/**
 * 🔔 SISTEMA DE NOTIFICAÇÕES OTIMIZADO - RATIXPAY
 * 
 * Versão otimizada do sistema de notificações com:
 * - Carregamento centralizado
 * - Cache inteligente
 * - Retry automático
 * - Performance melhorada
 * - Menos logs desnecessários
 */

class NotificationOptimized {
    constructor() {
        this.isInitialized = false;
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 segundos
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.updateInterval = null;
        this.notifications = [];
        this.unreadCount = 0;
        
        // Configurações
        this.config = {
            apiBase: window.API_BASE,
            updateInterval: 30000, // 30 segundos
            maxNotifications: 50,
            debug: false
        };
        
        // Event listeners
        this.events = new EventTarget();
        
        console.log('🔔 NotificationOptimized criado');
    }

    /**
     * Inicializar sistema de notificações
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Sistema de notificações já inicializado');
            return;
        }

        try {
            console.log('🔔 Inicializando sistema de notificações...');
            
            // Aguardar sistema estar pronto
            await this.waitForSystemReady();
            
            // Carregar notificações iniciais
            await this.loadNotifications();
            
            // Configurar interface
            this.setupUI();
            
            // Iniciar atualizações automáticas
            this.startAutoUpdates();
            
            this.isInitialized = true;
            
            this.events.dispatchEvent(new CustomEvent('notificationsInitialized'));
            console.log('✅ Sistema de notificações inicializado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema de notificações:', error);
            throw error;
        }
    }

    /**
     * Aguardar sistema estar pronto
     */
    async waitForSystemReady() {
        return new Promise((resolve) => {
            if (window.systemLoader && window.systemLoader.config.isConnected) {
                resolve();
            } else {
                window.systemLoader?.events.addEventListener('systemReady', resolve, { once: true });
            }
        });
    }

    /**
     * Carregar notificações
     */
    async loadNotifications() {
        try {
            const data = await this.apiCall('/notifications');
            
            if (data && data.notificacoes) {
                this.notifications = data.notificacoes.slice(0, this.config.maxNotifications);
                this.unreadCount = data.total || this.notifications.length;
                
                this.updateUI();
                this.cache.set('notifications', { data: this.notifications, timestamp: Date.now() });
            }
            
            return this.notifications;
            
        } catch (error) {
            console.error('❌ Erro ao carregar notificações:', error);
            throw error;
        }
    }

    /**
     * Chamada de API com retry automático
     */
    async apiCall(endpoint, options = {}) {
        const url = `${this.config.apiBase}${endpoint}`;
        const retryKey = url;
        const retryCount = this.retryAttempts.get(retryKey) || 0;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Reset retry count on success
            this.retryAttempts.delete(retryKey);
            
            return data;
            
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`⚠️ Tentativa ${retryCount + 1}/${this.maxRetries} falhou para ${endpoint}`);
                this.retryAttempts.set(retryKey, retryCount + 1);
                
