const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const http = require('http');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
require('dotenv').config();

// Arquivo suppress-baileys-logs removido junto com a biblioteca Baileys

// Serviço de cancelamento será inicializado apenas quando necessário

// Importar serviço de notificações
const { NotificationService } = require('./services/notificationService');

// Importar middlewares de segurança
const {
    createRateLimiters,
    createSlowDown,
    sanitizeInput,
    auditLog,
    integrityCheck,
    attackProtection,
    securityHeaders,
    helmetConfig
} = require('./middleware/security');

// Importar middlewares de segurança avançada
const advancedSecurity = require('./middleware/advancedSecurity');

// Importar middleware de analytics
const { captureAnalytics, captureConversion } = require('./middleware/analytics');

// Inicializar banco de dados PostgreSQL
const { databaseManager } = require('./config/database');
const { setupAssociations } = require('./config/associations');

// Inicializar Passport
require('./config/passport');

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_SENDER,
        pass: process.env.GMAIL_PASS
    }
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Configurar Socket.IO
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const fs = require('fs');

// Inicializar serviço de notificações
const notificationService = require('./services/notificationService');

// Push notifications removido do sistema

// Serviço de notificações de vendedores removido

// Configuração para confiar no proxy (necessário em alguns hosts)
app.set('trust proxy', 1);

// Segurança
const rateLimiters = createRateLimiters();
const slowDown = createSlowDown();

app.use(helmetConfig);
app.use(securityHeaders);

// Middleware para otimização de cache com Cloudflare
app.use((req, res, next) => {
    // Headers para Cloudflare
    res.setHeader('CF-Cache-Status', 'HIT');
    res.setHeader('CF-Ray', req.headers['cf-ray'] || '');
    
    // Headers de cache baseados no tipo de arquivo
    // Em desenvolvimento, desabilitar cache para facilitar atualizações
    const isDevelopment = process.env.NODE_ENV !== 'production' || 
                          req.hostname === 'localhost' || 
                          req.hostname === '127.0.0.1';
    
    // Arquivos que NUNCA devem ser cacheados
    const noCacheFiles = ['pagamentos.html', 'pagamentos.js', 'gestao-vendas.html', 'gestao-vendas.js', 'login.html', 'register.html'];
    if (noCacheFiles.some(file => req.path.includes(file))) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return next();
    }
    
    // APIs de saque nunca devem ser cacheadas
    if (req.path.includes('/api/saques') || req.path.includes('/api/carteiras/saque')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return next();
    }
    
    if (isDevelopment) {
        // Em desenvolvimento: no-cache para HTML, CSS e JS
        if (req.path.match(/\.(html|css|js)$/) || req.path === '/sw.js' || req.path === '/sw-pwa.js') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return next();
        }
    }
    
    if (req.path.match(/\.(css|js)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
        res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    } else if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    } else if (req.path.match(/\.(woff|woff2|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    } else if (req.path === '/sw.js' || req.path === '/sw-pwa.js') {
        // Service Worker nunca deve ser cacheado
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
});

// Configurar Content Security Policy para permitir sons externos
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://connect.facebook.net https://static.cloudflareinsights.com; " +
        "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
        "img-src 'self' data: https:; " +
        "media-src 'self' https://www.myinstants.com https://actions.google.com; " +
        "connect-src 'self' https://connect.facebook.net https://www.facebook.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://fonts.googleapis.com https://api.utmify.com.br https://api.utmify.com; " +
        "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.gstatic.com;"
    );
    next();
});

if (process.env.NODE_ENV === 'production') {
    app.use(auditLog);
    app.use(integrityCheck);
    app.use(attackProtection);
}

app.use(rateLimiters.general);
app.use(slowDown);
app.use(sanitizeInput);

// Analytics
app.use(captureAnalytics);
app.use(captureConversion);

// CORS - Configuração permissiva para desenvolvimento
app.use(cors({
    origin: true, // Permite qualquer origem
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Pragma', 'Cache-Control'],
    credentials: true
}));

