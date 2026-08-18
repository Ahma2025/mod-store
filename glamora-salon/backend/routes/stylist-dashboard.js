const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

router.get('/my-salon', authenticate, async (req, res) => {
  try {
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (!stylist) return res.json({ salon: null, stylist: null });

    const salon = await DB.salons.findOne(s => s.id === stylist.salon_id);
    if (!salon) return res.json({ salon: null, stylist });

    const hours = (await DB.salon_hours.find(h => h.salon_id === salon.id)).sort((a, b) => a.day_of_week - b.day_of_week);
    const rawStylists = await DB.stylists.find(st => st.salon_id === salon.id && st.is_active === 1);
    const stylists = await Promise.all(rawStylists.map(async st => {
      const user = st.user_id ? await DB.users.findById(st.user_id) : null;
      const availability = (await DB.stylist_availability.find(a => a.stylist_id === st.id)).sort((a, b) => a.day_of_week - b.day_of_week);
      return { ...st, name: user?.name || st.name, phone: user?.phone || st.phone, email: user?.email || st.email, availability };
    }));
    const services = (await DB.services.find(s => s.salon_id === salon.id && s.is_active === 1)).sort((a, b) => a.price - b.price);

    res.json({ salon: { ...salon, hours, services }, stylists, my_stylist: stylist });
  } catch (e) {
    console.error('GET /my-salon error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/salon', authenticate, async (req, res) => {
  try {
    const { name, description, address, city, phone, cover_emoji } = req.body;
    if (!name || !address || !city) return res.status(400).json({ error: 'الاسم والعنوان والمدينة مطلوبة' });

    const existingStylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (existingStylist?.salon_id) {
      const existing = await DB.salons.findOne(s => s.id === existingStylist.salon_id);
      if (existing) return res.status(409).json({ error: 'لديك صالون مسجل بالفعل' });
    }

    const salon = await DB.salons.insert({ name, description: description || '', address, city, phone: phone || '', cover_emoji: cover_emoji || '💅', rating: 0, reviews_count: 0 });

    let stylist = existingStylist;
    if (!stylist) {
      stylist = await DB.stylists.insert({ user_id: req.user.id, salon_id: salon.id, bio: '', specialties: '[]', experience_years: 1, rating: 0, reviews_count: 0 });
    } else {
      await DB.stylists.update(st => st.id === stylist.id, { salon_id: salon.id });
    }

    res.status(201).json({ salon, stylist });
  } catch (e) {
    console.error('POST /salon error:', e);
    res.status(500).json({ error: 'خطأ في إنشاء الصالون' });
  }
});

router.put('/salon/:id', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id && st.salon_id === salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const { name, description, address, city, phone, cover_emoji } = req.body;
    const salon = await DB.salons.findOne(s => s.id === salonId);
    if (!salon) return res.status(404).json({ error: 'الصالون غير موجود' });

    const updates = {
      name: name || salon.name,
      description: description !== undefined ? description : salon.description,
      address: address || salon.address,
      city: city || salon.city,
      phone: phone !== undefined ? phone : salon.phone,
      cover_emoji: cover_emoji || salon.cover_emoji
    };
    await DB.salons.update(s => s.id === salonId, updates);
    const updated = await DB.salons.findOne(s => s.id === salonId);
    res.json({ salon: updated });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/reviews/:id/reply', authenticate, async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);
    const { reply_text } = req.body;
    if (!reply_text?.trim()) return res.status(400).json({ error: 'الرد فارغ' });
    // verify review belongs to this stylist's salon
    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });
    const review = await DB.salon_ratings.findOne(r => r.id === reviewId && r.salon_id === stylist.salon_id);
    if (!review) return res.status(404).json({ error: 'التقييم غير موجود' });
    await query(`UPDATE salon_ratings SET reply_text=$1, replied_at=NOW() WHERE id=$2`, [reply_text.trim(), reviewId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ في الرد' });
  }
});

router.put('/salon/:id/categories', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });
    const { categories } = req.body;
    if (!Array.isArray(categories)) return res.status(400).json({ error: 'categories يجب أن تكون مصفوفة' });
    await query('UPDATE salons SET categories=$1 WHERE id=$2', [JSON.stringify(categories), salonId]);
    res.json({ categories });
  } catch (e) {
    res.status(500).json({ error: 'خطأ في حفظ التخصصات' });
  }
});

