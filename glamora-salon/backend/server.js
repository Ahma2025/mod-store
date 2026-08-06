const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { DB, initDatabase } = require('./database');
const fcm = require('./fcm');

// ✅ SECURITY: JWT_SECRET must be set in environment — no fallback
if (!process.env.JWT_SECRET) {
  console.error('[SECURITY] FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:8100', 'capacitor://localhost', 'ionic://localhost'];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true }
});

// ✅ SECURITY: Trust Railway's reverse proxy so rate-limit sees real client IP
app.set('trust proxy', 1);

// ✅ SECURITY: HTTP security headers
app.use(helmet({ contentSecurityPolicy: false }));

// ✅ SECURITY: CORS restricted to known origins
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));

app.use(express.json({ limit: '2mb' }));

// ✅ SECURITY: Rate limiting — auth endpoints (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'محاولات كثيرة، انتظري 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// ✅ SECURITY: Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'طلبات كثيرة جداً' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

app.use('/api/auth', authLimiter);
app.use('/api/', apiLimiter);

app.use(express.static(path.join(__dirname, '../frontend')));

initDatabase().then(() => {
  console.log('[DB] Database initialized');
}).catch(e => {
  console.error('[DB] Failed to initialize database:', e);
  process.exit(1);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/stylists', require('./routes/stylists'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stylist', require('./routes/stylist-dashboard'));
app.use('/api/media', require('./routes/media'));
app.use('/api/blocked-slots', require('./routes/blocked-slots'));

app.use('/api/bookings', (req, res, next) => { req.io = io; next(); }, require('./routes/bookings'));
app.use('/api/messages', (req, res, next) => { req.io = io; next(); }, require('./routes/messages'));
app.use('/api/beauty', require('./routes/beauty'));

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('غير مصرح'));
  try {
    socket.user = jwt.verify(token, SECRET);
    next();
  } catch { next(new Error('جلسة منتهية')); }
});

io.on('connection', (socket) => {
  socket.join(`user_${socket.user.id}`);

  socket.on('send_message', async (data) => {
    const { receiver_id, content, booking_id } = data;
    if (!receiver_id || !content?.trim()) return;
    try {
      const msg = await DB.messages.insert({
        sender_id: socket.user.id,
        receiver_id: parseInt(receiver_id),
        booking_id: booking_id || null,
        content: content.trim()
      });
      const sender = await DB.users.findOne(u => u.id === socket.user.id);
      const fullMsg = { ...msg, sender_name: sender?.name };

      io.to(`user_${receiver_id}`).emit('new_message', fullMsg);
      socket.emit('message_sent', fullMsg);

      await DB.notifications.insert({ user_id: parseInt(receiver_id), title: `رسالة من ${sender?.name || 'مستخدمة'} 💬`, body: content.trim().slice(0, 60), type: 'message' });
      io.to(`user_${receiver_id}`).emit('new_notif', { type: 'message', sender_id: socket.user.id });

      const receiver = await DB.users.findOne(u => u.id === parseInt(receiver_id));
      if (receiver?.fcm_token) {
        fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة').catch(() => {});
      }
    } catch (e) {
      console.error('socket send_message error:', e);
    }
  });

  socket.on('typing', (data) => {
    const receiverId = parseInt(data?.receiver_id);
    if (!receiverId || isNaN(receiverId)) return;
    io.to(`user_${receiverId}`).emit('user_typing', { sender_id: socket.user.id });
  });

  socket.on('disconnect', () => {});
});


app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ===== SMART NOTIFICATION JOBS =====
const sentNotifCache = new Set(); // dedup within same day

async function runSmartNotifJobs() {
  const today = new Date().toISOString().split('T')[0];
  // Reset cache at midnight
  const hour = new Date().getHours();
  if (hour === 0) sentNotifCache.clear();

  try {
    const allUsers = await DB.users.find(u => u.role === 'client' && u.fcm_token);

    for (const user of allUsers) {
      // #75 — inactive user reminder (no booking in 30+ days)
      const inactiveKey = `inactive_${today}_${user.id}`;
      if (!sentNotifCache.has(inactiveKey)) {
        const bookings = await DB.bookings.find(b => b.client_id === user.id && b.status === 'completed');
        if (bookings.length > 0) {
          const last = bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
          const daysSince = Math.floor((Date.now() - new Date(last.created_at)) / 86400000);
          if (daysSince >= 30) {
            await fcm.notifyInactiveUser(user.fcm_token, daysSince).catch(() => {});
            await DB.notifications.insert({ user_id: user.id, title: 'اشتقنا إليكِ! 💆', body: `مضى ${daysSince} يوماً على آخر زيارة — احجزي موعدك الآن`, type: 'reminder' });
            sentNotifCache.add(inactiveKey);
          }
        }
      }

      // #71 — favorite salon has availability today (most visited salon)
      const favKey = `fav_avail_${today}_${user.id}`;
      if (!sentNotifCache.has(favKey)) {
        const userBookings = await DB.bookings.find(b => b.client_id === user.id);
        if (userBookings.length > 0) {
          const salonCount = {};
          userBookings.forEach(b => { salonCount[b.salon_id] = (salonCount[b.salon_id] || 0) + 1; });
          const favSalonId = parseInt(Object.entries(salonCount).sort((a, b) => b[1] - a[1])[0]?.[0]);
          if (favSalonId) {
            // Check if salon has any stylists with availability today
            const todayDay = new Date().getDay();
            const stylists = await DB.stylists.find(s => s.salon_id === favSalonId && s.is_active !== 0);
            const hasAvail = await Promise.any(
              stylists.map(async st => {
                const avail = await DB.stylist_availability.findOne(a => a.stylist_id === st.id && a.day_of_week === todayDay);
                if (avail && !avail.is_closed) return true;
                throw new Error('no');
              })
            ).catch(() => false);
            if (hasAvail) {
              const salon = await DB.salons.findOne(s => s.id === favSalonId);
              if (salon) {
                await fcm.notifyFavoriteSalonAvailability(user.fcm_token, salon.name).catch(() => {});
                await DB.notifications.insert({ user_id: user.id, title: `${salon.name} متاح اليوم 💅`, body: `صالونك المفضل عنده أوقات فاضية — احجزي الآن!`, type: 'availability' });
                sentNotifCache.add(favKey);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('[SmartNotifs] error:', e.message);
  }
}

// Run smart jobs every 24 hours, first run after 10 seconds (server warm-up)
setTimeout(() => {
  runSmartNotifJobs();
  setInterval(runSmartNotifJobs, 24 * 60 * 60 * 1000);
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🌸 Glamora running at http://localhost:${PORT}\n`);
});
