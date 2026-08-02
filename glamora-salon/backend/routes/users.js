const express = require('express');
const bcrypt = require('bcryptjs');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

router.get('/loyalty', authenticate, async (req, res) => {
  try {
    const user = await DB.users.findOne(u => u.id === req.user.id);
    const transactions = (await DB.loyalty_transactions.find(t => t.user_id === req.user.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
    const tier = getTier(user?.loyalty_points || 0);
    res.json({ points: user?.loyalty_points || 0, tier, transactions });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/notifications', authenticate, async (req, res) => {
  try {
    const notifs = (await DB.notifications.find(n => n.user_id === req.user.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 30);
    res.json(notifs);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.put('/notifications/read', authenticate, async (req, res) => {
  try {
    await DB.notifications.update(n => n.user_id === req.user.id, { is_read: 1 });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/color-history', authenticate, async (req, res) => {
  try {
    const formulas = await DB.color_formulas.find(f => f.client_id === req.user.id);
    formulas.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const result = await Promise.all(formulas.map(async f => {
      const stylist = await DB.stylists.findOne(s => s.id === f.stylist_id);
      const stylistUser = stylist ? await DB.users.findOne(u => u.id === stylist.user_id) : null;
      const salon = stylist ? await DB.salons.findOne(s => s.id === stylist.salon_id) : null;
      return { ...f, stylist_name: stylistUser?.name, salon_name: salon?.name };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password) updates.password_hash = await bcrypt.hash(password, 12);
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'لا يوجد تحديثات' });

    await DB.users.update(u => u.id === req.user.id, updates);
    const user = await DB.users.findOne(u => u.id === req.user.id);
    res.json({ success: true, user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: 'خطأ في تحديث الملف الشخصي' });
  }
});

router.post('/fcm-token', authenticate, async (req, res) => {
  try {
    const { token, platform } = req.body;
    console.log(`[FCM] Token received for user ${req.user.id} | platform: ${platform} | token: ${token ? token.substring(0, 30) + '...' : 'NULL'}`);
    if (!token) return res.status(400).json({ error: 'Token مطلوب' });

    // Remove token from other users
    await query('UPDATE users SET fcm_token=NULL, fcm_platform=NULL WHERE fcm_token=$1 AND id!=$2', [token, req.user.id]);

    await DB.users.update(u => u.id === req.user.id, {
      fcm_token: token,
      fcm_platform: platform || 'web',
      fcm_updated_at: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.delete('/fcm-token', authenticate, async (req, res) => {
  try {
    await DB.users.update(u => u.id === req.user.id, { fcm_token: null, fcm_platform: null });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

function getTier(points) {
  if (points >= 1000) return { name: 'بلاتيني', min: 1000, next: null, color: '#B8A9C9' };
  if (points >= 500) return { name: 'ذهبي', min: 500, next: 1000, color: '#C9A96E' };
  if (points >= 200) return { name: 'فضي', min: 200, next: 500, color: '#B0B7BE' };
  return { name: 'وردي', min: 0, next: 200, color: '#F4A0B5' };
}

module.exports = router;
