/**
 * RatixPay PWA Manager
 * Gerencia instalação, atualizações e funcionalidades offline
 */

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isOnline = navigator.onLine;
        this.updateAvailable = false;
        
        this.init();
    }

    /**
     * Inicializa o PWA Manager
     */
    init() {
        console.log('🚀 Inicializando PWA Manager...');
        
        // Remover elemento update-notification se existir
        this.removeUpdateNotification();
        
        this.setupInstallPrompt();
        this.setupUpdateHandling();
        this.setupOfflineHandling();
        this.setupServiceWorker();
        this.checkInstallationStatus();
        
        console.log('✅ PWA Manager inicializado');
    }
    
    /**
     * Remove elemento update-notification se existir
     */
    removeUpdateNotification() {
        const notification = document.getElementById('update-notification');
        if (notification) {
            notification.remove();
            console.log('✅ Elemento update-notification removido do DOM');
        }
    }

    /**
     * Configura prompt de instalação
     */
    setupInstallPrompt() {
        // Interceptar evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('📱 Prompt de instalação disponível');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Detectar se app foi instalado
        window.addEventListener('appinstalled', () => {
            console.log('✅ PWA instalado com sucesso');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showNotification('PWA instalado com sucesso!', 'success');
        });
    }

    /**
     * Configura tratamento de atualizações
     */
    setupUpdateHandling() {
        // Detectar atualizações do Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'SW_ACTIVATED') {
                    this.updateAvailable = true;
                    this.showUpdateNotification();
                }
            });
        }
    }

    /**
     * Configura tratamento offline
     */
    setupOfflineHandling() {
        // Detectar mudanças de conectividade
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada');
            this.isOnline = true;
            this.hideOfflineIndicator();
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            console.log('🔴 Conexão perdida');
            this.isOnline = false;
            this.showOfflineIndicator();
        });

        // Verificar status inicial
        this.updateConnectionStatus();
    }

    /**
     * Configura Service Worker
     */
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw-pwa.js');
                console.log('✅ Service Worker registrado:', registration.scope);

                // Verificar atualizações
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Nova versão do Service Worker encontrada');
                    this.updateAvailable = true;
                    this.showUpdateNotification();
                });

                // Verificar se há atualização pendente
                if (registration.waiting) {
                    this.updateAvailable = true;
                    this.showUpdateNotification();
                }

            } catch (error) {
                console.error('❌ Erro ao registrar Service Worker:', error);
            }
        }
    }

    /**
     * Verifica status de instalação
     */
    checkInstallationStatus() {
        // Verificar se está rodando como PWA
        if (window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true) {
            this.isInstalled = true;
            console.log('📱 PWA já está instalado');
        }
    }

    /**
     * Mostra botão de instalação
     */
    showInstallButton() {
        const installButton = this.createInstallButton();
        document.body.appendChild(installButton);
    }

    /**
     * Cria botão de instalação
     */
    createInstallButton() {
        const button = document.createElement('div');
        button.id = 'pwa-install-button';
        button.className = 'pwa-install-button';
        button.innerHTML = `
            <div class="pwa-install-content">
                <i class="fas fa-download"></i>
                <span>Instalar App</span>
                <button onclick="pwaManager.installApp()" class="btn-install">
                    <i class="fas fa-plus"></i>
                </button>
                <button onclick="pwaManager.hideInstallButton()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Adicionar estilos
        const style = document.createElement('style');
        style.textContent = `
            .pwa-install-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #0066FF, #0044CC);
                color: white;
                padding: 12px 16px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 102, 255, 0.3);
                z-index: 10000;
                animation: slideInUp 0.3s ease-out;
                max-width: 300px;
            }
            
            .pwa-install-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .pwa-install-content span {
                font-weight: 500;
                font-size: 14px;
            }
            
            .btn-install, .btn-close {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 6px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .btn-install:hover, .btn-close:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            @keyframes slideInUp {
                from {
                    transform: translateY(100px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        return button;
    }

    /**
     * Instala o PWA
     */
    async installApp() {
        if (!this.deferredPrompt) {
            console.log('❌ Prompt de instalação não disponível');
            return;
        }

        try {
            // Mostrar prompt de instalação
            this.deferredPrompt.prompt();
            
            // Aguardar resposta do usuário
            const { outcome } = await this.deferredPrompt.userChoice;
            
            console.log('📱 Resultado da instalação:', outcome);
            
            if (outcome === 'accepted') {
                this.showNotification('Instalando PWA...', 'info');
            }
            
            // Limpar prompt
            this.deferredPrompt = null;
            this.hideInstallButton();
            
        } catch (error) {
            console.error('❌ Erro ao instalar PWA:', error);
        }
    }

    /**
     * Esconde botão de instalação
     */
    hideInstallButton() {
        const button = document.getElementById('pwa-install-button');
        if (button) {
            button.style.animation = 'slideOutDown 0.3s ease-in';
            setTimeout(() => button.remove(), 300);
        }
    }

    /**
     * Mostra indicador offline
     */
    showOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'offline-indicator';
        indicator.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi"></i>
                <span>Modo Offline</span>
            </div>
        `;

        // Adicionar estilos
        const style = document.createElement('style');
        style.textContent = `
            .offline-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #ff6b6b;
                color: white;
                padding: 8px 16px;
                text-align: center;
                z-index: 10001;
                animation: slideDown 0.3s ease-out;
            }
            
            .offline-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                font-weight: 500;
            }
            
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                }
                to {
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(indicator);
    }

    /**
     * Esconde indicador offline
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => indicator.remove(), 300);
        }
    }

    /**
     * Mostra notificação de atualização
     * DESABILITADO: Notificação de atualização removida conforme solicitado
     */
    showUpdateNotification() {
        // Função desabilitada - não criar elemento update-notification
        console.log('⚠️ Notificação de atualização desabilitada');
        return;
        
        // Código original comentado para referência
        /*
        const notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-sync-alt"></i>
                <span>Nova versão disponível</span>
                <button onclick="pwaManager.updateApp()" class="btn-update">
                    Atualizar
                </button>
                <button onclick="pwaManager.hideUpdateNotification()" class="btn-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Adicionar estilos
        const style = document.createElement('style');
        style.textContent = `
            .update-notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4CAF50;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(76, 175, 80, 0.3);
                z-index: 10002;
                animation: slideInDown 0.3s ease-out;
                max-width: 400px;
            }
            
            .update-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .btn-update {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            
            .btn-update:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            @keyframes slideInDown {
                from {
                    transform: translateX(-50%) translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);
        */
    }

    /**
     * Atualiza o app
     */
    async updateApp() {
        if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
            }
        }
    }

    /**
     * Esconde notificação de atualização
     */
    hideUpdateNotification() {
        // Remover elemento se existir (caso tenha sido criado antes da desabilitação)
        const notification = document.getElementById('update-notification');
        if (notification) {
            notification.remove();
            console.log('✅ Elemento update-notification removido');
        }
    }

    /**
     * Sincroniza dados offline
     */
    async syncOfflineData() {
        console.log('🔄 Sincronizando dados offline...');
        
        try {
            // Registrar background sync
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('payment-sync');
                await registration.sync.register('notification-sync');
            }
            
            this.showNotification('Dados sincronizados', 'success');
        } catch (error) {
            console.error('❌ Erro ao sincronizar dados:', error);
        }
    }

    /**
     * Atualiza status de conexão
     */
    updateConnectionStatus() {
        const status = navigator.onLine ? 'online' : 'offline';
        document.body.classList.toggle('online', navigator.onLine);
        document.body.classList.toggle('offline', !navigator.onLine);
        
        console.log('🌐 Status de conexão:', status);
    }

    /**
     * Mostra notificação
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Adicionar estilos se não existirem
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    border-radius: 8px;
                    color: white;
                    z-index: 10003;
                    animation: slideInRight 0.3s ease-out;
                    max-width: 300px;
                }
                
                .notification-success { background: #4CAF50; }
                .notification-error { background: #f44336; }
                .notification-warning { background: #ff9800; }
                .notification-info { background: #2196F3; }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto remove após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Obtém ícone da notificação
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Obtém status do PWA
     */
    getStatus() {
        return {
            isInstalled: this.isInstalled,
            isOnline: this.isOnline,
            updateAvailable: this.updateAvailable,
            hasServiceWorker: 'serviceWorker' in navigator,
            canInstall: !!this.deferredPrompt
        };
    }
}

// Inicializar PWA Manager
let pwaManager;
document.addEventListener('DOMContentLoaded', () => {
    pwaManager = new PWAManager();
    window.pwaManager = pwaManager;
});

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
}
