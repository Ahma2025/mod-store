let screenStack = [];
let currentSalonData = null;
let currentChatUserId = null;
let wizardState = { step: 1, service: null, stylist: null, date: null, time: null, salonId: null };
let calendarDate = new Date();
let selectedRole = 'client';

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  const all = document.querySelectorAll('.screen');
  const target = document.getElementById('screen-' + id);
  if (!target) return;

  all.forEach(s => s.classList.remove('active'));
  target.style.display = 'block';

  // rAF ensures display:block is painted before the class (and transition) fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.classList.add('active');
      if (window.VELOUR_LANG === 'en') applyTranslations(target);
    });
  });

  if (id !== 'splash' && id !== 'onboard' && id !== 'login' && id !== 'register') {
    const prev = screenStack[screenStack.length - 1];
    if (prev !== id) screenStack.push(id);
  } else {
    screenStack = [id];
  }
}

function goBack() {
  screenStack.pop();
  const prev = screenStack[screenStack.length - 1] || 'main';
  const target = document.getElementById('screen-' + prev);
  if (!target) { showScreen('main'); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  requestAnimationFrame(() => target.classList.add('active'));
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // let the remove paint first, then add for a smooth cross-fade
  requestAnimationFrame(() => {
    document.getElementById('tab-' + name)?.classList.add('active');
    btn?.classList.add('active');
  });

  if (name === 'bookings') loadMyBookings();
  if (name === 'chat') {
    loadConversations();
    document.getElementById('chat-badge')?.classList.add('hidden');
  }
  if (name === 'profile') loadProfile();
}

function closeModal() {
  document.getElementById('modal-success').classList.add('hidden');
  showScreen('main');
  switchTab('bookings', document.querySelector('.nav-btn:nth-child(2)'));
  loadMyBookings();
}

function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); t.classList.add('hidden'); }, duration);
}

