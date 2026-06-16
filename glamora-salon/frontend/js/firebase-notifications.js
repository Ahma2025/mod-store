// Glamora - Firebase Cloud Messaging (FCM) - Push Notifications
// Works for Web PWA, Android (Capacitor), and iOS (Capacitor)

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDvc2pdQUtcQcNgq1tR4UshTNqEGfH7C38",
  authDomain: "glamora-salon-app.firebaseapp.com",
  projectId: "glamora-salon-app",
  storageBucket: "glamora-salon-app.firebasestorage.app",
  messagingSenderId: "522325560123",
  appId: "1:522325560123:android:166ad7d618c4f24076851e"
};

const VAPID_KEY = "BF6qEhfWlrvgJWK2hDzSeuGV18uZMIL1heQEQLkdyM1FpiL6I_OjDGEfAAaKMYTJMx9B-ZlPq-v1gLbvKxiIA54";

let messaging = null;
let fcmToken = null;

async function initFirebaseNotifications() {
  try {
    // Native platform (Android/iOS via Capacitor) - no Firebase JS SDK needed
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      // Always try to claim cached token for current user on every login
      const cached = localStorage.getItem('glamora_fcm_token');
      if (cached) {
        fcmToken = cached;
        await saveFCMToken(cached, Capacitor.getPlatform());
      }
      await initNativeNotifications();
      return;
    }

    // Web PWA - needs Firebase JS SDK
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    await initWebNotifications();
  } catch (e) {
    console.warn('Firebase notifications init failed:', e.message);
  }
}

// ===== WEB (PWA) NOTIFICATIONS =====
async function initWebNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.register('/firebase-sw.js');
    messaging = firebase.messaging();
    messaging.useServiceWorker(reg);

    fcmToken = await messaging.getToken({ vapidKey: VAPID_KEY });
    if (fcmToken) {
      await saveFCMToken(fcmToken);
    }

    messaging.onMessage((payload) => {
      showInAppNotification(payload.notification?.title, payload.notification?.body, payload.data?.type);
    });
  } catch (e) {
    console.warn('Web notifications failed:', e.message);
  }
}

// ===== NATIVE (Android + iOS via Capacitor) =====
async function initNativeNotifications() {
  try {
    const PushNotifications = Capacitor.Plugins.PushNotifications;
    if (!PushNotifications) {
      console.warn('PushNotifications plugin not available');
      return;
    }

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    // Set up onNativeFCMToken FIRST before anything else
    // AppDelegate will call this when Firebase gives us a real FCM token
    window.onNativeFCMToken = async (token) => {
      if (!token || token === fcmToken) return;
      fcmToken = token;
      localStorage.setItem('glamora_fcm_token', token);
      await saveFCMToken(token, 'ios');
      console.log('FCM token from AppDelegate:', token.substring(0, 20));
    };

    // Also check if AppDelegate already injected the token (early injection)
    if (window.__nativeFCMToken) {
      window.onNativeFCMToken(window.__nativeFCMToken);
    }

    PushNotifications.addListener('registration', async (token) => {
      const platform = Capacitor.getPlatform();

      if (platform === 'ios') {
        // On iOS wait up to 15 seconds for Firebase to inject real FCM token
        // AppDelegate retries injection at 1s, 3s, 6s, 10s, 15s
        const fcmFromFirebase = await waitForIOSFCMToken(15000);
        if (fcmFromFirebase) {
          fcmToken = fcmFromFirebase;
        } else {
          // Save APNs token as fallback - onNativeFCMToken will update it later
          fcmToken = token.value;
        }
      } else {
        fcmToken = token.value;
      }

      localStorage.setItem('glamora_fcm_token', fcmToken);
      console.log('Token saved, platform:', platform, 'prefix:', fcmToken.substring(0, 20));
      await saveFCMToken(fcmToken, platform);
    });

    PushNotifications.addListener('registrationError', async (err) => {
      console.error('FCM registration error:', JSON.stringify(err));
      const cached = localStorage.getItem('glamora_fcm_token');
      if (cached) {
        fcmToken = cached;
        await saveFCMToken(cached, Capacitor.getPlatform());
      } else {
        setTimeout(async () => {
          try { await PushNotifications.register(); } catch(e) {}
        }, 5000);
      }
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      showInAppNotification(notification.title, notification.body, notification.data?.type);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handleNotificationAction(action.notification.data);
    });

    await PushNotifications.register();

    setTimeout(async () => {
      if (fcmToken) await saveFCMToken(fcmToken, Capacitor.getPlatform());
    }, 500);

  } catch (e) {
    console.warn('Native notifications failed:', e.message);
  }
}