router.post('/salon/:id/hours', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id && st.salon_id === salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const { hours } = req.body;
    if (!Array.isArray(hours)) return res.status(400).json({ error: 'hours يجب أن يكون مصفوفة' });

    for (const h of hours) {
      await query(
        `INSERT INTO salon_hours (salon_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [salonId, h.day_of_week, h.open_time || '09:00', h.close_time || '20:00', h.is_closed ? 1 : 0]
      );
      await query(
        `UPDATE salon_hours SET open_time=$3, close_time=$4, is_closed=$5 WHERE salon_id=$1 AND day_of_week=$2`,
        [salonId, h.day_of_week, h.open_time || '09:00', h.close_time || '20:00', h.is_closed ? 1 : 0]
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/salon/:id/services', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id && st.salon_id === salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const { name_ar, name, category, price, duration_minutes, description } = req.body;
    if (!name_ar || !category || !price || !duration_minutes)
      return res.status(400).json({ error: 'بيانات الخدمة ناقصة' });

    const service = await DB.services.insert({
      salon_id: salonId,
      stylist_id: stylist.id,
      name: name || name_ar,
      name_ar,
      category,
      price: parseFloat(price),
      duration_minutes: parseInt(duration_minutes),
      description: description || ''
    });

    res.status(201).json({ service });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.put('/services/:id', authenticate, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await DB.services.findOne(s => s.id === serviceId);
    if (!service) return res.status(404).json({ error: 'الخدمة غير موجودة' });

    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id && st.salon_id === service.salon_id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    const { name_ar, name, category, price, duration_minutes, description } = req.body;
    const updates = {
      name_ar: name_ar || service.name_ar,
      name: name || name_ar || service.name,
      category: category || service.category,
      price: price ? parseFloat(price) : service.price,
      duration_minutes: duration_minutes ? parseInt(duration_minutes) : service.duration_minutes,
      description: description !== undefined ? description : service.description
    };
    await DB.services.update(s => s.id === serviceId, updates);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.delete('/services/:id', authenticate, async (req, res) => {
  try {
    const serviceId = parseInt(req.params.id);
    const service = await DB.services.findOne(s => s.id === serviceId);
    if (!service) return res.status(404).json({ error: 'الخدمة غير موجودة' });

    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id && st.salon_id === service.salon_id);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });

    await DB.services.update(s => s.id === serviceId, { is_active: 0 });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/salon/:id/stylists', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const owner = await DB.stylists.findOne(st => st.user_id == req.user.id && st.salon_id == salonId);
    if (!owner) return res.status(403).json({ error: 'غير مصرح - أنت لا تملك هذا الصالون' });

    const { name, phone, bio, specialties, experience_years } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الكوفيرة مطلوب' });

    const existingSt = await DB.stylists.findOne(st => st.salon_id === salonId && st.name === name && st.user_id === null);
    if (existingSt) return res.status(409).json({ error: 'هذه الكوفيرة مضافة بالفعل' });

    const stylist = await DB.stylists.insert({
      user_id: null,
      salon_id: salonId,
      name,
      phone: phone || '',
      bio: bio || '',
      specialties: JSON.stringify(specialties || []),
      experience_years: parseInt(experience_years) || 1,
      rating: 0,
      reviews_count: 0
    });

    res.status(201).json({ stylist });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.post('/stylist/:id/availability', authenticate, async (req, res) => {
  try {
    const stylistId = parseInt(req.params.id);
    const st = await DB.stylists.findOne(s => s.id === stylistId);
    if (!st) return res.status(404).json({ error: 'الكوفيرة غير موجودة' });

    const owner = await DB.stylists.findOne(s => s.user_id === req.user.id && s.salon_id === st.salon_id);
    const isSelf = st.user_id === req.user.id;
    if (!owner && !isSelf) return res.status(403).json({ error: 'غير مصرح' });

    const { availability } = req.body;
    if (!Array.isArray(availability)) return res.status(400).json({ error: 'availability يجب أن يكون مصفوفة' });

    for (const a of availability) {
      await DB.stylist_availability.insert({
        stylist_id: stylistId,
        day_of_week: a.day_of_week,
        is_off: a.is_off ? 1 : 0,
        start_time: a.start_time || '09:00',
        end_time: a.end_time || '17:00',
        shift2_enabled: a.shift2_enabled ? 1 : 0,
        shift2_start: a.shift2_start || null,
        shift2_end: a.shift2_end || null
      });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/bookings', authenticate, async (req, res) => {
  try {
    const stylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    if (!stylist) return res.json([]);

    const { filter } = req.query;
    const allSalonStylists = await DB.stylists.find(st => st.salon_id === stylist.salon_id);
    const salonStylistIds = allSalonStylists.map(s => s.id);

    let bookings;
    if (filter === 'mine') {
      bookings = await DB.bookings.find(b => b.stylist_id === stylist.id);
    } else if (filter === 'pending') {
      bookings = await DB.bookings.find(b => salonStylistIds.includes(b.stylist_id) && b.status === 'pending');
    } else if (filter === 'confirmed') {
      bookings = await DB.bookings.find(b => salonStylistIds.includes(b.stylist_id) && b.status === 'confirmed');
    } else if (filter === 'today') {
      // all of today's appointments (Palestine time), pending + confirmed, any who booked for today
      const todayP = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      bookings = await DB.bookings.find(b => salonStylistIds.includes(b.stylist_id) && b.booking_date === todayP && b.status !== 'cancelled' && b.status !== 'rejected');
    } else {
      bookings = await DB.bookings.find(b => salonStylistIds.includes(b.stylist_id));
    }

    if (filter === 'today') {
      // earliest → latest by time
      bookings.sort((a, b) => (a.booking_time || '').localeCompare(b.booking_time || ''));
    } else {
      bookings.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (b.status === 'pending' && a.status !== 'pending') return 1;
        return new Date(b.booking_date + 'T' + b.booking_time) - new Date(a.booking_date + 'T' + a.booking_time);
      });
    }

    // ✅ SECURITY: client_phone and client_email are private — only expose to the assigned stylist or salon owner
    const currentStylist = await DB.stylists.findOne(st => st.user_id === req.user.id);
    const isOwner = currentStylist && await DB.stylists.findOne(s => s.salon_id === currentStylist.salon_id && s.user_id === req.user.id && s.id === currentStylist.id);

    const result = await Promise.all(bookings.map(async b => {
      const client = await DB.users.findById(b.client_id);
      const bStylist = await DB.stylists.findOne(s => s.id === b.stylist_id);
      const bStylistUser = bStylist?.user_id ? await DB.users.findById(bStylist.user_id) : null;
      const bStylistName = bStylist?.user_id ? bStylistUser?.name : bStylist?.name;
      const isAssignedStylist = bStylist?.user_id === req.user.id;
      const canSeeContact = isAssignedStylist || isOwner;
      // ALL services on this booking (multi-service support), not just the first one
      let ids = [];
      try { ids = b.service_ids ? JSON.parse(b.service_ids) : []; } catch (e) {}
      if (!ids.length && b.service_id) ids = [b.service_id];
      const svcs = (await Promise.all(ids.map(id => DB.services.findOne(s => s.id === parseInt(id))))).filter(Boolean);
      const services = svcs.map(s => ({ id: s.id, name: s.name_ar || s.name, category: s.category, price: parseFloat(s.price || 0), duration_minutes: s.duration_minutes || 0 }));
      const total_duration = b.total_duration || services.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const total_price = (b.total_price != null ? parseFloat(b.total_price) : services.reduce((sum, s) => sum + (s.price || 0), 0));
      return {
        ...b,
        client_name: client?.name,
        client_phone: canSeeContact ? client?.phone : undefined,
        client_email: canSeeContact ? client?.email : undefined,
        services,                                                   // full list [{name,category,price,duration_minutes}]
        service_name: services.map(s => s.name).join(' + ') || '-', // all names joined
        service_category: services[0]?.category,
        service_price: services[0]?.price,
        duration_minutes: services[0]?.duration_minutes,
        total_duration,
        total_price,
        stylist_name: bStylistName,
      };
    }));

    res.json(result);
  } catch (e) {
    console.error('GET /stylist/bookings error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

// ===== SALON OFFERS (feature #72) =====
router.get('/salon/:id/offers', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const { query } = require('../database');
    const offers = await query(`SELECT * FROM salon_offers WHERE salon_id=$1 AND is_active=1 ORDER BY created_at DESC`, [salonId]);
    res.json(offers.rows);
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

router.post('/salon/:id/offers', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const stylist = await DB.stylists.findOne(s => s.user_id == req.user.id && s.salon_id === salonId);
    if (!stylist) return res.status(403).json({ error: 'غير مصرح' });
    const { title, description = '', discount_percent = 0, valid_until = null } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'عنوان العرض مطلوب' });

    const { query } = require('../database');
    const offer = await query(
      `INSERT INTO salon_offers (salon_id, title, description, discount_percent, valid_until) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [salonId, title.trim(), description.trim(), discount_percent, valid_until]
    ).then(r => r.rows[0]);

    const salon = await DB.salons.findOne(s => s.id === salonId);
    // Notify all users in same city
    const fcm = require('../fcm');
    const cityUsers = await DB.users.find(u => u.role === 'client' && u.fcm_token);
    // Filter by city roughly: just send to clients who booked in this salon before
    const salonBookings = await DB.bookings.find(b => b.salon_id === salonId);
    const clientIds = [...new Set(salonBookings.map(b => b.client_id))];
    for (const cid of clientIds) {
      const client = await DB.users.findById(cid);
      if (client?.fcm_token) {
        fcm.notifySpecialOffer(client.fcm_token, salon?.name || 'صالون', title.trim()).catch(() => {});
      }
      await DB.notifications.insert({ user_id: cid, title: `عرض خاص من ${salon?.name || 'الصالون'} 🎁`, body: title.trim(), type: 'offer' });
      req.io?.to(`user_${cid}`).emit('new_notif', { type: 'offer' });
    }

    res.status(201).json({ offer, notified: clientIds.length });
  } catch (e) { console.error('POST offers error:', e); res.status(500).json({ error: 'خطأ' }); }
});

