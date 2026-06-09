// ZAIN STORE - Admin Panel
(function () {
  if (!Store.isAdminLoggedIn()) {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminApp').style.display = 'none';
  } else {
    showApp();
  }

  // LOGIN
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  function doLogin() {
    const pass = document.getElementById('loginPassword').value;
    if (Store.adminLogin(pass)) {
      document.getElementById('loginPage').style.display = 'none';
      showApp();
    } else {
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginPassword').value = '';
    }
  }

  function showApp() {
    document.getElementById('adminApp').style.display = 'flex';
    updatePendingBadge();
    navigateTo('dashboard');
  }

  // NAVIGATION
  document.querySelectorAll('.nav-item[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.panel);
      closeSidebar();
    });
  });

  function navigateTo(panel) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-panel="${panel}"]`)?.classList.add('active');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + panel)?.classList.add('active');
    const titles = { dashboard: 'لوحة التحكم', products: 'المنتجات', orders: 'الطلبات', settings: 'الإعدادات' };
    document.getElementById('topbarTitle').textContent = titles[panel] || '';
    if (panel === 'dashboard') renderDashboard();
    if (panel === 'products') renderProductsAdmin();
    if (panel === 'orders') renderOrdersAdmin('all');
    if (panel === 'settings') renderSettings();
  }

  // SIDEBAR MOBILE
  document.getElementById('mobileMenuBtn').addEventListener('click', openSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  }
  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }

  // LOGOUT
  document.getElementById('logoutBtn').addEventListener('click', () => {
    Store.adminLogout();
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('loginError').style.display = 'none';
  });

  // ===== DASHBOARD =====
  function renderDashboard() {
    const a = Store.getAnalytics();
    document.getElementById('statTodayOrders').textContent = a.todayOrders;
    document.getElementById('statTodayRevenue').textContent = a.todayRevenue + ' ₪';
    document.getElementById('statMonthOrders').textContent = a.monthOrders;
    document.getElementById('statMonthRevenue').textContent = a.monthRevenue + ' ₪';
    document.getElementById('statTotalOrders').textContent = a.totalOrders;
    document.getElementById('statTotalRevenue').textContent = a.totalRevenue + ' ₪';
    document.getElementById('statPending').textContent = a.pendingOrders;
    document.getElementById('statProducts').textContent = a.totalProducts;
    renderChart(a.monthlyData);
    renderBestSellers(a.bestSelling);
  }

  function renderChart(data) {
    const el = document.getElementById('revenueChart');
    const max = Math.max(...data.map(d => d.revenue), 1);
    el.innerHTML = data.map(d => `
      <div class="bar-item">
        <div class="bar-value">${d.revenue > 0 ? d.revenue + '₪' : ''}</div>
        <div class="bar" style="height:${Math.max(4, (d.revenue / max) * 110)}px" title="${d.label}: ${d.revenue} ₪"></div>
        <div class="bar-label">${d.label}</div>
      </div>`).join('');
  }

  function renderBestSellers(list) {
    const el = document.getElementById('bestSellersList');
    if (!list.length) { el.innerHTML = '<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:20px">لا توجد مبيعات بعد</p>'; return; }
    el.innerHTML = list.map((item, i) => `
      <div class="best-seller-item">
        <div class="rank-badge ${i === 0 ? 'gold' : ''}">${i + 1}</div>
        <div class="seller-name">${item.name}</div>
        <div>
          <div class="seller-count">${item.count} مبيع</div>
          <div class="seller-stats">${item.revenue} ₪</div>
        </div>
      </div>`).join('');
  }

  // ===== PRODUCTS =====
  let editingProductId = null;
  let productImages = [null, null, null, null];
  let productColors = [];

  function renderProductsAdmin() {
    const products = Store.getProducts();
    const grid = document.getElementById('productsAdminGrid');
    if (!products.length) {
      grid.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted);grid-column:1/-1"><p style="font-size:36px">📦</p><p>لا توجد منتجات. أضف منتجاً الآن!</p></div>`;
      return;
    }
    grid.innerHTML = products.map(p => {
      const fp = p.discount ? Math.max(0, p.price - p.discount) : p.price;
      const totalStk = (p.colors || []).reduce((t, c) => t + (c.sizes || []).reduce((tt, s) => tt + (s.stock || 0), 0), 0);
      const img = p.images && p.images[0] ? `<img class="product-admin-img" src="${p.images[0]}" alt="${p.name}">` :
        `<div class="product-admin-img" style="display:flex;align-items:center;justify-content:center;font-size:40px;background:#f5f0ed">👗</div>`;
      return `
        <div class="product-admin-card">
          ${img}
          <div class="product-admin-body">
            <div class="product-admin-name">${p.name}</div>
            <div class="product-admin-price">
              <span class="p-price">${fp} ₪</span>
              ${p.discount ? `<span class="p-original">${p.price} ₪</span><span class="p-discount">خصم ${p.discount} ₪</span>` : ''}
            </div>
            <div class="stock-summary">مخزون: ${totalStk} قطعة · ${(p.colors || []).length} ألوان</div>
            <div class="product-admin-actions">
              <button class="btn btn-outline btn-sm" onclick="openEditProduct('${p.id}')">✏️ تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑️</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  document.getElementById('addProductBtn').addEventListener('click', () => openProductForm(null));
  window.openEditProduct = function (id) { openProductForm(id); };
  window.deleteProduct = function (id) {
    if (confirm('هل تريد حذف هذا المنتج؟')) {
      Store.deleteProduct(id);
      renderProductsAdmin();
      showAdminToast('تم حذف المنتج', 'success');
    }
  };

  function openProductForm(id) {
    editingProductId = id;
    productImages = [null, null, null, null];
    productColors = [];
    const product = id ? Store.getProducts().find(p => p.id === id) : null;
    document.getElementById('productFormTitle').textContent = id ? 'تعديل المنتج' : 'إضافة منتج جديد';
    document.getElementById('productName').value = product ? product.name : '';
    document.getElementById('productPrice').value = product ? product.price : '';
    document.getElementById('productDiscount').value = product ? (product.discount || '') : '';
    document.getElementById('productDesc').value = product ? (product.description || '') : '';
    if (product && product.images) {
      productImages = [...product.images, null, null, null, null].slice(0, 4);
    }
    renderImgUploadBoxes();
    if (product && product.colors) {
      productColors = JSON.parse(JSON.stringify(product.colors));
    } else {
      productColors = [{ name: 'أسود', hex: '#000000', sizes: defaultSizes() }];
    }
    renderColorsAdmin();
    openAdminModal('productFormModal');
  }

  function defaultSizes() {
    return ['S', 'M', 'L', 'XL'].map(s => ({ size: s, stock: 0 }));
  }

  function renderImgUploadBoxes() {
    const grid = document.getElementById('imgUploadGrid');
    grid.innerHTML = productImages.map((img, i) => `
      <div class="img-upload-box ${img ? 'has-img' : ''}" id="imgBox${i}">
        ${img ? `<img src="${img}" alt=""><button class="img-remove-btn" onclick="removeImg(${i})">×</button>` :
        `<div class="img-upload-icon">+</div><div class="img-upload-label">صورة ${i + 1}</div>`}
        ${!img ? `<input type="file" accept="image/*" onchange="handleImgUpload(${i}, this)">` : ''}
      </div>`).join('');
  }

  window.removeImg = function (i) {
    productImages[i] = null;
    renderImgUploadBoxes();
  };

  window.handleImgUpload = function (i, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      productImages[i] = e.target.result;
      renderImgUploadBoxes();
    };
    reader.readAsDataURL(file);
  };

  function renderColorsAdmin() {
    const el = document.getElementById('colorsContainer');
    el.innerHTML = productColors.map((c, ci) => `
      <div class="color-entry" id="colorEntry${ci}">
        <div class="color-entry-header">
          <input type="color" value="${c.hex || '#000000'}" onchange="updateColorHex(${ci}, this.value)">
          <input type="text" value="${c.name}" placeholder="اسم اللون (مثل: أسود، أحمر)" oninput="updateColorName(${ci}, this.value)">
          <button class="btn-icon-only del" onclick="removeColor(${ci})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
        <div class="sizes-grid">
          ${c.sizes.map((s, si) => `
            <div class="size-entry">
              <label>${s.size}</label>
              <input type="number" min="0" value="${s.stock || 0}" placeholder="0" onchange="updateSizeStock(${ci}, ${si}, this.value)">
            </div>`).join('')}
        </div>
      </div>`).join('');
  }

  window.updateColorHex = (ci, val) => { productColors[ci].hex = val; };
  window.updateColorName = (ci, val) => { productColors[ci].name = val; };
  window.updateSizeStock = (ci, si, val) => { productColors[ci].sizes[si].stock = parseInt(val) || 0; };
  window.removeColor = (ci) => { productColors.splice(ci, 1); renderColorsAdmin(); };

  document.getElementById('addColorBtn').addEventListener('click', () => {
    productColors.push({ name: '', hex: '#888888', sizes: defaultSizes() });
    renderColorsAdmin();
  });

  document.getElementById('saveProductBtn').addEventListener('click', () => {
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const discount = parseFloat(document.getElementById('productDiscount').value) || 0;
    const description = document.getElementById('productDesc').value.trim();
    if (!name) { showAdminToast('أدخل اسم المنتج', 'error'); return; }
    if (!price || price <= 0) { showAdminToast('أدخل سعراً صحيحاً', 'error'); return; }
    const images = productImages.filter(Boolean);
    const colors = productColors.filter(c => c.name.trim());
    const data = { name, price, discount: discount || 0, description, images, colors };
    if (editingProductId) {
      Store.updateProduct(editingProductId, data);
      showAdminToast('تم تحديث المنتج', 'success');
    } else {
      Store.addProduct(data);
      showAdminToast('تمت إضافة المنتج', 'success');
    }
    closeAdminModal('productFormModal');
    renderProductsAdmin();
  });

  // ===== ORDERS =====
  let ordersFilter = 'all';

  function renderOrdersAdmin(filter) {
    ordersFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.filter === filter);
    });
    let orders = Store.getOrders();
    if (filter !== 'all') orders = orders.filter(o => o.status === filter);
    const el = document.getElementById('ordersList');
    if (!orders.length) {
      el.innerHTML = `<div style="text-align:center;padding:60px;color:var(--text-muted)"><p style="font-size:36px">📋</p><p>لا توجد طلبات</p></div>`;
      return;
    }
    const statusLabels = { pending: 'قيد الانتظار', approved: 'موافق عليه', rejected: 'مرفوض' };
    el.innerHTML = orders.map(o => {
      const date = new Date(o.createdAt);
      const dateStr = date.toLocaleDateString('ar-PS', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <div class="order-id">${o.id}</div>
              <div class="order-date">${dateStr}</div>
            </div>
            <span class="status-badge ${o.status}">${statusLabels[o.status]}</span>
          </div>
          <div class="order-card-body">
            <div class="order-customer">
              <strong>${o.customer?.name || ''}</strong>
              <span style="color:var(--text-muted);font-size:13px"> · ${o.customer?.city || ''}</span>
            </div>
            <div class="order-delivery-info">
              📍 ${o.customer?.address || ''}<br>
              🚚 ${o.deliveryLabel || ''} (+${o.deliveryFee || 0} ₪)
            </div>
            <div class="order-items">
              ${(o.items || []).map(item => `
                <div class="order-item-row">
                  <span>${item.name} · ${item.color} · ${item.size} × ${item.quantity || 1}</span>
                  <span>${(item.finalPrice || item.price) * (item.quantity || 1)} ₪</span>
                </div>`).join('')}
            </div>
            <div class="order-total">الإجمالي: ${o.total} ₪</div>
            <div class="order-actions">
              ${o.status === 'pending' ? `
                <button class="btn btn-success btn-sm" onclick="approveOrder('${o.id}')">✓ قبول</button>
                <button class="btn btn-danger btn-sm" onclick="rejectOrder('${o.id}')">✗ رفض</button>
              ` : ''}
              <button class="btn btn-sm" style="background:#f5f5f5;color:#999;border:1px solid #ddd" onclick="deleteOrder('${o.id}')">🗑️ حذف</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  window.deleteOrder = function (id) {
    if (confirm('هل تريد حذف هذا الطلب نهائياً؟')) {
      const orders = Store.getOrders().filter(o => o.id !== id);
      Store.saveOrders(orders);
      updatePendingBadge();
      renderOrdersAdmin(ordersFilter);
      showAdminToast('تم حذف الطلب', 'success');
    }
  };

  window.approveOrder = function (id) {
    if (confirm('هل تريد قبول هذا الطلب؟ سيتم خصم الكمية من المخزون.')) {
      Store.updateOrderStatus(id, 'approved');
      updatePendingBadge();
      renderOrdersAdmin(ordersFilter);
      showAdminToast('تم قبول الطلب وخصم المخزون', 'success');
    }
  };
  window.rejectOrder = function (id) {
    if (confirm('هل تريد رفض هذا الطلب؟')) {
      Store.updateOrderStatus(id, 'rejected');
      updatePendingBadge();
      renderOrdersAdmin(ordersFilter);
      showAdminToast('تم رفض الطلب', '');
    }
  };

  document.querySelectorAll('.filter-tab').forEach(t => {
    t.addEventListener('click', () => renderOrdersAdmin(t.dataset.filter));
  });

  function updatePendingBadge() {
    const count = Store.getPendingCount();
    const badge = document.getElementById('ordersBadge');
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }

  // ===== SETTINGS =====
  function renderSettings() {
    // nothing to pre-fill
  }

  document.getElementById('savePasswordBtn').addEventListener('click', () => {
    const p1 = document.getElementById('newPassword').value;
    const p2 = document.getElementById('confirmPassword').value;
    if (!p1) { showAdminToast('أدخل كلمة المرور الجديدة', 'error'); return; }
    if (p1 !== p2) { showAdminToast('كلمتا المرور غير متطابقتين', 'error'); return; }
    Store.changeAdminPassword(p1);
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showAdminToast('تم تغيير كلمة المرور', 'success');
  });

  // MODAL HELPERS
  function openAdminModal(id) { document.getElementById(id).classList.add('open'); }
  function closeAdminModal(id) { document.getElementById(id).classList.remove('open'); }
  window.closeAdminModal = closeAdminModal;

  document.querySelectorAll('.admin-modal-overlay').forEach(o => {
    o.addEventListener('click', e => {
      if (e.target === o) o.classList.remove('open');
    });
  });
  document.querySelectorAll('.admin-modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.admin-modal-overlay').classList.remove('open');
    });
  });

  function showAdminToast(msg, type) {
    const t = document.getElementById('adminToast');
    t.textContent = msg;
    t.className = 'admin-toast ' + type;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }
})();
