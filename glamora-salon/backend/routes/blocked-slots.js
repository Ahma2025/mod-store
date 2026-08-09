const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (!stylist) return res.json([]);

    const allStylists = await DB.stylists.find(st => st.salon_id === stylist.salon_id);
    const salonStylistIds = allStylists.map(s => s.id);

    const { date } = req.query;
    let blocks = await DB.stylist_blocked_slots.find(b => salonStylistIds.includes(b.stylist_id));
    if (date) blocks = blocks.filter(b => b.date === date);

    const today = new Date().toISOString().split('T')[0];
    blocks = blocks.filter(b => b.date >= today).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    const result = await Promise.all(blocks.map(async b => {
      const st = await DB.stylists.findOne(s => s.id === b.stylist_id);
      const user = st ? await DB.users.findById(st.user_id) : null;
      return { ...b, stylist_name: user?.name };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { date, start_time, end_time, reason, stylist_id } = req.body;
    if (!date || !start_time || !end_time) return res.status(400).json({ error: 'التاريخ والوقت مطلوبان' });

    const myStyleist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (!myStyleist) return res.status(403).json({ error: 'غير مصرح' });

    let stylist = myStyleist;
    if (stylist_id && stylist_id !== myStyleist.id) {
      const target = await DB.stylists.findOne(st => st.id === parseInt(stylist_id) && st.salon_id === myStyleist.salon_id);
      if (!target) return res.status(403).json({ error: 'الكوفيرة غير موجودة في صالونك' });
      stylist = target;
    }

    const exists = await DB.stylist_blocked_slots.findOne(b =>
      b.stylist_id === stylist.id && b.date === date &&
      b.start_time === start_time && b.end_time === end_time
    );
    if (exists) return res.status(409).json({ error: 'هذا الوقت محجوب بالفعل' });

    const block = await DB.stylist_blocked_slots.insert({ stylist_id: stylist.id, date, start_time, end_time, reason: reason || '' });
    res.status(201).json({ block });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const blockId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const block = await DB.stylist_blocked_slots.findOne(b => b.id === blockId && b.stylist_id === stylist.id);
    if (!block) return res.status(404).json({ error: 'غير موجود' });

    await DB.stylist_blocked_slots.remove(b => b.id === blockId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;
