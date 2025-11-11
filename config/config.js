/**
 * Configurações centralizadas do sistema RatixPay
 * Carrega variáveis do arquivo .env e mantém a estrutura original
 */

require('dotenv').config();

// Lista de variáveis obrigatórias
const requiredEnvVars = [
    'ADMIN_EMAIL',
    'ADMIN_WHATSAPP',
    'ADMIN_NOME',
    'EMAIL_FROM',
    'EMAIL_FROM_NAME',
    'EMAIL_REPLY_TO',
    'WHATSAPP_ADMIN_NUMBER',
    'WHATSAPP_COUNTRY_CODE',
    'NOTIFICATIONS_ADMIN_RECEIVES',
    'NOTIFICATIONS_VENDEDOR_RECEIVES'
];

// Validar variáveis obrigatórias
function validateRequiredEnvVars() {
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`❌ Variáveis de ambiente obrigatórias ausentes: ${missingVars.join(', ')}`);
    }
}

// Função para converter string separada por vírgulas em array
function stringToArray(str) {
    if (!str) return [];
    return str.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

// Função para converter string em número
function stringToNumber(str, defaultValue = 0) {
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
}

// Função para converter string em boolean
function stringToBoolean(str, defaultValue = false) {
    if (!str) return defaultValue;
    return str.toLowerCase() === 'true';
}

// Validar e carregar configurações
try {
    validateRequiredEnvVars();
    console.log('✅ Todas as variáveis de ambiente obrigatórias estão presentes');
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

// Configurações do sistema
const config = {
    // Dados de contato do admin
    admin: {
        email: process.env.ADMIN_EMAIL,
        whatsapp: process.env.ADMIN_WHATSAPP,
        nome: process.env.ADMIN_NOME
    },
    
    // Configurações de email
    email: {
        from: process.env.EMAIL_FROM,
        fromName: process.env.EMAIL_FROM_NAME,
        replyTo: process.env.EMAIL_REPLY_TO
    },
    
    // Configurações de WhatsApp
    whatsapp: {
        adminNumber: process.env.WHATSAPP_ADMIN_NUMBER,
        countryCode: process.env.WHATSAPP_COUNTRY_CODE
    },
    
    // Configurações de notificações
    notifications: {
        // Tipos de notificação que o admin deve receber
        adminReceives: stringToArray(process.env.NOTIFICATIONS_ADMIN_RECEIVES),
        
        // Tipos de notificação que vendedores devem receber
        vendedorReceives: stringToArray(process.env.NOTIFICATIONS_VENDEDOR_RECEIVES)
    },

    // Configurações do banco de dados
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: stringToNumber(process.env.DB_PORT, 5432),
        name: process.env.DB_NAME || 'ratixpay',
        user: process.env.DB_USER || 'ratixpay',
        password: process.env.DB_PASS || '',
        url: process.env.DATABASE_URL
    },

    // Configurações do Redis
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: stringToNumber(process.env.REDIS_PORT, 6379),
        password: process.env.REDIS_PASSWORD || '',
        db: stringToNumber(process.env.REDIS_DB, 0)
    },

    // Configurações de sessão
    session: {
        secret: process.env.SESSION_SECRET || 'ratixpay-secret-key-2024',
        jwtSecret: process.env.JWT_SECRET || 'ratixpay-jwt-secret-2024'
    },

    // Configurações de performance
    performance: {
        nodeOptions: process.env.NODE_OPTIONS || '--max-old-space-size=2048',
        threadPoolSize: stringToNumber(process.env.UV_THREADPOOL_SIZE, 16)
    },

    // Configurações de logs
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || 'logs/app.log'
    },

    // Configurações de segurança
    security: {
        bcryptRounds: stringToNumber(process.env.BCRYPT_ROUNDS, 12),
        rateLimitWindow: stringToNumber(process.env.RATE_LIMIT_WINDOW, 900000),
        rateLimitMax: stringToNumber(process.env.RATE_LIMIT_MAX, 100)
    },

    // Configurações de cache
    cache: {
        ttl: stringToNumber(process.env.CACHE_TTL, 3600),
        maxSize: stringToNumber(process.env.CACHE_MAX_SIZE, 1000)
    },

    // Configurações de monitoramento
    monitoring: {
        enabled: stringToBoolean(process.env.ENABLE_MONITORING, true),
        metricsPort: stringToNumber(process.env.METRICS_PORT, 9090)
    },

    // Configurações do E2Payment
    e2payment: {
        apiUrl: process.env.E2PAYMENT_API_URL || 'https://opay.mucamba.site',
        apiKey: process.env.E2PAYMENT_API_KEY || ''
    },

    // Configurações do Cloudinary
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || ''
    },

    // Configurações do WhatsApp Bot
    whatsappBot: {
        sessionPath: process.env.WHATSAPP_BOT_SESSION_PATH || './auth_info_baileys',
        qrTimeout: stringToNumber(process.env.WHATSAPP_BOT_QR_TIMEOUT, 60000)
    },

    // Configurações de SMTP
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: stringToNumber(process.env.SMTP_PORT, 587),
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASS || ''
    },

    // Push Notifications removido

    // Configurações de ambiente
    environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        port: stringToNumber(process.env.PORT, 3000)
    },

    // Configurações de timeout
    timeout: {
        payment: stringToNumber(process.env.PAYMENT_TIMEOUT, 300000),
        connection: stringToNumber(process.env.CONNECTION_TIMEOUT, 30000),
        request: stringToNumber(process.env.REQUEST_TIMEOUT, 30000)
    },

    // Configurações de rate limiting
    rateLimit: {
        general: {
            max: stringToNumber(process.env.RATE_LIMIT_GENERAL_MAX, 100)
        },
        auth: {
            max: stringToNumber(process.env.RATE_LIMIT_AUTH_MAX, 10)
        },
        payment: {
            max: stringToNumber(process.env.RATE_LIMIT_PAYMENT_MAX, 20)
        },
        upload: {
            max: stringToNumber(process.env.RATE_LIMIT_UPLOAD_MAX, 5)
        }
    },

    // Configurações de compressão
    compression: {
        level: stringToNumber(process.env.COMPRESSION_LEVEL, 6),
        threshold: stringToNumber(process.env.COMPRESSION_THRESHOLD, 1024)
    },

    // Configurações de cache headers
    cacheHeaders: {
        static: `public, max-age=${process.env.CACHE_STATIC_MAX_AGE || 31536000}`,
        api: `public, max-age=${process.env.CACHE_API_MAX_AGE || 300}`,
        dynamic: process.env.CACHE_DYNAMIC_MAX_AGE === '0' ? 'no-cache, no-store, must-revalidate' : `public, max-age=${process.env.CACHE_DYNAMIC_MAX_AGE || 0}`
    }
};

// Função para obter configuração específica
function getConfig(path) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    
    return value;
}

// Função para verificar se está em produção
function isProduction() {
    return config.environment.nodeEnv === 'production';
}

// Função para verificar se está em desenvolvimento
function isDevelopment() {
    return config.environment.nodeEnv === 'development';
}

// Função para obter URL base
function getBaseUrl() {
    if (isProduction()) {
        return process.env.BASE_URL || 'https://ratixpay.com';
    } else {
        return `http://localhost:${config.environment.port}`;
    }
}

// Configurações carregadas silenciosamente

module.exports = {
    ...config,
    // Funções utilitárias
    getConfig,
    isProduction,
    isDevelopment,
    getBaseUrl,
    stringToArray,
    stringToNumber,
    stringToBoolean
};