// ===== AUTH =====
async function doLogin() {
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btnText = document.getElementById('login-btn-text');
  const spinner = document.getElementById('login-spinner');

  if (!phone || !pass) { showError(errEl, 'أدخلي رقم الهاتف وكلمة المرور'); return; }

  btnText.classList.add('hidden');
  spinner.classList.remove('hidden');
  errEl.classList.add('hidden');

  try {
    const { token, user } = await Api.auth.login(phone, pass);
    setAuth(token, user);
    initSocket();
    // Save FCM token now that user is logged in
    const cachedFcm = localStorage.getItem('glamora_fcm_token');
    if (cachedFcm) saveFCMToken(cachedFcm, (typeof Capacitor !== 'undefined' ? Capacitor.getPlatform() : 'web')).catch(()=>{});
    enterApp(user);
  } catch (e) {
    showError(errEl, e.message);
  } finally {
    btnText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');

  if (!name || !phone || !pass) { showError(errEl, 'يرجى تعبئة الحقول المطلوبة'); return; }
  if (pass.length < 6) { showError(errEl, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }

  try {
    const { token, user } = await Api.auth.register({ name, phone, email, password: pass, role: selectedRole });
    setAuth(token, user);
    initSocket();
    // Save FCM token now that user is logged in
    const cachedFcmR = localStorage.getItem('glamora_fcm_token');
    if (cachedFcmR) saveFCMToken(cachedFcmR, (typeof Capacitor !== 'undefined' ? Capacitor.getPlatform() : 'web')).catch(()=>{});
    enterApp(user);
  } catch (e) {
    showError(errEl, e.message);
  }
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function enterApp(user) {
  if (typeof initFirebaseNotifications === 'function') {
    initFirebaseNotifications();
  }
  requestLocationPermission();
  if (user.role === 'stylist' || user.role === 'salon_owner') {
    enterStylistDashboard(user);
    return;
  }
  showScreen('main');
  document.getElementById('home-user-name').textContent = user.name.split(' ')[0];
  loadHome();
  loadChatBadge();
  // Beauty features: check reminders + load recommendations
  setTimeout(() => {
    checkBeautyReminder().catch(() => {});
    loadRecommendations().catch(() => {});
  }, 2000);
}

// ===== SALON LOCATION PICKER =====
let pickerMap = null;
let pickerMarker = null;
let pendingSalonLocation = null;

function openSalonLocationPicker() {
  document.getElementById('modal-location-picker').classList.remove('hidden');
  setTimeout(() => {
    if (pickerMap) { pickerMap.remove(); pickerMap = null; pickerMarker = null; }
    const center = pendingSalonLocation || userLocation || { lat: 32.0, lng: 35.2 };
    pickerMap = L.map('location-picker-map').setView([center.lat, center.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(pickerMap);
    if (pendingSalonLocation) {
      pickerMarker = L.marker([pendingSalonLocation.lat, pendingSalonLocation.lng], { draggable: true }).addTo(pickerMap);
    }
    pickerMap.on('click', (e) => {
      if (pickerMarker) pickerMarker.remove();
      pickerMarker = L.marker([e.latlng.lat, e.latlng.lng], { draggable: true }).addTo(pickerMap);
      pickerMarker.on('dragend', () => {
        const pos = pickerMarker.getLatLng();
        pendingSalonLocation = { lat: pos.lat, lng: pos.lng };
      });
      pendingSalonLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
    });
  }, 200);
}

async function confirmSalonLocation() {
  if (!pendingSalonLocation) { showToast('اضغطي على الخريطة لتحديد الموقع'); return; }
  closeModalById('modal-location-picker');

  // حفظ مباشر إذا الصالون موجود (من داشبورد الكوفيرة)
  const salonId = (typeof stSalonData !== 'undefined' && stSalonData?.id) ? stSalonData.id :
                  (typeof stEditingSalonId !== 'undefined' ? stEditingSalonId : null);
  if (salonId) {
    try {
      await Api.salons.updateLocation(salonId, pendingSalonLocation.lat, pendingSalonLocation.lng);
      showToast('✅ تم حفظ موقع الصالون على الخريطة');
      const locEl = document.getElementById('st-location-status');
      if (locEl) locEl.textContent = '✅ الموقع محدد على الخريطة';
      pendingSalonLocation = null;
      return;
    } catch(e) { showToast('خطأ في حفظ الموقع'); }
  }

  // من داخل فورم الصالون الجديد — نخزن مؤقتاً
  const status = document.getElementById('sf-location-status');
  if (status) status.textContent = `✅ تم تحديد الموقع`;
}

// ===== LOCATION =====
let userLocation = null;
let allSalonsCache = null;
let leafletMap = null;

async function getLocation() {
  const Geo = window.Capacitor?.Plugins?.Geolocation;
  if (Geo) {
    const perm = await Geo.requestPermissions().catch(() => ({ location: 'prompt' }));
    const status = perm?.location || perm?.coarseLocation;
    if (status === 'denied') throw new Error('permission_denied');
    // Try network location first (fast), then GPS
    try {
      const pos = await Geo.getCurrentPosition({ timeout: 20000, enableHighAccuracy: false });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      const pos = await Geo.getCurrentPosition({ timeout: 30000, enableHighAccuracy: true });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      reject,
      { timeout: 20000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  });
}

async function requestLocationPermission() {
  try {
    const loc = await getLocation();
    userLocation = loc;
    localStorage.setItem('velour_location', JSON.stringify(loc));
  } catch {
    const cached = localStorage.getItem('velour_location');
    if (cached) userLocation = JSON.parse(cached);
  }
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function filterTopRated(el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  showScreen('top-rated');
  document.getElementById('top-rated-loading').style.display = 'block';
  document.getElementById('top-rated-list').innerHTML = '';
  try {
    const salons = allSalonsCache || await Api.salons.list();
    allSalonsCache = salons;
    const sorted = [...salons].sort((a, b) => {
      const scoreA = a.rating * Math.log(a.reviews_count + 1);
      const scoreB = b.rating * Math.log(b.reviews_count + 1);
      return scoreB - scoreA;
    });
    document.getElementById('top-rated-loading').style.display = 'none';
    const medals = ['🥇','🥈','🥉'];
    document.getElementById('top-rated-list').innerHTML = sorted.map((s, i) => {
      const isFav = getFavorites().includes(s.id);
      const bg = s.cover_url
        ? `background:url('${mediaUrl(s.cover_url)}') center/cover no-repeat`
        : `background:linear-gradient(135deg,#6B0F2B,#C9728A)`;
      const medal = i < 3 ? medals[i] : `#${i+1}`;
      return `<div onclick="openSalon(${s.id})" style="margin:0 12px 12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);background:white;cursor:pointer;display:flex;align-items:stretch;min-height:90px;position:relative">
        <div style="width:90px;min-width:90px;${bg};display:flex;align-items:center;justify-content:center;font-size:36px">
          ${!s.cover_url ? (s.cover_emoji||'💅') : ''}
        </div>
        <div style="flex:1;padding:12px 12px 12px 8px;display:flex;flex-direction:column;justify-content:center;gap:4px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:16px">${medal}</span>
            <span style="font-family:El Messiri;font-size:15px;font-weight:800;color:#1A0A0F">${s.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="background:#fff8f0;color:#C9728A;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid #f0d8e0">⭐ ${s.rating} (${s.reviews_count})</span>
            <span style="background:#f5eef2;color:#6B0F2B;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">📍 ${s.city}</span>
          </div>
          <div style="font-family:El Messiri;font-size:12px;color:#999">${s.description ? s.description.substring(0,50)+'...' : ''}</div>
        </div>
        <button onclick="toggleFavorite(${s.id},event)" style="position:absolute;top:8px;left:8px;background:none;border:none;font-size:18px;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))">${isFav?'⭐':'☆'}</button>
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('top-rated-loading').style.display = 'none';
    showToast('خطأ في تحميل الصالونات');
  }
}

async function openNearestScreen() {
  showScreen('nearest');
  document.getElementById('nearest-loading').style.display = 'block';
  document.getElementById('nearest-list').innerHTML = '';

  let locationError = '';
  try {
    userLocation = await getLocation();
    localStorage.setItem('velour_location', JSON.stringify(userLocation));
  } catch(e) { locationError = e.message || String(e); }

  document.getElementById('nearest-loading').style.display = 'none';

  try {
    const salons = allSalonsCache || await Api.salons.list();
    allSalonsCache = salons;

    if (!userLocation) {
      document.getElementById('nearest-list').innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--gray)">
          <div style="font-size:40px;margin-bottom:12px">📍</div>
          <div style="font-size:15px;margin-bottom:8px">يرجى السماح بالوصول للموقع</div>
          <div style="font-size:11px;color:#C9728A;margin-bottom:4px">${locationError}</div>
          <div style="font-size:12px;color:var(--gray)">تأكدي إن خدمات الموقع مفعّلة بالإعدادات</div>
          <button onclick="retryLocation()" style="margin-top:16px;background:var(--primary);color:white;border:none;border-radius:20px;padding:10px 24px;font-family:El Messiri;font-size:14px;cursor:pointer">إعادة المحاولة</button>
        </div>`;
      return;
    }

    const withDist = salons
      .filter(s => s.latitude && s.longitude)
      .map(s => ({ ...s, _dist: haversineKm(userLocation.lat, userLocation.lng, s.latitude, s.longitude) }))
      .sort((a, b) => a._dist - b._dist);
    const withoutDist = salons.filter(s => !s.latitude || !s.longitude);
    const sorted = [...withDist, ...withoutDist];

    document.getElementById('nearest-list').innerHTML = sorted.map((s, i) => {
      const isFav = getFavorites().includes(s.id);
      const bg = s.cover_url
        ? `background:url('${mediaUrl(s.cover_url)}') center/cover no-repeat`
        : `background:linear-gradient(135deg,#6B0F2B,#C9728A)`;
      const dist = s._dist != null
        ? (s._dist < 1 ? (s._dist*1000).toFixed(0)+'م' : s._dist.toFixed(1)+'كم')
        : s.city;
      const rank = i < 3 ? ['🥇','🥈','🥉'][i] : '';
      return `
      <div onclick="openSalon(${s.id})" style="margin:0 12px 12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);background:white;cursor:pointer;display:flex;align-items:stretch;min-height:90px;position:relative">
        <div style="width:90px;min-width:90px;${bg};display:flex;align-items:center;justify-content:center;font-size:36px">
          ${!s.cover_url ? (s.cover_emoji||'💅') : ''}
        </div>
        <div style="flex:1;padding:12px 12px 12px 8px;display:flex;flex-direction:column;justify-content:center;gap:4px">
          <div style="display:flex;align-items:center;gap:6px">
            ${rank ? `<span style="font-size:16px">${rank}</span>` : ''}
            <span style="font-family:El Messiri;font-size:15px;font-weight:800;color:#1A0A0F">${s.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="background:#fff8f0;color:#C9728A;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid #f0d8e0">⭐ ${s.rating} (${s.reviews_count})</span>
            <span style="background:#f5eef2;color:#6B0F2B;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">📍 ${dist}</span>
          </div>
          <div style="font-family:El Messiri;font-size:12px;color:#999">${s.description ? s.description.substring(0,50)+'...' : s.city}</div>
        </div>
        <button onclick="toggleFavorite(${s.id},event)" style="position:absolute;top:8px;left:8px;background:none;border:none;font-size:18px;cursor:pointer;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))">${isFav?'⭐':'☆'}</button>
      </div>`;
    }).join('');

    if (!withDist.length) showToast('لا توجد صالونات بمواقع محددة بعد — أضيفي موقع صالونك من الداشبورد');
  } catch (e) { showToast('خطأ في تحميل الصالونات'); }
}

async function retryLocation() {
  document.getElementById('nearest-list').innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray)">جاري تحديد موقعك...</div>';
  try {
    userLocation = await getLocation();
    localStorage.setItem('velour_location', JSON.stringify(userLocation));
  } catch {}
  openNearestScreen();
}

async function openMapScreen() {
  showScreen('map');
  await new Promise(r => setTimeout(r, 100));

  if (!userLocation) {
    try { userLocation = await getLocation(); localStorage.setItem('velour_location', JSON.stringify(userLocation)); } catch {}
  }

  const center = userLocation || { lat: 32.0, lng: 35.2 };

  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  leafletMap = L.map('map-container').setView([center.lat, center.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(leafletMap);

  if (userLocation) {
    const userIcon = L.divIcon({ html: '<div style="background:#C9728A;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5)"></div>', iconSize:[20,20], iconAnchor:[10,10], className:'' });
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(leafletMap).bindPopup('<b>موقعك الحالي</b>');
  }

  try {
    const salons = await Api.salons.allLocations();
    salons.forEach(s => {
      const emoji = s.cover_emoji || '✂️';
      const salonIcon = L.divIcon({
        html: `<div style="background:#6B0F2B;border-radius:20px;padding:6px 10px;font-size:13px;white-space:nowrap;box-shadow:0 3px 10px rgba(107,15,43,0.4);font-family:El Messiri;font-weight:700;color:white;display:flex;align-items:center;gap:5px;position:relative">
          <span style="font-size:15px">${emoji}</span>
          <span>${s.name}</span>
          <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:7px solid #6B0F2B"></div>
        </div>`,
        iconAnchor:[40, 37], className:''
      });
      L.marker([s.latitude, s.longitude], { icon: salonIcon })
        .addTo(leafletMap)
        .bindPopup(`<div style="font-family:El Messiri;text-align:right;min-width:140px"><b style="font-size:14px">${s.name}</b><br><span style="color:#888;font-size:12px">⭐ ${s.rating} · ${s.city}</span><br><a href="#" onclick="openSalon(${s.id});goBack();return false;" style="color:#C9728A;font-size:13px;font-weight:700">عرض الصالون ←</a></div>`);
    });
    if (!salons.length) showToast('لا توجد صالونات بمواقع محددة بعد');
  } catch(e) { showToast('خطأ في تحميل مواقع الصالونات'); }
}

function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.role-card[data-role="${role}"]`)?.classList.add('active');
}

function togglePass(id) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ===== HOME =====
async function loadHome() {
  try {
    const salons = await Api.salons.list();
    allSalonsCache = salons;
    renderFeaturedSalons(salons);
    renderHomeTopRated(salons);
    renderSalonsList([...salons].sort((a,b) => b.id - a.id));
    loadNotifBadge();
    loadHomeNearYou(salons);
  } catch (e) {
    console.error(e);
  }
}

function renderHomeTopRated(salons) {
  const sorted = [...salons].sort((a,b) => b.rating - a.rating || b.reviews_count - a.reviews_count).slice(0, 8);
  const el = document.getElementById('home-top-rated-list');
  if (!el) return;
  el.innerHTML = sorted.map(s => homeSalonCard(s)).join('');
}

function homeSalonCard(s, distText) {
  const thumb = s.cover_url
    ? `<img src="${mediaUrl(s.cover_url)}" onerror="this.style.display='none'">`
    : s.cover_emoji || '💅';
  const meta = distText
    ? `<div class="hsc-dist">📍 ${distText}</div>`
    : `<div class="hsc-meta">⭐ ${s.rating} · ${s.city}</div>`;
  return `<div class="home-salon-card" onclick="openSalon(${s.id})">
    <div class="hsc-thumb">${thumb}</div>
    <div class="hsc-info">
      <div class="hsc-name">${s.name}</div>
      ${meta}
    </div>
  </div>`;
}

async function loadHomeNearYou(salons) {
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout:5000}));
    const { latitude: lat, longitude: lon } = pos.coords;
    function dist(s) {
      if (!s.latitude || !s.longitude) return Infinity;
      const R = 6371;
      const dLat = (s.latitude - lat) * Math.PI / 180;
      const dLon = (s.longitude - lon) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(s.latitude*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    const withDist = salons.map(s => ({...s, _dist: dist(s)})).filter(s => s._dist < Infinity).sort((a,b) => a._dist - b._dist).slice(0, 5);
    if (!withDist.length) return;
    const section = document.getElementById('section-near-you');
    const el = document.getElementById('home-near-list');
    if (!section || !el) return;
    section.style.display = '';
    el.innerHTML = withDist.map(s => {
      const d = s._dist < 1 ? (s._dist*1000).toFixed(0)+'م' : s._dist.toFixed(1)+'كم';
      return homeSalonCard(s, d);
    }).join('');
  } catch {}
}

async function filterByService(serviceName) {
  showScreen('service-filter');
  document.getElementById('service-filter-title').textContent = serviceName;
  document.getElementById('service-filter-loading').style.display = 'block';
  document.getElementById('service-filter-empty').style.display = 'none';
  document.getElementById('service-filter-list').innerHTML = '';

  try {
    const salons = allSalonsCache || await Api.salons.list();
    allSalonsCache = salons;

    const filtered = salons.filter(s => {
      let cats = [];
      try { cats = JSON.parse(s.categories || '[]'); } catch {}
      return cats.includes(serviceName) ||
        s.services?.some(sv => sv.category?.includes(serviceName) || sv.name?.includes(serviceName));
    });

    document.getElementById('service-filter-loading').style.display = 'none';

    const list = filtered.length ? filtered : salons;
    if (!filtered.length) {
      document.getElementById('service-filter-empty').style.display = 'block';
      return;
    }

    const favs = getFavorites();
    document.getElementById('service-filter-list').innerHTML = list.map(s => {
      const isFav = favs.includes(s.id);
      const thumb = s.cover_url
        ? `<img src="${mediaUrl(s.cover_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.outerHTML='${s.cover_emoji||'💅'}'"`+'>'
        : (s.cover_emoji || '💅');
      return `
      <div class="salon-card" onclick="openSalon(${s.id})" style="position:relative">
        <button onclick="toggleFavorite(${s.id}, event)" style="position:absolute;top:10px;left:10px;background:none;border:none;font-size:20px;cursor:pointer;z-index:2;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))">${isFav ? '⭐' : '☆'}</button>
        <div class="salon-thumb" style="${s.cover_url?'padding:0;overflow:hidden':''}">${thumb}</div>
        <div class="salon-card-info">
          <h4>${s.name}</h4>
          <div class="salon-card-meta">
            <span class="salon-rating-badge">⭐ ${s.rating} (${s.reviews_count})</span>
            <span style="color:#888;font-size:12px">📍 ${s.city}</span>
          </div>
          <p style="font-size:13px;color:var(--gray)">${s.description ? s.description.substring(0,60)+'...' : ''}</p>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    document.getElementById('service-filter-loading').style.display = 'none';
  }
}

let featuredSliderTimer = null;
let featuredSliderIndex = 0;

function renderFeaturedSalons(salons) {
  const sorted = [...salons].sort((a,b) => (b.rating * Math.log(b.reviews_count+1)) - (a.rating * Math.log(a.reviews_count+1)));
  const top = sorted.slice(0, 8);
  const container = document.getElementById('featured-salons');

  container.style.cssText = 'position:relative;overflow:hidden;border-radius:18px;height:200px;background:#1A0A0F;cursor:pointer';

  const slides = top.map((s, i) => {
    const bg = s.cover_url
      ? `background:url('${mediaUrl(s.cover_url)}') center/cover no-repeat`
      : `background:linear-gradient(135deg,#6B0F2B,#C9728A)`;
    return `
    <div class="fslide" data-id="${s.id}" style="position:absolute;inset:0;${bg};transition:opacity 0.5s ease;opacity:${i===0?1:0};pointer-events:${i===0?'auto':'none'};display:flex;flex-direction:column;justify-content:flex-end">
      <div style="background:linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%);padding:16px 14px 14px;border-radius:0 0 18px 18px">
        ${!s.cover_url ? `<div style="font-size:42px;text-align:center;margin-bottom:6px">${s.cover_emoji||'💅'}</div>` : ''}
        <div style="font-family:El Messiri;font-size:18px;font-weight:800;color:white">${s.name}</div>
        <div style="font-family:El Messiri;font-size:13px;color:rgba(255,255,255,0.8);margin-top:2px">📍 ${s.city} · ⭐ ${s.rating}</div>
      </div>
    </div>`;
  }).join('');

  const dots = top.map((_, i) =>
    `<div class="fdot" onclick="event.stopPropagation();goFeaturedSlide(${i})" style="width:${i===0?'20px':'7px'};height:7px;border-radius:4px;background:${i===0?'white':'rgba(255,255,255,0.45)'};transition:all 0.3s;cursor:pointer"></div>`
  ).join('');

  container.innerHTML = slides + `<div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:5px;align-items:center;z-index:5">${dots}</div>`;

  // Click to open salon
  container.onclick = () => {
    const active = container.querySelector('.fslide[style*="pointer-events: auto"], .fslide[style*="pointer-events:auto"]');
    const id = active ? parseInt(active.dataset.id) : null;
    if (id) openSalon(id);
  };

  // Swipe support
  let touchStartX = 0;
  container.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  container.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goFeaturedSlide(diff > 0
      ? (featuredSliderIndex + 1) % top.length
      : (featuredSliderIndex - 1 + top.length) % top.length);
  }, { passive: true });

  if (featuredSliderTimer) clearInterval(featuredSliderTimer);
  featuredSliderIndex = 0;
  featuredSliderTimer = setInterval(() => goFeaturedSlide((featuredSliderIndex + 1) % top.length), 3000);
}

function goFeaturedSlide(idx) {
  const slides = document.querySelectorAll('.fslide');
  const dots = document.querySelectorAll('.fdot');
  if (!slides.length) return;
  slides.forEach((s, i) => {
    s.style.opacity = i === idx ? 1 : 0;
    s.style.pointerEvents = i === idx ? 'auto' : 'none';
  });
  dots.forEach((d, i) => {
    d.style.width = i === idx ? '20px' : '7px';
    d.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.45)';
  });
  featuredSliderIndex = idx;
}


function getFavorites() {
  try { return JSON.parse(localStorage.getItem('velour_favs') || '[]'); } catch { return []; }
}
function toggleFavorite(id, e) {
  e.stopPropagation();
  let favs = getFavorites();
  if (favs.includes(id)) { favs = favs.filter(f => f !== id); }
  else { favs.unshift(id); }
  localStorage.setItem('velour_favs', JSON.stringify(favs));
  const allSalons = allSalonsCache || [];
  renderSalonsList(allSalons);
}

function renderSalonsList(salons, showDistance = false) {
  const favs = getFavorites();
  // Sort: favorites first, then by newest (highest id)
  const sorted = [...salons].sort((a, b) => {
    const aFav = favs.includes(a.id) ? 1 : 0;
    const bFav = favs.includes(b.id) ? 1 : 0;
    if (bFav !== aFav) return bFav - aFav;
    return b.id - a.id;
  });

  document.getElementById('salons-list').innerHTML = sorted.map(s => {
    const isFav = favs.includes(s.id);
    const thumb = s.cover_url
      ? `<img src="${mediaUrl(s.cover_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" onerror="this.outerHTML='${s.cover_emoji||'💅'}'"`+'>'
      : (s.cover_emoji || '💅');
    const distBadge = showDistance && s._dist != null
      ? `<span style="color:#C9728A;font-size:12px;font-weight:600">📍 ${s._dist < 1 ? (s._dist*1000).toFixed(0)+'م' : s._dist.toFixed(1)+'كم'}</span>`
      : `<span style="color:#888;font-size:12px">📍 ${s.city}</span>`;
    return `
    <div class="salon-card" onclick="openSalon(${s.id})" style="position:relative">
      <button onclick="toggleFavorite(${s.id}, event)" style="position:absolute;top:10px;left:10px;background:none;border:none;font-size:20px;cursor:pointer;z-index:2;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.2))">${isFav ? '⭐' : '☆'}</button>
      <div class="salon-thumb" style="${s.cover_url?'padding:0;overflow:hidden':''}">${thumb}</div>
      <div class="salon-card-info">
        <h4>${s.name}</h4>
        <div class="salon-badges-row">
          ${s.is_verified ? '<span class="salon-badge badge-verified">✓ موثّق</span>' : ''}
          ${s.is_new ? '<span class="salon-badge badge-new">✨ جديد</span>' : ''}
          ${s.is_most_booked ? '<span class="salon-badge badge-hot">🔥 الأكثر حجزاً</span>' : ''}
        </div>
        <div class="salon-card-meta">
          <span class="salon-rating-badge">⭐ ${s.rating} (${s.reviews_count})</span>
          ${distBadge}
        </div>
        <p style="font-size:13px;color:var(--gray)">${s.description ? s.description.substring(0,60) + '...' : ''}</p>
      </div>
    </div>`;
  }).join('');
}

async function searchSalons(q) {
  try {
    const salons = await Api.salons.list(q ? { search: q } : {});
    renderSalonsList(salons);
  } catch (e) {}
}

async function filterCategory(el, cat) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  try {
    const salons = allSalonsCache || await Api.salons.list();
    allSalonsCache = salons;
    const filtered = cat ? salons.filter(s => (s.services || []).some(sv => sv.category === cat)) : salons;
    renderSalonsList(cat ? filtered : salons);
  } catch(e) {}
}

// ===== SALON DETAIL =====
async function openSalon(id) {
  showScreen('salon');
  document.getElementById('salon-services-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const data = await Api.salons.get(id);
    currentSalonData = data;

    document.getElementById('salon-detail-name').textContent = data.name;
    document.getElementById('salon-detail-rating').textContent = data.rating || '0';
    document.getElementById('salon-detail-reviews').textContent = data.reviews_count || 0;
    document.getElementById('salon-detail-city').textContent = data.city;
    // Badges on detail header
    const badgesHtml = [
      data.is_verified ? '<span class="salon-badge badge-verified">✓ موثّق</span>' : '',
      data.is_new ? '<span class="salon-badge badge-new">✨ جديد</span>' : '',
    ].filter(Boolean).join('');
    const metaEl = document.querySelector('.salon-meta');
    if (metaEl && badgesHtml) {
      let badgeRow = document.getElementById('salon-detail-badges');
      if (!badgeRow) { badgeRow = document.createElement('div'); badgeRow.id = 'salon-detail-badges'; badgeRow.className = 'salon-badges-row'; metaEl.after(badgeRow); }
      badgeRow.innerHTML = badgesHtml;
    }

    renderSalonServices(data.services);
    renderSalonStylists(data.stylists);
    renderSalonRatings(data);
    renderSalonInfo(data);
    loadSalonGallery(id);

    const cats = [...new Set(data.services.map(s => s.category))];
    const filterHtml = `<div class="svc-filter-chip active" onclick="filterSalonServices(this, '')">الكل</div>` +
      cats.map(c => `<div class="svc-filter-chip" onclick="filterSalonServices(this, '${c}')">${categoryIcon(c)} ${c}</div>`).join('');
    document.getElementById('services-filter').innerHTML = filterHtml;
  } catch (e) {
    showToast('خطأ في تحميل بيانات الصالون');
  }
}

function renderSalonServices(services) {
  if (!services?.length) { document.getElementById('salon-services-list').innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><h3>لا توجد خدمات</h3></div>'; return; }
  document.getElementById('salon-services-list').innerHTML = services.map(s => `
    <div class="service-card" onclick="quickBook(${s.id}, ${s.salon_id})">
      <div class="service-icon">${categoryIcon(s.category)}</div>
      <div class="service-info">
        <h4>${s.name_ar || s.name}</h4>
        <p>${s.description ? s.description.substring(0,55) + '...' : ''}</p>
        <div class="duration">⏱ ${s.duration_minutes} دقيقة</div>
      </div>
      <div class="service-price">₪${s.price}</div>
    </div>
  `).join('');
}

function renderSalonStylists(stylists) {
  if (!stylists?.length) { document.getElementById('salon-stylists-list').innerHTML = '<div class="empty-state"><div class="empty-icon">👩</div><h3>لا توجد كوفيرات</h3></div>'; return; }
  document.getElementById('salon-stylists-list').innerHTML = stylists.map(st => {
    let specs = [];
    try { specs = JSON.parse(st.specialties || '[]'); } catch {}
    return `
    <div class="stylist-card-full" onclick="openStylistBooking(${st.id})">
      <div class="stylist-card-avatar">${st.avatar ? `<img class="avatar-img" src="${st.avatar}" alt="${st.name}">` : (st.name || '؟')[0]}</div>
      <div class="stylist-card-info">
        <h4>${st.name}</h4>
        ${st.bio ? `<div class="stylist-bio">${st.bio}</div>` : ''}
        <div class="specialty-tags">${specs.slice(0,3).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </div>`;
  }).join('');
}

let selectedRating = 0;

function renderSalonRatings(data) {
  const ratings = data.salon_ratings || [];
  const avg = data.rating || 0;
  const count = data.reviews_count || 0;

  document.getElementById('rw-avg').textContent = avg > 0 ? avg.toFixed(1) : '0';
  document.getElementById('rw-stars-display').textContent = avg > 0 ? '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg)) : '☆☆☆☆☆';
  document.getElementById('rw-count').textContent = count > 0 ? `${count} تقييم` : 'لا توجد تقييمات بعد';

  // Visitor count
  if (data.total_visitors > 0) {
    const countEl = document.getElementById('rw-count');
    countEl.textContent = `${count} تقييم · 👩 ${data.total_visitors} زبونة زارت الصالون`;
  }

  // Reset sub-ratings
  subRatings = { cleanliness: 0, punctuality: 0, result: 0 };
  ['cleanliness','punctuality','result'].forEach(k => updateSubStars(k, 0));

  // Load user's existing rating
  selectedRating = 0;
  if (currentUser && currentSalonData) {
    Api.salons.myRating(currentSalonData.id).then(r => {
      if (r.stars) { selectedRating = r.stars; updateStarInput(r.stars); }
    }).catch(() => {});
  }

  if (!ratings.length) {
    document.getElementById('salon-reviews-list').innerHTML = '<div class="empty-state" style="padding:20px 16px"><div class="empty-icon">⭐</div><h3>كوني أول من يقيّم!</h3></div>';
    return;
  }

  document.getElementById('salon-reviews-list').innerHTML = ratings.map(r => {
    const subTags = [
      r.cleanliness_rating ? `🧹 ${r.cleanliness_rating}/5` : '',
      r.punctuality_rating ? `⏰ ${r.punctuality_rating}/5` : '',
      r.result_rating ? `✨ ${r.result_rating}/5` : '',
    ].filter(Boolean);
    const baHtml = (r.before_photo || r.after_photo) ? `
      <div class="review-before-after">
        ${r.before_photo ? `<div class="review-ba-img"><img src="${r.before_photo}" loading="lazy"><div class="review-ba-label">قبل</div></div>` : ''}
        ${r.after_photo ? `<div class="review-ba-img"><img src="${r.after_photo}" loading="lazy"><div class="review-ba-label">بعد</div></div>` : ''}
      </div>` : '';
    const replyHtml = r.reply_text ? `
      <div class="review-reply">
        <div class="review-reply-label">💬 رد الصالون</div>
        <div class="review-reply-text">${r.reply_text}</div>
      </div>` : '';
    return `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar">${(r.client_name || '؟')[0]}</div>
        <div>
          <div class="review-name">${r.client_name || 'زبونة'}</div>
          <div class="review-date">${new Date(r.created_at).toLocaleDateString('ar-SA')}</div>
        </div>
      </div>
      <div class="review-stars-row">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      ${subTags.length ? `<div class="review-sub-ratings">${subTags.map(t => `<span class="review-sub-tag">${t}</span>`).join('')}</div>` : ''}
      ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}
      ${baHtml}
      ${replyHtml}
    </div>`;
  }).join('');
}

let subRatings = { cleanliness: 0, punctuality: 0, result: 0 };

function setSubRating(key, val) {
  subRatings[key] = val;
  updateSubStars(key, val);
}

function updateSubStars(key, val) {
  document.querySelectorAll(`#sub-${key} span`).forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= val);
  });
}

let reviewBeforeUrl = null, reviewAfterUrl = null;

async function previewReviewPhoto(input, type) {
  const file = input.files[0];
  if (!file) return;
  const previewEl = document.getElementById(`${type}-photo-preview`);
  const reader = new FileReader();
  reader.onload = e => { previewEl.src = e.target.result; previewEl.classList.remove('hidden'); };
  reader.readAsDataURL(file);
  try {
    const res = await Api.stylistDash.uploadReviewPhoto(file);
    if (res.url) { type === 'before' ? (reviewBeforeUrl = res.url) : (reviewAfterUrl = res.url); }
  } catch (e) { showToast('فشل رفع الصورة'); }
}

function updateStarInput(val) {
  document.querySelectorAll('.star-btn').forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.v) <= val);
  });
}

