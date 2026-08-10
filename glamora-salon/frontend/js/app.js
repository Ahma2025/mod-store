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
  const flexScreens = ['login', 'register'];
  target.style.display = flexScreens.includes(id) ? 'flex' : 'block';

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

  if (!phone || !pass) { showError(errEl, window.VELOUR_LANG === 'en' ? 'Enter phone number and password' : 'أدخلي رقم الهاتف وكلمة المرور'); return; }

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
  if (pass.length < 6) { showError(errEl, window.VELOUR_LANG === 'en' ? 'Password must be at least 6 characters' : 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }

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
      showToast(window.VELOUR_LANG === 'en' ? '✅ Salon location saved on map' : '✅ تم حفظ موقع الصالون على الخريطة');
      const locEl = document.getElementById('st-location-status');
      if (locEl) locEl.textContent = window.VELOUR_LANG === 'en' ? '✅ Location set on map' : '✅ الموقع محدد على الخريطة';
      pendingSalonLocation = null;
      return;
    } catch(e) { showToast(window.VELOUR_LANG === 'en' ? 'Error saving location' : 'خطأ في حفظ الموقع'); }
  }

  // من داخل فورم الصالون الجديد — نخزن مؤقتاً
  const status = document.getElementById('sf-location-status');
  if (status) status.textContent = window.VELOUR_LANG === 'en' ? '✅ Location set' : '✅ تم تحديد الموقع';
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

    if (!withDist.length) showToast(window.VELOUR_LANG === 'en' ? 'No salons with locations yet — add your salon location from the dashboard' : 'لا توجد صالونات بمواقع محددة بعد — أضيفي موقع صالونك من الداشبورد');
  } catch (e) { showToast('خطأ في تحميل الصالونات'); }
}

async function retryLocation() {
  document.getElementById('nearest-list').innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray)">${window.VELOUR_LANG === 'en' ? 'Detecting your location...' : 'جاري تحديد موقعك...'}</div>`;
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
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(leafletMap).bindPopup(`<b>${window.VELOUR_LANG === 'en' ? 'Your current location' : 'موقعك الحالي'}</b>`);
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
    if (!salons.length) showToast(window.VELOUR_LANG === 'en' ? 'No salons with locations yet' : 'لا توجد صالونات بمواقع محددة بعد');
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
let _homeRevealed = false;

function _getSalonsCache() { try { return JSON.parse(localStorage.getItem('velour_salons_cache') || 'null'); } catch { return null; } }
function _setSalonsCache(s) { try { localStorage.setItem('velour_salons_cache', JSON.stringify(s)); } catch {} }

function _revealHome() {
  const sc = document.getElementById('home-scroll');
  if (sc && !_homeRevealed) { _homeRevealed = true; sc.classList.add('vel-reveal'); }
}

function _paintHome(salons) {
  renderFeaturedSalons(salons);
  renderHomeTopRated(salons);
  renderSalonsList([...salons].sort((a, b) => b.id - a.id));
}

function _showHomeSkeletons() {
  const f = document.getElementById('featured-salons');
  if (f) f.innerHTML = Array.from({ length: 3 }).map(() => '<div class="skel skel-featured"></div>').join('');
  const t = document.getElementById('home-top-rated-list');
  if (t) t.innerHTML = Array.from({ length: 4 }).map(() => '<div class="skel skel-hcard"></div>').join('');
  const l = document.getElementById('salons-list');
  if (l) l.innerHTML = Array.from({ length: 4 }).map(() => '<div class="skel skel-row"></div>').join('');
  _revealHome();
}

function _renderNearYouFromCache() {
  let html = null;
  try { html = localStorage.getItem('velour_nearyou_cache'); } catch {}
  if (!html) return;
  const section = document.getElementById('section-near-you');
  const el = document.getElementById('home-near-list');
  if (section && el) { el.innerHTML = html; section.style.display = ''; }
}

