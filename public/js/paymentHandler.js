class PaymentHandler {
    constructor() {
        this.paymentId = null;
        this.statusCheckInterval = null;
        this.maxStatusChecks = 60; // 5 minutos (60 * 5 segundos)
        this.statusCheckCount = 0;
        this.isProcessing = false;
        this.statusCheckInterval = 5000; // 5 segundos
        
        this.setupEventListeners();
    }

    // Configurar listeners de eventos
    setupEventListeners() {
        // Listener para WebSocket (se disponível)
        if (window.io) {
            window.io.on('paymentUpdate', (data) => {
                this.handlePaymentUpdate(data);
            });
        }

        // Listener para visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseStatusChecking();
            } else {
                this.resumeStatusChecking();
            }
        });

        // Listener para fechamento da página
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    // Iniciar pagamento
    async initiatePayment(paymentData) {
        try {
            this.isProcessing = true;
            this.statusCheckCount = 0;

            // Mostrar modal de processamento
            this.showProcessingModal();

            // Enviar requisição para iniciar pagamento
            const response = await fetch('/api/payment-status/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(paymentData)
            });

            const result = await response.json();

            if (result.success) {
                this.paymentId = result.paymentId;
                this.startStatusChecking();
                
                console.log('✅ Pagamento iniciado:', this.paymentId);
                return result;
            } else {
                this.handlePaymentError(result.message || 'Erro ao iniciar pagamento');
                return null;
            }

        } catch (error) {
            console.error('❌ Erro ao iniciar pagamento:', error);
            this.handlePaymentError('Erro de conexão. Tente novamente.');
            return null;
        }
    }

    // Iniciar verificação de status
    startStatusChecking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        this.statusCheckInterval = setInterval(() => {
            this.checkPaymentStatus();
        }, this.statusCheckInterval);

        console.log('🔄 Verificação de status iniciada');
    }

    // Verificar status do pagamento
    async checkPaymentStatus() {
        if (!this.paymentId || this.statusCheckCount >= this.maxStatusChecks) {
            this.stopStatusChecking();
            this.handlePaymentTimeout();
            return;
        }

        try {
            this.statusCheckCount++;

            const response = await fetch(`/api/payment-status/status/${this.paymentId}`);
            const result = await response.json();

            if (result.success) {
                this.handleStatusUpdate(result);
            } else {
                console.error('❌ Erro ao verificar status:', result.message);
            }

        } catch (error) {
            console.error('❌ Erro na verificação de status:', error);
            
            // Se houver erro de conexão, parar verificação
            if (this.statusCheckCount >= 3) {
                this.stopStatusChecking();
                this.handlePaymentError('Erro de conexão. Verifique sua internet.');
            }
        }
    }

    // Manipular atualização de status
    handleStatusUpdate(statusData) {
        const { status, isProcessing, message } = statusData;

        console.log(`📊 Status do pagamento: ${status}`);

        // Atualizar UI baseado no status
        switch (status) {
            case 'success':
                this.handlePaymentSuccess(statusData);
                break;
            case 'failed':
            case 'cancelled':
            case 'rejected':
                this.handlePaymentFailure(statusData);
                break;
            case 'timeout':
                this.handlePaymentTimeout();
                break;
            case 'error':
                this.handlePaymentError(message || 'Erro no processamento');
                break;
            case 'pending':
                if (!isProcessing) {
                    this.handlePaymentTimeout();
                } else {
                    this.updateProcessingMessage(message || 'Processando pagamento...');
                }
                break;
            default:
                console.log(`⚠️ Status desconhecido: ${status}`);
        }
    }

    // Manipular sucesso do pagamento
    handlePaymentSuccess(statusData) {
        this.stopStatusChecking();
        this.isProcessing = false;

        // Mostrar modal de sucesso
        this.showSuccessModal({
            message: 'Pagamento processado com sucesso!',
            paymentId: this.paymentId,
            data: statusData
        });

        // Emitir evento de sucesso
        this.emitEvent('paymentSuccess', {
            paymentId: this.paymentId,
            data: statusData
        });

        console.log('✅ Pagamento processado com sucesso');
    }

    // Manipular falha do pagamento
    handlePaymentFailure(statusData) {
        this.stopStatusChecking();
        this.isProcessing = false;

        // Mostrar modal de falha
        this.showFailureModal({
            message: statusData.message || 'Pagamento não foi processado.',
            paymentId: this.paymentId,
            data: statusData
        });

        // Emitir evento de falha
        this.emitEvent('paymentFailure', {
            paymentId: this.paymentId,
            data: statusData
        });

        console.log('❌ Pagamento falhou');
    }

    // Manipular timeout do pagamento
    handlePaymentTimeout() {
        this.stopStatusChecking();
        this.isProcessing = false;

        // Mostrar modal de timeout
        this.showTimeoutModal({
            message: 'Pagamento expirado por timeout. Tente novamente.',
            paymentId: this.paymentId
        });

        // Emitir evento de timeout
        this.emitEvent('paymentTimeout', {
            paymentId: this.paymentId
        });

        console.log('⏰ Pagamento expirado por timeout');
    }

    // Manipular erro do pagamento
    handlePaymentError(message) {
        this.stopStatusChecking();
        this.isProcessing = false;

        // Mostrar modal de erro
        this.showErrorModal({
            message: message || 'Erro no processamento do pagamento.',
            paymentId: this.paymentId
        });

        // Emitir evento de erro
        this.emitEvent('paymentError', {
            paymentId: this.paymentId,
            message: message
        });

        console.log('💥 Erro no pagamento:', message);
    }

    // Cancelar pagamento
    async cancelPayment() {
        if (!this.paymentId) {
            console.log('⚠️ Nenhum pagamento para cancelar');
            return;
        }

        try {
            const response = await fetch(`/api/payment-status/cancel/${this.paymentId}`, {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                this.stopStatusChecking();
                this.isProcessing = false;

                // Mostrar modal de cancelamento
                this.showCancelledModal({
                    message: 'Pagamento cancelado com sucesso.',
                    paymentId: this.paymentId
                });

                // Emitir evento de cancelamento
                this.emitEvent('paymentCancelled', {
                    paymentId: this.paymentId
                });

                console.log('🚫 Pagamento cancelado');
            } else {
                console.error('❌ Erro ao cancelar pagamento:', result.message);
            }

        } catch (error) {
            console.error('❌ Erro ao cancelar pagamento:', error);
        }
    }

    // Parar verificação de status
    stopStatusChecking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        console.log('⏹️ Verificação de status parada');
    }

    // Pausar verificação de status
    pauseStatusChecking() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        console.log('⏸️ Verificação de status pausada');
    }

    // Retomar verificação de status
    resumeStatusChecking() {
        if (this.paymentId && this.isProcessing && !this.statusCheckInterval) {
            this.startStatusChecking();
        }
        console.log('▶️ Verificação de status retomada');
    }

    // Limpeza
    cleanup() {
        this.stopStatusChecking();
        this.paymentId = null;
        this.isProcessing = false;
        this.statusCheckCount = 0;
        console.log('🧹 PaymentHandler limpo');
    }

    // Mostrar modal de processamento
    showProcessingModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Processando Pagamento</h3>
                    </div>
                    <div class="modal-body">
                        <div class="processing-spinner">
                            <div class="spinner"></div>
                        </div>
                        <p id="processingMessage">Processando pagamento...</p>
                        <p class="processing-note">Não feche esta janela até o pagamento ser processado.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="paymentHandler.cancelPayment()">
                            Cancelar Pagamento
                        </button>
                    </div>
                </div>
            `;
            modal.style.display = 'block';
        }
    }

    // Atualizar mensagem de processamento
    updateProcessingMessage(message) {
        const messageElement = document.getElementById('processingMessage');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    // Mostrar modal de sucesso
    showSuccessModal(data) {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header success">
                        <h3>✅ Pagamento Processado!</h3>
                    </div>
                    <div class="modal-body">
                        <p>${data.message}</p>
                        <p><strong>ID do Pagamento:</strong> ${data.paymentId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="paymentHandler.closeModal()">
                            Fechar
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Mostrar modal de falha
    showFailureModal(data) {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header error">
                        <h3>❌ Pagamento Não Processado</h3>
                    </div>
                    <div class="modal-body">
                        <p>${data.message}</p>
                        <p><strong>ID do Pagamento:</strong> ${data.paymentId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="paymentHandler.closeModal()">
                            Fechar
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="paymentHandler.retryPayment()">
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Mostrar modal de timeout
    showTimeoutModal(data) {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header warning">
                        <h3>⏰ Pagamento Expirado</h3>
                    </div>
                    <div class="modal-body">
                        <p>${data.message}</p>
                        <p><strong>ID do Pagamento:</strong> ${data.paymentId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="paymentHandler.closeModal()">
                            Fechar
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="paymentHandler.retryPayment()">
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Mostrar modal de erro
    showErrorModal(data) {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header error">
                        <h3>💥 Erro no Pagamento</h3>
                    </div>
                    <div class="modal-body">
                        <p>${data.message}</p>
                        <p><strong>ID do Pagamento:</strong> ${data.paymentId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="paymentHandler.closeModal()">
                            Fechar
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="paymentHandler.retryPayment()">
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Mostrar modal de cancelamento
    showCancelledModal(data) {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header warning">
                        <h3>🚫 Pagamento Cancelado</h3>
                    </div>
                    <div class="modal-body">
                        <p>${data.message}</p>
                        <p><strong>ID do Pagamento:</strong> ${data.paymentId}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="paymentHandler.closeModal()">
                            Fechar
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Fechar modal
    closeModal() {
        const modal = document.getElementById('paymentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.cleanup();
    }

    // Tentar pagamento novamente
    retryPayment() {
        this.closeModal();
        // Emitir evento para tentar novamente
        this.emitEvent('paymentRetry', {
            paymentId: this.paymentId
        });
    }

    // Manipular atualização via WebSocket
    handlePaymentUpdate(data) {
        if (data.paymentId === this.paymentId) {
            this.handleStatusUpdate(data.data);
        }
    }

    // Emitir evento personalizado
    emitEvent(eventName, data) {
        const event = new CustomEvent(eventName, {
            detail: data
        });
        document.dispatchEvent(event);
    }

    // Configurar parâmetros
    configure(options = {}) {
        if (options.maxStatusChecks) {
            this.maxStatusChecks = options.maxStatusChecks;
        }
        
        if (options.statusCheckInterval) {
            this.statusCheckInterval = options.statusCheckInterval;
        }

        console.log('⚙️ PaymentHandler configurado:', options);
    }
}

// Instância global
const paymentHandler = new PaymentHandler();

// Event listeners para eventos personalizados
document.addEventListener('paymentSuccess', (event) => {
    console.log('🎉 Pagamento processado com sucesso:', event.detail);
    // Aqui você pode adicionar lógica adicional para sucesso
});

document.addEventListener('paymentFailure', (event) => {
    console.log('❌ Pagamento falhou:', event.detail);
    // Aqui você pode adicionar lógica adicional para falha
});

document.addEventListener('paymentTimeout', (event) => {
    console.log('⏰ Pagamento expirado:', event.detail);
    // Aqui você pode adicionar lógica adicional para timeout
});

document.addEventListener('paymentError', (event) => {
    console.log('💥 Erro no pagamento:', event.detail);
    // Aqui você pode adicionar lógica adicional para erro
});

document.addEventListener('paymentCancelled', (event) => {
    console.log('🚫 Pagamento cancelado:', event.detail);
    // Aqui você pode adicionar lógica adicional para cancelamento
});

document.addEventListener('paymentRetry', (event) => {
    console.log('🔄 Tentando pagamento novamente:', event.detail);
    // Aqui você pode adicionar lógica adicional para retry
});

// Exportar para uso global
window.paymentHandler = paymentHandler;
