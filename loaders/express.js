const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const compression = require('compression');
const {
    createRateLimiters,
    createSlowDown,
    sanitizeInput,
    auditLog,
    integrityCheck,
    attackProtection,
    securityHeaders,
    helmetConfig
} = require('../middleware/security');
const advancedSecurity = require('../middleware/advancedSecurity');
const { captureAnalytics, captureConversion } = require('../middleware/analytics');
require('../config/passport'); // Inicializar Passport config

/**
 * Carrega configurações e middlewares do Express
 * @param {Object} app - Instância do Express
 */
function loadExpress(app) {
    // Configuração para confiar no proxy
    app.set('trust proxy', 1);

    // Segurança Básica
    const rateLimiters = createRateLimiters();
    const slowDown = createSlowDown();

    app.use(helmetConfig);
    app.use(securityHeaders);

    // Cache Control (Cloudflare optimization)
    app.use((req, res, next) => {
        res.setHeader('CF-Cache-Status', 'BYPASS');
        res.setHeader('CF-Ray', req.headers['cf-ray'] || '');

        if (req.path.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
            res.setHeader('Expires', new Date(Date.now() + 300000).toUTCString());
        } else if (req.path.match(/\.(woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
            res.setHeader('Expires', new Date(Date.now() + 3600000).toUTCString());
        } else {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Last-Modified', new Date().toUTCString());
            res.setHeader('ETag', '');
        }

        if (req.path === '/sw.js' || req.path === '/sw-pwa.js' || req.path.includes('service-worker') || req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }

        next();
    });

    // CSP
    app.use((req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.socket.io https://connect.facebook.net https://static.cloudflareinsights.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.quilljs.com; " +
            "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdn.tailwindcss.com https://unpkg.com https://cdn.quilljs.com; " +
            "img-src 'self' data: https: http://localhost:* http://127.0.0.1:*; " +
            "media-src 'self' https://www.myinstants.com https://actions.google.com https: blob:; " +
            "connect-src 'self' https://connect.facebook.net https://www.facebook.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://static.cloudflareinsights.com https://fonts.googleapis.com https://api.utmify.com.br https://api.utmify.com https://cdn.socket.io wss://cdn.socket.io https://cdn.socket.io wss://ratixpay.site ws://ratixpay.site ws://localhost:* http://localhost:* wss://localhost:* https://cdn.tailwindcss.com https://unpkg.com; " +
            "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://fonts.gstatic.com; " +
            "frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtu.be https://youtu.be https://player.vimeo.com https://vimeo.com https://www.vimeo.com https://embed.videodelivery.net https://*.cloudinary.com https://*.cloudflare.com https://scripts.converteai.net https://*.converteai.net blob:; " +
            "worker-src 'self' blob:;"
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

    // Analytics
    app.use(captureAnalytics);
    app.use(captureConversion);

    // CORS
    app.use(cors({
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Pragma', 'Cache-Control'],
        credentials: true
    }));

    // Advanced Security (Rate Limiters)
    const advancedRateLimiters = advancedSecurity.createAdvancedRateLimiters();
    app.use('/api/auth', advancedRateLimiters.auth);
    app.use('/api/pagar', advancedRateLimiters.payment);
    app.use(advancedSecurity.createDynamicSlowDown());

    // Compression
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) return false;
            return compression.filter(req, res);
        }
    }));

    // Body Parser & Cookie Parser (DEVE VIR ANTES DO sanitizeInput)
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Sanitize Input (DEVE VIR DEPOIS DO BODY PARSER)
    app.use(sanitizeInput);

    // Session
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

    // Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Static Files
    configureStaticFiles(app);

    // Routes
    loadRoutes(app);

    // Error Handling
    app.use((err, req, res, next) => {
        if (err && (err.message.includes('timeout') || err.message.includes('terminated') || err.message.includes('Connection terminated'))) {
            console.error('Erro de conexão com o banco de dados interceptado:', err.message);
            return res.status(503).json({
                success: false,
                message: 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.',
                error: 'database_connection_error'
            });
        }
        next(err);
    });
}

function configureStaticFiles(app) {
    const rootDir = path.resolve(__dirname, '..');

    app.use(express.static(path.join(rootDir, 'public')));

    const staticOptions = {
        maxAge: '1M',
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
            res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
            res.setHeader('Vary', 'Accept-Encoding');
        }
    };

    app.use('/css', express.static(path.join(rootDir, 'public', 'css'), staticOptions));
    app.use('/js', express.static(path.join(rootDir, 'public', 'js'), staticOptions));
    app.use('/assets', express.static(path.join(rootDir, 'public', 'assets'), staticOptions));

    app.use('/uploads', express.static(path.join(rootDir, 'public', 'uploads'), {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
            res.setHeader('Vary', 'Accept-Encoding');
        }
    }));

    app.use('/ratixshop', express.static(path.join(rootDir, 'ratixshop')));

    // Templates
    app.use('/templates', express.static(path.join(rootDir, 'public', 'templates'), {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
            } else if (filePath.endsWith('.json')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
        }
    }));
}

