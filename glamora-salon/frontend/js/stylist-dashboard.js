// ===== STYLIST DASHBOARD =====
let stSalonData = null;
let stStylistData = null;
let stMyStyleistId = null;
let stSelectedEmoji = '💅';
let stEditingSalonId = null;
let stEditingServiceId = null;
let stAvailStylistId = null;
let stAllBookings = [];

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function DAYS() { return window.VELOUR_LANG === 'en' ? DAYS_EN : DAYS_AR; }
const CAT_ICONS = { 'صبغ الشعر': '🎨', 'قص': '✂️', 'علاجات': '💆', 'مكياج': '💄', 'أظافر': '💅', 'تصفيف': '👑' };

// Called when stylist logs in
async function enterStylistDashboard(user) {
  showScreen('stylist');
  stSwitchTab('salon', document.querySelector('#screen-stylist .nav-btn'));
  await loadStylistDashboard();
  loadNotifBadge();
  loadChatBadge();
  if (typeof initFirebaseNotifications === 'function') initFirebaseNotifications();
}

let _stDashRevealed = false;

function _revealStDash() {
  const el = document.getElementById('st-salon-info');
  if (el && !_stDashRevealed) { _stDashRevealed = true; el.classList.add('vel-reveal'); }
}

function _applyDashData(data) {
  stSalonData = data.salon;
  stStylistData = data.stylists || [];
  stMyStyleistId = data.my_stylist?.id || null;
  if (!stSalonData) {
    document.getElementById('st-no-salon').classList.remove('hidden');
    document.getElementById('st-salon-info').classList.add('hidden');
  } else {
    document.getElementById('st-no-salon').classList.add('hidden');
    document.getElementById('st-salon-info').classList.remove('hidden');
    renderSalonHeader();
    renderHours();
    renderCategories();
    renderServices();
  }
}

async function loadStylistDashboard() {
  _stDashRevealed = false;
  // Per-user cache key so a NEW stylist never briefly sees a previous account's salon.
  const dashKey = 'velour_dash_cache_' + ((currentUser && currentUser.id) || 'g');
  // instant paint from cache (zero wait)
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(dashKey) || 'null'); } catch {}
  if (cached && cached.salon) {
    _applyDashData(cached);
    _revealStDash();
  }
  // refresh silently
  try {
    const data = await Api.stylistDash.mySalon();
    try { localStorage.setItem(dashKey, JSON.stringify(data)); } catch {}
    _applyDashData(data);
    _revealStDash();
    if (stSalonData) {
      loadSalonMedia();
      loadBlockedSlots();
      loadStReviews();
      loadOffers(stSalonData.id);
      if (typeof refreshOrdersBadge === 'function') refreshOrdersBadge();
    }
  } catch (e) {
    console.error('loadStylistDashboard:', e);
    _revealStDash();
  }
}

