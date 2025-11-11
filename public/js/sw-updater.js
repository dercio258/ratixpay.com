/**
 * Service Worker Updater
 * Detecta atualizações do SW e força reload automático
 */

(function() {
    'use strict';

    const SWUpdater = {
        registration: null,
        updateInterval: null,
        checkInterval: 60000, // Verificar a cada 1 minuto

        init: function() {
            if ('serviceWorker' in navigator) {
                this.register();
                this.setupUpdateCheck();
                this.listenForUpdates();
            }
        },

        register: async function() {
            try {
                this.registration = await navigator.serviceWorker.register('/sw.js', {
                    updateViaCache: 'none' // Sempre verificar atualizações
                });

                console.log('✅ Service Worker registrado');

                // Verificar atualização imediatamente
                await this.checkForUpdate();

                // Escutar mensagens do SW
                navigator.serviceWorker.addEventListener('message', (event) => {
                    this.handleSWMessage(event);
                });
            } catch (error) {
                console.error('❌ Erro ao registrar Service Worker:', error);
            }
        },

        checkForUpdate: async function() {
            if (!this.registration) return;

            try {
                await this.registration.update();
                
                // Verificar se há nova versão esperando
                if (this.registration.waiting) {
                    console.log('🔄 Nova versão do Service Worker detectada!');
                    this.promptUserUpdate();
                }
            } catch (error) {
                console.error('Erro ao verificar atualização:', error);
            }
        },

        setupUpdateCheck: function() {
            // Verificar atualizações periodicamente
            this.updateInterval = setInterval(() => {
                this.checkForUpdate();
            }, this.checkInterval);

            // Verificar quando a página ganha foco
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    this.checkForUpdate();
                }
            });

            // Verificar quando a página carrega
            window.addEventListener('load', () => {
                this.checkForUpdate();
            });
        },

        listenForUpdates: function() {
            // Escutar quando novo SW está instalado
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('🔄 Novo Service Worker ativado - recarregando página...');
                window.location.reload();
            });
        },

        handleSWMessage: function(event) {
            const { type, version, timestamp } = event.data || {};

            switch (type) {
                case 'SW_UPDATED':
                    console.log(`🔄 Service Worker atualizado para v${version}`);
                    this.promptUserUpdate();
                    break;

                case 'CACHE_CLEARED':
                    console.log('✅ Cache limpo pelo Service Worker');
                    break;

                default:
                    console.log('📨 Mensagem do SW:', event.data);
            }
        },

        promptUserUpdate: function() {
            // Em desenvolvimento, sempre recarregar automaticamente
            if (window.location.hostname === 'localhost' || 
                window.location.hostname === '127.0.0.1') {
                console.log('🔄 [DEV] Recarregando automaticamente...');
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                return;
            }

            // Em produção, mostrar notificação opcional
            if (this.shouldShowUpdateNotification()) {
                this.showUpdateNotification();
            } else {
                // Recarregar automaticamente após 2 segundos
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            }
        },

        shouldShowUpdateNotification: function() {
            // Mostrar notificação apenas se usuário está ativo na página
            return document.visibilityState === 'visible' && 
                   !document.hidden;
        },

        showUpdateNotification: function() {
            // Criar notificação visual
            const notification = document.createElement('div');
            notification.id = 'sw-update-notification';
            notification.innerHTML = `
                <div style="
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #F64C00;
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    max-width: 350px;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">🔄</span>
                        <div>
                            <div style="font-weight: 600; margin-bottom: 5px;">Nova versão disponível!</div>
                            <div style="font-size: 14px; opacity: 0.9;">A página será atualizada automaticamente...</div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // Remover após 3 segundos
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                window.location.reload();
            }, 3000);
        },

        forceUpdate: async function() {
            if (!this.registration) return;

            try {
                // Limpar cache
                if (this.registration.active) {
                    this.registration.active.postMessage({ type: 'CLEAR_CACHE' });
                }

                // Forçar atualização
                await this.registration.update();
                
                // Recarregar página
                window.location.reload();
            } catch (error) {
                console.error('Erro ao forçar atualização:', error);
            }
        }
    };

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => SWUpdater.init());
    } else {
        SWUpdater.init();
    }

    // Exportar para uso global
    window.SWUpdater = SWUpdater;

    // Adicionar atalho de teclado para forçar atualização (Ctrl+Shift+R)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            SWUpdater.forceUpdate();
        }
    });
})();

