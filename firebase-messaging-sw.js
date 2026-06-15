// Firebase Messaging Service Worker
// Necessário para receber notificações push em background (app fechado ou em segundo plano)
//
// ATENÇÃO: Este arquivo deve estar na raiz do site (mesmo escopo do app).
// Para GitHub Pages: https://crv-dpp-sc.github.io/manual-crv-v2/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyB61jtxRJlDu0LhwXOM9c42MEHQWciJh-I",
  authDomain:        "crv-dpp-sc-v2.firebaseapp.com",
  projectId:         "crv-dpp-sc-v2",
  storageBucket:     "crv-dpp-sc-v2.firebasestorage.app",
  messagingSenderId: "513539683551",
  appId:             "1:513539683551:web:2fdcdd236f0c37853ae56a"
});

const messaging = firebase.messaging();

// Mensagens em background (app fechado ou minimizado)
messaging.onBackgroundMessage(function(payload) {
  const notif = payload.notification || {};
  const title  = notif.title || '🔔 CRV — Nova Notificação';
  const body   = notif.body  || 'Você tem uma nova pendência.';
  const icon   = '/manual-crv-v2/img/brasao.png';
  const badge  = '/manual-crv-v2/img/brasao.png';
  const tag    = payload.data?.tag || 'crv-notif';
  const url    = payload.data?.url || '/manual-crv-v2/painel.html';

  return self.registration.showNotification(title, {
    body,
    icon,
    badge,
    tag,
    data: { url },
    requireInteraction: true,
  });
});

// Ao clicar na notificação, abre/foca o painel
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data?.url || '/manual-crv-v2/painel.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var c of list) {
        if (c.url.includes('/manual-crv-v2/') && 'focus' in c) {
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