async function loadHome() {
  _homeRevealed = false;
  // 1) instant paint from cache (zero wait) — or elegant skeletons on first-ever open
  const cached = _getSalonsCache();
  if (cached && cached.length) {
    allSalonsCache = cached;
    _paintHome(cached);
    _renderNearYouFromCache();
    _revealHome();
  } else {
    _showHomeSkeletons();
  }
  // 2) refresh silently in the background
  try {
    const salons = await Api.salons.list();
    allSalonsCache = salons;
    _setSalonsCache(salons);
    _paintHome(salons);
    _revealHome();
    loadNotifBadge();
    loadHomeNearYou(salons);
  } catch (e) {
    console.error(e);
    _revealHome();
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
    try { localStorage.setItem('velour_nearyou_cache', el.innerHTML); } catch {}
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
          ${s.is_verified ? `<span class="salon-badge badge-verified">✓ ${window.VELOUR_LANG === 'en' ? 'Verified' : 'موثّق'}</span>` : ''}
          ${s.is_new ? `<span class="salon-badge badge-new">✨ ${window.VELOUR_LANG === 'en' ? 'New' : 'جديد'}</span>` : ''}
          ${s.is_most_booked ? `<span class="salon-badge badge-hot">🔥 ${window.VELOUR_LANG === 'en' ? 'Most Booked' : 'الأكثر حجزاً'}</span>` : ''}
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
  // Reset first so the previously-viewed salon / placeholder never flashes.
  document.getElementById('salon-detail-name').textContent = '';
  const _salonMeta = document.querySelector('.salon-meta');
  if (_salonMeta) _salonMeta.style.visibility = 'hidden';
  const _oldBadges = document.getElementById('salon-detail-badges');
  if (_oldBadges) _oldBadges.innerHTML = '';

  const cached = _pageCacheGet('salon_' + id);
  if (cached && cached.services) {
    // Repeat visit — paint the whole page instantly from cache (same tick, no blank).
    _paintSalon(cached, id);
  } else {
    const _coverTrack = document.getElementById('cover-slider-track');
    if (_coverTrack) _coverTrack.innerHTML = '';
    const _coverDots = document.getElementById('cover-dots');
    if (_coverDots) _coverDots.innerHTML = '';
    document.getElementById('salon-services-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    // First visit — at least fill the header instantly from the salons-list data we already have.
    const fromList = (_getSalonsCache() || []).find(s => String(s.id) === String(id));
    if (fromList) {
      document.getElementById('salon-detail-name').textContent = fromList.name || '';
      document.getElementById('salon-detail-rating').textContent = fromList.rating || '0';
      document.getElementById('salon-detail-reviews').textContent = fromList.reviews_count || 0;
      document.getElementById('salon-detail-city').textContent = fromList.city || '';
      if (_salonMeta) _salonMeta.style.visibility = 'visible';
    }
  }

  try {
    const data = await Api.salons.get(id);
    _pageCacheSet('salon_' + id, data);
    _paintSalon(data, id);
  } catch (e) {
    if (!cached) showToast('خطأ في تحميل بيانات الصالون');
  }
}

function _paintSalon(data, id) {
  currentSalonData = data;
  document.getElementById('salon-detail-name').textContent = data.name;
  document.getElementById('salon-detail-rating').textContent = data.rating || '0';
  document.getElementById('salon-detail-reviews').textContent = data.reviews_count || 0;
  document.getElementById('salon-detail-city').textContent = data.city;
  const metaEl = document.querySelector('.salon-meta');
  if (metaEl) metaEl.style.visibility = 'visible';
  const badgesHtml = [
    data.is_verified ? `<span class="salon-badge badge-verified">✓ ${window.VELOUR_LANG === 'en' ? 'Verified' : 'موثّق'}</span>` : '',
    data.is_new ? `<span class="salon-badge badge-new">✨ ${window.VELOUR_LANG === 'en' ? 'New' : 'جديد'}</span>` : '',
  ].filter(Boolean).join('');
  if (metaEl) {
    let badgeRow = document.getElementById('salon-detail-badges');
    if (!badgeRow && badgesHtml) { badgeRow = document.createElement('div'); badgeRow.id = 'salon-detail-badges'; badgeRow.className = 'salon-badges-row'; metaEl.after(badgeRow); }
    if (badgeRow) badgeRow.innerHTML = badgesHtml;
  }
  renderSalonServices(data.services);
  renderSalonStylists(data.stylists);
  renderSalonRatings(data);
  renderSalonInfo(data);
  loadSalonGallery(id != null ? id : data.id);
  const cats = [...new Set((data.services || []).map(s => s.category))];
  document.getElementById('services-filter').innerHTML =
    `<div class="svc-filter-chip active" onclick="filterSalonServices(this, '')">الكل</div>` +
    cats.map(c => `<div class="svc-filter-chip" onclick="filterSalonServices(this, '${c}')">${categoryIcon(c)} ${c}</div>`).join('');
}

function renderSalonServices(services) {
  const _ssEN = window.VELOUR_LANG === 'en';
  if (!services?.length) { document.getElementById('salon-services-list').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>${_ssEN ? 'No services' : 'لا توجد خدمات'}</h3></div>`; return; }
  document.getElementById('salon-services-list').innerHTML = services.map(s => `
    <div class="service-card" onclick="quickBook(${s.id}, ${s.salon_id})">
      <div class="service-icon" style="background:${categoryColor(s.category)}1a;border:1.5px solid ${categoryColor(s.category)}33">
        <span style="font-size:22px">${categoryIcon(s.category)}</span>
      </div>
      <div class="service-info">
        <h4 translate="no">${s.name_ar || s.name}</h4>
        <p translate="no">${s.description ? s.description.substring(0,55) + '...' : ''}</p>
        <div class="duration">⏱ ${s.duration_minutes} ${_ssEN ? 'min' : 'دقيقة'}</div>
      </div>
      <div class="service-price">₪${s.price}</div>
    </div>
  `).join('');
}

function renderSalonStylists(stylists) {
  const _stEN = window.VELOUR_LANG === 'en';
  if (!stylists?.length) { document.getElementById('salon-stylists-list').innerHTML = `<div class="empty-state"><div class="empty-icon">👩</div><h3>${_stEN ? 'No stylists' : 'لا توجد كوفيرات'}</h3></div>`; return; }
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
  const _rwEN = window.VELOUR_LANG === 'en';
  document.getElementById('rw-count').textContent = count > 0 ? `${count} ${_rwEN ? 'review' : 'تقييم'}` : (_rwEN ? 'No reviews yet' : 'لا توجد تقييمات بعد');

  // Visitor count
  if (data.total_visitors > 0) {
    const countEl = document.getElementById('rw-count');
    countEl.textContent = _rwEN
      ? `${count} reviews · 👩 ${data.total_visitors} clients visited`
      : `${count} تقييم · 👩 ${data.total_visitors} زبونة زارت الصالون`;
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
    document.getElementById('salon-reviews-list').innerHTML = `<div class="empty-state" style="padding:20px 16px"><div class="empty-icon">⭐</div><h3>${_rwEN ? 'Be the first to review!' : 'كوني أول من يقيّم!'}</h3></div>`;
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
        ${r.before_photo ? `<div class="review-ba-img"><img src="${r.before_photo}" loading="lazy"><div class="review-ba-label">${window.VELOUR_LANG === 'en' ? 'Before' : 'قبل'}</div></div>` : ''}
        ${r.after_photo ? `<div class="review-ba-img"><img src="${r.after_photo}" loading="lazy"><div class="review-ba-label">${window.VELOUR_LANG === 'en' ? 'After' : 'بعد'}</div></div>` : ''}
      </div>` : '';
    const replyHtml = r.reply_text ? `
      <div class="review-reply">
        <div class="review-reply-label">💬 ${window.VELOUR_LANG === 'en' ? 'Salon Reply' : 'رد الصالون'}</div>
        <div class="review-reply-text">${r.reply_text}</div>
      </div>` : '';
    return `
    <div class="review-card">
      <div class="review-header">
        <div class="review-avatar">${(r.client_name || '؟')[0]}</div>
        <div>
          <div class="review-name">${r.client_name || (window.VELOUR_LANG === 'en' ? 'Client' : 'زبونة')}</div>
          <div class="review-date">${new Date(r.created_at).toLocaleDateString(window.VELOUR_LANG === 'en' ? 'en-US' : 'ar-SA')}</div>
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
  const _sbEN = window.VELOUR_LANG === 'en';
  if (!currentUser) { showToast(_sbEN ? 'Please log in first' : 'يجب تسجيل الدخول أولاً'); return; }
  if (!selectedRating) { showToast(_sbEN ? 'Select a star rating first' : 'اختاري عدد النجوم أولاً'); return; }
  if (!currentSalonData) { showToast(_sbEN ? 'Error: salon data not loaded' : 'خطأ: بيانات الصالون غير محملة'); return; }
  const btn = document.querySelector('.rating-submit-btn');
  const comment = document.getElementById('rating-comment').value.trim();
  if (btn) { btn.disabled = true; btn.textContent = _sbEN ? 'Sending...' : 'جاري الإرسال...'; }
  try {
    const result = await Api.salons.rate(currentSalonData.id, selectedRating, comment,
      subRatings.cleanliness || null, subRatings.punctuality || null, subRatings.result || null,
      reviewBeforeUrl, reviewAfterUrl
    );
    document.getElementById('salon-detail-rating').textContent = result.rating;
    document.getElementById('salon-detail-reviews').textContent = result.reviews_count;
    document.getElementById('rw-avg').textContent = result.rating.toFixed(1);
    document.getElementById('rw-count').textContent = `${result.reviews_count} ${window.VELOUR_LANG === 'en' ? 'reviews' : 'تقييم'}`;
    document.getElementById('rw-stars-display').textContent = '★'.repeat(Math.round(result.rating)) + '☆'.repeat(5 - Math.round(result.rating));
    document.getElementById('rating-comment').value = '';
    const data = await Api.salons.get(currentSalonData.id);
    currentSalonData = data;
    document.getElementById('salon-reviews-list').innerHTML = '';
    renderSalonRatings(data);
    const _srEN = window.VELOUR_LANG === 'en';
    showToast(_srEN ? '✅ Thank you for your review!' : '✅ شكراً على تقييمك!');
  } catch (e) {
    const _srEN2 = window.VELOUR_LANG === 'en';
    showToast((_srEN2 ? 'Error: ' : 'خطأ: ') + (e.message || (_srEN2 ? 'Connection failed' : 'فشل الاتصال بالسيرفر')));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = window.VELOUR_LANG === 'en' ? 'Submit Review' : 'إرسال التقييم'; }
  }
}

function renderSalonReviews(reviews) {
  if (!reviews?.length) { document.getElementById('salon-reviews-list').innerHTML = `<div class="empty-state"><div class="empty-icon">⭐</div><h3>${window.VELOUR_LANG === 'en' ? 'No reviews yet' : 'لا توجد تقييمات بعد'}</h3></div>`; return; }
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
  const cachedMedia = _pageCacheGet('salonmedia_' + salonId);
  if (Array.isArray(cachedMedia)) _paintGallery(cachedMedia);   // instant cover on repeat visits
  try {
    const media = await Api.salons.media(salonId);
    _pageCacheSet('salonmedia_' + salonId, media);
    _paintGallery(media);
  } catch (e) {}
}

function _paintGallery(media) {
  const photos = media.filter(m => m.url && m.type !== 'video');
  const video  = media.find(m => m.url && m.type === 'video');
  buildCoverSlider(photos);   // photos only
  buildVideoSection(video);   // dedicated video section
  const strip = document.getElementById('salon-gallery-strip');
  if (strip) strip.classList.add('hidden');
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

  // Crossfade stack: every slide is absolutely stacked and filling the cover;
  // only the active slide is opaque. This deliberately avoids flex + translateX,
  // which shows blank slides under RTL (slides lay right→left, so translateX(-100%)
  // scrolls into empty space) and is unreliable in iOS WKWebView.
  track.style.cssText = 'position:absolute;inset:0;transform:none;';
  track.innerHTML = items.map((m, i) => {
    const url = mediaUrl(m.url);
    const base = `position:absolute;inset:0;opacity:${i === 0 ? 1 : 0};transition:opacity .6s ease;background:#f0e6ea;overflow:hidden;`;
    if (m.type === 'video') {
      return `<div class="cover-slide" style="${base}">
        <video src="${url}" muted playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"></video>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="openMediaViewer('${url}','video')">
          <svg viewBox="0 0 60 60" width="52" height="52" fill="none">
            <circle cx="30" cy="30" r="29" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
            <polygon points="24,18 46,30 24,42" fill="white"/>
          </svg>
        </div>
      </div>`;
    }
    // #f0e6ea base color shows if the image itself ever fails to load.
    return `<div class="cover-slide" style="${base}">
      <img src="${url}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" draggable="false">
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
  if (track) track.querySelectorAll('.cover-slide').forEach((s, i) => { s.style.opacity = i === idx ? '1' : '0'; });
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
  const _siEN = window.VELOUR_LANG === 'en';
  const days = _siEN
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const closedDays = (data.hours || []).filter(h => h.is_closed).map(h => days[h.day_of_week]);
  const offDaysHtml = closedDays.length
    ? closedDays.map(d => `<span class="off-day-chip">${d}</span>`).join('')
    : `<span style="color:#888">${_siEN ? 'No days off' : 'لا يوجد أيام إجازة'}</span>`;

  document.getElementById('salon-info-content').innerHTML = `
    <div class="info-row"><span class="info-icon">📍</span><div><div class="info-label">${_siEN ? 'Address' : 'العنوان'}</div><div class="info-value">${data.address || ''}, ${data.city}</div></div></div>
    <div class="info-row"><span class="info-icon">📞</span><div><div class="info-label">${_siEN ? 'Phone' : 'هاتف'}</div><div class="info-value">${data.phone || ''}</div></div></div>
    <div class="info-row"><span class="info-icon">🗓️</span><div><div class="info-label">${_siEN ? 'Days Off' : 'أيام الإجازة'}</div><div class="off-days-wrap">${offDaysHtml}</div></div></div>
    <div class="info-row"><span class="info-icon">ℹ️</span><div><div class="info-label">${_siEN ? 'About' : 'عن الصالون'}</div><div class="info-value">${data.description || ''}</div></div></div>
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
      <div class="service-icon" style="background:${categoryColor(s.category)}1a;border:1.5px solid ${categoryColor(s.category)}33">
        <span style="font-size:22px">${categoryIcon(s.category)}</span>
      </div>
      <div class="service-info">
        <h4 translate="no">${s.name_ar || s.name}</h4>
        <div class="duration">⏱ ${s.duration_minutes} ${window.VELOUR_LANG === 'en' ? 'min' : 'دقيقة'}</div>
      </div>
      <div class="service-price">₪${s.price}</div>
      <div class="service-check ${selectedIds.has(s.id) ? 'checked' : ''}">✓</div>
    </div>
  `).join('') + `<div id="wizard-services-footer" class="${(wizardState.services||[]).length ? '' : 'hidden'}">
    <div class="selected-services-bar">
      <span id="selected-svcs-count">${(wizardState.services||[]).length} ${window.VELOUR_LANG === 'en' ? 'service' : 'خدمة'}</span>
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
  } catch (e) { list.innerHTML = `<p style="padding:20px;text-align:center;color:var(--gray)">${window.VELOUR_LANG === 'en' ? 'No stylists available' : 'لا توجد كوفيرات متاحة'}</p>`; }
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
  document.getElementById('time-slots-grid').innerHTML = `<p style="text-align:center;color:var(--gray);padding:20px">${window.VELOUR_LANG === 'en' ? 'Select a day first' : 'اختاري يوماً أولاً'}</p>`;
}

function renderCalendar(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const _calEN = window.VELOUR_LANG === 'en';
  const monthNames = _calEN
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const dayNames = _calEN ? ['Su','Mo','Tu','We','Th','Fr','Sa'] : ['أح','اث','ث','أر','خ','ج','س'];
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
    if (!slots?.length) { slotsEl.innerHTML = `<p style="text-align:center;color:var(--gray);padding:20px">${window.VELOUR_LANG === 'en' ? 'No available slots on this day' : 'لا توجد مواعيد متاحة في هذا اليوم'}</p>`; return; }
    slotsEl.innerHTML = slots.map(s => `
      <button class="slot-btn ${s.available ? 'available' : 'unavailable'}"
        onclick="${s.available ? `selectSlot(this, '${s.time}')` : ''}">${s.time}</button>
    `).join('');
  } catch (e) {
    slotsEl.innerHTML = `<p style="text-align:center;color:var(--gray);padding:20px">${window.VELOUR_LANG === 'en' ? 'Failed to load slots' : 'تعذر تحميل المواعيد'}</p>`;
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
  const _bsEN = window.VELOUR_LANG === 'en';
  document.getElementById('booking-summary').innerHTML = `
    <div class="summary-row">
      <span class="summary-label">${_bsEN ? 'Services' : 'الخدمات'}</span>
      <span class="summary-value">${(s.services||[]).map(x => x.name_ar || x.name).join(' + ') || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">${_bsEN ? 'Stylist' : 'الكوفيرة'}</span>
      <span class="summary-value">${s.stylist?.name || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">${_bsEN ? 'Date' : 'التاريخ'}</span>
      <span class="summary-value">${s.date ? formatDateAr(s.date) : '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">${_bsEN ? 'Time' : 'الوقت'}</span>
      <span class="summary-value">${s.time || '-'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">${_bsEN ? 'Total Duration' : 'المدة الإجمالية'}</span>
      <span class="summary-value">${(s.services||[]).reduce((t,x)=>t+(x.duration_minutes||0),0) || '-'} ${_bsEN ? 'min' : 'دقيقة'}</span>
    </div>
    <div class="summary-row summary-price">
      <span class="summary-label">${_bsEN ? 'Total Price' : 'السعر الإجمالي'}</span>
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
  const _wnEN = window.VELOUR_LANG === 'en';
  if (s.step === 1 && !(s.services?.length)) { showToast(_wnEN ? '⚠️ Select at least one service' : '⚠️ اختاري خدمة واحدة على الأقل'); return; }
  if (s.step === 2 && !s.stylist) { showToast(_wnEN ? '⚠️ Select a stylist' : '⚠️ اختاري الكوفيرة'); return; }
  if (s.step === 3 && (!s.date || !s.time)) { showToast(_wnEN ? '⚠️ Select date and time' : '⚠️ اختاري التاريخ والوقت'); return; }

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
  const _cbEN = window.VELOUR_LANG === 'en';
  if (!s.services?.length || !s.stylist || !s.date || !s.time || !s.salonId) {
    showToast(_cbEN ? '⚠️ Booking data is incomplete' : '⚠️ بيانات الحجز غير مكتملة'); return;
  }

  const btn = event.currentTarget;
  btn.textContent = _cbEN ? '⏳ Booking...' : '⏳ جاري الحجز...';
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
    document.getElementById('success-points').textContent = _cbEN ? 'Awaiting stylist approval — you will be notified upon confirmation' : 'بانتظار موافقة الكوفيرة - ستصلك إشعار عند التأكيد';
    document.getElementById('modal-success').classList.remove('hidden');

    wizardState = { step: 1, services: [], stylist: null, date: null, time: null, salonId: null };
  } catch (e) {
    showToast('⚠️ ' + e.message);
  } finally {
    btn.textContent = window.VELOUR_LANG === 'en' ? 'Confirm Booking' : 'تأكيد الحجز';
    btn.disabled = false;
  }
}

// ===== BOOKINGS =====
let allBookings = [];
// Cache-first page data: paint the last-seen data instantly, refresh in the background.
function _pageCacheGet(key) {
  try { const uid = (currentUser && currentUser.id) || 'g'; return JSON.parse(localStorage.getItem(`velour_pc_${key}_${uid}`) || 'null'); } catch (e) { return null; }
}
function _pageCacheSet(key, data) {
  try { const uid = (currentUser && currentUser.id) || 'g'; localStorage.setItem(`velour_pc_${key}_${uid}`, JSON.stringify(data)); } catch (e) {}
}

let _bookingsFilter = 'upcoming';
async function loadMyBookings() {
  const cached = _pageCacheGet('bookings');
  if (Array.isArray(cached)) { allBookings = cached; filterBookings(_bookingsFilter); }  // instant paint
  else document.getElementById('bookings-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    allBookings = await Api.bookings.my();
    _pageCacheSet('bookings', allBookings);
    filterBookings(_bookingsFilter);
  } catch (e) {
    if (!Array.isArray(cached)) document.getElementById('bookings-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>${window.VELOUR_LANG === 'en' ? 'Failed to load bookings' : 'تعذر تحميل الحجوزات'}</h3></div>`;
  }
}

function filterBookings(type, btn) {
  _bookingsFilter = type;
  if (btn) { document.querySelectorAll('.btab').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
  const today = new Date().toISOString().split('T')[0];
  const filtered = type === 'upcoming'
    ? allBookings.filter(b => (b.booking_date >= today && b.status !== 'cancelled' && b.status !== 'rejected') || b.status === 'pending')
    : allBookings.filter(b => (b.booking_date < today && b.status !== 'pending') || b.status === 'cancelled' || b.status === 'rejected');

  if (!filtered.length) {
    const _noBookMsg = type === 'upcoming'
      ? (window.VELOUR_LANG === 'en' ? 'No upcoming bookings' : 'لا توجد حجوزات قادمة')
      : (window.VELOUR_LANG === 'en' ? 'No past bookings' : 'لا توجد حجوزات سابقة');
    const _bookCta = window.VELOUR_LANG === 'en' ? 'Book your first appointment now!' : 'احجزي موعدك الأول الآن!';
    document.getElementById('bookings-list').innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><h3>${_noBookMsg}</h3><p>${_bookCta}</p></div>`;
    return;
  }

  document.getElementById('bookings-list').innerHTML = filtered.map(b => `
    <div class="booking-item ${b.status === 'pending' ? 'pending-card' : ''} ${b.status === 'cancelled' || b.status === 'rejected' ? 'cancelled' : ''}" data-booking-id="${b.id}">
      <div class="booking-top">
        <div class="booking-service-name" translate="no">${b.name_ar || b.service_name}</div>
        <div class="status-${b.status}">${statusLabel(b.status)}</div>
      </div>
      <div class="booking-detail">
        <span>👩 ${b.stylist_name || '-'}</span>
        <span>🏠 ${b.salon_name || '-'}</span>
        <span>📅 ${formatDateAr(b.booking_date)}</span>
        <span>🕐 ${b.booking_time}</span>
        <span>💰 ₪${b.total_price}</span>
      </div>
      ${b.status === 'pending' ? `<div style="font-size:12px;color:#856404;background:#FFF3CD;border-radius:8px;padding:8px 10px;margin-top:8px">⏳ ${window.VELOUR_LANG === 'en' ? 'Awaiting stylist approval — you will be notified upon confirmation' : 'بانتظار موافقة الكوفيرة - ستصلك إشعار فور التأكيد'}</div>` : ''}
      ${b.status === 'rejected' ? `<div style="font-size:12px;color:#721c24;background:#F8D7DA;border-radius:8px;padding:8px 10px;margin-top:8px">❌ ${window.VELOUR_LANG === 'en' ? 'Booking rejected — you can choose another time' : 'تم رفض الحجز - يمكنك اختيار وقت آخر'}</div>` : ''}
      ${(b.status === 'pending' || b.status === 'confirmed') && b.booking_date >= today ? `
        <div class="booking-actions">
          ${b.status === 'confirmed' && b.stylist_user_id ? `<button class="btn-sm btn-sm-primary" onclick="openChatWith(${b.stylist_user_id}, '${(b.salon_name || b.stylist_name || '').replace(/'/g, '')}')">💬 ${window.VELOUR_LANG === 'en' ? 'Contact Salon' : 'تواصل مع الصالون'}</button>` : ''}
          <button class="btn-sm btn-sm-danger" onclick="cancelBooking(${b.id})">${window.VELOUR_LANG === 'en' ? 'Cancel' : 'إلغاء'}</button>
        </div>` : ''}
      ${b.booking_date < today && b.status === 'confirmed' ? `
        <div class="booking-actions">
          <button class="btn-sm btn-sm-primary" onclick="writeReview(${b.id})">⭐ ${window.VELOUR_LANG === 'en' ? 'Rate Session' : 'تقييم'}</button>
        </div>` : ''}
    </div>
  `).join('');
}

async function cancelBooking(id) {
  if (!confirm(window.VELOUR_LANG === 'en' ? 'Are you sure you want to cancel this booking?' : 'هل أنت متأكدة من إلغاء الحجز؟')) return;
  try {
    await Api.bookings.updateStatus(id, 'cancelled');
    showToast(window.VELOUR_LANG === 'en' ? 'Booking cancelled' : 'تم إلغاء الحجز');
    loadMyBookings();
  } catch (e) { showToast('⚠️ ' + e.message); }
}

function writeReview(id) {
  const _wrEN = window.VELOUR_LANG === 'en';
  const rating = prompt(_wrEN ? 'Rate from 1-5 stars:' : 'أعطي تقييماً من 1-5 نجوم:');
  const comment = prompt(_wrEN ? 'Your comment (optional):' : 'اكتبي تعليقك (اختياري):');
  if (rating) {
    Api.bookings.review(id, parseInt(rating), comment).then(() => {
      showToast(_wrEN ? 'Thank you for your review!' : 'شكراً على تقييمك!');
      loadMyBookings();
    }).catch(e => showToast('⚠️ ' + e.message));
  }
}

// ===== VOICE PLAYER =====
let _activeVoiceId = null;
const WAVE_BARS = 28;

// Generate random-looking wave heights (seeded per vid so consistent)
function _waveHeights(vid) {
  const heights = [];
  let seed = vid.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < WAVE_BARS; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    heights.push(30 + (Math.abs(seed) % 70));
  }
  return heights;
}

function _buildWaveBars(vid) {
  const heights = _waveHeights(vid);
  return heights.map((h, i) =>
    `<div class="vp-wave" id="${vid}_w${i}" style="height:${h}%"></div>`
  ).join('');
}

function _updateWaves(vid, pct) {
  const playedCount = Math.floor((pct / 100) * WAVE_BARS);
  for (let i = 0; i < WAVE_BARS; i++) {
    const bar = document.getElementById(vid + '_w' + i);
    if (bar) bar.classList.toggle('played', i < playedCount);
  }
}

function toggleVoice(vid) {
  const audio = document.getElementById(vid + '_audio');
  const btn = document.querySelector('#' + vid + ' .vp-btn');
  if (!audio) return;

  if (_activeVoiceId && _activeVoiceId !== vid) {
    const other = document.getElementById(_activeVoiceId + '_audio');
    if (other) { other.pause(); other.currentTime = 0; }
    const otherBtn = document.querySelector('#' + _activeVoiceId + ' .vp-btn');
    if (otherBtn) otherBtn.innerHTML = '&#9654;';
    _updateWaves(_activeVoiceId, 0);
  }

  if (audio.paused) {
    if (window._audioCtx && window._audioCtx.state === 'suspended') window._audioCtx.resume();
    audio.load();
    audio.play().catch(() => {});
    btn.innerHTML = '&#9646;&#9646;';
    _activeVoiceId = vid;
  } else {
    audio.pause();
    btn.innerHTML = '&#9654;';
  }
}

function updateVoiceProgress(vid) {
  const audio = document.getElementById(vid + '_audio');
  const timeEl = document.getElementById(vid + '_time');
  if (!audio) return;
  const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
  _updateWaves(vid, pct);
  if (timeEl) timeEl.textContent = fmtVoiceTime(audio.currentTime);
}

function showVoiceDuration(vid) {
  const audio = document.getElementById(vid + '_audio');
  const timeEl = document.getElementById(vid + '_time');
  if (audio && timeEl && audio.duration && !isNaN(audio.duration))
    timeEl.textContent = fmtVoiceTime(audio.duration);
}

function resetVoice(vid) {
  const btn = document.querySelector('#' + vid + ' .vp-btn');
  if (btn) btn.innerHTML = '&#9654;';
  _updateWaves(vid, 0);
  const audio = document.getElementById(vid + '_audio');
  const timeEl = document.getElementById(vid + '_time');
  if (timeEl && audio) timeEl.textContent = fmtVoiceTime(audio.duration || 0);
  _activeVoiceId = null;
}

function seekVoice(e, vid) {
  const audio = document.getElementById(vid + '_audio');
  const bar = e.currentTarget;
  if (!audio || !audio.duration) return;
  const rect = bar.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX);
  const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
  audio.currentTime = ratio * audio.duration;
}

function fmtVoiceTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// Unlock AudioContext on first touch (iOS fix)
document.addEventListener('touchstart', function unlockAudio() {
  if (!window._audioCtx) {
    try { window._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (window._audioCtx && window._audioCtx.state === 'suspended') window._audioCtx.resume();
}, { once: true });

// ===== CHAT =====
let voiceRecorder = null;
let voiceChunks = [];
let voiceRecording = false;

async function loadConversations() {
  const cached = _pageCacheGet('convos');
  if (Array.isArray(cached)) _renderConversations(cached);   // instant paint
  else document.getElementById('conversations-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    const convs = await Api.messages.conversations();
    _pageCacheSet('convos', convs);
    _renderConversations(convs);
  } catch (e) {}
}

function _renderConversations(convs) {
  const el = document.getElementById('conversations-list');
  if (!el) return;
  if (!convs.length) {
    const _cvEN = window.VELOUR_LANG === 'en';
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><h3>${_cvEN ? 'No conversations yet' : 'لا توجد محادثات بعد'}</h3><p>${_cvEN ? 'Contact your stylist from the bookings page' : 'تواصلي مع كوفيرتك من صفحة الحجوزات'}</p></div>`;
    return;
  }
  el.innerHTML = convs.map(c => `
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
    const vid = 'va_' + (msg.id || Date.now());
    bubble = `
      <div class="voice-player" id="${vid}">
        <button class="vp-btn" onclick="toggleVoice('${vid}')">&#9654;</button>
        <div class="vp-middle">
          <div class="vp-waves" onclick="seekVoice(event,'${vid}')">${_buildWaveBars(vid)}</div>
          <span class="vp-time" id="${vid}_time">0:00</span>
        </div>
        <audio id="${vid}_audio" src="${msg.media_url}" preload="metadata"
               ontimeupdate="updateVoiceProgress('${vid}')"
               onended="resetVoice('${vid}')"
               onloadedmetadata="showVoiceDuration('${vid}')"></audio>
      </div>`;
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
  if (voiceRecording) {
    // Pressing send button while voice recording is active sends the voice note!
    stopVoiceRecord();
    return;
  }
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
    showToast(window.VELOUR_LANG === 'en' ? '📤 Uploading photo...' : '📤 جاري رفع الصورة...');
    try {
      const res = await Api.messages.uploadChatFile(file);
      if (res.url) {
        const fakeMsg = { media_url: res.url, sender_id: currentUser?.id, created_at: new Date().toISOString(), msg_type: 'image', content: '' };
        appendChatMessage(fakeMsg, true);
        Api.messages.send(currentChatUserId, '', null, 'image', res.url).catch(e => showToast('⚠️ ' + e.message));
      }
    } catch (e) { showToast(window.VELOUR_LANG === 'en' ? '⚠️ Photo upload failed' : '⚠️ فشل رفع الصورة'); }
  };
  input.click();
}

let recordingTimerInterval = null;
let recordingSeconds = 0;

async function toggleVoiceRecord() {
  if (!voiceRecording) {
    await startVoiceRecord();
  } else {
    await stopVoiceRecord();
  }
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

    // UI Updates (Instagram style)
    document.getElementById('chat-voice-btn')?.classList.add('recording');
    document.getElementById('chat-input')?.classList.add('hidden');
    const recBar = document.getElementById('chat-recording-bar');
    if (recBar) recBar.classList.remove('hidden');

    recordingSeconds = 0;
    const timerEl = document.getElementById('chat-recording-timer');
    if (timerEl) timerEl.textContent = '0:00';
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = setInterval(() => {
      recordingSeconds++;
      if (timerEl) timerEl.textContent = fmtVoiceTime(recordingSeconds);
    }, 1000);

  } catch (e) {
    showToast(window.VELOUR_LANG === 'en' ? '⚠️ Microphone access denied' : '⚠️ لا يمكن الوصول للميكروفون');
  }
}

async function stopVoiceRecord() {
  if (!voiceRecording || !voiceRecorder) return;
  voiceRecording = false;

  clearInterval(recordingTimerInterval);
  document.getElementById('chat-voice-btn')?.classList.remove('recording');
  document.getElementById('chat-input')?.classList.remove('hidden');
  const recBar = document.getElementById('chat-recording-bar');
  if (recBar) recBar.classList.add('hidden');

  voiceRecorder.stream?.getTracks().forEach(t => t.stop());
  voiceRecorder.onstop = async () => {
    const blob = new Blob(voiceChunks, { type: 'audio/webm' });
    const _vrEN = window.VELOUR_LANG === 'en';
    if (blob.size < 1000) { showToast(_vrEN ? 'Recording too short' : 'التسجيل قصير جداً'); return; }
    showToast(_vrEN ? '📤 Sending voice message...' : '📤 جاري إرسال الرسالة الصوتية...');
    try {
      const file = new File([blob], 'voice.webm', { type: 'audio/webm' });
      const res = await Api.messages.uploadChatFile(file);
      if (res.url) {
        const fakeMsg = { media_url: res.url, sender_id: currentUser?.id, created_at: new Date().toISOString(), msg_type: 'voice', content: '' };
        appendChatMessage(fakeMsg, true);
        Api.messages.send(currentChatUserId, '', null, 'voice', res.url).catch(e => showToast('⚠️ ' + e.message));
      }
    } catch (e) { showToast(window.VELOUR_LANG === 'en' ? '⚠️ Failed to send voice message' : '⚠️ فشل إرسال الرسالة الصوتية'); }
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
      const _nextN = nextTierName(tier.name);
      const _tierEN = { 'الفضي': 'Silver', 'الذهبي': 'Gold', 'البلاتيني': 'Platinum' };
      document.getElementById('loyalty-next-info').textContent = window.VELOUR_LANG === 'en'
        ? `${tier.next - points} pts to ${_tierEN[_nextN] || _nextN}`
        : `${tier.next - points} نقطة للـ${_nextN}`;
      document.getElementById('loyalty-current-tier').textContent = window.VELOUR_LANG === 'en'
        ? ({ 'وردي': 'Pink', 'فضي': 'Silver', 'ذهبي': 'Gold', 'بلاتيني': 'Platinum' }[tier.name] || tier.name)
        : tier.name;
    } else {
      document.getElementById('loyalty-bar').style.width = '100%';
      document.getElementById('loyalty-next-info').textContent = window.VELOUR_LANG === 'en' ? 'Highest level ✦' : 'أعلى مستوى ✦';
    }
  } catch (e) {}
}

async function showColorHistory() {
  showScreen('color-history');
  document.getElementById('color-history-list').innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    const formulas = await Api.users.colorHistory();
    const _chEN = window.VELOUR_LANG === 'en';
    if (!formulas.length) {
      document.getElementById('color-history-list').innerHTML = `<div class="empty-state"><div class="empty-icon">🎨</div><h3>${_chEN ? 'No color history yet' : 'لا يوجد سجل ألوان بعد'}</h3><p>${_chEN ? 'After your first color visit, the formula will appear here' : 'بعد أول زيارة صبغ، ستجدين الفورمولا هنا'}</p></div>`;
      return;
    }
    document.getElementById('color-history-list').innerHTML = formulas.map(f => `
      <div class="color-card">
        <div class="color-card-header">
          <div class="color-swatch" style="background:${formulaToColor(f.formula)}"></div>
          <div>
            <h4>${f.color_name || (_chEN ? 'Color' : 'صبغة')}</h4>
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
          <div class="notif-title" style="color:${t.points > 0 ? 'var(--success)' : 'var(--rose)'}">${t.points > 0 ? '+' : ''}${t.points} ${window.VELOUR_LANG === 'en' ? 'pts' : 'نقطة'}</div>
          <div class="notif-body">${t.description}</div>
          <div class="notif-time">${formatTime(t.created_at)}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('notifs-list').innerHTML = html;
    showScreen('notifications');
    document.querySelector('#screen-notifications h2').textContent = window.VELOUR_LANG === 'en' ? 'Points History' : 'سجل النقاط';
  } catch (e) {}
}

async function showNotifications() {
  showScreen('notifications');
  document.querySelector('#screen-notifications h2').textContent = window.VELOUR_LANG === 'en' ? 'Notifications' : 'الإشعارات';
  // Hide both badges
  document.getElementById('notif-badge')?.classList.add('hidden');
  document.getElementById('st-notif-badge')?.classList.add('hidden');
  try {
    const notifs = await Api.users.notifications();
    await Api.users.markNotifsRead();
    if (!notifs.length) {
      document.getElementById('notifs-list').innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><h3>${window.VELOUR_LANG === 'en' ? 'No notifications' : 'لا توجد إشعارات'}</h3></div>`;
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
  const map = { 'صبغ الشعر': '🎨', 'قص': '✂️', 'علاجات': '💆', 'مكياج': '💄', 'أظافر': '💅', 'تصفيف': '👑', 'Hair': '✂️', 'Makeup': '💄', 'Nails': '💅', 'Styling': '👑', 'Treatment': '💆', 'Color': '🎨' };
  return map[cat] || '✨';
}

function categoryColor(cat) {
  const map = { 'صبغ الشعر': '#C97B8A', 'قص': '#8B6B9E', 'علاجات': '#6B9EA8', 'مكياج': '#C9608A', 'أظافر': '#A8706B', 'تصفيف': '#6B0F2B', 'Hair': '#8B6B9E', 'Makeup': '#C9608A', 'Nails': '#A8706B', 'Styling': '#6B0F2B', 'Treatment': '#6B9EA8', 'Color': '#C97B8A' };
  return map[cat] || '#6B0F2B';
}

function statusLabel(s) {
  if (window.VELOUR_LANG === 'en') {
    const en = { confirmed: '✅ Confirmed', pending: '⏳ Pending', cancelled: '❌ Cancelled', rejected: '❌ Rejected', completed: '✔️ Completed' };
    return en[s] || s;
  }
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
  if (window.VELOUR_LANG === 'en') {
    const monthsEN = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${parseInt(d)} ${monthsEN[parseInt(m)]} ${y}`;
  }
  const months = ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return `${parseInt(d)} ${months[parseInt(m)]} ${y}`;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  const _ftEN = window.VELOUR_LANG === 'en';
  if (diff < 1) return _ftEN ? 'Now' : 'الآن';
  if (diff < 60) return _ftEN ? `${diff}m` : `${diff} د`;
  if (diff < 1440) return _ftEN ? `${Math.floor(diff/60)}h` : `${Math.floor(diff/60)} س`;
  return d.toLocaleDateString(_ftEN ? 'en-US' : 'ar-PS', { month: 'short', day: 'numeric' });
}

// ===== BEAUTY PROFILE =====
let beautyProfileData = null;

async function showBeautyProfile() {
  showScreen('beauty-profile');
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
    const _bpEN = window.VELOUR_LANG === 'en';
    if (data.next_reminder_date) {
      const d = new Date(data.next_reminder_date);
      rEl.textContent = _bpEN
        ? `Next reminder: ${d.toLocaleDateString('en-US', { day:'numeric', month:'long' })}`
        : `التذكير القادم: ${d.toLocaleDateString('ar-PS', { day:'numeric', month:'long' })}`;
    } else {
      rEl.textContent = _bpEN ? 'No reminder set' : 'لا يوجد تذكير مضبوط حالياً';
    }

    // Color formulas
    const fl = document.getElementById('bp-formulas-list');
    if (!data.color_formulas?.length) {
      fl.innerHTML = `<div style="font-size:13px;color:var(--gray);text-align:center;padding:16px">${_bpEN ? 'No saved formulas yet' : 'لا توجد وصفات محفوظة بعد'}</div>`;
    } else {
      fl.innerHTML = data.color_formulas.map(f => `
        <div class="formula-card">
          <div class="formula-card-name">🎨 ${f.color_name || (_bpEN ? 'Color formula' : 'وصفة لون')}</div>
          <div class="formula-card-detail">${f.formula || ''}</div>
          ${f.notes ? `<div class="formula-card-detail" style="color:var(--rose-dark)">${f.notes}</div>` : ''}
          <div class="formula-card-detail">${f.visit_date || ''}</div>
        </div>
      `).join('');
    }
  } catch (e) { showToast(window.VELOUR_LANG === 'en' ? 'Failed to load beauty profile' : 'تعذّر تحميل الملف الجمالي'); }
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
    showToast(window.VELOUR_LANG === 'en' ? '✅ Beauty profile saved' : '✅ تم حفظ ملفك الجمالي');
  } catch (e) { showToast(window.VELOUR_LANG === 'en' ? '⚠️ Save failed' : '⚠️ فشل الحفظ'); }
}

async function setBeautyReminder(weeks) {
  const _brEN = window.VELOUR_LANG === 'en';
  try {
    const res = await Api.beauty.scheduleReminder(weeks);
    const d = new Date(res.reminder_date);
    document.getElementById('bp-reminder-status').textContent = _brEN
      ? `Next reminder: ${d.toLocaleDateString('en-US', { day:'numeric', month:'long' })}`
      : `التذكير القادم: ${d.toLocaleDateString('ar-PS', { day:'numeric', month:'long' })}`;
    showToast(_brEN ? `✅ We'll remind you in ${weeks} weeks 💆` : `✅ سنذكّرك بعد ${weeks} أسابيع 💆`);
  } catch (e) { showToast(_brEN ? '⚠️ Failed to set reminder' : '⚠️ فشل ضبط التذكير'); }
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
        const _brEN = window.VELOUR_LANG === 'en';
        msg.textContent = _brEN
          ? `Last color: ${data.last_color_date || 'Not set'} — Time for a refresh!`
          : `آخر صبغة: ${data.last_color_date || 'غير محددة'} — حان وقت التجديد!`;
        banner.classList.remove('hidden');
        showToast(_brEN ? '💆 Reminder: Time for your hair color!' : '💆 تذكير: حان وقت صبغة شعرك!', 5000);
      }
    }
  } catch (e) {}
}

