/**
 * RatixPay PWA Service Worker
 * Versão: 2.0.0
 * Funcionalidades: Cache strategies, offline support, push notifications, background sync
 */

const CACHE_NAME = 'ratixpay-pwa-v2.0.0';
const STATIC_CACHE = 'ratixpay-static-v2.0.0';
const DYNAMIC_CACHE = 'ratixpay-dynamic-v2.0.0';
const API_CACHE = 'ratixpay-api-v2.0.0';

// Recursos estáticos para cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/login.html',
    '/gestao-produtos.html',
    '/integracoes.html',
    '/gestao-vendas.html',
    '/marketing-avancado.html',
    '/css/style.css',
    '/css/integracoes.css',
    '/js/server-check.js',
    '/js/global-auth.js',
    '/js/config.js',
    '/js/sidebar-component.js',
    '/js/offline-manager.js',
    '/manifest.json',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css'
];

// URLs da API para cache
const API_ENDPOINTS = [
    '/api/health'
];

// Configurações de cache
const CACHE_CONFIG = {
    // Cache first para recursos estáticos
    static: {
        strategy: 'cache-first',
        maxAge: 86400000, // 24 horas
        maxEntries: 100
    },
    // Network first para APIs
    api: {
        strategy: 'network-first',
        maxAge: 300000, // 5 minutos
        maxEntries: 50
    },
    // Stale while revalidate para recursos dinâmicos
    dynamic: {
        strategy: 'stale-while-revalidate',
        maxAge: 3600000, // 1 hora
        maxEntries: 200
    }
};

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando...');
    
    event.waitUntil(
        Promise.all([
            // Cache recursos estáticos
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('📦 Cacheando recursos estáticos...');
                return cache.addAll(STATIC_ASSETS);
            }),
            // Cache endpoints da API
            caches.open(API_CACHE).then((cache) => {
                console.log('🌐 Cacheando endpoints da API...');
                return Promise.allSettled(API_ENDPOINTS.map(url => {
                    return cache.add(new Request(url, {
                        method: 'GET',
                        headers: { 'Accept': 'application/json' }
                    })).catch(err => {
                        console.warn(`⚠️ Erro ao cachear ${url}:`, err);
                        return null;
                    });
                }));
            })
        ]).then(() => {
            console.log('✅ Service Worker instalado com sucesso');
            return self.skipWaiting();
        })
    );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker ativando...');
    
    event.waitUntil(
        Promise.all([
            // Limpar caches antigos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== STATIC_CACHE && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('🗑️ Removendo cache antigo:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Tomar controle de todas as páginas
            self.clients.claim()
        ]).then(() => {
            console.log('✅ Service Worker ativado com sucesso');
            
            // Notificar clientes sobre atualização
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        message: 'Service Worker atualizado com sucesso'
                    });
                });
            });
        })
    );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Ignorar requisições não-HTTP
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Ignorar URLs do Google Fonts para evitar erros de CSP
    if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
        console.log('🔤 URL do Google Fonts - não interceptando:', request.url);
        return; // Deixar passar direto para a rede
    }
    
    // Páginas que NUNCA devem ser cacheadas (sempre da rede)
    if (isNoCachePage(request)) {
        event.respondWith(networkOnly(request));
        return;
    }
    
    // Estratégia baseada no tipo de recurso
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
    } else if (isApiRequest(request)) {
        event.respondWith(networkFirst(request, API_CACHE));
    } else if (isImageRequest(request)) {
        event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    } else {
        event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
    }
});

// Estratégia Cache First
async function cacheFirst(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            console.log('📦 Servindo do cache:', request.url);
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('❌ Erro no cache first:', error);
        return new Response('Recurso não disponível offline', { status: 503 });
    }
}

// Estratégia Network First
async function networkFirst(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        // Só fazer cache de requisições GET
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
            console.log('🌐 Resposta da rede cacheada:', request.url);
        } else if (request.method !== 'GET') {
            console.log(`🔄 Requisição ${request.method} não será cacheada:`, request.url);
        }
        
        return networkResponse;
    } catch (error) {
        console.log('🔴 Rede indisponível, tentando cache para:', request.url);
        
        // Só tentar cache para requisições GET
        if (request.method === 'GET') {
            const cache = await caches.open(cacheName);
            const cachedResponse = await cache.match(request);
            
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        
        return new Response('API não disponível offline', { 
            status: 503,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Serviço indisponível offline',
                offline: true 
            })
        });
    }
}

// Estratégia Stale While Revalidate
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Em caso de erro de rede, retornar cache se disponível
        return cachedResponse;
    });
    
    return cachedResponse || fetchPromise;
}

// Verificar se é recurso estático
function isStaticAsset(request) {
    const url = new URL(request.url);
    return STATIC_ASSETS.includes(url.pathname) ||
           url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.html') ||
           url.pathname.endsWith('.json') ||
           url.pathname.endsWith('.ico');
}

