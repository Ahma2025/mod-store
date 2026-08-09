const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

router.get('/me/color-history', authenticate, async (req, res) => {
  try {
    const formulas = await DB.color_formulas.find(f => f.client_id === req.user.id);
    formulas.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
    const result = await Promise.all(formulas.map(async f => {
      const stylist = await DB.stylists.findOne(s => s.id === f.stylist_id);
      const stylistUser = stylist ? await DB.users.findById(stylist.user_id) : null;
      const salon = stylist ? await DB.salons.findOne(s => s.id === stylist.salon_id) : null;
      return { ...f, stylist_name: stylistUser?.name, stylist_avatar: stylistUser?.avatar, salon_name: salon?.name };
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(s => s.id === id);
    if (!stylist) return res.status(404).json({ error: 'الكوفيرة غير موجودة' });

    const user = await DB.users.findById(stylist.user_id);
    const salon = stylist.salon_id ? await DB.salons.findOne(s => s.id === stylist.salon_id) : null;
    const services = await DB.services.find(s => s.stylist_id === id && s.is_active === 1);
    const allReviews = await DB.reviews.find(r => r.stylist_id === id);
    const reviews = await Promise.all(
      allReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15)
        .map(async r => {
          const u = await DB.users.findById(r.client_id);
          return { ...r, client_name: u?.name };
        })
    );
    const availability = (await DB.stylist_availability.find(a => a.stylist_id === id)).sort((a, b) => a.day_of_week - b.day_of_week);

    let specs = [];
    try { specs = JSON.parse(stylist.specialties || '[]'); } catch {}

    // ✅ SECURITY: phone and email stripped explicitly (...stylist spread may include them from DB columns)
    const { phone: _p, email: _e, ...stylistSafe } = stylist;
    res.json({ ...stylistSafe, specialties: specs, name: user?.name, avatar: user?.avatar, salon_name: salon?.name, salon_address: salon?.address, services, reviews, availability });
  } catch (e) {
    console.error('GET /stylists/:id error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/color-formula', authenticate, async (req, res) => {
  try {
    const { client_id, formula, color_name, notes, visit_date } = req.body;
    const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const cf = await DB.color_formulas.insert({ client_id: parseInt(client_id), stylist_id: stylist.id, formula, color_name, notes, visit_date });
    res.status(201).json(cf);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;
