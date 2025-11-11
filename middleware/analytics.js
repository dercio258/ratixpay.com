const Venda = require('../models/Venda');

// Middleware para capturar dados de analytics
const captureAnalytics = (req, res, next) => {
    // Capturar UTM parameters
    const utmSource = req.query.utm_source || req.query.utmSource;
    const utmMedium = req.query.utm_medium || req.query.utmMedium;
    const utmCampaign = req.query.utm_campaign || req.query.utmCampaign;
    const utmTerm = req.query.utm_term || req.query.utmTerm;
    const utmContent = req.query.utm_content || req.query.utmContent;

    // Capturar referrer
    const referrer = req.get('Referrer') || req.get('Referer');

    // Determinar origem do tráfego
    let origemTrafico = 'Direto';
    if (referrer) {
        if (referrer.includes('google')) {
            origemTrafico = 'Google';
        } else if (referrer.includes('facebook')) {
            origemTrafico = 'Facebook';
        } else if (referrer.includes('instagram')) {
            origemTrafico = 'Instagram';
        } else if (referrer.includes('whatsapp')) {
            origemTrafico = 'WhatsApp';
        } else if (referrer.includes('telegram')) {
            origemTrafico = 'Telegram';
        } else {
            origemTrafico = 'Outros Sites';
        }
    }

    // Armazenar dados no request para uso posterior
    req.analytics = {
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        referrer,
        origemTrafico,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
        timestamp: new Date().toISOString()
    };

    // Salvar dados de analytics se for uma página de produto ou checkout
    if (req.path.includes('/checkout') || req.path.includes('/produto')) {
        saveAnalyticsData(req);
    }

    next();
};

// Função para salvar dados de analytics
const saveAnalyticsData = async (req) => {
    try {
        // Aqui você pode implementar a lógica para salvar dados de analytics
        // Por exemplo, salvar em uma tabela separada ou usar cookies
        // Removido log de analytics capturado
    } catch (error) {
        // Removido log de erro ao salvar analytics
    }
};

// Middleware para capturar dados de conversão
const captureConversion = (req, res, next) => {
    // Interceptar resposta para capturar dados de conversão
    const originalSend = res.send;
    
    res.send = function(data) {
        // Se for uma resposta de pagamento bem-sucedido
        if (req.path.includes('/pagar') && req.method === 'POST') {
            try {
                const responseData = JSON.parse(data);
                if (responseData.success && responseData.data?.venda) {
                    // Removido log de conversão capturada
                }
            } catch (error) {
                // Ignorar erros de parsing
            }
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Função para obter dados de analytics para uma venda
const getAnalyticsForVenda = (vendaId) => {
    // Implementar lógica para buscar dados de analytics de uma venda específica
    return {
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        origemTrafico: null,
        referrer: null
    };
};

module.exports = {
    captureAnalytics,
    captureConversion,
    getAnalyticsForVenda
};