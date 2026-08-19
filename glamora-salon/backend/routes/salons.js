const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

async function computeSalonRating(salonId) {
  const r = (await query(`SELECT AVG(stars)::float AS avg, COUNT(*) AS cnt FROM salon_ratings WHERE salon_id=$1`, [salonId])).rows[0];
  const cnt = r ? parseInt(r.cnt) : 0;
  if (!cnt) return { rating: 0, reviews_count: 0 };
  return { rating: Math.round(r.avg * 10) / 10, reviews_count: cnt };
}

// Short-lived cache for the unfiltered home list (identical for every visitor).
let _listCache = null;
const LIST_TTL = 30 * 1000;

router.get('/', async (req, res) => {
  try {
    const { city, search } = req.query;
    const cacheable = !city && !search;
    if (cacheable && _listCache && Date.now() - _listCache.t < LIST_TTL) {
      return res.json(_listCache.data);
    }

    let salons = (await query('SELECT * FROM salons WHERE is_active=1')).rows;
    if (city) salons = salons.filter(s => (s.city || '').includes(city));
    if (search) salons = salons.filter(s => (s.name || '').includes(search) || (s.description || '').includes(search));
    if (!salons.length) { if (cacheable) _listCache = { t: Date.now(), data: [] }; return res.json([]); }
    const ids = salons.map(s => s.id);

    // ---- everything in a handful of set-based queries (was hundreds of N+1 queries) ----
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [weeklyRes, ratingRes, stylistRes, mediaRes] = await Promise.all([
      query(`SELECT salon_id, COUNT(*) AS cnt FROM bookings WHERE created_at >= $1 GROUP BY salon_id`, [weekAgo]),
      query(`SELECT salon_id, AVG(stars)::float AS avg, COUNT(*) AS cnt FROM salon_ratings WHERE salon_id = ANY($1) GROUP BY salon_id`, [ids]),
      query(`SELECT * FROM stylists WHERE salon_id = ANY($1) AND is_active = 1`, [ids]),
      query(`SELECT salon_id, url, type, is_cover FROM salon_media WHERE salon_id = ANY($1) ORDER BY id`, [ids]),
    ]);

    const weeklyMap = {}; weeklyRes.rows.forEach(r => { weeklyMap[r.salon_id] = parseInt(r.cnt); });
    const maxWeekly = Math.max(1, ...Object.values(weeklyMap));

    const ratingMap = {};
    ratingRes.rows.forEach(r => { ratingMap[r.salon_id] = { rating: Math.round(r.avg * 10) / 10, reviews_count: parseInt(r.cnt) }; });

    const stylistUserIds = [...new Set(stylistRes.rows.filter(st => st.user_id).map(st => st.user_id))];
    const userRows = stylistUserIds.length
      ? (await query(`SELECT id, name, avatar FROM users WHERE id = ANY($1)`, [stylistUserIds])).rows : [];
    const userMap = {}; userRows.forEach(u => { userMap[u.id] = u; });
    const stylistsBySalon = {};
    stylistRes.rows.forEach(st => {
      const u = st.user_id ? userMap[st.user_id] : null;
      (stylistsBySalon[st.salon_id] = stylistsBySalon[st.salon_id] || []).push({ ...st, name: (u && u.name) || st.name, avatar: (u && u.avatar) || st.avatar });
    });

    const coverBySalon = {};
    mediaRes.rows.forEach(m => {
      if (m.type !== 'photo') return;
      const cur = coverBySalon[m.salon_id];
      if (!cur || (m.is_cover === 1 && cur.is_cover !== 1)) coverBySalon[m.salon_id] = m;
    });

    const enriched = salons.map(s => {
      const r = ratingMap[s.id] || { rating: 0, reviews_count: 0 };
      const createdAt = s.created_at ? new Date(s.created_at) : null;
      const is_new = createdAt ? (Date.now() - createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
      const weekly = weeklyMap[s.id] || 0;
      return { ...s, rating: r.rating, reviews_count: r.reviews_count, stylists: stylistsBySalon[s.id] || [], cover_url: (coverBySalon[s.id] || {}).url || null, is_new, is_most_booked: weekly > 0 && weekly >= maxWeekly * 0.7 };
    });

    enriched.sort((a, b) => b.rating - a.rating || b.reviews_count - a.reviews_count);
    if (cacheable) _listCache = { t: Date.now(), data: enriched };
    res.json(enriched);
  } catch (e) {
    console.error('GET /salons error:', e);
    res.status(500).json({ error: 'خطأ في جلب الصالونات' });
  }
});

router.get('/all-locations', async (req, res) => {
  try {
    const salons = await DB.salons.find(s => s.is_active === 1);
    res.json(salons.map(s => ({
      id: s.id, name: s.name, city: s.city, rating: s.rating,
      latitude: s.latitude || null, longitude: s.longitude || null,
      cover_emoji: s.cover_emoji || '💅'
    })).filter(s => s.latitude && s.longitude));
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const salon = (await query('SELECT * FROM salons WHERE id=$1', [id])).rows[0];
    if (!salon) return res.status(404).json({ error: 'الصالون غير موجود' });

    const hours = (await query('SELECT * FROM salon_hours WHERE salon_id=$1 ORDER BY day_of_week', [id])).rows;
    const rawStylists = (await query('SELECT * FROM stylists WHERE salon_id=$1 AND is_active=1', [id])).rows;
    const stylists = await Promise.all(rawStylists.map(async st => {
      const user = st.user_id ? await DB.users.findById(st.user_id) : null;
      // ✅ SECURITY: phone is private — not exposed in public salon detail
      return { ...st, name: user?.name || st.name, avatar: user?.avatar || st.avatar };
    }));
    const services = (await query('SELECT * FROM services WHERE salon_id=$1 AND is_active=1 ORDER BY price', [id])).rows;
    const stylistIds = stylists.map(s => s.id);
    const allReviews = stylistIds.length ? (await query('SELECT * FROM reviews WHERE stylist_id = ANY($1)', [stylistIds])).rows : [];
    const reviews = await Promise.all(
      allReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20)
        .map(async r => {
          const u = await DB.users.findById(r.client_id);
          return { ...r, client_name: u?.name, avatar: u?.avatar };
        })
    );

    const { rating, reviews_count } = await computeSalonRating(id);
    const rawRatings = (await query('SELECT * FROM salon_ratings WHERE salon_id=$1', [id])).rows;
    const salonRatings = await Promise.all(
      rawRatings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map(async r => {
          const u = await DB.users.findById(r.client_id);
          return { ...r, client_name: u?.name, avatar: u?.avatar };
        })
    );

    // Total unique visitors (completed bookings)
    const visitorsRes = await query(
      `SELECT COUNT(DISTINCT client_id) as cnt FROM bookings WHERE salon_id=$1 AND status='completed'`,
      [id]
    );
    const total_visitors = parseInt(visitorsRes.rows[0]?.cnt || 0);

    const createdAt = salon.created_at ? new Date(salon.created_at) : null;
    const is_new = createdAt ? (Date.now() - createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000 : false;

    res.json({ ...salon, rating, reviews_count, hours, stylists, services, reviews, salon_ratings: salonRatings, total_visitors, is_new });
  } catch (e) {
    console.error('GET /salons/:id error:', e);
    res.status(500).json({ error: 'خطأ في جلب الصالون' });
  }
});

router.post('/:id/rate', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const clientId = req.user?.id;
    if (!clientId) return res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    const { stars, comment, cleanliness_rating, punctuality_rating, result_rating, before_photo, after_photo } = req.body;
    if (!stars || stars < 1 || stars > 5) return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5 نجوم' });
    const salon = await DB.salons.findOne(s => s.id === salonId);
    if (!salon) return res.status(404).json({ error: 'الصالون غير موجود' });

    await DB.salon_ratings.insert({
      salon_id: salonId, client_id: clientId, stars, comment: comment || '',
      cleanliness_rating: cleanliness_rating || null,
      punctuality_rating: punctuality_rating || null,
      result_rating: result_rating || null,
      before_photo: before_photo || null,
      after_photo: after_photo || null,
    });
    const { rating, reviews_count } = await computeSalonRating(salonId);

    // #74 — notify salon stylists about new review
    try {
      const stylists = await DB.stylists.find(s => s.salon_id === salonId && s.user_id != null);
      const rater = await DB.users.findById(clientId);
      for (const st of stylists) {
        const stUser = await DB.users.findById(st.user_id);
        if (stUser?.fcm_token) {
          fcm.notifyNewReview(stUser.fcm_token, rater?.name || 'زبونة', stars, salon.name).catch(() => {});
        }
        await DB.notifications.insert({ user_id: st.user_id, title: `تقييم جديد ${'⭐'.repeat(stars)}`, body: `${rater?.name || 'زبونة'} قيّمت ${salon.name}`, type: 'review' });
        req.io?.to(`user_${st.user_id}`).emit('new_notif', { type: 'review' });
      }
    } catch (_) {}

    res.json({ success: true, rating, reviews_count, user_stars: stars });
  } catch (e) {
    console.error('POST /salons/:id/rate error:', e);
    res.status(500).json({ error: 'خطأ في التقييم' });
  }
});

