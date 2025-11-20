/**
 * RatixPay PWA Service Worker
 * Versão: 2.0.1
 * Funcionalidades: Cache strategies, offline support, push notifications, background sync
 */

const CACHE_NAME = 'ratixpay-pwa-v2.0.1';
const STATIC_CACHE = 'ratixpay-static-v2.0.1';
const DYNAMIC_CACHE = 'ratixpay-dynamic-v2.0.1';
const API_CACHE = 'ratixpay-api-v2.0.1';

// Recursos estáticos para cache
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    // '/login.html', // REMOVIDO - não deve ser cacheado
    '/gestao-produtos.html',
    '/integracoes.html',
    // '/gestao-vendas.html', // REMOVIDO - não deve ser cacheado
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
            // Limpar TODOS os caches de arquivos específicos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.open(cacheName).then((cache) => {
                            const filesToDelete = [
                                '/gestao-vendas.html',
                                '/js/gestao-vendas.js',
                                '/js/pagamentos.js',
                                '/pagamentos.html',
                                '/login.html',
                                '/register.html'
                            ];
                            
                            return Promise.all([
                                ...filesToDelete.map(file => cache.delete(file)),
                                ...filesToDelete.map(file => cache.delete(new Request(file)))
                            ]).then(() => {
                                console.log(`🗑️ Cache de arquivos específicos removido de ${cacheName}`);
                            });
                        });
                    })
                );
            }).catch(() => {
                // Ignorar erros se os caches não existirem
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
    
    // PRIORIDADE: arquivos JavaScript específicos SEMPRE da rede (sem cache)
    const noCacheJsFiles = ['gestao-vendas.js', 'gestao-vendas.html', 'pagamentos.js', 'pagamentos.html', 'login.html', 'register.html'];
    const shouldBypassCache = noCacheJsFiles.some(file => url.pathname.includes(file));
    
    if (shouldBypassCache) {
        console.log('🚫 Bypass de cache para:', request.url);
        event.respondWith(
            fetch(request, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache'
                }
            }).then(response => {
                // Criar nova resposta com headers no-cache
                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
                newHeaders.set('Pragma', 'no-cache');
                newHeaders.set('Expires', '0');
                
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            }).catch(error => {
                console.error('❌ Erro ao buscar recurso da rede:', error);
                return new Response('Erro ao carregar recurso', { status: 503 });
            })
        );
        return;
    }
    
    // Páginas que NUNCA devem ser cacheadas (sempre da rede)
    if (isNoCachePage(request)) {
        event.respondWith(networkOnly(request));
        return;
    }
    
    // APIs de saque sempre da rede (sem cache)
    const noCacheApiPatterns = ['/api/saques', '/api/carteiras/saque'];
    const isSaqueApi = noCacheApiPatterns.some(pattern => url.pathname.includes(pattern));
    
    if (isSaqueApi) {
        console.log('🚫 API de saque - bypass de cache:', request.url);
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
        // NUNCA fazer cache de arquivos específicos
        const url = new URL(request.url);
        const noCacheFiles = ['gestao-vendas.js', 'gestao-vendas.html', 'pagamentos.js', 'pagamentos.html', 'login.html', 'register.html'];
        if (noCacheFiles.some(file => url.pathname.includes(file))) {
            console.log('🚫 Bypass de cache no cacheFirst:', request.url);
            return await fetch(request, { cache: 'no-store' });
        }
        
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
        const url = new URL(request.url);
        
        // NUNCA fazer cache de APIs de saque (POST, PUT, DELETE)
        const noCacheApiPatterns = ['/api/saques', '/api/carteiras/saque'];
        const isSaqueApi = noCacheApiPatterns.some(pattern => url.pathname.includes(pattern));
        
        if (isSaqueApi || request.method !== 'GET') {
            console.log(`🔄 Requisição ${request.method} não será cacheada:`, request.url);
            return await fetch(request);
        }
        
        const networkResponse = await fetch(request);
        
        // Só fazer cache de requisições GET bem-sucedidas
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
            console.log('🌐 Resposta da rede cacheada:', request.url);
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
    // NUNCA fazer cache de arquivos específicos
    const url = new URL(request.url);
    const noCacheFiles = ['gestao-vendas.js', 'gestao-vendas.html', 'pagamentos.js', 'pagamentos.html', 'login.html', 'register.html'];
    if (noCacheFiles.some(file => url.pathname.includes(file))) {
        console.log('🚫 Bypass de cache no staleWhileRevalidate:', request.url);
        return await fetch(request, { cache: 'no-store' });
    }
    
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
    
    // NUNCA considerar arquivos específicos como estáticos
    const noCacheFiles = ['gestao-vendas.js', 'gestao-vendas.html', 'pagamentos.js', 'pagamentos.html', 'login.html', 'register.html'];
    if (noCacheFiles.some(file => url.pathname.includes(file))) {
        return false;
    }
    
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
    const isApi = url.pathname.startsWith('/api/') ||
                  (url.hostname === 'localhost' && url.pathname.startsWith('/api/'));
    
    // APIs de saque nunca devem ser cacheadas
    if (isApi) {
        const noCacheApiPatterns = ['/api/saques', '/api/carteiras/saque'];
        if (noCacheApiPatterns.some(pattern => url.pathname.includes(pattern))) {
            return false; // Não tratar como API normal para evitar cache
        }
    }
    
    return isApi;
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
        '/payment-success.html',
        '/gestao-vendas.html', // Adicionado - não deve ser cacheado
        '/pagamentos.html', // Adicionado - não deve ser cacheado
        '/login.html', // Adicionado - não deve ser cacheado
        '/register.html' // Adicionado - não deve ser cacheado
    ];
    
    // Páginas que não devem ser cacheadas
    const noCachePatterns = [
        'checkout',
        'payment-success',
        'gestao-vendas', // Adicionado
        'pagamentos', // Adicionado
        'login', // Adicionado
        'register' // Adicionado
    ];
    
    // Arquivos JavaScript que não devem ser cacheados
    const noCacheJsFiles = ['gestao-vendas.js', 'pagamentos.js', 'pagamentos.html', 'login.html', 'register.html'];
    
    return noCachePages.some(page => url.pathname === page) ||
           request.destination === 'document' && 
           noCachePatterns.some(pattern => url.pathname.includes(pattern)) ||
           // JavaScript específicos também não devem ser cacheados
           noCacheJsFiles.some(file => url.pathname.includes(file));
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
    } else if (event.data && event.data.type === 'CLEAR_GESTAO_VENDAS_CACHE') {
        // Limpar especificamente o cache de arquivos específicos
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        return caches.open(cacheName).then((cache) => {
                            const filesToDelete = [
                                '/gestao-vendas.html',
                                '/js/gestao-vendas.js',
                                '/js/pagamentos.js',
                                '/login.html',
                                '/register.html'
                            ];
                            
                            return Promise.all([
                                ...filesToDelete.map(file => cache.delete(file)),
                                ...filesToDelete.map(file => cache.delete(new Request(file)))
                            ]);
                        });
                    })
                ).then(() => {
                    console.log('🗑️ Cache de arquivos específicos limpo manualmente');
                    if (event.ports && event.ports[0]) {
                        event.ports[0].postMessage({ success: true });
                    }
                });
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

console.log('🎯 Service Worker carregado - RatixPay v2.0.1');
