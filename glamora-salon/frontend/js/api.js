const API = (window.location.hostname === 'localhost' ? 'http://localhost:3000' : '') + '/api';
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
}

async function apiCall(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
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
  },
  bookings: {
    my: () => apiCall('GET', '/bookings/my'),
    stylist: (date) => apiCall('GET', `/bookings/stylist${date ? '?date=' + date : ''}`),
    slots: (stylist_id, date, service_id) => apiCall('GET', `/bookings/available-slots?stylist_id=${stylist_id}&date=${date}&service_id=${service_id}`),
    create: (data) => apiCall('POST', '/bookings', data),
    updateStatus: (id, status) => apiCall('PUT', `/bookings/${id}/status`, { status }),
    review: (id, rating, comment) => apiCall('POST', `/bookings/${id}/review`, { rating, comment }),
  },
  messages: {
    conversations: () => apiCall('GET', '/messages/conversations'),
    get: (otherId) => apiCall('GET', `/messages/${otherId}`),
    send: (receiver_id, content, booking_id) => apiCall('POST', '/messages', { receiver_id, content, booking_id }),
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
};

function initSocket() {
  if (!authToken || socket) return;
  socket = io('http://localhost:3000', { auth: { token: authToken } });
  socket.on('new_message', (msg) => {
    if (currentChatUserId && msg.sender_id == currentChatUserId) {
      appendChatMessage(msg, false);
    }
    showToast('💬 رسالة جديدة من ' + msg.sender_name);
  });
  socket.on('user_typing', () => {
    document.getElementById('typing-indicator')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('typing-indicator')?.classList.add('hidden'), 2000);
  });
}
