// Service Worker para RatixPay
// Versão dinâmica baseada em timestamp para auto-atualização
// Data: 2024-12-25

// Versão dinâmica - será atualizada automaticamente
const SW_VERSION = '1.0.2';
const BUILD_TIMESTAMP = Date.now(); // Timestamp para forçar atualização

const CACHE_NAME = `ratixpay-v${SW_VERSION}-${BUILD_TIMESTAMP}`;
const STATIC_CACHE = `ratixpay-static-v${SW_VERSION}-${BUILD_TIMESTAMP}`;
const DYNAMIC_CACHE = `ratixpay-dynamic-v${SW_VERSION}-${BUILD_TIMESTAMP}`;

// Flag para desenvolvimento (desabilitar cache agressivo)
const IS_DEVELOPMENT = self.location.hostname === 'localhost' || 
                       self.location.hostname === '127.0.0.1' ||
                       self.location.port !== '';

// Recursos críticos para cache (apenas os essenciais)
const CRITICAL_RESOURCES = [
  '/',
  '/css/style.css',
  '/js/server-check.js',
  '/js/config.js',
  '/favicon.ico'
];

// Recursos da API que devem ser cacheados
const API_CACHE_PATTERNS = [
  '/api/produtos/',
  '/api/auth/me',
  '/api/health'
];

// Instalar Service Worker
self.addEventListener('install', event => {
  console.log(`🔧 Service Worker instalando v${SW_VERSION}...`);
  
  // Em desenvolvimento, limpar cache imediatamente
  if (IS_DEVELOPMENT) {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('🗑️ [DEV] Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('✅ [DEV] Cache limpo - instalando nova versão');
        return self.skipWaiting();
      })
    );
    return;
  }
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Cacheando recursos críticos...');
        return cacheResourcesIndividually(cache, CRITICAL_RESOURCES);
      })
      .then(() => {
        console.log('✅ Service Worker instalado com sucesso');
        return self.skipWaiting(); // Ativar imediatamente
      })
      .catch(error => {
        console.error('❌ Erro ao instalar Service Worker:', error);
        return self.skipWaiting();
      })
  );
});

// Função para adicionar recursos individualmente
async function cacheResourcesIndividually(cache, resources) {
  const results = [];
  
  for (const resource of resources) {
    try {
      const response = await fetch(resource, {
        cache: IS_DEVELOPMENT ? 'no-cache' : 'default'
      });
      if (response.ok) {
        await cache.put(resource, response);
        results.push({ resource, status: 'success' });
      } else {
        results.push({ resource, status: 'not_found', statusCode: response.status });
      }
    } catch (error) {
      results.push({ resource, status: 'error', error: error.message });
    }
  }
  
  return results;
}

