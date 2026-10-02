const CACHE = 'content-v1';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('push', e => {
  let data = { title: 'Content Manager', body: 'New notification' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png', data: data.data }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  // Payloads may carry data.url (e.g. the posting nudge deep-links to /pipeline); default to home.
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.openWindow(url));
});