// Wait for iOS Firebase SDK to inject FCM token via AppDelegate
function waitForIOSFCMToken(timeoutMs) {
  return new Promise((resolve) => {
    if (window.__nativeFCMToken) {
      resolve(window.__nativeFCMToken);
      return;
    }
    const start = Date.now();
    const check = setInterval(() => {
      if (window.__nativeFCMToken) {
        clearInterval(check);
        resolve(window.__nativeFCMToken);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(check);
        resolve(null); // fall back to APNs token
      }
    }, 100);
  });
}

// ===== SAVE TOKEN TO BACKEND =====
async function saveFCMToken(token, platform = 'web') {
  try {
    const stored = localStorage.getItem('glamora_token');
    if (!stored) return;
    // Use BASE from api.js if available, otherwise auto-detect
    const base = (typeof BASE !== 'undefined') ? BASE : (window.location.hostname === 'localhost' ? 'http://localhost:3000' : `http://${window.location.hostname}:3000`);
    await fetch(base + '/api/users/fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stored}` },
      body: JSON.stringify({ token, platform })
    });
    console.log('FCM token saved to backend, platform:', platform);
  } catch (e) {
    console.warn('saveFCMToken failed:', e.message);
  }
}

// ===== IN-APP NOTIFICATION BANNER =====
function showInAppNotification(title, body, type = '') {
  const banner = document.createElement('div');
  banner.className = 'fcm-banner';
  banner.innerHTML = `
    <div class="fcm-icon">${getNotifIcon(type)}</div>
    <div class="fcm-text">
      <div class="fcm-title">${title || ''}</div>
      <div class="fcm-body">${body || ''}</div>
    </div>
    <button class="fcm-close" onclick="this.parentElement.remove()">×</button>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner?.remove(), 5000);

  if (window.currentUser) {
    loadNotifBadge?.();
  }
}

function getNotifIcon(type) {
  const icons = { booking: '📅', reminder: '⏰', loyalty: '⭐', message: '💬', promo: '🎁' };
  return icons[type] || '🔔';
}

function handleNotificationAction(data) {
  if (!data) return;
  if (data.type === 'booking') switchTab('bookings', null);
  else if (data.type === 'message') switchTab('chat', null);
  else if (data.type === 'loyalty') switchTab('profile', null);
}

// ===== SEND NOTIFICATION FROM BACKEND (helper) =====
// هذي بتشتغل من السيرفر مش من الفرونت اند
const FCM_UTILS = {
  bookingConfirmed: (userName, serviceName, date, time) => ({
    title: `تم تأكيد حجزك ✅`,
    body: `${serviceName} · ${date} · ${time}`,
    type: 'booking'
  }),
  bookingReminder: (serviceName, time) => ({
    title: `موعدك اليوم ⏰`,
    body: `${serviceName} الساعة ${time} - لا تنسي!`,
    type: 'reminder'
  }),
  newMessage: (senderName) => ({
    title: `رسالة جديدة 💬`,
    body: `${senderName} أرسلت لك رسالة`,
    type: 'message'
  }),
  loyaltyPoints: (points) => ({
    title: `كسبتِ نقاط 🌟`,
    body: `+${points} نقطة أضيفت لرصيدك`,
    type: 'loyalty'
  }),
  promoOffer: (salonName, discount) => ({
    title: `عرض خاص لك 🎁`,
    body: `${salonName} تقدم خصم ${discount}% - اليوم فقط!`,
    type: 'promo'
  })
};