// Middlewares de segurança avançada - DESABILITADOS para desenvolvimento
// app.use(advancedSecurity.botDetection());
// app.use(advancedSecurity.originValidation());
// app.use(advancedSecurity.payloadValidation());
// app.use(advancedSecurity.attackDetection());
// app.use(advancedSecurity.ipBlocking());

// Rate limiters avançados
const advancedRateLimiters = advancedSecurity.createAdvancedRateLimiters();
app.use('/api/auth', advancedRateLimiters.auth);
app.use('/api/pagar', advancedRateLimiters.payment);
// app.use('/api', advancedRateLimiters.api); // Comentado temporariamente para permitir rotas de afiliados

// Slow down dinâmico
app.use(advancedSecurity.createDynamicSlowDown());

// Middleware de compressão (adicionar antes de outros middlewares)
const compression = require('compression');
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração de sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'ratixpay-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configuração do Passport
app.use(passport.initialize());
app.use(passport.session());

// Importar rotas
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const pagamentoRoutes = require('./routes/pagamento');
const produtosRoutes = require('./routes/produtos');
const vendasRoutes = require('./routes/vendas');
const imagemRoutes = require('./routes/imagem');
const whatsappRoutes = require('./routes/whatsapp');
const estatisticasRoutes = require('./routes/estatisticas');
const adminRoutes = require('./routes/admin');
const adminResetRoutes = require('./routes/admin-reset');
const saquesRoutes = require('./routes/saques');
const adminGestaoNegocioRoutes = require('./routes/admin-gestao-negocio');
const configuracoesRoutes = require('./routes/configuracoes');
const notificationsRoutes = require('./routes/notifications');
const adminNotificationsRoutes = require('./routes/adminNotifications');
const uploadRoutes = require('./routes/upload');
const registrationControlRoutes = require('./routes/registration-control');
const dashboardMetricsRoutes = require('./routes/dashboard-metrics');
const pushRoutes = require('./routes/push');

// Importar serviço de WhatsApp Bot
const whatsappBotService = require('./services/whatsappBotService');

// CORS já configurado acima

// Middleware para lidar com erros de conexão com o banco de dados
const handleDatabaseErrors = (err, req, res, next) => {
    if (err && (err.message.includes('timeout') || err.message.includes('terminated') || err.message.includes('Connection terminated'))) {
        console.error('Erro de conexão com o banco de dados interceptado:', err.message);
        return res.status(503).json({
            success: false,
            message: 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
            error: 'database_connection_error'
        });
    }
    next(err);
};

// Registrar rotas
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Rota de pagamento movida para /api/pagar
app.use('/api/produtos', produtosRoutes);

// Rotas de afiliados (devem vir antes das rotas de vendas para evitar conflitos)
app.use('/api/afiliados', require('./routes/afiliados'));
app.use('/api/afiliados/auth', require('./routes/auth-afiliados'));

app.use('/api/vendas', vendasRoutes);
app.use('/api/imagem', imagemRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/estatisticas', estatisticasRoutes);
// Dashboard admin (deve vir antes das outras rotas admin)
app.use('/api/admin/dashboard', require('./routes/admin-dashboard'));

// Endpoint de teste temporário
app.get('/api/test-admin', (req, res) => {
    console.log('🧪 Teste de endpoint admin chamado');
    res.json({
        success: true,
        message: 'Endpoint admin funcionando',
        timestamp: new Date().toISOString()
    });
});

app.use('/api/admin', require('./routes/admin-saques'));
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminGestaoNegocioRoutes);
app.use('/api/admin', require('./routes/admin-produtos'));

