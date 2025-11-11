const fs = require('fs');
const path = require('path');

class SecurityMonitor {
    constructor() {
        this.logFile = path.join(__dirname, '../logs/security.log');
        this.alertFile = path.join(__dirname, '../logs/alerts.log');
        this.suspiciousIPs = new Map();
        this.failedAttempts = new Map();
        this.blockedIPs = new Set();
        
        // Criar diretório de logs se não existir
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    // Log de eventos de segurança
    logSecurityEvent(event) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${JSON.stringify(event)}\n`;
        
        try {
            fs.appendFileSync(this.logFile, logEntry);
        } catch (error) {
            console.error('[SECURITY] Error writing to security log:', error);
        }
    }

    // Log de alertas críticos
    logAlert(alert) {
        const timestamp = new Date().toISOString();
        const alertEntry = `[${timestamp}] ALERT: ${JSON.stringify(alert)}\n`;
        
        try {
            fs.appendFileSync(this.alertFile, alertEntry);
            console.error(`🚨 SECURITY ALERT: ${alert.type} - ${alert.message}`);
        } catch (error) {
            console.error('[SECURITY] Error writing to alert log:', error);
        }
    }

    // Monitorar tentativas de login
    monitorLoginAttempt(ip, success, username = null) {
        const key = `login:${ip}`;
        const attempts = this.failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
        
        if (!success) {
            attempts.count++;
            attempts.lastAttempt = Date.now();
            this.failedAttempts.set(key, attempts);
            
            // Bloquear IP após 10 tentativas falhadas
            if (attempts.count >= 10) {
                this.blockIP(ip, 'Múltiplas tentativas de login falhadas');
                this.logAlert({
                    type: 'LOGIN_ATTEMPT_BLOCK',
                    ip: ip,
                    username: username,
                    attempts: attempts.count,
                    message: 'IP bloqueado por múltiplas tentativas de login'
                });
            }
        } else {
            // Reset contador em caso de sucesso
            this.failedAttempts.delete(key);
        }

        this.logSecurityEvent({
            type: 'LOGIN_ATTEMPT',
            ip: ip,
            username: username,
            success: success,
            attempts: attempts.count
        });
    }

    // Monitorar tentativas de pagamento
    monitorPaymentAttempt(ip, success, amount, method) {
        const key = `payment:${ip}`;
        const attempts = this.failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
        
        if (!success) {
            attempts.count++;
            attempts.lastAttempt = Date.now();
            this.failedAttempts.set(key, attempts);
            
            // Alertar após 5 tentativas falhadas
            if (attempts.count >= 5) {
                this.logAlert({
                    type: 'PAYMENT_ATTEMPT_ALERT',
                    ip: ip,
                    amount: amount,
                    method: method,
                    attempts: attempts.count,
                    message: 'Múltiplas tentativas de pagamento falhadas'
                });
            }
        } else {
            // Reset contador em caso de sucesso
            this.failedAttempts.delete(key);
        }

        this.logSecurityEvent({
            type: 'PAYMENT_ATTEMPT',
            ip: ip,
            success: success,
            amount: amount,
            method: method,
            attempts: attempts.count
        });
    }

    // Monitorar requisições suspeitas
    monitorSuspiciousRequest(req, reason) {
        const ip = req.ip;
        const userAgent = req.get('User-Agent');
        const path = req.path;
        const method = req.method;
        
        const suspicious = this.suspiciousIPs.get(ip) || { count: 0, reasons: [] };
        suspicious.count++;
        suspicious.reasons.push(reason);
        this.suspiciousIPs.set(ip, suspicious);

        // Alertar após 3 requisições suspeitas
        if (suspicious.count >= 3) {
            this.logAlert({
                type: 'SUSPICIOUS_ACTIVITY',
                ip: ip,
                userAgent: userAgent,
                path: path,
                method: method,
                reasons: suspicious.reasons,
                message: 'Atividade suspeita detectada'
            });
        }

        this.logSecurityEvent({
            type: 'SUSPICIOUS_REQUEST',
            ip: ip,
            userAgent: userAgent,
            path: path,
            method: method,
            reason: reason,
            count: suspicious.count
        });
    }

    // Bloquear IP
    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        this.logSecurityEvent({
            type: 'IP_BLOCKED',
            ip: ip,
            reason: reason,
            timestamp: new Date().toISOString()
        });
    }

    // Verificar se IP está bloqueado
    isIPBlocked(ip) {
        return this.blockedIPs.has(ip);
    }

    // Monitorar tentativas de SQL Injection
    monitorSQLInjectionAttempt(req) {
        const ip = req.ip;
        const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
        const sqlPatterns = [
            /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
            /(\b(exec|execute|script|javascript)\b)/i,
            /(\b(admin|root|system)\b)/i
        ];

        for (const pattern of sqlPatterns) {
            if (pattern.test(queryString)) {
                this.monitorSuspiciousRequest(req, 'SQL_INJECTION_ATTEMPT');
                this.logAlert({
                    type: 'SQL_INJECTION_ATTEMPT',
                    ip: ip,
                    pattern: pattern.source,
                    message: 'Tentativa de SQL Injection detectada'
                });
                return true;
            }
        }
        return false;
    }

    // Monitorar tentativas de XSS
    monitorXSSAttempt(req) {
        const ip = req.ip;
        const queryString = JSON.stringify(req.query) + JSON.stringify(req.body);
        const xssPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+=/i,
            /<iframe/i,
            /<object/i
        ];

        for (const pattern of xssPatterns) {
            if (pattern.test(queryString)) {
                this.monitorSuspiciousRequest(req, 'XSS_ATTEMPT');
                this.logAlert({
                    type: 'XSS_ATTEMPT',
                    ip: ip,
                    pattern: pattern.source,
                    message: 'Tentativa de XSS detectada'
                });
                return true;
            }
        }
        return false;
    }

    // Monitorar tentativas de Path Traversal
    monitorPathTraversalAttempt(req) {
        const ip = req.ip;
        const path = req.path;
        const pathTraversalPattern = /\.\.\/|\.\.\\/;

        if (pathTraversalPattern.test(path)) {
            this.monitorSuspiciousRequest(req, 'PATH_TRAVERSAL_ATTEMPT');
            this.logAlert({
                type: 'PATH_TRAVERSAL_ATTEMPT',
                ip: ip,
                path: path,
                message: 'Tentativa de Path Traversal detectada'
            });
            return true;
        }
        return false;
    }

    // Monitorar tentativas de brute force
    monitorBruteForceAttempt(ip, endpoint) {
        const key = `bruteforce:${ip}:${endpoint}`;
        const attempts = this.failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
        
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.failedAttempts.set(key, attempts);

        // Alertar após 20 tentativas
        if (attempts.count >= 20) {
            this.blockIP(ip, 'Brute force attack detected');
            this.logAlert({
                type: 'BRUTE_FORCE_ATTEMPT',
                ip: ip,
                endpoint: endpoint,
                attempts: attempts.count,
                message: 'Ataque de brute force detectado'
            });
        }

        this.logSecurityEvent({
            type: 'BRUTE_FORCE_ATTEMPT',
            ip: ip,
            endpoint: endpoint,
            attempts: attempts.count
        });
    }

    // Gerar relatório de segurança
    generateSecurityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Array.from(this.suspiciousIPs.entries()),
            failedAttempts: Array.from(this.failedAttempts.entries()),
            summary: {
                totalBlockedIPs: this.blockedIPs.size,
                totalSuspiciousIPs: this.suspiciousIPs.size,
                totalFailedAttempts: this.failedAttempts.size
            }
        };

        return report;
    }

    // Limpar dados antigos (executar periodicamente)
    cleanupOldData() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas

        // Limpar tentativas falhadas antigas
        for (const [key, data] of this.failedAttempts.entries()) {
            if (now - data.lastAttempt > maxAge) {
                this.failedAttempts.delete(key);
            }
        }

        // Limpar IPs suspeitos antigos
        for (const [ip, data] of this.suspiciousIPs.entries()) {
            if (now - data.lastAttempt > maxAge) {
                this.suspiciousIPs.delete(ip);
            }
        }

        this.logSecurityEvent({
            type: 'CLEANUP',
            timestamp: new Date().toISOString(),
            message: 'Limpeza de dados antigos executada'
        });
    }

    // Middleware para monitoramento automático
    middleware() {
        return (req, res, next) => {
            const ip = req.ip;

            // Verificar se IP está bloqueado
            if (this.isIPBlocked(ip)) {
                return res.status(403).json({
                    error: 'Acesso negado. IP bloqueado por atividades suspeitas.'
                });
            }

            // Monitorar ataques comuns
            this.monitorSQLInjectionAttempt(req);
            this.monitorXSSAttempt(req);
            this.monitorPathTraversalAttempt(req);

            // Monitorar requisições excessivas
            const key = `requests:${ip}`;
            const requests = this.failedAttempts.get(key) || { count: 0, lastRequest: 0 };
            requests.count++;
            requests.lastRequest = now;

            if (requests.count > 1000) { // Mais de 1000 requests por hora
                this.monitorSuspiciousRequest(req, 'EXCESSIVE_REQUESTS');
            }

            this.failedAttempts.set(key, requests);

            next();
        };
    }
}

// Instância singleton
const securityMonitor = new SecurityMonitor();

// Limpeza automática a cada hora
setInterval(() => {
    securityMonitor.cleanupOldData();
}, 60 * 60 * 1000);

module.exports = securityMonitor; 