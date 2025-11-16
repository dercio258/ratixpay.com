/**
 * Monitor de Pagamentos em Tempo Real
 * Escuta notificações de cancelamento automático via Socket.IO
 */

class PaymentMonitor {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // 1 segundo
    }

    /**
     * Conecta ao servidor Socket.IO
     */
    connect() {
        try {
            // Usar Socket.IO do CDN ou importar localmente
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnectionEstablished();
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.onConnectionLost();
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Erro de conexão:', error);
                this.handleReconnection();
            });

            // Escutar cancelamentos de pagamento
            this.socket.on('payment_cancelled', (data) => {
                this.handlePaymentCancellation(data);
            });

            // Escutar atualizações de status
            this.socket.on('payment_status_update', (data) => {
                this.handlePaymentStatusUpdate(data);
            });

        } catch (error) {
            console.error('❌ Erro ao conectar ao Socket.IO:', error);
            this.handleReconnection();
        }
    }

    /**
     * Entra em uma sala específica para receber atualizações de uma venda
     */
    joinVendaRoom(vendaId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('join', `venda_${vendaId}`);
        }
    }

    /**
     * Sai de uma sala específica
     */
    leaveVendaRoom(vendaId) {
        if (this.socket && this.isConnected) {
            this.socket.emit('leave', `venda_${vendaId}`);
        }
    }

    /**
     * Manipula cancelamento de pagamento
     */
    handlePaymentCancellation(data) {
        const { vendaId, publicId, motivo, tipoErro, timestamp } = data;
        
        // Fechar spinner de loading automaticamente
        this.closeLoadingSpinner();
        
        // Fechar modais de processamento
        this.closeProcessingModals();
        
        // Parar verificações de status se estiverem rodando
        this.stopStatusChecks();
        
        // Mostrar notificação para o usuário
        this.showCancellationNotification(publicId, motivo, tipoErro);
        
        // Atualizar interface se estiver na página de pagamento
        this.updatePaymentInterface('cancelled', motivo);
        
        // Log para debug
            motivo,
            tipoErro,
            timestamp
        });
    }

    /**
     * Manipula atualização de status de pagamento
     */
    handlePaymentStatusUpdate(data) {
        const { vendaId, publicId, status, timestamp } = data;
        
        // Atualizar interface com novo status
        this.updatePaymentInterface(status, null);
        
    }

    /**
     * Fecha o spinner de loading
     */
    closeLoadingSpinner() {
        // Fechar spinner principal
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        
        // Fechar spinner overlay
        const spinnerOverlay = document.querySelector('.spinner-overlay');
        if (spinnerOverlay) {
            spinnerOverlay.remove();
        }
        
        // Chamar função hideLoadingSpinner se existir
        if (typeof hideLoadingSpinner === 'function') {
            hideLoadingSpinner();
        }
    }

    /**
     * Para verificações de status em andamento
     */
    stopStatusChecks() {
        // Parar intervalos de verificação de status
        if (window.statusCheckInterval) {
            clearInterval(window.statusCheckInterval);
            window.statusCheckInterval = null;
        }
        
        // Parar timeouts de verificação
        if (window.statusCheckTimeout) {
            clearTimeout(window.statusCheckTimeout);
            window.statusCheckTimeout = null;
        }
    }

    /**
     * Fecha modais de processamento
     */
    closeProcessingModals() {
        // Fechar modal de processamento
        const processingModal = document.querySelector('.processing-modal');
        if (processingModal) {
            processingModal.remove();
        }
        
        // Fechar modal de transação
        const transactionModal = document.querySelector('.transaction-modal');
        if (transactionModal) {
            transactionModal.remove();
        }
        
        // Fechar modal de checkout
        const checkoutModal = document.getElementById('checkoutModal');
        if (checkoutModal) {
            checkoutModal.style.display = 'none';
        }
        
        // Restaurar scroll da página
        document.body.style.overflow = 'auto';
    }

    /**
     * Mostra notificação de cancelamento
     */
    showCancellationNotification(publicId, motivo, tipoErro) {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = 'payment-notification cancelled';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🚨</div>
                <div class="notification-text">
                    <h4>Pagamento Cancelado</h4>
                    <p>Venda #${publicId} foi cancelada automaticamente</p>
                    <small>Motivo: ${motivo}</small>
                    <div style="margin-top: 10px;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove(); window.location.reload();" 
                                style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px;">
                            🔄 Tentar Novamente
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                                style="background: #95a5a6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                            ✕ Fechar
                        </button>
                    </div>
                </div>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Remover automaticamente após 10 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }

    /**
     * Atualiza interface de pagamento
     */
    updatePaymentInterface(status, message) {
        // Fechar spinner se status for cancelado
        if (status === 'cancelled') {
            this.closeLoadingSpinner();
            this.closeProcessingModals();
        }
        
        // Buscar elementos da interface
        const statusElement = document.querySelector('.payment-status');
        const messageElement = document.querySelector('.payment-message');
        const buttonElement = document.querySelector('.payment-button');

        if (statusElement) {
            statusElement.textContent = this.getStatusText(status);
            statusElement.className = `payment-status ${status}`;
        }

        if (messageElement && message) {
            messageElement.textContent = message;
        }

        if (buttonElement) {
            if (status === 'cancelled') {
                buttonElement.textContent = 'Tentar Novamente';
                buttonElement.onclick = () => window.location.reload();
            } else if (status === 'approved') {
                buttonElement.textContent = 'Ver Produto';
                buttonElement.onclick = () => this.redirectToProduct();
            }
        }
    }

    /**
     * Retorna texto do status
     */
    getStatusText(status) {
        const statusTexts = {
            'pending': 'Pendente',
            'approved': 'Pagamento Aprovado',
            'cancelled': 'Pagamento Cancelado',
            'failed': 'Pagamento Falhou'
        };
        return statusTexts[status] || status;
    }

    /**
     * Redireciona para o produto após pagamento aprovado
     */
    redirectToProduct() {
        // Implementar redirecionamento para o produto
        const productLink = document.querySelector('[data-product-link]');
        if (productLink) {
            window.location.href = productLink.dataset.productLink;
        }
    }

    /**
     * Manipula reconexão
     */
    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            this.onMaxReconnectAttemptsReached();
        }
    }

    /**
     * Callback quando conexão é estabelecida
     */
    onConnectionEstablished() {
        // Reentrar nas salas necessárias se houver
        this.rejoinRooms();
    }

    /**
     * Callback quando conexão é perdida
     */
    onConnectionLost() {
        // Implementar lógica de fallback se necessário
    }

    /**
     * Callback quando máximo de tentativas de reconexão é atingido
     */
    onMaxReconnectAttemptsReached() {
        console.error('❌ Não foi possível reconectar ao servidor de pagamentos');
        // Implementar notificação para o usuário
        this.showConnectionError();
    }

    /**
     * Reentra nas salas necessárias após reconexão
     */
    rejoinRooms() {
        // Implementar lógica para reentrar nas salas necessárias
        const currentVendaId = this.getCurrentVendaId();
        if (currentVendaId) {
            this.joinVendaRoom(currentVendaId);
        }
    }

    /**
     * Obtém ID da venda atual (implementar conforme necessário)
     */
    getCurrentVendaId() {
        // Implementar lógica para obter ID da venda atual
        // Pode ser do localStorage, URL, ou elemento da página
        return localStorage.getItem('currentVendaId');
    }

    /**
     * Mostra erro de conexão
     */
    showConnectionError() {
        const notification = document.createElement('div');
        notification.className = 'payment-notification error';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">⚠️</div>
                <div class="notification-text">
                    <h4>Erro de Conexão</h4>
                    <p>Não foi possível conectar ao servidor de pagamentos</p>
                    <small>As atualizações em tempo real podem não funcionar</small>
                </div>
            </div>
        `;

        document.body.appendChild(notification);
    }

    /**
     * Desconecta do servidor
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// CSS para as notificações
const notificationStyles = `
<style>
.payment-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    max-width: 400px;
    animation: slideIn 0.3s ease-out;
}

