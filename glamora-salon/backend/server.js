const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { DB, db, initDatabase } = require('./database');
const fcm = require('./fcm');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const SECRET = process.env.JWT_SECRET || 'glamora_secret_2024';

app.use(cors());
app.use(express.json());
const _logFile = require('path').join(__dirname, 'requests.log');
require('fs').writeFileSync(_logFile, '');
app.use((req, res, next) => {
  const line = `[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip}\n`;
  require('fs').appendFileSync(_logFile, line);
  next();
});
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/stylists', require('./routes/stylists'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stylist', require('./routes/stylist-dashboard'));
app.use('/api/media', require('./routes/media'));
app.use('/api/blocked-slots', require('./routes/blocked-slots'));

// Routes that need io for real-time events - injected after io is created
app.use('/api/bookings', (req, res, next) => { req.io = io; next(); }, require('./routes/bookings'));
app.use('/api/messages', (req, res, next) => { req.io = io; next(); }, require('./routes/messages'));

// TEMP cleanup endpoint - remove after use
app.post('/api/admin/cleanup-velour-2025', (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    // Keep only salon فيونكا (id=4) and its stylists
    const fionka = db.get('salons').find({ id: 4 }).value();
    const fionkaStylists = db.get('stylists').filter({ salon_id: 4 }).value();
    const fionkaUserIds = fionkaStylists.map(s => s.user_id).filter(Boolean);
    const fionkaUsers = db.get('users').filter(u => fionkaUserIds.includes(u.id)).value();
    // Create new customer
    const hash = bcrypt.hashSync('velour123', 10);
    const newCustomer = { id: 999, created_at: new Date().toISOString(), loyalty_points: 0, avatar: null, name: 'زبونة تيست', phone: '0599000001', email: 'test@velour.app', password: hash, role: 'user' };
    // Reset everything
    db.set('salons', [fionka]).write();
    db.set('stylists', fionkaStylists).write();
    db.set('users', [...fionkaUsers, newCustomer]).write();
    db.set('bookings', []).write();
    db.set('reviews', []).write();
    db.set('messages', []).write();
    db.set('notifications', []).write();
    db.set('salon_media', []).write();
    db.set('services', db.get('services').filter({ salon_id: 4 }).value()).write();
    db.set('salon_hours', db.get('salon_hours').filter({ salon_id: 4 }).value()).write();
    db.set('salon_ratings', []).write();
    res.json({ ok: true, salon: fionka, stylists: fionkaStylists, users: [...fionkaUsers, newCustomer], customer: { phone: '0599000001', password: 'velour123' } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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

  socket.on('send_message', (data) => {
    const { receiver_id, content, booking_id } = data;
    if (!receiver_id || !content?.trim()) return;

    const msg = DB.messages.insert({
      sender_id: socket.user.id,
      receiver_id: parseInt(receiver_id),
      booking_id: booking_id || null,
      content: content.trim()
    });
    const sender = DB.users.findOne(u => u.id === socket.user.id);
    const fullMsg = { ...msg, sender_name: sender?.name };

    io.to(`user_${receiver_id}`).emit('new_message', fullMsg);
    socket.emit('message_sent', fullMsg);

    const notifTitle = `رسالة من ${sender?.name || 'مستخدمة'} 💬`;
    const notifBody = content.trim().slice(0, 60);
    DB.notifications.insert({ user_id: parseInt(receiver_id), title: notifTitle, body: notifBody, type: 'message' });
    io.to(`user_${receiver_id}`).emit('new_notif', { type: 'message', sender_id: socket.user.id });

    const receiver = DB.users.findOne(u => u.id === parseInt(receiver_id));
    if (receiver?.fcm_token) {
      fcm.notifyNewMessage(receiver.fcm_token, sender?.name || 'مستخدمة').catch(() => {});
    }
  });

  socket.on('typing', (data) => {
    io.to(`user_${data.receiver_id}`).emit('user_typing', { sender_id: socket.user.id });
  });

  socket.on('disconnect', () => {});
});

app.post('/api/debug-log', (req, res) => {
  const msg = req.body.msg || '';
  const line = `[DEBUG ${new Date().toISOString()}] ${msg}\n`;
  require('fs').appendFileSync(require('path').join(__dirname, 'debug.log'), line);
  res.json({ ok: true });
});

app.get('/api/debug-log', (req, res) => {
  const fs = require('fs');
  const logPath = require('path').join(__dirname, 'debug.log');
  const content = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '(no logs yet)';
  const lines = content.trim().split('\n').slice(-100).join('\n');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(lines);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
server.listen(PORT, () => {
  console.log(`\n🌸 Glamora Salon App running at http://localhost:${PORT}\n`);
});