function stSwitchTab(name, btn) {
  document.querySelectorAll('#screen-stylist .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#screen-stylist .nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('stab-' + name)?.classList.add('active');
  btn?.classList.add('active');

  if (name === 'bookings') loadStBookings('pending');
  if (name === 'team') renderTeam();
  if (name === 'chat') {
    loadStConversations();
    document.getElementById('st-chat-badge')?.classList.add('hidden');
    // Show quick replies for stylists
    document.getElementById('quick-replies-row')?.classList.remove('hidden');
  }
  if (name === 'profile') loadStProfile();
}

// ===== SALON HEADER =====
function renderSalonHeader() {
  if (!stSalonData) return;
  const coverEl = document.getElementById('st-cover-emoji');
  if (stSalonData.cover_url) {
    coverEl.innerHTML = `<img src="${stSalonData.cover_url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
  } else {
    coverEl.textContent = stSalonData.cover_emoji || '💅';
  }
  document.getElementById('st-sname').textContent = stSalonData.name;
  document.getElementById('st-scity').textContent = stSalonData.city;
  document.getElementById('st-saddress').textContent = stSalonData.address;
  document.getElementById('st-salon-name').textContent = stSalonData.name;
  const locEl = document.getElementById('st-location-status');
  if (locEl) {
    const _e = window.VELOUR_LANG === 'en';
    locEl.textContent = (stSalonData.latitude && stSalonData.longitude)
      ? (_e ? '✅ Location set on map' : '✅ الموقع محدد على الخريطة')
      : (_e ? '⚠️ Location not set — tap "Set Location"' : '⚠️ لم يتم تحديد الموقع بعد — اضغطي على "تحديد الموقع"');
  }
}

// ===== HOURS =====
function renderHours() {
  const hours = stSalonData?.hours || [];
  const closedDays = hours.filter(h => h.is_closed).map(h => DAYS()[h.day_of_week]);
  const el = document.getElementById('st-hours-list');
  if (!closedDays.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--gray)">${window.VELOUR_LANG === 'en' ? 'No days off — salon open every day' : 'لا يوجد أيام إجازة — الصالون مفتوح كل الأيام'}</div>`;
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
    closedDays.map(d => `<span class="off-day-chip">${d}</span>`).join('') +
    '</div>';
}

// ===== SERVICES =====
function renderServices() {
  const services = stSalonData?.services || [];
  const _svcEN = window.VELOUR_LANG === 'en';
  if (!services.length) {
    document.getElementById('st-services-list').innerHTML = `<div style="text-align:center;padding:20px;color:var(--gray)">${_svcEN ? 'No services yet' : 'لا توجد خدمات بعد'}</div>`;
    return;
  }
  document.getElementById('st-services-list').innerHTML = services.map(s => `
    <div class="service-mgmt-item">
      <div class="svc-cat-badge">${CAT_ICONS[s.category] || '💅'}</div>
      <div class="svc-mgmt-info">
        <div class="svc-mgmt-name" translate="no">${s.name_ar || s.name}</div>
        <div class="svc-mgmt-meta" translate="no">${s.category} · ${s.duration_minutes} ${_svcEN ? 'min' : 'دقيقة'}</div>
      </div>
      <div>
        <div class="svc-mgmt-price">${s.price}₪</div>
        <div class="svc-mgmt-actions" style="margin-top:6px">
          <button class="btn-svc-edit" onclick="showEditServiceForm(${s.id})">✏️</button>
          <button class="btn-svc-del" onclick="deleteService(${s.id})">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ===== TEAM =====
function renderTeam() {
  if (!stSalonData) { loadStylistDashboard().then(renderTeam); return; }
  const list = document.getElementById('st-stylists-list');
  const _teamEN = window.VELOUR_LANG === 'en';
  if (!stStylistData.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon">👩‍🎨</div><h3>${_teamEN ? 'No stylists yet' : 'لا توجد كوفيرات بعد'}</h3></div>`;
    return;
  }
  list.innerHTML = stStylistData.map(st => {
    let specs = [];
    try { specs = JSON.parse(st.specialties || '[]'); } catch {}
    const avail = st.availability || [];
    const workDays = avail.filter(a => !a.is_off).map(a => DAYS()[a.day_of_week]).join(window.VELOUR_LANG === 'en' ? ', ' : '، ');
    return `
      <div class="team-card">
        <div class="team-card-top">
          <div class="team-avatar-wrap" onclick="document.getElementById('team-avatar-input-${st.id}').click()" style="position:relative;cursor:pointer;flex-shrink:0">
            <div class="team-avatar">${st.avatar ? `<img class="avatar-img" src="${st.avatar}" alt="${st.name}">` : (st.name || '؟')[0]}</div>
            <div style="position:absolute;bottom:-2px;left:-2px;background:var(--rose);color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)">📷</div>
            <input type="file" id="team-avatar-input-${st.id}" accept="image/*" style="display:none" onchange="uploadTeamAvatar(${st.id}, this)">
          </div>
          <div class="team-info">
            <div class="team-name">${st.name || '-'}</div>
            <div class="team-phone">📞 ${st.phone || '-'} · ${st.experience_years} ${_teamEN ? 'yrs exp' : 'سنوات خبرة'}</div>
          </div>
        </div>
        ${specs.length ? `<div class="team-specs">${specs.map(sp => `<span class="team-spec-tag">${sp}</span>`).join('')}</div>` : ''}
        ${avail.length ? `<div class="team-schedule">${avail.filter(a=>!a.is_off).map(a => {
          let shifts = `<span class="day-label">${DAYS()[a.day_of_week]}</span>: ${a.start_time}–${a.end_time}`;
          if (a.shift2_enabled && a.shift2_start) shifts += ` · ${a.shift2_start}–${a.shift2_end}`;
          return `<span class="team-schedule-item">${shifts}</span>`;
        }).join('')}</div>` : `<div style="font-size:12px;color:var(--gray);margin-top:8px;padding:8px;background:var(--cream2);border-radius:8px">⚠️ ${_teamEN ? 'Working hours not set yet' : 'لم تُضبط مواعيد الدوام بعد'}</div>`}
        <button class="team-avail-btn" onclick="showAvailForm(${st.id}, '${st.name}')">⏰ ${_teamEN ? 'Set Working Hours' : 'ضبط مواعيد الدوام'}</button>
      </div>
    `;
  }).join('');
}

// ===== BOOKINGS =====
async function loadStBookings(filter) {
  const list = document.getElementById('st-bookings-list');
  const f = filter || 'pending';
  const cached = _pageCacheGet('stbookings_' + f);
  if (Array.isArray(cached)) { stAllBookings = cached; renderStBookings(cached); }  // instant
  else list.innerHTML = '<div class="loading-dots" style="padding:40px;text-align:center"><span></span><span></span><span></span></div>';
  try {
    stAllBookings = await Api.stylistDash.bookings(f);
    _pageCacheSet('stbookings_' + f, stAllBookings);
    renderStBookings(stAllBookings);
  } catch (e) {
    console.error(e);
    if (!Array.isArray(cached)) list.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon">⚠️</div><h3>${window.VELOUR_LANG === 'en' ? 'Loading error' : 'خطأ في التحميل'}</h3></div>`;
  }
}

function stFilterBookings(filter, btn) {
  document.querySelectorAll('#stab-bookings .btab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadStBookings(filter);
}

function renderStBookings(bookings) {
  const list = document.getElementById('st-bookings-list');
  if (!bookings.length) {
    list.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon">📅</div><h3>${window.VELOUR_LANG === 'en' ? 'No bookings' : 'لا توجد حجوزات'}</h3></div>`;
    return;
  }
  list.innerHTML = bookings.map(b => buildStBookingCard(b)).join('');
}

function buildStBookingCard(b) {
  const _isEN = window.VELOUR_LANG === 'en';
  const statusMap = {
    confirmed: { label: _isEN ? 'Confirmed ✅' : 'مؤكد ✅', cls: 'status-confirmed' },
    pending:   { label: _isEN ? 'Pending Approval ⏳' : 'بانتظار الموافقة ⏳', cls: 'status-pending' },
    cancelled: { label: _isEN ? 'Cancelled ❌' : 'ملغي ❌', cls: 'status-cancelled' },
    rejected:  { label: _isEN ? 'Rejected ❌' : 'مرفوض ❌', cls: 'status-cancelled' },
    completed: { label: _isEN ? 'Completed ✔️' : 'مكتمل ✔️', cls: 'status-completed' }
  };
  // a confirmed booking whose appointment time has passed shows as completed
  const _endMs = (() => {
    if (!b.booking_date) return null;
    const t = /^\d{1,2}:\d{2}/.test(b.booking_time || '') ? b.booking_time.slice(0, 5) : '23:59';
    const start = new Date(`${b.booking_date}T${t}:00`).getTime();
    return isNaN(start) ? null : start + (parseInt(b.total_duration) || 0) * 60000;
  })();
  const effStatus = (b.status === 'confirmed' && _endMs !== null && _endMs <= Date.now()) ? 'completed' : b.status;
  const st = statusMap[effStatus] || { label: b.status, cls: '' };
  const catIcon = { 'صبغ الشعر': '🎨', 'قص': '✂️', 'علاجات': '💆', 'مكياج': '💄', 'أظافر': '💅', 'تصفيف': '👑' };
  const icon = catIcon[b.service_category] || '✨';
  return `
    <div class="st-booking-card ${b.status === 'pending' ? 'booking-pending-highlight' : ''}" data-booking-id="${b.id}">
      <div class="st-bk-status-bar ${st.cls}">${st.label}</div>
      <div class="st-bk-body">
        <div class="st-bk-client-section">
          <div class="st-bk-client-avatar">${(b.client_name || '؟')[0]}</div>
          <div class="st-bk-client-info">
            <div class="st-bk-client-name">${b.client_name || '-'}</div>
            ${b.client_phone ? `<a href="tel:${b.client_phone}" class="st-bk-phone">📞 ${b.client_phone}</a>` : ''}
          </div>
        </div>
        <div class="st-bk-divider"></div>
        <div class="st-bk-details">
          <div class="st-bk-detail-row">
            <span class="st-bk-detail-icon">${icon}</span>
            <div>
              <div class="st-bk-svc-name" translate="no">${b.service_name || '-'}</div>
              <div class="st-bk-svc-meta">⏱ ${fmtDur(b.total_duration || b.duration_minutes)} · ${(b.total_price != null ? b.total_price : (b.service_price || 0))}₪${(b.services && b.services.length > 1) ? ` · ${b.services.length} ${_isEN ? 'services' : 'خدمات'}` : ''}</div>
              ${(b.services && b.services.length > 1) ? `<div class="st-bk-svc-list" style="margin-top:4px;font-size:12px;color:var(--gray)">${b.services.map(s => `${s.name} <span style="opacity:.7">(${fmtDur(s.duration_minutes)})</span>`).join(' • ')}</div>` : ''}
            </div>
          </div>
          <div class="st-bk-detail-row">
            <span class="st-bk-detail-icon">📅</span>
            <div>
              <div class="st-bk-svc-name">${formatDateAr ? formatDateAr(b.booking_date) : b.booking_date}</div>
              <div class="st-bk-svc-meta">${_isEN ? 'At' : 'الساعة'} ${b.booking_time}</div>
            </div>
          </div>
          ${b.stylist_name ? `<div class="st-bk-detail-row"><span class="st-bk-detail-icon">👩‍🎨</span><div class="st-bk-svc-name">${b.stylist_name}</div></div>` : ''}
          ${b.notes ? `<div class="st-bk-notes">💬 ${b.notes}</div>` : ''}
        </div>
      </div>
      ${b.status === 'pending' ? `
        <div class="st-bk-actions">
          <button class="btn-accept" onclick="stUpdateBooking(${b.id},'confirmed')">${_isEN ? 'Accept' : 'قبول الحجز'}</button>
          <button class="btn-reject" onclick="stUpdateBooking(${b.id},'rejected')">${_isEN ? 'Reject' : 'رفض'}</button>
        </div>` : ''}
      ${effStatus === 'confirmed' ? `
        <div class="st-bk-actions">
          <button class="btn-chat-sm" onclick="openChatWith(${b.client_id || b.id}, '${b.client_name}')">${_isEN ? 'Contact' : 'تواصل'}</button>
          <button class="btn-reject" onclick="stUpdateBooking(${b.id},'cancelled')">${_isEN ? 'Cancel Booking' : 'إلغاء الحجز'}</button>
        </div>` : ''}
    </div>
  `;
}

async function stUpdateBooking(id, status) {
  const _bkEN = window.VELOUR_LANG === 'en';
  const labels = _bkEN
    ? { confirmed: 'Booking accepted & client notified', rejected: 'Booking rejected', cancelled: 'Booking cancelled' }
    : { confirmed: 'تم قبول الحجز وإشعار الزبونة', rejected: 'تم رفض الحجز', cancelled: 'تم إلغاء الحجز' };
  try {
    await Api.stylistDash.updateBooking(id, status);
    showToast(labels[status] || (_bkEN ? 'Updated' : 'تم التحديث'));
    // reload current active filter
    const activeBtn = document.querySelector('#stab-bookings .btab.active');
    const filter = activeBtn?.dataset?.filter || 'pending';
    loadStBookings(filter);
  } catch (e) { showToast(window.VELOUR_LANG === 'en' ? 'An error occurred' : 'حدث خطأ'); }
}

// ===== CONVERSATIONS =====
async function loadStConversations() {
  try {
    const convs = await Api.messages.conversations();
    const list = document.getElementById('st-conversations-list');
    if (!convs.length) { list.innerHTML = `<div class="empty-state" style="padding:40px"><div class="empty-icon">💬</div><h3>${window.VELOUR_LANG === 'en' ? 'No messages' : 'لا توجد رسائل'}</h3></div>`; return; }
    list.innerHTML = convs.map(c => `
      <div class="conv-item" data-conv-id="${c.other_id}" onclick="openChatWith(${c.other_id}, '${c.other_name}', '${c.other_avatar || ''}')">
        <div class="conv-avatar">${_avatarInner(c.other_avatar, c.other_name)}</div>
        <div class="conv-info">
          <div class="conv-name">${c.other_name}</div>
          <div class="conv-preview">${c.last_message || ''}</div>
        </div>
        ${c.unread > 0 ? `<span class="badge">${c.unread}</span>` : ''}
      </div>
    `).join('');
  } catch (e) {}
}

// ===== SALON FORM =====
function _resetAvatarPreview(existingUrl) {
  stPendingAvatarFile = null;
  const preview = document.getElementById('sf-avatar-preview');
  if (!preview) return;
  if (existingUrl) {
    preview.innerHTML = `<img src="${existingUrl}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    preview.innerHTML = '💅';
  }
}

function showCreateSalonForm() {
  stEditingSalonId = null;
  const _cEN = window.VELOUR_LANG === 'en';
  document.getElementById('salon-form-title').textContent = _cEN ? 'Add New Salon' : 'إضافة صالون جديد';
  document.getElementById('sf-name').value = '';
  document.getElementById('sf-city').value = '';
  document.getElementById('sf-address').value = '';
  document.getElementById('sf-phone').value = '';
  document.getElementById('sf-desc').value = '';
  _resetAvatarPreview(null);
  document.getElementById('modal-salon-form').classList.remove('hidden');
}

function showEditSalonForm() {
  if (!stSalonData) return;
  stEditingSalonId = stSalonData.id;
  const _eEN = window.VELOUR_LANG === 'en';
  document.getElementById('salon-form-title').textContent = _eEN ? 'Edit Salon Info' : 'تعديل معلومات الصالون';
  document.getElementById('sf-name').value = stSalonData.name || '';
  document.getElementById('sf-city').value = stSalonData.city || '';
  document.getElementById('sf-address').value = stSalonData.address || '';
  document.getElementById('sf-phone').value = stSalonData.phone || '';
  document.getElementById('sf-desc').value = stSalonData.description || '';
  _resetAvatarPreview(stSalonData.cover_url || null);
  document.getElementById('modal-salon-form').classList.remove('hidden');
}

function selectSalonEmoji(el, emoji) {
  stSelectedEmoji = emoji;
  document.querySelectorAll('.ep-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
}

let stPendingAvatarFile = null;

function previewSalonAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  stPendingAvatarFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('sf-avatar-preview');
    preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover">`;
  };
  reader.readAsDataURL(file);
}

async function saveSalon() {
  const name = document.getElementById('sf-name').value.trim();
  const city = document.getElementById('sf-city').value.trim();
  const address = document.getElementById('sf-address').value.trim();
  const phone = document.getElementById('sf-phone').value.trim();
  const description = document.getElementById('sf-desc').value.trim();
  const _sfEN = window.VELOUR_LANG === 'en';
  if (!name || !city || !address) { showToast(_sfEN ? 'Name, city and address are required' : 'الاسم والمدينة والعنوان مطلوبة'); return; }

  try {
    let salonId = stEditingSalonId;
    if (stEditingSalonId) {
      await Api.stylistDash.updateSalon(stEditingSalonId, { name, city, address, phone, description });
      showToast(_sfEN ? 'Salon updated' : 'تم تحديث الصالون');
    } else {
      const created = await Api.stylistDash.createSalon({ name, city, address, phone, description });
      salonId = created?.id;
      showToast(_sfEN ? 'Salon created' : 'تم إنشاء الصالون');
    }
    // Upload avatar if selected
    if (stPendingAvatarFile && salonId) {
      const fd = new FormData();
      fd.append('file', stPendingAvatarFile);
      const avatarRes = await fetch(`${typeof API !== 'undefined' ? API : '/api'}/media/salon/${salonId}/avatar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: fd
      });
      const avatarData = await avatarRes.json().catch(() => ({}));
      if (!avatarRes.ok) showToast(avatarData.error || 'فشل رفع صورة الصالون');
      stPendingAvatarFile = null;
    }
    if (typeof pendingSalonLocation !== 'undefined' && pendingSalonLocation && salonId) {
      await Api.salons.updateLocation(salonId, pendingSalonLocation.lat, pendingSalonLocation.lng);
      pendingSalonLocation = null;
    }
    closeModalById('modal-salon-form');
    await loadStylistDashboard();
  } catch (e) { showToast(e.message); }
}

// ===== HOURS FORM =====
function showHoursForm() {
  const existing = stSalonData?.hours || [];
  const rows = document.getElementById('hours-form-rows');
  const _hfEN = window.VELOUR_LANG === 'en';
  const DAYS_DISP = _hfEN
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    : DAYS_AR;
  rows.innerHTML = `
    <p style="font-size:13px;color:var(--gray);margin-bottom:16px">${_hfEN ? 'Select days off — stylists cannot be booked on these days' : 'اختاري أيام إجازة الصالون — الكوفيرات لن تتمكن من الحجز في هذه الأيام'}</p>
    <div style="display:flex;flex-direction:column;gap:10px">
    ${DAYS_AR.map((day, i) => {
      const h = existing.find(e => e.day_of_week === i);
      const isOff = h?.is_closed ? 'checked' : '';
      return `
        <label style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;border:1.5px solid var(--gray-light);cursor:pointer" id="hf-label-${i}">
          <input type="checkbox" id="hf-closed-${i}" ${isOff} onchange="toggleOffDay(${i},this.checked)" style="width:18px;height:18px;accent-color:var(--primary)">
          <span style="font-size:15px;font-weight:600">${DAYS_DISP[i]}</span>
          ${h?.is_closed ? `<span class="off-day-chip" id="hf-badge-${i}">${_hfEN ? 'Day Off' : 'إجازة'}</span>` : `<span id="hf-badge-${i}"></span>`}
        </label>
      `;
    }).join('')}
    </div>
  `;
  document.getElementById('modal-hours-form').classList.remove('hidden');
}

function toggleOffDay(i, isOff) {
  const badge = document.getElementById(`hf-badge-${i}`);
  const label = document.getElementById(`hf-label-${i}`);
  const _tfEN = window.VELOUR_LANG === 'en';
  if (isOff) {
    badge.className = 'off-day-chip';
    badge.textContent = _tfEN ? 'Day Off' : 'إجازة';
    label.style.borderColor = '#EF4444';
    label.style.background = '#FEF2F2';
  } else {
    badge.className = '';
    badge.textContent = '';
    label.style.borderColor = 'var(--gray-light)';
    label.style.background = '';
  }
}

async function saveHours() {
  const hours = DAYS_AR.map((_, i) => ({
    day_of_week: i,
    open_time: '09:00',
    close_time: '20:00',
    is_closed: document.getElementById(`hf-closed-${i}`).checked
  }));
  try {
    await Api.stylistDash.setHours(stSalonData.id, hours);
    showToast(window.VELOUR_LANG === 'en' ? 'Days off saved' : 'تم حفظ أيام الإجازة');
    closeModalById('modal-hours-form');
    await loadStylistDashboard();
  } catch (e) { showToast(e.message); }
}

// ===== SERVICE FORM =====
function showAddServiceForm() {
  stEditingServiceId = null;
  document.getElementById('service-form-title').textContent = 'إضافة خدمة جديدة';
  document.getElementById('svc-edit-id').value = '';
  document.getElementById('svc-name').value = '';
  document.getElementById('svc-price').value = '';
  document.getElementById('svc-duration').value = '';
  document.getElementById('svc-desc').value = '';
  document.getElementById('modal-service-form').classList.remove('hidden');
}

function showEditServiceForm(id) {
  const svc = stSalonData?.services?.find(s => s.id === id);
  if (!svc) return;
  stEditingServiceId = id;
  document.getElementById('service-form-title').textContent = 'تعديل الخدمة';
  document.getElementById('svc-edit-id').value = id;
  document.getElementById('svc-name').value = svc.name_ar || svc.name || '';
  document.getElementById('svc-category').value = svc.category || 'صبغ الشعر';
  document.getElementById('svc-price').value = svc.price || '';
  document.getElementById('svc-duration').value = svc.duration_minutes || '';
  document.getElementById('svc-desc').value = svc.description || '';
  document.getElementById('modal-service-form').classList.remove('hidden');
}

async function saveService() {
  const name_ar = document.getElementById('svc-name').value.trim();
  const category = document.getElementById('svc-category').value;
  const price = document.getElementById('svc-price').value;
  const duration_minutes = document.getElementById('svc-duration').value;
  const description = document.getElementById('svc-desc').value.trim();
  const _svcFEN = window.VELOUR_LANG === 'en';
  if (!name_ar || !price || !duration_minutes) { showToast(_svcFEN ? 'Please fill all fields' : 'يرجى تعبئة جميع الحقول'); return; }

  try {
    if (stEditingServiceId) {
      await Api.stylistDash.editService(stEditingServiceId, { name_ar, category, price, duration_minutes, description });
      showToast(_svcFEN ? 'Service updated' : 'تم تحديث الخدمة');
    } else {
      await Api.stylistDash.addService(stSalonData.id, { name_ar, category, price, duration_minutes, description });
      showToast(_svcFEN ? 'Service added' : 'تمت إضافة الخدمة');
    }
    closeModalById('modal-service-form');
    await loadStylistDashboard();
  } catch (e) { showToast(e.message); }
}

async function deleteService(id) {
  const _delSEN = window.VELOUR_LANG === 'en';
  if (!confirm(_delSEN ? 'Delete this service?' : 'هل تريدين حذف هذه الخدمة؟')) return;
  try {
    await Api.stylistDash.deleteService(id);
    showToast(_delSEN ? 'Service deleted' : 'تم حذف الخدمة');
    await loadStylistDashboard();
  } catch (e) { showToast(e.message); }
}

// ===== ADD STYLIST =====
function showAddStylistForm() {
  document.getElementById('stf-name').value = '';
  document.getElementById('stf-phone').value = '';
  document.getElementById('stf-exp').value = '';
  document.getElementById('stf-bio').value = '';
  document.getElementById('modal-stylist-form').classList.remove('hidden');
}

function toggleSpec(el, spec) {
  el.classList.toggle('selected');
}

async function saveStylist() {
  const _stFEN = window.VELOUR_LANG === 'en';
  if (!stSalonData) { showToast(_stFEN ? 'Create a salon first' : 'يجب إنشاء الصالون أولاً'); return; }
  const name = document.getElementById('stf-name').value.trim();
  const phone = document.getElementById('stf-phone').value.trim();
  const experience_years = parseInt(document.getElementById('stf-exp').value) || 1;
  const bio = document.getElementById('stf-bio').value.trim();
  if (!name || !phone) { showToast(_stFEN ? 'Name and phone are required' : 'الاسم والهاتف مطلوبان'); return; }

  const btn = document.querySelector('#modal-stylist-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = _stFEN ? 'Adding...' : 'جاري الإضافة...'; }
  try {
    await Api.stylistDash.addStylist(stSalonData.id, { name, phone, bio, experience_years });
    showToast(_stFEN ? 'Stylist added — default password: 123456' : 'تمت إضافة الكوفيرة - كلمة مرورها الافتراضية: 123456');
    closeModalById('modal-stylist-form');
    await loadStylistDashboard();
    renderTeam();
  } catch (e) {
    console.error('saveStylist error:', e);
    showToast(e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = window.VELOUR_LANG === 'en' ? 'Add' : 'إضافة'; }
  }
}

// ===== AVAILABILITY (2 SHIFTS) =====
function showAvailForm(stylistId, name) {
  stAvailStylistId = stylistId;
  const _avEN = window.VELOUR_LANG === 'en';
  document.getElementById('avail-form-title').textContent = _avEN ? `${name} Working Hours ⏰` : `مواعيد دوام ${name} ⏰`;
  document.getElementById('avail-stylist-id').value = stylistId;

  const st = stStylistData.find(s => s.id === stylistId);
  const existing = st?.availability || [];
  const DAYS_DISP2 = _avEN
    ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    : DAYS_AR;

  document.getElementById('avail-form-rows').innerHTML = DAYS_AR.map((day, i) => {
    const a = existing.find(e => e.day_of_week === i);
    const isOff = !a || a.is_off;
    const s2 = !isOff && a?.shift2_enabled;
    return `
      <div class="avail-day-block" id="avail-block-${i}">
        <div class="avail-day-header">
          <span class="avail-day-name">${DAYS_DISP2[i]}</span>
          <label class="avail-toggle">
            <input type="checkbox" id="af-off-${i}" ${isOff ? 'checked' : ''} onchange="toggleAvailDay(${i},this.checked)">
            <span class="avail-toggle-label ${isOff ? 'off' : 'on'}" id="af-off-label-${i}">${isOff ? (_avEN ? 'Day Off' : 'إجازة') : (_avEN ? 'Working' : 'دوام')}</span>
          </label>
        </div>
        <div class="avail-shifts" id="af-shifts-${i}" style="display:${isOff ? 'none' : 'block'}">
          <div class="avail-shift-row">
            <span class="shift-label">🌅 ${_avEN ? 'Morning' : 'الصباحي'}</span>
            <div class="shift-times">
              <input type="time" id="af-start-${i}" value="${a?.start_time || '09:00'}">
              <span>–</span>
              <input type="time" id="af-end-${i}" value="${a?.end_time || '14:00'}">
            </div>
          </div>
          <div class="avail-shift2-toggle">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="af-s2-${i}" ${s2 ? 'checked' : ''} onchange="toggleShift2(${i},this.checked)" style="width:16px;height:16px;accent-color:var(--rose)">
              <span style="font-size:13px;color:var(--rose-dark);font-weight:600">+ ${_avEN ? 'Add Evening Shift' : 'إضافة شيفت مسائي'}</span>
            </label>
          </div>
          <div class="avail-shift-row" id="af-s2-row-${i}" style="display:${s2 ? 'flex' : 'none'}">
            <span class="shift-label">🌙 ${_avEN ? 'Evening' : 'المسائي'}</span>
            <div class="shift-times">
              <input type="time" id="af-s2start-${i}" value="${a?.shift2_start || '16:00'}">
              <span>–</span>
              <input type="time" id="af-s2end-${i}" value="${a?.shift2_end || '21:00'}">
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('modal-avail-form').classList.remove('hidden');
}

function toggleAvailDay(day, isOff) {
  const shifts = document.getElementById(`af-shifts-${day}`);
  const label = document.getElementById(`af-off-label-${day}`);
  shifts.style.display = isOff ? 'none' : 'block';
  const _tdEN = window.VELOUR_LANG === 'en';
  label.textContent = isOff ? (_tdEN ? 'Day Off' : 'إجازة') : (_tdEN ? 'Working' : 'دوام');
  label.className = `avail-toggle-label ${isOff ? 'off' : 'on'}`;
}

function toggleShift2(day, enabled) {
  document.getElementById(`af-s2-row-${day}`).style.display = enabled ? 'flex' : 'none';
}

async function saveAvailability() {
  const availability = DAYS_AR.map((_, i) => ({
    day_of_week: i,
    is_off: document.getElementById(`af-off-${i}`).checked,
    start_time: document.getElementById(`af-start-${i}`)?.value || '09:00',
    end_time: document.getElementById(`af-end-${i}`)?.value || '14:00',
    shift2_enabled: document.getElementById(`af-s2-${i}`)?.checked || false,
    shift2_start: document.getElementById(`af-s2start-${i}`)?.value || null,
    shift2_end: document.getElementById(`af-s2end-${i}`)?.value || null
  }));
  try {
    await Api.stylistDash.setAvailability(stAvailStylistId, availability);
    showToast(window.VELOUR_LANG === 'en' ? 'Working hours saved' : 'تم حفظ مواعيد الدوام');
    closeModalById('modal-avail-form');
    await loadStylistDashboard();
    renderTeam();
  } catch (e) { showToast(e.message); }
}

// ===== SALON MEDIA =====
async function loadSalonMedia() {
  if (!stSalonData) return;
  const cached = _pageCacheGet('stmedia_' + stSalonData.id);
  if (Array.isArray(cached)) renderMediaGrid(cached);   // instant photos on open
  try {
    const media = await Api.stylistDash.getSalonMedia(stSalonData.id);
    _pageCacheSet('stmedia_' + stSalonData.id, media);
    renderMediaGrid(media);
  } catch (e) {}
}

function renderMediaGrid(media) {
  const grid = document.getElementById('st-media-grid');
  if (!grid) return;
  const photos = media.filter(m => m.type === 'photo');
  const video = media.find(m => m.type === 'video');
  const _mgEN = window.VELOUR_LANG === 'en';

  grid.innerHTML = media.map(m => {
    const isVideo = m.type === 'video';
    return `
      <div class="media-item ${m.is_cover ? 'media-cover' : ''}" onclick="${isVideo ? '' : `setCoverMedia(${m.id})`}">
        ${isVideo
          ? `<video src="${mediaUrl(m.url)}#t=0.5" class="media-thumb" muted playsinline preload="auto" onloadeddata="try{if(this.currentTime===0)this.currentTime=0.5}catch(e){}"></video><div class="media-type-badge">vid</div>`
          : `<img src="${mediaUrl(m.url)}" class="media-thumb">`}
        ${m.is_cover ? `<div class="media-cover-badge">${_mgEN ? 'Cover ✓' : 'غلاف ✓'}</div>` : ''}
        <button class="media-delete-btn" onclick="event.stopPropagation();deleteMedia(${m.id})">×</button>
      </div>
    `;
  }).join('');

  // Add slots
  const photoSlots = 4 - photos.length;
  const videoSlot = video ? 0 : 1;
  for (let i = 0; i < photoSlots; i++) {
    grid.innerHTML += `<label class="media-add-slot"><input type="file" accept="image/*" style="display:none" onchange="uploadSalonMedia(this)">📷<br><span>${_mgEN ? 'Photo' : 'صورة'}</span></label>`;
  }
  if (videoSlot) {
    grid.innerHTML += `<label class="media-add-slot media-video-slot"><input type="file" accept="video/mp4,video/webm" style="display:none" onchange="uploadSalonMedia(this)">🎬<br><span>${_mgEN ? 'Video' : 'فيديو'}</span></label>`;
  }
}

async function uploadSalonMedia(input) {
  if (!stSalonData || !input.files[0]) return;
  const file = input.files[0];
  const _upEN = window.VELOUR_LANG === 'en';
  showToast(_upEN ? '⏳ Uploading file...' : '⏳ جاري رفع الملف...');
  try {
    const result = await Api.stylistDash.uploadMedia(stSalonData.id, file);
    if (result.error) { showToast(result.error); return; }
    showToast(_upEN ? 'File uploaded' : 'تم رفع الملف');
    loadSalonMedia();
  } catch (e) { showToast(e.message || (_upEN ? 'Upload failed' : 'فشل الرفع')); }
  input.value = '';
}

async function setCoverMedia(mediaId) {
  try {
    await Api.stylistDash.setCover(mediaId);
    showToast(window.VELOUR_LANG === 'en' ? 'Cover photo set' : 'تم تعيين الغلاف');
    loadSalonMedia();
  } catch (e) { showToast(e.message); }
}

async function deleteMedia(mediaId) {
  const _dmEN = window.VELOUR_LANG === 'en';
  if (!confirm(_dmEN ? 'Delete this photo?' : 'حذف هذه الصورة؟')) return;
  try {
    await Api.stylistDash.deleteMedia(mediaId);
    showToast(_dmEN ? 'Deleted' : 'تم الحذف');
    loadSalonMedia();
  } catch (e) { showToast(e.message); }
}

// ===== OFFERS =====
let currentSalonIdForOffers = null;

function showAddOfferForm() {
  document.getElementById('offer-title').value = '';
  document.getElementById('offer-desc').value = '';
  document.getElementById('offer-discount').value = '';
  document.getElementById('offer-valid-until').value = '';
  document.getElementById('modal-add-offer').classList.remove('hidden');
}

async function saveOffer() {
  const _ofEN = window.VELOUR_LANG === 'en';
  const title = document.getElementById('offer-title').value.trim();
  if (!title) { showToast(_ofEN ? 'Enter offer title' : 'أدخلي عنوان العرض'); return; }
  const btn = document.querySelector('#modal-add-offer .btn-primary');
  btn.disabled = true; btn.textContent = _ofEN ? 'Sending...' : 'جاري الإرسال...';
  try {
    const salonId = currentSalonIdForOffers;
    await Api.stylistDash.addOffer(salonId, {
      title,
      description: document.getElementById('offer-desc').value.trim(),
      discount_percent: parseInt(document.getElementById('offer-discount').value) || 0,
      valid_until: document.getElementById('offer-valid-until').value || null,
    });
    closeModalById('modal-add-offer');
    showToast(_ofEN ? '✅ Offer sent & clients notified!' : '✅ تم إرسال العرض وإشعار الزبونات!');
    loadOffers(salonId);
  } catch (e) { showToast('⚠️ ' + e.message); }
  finally { btn.disabled = false; btn.textContent = _ofEN ? 'Send Offer 🎁' : 'إرسال العرض 🎁'; }
}

async function loadOffers(salonId) {
  currentSalonIdForOffers = salonId;
  const list = document.getElementById('st-offers-list');
  if (!list) return;
  try {
    const _loEN = window.VELOUR_LANG === 'en';
    const offers = await Api.stylistDash.getOffers(salonId);
    if (!offers.length) {
      list.innerHTML = `<div style="font-size:13px;color:var(--gray);padding:8px 0">${_loEN ? 'No active offers' : 'لا توجد عروض نشطة'}</div>`;
      return;
    }
    list.innerHTML = offers.map(o => `
      <div style="background:var(--bg);border-radius:12px;padding:12px;margin-bottom:8px;border-right:4px solid var(--rose);display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div>
          <div style="font-weight:800;font-size:14px">🎁 ${o.title}</div>
          ${o.discount_percent ? `<div style="font-size:12px;color:var(--rose-dark);margin-top:2px">${_loEN ? `${o.discount_percent}% discount` : `خصم ${o.discount_percent}%`}</div>` : ''}
          ${o.valid_until ? `<div style="font-size:11px;color:var(--gray);margin-top:2px">${_loEN ? `Valid until ${o.valid_until}` : `صالح حتى ${o.valid_until}`}</div>` : ''}
        </div>
        <button onclick="deleteOffer(${o.id})" style="background:none;border:none;color:#e74c3c;font-size:18px;cursor:pointer;flex-shrink:0">🗑</button>
      </div>
    `).join('');
  } catch (e) { list.innerHTML = ''; }
}

async function deleteOffer(id) {
  try {
    await Api.stylistDash.deleteOffer(id);
    showToast(window.VELOUR_LANG === 'en' ? 'Offer deleted' : 'تم حذف العرض');
    loadOffers(currentSalonIdForOffers);
  } catch (e) { showToast('⚠️ ' + e.message); }
}

// ===== BLOCKED SLOTS =====
function showBlockSlotForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bs-date').value = today;
  document.getElementById('bs-date').min = today;
  document.getElementById('bs-start').value = '09:00';
  document.getElementById('bs-end').value = '11:00';
  document.getElementById('bs-reason').value = '';

  // Fill stylist dropdown
  const sel = document.getElementById('bs-stylist');
  sel.innerHTML = `<option value="">${window.VELOUR_LANG === 'en' ? 'Select stylist...' : 'اختاري الكوفيرة...'}</option>`;
  (stStylistData || []).forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.id;
    opt.textContent = st.name || 'كوفيرة';
    if (st.id === stMyStyleistId) opt.selected = true;
    sel.appendChild(opt);
  });

  document.getElementById('modal-block-slot').classList.remove('hidden');
}

async function saveBlockedSlot() {
  const stylist_id = document.getElementById('bs-stylist').value;
  const date = document.getElementById('bs-date').value;
  const start_time = document.getElementById('bs-start').value;
  const end_time = document.getElementById('bs-end').value;
  const reason = document.getElementById('bs-reason').value;

  const _bsEN = window.VELOUR_LANG === 'en';
  if (!stylist_id) { showToast(_bsEN ? 'Select a stylist' : 'اختاري الكوفيرة'); return; }
  if (!date || !start_time || !end_time) { showToast(_bsEN ? 'Date and time are required' : 'التاريخ والوقت مطلوبان'); return; }
  if (start_time >= end_time) { showToast(_bsEN ? 'Start time must be before end time' : 'وقت البداية يجب أن يكون قبل وقت النهاية'); return; }

  try {
    await Api.stylistDash.addBlockedSlot({ stylist_id: parseInt(stylist_id), date, start_time, end_time, reason });
    showToast(_bsEN ? 'Time blocked' : 'تم حجب الوقت');
    closeModalById('modal-block-slot');
    loadBlockedSlots();
  } catch (e) { showToast(e.message); }
}

async function loadBlockedSlots() {
  try {
    const blocks = await Api.stylistDash.getBlockedSlots();
    const list = document.getElementById('st-blocked-list');
    if (!list) return;
    const _blEN = window.VELOUR_LANG === 'en';
    if (!blocks.length) {
      list.innerHTML = `<div style="color:var(--gray);font-size:13px;padding:8px 0">${_blEN ? 'No blocked slots' : 'لا توجد أوقات محجوبة'}</div>`;
      return;
    }
    list.innerHTML = blocks.map(b => `
      <div class="blocked-slot-item">
        <div class="blocked-slot-info">
          <div class="blocked-slot-date">👩 ${b.stylist_name || (_blEN ? 'Stylist' : 'كوفيرة')} · 📅 ${formatDateAr(b.date)}</div>
          <div class="blocked-slot-time">🕐 ${b.start_time} – ${b.end_time}${b.reason ? ' · ' + b.reason : ''}</div>
        </div>
        <button class="blocked-slot-del" onclick="unblockSlot(${b.id})">${_blEN ? 'Unblock' : 'فتح'}</button>
      </div>
    `).join('');
  } catch (e) {}
}

async function unblockSlot(id) {
  try {
    await Api.stylistDash.deleteBlockedSlot(id);
    showToast(window.VELOUR_LANG === 'en' ? 'Time unblocked' : 'تم فتح الوقت');
    loadBlockedSlots();
  } catch (e) { showToast(e.message); }
}

function formatDateAr(d) {
  if (!d) return '';
  try {
    const locale = window.VELOUR_LANG === 'en' ? 'en-US' : 'ar-EG';
    return new Date(d + 'T12:00:00').toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return d; }
}

async function uploadTeamAvatar(stylistId, input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const res = await Api.stylistDash.uploadStylistAvatar(stylistId, file);
    const _taEN = window.VELOUR_LANG === 'en';
    if (res.avatar) {
      // update local data and re-render
      const st = stStylistData.find(s => s.id === stylistId);
      if (st) st.avatar = res.avatar;
      renderTeam();
      showToast(_taEN ? 'Photo updated ✓' : 'تم تحديث الصورة ✓');
    } else {
      showToast(res.error || (_taEN ? 'Upload failed' : 'فشل رفع الصورة'));
    }
  } catch (e) {
    showToast(window.VELOUR_LANG === 'en' ? 'Upload failed' : 'فشل رفع الصورة');
  }
  input.value = '';
}

async function uploadStylistAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const res = await Api.stylistDash.uploadAvatar(file);
    const _saEN = window.VELOUR_LANG === 'en';
    if (res.avatar) {
      currentUser.avatar = res.avatar;
      const avatarEl = document.getElementById('st-profile-avatar');
      avatarEl.innerHTML = `<img class="avatar-img" src="${res.avatar}" alt="${_saEN ? 'My photo' : 'صورتي'}">`;
      showToast(_saEN ? 'Photo updated ✓' : 'تم تحديث صورتك ✓');
    } else {
      showToast(res.error || (_saEN ? 'Upload failed' : 'فشل رفع الصورة'));
    }
  } catch (e) {
    showToast(window.VELOUR_LANG === 'en' ? 'Upload failed' : 'فشل رفع الصورة');
  }
  input.value = '';
}

