const winston = require('winston');
const path = require('path');
const fs = require('fs');

class AdvancedLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
        
        // Configuração de formatos
        this.formats = {
            console: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let log = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        log += ` ${JSON.stringify(meta)}`;
                    }
                    return log;
                })
            ),
            
            file: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.errors({ stack: true }),
                winston.format.json()
            )
        };
        
        // Configuração dos transportes
        this.transports = {
            console: new winston.transports.Console({
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                format: this.formats.console
            }),
            
            error: new winston.transports.File({
                filename: path.join(this.logDir, 'error.log'),
                level: 'error',
                format: this.formats.file,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            }),
            
            combined: new winston.transports.File({
                filename: path.join(this.logDir, 'combined.log'),
                format: this.formats.file,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 5
            }),
            
            security: new winston.transports.File({
                filename: path.join(this.logDir, 'security.log'),
                level: 'warn',
                format: this.formats.file,
                maxsize: 5 * 1024 * 1024, // 5MB
                maxFiles: 10
            }),
            
            performance: new winston.transports.File({
                filename: path.join(this.logDir, 'performance.log'),
                level: 'info',
                format: this.formats.file,
                maxsize: 5 * 1024 * 1024, // 5MB
                maxFiles: 5
            }),
            
            database: new winston.transports.File({
                filename: path.join(this.logDir, 'database.log'),
                level: 'info',
                format: this.formats.file,
                maxsize: 5 * 1024 * 1024, // 5MB
                maxFiles: 5
            })
        };
        
        // Criar logger principal
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            transports: [
                this.transports.console,
                this.transports.error,
                this.transports.combined
            ],
            exitOnError: false
        });
        
        // Criar loggers específicos
        this.securityLogger = winston.createLogger({
            level: 'warn',
            transports: [this.transports.security],
            exitOnError: false
        });
        
        this.performanceLogger = winston.createLogger({
            level: 'info',
            transports: [this.transports.performance],
            exitOnError: false
        });
        
        this.databaseLogger = winston.createLogger({
            level: 'info',
            transports: [this.transports.database],
            exitOnError: false
        });
        
        // Configurar rotação de logs
        this.setupLogRotation();
    }

    // Garantir que o diretório de logs existe
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    // Configurar rotação de logs
    setupLogRotation() {
        // Rotacionar logs diariamente
        setInterval(() => {
            this.rotateLogs();
        }, 24 * 60 * 60 * 1000); // 24 horas
    }

    // Rotacionar logs
    rotateLogs() {
        const logFiles = [
            'error.log',
            'combined.log',
            'security.log',
            'performance.log',
            'database.log'
        ];
        
        logFiles.forEach(filename => {
            const filePath = path.join(this.logDir, filename);
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                const fileSize = stats.size;
                
                // Rotacionar se arquivo for maior que 10MB
                if (fileSize > 10 * 1024 * 1024) {
                    const timestamp = new Date().toISOString().split('T')[0];
                    const rotatedPath = path.join(this.logDir, `${filename}.${timestamp}`);
                    
                    try {
                        fs.renameSync(filePath, rotatedPath);
                        console.log(`📁 Log rotacionado: ${filename} -> ${filename}.${timestamp}`);
                    } catch (error) {
                        console.error(`❌ Erro ao rotacionar log ${filename}:`, error);
                    }
                }
            }
        });
    }

    // Log genérico
    log(level, message, meta = {}) {
        this.logger.log(level, message, {
            ...meta,
            timestamp: new Date().toISOString(),
            pid: process.pid,
            hostname: require('os').hostname()
        });
    }

    // Log de erro
    error(message, error = null, meta = {}) {
        const errorMeta = {
            ...meta,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            } : null
        };
        
        this.logger.error(message, errorMeta);
    }

    // Log de aviso
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    // Log de informação
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    // Log de debug
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    // Log de segurança
    security(level, message, meta = {}) {
        this.securityLogger.log(level, message, {
            ...meta,
            timestamp: new Date().toISOString(),
            type: 'SECURITY'
        });
    }

    // Log de performance
    performance(message, meta = {}) {
        this.performanceLogger.info(message, {
            ...meta,
            timestamp: new Date().toISOString(),
            type: 'PERFORMANCE'
        });
    }

    // Log de banco de dados
    database(level, message, meta = {}) {
        this.databaseLogger.log(level, message, {
            ...meta,
            timestamp: new Date().toISOString(),
            type: 'DATABASE'
        });
    }

    // Log de requisição HTTP
    httpRequest(req, res, responseTime) {
        const meta = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            referer: req.get('Referer'),
            contentLength: res.get('Content-Length')
        };
        
        const level = res.statusCode >= 400 ? 'warn' : 'info';
        this.log(level, `${req.method} ${req.url} ${res.statusCode}`, meta);
    }

    // Log de erro de requisição HTTP
    httpError(req, error) {
        const meta = {
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            body: req.body,
            query: req.query,
            params: req.params
        };
        
        this.error(`HTTP Error: ${req.method} ${req.url}`, error, meta);
    }

    // Log de query do banco de dados
    databaseQuery(query, duration, success = true) {
        const level = success ? 'info' : 'error';
        const meta = {
            query: query,
            duration: `${duration}ms`,
            success: success
        };
        
        this.database(level, 'Database Query', meta);
        
        // Log de performance se query for lenta
        if (duration > 1000) {
            this.performance('Slow Query Detected', meta);
        }
    }

    // Log de erro de banco de dados
    databaseError(error, query = null) {
        const meta = {
            query: query,
            error: {
                name: error.name,
                message: error.message,
                code: error.code,
                detail: error.detail
            }
        };
        
        this.database('error', 'Database Error', meta);
    }

    // Log de segurança
    securityEvent(type, message, meta = {}) {
        const securityMeta = {
            ...meta,
            eventType: type,
            severity: this.getSecuritySeverity(type)
        };
        
        this.security('warn', message, securityMeta);
    }

    // Determinar severidade de evento de segurança
    getSecuritySeverity(type) {
        const criticalEvents = [
            'SQL_INJECTION_ATTEMPT',
            'XSS_ATTEMPT',
            'PATH_TRAVERSAL_ATTEMPT',
            'BRUTE_FORCE_ATTACK',
            'UNAUTHORIZED_ACCESS'
        ];
        
        const warningEvents = [
            'SUSPICIOUS_ACTIVITY',
            'RATE_LIMIT_EXCEEDED',
            'INVALID_ORIGIN',
            'BOT_DETECTED'
        ];
        
        if (criticalEvents.includes(type)) {
            return 'CRITICAL';
        } else if (warningEvents.includes(type)) {
            return 'WARNING';
        } else {
            return 'INFO';
        }
    }

    // Log de performance
    performanceMetric(metric, value, meta = {}) {
        const performanceMeta = {
            ...meta,
            metric: metric,
            value: value,
            unit: this.getMetricUnit(metric)
        };
        
        this.performance(`Performance Metric: ${metric}`, performanceMeta);
    }

    // Obter unidade da métrica
    getMetricUnit(metric) {
        const units = {
            'response_time': 'ms',
            'memory_usage': '%',
            'cpu_usage': '%',
            'database_connections': 'count',
            'cache_hit_rate': '%',
            'error_rate': '%'
        };
        
        return units[metric] || 'unknown';
    }

    // Log de transação de pagamento
    paymentTransaction(transaction, status, meta = {}) {
        const transactionMeta = {
            ...meta,
            transactionId: transaction.id,
            amount: transaction.amount,
            method: transaction.method,
            status: status,
            customerEmail: transaction.customerEmail,
            productId: transaction.productId
        };
        
        const level = status === 'success' ? 'info' : 'warn';
        this.log(level, `Payment Transaction: ${status}`, transactionMeta);
    }

    // Log de erro de pagamento
    paymentError(error, transaction = null) {
        const meta = {
            transaction: transaction,
            error: {
                name: error.name,
                message: error.message,
                code: error.code
            }
        };
        
        this.error('Payment Error', error, meta);
    }

    // Log de notificação
    notification(type, message, meta = {}) {
        const notificationMeta = {
            ...meta,
            notificationType: type,
            timestamp: new Date().toISOString()
        };
        
        this.info(`Notification: ${type}`, notificationMeta);
    }

    // Log de erro de notificação
    notificationError(type, error, meta = {}) {
        const notificationMeta = {
            ...meta,
            notificationType: type,
            error: {
                name: error.name,
                message: error.message
            }
        };
        
        this.error(`Notification Error: ${type}`, error, notificationMeta);
    }

    // Middleware para logging automático de requisições
    middleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const responseTime = Date.now() - startTime;
                
                // Log da requisição
                advancedLogger.httpRequest(req, res, responseTime);
                
                // Log de performance se resposta for lenta
                if (responseTime > 2000) {
                    advancedLogger.performanceMetric('slow_response', responseTime, {
                        method: req.method,
                        url: req.url,
                        statusCode: res.statusCode
                    });
                }
                
                originalSend.call(this, data);
            };
            
            // Interceptar erros
            const originalJson = res.json;
            res.json = function(data) {
                if (res.statusCode >= 400) {
                    advancedLogger.httpError(req, new Error(`HTTP ${res.statusCode}: ${data.message || 'Unknown error'}`));
                }
                
                originalJson.call(this, data);
            };
            
            next();
        };
    }

    // Obter estatísticas de logs
    getLogStats() {
        const stats = {
            logFiles: [],
            totalSize: 0,
            lastRotation: new Date().toISOString()
        };
        
        try {
            const files = fs.readdirSync(this.logDir);
            
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const fileStats = fs.statSync(filePath);
                    
                    stats.logFiles.push({
                        name: file,
                        size: fileStats.size,
                        modified: fileStats.mtime,
                        created: fileStats.birthtime
                    });
                    
                    stats.totalSize += fileStats.size;
                }
            });
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de logs:', error);
        }
        
        return stats;
    }

    // Limpar logs antigos
    cleanupOldLogs(daysToKeep = 30) {
        try {
            const files = fs.readdirSync(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            let deletedCount = 0;
            
            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const fileStats = fs.statSync(filePath);
                    
                    if (fileStats.mtime < cutoffDate) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        console.log(`🗑️ Log antigo removido: ${file}`);
                    }
                }
            });
            
            console.log(`✅ Limpeza de logs concluída: ${deletedCount} arquivos removidos`);
            return deletedCount;
        } catch (error) {
            console.error('❌ Erro ao limpar logs antigos:', error);
            return 0;
        }
    }
}

// Instância singleton
const advancedLogger = new AdvancedLogger();

module.exports = advancedLogger;
