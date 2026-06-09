// ZAIN STORE - Customer App
(function () {
  let currentProduct = null;
  let selectedColor = null;
  let selectedSize = null;
  let viewMode = 'grid';
  let searchQuery = '';

  // DOM refs
  const productsContainer = document.getElementById('productsContainer');
  const cartBadge = document.getElementById('cartBadge');
  const productModal = document.getElementById('productModal');
  const cartModal = document.getElementById('cartModal');
  const checkoutModal = document.getElementById('checkoutModal');
  const successModal = document.getElementById('successModal');

  function init() {
    renderProducts();
    updateCartBadge();
    bindEvents();
  }

  function bindEvents() {
    document.getElementById('searchInput').addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderProducts();
    });
    document.getElementById('gridViewBtn').addEventListener('click', () => setView('grid'));
    document.getElementById('listViewBtn').addEventListener('click', () => setView('list'));
    document.getElementById('cartBtn').addEventListener('click', openCart);
    document.querySelectorAll('.modal-overlay').forEach(o => {
      o.addEventListener('click', e => { if (e.target === o) closeAllModals(); });
    });
  }

  function setView(mode) {
    viewMode = mode;
    document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    renderProducts();
  }

  function renderProducts() {
    let products = Store.getProducts();
    if (searchQuery) {
      products = products.filter(p => p.name.toLowerCase().includes(searchQuery));
    }
    if (!products.length) {
      productsContainer.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8L6 7h12l-2-4z"/></svg>
          <p>${searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد منتجات حالياً'}</p>
        </div>`;
      productsContainer.className = '';
      return;
    }
    productsContainer.className = viewMode === 'grid' ? 'products-grid' : 'products-list';
    productsContainer.innerHTML = products.map(p => viewMode === 'grid' ? renderCard(p) : renderListCard(p)).join('');
    productsContainer.querySelectorAll('[data-pid]').forEach(el => {
      el.addEventListener('click', () => openProduct(el.dataset.pid));
    });
    if (viewMode === 'grid') applyTiltEffect();
  }

  function isOutOfStock(product) {
    return product.colors.every(c => c.sizes.every(s => (s.stock || 0) === 0));
  }

  function totalStock(product) {
    return product.colors.reduce((t, c) => t + c.sizes.reduce((tt, s) => tt + (s.stock || 0), 0), 0);
  }

  function finalPrice(p) {
    return p.discount ? Math.max(0, p.price - p.discount) : p.price;
  }

  function renderCard(p) {
    const oos = isOutOfStock(p);
    const fp = finalPrice(p);
    const discPct = p.discount ? Math.round((p.discount / p.price) * 100) : 0;
    const img = (p.images && p.images[0])
      ? `<img src="${p.images[0]}" alt="${p.name}" loading="lazy">`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:64px;background:linear-gradient(135deg,#f8f0eb,#f0e4d7)">👗</div>`;
    const colorDots = (p.colors || []).slice(0, 4).map(c =>
      `<span class="color-dot" style="background:${c.hex||'#ccc'}" title="${c.name}"></span>`
    ).join('');
    const isNew = (Date.now() - new Date(p.createdAt).getTime()) < 7 * 86400000;
    return `
      <div class="product-card" data-pid="${p.id}">
        <div class="card-img-wrap">
          ${img}
          <div class="card-img-overlay"></div>
          ${p.discount ? `<span class="card-discount-badge">-${discPct}%</span>` : ''}
          ${isNew && !p.discount ? `<span class="card-new-badge">جديد ✨</span>` : ''}
          ${oos ? `<div class="out-of-stock-overlay"><span>نفد المخزون</span></div>` : ''}
          <div class="card-color-dots">${colorDots}</div>
          <button class="card-quick-view">👁 عرض سريع</button>
        </div>
        <div class="card-body">
          <div class="card-name">${p.name}</div>
          <div class="card-price">
            ${p.discount ? `<span class="price-original">${p.price} ₪</span>` : ''}
            <span class="price-current">${fp} <span class="price-currency">₪</span></span>
          </div>
        </div>
      </div>`;
  }

  function renderListCard(p) {
    const oos = isOutOfStock(p);
    const fp = finalPrice(p);
    const img = (p.images && p.images[0]) ? `<img src="${p.images[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;">` : '';
    return `
      <div class="product-card-list" data-pid="${p.id}">
        <div class="list-img-wrap">${img}</div>
        <div class="list-body">
          <div>
            <div class="card-name" style="font-size:15px">${p.name}</div>
            <div style="font-size:12px;color:var(--text-muted);margin:4px 0">
              ${p.colors.length} لون متوفر${oos ? ' · <span style="color:var(--danger)">نفد المخزون</span>' : ''}
            </div>
          </div>
          <div class="card-price">
            ${p.discount ? `<span class="price-original">${p.price} ₪</span>` : ''}
            <span class="price-current">${fp} ₪</span>
          </div>
        </div>
      </div>`;
  }

  function openProduct(id) {
    const product = Store.getProducts().find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    selectedColor = null;
    selectedSize = null;
    renderProductModal(product);
    openModal(productModal);
  }

  function renderProductModal(p) {
    const fp = finalPrice(p);
    document.getElementById('pdImgMain').src = (p.images && p.images[0]) || '';
    document.getElementById('pdImgMain').style.display = (p.images && p.images[0]) ? 'block' : 'none';
    // Thumbnails
    const thumbsEl = document.getElementById('pdThumbs');
    thumbsEl.innerHTML = (p.images || []).map((img, i) =>
      `<img class="img-thumb ${i === 0 ? 'active' : ''}" src="${img}" data-i="${i}" alt="">`
    ).join('');
    thumbsEl.querySelectorAll('.img-thumb').forEach(t => {
      t.addEventListener('click', () => {
        document.getElementById('pdImgMain').src = p.images[t.dataset.i];
        thumbsEl.querySelectorAll('.img-thumb').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
      });
    });
    document.getElementById('pdName').textContent = p.name;
    const priceEl = document.getElementById('pdPrice');
    const discPct2 = p.discount ? Math.round((p.discount / p.price) * 100) : 0;
    if (p.discount) {
      priceEl.innerHTML = `<span class="price-big">${fp} ₪</span><span class="price-old">${p.price} ₪</span><span class="discount-badge-modal">خصم ${discPct2}%</span>`;
    } else {
      priceEl.innerHTML = `<span class="price-big">${fp} ₪</span>`;
    }
    renderColorOptions(p);
    renderSizeOptions(null);
    updateStockInfo();
    updateAddBtn();
  }

  function renderColorOptions(p) {
    const el = document.getElementById('pdColors');
    if (!p.colors || !p.colors.length) { el.innerHTML = ''; return; }
    el.innerHTML = p.colors.map((c, i) => {
      const totalC = c.sizes.reduce((t, s) => t + (s.stock || 0), 0);
      return `<button class="color-btn ${totalC === 0 ? 'sold-out' : ''}" data-ci="${i}" ${totalC === 0 ? 'disabled' : ''}>
        <span class="color-swatch" style="background:${c.hex || '#ccc'}"></span>
        ${c.name}
      </button>`;
    }).join('');
    el.querySelectorAll('.color-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedColor = parseInt(btn.dataset.ci);
        selectedSize = null;
        renderSizeOptions(currentProduct.colors[selectedColor]);
        updateStockInfo();
        updateAddBtn();
      });
    });
  }

  function renderSizeOptions(colorObj) {
    const el = document.getElementById('pdSizes');
    const wrap = document.getElementById('pdSizesWrap');
    if (!colorObj) { wrap.style.display = 'none'; el.innerHTML = ''; return; }
    wrap.style.display = 'block';
    el.innerHTML = colorObj.sizes.map((s, i) => {
      const oos = (s.stock || 0) === 0;
      return `<button class="size-btn ${oos ? 'sold-out' : ''}" data-si="${i}" ${oos ? 'disabled' : ''}>${s.size}</button>`;
    }).join('');
    el.querySelectorAll('.size-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedSize = parseInt(btn.dataset.si);
        updateStockInfo();
        updateAddBtn();
      });
    });
  }

  function updateStockInfo() {
    const el = document.getElementById('pdStockInfo');
    if (selectedColor === null) { el.textContent = ''; el.className = 'stock-info'; return; }
    if (selectedSize === null) { el.textContent = 'اختر المقاس'; el.className = 'stock-info'; return; }
    const color = currentProduct.colors[selectedColor];
    const size = color.sizes[selectedSize];
    const stock = size.stock || 0;
    if (stock === 0) {
      el.textContent = '✕ نفد المخزون';
      el.className = 'stock-info out';
    } else if (stock <= 3) {
      el.textContent = `⚠️ باقي ${stock} قطعة فقط!`;
      el.className = 'stock-info low';
    } else {
      el.textContent = `✓ متوفر (${stock} قطعة)`;
      el.className = 'stock-info ok';
    }
  }

  function updateAddBtn() {
    const btn = document.getElementById('addToCartBtn');
    const ready = selectedColor !== null && selectedSize !== null;
    const oos = ready && (currentProduct.colors[selectedColor].sizes[selectedSize].stock || 0) === 0;
    btn.disabled = !ready || oos;
    btn.textContent = oos ? 'نفد المخزون' : ready ? 'إضافة إلى السلة 🛒' : 'اختر اللون والمقاس';
  }

  document.getElementById('addToCartBtn').addEventListener('click', () => {
    if (selectedColor === null || selectedSize === null) return;
    const color = currentProduct.colors[selectedColor];
    const size = color.sizes[selectedSize];
    const fp = finalPrice(currentProduct);
    Store.addToCart({
      productId: currentProduct.id,
      name: currentProduct.name,
      color: color.name,
      colorHex: color.hex,
      size: size.size,
      price: fp,
      image: currentProduct.images && currentProduct.images[0],
    });
    updateCartBadge();
    closeModal(productModal);
    showToast('✓ تمت الإضافة إلى السلة', 'success');
  });

  // CART
  function openCart() {
    renderCart();
    openModal(cartModal);
  }

  function renderCart() {
    const cart = Store.getCart();
    const cartItemsEl = document.getElementById('cartItems');
    const cartFooter = document.getElementById('cartFooter');
    if (!cart.length) {
      cartItemsEl.innerHTML = `<div class="empty-cart"><div style="font-size:48px;margin-bottom:12px">🛒</div><p>سلتك فارغة</p></div>`;
      cartFooter.style.display = 'none';
      return;
    }
    cartFooter.style.display = 'block';
    cartItemsEl.innerHTML = cart.map((item, i) => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.image || ''}" alt="${item.name}" onerror="this.style.display='none'">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-meta">
            <span class="color-swatch" style="background:${item.colorHex||'#ccc'};display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #ccc;"></span>
            ${item.color} · ${item.size}
          </div>
          <div class="cart-item-row">
            <div class="qty-control">
              <button class="qty-btn" onclick="changeQty(${i}, -1)">−</button>
              <span class="qty-num">${item.quantity || 1}</span>
              <button class="qty-btn" onclick="changeQty(${i}, 1)">+</button>
            </div>
            <span class="item-price">${((item.price) * (item.quantity || 1)).toFixed(0)} ₪</span>
            <button class="remove-item-btn" onclick="removeItem(${i})">×</button>
          </div>
        </div>
      </div>`).join('');

    const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    document.getElementById('cartSubtotal').textContent = subtotal.toFixed(0) + ' ₪';
    document.getElementById('cartTotal').textContent = subtotal.toFixed(0) + ' ₪';
  }

  window.changeQty = function (index, delta) {
    const cart = Store.getCart();
    const newQty = (cart[index].quantity || 1) + delta;
    if (newQty < 1) { Store.removeFromCart(index); }
    else { Store.updateCartQty(index, newQty); }
    updateCartBadge();
    renderCart();
  };

  window.removeItem = function (index) {
    Store.removeFromCart(index);
    updateCartBadge();
    renderCart();
  };

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    closeModal(cartModal);
    renderCheckout();
    openModal(checkoutModal);
  });

  // CHECKOUT
  let selectedDelivery = 'westbank';
  const deliveryFees = { westbank: 20, jerusalem: 30, inside: 60 };
  const deliveryLabels = { westbank: 'الضفة الغربية', jerusalem: 'القدس', inside: 'الداخل' };

  function renderCheckout() {
    document.querySelectorAll('.delivery-option').forEach(opt => {
      opt.addEventListener('click', () => {
        selectedDelivery = opt.dataset.delivery;
        document.querySelectorAll('.delivery-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        updateCheckoutSummary();
      });
    });
    document.querySelector('.delivery-option[data-delivery="westbank"]').classList.add('selected');
    selectedDelivery = 'westbank';
    updateCheckoutSummary();
  }

  function updateCheckoutSummary() {
    const cart = Store.getCart();
    const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    const fee = deliveryFees[selectedDelivery] || 0;
    const total = subtotal + fee;
    document.getElementById('checkoutSubtotal').textContent = subtotal.toFixed(0) + ' ₪';
    document.getElementById('checkoutDeliveryFee').textContent = fee + ' ₪';
    document.getElementById('checkoutTotal').textContent = total.toFixed(0) + ' ₪';
  }

  document.getElementById('submitOrderBtn').addEventListener('click', () => {
    const name = document.getElementById('orderName').value.trim();
    const city = document.getElementById('orderCity').value.trim();
    const address = document.getElementById('orderAddress').value.trim();
    if (!name || !city || !address) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }
    const cart = Store.getCart();
    const subtotal = cart.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
    const fee = deliveryFees[selectedDelivery] || 0;
    const total = subtotal + fee;
    const order = Store.addOrder({
      items: cart.map(i => ({
        productId: i.productId,
        name: i.name,
        color: i.color,
        size: i.size,
        quantity: i.quantity || 1,
        finalPrice: i.price,
        price: i.price,
        image: i.image
      })),
      customer: { name, city, address },
      delivery: selectedDelivery,
      deliveryLabel: deliveryLabels[selectedDelivery],
      deliveryFee: fee,
      subtotal,
      total
    });
    Store.clearCart();
    updateCartBadge();
    closeModal(checkoutModal);
    document.getElementById('successOrderId').textContent = order.id;
    openModal(successModal);
    document.getElementById('orderName').value = '';
    document.getElementById('orderCity').value = '';
    document.getElementById('orderAddress').value = '';
  });

  document.getElementById('closeSuccessBtn').addEventListener('click', () => {
    closeModal(successModal);
  });

  function updateCartBadge() {
    const count = Store.getCartCount();
    cartBadge.textContent = count;
    cartBadge.classList.toggle('hidden', count === 0);
  }

  function openModal(modal) { modal.classList.add('open'); }
  function closeModal(modal) { modal.classList.remove('open'); }
  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // 3D TILT EFFECT
  function applyTiltEffect() {
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotateX = ((y - cy) / cy) * -10;
        const rotateY = ((x - cx) / cx) * 10;
        card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        card.style.transition = 'box-shadow 0.4s, transform 0.1s';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateZ(0)';
        card.style.transition = 'box-shadow 0.4s, transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)';
      });
    });
  }

  // ENTRANCE ANIMATION on scroll
  function observeCards() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = (i * 0.07) + 's';
          entry.target.classList.add('card-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.product-card, .product-card-list').forEach(c => io.observe(c));
  }

  window.showToast = showToast;
  init();
  observeCards();
})();
