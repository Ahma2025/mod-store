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

// Capacitor WebView origins — iOS uses capacitor://localhost, Android uses
// https://localhost (default androidScheme). Always allow these so both native
// apps can call the API regardless of any ALLOWED_ORIGINS env override.
const CAPACITOR_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost'];
const ALLOWED_ORIGINS = [
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:8100']),
  ...CAPACITOR_ORIGINS,
];

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
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true, exposedHeaders: ['X-Renew-Token'] }));

app.use(express.json({ limit: '2mb' }));

// ✅ SECURITY: Rate limiting — auth endpoints (strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,   // raised: multiple testers can share one IP (NAT/wifi); 10 was far too strict
  message: { error: 'محاولات كثيرة، انتظري قليلاً' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// ✅ SECURITY: Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,  // raised: dashboard + normal salon management + shared IPs easily exceeded 100/min
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
app.use('/api/orders', (req, res, next) => { req.io = io; next(); }, require('./routes/orders'));
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

// Which conversation each connected user is actively viewing (userId -> otherUserId).
// Lets us skip message notifications when the recipient is already looking at that chat.
const activeConv = new Map();
io.activeConv = activeConv;   // shared with the HTTP /messages route via req.io

io.on('connection', (socket) => {
  socket.join(`user_${socket.user.id}`);

  // client reports the chat it currently has open (or null/absent when it leaves)
  socket.on('active_conversation', (data) => {
    const w = parseInt(data?.with);
    if (w && !isNaN(w)) activeConv.set(socket.user.id, w);
    else activeConv.delete(socket.user.id);
  });
  socket.on('disconnect', () => { activeConv.delete(socket.user.id); });

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
      const sender = await DB.users.findById(socket.user.id);
      const fullMsg = { ...msg, sender_name: sender?.name };

      io.to(`user_${receiver_id}`).emit('new_message', fullMsg);
      socket.emit('message_sent', fullMsg);

      // Skip the notification if the recipient is already viewing this exact conversation.
      const viewing = activeConv.get(parseInt(receiver_id)) === socket.user.id;
      if (!viewing) {
        await DB.notifications.insert({ user_id: parseInt(receiver_id), title: `رسالة من ${sender?.name || 'مستخدمة'} 💬`, body: content.trim().slice(0, 60), type: 'message' });
        io.to(`user_${receiver_id}`).emit('new_notif', { type: 'message', sender_id: socket.user.id });

        const receiver = await DB.users.findById(parseInt(receiver_id));
        if (receiver?.fcm_token) {
          fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة').catch(() => {});
        }
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


// ===== Salon share landing page (QR / link target) =====
// If the app is installed, the OS opens it via the deep link and this page is never seen.
// Otherwise the visitor lands here: salon name + "open in app" + "download" buttons.
const IOS_STORE = 'https://apps.apple.com/il/app/velour-salon/id6781790856';
const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.velour.salon';
const _esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

app.get('/s/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  let salon = null;
  try { salon = await DB.salons.findOne(s => s.id === id); } catch (e) {}
  const name = salon ? salon.name : 'صالون فيلور';
  const city = salon ? (salon.city || '') : '';
  const logo = salon && salon.cover_url ? salon.cover_url : '';
  const html = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(name)} · فيلور</title>
<meta property="og:title" content="${_esc(name)} على فيلور">
<meta property="og:description" content="احجزي موعدك في ${_esc(name)} عبر تطبيق فيلور 🌹">
${logo ? `<meta property="og:image" content="${_esc(logo)}">` : ''}
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Tahoma,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 30% 10%,#3a0f22,#1a0a0f 70%);color:#fff;padding:24px}
  .card{width:100%;max-width:380px;text-align:center}
  .logo{width:110px;height:110px;border-radius:50%;margin:0 auto 18px;object-fit:cover;
    background:linear-gradient(135deg,#9B1B3B,#4a0a25);display:flex;align-items:center;justify-content:center;
    font-size:46px;border:3px solid #C9A96E;box-shadow:0 8px 30px rgba(201,169,110,.35)}
  h1{font-size:24px;font-weight:800;margin-bottom:4px}
  .city{color:#e5c9a0;font-size:14px;margin-bottom:6px}
  .tag{color:#d8b6c2;font-size:14px;margin-bottom:28px}
  .btn{display:block;width:100%;padding:15px;border-radius:16px;font-size:16px;font-weight:800;text-decoration:none;
    margin-bottom:12px;border:none;cursor:pointer;font-family:inherit}
  .btn-primary{background:linear-gradient(135deg,#C9A96E,#a87919);color:#1a050f;box-shadow:0 8px 22px rgba(201,169,110,.4)}
  .btn-ghost{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.18)}
  .brand{margin-top:26px;color:#8a6b76;font-size:13px;letter-spacing:1px}
  .brand b{color:#C9A96E}
</style></head><body>
<div class="card">
  ${logo ? `<img class="logo" src="${_esc(logo)}" alt="">` : `<div class="logo">💅</div>`}
  <h1>${_esc(name)}</h1>
  ${city ? `<div class="city">📍 ${_esc(city)}</div>` : ''}
  <div class="tag">احجزي موعدك عبر تطبيق فيلور 🌹</div>
  <a class="btn btn-primary" id="openBtn" href="velour://salon/${id}">افتح في التطبيق</a>
  <a class="btn btn-ghost" id="dlBtn" href="${IOS_STORE}">نزّلي تطبيق فيلور</a>
  <div class="brand">V E L O U R · <b>فيلور</b></div>
</div>
<script>
  var ID=${id}, IOS=${JSON.stringify(IOS_STORE)}, AND=${JSON.stringify(ANDROID_STORE)};
  var ua=navigator.userAgent||'';
  var isAndroid=/android/i.test(ua), isIOS=/iphone|ipad|ipod/i.test(ua);
  document.getElementById('dlBtn').href = isAndroid ? AND : IOS;
  // Try to open the app; if it isn't installed we simply stay on this page (download button ready).
  var t=Date.now();
  document.getElementById('openBtn').addEventListener('click', function(e){
    e.preventDefault();
    window.location.href='velour://salon/'+ID;
    setTimeout(function(){ if(Date.now()-t<2000){ window.location.href=(isAndroid?AND:IOS); } },1200);
  });
</script>
</body></html>`;
  res.set('Content-Type', 'text/html; charset=utf-8').send(html);
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

// DISABLED by request: the recurring promo pushes ("اشتقنا إليكِ" inactive-user and
// "الصالون متاح" favorite-salon availability) are no longer scheduled. The ONLY
// automated push to clients is the one-hour-before appointment reminder below.
// (runSmartNotifJobs is kept above but intentionally never invoked.)

// ===== THE ONLY automated client push: reminder ~1 hour before the appointment =====
// Uses Palestine wall-clock (Asia/Hebron) so the timing is correct year-round (DST-safe).
function _nowInPalestine() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hebron', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: parseInt(g('hour'), 10) * 60 + parseInt(g('minute'), 10) };
}

async function runBookingReminders() {
  try {
    const nowP = _nowInPalestine();
    const bookings = await DB.bookings.find(b => b.booking_date === nowP.date && b.status === 'confirmed');
    for (const b of bookings) {
      const t = /^\d{1,2}:\d{2}/.test(b.booking_time || '') ? b.booking_time.slice(0, 5) : null;
      if (!t) continue;
      const [hh, mm] = t.split(':').map(Number);
      const minsUntil = (hh * 60 + mm) - nowP.minutes;
      // fire exactly once when the appointment is ~1 hour away (50–70 min window; job runs every 15 min)
      if (minsUntil < 50 || minsUntil > 70) continue;
      const client = await DB.users.findById(b.client_id);
      if (!client?.fcm_token) continue;
      const already = await DB.notifications.find(n => n.user_id === b.client_id && n.type === 'reminder' && String(n.booking_id) === String(b.id) && n.created_at > new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString());
      if (already.length > 0) continue;
      const title = 'تذكير: موعدك بعد ساعة ⏰';
      const body = `دورك قريب! موعدك الساعة ${t} 💅 جهّزي حالك`;
      await fcm.sendPushNotification(client.fcm_token, title, body, { type: 'reminder', booking_id: String(b.id) }).catch(() => {});
      await DB.notifications.insert({ user_id: b.client_id, title, body, type: 'reminder', booking_id: b.id });
    }
  } catch (e) { console.error('[Reminders] error:', e.message); }
}
// check every 15 minutes so the ~1-hour-before window is hit exactly once
setTimeout(() => {
  runBookingReminders();
  setInterval(runBookingReminders, 15 * 60 * 1000);
}, 15000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🌸 Glamora running at http://localhost:${PORT}\n`);
});
