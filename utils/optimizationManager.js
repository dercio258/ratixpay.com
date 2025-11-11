const performanceOptimizer = require('./performanceOptimizer');
const queryOptimizer = require('./queryOptimizer');
const memoryOptimizer = require('./memoryOptimizer');
const responseOptimizer = require('./responseOptimizer');
const securityOptimizer = require('./securityOptimizer');
const errorOptimizer = require('./errorOptimizer');
const performanceMonitor = require('./performanceMonitor');
const OPTIMIZATION_DEBUG = process.env.OPTIMIZATION_DEBUG === 'true';

class OptimizationManager {
    constructor() {
        this.optimizers = {
            performance: performanceOptimizer,
            query: queryOptimizer,
            memory: memoryOptimizer,
            response: responseOptimizer,
            security: securityOptimizer,
            error: errorOptimizer,
            monitor: performanceMonitor
        };
        
        this.optimizationStatus = {
            enabled: true,
            lastOptimization: null,
            optimizationCount: 0,
            errors: []
        };
        
        this.startOptimization();
    }

    // Iniciar otimização
    startOptimization() {
        if (OPTIMIZATION_DEBUG) {
            console.log('🚀 Iniciando otimizações do sistema...');
        }
        
        // Otimizar configurações do Node.js
        this.optimizers.performance.optimizeNodeSettings();
        
        // Otimizar configurações de memória
        this.optimizers.memory.optimizeMemorySettings();
        
        // Configurar otimizações
        this.configureOptimizations();
        
        // Iniciar monitoramento
        this.startMonitoring();
        
        if (OPTIMIZATION_DEBUG) {
            console.log('✅ Otimizações iniciadas com sucesso');
        }
    }

    // Configurar otimizações
    configureOptimizations() {
        // Configurar otimizações de performance
        this.optimizers.performance.configure({
            compressionThreshold: 1024,
            compressionLevel: 6,
            cacheHeaders: {
                static: 'public, max-age=31536000',
                api: 'public, max-age=300',
                dynamic: 'no-cache, no-store, must-revalidate'
            }
        });
        
        // Configurar otimizações de resposta
        this.optimizers.response.configure({
            compressionThreshold: 1024,
            compressionLevel: 6,
            cacheHeaders: {
                static: 'public, max-age=31536000',
                api: 'public, max-age=300',
                dynamic: 'no-cache, no-store, must-revalidate'
            }
        });
        
        // Configurar otimizações de segurança
        this.optimizers.security.configure({
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
            }
        });
        
        // Configurar monitoramento
        this.optimizers.monitor.configureAlerts({
            memory: { threshold: 500 * 1024 * 1024, enabled: true },
            cpu: { threshold: 80, enabled: true },
            responseTime: { threshold: 5000, enabled: true },
            errorRate: { threshold: 5, enabled: true }
        });
        
