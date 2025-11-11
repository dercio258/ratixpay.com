/**
 * Cache de Vendedores para Otimização
 * Reduz consultas repetitivas ao banco de dados
 */
class VendedorCache {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.statsCache = new Map();
        this.statsTimeout = 2 * 60 * 1000; // 2 minutos
    }

    /**
     * Obter vendedor do cache
     */
    getVendedor(vendedorId) {
        const cached = this.cache.get(vendedorId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Salvar vendedor no cache
     */
    setVendedor(vendedorId, vendedorData) {
        this.cache.set(vendedorId, {
            data: vendedorData,
            timestamp: Date.now()
        });
    }

    /**
     * Obter estatísticas do cache
     */
    getStats(vendedorId) {
        const cached = this.statsCache.get(vendedorId);
        if (cached && Date.now() - cached.timestamp < this.statsTimeout) {
            return cached.data;
        }
        return null;
    }

    /**
     * Salvar estatísticas no cache
     */
    setStats(vendedorId, statsData) {
        this.statsCache.set(vendedorId, {
            data: statsData,
            timestamp: Date.now()
        });
    }

    /**
     * Limpar cache de um vendedor específico
     */
    clearVendedor(vendedorId) {
        this.cache.delete(vendedorId);
        this.statsCache.delete(vendedorId);
    }

    /**
     * Limpar todo o cache
     */
    clearAll() {
        this.cache.clear();
        this.statsCache.clear();
    }

    /**
     * Limpar cache expirado
     */
    cleanExpired() {
        const now = Date.now();
        
        // Limpar vendedores expirados
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
        
        // Limpar estatísticas expiradas
        for (const [key, value] of this.statsCache.entries()) {
            if (now - value.timestamp > this.statsTimeout) {
                this.statsCache.delete(key);
            }
        }
    }

    /**
     * Obter estatísticas do cache
     */
    getCacheStats() {
        return {
            vendedores: this.cache.size,
            stats: this.statsCache.size,
            memoryUsage: process.memoryUsage()
        };
    }
}

// Instância singleton
const vendedorCache = new VendedorCache();

// Limpar cache expirado a cada 10 minutos
setInterval(() => {
    vendedorCache.cleanExpired();
}, 10 * 60 * 1000);

module.exports = vendedorCache;