// Rotas do chatbot
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/ratixshop', require('./routes/ratixshop'));
app.use('/api/admin', require('./routes/admin-cancelamentos'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/notifications', require('./routes/notification-api'));
app.use('/api/remarketing', require('./routes/remarketing'));
app.use('/api/notificacoes', notificationsRoutes);
app.use('/api/admin/notificacoes', adminNotificationsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/cache', require('./routes/cache-monitor'));
app.use('/api/image-cache', require('./routes/image-cache'));
app.use('/api/upload', uploadRoutes);
 // Enhanced upload routes (reativadas)
 app.use('/api/upload/enhanced', require('./routes/enhanced-upload'));
 app.use('/api/upload/enhanced-content', require('./routes/enhanced-content-upload'));
// Push notifications removido
// Vendor notifications removido
app.use('/api/taxas', require('./routes/taxas'));
app.use('/api/saques', saquesRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/registration-control', registrationControlRoutes);
app.use('/api/dashboard', dashboardMetricsRoutes);
app.use('/api/experts', require('./routes/experts'));
app.use('/api/webhooks', require('./routes/webhooks').router);

// Rota de monitoramento de email
app.use('/api/email-monitor', require('./routes/email-monitor'));

// Rotas de emails profissionais
app.use('/api/email', require('./routes/professional-email'));

// Rota de reset do admin
app.use('/admin-reset', adminResetRoutes);

// Rota de pagamento movida para routes/pagamento.js
app.use('/api', pagamentoRoutes);

// Rotas e2Payments (proxy com Bearer do Postman)
app.use('/api', require('./routes/e2payments'));

// Rotas de afiliados já registradas acima

// Rotas de carteiras
const carteirasRoutes = require('./routes/carteiras');
app.use('/api/carteiras', carteirasRoutes);

// Dashboard otimizado integrado ao dashboard.js existente

// Transações otimizadas
const transactionsOptimizedRoutes = require('./routes/transactions-optimized');
app.use('/api/transactions', transactionsOptimizedRoutes);

// Produtos para integrações
const produtosIntegracaoRoutes = require('./routes/produtos-integracao');
app.use('/api/produtos-integracao', produtosIntegracaoRoutes);

// Produtos complementares das vendas
const produtosComplementaresRoutes = require('./routes/produtos-complementares');
app.use('/api/produtos-complementares', produtosComplementaresRoutes);

// Configurações de temporizador e desconto agora integradas na criação de produtos

// Servir arquivos estáticos com cache otimizado para Cloudflare
app.use(express.static(path.join(__dirname, 'public')));

// Servir CSS com cache otimizado
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), {
    maxAge: '1M', // 1 mês
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
        res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    }
}));

// Servir JS com cache otimizado
app.use('/js', express.static(path.join(__dirname, 'public', 'js'), {
    maxAge: '1M', // 1 mês
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
        res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    }
}));

// Servir assets com cache otimizado
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
    maxAge: '1M', // 1 mês
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000');
        res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    }
}));

// Servir imagens de upload com cache otimizado
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
    maxAge: '1y', // Cache por 1 ano
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        res.setHeader('Vary', 'Accept-Encoding');
    }
}));

// Garantir pasta de uploads existente em runtime
const uploadsDir = path.join(__dirname, 'public', 'uploads');
try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
} catch (e) {
    console.error('Erro ao criar diretório de uploads:', e.message);
}

// Rota específica para a página de sucesso de pagamento
app.get('/payment/success', (req, res) => {
    // Não depende mais do ID da transação
    res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});

// Rota para a página de sucesso com acesso seguro
app.get('/payment-success.html', (req, res) => {
    const { pedido, idpedido, productId, clientName, amount } = req.query;
    
    // Validar parâmetros de acesso - aceitar pedido OU idpedido
    if (!pedido && !idpedido) {
        return res.status(400).send(`
            <html>
                <head><title>Acesso Negado - RatixPay</title></head>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #f64c00;">🔒 Acesso Negado</h1>
                    <p>Link inválido ou expirado.</p>
                    <p>Verifique se o link está correto.</p>
                </body>
            </html>
        `);
    }
    
    console.log(`✅ Acesso autorizado à página de sucesso - Pedido: ${pedido}, ID Pedido: ${idpedido}, ProductId: ${productId}, Client: ${clientName}, Amount: ${amount}`);
    res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});

