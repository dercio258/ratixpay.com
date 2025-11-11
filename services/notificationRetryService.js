/**
 * 🔄 SERVIÇO DE RETRY INTELIGENTE PARA NOTIFICAÇÕES - RATIXPAY
 * 
 * Gerencia retry inteligente para falhas de notificação:
 * - Backoff exponencial
 * - Retry baseado no tipo de erro
 * - Circuit breaker
 * - Dead letter queue
 */

class NotificationRetryService {
    constructor() {
        this.retryQueue = new Map();
        this.circuitBreakers = new Map();
        this.deadLetterQueue = [];
        
        // Configurações de retry
        this.config = {
            maxRetries: 3,
            baseDelay: 1000, // 1 segundo
            maxDelay: 30000, // 30 segundos
            circuitBreakerThreshold: 5, // 5 falhas consecutivas
            circuitBreakerTimeout: 60000, // 1 minuto
            deadLetterQueueSize: 100
        };
        
        // Iniciar processamento da fila
        this.startQueueProcessor();
        
        console.log('🔄 NotificationRetryService inicializado');
    }
    
    /**
     * Inicia processamento da fila de retry
     */
    startQueueProcessor() {
        setInterval(() => {
            this.processRetryQueue();
        }, 5000); // Processar a cada 5 segundos
    }
    
    /**
     * Adiciona notificação à fila de retry
     */
    addToRetryQueue(notificationData, error, attempt = 1) {
        const retryKey = this.generateRetryKey(notificationData);
        
        // Verificar se já está na fila
        if (this.retryQueue.has(retryKey)) {
            console.log(`⚠️ Notificação ${retryKey} já está na fila de retry`);
            return;
        }
        
        // Verificar circuit breaker
        if (this.isCircuitBreakerOpen(notificationData.type)) {
            console.log(`🚫 Circuit breaker aberto para ${notificationData.type}, enviando para dead letter queue`);
            this.addToDeadLetterQueue(notificationData, error);
            return;
        }
        
        const retryData = {
            notificationData,
            error: error.message || error,
            attempt,
            nextRetryAt: Date.now() + this.calculateDelay(attempt),
            maxRetries: this.config.maxRetries,
            createdAt: Date.now()
        };
        
        this.retryQueue.set(retryKey, retryData);
        console.log(`🔄 Notificação ${retryKey} adicionada à fila de retry (tentativa ${attempt})`);
    }
    
    /**
     * Processa a fila de retry
     */
    async processRetryQueue() {
        const now = Date.now();
        const toProcess = [];
        
        // Coletar notificações prontas para retry
        for (const [key, retryData] of this.retryQueue.entries()) {
            if (now >= retryData.nextRetryAt) {
                toProcess.push({ key, retryData });
            }
        }
        
        // Processar notificações
        for (const { key, retryData } of toProcess) {
            await this.processRetry(key, retryData);
        }
    }
    
