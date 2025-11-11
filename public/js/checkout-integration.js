/**
 * Integração do Monitor de Pagamentos com Checkout
 * Este arquivo integra o sistema de cancelamento automático com o checkout-new.js
 */

class CheckoutIntegration {
    constructor() {
        this.paymentMonitor = null;
        this.currentTransactionId = null;
        this.statusCheckInterval = null;
        this.statusCheckTimeout = null;
    }

    /**
     * Inicializar integração
     */
    init() {
        // Aguardar o monitor estar disponível
        this.waitForMonitor();
    }

    /**
     * Aguardar o monitor de pagamentos estar disponível
     */
    waitForMonitor() {
        const checkMonitor = () => {
            if (window.paymentMonitor) {
                this.paymentMonitor = window.paymentMonitor;
                this.setupIntegration();
                console.log('✅ Integração do checkout com monitor de pagamentos ativa');
            } else {
                setTimeout(checkMonitor, 100);
            }
        };
        checkMonitor();
    }

    /**
     * Configurar integração
     */
    setupIntegration() {
        // Sobrescrever funções do checkout para integrar com o monitor
        this.overrideStatusCheck();
        this.overrideShowTransactionStatus();
        this.overrideShowLoadingSpinner();
    }

    /**
     * Sobrescrever verificação de status para integrar com o monitor
     */
    overrideStatusCheck() {
        // Salvar função original se existir
        if (typeof startStatusCheck === 'function') {
            window.originalStartStatusCheck = startStatusCheck;
        }

        // Sobrescrever função startStatusCheck
        window.startStatusCheck = (transactionId) => {
            this.currentTransactionId = transactionId;
            
            // Entrar na sala da venda no monitor
            if (this.paymentMonitor) {
                this.paymentMonitor.joinVendaRoom(transactionId);
            }

            // Chamar função original se existir
            if (window.originalStartStatusCheck) {
                return window.originalStartStatusCheck(transactionId);
            }

            // Implementação padrão se não houver função original
            this.startStatusCheckDefault(transactionId);
        };
    }

    /**
     * Implementação padrão de verificação de status
     */
    startStatusCheckDefault(transactionId) {
        let checkCount = 0;
        const maxChecks = 12;
        const checkInterval = 5000;

        console.log('🔄 Iniciando verificação de status integrada...');

        this.statusCheckInterval = setInterval(async () => {
            try {
                checkCount++;
                console.log(`🔄 Verificando status (${checkCount}/${maxChecks})...`);

                const response = await fetch(`${window.API_BASE}/status/${transactionId}`, {
                    method: 'GET',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                });

                if (!response.ok) {
                    console.log(`❌ Erro HTTP ${response.status} ao verificar status`);
                    
                    if (response.status >= 400) {
                        this.handleStatusError(transactionId, response.status);
                        return;
                    }
                    
                    throw new Error(`Erro ao verificar status: ${response.status}`);
                }

                const result = await response.json();
                console.log(`🔄 Verificação ${checkCount}/${maxChecks} - Resposta:`, result);

                if (result.error || result.success === false) {
                    this.handleStatusError(transactionId, result.error || result.message);
                    return;
                }

                // Verificar se o status mudou
                if (result.data && result.data.status) {
                    const status = result.data.status.toLowerCase();
                    
                    if (status === 'aprovado' || status === 'approved') {
                        this.handlePaymentSuccess(transactionId, result.data);
                        return;
                    } else if (status === 'cancelado' || status === 'cancelled' || status === 'rejeitado' || status === 'rejected') {
                        this.handlePaymentCancellation(transactionId, result.data);
                        return;
                    }
                }

                // Verificar se atingiu o limite de verificações
                if (checkCount >= maxChecks) {
                    this.handleStatusTimeout(transactionId);
                    return;
                }

            } catch (error) {
                console.error('❌ Erro na verificação de status:', error);
                this.handleStatusError(transactionId, error.message);
            }
        }, checkInterval);

        // Timeout total
        this.statusCheckTimeout = setTimeout(() => {
            this.handleStatusTimeout(transactionId);
        }, 60000);
    }

    /**
     * Manipular erro de status
     */
    handleStatusError(transactionId, error) {
        this.stopStatusChecks();
        
        // Fechar spinner e modais
        if (window.closePaymentSpinner) {
            window.closePaymentSpinner();
        }

        // Mostrar status de erro
        this.showTransactionStatus('failed', 'Erro do Servidor', transactionId, '', error);

        // Atualizar status no backend
        this.updateVendaStatus(transactionId, 'Cancelado', `Erro do servidor: ${error}`);
    }