        if (OPTIMIZATION_DEBUG) {
            console.log('⚙️ Otimizações configuradas');
        }
    }

    // Iniciar monitoramento
    startMonitoring() {
        // Monitorar performance a cada 5 minutos
        setInterval(() => {
            this.monitorPerformance();
        }, 300000);
        
        // Otimizar automaticamente a cada 10 minutos
        setInterval(() => {
            this.autoOptimize();
        }, 600000);
        
        // Log de status a cada 15 minutos
        setInterval(() => {
            this.logOptimizationStatus();
        }, 900000);
    }

    // Monitorar performance
    monitorPerformance() {
        try {
            const metrics = this.optimizers.monitor.getPerformanceMetrics();
            
            // Verificar se otimizações são necessárias
            if (this.needsOptimization(metrics)) {
                if (OPTIMIZATION_DEBUG) {
                    console.log('🔧 Otimizações necessárias detectadas');
                }
                this.performOptimization();
            }
        } catch (error) {
            console.error('❌ Erro ao monitorar performance:', error);
            this.optimizationStatus.errors.push({
                type: 'monitoring',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Verificar se otimizações são necessárias
    needsOptimization(metrics) {
        // Verificar memória
        if (metrics.memory.heapUsed > 400 * 1024 * 1024) { // 400MB
            return true;
        }
        
        // Verificar CPU
        if (metrics.cpu.usage > 70) { // 70%
            return true;
        }
        
        // Verificar tempo de resposta
        if (metrics.requests.averageResponseTime > 3000) { // 3 segundos
            return true;
        }
        
        // Verificar taxa de erro
        if (metrics.requests.total > 0) {
            const errorRate = (metrics.requests.failed / metrics.requests.total) * 100;
            if (errorRate > 3) { // 3%
                return true;
            }
        }
        
        return false;
    }

    // Realizar otimização
    performOptimization() {
        try {
            if (OPTIMIZATION_DEBUG) {
                console.log('🔧 Iniciando otimização automática...');
            }
            
            // Otimizar memória
            this.optimizers.memory.optimizeMemory();
            
            // Limpar caches
            this.optimizers.query.clearExpiredCache();
            
            // Otimizar configurações
            this.optimizers.performance.optimizeMemorySettings();
            
            // Atualizar status
            this.optimizationStatus.lastOptimization = new Date().toISOString();
            this.optimizationStatus.optimizationCount++;
            
            if (OPTIMIZATION_DEBUG) {
                console.log('✅ Otimização automática concluída');
            }
        } catch (error) {
            console.error('❌ Erro durante otimização:', error);
            this.optimizationStatus.errors.push({
                type: 'optimization',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Otimização automática
    autoOptimize() {
        if (!this.optimizationStatus.enabled) {
            return;
        }
        
        try {
            // Verificar métricas
            const metrics = this.optimizers.monitor.getPerformanceMetrics();
            
            // Otimizar baseado nas métricas
            if (metrics.memory.heapUsed > 300 * 1024 * 1024) {
                this.optimizers.memory.performGarbageCollection();
            }
            
            if (metrics.requests.averageResponseTime > 2000) {
                this.optimizers.query.clearCache();
            }
            
            if (metrics.database.slowQueries > metrics.database.queries * 0.05) {
                this.optimizers.query.optimizeIndexes();
            }
            
            if (OPTIMIZATION_DEBUG) {
                console.log('🔄 Otimização automática executada');
            }
        } catch (error) {
            console.error('❌ Erro na otimização automática:', error);
        }
    }

    // Log de status de otimização
    logOptimizationStatus() {
        if (OPTIMIZATION_DEBUG) {
            console.log('📊 Status das otimizações:', {
            enabled: this.optimizationStatus.enabled,
            lastOptimization: this.optimizationStatus.lastOptimization,
            optimizationCount: this.optimizationStatus.optimizationCount,
            errors: this.optimizationStatus.errors.length,
            timestamp: new Date().toISOString()
        });
        }
    }

    // Obter status de otimização
    getOptimizationStatus() {
        return {
            ...this.optimizationStatus,
            optimizers: Object.keys(this.optimizers),
            metrics: this.optimizers.monitor.getPerformanceMetrics(),
            recommendations: this.getOptimizationRecommendations()
        };
    }

    // Obter recomendações de otimização
    getOptimizationRecommendations() {
        const recommendations = [];
        const metrics = this.optimizers.monitor.getPerformanceMetrics();
        
        // Recomendações de memória
        if (metrics.memory.heapUsed > 500 * 1024 * 1024) {
            recommendations.push('Considerar aumentar o limite de memória');
        }
        
        // Recomendações de CPU
        if (metrics.cpu.usage > 80) {
            recommendations.push('Considerar otimizar código ou aumentar recursos');
        }
        
        // Recomendações de banco de dados
        if (metrics.database.slowQueries > metrics.database.queries * 0.1) {
            recommendations.push('Investigar queries lentas do banco de dados');
        }
        
        // Recomendações de cache
        if (metrics.cache.hitRate < 50) {
            recommendations.push('Melhorar estratégia de cache');
        }
        
        return recommendations;
    }

    // Habilitar/desabilitar otimizações
    setOptimizationEnabled(enabled) {
        this.optimizationStatus.enabled = enabled;
        if (OPTIMIZATION_DEBUG) {
            console.log(`🔧 Otimizações ${enabled ? 'habilitadas' : 'desabilitadas'}`);
        }
    }

    // Executar otimização manual
    executeOptimization(type = 'all') {
        try {
            if (OPTIMIZATION_DEBUG) {
                console.log(`🔧 Executando otimização manual: ${type}`);
            }
            
            switch (type) {
                case 'memory':
                    this.optimizers.memory.optimizeMemory();
                    break;
                case 'cache':
                    this.optimizers.query.clearCache();
                    break;
                case 'database':
                    this.optimizers.query.optimizeIndexes();
                    break;
                case 'all':
                default:
                    this.performOptimization();
                    break;
            }
            
            if (OPTIMIZATION_DEBUG) {
                console.log(`✅ Otimização ${type} concluída`);
            }
        } catch (error) {
            console.error(`❌ Erro na otimização ${type}:`, error);
            throw error;
        }
    }

    // Obter relatório de otimização
    getOptimizationReport() {
        return {
            status: this.optimizationStatus,
            performance: this.optimizers.monitor.getPerformanceReport(),
            memory: this.optimizers.memory.getMemoryReport(),
            security: this.optimizers.security.getSecurityStats(),
            errors: this.optimizers.error.getErrorStats(),
            queries: this.optimizers.query.getQueryStats(),
            responses: this.optimizers.response.getResponseStats(),
            timestamp: new Date().toISOString()
        };
    }

    // Limpar dados de otimização
    clearOptimizationData() {
        // Limpar caches
        this.optimizers.query.clearCache();
        
        // Limpar estatísticas
        this.optimizers.monitor.clearMetrics();
        this.optimizers.memory.clearMemoryStats();
        this.optimizers.response.clearStats();
        this.optimizers.error.clearErrorStats();
        
        // Resetar status
        this.optimizationStatus = {
            enabled: true,
            lastOptimization: null,
            optimizationCount: 0,
            errors: []
        };
        
        if (OPTIMIZATION_DEBUG) {
            console.log('🧹 Dados de otimização limpos');
        }
    }

    // Configurar otimizações
    configureOptimizations(options = {}) {
        if (options.performance) {
            this.optimizers.performance.configure(options.performance);
        }
        
        if (options.response) {
            this.optimizers.response.configure(options.response);
        }
        
        if (options.security) {
            this.optimizers.security.configure(options.security);
        }
        
        if (options.monitoring) {
            this.optimizers.monitor.configureAlerts(options.monitoring);
        }
        
        if (OPTIMIZATION_DEBUG) {
            console.log('⚙️ Configurações de otimização atualizadas:', options);
        }
    }

    // Obter otimizador específico
    getOptimizer(type) {
        return this.optimizers[type];
    }

    // Verificar se otimizador está disponível
    isOptimizerAvailable(type) {
        return this.optimizers.hasOwnProperty(type);
    }

    // Listar otimizadores disponíveis
    getAvailableOptimizers() {
        return Object.keys(this.optimizers);
    }

    // Obter estatísticas de todos os otimizadores
    getAllOptimizerStats() {
        return {
            performance: this.optimizers.performance.getPerformanceMetrics(),
            memory: this.optimizers.memory.getMemoryStats(),
            security: this.optimizers.security.getSecurityStats(),
            errors: this.optimizers.error.getErrorStats(),
            queries: this.optimizers.query.getQueryStats(),
            responses: this.optimizers.response.getResponseStats(),
            monitoring: this.optimizers.monitor.getPerformanceMetrics()
        };
    }
}

// Instância singleton
const optimizationManager = new OptimizationManager();

module.exports = optimizationManager;
