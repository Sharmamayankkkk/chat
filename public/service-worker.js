
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const chatId = event.notification.data?.chatId;
  if (chatId) {
    const urlToOpen = new URL(`/chat/${chatId}`, self.location.origin).href;

    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((clientList) => {
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
            }
          }
          return client.focus().then(c => c.navigate(urlToOpen));
        }
        return clients.openWindow(urlToOpen);
      })
    );
  }
});