function setSalonRating(val) {
  selectedRating = val;
  updateStarInput(val);
}

async function submitSalonRating() {
  if (!currentUser) { showToast('يجب تسجيل الدخول أولاً'); return; }
  if (!selectedRating) { showToast('اختاري عدد النجوم أولاً'); return; }
  if (!currentSalonData) { showToast('خطأ: بيانات الصالون غير محملة'); return; }
  const btn = document.querySelector('.rating-submit-btn');
  const comment = document.getElementById('rating-comment').value.trim();
  if (btn) { btn.disabled = true; btn.textContent = 'جاري الإرسال...'; }
  try {
    const result = await Api.salons.rate(currentSalonData.id, selectedRating, comment,
      subRatings.cleanliness || null, subRatings.punctuality || null, subRatings.result || null,
      reviewBeforeUrl, reviewAfterUrl
    );
    document.getElementById('salon-detail-rating').textContent = result.rating;
    document.getElementById('salon-detail-reviews').textContent = result.reviews_count;
    document.getElementById('rw-avg').textContent = result.rating.toFixed(1);
    document.getElementById('rw-count').textContent = `${result.reviews_count} تقييم`;
    document.getElementById('rw-stars-display').textContent = '★'.repeat(Math.round(result.rating)) + '☆'.repeat(5 - Math.round(result.rating));
    document.getElementById('rating-comment').value = '';
    const data = await Api.salons.get(currentSalonData.id);
    currentSalonData = data;
    document.getElementById('salon-reviews-list').innerHTML = '';
    renderSalonRatings(data);
    showToast('✅ شكراً على تقييمك!');
  } catch (e) {
    showToast('خطأ: ' + (e.message || 'فشل الاتصال بالسيرفر'));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'إرسال التقييم'; }
  }
}

