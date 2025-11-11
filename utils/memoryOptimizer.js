const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class MemoryOptimizer {
    constructor() {
        this.memoryStats = {
            heapUsed: 0,
            heapTotal: 0,
            external: 0,
            rss: 0,
            timestamp: new Date().toISOString()
        };
        
        this.gcStats = {
            total: 0,
            lastGC: null,
            averageInterval: 0
        };
        
        this.leakDetection = {
            enabled: false,
            threshold: 100 * 1024 * 1024, // 100MB
            interval: 60000, // 1 minuto
            history: []
        };
        
        this.startMonitoring();
    }

    // Iniciar monitoramento de memória
    startMonitoring() {
        // Monitorar memória a cada 30 segundos
        setInterval(() => {
            this.updateMemoryStats();
            this.checkMemoryLeaks();
            this.optimizeMemory();
        }, 30000);
        
        // Limpeza de memória a cada 5 minutos
        setInterval(() => {
            this.performGarbageCollection();
        }, 300000);
        
        // Análise de vazamentos a cada minuto
        if (this.leakDetection.enabled) {
            setInterval(() => {
                this.detectMemoryLeaks();
            }, this.leakDetection.interval);
        }
    }

    // Atualizar estatísticas de memória
    updateMemoryStats() {
        const memUsage = process.memoryUsage();
        
        this.memoryStats = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            timestamp: new Date().toISOString()
        };
        
        // Log se uso de memória estiver alto
        if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            console.log(`⚠️ Uso de memória alto: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
    }

    // Verificar vazamentos de memória
    checkMemoryLeaks() {
        const currentUsage = process.memoryUsage().heapUsed;
        
        // Adicionar ao histórico
        this.leakDetection.history.push({
            usage: currentUsage,
            timestamp: Date.now()
        });
        
        // Manter apenas últimos 10 registros
        if (this.leakDetection.history.length > 10) {
            this.leakDetection.history.shift();
        }
        
        // Verificar se há tendência de crescimento
        if (this.leakDetection.history.length >= 5) {
            const first = this.leakDetection.history[0];
            const last = this.leakDetection.history[this.leakDetection.history.length - 1];
            
            const growth = last.usage - first.usage;
            const timeDiff = last.timestamp - first.timestamp;
            const growthRate = growth / timeDiff; // bytes por ms
            
            if (growthRate > 1000) { // Crescimento > 1KB/ms
                console.log(`🚨 Possível vazamento de memória detectado. Taxa de crescimento: ${(growthRate * 1000).toFixed(2)}KB/s`);
                this.handleMemoryLeak();
            }
        }
    }

    // Detectar vazamentos de memória
    detectMemoryLeaks() {
        const memUsage = process.memoryUsage();
        
        // Verificar se uso de memória excede threshold
        if (memUsage.heapUsed > this.leakDetection.threshold) {
            console.log(`🚨 Uso de memória excede threshold: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB > ${(this.leakDetection.threshold / 1024 / 1024).toFixed(2)}MB`);
            
            // Forçar garbage collection
            this.performGarbageCollection();
            
            // Verificar se ainda está alto após GC
            const newUsage = process.memoryUsage().heapUsed;
            if (newUsage > this.leakDetection.threshold) {
                console.log(`🚨 Vazamento de memória confirmado após GC: ${(newUsage / 1024 / 1024).toFixed(2)}MB`);
                this.handleMemoryLeak();
            }
        }
    }

    // Manipular vazamento de memória
    handleMemoryLeak() {
        console.log('🔧 Tentando resolver vazamento de memória...');
        
        // Forçar garbage collection
        this.performGarbageCollection();
        
        // Limpar caches
        this.clearCaches();
        
        // Otimizar configurações
        this.optimizeMemorySettings();
        
        // Log de memória
        this.logMemoryUsage();
    }

    // Otimizar memória
    optimizeMemory() {
        const memUsage = process.memoryUsage();
        
        // Se uso de memória estiver alto, otimizar
        if (memUsage.heapUsed > 300 * 1024 * 1024) { // 300MB
            this.performGarbageCollection();
            this.clearCaches();
        }
        
        // Se uso de memória estiver muito alto, forçar otimização
        if (memUsage.heapUsed > 700 * 1024 * 1024) { // 700MB
            this.forceMemoryOptimization();
        }
    }

    // Forçar otimização de memória
    forceMemoryOptimization() {
        console.log('🔧 Forçando otimização de memória...');
        
        // Forçar garbage collection
        this.performGarbageCollection();
        
        // Limpar caches
        this.clearCaches();
        
        // Otimizar configurações
        this.optimizeMemorySettings();
        
        // Log de memória
        this.logMemoryUsage();
    }

    // Realizar garbage collection
    performGarbageCollection() {
        if (global.gc) {
            const beforeGC = process.memoryUsage().heapUsed;
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            
            const freed = beforeGC - afterGC;
            
            this.gcStats.total++;
            this.gcStats.lastGC = new Date().toISOString();
            
            if (freed > 0) {
                console.log(`🧹 GC liberou ${(freed / 1024 / 1024).toFixed(2)}MB de memória`);
            }
        } else {
            console.log('⚠️ Garbage collection não disponível. Execute com --expose-gc');
        }
    }

    // Limpar caches
    clearCaches() {
        // Limpar cache de queries
        if (global.queryOptimizer) {
            global.queryOptimizer.clearCache();
        }
        
        // Limpar cache de sessões
        if (global.sessionStore) {
            global.sessionStore.clear();
        }
        
        // Limpar cache de Redis
        if (global.redisClient) {
            global.redisClient.flushdb();
        }
        
        console.log('🧹 Caches limpos');
    }

    // Otimizar configurações de memória
    optimizeMemorySettings() {
        // Configurar limite de memória
        if (process.env.NODE_OPTIONS) {
            process.env.NODE_OPTIONS += ' --max-old-space-size=2048';
        } else {
            process.env.NODE_OPTIONS = '--max-old-space-size=2048';
        }
        
        // Configurar thread pool
        process.env.UV_THREADPOOL_SIZE = '16';
        
        // Configurar garbage collection
        if (process.env.NODE_ENV === 'production') {
            process.env.NODE_OPTIONS += ' --expose-gc';
        }
        
        console.log('⚙️ Configurações de memória otimizadas');
    }

    // Log de uso de memória
    logMemoryUsage() {
        const memUsage = process.memoryUsage();
        
        console.log('📊 Uso de memória atual:');
        console.log(`  Heap usado: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Heap total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  External: ${(memUsage.external / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
    }

    // Obter estatísticas de memória
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        
        return {
            current: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            },
            stats: this.memoryStats,
            gc: this.gcStats,
            leakDetection: {
                enabled: this.leakDetection.enabled,
                threshold: this.leakDetection.threshold,
                history: this.leakDetection.history
            },
            uptime: process.uptime(),
            pid: process.pid,
            platform: process.platform,
            nodeVersion: process.version
        };
    }

    // Obter heap snapshot
    async getHeapSnapshot() {
        try {
            const snapshot = v8.getHeapSnapshot();
            const filename = `heap-${Date.now()}.heapsnapshot`;
            const filepath = path.join(__dirname, '../logs', filename);
            
            // Criar diretório se não existir
            const logDir = path.dirname(filepath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            // Salvar snapshot
            const fileStream = fs.createWriteStream(filepath);
            snapshot.pipe(fileStream);
            
            return new Promise((resolve, reject) => {
                fileStream.on('finish', () => {
                    console.log(`📸 Heap snapshot salvo: ${filepath}`);
                    resolve(filepath);
                });
                
                fileStream.on('error', (error) => {
                    console.error('❌ Erro ao salvar heap snapshot:', error);
                    reject(error);
                });
            });
        } catch (error) {
            console.error('❌ Erro ao obter heap snapshot:', error);
            throw error;
        }
    }

    // Analisar heap
    analyzeHeap() {
        try {
            const heapStats = v8.getHeapStatistics();
            
            console.log('📊 Análise do heap:');
            console.log(`  Total heap size: ${(heapStats.total_heap_size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Used heap size: ${(heapStats.used_heap_size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Heap size limit: ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Total available size: ${(heapStats.total_available_size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Total physical size: ${(heapStats.total_physical_size / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  Number of native contexts: ${heapStats.number_of_native_contexts}`);
            console.log(`  Number of detached contexts: ${heapStats.number_of_detached_contexts}`);
            
            return heapStats;
        } catch (error) {
            console.error('❌ Erro ao analisar heap:', error);
            throw error;
        }
    }

    // Configurar monitoramento de vazamentos
    configureLeakDetection(options = {}) {
        this.leakDetection = {
            ...this.leakDetection,
            ...options
        };
        
        console.log('🔧 Detecção de vazamentos configurada:', this.leakDetection);
    }

    // Habilitar/desabilitar detecção de vazamentos
    setLeakDetectionEnabled(enabled) {
        this.leakDetection.enabled = enabled;
        console.log(`🔧 Detecção de vazamentos ${enabled ? 'habilitada' : 'desabilitada'}`);
    }

    // Definir threshold de vazamento
    setLeakThreshold(threshold) {
        this.leakDetection.threshold = threshold;
        console.log(`🔧 Threshold de vazamento definido para ${(threshold / 1024 / 1024).toFixed(2)}MB`);
    }

    // Definir intervalo de detecção
    setLeakDetectionInterval(interval) {
        this.leakDetection.interval = interval;
        console.log(`🔧 Intervalo de detecção definido para ${interval}ms`);
    }

    // Obter relatório de memória
    getMemoryReport() {
        const memUsage = process.memoryUsage();
        const heapStats = v8.getHeapStatistics();
        
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
            heap: heapStats,
            gc: this.gcStats,
            leakDetection: this.leakDetection,
            recommendations: this.getMemoryRecommendations()
        };
    }

    // Obter recomendações de memória
    getMemoryRecommendations() {
        const memUsage = process.memoryUsage();
        const recommendations = [];
        
        if (memUsage.heapUsed > 500 * 1024 * 1024) {
            recommendations.push('Considerar aumentar o limite de memória com --max-old-space-size');
        }
        
        if (memUsage.external > 100 * 1024 * 1024) {
            recommendations.push('Verificar uso de buffers e streams externos');
        }
        
        if (this.gcStats.total === 0) {
            recommendations.push('Habilitar garbage collection com --expose-gc');
        }
        
        if (this.leakDetection.history.length > 0) {
            const lastUsage = this.leakDetection.history[this.leakDetection.history.length - 1];
            if (lastUsage.usage > this.leakDetection.threshold) {
                recommendations.push('Investigar possíveis vazamentos de memória');
            }
        }
        
        return recommendations;
    }
}

// Instância singleton
const memoryOptimizer = new MemoryOptimizer();

module.exports = memoryOptimizer;
