const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');
const fcm = require('../fcm');

const router = express.Router();

async function getSalonOwner(salonId) {
  const ownerStylist = await DB.stylists.findOne(s => s.salon_id === salonId && s.user_id != null);
  if (!ownerStylist) return null;
  return DB.users.findOne(u => u.id === ownerStylist.user_id);
}

router.get('/my', authenticate, async (req, res) => {
  try {
    const bookings = await DB.bookings.find(b => b.client_id === req.user.id);
    bookings.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.booking_date) - new Date(a.booking_date);
    });
    const result = await Promise.all(bookings.map(async b => {
      const service = await DB.services.findOne(s => s.id === b.service_id);
      const stylist = await DB.stylists.findOne(s => s.id === b.stylist_id);
      const stylistUser = stylist ? await DB.users.findOne(u => u.id === stylist.user_id) : null;
      const salon = await DB.salons.findOne(s => s.id === b.salon_id);
      const owner = await getSalonOwner(b.salon_id);
      const stylistName = stylist?.user_id ? stylistUser?.name : stylist?.name;
      return { ...b, service_name: service?.name, name_ar: service?.name_ar, category: service?.category, duration_minutes: service?.duration_minutes, stylist_name: stylistName, stylist_id: stylist?.id, stylist_user_id: owner?.id, salon_name: salon?.name };
    }));
    res.json(result);
  } catch (e) {
    console.error('GET /bookings/my error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

router.get('/available-slots', async (req, res) => {
  try {
    const { stylist_id, date, service_id, total_duration } = req.query;
    if (!stylist_id || !date) return res.status(400).json({ error: 'بيانات ناقصة' });

    const dayOfWeek = new Date(date).getDay();
    const avail = await DB.stylist_availability.findOne(a => a.stylist_id === parseInt(stylist_id) && a.day_of_week === dayOfWeek);
    if (!avail || avail.is_off) return res.json({ slots: [], reason: 'day_off' });

    let duration;
    if (total_duration) {
      duration = parseInt(total_duration);
    } else {
      const service = service_id ? await DB.services.findOne(s => s.id === parseInt(service_id)) : null;
      duration = service?.duration_minutes || 60;
    }

    const activeBookings = await DB.bookings.find(b =>
      b.stylist_id === parseInt(stylist_id) &&
      b.booking_date === date &&
      (b.status === 'pending' || b.status === 'confirmed')
    );
    const booked = await Promise.all(activeBookings.map(async b => {
      const svc = await DB.services.findOne(s => s.id === b.service_id);
      return { booking_time: b.booking_time, duration_minutes: svc?.duration_minutes || 60 };
    }));

    const blocked = await DB.stylist_blocked_slots.find(b => b.stylist_id === parseInt(stylist_id) && b.date === date);
    blocked.forEach(b => {
      booked.push({ booking_time: b.start_time, duration_minutes: timeToMin(b.end_time) - timeToMin(b.start_time) });
    });

    let slots = generateSlots(avail.start_time, avail.end_time, duration, booked);
    if (avail.shift2_enabled && avail.shift2_start && avail.shift2_end) {
      const slots2 = generateSlots(avail.shift2_start, avail.shift2_end, duration, booked);
      const existingTimes = new Set(slots.map(s => s.time));
      slots2.forEach(s => { if (!existingTimes.has(s.time)) slots.push(s); });
      slots.sort((a, b) => timeToMin(a.time) - timeToMin(b.time));
    }

    res.json({ slots, date, stylist_id });
  } catch (e) {
    console.error('available-slots error:', e);
    res.status(500).json({ error: 'خطأ' });
  }
});

function generateSlots(start, end, duration, booked) {
  const slots = [];
  let current = timeToMin(start);
  const endMin = timeToMin(end);
  while (current + duration <= endMin) {
    const timeStr = minToTime(current);
    const isBooked = booked.some(b => {
      const bs = timeToMin(b.booking_time);
      return current < bs + b.duration_minutes && current + duration > bs;
    });
    slots.push({ time: timeStr, available: !isBooked });
    current += duration;
  }
  return slots;
}

function timeToMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function minToTime(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

router.post('/', authenticate, async (req, res) => {
  try {
    const { stylist_id, service_id, service_ids, salon_id, booking_date, booking_time, notes } = req.body;
    if (!stylist_id || !salon_id || !booking_date || !booking_time)
      return res.status(400).json({ error: 'يرجى تعبئة جميع الحقول المطلوبة' });

    // Support both single service_id and multiple service_ids array
    const ids = service_ids?.length ? service_ids.map(Number) : [parseInt(service_id)];
    if (!ids.length || ids.some(isNaN)) return res.status(400).json({ error: 'يرجى اختيار خدمة واحدة على الأقل' });

    const services = await Promise.all(ids.map(id => DB.services.findOne(s => s.id === id)));
    if (services.some(s => !s)) return res.status(404).json({ error: 'إحدى الخدمات غير موجودة' });

    const totalDuration = services.reduce((sum, s) => sum + (s.duration_minutes || 60), 0);
    const totalPrice = services.reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
    const primaryService = services[0];

    // Conflict check: any existing booking overlaps with [booking_time, booking_time + totalDuration]
    const activeBookings = await DB.bookings.find(b =>
      b.stylist_id === parseInt(stylist_id) &&
      b.booking_date === booking_date &&
      (b.status === 'pending' || b.status === 'confirmed')
    );
    const newStart = timeToMin(booking_time);
    const newEnd = newStart + totalDuration;
    for (const b of activeBookings) {
      const existDur = b.total_duration || 60;
      const bStart = timeToMin(b.booking_time);
      const bEnd = bStart + existDur;
      if (newStart < bEnd && newEnd > bStart) {
        return res.status(409).json({ error: 'هذا الوقت محجوز، اختاري وقتاً آخر' });
      }
    }

    const booking = await DB.bookings.insert({
      client_id: req.user.id,
      stylist_id: parseInt(stylist_id),
      service_id: primaryService.id,
      service_ids: JSON.stringify(ids),
      salon_id: parseInt(salon_id),
      booking_date,
      booking_time,
      notes: notes || null,
      total_duration: totalDuration,
      total_price: totalPrice,
      status: 'pending'
    });

    const serviceName = services.map(s => s.name_ar || s.name).join(' + ');
    const user = await DB.users.findOne(u => u.id === req.user.id);
    const io = req.io;

    await DB.notifications.insert({ user_id: req.user.id, title: 'طلب حجزك قيد المراجعة ⏳', body: `${serviceName} بتاريخ ${booking_date} الساعة ${booking_time} - بانتظار موافقة الصالون`, type: 'booking', booking_id: booking.id });
    io?.to(`user_${req.user.id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
    if (user?.fcm_token) {
      fcm.sendPushNotification(user.fcm_token, 'طلب حجزك قيد المراجعة ⏳', `${serviceName} · ${booking_date} · ${booking_time}`, { type: 'booking', booking_id: String(booking.id) }).catch(() => {});
    }

    const stylist = await DB.stylists.findOne(s => s.id === booking.stylist_id);
    const stylistUser = stylist?.user_id ? await DB.users.findOne(u => u.id === stylist.user_id) : null;
    const stylistName = stylist?.user_id ? (stylistUser?.name || 'الكوفيرة') : (stylist?.name || 'الكوفيرة');
    const owner = await getSalonOwner(booking.salon_id);
    if (owner) {
      const clientName = user?.name || 'زبونة';
      await DB.notifications.insert({ user_id: owner.id, title: 'طلب حجز جديد 📅', body: `${clientName} طلبت ${serviceName} عند ${stylistName} - ${booking_date} ${booking_time}`, type: 'booking', booking_id: booking.id });
      io?.to(`user_${owner.id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
      if (owner.fcm_token) {
        fcm.sendPushNotification(owner.fcm_token, 'طلب حجز جديد 📅', `${clientName} · ${stylistName} · ${booking_date} ${booking_time}`, { type: 'booking', booking_id: String(booking.id) }).catch(() => {});
      }
    }

    // #73 — notify the assigned stylist directly (if different from owner)
    if (stylist?.user_id && stylistUser && stylist.user_id !== owner?.id) {
      const clientName = user?.name || 'زبونة';
      await DB.notifications.insert({ user_id: stylist.user_id, title: 'زبونة جديدة حجزت عندك 🎉', body: `${clientName} · ${serviceName} · ${booking_date} ${booking_time}`, type: 'booking', booking_id: booking.id });
      io?.to(`user_${stylist.user_id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
      if (stylistUser.fcm_token) {
        fcm.notifyNewBookingToStylist(stylistUser.fcm_token, clientName, serviceName, booking_date, booking_time).catch(() => {});
      }
    }

    const salon = await DB.salons.findOne(s => s.id === booking.salon_id);
    res.status(201).json({ booking: { ...booking, service_name: serviceName, stylist_name: stylistName, salon_name: salon?.name }, points_earned: 0 });
  } catch (e) {
    console.error('POST /bookings error:', e);
    res.status(500).json({ error: 'خطأ في إنشاء الحجز' });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    // ✅ SECURITY: validate status against allowed values
    const ALLOWED_STATUSES = ['confirmed', 'rejected', 'cancelled'];
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'حالة غير صالحة' });
    }

    const bookingId = parseInt(req.params.id);
    const booking = await DB.bookings.findOne(b => b.id === bookingId);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    // ✅ SECURITY: ownership check — only the salon owner or the client can change status
    const isClient = req.user.id === booking.client_id;
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === booking.salon_id && s.user_id === req.user.id);
    const isSalonOwner = !!ownerStylist;

    if (!isClient && !isSalonOwner) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الحجز' });
    }

    // Clients can only cancel their own bookings
    if (isClient && status !== 'cancelled') {
      return res.status(403).json({ error: 'يمكنك فقط إلغاء الحجز' });
    }

    const prevStatus = booking.status;
    await DB.bookings.update(b => b.id === bookingId, { status });

    const service = await DB.services.findOne(s => s.id === booking.service_id);
    const client = await DB.users.findOne(u => u.id === booking.client_id);
    const serviceName = service?.name_ar || service?.name || '';
    const io = req.io;

    if (status === 'confirmed' && prevStatus === 'pending') {
      const points = Math.floor((service?.price || 0) / 5);
      if (points > 0) {
        const newPoints = (client?.loyalty_points || 0) + points;
        await DB.users.update(u => u.id === client.id, { loyalty_points: newPoints });
        await DB.loyalty_transactions.insert({ user_id: client.id, points, type: 'earned', description: `حجز ${serviceName}` });
      }
      await DB.notifications.insert({ user_id: booking.client_id, title: 'تم قبول حجزك ✅', body: `تم تأكيد ${serviceName} · ${booking.booking_date} · ${booking.booking_time}`, type: 'booking', booking_id: booking.id });
      io?.to(`user_${booking.client_id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
      if (client?.fcm_token) {
        fcm.notifyBookingConfirmed(client.fcm_token, serviceName, booking.booking_date, booking.booking_time).catch(() => {});
      }
    } else if (status === 'rejected') {
      await DB.notifications.insert({ user_id: booking.client_id, title: 'الحجز غير متاح ❌', body: `للأسف تم رفض حجز ${serviceName} · ${booking.booking_date}. يرجى اختيار وقت آخر`, type: 'booking', booking_id: booking.id });
      io?.to(`user_${booking.client_id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
      if (client?.fcm_token) {
        fcm.sendPushNotification(client.fcm_token, 'الحجز غير متاح ❌', `تم رفض ${serviceName} · ${booking.booking_date}. اختاري وقتاً آخر`, { type: 'booking' }).catch(() => {});
      }
    } else if (status === 'cancelled') {
      await DB.notifications.insert({ user_id: booking.client_id, title: 'تم إلغاء الحجز ❌', body: `تم إلغاء حجز ${serviceName}`, type: 'booking', booking_id: booking.id });
      io?.to(`user_${booking.client_id}`).emit('new_notif', { type: 'booking', booking_id: booking.id });
      if (client?.fcm_token) {
        fcm.notifyBookingCancelled(client.fcm_token, serviceName).catch(() => {});
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('PUT /bookings/:id/status error:', e);
    res.status(500).json({ error: 'خطأ في تحديث الحجز' });
  }
});

router.post('/:id/review', authenticate, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const booking = await DB.bookings.findOne(b => b.id === parseInt(req.params.id) && b.client_id === req.user.id);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    await DB.reviews.insert({ booking_id: booking.id, client_id: req.user.id, stylist_id: booking.stylist_id, rating: parseInt(rating), comment: comment || null });

    const reviews = await DB.reviews.find(r => r.stylist_id === booking.stylist_id);
    const avg = reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length;
    await DB.stylists.update(s => s.id === booking.stylist_id, { rating: Math.round(avg * 10) / 10, reviews_count: reviews.length });

    res.json({ success: true });
  } catch (e) {
    console.error('POST /bookings/:id/review error:', e);
    res.status(500).json({ error: 'خطأ في التقييم' });
  }
});

module.exports = router;