function renderSalonReviews(reviews) {
  if (!reviews?.length) { document.getElementById('salon-reviews-list').innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><h3>لا توجد تقييمات بعد</h3></div>'; return; }
  document.getElementById('salon-reviews-list').innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="review-header">
        <div class="review-avatar">${(r.client_name || '؟')[0]}</div>
        <div>
          <div class="review-name">${r.client_name}</div>
          <div class="review-stars">${'⭐'.repeat(r.rating)}</div>
        </div>
        <div class="review-date" style="margin-right:auto">${formatDate(r.created_at)}</div>
      </div>
      <div class="review-comment">${r.comment || ''}</div>
    </div>
  `).join('');
}

let _sliderState = null;
let _coverSliderState = null;

async function loadSalonGallery(salonId) {
  try {
    const media = await Api.salons.media(salonId);
    const photos = media.filter(m => m.url && m.type !== 'video');
    const video  = media.find(m => m.url && m.type === 'video');

    // Slider: photos only
    buildCoverSlider(photos);

    // Dedicated video section
    buildVideoSection(video);

    const strip = document.getElementById('salon-gallery-strip');
    if (strip) strip.classList.add('hidden');
  } catch (e) {}
}

function buildVideoSection(videoItem) {
  const sec = document.getElementById('salon-video-section');
  if (!sec) return;
  if (!videoItem) { sec.classList.add('hidden'); sec.innerHTML = ''; return; }

  const url = mediaUrl(videoItem.url);
  sec.classList.remove('hidden');
  sec.innerHTML = `
    <video class="svs-thumb" src="${url}" preload="metadata" muted playsinline></video>
    <div class="svs-play" onclick="openMediaViewer('${url}','video')">
      <div class="svs-play-btn">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="11,7 31,18 11,29" fill="#7B1D40"/>
        </svg>
      </div>
      <span class="svs-label">فيديو الصالون</span>
    </div>`;
}

function buildCoverSlider(items) {
  if (_coverSliderState && _coverSliderState.timer) clearInterval(_coverSliderState.timer);
  const track = document.getElementById('cover-slider-track');
  const dotsEl = document.getElementById('cover-dots');
  if (!track || !dotsEl) return;

  if (!items.length) {
    track.innerHTML = '';
    dotsEl.innerHTML = '';
    return;
  }

  track.innerHTML = items.map((m) => {
    const url = mediaUrl(m.url);
    if (m.type === 'video') {
      return `<div class="cover-slide" style="flex:0 0 100%;position:relative;">
        <video src="${url}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;display:block;"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="openMediaViewer('${url}','video')">
          <svg viewBox="0 0 60 60" width="52" height="52" fill="none">
            <circle cx="30" cy="30" r="29" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
            <polygon points="24,18 46,30 24,42" fill="white"/>
          </svg>
        </div>
      </div>`;
    }
    return `<div class="cover-slide" style="flex:0 0 100%;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;display:block;" draggable="false">
    </div>`;
  }).join('');

  dotsEl.innerHTML = items.map((_, i) =>
    `<span class="cover-dot${i===0?' active':''}" onclick="coverSliderGoTo(${i})"></span>`
  ).join('');

  _coverSliderState = { cur: 0, total: items.length, timer: null };
  if (items.length > 1) {
    _coverSliderState.timer = setInterval(() => {
      coverSliderGoTo((_coverSliderState.cur + 1) % _coverSliderState.total);
    }, 3000);
  }

  // swipe support
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) coverSliderGoTo(dx < 0
      ? (_coverSliderState.cur + 1) % _coverSliderState.total
      : (_coverSliderState.cur - 1 + _coverSliderState.total) % _coverSliderState.total);
  }, {passive:true});
}

function coverSliderGoTo(idx) {
  if (!_coverSliderState) return;
  _coverSliderState.cur = idx;
  const track = document.getElementById('cover-slider-track');
  if (track) track.style.transform = `translateX(${idx * 100}%)`;
  document.querySelectorAll('.cover-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}

function buildSlider(container, items) {
  if (_sliderState && _sliderState.timer) clearInterval(_sliderState.timer);

  const slides = items.map((m, i) => {
    const mUrl = mediaUrl(m.url);
    if (m.type === 'video') {
      return `<div class="slider-slide" data-idx="${i}" data-type="video" data-url="${mUrl}">
        <video src="${mUrl}" class="slider-video" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;display:block"></video>
        <div class="slider-video-overlay" onclick="openMediaViewer('${mUrl}','video')">
          <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="29" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
            <polygon points="24,18 46,30 24,42" fill="white"/>
          </svg>
        </div>
      </div>`;
    }
    return `<div class="slider-slide" data-idx="${i}" data-type="photo" data-url="${mUrl}" onclick="openMediaViewer('${mUrl}','photo')">
      <img src="${mUrl}" alt="" draggable="false">
    </div>`;
  }).join('');

  const dots = items.map((_, i) => `<span class="slider-dot${i===0?' active':''}" onclick="sliderGoTo(${i})"></span>`).join('');

  container.innerHTML = `
    <div class="slider-track" id="sliderTrack">${slides}</div>
    <div class="slider-dots">${dots}</div>
    <div class="slider-count"><span id="sliderCur">1</span> / ${items.length}</div>
  `;

  _sliderState = { cur: 0, total: items.length, timer: null };
  _sliderState.timer = setInterval(() => sliderGoTo((_sliderState.cur + 1) % _sliderState.total), 3000);

  // touch/swipe
  let startX = 0, dragging = false;
  const track = container.querySelector('.slider-track');
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dragging = true; }, {passive:true});
  track.addEventListener('touchend', e => {
    if (!dragging) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) sliderGoTo(dx < 0 ? (_sliderState.cur+1) % _sliderState.total : (_sliderState.cur-1+_sliderState.total) % _sliderState.total);
    dragging = false;
  }, {passive:true});
}

function sliderGoTo(idx) {
  if (!_sliderState) return;
  _sliderState.cur = idx;
  const track = document.getElementById('sliderTrack');
  if (track) track.style.transform = `translateX(-${idx * 100}%)`;
  document.querySelectorAll('.slider-dot').forEach((d,i) => d.classList.toggle('active', i===idx));
  const cur = document.getElementById('sliderCur');
  if (cur) cur.textContent = idx + 1;
  if (_sliderState.timer) { clearInterval(_sliderState.timer); _sliderState.timer = setInterval(() => sliderGoTo((_sliderState.cur+1) % _sliderState.total), 3000); }
}

function openMediaViewer(url, type) {
  const overlay = document.createElement('div');
  overlay.className = 'media-viewer-overlay';
  const closeBtn = `<div class="media-viewer-close" onclick="this.closest('.media-viewer-overlay').remove()">✕</div>`;
  if (type === 'video') {
    overlay.innerHTML = closeBtn + `<video src="${url}" controls autoplay playsinline style="max-width:100%;max-height:85vh;border-radius:10px;background:#000;outline:none"></video>`;
  } else {
    overlay.innerHTML = closeBtn + `<img src="${url}" style="max-width:100%;max-height:85vh;border-radius:10px;object-fit:contain">`;
  }
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

function renderSalonInfo(data) {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const closedDays = (data.hours || []).filter(h => h.is_closed).map(h => days[h.day_of_week]);
  const offDaysHtml = closedDays.length
    ? closedDays.map(d => `<span class="off-day-chip">${d}</span>`).join('')
    : '<span style="color:#888">لا يوجد أيام إجازة</span>';

  document.getElementById('salon-info-content').innerHTML = `
    <div class="info-row"><span class="info-icon">📍</span><div><div class="info-label">العنوان</div><div class="info-value">${data.address || ''}, ${data.city}</div></div></div>
    <div class="info-row"><span class="info-icon">📞</span><div><div class="info-label">هاتف</div><div class="info-value">${data.phone || ''}</div></div></div>
    <div class="info-row"><span class="info-icon">🗓️</span><div><div class="info-label">أيام الإجازة</div><div class="off-days-wrap">${offDaysHtml}</div></div></div>
    <div class="info-row"><span class="info-icon">ℹ️</span><div><div class="info-label">عن الصالون</div><div class="info-value">${data.description || ''}</div></div></div>
  `;
}

function filterSalonServices(el, cat) {
  document.querySelectorAll('.svc-filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  if (!currentSalonData) return;
  const filtered = cat ? currentSalonData.services.filter(s => s.category === cat) : currentSalonData.services;
  renderSalonServices(filtered);
}

function switchSalonTab(name, btn) {
  document.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.salon-tab-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('salon-tab-' + name)?.classList.add('active');
}

// ===== BOOKING WIZARD =====
function quickBook(serviceId, salonId) {
  wizardState = { step: 1, services: [], stylist: null, date: null, time: null, salonId: salonId || null };
  showScreen('booking-wizard');
  loadWizardStep1(salonId);

  if (serviceId && currentSalonData) {
    const svc = currentSalonData.services.find(s => s.id === serviceId);
    if (svc) { selectWizardService(svc); }
  }
}

function openStylistBooking(stylistId) {
  wizardState = { step: 1, services: [], stylist: null, date: null, time: null, salonId: null, preStylest: stylistId };
  showScreen('booking-wizard');
  loadWizardStep1(null);
}

async function loadWizardStep1(salonId) {
  document.getElementById('wizard-cats').innerHTML = '';
  document.getElementById('wizard-services-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    let services = [];
    if (salonId) {
      services = await Api.salons.services(salonId);
    } else if (currentSalonData) {
      services = currentSalonData.services;
    } else {
      const salons = await Api.salons.list();
      salons.forEach(s => { if (s.services) services.push(...s.services); });
    }

    const cats = [...new Set(services.map(s => s.category))];
    document.getElementById('wizard-cats').innerHTML =
      `<div class="svc-filter-chip active" onclick="filterWizardServices(this, '', ${JSON.stringify(services).replace(/"/g,'&quot;')})">الكل</div>` +
      cats.map(c => `<div class="svc-filter-chip" onclick="filterWizardServices(this,'${c}',null)">${categoryIcon(c)} ${c}</div>`).join('');

    window._wizardServices = services;
    renderWizardServices(services);
  } catch (e) { console.error(e); }
}