router.delete('/offers/:id', authenticate, async (req, res) => {
  try {
    const { query } = require('../database');
    await query(`UPDATE salon_offers SET is_active=0 WHERE id=$1`, [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

// ===== 59-61: ANALYTICS =====
router.get('/salon/:id/analytics', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const weekAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];

    const allBookings = await DB.bookings.find(b => b.salon_id === salonId);

    // A confirmed booking auto-completes once its appointment time has passed → its price
    // is then counted as earned revenue. (End = start time + service duration.)
    const nowMs = now.getTime();
    const endMs = (b) => {
      if (!b.booking_date) return 0;
      const t = /^\d{1,2}:\d{2}/.test(b.booking_time || '') ? b.booking_time.slice(0, 5) : '23:59';
      const start = new Date(`${b.booking_date}T${t}:00`).getTime();
      if (isNaN(start)) return 0;
      return start + (parseInt(b.total_duration) || 0) * 60000;
    };
    const isEarned = (b) => b.status === 'completed' || (b.status === 'confirmed' && endMs(b) <= nowMs);

    // "تصفير الدخل": only count income earned after the reset moment.
    const salon = await DB.salons.findOne(s => s.id === salonId);
    const resetMs = salon && salon.revenue_reset_at ? new Date(salon.revenue_reset_at).getTime() : 0;

    const earned = allBookings.filter(b => isEarned(b) && endMs(b) > resetMs);
    const sumIn = (pred) => earned.filter(pred).reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
    const todayRevenue = sumIn(b => b.booking_date === todayStr);
    const weekRevenue  = sumIn(b => b.booking_date >= weekAgo);
    const monthRevenue = sumIn(b => b.booking_date >= monthAgo);
    const totalRevenue = sumIn(() => true);

    // Demand stats (top service / busiest hour) count every real booking that reflects
    // demand — everything except cancelled/rejected — so they populate from day one.
    const demand = allBookings.filter(b => b.status !== 'cancelled' && b.status !== 'rejected');

    // 60 — most requested service
    const serviceCounts = {};
    demand.forEach(b => {
      let ids = [];
      try { ids = b.service_ids ? JSON.parse(b.service_ids) : (b.service_id ? [b.service_id] : []); }
      catch (_) { ids = b.service_id ? [b.service_id] : []; }
      ids.forEach(id => { serviceCounts[id] = (serviceCounts[id] || 0) + 1; });
    });
    const topServiceId = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topService = topServiceId ? await DB.services.findOne(s => s.id === parseInt(topServiceId)) : null;

    // 61 — busiest booking hour
    const hourCounts = {};
    demand.forEach(b => {
      const h = b.booking_time?.split(':')[0];
      if (h) hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const topHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

    // Total bookings counts (respecting the auto-complete rule)
    const pending = allBookings.filter(b => b.status === 'pending').length;
    const confirmed = allBookings.filter(b => b.status === 'confirmed' && !isEarned(b)).length; // still upcoming
    const completed = allBookings.filter(b => isEarned(b)).length;

    res.json({
      revenue: { today: todayRevenue, week: weekRevenue, month: monthRevenue, total: totalRevenue },
      top_service: topService ? { name: topService.name_ar || topService.name, count: serviceCounts[topServiceId] } : null,
      busiest_hour: topHour ? `${topHour}:00` : null,
      bookings: { pending, confirmed, completed, total: allBookings.length }
    });
  } catch (e) { console.error('analytics error:', e); res.status(500).json({ error: 'خطأ' }); }
});

// Reset revenue counter (تصفير الدخل) — owner only. Income earned before now stops counting.
router.post('/salon/:id/revenue-reset', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === salonId && s.user_id === req.user.id);
    if (!ownerStylist && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    await DB.salons.update(s => s.id === salonId, { revenue_reset_at: new Date().toISOString() });
    res.json({ ok: true });
  } catch (e) { console.error('revenue-reset error:', e); res.status(500).json({ error: 'خطأ' }); }
});

// Set per-region delivery prices for the shop (owner only)
router.put('/salon/:id/delivery-prices', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id, 10);
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === salonId && s.user_id === req.user.id);
    if (!ownerStylist && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    const { west_bank = 0, jerusalem = 0, inside = 0 } = req.body;
    const prices = { west_bank: parseFloat(west_bank) || 0, jerusalem: parseFloat(jerusalem) || 0, inside: parseFloat(inside) || 0 };
    await DB.salons.update(s => s.id === salonId, { delivery_prices: JSON.stringify(prices) });
    res.json({ ok: true, delivery_prices: prices });
  } catch (e) { console.error('delivery-prices error:', e.message); res.status(500).json({ error: 'خطأ' }); }
});

