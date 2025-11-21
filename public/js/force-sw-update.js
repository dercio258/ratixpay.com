/**
 * Force Service Worker Update
 * Desregistra TODOS os service workers antigos e força atualização
 */

(function() {
    'use strict';
    
    console.log('🔄 Forçando atualização do Service Worker...');
    
    if ('serviceWorker' in navigator) {
        // Desregistrar TODOS os service workers
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            console.log('🗑️ Desregistrando', registrations.length, 'service worker(s)...');
            
            return Promise.all(
                registrations.map((registration) => {
                    console.log('🗑️ Desregistrando:', registration.scope);
                    return registration.unregister().then((success) => {
                        if (success) {
                            console.log('✅ Service Worker desregistrado:', registration.scope);
                        }
                        return success;
                    });
                })
            );
        }).then((results) => {
            const unregisteredCount = results.filter(r => r).length;
            console.log('✅ Total de service workers desregistrados:', unregisteredCount);
            
            // Limpar todos os caches
            if ('caches' in window) {
                return caches.keys().then((cacheNames) => {
                    console.log('🗑️ Limpando', cacheNames.length, 'caches...');
                    return Promise.all(
                        cacheNames.map((cacheName) => {
                            return caches.delete(cacheName).then((deleted) => {
                                if (deleted) {
                                    console.log('✅ Cache removido:', cacheName);
                                }
                                return deleted;
                            });
                        })
                    );
                });
            }
            return Promise.resolve([]);
        }).then(() => {
            console.log('✅ Limpeza completa! Recarregando página em 2 segundos...');
            
            // Recarregar página após limpeza
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);
        }).catch((error) => {
            console.error('❌ Erro ao forçar atualização:', error);
        });
    } else {
        console.log('⚠️ Service Workers não suportados neste navegador');
    }
})();

