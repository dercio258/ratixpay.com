/**
 * RatixPay PWA Service Worker
 * Versão: 2.0.2
 * Funcionalidades: Push notifications, background sync (CACHE DESABILITADO)
 */

const CACHE_NAME = 'ratixpay-pwa-v2.0.2';

// CACHE DESABILITADO - Todas as requisições vão direto para a rede

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando (sem cache)...');
    
    event.waitUntil(
        Promise.resolve().then(() => {
            console.log('✅ Service Worker instalado com sucesso (cache desabilitado)');
            return self.skipWaiting();
        })
    );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker ativando (removendo todos os caches)...');
    
    event.waitUntil(
        Promise.all([
            // Limpar TODOS os caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        console.log('🗑️ Removendo cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            }),
            // Tomar controle de todas as páginas
            self.clients.claim()
        ]).then(() => {
            console.log('✅ Service Worker ativado - Todos os caches removidos');
            
            // Notificar clientes sobre atualização
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        message: 'Service Worker atualizado - Cache desabilitado'
                    });
                });
            });
        })
    );
});

// Interceptar requisições - TODAS vão direto para a rede (SEM CACHE)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    
    // Ignorar requisições não-HTTP
    if (!request.url.startsWith('http')) {
        return;
    }
    
    // Ignorar URLs do Google Fonts para evitar erros de CSP
    const url = new URL(request.url);
    if (url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com')) {
        console.log('🔤 URL do Google Fonts - não interceptando:', request.url);
        return; // Deixar passar direto para a rede
    }
    
    // TODAS as requisições vão direto para a rede (SEM CACHE)
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
});

// Todas as funções de cache foram removidas - cache desabilitado

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync:', event.tag);
    
    if (event.tag === 'payment-sync') {
        event.waitUntil(syncPayments());
    } else if (event.tag === 'notification-sync') {
        event.waitUntil(syncNotifications());
    }
});

// Sincronizar pagamentos offline (sem cache)
async function syncPayments() {
    console.log('🔄 Sync de pagamentos (cache desabilitado)');
    // Cache desabilitado - função mantida para compatibilidade mas não faz nada
}

// Sincronizar notificações offline (sem cache)
async function syncNotifications() {
    console.log('🔄 Sync de notificações (cache desabilitado)');
    // Cache desabilitado - função mantida para compatibilidade mas não faz nada
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
    } else if (event.data && event.data.type === 'CLEAR_CACHE') {
        // Limpar todos os caches (cache desabilitado, mas mantido para compatibilidade)
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('🗑️ Todos os caches removidos');
                if (event.ports && event.ports[0]) {
                    event.ports[0].postMessage({ success: true });
                }
            })
        );
    }
});

// Periodic Background Sync (experimental) - Desabilitado (cache desabilitado)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'content-sync') {
        console.log('🔄 Periodic sync solicitado (cache desabilitado)');
        // Cache desabilitado - não fazer nada
    }
});

console.log('🎯 Service Worker carregado - RatixPay v2.0.2 (Cache Desabilitado)');