    /**
     * Manipular sucesso do pagamento
     */
    handlePaymentSuccess(transactionId, data) {
        this.stopStatusChecks();
        
        // Fechar spinner e modais
        if (window.closePaymentSpinner) {
            window.closePaymentSpinner();
        }

        // Mostrar status de sucesso
        this.showTransactionStatus('completed', 'Pagamento Aprovado', transactionId);

        // Sair da sala da venda
        if (this.paymentMonitor) {
            this.paymentMonitor.leaveVendaRoom(transactionId);
        }
    }

    /**
     * Manipular cancelamento do pagamento
     */
    handlePaymentCancellation(transactionId, data) {
        this.stopStatusChecks();
        
        // Fechar spinner e modais
        if (window.closePaymentSpinner) {
            window.closePaymentSpinner();
        }

        // Mostrar status de cancelamento
        const motivo = data.falha_motivo || data.motivo || 'Pagamento cancelado';
        this.showTransactionStatus('cancelled', 'Pagamento Cancelado', transactionId, '', motivo);

        // Sair da sala da venda
        if (this.paymentMonitor) {
            this.paymentMonitor.leaveVendaRoom(transactionId);
        }
    }

    /**
     * Manipular timeout de status
     */
    handleStatusTimeout(transactionId) {
        this.stopStatusChecks();
        
        // Fechar spinner e modais
        if (window.closePaymentSpinner) {
            window.closePaymentSpinner();
        }

        // Mostrar status de timeout
        this.showTransactionStatus('failed', 'Timeout', transactionId, '', 'Tempo limite excedido');

        // Atualizar status no backend
        this.updateVendaStatus(transactionId, 'Cancelado', 'Timeout na verificação de status');
    }

    /**
     * Parar verificações de status
     */
    stopStatusChecks() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        
        if (this.statusCheckTimeout) {
            clearTimeout(this.statusCheckTimeout);
            this.statusCheckTimeout = null;
        }
    }

    /**
     * Atualizar status da venda no backend
     */
    async updateVendaStatus(transactionId, status, motivo) {
        try {
            await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify({
                    status: status,
                    motivo: motivo
                })
            });
            console.log(`✅ Status da venda atualizado para ${status}`);
        } catch (error) {
            console.error('❌ Erro ao atualizar status da venda:', error);
        }
    }

    /**
     * Mostrar status da transação
     */
    showTransactionStatus(status, message, transactionId, falhaId = '', falhaMotivo = '') {
        // Usar função original se existir
        if (typeof showTransactionStatus === 'function') {
            return showTransactionStatus(status, message, transactionId, falhaId, falhaMotivo);
        }

        // Implementação padrão
        console.log(`📊 Status da transação: ${status} - ${message}`);
        
        // Fechar modais existentes
        const existingModal = document.querySelector('.transaction-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Criar modal de status
        const modal = document.createElement('div');
        modal.className = 'transaction-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="status-icon" style="color: ${this.getStatusColor(status)}; font-size: 3rem; margin-bottom: 20px;">
                    <i class="fas fa-${this.getStatusIcon(status)}"></i>
                </div>
                <h3>${message}</h3>
                <div class="transaction-info">
                    <p><strong>ID da Transação:</strong> ${transactionId}</p>
                    <p><strong>Status:</strong> <span style="color:${this.getStatusColor(status)};font-weight:bold;">${status}</span></p>
                    ${falhaMotivo ? `<p><strong>Motivo:</strong> ${falhaMotivo}</p>` : ''}
                </div>
                <div class="button-group">
                    <button onclick="this.parentElement.parentElement.parentElement.remove(); window.location.reload();" 
                            style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px;">
                        🔄 Tentar Novamente
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                            style="background: #95a5a6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px;">
                        ✕ Fechar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Obter cor do status
     */
    getStatusColor(status) {
        const colors = {
            'pending': '#f59e42',
            'completed': '#28a745',
            'cancelled': '#dc3545',
            'failed': '#dc3545'
        };
        return colors[status] || '#888';
    }

    /**
     * Obter ícone do status
     */
    getStatusIcon(status) {
        const icons = {
            'pending': 'clock',
            'completed': 'check-circle',
            'cancelled': 'times-circle',
            'failed': 'exclamation-triangle'
        };
        return icons[status] || 'info-circle';
    }
}

// Inicializar integração quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.checkoutIntegration = new CheckoutIntegration();
    window.checkoutIntegration.init();
});

// Exportar para uso global
window.CheckoutIntegration = CheckoutIntegration;
