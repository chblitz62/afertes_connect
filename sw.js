// Service Worker pour AFERTES Connect
// Version améliorée avec mode hors-ligne et sync automatique
const CACHE_VERSION = 'v2';
const STATIC_CACHE = `afertes-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `afertes-dynamic-${CACHE_VERSION}`;
const OFFLINE_QUEUE_STORE = 'afertes-offline-queue';

// Ressources à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/features.css',
  '/css/accessibility.css',
  '/css/collaborative.css',
  '/js/app.js',
  '/js/data.js',
  '/manifest.json',
  '/img/logo-afertes.png',
  '/img/logo-afertes.svg',
  '/img/icons/icon-72x72.png',
  '/img/icons/icon-96x96.png',
  '/img/icons/icon-128x128.png',
  '/img/icons/icon-144x144.png',
  '/img/icons/icon-152x152.png',
  '/img/icons/icon-192x192.png',
  '/img/icons/icon-384x384.png',
  '/img/icons/icon-512x512.png'
];

// IndexedDB pour la file d'attente hors-ligne
let db = null;

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('AfertesSW', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        database.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Ajouter une action à la file d'attente hors-ligne
async function addToOfflineQueue(action) {
  if (!db) await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE);

    action.timestamp = Date.now();
    const request = store.add(action);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Récupérer toutes les actions en attente
async function getOfflineQueue() {
  if (!db) await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE], 'readonly');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Supprimer une action de la file
async function removeFromOfflineQueue(id) {
  if (!db) await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Vider la file d'attente
async function clearOfflineQueue() {
  if (!db) await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([OFFLINE_QUEUE_STORE], 'readwrite');
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Installation du Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installation du Service Worker');

  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        console.log('[SW] Mise en cache des ressources statiques');

        // Mettre en cache chaque ressource individuellement pour éviter les erreurs
        for (const asset of STATIC_ASSETS) {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[SW] Impossible de mettre en cache: ${asset}`, err);
          }
        }

        await openDatabase();
        console.log('[SW] Installation terminée');
        return self.skipWaiting();
      } catch (err) {
        console.error('[SW] Erreur lors de l\'installation:', err);
      }
    })()
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  console.log('[SW] Activation du Service Worker');

  event.waitUntil(
    (async () => {
      // Supprimer les anciens caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('afertes-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Suppression du cache obsolète:', name);
            return caches.delete(name);
          })
      );

      console.log('[SW] Activation terminée');
      return self.clients.claim();
    })()
  );
});

// Stratégie de cache améliorée
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET pour le cache
  if (request.method !== 'GET') {
    // Gérer les requêtes POST/PUT/DELETE hors-ligne
    if (!navigator.onLine && ['POST', 'PUT', 'DELETE'].includes(request.method)) {
      event.respondWith(handleOfflineRequest(request));
    }
    return;
  }

  // Ignorer les requêtes vers des domaines externes (sauf CDN autorisés)
  const allowedExternalDomains = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (url.origin !== self.location.origin && !allowedExternalDomains.some(d => url.hostname.includes(d))) {
    return;
  }

  // Stratégie selon le type de ressource
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.match(/\.(css|js|png|jpg|svg|ico|woff2?)$/)) {
    // Cache First pour les ressources statiques
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith('/api/')) {
    // Network First pour les API
    event.respondWith(networkFirst(request));
  } else {
    // Stale While Revalidate pour le reste
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Stratégie Cache First
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return getOfflineFallback(request);
  }
}

// Stratégie Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return getOfflineFallback(request);
  }
}

// Stratégie Stale While Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cached = await caches.match(request);

  const networkPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cached || networkPromise || getOfflineFallback(request);
}

// Fallback hors-ligne
async function getOfflineFallback(request) {
  const accept = request.headers.get('accept') || '';

  if (accept.includes('text/html')) {
    return caches.match('/index.html');
  }

  if (accept.includes('application/json')) {
    return new Response(JSON.stringify({
      offline: true,
      message: 'Vous êtes hors-ligne. Les données seront synchronisées au retour de la connexion.'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response('Contenu non disponible hors-ligne', {
    status: 503,
    statusText: 'Service Unavailable'
  });
}

// Gestion des requêtes hors-ligne
async function handleOfflineRequest(request) {
  const clonedRequest = request.clone();
  const body = await clonedRequest.text();

  await addToOfflineQueue({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body
  });

  // Notifier l'application
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'OFFLINE_ACTION_QUEUED',
      url: request.url,
      method: request.method
    });
  });

  return new Response(JSON.stringify({
    offline: true,
    queued: true,
    message: 'Action enregistrée. Elle sera exécutée au retour de la connexion.'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Gestion des notifications push
self.addEventListener('push', event => {
  console.log('[SW] Notification push reçue');

  let notificationData = {
    title: 'AFERTES Connect',
    body: 'Vous avez une nouvelle notification',
    icon: '/img/icons/icon-192x192.png',
    badge: '/img/icons/icon-72x72.png',
    tag: 'afertes-notification',
    requireInteraction: false,
    data: { url: '/index.html' }
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
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Synchronisation en arrière-plan
self.addEventListener('sync', event => {
  console.log('[SW] Synchronisation en arrière-plan:', event.tag);

  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

// Traiter la file d'attente hors-ligne
async function processOfflineQueue() {
  console.log('[SW] Traitement de la file d\'attente hors-ligne...');

  try {
    const queue = await getOfflineQueue();
    console.log(`[SW] ${queue.length} action(s) en attente`);

    for (const action of queue) {
      try {
        const response = await fetch(action.url, {
          method: action.method,
          headers: action.headers,
          body: action.body
        });

        if (response.ok) {
          await removeFromOfflineQueue(action.id);
          console.log(`[SW] Action synchronisée: ${action.method} ${action.url}`);
        }
      } catch (error) {
        console.error(`[SW] Échec de synchronisation pour ${action.url}:`, error);
      }
    }

    // Notifier l'application
    const clients = await self.clients.matchAll();
    const remainingQueue = await getOfflineQueue();

    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        processed: queue.length - remainingQueue.length,
        remaining: remainingQueue.length
      });
    });

  } catch (error) {
    console.error('[SW] Erreur lors du traitement de la file:', error);
  }
}

// Écouter les messages de l'application
self.addEventListener('message', event => {
  console.log('[SW] Message reçu:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_OFFLINE_QUEUE_COUNT') {
    getOfflineQueue().then(queue => {
      event.source.postMessage({
        type: 'OFFLINE_QUEUE_COUNT',
        count: queue.length
      });
    });
  }

  if (event.data.type === 'TRIGGER_SYNC') {
    processOfflineQueue();
  }
});

// Gestion des erreurs globales
self.addEventListener('error', event => {
  console.error('[SW] Erreur:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Promise rejetée:', event.reason);
});

console.log('[SW] Service Worker chargé');