                await this.delay(1000 * (retryCount + 1));
                return this.apiCall(endpoint, options);
            } else {
                console.error(`❌ Falha definitiva para ${endpoint}:`, error);
                this.retryAttempts.delete(retryKey);
                throw error;
            }
        }
    }

    /**
     * Atualizar interface
     */
    updateUI() {
        this.updateCounter();
        this.updateDropdown();
    }

    /**
     * Atualizar contador
     */
    updateCounter() {
        const counter = document.getElementById('notificationCount');
        if (counter) {
            counter.textContent = this.unreadCount.toString();
            counter.style.display = this.unreadCount > 0 ? 'block' : 'none';
        }
    }

    /**
     * Atualizar dropdown
     */
    updateDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (!dropdown) {
            this.createDropdown();
            return;
        }
        
        const list = dropdown.querySelector('.notifications-list');
        if (list) {
            list.innerHTML = this.renderNotifications();
        }
    }

    /**
     * Criar dropdown
     */
    createDropdown() {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;
        
        const dropdown = document.createElement('div');
        dropdown.id = 'notification-dropdown';
        dropdown.className = 'notification-dropdown';
        dropdown.innerHTML = `
            <div class="notification-header">
                <h4>Notificações</h4>
                <div class="notification-actions-header">
                    <button class="btn-mark-all-read" onclick="notificationOptimized.markAllAsRead()">
                        <i class="fas fa-check-double"></i>
                        Marcar todas como lida
                    </button>
                    <button class="btn-view-all" onclick="notificationOptimized.viewAll()">
                        <i class="fas fa-list"></i>
                        Ver todas
                    </button>
                </div>
            </div>
            <div class="notifications-list">
                ${this.renderNotifications()}
            </div>
        `;
        
        panel.appendChild(dropdown);
    }

    /**
     * Renderizar notificações
     */
    renderNotifications() {
        if (this.notifications.length === 0) {
            return '<div class="no-notifications">Nenhuma notificação</div>';
        }
        
        return this.notifications.map(notification => `
            <div class="notification-item ${notification.lida ? 'read' : 'unread'}" 
                 data-id="${notification.id}">
                <div class="notification-content">
                    <h5>${notification.titulo}</h5>
                    <p>${notification.mensagem}</p>
                    <small>${this.formatTime(notification.created_at)}</small>
                </div>
                <div class="notification-actions">
                    ${!notification.lida ? `
                        <button class="btn-mark-read" onclick="notificationOptimized.markAsRead('${notification.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn-delete" onclick="notificationOptimized.deleteNotification('${notification.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Formatar tempo
     */
    formatTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Agora';
        if (minutes < 60) return `${minutes}m atrás`;
        if (hours < 24) return `${hours}h atrás`;
        if (days < 7) return `${days}d atrás`;
        
        return date.toLocaleDateString();
    }

    /**
     * Configurar interface
     */
    setupUI() {
        // Configurar botão de notificações
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.toggleDropdown();
            });
        }
        
        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notification-dropdown');
            const btn = document.getElementById('notificationBtn');
            
            if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }

    /**
     * Alternar dropdown
     */
    toggleDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    /**
     * Fechar dropdown
     */
    closeDropdown() {
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    /**
     * Marcar como lida
     */
    async markAsRead(notificationId) {
        try {
            await this.apiCall(`/notifications/${notificationId}/read`, {
                method: 'PUT'
            });
            
            // Atualizar localmente
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.lida = true;
                this.unreadCount = Math.max(0, this.unreadCount - 1);
                this.updateUI();
            }
            
        } catch (error) {
            console.error('❌ Erro ao marcar notificação como lida:', error);
        }
    }

    /**
     * Marcar todas como lidas
     */
    async markAllAsRead() {
        try {
            await this.apiCall('/notifications/mark-all-read', {
                method: 'PUT'
            });
            
            // Atualizar localmente
            this.notifications.forEach(notification => {
                notification.lida = true;
            });
            this.unreadCount = 0;
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Erro ao marcar todas como lidas:', error);
        }
    }

    /**
     * Deletar notificação
     */
    async deleteNotification(notificationId) {
        try {
            await this.apiCall(`/notifications/${notificationId}`, {
                method: 'DELETE'
            });
            
            // Atualizar localmente
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.unreadCount = Math.max(0, this.unreadCount - 1);
            this.updateUI();
            
        } catch (error) {
            console.error('❌ Erro ao deletar notificação:', error);
        }
    }

    /**
     * Ver todas as notificações
     */
    viewAll() {
        // Implementar navegação para página de notificações
        window.location.href = '/notifications.html';
    }

    /**
     * Atualizar notificações
     */
    async refresh() {
        try {
            await this.loadNotifications();
        } catch (error) {
            console.error('❌ Erro ao atualizar notificações:', error);
        }
    }

    /**
     * Iniciar atualizações automáticas
     */
    startAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.refresh();
        }, this.config.updateInterval);
    }

    /**
     * Parar atualizações automáticas
     */
    stopAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Destruir sistema de notificações
     */
    destroy() {
        this.stopAutoUpdates();
        this.cache.clear();
        this.retryAttempts.clear();
        this.isInitialized = false;
        
        console.log('🗑️ Sistema de notificações destruído');
    }
}

// Instância global
window.notificationOptimized = new NotificationOptimized();

// Inicialização automática
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.notificationOptimized.initialize();
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de notificações:', error);
    }
});

// Exportar para uso global
window.NotificationOptimized = NotificationOptimized;
