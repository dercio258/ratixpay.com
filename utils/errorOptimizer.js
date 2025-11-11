const winston = require('winston');
const path = require('path');

class ErrorOptimizer {
    constructor() {
        this.logger = this.setupLogger();
        this.errorStats = {
            total: 0,
            byType: new Map(),
            byRoute: new Map(),
            byStatus: new Map(),
            lastError: null
        };
        
        this.startErrorMonitoring();
    }

    // Configurar logger
    setupLogger() {
        const logDir = path.join(__dirname, '../logs');
        
        // Criar diretório de logs se não existir
        if (!require('fs').existsSync(logDir)) {
            require('fs').mkdirSync(logDir, { recursive: true });
        }
        
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'ratixpay' },
            transports: [
                // Console transport
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                
                // File transport para erros
                new winston.transports.File({
                    filename: path.join(logDir, 'error.log'),
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                
                // File transport para todos os logs
                new winston.transports.File({
                    filename: path.join(logDir, 'combined.log'),
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                })
            ]
        });
    }

    // Iniciar monitoramento de erros
    startErrorMonitoring() {
        // Processar erros não capturados
        process.on('uncaughtException', (error) => {
            this.handleUncaughtException(error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.handleUnhandledRejection(reason, promise);
        });
        
        // Log de estatísticas a cada 10 minutos
        setInterval(() => {
            this.logErrorStats();
        }, 600000);
    }

    // Manipular exceções não capturadas
    handleUncaughtException(error) {
        this.logger.error('Exceção não capturada:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        // Log de estatísticas
        this.updateErrorStats('uncaughtException', error);
        
        // Graceful shutdown
        process.exit(1);
    }

    // Manipular rejeições não tratadas
    handleUnhandledRejection(reason, promise) {
        this.logger.error('Rejeição não tratada:', {
            reason: reason,
            promise: promise,
            timestamp: new Date().toISOString()
        });
        
        // Log de estatísticas
        this.updateErrorStats('unhandledRejection', reason);
    }

    // Middleware de tratamento de erros
    errorHandlingMiddleware() {
        return (error, req, res, next) => {
            // Log do erro
            this.logger.error('Erro capturado:', {
                error: error.message,
                stack: error.stack,
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            
            // Atualizar estatísticas
            this.updateErrorStats('httpError', error, req);
            
            // Determinar status code
            let statusCode = error.statusCode || error.status || 500;
            
            // Mapear tipos de erro para status codes
            if (error.name === 'ValidationError') {
                statusCode = 400;
            } else if (error.name === 'UnauthorizedError') {
                statusCode = 401;
            } else if (error.name === 'ForbiddenError') {
                statusCode = 403;
            } else if (error.name === 'NotFoundError') {
                statusCode = 404;
            } else if (error.name === 'ConflictError') {
                statusCode = 409;
            } else if (error.name === 'TooManyRequestsError') {
                statusCode = 429;
            }
            
            // Resposta de erro
            const errorResponse = {
                error: error.message || 'Erro interno do servidor',
                code: error.code || 'INTERNAL_ERROR',
                timestamp: new Date().toISOString(),
                path: req.originalUrl
            };
            
            // Adicionar stack trace em desenvolvimento
            if (process.env.NODE_ENV === 'development') {
                errorResponse.stack = error.stack;
            }
            
            res.status(statusCode).json(errorResponse);
        };
    }

    // Middleware de captura de erros 404
    notFoundMiddleware() {
        return (req, res, next) => {
            const error = new Error(`Rota não encontrada: ${req.originalUrl}`);
            error.statusCode = 404;
            error.code = 'ROUTE_NOT_FOUND';
            
            this.logger.warn('Rota não encontrada:', {
                url: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            
            this.updateErrorStats('notFound', error, req);
            
            next(error);
        };
    }

    // Middleware de validação de entrada
    validationMiddleware() {
        return (req, res, next) => {
            try {
                // Validar JSON
                if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                    if (req.get('Content-Type')?.includes('application/json')) {
                        try {
                            JSON.parse(JSON.stringify(req.body));
                        } catch (error) {
                            const validationError = new Error('JSON inválido');
                            validationError.statusCode = 400;
                            validationError.code = 'INVALID_JSON';
                            throw validationError;
                        }
                    }
                }
                
                // Validar parâmetros obrigatórios
                if (req.body) {
                    this.validateRequiredFields(req.body, req.route?.path);
                }
                
                next();
            } catch (error) {
                this.logger.warn('Erro de validação:', {
                    error: error.message,
                    url: req.originalUrl,
                    method: req.method,
                    body: req.body,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('validation', error, req);
                next(error);
            }
        };
    }

    // Validar campos obrigatórios
    validateRequiredFields(body, route) {
        const requiredFields = this.getRequiredFields(route);
        
        for (const field of requiredFields) {
            if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
                const error = new Error(`Campo obrigatório ausente: ${field}`);
                error.statusCode = 400;
                error.code = 'MISSING_REQUIRED_FIELD';
                error.field = field;
                throw error;
            }
        }
    }

    // Obter campos obrigatórios por rota
    getRequiredFields(route) {
        const fieldMap = {
            '/api/auth/login': ['email', 'senha'],
            '/api/auth/register': ['nome', 'email', 'senha', 'telefone'],
            '/api/produtos': ['nome', 'preco', 'categoria'],
            '/api/vendas': ['produtoId', 'quantidade', 'clienteId'],
            '/api/pagamentos': ['vendaId', 'valor', 'metodo']
        };
        
        return fieldMap[route] || [];
    }

    // Middleware de timeout
    timeoutMiddleware(timeout = 30000) {
        return (req, res, next) => {
            req.setTimeout(timeout, () => {
                const error = new Error('Timeout da requisição');
                error.statusCode = 408;
                error.code = 'REQUEST_TIMEOUT';
                
                this.logger.warn('Timeout da requisição:', {
                    url: req.originalUrl,
                    method: req.method,
                    timeout: timeout,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('timeout', error, req);
                
                res.status(408).json({
                    error: 'Timeout da requisição',
                    code: 'REQUEST_TIMEOUT',
                    timestamp: new Date().toISOString()
                });
            });
            
            next();
        };
    }

    // Middleware de rate limiting
    rateLimitMiddleware() {
        const rateLimit = require('express-rate-limit');
        
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100, // Limite de 100 requests por IP
            message: {
                error: 'Muitas requisições. Tente novamente em 15 minutos.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                this.logger.warn('Rate limit excedido:', {
                    ip: req.ip,
                    url: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('rateLimit', new Error('Rate limit excedido'), req);
                
                res.status(429).json({
                    error: 'Muitas requisições. Tente novamente em 15 minutos.',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: 15 * 60
                });
            }
        });
    }

    // Middleware de validação de schema
    schemaValidationMiddleware(schema) {
        return (req, res, next) => {
            try {
                const { error } = schema.validate(req.body);
                if (error) {
                    const validationError = new Error(`Erro de validação: ${error.details[0].message}`);
                    validationError.statusCode = 400;
                    validationError.code = 'SCHEMA_VALIDATION_ERROR';
                    validationError.details = error.details;
                    throw validationError;
                }
                next();
            } catch (error) {
                this.logger.warn('Erro de validação de schema:', {
                    error: error.message,
                    details: error.details,
                    url: req.originalUrl,
                    method: req.method,
                    body: req.body,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('schemaValidation', error, req);
                next(error);
            }
        };
    }

    // Middleware de logging de requisições
    requestLoggingMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                // Log da requisição
                this.logger.info('Requisição processada:', {
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString()
                });
                
                originalSend.call(this, data);
            }.bind(this);
            
            next();
        };
    }

    // Middleware de captura de erros de banco de dados
    databaseErrorMiddleware() {
        return (error, req, res, next) => {
            if (error.name === 'SequelizeValidationError') {
                const validationError = new Error('Erro de validação do banco de dados');
                validationError.statusCode = 400;
                validationError.code = 'DATABASE_VALIDATION_ERROR';
                validationError.details = error.errors.map(err => ({
                    field: err.path,
                    message: err.message,
                    value: err.value
                }));
                
                this.logger.warn('Erro de validação do banco de dados:', {
                    error: validationError.message,
                    details: validationError.details,
                    url: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('databaseValidation', validationError, req);
                return next(validationError);
            }
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                const uniqueError = new Error('Violação de restrição única');
                uniqueError.statusCode = 409;
                uniqueError.code = 'UNIQUE_CONSTRAINT_ERROR';
                uniqueError.field = error.errors[0]?.path;
                
                this.logger.warn('Violação de restrição única:', {
                    error: uniqueError.message,
                    field: uniqueError.field,
                    url: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('uniqueConstraint', uniqueError, req);
                return next(uniqueError);
            }
            
            if (error.name === 'SequelizeForeignKeyConstraintError') {
                const foreignKeyError = new Error('Violação de chave estrangeira');
                foreignKeyError.statusCode = 400;
                foreignKeyError.code = 'FOREIGN_KEY_CONSTRAINT_ERROR';
                foreignKeyError.table = error.table;
                foreignKeyError.field = error.fields[0];
                
                this.logger.warn('Violação de chave estrangeira:', {
                    error: foreignKeyError.message,
                    table: foreignKeyError.table,
                    field: foreignKeyError.field,
                    url: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('foreignKeyConstraint', foreignKeyError, req);
                return next(foreignKeyError);
            }
            
            // Erro genérico de banco de dados
            if (error.name?.includes('Sequelize')) {
                const dbError = new Error('Erro interno do banco de dados');
                dbError.statusCode = 500;
                dbError.code = 'DATABASE_ERROR';
                
                this.logger.error('Erro do banco de dados:', {
                    error: error.message,
                    name: error.name,
                    url: req.originalUrl,
                    method: req.method,
                    timestamp: new Date().toISOString()
                });
                
                this.updateErrorStats('database', dbError, req);
                return next(dbError);
            }
            
            next(error);
        };
    }

    // Atualizar estatísticas de erro
    updateErrorStats(type, error, req = null) {
        this.errorStats.total++;
        
        // Por tipo
        if (!this.errorStats.byType.has(type)) {
            this.errorStats.byType.set(type, 0);
        }
        this.errorStats.byType.set(type, this.errorStats.byType.get(type) + 1);
        
        // Por rota
        if (req) {
            const route = req.originalUrl;
            if (!this.errorStats.byRoute.has(route)) {
                this.errorStats.byRoute.set(route, 0);
            }
            this.errorStats.byRoute.set(route, this.errorStats.byRoute.get(route) + 1);
        }
        
        // Por status
        const status = error.statusCode || error.status || 500;
        if (!this.errorStats.byStatus.has(status)) {
            this.errorStats.byStatus.set(status, 0);
        }
        this.errorStats.byStatus.set(status, this.errorStats.byStatus.get(status) + 1);
        
        // Último erro
        this.errorStats.lastError = {
            type,
            message: error.message,
            status: status,
            timestamp: new Date().toISOString(),
            route: req?.originalUrl
        };
    }

    // Log de estatísticas de erro
    logErrorStats() {
        console.log('📊 Estatísticas de erros:', {
            total: this.errorStats.total,
            byType: Object.fromEntries(this.errorStats.byType),
            byRoute: Object.fromEntries(this.errorStats.byRoute),
            byStatus: Object.fromEntries(this.errorStats.byStatus),
            lastError: this.errorStats.lastError
        });
    }

    // Obter estatísticas de erro
    getErrorStats() {
        return {
            ...this.errorStats,
            byType: Object.fromEntries(this.errorStats.byType),
            byRoute: Object.fromEntries(this.errorStats.byRoute),
            byStatus: Object.fromEntries(this.errorStats.byStatus)
        };
    }

    // Limpar estatísticas
    clearErrorStats() {
        this.errorStats = {
            total: 0,
            byType: new Map(),
            byRoute: new Map(),
            byStatus: new Map(),
            lastError: null
        };
        
        console.log('🧹 Estatísticas de erro limpas');
    }

    // Obter logger
    getLogger() {
        return this.logger;
    }

    // Configurar logger
    configureLogger(options = {}) {
        if (options.level) {
            this.logger.level = options.level;
        }
        
        if (options.transports) {
            this.logger.clear();
            this.logger.add(options.transports);
        }
        
        console.log('⚙️ Logger configurado:', options);
    }
}

// Instância singleton
const errorOptimizer = new ErrorOptimizer();

module.exports = errorOptimizer;