router.get('/:id/my-rating', async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const clientId = req.user?.id;
    if (!clientId) return res.json({ stars: 0 });
    const r = await DB.salon_ratings.findOne(r => r.salon_id === salonId && r.client_id === clientId);
    res.json({ stars: r?.stars || 0 });
  } catch (e) {
    res.json({ stars: 0 });
  }
});

router.put('/:id/location', authenticate, async (req, res) => {
  try {
    const salonId = parseInt(req.params.id);
    const { latitude, longitude } = req.body;
    if (!latitude || !longitude) return res.status(400).json({ error: 'الموقع مطلوب' });
    const salon = await DB.salons.findOne(s => s.id === salonId);
    if (!salon) return res.status(404).json({ error: 'الصالون غير موجود' });

    // ✅ SECURITY: only the salon owner (stylist with matching salon_id) can update location
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === salonId && s.user_id === req.user.id);
    if (!ownerStylist) return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الصالون' });

    await query('UPDATE salons SET latitude=$1, longitude=$2 WHERE id=$3', [parseFloat(latitude), parseFloat(longitude), salonId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/:id/services', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category } = req.query;
    let services = await DB.services.find(s => s.salon_id === id && s.is_active === 1);
    if (category) services = services.filter(s => s.category === category);
    res.json(services.sort((a, b) => a.price - b.price));
  } catch (e) {
    res.status(500).json({ error: 'خطأ' });
  }
});

module.exports = router;