function loadRoutes(app) {
    const rootDir = path.resolve(__dirname, '..');

    // API Routes
    app.use('/api/auth', require('../routes/auth'));
    app.use('/api/dashboard', require('../routes/dashboard'));
    app.use('/api/produtos', require('../routes/produtos'));
    app.use('/api/vendedor/afiliados', require('../routes/afiliados-vendedor'));
    app.use('/api/afiliados', require('../routes/afiliados'));
    app.use('/api/vendas', require('../routes/vendas'));
    app.use('/api/imagem', require('../routes/imagem'));
    app.use('/api/whatsapp', require('../routes/whatsapp'));
    app.use('/api/estatisticas', require('../routes/estatisticas'));

    // Admin Routes
    app.use('/api/admin/dashboard', require('../routes/admin-dashboard'));
    app.use('/api/admin', require('../routes/admin-saques'));
    app.use('/api/admin', require('../routes/admin'));
    app.use('/api/admin', require('../routes/admin-gestao-negocio'));
    app.use('/api/admin', require('../routes/admin-produtos'));
    app.use('/api/admin', require('../routes/admin-cancelamentos'));
    app.use('/api/admin/notificacoes', require('../routes/adminNotifications'));

    // Other Services
    app.use('/api/chatbot', require('../routes/chatbot'));
    app.use('/api/ratixshop', require('../routes/ratixshop'));
    app.use('/api/notifications', require('../routes/notifications'));
    app.use('/api/notifications', require('../routes/notification-api'));
    app.use('/api/remarketing', require('../routes/remarketing'));
    app.use('/api/upsell', require('../routes/upsell'));
    app.use('/api/notificacoes', require('../routes/notifications'));
    app.use('/api/push', require('../routes/push'));
    app.use('/api/cache', require('../routes/cache-monitor'));
    app.use('/api/image-cache', require('../routes/image-cache'));
    app.use('/api/upload', require('../routes/upload'));
    app.use('/api/upload/enhanced', require('../routes/enhanced-upload'));
    app.use('/api/upload/enhanced-content', require('../routes/enhanced-content-upload'));
    app.use('/api/taxas', require('../routes/taxas'));
    app.use('/api/saques', require('../routes/saques'));
    app.use('/api/configuracoes', require('../routes/configuracoes'));
    app.use('/api/registration-control', require('../routes/registration-control'));
    app.use('/api/dashboard', require('../routes/dashboard-metrics'));
    app.use('/api/experts', require('../routes/experts'));
    app.use('/api/webhooks', require('../routes/webhooks').router);
    app.use('/api/email-monitor', require('../routes/email-monitor'));
    app.use('/api/email', require('../routes/professional-email'));
    app.use('/admin-reset', require('../routes/admin-reset'));
    app.use('/api', require('../routes/pagamento'));
    app.use('/api', require('../routes/e2payments'));
    app.use('/api/carteiras', require('../routes/carteiras'));
    app.use('/api/transactions', require('../routes/transactions-optimized'));
    app.use('/api/produtos-integracao', require('../routes/produtos-integracao'));
    app.use('/api/produtos-complementares', require('../routes/produtos-complementares'));
    app.use('/api/blog', require('../routes/blog'));

    // Rotas extraídas do server.js
    app.use('/api/whatsapp-bot', require('../routes/whatsapp-bot'));
    app.use('/api', require('../routes/misc'));

    // Public Pages Routes
    app.get('/', (req, res) => res.sendFile(path.join(rootDir, 'public', 'index.html')));

    app.get('/payment/success', (req, res) => {
        res.sendFile(path.join(rootDir, 'public', 'payment-success.html'));
    });

    app.get('/payment-success.html', (req, res) => {
        const { pedido, idpedido } = req.query;
        if (!pedido && !idpedido) {
            return res.status(400).send(`
                <html>
                    <head><title>Acesso Negado - RatixPay</title></head>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h1 style="color: #f64c00;">🔒 Acesso Negado</h1>
                        <p>Link inválido ou expirado.</p>
                    </body>
                </html>
            `);
        }
        res.sendFile(path.join(rootDir, 'public', 'payment-success.html'));
    });

    app.get('/upsell-page.html', (req, res) => {
        res.sendFile(path.join(rootDir, 'public', 'upsell-page.html'));
    });

    app.get('/sucess/pedido=:numeroPedido', (req, res) => {
        res.sendFile(path.join(rootDir, 'public', 'sucess.html'));
    });

    app.get('/whatsapp-bot', (req, res) => {
        res.sendFile(path.join(rootDir, 'bot', 'public', 'index.html'));
    });

    // Blog Routes
    app.get('/blog', (req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.sendFile(path.join(rootDir, 'public', 'blog.html'));
    });
    app.get('/blog-post.html', (req, res) => {
        // Headers explícitos para garantir que o navegador não tente interpretar como JavaScript
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        res.sendFile(path.join(rootDir, 'public', 'blog-post.html'));
    });

    // Health Check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });
}

module.exports = { loadExpress };