function renderWizardServices(services) {
  const selectedIds = new Set((wizardState.services || []).map(s => s.id));
  document.getElementById('wizard-services-list').innerHTML = services.map(s => `
    <div class="wizard-service-item ${selectedIds.has(s.id) ? 'selected' : ''}" onclick="selectWizardService(${JSON.stringify(s).replace(/"/g,"'")})">
      <div class="service-icon">${categoryIcon(s.category)}</div>
      <div class="service-info">
        <h4>${s.name_ar || s.name}</h4>
        <div class="duration">⏱ ${s.duration_minutes} دقيقة</div>
      </div>
      <div class="service-price">₪${s.price}</div>
      <div class="service-check ${selectedIds.has(s.id) ? 'checked' : ''}">✓</div>
    </div>
  `).join('') + `<div id="wizard-services-footer" class="${(wizardState.services||[]).length ? '' : 'hidden'}">
    <div class="selected-services-bar">
      <span id="selected-svcs-count">${(wizardState.services||[]).length} خدمة</span>
      <span id="selected-svcs-total">⏱ ${(wizardState.services||[]).reduce((s,x)=>s+x.duration_minutes,0)} د · ₪${(wizardState.services||[]).reduce((s,x)=>s+parseFloat(x.price||0),0)}</span>
    </div>
  </div>`;
}