// ===== AI HAIRSTYLE =====
let aiFaceBase64 = null;
let aiSelectedShape = null;

// ===================== Saved & resumable AI conversations (ChatGPT-style) =====================
// Stored locally per user & per kind ('beauty' | 'stylist'). Each conversation keeps its rich
// messages (text + optional image/products) so it can be reopened and continued anytime.
const AiConvo = {
  key(kind) { const uid = (currentUser && currentUser.id) || 'guest'; return `velour_ai_convos_${kind}_${uid}`; },
  load(kind) { try { return JSON.parse(localStorage.getItem(this.key(kind)) || '[]'); } catch (e) { return []; } },
  saveAll(kind, list) {
    try { localStorage.setItem(this.key(kind), JSON.stringify(list)); }
    catch (e) { try { localStorage.setItem(this.key(kind), JSON.stringify(list.slice(0, Math.max(1, list.length >> 1)))); } catch (_) {} }
  },
  upsert(kind, convo) {
    convo.updatedAt = Date.now();
    const list = this.load(kind).filter(c => c.id !== convo.id);
    list.unshift(convo);
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    this.saveAll(kind, list.slice(0, 40));
  },
  get(kind, id) { return this.load(kind).find(c => c.id === id) || null; },
  remove(kind, id) { this.saveAll(kind, this.load(kind).filter(c => c.id !== id)); },
};
function _convoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function _convoTitle(messages) {
  const fu = (messages || []).find(m => m.role === 'user' && (m.content || '').trim());
  const t = (fu ? fu.content : '').replace(/\s+/g, ' ').trim() || 'محادثة جديدة';
  return t.length > 34 ? t.slice(0, 34) + '…' : t;
}
function _convoWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  const yst = new Date(now); yst.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return 'اليوم ' + time;
  if (d.toDateString() === yst.toDateString()) return 'أمس ' + time;
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