    /**
     * Processa uma notificação específica da fila de retry
     */
    async processRetry(retryKey, retryData) {
        try {
            console.log(`🔄 Processando retry ${retryKey} (tentativa ${retryData.attempt})`);
            
            // Remover da fila
            this.retryQueue.delete(retryKey);
            
            // Tentar enviar novamente
            const success = await this.retryNotification(retryData.notificationData);
            
            if (success) {
                console.log(`✅ Retry bem-sucedido para ${retryKey}`);
                this.recordSuccess(retryData.notificationData.type);
            } else {
                // Incrementar tentativa
                const nextAttempt = retryData.attempt + 1;
                
                if (nextAttempt <= retryData.maxRetries) {
                    // Adicionar novamente à fila
                    this.addToRetryQueue(retryData.notificationData, retryData.error, nextAttempt);
                } else {
                    // Máximo de tentativas atingido
                    console.log(`❌ Máximo de tentativas atingido para ${retryKey}, enviando para dead letter queue`);
                    this.addToDeadLetterQueue(retryData.notificationData, retryData.error);
                    this.recordFailure(retryData.notificationData.type);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao processar retry ${retryKey}:`, error);
            this.recordFailure(retryData.notificationData.type);
        }
    }
    
    /**
     * Tenta reenviar uma notificação
     */
    async retryNotification(notificationData) {
        try {
            const { type, method, params } = notificationData;
            
            switch (type) {
                case 'email':
                    return await this.retryEmail(params);
                case 'whatsapp':
                    return await this.retryWhatsApp(params);
                case 'push':
                    return await this.retryPush(params);
                default:
                    console.log(`⚠️ Tipo de notificação não suportado para retry: ${type}`);
                    return false;
            }
        } catch (error) {
            console.error('❌ Erro ao tentar reenviar notificação:', error);
            return false;
        }
    }
    
    /**
     * Retry para email
     */
    async retryEmail(params) {
        try {
            const professionalEmailService = require('./professionalEmailService');
            await professionalEmailService.enviarEmailVendas(params.destinatario, params.assunto, params.conteudo, 'retry');
            return true;
        } catch (error) {
            console.error('❌ Erro no retry de email:', error);
            return false;
        }
    }
    
    /**
     * Retry para WhatsApp
     */
    async retryWhatsApp(params) {
        try {
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(params.to, params.message, null, 'default');
            return true;
        } catch (error) {
            console.error('❌ Erro no retry de WhatsApp:', error);
            return false;
        }
    }
    
    /**
     * Retry para push notification
     */
    async retryPush(params) {
        try {
            // Implementar retry para push notifications se necessário
            console.log('📱 Retry de push notification não implementado');
            return true;
        } catch (error) {
            console.error('❌ Erro no retry de push:', error);
            return false;
        }
    }
    
    /**
     * Calcula delay para próxima tentativa (backoff exponencial)
     */
    calculateDelay(attempt) {
        const delay = this.config.baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, this.config.maxDelay);
    }
    
    /**
     * Gera chave única para retry
     */
    generateRetryKey(notificationData) {
        const dataString = JSON.stringify(notificationData);
        return require('crypto')
            .createHash('md5')
            .update(dataString)
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Verifica se circuit breaker está aberto
     */
    isCircuitBreakerOpen(type) {
        const breaker = this.circuitBreakers.get(type);
        
        if (!breaker) {
            return false;
        }
        
        if (breaker.state === 'open') {
            // Verificar se deve tentar fechar
            if (Date.now() - breaker.lastFailureTime > this.config.circuitBreakerTimeout) {
                breaker.state = 'half-open';
                console.log(`🔄 Circuit breaker para ${type} mudou para half-open`);
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Registra sucesso (fecha circuit breaker)
     */
    recordSuccess(type) {
        const breaker = this.circuitBreakers.get(type);
        
        if (breaker) {
            breaker.failureCount = 0;
            breaker.state = 'closed';
            breaker.lastSuccessTime = Date.now();
        }
    }
    
    /**
     * Registra falha (pode abrir circuit breaker)
     */
    recordFailure(type) {
        let breaker = this.circuitBreakers.get(type);
        
        if (!breaker) {
            breaker = {
                failureCount: 0,
                state: 'closed',
                lastFailureTime: null,
                lastSuccessTime: null
            };
            this.circuitBreakers.set(type, breaker);
        }
        
        breaker.failureCount++;
        breaker.lastFailureTime = Date.now();
        
        if (breaker.failureCount >= this.config.circuitBreakerThreshold) {
            breaker.state = 'open';
            console.log(`🚫 Circuit breaker aberto para ${type} (${breaker.failureCount} falhas consecutivas)`);
        }
    }
    
    /**
     * Adiciona à dead letter queue
     */
    addToDeadLetterQueue(notificationData, error) {
        const dlqEntry = {
            notificationData,
            error: error.message || error,
            timestamp: Date.now(),
            id: require('crypto').randomUUID()
        };
        
        this.deadLetterQueue.push(dlqEntry);
        
        // Limitar tamanho da dead letter queue
        if (this.deadLetterQueue.length > this.config.deadLetterQueueSize) {
            this.deadLetterQueue.shift(); // Remove o mais antigo
        }
        
        console.log(`💀 Notificação enviada para dead letter queue: ${dlqEntry.id}`);
    }
    
    /**
     * Obtém estatísticas do serviço
     */
    getStats() {
        return {
            retryQueueSize: this.retryQueue.size,
            deadLetterQueueSize: this.deadLetterQueue.length,
            circuitBreakers: Object.fromEntries(
                Array.from(this.circuitBreakers.entries()).map(([type, breaker]) => [
                    type,
                    {
                        state: breaker.state,
                        failureCount: breaker.failureCount,
                        lastFailureTime: breaker.lastFailureTime,
                        lastSuccessTime: breaker.lastSuccessTime
                    }
                ])
            )
        };
    }
    
    /**
     * Limpa a fila de retry
     */
    clearRetryQueue() {
        this.retryQueue.clear();
        console.log('🗑️ Fila de retry limpa');
    }
    
    /**
     * Limpa a dead letter queue
     */
    clearDeadLetterQueue() {
        this.deadLetterQueue.length = 0;
        console.log('🗑️ Dead letter queue limpa');
    }
}

// Exportar instância única
module.exports = new NotificationRetryService();
