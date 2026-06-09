const express = require('express');
const cors = require('cors');
const { db, findAll, insertOne } = require('./database');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// ─── MENU ROUTES ─────────────────────────────────────────────
app.get('/api/menu/categories', async (req, res) => {
  try {
    const cats = await findAll(db.categories, {}, { order: 1 });
    res.json({ success: true, data: cats });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/menu/full', async (req, res) => {
  try {
    const cats = await findAll(db.categories, {}, { order: 1 });
    const result = await Promise.all(cats.map(async (cat) => ({
      ...cat,
      items: await findAll(db.items, { category_id: cat._id }),
    })));
    res.json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/menu/featured', async (req, res) => {
  try {
    const items = await findAll(db.items, { is_featured: true });
    res.json({ success: true, data: items });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── RESERVATION ROUTES ──────────────────────────────────────
app.post('/api/reservations', async (req, res) => {
  try {
    const { name, email, phone, date, time, guests, special_requests } = req.body;
    if (!name || !email || !phone || !date || !time || !guests) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }
    const doc = await insertOne(db.reservations, {
      name, email, phone, date, time,
      guests: Number(guests),
      special_requests: special_requests || '',
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    res.json({ success: true, message: 'Reservation confirmed!', id: doc._id });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = await findAll(db.reservations, {}, { created_at: -1 });
    res.json({ success: true, data: reservations });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── CONTACT ROUTES ──────────────────────────────────────────
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }
    const doc = await insertOne(db.contacts, {
      name, email,
      subject: subject || '',
      message,
      created_at: new Date().toISOString(),
    });
    res.json({ success: true, message: 'Message sent!', id: doc._id });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── STATS ───────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [items, reservations, contacts] = await Promise.all([
      new Promise(r => db.items.count({}, (_, n) => r(n))),
      new Promise(r => db.reservations.count({}, (_, n) => r(n))),
      new Promise(r => db.contacts.count({}, (_, n) => r(n))),
    ]);
    res.json({ success: true, data: { items, reservations, contacts } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ─── HEALTH ──────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'Darna API' }));

app.listen(PORT, () => {
  console.log(`🚀 Darna Backend running at http://localhost:${PORT}`);
  console.log(`📊 API Endpoints ready: /api/menu/full | /api/reservations | /api/contact`);
});