function filterWizardServices(el, cat, services) {
  document.querySelectorAll('#wizard-cats .svc-filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const src = services || window._wizardServices || [];
  const filtered = cat ? src.filter(s => s.category === cat) : src;
  renderWizardServices(filtered);
}

function selectWizardService(svc) {
  if (typeof svc === 'string') { try { svc = JSON.parse(svc.replace(/'/g,'"')); } catch {} }
  if (!wizardState.services) wizardState.services = [];
  const idx = wizardState.services.findIndex(s => s.id === svc.id);
  if (idx >= 0) {
    wizardState.services.splice(idx, 1);
  } else {
    wizardState.services.push(svc);
  }
  // Re-render to reflect new selection
  const src = window._wizardServices || [];
  const activeChip = document.querySelector('#wizard-cats .svc-filter-chip.active');
  const cat = activeChip?.textContent?.trim();
  const filtered = (cat && cat !== 'الكل') ? src.filter(s => categoryIcon(s.category) + ' ' + s.category === cat || s.category === cat) : src;
  renderWizardServices(filtered.length ? filtered : src);
  updateWizardSummary();
}

async function loadWizardStep2() {
  const list = document.getElementById('wizard-stylists-list');
  list.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    let stylists = [];
    if (currentSalonData) {
      stylists = currentSalonData.stylists || [];
    } else if (wizardState.salonId) {
      const data = await Api.salons.get(wizardState.salonId);
      stylists = data.stylists || [];
    } else {
      const salons = await Api.salons.list();
      salons.forEach(s => { if (s.stylists) s.stylists.forEach(st => stylists.push(st)); });
    }

    list.innerHTML = stylists.map(st => {
      let specs = [];
      try { specs = JSON.parse(st.specialties || '[]'); } catch {}
      return `
        <div class="wizard-stylist-item ${wizardState.stylist?.id === st.id ? 'selected' : ''}" onclick="selectWizardStylist(${st.id}, '${st.name}', '${st.rating}', ${st.salon_id || currentSalonData?.id || 1})">
          <div class="wst-avatar">${st.avatar ? `<img class="avatar-img" src="${st.avatar}" alt="${st.name}">` : (st.name || '؟')[0]}</div>
          <div class="service-info">
            <h4>${st.name}</h4>
            <div class="duration">⭐ ${st.rating} · ${specs.slice(0,2).join(' · ')}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) { list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--gray)">لا توجد كوفيرات متاحة</p>'; }
}

function selectWizardStylist(id, name, rating, salonId) {
  wizardState.stylist = { id, name, rating };
  wizardState.salonId = salonId;
  document.querySelectorAll('.wizard-stylist-item').forEach(el => el.classList.remove('selected'));
  event?.currentTarget?.classList.add('selected');
  updateWizardSummary();
}

function loadWizardStep3() {
  renderCalendar(calendarDate);
  document.getElementById('time-slots-grid').innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px">اختاري يوماً أولاً</p>';
}

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const dayNames = ['أح','اث','ث','أر','خ','ج','س'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let html = `
    <div class="cal-header">
      <button class="cal-nav-btn" onclick="changeMonth(-1)">›</button>
      <h4>${monthNames[month]} ${year}</h4>
      <button class="cal-nav-btn" onclick="changeMonth(1)">‹</button>
    </div>
    <div class="cal-grid">
      ${dayNames.map(d => `<div class="cal-day-name">${d}</div>`).join('')}
      ${Array(firstDay).fill('<div></div>').join('')}
  `;

  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(year, month, d);
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isPast = thisDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    const isSelected = wizardState.date === dateStr;

    html += `<div class="cal-day ${isPast?'past':''} ${isToday?'today':''} ${isSelected?'selected':''}"
      onclick="${isPast?'':'selectCalDay(this, \''+dateStr+'\')'}">${d}</div>`;
  }

  html += '</div>';
  document.getElementById('mini-calendar').innerHTML = html;
}

function changeMonth(dir) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + dir, 1);
  renderCalendar(calendarDate);
}

async function selectCalDay(el, dateStr) {
  wizardState.date = dateStr;
  wizardState.time = null;
  renderCalendar(calendarDate);

  const slotsEl = document.getElementById('time-slots-grid');
  slotsEl.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  try {
    const totalDuration = (wizardState.services || []).reduce((s, x) => s + (x.duration_minutes || 60), 0) || 60;
    const { slots } = await Api.bookings.slots(wizardState.stylist.id, dateStr, null, totalDuration);
    if (!slots?.length) { slotsEl.innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px">لا توجد مواعيد متاحة في هذا اليوم</p>'; return; }
    slotsEl.innerHTML = slots.map(s => `
      <button class="slot-btn ${s.available ? 'available' : 'unavailable'}"
        onclick="${s.available ? `selectSlot(this, '${s.time}')` : ''}">${s.time}</button>
    `).join('');
  } catch (e) {
    slotsEl.innerHTML = '<p style="text-align:center;color:var(--gray);padding:20px">تعذر تحميل المواعيد</p>';
  }
}

function selectSlot(el, time) {
  wizardState.time = time;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  updateWizardSummary();
}

function renderBookingSummary() {
  const s = wizardState;
  document.getElementById('booking-summary').innerHTML = `
    <div class="summary-row">
      <span class="summary-label">الخدمات</span>
      <span class="summary-value">${(s.services||[]).map(x => x.name_ar || x.name).join(' + ') || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">الكوفيرة</span>
      <span class="summary-value">${s.stylist?.name || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">التاريخ</span>
      <span class="summary-value">${s.date ? formatDateAr(s.date) : '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">الوقت</span>
      <span class="summary-value">${s.time || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">المدة الإجمالية</span>
      <span class="summary-value">${(s.services||[]).reduce((t,x)=>t+(x.duration_minutes||0),0) || '-'} دقيقة</span>
    </div>
    <div class="summary-row summary-price">
      <span class="summary-label">السعر الإجمالي</span>
      <span class="summary-value">₪${(s.services||[]).reduce((t,x)=>t+parseFloat(x.price||0),0) || '0'}</span>
    </div>
  `;
}

function updateWizardSummary() {
  const s = wizardState;
  const el = document.getElementById('wizard-selected-summary');
  const parts = [];
  if (s.service) parts.push(s.service.name_ar || s.service.name);
  if (s.stylist) parts.push(s.stylist.name);
  if (s.date) parts.push(s.date);
  if (s.time) parts.push(s.time);
  if (s.services?.length) parts.unshift(s.services.map(x => x.name_ar || x.name).join(' + '));
  if (parts.length) { el.textContent = parts.join(' · '); el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

function wizardNext() {
  const s = wizardState;
  if (s.step === 1 && !(s.services?.length)) { showToast('⚠️ اختاري خدمة واحدة على الأقل'); return; }
  if (s.step === 2 && !s.stylist) { showToast('⚠️ اختاري الكوفيرة'); return; }
  if (s.step === 3 && (!s.date || !s.time)) { showToast('⚠️ اختاري التاريخ والوقت'); return; }

  if (s.step < 4) {
    document.getElementById('wstep-' + s.step).classList.remove('active');
    document.getElementById('ws' + s.step).classList.remove('active');
    document.getElementById('ws' + s.step).classList.add('done');
    s.step++;
    document.getElementById('wstep-' + s.step).classList.add('active');
    document.getElementById('ws' + s.step).classList.add('active');
    document.getElementById('wizard-prev').style.display = 'block';
    if (s.step === 4) { document.getElementById('wizard-next').style.display = 'none'; renderBookingSummary(); }
    if (s.step === 2) loadWizardStep2();
    if (s.step === 3) loadWizardStep3();
  }
}

function wizardPrev() {
  const s = wizardState;
  if (s.step > 1) {
    document.getElementById('wstep-' + s.step).classList.remove('active');
    document.getElementById('ws' + s.step).classList.remove('active');
    s.step--;
    document.getElementById('wstep-' + s.step).classList.add('active');
    document.getElementById('ws' + s.step).classList.remove('done');
    document.getElementById('ws' + s.step).classList.add('active');
    document.getElementById('wizard-next').style.display = 'block';
    if (s.step === 1) document.getElementById('wizard-prev').style.display = 'none';
  }
}

async function confirmBooking() {
  const s = wizardState;
  if (!s.services?.length || !s.stylist || !s.date || !s.time || !s.salonId) {
    showToast('⚠️ بيانات الحجز غير مكتملة'); return;
  }

  const btn = event.currentTarget;
  btn.textContent = '⏳ جاري الحجز...';
  btn.disabled = true;

  try {
    const notes = document.getElementById('booking-notes').value;
    const { booking, points_earned } = await Api.bookings.create({
      stylist_id: s.stylist.id,
      service_id: s.services[0].id,
      service_ids: s.services.map(x => x.id),
      salon_id: s.salonId,
      booking_date: s.date,
      booking_time: s.time,
      notes
    });

    const svcsLabel = s.services.map(x => x.name_ar || x.name).join(' + ');
    document.getElementById('success-msg').textContent = `${svcsLabel} · ${formatDateAr(s.date)} · ${s.time}`;
    document.getElementById('success-points').textContent = `بانتظار موافقة الكوفيرة - ستصلك إشعار عند التأكيد`;
    document.getElementById('modal-success').classList.remove('hidden');

    wizardState = { step: 1, services: [], stylist: null, date: null, time: null, salonId: null };
  } catch (e) {
    showToast('⚠️ ' + e.message);
  } finally {
    btn.textContent = 'تأكيد الحجز';
    btn.disabled = false;
  }
}

// ===== BOOKINGS =====
let allBookings = [];
async function loadMyBookings() {
  document.getElementById('bookings-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    allBookings = await Api.bookings.my();
    filterBookings('upcoming');
  } catch (e) {
    document.getElementById('bookings-list').innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><h3>تعذر تحميل الحجوزات</h3></div>';
  }
}

function filterBookings(type, btn) {
  if (btn) { document.querySelectorAll('.btab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  const today = new Date().toISOString().split('T')[0];
  const filtered = type === 'upcoming'
    ? allBookings.filter(b => (b.booking_date >= today && b.status !== 'cancelled' && b.status !== 'rejected') || b.status === 'pending')
    : allBookings.filter(b => (b.booking_date < today && b.status !== 'pending') || b.status === 'cancelled' || b.status === 'rejected');

  if (!filtered.length) {
    document.getElementById('bookings-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>${type === 'upcoming' ? 'لا توجد حجوزات قادمة' : 'لا توجد حجوزات سابقة'}</h3><p>احجزي موعدك الأول الآن!</p></div>`;
    return;
  }

  document.getElementById('bookings-list').innerHTML = filtered.map(b => `
    <div class="booking-item ${b.status === 'pending' ? 'pending-card' : ''} ${b.status === 'cancelled' || b.status === 'rejected' ? 'cancelled' : ''}" data-booking-id="${b.id}">
      <div class="booking-top">
        <div class="booking-service-name">${b.name_ar || b.service_name}</div>
        <div class="status-${b.status}">${statusLabel(b.status)}</div>
      </div>
      <div class="booking-detail">
        <span>👩 ${b.stylist_name || '-'}</span>
        <span>🏠 ${b.salon_name || '-'}</span>
        <span>📅 ${formatDateAr(b.booking_date)}</span>
        <span>🕐 ${b.booking_time}</span>
        <span>💰 ₪${b.total_price}</span>
      </div>
      ${b.status === 'pending' ? `<div style="font-size:12px;color:#856404;background:#FFF3CD;border-radius:8px;padding:8px 10px;margin-top:8px">⏳ بانتظار موافقة الكوفيرة - ستصلك إشعار فور التأكيد</div>` : ''}
      ${b.status === 'rejected' ? `<div style="font-size:12px;color:#721c24;background:#F8D7DA;border-radius:8px;padding:8px 10px;margin-top:8px">❌ تم رفض الحجز - يمكنك اختيار وقت آخر</div>` : ''}
      ${(b.status === 'pending' || b.status === 'confirmed') && b.booking_date >= today ? `
        <div class="booking-actions">
          ${b.status === 'confirmed' && b.stylist_user_id ? `<button class="btn-sm btn-sm-primary" onclick="openChatWith(${b.stylist_user_id}, '${(b.salon_name || b.stylist_name || '').replace(/'/g, '')}')">💬 تواصل مع الصالون</button>` : ''}
          <button class="btn-sm btn-sm-danger" onclick="cancelBooking(${b.id})">إلغاء</button>
        </div>` : ''}
      ${b.booking_date < today && b.status === 'confirmed' ? `
        <div class="booking-actions">
          <button class="btn-sm btn-sm-primary" onclick="writeReview(${b.id})">⭐ تقييم</button>
        </div>` : ''}
    </div>
  `).join('');
}

async function cancelBooking(id) {
  if (!confirm('هل أنت متأكدة من إلغاء الحجز؟')) return;
  try {
    await Api.bookings.updateStatus(id, 'cancelled');
    showToast('تم إلغاء الحجز');
    loadMyBookings();
  } catch (e) { showToast('⚠️ ' + e.message); }
}

function writeReview(id) {
  const rating = prompt('أعطي تقييماً من 1-5 نجوم:');
  const comment = prompt('اكتبي تعليقك (اختياري):');
  if (rating) {
    Api.bookings.review(id, parseInt(rating), comment).then(() => {
      showToast('شكراً على تقييمك!');
      loadMyBookings();
    }).catch(e => showToast('⚠️ ' + e.message));
  }
}

// ===== CHAT =====
let voiceRecorder = null;
let voiceChunks = [];
let voiceRecording = false;

async function loadConversations() {
  document.getElementById('conversations-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    const convs = await Api.messages.conversations();
    if (!convs.length) {
      document.getElementById('conversations-list').innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><h3>لا توجد محادثات بعد</h3><p>تواصلي مع كوفيرتك من صفحة الحجوزات</p></div>';
      return;
    }
    document.getElementById('conversations-list').innerHTML = convs.map(c => `
      <div class="conv-item" onclick="openChatWith(${c.other_id}, '${c.other_name}')">
        <div class="conv-avatar">${(c.other_name || '?')[0]}</div>
        <div class="conv-info">
          <div class="conv-name">${c.other_name}</div>
          <div class="conv-last">${c.last_message || ''}</div>
        </div>
        <div class="conv-meta">
          <div class="conv-time">${formatTime(c.last_time)}</div>
          ${c.unread_count > 0 ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function openChatWith(userId, userName) {
  currentChatUserId = userId;
  document.getElementById('chat-other-name').textContent = userName;
  document.getElementById('chat-other-avatar').textContent = (userName || '?')[0];
  showScreen('chat-conv');

  const msgs = await Api.messages.get(userId);
  renderedMsgIds.clear();
  msgs.forEach(m => { if (m.id) renderedMsgIds.add(m.id); });
  const container = document.getElementById('chat-messages');
  container.innerHTML = msgs.map(m => buildMsgHtml(m)).join('');
  setTimeout(() => {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  }, 100);
  // Mark incoming messages as seen
  Api.messages.markSeen(userId).catch(() => {});
}

function buildMsgHtml(msg) {
  const isMe = msg.sender_id === currentUser?.id;
  const type = msg.msg_type || 'text';
  let bubble = '';
  if (type === 'image') {
    bubble = `<img class="chat-img" src="${msg.media_url}" onclick="viewChatImage('${msg.media_url}')" loading="lazy">`;
  } else if (type === 'voice') {
    bubble = `<audio class="chat-audio" controls src="${msg.media_url}" preload="metadata"></audio>`;
  } else {
    bubble = escapeHtml(msg.content);
  }
  const seenTick = isMe ? `<span class="msg-seen" id="seen_${msg.id}">${msg.seen_at ? '✓✓' : '✓'}</span>` : '';
  return `
    <div class="msg-wrap ${isMe ? 'me' : 'them'}" data-id="${msg.id || ''}">
      <div class="msg-bubble ${type !== 'text' ? 'msg-bubble-media' : ''}">${bubble}</div>
      <div class="msg-time">${formatTime(msg.created_at)}${seenTick}</div>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function viewChatImage(url) {
  const ov = document.createElement('div');
  ov.className = 'media-viewer-overlay';
  ov.innerHTML = `<button class="media-viewer-close" onclick="this.closest('.media-viewer-overlay').remove()">✕</button><img src="${url}" style="max-width:95vw;max-height:90vh;border-radius:12px;">`;
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov);
}

function appendChatMessage(msg, isMe) {
  const container = document.getElementById('chat-messages');
  container.insertAdjacentHTML('beforeend', buildMsgHtml({ ...msg, sender_id: isMe ? currentUser?.id : msg.sender_id }));
  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentChatUserId) return;

  input.value = '';
  input.focus();
  const fakeMsg = { content, sender_id: currentUser?.id, created_at: new Date().toISOString(), msg_type: 'text' };
  appendChatMessage(fakeMsg, true);

  if (socket?.connected) {
    socket.emit('send_message', { receiver_id: currentChatUserId, content });
  } else {
    Api.messages.send(currentChatUserId, content)
      .then(msg => { if (msg?.id) renderedMsgIds.add(msg.id); })
      .catch(e => showToast('⚠️ ' + e.message));
  }
}

async function sendChatImage() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    showToast('📤 جاري رفع الصورة...');
    try {
      const res = await Api.messages.uploadChatFile(file);
      if (res.url) {
        const fakeMsg = { media_url: res.url, sender_id: currentUser?.id, created_at: new Date().toISOString(), msg_type: 'image', content: '' };
        appendChatMessage(fakeMsg, true);
        Api.messages.send(currentChatUserId, '', null, 'image', res.url).catch(e => showToast('⚠️ ' + e.message));
      }
    } catch (e) { showToast('⚠️ فشل رفع الصورة'); }
  };
  input.click();
}

async function startVoiceRecord() {
  if (voiceRecording) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceChunks = [];
    voiceRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    voiceRecorder.ondataavailable = e => { if (e.data.size > 0) voiceChunks.push(e.data); };
    voiceRecorder.start();
    voiceRecording = true;
    document.getElementById('chat-voice-btn')?.classList.add('recording');
    showToast('🎤 جاري التسجيل...');
  } catch (e) {
    showToast('⚠️ لا يمكن الوصول للميكروفون');
  }
}

async function stopVoiceRecord() {
  if (!voiceRecording || !voiceRecorder) return;
  voiceRecording = false;
  document.getElementById('chat-voice-btn')?.classList.remove('recording');
  voiceRecorder.stream?.getTracks().forEach(t => t.stop());
  voiceRecorder.onstop = async () => {
    const blob = new Blob(voiceChunks, { type: 'audio/webm' });
    if (blob.size < 1000) { showToast('التسجيل قصير جداً'); return; }
    showToast('📤 جاري إرسال الرسالة الصوتية...');
    try {
      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
      const res = await Api.messages.uploadChatFile(file);
      if (res.url) {
        const fakeMsg = { media_url: res.url, sender_id: currentUser?.id, created_at: new Date().toISOString(), msg_type: 'voice', content: '' };
        appendChatMessage(fakeMsg, true);
        Api.messages.send(currentChatUserId, '', null, 'voice', res.url).catch(e => showToast('⚠️ ' + e.message));
      }
    } catch (e) { showToast('⚠️ فشل إرسال الرسالة الصوتية'); }
  };
  voiceRecorder.stop();
}

function useQuickReply(text) {
  document.getElementById('chat-input').value = text;
  document.getElementById('chat-input').focus();
  document.getElementById('quick-replies-row')?.classList.add('hidden');
}

async function doLogout() {
  try {
    const base = (typeof BASE !== 'undefined') ? BASE : `http://${window.location.hostname}:3000`;
    const token = localStorage.getItem('glamora_token');
    if (token) {
      await fetch(base + '/api/users/fcm-token', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
    }
  } catch (e) {}
  clearAuth();
  location.reload();
}

// ===== PROFILE =====
async function loadProfile() {
  if (!currentUser) return;
  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-phone-display').textContent = currentUser.phone;
  document.getElementById('profile-avatar-text').textContent = currentUser.name[0];

  try {
    const { points, tier, transactions } = await Api.users.loyalty();
    document.getElementById('loyalty-points').textContent = points;
    document.getElementById('profile-tier-badge').textContent = tier.name;
    document.getElementById('loyalty-tier-icon').textContent = tierIcon(tier.name);

    if (tier.next) {
      const progress = ((points - tier.min) / (tier.next - tier.min)) * 100;
      document.getElementById('loyalty-bar').style.width = Math.min(100, progress) + '%';
      document.getElementById('loyalty-next-info').textContent = `${tier.next - points} نقطة للـ${nextTierName(tier.name)}`;
      document.getElementById('loyalty-current-tier').textContent = tier.name;
    } else {
      document.getElementById('loyalty-bar').style.width = '100%';
      document.getElementById('loyalty-next-info').textContent = 'أعلى مستوى ✦';
    }
  } catch (e) {}
}

async function showColorHistory() {
  showScreen('color-history');
  document.getElementById('color-history-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    const formulas = await Api.users.colorHistory();
    if (!formulas.length) {
      document.getElementById('color-history-list').innerHTML = '<div class="empty-state"><div class="empty-icon">🎨</div><h3>لا يوجد سجل ألوان بعد</h3><p>بعد أول زيارة صبغ، ستجدين الفورمولا هنا</p></div>';
      return;
    }
    document.getElementById('color-history-list').innerHTML = formulas.map(f => `
      <div class="color-card">
        <div class="color-card-header">
          <div class="color-swatch" style="background:${formulaToColor(f.formula)}"></div>
          <div>
            <h4>${f.color_name || 'صبغة'}</h4>
            <p>${f.stylist_name} · ${formatDateAr(f.visit_date)}</p>
          </div>
        </div>
        <div class="color-card-body">
          <div class="formula-code">${f.formula}</div>
          ${f.notes ? `<div class="color-notes">📝 ${f.notes}</div>` : ''}
          <div class="color-meta">
            <span>📅 ${formatDateAr(f.visit_date)}</span>
            <span>${f.stylist_name}</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function showLoyaltyHistory() {
  try {
    const { transactions } = await Api.users.loyalty();
    const html = transactions.map(t => `
      <div class="notif-item">
        <div class="notif-icon">${t.points > 0 ? '▴' : '▾'}</div>
        <div>
          <div class="notif-title" style="color:${t.points > 0 ? 'var(--success)' : 'var(--rose)'}">${t.points > 0 ? '+' : ''}${t.points} نقطة</div>
          <div class="notif-body">${t.description}</div>
          <div class="notif-time">${formatTime(t.created_at)}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('notifs-list').innerHTML = html;
    showScreen('notifications');
    document.querySelector('#screen-notifications h2').textContent = 'سجل النقاط';
  } catch (e) {}
}

async function showNotifications() {
  showScreen('notifications');
  document.querySelector('#screen-notifications h2').textContent = 'الإشعارات';
  // Hide both badges
  document.getElementById('notif-badge')?.classList.add('hidden');
  document.getElementById('st-notif-badge')?.classList.add('hidden');
  try {
    const notifs = await Api.users.notifications();
    await Api.users.markNotifsRead();
    if (!notifs.length) {
      document.getElementById('notifs-list').innerHTML = '<div class="empty-state"><div class="empty-icon">🔔</div><h3>لا توجد إشعارات</h3></div>';
      return;
    }
    document.getElementById('notifs-list').innerHTML = notifs.map(n => {
      const isUnread = !n.is_read;
      const clickable = n.type === 'booking' && n.booking_id;
      const onclick = clickable ? `navigateToBooking(${n.booking_id})` : (n.type === 'message' ? `switchTab('chat', document.querySelector('.nav-btn:nth-child(4)')); goBack();` : '');
      return `
        <div class="notif-item ${isUnread ? 'notif-unread' : ''}" ${onclick ? `onclick="${onclick}" style="cursor:pointer"` : ''}>
          <div class="notif-icon">${notifIcon(n.type)}</div>
          <div style="flex:1">
            <div class="notif-title">${n.title}</div>
            <div class="notif-body">${n.body}</div>
            <div class="notif-time">${formatTime(n.created_at)}</div>
          </div>
          ${clickable ? '<div style="color:var(--rose);font-size:18px">›</div>' : ''}
        </div>
      `;
    }).join('');
  } catch (e) {}
}

function navigateToBooking(bookingId) {
  goBack();
  const role = currentUser?.role;
  if (role === 'stylist' || role === 'salon_owner') {
    stSwitchTab('bookings', document.querySelector('#screen-stylist .nav-btn:nth-child(3)'));
    setTimeout(() => {
      const card = document.querySelector(`[data-booking-id="${bookingId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('highlight-pulse');
      setTimeout(() => card?.classList.remove('highlight-pulse'), 2000);
    }, 300);
  } else {
    switchTab('bookings', document.querySelector('.nav-btn:nth-child(2)'));
    setTimeout(() => {
      const card = document.querySelector(`[data-booking-id="${bookingId}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('highlight-pulse');
      setTimeout(() => card?.classList.remove('highlight-pulse'), 2000);
    }, 300);
  }
}

async function loadNotifBadge() {
  try {
    const notifs = await Api.users.notifications();
    const unread = notifs.filter(n => !n.is_read).length;
    // Update both client and stylist bell badges
    ['notif-badge', 'st-notif-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    });
  } catch (e) {}
}

async function loadChatBadge() {
  try {
    const convs = await Api.messages.conversations();
    const unread = convs.reduce((s, c) => s + (c.unread_count || 0), 0);
    ['chat-badge', 'st-chat-badge'].forEach(id => {
      const badge = document.getElementById(id);
      if (!badge) return;
      if (unread > 0) { badge.textContent = unread; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    });
  } catch (e) {}
}

// ===== ONBOARDING =====
let currentSlide = 0;
function goToSlide(n) {
  document.querySelectorAll('.onboard-slide').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.dot').forEach(d => d.classList.remove('active'));
  document.querySelectorAll('.onboard-slide')[n]?.classList.add('active');
  document.querySelectorAll('.dot')[n]?.classList.add('active');
  currentSlide = n;
}

function focusSearch() { document.getElementById('search-input')?.focus(); }

// ===== HELPERS =====
function categoryIcon(cat) {
  const map = { 'صبغ الشعر': '🎨', 'قص': '✂️', 'علاجات': '💆', 'مكياج': '💄', 'أظافر': '💅', 'تصفيف': '👑' };
  return map[cat] || '✨';
}

function statusLabel(s) {
  const map = { confirmed: '✅ مؤكد', pending: '⏳ بانتظار', cancelled: '❌ ملغي', rejected: '❌ مرفوض', completed: '✔️ مكتمل' };
  return map[s] || s;
}

function tierIcon(tier) {
  const map = { 'بلاتيني': '🏆', 'ذهبي': '👑', 'فضي': '⭐', 'وردي': '🌸' };
  return map[tier] || '🌸';
}

function nextTierName(tier) {
  const map = { 'وردي': 'الفضي', 'فضي': 'الذهبي', 'ذهبي': 'البلاتيني' };
  return map[tier] || '';
}

function notifIcon(type) {
  const map = { booking: '📅', reminder: '⏰', loyalty: '⭐', message: '💬' };
  return map[type] || '🔔';
}

function formulaToColor(formula) {
  const colors = { '7': '#C4A97D', '8': '#D4B896', '9': '#E8D5BA', '10': '#F5EDD8', 'ash': '#9EA3A8', 'platinum': '#E8E8E8' };
  for (const [k, v] of Object.entries(colors)) if (formula.includes(k)) return v;
  return '#C9A96E';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('ar-PS', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateAr(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${parseInt(d)} ${months[parseInt(m)]} ${y}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'الآن';
  if (diff < 60) return `${diff} د`;
  if (diff < 1440) return `${Math.floor(diff/60)} س`;
  return d.toLocaleDateString('ar-PS', { month: 'short', day: 'numeric' });
}

// ===== BEAUTY PROFILE =====
let beautyProfileData = null;

async function showBeautyProfile() {
  showScreen('screen-beauty-profile');
  try {
    const data = await Api.beauty.getProfile();
    beautyProfileData = data;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('bp-hair-color', data.hair_color);
    set('bp-hair-texture', data.hair_texture);
    set('bp-skin-tone', data.skin_tone);
    set('bp-face-shape', data.face_shape);
    if (data.allergies) document.getElementById('bp-allergies').value = data.allergies;
    if (data.color_notes) document.getElementById('bp-color-notes').value = data.color_notes;

    // Reminder status
    const rEl = document.getElementById('bp-reminder-status');
    if (data.next_reminder_date) {
      const d = new Date(data.next_reminder_date);
      rEl.textContent = `التذكير القادم: ${d.toLocaleDateString('ar-PS', { day:'numeric', month:'long' })}`;
    } else {
      rEl.textContent = 'لا يوجد تذكير مضبوط حالياً';
    }

    // Color formulas
    const fl = document.getElementById('bp-formulas-list');
    if (!data.color_formulas?.length) {
      fl.innerHTML = '<div style="font-size:13px;color:var(--gray);text-align:center;padding:16px">لا توجد وصفات محفوظة بعد</div>';
    } else {
      fl.innerHTML = data.color_formulas.map(f => `
        <div class="formula-card">
          <div class="formula-card-name">🎨 ${f.color_name || 'وصفة لون'}</div>
          <div class="formula-card-detail">${f.formula || ''}</div>
          ${f.notes ? `<div class="formula-card-detail" style="color:var(--rose-dark)">${f.notes}</div>` : ''}
          <div class="formula-card-detail">${f.visit_date || ''}</div>
        </div>
      `).join('');
    }
  } catch (e) { showToast('تعذّر تحميل الملف الجمالي'); }
}

async function saveBeautyProfile() {
  try {
    const data = {
      hair_color: document.getElementById('bp-hair-color').value || null,
      hair_texture: document.getElementById('bp-hair-texture').value || null,
      skin_tone: document.getElementById('bp-skin-tone').value || null,
      face_shape: document.getElementById('bp-face-shape').value || null,
      allergies: document.getElementById('bp-allergies').value.trim() || null,
      color_notes: document.getElementById('bp-color-notes').value.trim() || null,
    };
    await Api.beauty.updateProfile(data);
    showToast('✅ تم حفظ ملفك الجمالي');
  } catch (e) { showToast('⚠️ فشل الحفظ'); }
}

async function setBeautyReminder(weeks) {
  try {
    const res = await Api.beauty.scheduleReminder(weeks);
    const d = new Date(res.reminder_date);
    document.getElementById('bp-reminder-status').textContent = `التذكير القادم: ${d.toLocaleDateString('ar-PS', { day:'numeric', month:'long' })}`;
    showToast(`✅ سنذكّرك بعد ${weeks} أسابيع 💆`);
  } catch (e) { showToast('⚠️ فشل ضبط التذكير'); }
}

async function checkBeautyReminder() {
  if (!authToken) return;
  try {
    const data = await Api.beauty.getProfile();
    if (!data.next_reminder_date) return;
    const today = new Date().toISOString().split('T')[0];
    if (data.next_reminder_date <= today) {
      const banner = document.getElementById('beauty-reminder-banner');
      const msg = document.getElementById('beauty-reminder-msg');
      if (banner && msg) {
        msg.textContent = `آخر صبغة: ${data.last_color_date || 'غير محددة'} — حان وقت التجديد!`;
        banner.classList.remove('hidden');
        // Show banner in beauty profile if open, else toast
        showToast('💆 تذكير: حان وقت صبغة شعرك!', 5000);
      }
    }
  } catch (e) {}
}

// ===== AI HAIRSTYLE =====
let aiFaceBase64 = null;
let aiSelectedShape = null;

function loadAiScreen() {
  aiFaceBase64 = null;
  aiSelectedShape = null;
  document.getElementById('ai-face-preview').classList.add('hidden');
  document.getElementById('ai-results').classList.add('hidden');
  document.querySelectorAll('.face-shape-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('ai-analyze-btn').disabled = false;
  // Pre-fill shape from beauty profile
  if (beautyProfileData?.face_shape) {
    const btn = document.querySelector(`.face-shape-btn[data-shape="${beautyProfileData.face_shape}"]`);
    if (btn) { btn.classList.add('selected'); aiSelectedShape = beautyProfileData.face_shape; }
  }
}

function previewAiFace(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    aiFaceBase64 = e.target.result;
    const img = document.getElementById('ai-face-preview');
    img.src = aiFaceBase64;
    img.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function selectFaceShape(el) {
  document.querySelectorAll('.face-shape-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  aiSelectedShape = el.dataset.shape;
}

async function runAiHairstyle() {
  const btn = document.getElementById('ai-analyze-btn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري التحليل...';
  try {
    const result = await Api.beauty.aiHairstyle(aiFaceBase64, aiSelectedShape);
    renderAiResults(result);
  } catch (e) {
    showToast('⚠️ فشل التحليل، جربي مرة أخرى');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ احصلي على توصياتك';
  }
}

function renderAiResults(data) {
  const results = document.getElementById('ai-results');
  results.classList.remove('hidden');

  const shapeNames = { oval:'بيضاوي', round:'مستدير', square:'مربع', heart:'قلب', rectangle:'مستطيل', diamond:'ماسي' };
  const shapeName = shapeNames[data.face_shape] || data.face_shape || '';

  document.getElementById('ai-hairstyles-list').innerHTML = (data.hairstyles || []).map(h => `
    <div class="hairstyle-result-item">
      <div class="hairstyle-result-name">💇 ${h.name}</div>
      <div class="hairstyle-result-why">${h.why || ''}</div>
      <div class="hairstyle-result-desc">${h.description || ''}</div>
    </div>
  `).join('') || '<div style="color:var(--gray);font-size:13px">لا توجد نتائج</div>';

  document.getElementById('ai-colors-list').innerHTML = (data.colors || []).map(c => `
    <span class="color-result-chip">🎨 ${c.arabic_name || c.name} <small style="font-weight:400;color:var(--gray)">${c.why || ''}</small></span>
  `).join('');

  if (shapeName) {
    const shapeEl = document.querySelector('.ai-intro-card h3');
    if (shapeEl) shapeEl.textContent = `شكل وجهك: ${shapeName}`;
  }
  results.scrollIntoView({ behavior: 'smooth' });
}

// ===== HAIR COLOR CALCULATOR =====
const calcAnswers = {};
let calcCurrentStep = 1;
const calcTotalSteps = 3;

function initColorCalc() {
  Object.keys(calcAnswers).forEach(k => delete calcAnswers[k]);
  calcCurrentStep = 1;
  document.querySelectorAll('.calc-step').forEach((s, i) => s.classList.toggle('active', i === 0));
  document.querySelectorAll('.calc-opt').forEach(o => o.classList.remove('selected'));
  document.getElementById('color-calc-quiz').classList.remove('hidden');
  document.getElementById('color-calc-result').classList.add('hidden');
  document.getElementById('calc-next-btn').disabled = true;
  document.getElementById('calc-prev-btn').style.visibility = 'hidden';
  document.getElementById('calc-progress-bar').style.width = '33%';
}

function calcPick(el) {
  const key = el.dataset.key;
  document.querySelectorAll(`.calc-opt[data-key="${key}"]`).forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  calcAnswers[key] = el.dataset.val;
  document.getElementById('calc-next-btn').disabled = false;
}

function calcStep(dir) {
  const nextStep = calcCurrentStep + dir;
  if (nextStep < 1 || nextStep > calcTotalSteps) {
    if (calcCurrentStep === calcTotalSteps) { showColorCalcResult(); return; }
    return;
  }
  document.querySelector(`.calc-step[data-step="${calcCurrentStep}"]`).classList.remove('active');
  calcCurrentStep = nextStep;
  document.querySelector(`.calc-step[data-step="${calcCurrentStep}"]`).classList.add('active');
  document.getElementById('calc-progress-bar').style.width = `${(calcCurrentStep / calcTotalSteps) * 100}%`;
  document.getElementById('calc-prev-btn').style.visibility = calcCurrentStep === 1 ? 'hidden' : 'visible';
  const isLastStep = calcCurrentStep === calcTotalSteps;
  const nextBtn = document.getElementById('calc-next-btn');
  nextBtn.textContent = isLastStep ? 'عرض النتيجة ✨' : 'التالي ›';
  const currentKey = document.querySelector(`.calc-step[data-step="${calcCurrentStep}"] .calc-opt`)?.dataset?.key;
  nextBtn.disabled = currentKey ? !calcAnswers[currentKey] : false;
}

function showColorCalcResult() {
  const { skin, eyes, style } = calcAnswers;
  const results = getColorRecommendations(skin, eyes, style);
  document.getElementById('color-calc-quiz').classList.add('hidden');
  document.getElementById('color-calc-result').classList.remove('hidden');
  document.getElementById('calc-result-title').textContent = results.headline;
  document.getElementById('calc-result-desc').textContent = results.desc;
  document.getElementById('calc-result-list').innerHTML = results.colors.map(c => `
    <div class="beauty-card" style="margin-bottom:10px;border-right:4px solid ${c.swatch}">
      <div style="font-size:15px;font-weight:800;margin-bottom:4px">${c.name}</div>
      <div style="font-size:13px;color:var(--gray)">${c.reason}</div>
      <div style="font-size:12px;color:var(--rose-dark);margin-top:4px">${c.tip}</div>
    </div>
  `).join('');
}

function resetColorCalc() { initColorCalc(); }

function getColorRecommendations(skin, eyes, style) {
  // Scoring matrix
  const allColors = [
    { name: 'بني شوكولاتة داكن', swatch: '#4a2c17', skins: ['olive','dark','medium'], eyes: ['brown','hazel','black'], styles: ['natural','professional'], reason: 'يناسب البشرة القمحية والداكنة ويعطي عمقاً طبيعياً', tip: 'أضيفي هايلايت كراميل لإضاءة الوجه' },
    { name: 'بني كراميل ذهبي', swatch: '#c68642', skins: ['fair','light','medium'], eyes: ['hazel','brown','green'], styles: ['warm','bold'], reason: 'يُضيء البشرة الفاتحة ويعطي دفئاً جميلاً', tip: 'رائع مع بالياج منتشر من المنتصف' },
    { name: 'أشقر رمادي بارد', swatch: '#b8b8b8', skins: ['fair','light'], eyes: ['blue','green','hazel'], styles: ['cool','bold'], reason: 'يُبرز العيون الزرقاء والخضراء بشكل مذهل', tip: 'يحتاج صيانة كل 4-5 أسابيع' },
    { name: 'بني رمادي أسود', swatch: '#2d2d2d', skins: ['olive','dark','medium'], eyes: ['black','brown'], styles: ['cool','professional'], reason: 'أنيق وعصري، يناسب جميع مناسبات العمل', tip: 'ألمع مع شامبو اللون الأسود' },
    { name: 'نحاسي دافئ', swatch: '#b87333', skins: ['medium','olive','light'], eyes: ['hazel','brown','green'], styles: ['warm','bold'], reason: 'لون جريء يُبرز تفاصيل الوجه ويعطي حيوية', tip: 'احمي لونك بواقي الألوان يومياً' },
    { name: 'بلاتيني فاتح', swatch: '#e8d5a3', skins: ['fair','light'], eyes: ['blue','green'], styles: ['bold','cool'], reason: 'تغيير جذري وجريء، مثالي للبشرة الفاتحة', tip: 'يحتاج فترات استراحة بين الجلسات' },
    { name: 'بني طبيعي دافئ', swatch: '#8b5a2b', skins: ['medium','olive','light'], eyes: ['brown','hazel','black'], styles: ['natural'], reason: 'الأقل ضرراً والأكثر طبيعية لأي بشرة', tip: 'خيار مثالي إذا كنتِ تفضلين الشعر الصحي' },
    { name: 'أحمر برغندي', swatch: '#800020', skins: ['fair','medium','olive'], eyes: ['hazel','green','brown'], styles: ['bold','warm'], reason: 'لون عاطفي وجريء يناسب الشخصيات القوية', tip: 'البرغندي الداكن يناسب الجميع' },
  ];

  const scored = allColors.map(c => ({
    ...c,
    score: (c.skins.includes(skin) ? 2 : 0) + (c.eyes.includes(eyes) ? 2 : 0) + (c.styles.includes(style) ? 1 : 0)
  })).sort((a, b) => b.score - a.score).slice(0, 3);

  const styleLabels = { natural:'الطبيعية', bold:'الجريئة', warm:'الدافئة', cool:'الأنيقة الباردة' };
  return {
    headline: `أنسب الألوان لشخصيتك ${styleLabels[style] || ''}`,
    desc: 'بناءً على لون بشرتك وعيونك وأسلوبك',
    colors: scored,
  };
}

// ===== RECOMMENDATIONS on home =====
async function loadRecommendations() {
  if (!authToken) return;
  try {
    const [recoRes, likeRes] = await Promise.all([Api.beauty.recommendations(), Api.beauty.youMightLike()]);

  } catch (e) {}
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  // Hide native splash immediately - HTML splash takes over
  if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    try { Capacitor.Plugins.SplashScreen?.hide(); } catch(e) {}
  }
  // Show HTML splash with logo + animation
  showScreen('splash');
  // After animation, navigate to real screen
  setTimeout(() => {
    try {
      if (authToken && currentUser) {
        enterApp(currentUser);
        setTimeout(() => { try { initSocket(); } catch(e) {} }, 500);
      } else {
        showScreen('onboard');
      }
    } catch(e) {
      showScreen('onboard');
    }
  }, 2500);
});