// ===== PROFILE TAB =====
function loadStProfile() {
  const user = currentUser;
  if (!user) return;

  const initial = (user.name || 'م')[0].toUpperCase();
  const avatarEl = document.getElementById('st-profile-avatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img class="avatar-img" src="${user.avatar}" alt="صورتي">`;
  } else {
    avatarEl.textContent = initial;
  }
  document.getElementById('st-profile-name').textContent = user.name || '-';
  document.getElementById('st-profile-phone').textContent = user.phone || '';
  const _prEN = window.VELOUR_LANG === 'en';
  document.getElementById('st-profile-role-badge').textContent =
    user.role === 'salon_owner' ? (_prEN ? 'Salon Owner' : 'صاحبة صالون') : (_prEN ? 'Stylist' : 'كوفيرة');

  // Pre-fill edit form
  document.getElementById('st-edit-name').value = user.name || '';
  document.getElementById('st-edit-pass').value = '';

  // Hide panels
  document.getElementById('st-edit-profile-panel').classList.add('hidden');
  document.getElementById('st-stats-panel').classList.add('hidden');
}

function stShowEditProfile() {
  const panel = document.getElementById('st-edit-profile-panel');
  const statsPanel = document.getElementById('st-stats-panel');
  statsPanel.classList.add('hidden');
  panel.classList.toggle('hidden');
}