// Rota para a página de sucesso com número do pedido
app.get('/sucess/pedido=:numeroPedido', (req, res) => {
    const { numeroPedido } = req.params;
    console.log(`📋 Acessando página de sucesso para pedido: ${numeroPedido}`);
    res.sendFile(path.join(__dirname, 'public', 'sucess.html'));
});

// Servir arquivos da pasta ratixshop
app.use('/ratixshop', express.static(path.join(__dirname, 'ratixshop')));

// Servir arquivos de uploads (pasta local)
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
    maxAge: '7d',
    etag: true,
    index: false
}));

// Rota para acessar a página de QR Code do WhatsApp Bot
app.get('/whatsapp-bot', (req, res) => {
    res.sendFile(path.join(__dirname, 'bot', 'public', 'index.html'));
});

// Rota de health check
app.get('/api/health', async (req, res) => {
    try {
        // Verificar conexão com banco de dados
        await databaseManager.sequelize.authenticate();
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: 'connected',
            uptime: process.uptime()
        });
    } catch (error) {
        console.error('Erro no health check:', error);
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Rota para verificar status do WhatsApp Bot
app.get('/api/whatsapp-status', async (req, res) => {
    try {
        const status = whatsappBotService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Erro ao verificar status do WhatsApp Bot:', error);
        res.json({
            connected: false,
            error: 'Erro de conexão com o bot',
            qr: null
        });
    }
});

// Rota para resetar conexão do WhatsApp Bot
app.post('/api/whatsapp-reset', async (req, res) => {
    try {
        const success = await whatsappBotService.reset();
        if (success) {
            res.json({ success: true, message: 'Conexão resetada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao resetar conexão' });
        }
    } catch (error) {
        console.error('Erro ao resetar WhatsApp Bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para enviar notificação de teste
app.post('/api/whatsapp-test', async (req, res) => {
    try {
        const success = await whatsappBotService.sendTestNotification();
        if (success) {
            res.json({ success: true, message: 'Notificação de teste enviada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao enviar notificação de teste' });
        }
    } catch (error) {
        console.error('Erro ao enviar notificação de teste:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para inicializar WhatsApp Bot (apenas quando solicitado manualmente)
app.post('/api/whatsapp-initialize', async (req, res) => {
    try {
        console.log('🤖 Inicialização manual do WhatsApp Bot solicitada via API...');
        const success = await whatsappBotService.manualInitialize();
        if (success) {
            res.json({ success: true, message: 'WhatsApp Bot inicializado com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao inicializar WhatsApp Bot' });
        }
    } catch (error) {
        console.error('Erro ao inicializar WhatsApp Bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para obter estatísticas do WhatsApp Bot
app.get('/api/whatsapp-stats', async (req, res) => {
    try {
        const status = whatsappBotService.getStatus();
        const stats = {
            connected: status.connected,
            lastUpdate: status.lastUpdate,
            hasError: !!status.error,
            errorMessage: status.error,
            hasQR: !!status.qr,
            uptime: status.lastUpdate ? new Date(status.lastUpdate) : null
        };
        res.json(stats);
    } catch (error) {
        console.error('Erro ao obter estatísticas do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para obter status detalhado do WhatsApp Bot
app.get('/api/whatsapp-status-detailed', async (req, res) => {
    try {
        const detailedStatus = await whatsappBotService.getDetailedStatus();
        res.json({
            success: true,
            data: detailedStatus
        });
    } catch (error) {
        console.error('Erro ao obter status detalhado do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter status detalhado' });
    }
});

// Rota para forçar reconexão do WhatsApp Bot
app.post('/api/whatsapp-reconnect', async (req, res) => {
    try {
        console.log('🔄 Forçando reconexão do WhatsApp Bot via API...');
        const success = await whatsappBotService.forceReconnect();
        
        if (success) {
            res.json({ success: true, message: 'Reconexão iniciada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao forçar reconexão' });
        }
    } catch (error) {
        console.error('Erro ao forçar reconexão do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao forçar reconexão' });
    }
});

// Rota para verificar saúde da conexão do WhatsApp Bot
app.get('/api/whatsapp-health', async (req, res) => {
    try {
        const isHealthy = await whatsappBotService.checkConnectionHealth();
        res.json({
            success: true,
            data: {
                healthy: isHealthy,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Erro ao verificar saúde da conexão:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar saúde da conexão' });
    }
});

// Rota para gerar QR code do WhatsApp
app.post('/api/whatsapp-generate-qr', async (req, res) => {
    try {
        console.log('📱 Gerando QR code do WhatsApp via API...');
        const success = await whatsappBotService.generateManualQR();
        
        if (success) {
            // Aguardar um pouco para o QR ser gerado
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const qrCode = whatsappBotService.getCurrentQR();
            if (qrCode) {
                res.json({ 
                    success: true, 
                    message: 'QR code gerado com sucesso',
                    qrCode: qrCode
                });
            } else {
                res.json({ 
                    success: false, 
                    message: 'QR code não foi gerado, tente novamente'
                });
            }
        } else {
            res.status(500).json({ success: false, message: 'Erro ao gerar QR code' });
        }
    } catch (error) {
        console.error('Erro ao gerar QR code do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar QR code' });
    }
});

// Rota para obter QR code atual
app.get('/api/whatsapp-qr', async (req, res) => {
    try {
        const qrCode = whatsappBotService.getCurrentQR();
        const status = whatsappBotService.getStatus();
        
        res.json({
            success: true,
            data: {
                qrCode: qrCode,
                connected: status.connected,
                error: status.error,
                lastUpdate: status.lastUpdate
            }
        });
    } catch (error) {
        console.error('Erro ao obter QR code:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter QR code' });
    }
});

// Função para determinar tipo de conteúdo
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };
    return contentTypes[ext] || 'application/octet-stream';
}

// Endpoint health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API está funcionando corretamente'
    });
});

// Página inicial
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Enviar confirmação de compra por e-mail (usar email profissional de vendas)
app.post('/api/enviar-confirmacao', async (req, res) => {
    try {
        const { nome, email, produto, valorPago, idTransacao } = req.body;

        if (!nome || !email || !produto || !valorPago || !idTransacao) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }

        const professionalEmailService = require('./services/professionalEmailService');
        const assunto = '🎉 Parabéns! Seu produto está pronto - RatixPay';
        const conteudo = `
            <p>Olá <strong>${nome}</strong>!</p>
            <p>Parabéns pela sua compra do produto <strong>${produto}</strong>, no valor de <strong>${valorPago}</strong>.</p>
            <div style="text-align:center; margin: 30px 0;">
                <a href="${req.body.linkConteudo || '#'}" style="background-color:#F64C00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">📥 Acessar Conteúdo do Produto</a>
            </div>
            <p style="color:#6c757d;font-size:14px;">Guarde este email em local seguro. O link do conteúdo é válido por tempo indeterminado.</p>
        `;
        await professionalEmailService.enviarEmailVendas(email, assunto, conteudo, 'conteudo');

        console.log(`✅ E-mail profissional de vendas enviado para: ${email}`);
        res.status(200).json({ success: true, message: 'E-mail enviado com sucesso.' });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar e-mail.'
        });
    }
});

// Iniciar servidor após inicializar o banco de dados
async function startServer() {
    const maxRetries = 3;
    let retryCount = 0;
    let connected = false;
    
    while (!connected && retryCount < maxRetries) {
        try {
            // Aguardar a inicialização do banco de dados
            await databaseManager.initialize();
            
            // Configurar relacionamentos entre modelos
            setupAssociations();
            
            connected = true;
            
            // Iniciar o servidor apenas após o banco estar pronto
            server.listen(PORT, async () => {
                console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
                
                // Sistema de emails profissionais inicializado
                
                // Inicializar produtos especiais
                // Comentado - arquivo não existe
                // try {
                //     const { initializeSpecialProducts } = require('./scripts/init-special-products');
                //     await initializeSpecialProducts();
                // } catch (error) {
                //     console.error('❌ Erro ao inicializar produtos especiais:', error);
                // }
                
                // Serviço de cancelamento será inicializado apenas quando necessário
                
                // Push notifications removido do sistema
            });
            
        } catch (error) {
            retryCount++;
            console.error(`❌ Tentativa ${retryCount}/${maxRetries} - Erro ao iniciar o banco de dados:`, error.message);
            
            if (retryCount < maxRetries) {
                // Aguardar antes de tentar novamente (backoff exponencial)
                const delay = Math.min(2000 * retryCount, 10000);
                console.log(`Aguardando ${delay/1000} segundos antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ Falha ao conectar ao banco de dados após várias tentativas. Iniciando servidor sem banco de dados.');
                
                // Iniciar o servidor mesmo sem o banco de dados
                // Isso permite que endpoints que não dependem do banco funcionem
                server.listen(PORT, () => {
                    console.log(`⚠️ Servidor rodando em http://localhost:${PORT} (MODO LIMITADO - SEM BANCO DE DADOS)`);
                });
                
                
                // Configurar tentativa de reconexão periódica ao banco
                setupDatabaseReconnection();
            }
        }
    }
}


// Configurar tentativa de reconexão periódica ao banco de dados
function setupDatabaseReconnection() {
    const reconnectInterval = 60000; // 1 minuto
    
    console.log(`Configurando tentativas de reconexão ao banco a cada ${reconnectInterval/1000} segundos...`);
    
    setInterval(async () => {
        try {
            if (!databaseManager.initialized) {
                console.log('Tentando reconectar ao banco de dados...');
                await databaseManager.initialize();
                console.log('✅ Reconexão ao banco de dados bem-sucedida! Sistema operando normalmente.');
            }
        } catch (error) {
            console.error('❌ Falha na tentativa de reconexão ao banco de dados:', error.message);
        }
    }, reconnectInterval);
}

// Inicializar o serviço de WhatsApp Bot (apenas quando solicitado manualmente)
async function initializeWhatsApp() {
    try {
        console.log('🤖 Inicialização manual do WhatsApp Bot solicitada...');
        
        // Inicializar o bot integrado
        const success = await whatsappBotService.manualInitialize();
        
        if (success) {
            console.log('✅ WhatsApp Bot inicializado com sucesso!');
            return true;
        } else {
            console.error('❌ Falha ao inicializar WhatsApp Bot');
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
        return false;
    }
}

// Configurar eventos do Socket.IO
io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado via Socket.IO:', socket.id);
    
    // Evento para notificações em tempo real
    socket.on('join_room', (room) => {
        socket.join(room);
        console.log(`🔌 Cliente ${socket.id} entrou na sala: ${room}`);
    });
    
    socket.on('leave_room', (room) => {
        socket.leave(room);
        console.log(`🔌 Cliente ${socket.id} saiu da sala: ${room}`);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Cliente desconectado:', socket.id);
    });
});

// Tornar Socket.IO disponível globalmente
app.set('io', io);

// Inicializar SocketService
const socketService = require('./services/socketService');
socketService.initialize(io);

// Push notifications removido do sistema

// Cron job para processar fila de remarketing
// Executa a cada 5 minutos
const remarketingService = require('./services/remarketingService');
setInterval(async () => {
    try {
        const stats = await remarketingService.processarFila();
        if (stats.processados > 0) {
            console.log(`📧 Remarketing: ${stats.enviados} enviados, ${stats.ignorados} ignorados, ${stats.erros} erros`);
        }
    } catch (error) {
        console.error('❌ Erro no cron job de remarketing:', error.message);
    }
}, 5 * 60 * 1000); // 5 minutos

// Iniciar o servidor
startServer();

// WhatsApp Bot NÃO será inicializado automaticamente
// Deve ser inicializado manualmente através da página de gestão

// Servidor configurado e pronto
