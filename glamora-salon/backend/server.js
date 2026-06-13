const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const { db, initDatabase } = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const SECRET = process.env.JWT_SECRET || 'glamora_secret_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

initDatabase();

app.use('/api/auth', require('./routes/auth'));
app.use('/api/salons', require('./routes/salons'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/stylists', require('./routes/stylists'));
app.use('/api/users', require('./routes/users'));

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

    const result = db.prepare('INSERT INTO messages (sender_id, receiver_id, booking_id, content) VALUES (?, ?, ?, ?)').run(socket.user.id, receiver_id, booking_id || null, content.trim());
    const msg = db.prepare('SELECT m.*, u.name as sender_name, u.avatar as sender_avatar FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?').get(result.lastInsertRowid);

    io.to(`user_${receiver_id}`).emit('new_message', msg);
    socket.emit('message_sent', msg);
  });

  socket.on('typing', (data) => {
    io.to(`user_${data.receiver_id}`).emit('user_typing', { sender_id: socket.user.id });
  });

  socket.on('disconnect', () => {});
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
server.listen(PORT, () => {
  console.log(`\n🌸 Glamora Salon App running at http://localhost:${PORT}\n`);
});
