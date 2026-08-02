const express = require('express');
const { DB } = require('../database');
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
    const user = await DB.users.findOne(u => u.id === uid);

    if (user?.role === 'stylist') {
      const salon = await getSalonUserIds(uid);
      if (!salon) return res.json([]);

      const msgs = await DB.messages.find(m =>
        salon.userIds.includes(m.sender_id) || salon.userIds.includes(m.receiver_id)
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
        const other = await DB.users.findOne(u => u.id === c.other_id);
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

    const msgs = await DB.messages.find(m => m.sender_id === uid || m.receiver_id === uid);
    const convMap = {};
    msgs.forEach(m => {
      const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
      if (!convMap[otherId] || new Date(m.created_at) > new Date(convMap[otherId].last_time)) {
        convMap[otherId] = { other_id: otherId, last_message: m.content, last_time: m.created_at };
      }
    });

    const convs = await Promise.all(Object.values(convMap).map(async c => {
      const other = await DB.users.findOne(u => u.id === c.other_id);
      const unread = msgs.filter(m => m.sender_id === c.other_id && m.receiver_id === uid && !m.is_read).length;
      const stylist = await DB.stylists.findOne(s => s.user_id === c.other_id);
      const salon = stylist ? await DB.salons.findOne(s => s.id === stylist.salon_id) : null;
      return {
        ...c,
        other_name: salon ? salon.name : (other?.name || ''),
        other_avatar: salon ? (salon.cover_emoji || '💅') : other?.avatar,
        other_role: other?.role,
        unread_count: unread
      };
    }));

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
    const user = await DB.users.findOne(u => u.id === uid);

    let msgs;
    if (user?.role === 'stylist') {
      const salon = await getSalonUserIds(uid);
      if (salon) {
        msgs = await DB.messages.find(m =>
          (salon.userIds.includes(m.sender_id) && m.receiver_id === otherId) ||
          (m.sender_id === otherId && salon.userIds.includes(m.receiver_id))
        );
        await DB.messages.update(
          m => m.sender_id === otherId && salon.userIds.includes(m.receiver_id),
          { is_read: 1 }
        );
      } else {
        msgs = [];
      }
    } else {
      const salon = await getSalonUserIds(otherId);
      if (salon) {
        msgs = await DB.messages.find(m =>
          (m.sender_id === uid && salon.userIds.includes(m.receiver_id)) ||
          (salon.userIds.includes(m.sender_id) && m.receiver_id === uid)
        );
        await DB.messages.update(
          m => salon.userIds.includes(m.sender_id) && m.receiver_id === uid,
          { is_read: 1 }
        );
      } else {
        msgs = await DB.messages.find(m =>
          (m.sender_id === uid && m.receiver_id === otherId) ||
          (m.sender_id === otherId && m.receiver_id === uid)
        );
        await DB.messages.update(m => m.sender_id === otherId && m.receiver_id === uid, { is_read: 1 });
      }
    }

    const result = await Promise.all(
      msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(async m => {
          const sender = await DB.users.findOne(u => u.id === m.sender_id);
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
    const { receiver_id, content, booking_id } = req.body;
    if (!receiver_id || !content?.trim()) return res.status(400).json({ error: 'الرسالة فارغة' });
    // ✅ SECURITY: message length limit
    if (content.trim().length > 2000) return res.status(400).json({ error: 'الرسالة طويلة جداً (الحد الأقصى 2000 حرف)' });

    const msg = await DB.messages.insert({
      sender_id: req.user.id,
      receiver_id: parseInt(receiver_id),
      booking_id: booking_id || null,
      content: content.trim()
    });
    const sender = await DB.users.findOne(u => u.id === req.user.id);
    const receiver = await DB.users.findOne(u => u.id === parseInt(receiver_id));

    await DB.notifications.insert({ user_id: parseInt(receiver_id), title: `رسالة من ${sender?.name || 'مستخدمة'} 💬`, body: content.trim().slice(0, 60), type: 'message' });
    req.io?.to(`user_${receiver_id}`).emit('new_notif', { type: 'message', sender_id: req.user.id });
    req.io?.to(`user_${receiver_id}`).emit('new_message', { ...msg, sender_name: sender?.name });
    if (receiver?.fcm_token) {
      fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة').catch(() => {});
    }

    res.status(201).json({ ...msg, sender_name: sender?.name });
  } catch (e) {
    console.error('POST /messages error:', e);
    res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

module.exports = router;
