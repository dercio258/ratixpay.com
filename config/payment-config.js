/**
 * Configuração centralizada para o sistema de pagamento
 * Este arquivo organiza todas as configurações relacionadas ao pagamento
 */

const paymentConfig = {
    // Configurações do e2Payments
    e2payments: {
        timeout: {
            connection: 10000,  // 10 segundos para conectar
            response: 30000,    // 30 segundos para resposta
            total: 60000        // 60 segundos total
        },
        retry: {
            maxAttempts: 3,
            backoffMultiplier: 2,
            initialDelay: 1000
        },
        methods: ['mpesa', 'emola'],
        phonePattern: /^8[4-7]\d{7}$/,
        amountLimits: {
            min: 1,
            max: 100000
        }
    },

    // Configurações de validação
    validation: {
        productId: {
            pattern: /^[a-zA-Z0-9-_]+$/,
            required: true
        },
        phone: {
            pattern: /^8[4-7]\d{7}$/,
            required: true,
            message: 'Número de telefone deve ser válido para Moçambique (84, 85, 86, 87)'
        },
        method: {
            allowed: ['mpesa', 'emola'],
            required: true,
            message: 'Método de pagamento deve ser mpesa ou emola'
        }
    },

    // Configurações de cache
    cache: {
        product: {
            ttl: 5 * 60 * 1000, // 5 minutos
            maxSize: 100
        },
        payment: {
            ttl: 2 * 60 * 1000, // 2 minutos
            maxSize: 50
        }
    },

    // Configurações de monitoramento
    monitoring: {
        metrics: {
            enabled: true,
            interval: 60000, // 1 minuto
            retention: 24 * 60 * 60 * 1000 // 24 horas
        },
        alerts: {
            errorRate: 0.1, // 10%
            responseTime: 10000, // 10 segundos
            enabled: true
        }
    },

    // Configurações de resposta
    response: {
        timeout: 30000,
        retries: 3,
        fallback: {
            enabled: true,
            message: 'Serviço temporariamente indisponível'
        }
    },

    // Configurações de logs
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: 'json',
        includeStack: process.env.NODE_ENV === 'development'
    }
};

// Validação de configuração
function validateConfig() {
    const errors = [];
    
    // e2Payments usa OAuth dinâmico, então não validamos aqui
    
    // Verificar configurações internas
    if (paymentConfig.e2payments.timeout.connection > paymentConfig.e2payments.timeout.total) {
        errors.push('Timeout de conexão não pode ser maior que timeout total');
    }
    
    if (paymentConfig.e2payments.amountLimits.min >= paymentConfig.e2payments.amountLimits.max) {
        errors.push('Limite mínimo deve ser menor que limite máximo');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Função para obter timeout baseado no método
function getTimeoutForMethod(method) {
    const timeouts = {
        'mpesa': 45000,  // 45 segundos
        'emola': 30000   // 30 segundos
    };
    return timeouts[method] || paymentConfig.e2payments.timeout.response;
}

// Função para validar dados de pagamento
function validatePaymentData(data) {
    const errors = [];
    
    // Validar telefone
    if (!data.numeroCelular) {
        errors.push('Número de celular é obrigatório');
    } else if (!paymentConfig.validation.phone.pattern.test(data.numeroCelular)) {
        errors.push(paymentConfig.validation.phone.message);
    }
    
    // Validar método
    if (!data.metodo) {
        errors.push('Método de pagamento é obrigatório');
    } else if (!paymentConfig.validation.method.allowed.includes(data.metodo)) {
        errors.push(paymentConfig.validation.method.message);
    }
    
    // Validar produto
    if (!data.produtoPublicId) {
        errors.push('ID do produto é obrigatório');
    } else if (!paymentConfig.validation.productId.pattern.test(data.produtoPublicId)) {
        errors.push('ID do produto contém caracteres inválidos');
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Função para criar resposta padronizada
function createResponse(success, data = null, error = null, requestId = null) {
    return {
        success,
        timestamp: new Date().toISOString(),
        requestId: requestId || generateRequestId(),
        data,
        error
    };
}

// Função para gerar ID de requisição
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Função para formatar telefone
function formatPhone(phone) {
    if (!phone) return null;
    
    // Remover caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Verificar se tem 9 dígitos
    if (cleanPhone.length !== 9) {
        throw new Error('Número de telefone deve ter 9 dígitos');
    }
    
    // Verificar se é um número válido de Moçambique
    if (!['84', '85', '86', '87'].includes(cleanPhone.substring(0, 2))) {
        throw new Error('Número de telefone inválido para Moçambique');
    }
    
    return cleanPhone;
}

// Função para calcular delay de retry
function calculateRetryDelay(attempt, baseDelay = paymentConfig.e2payments.retry.initialDelay) {
    return baseDelay * Math.pow(paymentConfig.e2payments.retry.backoffMultiplier, attempt - 1);
}

// Função para verificar se deve fazer retry
function shouldRetry(error, attempt) {
    if (attempt >= paymentConfig.e2payments.retry.maxAttempts) {
        return false;
    }
    
    // Fazer retry para erros de timeout e conexão
    const retryableErrors = [
        'ECONNABORTED',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ECONNRESET',
        'ETIMEDOUT'
    ];
    
    return retryableErrors.includes(error.code) || 
           error.message?.includes('timeout') ||
           error.message?.includes('connection');
}

module.exports = {
    paymentConfig,
    validateConfig,
    getTimeoutForMethod,
    validatePaymentData,
    createResponse,
    generateRequestId,
    formatPhone,
    calculateRetryDelay,
    shouldRetry
};