async function stShowStats() {
  const panel = document.getElementById('st-stats-panel');
  const editPanel = document.getElementById('st-edit-profile-panel');
  editPanel.classList.add('hidden');
  panel.classList.toggle('hidden');
  if (panel.classList.contains('hidden')) return;

  try {
    const bookings = await Api.stylistDash.getBookings('mine');
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const total = bookings.length;
    const revenue = bookings.filter(b => b.status === 'confirmed')
      .reduce((s, b) => s + (b.total_price || 0), 0);

    const _ssEN = window.VELOUR_LANG === 'en';
    document.getElementById('st-stats-content').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-num">${total}</div><div class="stat-label">${_ssEN ? 'Total Bookings' : 'إجمالي الحجوزات'}</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#27ae60">${confirmed}</div><div class="stat-label">${_ssEN ? 'Confirmed' : 'مؤكدة'}</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#f39c12">${pending}</div><div class="stat-label">${_ssEN ? 'Pending' : 'بانتظار'}</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#9b59b6">${revenue}₪</div><div class="stat-label">${_ssEN ? 'Total Revenue' : 'إجمالي الدخل'}</div></div>
      </div>
    `;
  } catch (e) {
    document.getElementById('st-stats-content').innerHTML = `<p style="color:#e74c3c">${window.VELOUR_LANG === 'en' ? 'Failed to load stats' : 'تعذر تحميل الإحصائيات'}</p>`;
  }
}

async function stSaveProfile() {
  const _spEN = window.VELOUR_LANG === 'en';
  const name = document.getElementById('st-edit-name').value.trim();
  const newPass = document.getElementById('st-edit-pass').value;
  if (!name) { showToast(_spEN ? 'Name is required' : 'الاسم مطلوب'); return; }

  try {
    const body = { name };
    if (newPass) body.password = newPass;
    await apiCall('PUT', '/users/profile', body);

    // Update local user cache
    const user = currentUser;
    if (user) {
      user.name = name;
      localStorage.setItem('glamora_user', JSON.stringify(user));
    }

    showToast(_spEN ? 'Changes saved' : 'تم حفظ التغييرات');
    loadStProfile();
    document.getElementById('st-edit-profile-panel').classList.add('hidden');
  } catch (e) {
    showToast('❌ ' + (e.message || 'حدث خطأ'));
  }
}


// ===== UTILS =====
function closeModalById(id) {
  document.getElementById(id).classList.add('hidden');
}

function stLogout() {
  clearAuth();
  location.reload();
}

function renderCategories() {
  if (!stSalonData) return;
  let cats = [];
  try { cats = JSON.parse(stSalonData.categories || '[]'); } catch {}
  document.querySelectorAll('#cat-chips .cat-chip').forEach(chip => {
    chip.classList.toggle('selected', cats.includes(chip.dataset.cat));
  });
}

function toggleCatChip(el) {
  el.classList.toggle('selected');
}

async function saveCategories() {
  if (!stSalonData) return;
  const selected = [...document.querySelectorAll('#cat-chips .cat-chip.selected')]
    .map(c => c.dataset.cat);
  try {
    await Api.stylistDash.setCategories(stSalonData.id, selected);
    stSalonData.categories = JSON.stringify(selected);
    showToast(window.VELOUR_LANG === 'en' ? 'Specialties saved ✓' : 'تم حفظ التخصصات ✓');
  } catch (e) {
    showToast(window.VELOUR_LANG === 'en' ? 'Save failed' : 'فشل الحفظ');
  }
}

async function loadStReviews() {
  if (!stSalonData) return;
  const el = document.getElementById('st-reviews-list');
  if (!el) return;
  try {
    const data = await Api.salons.get(stSalonData.id);
    const _rvEN = window.VELOUR_LANG === 'en';
    const ratings = data.salon_ratings || [];
    if (!ratings.length) {
      el.innerHTML = `<div style="font-size:13px;color:var(--gray);padding:8px 0">${_rvEN ? 'No reviews yet' : 'لا توجد تقييمات بعد'}</div>`;
      return;
    }
    el.innerHTML = ratings.map(r => `
      <div class="review-card" style="margin:0 0 10px">
        <div class="review-header">
          <div class="review-avatar">${(r.client_name||'؟')[0]}</div>
          <div>
            <div class="review-name">${r.client_name||(_rvEN ? 'Client' : 'زبونة')}</div>
            <div class="review-date">${new Date(r.created_at).toLocaleDateString(_rvEN ? 'en-US' : 'ar-SA')}</div>
          </div>
          <div style="margin-right:auto;color:#FFB800;font-size:14px">${'★'.repeat(r.stars)}${'☆'.repeat(5-r.stars)}</div>
        </div>
        ${r.comment ? `<div class="review-comment">${r.comment}</div>` : ''}
        ${r.reply_text
          ? `<div class="review-reply"><div class="review-reply-label">💬 ${_rvEN ? 'Your reply' : 'ردك'}</div><div class="review-reply-text">${r.reply_text}</div></div>`
          : `<div style="margin-top:8px">
              <textarea id="reply-input-${r.id}" placeholder="${_rvEN ? 'Write your reply...' : 'اكتبي ردك على هذا التقييم...'}" rows="2" class="rating-comment-input" style="font-size:13px"></textarea>
              <button class="btn-sm btn-sm-primary" style="margin-top:6px;width:100%" onclick="sendReviewReply(${r.id})">${_rvEN ? 'Send Reply' : 'إرسال الرد'}</button>
             </div>`
        }
      </div>`).join('');
  } catch (e) { el.innerHTML = `<div style="color:red;font-size:13px">${window.VELOUR_LANG === 'en' ? 'Failed to load reviews' : 'فشل تحميل التقييمات'}</div>`; }
}

async function sendReviewReply(reviewId) {
  const input = document.getElementById(`reply-input-${reviewId}`);
  const _rrEN = window.VELOUR_LANG === 'en';
  const text = input?.value?.trim();
  if (!text) { showToast(_rrEN ? 'Write your reply first' : 'اكتبي الرد أولاً'); return; }
  try {
    await Api.stylistDash.replyToReview(reviewId, text);
    showToast(_rrEN ? 'Reply sent ✓' : 'تم إرسال الرد ✓');
    loadStReviews();
  } catch (e) { showToast(_rrEN ? 'Failed to send reply' : 'فشل إرسال الرد'); }
}

// ===== 59-61: ANALYTICS =====
let analyticsData = null;
async function showAnalytics() {
  showScreen('analytics');
  if (!stSalonData?.id) return;
  try {
    analyticsData = await Api.stylistDash.analytics(stSalonData.id);
    renderAnalytics('total');
    const _anEN = window.VELOUR_LANG === 'en';
    document.getElementById('analytics-top-service').textContent =
      analyticsData.top_service ? `${analyticsData.top_service.name} (${analyticsData.top_service.count} ${_anEN ? 'times' : 'مرة'})` : (_anEN ? 'No data yet' : 'لا توجد بيانات بعد');
    document.getElementById('analytics-top-hour').textContent =
      analyticsData.busiest_hour ? `${_anEN ? 'Hour' : 'الساعة'} ${analyticsData.busiest_hour}` : (_anEN ? 'No data yet' : 'لا توجد بيانات بعد');
    document.getElementById('analytics-pending').textContent = analyticsData.bookings.pending;
    document.getElementById('analytics-confirmed').textContent = analyticsData.bookings.confirmed;
    document.getElementById('analytics-completed').textContent = analyticsData.bookings.completed;
  } catch (e) { showToast(window.VELOUR_LANG === 'en' ? 'Failed to load analytics' : 'فشل تحميل التحليلات'); }
}

function renderAnalytics(period) {
  if (!analyticsData) return;
  const map = { today: analyticsData.revenue.today, week: analyticsData.revenue.week, month: analyticsData.revenue.month, total: analyticsData.revenue.total };
  document.getElementById('analytics-revenue').textContent = `₪${(map[period] || 0).toFixed(2)}`;
}

function switchAnalyticsPeriod(period, el) {
  document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  renderAnalytics(period);
}

async function resetRevenue() {
  if (!stSalonData?.id) return;
  const _en = window.VELOUR_LANG === 'en';
  if (!confirm(_en ? 'Reset revenue to zero? Income earned so far will no longer be counted (bookings are kept).' : 'تصفير الدخل؟ الدخل المحسوب لحد هلأ ما رح ينعد بعد اليوم (الحجوزات بتضل موجودة).')) return;
  try {
    await Api.stylistDash.resetRevenue(stSalonData.id);
    showToast(_en ? '✅ Revenue reset' : '✅ تم تصفير الدخل');
    showAnalytics();
  } catch (e) { showToast(_en ? 'Failed to reset' : 'فشل التصفير'); }
}

// ===== 64: CLIENTS =====
async function showClients() {
  showScreen('clients');
  if (!stSalonData?.id) return;
  const el = document.getElementById('clients-list');
  el.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  try {
    const _clEN = window.VELOUR_LANG === 'en';
    const { clients } = await Api.stylistDash.clients(stSalonData.id);
    if (!clients.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>${_clEN ? 'No clients yet' : 'لا توجد زبونات بعد'}</p></div>`; return; }
    el.innerHTML = clients.map(c => {
      const lastB = c.bookings.sort((a, b) => b.date?.localeCompare(a.date))[0];
      const total = c.bookings.filter(b => b.status === 'completed').reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
      return `<div class="client-card">
        <div class="client-card-header">
          <span class="client-name">${c.name}</span>
          <span class="client-badge">${c.bookings.length} ${_clEN ? 'booking' : 'حجز'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="client-last-visit">${_clEN ? 'Last visit' : 'آخر زيارة'}: ${lastB?.date || '-'}</span>
          <span class="client-total">₪${total.toFixed(0)} ${_clEN ? 'total' : 'إجمالي'}</span>
        </div>
        ${c.phone ? `<div style="font-size:12px;color:var(--gray);margin-top:4px">📞 ${c.phone}</div>` : ''}
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = `<div style="color:red;padding:20px">${window.VELOUR_LANG === 'en' ? 'Loading failed' : 'فشل التحميل'}</div>`; }
}

// ===== 62: INVENTORY =====
async function loadInventory() {
  if (!stSalonData?.id) return;
  const el = document.getElementById('st-inventory-list');
  if (!el) return;
  try {
    const _invEN = window.VELOUR_LANG === 'en';
    const { items } = await Api.stylistDash.getInventory(stSalonData.id);
    if (!items.length) { el.innerHTML = `<div class="media-hint">${_invEN ? 'No products added yet' : 'لا يوجد منتجات مضافة بعد'}</div>`; return; }
    el.innerHTML = items.map(item => {
      const isLow = parseFloat(item.quantity) <= parseInt(item.low_threshold);
      return `<div class="inventory-item ${isLow ? 'low-stock' : ''}">
        <div style="flex:1">
          <div class="inv-name">${item.name}</div>
          <div class="inv-qty">${item.quantity} ${item.unit}</div>
        </div>
        ${isLow ? `<span class="inv-low-badge">${_invEN ? 'Low stock ⚠️' : 'مخزون منخفض ⚠️'}</span>` : ''}
        <div class="inv-actions">
          <button class="inv-action-btn" onclick="editInventoryItem(${JSON.stringify(item).replace(/"/g,"'")})">✏️</button>
          <button class="inv-action-btn" onclick="deleteInventoryItem(${item.id})">🗑️</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {}
}

