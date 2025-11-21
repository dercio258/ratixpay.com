/**
 * Global Cache Cleaner
 * Limpa todos os caches e força atualização do Service Worker
 * Incluir este script em todas as páginas HTML
 */

(function() {
    'use strict';
    
    const CacheCleaner = {
        initialized: false,
        
        init: function() {
            if (this.initialized) return;
            this.initialized = true;
            
            console.log('🧹 Global Cache Cleaner inicializado');
            
            // Limpar caches ao carregar a página
            this.clearAllCaches();
            
            // Atualizar service workers
            this.updateServiceWorkers();
            
            // Escutar mensagens do service worker
            this.listenToServiceWorker();
            
            // Limpar caches periodicamente (a cada 5 minutos)
            setInterval(() => {
                this.clearAllCaches();
            }, 5 * 60 * 1000);
        },
        
        clearAllCaches: function() {
            if ('caches' in window) {
                caches.keys().then((cacheNames) => {
                    if (cacheNames.length > 0) {
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
                    } else {
                        console.log('✅ Nenhum cache encontrado');
                        return Promise.resolve([]);
                    }
                }).then((results) => {
                    const deletedCount = results.filter(r => r).length;
                    if (deletedCount > 0) {
                        console.log('✅ Total de caches removidos:', deletedCount);
                    }
                }).catch((error) => {
                    console.error('❌ Erro ao limpar caches:', error);
                });
            }
        },
        
        updateServiceWorkers: function() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    if (registrations.length > 0) {
                        console.log('🔄 Atualizando', registrations.length, 'service worker(s)...');
                        registrations.forEach((registration) => {
                            registration.update().then(() => {
                                console.log('✅ Service Worker atualizado:', registration.scope);
                                
                                // Se há uma nova versão esperando, ativar imediatamente
                                if (registration.waiting) {
                                    console.log('🔄 Nova versão do SW detectada, ativando...');
                                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                                }
                            }).catch((error) => {
                                console.error('❌ Erro ao atualizar SW:', error);
                            });
                        });
                    } else {
                        console.log('✅ Nenhum service worker registrado');
                    }
                }).catch((error) => {
                    console.error('❌ Erro ao obter registros de SW:', error);
                });
            }
        },
        
        listenToServiceWorker: function() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'SW_ACTIVATED') {
                        console.log('🔄 Service Worker ativado:', event.data.version);
                        
                        if (event.data.forceReload) {
                            console.log('🔄 Recarregando página em 1 segundo...');
                            setTimeout(() => {
                                window.location.reload(true);
                            }, 1000);
                        }
                    }
                });
            }
        },
        
        forceReload: function() {
            console.log('🔄 Forçando reload completo da página...');
            this.clearAllCaches();
            this.updateServiceWorkers();
            setTimeout(() => {
                window.location.reload(true);
            }, 500);
        }
    };
    
    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            CacheCleaner.init();
        });
    } else {
        CacheCleaner.init();
    }
    
    // Disponibilizar globalmente para uso manual
    window.CacheCleaner = CacheCleaner;
    
    console.log('✅ Global Cache Cleaner carregado');
})();

