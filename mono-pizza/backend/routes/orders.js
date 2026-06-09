const express = require('express');
const router = express.Router();
const { orders } = require('../db');
const auth = require('../middleware/auth');

// Public: place order
router.post('/', (req, res) => {
  const { customerName, customerPhone, customerAddress, deliveryType, items, notes } = req.body;

  const subtotal = items.reduce((sum, item) => {
    const addonsTotal = (item.selectedAddons || []).reduce((a, b) => a + b.price, 0);
    return sum + (item.price + addonsTotal) * item.quantity;
  }, 0);
  const deliveryFee = deliveryType === 'delivery' ? 10 : 0;

  orders.count({}, (err, count) => {
    const order = {
      orderNumber: (count || 0) + 1,
      customerName, customerPhone,
      customerAddress: customerAddress || '',
      deliveryType, items,
      subtotal, deliveryFee,
      total: subtotal + deliveryFee,
      status: 'pending',
      notes: notes || '',
      createdAt: new Date()
    };
    orders.insert(order, (err, doc) => {
      if (err) return res.status(400).json({ message: err.message });
      req.app.get('io').emit('new_order', doc);
      res.status(201).json(doc);
    });
  });
});

// Admin: get all orders
router.get('/', auth, (req, res) => {
  orders.find({}).sort({ createdAt: -1 }).exec((err, docs) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(docs);
  });
});

// Admin: update status
router.put('/:id/status', auth, (req, res) => {
  orders.update({ _id: req.params.id }, { $set: { status: req.body.status } }, {}, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    orders.findOne({ _id: req.params.id }, (err, doc) => res.json(doc));
  });
});

// Admin: analytics
router.get('/analytics', auth, (req, res) => {
  const now = new Date();

  // Time boundaries
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999);
  const weekAgo    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);

  orders.find({}, (err, all) => {
    if (err) return res.status(500).json({ message: err.message });

    const active = all.filter(o => o.status !== 'cancelled');
    const todayOrders  = active.filter(o => new Date(o.createdAt) >= todayStart);
    const weekOrders   = active.filter(o => new Date(o.createdAt) >= weekAgo);
    const monthOrders  = active.filter(o => new Date(o.createdAt) >= monthStart);
    const lastMOrders  = active.filter(o => new Date(o.createdAt) >= lastMStart && new Date(o.createdAt) <= lastMEnd);

    const sum = arr => arr.reduce((s, o) => s + o.total, 0);

    // Today hourly (0-23)
    const hourlyRevenue = Array.from({length:24}, (_,h) => {
      const ho = todayOrders.filter(o => new Date(o.createdAt).getHours() === h);
      return { hour: h, revenue: sum(ho), orders: ho.length };
    });

    // Daily last 30 days
    const monthlyDaily = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = new Date(d); ds.setHours(0,0,0,0);
      const de = new Date(d); de.setHours(23,59,59,999);
      const do_ = active.filter(o => new Date(o.createdAt) >= ds && new Date(o.createdAt) <= de);
      monthlyDaily.push({
        date: ds.toLocaleDateString('ar-EG', {day:'numeric', month:'short'}),
        revenue: sum(do_), orders: do_.length
      });
    }

    // Weekly daily
    const dailyRevenue = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = new Date(d); ds.setHours(0,0,0,0);
      const de = new Date(d); de.setHours(23,59,59,999);
      const do_ = active.filter(o => new Date(o.createdAt) >= ds && new Date(o.createdAt) <= de);
      dailyRevenue.push({
        date: ds.toLocaleDateString('ar-EG', {weekday:'short'}),
        revenue: sum(do_), orders: do_.length
      });
    }

    // Top items (all time)
    const itemMap = {};
    active.forEach(order => {
      (order.items||[]).forEach(item => {
        if (!itemMap[item.name]) itemMap[item.name] = {name:item.name, count:0, revenue:0};
        itemMap[item.name].count   += item.quantity;
        itemMap[item.name].revenue += (item.price + (item.selectedAddons||[]).reduce((s,a)=>s+a.price,0)) * item.quantity;
      });
    });
    const topItems = Object.values(itemMap).sort((a,b)=>b.count-a.count).slice(0,8);

    // Delivery vs pickup
    const deliveryCount = active.filter(o=>o.deliveryType==='delivery').length;
    const pickupCount   = active.filter(o=>o.deliveryType==='pickup').length;

    // Status breakdown
    const statusBreakdown = {
      pending:   all.filter(o=>o.status==='pending').length,
      preparing: all.filter(o=>o.status==='preparing').length,
      delivered: all.filter(o=>o.status==='delivered').length,
      cancelled: all.filter(o=>o.status==='cancelled').length,
    };

    // Avg order value
    const avgOrderValue = active.length ? Math.round(sum(active) / active.length) : 0;

    // Month-over-month growth
    const monthRevenue = sum(monthOrders);
    const lastMonthRevenue = sum(lastMOrders);
    const growth = lastMonthRevenue > 0 ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : null;

    res.json({
      // Today
      todayRevenue: sum(todayOrders),
      todayOrders: todayOrders.length,
      hourlyRevenue,
      // Week
      weekRevenue: sum(weekOrders),
      weekOrdersCount: weekOrders.length,
      dailyRevenue,
      // Month
      monthRevenue,
      monthOrders: monthOrders.length,
      monthlyDaily,
      lastMonthRevenue,
      growth,
      // All time
      totalOrders: all.length,
      totalRevenue: sum(active),
      avgOrderValue,
      pendingOrders: statusBreakdown.pending,
      cancelledOrders: statusBreakdown.cancelled,
      // Breakdown
      topItems,
      deliveryCount,
      pickupCount,
      statusBreakdown,
    });
  });
});

module.exports = router;
