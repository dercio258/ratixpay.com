/**
 * Configuração de Emails Profissionais RatixPay
 * Centraliza as configurações de email por categoria
 */

const emailConfigs = {
    vendas: {
        user: process.env.VENDAS_EMAIL || 'vendas@ratixpay.com',
        pass: process.env.VENDAS_PASS || '',
        name: 'RatixPay Vendas',
        from: 'RatixPay Vendas <vendas@ratixpay.com>'
    },
    sistema: {
        user: process.env.SISTEMA_EMAIL || 'sistema@ratixpay.com',
        pass: process.env.SISTEMA_PASS || '',
        name: 'RatixPay Sistema',
        from: 'RatixPay Sistema <sistema@ratixpay.com>'
    },
    suporte: {
        user: process.env.SUPORTE_EMAIL || 'suporte@ratixpay.com',
        pass: process.env.SUPORTE_PASS || '',
        name: 'RatixPay Suporte',
        from: 'RatixPay Suporte <suporte@ratixpay.com>'
    },
    ofertas: {
        user: process.env.OFERTAS_EMAIL || 'ofertas@ratixpay.com',
        pass: process.env.OFERTAS_PASS || '',
        name: 'RatixPay Ofertas',
        from: 'RatixPay Ofertas <ofertas@ratixpay.com>'
    }
};

/**
 * Configuração do transportador Nodemailer
 */
const getTransporterConfig = (config) => {
    // Configuração base
    const baseConfig = {
        port: 587,
        secure: false, // true para 465, false para outras portas
        auth: {
            user: config.user,
            pass: config.pass
        },
        tls: {
            rejectUnauthorized: false
        },
        pool: true, // usar pool de conexões
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 20000, // 20 segundos
        rateLimit: 5 // máximo 5 emails por rateDelta
    };

    // Configuração específica por provedor
    if (config.user.includes('@gmail.com')) {
        return {
            ...baseConfig,
            service: 'gmail',
            host: 'smtp.gmail.com'
        };
    } else if (config.user.includes('@ratixpay.com')) {
        return {
            ...baseConfig,
            host: 'smtp.zoho.com'
        };
    } else {
        // Configuração genérica
        return {
            ...baseConfig,
            host: 'smtp.zoho.com'
        };
    }
};

/**
 * Verificar se as configurações estão completas
 */
const validateConfig = () => {
    const missing = [];
    
    for (const [category, config] of Object.entries(emailConfigs)) {
        if (!config.user || !config.pass) {
            missing.push(category);
        }
    }
    
    if (missing.length > 0) {
        console.warn(`⚠️ Configurações de email incompletas para: ${missing.join(', ')}`);
        return false;
    }
    
    return true;
};

/**
 * Obter configuração por categoria
 */
const getConfig = (category) => {
    return emailConfigs[category] || null;
};

/**
 * Listar todas as configurações
 */
const getAllConfigs = () => {
    return emailConfigs;
};

module.exports = {
    emailConfigs,
    getTransporterConfig,
    validateConfig,
    getConfig,
    getAllConfigs
};
