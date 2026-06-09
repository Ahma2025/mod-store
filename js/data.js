// ZAIN STORE - Data Management Layer

// Seed sample products on first load
(function seedDemo() {
  if (localStorage.getItem('zain_seeded')) return;
  const demo = [
    {
      id: '1001', name: 'بدلة كاجوال أنيقة', price: 180, discount: 30,
      description: 'بدلة عصرية مريحة للخروجات اليومية', images: [],
      colors: [
        { name: 'بيج', hex: '#D4B896', sizes: [{size:'S',stock:5},{size:'M',stock:8},{size:'L',stock:3},{size:'XL',stock:2}] },
        { name: 'أسود', hex: '#1A1A1A', sizes: [{size:'S',stock:4},{size:'M',stock:6},{size:'L',stock:5},{size:'XL',stock:1}] },
      ], createdAt: new Date().toISOString()
    },
    {
      id: '1002', name: 'فستان سهرة فاخر', price: 250, discount: 0,
      description: 'فستان أنيق للمناسبات والسهرات', images: [],
      colors: [
        { name: 'برغندي', hex: '#800020', sizes: [{size:'S',stock:3},{size:'M',stock:4},{size:'L',stock:2},{size:'XL',stock:0}] },
        { name: 'ذهبي', hex: '#CFB53B', sizes: [{size:'S',stock:2},{size:'M',stock:3},{size:'L',stock:1},{size:'XL',stock:0}] },
      ], createdAt: new Date().toISOString()
    },
    {
      id: '1003', name: 'تيشيرت كاجوال بنقشة', price: 85, discount: 15,
      description: 'تيشيرت قطن مريح للبيت والخروج', images: [],
      colors: [
        { name: 'وردي', hex: '#FFB6C1', sizes: [{size:'S',stock:10},{size:'M',stock:12},{size:'L',stock:8},{size:'XL',stock:5}] },
        { name: 'أبيض', hex: '#F5F5F5', sizes: [{size:'S',stock:7},{size:'M',stock:9},{size:'L',stock:6},{size:'XL',stock:3}] },
        { name: 'رمادي', hex: '#808080', sizes: [{size:'S',stock:5},{size:'M',stock:7},{size:'L',stock:4},{size:'XL',stock:2}] },
      ], createdAt: new Date().toISOString()
    },
    {
      id: '1004', name: 'بنطلون كلاسيكي رسمي', price: 120, discount: 0,
      description: 'بنطلون رسمي مناسب للدوام والمناسبات', images: [],
      colors: [
        { name: 'أسود', hex: '#1A1A1A', sizes: [{size:'S',stock:6},{size:'M',stock:8},{size:'L',stock:5},{size:'XL',stock:3}] },
        { name: 'كحلي', hex: '#1B2A4A', sizes: [{size:'S',stock:4},{size:'M',stock:5},{size:'L',stock:3},{size:'XL',stock:1}] },
      ], createdAt: new Date().toISOString()
    },
    {
      id: '1005', name: 'عباية مودرن مطرزة', price: 320, discount: 50,
      description: 'عباية عصرية بتطريز يدوي فاخر', images: [],
      colors: [
        { name: 'أسود', hex: '#1A1A1A', sizes: [{size:'S',stock:3},{size:'M',stock:4},{size:'L',stock:3},{size:'XL',stock:2}] },
        { name: 'رمادي غامق', hex: '#555555', sizes: [{size:'S',stock:2},{size:'M',stock:3},{size:'L',stock:2},{size:'XL',stock:1}] },
      ], createdAt: new Date().toISOString()
    }
  ];
  localStorage.setItem('zain_products', JSON.stringify(demo));
  localStorage.setItem('zain_orders', '[]');
  localStorage.setItem('zain_seeded', '1');
})();

