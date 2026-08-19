const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');
const fcm = require('../fcm');

const router = express.Router();

async function getSalonUserIds(userId) {
  const stylist = await DB.stylists.findOne(s => s.user_id === userId);
  if (!stylist) return null;
  const all = await DB.stylists.find(s => s.salon_id === stylist.salon_id);
  return { salonId: stylist.salon_id, userIds: all.map(s => s.user_id).filter(id => id != null) };
}

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const user = await DB.users.findById(uid);

    if (user?.role === 'stylist') {
      const salon = await getSalonUserIds(uid);
      if (!salon) return res.json([]);

      const { rows: msgs } = await query(
        'SELECT * FROM messages WHERE sender_id = ANY($1) OR receiver_id = ANY($1)',
        [salon.userIds]
      );

      const convMap = {};
      msgs.forEach(m => {
        const isFromSalon = salon.userIds.includes(m.sender_id);
        const clientId = isFromSalon ? m.receiver_id : m.sender_id;
        if (!convMap[clientId] || new Date(m.created_at) > new Date(convMap[clientId].last_time)) {
          convMap[clientId] = { other_id: clientId, last_message: m.content, last_time: m.created_at };
        }
      });

      const convs = await Promise.all(Object.values(convMap).map(async c => {
        const other = await DB.users.findById(c.other_id);
        const unread = msgs.filter(m =>
          !salon.userIds.includes(m.sender_id) &&
          salon.userIds.includes(m.receiver_id) &&
          m.sender_id === c.other_id &&
          !m.is_read
        ).length;
        return { ...c, other_name: other?.name, other_avatar: other?.avatar, unread_count: unread };
      }));

      return res.json(convs.sort((a, b) => new Date(b.last_time) - new Date(a.last_time)));
    }

    const { rows: msgs } = await query('SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1', [uid]);
    const convMap = {};
    msgs.forEach(m => {
      const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!convMap[otherId] || new Date(m.created_at) > new Date(convMap[otherId].last_time)) {
        convMap[otherId] = { other_id: otherId, last_message: m.content, last_time: m.created_at };
      }
    });

    // Batch-fetch the "other" users + any salon they belong to (was 2 full scans per conversation).
    const otherIds = Object.keys(convMap).map(Number);
    let userMap = {}, salonByUser = {};
    if (otherIds.length) {
      (await query('SELECT id, name, avatar, role FROM users WHERE id = ANY($1)', [otherIds])).rows.forEach(u => { userMap[u.id] = u; });
      const stRows = (await query('SELECT user_id, salon_id FROM stylists WHERE user_id = ANY($1)', [otherIds])).rows;
      const salonIds = [...new Set(stRows.map(s => s.salon_id))];
      const salonMap = {};
      if (salonIds.length) (await query('SELECT id, name, cover_emoji FROM salons WHERE id = ANY($1)', [salonIds])).rows.forEach(s => { salonMap[s.id] = s; });
      stRows.forEach(s => { if (salonMap[s.salon_id]) salonByUser[s.user_id] = salonMap[s.salon_id]; });
    }
    const convs = Object.values(convMap).map(c => {
      const other = userMap[c.other_id];
      const salon = salonByUser[c.other_id];
      const unread = msgs.filter(m => m.sender_id === c.other_id && m.receiver_id === uid && !m.is_read).length;
      return {
        ...c,
        other_name: salon ? salon.name : (other?.name || ''),
        other_avatar: salon ? (salon.cover_emoji || '💅') : other?.avatar,
        other_role: other?.role,
        unread_count: unread,
      };
    });

    res.json(convs.sort((a, b) => new Date(b.last_time) - new Date(a.last_time)));
  } catch (e) {
    console.error('GET /conversations error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/:other_id', authenticate, async (req, res) => {
  try {
    const uid = req.user.id;
    const otherId = parseInt(req.params.other_id);
    const user = await DB.users.findById(uid);

    let msgs;
    if (user?.role === 'stylist') {
      const salon = await getSalonUserIds(uid);
      if (salon) {
        msgs = (await query(
          `SELECT * FROM messages WHERE (sender_id = ANY($1) AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = ANY($1))`,
          [salon.userIds, otherId]
        )).rows;
        await query(`UPDATE messages SET is_read=1 WHERE sender_id=$1 AND receiver_id = ANY($2) AND is_read=0`, [otherId, salon.userIds]);
      } else {
        msgs = [];
      }
    } else {
      const salon = await getSalonUserIds(otherId);
      if (salon) {
        msgs = (await query(
          `SELECT * FROM messages WHERE (sender_id = $1 AND receiver_id = ANY($2)) OR (sender_id = ANY($2) AND receiver_id = $1)`,
          [uid, salon.userIds]
        )).rows;
        await query(`UPDATE messages SET is_read=1 WHERE sender_id = ANY($1) AND receiver_id=$2 AND is_read=0`, [salon.userIds, uid]);
      } else {
        msgs = (await query(
          `SELECT * FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)`,
          [uid, otherId]
        )).rows;
        await query(`UPDATE messages SET is_read=1 WHERE sender_id=$1 AND receiver_id=$2 AND is_read=0`, [otherId, uid]);
      }
    }

    const result = await Promise.all(
      msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(async m => {
          const sender = await DB.users.findById(m.sender_id);
          return { ...m, sender_name: sender?.name, sender_avatar: sender?.avatar };
        })
    );

    res.json(result);
  } catch (e) {
    console.error('GET /messages/:other_id error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { receiver_id, content, booking_id, msg_type = 'text', media_url = null } = req.body;
    if (!receiver_id) return res.status(400).json({ error: 'مستقبل مجهول' });

    const textContent = (msg_type === 'text') ? (content || '').trim() : (content || '').trim();
    if (msg_type === 'text' && !textContent) return res.status(400).json({ error: 'الرسالة فارغة' });
    if (msg_type === 'text' && textContent.length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جداً' });

    const { query } = require('../database');
    const msg = await query(
      `INSERT INTO messages (sender_id, receiver_id, booking_id, content, msg_type, media_url)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, parseInt(receiver_id), booking_id || null, textContent || '', msg_type, media_url]
    ).then(r => r.rows[0]);

    const sender = await DB.users.findById(req.user.id);
    const receiver = await DB.users.findById(parseInt(receiver_id));

    const notifBody = msg_type === 'voice' ? '🎤 رسالة صوتية' : msg_type === 'image' ? '📷 صورة' : textContent.slice(0, 60);
    req.io?.to(`user_${receiver_id}`).emit('new_message', { ...msg, sender_name: sender?.name });  // always — appears in the open chat
    // Skip the notification if the recipient is already viewing this exact conversation.
    const viewing = req.io?.activeConv?.get(parseInt(receiver_id)) === req.user.id;
    if (!viewing) {
      await DB.notifications.insert({ user_id: parseInt(receiver_id), title: `رسالة من ${sender?.name || 'مستخدمة'} 💬`, body: notifBody, type: 'message', ref_id: req.user.id });
      req.io?.to(`user_${receiver_id}`).emit('new_notif', { type: 'message', sender_id: req.user.id });
      if (receiver?.fcm_token) {
        fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة', req.user.id).catch(() => {});
      }
    }

    // Auto-bot: reply to common questions when the receiver is a stylist-linked user
    const receiverUser = receiver;
    if (receiverUser?.role === 'stylist' && msg_type === 'text') {
      const autoReply = getAutoReply(textContent);
      if (autoReply) {
        setTimeout(async () => {
          try {
            const bot = await query(
              `INSERT INTO messages (sender_id, receiver_id, content, msg_type) VALUES ($1,$2,$3,'text') RETURNING *`,
              [parseInt(receiver_id), req.user.id, autoReply]
            ).then(r => r.rows[0]);
            req.io?.to(`user_${req.user.id}`).emit('new_message', { ...bot, sender_name: sender?.name || 'الصالون', is_bot: true });
          } catch {}
        }, 1200);
      }
    }

    res.status(201).json({ ...msg, sender_name: sender?.name });
  } catch (e) {
    console.error('POST /messages error:', e);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

// Mark messages as seen and notify sender
router.post('/seen/:sender_id', authenticate, async (req, res) => {
  try {
    const { query } = require('../database');
    const senderId = parseInt(req.params.sender_id);
    const now = new Date().toISOString();
    await query(
      `UPDATE messages SET is_read=1, seen_at=NOW() WHERE sender_id=$1 AND receiver_id=$2 AND is_read=0`,
      [senderId, req.user.id]
    );
    req.io?.to(`user_${senderId}`).emit('messages_seen', { by: req.user.id, at: now });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

const FAQ_TRIGGERS = [
  { words: ['سعر','أسعار','كم تكلف','بكم','التكلفة'], reply: 'أهلاً! يمكنك الاطلاع على أسعارنا من قسم الخدمات في صفحة الصالون 💅' },
  { words: ['وقت','متى','مواعيد','دوام','ساعات العمل'], reply: 'أوقات الدوام موضحة في صفحة الصالون ضمن تبويب "المواعيد" 🕐' },
  { words: ['حجز','أحجز','أقدر أحجز','أريد حجز'], reply: 'يمكنك الحجز مباشرة من صفحة الصالون > اختاري الخدمة > اضغطي حجز 📅' },
  { words: ['إلغاء','ألغي','ألغ الحجز'], reply: 'لإلغاء الحجز، اذهبي إلى "حجوزاتي" وافتحي الحجز واضغطي إلغاء ❌' },
  { words: ['عنوان','وين','أين','الموقع','لوكيشن'], reply: 'موقعنا موضح في صفحة الصالون، يمكنك الضغط على الخريطة للوصول إلينا 📍' },
  { words: ['شكراً','شكرا','تسلمي','يعطيكي العافية'], reply: 'العفو! نتشرف بخدمتك دائماً 🌸' },
  { words: ['مرحبا','أهلا','هلا','السلام'], reply: 'أهلاً وسهلاً! كيف يمكنني مساعدتك؟ 💖' },
];

function getAutoReply(text) {
  const t = text.toLowerCase();
  for (const faq of FAQ_TRIGGERS) {
    if (faq.words.some(w => t.includes(w))) return faq.reply;
  }
  return null;
}

module.exports = router;