function showAddInventory() {
  document.getElementById('inv-edit-id').value = '';
  document.getElementById('inv-name').value = '';
  document.getElementById('inv-qty').value = '';
  document.getElementById('inv-unit').value = 'قطعة';
  document.getElementById('inv-threshold').value = '2';
  document.getElementById('modal-inventory').classList.remove('hidden');
}

function editInventoryItem(item) {
  if (typeof item === 'string') { try { item = JSON.parse(item.replace(/'/g, '"')); } catch {} }
  document.getElementById('inv-edit-id').value = item.id;
  document.getElementById('inv-name').value = item.name;
  document.getElementById('inv-qty').value = item.quantity;
  document.getElementById('inv-unit').value = item.unit;
  document.getElementById('inv-threshold').value = item.low_threshold;
  document.getElementById('modal-inventory').classList.remove('hidden');
}

async function saveInventoryItem() {
  const id = document.getElementById('inv-edit-id').value;
  const _invSEN = window.VELOUR_LANG === 'en';
  const data = {
    name: document.getElementById('inv-name').value.trim(),
    quantity: document.getElementById('inv-qty').value,
    unit: document.getElementById('inv-unit').value.trim() || (_invSEN ? 'piece' : 'قطعة'),
    low_threshold: document.getElementById('inv-threshold').value
  };
  if (!data.name) { showToast(_invSEN ? 'Product name is required' : 'اسم المنتج مطلوب'); return; }
  try {
    if (id) { await Api.stylistDash.updateInventory(id, data); }
    else { await Api.stylistDash.addInventory(stSalonData.id, data); }
    document.getElementById('modal-inventory').classList.add('hidden');
    showToast(_invSEN ? 'Saved ✓' : 'تم الحفظ ✓');
    loadInventory();
  } catch (e) { showToast(_invSEN ? 'Save failed' : 'فشل الحفظ'); }
}

async function deleteInventoryItem(id) {
  const _diEN = window.VELOUR_LANG === 'en';
  if (!confirm(_diEN ? 'Delete product?' : 'حذف المنتج؟')) return;
  try {
    await Api.stylistDash.deleteInventory(id);
    showToast(_diEN ? 'Deleted ✓' : 'تم الحذف ✓');
    loadInventory();
  } catch (e) { showToast(_diEN ? 'Delete failed' : 'فشل الحذف'); }
}
