const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const SECURITY_DEBUG = process.env.SECURITY_DEBUG === 'true';

class SecurityOptimizer {
    constructor() {
        this.securityConfig = {
            rateLimits: {
                general: { windowMs: 15 * 60 * 1000, max: 100 },
                auth: { windowMs: 15 * 60 * 1000, max: 10 },
                payment: { windowMs: 15 * 60 * 1000, max: 20 },
                upload: { windowMs: 15 * 60 * 1000, max: 5 }
            },
            slowDown: {
                windowMs: 15 * 60 * 1000,
                delayAfter: 50,
                delayMs: 500,
                maxDelayMs: 20000
            },
            securityHeaders: {
                csp: "default-src 'self'; script-src 'self' 'unsafe-inline' cdnjs.cloudflare.com cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com cdn.jsdelivr.net fonts.googleapis.com; img-src 'self' data: https: http://localhost:* http://127.0.0.1:*; font-src 'self' cdnjs.cloudflare.com cdn.jsdelivr.net fonts.googleapis.com fonts.gstatic.com; connect-src 'self' https://opay.mucamba.site https://fonts.googleapis.com https://api.utmify.com.br https://api.utmify.com; frame-src 'self' https://www.youtube.com https://youtube.com https://www.youtu.be https://youtu.be https://player.vimeo.com https://vimeo.com https://www.vimeo.com https://embed.videodelivery.net https://*.cloudinary.com https://*.cloudflare.com",
                hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
                xss: '1; mode=block',
                frameOptions: 'DENY',
                contentType: 'nosniff',
                referrer: 'strict-origin-when-cross-origin'
            }
        };
        
        this.securityStats = {
            blockedRequests: 0,
            suspiciousIPs: new Set(),
            failedAttempts: new Map(),
            lastCleanup: Date.now()
        };
        
        this.startSecurityMonitoring();
    }

    // Iniciar monitoramento de segurança
    startSecurityMonitoring() {
        // Limpeza de dados de segurança a cada 5 minutos
        setInterval(() => {
            this.cleanupSecurityData();
        }, 300000);
        
        // Log de estatísticas a cada 10 minutos
        setInterval(() => {
            if (SECURITY_DEBUG) {
                this.logSecurityStats();
            }
        }, 600000);
    }

