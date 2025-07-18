
self.addEventListener('push', event => {
  const data = event.data.json();
  const title = data.title || 'New Message';
  const options = {
    body: data.body,
    icon: data.icon || '/logo/light_KCS.png',
    badge: '/logo/light_KCS.png',
    tag: data.tag,
    data: data.data,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  const chatId = event.notification.data?.chatId;
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const urlToOpen = new URL(chatId ? `/chat/${chatId}` : '/', self.location.origin).href;

      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
