const express = require('express');
const { DB, query } = require('../database');
const { authenticate } = require('./auth');

const router = express.Router();

async function computeSalonRating(salonId) {
  const ratings = await DB.salon_ratings.find(r => r.salon_id === salonId);
  if (!ratings.length) return { rating: 0, reviews_count: 0 };
  const avg = ratings.reduce((s, r) => s + Number(r.stars), 0) / ratings.length;
  return { rating: Math.round(avg * 10) / 10, reviews_count: ratings.length };
}

router.get('/', async (req, res) => {
  try {
    const { city, search } = req.query;
    let salons = await DB.salons.find(s => s.is_active === 1);
    if (city) salons = salons.filter(s => s.city.includes(city));
    if (search) salons = salons.filter(s => s.name.includes(search) || (s.description || '').includes(search));

    // Count bookings this week per salon for "most_booked" badge
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weeklyRes = await query(
      `SELECT salon_id, COUNT(*) as cnt FROM bookings WHERE created_at >= $1 GROUP BY salon_id`,
      [weekAgo]
    );
    const weeklyMap = {};
    weeklyRes.rows.forEach(r => { weeklyMap[r.salon_id] = parseInt(r.cnt); });
    const maxWeekly = Math.max(1, ...Object.values(weeklyMap));

    const enriched = await Promise.all(salons.map(async s => {
      const { rating, reviews_count } = await computeSalonRating(s.id);
      const rawStylists = await DB.stylists.find(st => st.salon_id === s.id && st.is_active === 1);
      const stylists = await Promise.all(rawStylists.map(async st => {
        const user = st.user_id ? await DB.users.findById(st.user_id) : null;
        return { ...st, name: user?.name || st.name, avatar: user?.avatar || st.avatar };
      }));
      const allMedia = await DB.salon_media.find(m => m.salon_id === s.id);
      const cover = allMedia.find(m => m.is_cover === 1 && m.type === 'photo') || allMedia.find(m => m.type === 'photo');
      const createdAt = s.created_at ? new Date(s.created_at) : null;
      const is_new = createdAt ? (Date.now() - createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
      const weekly = weeklyMap[s.id] || 0;
      const is_most_booked = weekly > 0 && weekly >= maxWeekly * 0.7;
      return { ...s, rating, reviews_count, stylists, cover_url: cover?.url || null, is_new, is_most_booked };
    }));

    enriched.sort((a, b) => b.rating - a.rating || b.reviews_count - a.reviews_count);
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
    const salon = await DB.salons.findOne(s => s.id === id);
    if (!salon) return res.status(404).json({ error: 'الصالون غير موجود' });

    const hours = (await DB.salon_hours.find(h => h.salon_id === id)).sort((a, b) => a.day_of_week - b.day_of_week);
    const rawStylists = await DB.stylists.find(st => st.salon_id === id && st.is_active === 1);
    const stylists = await Promise.all(rawStylists.map(async st => {
      const user = st.user_id ? await DB.users.findById(st.user_id) : null;
      // ✅ SECURITY: phone is private — not exposed in public salon detail
      return { ...st, name: user?.name || st.name, avatar: user?.avatar || st.avatar };
    }));
    const services = (await DB.services.find(s => s.salon_id === id && s.is_active === 1)).sort((a, b) => a.price - b.price);
    const stylistIds = stylists.map(s => s.id);
    const allReviews = await DB.reviews.find(r => stylistIds.includes(r.stylist_id));
    const reviews = await Promise.all(
      allReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20)
        .map(async r => {
          const u = await DB.users.findById(r.client_id);
          return { ...r, client_name: u?.name, avatar: u?.avatar };
        })
    );

    const { rating, reviews_count } = await computeSalonRating(id);
    const rawRatings = await DB.salon_ratings.find(r => r.salon_id === id);
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
