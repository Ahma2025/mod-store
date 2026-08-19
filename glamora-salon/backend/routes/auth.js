const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { DB, query } = require('../database');

const router = express.Router();
// ✅ SECURITY: No fallback — server.js already enforces JWT_SECRET presence at startup
const SECRET = process.env.JWT_SECRET;

router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    if (!name || !phone || !password) return res.status(400).json({ error: 'بيانات ناقصة' });

    const exists = await DB.users.findByPhone(phone);
    if (exists) return res.status(409).json({ error: 'رقم الهاتف مسجل مسبقاً' });

    // ✅ SECURITY: only 'client' or 'stylist' may self-register — never admin/salon_owner.
    const safeRole = role === 'stylist' ? 'stylist' : 'client';
    const hash = await bcrypt.hash(password, 10);   // cost 10: secure + ~4× faster than 12
    const user = await DB.users.insert({ name, phone, email: email || null, password_hash: hash, role: safeRole, loyalty_points: 50 });

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

    const user = await DB.users.findByPhone(phone);
    const validPassword = user && await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'رقم الهاتف أو كلمة المرور غلط' });
    }

    // Opportunistically down-cost legacy hashes (12 → 10) so future logins are faster.
    try {
      const rounds = parseInt((user.password_hash || '').split('$')[2], 10);
      if (rounds > 10) {
        const nh = await bcrypt.hash(password, 10);
        await query('UPDATE users SET password_hash=$1 WHERE id=$2', [nh, user.id]);
      }
    } catch (e) { /* never block login on a rehash failure */ }

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
    const user = await DB.users.findById(req.user.id);
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