.payment-notification.cancelled {
    border-left: 4px solid #e74c3c;
}

.payment-notification.error {
    border-left: 4px solid #f39c12;
}

.notification-content {
    display: flex;
    align-items: center;
    padding: 16px;
}

.notification-icon {
    font-size: 24px;
    margin-right: 12px;
}

.notification-text {
    flex: 1;
}

.notification-text h4 {
    margin: 0 0 4px 0;
    font-size: 16px;
    font-weight: 600;
}

.notification-text p {
    margin: 0 0 4px 0;
    font-size: 14px;
    color: #666;
}

.notification-text small {
    font-size: 12px;
    color: #999;
}

.notification-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #999;
    padding: 0;
    margin-left: 12px;
}

.notification-close:hover {
    color: #333;
}

@keyframes slideIn {
    from {
        transform: translateX(100%);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.payment-status {
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: 600;
    text-align: center;
}

.payment-status.pending {
    background: #f39c12;
    color: white;
}

.payment-status.approved {
    background: #27ae60;
    color: white;
}

.payment-status.cancelled {
    background: #e74c3c;
    color: white;
}

.payment-status.failed {
    background: #95a5a6;
    color: white;
}
</style>
`;

// Adicionar estilos ao documento
document.head.insertAdjacentHTML('beforeend', notificationStyles);

// Função global para fechar spinner (pode ser chamada de qualquer lugar)
window.closePaymentSpinner = function() {
    if (window.paymentMonitor) {
        window.paymentMonitor.closeLoadingSpinner();
        window.paymentMonitor.closeProcessingModals();
        window.paymentMonitor.stopStatusChecks();
    } else {
        // Fallback se o monitor não estiver disponível
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) spinner.style.display = 'none';
        
        const spinnerOverlay = document.querySelector('.spinner-overlay');
        if (spinnerOverlay) spinnerOverlay.remove();
        
        const processingModal = document.querySelector('.processing-modal');
        if (processingModal) processingModal.remove();
        
        const transactionModal = document.querySelector('.transaction-modal');
        if (transactionModal) transactionModal.remove();
        
        // Parar verificações de status
        if (window.statusCheckInterval) {
            clearInterval(window.statusCheckInterval);
            window.statusCheckInterval = null;
        }
        
        if (window.statusCheckTimeout) {
            clearTimeout(window.statusCheckTimeout);
            window.statusCheckTimeout = null;
        }
        
        document.body.style.overflow = 'auto';
        
        if (typeof hideLoadingSpinner === 'function') {
            hideLoadingSpinner();
        }
    }
};

// Inicializar monitor quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.paymentMonitor = new PaymentMonitor();
    window.paymentMonitor.connect();
});

// Exportar para uso global
window.PaymentMonitor = PaymentMonitor;
