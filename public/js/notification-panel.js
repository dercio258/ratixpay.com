/**
 * Notification Panel - Sistema de Notificações
 * Gerencia a exibição e interação com notificações
 */

class NotificationPanel {
    constructor() {
        this.notifications = [];
        this.isOpen = false;
        this.init();
    }

    async init() {
        // Remover elemento notification-toast se existir
        this.removeNotificationToast();
        
        await this.carregarNotificacoes();
        this.configurarEventos();
        this.atualizarContador();
        
        // Atualizar notificações a cada 15 segundos para melhor responsividade
        setInterval(() => {
            this.carregarNotificacoes();
        }, 15000);

        // Atualizar contador a cada 10 segundos
        setInterval(() => {
            this.atualizarContador();
        }, 10000);
    }
    
    /**
     * Remove elemento notification-toast se existir
     */
    removeNotificationToast() {
        const toast = document.querySelector('.notification-toast');
        if (toast) {
            toast.remove();
            console.log('✅ Elemento notification-toast removido do DOM');
        }
    }

    configurarEventos() {
        const panel = document.getElementById('notification-panel');
        console.log('Notification panel encontrado:', panel ? 'Sim' : 'Não');
        if (panel) {
            panel.addEventListener('click', () => {
                console.log('Clique no notification panel detectado');
                this.togglePanel();
            });
        }

        // Fechar panel ao clicar fora
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('notification-panel');
            const dropdown = document.getElementById('notification-dropdown');
            
            if (panel && dropdown && !panel.contains(e.target) && !dropdown.contains(e.target)) {
                this.fecharPanel();
            }
        });
    }

    async carregarNotificacoes() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            console.log('Token encontrado:', token ? 'Sim' : 'Não');
            console.log('API_BASE:', window.API_BASE);
            
            // Salvar contador anterior para detectar novas notificações
            const contadorAnterior = this.notifications.length;
            
            const response = await fetch(`${API_BASE}/notificacoes/nao-lidas`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar notificações');
            }

            const data = await response.json();
            console.log('Resposta da API:', data);
            const novasNotificacoes = data.notificacoes || [];
            
            // Detectar novas notificações
            const temNovasNotificacoes = novasNotificacoes.length > contadorAnterior;
            if (temNovasNotificacoes) {
                console.log('🔔 Novas notificações detectadas!');
                this.mostrarIndicadorNovaNotificacao();
            }
            
            this.notifications = novasNotificacoes;
            console.log('Notificações processadas:', this.notifications);
            this.atualizarContador();
            this.renderizarNotificacoes();

        } catch (error) {
            console.error('Erro ao carregar notificações:', error);
        }
    }

    atualizarContador() {
        const contador = document.getElementById('notificationCount');
        console.log('Atualizando contador:', this.notifications.length);
        console.log('Contador encontrado:', contador ? 'Sim' : 'Não');
        if (contador) {
            contador.textContent = this.notifications.length;
            contador.style.display = this.notifications.length > 0 ? 'flex' : 'none';
            console.log('Contador atualizado para:', contador.textContent);
        }
    }

    mostrarIndicadorNovaNotificacao() {
        // Criar indicador visual de nova notificação
        const panel = document.getElementById('notification-panel');
        if (panel) {
            // Adicionar classe de animação
            panel.classList.add('nova-notificacao');
            
            // Remover classe após animação
            setTimeout(() => {
                panel.classList.remove('nova-notificacao');
            }, 2000);
        }

        // Mostrar notificação toast - DESABILITADO
        // this.mostrarToastNotificacao('🔔 Nova venda realizada!');
    }

    mostrarToastNotificacao(mensagem) {
        // DESABILITADO: notification-toast removido conforme solicitado
        console.log('⚠️ Notificação toast desabilitada:', mensagem);
        return;
        
        // Código original comentado para referência
        /*
        // Criar elemento toast
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-bell"></i>
                <span>${mensagem}</span>
            </div>
        `;

        // Adicionar estilos
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
        `;

        // Adicionar ao DOM
        document.body.appendChild(toast);

        // Remover após 4 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 4000);
        */
    }

    renderizarNotificacoes() {
        console.log('renderizarNotificacoes chamado');
        console.log('Número de notificações:', this.notifications.length);
        console.log('Notificações:', this.notifications);
        
        const dropdown = document.getElementById('notification-dropdown');
        console.log('Dropdown encontrado:', dropdown ? 'Sim' : 'Não');
        if (!dropdown) {
            console.log('Criando dropdown...');
            this.criarDropdown();
            return;
        }

        const notificationsList = dropdown.querySelector('.notifications-list');
        console.log('Notifications list encontrado:', notificationsList ? 'Sim' : 'Não');
        if (!notificationsList) return;

        if (this.notifications.length === 0) {
            console.log('Mostrando mensagem de notificações vazias');
            notificationsList.innerHTML = `
                <div class="notification-empty">
                    <i class="fas fa-bell-slash"></i>
                    <p>Nenhuma notificação</p>
                </div>
            `;
            return;
        }

        notificationsList.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.status}" data-id="${notification.id}">
                <div class="notification-header-row">
                    <div class="notification-title-row">
                        <div class="notification-icon">
                            <i class="fas ${this.getNotificationIcon(notification.tipo)}"></i>
                        </div>
                        <div class="notification-title">${notification.titulo}</div>
                    </div>
                </div>
                <div class="notification-message">${this.truncateText(notification.mensagem, 60)}</div>
                <div class="notification-footer-row">
                    <div class="notification-time">${this.formatTime(notification.created_at)}</div>
                    <div class="notification-actions">
                        <button class="btn-mark-read" onclick="notificationPanel.marcarComoLida('${notification.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    criarDropdown() {
        console.log('criarDropdown chamado');
        const panel = document.getElementById('notification-panel');
        console.log('Panel encontrado:', panel ? 'Sim' : 'Não');
        if (!panel) return;

        // Criar dropdown
        const dropdown = document.createElement('div');
        dropdown.id = 'notification-dropdown';
        dropdown.className = 'notification-dropdown';
        dropdown.innerHTML = `
            <div class="notification-header">
                <h4>Notificações</h4>
                <div class="notification-actions-header">
                    <button class="btn-mark-all-read" onclick="notificationPanel.marcarTodasComoLidas()">
                        <i class="fas fa-check-double"></i>
                        Marcar todas como lidas
                    </button>
                    <button class="btn-view-all" onclick="notificationPanel.verTodas()">
                        <i class="fas fa-list"></i>
                        Ver todas
                    </button>
                </div>
            </div>
            <div class="notifications-list">
                <!-- Notificações serão renderizadas aqui -->
            </div>
        `;

        console.log('Dropdown criado:', dropdown);
        console.log('HTML do dropdown:', dropdown.innerHTML);

        // Adicionar estilos
        this.adicionarEstilos();
        
        // Inserir dropdown no body para fixed positioning
        document.body.appendChild(dropdown);
        console.log('Dropdown inserido no DOM');
        
        // Renderizar notificações
        this.renderizarNotificacoes();
    }

    adicionarEstilos() {
        if (document.getElementById('notification-panel-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-panel-styles';
        style.textContent = `
            .notification-dropdown {
                position: fixed;
                top: 120px;
                right: 30px;
                width: 350px;
                max-height: 500px;
                background: #000000;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                z-index: 9999;
                display: none;
                overflow: hidden;
                border: 1px solid #333;
            }

            .notification-dropdown.show {
                display: block;
            }

            .notification-header {
                padding: 15px 20px;
                border-bottom: 1px solid #333333;
                background: #1a1a1a;
            }

            .notification-header h4 {
                margin: 0 0 10px 0;
                color: #ffffff;
                font-size: 16px;
            }

            .notification-actions-header {
                display: flex;
                gap: 10px;
            }

            .notification-actions-header button {
                background: none;
                border: 1px solid #555;
                padding: 5px 10px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                color: #ccc;
                transition: all 0.3s ease;
            }

            .notification-actions-header button:hover {
                background: #333;
                border-color: #E67E22;
                color: #E67E22;
            }

            .notifications-list {
                max-height: 400px;
                overflow-y: auto;
                background: #111111;
                min-height: 100px;
                padding: 10px;
            }

            .notification-item {
                display: flex;
                flex-direction: column;
                padding: 15px 20px;
                border-bottom: 1px solid #333;
                transition: background-color 0.3s ease;
                cursor: pointer;
                background: #1a1a1a;
                margin: 5px;
                border-radius: 8px;
                gap: 8px;
            }

            .notification-item:hover {
                background: #1a1a1a;
            }

            .notification-item.unread {
                background: #2a2a2a;
                border-left: 4px solid #E67E22;
            }

            .notification-header-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
            }

            .notification-title-row {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .notification-icon {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 20px;
                height: 20px;
            }

            .notification-icon i {
                font-size: 16px;
                color: #E67E22;
            }

            .notification-title {
                font-weight: 600;
                color: #ffffff;
                font-size: 14px;
                margin: 0;
            }

            .notification-message {
                color: #ccc;
                font-size: 13px;
                line-height: 1.4;
                margin: 0;
                padding-left: 30px;
            }

            .notification-footer-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                padding-left: 30px;
            }

            .notification-time {
                color: #888;
                font-size: 11px;
                margin: 0;
            }

            .notification-actions {
                display: flex;
                align-items: center;
            }

            .btn-mark-read {
                background: none;
                border: none;
                color: #28a745;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                transition: all 0.3s ease;
            }

            .btn-mark-read:hover {
                background: #28a745;
                color: white;
            }

            .notification-empty {
                text-align: center;
                padding: 40px 20px;
                color: #888;
                background: #222222;
                border-radius: 8px;
                margin: 10px;
            }

            .notification-empty i {
                font-size: 2rem;
                margin-bottom: 10px;
                color: #555;
            }

            /* Responsividade */
            @media (max-width: 768px) {
                .notification-dropdown {
                    width: 300px;
                    right: 20px;
                    top: 100px;
                }
            }

            @media (max-width: 480px) {
                .notification-dropdown {
                    width: 280px;
                    right: 15px;
                    top: 90px;
                }
            }

            /* Animações para notificações */
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

            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            @keyframes pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
                100% {
                    transform: scale(1);
                }
            }

            .nova-notificacao {
                animation: pulse 0.5s ease-in-out 3;
            }

            .notification-toast .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .notification-toast .toast-content i {
                font-size: 18px;
            }
        `;

        document.head.appendChild(style);
    }

    togglePanel() {
        console.log('togglePanel chamado, isOpen atual:', this.isOpen);
        const dropdown = document.getElementById('notification-dropdown');
        console.log('Dropdown encontrado:', dropdown ? 'Sim' : 'Não');
        
        if (!dropdown) {
            console.log('Criando dropdown...');
            this.criarDropdown();
            return;
        }

        this.isOpen = !this.isOpen;
        console.log('Novo estado isOpen:', this.isOpen);
        dropdown.classList.toggle('show', this.isOpen);
        console.log('Classe show aplicada:', dropdown.classList.contains('show'));

        if (this.isOpen) {
            this.carregarNotificacoes();
        }
    }

    fecharPanel() {
        this.isOpen = false;
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.remove('show');
        }
    }

    async marcarComoLida(notificationId) {
        try {
            const response = await fetch(`${API_BASE}/notificacoes/${notificationId}/marcar-lida`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao marcar notificação como lida');
            }

            // Remover notificação da lista local
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.atualizarContador();
            this.renderizarNotificacoes();

        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
        }
    }

    async marcarTodasComoLidas() {
        try {
            const response = await fetch(`${API_BASE}/notificacoes/marcar-todas-lidas`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao marcar todas as notificações como lidas');
            }

            // Limpar lista local
            this.notifications = [];
            this.atualizarContador();
            this.renderizarNotificacoes();

        } catch (error) {
            console.error('Erro ao marcar todas as notificações como lidas:', error);
        }
    }

    verTodas() {
        // Implementar página de todas as notificações
        console.log('Ver todas as notificações');
        this.fecharPanel();
    }

    getNotificationIcon(tipo) {
        const icons = {
            'sistema': 'fa-cog',
            'promocao': 'fa-percent',
            'venda': 'fa-shopping-cart',
            'pagamento': 'fa-credit-card'
        };
        return icons[tipo] || 'fa-bell';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

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
        
        return date.toLocaleDateString('pt-BR');
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, procurando notification-panel...');
    // Verificar se existe o notification-panel
    const panel = document.getElementById('notification-panel');
    console.log('Panel encontrado na inicialização:', panel ? 'Sim' : 'Não');
    if (panel) {
        console.log('Criando NotificationPanel...');
        window.notificationPanel = new NotificationPanel();
        console.log('NotificationPanel criado:', window.notificationPanel);
    } else {
        console.log('NotificationPanel não encontrado, não será inicializado');
    }
});
