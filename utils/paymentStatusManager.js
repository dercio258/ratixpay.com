const EventEmitter = require('events');

class PaymentStatusManager extends EventEmitter {
    constructor() {
        super();
        this.pendingPayments = new Map();
        this.statusCheckInterval = null;
        this.maxRetries = 3;
        this.checkInterval = 5000; // 5 segundos
        this.timeoutDuration = 300000; // 5 minutos
        
        this.startStatusMonitoring();
    }

    // Iniciar monitoramento de status
    startStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }

        this.statusCheckInterval = setInterval(() => {
            this.checkPendingPayments();
        }, this.checkInterval);

        console.log('🔄 Monitoramento de status de pagamento iniciado');
    }

    // Parar monitoramento
    stopStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
        console.log('⏹️ Monitoramento de status de pagamento parado');
    }

    // Adicionar pagamento pendente
    addPendingPayment(paymentId, paymentData) {
        const paymentInfo = {
            id: paymentId,
            data: paymentData,
            status: 'pending',
            attempts: 0,
            createdAt: Date.now(),
            lastChecked: Date.now(),
            timeout: Date.now() + this.timeoutDuration
        };

        this.pendingPayments.set(paymentId, paymentInfo);
        
        console.log(`📝 Pagamento ${paymentId} adicionado ao monitoramento`);
        
        // Emitir evento de pagamento pendente
        this.emit('paymentPending', paymentInfo);
        
        return paymentInfo;
    }

    // Verificar pagamentos pendentes
    async checkPendingPayments() {
        const now = Date.now();
        const paymentsToCheck = [];

        for (const [paymentId, paymentInfo] of this.pendingPayments) {
            // Verificar timeout
            if (now > paymentInfo.timeout) {
                console.log(`⏰ Pagamento ${paymentId} expirou por timeout`);
                await this.handlePaymentTimeout(paymentId);
                continue;
            }

            // Verificar se precisa ser verificado
            if (now - paymentInfo.lastChecked >= this.checkInterval) {
                paymentsToCheck.push(paymentId);
            }
        }

        // Verificar status dos pagamentos
        for (const paymentId of paymentsToCheck) {
            await this.checkPaymentStatus(paymentId);
        }
    }

    // Verificar status de um pagamento específico
    async checkPaymentStatus(paymentId) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        if (!paymentInfo) return;

        try {
            paymentInfo.attempts++;
            paymentInfo.lastChecked = Date.now();

            console.log(`🔍 Verificando status do pagamento ${paymentId} (tentativa ${paymentInfo.attempts})`);

            // Verificar status com e2Payments
            const status = await this.verifyPaymentWithE2Payments(paymentId, paymentInfo.data);
            
            if (status) {
                await this.handlePaymentStatusUpdate(paymentId, status);
            } else if (paymentInfo.attempts >= this.maxRetries) {
                await this.handlePaymentMaxRetries(paymentId);
            }

        } catch (error) {
            console.error(`❌ Erro ao verificar pagamento ${paymentId}:`, error);
            
            if (paymentInfo.attempts >= this.maxRetries) {
                await this.handlePaymentError(paymentId, error);
            }
        }
    }

    // Verificar pagamento com e2Payments
    async verifyPaymentWithE2Payments(paymentId, paymentData) {
        try {
            const e2paymentsService = require('../services/e2paymentsService');
            // Verificar status do pagamento
            const result = await e2paymentsService.checkPaymentStatus(paymentId);
            
            return result;
            
        } catch (error) {
            console.error('❌ Erro na verificação com e2Payments:', error);
            return null;
        }
    }

    // Manipular atualização de status do pagamento
    async handlePaymentStatusUpdate(paymentId, status) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        if (!paymentInfo) return;

        console.log(`📊 Status do pagamento ${paymentId} atualizado: ${status.status}`);

        // Atualizar status
        paymentInfo.status = status.status;
        paymentInfo.updatedAt = Date.now();

        // Emitir evento baseado no status
        switch (status.status) {
            case 'success':
            case 'completed':
                await this.handlePaymentSuccess(paymentId, status);
                break;
            case 'failed':
            case 'cancelled':
            case 'rejected':
                await this.handlePaymentFailure(paymentId, status);
                break;
            case 'pending':
                // Continuar monitorando
                break;
            default:
                console.log(`⚠️ Status desconhecido: ${status.status}`);
        }
    }

    // Manipular sucesso do pagamento
    async handlePaymentSuccess(paymentId, status) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        
        console.log(`✅ Pagamento ${paymentId} processado com sucesso`);
        
        // Remover do monitoramento
        this.pendingPayments.delete(paymentId);
        
        // Emitir evento de sucesso
        this.emit('paymentSuccess', {
            paymentId,
            paymentInfo,
            status
        });

        // Atualizar banco de dados
        await this.updatePaymentInDatabase(paymentId, 'success', status);
    }

    // Manipular falha do pagamento
    async handlePaymentFailure(paymentId, status) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        
        console.log(`❌ Pagamento ${paymentId} falhou: ${status.status}`);
        
        // Remover do monitoramento
        this.pendingPayments.delete(paymentId);
        
        // Emitir evento de falha
        this.emit('paymentFailure', {
            paymentId,
            paymentInfo,
            status
        });

        // Atualizar banco de dados
        await this.updatePaymentInDatabase(paymentId, 'failed', status);
    }

    // Manipular timeout do pagamento
    async handlePaymentTimeout(paymentId) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        
        console.log(`⏰ Pagamento ${paymentId} expirou por timeout`);
        
        // Remover do monitoramento
        this.pendingPayments.delete(paymentId);
        
        // Emitir evento de timeout
        this.emit('paymentTimeout', {
            paymentId,
            paymentInfo
        });

        // Atualizar banco de dados
        await this.updatePaymentInDatabase(paymentId, 'timeout', {
            message: 'Pagamento expirado por timeout'
        });
    }

    // Manipular máximo de tentativas
    async handlePaymentMaxRetries(paymentId) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        
        console.log(`🔄 Pagamento ${paymentId} atingiu máximo de tentativas`);
        
        // Remover do monitoramento
        this.pendingPayments.delete(paymentId);
        
        // Emitir evento de máximo de tentativas
        this.emit('paymentMaxRetries', {
            paymentId,
            paymentInfo
        });

        // Atualizar banco de dados
        await this.updatePaymentInDatabase(paymentId, 'max_retries', {
            message: 'Máximo de tentativas atingido'
        });
    }

    // Manipular erro do pagamento
    async handlePaymentError(paymentId, error) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        
        console.log(`💥 Erro no pagamento ${paymentId}:`, error.message);
        
        // Remover do monitoramento
        this.pendingPayments.delete(paymentId);
        
        // Emitir evento de erro
        this.emit('paymentError', {
            paymentId,
            paymentInfo,
            error
        });

        // Atualizar banco de dados
        await this.updatePaymentInDatabase(paymentId, 'error', {
            message: error.message
        });
    }

    // Atualizar pagamento no banco de dados
    async updatePaymentInDatabase(paymentId, status, details) {
        try {
            const { Pagamento, Venda } = require('../config/database');
            
            // Atualizar pagamento
            await Pagamento.update({
                status: status,
                detalhes: JSON.stringify(details),
                updatedAt: new Date()
            }, {
                where: { referencia: paymentId }
            });

            // Se o pagamento falhou, atualizar venda
            if (['failed', 'cancelled', 'rejected', 'timeout', 'max_retries', 'error'].includes(status)) {
                await Venda.update({
                    status: 'cancelada',
                    updatedAt: new Date()
                }, {
                    where: { 
                        id: details.vendaId || null 
                    }
                });
            }

            console.log(`💾 Pagamento ${paymentId} atualizado no banco: ${status}`);
            
        } catch (error) {
            console.error(`❌ Erro ao atualizar pagamento ${paymentId} no banco:`, error);
        }
    }

    // Obter status de um pagamento
    getPaymentStatus(paymentId) {
        const paymentInfo = this.pendingPayments.get(paymentId);
        return paymentInfo ? {
            id: paymentId,
            status: paymentInfo.status,
            attempts: paymentInfo.attempts,
            createdAt: paymentInfo.createdAt,
            lastChecked: paymentInfo.lastChecked,
            timeout: paymentInfo.timeout
        } : null;
    }

    // Remover pagamento do monitoramento
    removePayment(paymentId) {
        const removed = this.pendingPayments.delete(paymentId);
        if (removed) {
            console.log(`🗑️ Pagamento ${paymentId} removido do monitoramento`);
        }
        return removed;
    }

    // Obter estatísticas
    getStats() {
        const now = Date.now();
        const stats = {
            total: this.pendingPayments.size,
            byStatus: {},
            byAge: {
                recent: 0,    // < 1 minuto
                medium: 0,    // 1-5 minutos
                old: 0        // > 5 minutos
            },
            averageAttempts: 0,
            totalAttempts: 0
        };

        for (const [paymentId, paymentInfo] of this.pendingPayments) {
            // Por status
            stats.byStatus[paymentInfo.status] = (stats.byStatus[paymentInfo.status] || 0) + 1;
            
            // Por idade
            const age = now - paymentInfo.createdAt;
            if (age < 60000) {
                stats.byAge.recent++;
            } else if (age < 300000) {
                stats.byAge.medium++;
            } else {
                stats.byAge.old++;
            }
            
            // Tentativas
            stats.totalAttempts += paymentInfo.attempts;
        }

        stats.averageAttempts = stats.total > 0 ? (stats.totalAttempts / stats.total).toFixed(2) : 0;

        return stats;
    }

    // Limpar pagamentos antigos
    cleanupOldPayments() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        let cleaned = 0;

        for (const [paymentId, paymentInfo] of this.pendingPayments) {
            if (now - paymentInfo.createdAt > maxAge) {
                this.pendingPayments.delete(paymentId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 ${cleaned} pagamentos antigos removidos`);
        }

        return cleaned;
    }

    // Configurar parâmetros
    configure(options = {}) {
        if (options.checkInterval) {
            this.checkInterval = options.checkInterval;
        }
        
        if (options.maxRetries) {
            this.maxRetries = options.maxRetries;
        }
        
        if (options.timeoutDuration) {
            this.timeoutDuration = options.timeoutDuration;
        }

        console.log('⚙️ Configurações do PaymentStatusManager atualizadas:', options);
    }
}

// Instância singleton
const paymentStatusManager = new PaymentStatusManager();

module.exports = paymentStatusManager;
