const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DB } = require('../database');

const router = express.Router();
// ✅ SECURITY: No fallback — server.js already enforces JWT_SECRET presence at startup
const SECRET = process.env.JWT_SECRET;

router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

    const exists = await DB.users.findOne(u => u.phone === phone);
    if (exists) return res.status(409).json({ error: 'رقم الهاتف مسجل مسبقاً' });

    // ✅ SECURITY: role always 'client' on registration — never from request body
    const hash = await bcrypt.hash(password, 12);
    const user = await DB.users.insert({ name, phone, email: email || null, password_hash: hash, role: 'client', loyalty_points: 50 });

    await DB.loyalty_transactions.insert({ user_id: user.id, points: 50, type: 'earned', description: 'مكافأة التسجيل 🎉' });
    await DB.notifications.insert({ user_id: user.id, title: 'أهلاً بك في Glamora 🌸', body: 'كسبتِ 50 نقطة كمكافأة تسجيل!', type: 'loyalty' });

    // ✅ SECURITY: 7d expiry instead of 30d
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    console.error('register error:', e);
    res.status(500).json({ error: 'خطأ في التسجيل' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: 'أدخلي رقم الهاتف وكلمة المرور' });

    const user = await DB.users.findOne(u => u.phone === phone);
    const validPassword = user && await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غلط' });
    }

    // ✅ SECURITY: 7d expiry instead of 30d
    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await DB.users.findOne(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const { password_hash, ...safeUser } = user;
    res.json(safeUser);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'غير مصرح' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'جلسة منتهية، سجلي دخولك مجدداً' });
  }
}

module.exports = router;
module.exports.authenticate = authenticate;
