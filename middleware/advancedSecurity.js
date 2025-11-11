const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { body, validationResult } = require('express-validator');

class AdvancedSecurity {
    constructor() {
        this.suspiciousIPs = new Map();
        this.blockedIPs = new Set();
        this.failedAttempts = new Map();
        this.rateLimitStore = new Map();
        
        // Configurações de segurança
        this.config = {
            maxFailedAttempts: 5,
            blockDuration: 15 * 60 * 1000, // 15 minutos
            suspiciousThreshold: 3,
            maxRequestsPerMinute: 60,
            maxRequestsPerHour: 1000
        };
        
        // Iniciar limpeza automática
        this.startCleanup();
    }

    // Rate limiting avançado
    createAdvancedRateLimiters() {
        return {
            // Rate limiter para autenticação com backoff exponencial
            auth: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutos
                max: (req) => {
                    const ip = req.ip;
                    const attempts = this.getFailedAttempts(ip);
                    // Reduzir limite baseado em tentativas falhadas
                    return Math.max(3, 10 - attempts);
                },
                message: {
                    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
                    retryAfter: 15 * 60
                },
                standardHeaders: true,
                legacyHeaders: false,
                skipSuccessfulRequests: true,
                keyGenerator: (req) => {
                    // Combinar IP + User-Agent para maior precisão
                    const ip = req.ip;
                    const userAgent = req.get('User-Agent') || '';
                    return crypto.createHash('sha256').update(ip + userAgent).digest('hex');
                },
                skip: (req) => req.path === '/api/health'
            }),

            // Rate limiter para pagamentos
            payment: rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hora
                max: (req) => {
                    const ip = req.ip;
                    const attempts = this.getFailedAttempts(ip);
                    return Math.max(5, 20 - attempts);
                },
                message: {
                    error: 'Muitas tentativas de pagamento. Tente novamente em 1 hora.',
                    retryAfter: 60 * 60
                },
                standardHeaders: true,
                legacyHeaders: false,
                keyGenerator: (req) => {
                    const ip = req.ip;
                    const userAgent = req.get('User-Agent') || '';
                    return crypto.createHash('sha256').update(ip + userAgent).digest('hex');
                },
                skip: (req) => req.path === '/api/health'
            }),

            // Rate limiter para APIs gerais
            api: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutos
                max: (req) => {
                    const ip = req.ip;
                    const attempts = this.getFailedAttempts(ip);
                    return Math.max(50, 200 - attempts);
                },
                message: {
                    error: 'Muitas requisições. Tente novamente em 15 minutos.',
                    retryAfter: 15 * 60
                },
                standardHeaders: true,
                legacyHeaders: false,
                keyGenerator: (req) => {
                    const ip = req.ip;
                    const userAgent = req.get('User-Agent') || '';
                    return crypto.createHash('sha256').update(ip + userAgent).digest('hex');
                },
                skip: (req) => req.path === '/api/health'
            })
        };
    }

    // Slow down dinâmico
    createDynamicSlowDown() {
        return slowDown({
            windowMs: 15 * 60 * 1000, // 15 minutos
            delayAfter: (req) => {
                const ip = req.ip;
                const attempts = this.getFailedAttempts(ip);
                // Aumentar delay baseado em tentativas falhadas
                return Math.max(20, 50 - attempts);
            },
            delayMs: (req) => {
                const ip = req.ip;
                const attempts = this.getFailedAttempts(ip);
                // Aumentar delay baseado em tentativas falhadas
                return Math.min(5000, 500 + (attempts * 200));
            },
            maxDelayMs: 20000, // 20 segundos máximo
            skip: (req) => req.path === '/api/health',
            onLimitReached: (req, res, options) => {
                this.recordSuspiciousActivity(req, 'SLOW_DOWN_TRIGGERED');
            }
        });
    }

    // Middleware de detecção de bots (DESATIVADO)
    botDetection() {
        return (req, res, next) => {
            // Detecção de bots desativada para desenvolvimento
            next();
        };
    }

    // Middleware de validação de origem (DESATIVADO)
    originValidation() {
        return (req, res, next) => {
            // Validação de origem desativada para desenvolvimento
            next();
        };
    }

    // Middleware de validação de payload (DESATIVADO)
    payloadValidation() {
        return (req, res, next) => {
            // Validação desativada para desenvolvimento
            next();
        };
    }

    // Middleware de detecção de ataques (DESATIVADO)
    attackDetection() {
        return (req, res, next) => {
            // Detecção de ataques desativada para desenvolvimento
            next();
        };
    }

    // Middleware de verificação de IP bloqueado (DESATIVADO)
    ipBlocking() {
        return (req, res, next) => {
            // Bloqueio de IP desativado para desenvolvimento
            next();
        };
    }

    // Registrar atividade suspeita (DESATIVADO)
    recordSuspiciousActivity(req, reason) {
        // Registro de atividades suspeitas desativado para desenvolvimento
        // console.log(`🚨 Atividade suspeita detectada: ${req.ip} - ${reason}`);
    }

    // Registrar tentativa falhada (DESATIVADO)
    recordFailedAttempt(ip, reason = 'UNKNOWN') {
        // Registro de tentativas falhadas desativado para desenvolvimento
        // console.log(`❌ Tentativa falhada: ${ip} - ${reason}`);
    }

    // Obter número de tentativas falhadas
    getFailedAttempts(ip) {
        const data = this.failedAttempts.get(ip);
        return data ? data.count : 0;
    }

    // Bloquear IP (DESATIVADO)
    blockIP(ip, reason) {
        // Bloqueio de IP desativado para desenvolvimento
        // console.log(`🚫 IP bloqueado: ${ip} - Motivo: ${reason}`);
    }

    // Verificar se IP está bloqueado (DESATIVADO)
    isIPBlocked(ip) {
        // Verificação de IP bloqueado desativada para desenvolvimento
        return false;
    }

    // Validações específicas para pagamentos (DESATIVADO)
    validatePayment() {
        return [
            // Validações desativadas para desenvolvimento
            (req, res, next) => {
                next();
            }
        ];
    }

    // Validações para autenticação (DESATIVADO)
    validateAuth() {
        return [
            // Validações desativadas para desenvolvimento
            (req, res, next) => {
                next();
            }
        ];
    }

    // Iniciar limpeza automática
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, 60 * 60 * 1000); // A cada hora
    }

    // Limpar dados antigos
    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        
        // Limpar tentativas falhadas antigas
        for (const [ip, data] of this.failedAttempts.entries()) {
            if (now - data.lastAttempt > maxAge) {
                this.failedAttempts.delete(ip);
            }
        }
        
        // Limpar IPs suspeitos antigos
        for (const [ip, data] of this.suspiciousIPs.entries()) {
            if (now - data.lastSeen > maxAge) {
                this.suspiciousIPs.delete(ip);
            }
        }
        
        console.log('🧹 Limpeza de dados de segurança executada');
    }

    // Obter estatísticas de segurança
    getSecurityStats() {
        return {
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs.entries()),
            failedAttempts: Array.from(this.failedAttempts.entries()),
            summary: {
                totalBlockedIPs: this.blockedIPs.size,
                totalSuspiciousIPs: this.suspiciousIPs.size,
                totalFailedAttempts: this.failedAttempts.size
            },
            lastCleanup: new Date().toISOString()
        };
    }
}

// Instância singleton
const advancedSecurity = new AdvancedSecurity();

module.exports = advancedSecurity;