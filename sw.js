// Service Worker pour AFERTES Connect
const CACHE_NAME = 'afertes-connect-v1';
const STATIC_CACHE = 'afertes-static-v1';
const DYNAMIC_CACHE = 'afertes-dynamic-v1';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/data.js',
  '/manifest.json',
  '/img/logo-afertes.svg',
  '/img/icons/icon-192x192.png',
  '/img/icons/icon-512x512.png'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installation du Service Worker');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Mise en cache des ressources statiques');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation terminée');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] Erreur lors de l\'installation:', err);
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activation du Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE;
            })
            .map(cacheName => {
              console.log('[SW] Suppression du cache obsolète:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation terminée');
        return self.clients.claim();
      })
  );
});

// Stratégie de cache : Cache First, Network Fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignorer les requêtes externes (API, CDN, etc.)
  if (!url.origin.includes(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Ressource trouvée dans le cache
          console.log('[SW] Ressource servie depuis le cache:', request.url);
          
          // Mise à jour en arrière-plan (stale-while-revalidate)
          fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(DYNAMIC_CACHE)
                  .then(cache => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }
        
        // Ressource non trouvée dans le cache, récupération réseau
        return fetch(request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            
            // Mise en cache de la nouvelle ressource
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.error('[SW] Erreur réseau:', error);
            
            // Page hors-ligne de secours pour les documents HTML
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            return new Response('Contenu non disponible hors-ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
      })
  );
});

// Gestion des notifications push
self.addEventListener('push', event => {
  console.log('[SW] Notification push reçue');
  
  let notificationData = {
    title: 'AFERTES Connect',
    body: 'Vous avez une nouvelle notification',
    icon: '/img/icons/icon-192x192.png',
    badge: '/img/icons/badge-72x72.png',
    tag: 'afertes-notification',
    requireInteraction: false,
    data: {
      url: '/index.html'
    }
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data
    })
  );
});

// Clic sur une notification
self.addEventListener('notificationclick', event => {
  console.log('[SW] Clic sur notification');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/index.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Chercher si une fenêtre est déjà ouverte
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Sinon, ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
  console.log('[SW] Synchronisation en arrière-plan:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

// Fonction de synchronisation des messages
async function syncMessages() {
  console.log('[SW] Synchronisation des messages...');
  // À implémenter avec le backend
}

// Fonction de synchronisation des données
async function syncData() {
  console.log('[SW] Synchronisation des données...');
  // À implémenter avec le backend
}

// Gestion des erreurs globales
self.addEventListener('error', event => {
  console.error('[SW] Erreur:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Promise rejetée:', event.reason);
});

console.log('[SW] Service Worker chargé');