const Store = {
  getProducts() {
    return JSON.parse(localStorage.getItem('zain_products') || '[]');
  },
  saveProducts(products) {
    localStorage.setItem('zain_products', JSON.stringify(products));
  },
  addProduct(product) {
    const products = this.getProducts();
    product.id = Date.now().toString();
    product.createdAt = new Date().toISOString();
    products.unshift(product);
    this.saveProducts(products);
    return product;
  },
  updateProduct(id, updates) {
    const products = this.getProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...updates };
      this.saveProducts(products);
      return products[idx];
    }
    return null;
  },
  deleteProduct(id) {
    const products = this.getProducts().filter(p => p.id !== id);
    this.saveProducts(products);
  },
  getOrders() {
    return JSON.parse(localStorage.getItem('zain_orders') || '[]');
  },
  saveOrders(orders) {
    localStorage.setItem('zain_orders', JSON.stringify(orders));
  },
  addOrder(order) {
    const orders = this.getOrders();
    order.id = 'ORD-' + Date.now();
    order.status = 'pending';
    order.createdAt = new Date().toISOString();
    orders.unshift(order);
    this.saveOrders(orders);
    return order;
  },
  updateOrderStatus(id, status) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      orders[idx].status = status;
      orders[idx].updatedAt = new Date().toISOString();
      if (status === 'approved') {
        this.deductStock(orders[idx].items);
      }
      this.saveOrders(orders);
      return orders[idx];
    }
    return null;
  },
  deductStock(items) {
    const products = this.getProducts();
    items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const color = product.colors.find(c => c.name === item.color);
        if (color) {
          const sizeObj = color.sizes.find(s => s.size === item.size);
          if (sizeObj) {
            sizeObj.stock = Math.max(0, (sizeObj.stock || 0) - (item.quantity || 1));
          }
        }
      }
    });
    this.saveProducts(products);
  },
  getPendingCount() {
    return this.getOrders().filter(o => o.status === 'pending').length;
  },
  getCart() {
    return JSON.parse(localStorage.getItem('zain_cart') || '[]');
  },
  saveCart(cart) {
    localStorage.setItem('zain_cart', JSON.stringify(cart));
  },
  addToCart(item) {
    const cart = this.getCart();
    const existing = cart.find(c =>
      c.productId === item.productId &&
      c.color === item.color &&
      c.size === item.size
    );
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
    } else {
      cart.push({ ...item, quantity: item.quantity || 1 });
    }
    this.saveCart(cart);
  },
  updateCartQty(index, qty) {
    const cart = this.getCart();
    if (cart[index]) {
      cart[index].quantity = qty;
      this.saveCart(cart);
    }
  },
  removeFromCart(index) {
    const cart = this.getCart();
    cart.splice(index, 1);
    this.saveCart(cart);
  },
  clearCart() {
    localStorage.removeItem('zain_cart');
  },
  getCartCount() {
    return this.getCart().reduce((s, i) => s + (i.quantity || 1), 0);
  },
  getAnalytics() {
    const orders = this.getOrders();
    const approved = orders.filter(o => o.status === 'approved');
    const now = new Date();

    const filterByDate = (list, days) => {
      const cutoff = new Date(now - days * 86400000);
      return list.filter(o => new Date(o.createdAt) >= cutoff);
    };

    const today = approved.filter(o => {
      const d = new Date(o.createdAt);
      return d.toDateString() === now.toDateString();
    });
    const week = filterByDate(approved, 7);
    const month = approved.filter(o => {
      const d = new Date(o.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const productSales = {};
    approved.forEach(o => {
      (o.items || []).forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.name, count: 0, revenue: 0 };
        }
        productSales[item.productId].count += (item.quantity || 1);
        productSales[item.productId].revenue += (item.finalPrice || item.price) * (item.quantity || 1);
      });
    });

    const bestSelling = Object.entries(productSales)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, data]) => ({ id, ...data }));

    // Monthly revenue for chart (last 6 months)
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mo = approved.filter(o => {
        const od = new Date(o.createdAt);
        return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear();
      });
      const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      monthlyData.push({
        label: months[d.getMonth()],
        revenue: mo.reduce((s, o) => s + (o.total || 0), 0),
        orders: mo.length
      });
    }

    return {
      todayOrders: today.length,
      todayRevenue: today.reduce((s, o) => s + (o.total || 0), 0),
      weekOrders: week.length,
      weekRevenue: week.reduce((s, o) => s + (o.total || 0), 0),
      monthOrders: month.length,
      monthRevenue: month.reduce((s, o) => s + (o.total || 0), 0),
      totalOrders: approved.length,
      totalRevenue: approved.reduce((s, o) => s + (o.total || 0), 0),
      pendingOrders: this.getPendingCount(),
      rejectedOrders: orders.filter(o => o.status === 'rejected').length,
      bestSelling,
      monthlyData,
      totalProducts: this.getProducts().length,
    };
  },
  isAdminLoggedIn() {
    return localStorage.getItem('zain_admin') === 'true';
  },
  adminLogin(password) {
    const stored = localStorage.getItem('zain_admin_pass') || 'valeria2024';
    if (password === stored) {
      localStorage.setItem('zain_admin', 'true');
      return true;
    }
    return false;
  },
  adminLogout() {
    localStorage.removeItem('zain_admin');
  },
  changeAdminPassword(newPass) {
    localStorage.setItem('zain_admin_pass', newPass);
  }
};
