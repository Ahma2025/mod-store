const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');
const fcm = require('../fcm');

const router = express.Router();

router.get('/my', authenticate, (req, res) => {
  const bookings = DB.bookings.find(b => b.client_id === req.user.id)
    .sort((a,b) => new Date(b.booking_date) - new Date(a.booking_date))
    .map(b => {
      const service = DB.services.findOne(s => s.id === b.service_id);
      const stylist = DB.stylists.findOne(s => s.id === b.stylist_id);
      const stylistUser = stylist ? DB.users.findOne(u => u.id === stylist.user_id) : null;
      const salon = DB.salons.findOne(s => s.id === b.salon_id);
      return { ...b, service_name: service?.name, name_ar: service?.name_ar, category: service?.category, duration_minutes: service?.duration_minutes, stylist_name: stylistUser?.name, stylist_avatar: stylistUser?.avatar, salon_name: salon?.name };
    });
  res.json(bookings);
});

router.get('/available-slots', (req, res) => {
  const { stylist_id, date, service_id } = req.query;
  if (!stylist_id || !date) return res.status(400).json({ error: 'بيانات ناقصة' });

  const dayOfWeek = new Date(date).getDay();
  const avail = DB.stylist_availability.findOne(a => a.stylist_id === parseInt(stylist_id) && a.day_of_week === dayOfWeek);
  if (!avail) return res.json({ slots: [] });

  const service = service_id ? DB.services.findOne(s => s.id === parseInt(service_id)) : null;
  const duration = service?.duration_minutes || 60;

  const booked = DB.bookings.find(b => b.stylist_id === parseInt(stylist_id) && b.booking_date === date && b.status !== 'cancelled')
    .map(b => { const svc = DB.services.findOne(s => s.id === b.service_id); return { booking_time: b.booking_time, duration_minutes: svc?.duration_minutes || 60 }; });

  const slots = generateSlots(avail.start_time, avail.end_time, duration, booked);
  res.json({ slots, date, stylist_id });
});

function generateSlots(start, end, duration, booked) {
  const slots = [];
  let current = timeToMin(start);
  const endMin = timeToMin(end);
  while (current + duration <= endMin) {
    const timeStr = minToTime(current);
    const isBooked = booked.some(b => { const bs = timeToMin(b.booking_time); return current < bs + b.duration_minutes && current + duration > bs; });
    slots.push({ time: timeStr, available: !isBooked });
    current += 30;
  }
  return slots;
}

function timeToMin(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function minToTime(m) { return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`; }

router.post('/', authenticate, async (req, res) => {
  const { stylist_id, service_id, salon_id, booking_date, booking_time, notes } = req.body;
  if (!stylist_id || !service_id || !salon_id || !booking_date || !booking_time)
    return res.status(400).json({ error: 'يرجى تعبئة جميع الحقول المطلوبة' });

  const service = DB.services.findOne(s => s.id === parseInt(service_id));
  if (!service) return res.status(404).json({ error: 'الخدمة غير موجودة' });

  const conflict = DB.bookings.find(b => b.stylist_id === parseInt(stylist_id) && b.booking_date === booking_date && b.booking_time === booking_time && b.status !== 'cancelled');
  if (conflict.length > 0) return res.status(409).json({ error: 'هذا الوقت محجوز، اختاري وقتاً آخر' });

  const booking = DB.bookings.insert({ client_id: req.user.id, stylist_id: parseInt(stylist_id), service_id: parseInt(service_id), salon_id: parseInt(salon_id), booking_date, booking_time, notes: notes || null, total_price: service.price, status: 'confirmed' });

  const points = Math.floor(service.price / 5);
  const user = DB.users.findOne(u => u.id === req.user.id);
  DB.users.updateOne(u => u.id === req.user.id, { loyalty_points: (user?.loyalty_points || 0) + points });
  DB.loyalty_transactions.insert({ user_id: req.user.id, points, type: 'earned', description: `حجز ${service.name_ar || service.name}` });

  const serviceName = service.name_ar || service.name;
  DB.notifications.insert({ user_id: req.user.id, title: 'تم تأكيد حجزك ✅', body: `تم حجز ${serviceName} بتاريخ ${booking_date} الساعة ${booking_time}`, type: 'booking' });

  // FCM push notification
  if (user?.fcm_token) {
    fcm.notifyBookingConfirmed(user.fcm_token, serviceName, booking_date, booking_time).catch(() => {});
  }

  // Also notify the stylist
  const stylist = DB.stylists.findOne(s => s.id === booking.stylist_id);
  const stylistUser = stylist ? DB.users.findOne(u => u.id === stylist.user_id) : null;
  if (stylistUser?.fcm_token) {
    const clientName = user?.name || 'زبونة';
    fcm.sendPushNotification(stylistUser.fcm_token, 'حجز جديد 📅', `${clientName} حجزت ${serviceName} - ${booking_date}`, { type: 'booking' }).catch(() => {});
  }

  const salon = DB.salons.findOne(s => s.id === booking.salon_id);

  res.status(201).json({ booking: { ...booking, service_name: service.name, name_ar: service.name_ar, stylist_name: stylistUser?.name, salon_name: salon?.name }, points_earned: points });
});

router.put('/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  const booking = DB.bookings.findOne(b => b.id === parseInt(req.params.id));
  if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });
  DB.bookings.update(b => b.id === booking.id, { status });

  if (status === 'cancelled') {
    const service = DB.services.findOne(s => s.id === booking.service_id);
    const client = DB.users.findOne(u => u.id === booking.client_id);
    DB.notifications.insert({ user_id: booking.client_id, title: 'تم إلغاء الحجز ❌', body: `تم إلغاء حجز ${service?.name_ar || service?.name}`, type: 'booking' });
    if (client?.fcm_token) {
      fcm.notifyBookingCancelled(client.fcm_token, service?.name_ar || service?.name || '').catch(() => {});
    }
  }

  res.json({ success: true });
});

router.post('/:id/review', authenticate, (req, res) => {
  const { rating, comment } = req.body;
  const booking = DB.bookings.findOne(b => b.id === parseInt(req.params.id) && b.client_id === req.user.id);
  if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

  DB.reviews.insert({ booking_id: booking.id, client_id: req.user.id, stylist_id: booking.stylist_id, rating: parseInt(rating), comment: comment || null });

  const reviews = DB.reviews.find(r => r.stylist_id === booking.stylist_id);
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  DB.stylists.update(s => s.id === booking.stylist_id, { rating: Math.round(avg * 10) / 10, reviews_count: reviews.length });

  res.json({ success: true });
});

module.exports = router;