    // Middleware de rate limiting otimizado
    rateLimitMiddleware() {
        return rateLimit({
            windowMs: this.securityConfig.rateLimits.general.windowMs,
            max: (req) => {
                // Limite dinâmico baseado no tipo de requisição
                if (req.path.includes('/api/auth')) {
                    return this.securityConfig.rateLimits.auth.max;
                } else if (req.path.includes('/api/pagar')) {
                    return this.securityConfig.rateLimits.payment.max;
                } else if (req.path.includes('/api/upload')) {
                    return this.securityConfig.rateLimits.upload.max;
                } else {
                    return this.securityConfig.rateLimits.general.max;
                }
            },
            message: {
                error: 'Muitas requisições. Tente novamente em 15 minutos.',
                retryAfter: 15 * 60
            },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req) => req.path === '/api/health',
            keyGenerator: (req) => {
                // Usar IP + User-Agent para melhor identificação
                return `${req.ip}-${req.get('User-Agent')}`;
            }
        });
    }

    // Middleware de slow down otimizado
    slowDownMiddleware() {
        return slowDown({
            windowMs: this.securityConfig.slowDown.windowMs,
            delayAfter: this.securityConfig.slowDown.delayAfter,
            delayMs: this.securityConfig.slowDown.delayMs,
            maxDelayMs: this.securityConfig.slowDown.maxDelayMs,
            skip: (req) => req.path === '/api/health',
            keyGenerator: (req) => {
                return `${req.ip}-${req.get('User-Agent')}`;
            }
        });
    }

    // Middleware de headers de segurança
    securityHeadersMiddleware() {
        return (req, res, next) => {
            // Content Security Policy
            res.setHeader('Content-Security-Policy', this.securityConfig.securityHeaders.csp);
            
            // Strict Transport Security
            res.setHeader('Strict-Transport-Security', 
                `max-age=${this.securityConfig.securityHeaders.hsts.maxAge}; includeSubDomains; preload`);
            
            // X-XSS-Protection
            res.setHeader('X-XSS-Protection', this.securityConfig.securityHeaders.xss);
            
            // X-Frame-Options
            res.setHeader('X-Frame-Options', this.securityConfig.securityHeaders.frameOptions);
            
            // X-Content-Type-Options
            res.setHeader('X-Content-Type-Options', this.securityConfig.securityHeaders.contentType);
            
            // Referrer Policy
            res.setHeader('Referrer-Policy', this.securityConfig.securityHeaders.referrer);
            
            // X-Powered-By (remover)
            res.removeHeader('X-Powered-By');
            
            // X-DNS-Prefetch-Control
            res.setHeader('X-DNS-Prefetch-Control', 'off');
            
            // X-Download-Options
            res.setHeader('X-Download-Options', 'noopen');
            
            // X-Permitted-Cross-Domain-Policies
            res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
            
            next();
        };
    }

    // Middleware de validação de entrada
    inputValidationMiddleware() {
        return (req, res, next) => {
            // Validar tamanho do body
            if (req.get('Content-Length') > 10 * 1024 * 1024) { // 10MB
                return res.status(413).json({
                    error: 'Payload muito grande',
                    code: 'PAYLOAD_TOO_LARGE'
                });
            }
            
            // Validar Content-Type
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                const contentType = req.get('Content-Type');
                if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
                    return res.status(400).json({
                        error: 'Content-Type inválido',
                        code: 'INVALID_CONTENT_TYPE'
                    });
                }
            }
            
            // Validar parâmetros de query
            if (req.query) {
                for (const [key, value] of Object.entries(req.query)) {
                    if (typeof value === 'string' && value.length > 1000) {
                        return res.status(400).json({
                            error: 'Parâmetro de query muito longo',
                            code: 'QUERY_PARAM_TOO_LONG'
                        });
                    }
                }
            }
            
            next();
        };
    }

    // Middleware de sanitização de entrada
    inputSanitizationMiddleware() {
        return (req, res, next) => {
            // Sanitizar body
            if (req.body) {
                req.body = this.sanitizeObject(req.body);
            }
            
            // Sanitizar query
            if (req.query) {
                req.query = this.sanitizeObject(req.query);
            }
            
            // Sanitizar params
            if (req.params) {
                req.params = this.sanitizeObject(req.params);
            }
            
            next();
        };
    }

    // Sanitizar objeto
    sanitizeObject(obj) {
        if (typeof obj === 'string') {
            return this.sanitizeString(obj);
        } else if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        } else if (typeof obj === 'object' && obj !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                sanitized[key] = this.sanitizeObject(value);
            }
            return sanitized;
        }
        
        return obj;
    }

    // Sanitizar string
    sanitizeString(str) {
        if (typeof str !== 'string') {
            return str;
        }
        
        // Remover caracteres perigosos
        return str
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/data:text\/html/gi, '')
            .trim();
    }

    // Middleware de detecção de ataques
    attackDetectionMiddleware() {
        return (req, res, next) => {
            const ip = req.ip;
            const userAgent = req.get('User-Agent') || '';
            const path = req.path;
            const method = req.method;
            
            // Detectar SQL injection
            if (this.detectSQLInjection(req)) {
                this.logSecurityEvent('SQL_INJECTION_ATTEMPT', { ip, path, method });
                return res.status(400).json({
                    error: 'Requisição suspeita detectada',
                    code: 'SUSPICIOUS_REQUEST'
                });
            }
            
            // Detectar XSS
            if (this.detectXSS(req)) {
                this.logSecurityEvent('XSS_ATTEMPT', { ip, path, method });
                return res.status(400).json({
                    error: 'Requisição suspeita detectada',
                    code: 'SUSPICIOUS_REQUEST'
                });
            }
            
            // Detectar path traversal
            if (this.detectPathTraversal(req)) {
                this.logSecurityEvent('PATH_TRAVERSAL_ATTEMPT', { ip, path, method });
                return res.status(400).json({
                    error: 'Requisição suspeita detectada',
                    code: 'SUSPICIOUS_REQUEST'
                });
            }
            
            // Detectar User-Agent suspeito
            if (this.detectSuspiciousUserAgent(userAgent)) {
                this.logSecurityEvent('SUSPICIOUS_USER_AGENT', { ip, userAgent, path });
                this.securityStats.suspiciousIPs.add(ip);
            }
            
            // Verificar se IP está bloqueado
            if (this.securityStats.suspiciousIPs.has(ip)) {
                this.logSecurityEvent('BLOCKED_IP_ACCESS', { ip, path, method });
                this.securityStats.blockedRequests++;
                return res.status(403).json({
                    error: 'Acesso negado',
                    code: 'ACCESS_DENIED'
                });
            }
            
            next();
        };
    }

    // Detectar SQL injection
    detectSQLInjection(req) {
        const suspiciousPatterns = [
            /union\s+select/i,
            /drop\s+table/i,
            /delete\s+from/i,
            /insert\s+into/i,
            /update\s+set/i,
            /or\s+1\s*=\s*1/i,
            /and\s+1\s*=\s*1/i,
            /'\s*or\s*'/i,
            /"\s*or\s*"/i,
            /;\s*drop/i,
            /;\s*delete/i,
            /;\s*insert/i,
            /;\s*update/i
        ];
        
        const searchText = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
        
        return suspiciousPatterns.some(pattern => pattern.test(searchText));
    }

    // Detectar XSS
    detectXSS(req) {
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,
            /<iframe/i,
            /<object/i,
            /<embed/i,
            /<link/i,
            /<meta/i,
            /<style/i,
            /expression\s*\(/i,
            /url\s*\(/i,
            /@import/i
        ];
        
        const searchText = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params);
        
        return suspiciousPatterns.some(pattern => pattern.test(searchText));
    }

    // Detectar path traversal
    detectPathTraversal(req) {
        const suspiciousPatterns = [
            /\.\.\//,
            /\.\.\\/,
            /\.\.%2f/i,
            /\.\.%5c/i,
            /\.\.%252f/i,
            /\.\.%255c/i,
            /\.\.%c0%af/i,
            /\.\.%c1%9c/i
        ];
        
        const searchText = JSON.stringify(req.body) + JSON.stringify(req.query) + JSON.stringify(req.params) + req.path;
        
        return suspiciousPatterns.some(pattern => pattern.test(searchText));
    }

    // Detectar User-Agent suspeito
    detectSuspiciousUserAgent(userAgent) {
        const suspiciousPatterns = [
            /sqlmap/i,
            /nikto/i,
            /nmap/i,
            /masscan/i,
            /zap/i,
            /burp/i,
            /w3af/i,
            /havij/i,
            /acunetix/i,
            /nessus/i,
            /openvas/i,
            /metasploit/i,
            /curl/i,
            /wget/i,
            /python-requests/i,
            /go-http-client/i,
            /java/i,
            /php/i,
            /perl/i,
            /ruby/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(userAgent));
    }

    // Middleware de auditoria de segurança
    securityAuditMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                // Log de auditoria
                this.logSecurityEvent('REQUEST_PROCESSED', {
                    ip: req.ip,
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    userAgent: req.get('User-Agent'),
                    referer: req.get('Referer'),
                    timestamp: new Date().toISOString()
                });
                
                originalSend.call(this, data);
            }.bind(this);
            
            next();
        };
    }

    // Middleware de verificação de integridade
    integrityCheckMiddleware() {
        return (req, res, next) => {
            // Verificar integridade do token JWT se presente
            const authHeader = req.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                if (!this.verifyTokenIntegrity(token)) {
                    return res.status(401).json({
                        error: 'Token inválido',
                        code: 'INVALID_TOKEN'
                    });
                }
            }
            
            // Verificar integridade de cookies
            if (req.cookies) {
                for (const [name, value] of Object.entries(req.cookies)) {
                    if (!this.verifyCookieIntegrity(name, value)) {
                        return res.status(400).json({
                            error: 'Cookie inválido',
                            code: 'INVALID_COOKIE'
                        });
                    }
                }
            }
            
            next();
        };
    }

    // Verificar integridade do token
    verifyTokenIntegrity(token) {
        try {
            // Verificar formato básico do JWT
            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }
            
            // Verificar se as partes são base64 válidas
            for (const part of parts) {
                if (!/^[A-Za-z0-9_-]+$/.test(part)) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            return false;
        }
    }

    // Verificar integridade do cookie
    verifyCookieIntegrity(name, value) {
        // Verificar se o nome do cookie é válido
        if (!/^[A-Za-z0-9_-]+$/.test(name)) {
            return false;
        }
        
        // Verificar se o valor não contém caracteres perigosos
        if (typeof value === 'string' && /[<>'"]/.test(value)) {
            return false;
        }
        
        return true;
    }

    // Middleware de proteção contra CSRF
    csrfProtectionMiddleware() {
        return (req, res, next) => {
            // Apenas para métodos que modificam dados
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                const csrfToken = req.get('X-CSRF-Token') || req.body._csrf;
                const sessionToken = req.session.csrfToken;
                
                if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
                    return res.status(403).json({
                        error: 'Token CSRF inválido',
                        code: 'INVALID_CSRF_TOKEN'
                    });
                }
            }
            
            next();
        };
    }

    // Gerar token CSRF
    generateCSRFToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    // Middleware de proteção contra clickjacking
    clickjackingProtectionMiddleware() {
        return (req, res, next) => {
            res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
            next();
        };
    }

    // Middleware de proteção contra MIME sniffing
    mimeSniffingProtectionMiddleware() {
        return (req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            next();
        };
    }

    // Middleware de proteção contra XSS
    xssProtectionMiddleware() {
        return (req, res, next) => {
            res.setHeader('X-XSS-Protection', '1; mode=block');
            next();
        };
    }

    // Log de evento de segurança
    logSecurityEvent(event, data) {
        const logEntry = {
            event,
            data,
            timestamp: new Date().toISOString(),
            pid: process.pid
        };
        
        if (SECURITY_DEBUG) {
            console.log(`🔒 Evento de segurança: ${event}`, logEntry);
        }
        
        // Aqui você pode adicionar lógica para enviar para um sistema de monitoramento
        // como Sentry, LogRocket, ou um SIEM
    }

    // Limpar dados de segurança
    cleanupSecurityData() {
        const now = Date.now();
        const cleanupInterval = 24 * 60 * 60 * 1000; // 24 horas
        
        // Limpar IPs suspeitos antigos
        if (now - this.securityStats.lastCleanup > cleanupInterval) {
            this.securityStats.suspiciousIPs.clear();
            this.securityStats.failedAttempts.clear();
            this.securityStats.lastCleanup = now;
            
            if (SECURITY_DEBUG) {
                console.log('🧹 Dados de segurança limpos');
            }
        }
    }

    // Log de estatísticas de segurança
    logSecurityStats() {
        console.log('📊 Estatísticas de segurança:', {
            blockedRequests: this.securityStats.blockedRequests,
            suspiciousIPs: this.securityStats.suspiciousIPs.size,
            failedAttempts: this.securityStats.failedAttempts.size,
            lastCleanup: new Date(this.securityStats.lastCleanup).toISOString()
        });
    }

    // Obter estatísticas de segurança
    getSecurityStats() {
        return {
            ...this.securityStats,
            suspiciousIPs: Array.from(this.securityStats.suspiciousIPs),
            failedAttempts: Object.fromEntries(this.securityStats.failedAttempts),
            config: this.securityConfig
        };
    }

    // Configurar segurança
    configure(options = {}) {
        if (options.rateLimits) {
            this.securityConfig.rateLimits = { ...this.securityConfig.rateLimits, ...options.rateLimits };
        }
        
        if (options.slowDown) {
            this.securityConfig.slowDown = { ...this.securityConfig.slowDown, ...options.slowDown };
        }
        
        if (options.securityHeaders) {
            this.securityConfig.securityHeaders = { ...this.securityConfig.securityHeaders, ...options.securityHeaders };
        }
        
        if (SECURITY_DEBUG) {
            console.log('⚙️ Configurações de segurança atualizadas:', options);
        }
    }
}

// Instância singleton
const securityOptimizer = new SecurityOptimizer();

module.exports = securityOptimizer;