// Ativar Service Worker
self.addEventListener('activate', event => {
  console.log(`🚀 Service Worker ativando v${SW_VERSION}...`);
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        // Remover TODOS os caches antigos (que não correspondem à versão atual)
        const cachesToDelete = cacheNames.filter(cacheName => {
          return !cacheName.includes(`v${SW_VERSION}-${BUILD_TIMESTAMP}`);
        });
        
        console.log(`🗑️ Removendo ${cachesToDelete.length} cache(s) antigo(s):`, cachesToDelete);
        
        return Promise.all(
          cachesToDelete.map(cacheName => {
            console.log('🗑️ Removendo cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker ativado - Cache limpo');
        // Notificar todos os clientes para recarregar
        return self.clients.claim().then(() => {
          // Enviar mensagem para todos os clientes recarregarem
          return self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SW_UPDATED',
                version: SW_VERSION,
                timestamp: BUILD_TIMESTAMP
              });
            });
          });
        });
      })
  );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorar requisições que não são HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Em desenvolvimento, sempre buscar da rede (sem cache)
  if (IS_DEVELOPMENT) {
    // Para HTML, CSS e JS, sempre buscar da rede
    if (url.pathname.match(/\.(html|css|js)$/) || url.pathname === '/') {
      event.respondWith(
        fetch(request, {
          cache: 'no-store'
        }).catch(() => {
          // Fallback para cache apenas se rede falhar
          return caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se não houver cache, retornar Response vazia
            return new Response('', { status: 404 });
          });
        })
      );
      return;
    }
  }
  
  // Ignorar requisições de imagens da API
  if (url.pathname.includes('/api/produtos/imagem/')) {
    return;
  }
  
  // Ignorar URLs externas (CDNs, fontes, etc)
  if (url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    return;
  }
  
  // Páginas que NUNCA devem ser cacheadas (sempre da rede)
  if (isNoCachePage(request)) {
    event.respondWith(networkOnly(request));
    return;
  }
  
  // Estratégia para diferentes tipos de recursos
  if (isApiRequest(request)) {
    event.respondWith(networkFirst(request));
  } else if (isStaticResource(request)) {
    // Em desenvolvimento, usar network-first para recursos estáticos
    if (IS_DEVELOPMENT) {
      event.respondWith(networkFirst(request));
    } else {
      event.respondWith(cacheFirst(request));
    }
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirstWithNetworkFallback(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// Estratégia cache-first com fallback para imagens
async function cacheFirstWithNetworkFallback(request) {
  if (IS_DEVELOPMENT) {
    // Em desenvolvimento, sempre buscar da rede
    return fetch(request, { cache: 'no-store' }).catch(() => {
      return caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Retornar Response vazia se não houver cache
        return new Response('', { status: 404 });
      });
    });
  }
  
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    // Verificar se cache está atualizado (max 1 hora)
    const cacheDate = cached.headers.get('date');
    if (cacheDate) {
      const age = Date.now() - new Date(cacheDate).getTime();
      if (age < 3600000) { // 1 hora
        return cached;
      }
    } else {
      return cached;
    }
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (cached) return cached;
    return new Response('', { status: 404 });
  }
}

// Verificar se é recurso estático
function isStaticResource(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/);
}

// Verificar se é requisição da API
function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') || url.pathname.includes('/api/');
}

// Verificar se é imagem
function isImageRequest(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp)$/);
}

// Verificar se é página que NÃO deve ser cacheada
function isNoCachePage(request) {
  const url = new URL(request.url);
  const noCachePages = [
    '/checkout.html',
    '/payment-success.html',
    '/login.html',
    '/register.html',
    '/admin',
    '/api/'
  ];
  
  return noCachePages.some(page => url.pathname.includes(page)) ||
         request.destination === 'document' && 
         (url.pathname.includes('checkout') || url.pathname.includes('payment-success'));
}

