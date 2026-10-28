'use strict';

// Service worker of the admin panel: shows the pushes the server sends and
// opens the right tab when one is tapped. It caches nothing: the panel
// always runs the latest code.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Better Deen Admin', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Better Deen Admin', {
      body: data.body || '',
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'admin',
      renotify: true,
      data: { tab: data.tab || 'overview' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tab = (event.notification.data && event.notification.data.tab) || 'overview';
  const target = new URL('./#' + tab, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          client.postMessage({ tab });
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
