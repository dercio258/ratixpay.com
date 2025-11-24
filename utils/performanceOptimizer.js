const cluster = require('cluster');
const os = require('os');
const { performance } = require('perf_hooks');

class PerformanceOptimizer {
    constructor() {
        this.isMaster = cluster.isMaster;
        this.workers = [];
        this.performanceMetrics = {
            requests: 0,
            averageResponseTime: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            activeConnections: 0
        };
        
        if (this.isMaster) {
            this.setupCluster();
        } else {
            this.setupWorker();
        }
    }

    // Configurar cluster para aproveitar múltiplos cores
    setupCluster() {
        const numCPUs = os.cpus().length;
        const numWorkers = Math.min(numCPUs, 4); // Máximo 4 workers
        
        console.log(`🚀 Iniciando ${numWorkers} workers para aproveitar ${numCPUs} cores`);
        
        // Criar workers
        for (let i = 0; i < numWorkers; i++) {
            const worker = cluster.fork();
            this.workers.push(worker);
            
            worker.on('message', (message) => {
                this.handleWorkerMessage(worker, message);
            });
            
            worker.on('exit', (code, signal) => {
                console.log(`⚠️ Worker ${worker.process.pid} morreu. Reiniciando...`);
                const newWorker = cluster.fork();
                this.workers.push(newWorker);
            });
        }
        
        // Monitorar workers
        cluster.on('exit', (worker, code, signal) => {
            console.log(`Worker ${worker.process.pid} morreu`);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('🛑 Recebido SIGTERM, encerrando workers...');
            this.workers.forEach(worker => {
                worker.kill('SIGTERM');
            });
        });
    }