// Estratégia Network Only (sempre da rede, sem cache)
async function networkOnly(request) {
  try {
    const url = new URL(request.url);
    // Não adicionar headers customizados para requisições externas (evita CORS)
    const isExternal = !url.hostname.includes(self.location.hostname) && 
                       url.hostname !== 'localhost' && 
                       url.hostname !== '127.0.0.1';
    
    if (isExternal) {
      return await fetch(request, { cache: 'no-store' });
    }
    
    return await fetch(request, {
      cache: 'no-store'
    });
  } catch (error) {
    return new Response('Página não disponível offline', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estratégia: Cache First (para recursos estáticos)
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Recurso não disponível', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Estratégia: Network First (para APIs e conteúdo dinâmico)
async function networkFirst(request) {
  try {
    const url = new URL(request.url);
    // Não adicionar headers customizados para requisições externas (evita CORS)
    const isExternal = !url.hostname.includes(self.location.hostname) && 
                       url.hostname !== 'localhost' && 
                       url.hostname !== '127.0.0.1';
    
    const networkResponse = await fetch(request, {
      cache: IS_DEVELOPMENT ? 'no-store' : 'default'
    });
    
    if (networkResponse.ok && request.method === 'GET' && !IS_DEVELOPMENT) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    if (request.destination === 'document') {
      const offlineResponse = await caches.match('/offline.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    return new Response(JSON.stringify({
      error: 'Conteúdo não disponível offline',
      message: 'Verifique sua conexão com a internet'
    }), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Background Sync
self.addEventListener('sync', event => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'payment-sync') {
    event.waitUntil(syncPayments());
  } else if (event.tag === 'data-sync') {
    event.waitUntil(syncData());
  }
});

async function syncPayments() {
  try {
    console.log('💳 Sincronizando pagamentos offline...');
    const pendingPayments = await getPendingPayments();
    
    for (const payment of pendingPayments) {
      try {
        await fetch('/api/payments/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payment)
        });
        await removePendingPayment(payment.id);
      } catch (error) {
        console.error('Erro ao sincronizar pagamento:', error);
      }
    }
  } catch (error) {
    console.error('Erro na sincronização de pagamentos:', error);
  }
}

async function syncData() {
  try {
    console.log('📊 Sincronizando dados offline...');
  } catch (error) {
    console.error('Erro na sincronização de dados:', error);
  }
}

// IndexedDB Manager
class PushNotificationDB {
  constructor() {
    this.dbName = 'RatixPayPushDB';
    this.dbVersion = 1;
    this.storeName = 'notifications';
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('read', 'read', { unique: false });
          objectStore.createIndex('tag', 'tag', { unique: false });
        }
      };
    });
  }

  async saveNotification(notification) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const notificationData = {
        id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        url: notification.url || notification.data?.url,
        data: notification.data || {},
        timestamp: notification.timestamp || Date.now(),
        read: false,
        createdAt: new Date().toISOString()
      };

      const request = store.add(notificationData);
      request.onsuccess = () => resolve(notificationData);
      request.onerror = () => reject(request.error);
    });
  }
}

let pushNotificationDB = null;
try {
  pushNotificationDB = new PushNotificationDB();
  pushNotificationDB.init().then(() => {
    console.log('✅ IndexedDB inicializado no Service Worker');
  }).catch(err => {
    console.warn('⚠️ Erro ao inicializar IndexedDB:', err);
  });
} catch (error) {
  console.warn('⚠️ Erro ao criar PushNotificationDB:', error);
}

// Push Notifications
self.addEventListener('push', event => {
  console.log('🔔 Push notification recebida');
  
  let notificationData = {
    title: 'RatixPay',
    body: 'Nova notificação',
    icon: '/assets/images/icons/push-icon-192x192.png',
    badge: '/assets/images/icons/push-icon-48x48.png',
    data: {
      url: '/dashboard.html',
      timestamp: Date.now()
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'RatixPay',
        body: data.body || data.message || 'Nova notificação',
        icon: data.icon || '/assets/images/icons/push-icon-192x192.png',
        badge: '/assets/images/icons/push-icon-48x48.png',
        tag: data.tag || 'ratixpay-notification',
        requireInteraction: data.requireInteraction || false,
        vibrate: data.vibrate || [200, 100, 200, 100, 200],
        sound: data.sound || '/assets/sounds/alert.mp3',
        data: {
          url: data.url || data.data?.url || '/gestao-vendas.html',
          timestamp: Date.now(),
          ...data.data
        }
      };
    } catch (error) {
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    vibrate: notificationData.vibrate || [200, 100, 200, 100, 200],
    sound: notificationData.sound || '/assets/sounds/alert.mp3',
    data: notificationData.data,
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/assets/images/icons/icon-48x48.png'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  };
  
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationData.title, options),
      pushNotificationDB ? pushNotificationDB.saveNotification(notificationData) : Promise.resolve()
    ])
  );
});

// Clique em notificação
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notificação clicada:', event.action);
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/dashboard.html';
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

async function getPendingPayments() {
  return [];
}

async function removePendingPayment(id) {
  // Implementar remoção de pagamento pendente
}

// Mensagens do cliente
self.addEventListener('message', event => {
  console.log('📨 Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'CACHE_CLEARED' });
          });
        });
      })
    );
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urlsToCache = event.data.urls;
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then(cache => cache.addAll(urlsToCache))
    );
  }
});

console.log(`🎯 Service Worker carregado - RatixPay v${SW_VERSION} [${IS_DEVELOPMENT ? 'DEV' : 'PROD'}]`);