// ===== 64: CLIENT LIST =====
router.get('/salon/:id/clients', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const bookings = await DB.bookings.find(b => b.salon_id === salonId);
    const clientMap = {};
    for (const b of bookings) {
      if (!b.client_id) continue;
      if (!clientMap[b.client_id]) {
        const user = await DB.users.findById(b.client_id);
        clientMap[b.client_id] = { id: b.client_id, name: user?.name || 'زبونة', phone: user?.phone || '', bookings: [] };
      }
      clientMap[b.client_id].bookings.push({ date: b.booking_date, time: b.booking_time, status: b.status, total_price: b.total_price });
    }
    const clients = Object.values(clientMap).sort((a, b) => b.bookings.length - a.bookings.length);
    res.json({ clients });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

// ===== 62: INVENTORY =====
router.get('/salon/:id/inventory', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM salon_inventory WHERE salon_id=$1 ORDER BY name`, [parseInt(req.params.id)]);
    res.json({ items: rows });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

router.post('/salon/:id/inventory', authenticate, async (req, res) => {
  try {
    const { name, quantity, unit, low_threshold } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });
    const { rows } = await query(
      `INSERT INTO salon_inventory (salon_id, name, quantity, unit, low_threshold) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [parseInt(req.params.id), name.trim(), parseFloat(quantity) || 0, unit || 'قطعة', parseInt(low_threshold) || 2]
    );
    res.status(201).json({ item: rows[0] });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

router.put('/inventory/:id', authenticate, async (req, res) => {
  try {
    const { name, quantity, unit, low_threshold } = req.body;
    const { rows } = await query(
      `UPDATE salon_inventory SET name=$1, quantity=$2, unit=$3, low_threshold=$4 WHERE id=$5 RETURNING *`,
      [name, parseFloat(quantity) || 0, unit || 'قطعة', parseInt(low_threshold) || 2, parseInt(req.params.id)]
    );
    res.json({ item: rows[0] });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

router.delete('/inventory/:id', authenticate, async (req, res) => {
  try {
    await query(`DELETE FROM salon_inventory WHERE id=$1`, [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

module.exports = router;
