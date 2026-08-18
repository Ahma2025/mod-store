const express = require('express');
const { DB } = require('../database');
const { authenticate } = require('./auth');
const fcm = require('../fcm');
const router = express.Router();

const REGIONS = ['west_bank', 'jerusalem', 'inside'];
function safeParse(s) { try { return JSON.parse(s || '[]'); } catch (e) { return []; } }

// POST /api/orders — customer places a product order (cash on delivery/pickup)
router.post('/', authenticate, async (req, res) => {
  try {
    const { salon_id, items, delivery_method = 'pickup', delivery_region = null,
            city = null, address = null, customer_name = '', customer_phone = '', notes = '' } = req.body;
    if (!salon_id || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'الطلب فارغ' });
    const sid = parseInt(salon_id, 10);

    // validate items + stock, build a price snapshot
    let subtotal = 0;
    const snapshot = [];
    for (const it of items) {
      const pid = parseInt(it.product_id, 10);
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      const p = await DB.beauty_products.findOne(x => x.id === pid && x.salon_id === sid && x.is_active !== 0);
      if (!p) return res.status(400).json({ error: 'أحد المنتجات لم يعد متاحاً' });
      if ((p.stock || 0) < qty) return res.status(400).json({ error: `الكمية المطلوبة من "${p.name}" غير متوفرة` });
      const price = parseFloat(p.price || 0);
      subtotal += price * qty;
      snapshot.push({ product_id: p.id, name: p.name, price, qty, image_url: p.image_url });
    }

    // delivery fee (per region, set by the stylist)
    let delivery_fee = 0;
    if (delivery_method === 'delivery') {
      if (!REGIONS.includes(delivery_region)) return res.status(400).json({ error: 'اختاري منطقة التوصيل' });
      if (!city || !address || !customer_phone) return res.status(400).json({ error: 'أكملي بيانات التوصيل (المدينة، العنوان، الجوال)' });
      const salon = await DB.salons.findOne(s => s.id === sid);
      let prices = {}; try { prices = JSON.parse(salon?.delivery_prices || '{}'); } catch (e) {}
      delivery_fee = parseFloat(prices[delivery_region] || 0);
    }
    const total = subtotal + delivery_fee;

    const me = await DB.users.findById(req.user.id);
    const order = await DB.product_orders.insert({
      salon_id: sid, client_id: req.user.id, status: 'pending',
      items: JSON.stringify(snapshot), subtotal,
      delivery_method, delivery_region: delivery_method === 'delivery' ? delivery_region : null,
      delivery_fee, total,
      customer_name: customer_name || me?.name || '', customer_phone: customer_phone || me?.phone || '',
      city: delivery_method === 'delivery' ? city : null, address: delivery_method === 'delivery' ? address : null,
      notes: notes || '',
    });

    // notify the salon owner of the new order
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === sid && s.user_id);
    if (ownerStylist) {
      const ownerId = ownerStylist.user_id;
      await DB.notifications.insert({ user_id: ownerId, title: 'طلب منتجات جديد 🛍️', body: `${order.customer_name} طلبت ${snapshot.length} منتج · ${total} ₪`, type: 'order' });
      req.io?.to(`user_${ownerId}`).emit('new_notif', { type: 'order' });
      const owner = await DB.users.findById(ownerId);
      if (owner?.fcm_token) fcm.sendPushNotification(owner.fcm_token, 'طلب منتجات جديد 🛍️', `${order.customer_name} · ${total} ₪`, { type: 'order' }).catch(() => {});
    }

    res.json({ order });
  } catch (e) {
    console.error('create order error:', e.message);
    res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
  }
});

// GET /api/orders/salon — orders for the stylist's salon
router.get('/salon', authenticate, async (req, res) => {
  try {
    const stylist = await DB.stylists.findOne(s => s.user_id === req.user.id);
    if (!stylist) return res.json([]);
    const orders = (await DB.product_orders.find(o => o.salon_id === stylist.salon_id)) || [];
    orders.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    res.json(orders.map(o => ({ ...o, items: safeParse(o.items) })));
  } catch (e) { console.error('list orders error:', e.message); res.status(500).json({ error: 'خطأ' }); }
});

// GET /api/orders/my — the customer's own orders
router.get('/my', authenticate, async (req, res) => {
  try {
    const orders = (await DB.product_orders.find(o => o.client_id === req.user.id)) || [];
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(orders.map(o => ({ ...o, items: safeParse(o.items) })));
  } catch (e) { res.status(500).json({ error: 'خطأ' }); }
});

// PUT /api/orders/:id/status — stylist approves/rejects (confirm decrements stock)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['confirmed', 'rejected'].includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' });
    const id = parseInt(req.params.id, 10);
    const order = await DB.product_orders.findOne(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
    const ownerStylist = await DB.stylists.findOne(s => s.salon_id === order.salon_id && s.user_id === req.user.id);
    if (!ownerStylist && req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'تم الرد على هذا الطلب مسبقاً' });

    if (status === 'confirmed') {
      for (const it of safeParse(order.items)) {
        const p = await DB.beauty_products.findOne(x => x.id === it.product_id);
        if (p) await DB.beauty_products.update(x => x.id === it.product_id, { stock: Math.max(0, (p.stock || 0) - (it.qty || 1)) });
      }
    }
    await DB.product_orders.update(o => o.id === id, { status });

    const title = status === 'confirmed' ? 'تم تأكيد طلبك ✅' : 'تم رفض طلبك ❌';
    const body = status === 'confirmed' ? 'طلبك جاهز! تواصلي مع الصالون للاستلام/التوصيل 💝' : 'للأسف تعذّر تنفيذ طلبك حالياً';
    await DB.notifications.insert({ user_id: order.client_id, title, body, type: 'order' });
    req.io?.to(`user_${order.client_id}`).emit('new_notif', { type: 'order' });
    const client = await DB.users.findById(order.client_id);
    if (client?.fcm_token) fcm.sendPushNotification(client.fcm_token, title, body, { type: 'order' }).catch(() => {});

    res.json({ ok: true });
  } catch (e) { console.error('order status error:', e.message); res.status(500).json({ error: 'خطأ' }); }
});

module.exports = router;
