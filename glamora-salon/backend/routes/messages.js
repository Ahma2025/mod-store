const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');
const fcm = require('../fcm');

const router = express.Router();

router.get('/conversations', authenticate, (req, res) => {
  const uid = req.user.id;
  const msgs = DB.messages.find(m => m.sender_id === uid || m.receiver_id === uid);

  const convMap = {};
  msgs.forEach(m => {
    const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
    if (!convMap[otherId] || new Date(m.created_at) > new Date(convMap[otherId].last_time)) {
      convMap[otherId] = { other_id: otherId, last_message: m.content, last_time: m.created_at };
    }
  });

  const convs = Object.values(convMap).map(c => {
    const other = DB.users.findOne(u => u.id === c.other_id);
    const unread = msgs.filter(m => m.sender_id === c.other_id && m.receiver_id === uid && !m.is_read).length;
    return { ...c, other_name: other?.name, other_avatar: other?.avatar, other_role: other?.role, unread_count: unread };
  }).sort((a,b) => new Date(b.last_time) - new Date(a.last_time));

  res.json(convs);
});

router.get('/:other_id', authenticate, (req, res) => {
  const uid = req.user.id;
  const otherId = parseInt(req.params.other_id);
  const msgs = DB.messages.find(m => (m.sender_id === uid && m.receiver_id === otherId) || (m.sender_id === otherId && m.receiver_id === uid))
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    .map(m => { const sender = DB.users.findOne(u => u.id === m.sender_id); return { ...m, sender_name: sender?.name, sender_avatar: sender?.avatar }; });

  DB.messages.update(m => m.sender_id === otherId && m.receiver_id === uid, { is_read: 1 });
  res.json(msgs);
});

router.post('/', authenticate, async (req, res) => {
  const { receiver_id, content, booking_id } = req.body;
  if (!receiver_id || !content?.trim()) return res.status(400).json({ error: 'الرسالة فارغة' });

  const msg = DB.messages.insert({ sender_id: req.user.id, receiver_id: parseInt(receiver_id), booking_id: booking_id || null, content: content.trim() });
  const sender = DB.users.findOne(u => u.id === req.user.id);

  // FCM push notification to receiver
  const receiver = DB.users.findOne(u => u.id === parseInt(receiver_id));
  if (receiver?.fcm_token) {
    fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة').catch(() => {});
  }

  res.status(201).json({ ...msg, sender_name: sender?.name });
});

module.exports = router;
