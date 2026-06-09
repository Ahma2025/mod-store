const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, q } = require('./db');

const app = express();
const PORT = 5001;
const JWT_SECRET = 'rafidia_burger_secret_2024';

// SSE clients for real-time notifications
let sseClients = [];

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer for image uploads
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    req.owner = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); }
}

// ─── SSE (Real-time notifications) ───────────────────────────
app.get('/api/events', auth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = { id: uuidv4(), res };
  sseClients.push(client);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

function notifyClients(data) {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// ─── OWNER AUTH ───────────────────────────────────────────────
app.post('/api/owner/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const owner = await q.findOne(db.owner, { username });
    if (!owner) return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غلط' });
    const valid = await bcrypt.compare(password, owner.password);
    if (!valid) return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غلط' });
    const token = jwt.sign({ id: owner._id, username: owner.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, owner: { username: owner.username, restaurant: owner.restaurant, phone: owner.phone, address: owner.address } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/owner/me', auth, async (req, res) => {
  const owner = await q.findOne(db.owner, { _id: req.owner.id });
  res.json({ success: true, data: { username: owner.username, restaurant: owner.restaurant, phone: owner.phone, address: owner.address } });
});

// ─── MENU (PUBLIC) ────────────────────────────────────────────
app.get('/api/menu', async (req, res) => {
  try {
    const items = await q.find(db.items, { available: true }, { created_at: 1 });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── MENU (OWNER - CRUD) ──────────────────────────────────────
app.get('/api/owner/menu', auth, async (req, res) => {
  try {
    const items = await q.find(db.items, {}, { created_at: -1 });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.post('/api/owner/menu', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, name_ar, description, price, category, emoji, addons } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, message: 'الاسم والسعر مطلوبان' });
    const image = req.file ? `/uploads/${req.file.filename}` : '';
    const parsedAddons = addons ? JSON.parse(addons) : [];
    const item = await q.insert(db.items, {
      name, name_ar: name_ar || name,
      description: description || '',
      price: parseFloat(price),
      category: category || 'عام',
      emoji: emoji || '🍔',
      image,
      available: true,
      addons: parsedAddons,
      created_at: new Date().toISOString(),
    });
    res.json({ success: true, data: item });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/owner/menu/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { name, name_ar, description, price, category, emoji, available, addons } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (name_ar !== undefined) update.name_ar = name_ar;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = parseFloat(price);
    if (category !== undefined) update.category = category;
    if (emoji !== undefined) update.emoji = emoji;
    if (available !== undefined) update.available = available === 'true' || available === true;
    if (addons !== undefined) update.addons = JSON.parse(addons);
    if (req.file) update.image = `/uploads/${req.file.filename}`;
    await q.update(db.items, { _id: req.params.id }, { $set: update });
    const updated = await q.findOne(db.items, { _id: req.params.id });
    res.json({ success: true, data: updated });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete('/api/owner/menu/:id', auth, async (req, res) => {
  try {
    await q.remove(db.items, { _id: req.params.id });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ORDERS (PUBLIC - place order) ───────────────────────────
app.post('/api/orders', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_address, delivery_type, items, notes } = req.body;
    if (!customer_name || !customer_phone || !items?.length) {
      return res.status(400).json({ success: false, message: 'بيانات الطلب غير مكتملة' });
    }
    if (delivery_type === 'delivery' && !customer_address) {
      return res.status(400).json({ success: false, message: 'العنوان مطلوب للتوصيل' });
    }

    const subtotal = items.reduce((sum, item) => {
      const addonsTotal = (item.selectedAddons || []).reduce((s, a) => s + (a.price || 0), 0);
      return sum + (item.price + addonsTotal) * item.quantity;
    }, 0);
    const deliveryFee = delivery_type === 'delivery' ? 10 : 0;
    const total = subtotal + deliveryFee;

    const order = await q.insert(db.orders, {
      order_number: `ORD-${Date.now()}`,
      customer_name,
      customer_phone,
      customer_address: customer_address || '',
      delivery_type,
      items,
      notes: notes || '',
      subtotal,
      delivery_fee: deliveryFee,
      total,
      status: 'new',
      created_at: new Date().toISOString(),
    });

    // Notify owner via SSE
    notifyClients({ type: 'new_order', order });

    res.json({ success: true, data: order, message: 'تم استلام طلبك بنجاح!' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ORDERS (OWNER) ───────────────────────────────────────────
app.get('/api/owner/orders', auth, async (req, res) => {
  try {
    const orders = await q.find(db.orders, {}, { created_at: -1 });
    res.json({ success: true, data: orders });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.put('/api/owner/orders/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    await q.update(db.orders, { _id: req.params.id }, { $set: { status } });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── ANALYTICS ────────────────────────────────────────────────
app.get('/api/owner/analytics', auth, async (req, res) => {
  try {
    const allOrders = await q.find(db.orders, {});
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const weekOrders = allOrders.filter(o => new Date(o.created_at) >= weekAgo);
    const monthOrders = allOrders.filter(o => new Date(o.created_at) >= monthAgo);

    // Weekly revenue by day
    const weeklyRevenue = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString('ar-EG', { weekday: 'short' });
      weeklyRevenue[key] = 0;
    }
    weekOrders.forEach(o => {
      const key = new Date(o.created_at).toLocaleDateString('ar-EG', { weekday: 'short' });
      if (weeklyRevenue[key] !== undefined) weeklyRevenue[key] += o.total || 0;
    });

    // Best selling items
    const itemSales = {};
    allOrders.forEach(o => {
      (o.items || []).forEach(item => {
        if (!itemSales[item.name]) itemSales[item.name] = { name: item.name, name_ar: item.name_ar || item.name, count: 0, revenue: 0 };
        itemSales[item.name].count += item.quantity || 1;
        itemSales[item.name].revenue += (item.price || 0) * (item.quantity || 1);
      });
    });
    const topItems = Object.values(itemSales).sort((a, b) => b.count - a.count).slice(0, 5);

    // New orders count
    const newOrders = allOrders.filter(o => o.status === 'new').length;

    res.json({
      success: true,
      data: {
        total_orders: allOrders.length,
        week_orders: weekOrders.length,
        month_orders: monthOrders.length,
        week_revenue: weekOrders.reduce((s, o) => s + (o.total || 0), 0),
        month_revenue: monthOrders.reduce((s, o) => s + (o.total || 0), 0),
        total_revenue: allOrders.reduce((s, o) => s + (o.total || 0), 0),
        new_orders: newOrders,
        weekly_chart: weeklyRevenue,
        top_items: topItems,
        delivery_count: allOrders.filter(o => o.delivery_type === 'delivery').length,
        pickup_count: allOrders.filter(o => o.delivery_type === 'pickup').length,
      },
    });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🍔 Rafidia Burger API running → http://localhost:${PORT}`);
});
