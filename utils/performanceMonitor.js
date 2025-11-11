const os = require('os');
const { performance } = require('perf_hooks');
const PERF_DEBUG = process.env.PERFORMANCE_DEBUG === 'true';

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0,
                responseTimeHistory: []
            },
            memory: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0,
                history: []
            },
            cpu: {
                usage: 0,
                loadAverage: [0, 0, 0],
                history: []
            },
            database: {
                connections: 0,
                queries: 0,
                slowQueries: 0,
                averageQueryTime: 0,
                queryTimeHistory: []
            },
            cache: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                size: 0
            }
        };
        
        this.alerts = {
            memory: { threshold: 500 * 1024 * 1024, enabled: true }, // 500MB
            cpu: { threshold: 80, enabled: true }, // 80%
            responseTime: { threshold: 5000, enabled: true }, // 5 segundos
            errorRate: { threshold: 5, enabled: true } // 5%
        };
        
        this.startMonitoring();
    }

    // Iniciar monitoramento
    startMonitoring() {
        // Monitorar métricas a cada 30 segundos
        setInterval(() => {
            this.updateSystemMetrics();
            this.checkAlerts();
        }, 30000);
        
        // Log de estatísticas a cada 5 minutos
        setInterval(() => {
            if (PERF_DEBUG) {
                this.logPerformanceStats();
            }
        }, 300000);
        
        // Limpeza de histórico a cada hora
        setInterval(() => {
            this.cleanupHistory();
        }, 3600000);
    }

    // Atualizar métricas do sistema
    updateSystemMetrics() {
        // Métricas de memória
        const memUsage = process.memoryUsage();
        this.metrics.memory = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            history: this.metrics.memory.history
        };
        
        // Adicionar ao histórico (manter últimos 100 registros)
        this.metrics.memory.history.push({
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            timestamp: Date.now()
        });
        
        if (this.metrics.memory.history.length > 100) {
            this.metrics.memory.history.shift();
        }
        
        // Métricas de CPU
        const cpuUsage = process.cpuUsage();
        const loadAverage = os.loadavg();
        
        this.metrics.cpu = {
            usage: this.calculateCPUUsage(cpuUsage),
            loadAverage: loadAverage,
            history: this.metrics.cpu.history
        };
        
        // Adicionar ao histórico
        this.metrics.cpu.history.push({
            usage: this.metrics.cpu.usage,
            loadAverage: loadAverage,
            timestamp: Date.now()
        });
        
        if (this.metrics.cpu.history.length > 100) {
            this.metrics.cpu.history.shift();
        }
    }

    // Calcular uso de CPU
    calculateCPUUsage(cpuUsage) {
        const total = cpuUsage.user + cpuUsage.system;
        const percentage = (total / 1000000) * 100; // Converter para porcentagem
        return Math.min(percentage, 100); // Limitar a 100%
    }

    // Verificar alertas
    checkAlerts() {
        // Alerta de memória
        if (this.alerts.memory.enabled && this.metrics.memory.heapUsed > this.alerts.memory.threshold) {
            this.triggerAlert('memory', {
                current: this.metrics.memory.heapUsed,
                threshold: this.alerts.memory.threshold,
                message: `Uso de memória alto: ${(this.metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`
            });
        }
        
        // Alerta de CPU
        if (this.alerts.cpu.enabled && this.metrics.cpu.usage > this.alerts.cpu.threshold) {
            this.triggerAlert('cpu', {
                current: this.metrics.cpu.usage,
                threshold: this.alerts.cpu.threshold,
                message: `Uso de CPU alto: ${this.metrics.cpu.usage.toFixed(2)}%`
            });
        }
        
        // Alerta de tempo de resposta
        if (this.alerts.responseTime.enabled && this.metrics.requests.averageResponseTime > this.alerts.responseTime.threshold) {
            this.triggerAlert('responseTime', {
                current: this.metrics.requests.averageResponseTime,
                threshold: this.alerts.responseTime.threshold,
                message: `Tempo de resposta alto: ${this.metrics.requests.averageResponseTime}ms`
            });
        }
        
        // Alerta de taxa de erro
        if (this.alerts.errorRate.enabled && this.metrics.requests.total > 0) {
            const errorRate = (this.metrics.requests.failed / this.metrics.requests.total) * 100;
            if (errorRate > this.alerts.errorRate.threshold) {
                this.triggerAlert('errorRate', {
                    current: errorRate,
                    threshold: this.alerts.errorRate.threshold,
                    message: `Taxa de erro alta: ${errorRate.toFixed(2)}%`
                });
            }
        }
    }

    // Disparar alerta
    triggerAlert(type, data) {
        console.log(`🚨 ALERTA: ${type.toUpperCase()}`, {
            type,
            data,
            timestamp: new Date().toISOString(),
            pid: process.pid
        });
        
        // Aqui você pode adicionar lógica para enviar alertas
        // para sistemas de monitoramento como Prometheus, Grafana, etc.
    }

    // Middleware de monitoramento de requisições
    requestMonitoringMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            
            // Interceptar resposta
            const originalSend = res.send;
            res.send = function(data) {
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                // Atualizar métricas
                this.updateRequestMetrics(req, res, responseTime);
                
                originalSend.call(this, data);
            }.bind(this);
            
            next();
        };
    }

    // Atualizar métricas de requisição
    updateRequestMetrics(req, res, responseTime) {
        this.metrics.requests.total++;
        
        // Contar sucessos e falhas
        if (res.statusCode >= 200 && res.statusCode < 400) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }
        
        // Atualizar tempo de resposta médio
        this.metrics.requests.responseTimeHistory.push(responseTime);
        if (this.metrics.requests.responseTimeHistory.length > 1000) {
            this.metrics.requests.responseTimeHistory.shift();
        }
        
        this.metrics.requests.averageResponseTime = 
            this.metrics.requests.responseTimeHistory.reduce((a, b) => a + b, 0) / 
            this.metrics.requests.responseTimeHistory.length;
    }

    // Middleware de monitoramento de banco de dados
    databaseMonitoringMiddleware() {
        return (req, res, next) => {
            const startTime = performance.now();
            
            // Interceptar queries do Sequelize
            const originalQuery = require('sequelize').Sequelize.prototype.query;
            require('sequelize').Sequelize.prototype.query = function(sql, options) {
                const queryStartTime = performance.now();
                
                return originalQuery.call(this, sql, options).then(result => {
                    const queryEndTime = performance.now();
                    const queryTime = queryEndTime - queryStartTime;
                    
                    // Atualizar métricas de banco de dados
                    this.updateDatabaseMetrics(queryTime, sql);
                    
                    return result;
                }.bind(this));
            };
            
            next();
        };
    }

    // Atualizar métricas de banco de dados
    updateDatabaseMetrics(queryTime, sql) {
        this.metrics.database.queries++;
        
        // Contar queries lentas
        if (queryTime > 1000) { // Mais de 1 segundo
            this.metrics.database.slowQueries++;
        }
        
        // Atualizar tempo médio de query
        this.metrics.database.queryTimeHistory.push(queryTime);
        if (this.metrics.database.queryTimeHistory.length > 1000) {
            this.metrics.database.queryTimeHistory.shift();
        }
        
        this.metrics.database.averageQueryTime = 
            this.metrics.database.queryTimeHistory.reduce((a, b) => a + b, 0) / 
            this.metrics.database.queryTimeHistory.length;
    }

    // Middleware de monitoramento de cache
    cacheMonitoringMiddleware() {
        return (req, res, next) => {
            // Interceptar operações de cache
            const originalGet = global.cacheService?.get;
            const originalSet = global.cacheService?.set;
            
            if (originalGet) {
                global.cacheService.get = function(key) {
                    const result = originalGet.call(this, key);
                    
                    if (result) {
                        this.metrics.cache.hits++;
                    } else {
                        this.metrics.cache.misses++;
                    }
                    
                    // Calcular taxa de hit
                    const total = this.metrics.cache.hits + this.metrics.cache.misses;
                    this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
                    
                    return result;
                }.bind(this);
            }
            
            if (originalSet) {
                global.cacheService.set = function(key, value, ttl) {
                    const result = originalSet.call(this, key, value, ttl);
                    
                    // Atualizar tamanho do cache
                    this.metrics.cache.size++;
                    
                    return result;
                }.bind(this);
            }
            
            next();
        };
    }

    // Log de estatísticas de performance
    logPerformanceStats() {
        console.log('📊 Estatísticas de performance:', {
            requests: {
                total: this.metrics.requests.total,
                successful: this.metrics.requests.successful,
                failed: this.metrics.requests.failed,
                successRate: this.metrics.requests.total > 0 ? 
                    ((this.metrics.requests.successful / this.metrics.requests.total) * 100).toFixed(2) + '%' : '0%',
                averageResponseTime: this.metrics.requests.averageResponseTime.toFixed(2) + 'ms'
            },
            memory: {
                heapUsed: (this.metrics.memory.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
                heapTotal: (this.metrics.memory.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
                external: (this.metrics.memory.external / 1024 / 1024).toFixed(2) + 'MB',
                rss: (this.metrics.memory.rss / 1024 / 1024).toFixed(2) + 'MB'
            },
            cpu: {
                usage: this.metrics.cpu.usage.toFixed(2) + '%',
                loadAverage: this.metrics.cpu.loadAverage.map(load => load.toFixed(2))
            },
            database: {
                queries: this.metrics.database.queries,
                slowQueries: this.metrics.database.slowQueries,
                averageQueryTime: this.metrics.database.averageQueryTime.toFixed(2) + 'ms'
            },
            cache: {
                hits: this.metrics.cache.hits,
                misses: this.metrics.cache.misses,
                hitRate: this.metrics.cache.hitRate.toFixed(2) + '%',
                size: this.metrics.cache.size
            }
        });
    }

    // Limpar histórico
    cleanupHistory() {
        // Limpar histórico antigo (manter apenas últimos 100 registros)
        if (this.metrics.memory.history.length > 100) {
            this.metrics.memory.history = this.metrics.memory.history.slice(-100);
        }
        
        if (this.metrics.cpu.history.length > 100) {
            this.metrics.cpu.history = this.metrics.cpu.history.slice(-100);
        }
        
        if (this.metrics.requests.responseTimeHistory.length > 1000) {
            this.metrics.requests.responseTimeHistory = this.metrics.requests.responseTimeHistory.slice(-1000);
        }
        
        if (this.metrics.database.queryTimeHistory.length > 1000) {
            this.metrics.database.queryTimeHistory = this.metrics.database.queryTimeHistory.slice(-1000);
        }
        
        if (PERF_DEBUG) {
            console.log('🧹 Histórico de performance limpo');
        }
    }

    // Obter métricas de performance
    getPerformanceMetrics() {
        return {
            ...this.metrics,
            alerts: this.alerts,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version
        };
    }

    // Obter relatório de performance
    getPerformanceReport() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const loadAverage = os.loadavg();
        
        return {
            timestamp: new Date().toISOString(),
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                platform: process.platform,
                nodeVersion: process.version
            },
            memory: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            },
            cpu: {
                usage: this.calculateCPUUsage(cpuUsage),
                loadAverage: loadAverage
            },
            metrics: this.metrics,
            alerts: this.alerts,
            recommendations: this.getPerformanceRecommendations()
        };
    }

    // Obter recomendações de performance
    getPerformanceRecommendations() {
        const recommendations = [];
        
        // Recomendações de memória
        if (this.metrics.memory.heapUsed > 500 * 1024 * 1024) {
            recommendations.push('Considerar aumentar o limite de memória com --max-old-space-size');
        }
        
        if (this.metrics.memory.external > 100 * 1024 * 1024) {
            recommendations.push('Verificar uso de buffers e streams externos');
        }
        
        // Recomendações de CPU
        if (this.metrics.cpu.usage > 80) {
            recommendations.push('Considerar otimizar código ou aumentar recursos de CPU');
        }
        
        if (this.metrics.cpu.loadAverage[0] > os.cpus().length) {
            recommendations.push('Sistema sobrecarregado, considerar escalonamento horizontal');
        }
        
        // Recomendações de banco de dados
        if (this.metrics.database.slowQueries > this.metrics.database.queries * 0.1) {
            recommendations.push('Investigar queries lentas do banco de dados');
        }
        
        if (this.metrics.database.averageQueryTime > 1000) {
            recommendations.push('Otimizar queries do banco de dados');
        }
        
        // Recomendações de cache
        if (this.metrics.cache.hitRate < 50) {
            recommendations.push('Melhorar estratégia de cache');
        }
        
        // Recomendações de tempo de resposta
        if (this.metrics.requests.averageResponseTime > 2000) {
            recommendations.push('Otimizar tempo de resposta das APIs');
        }
        
        return recommendations;
    }

    // Configurar alertas
    configureAlerts(options = {}) {
        if (options.memory) {
            this.alerts.memory = { ...this.alerts.memory, ...options.memory };
        }
        
        if (options.cpu) {
            this.alerts.cpu = { ...this.alerts.cpu, ...options.cpu };
        }
        
        if (options.responseTime) {
            this.alerts.responseTime = { ...this.alerts.responseTime, ...options.responseTime };
        }
        
        if (options.errorRate) {
            this.alerts.errorRate = { ...this.alerts.errorRate, ...options.errorRate };
        }
        
        if (PERF_DEBUG) {
            console.log('⚙️ Alertas de performance configurados:', options);
        }
    }

    // Habilitar/desabilitar alertas
    setAlertEnabled(type, enabled) {
        if (this.alerts[type]) {
            this.alerts[type].enabled = enabled;
            if (PERF_DEBUG) {
                console.log(`🔧 Alerta ${type} ${enabled ? 'habilitado' : 'desabilitado'}`);
            }
        }
    }

    // Definir threshold de alerta
    setAlertThreshold(type, threshold) {
        if (this.alerts[type]) {
            this.alerts[type].threshold = threshold;
            if (PERF_DEBUG) {
                console.log(`🔧 Threshold do alerta ${type} definido para ${threshold}`);
            }
        }
    }

    // Limpar métricas
    clearMetrics() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                averageResponseTime: 0,
                responseTimeHistory: []
            },
            memory: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0,
                history: []
            },
            cpu: {
                usage: 0,
                loadAverage: [0, 0, 0],
                history: []
            },
            database: {
                connections: 0,
                queries: 0,
                slowQueries: 0,
                averageQueryTime: 0,
                queryTimeHistory: []
            },
            cache: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                size: 0
            }
        };
        
        if (PERF_DEBUG) {
            console.log('🧹 Métricas de performance limpas');
        }
    }
}

// Instância singleton
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