    // Configurar worker
    setupWorker() {
        // Configurar garbage collection
        if (global.gc) {
            setInterval(() => {
                global.gc();
            }, 30000); // GC a cada 30 segundos
        }
        
        // Monitorar memória
        setInterval(() => {
            const memUsage = process.memoryUsage();
            if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
                console.log('⚠️ Uso de memória alto, forçando GC');
                if (global.gc) {
                    global.gc();
                }
            }
        }, 10000); // Verificar a cada 10 segundos
    }

    // Manipular mensagens dos workers
    handleWorkerMessage(worker, message) {
        switch (message.type) {
            case 'metrics':
                this.updateMetrics(message.data);
                break;
            case 'error':
                console.error(`❌ Erro no worker ${worker.process.pid}:`, message.error);
                break;
        }
    }

    // Atualizar métricas de performance
    updateMetrics(data) {
        this.performanceMetrics = {
            ...this.performanceMetrics,
            ...data,
            timestamp: new Date().toISOString()
        };
    }

    // Middleware de otimização de performance
    performanceMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                // Otimizar resposta baseada no tamanho
                if (typeof data === 'string' && data.length > 10000) {
                    // Comprimir resposta grande
                    res.setHeader('Content-Encoding', 'gzip');
                }
                
                // Adicionar headers de cache para recursos estáticos
                if (req.path.includes('/assets/') || req.path.includes('/images/')) {
                    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 ano
                    res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
                }
                
                originalSend.call(this, data);
            };
            
            next();
        };
    }

    // Otimizar queries do banco de dados
    optimizeDatabaseQueries() {
        return {
            // Configurações otimizadas do Sequelize
            sequelize: {
                pool: {
                    max: 20,
                    min: 5,
                    acquire: 60000,
                    idle: 30000
                },
                retry: {
                    max: 5,
                    timeout: 60000
                },
                logging: false, // Desabilitar em produção
                benchmark: false,
                minifyAliases: true
            },
            
            // Configurações de query
            query: {
                raw: false,
                nest: true,
                plain: false
            }
        };
    }

    // Otimizar middleware de compressão
    compressionMiddleware() {
        const compression = require('compression');
        
        return compression({
            level: 6, // Nível de compressão balanceado
            threshold: 1024, // Comprimir apenas arquivos > 1KB
            filter: (req, res) => {
                // Não comprimir se já comprimido
                if (req.headers['x-no-compression']) {
                    return false;
                }
                
                // Usar compressão para todos os tipos de conteúdo
                return compression.filter(req, res);
            }
        });
    }

    // Otimizar middleware de cache
    cacheMiddleware() {
        return (req, res, next) => {
            // Cache para APIs que não mudam frequentemente
            if (req.path.includes('/api/produtos') && req.method === 'GET') {
                res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutos
            } else if (req.path.includes('/api/estatisticas') && req.method === 'GET') {
                res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minuto
            } else if (req.path.includes('/api/configuracoes') && req.method === 'GET') {
                res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutos
            }
            
            next();
        };
    }

    // Otimizar middleware de parsing
    parsingMiddleware() {
        return (req, res, next) => {
            // Limitar tamanho do body
            if (req.get('Content-Length') > 10 * 1024 * 1024) { // 10MB
                return res.status(413).json({
                    error: 'Payload muito grande',
                    code: 'PAYLOAD_TOO_LARGE'
                });
            }
            
            next();
        };
    }

    // Otimizar middleware de CORS
    corsMiddleware() {
        const cors = require('cors');
        
        return cors({
            origin: (origin, callback) => {
                const allowedOrigins = [
                    'https://ratixpay.com',
                    'https://www.ratixpay.com',
                    'https://ratixpay-backend.onrender.com',
                    'http://localhost:4000',
                    'http://127.0.0.1:4000'
                ];
                
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Não permitido pelo CORS'));
                }
            },
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
            credentials: true,
            maxAge: 86400 // 24 horas
        });
    }

    // Otimizar middleware de sessão
    sessionMiddleware() {
        const session = require('express-session');
        const RedisStore = require('connect-redis')(session);
        
        return session({
            store: new RedisStore({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0
            }),
            secret: process.env.SESSION_SECRET || 'ratixpay-secret-key-2024',
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 24 horas
                sameSite: 'strict'
            },
            name: 'ratixpay.sid'
        });
    }

    // Otimizar middleware de helmet
    helmetMiddleware() {
        const helmet = require('helmet');
        
        return helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"],
                    styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
                    imgSrc: ["'self'", "data:", "https:", "http://localhost:*", "http://127.0.0.1:*"],
                    fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com"],
                    connectSrc: ["'self'", "https://opay.mucamba.site", "https://www.ratixpay.com", "https://fonts.googleapis.com"],
                    frameAncestors: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        });
    }

    // Otimizar middleware de rate limiting
    rateLimitMiddleware() {
        const rateLimit = require('express-rate-limit');
        
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: (req) => {
                // Limite dinâmico baseado no tipo de requisição
                if (req.path.includes('/api/auth')) {
                    return 10; // Limite menor para autenticação
                } else if (req.path.includes('/api/pagar')) {
                    return 20; // Limite médio para pagamentos
                } else {
                    return 100; // Limite maior para APIs gerais
                }
            },
            message: {
                error: 'Muitas requisições. Tente novamente em 15 minutos.',
                retryAfter: 15 * 60
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => req.path === '/api/health'
        });
    }

    // Otimizar middleware de slow down
    slowDownMiddleware() {
        const slowDown = require('express-slow-down');
        
        return slowDown({
            windowMs: 15 * 60 * 1000, // 15 minutos
            delayAfter: 50, // Começar a desacelerar após 50 requests
            delayMs: 500, // Adicionar 500ms de delay por request
            maxDelayMs: 20000, // Máximo 20 segundos de delay
            skip: (req) => req.path === '/api/health'
        });
    }

    // Otimizar middleware de timeout
    timeoutMiddleware(timeout = 30000) {
        return (req, res, next) => {
            req.setTimeout(timeout, () => {
                res.status(408).json({
                    error: 'Timeout da requisição',
                    code: 'REQUEST_TIMEOUT'
                });
            });
            
            next();
        };
    }

    // Otimizar middleware de keep-alive
    keepAliveMiddleware() {
        return (req, res, next) => {
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Keep-Alive', 'timeout=5, max=1000');
            next();
        };
    }

    // Otimizar middleware de ETag
    etagMiddleware() {
        return (req, res, next) => {
            // Adicionar ETag para recursos estáticos
            if (req.path.includes('/assets/') || req.path.includes('/images/')) {
                res.setHeader('ETag', `"${Date.now()}"`);
            }
            next();
        };
    }

    // Otimizar middleware de preload
    preloadMiddleware() {
        return (req, res, next) => {
            // Adicionar preload para recursos críticos
            if (req.path === '/') {
                res.setHeader('Link', '</css/style.css>; rel=preload; as=style, </assets/js/main.js>; rel=preload; as=script');
            }
            next();
        };
    }

    // Obter métricas de performance
    getPerformanceMetrics() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        return {
            ...this.performanceMetrics,
            memory: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            },
            uptime: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version
        };
    }

    // Otimizar configurações do Node.js
    optimizeNodeSettings() {
        // Aumentar limite de listeners
        process.setMaxListeners(20);
        
        // Configurar variáveis de ambiente para performance
        process.env.UV_THREADPOOL_SIZE = '16';
        process.env.NODE_OPTIONS = '--max-old-space-size=2048';
        
        // Configurar garbage collection
        if (process.env.NODE_ENV === 'production') {
            process.env.NODE_OPTIONS += ' --expose-gc';
        }
    }

    // Otimizar configurações do Express
    optimizeExpressSettings(app) {
        // Desabilitar x-powered-by
        app.disable('x-powered-by');
        
        // Configurar trust proxy
        app.set('trust proxy', 1);
        
        // Configurar view engine
        app.set('view engine', 'html');
        app.set('views', path.join(__dirname, '../public'));
        
        // Configurar variáveis
        app.set('env', process.env.NODE_ENV || 'development');
        app.set('port', process.env.PORT || 3000);
    }

    // Otimizar configurações do banco de dados
    optimizeDatabaseSettings() {
        return {
            // Configurações do PostgreSQL
            postgres: {
                max_connections: 200,
                shared_buffers: '256MB',
                effective_cache_size: '1GB',
                maintenance_work_mem: '64MB',
                checkpoint_completion_target: 0.9,
                wal_buffers: '16MB',
                default_statistics_target: 100,
                random_page_cost: 1.1,
                effective_io_concurrency: 200,
                work_mem: '4MB',
                min_wal_size: '1GB',
                max_wal_size: '4GB'
            },
            
            // Configurações do Redis
            redis: {
                maxmemory: '256mb',
                maxmemory_policy: 'allkeys-lru',
                tcp_keepalive: 60,
                timeout: 300
            }
        };
    }
}

// Instância singleton
const performanceOptimizer = new PerformanceOptimizer();

module.exports = performanceOptimizer;
