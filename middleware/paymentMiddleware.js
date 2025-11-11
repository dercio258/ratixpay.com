const paymentStatusManager = require('../utils/paymentStatusManager');

class PaymentMiddleware {
    constructor() {
        this.setupEventListeners();
    }

    // Configurar listeners de eventos
    setupEventListeners() {
        // Sucesso do pagamento
        paymentStatusManager.on('paymentSuccess', (data) => {
            console.log('✅ Pagamento processado com sucesso:', data.paymentId);
            this.handlePaymentSuccess(data);
        });

        // Falha do pagamento
        paymentStatusManager.on('paymentFailure', (data) => {
            console.log('❌ Pagamento falhou:', data.paymentId);
            this.handlePaymentFailure(data);
        });

        // Timeout do pagamento
        paymentStatusManager.on('paymentTimeout', (data) => {
            console.log('⏰ Pagamento expirou:', data.paymentId);
            this.handlePaymentTimeout(data);
        });

        // Erro do pagamento
        paymentStatusManager.on('paymentError', (data) => {
            console.log('💥 Erro no pagamento:', data.paymentId);
            this.handlePaymentError(data);
        });
    }

    // Middleware para iniciar pagamento
    initiatePayment() {
        return async (req, res, next) => {
            try {
                const { vendaId, valor, metodo, clienteId } = req.body;

                // Validar dados
                if (!vendaId || !valor || !metodo || !clienteId) {
                    return res.status(400).json({
                        error: 'Dados obrigatórios ausentes',
                        code: 'MISSING_REQUIRED_FIELDS'
                    });
                }

                // Gerar ID único para o pagamento
                const paymentId = this.generatePaymentId();

                // Dados do pagamento
                const paymentData = {
                    vendaId,
                    valor,
                    metodo,
                    clienteId,
                    timestamp: Date.now(),
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                };

                // Adicionar ao monitoramento
                const paymentInfo = paymentStatusManager.addPendingPayment(paymentId, paymentData);

                // Adicionar ao request para uso posterior
                req.paymentId = paymentId;
                req.paymentInfo = paymentInfo;

                console.log(`🚀 Pagamento ${paymentId} iniciado para venda ${vendaId}`);

                next();

            } catch (error) {
                console.error('❌ Erro ao iniciar pagamento:', error);
                res.status(500).json({
                    error: 'Erro interno do servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        };
    }

    // Middleware para verificar status do pagamento
    checkPaymentStatus() {
        return async (req, res, next) => {
            try {
                const { paymentId } = req.params;

                if (!paymentId) {
                    return res.status(400).json({
                        error: 'ID do pagamento obrigatório',
                        code: 'MISSING_PAYMENT_ID'
                    });
                }

                // Verificar status no monitoramento
                const status = paymentStatusManager.getPaymentStatus(paymentId);

                if (!status) {
                    return res.status(404).json({
                        error: 'Pagamento não encontrado',
                        code: 'PAYMENT_NOT_FOUND'
                    });
                }

                // Adicionar status ao request
                req.paymentStatus = status;

                next();

            } catch (error) {
                console.error('❌ Erro ao verificar status do pagamento:', error);
                res.status(500).json({
                    error: 'Erro interno do servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        };
    }

    // Middleware para cancelar pagamento
    cancelPayment() {
        return async (req, res, next) => {
            try {
                const { paymentId } = req.params;

                if (!paymentId) {
                    return res.status(400).json({
                        error: 'ID do pagamento obrigatório',
                        code: 'MISSING_PAYMENT_ID'
                    });
                }

                // Remover do monitoramento
                const removed = paymentStatusManager.removePayment(paymentId);

                if (!removed) {
                    return res.status(404).json({
                        error: 'Pagamento não encontrado',
                        code: 'PAYMENT_NOT_FOUND'
                    });
                }

                // Atualizar banco de dados
                await this.updatePaymentStatus(paymentId, 'cancelled', {
                    message: 'Pagamento cancelado pelo usuário',
                    cancelledAt: new Date().toISOString()
                });

                console.log(`🚫 Pagamento ${paymentId} cancelado`);

                next();

            } catch (error) {
                console.error('❌ Erro ao cancelar pagamento:', error);
                res.status(500).json({
                    error: 'Erro interno do servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        };
    }

    // Middleware para webhook do e2Payments
    handleE2PaymentsWebhook() {
        return async (req, res, next) => {
            try {
                const { paymentId, status, message, transaction_id, transactionId } = req.body;

                // Suportar diferentes nomes de campos mantendo compatibilidade
                const resolvedPaymentId = paymentId || transaction_id || transactionId;

                if (!resolvedPaymentId || !status) {
                    return res.status(400).json({
                        error: 'Dados do webhook inválidos',
                        code: 'INVALID_WEBHOOK_DATA'
                    });
                }

                // Verificar se o pagamento está sendo monitorado
                const paymentInfo = paymentStatusManager.getPaymentStatus(resolvedPaymentId);

                if (paymentInfo) {
                    // Atualizar status diretamente
                    await paymentStatusManager.handlePaymentStatusUpdate(resolvedPaymentId, {
                        status: status,
                        message: message,
                        webhookReceived: true,
                        receivedAt: new Date().toISOString()
                    });

                    console.log(`📡 Webhook e2Payments recebido para pagamento ${resolvedPaymentId}: ${status}`);
                } else {
                    console.log(`⚠️ Webhook e2Payments para pagamento não monitorado: ${resolvedPaymentId}`);
                }

                // Responder ao webhook
                res.status(200).json({
                    success: true,
                    message: 'Webhook e2Payments processado com sucesso'
                });

            } catch (error) {
                console.error('❌ Erro ao processar webhook:', error);
                res.status(500).json({
                    error: 'Erro interno do servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        };
    }

    // Manipular sucesso do pagamento
    async handlePaymentSuccess(data) {
        try {
            const { paymentId, paymentInfo, status } = data;

            // Enviar notificação de sucesso
            await this.sendPaymentNotification(paymentId, 'success', {
                message: 'Pagamento processado com sucesso',
                amount: paymentInfo.data.valor,
                method: paymentInfo.data.metodo
            });

            // Atualizar venda
            await this.updateVendaStatus(paymentInfo.data.vendaId, 'paga');

            console.log(`✅ Pagamento ${paymentId} processado com sucesso`);

        } catch (error) {
            console.error('❌ Erro ao processar sucesso do pagamento:', error);
        }
    }

    // Manipular falha do pagamento
    async handlePaymentFailure(data) {
        try {
            const { paymentId, paymentInfo, status } = data;

            // Enviar notificação de falha
            await this.sendPaymentNotification(paymentId, 'failed', {
                message: 'Pagamento não foi processado',
                reason: status.message || 'Falha no processamento',
                amount: paymentInfo.data.valor,
                method: paymentInfo.data.metodo
            });

            // Atualizar venda
            await this.updateVendaStatus(paymentInfo.data.vendaId, 'cancelada');

            console.log(`❌ Pagamento ${paymentId} falhou: ${status.message}`);

        } catch (error) {
            console.error('❌ Erro ao processar falha do pagamento:', error);
        }
    }

    // Manipular timeout do pagamento
    async handlePaymentTimeout(data) {
        try {
            const { paymentId, paymentInfo } = data;

            // Enviar notificação de timeout
            await this.sendPaymentNotification(paymentId, 'timeout', {
                message: 'Pagamento expirado por timeout',
                amount: paymentInfo.data.valor,
                method: paymentInfo.data.metodo
            });

            // Atualizar venda
            await this.updateVendaStatus(paymentInfo.data.vendaId, 'cancelada');

            console.log(`⏰ Pagamento ${paymentId} expirou por timeout`);

        } catch (error) {
            console.error('❌ Erro ao processar timeout do pagamento:', error);
        }
    }

    // Manipular erro do pagamento
    async handlePaymentError(data) {
        try {
            const { paymentId, paymentInfo, error } = data;

            // Enviar notificação de erro
            await this.sendPaymentNotification(paymentId, 'error', {
                message: 'Erro no processamento do pagamento',
                reason: error.message,
                amount: paymentInfo.data.valor,
                method: paymentInfo.data.metodo
            });

            // Atualizar venda
            await this.updateVendaStatus(paymentInfo.data.vendaId, 'cancelada');

            console.log(`💥 Erro no pagamento ${paymentId}: ${error.message}`);

        } catch (error) {
            console.error('❌ Erro ao processar erro do pagamento:', error);
        }
    }

    // Enviar notificação de pagamento
    async sendPaymentNotification(paymentId, type, data) {
        try {
            // Aqui você implementaria o envio de notificação
            // Por exemplo: WebSocket, Push Notification, Email, etc.
            
            console.log(`📢 Notificação de pagamento ${type} enviada para ${paymentId}:`, data);

            // Exemplo de WebSocket
            if (global.io) {
                global.io.emit('paymentUpdate', {
                    paymentId,
                    type,
                    data,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
        }
    }

    // Atualizar status da venda
    async updateVendaStatus(vendaId, status) {
        try {
            const { Venda } = require('../config/database');
            
            await Venda.update({
                status: status,
                updatedAt: new Date()
            }, {
                where: { id: vendaId }
            });

            console.log(`📊 Venda ${vendaId} atualizada para status: ${status}`);

        } catch (error) {
            console.error('❌ Erro ao atualizar status da venda:', error);
        }
    }

    // Atualizar status do pagamento
    async updatePaymentStatus(paymentId, status, details) {
        try {
            const { Pagamento } = require('../config/database');
            
            await Pagamento.update({
                status: status,
                detalhes: JSON.stringify(details),
                updatedAt: new Date()
            }, {
                where: { referencia: paymentId }
            });

            console.log(`💾 Pagamento ${paymentId} atualizado para status: ${status}`);

        } catch (error) {
            console.error('❌ Erro ao atualizar status do pagamento:', error);
        }
    }

    // Gerar ID único para pagamento
    generatePaymentId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `PAY_${timestamp}_${random}`.toUpperCase();
    }

    // Obter estatísticas
    getStats() {
        return paymentStatusManager.getStats();
    }

    // Configurar parâmetros
    configure(options = {}) {
        paymentStatusManager.configure(options);
    }
}

// Instância singleton
const paymentMiddleware = new PaymentMiddleware();

module.exports = paymentMiddleware;
