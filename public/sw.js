// Service worker de Dachsi (web): muestra las notificaciones que llegan por Web Push.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Dachsi', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      lang: 'es',
    }),
  );
});

// Al tocar la notificación, abrir (o enfocar) Dachsi.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => 'focus' in c);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
