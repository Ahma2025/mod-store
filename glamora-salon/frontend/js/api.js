const BASE = (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform())
  ? 'https://glamora-salon-production.up.railway.app'
  : (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://glamora-salon-production.up.railway.app');
const API = BASE + '/api';

function mediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return BASE + url;
}
let authToken = localStorage.getItem('glamora_token');
let currentUser = JSON.parse(localStorage.getItem('glamora_user') || 'null');
let socket = null;

function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('glamora_token', token);
  localStorage.setItem('glamora_user', JSON.stringify(user));
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('glamora_token');
  localStorage.removeItem('glamora_user');
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  renderedMsgIds.clear();
}

async function apiCall(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const url = API + path;
  let res;
  try {
    res = await fetch(url, opts);
  } catch (fetchErr) {
    throw new Error(`[${method} ${url}] ${fetchErr.message}`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'حدث خطأ ما');
  return data;
}

const Api = {
  auth: {
    login: (phone, password) => apiCall('POST', '/auth/login', { phone, password }),
    register: (data) => apiCall('POST', '/auth/register', data),
    me: () => apiCall('GET', '/auth/me'),
  },
  salons: {
    list: (params = {}) => apiCall('GET', '/salons?' + new URLSearchParams(params)),
    get: (id) => apiCall('GET', `/salons/${id}`),
    services: (id, category) => apiCall('GET', `/salons/${id}/services${category ? '?category=' + category : ''}`),
    media: (id) => apiCall('GET', `/media/salon/${id}/media`),
    rate: (id, stars, comment = '', cleanliness_rating = null, punctuality_rating = null, result_rating = null, before_photo = null, after_photo = null) =>
      apiCall('POST', `/salons/${id}/rate`, { stars, comment, cleanliness_rating, punctuality_rating, result_rating, before_photo, after_photo }),
    myRating: (id) => apiCall('GET', `/salons/${id}/my-rating`),
    updateLocation: (id, latitude, longitude) => apiCall('PUT', `/salons/${id}/location`, { latitude, longitude }),
    allLocations: () => apiCall('GET', '/salons/all-locations'),
  },
  bookings: {
    my: () => apiCall('GET', '/bookings/my'),
    stylist: (date) => apiCall('GET', `/bookings/stylist${date ? '?date=' + date : ''}`),
    slots: (stylist_id, date, service_id, total_duration) => apiCall('GET', `/bookings/available-slots?stylist_id=${stylist_id}&date=${date}${service_id ? '&service_id=' + service_id : ''}${total_duration ? '&total_duration=' + total_duration : ''}`),
    create: (data) => apiCall('POST', '/bookings', data),
    updateStatus: (id, status) => apiCall('PUT', `/bookings/${id}/status`, { status }),
    review: (id, rating, comment) => apiCall('POST', `/bookings/${id}/review`, { rating, comment }),
  },
  messages: {
    conversations: () => apiCall('GET', '/messages/conversations'),
    get: (otherId) => apiCall('GET', `/messages/${otherId}`),
    send: (receiver_id, content, booking_id, msg_type = 'text', media_url = null) =>
      apiCall('POST', '/messages', { receiver_id, content, booking_id, msg_type, media_url }),
    markSeen: (senderId) => apiCall('POST', `/messages/seen/${senderId}`),
    uploadChatFile: (file) => {
      const fd = new FormData(); fd.append('file', file);
      return fetch(`${API}/media/chat/upload`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd }).then(r => r.json());
    },
  },
  stylists: {
    get: (id) => apiCall('GET', `/stylists/${id}`),
    colorHistory: () => apiCall('GET', '/stylists/me/color-history'),
  },
  users: {
    loyalty: () => apiCall('GET', '/users/loyalty'),
    notifications: () => apiCall('GET', '/users/notifications'),
    markNotifsRead: () => apiCall('PUT', '/users/notifications/read'),
    colorHistory: () => apiCall('GET', '/users/color-history'),
  },
  beauty: {
    getProfile: () => apiCall('GET', '/beauty/profile'),
    updateProfile: (data) => apiCall('PUT', '/beauty/profile', data),
    recommendations: () => apiCall('GET', '/beauty/recommendations'),
    youMightLike: () => apiCall('GET', '/beauty/you-might-like'),
    aiHairstyle: (image_base64, face_shape) => apiCall('POST', '/beauty/ai-hairstyle', { image_base64, face_shape }),
    scheduleReminder: (weeks) => apiCall('POST', '/beauty/schedule-reminder', { weeks }),
  },
  stylistDash: {
    mySalon: () => apiCall('GET', '/stylist/my-salon'),
    createSalon: (data) => apiCall('POST', '/stylist/salon', data),
    updateSalon: (id, data) => apiCall('PUT', `/stylist/salon/${id}`, data),
    setHours: (id, hours) => apiCall('POST', `/stylist/salon/${id}/hours`, { hours }),
    setCategories: (id, categories) => apiCall('PUT', `/stylist/salon/${id}/categories`, { categories }),
    replyToReview: (reviewId, reply_text) => apiCall('POST', `/stylist/reviews/${reviewId}/reply`, { reply_text }),
    myReviews: (salonId) => apiCall('GET', `/salons/${salonId}?reviews_only=1`),
    uploadReviewPhoto: (file) => {
      const fd = new FormData(); fd.append('file', file);
      return fetch(`${API}/media/review/photo`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd }).then(r => r.json());
    },
    addService: (id, data) => apiCall('POST', `/stylist/salon/${id}/services`, data),
    editService: (id, data) => apiCall('PUT', `/stylist/services/${id}`, data),
    deleteService: (id) => apiCall('DELETE', `/stylist/services/${id}`),
    addStylist: (id, data) => apiCall('POST', `/stylist/salon/${id}/stylists`, data),
    setAvailability: (stylistId, availability) => apiCall('POST', `/stylist/stylist/${stylistId}/availability`, { availability }),
    bookings: (filter) => apiCall('GET', `/stylist/bookings?filter=${filter || 'all'}`),
    getBookings: (filter) => apiCall('GET', `/stylist/bookings?filter=${filter || 'all'}`),
    uploadMedia: (salonId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return fetch(`${API}/media/salon/${salonId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd }).then(r => r.json());
    },
    uploadAvatar: (file) => {
      const fd = new FormData(); fd.append('file', file);
      return fetch(`${API}/media/stylist/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd }).then(r => r.json());
    },
    uploadStylistAvatar: (stylistId, file) => {
      const fd = new FormData(); fd.append('file', file);
      return fetch(`${API}/media/stylist/${stylistId}/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` }, body: fd }).then(r => r.json());
    },
    setCover: (mediaId) => apiCall('PUT', `/media/media/${mediaId}/cover`),
    deleteMedia: (mediaId) => apiCall('DELETE', `/media/media/${mediaId}`),
    getSalonMedia: (salonId) => apiCall('GET', `/media/salon/${salonId}/media`),
    getOffers: (salonId) => apiCall('GET', `/stylist/salon/${salonId}/offers`),
    addOffer: (salonId, data) => apiCall('POST', `/stylist/salon/${salonId}/offers`, data),
    deleteOffer: (id) => apiCall('DELETE', `/stylist/offers/${id}`),
    getBlockedSlots: () => apiCall('GET', '/blocked-slots'),
    addBlockedSlot: (data) => apiCall('POST', '/blocked-slots', data),
    deleteBlockedSlot: (id) => apiCall('DELETE', `/blocked-slots/${id}`),
    updateBooking: (id, status) => apiCall('PUT', `/bookings/${id}/status`, { status }),
    analytics: (salonId) => apiCall('GET', `/stylist/salon/${salonId}/analytics`),
    clients: (salonId) => apiCall('GET', `/stylist/salon/${salonId}/clients`),
    getInventory: (salonId) => apiCall('GET', `/stylist/salon/${salonId}/inventory`),
    addInventory: (salonId, data) => apiCall('POST', `/stylist/salon/${salonId}/inventory`, data),
    updateInventory: (id, data) => apiCall('PUT', `/stylist/inventory/${id}`, data),
    deleteInventory: (id) => apiCall('DELETE', `/stylist/inventory/${id}`),
  },
};

