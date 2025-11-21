/**
 * Script para limpar completamente todos os caches e service workers
 * Execute este script no console do navegador para forçar limpeza completa
 */

(function() {
    'use strict';
    
    console.log('🧹 Iniciando limpeza completa de caches...');
    
    // Limpar todos os caches
    if ('caches' in window) {
        caches.keys().then((cacheNames) => {
            console.log('🗑️ Encontrados', cacheNames.length, 'caches para remover');
            return Promise.all(
                cacheNames.map((cacheName) => {
                    console.log('🗑️ Removendo cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            console.log('✅ Todos os caches removidos');
        }).catch((error) => {
            console.error('❌ Erro ao remover caches:', error);
        });
    }
    
    // Desregistrar todos os service workers
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            console.log('🗑️ Encontrados', registrations.length, 'service workers para desregistrar');
            return Promise.all(
                registrations.map((registration) => {
                    console.log('🗑️ Desregistrando service worker:', registration.scope);
                    return registration.unregister();
                })
            );
        }).then(() => {
            console.log('✅ Todos os service workers desregistrados');
            console.log('🔄 Recarregando página em 2 segundos...');
            setTimeout(() => {
                window.location.reload(true);
            }, 2000);
        }).catch((error) => {
            console.error('❌ Erro ao desregistrar service workers:', error);
        });
    }
    
    // Limpar localStorage e sessionStorage (opcional - descomente se necessário)
    // localStorage.clear();
    // sessionStorage.clear();
    
    console.log('✅ Limpeza completa finalizada');
})();

