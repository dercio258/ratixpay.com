/**
 * RatixPay PWA Service Worker
 * Versão: 2.0.3
 * Funcionalidades: Apenas Push notifications (CACHE E OFFLINE DESABILITADOS)
 * 
 * IMPORTANTE: Este service worker NÃO intercepta requisições para garantir
 * que todos os dados sejam sempre carregados em tempo real da rede.
 */

const CACHE_NAME = 'ratixpay-pwa-v2.0.4';

// Instalar Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker instalando (modo offline desabilitado)...');
    
    event.waitUntil(
        Promise.resolve().then(() => {
            console.log('✅ Service Worker instalado (sem cache, sem offline)');
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
            console.log('✅ Service Worker ativado - Cache e modo offline desabilitados');
            
            // Notificar clientes sobre atualização
            self.clients.matchAll().then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({
                        type: 'SW_ACTIVATED',
                        message: 'Service Worker atualizado - Modo offline desabilitado'
                    });
                });
            });
        })
    );
});

// NÃO interceptar requisições - deixar tudo passar direto para a rede
// Isso garante que todos os dados sejam sempre carregados em tempo real
self.addEventListener('fetch', (event) => {
    // NÃO fazer nada - deixar todas as requisições passarem direto para a rede
    // Isso garante que não há cache e todos os dados são sempre atualizados
    // Não chamar event.respondWith() faz com que o navegador busque diretamente da rede
    return;
});

// Todas as funções de cache foram removidas - cache desabilitado

// Background Sync DESABILITADO - Modo offline não permitido
self.addEventListener('sync', (event) => {
    console.log('🚫 Background sync desabilitado (modo offline não permitido):', event.tag);
    // Não fazer nada - modo offline desabilitado
    event.waitUntil(Promise.resolve());
});

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

console.log('🎯 Service Worker carregado - RatixPay v2.0.4 (Cache e Offline Desabilitados)');