// Track message IDs already shown in chat to prevent duplicates
const renderedMsgIds = new Set();

function initSocket() {
  if (!authToken || socket) return;
  socket = io(BASE, { auth: { token: authToken } });

  // Server confirms our sent message — register its real DB id so new_message echo is ignored
  socket.on('message_sent', (msg) => {
    if (msg.id) renderedMsgIds.add(msg.id);
  });

  socket.on('new_message', (msg) => {
    // Skip if we already rendered this message (own message echo or duplicate)
    if (msg.id && renderedMsgIds.has(msg.id)) return;
    if (msg.id) renderedMsgIds.add(msg.id);

    const isMyMsg = msg.sender_id === currentUser?.id;
    if (isMyMsg) return;
    const chatActive = document.getElementById('screen-chat-conv')?.classList.contains('active');
    if (chatActive) {
      appendChatMessage(msg, false);
    } else {
      incrementChatBadge();
      showToast('💬 رسالة جديدة من ' + (msg.sender_name || ''), 4000);
    }
  });

  socket.on('new_notif', (data) => {
    // Increment notification bell badge
    incrementNotifBadge();
    if (data.type === 'message') {
      // also handled by new_message event
    }
  });

  socket.on('user_typing', () => {
    document.getElementById('typing-indicator')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('typing-indicator')?.classList.add('hidden'), 2000);
  });

  socket.on('messages_seen', () => {
    document.querySelectorAll('.msg-seen').forEach(el => { el.textContent = '✓✓'; el.classList.add('seen'); });
  });
}

function incrementNotifBadge() {
  const badge = document.getElementById('notif-badge') || document.getElementById('st-notif-badge');
  if (!badge) return;
  const cur = parseInt(badge.textContent) || 0;
  badge.textContent = cur + 1;
  badge.classList.remove('hidden');
}

function incrementChatBadge() {
  // Client nav chat badge
  const badge = document.getElementById('chat-badge');
  if (badge) {
    const cur = parseInt(badge.textContent) || 0;
    badge.textContent = cur + 1;
    badge.classList.remove('hidden');
  }
  // Stylist nav chat badge
  const stBadge = document.getElementById('st-chat-badge');
  if (stBadge) {
    const cur = parseInt(stBadge.textContent) || 0;
    stBadge.textContent = cur + 1;
    stBadge.classList.remove('hidden');
  }
}