// ---- generic conversations picker modal (shared by both chats) ----
let _aiConvoKind = 'beauty';
function ensureAiConvoModal() {
  if (document.getElementById('ai-convo-modal')) return;
  const d = document.createElement('div');
  d.id = 'ai-convo-modal';
  d.className = 'ai-convo-modal hidden';
  d.innerHTML = `<div class="ai-convo-sheet" onclick="event.stopPropagation()">
      <div class="ai-convo-head"><b>💬 محادثاتي</b><button type="button" class="ai-convo-x" onclick="closeAiConvoModal()">✕</button></div>
      <button type="button" class="ai-convo-new" onclick="newAiConvo()">➕ محادثة جديدة</button>
      <div id="ai-convo-list" class="ai-convo-list"></div>
    </div>`;
  d.addEventListener('click', () => closeAiConvoModal());
  document.body.appendChild(d);
}
function openAiConvoModal(kind) {
  _aiConvoKind = kind;
  ensureAiConvoModal();
  renderAiConvoList();
  document.getElementById('ai-convo-modal').classList.remove('hidden');
}
function closeAiConvoModal() { const m = document.getElementById('ai-convo-modal'); if (m) m.classList.add('hidden'); }
function renderAiConvoList() {
  const kind = _aiConvoKind;
  const list = AiConvo.load(kind);
  const curId = kind === 'beauty' ? (beautyConvo && beautyConvo.id) : (stylistConvo && stylistConvo.id);
  const el = document.getElementById('ai-convo-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = '<p class="ai-convo-empty">ما في محادثات محفوظة بعد ✨<br>ابدئي محادثة وراح تنحفظ هون تلقائياً.</p>'; return; }
  el.innerHTML = list.map(c => `<div class="ai-convo-item${c.id === curId ? ' active' : ''}" onclick="openAiConvo('${kind}','${c.id}')">
      <div class="ai-convo-item-main">
        <div class="ai-convo-item-t">${_esc(c.title || 'محادثة')}</div>
        <div class="ai-convo-item-d">${_convoWhen(c.updatedAt)}</div>
      </div>
      <button type="button" class="ai-convo-del" onclick="event.stopPropagation();deleteAiConvo('${kind}','${c.id}')" aria-label="حذف">🗑️</button>
    </div>`).join('');
}
function openAiConvo(kind, id) { closeAiConvoModal(); if (kind === 'beauty') openBeautyConversation(id); else openStylistConversation(id); }
function newAiConvo() { closeAiConvoModal(); if (_aiConvoKind === 'beauty') newBeautyConversation(); else newStylistConversation(); }
function deleteAiConvo(kind, id) {
  AiConvo.remove(kind, id);
  const curId = kind === 'beauty' ? (beautyConvo && beautyConvo.id) : (stylistConvo && stylistConvo.id);
  if (id === curId) { if (kind === 'beauty') newBeautyConversation(); else newStylistConversation(); }
  renderAiConvoList();
}

// ===================== Beauty (جوري) chat =====================
let beautyConvo = null;
let beautyChatBusy = false;
const BEAUTY_GREETING = 'أهلاً حبيبتي! 💖 أنا **جوري** 🌹 مستشارة جمالك. اسأليني عن أي شي — أظافرك 💅 مكياجك 💄 شعرك 💇 أو بشرتك 🧴\n\nوإذا حابة تحليل دقيق لملامحك، ارفعي صورتك 📸 وأنا أحللها لك وأعطيك نصايح مخصصة ✨';

function loadAiScreen() {
  ensureAiConvoModal();
  aiFaceBase64 = null;
  beautyChatBusy = false;
  clearBeautyAttach();
  const recent = AiConvo.load('beauty')[0];   // resume where she left off
  if (recent) openBeautyConversation(recent.id);
  else newBeautyConversation();
}
function newBeautyConversation() {
  beautyConvo = { id: _convoId(), title: 'محادثة جديدة', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  aiFaceBase64 = null; clearBeautyAttach();
  _renderBeautyConvo();
}
function openBeautyConversation(id) {
  const c = AiConvo.get('beauty', id);
  if (!c) return newBeautyConversation();
  beautyConvo = c;
  aiFaceBase64 = null; clearBeautyAttach();
  _renderBeautyConvo();
}
function _renderBeautyConvo() {
  const box = document.getElementById('beauty-chat-messages');
  if (box) box.innerHTML = '';
  appendBeautyMsg('them', BEAUTY_GREETING);
  (beautyConvo.messages || []).forEach(m => {
    if (m.role === 'user') appendBeautyMsg('me', m.content, m.image || null);
    else { appendBeautyMsg('them', m.content); if (Array.isArray(m.products) && m.products.length) appendBeautyProducts(m.products); }
  });
  if (box) box.scrollTop = box.scrollHeight;
}
function _persistBeauty() {
  if (!beautyConvo || !beautyConvo.messages.length) return;
  beautyConvo.title = _convoTitle(beautyConvo.messages);
  AiConvo.upsert('beauty', beautyConvo);
}

function _beautyFmt(t) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(t)
    .split('\n')
    .map((line) => {
      let l = esc(line);
      const h = l.match(/^\s*#{1,6}\s+(.*)$/);        // markdown header -> bold line
      if (h) l = '<strong>' + h[1] + '</strong>';
      l = l.replace(/^\s*[-*]\s+/, '• ');             // "- "/"* " bullet -> "• "
      l = l.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); // **bold**
      return l;
    })
    .join('<br>');
}

function _esc(t) {
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _catEmoji(cat) {
  return ({ skincare: '🧴', nails: '💅', makeup: '💄', hair: '💇' })[cat] || '✨';
}

function appendBeautyProducts(products) {
  const box = document.getElementById('beauty-chat-messages');
  if (!box) return;
  const wrap = document.createElement('div');
  wrap.className = 'beauty-products-row';
  wrap.innerHTML = products.map(p => {
    const img = p.image_url
      ? `<img class="bp-img" src="${_esc(p.image_url)}">`
      : `<div class="bp-img bp-img-ph">${_catEmoji(p.category)}</div>`;
    const price = (p.price != null && p.price !== '') ? `<div class="bp-price">${_esc(p.price)} ₪</div>` : '';
    const how = p.how_to_use ? `<div class="bp-how"><b>طريقة الاستخدام:</b> ${_beautyFmt(p.how_to_use)}</div>` : '';
    const desc = p.description ? `<div class="bp-desc">${_beautyFmt(p.description)}</div>` : '';
    const brand = p.brand ? ` <span class="bp-brand">${_esc(p.brand)}</span>` : '';
    return `<div class="beauty-product-card">
      ${img}
      <div class="bp-body">
        <div class="bp-name">${_esc(p.name)}${brand}</div>
        ${desc}${how}${price}
      </div>
    </div>`;
  }).join('');
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
}

// ===== Beauty products admin (stylist) =====
let bpNewImageUrl = null;

async function uploadBeautyProductImg(input) {
  const file = input.files[0];
  if (!file) return;
  const label = document.getElementById('bp-upload-text');
  if (label) label.textContent = '⏳ جاري الرفع...';
  try {
    const url = await Api.beauty.uploadProductImage(file);
    bpNewImageUrl = url;
    const img = document.getElementById('bp-new-img');
    if (img) { img.src = url; img.classList.remove('hidden'); }
    if (label) label.textContent = '✅ تم رفع الصورة (اضغطي للتغيير)';
  } catch (e) {
    if (label) label.textContent = '📷 اضغطي لإضافة صورة المنتج';
    showToast('⚠️ فشل رفع الصورة');
  }
}

async function addBeautyProduct() {
  const name = (document.getElementById('bp-new-name').value || '').trim();
  const category = document.getElementById('bp-new-category').value;
  if (!name) { showToast('اكتبي اسم المنتج'); return; }
  const tagsRaw = (document.getElementById('bp-new-tags').value || '').trim();
  const tags = tagsRaw ? tagsRaw.split(/[،,]/).map(s => s.trim()).filter(Boolean) : [];
  const priceRaw = (document.getElementById('bp-new-price').value || '').trim();
  const btn = document.getElementById('bp-add-btn');
  btn.disabled = true; btn.textContent = '⏳ جاري الإضافة...';
  try {
    await Api.beauty.addProduct({
      category, name,
      brand: (document.getElementById('bp-new-brand').value || '').trim(),
      tags,
      description: (document.getElementById('bp-new-desc').value || '').trim(),
      how_to_use: (document.getElementById('bp-new-how').value || '').trim(),
      price: priceRaw ? parseFloat(priceRaw) : null,
      image_url: bpNewImageUrl,
    });
    showToast('✅ تمت إضافة المنتج');
    ['bp-new-name', 'bp-new-brand', 'bp-new-tags', 'bp-new-desc', 'bp-new-how', 'bp-new-price'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    bpNewImageUrl = null;
    const img = document.getElementById('bp-new-img'); if (img) img.classList.add('hidden');
    const label = document.getElementById('bp-upload-text'); if (label) label.textContent = '📷 اضغطي لإضافة صورة المنتج';
    loadBeautyProductsAdmin();
  } catch (e) {
    showToast('⚠️ فشل إضافة المنتج');
  } finally {
    btn.disabled = false; btn.textContent = '➕ إضافة المنتج';
  }
}

async function loadBeautyProductsAdmin() {
  const list = document.getElementById('bp-admin-list');
  if (list) list.innerHTML = '<p style="text-align:center;color:#a08a94;padding:12px">⏳ جاري التحميل...</p>';
  try {
    const products = await Api.beauty.listProducts();
    if (!products || !products.length) {
      if (list) list.innerHTML = '<p style="text-align:center;color:#a08a94;padding:12px">ما في منتجات بعد — أضيفي أول منتج ✨</p>';
      return;
    }
    if (list) list.innerHTML = products.map(p => {
      const img = p.image_url ? `<img class="bp-img" src="${_esc(p.image_url)}">` : `<div class="bp-img bp-img-ph">${_catEmoji(p.category)}</div>`;
      const price = (p.price != null && p.price !== '') ? `<div class="bp-price">${_esc(p.price)} ₪</div>` : '';
      return `<div class="beauty-product-card" style="margin-bottom:10px">
        ${img}
        <div class="bp-body">
          <div class="bp-name">${_esc(p.name)}${p.brand ? ` <span class="bp-brand">${_esc(p.brand)}</span>` : ''}</div>
          ${p.description ? `<div class="bp-desc">${_beautyFmt(p.description)}</div>` : ''}
          ${price}
        </div>
        <button onclick="deleteBeautyProduct(${p.id})" title="حذف" style="border:none;background:none;color:#e05a6a;font-size:20px;cursor:pointer;align-self:flex-start">🗑️</button>
      </div>`;
    }).join('');
  } catch (e) {
    if (list) list.innerHTML = '<p style="text-align:center;color:#e05a6a;padding:12px">⚠️ خطأ في التحميل</p>';
  }
}

async function deleteBeautyProduct(id) {
  if (!confirm('حذف هذا المنتج؟')) return;
  try {
    await Api.beauty.deleteProduct(id);
    loadBeautyProductsAdmin();
  } catch (e) {
    showToast('⚠️ فشل الحذف');
  }
}

// ===== Stylist AI assistant (business + craft + marketing + replies) =====
let stylistConvo = null;
let stylistAssistantBusy = false;
const STYLIST_GREETING = 'أهلين 👋 أنا **جوري** 🌹 مساعِدتك الذكية. بقدر أساعدك بـ:\n\n📊 **تحليل أرقامك** ونصايح تزيد دخلك\n💬 **ردود جاهزة** لرسائل زبوناتك\n🎨 **أسئلة تقنية** (فورمولات صبغة، علاجات...)\n📣 **محتوى تسويقي** (عروض، كابشنات، وصف خدمات)\n\nشو بتحبي نبلّش فيه؟';

function loadStylistAssistant() {
  ensureAiConvoModal();
  stylistAssistantBusy = false;
  const recent = AiConvo.load('stylist')[0];
  if (recent) openStylistConversation(recent.id);
  else newStylistConversation();
}
function newStylistConversation() {
  stylistConvo = { id: _convoId(), title: 'محادثة جديدة', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  _renderStylistConvo();
}
function openStylistConversation(id) {
  const c = AiConvo.get('stylist', id);
  if (!c) return newStylistConversation();
  stylistConvo = c;
  _renderStylistConvo();
}
function _renderStylistConvo() {
  const box = document.getElementById('sa-chat-messages');
  if (box) box.innerHTML = '';
  appendSaMsg('them', STYLIST_GREETING);
  (stylistConvo.messages || []).forEach(m => appendSaMsg(m.role === 'user' ? 'me' : 'them', m.content));
  if (box) box.scrollTop = box.scrollHeight;
}
function _persistStylist() {
  if (!stylistConvo || !stylistConvo.messages.length) return;
  stylistConvo.title = _convoTitle(stylistConvo.messages);
  AiConvo.upsert('stylist', stylistConvo);
}

function appendSaMsg(who, text) {
  const box = document.getElementById('sa-chat-messages');
  if (!box) return null;
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (who === 'me' ? 'me' : 'them');
  wrap.innerHTML = text ? `<div class="msg-bubble">${_beautyFmt(text)}</div>` : '';
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  return wrap;
}

async function sendStylistAssistant() {
  if (stylistAssistantBusy) return;
  if (!stylistConvo) newStylistConversation();
  const input = document.getElementById('sa-chat-input');
  const text = (input.value || '').trim();
  if (!text) return;
  stylistAssistantBusy = true;
  appendSaMsg('me', text);
  input.value = '';
  stylistConvo.messages.push({ role: 'user', content: text });
  _persistStylist();
  const box = document.getElementById('sa-chat-messages');
  const wrap = appendSaMsg('them', '');
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<span class="ai-caret"></span>';
  if (wrap) wrap.appendChild(bubble);
  try {
    const apiHistory = stylistConvo.messages.map(m => ({ role: m.role, content: m.content }));
    const res = await Api.beauty.stylistAssistant(apiHistory, (partial) => {
      bubble.innerHTML = _beautyFmt(partial) + '<span class="ai-caret"></span>';
      if (box) box.scrollTop = box.scrollHeight;
    });
    const reply = (res && res.reply) || 'عذراً، ما قدرت أرد الآن.';
    bubble.innerHTML = _beautyFmt(reply);
    if (box) box.scrollTop = box.scrollHeight;
    stylistConvo.messages.push({ role: 'assistant', content: reply });
    _persistStylist();
  } catch (e) {
    if (wrap) wrap.remove();
    appendSaMsg('them', '⚠️ صار خطأ، جربي مرة ثانية.');
  } finally {
    stylistAssistantBusy = false;
  }
}

function appendBeautyMsg(who, text, imgSrc) {
  const box = document.getElementById('beauty-chat-messages');
  if (!box) return null;
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap ' + (who === 'me' ? 'me' : 'them');
  let html = '';
  if (imgSrc) html += `<img class="chat-img" src="${imgSrc}" style="margin-bottom:6px">`;
  if (text) html += `<div class="msg-bubble">${_beautyFmt(text)}</div>`;
  wrap.innerHTML = html;
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  return wrap;
}

function clearBeautyAttach() {
  aiFaceBase64 = null;
  const chip = document.getElementById('beauty-chat-attach-preview');
  if (chip) chip.classList.add('hidden');
  const inp = document.getElementById('ai-face-input');
  if (inp) inp.value = '';
}

async function sendBeautyChat() {
  if (beautyChatBusy) return;
  if (!beautyConvo) newBeautyConversation();
  const input = document.getElementById('beauty-chat-input');
  const text = (input.value || '').trim();
  const img = aiFaceBase64;
  if (!text && !img) return;

  beautyChatBusy = true;
  appendBeautyMsg('me', text, img);
  input.value = '';
  beautyConvo.messages.push({ role: 'user', content: text || 'حللي صورتي وأعطيني نصائح.', image: img || null });
  _persistBeauty();

  const sentImg = img;
  clearBeautyAttach();
  const box = document.getElementById('beauty-chat-messages');
  const wrap = appendBeautyMsg('them', '');
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = '<span class="ai-caret"></span>';
  if (wrap) wrap.appendChild(bubble);

  try {
    const apiHistory = beautyConvo.messages.map(m => ({ role: m.role, content: m.content }));
    const res = await Api.beauty.chat(apiHistory, sentImg, (partial) => {
      bubble.innerHTML = _beautyFmt(partial) + '<span class="ai-caret"></span>';
      if (box) box.scrollTop = box.scrollHeight;
    });
    const reply = (res && res.reply) || 'عذراً، ما قدرت أرد الآن.';
    bubble.innerHTML = _beautyFmt(reply);
    if (box) box.scrollTop = box.scrollHeight;
    const products = (res && Array.isArray(res.products)) ? res.products : [];
    if (products.length) appendBeautyProducts(products);
    beautyConvo.messages.push({ role: 'assistant', content: reply, products });
    _persistBeauty();
  } catch (e) {
    if (wrap) wrap.remove();
    appendBeautyMsg('them', '⚠️ صار خطأ، جربي مرة ثانية.');
  } finally {
    beautyChatBusy = false;
  }
}

function previewAiFace(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    // صور الآيفون كبيرة (2-5MB) وحد السيرفر 2MB — نصغّرها ونحوّلها JPEG قبل الإرسال
    const tmp = new Image();
    tmp.onload = () => {
      const MAX = 768;
      let w = tmp.width, h = tmp.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(tmp, 0, 0, w, h);
      aiFaceBase64 = canvas.toDataURL('image/jpeg', 0.85);
      const img = document.getElementById('ai-face-preview');
      if (img) img.src = aiFaceBase64;
      const chip = document.getElementById('beauty-chat-attach-preview');
      if (chip) chip.classList.remove('hidden');
    };
    tmp.onerror = () => showToast(window.VELOUR_LANG === 'en' ? '⚠️ Could not read image' : '⚠️ تعذّر قراءة الصورة');
    tmp.src = e.target.result;
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
  const _aiEN = window.VELOUR_LANG === 'en';
  btn.textContent = _aiEN ? '⏳ Analyzing...' : '⏳ جاري التحليل...';
  try {
    const result = await Api.beauty.aiHairstyle(aiFaceBase64, aiSelectedShape);
    renderAiResults(result);
  } catch (e) {
    showToast(_aiEN ? '⚠️ Analysis failed, try again' : '⚠️ فشل التحليل، جربي مرة أخرى');
  } finally {
    btn.disabled = false;
    btn.textContent = _aiEN ? '✨ Get your recommendations' : '✨ احصلي على توصياتك';
  }
}

function renderAiResults(data) {
  const results = document.getElementById('ai-results');
  results.classList.remove('hidden');

  const _rnEN = window.VELOUR_LANG === 'en';
  const shapeNames = _rnEN
    ? { oval:'Oval', round:'Round', square:'Square', heart:'Heart', rectangle:'Rectangle', diamond:'Diamond' }
    : { oval:'بيضاوي', round:'مستدير', square:'مربع', heart:'قلب', rectangle:'مستطيل', diamond:'ماسي' };
  const shapeName = shapeNames[data.face_shape] || data.face_shape || '';

  document.getElementById('ai-hairstyles-list').innerHTML = (data.hairstyles || []).map(h => `
    <div class="hairstyle-result-item">
      <div class="hairstyle-result-name">💇 ${h.name}</div>
      <div class="hairstyle-result-why">${h.why || ''}</div>
      <div class="hairstyle-result-desc">${h.description || ''}</div>
    </div>
  `).join('') || `<div style="color:var(--gray);font-size:13px">${_rnEN ? 'No results' : 'لا توجد نتائج'}</div>`;

  document.getElementById('ai-colors-list').innerHTML = (data.colors || []).map(c => `
    <span class="color-result-chip">🎨 ${c.arabic_name || c.name} <small style="font-weight:400;color:var(--gray)">${c.why || ''}</small></span>
  `).join('');

  if (shapeName) {
    const shapeEl = document.querySelector('.ai-intro-card h3');
    if (shapeEl) shapeEl.textContent = _rnEN ? `Face shape: ${shapeName}` : `شكل وجهك: ${shapeName}`;
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
  nextBtn.textContent = isLastStep ? (window.VELOUR_LANG === 'en' ? 'Show Result ✨' : 'عرض النتيجة ✨') : (window.VELOUR_LANG === 'en' ? 'Next ›' : 'التالي ›');
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
  const _gcEN = window.VELOUR_LANG === 'en';
  const allColors = [
    {
      name: _gcEN ? 'Dark Chocolate Brown' : 'بني شوكولاتة داكن',
      swatch: '#4a2c17', skins: ['olive','dark','medium'], eyes: ['brown','hazel','black'], styles: ['natural','professional'],
      reason: _gcEN ? 'Suits olive and dark skin tones, adding natural depth' : 'يناسب البشرة القمحية والداكنة ويعطي عمقاً طبيعياً',
      tip: _gcEN ? 'Add caramel highlights to brighten the face' : 'أضيفي هايلايت كراميل لإضاءة الوجه'
    },
    {
      name: _gcEN ? 'Golden Caramel Brown' : 'بني كراميل ذهبي',
      swatch: '#c68642', skins: ['fair','light','medium'], eyes: ['hazel','brown','green'], styles: ['warm','bold'],
      reason: _gcEN ? 'Brightens fair skin and adds beautiful warmth' : 'يُضيء البشرة الفاتحة ويعطي دفئاً جميلاً',
      tip: _gcEN ? 'Stunning with balayage spread from mid-length' : 'رائع مع بالياج منتشر من المنتصف'
    },
    {
      name: _gcEN ? 'Cool Ash Blonde' : 'أشقر رمادي بارد',
      swatch: '#b8b8b8', skins: ['fair','light'], eyes: ['blue','green','hazel'], styles: ['cool','bold'],
      reason: _gcEN ? 'Strikingly enhances blue and green eyes' : 'يُبرز العيون الزرقاء والخضراء بشكل مذهل',
      tip: _gcEN ? 'Requires maintenance every 4–5 weeks' : 'يحتاج صيانة كل 4-5 أسابيع'
    },
    {
      name: _gcEN ? 'Dark Charcoal Brown' : 'بني رمادي أسود',
      swatch: '#2d2d2d', skins: ['olive','dark','medium'], eyes: ['black','brown'], styles: ['cool','professional'],
      reason: _gcEN ? 'Elegant and modern, suits all professional occasions' : 'أنيق وعصري، يناسب جميع مناسبات العمل',
      tip: _gcEN ? 'Brighten with a black color-protect shampoo' : 'ألمع مع شامبو اللون الأسود'
    },
    {
      name: _gcEN ? 'Warm Copper' : 'نحاسي دافئ',
      swatch: '#b87333', skins: ['medium','olive','light'], eyes: ['hazel','brown','green'], styles: ['warm','bold'],
      reason: _gcEN ? 'A bold color that highlights facial features and adds vibrancy' : 'لون جريء يُبرز تفاصيل الوجه ويعطي حيوية',
      tip: _gcEN ? 'Protect your color with a daily color shield' : 'احمي لونك بواقي الألوان يومياً'
    },
    {
      name: _gcEN ? 'Light Platinum' : 'بلاتيني فاتح',
      swatch: '#e8d5a3', skins: ['fair','light'], eyes: ['blue','green'], styles: ['bold','cool'],
      reason: _gcEN ? 'A dramatic, daring change — ideal for fair skin' : 'تغيير جذري وجريء، مثالي للبشرة الفاتحة',
      tip: _gcEN ? 'Needs rest periods between sessions' : 'يحتاج فترات استراحة بين الجلسات'
    },
    {
      name: _gcEN ? 'Warm Natural Brown' : 'بني طبيعي دافئ',
      swatch: '#8b5a2b', skins: ['medium','olive','light'], eyes: ['brown','hazel','black'], styles: ['natural'],
      reason: _gcEN ? 'The least damaging and most natural option for any skin tone' : 'الأقل ضرراً والأكثر طبيعية لأي بشرة',
      tip: _gcEN ? 'Perfect choice if you prefer healthy hair' : 'خيار مثالي إذا كنتِ تفضلين الشعر الصحي'
    },
    {
      name: _gcEN ? 'Burgundy Red' : 'أحمر برغندي',
      swatch: '#800020', skins: ['fair','medium','olive'], eyes: ['hazel','green','brown'], styles: ['bold','warm'],
      reason: _gcEN ? 'An emotional, bold color that suits strong personalities' : 'لون عاطفي وجريء يناسب الشخصيات القوية',
      tip: _gcEN ? 'Dark burgundy flatters everyone' : 'البرغندي الداكن يناسب الجميع'
    },
  ];

  const scored = allColors.map(c => ({
    ...c,
    score: (c.skins.includes(skin) ? 2 : 0) + (c.eyes.includes(eyes) ? 2 : 0) + (c.styles.includes(style) ? 1 : 0)
  })).sort((a, b) => b.score - a.score).slice(0, 3);

  const styleLabels = _gcEN
    ? { natural: 'Natural', bold: 'Bold', warm: 'Warm', cool: 'Cool & Elegant' }
    : { natural: 'الطبيعية', bold: 'الجريئة', warm: 'الدافئة', cool: 'الأنيقة الباردة' };
  return {
    headline: _gcEN ? `Best Colors for Your ${styleLabels[style] || ''} Personality` : `أنسب الألوان لشخصيتك ${styleLabels[style] || ''}`,
    desc: _gcEN ? 'Based on your skin tone, eye color, and style' : 'بناءً على لون بشرتك وعيونك وأسلوبك',
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
