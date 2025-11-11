/**
 * RatixPay Offline Manager
 * Gerencia funcionalidades offline e sincronização
 */

class OfflineManager {
    constructor() {
        this.offlineData = new Map();
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        
        this.init();
    }

    /**
     * Inicializa o Offline Manager
     */
    init() {
        console.log('🔌 Inicializando Offline Manager...');
        
        this.setupEventListeners();
        this.loadOfflineData();
        this.setupPeriodicSync();
        
        console.log('✅ Offline Manager inicializado');
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Detectar mudanças de conectividade
        window.addEventListener('online', () => {
            console.log('🌐 Conexão restaurada - iniciando sincronização');
            this.isOnline = true;
            this.syncOfflineData();
        });

        window.addEventListener('offline', () => {
            console.log('🔴 Conexão perdida - modo offline ativado');
            this.isOnline = false;
            this.showOfflineMode();
        });

        // Interceptar requisições para cache offline
        this.setupRequestInterception();
    }

    /**
     * Configura interceptação de requisições
     */
    setupRequestInterception() {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            try {
                const response = await originalFetch(url, options);
                
                // Se online, cachear resposta para uso offline
                if (this.isOnline && response.ok) {
                    this.cacheResponse(url, response.clone());
                }
                
                return response;
            } catch (error) {
                // Se offline, tentar usar cache
                if (!this.isOnline) {
                    const cachedResponse = await this.getCachedResponse(url);
                    if (cachedResponse) {
                        console.log('📦 Usando resposta em cache:', url);
                        return cachedResponse;
                    }
                }
                
                throw error;
            }
        };
    }

    /**
     * Cacheia resposta para uso offline
     */
    async cacheResponse(url, response) {
        try {
            const cache = await caches.open('offline-cache');
            await cache.put(url, response);
            console.log('💾 Resposta cacheada:', url);
        } catch (error) {
            console.error('❌ Erro ao cachear resposta:', error);
        }
    }

    /**
     * Obtém resposta do cache
     */
    async getCachedResponse(url) {
        try {
            const cache = await caches.open('offline-cache');
            return await cache.match(url);
        } catch (error) {
            console.error('❌ Erro ao obter cache:', error);
            return null;
        }
    }

    /**
     * Carrega dados offline salvos
     */
    loadOfflineData() {
        try {
            const savedData = localStorage.getItem('offlineData');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.offlineData = new Map(Object.entries(data));
                console.log('📂 Dados offline carregados:', this.offlineData.size, 'itens');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados offline:', error);
        }
    }

    /**
     * Salva dados offline
     */
    saveOfflineData() {
        try {
            const data = Object.fromEntries(this.offlineData);
            localStorage.setItem('offlineData', JSON.stringify(data));
            console.log('💾 Dados offline salvos');
        } catch (error) {
            console.error('❌ Erro ao salvar dados offline:', error);
        }
    }

    /**
     * Adiciona dados para sincronização offline
     */
    addToSyncQueue(type, data) {
        const syncItem = {
            id: Date.now().toString(),
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
            attempts: 0
        };

        this.syncQueue.push(syncItem);
        this.saveSyncQueue();
        
        console.log('📝 Item adicionado à fila de sincronização:', type);
        
        // Se online, tentar sincronizar imediatamente
        if (this.isOnline) {
            this.syncOfflineData();
        }
    }

    /**
     * Salva fila de sincronização
     */
    saveSyncQueue() {
        try {
            localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
        } catch (error) {
            console.error('❌ Erro ao salvar fila de sincronização:', error);
        }
    }

    /**
     * Carrega fila de sincronização
     */
    loadSyncQueue() {
        try {
            const savedQueue = localStorage.getItem('syncQueue');
            if (savedQueue) {
                this.syncQueue = JSON.parse(savedQueue);
                console.log('📋 Fila de sincronização carregada:', this.syncQueue.length, 'itens');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar fila de sincronização:', error);
        }
    }

    /**
     * Sincroniza dados offline
     */
    async syncOfflineData() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }

        this.syncInProgress = true;
        console.log('🔄 Iniciando sincronização offline...');

        try {
            // Carregar fila se não estiver carregada
            if (this.syncQueue.length === 0) {
                this.loadSyncQueue();
            }

            const itemsToSync = [...this.syncQueue];
            let successCount = 0;
            let errorCount = 0;

            for (const item of itemsToSync) {
                try {
                    const success = await this.syncItem(item);
                    if (success) {
                        this.removeFromSyncQueue(item.id);
                        successCount++;
                    } else {
                        item.attempts++;
                        errorCount++;
                        
                        // Remover após muitas tentativas
                        if (item.attempts >= 3) {
                            this.removeFromSyncQueue(item.id);
                            console.log('❌ Item removido após muitas tentativas:', item.id);
                        }
                    }
                } catch (error) {
                    console.error('❌ Erro ao sincronizar item:', error);
                    item.attempts++;
                    errorCount++;
                }
            }

            console.log(`✅ Sincronização concluída: ${successCount} sucessos, ${errorCount} erros`);
            
            if (successCount > 0) {
                this.showNotification(`${successCount} itens sincronizados`, 'success');
            }

        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
        } finally {
            this.syncInProgress = false;
            this.saveSyncQueue();
        }
    }

    /**
     * Sincroniza item específico
     */
    async syncItem(item) {
        try {
            switch (item.type) {
                case 'payment':
                    return await this.syncPayment(item.data);
                case 'notification':
                    return await this.syncNotification(item.data);
                case 'product':
                    return await this.syncProduct(item.data);
                case 'user_action':
                    return await this.syncUserAction(item.data);
                default:
                    console.log('⚠️ Tipo de sincronização não reconhecido:', item.type);
                    return false;
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar item:', error);
            return false;
        }
    }

    /**
     * Sincroniza pagamento offline
     */
    async syncPayment(paymentData) {
        try {
            const response = await fetch('/api/payments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(paymentData)
            });

            if (response.ok) {
                console.log('✅ Pagamento sincronizado:', paymentData.id);
                return true;
            } else {
                console.log('❌ Falha ao sincronizar pagamento:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar pagamento:', error);
            return false;
        }
    }

    /**
     * Sincroniza notificação offline
     */
    async syncNotification(notificationData) {
        try {
            const response = await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(notificationData)
            });

            if (response.ok) {
                console.log('✅ Notificação sincronizada:', notificationData.id);
                return true;
            } else {
                console.log('❌ Falha ao sincronizar notificação:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar notificação:', error);
            return false;
        }
    }

    /**
     * Sincroniza produto offline
     */
    async syncProduct(productData) {
        try {
            const response = await fetch('/api/produtos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(productData)
            });

            if (response.ok) {
                console.log('✅ Produto sincronizado:', productData.id);
                return true;
            } else {
                console.log('❌ Falha ao sincronizar produto:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar produto:', error);
            return false;
        }
    }

    /**
     * Sincroniza ação do usuário offline
     */
    async syncUserAction(actionData) {
        try {
            const response = await fetch('/api/user-actions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify(actionData)
            });

            if (response.ok) {
                console.log('✅ Ação do usuário sincronizada:', actionData.id);
                return true;
            } else {
                console.log('❌ Falha ao sincronizar ação:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao sincronizar ação:', error);
            return false;
        }
    }

    /**
     * Remove item da fila de sincronização
     */
    removeFromSyncQueue(itemId) {
        this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
        this.saveSyncQueue();
    }

    /**
     * Configura sincronização periódica
     */
    setupPeriodicSync() {
        // Sincronizar a cada 5 minutos quando online
        setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.syncOfflineData();
            }
        }, 5 * 60 * 1000); // 5 minutos

        // Registrar background sync se disponível
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.sync.register('offline-sync');
            });
        }
    }

    /**
     * Mostra modo offline
     */
    showOfflineMode() {
        const offlineBanner = document.createElement('div');
        offlineBanner.id = 'offline-banner';
        offlineBanner.className = 'offline-banner';
        offlineBanner.innerHTML = `
            <div class="offline-content">
                <i class="fas fa-wifi"></i>
                <span>Modo Offline - Dados serão sincronizados quando a conexão for restaurada</span>
                <div class="offline-stats">
                    <span id="offline-queue-count">${this.syncQueue.length} itens pendentes</span>
                </div>
            </div>
        `;

        // Adicionar estilos
        const style = document.createElement('style');
        style.textContent = `
            .offline-banner {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                color: white;
                padding: 12px 20px;
                text-align: center;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .offline-content {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                font-weight: 500;
            }
            
            .offline-stats {
                background: rgba(255,255,255,0.2);
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
            }
            
            @media (max-width: 768px) {
                .offline-content {
                    flex-direction: column;
                    gap: 8px;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(offlineBanner);
    }

    /**
     * Esconde modo offline
     */
    hideOfflineMode() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.remove();
        }
    }

    /**
     * Mostra notificação
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `offline-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Adicionar estilos
        const style = document.createElement('style');
        style.textContent = `
            .offline-notification {
                position: fixed;
                bottom: 20px;
                left: 20px;
                padding: 12px 16px;
                border-radius: 8px;
                color: white;
                z-index: 10001;
                animation: slideInLeft 0.3s ease-out;
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
            
            @keyframes slideInLeft {
                from {
                    transform: translateX(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Auto remove após 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOutLeft 0.3s ease-in';
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
     * Verifica se está conectado (online)
     */
    isConnected() {
        return this.isOnline;
    }

    /**
     * Obtém status offline
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            syncQueueLength: this.syncQueue.length,
            syncInProgress: this.syncInProgress,
            offlineDataSize: this.offlineData.size
        };
    }
}

// Inicializar Offline Manager imediatamente
let offlineManager;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        offlineManager = new OfflineManager();
        window.offlineManager = offlineManager;
        console.log('🔌 Offline Manager inicializado via DOMContentLoaded');
    });
} else {
    // DOM já carregado, inicializar imediatamente
    offlineManager = new OfflineManager();
    window.offlineManager = offlineManager;
    console.log('🔌 Offline Manager inicializado imediatamente');
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineManager;
}