// Verificar se é requisição da API
function isApiRequest(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/') ||
           url.hostname === 'localhost' && url.pathname.startsWith('/api/');
}

// Verificar se é requisição de imagem
function isImageRequest(request) {
    return request.destination === 'image' ||
           request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
}

// Verificar se é página que NÃO deve ser cacheada
function isNoCachePage(request) {
    const url = new URL(request.url);
    const noCachePages = [
        '/checkout.html',
        '/payment-success.html'
    ];
    
    return noCachePages.some(page => url.pathname === page) ||
           request.destination === 'document' && 
           (url.pathname.includes('checkout') || url.pathname.includes('payment-success'));
}

// Estratégia Network Only (sempre da rede, sem cache)
async function networkOnly(request) {
    try {
        console.log('🌐 Servindo sempre da rede (sem cache):', request.url);
        return await fetch(request);
    } catch (error) {
        console.error('❌ Erro na rede para:', request.url, error);
        return new Response('Página não disponível offline', { 
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync:', event.tag);
    
    if (event.tag === 'payment-sync') {
        event.waitUntil(syncPayments());
    } else if (event.tag === 'notification-sync') {
        event.waitUntil(syncNotifications());
    }
});

// Sincronizar pagamentos offline
async function syncPayments() {
    try {
        const cache = await caches.open('offline-payments');
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                    console.log('✅ Pagamento sincronizado:', request.url);
                }
            } catch (error) {
                console.log('❌ Erro ao sincronizar pagamento:', error);
            }
        }
    } catch (error) {
        console.error('❌ Erro no sync de pagamentos:', error);
    }
}

// Sincronizar notificações offline
async function syncNotifications() {
    try {
        const cache = await caches.open('offline-notifications');
        const requests = await cache.keys();
        
        for (const request of requests) {
            try {
                const response = await fetch(request);
                if (response.ok) {
                    await cache.delete(request);
                    console.log('✅ Notificação sincronizada:', request.url);
                }
            } catch (error) {
                console.log('❌ Erro ao sincronizar notificação:', error);
            }
        }
    } catch (error) {
        console.error('❌ Erro no sync de notificações:', error);
    }
}

// Push Notifications
self.addEventListener('push', (event) => {
    console.log('📱 Push notification recebida');
    
    const options = {
        body: 'Nova notificação do RatixPay',
        icon: '/assets/images/icons/push-icon-192x192.png',
        badge: '/assets/images/icons/push-icon-96x96.png',
        vibrate: [200, 100, 200, 100, 200],
        sound: '/assets/sounds/alert.mp3',
        data: {
            url: '/dashboard.html'
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir',
                icon: '/assets/images/icons/icon-96x96.png'
            },
            {
                action: 'close',
                title: 'Fechar'
            }
        ]
    };
    
    if (event.data) {
        const data = event.data.json();
        options.body = data.body || options.body;
        options.vibrate = data.vibrate || options.vibrate;
        options.sound = data.sound || options.sound;
        options.data = { ...options.data, ...data };
    }
    
    // Tocar som da notificação
    if (options.sound && !options.silent) {
        const audio = new Audio(options.sound);
        audio.play().catch(error => {
            console.warn('⚠️ Erro ao tocar som da notificação:', error);
        });
    }
    
    event.waitUntil(
        self.registration.showNotification('RatixPay', options)
    );
});

// Click em notificação
self.addEventListener('notificationclick', (event) => {
    console.log('👆 Notificação clicada:', event.action);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                // Se já há uma janela aberta, focar nela
                for (const client of clientList) {
                    if (client.url.includes('dashboard') && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Senão, abrir nova janela
                if (clients.openWindow) {
                    return clients.openWindow('/dashboard.html');
                }
            })
        );
    }
});

// Message handling
self.addEventListener('message', (event) => {
    console.log('💬 Mensagem recebida:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    } else if (event.data && event.data.type === 'CACHE_URLS') {
        event.waitUntil(
            caches.open(DYNAMIC_CACHE).then((cache) => {
                return cache.addAll(event.data.urls);
            })
        );
    } else if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

// Periodic Background Sync (experimental)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        event.waitUntil(syncContent());
    }
});

async function syncContent() {
    try {
        console.log('🔄 Sincronizando conteúdo em background...');
        
        // Sincronizar dados importantes
        const endpoints = [
            '/api/dashboard/vendedor/resumo',
            '/api/notificacoes/nao-lidas',
            '/api/produtos'
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    const cache = await caches.open(API_CACHE);
                    await cache.put(endpoint, response.clone());
                }
            } catch (error) {
                console.log('❌ Erro ao sincronizar:', endpoint, error);
            }
        }
    } catch (error) {
        console.error('❌ Erro no sync periódico:', error);
    }
}

console.log('🎯 Service Worker carregado - RatixPay v2.0.0');
