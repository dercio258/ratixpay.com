const os = require('os');
const fs = require('fs');
const path = require('path');
const MONITORING_DEBUG = process.env.MONITORING_DEBUG === 'true';

class MonitoringService {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0,
                responseTimes: []
            },
            database: {
                connections: 0,
                queries: 0,
                slowQueries: 0,
                errors: 0
            },
            memory: {
                used: 0,
                free: 0,
                total: 0
            },
            cpu: {
                usage: 0,
                loadAverage: []
            },
            errors: {
                total: 0,
                byType: {},
                recent: []
            },
            uptime: Date.now()
        };
        
        this.alerts = [];
        this.thresholds = {
            responseTime: 2000, // 2 segundos
            memoryUsage: 80, // 80%
            cpuUsage: 80, // 80%
            errorRate: 5, // 5%
            slowQueries: 10 // 10 queries lentas por minuto
        };
        
        this.startTime = Date.now();
        this.lastCleanup = Date.now();
        
        // Iniciar coleta de métricas
        this.startMetricsCollection();
    }

    // Iniciar coleta automática de métricas
    startMetricsCollection() {
        // Coletar métricas a cada 30 segundos
        setInterval(() => {
            this.collectSystemMetrics();
            this.cleanupOldData();
        }, 30000);

        // Verificar alertas a cada minuto
        setInterval(() => {
            this.checkAlerts();
        }, 60000);

        if (MONITORING_DEBUG) {
            console.log('📊 Monitoring Service iniciado');
        }
    }

    // Coletar métricas do sistema
    collectSystemMetrics() {
        try {
            // Métricas de memória
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            this.metrics.memory = {
                used: usedMem,
                free: freeMem,
                total: totalMem,
                usage: Math.round((usedMem / totalMem) * 100)
            };

            // Métricas de CPU
            const cpus = os.cpus();
            const loadAvg = os.loadavg();

            this.metrics.cpu = {
                usage: this.calculateCpuUsage(cpus),
                loadAverage: loadAvg,
                cores: cpus.length
            };

            // Métricas de uptime
            this.metrics.uptime = Date.now() - this.startTime;

        } catch (error) {
            console.error('❌ Erro ao coletar métricas do sistema:', error);
        }
    }

    // Calcular uso de CPU
    calculateCpuUsage(cpus) {
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (let type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        return Math.round(100 - (100 * totalIdle / totalTick));
    }

    // Registrar requisição
    recordRequest(responseTime, success = true, error = null) {
        this.metrics.requests.total++;
        
        if (success) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
            
            if (error) {
                this.recordError(error);
            }
        }

        // Manter apenas os últimos 100 tempos de resposta
        this.metrics.requests.responseTimes.push(responseTime);
        if (this.metrics.requests.responseTimes.length > 100) {
            this.metrics.requests.responseTimes.shift();
        }

        // Calcular tempo médio de resposta
        const total = this.metrics.requests.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.requests.averageResponseTime = Math.round(total / this.metrics.requests.responseTimes.length);
    }

    // Registrar query do banco de dados
    recordDatabaseQuery(duration, success = true, isSlow = false) {
        this.metrics.database.queries++;
        
        if (!success) {
            this.metrics.database.errors++;
        }
        
        if (isSlow) {
            this.metrics.database.slowQueries++;
        }
    }

    // Registrar erro
    recordError(error) {
        this.metrics.errors.total++;
        
        const errorType = error.name || 'Unknown';
        this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
        
        // Manter apenas os últimos 50 erros
        this.metrics.errors.recent.push({
            type: errorType,
            message: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack
        });
        
        if (this.metrics.errors.recent.length > 50) {
            this.metrics.errors.recent.shift();
        }
    }

    // Verificar alertas
    checkAlerts() {
        const alerts = [];

        // Verificar tempo de resposta
        if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
            alerts.push({
                type: 'HIGH_RESPONSE_TIME',
                severity: 'WARNING',
                message: `Tempo de resposta alto: ${this.metrics.requests.averageResponseTime}ms`,
                value: this.metrics.requests.averageResponseTime,
                threshold: this.thresholds.responseTime,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar uso de memória
        if (this.metrics.memory.usage > this.thresholds.memoryUsage) {
            alerts.push({
                type: 'HIGH_MEMORY_USAGE',
                severity: 'CRITICAL',
                message: `Uso de memória alto: ${this.metrics.memory.usage}%`,
                value: this.metrics.memory.usage,
                threshold: this.thresholds.memoryUsage,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar uso de CPU
        if (this.metrics.cpu.usage > this.thresholds.cpuUsage) {
            alerts.push({
                type: 'HIGH_CPU_USAGE',
                severity: 'WARNING',
                message: `Uso de CPU alto: ${this.metrics.cpu.usage}%`,
                value: this.metrics.cpu.usage,
                threshold: this.thresholds.cpuUsage,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar taxa de erro
        const errorRate = this.metrics.requests.total > 0 ? 
            (this.metrics.requests.failed / this.metrics.requests.total) * 100 : 0;
        
        if (errorRate > this.thresholds.errorRate) {
            alerts.push({
                type: 'HIGH_ERROR_RATE',
                severity: 'CRITICAL',
                message: `Taxa de erro alta: ${errorRate.toFixed(2)}%`,
                value: errorRate,
                threshold: this.thresholds.errorRate,
                timestamp: new Date().toISOString()
            });
        }

        // Verificar queries lentas
        if (this.metrics.database.slowQueries > this.thresholds.slowQueries) {
            alerts.push({
                type: 'SLOW_QUERIES',
                severity: 'WARNING',
                message: `Muitas queries lentas: ${this.metrics.database.slowQueries}`,
                value: this.metrics.database.slowQueries,
                threshold: this.thresholds.slowQueries,
                timestamp: new Date().toISOString()
            });
        }

        // Processar alertas
        alerts.forEach(alert => {
            this.processAlert(alert);
        });
    }

    // Processar alerta
    processAlert(alert) {
        // Verificar se já existe alerta similar recente
        const recentAlert = this.alerts.find(a => 
            a.type === alert.type && 
            (Date.now() - new Date(a.timestamp).getTime()) < 300000 // 5 minutos
        );

        if (!recentAlert) {
            this.alerts.push(alert);
            this.logAlert(alert);
            this.sendAlert(alert);
        }
    }

    // Log do alerta
    logAlert(alert) {
        const logMessage = `🚨 ALERTA [${alert.severity}] ${alert.type}: ${alert.message}`;
        console.error(logMessage);
        
        // Salvar em arquivo de log
        this.saveAlertToFile(alert);
    }

    // Salvar alerta em arquivo
    saveAlertToFile(alert) {
        try {
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            const logFile = path.join(logDir, 'alerts.log');
            const logEntry = `[${alert.timestamp}] [${alert.severity}] ${alert.type}: ${alert.message}\n`;
            
            fs.appendFileSync(logFile, logEntry);
        } catch (error) {
            console.error('❌ Erro ao salvar alerta em arquivo:', error);
        }
    }

    // Enviar alerta (implementar integração com Slack, Discord, etc.)
    async sendAlert(alert) {
        try {
            // Aqui você pode implementar integração com:
            // - Slack webhook
            // - Discord webhook
            // - Email
            // - SMS
            // - Telegram bot
            
            if (MONITORING_DEBUG) {
                console.log(`📤 Enviando alerta: ${alert.type} - ${alert.message}`);
            }
            
            // Enviar alerta crítico via WhatsApp Session Manager
            if (alert.severity === 'CRITICAL') {
                const whatsappManager = require('./whatsappManager');
                const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
                const message = `🚨 *ALERTA CRÍTICO - RatixPay*

*Tipo:* ${alert.type}
*Mensagem:* ${alert.message}
*Valor:* ${alert.value}
*Limite:* ${alert.threshold}
*Timestamp:* ${alert.timestamp}

Verifique o sistema imediatamente!`;
                
                await whatsappManager.sendNotificationSafely(adminPhone, message, null, 'sistema');
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar alerta:', error);
        }
    }

    // Obter métricas atuais
    getMetrics() {
        return {
            ...this.metrics,
            alerts: this.alerts.slice(-10), // Últimos 10 alertas
            thresholds: this.thresholds,
            lastUpdate: new Date().toISOString()
        };
    }

    // Obter status de saúde
    getHealthStatus() {
        const errorRate = this.metrics.requests.total > 0 ? 
            (this.metrics.requests.failed / this.metrics.requests.total) * 100 : 0;

        const healthScore = this.calculateHealthScore(errorRate);
        
        return {
            status: healthScore > 80 ? 'HEALTHY' : healthScore > 60 ? 'WARNING' : 'CRITICAL',
            score: healthScore,
            uptime: this.metrics.uptime,
            lastCheck: new Date().toISOString(),
            issues: this.getCurrentIssues()
        };
    }

    // Calcular score de saúde
    calculateHealthScore(errorRate) {
        let score = 100;
        
        // Penalizar por tempo de resposta alto
        if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
            score -= 20;
        }
        
        // Penalizar por uso de memória alto
        if (this.metrics.memory.usage > this.thresholds.memoryUsage) {
            score -= 25;
        }
        
        // Penalizar por uso de CPU alto
        if (this.metrics.cpu.usage > this.thresholds.cpuUsage) {
            score -= 15;
        }
        
        // Penalizar por taxa de erro alta
        if (errorRate > this.thresholds.errorRate) {
            score -= 30;
        }
        
        // Penalizar por queries lentas
        if (this.metrics.database.slowQueries > this.thresholds.slowQueries) {
            score -= 10;
        }
        
        return Math.max(0, score);
    }

    // Obter problemas atuais
    getCurrentIssues() {
        const issues = [];
        
        if (this.metrics.requests.averageResponseTime > this.thresholds.responseTime) {
            issues.push('Tempo de resposta alto');
        }
        
        if (this.metrics.memory.usage > this.thresholds.memoryUsage) {
            issues.push('Uso de memória alto');
        }
        
        if (this.metrics.cpu.usage > this.thresholds.cpuUsage) {
            issues.push('Uso de CPU alto');
        }
        
        const errorRate = this.metrics.requests.total > 0 ? 
            (this.metrics.requests.failed / this.metrics.requests.total) * 100 : 0;
        
        if (errorRate > this.thresholds.errorRate) {
            issues.push('Taxa de erro alta');
        }
        
        if (this.metrics.database.slowQueries > this.thresholds.slowQueries) {
            issues.push('Muitas queries lentas');
        }
        
        return issues;
    }

    // Limpar dados antigos
    cleanupOldData() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 horas
        
        // Limpar alertas antigos
        this.alerts = this.alerts.filter(alert => 
            (now - new Date(alert.timestamp).getTime()) < maxAge
        );
        
        // Limpar erros antigos
        this.metrics.errors.recent = this.metrics.errors.recent.filter(error => 
            (now - new Date(error.timestamp).getTime()) < maxAge
        );
        
        this.lastCleanup = now;
    }

    // Middleware para monitorar requisições
    middleware() {
        return (req, res, next) => {
            const startTime = Date.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const responseTime = Date.now() - startTime;
                const success = res.statusCode < 400;
                
                // Registrar métrica
                monitoringService.recordRequest(responseTime, success);
                
                originalSend.call(this, data);
            };
            
            next();
        };
    }
}

// Instância singleton
const monitoringService = new MonitoringService();

module.exports = monitoringService;
