const Redis = require('redis');
const { promisify } = require('util');

class CacheService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.defaultTTL = 3600; // 1 hora
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    async initialize() {
        try {
            // Configuração do Redis para produção
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.log('❌ Redis server connection refused');
                        return new Error('Redis server connection refused');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.log('❌ Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        console.log('❌ Redis max retry attempts reached');
                        return undefined;
                    }
                    // Reconectar após delay exponencial
                    return Math.min(options.attempt * 100, 3000);
                },
                // Configurações de performance
                maxmemory_policy: 'allkeys-lru',
                tcp_keepalive: true,
                lazyConnect: true,
                // Configurações de timeout
                connect_timeout: 10000,
                command_timeout: 5000,
                // Configurações de pool
                family: 4,
                keepAlive: true
            };

            this.client = Redis.createClient(redisConfig);
            
            // Promisificar métodos
            this.get = promisify(this.client.get).bind(this.client);
            this.set = promisify(this.client.set).bind(this.client);
            this.del = promisify(this.client.del).bind(this.client);
            this.exists = promisify(this.client.exists).bind(this.client);
            this.expire = promisify(this.client.expire).bind(this.client);
            this.keys = promisify(this.client.keys).bind(this.client);
            this.flushdb = promisify(this.client.flushdb).bind(this.client);

            // Event listeners
            this.client.on('connect', () => {
                console.log('✅ Redis conectado');
                this.isConnected = true;
            });

            this.client.on('error', (error) => {
                console.error('❌ Erro no Redis:', error);
                this.isConnected = false;
            });

            this.client.on('end', () => {
                console.log('🔌 Redis desconectado');
                this.isConnected = false;
            });

            // Conectar
            await this.client.connect();
            
            // Cache Service inicializado com sucesso
            return true;

        } catch (error) {
            console.error('❌ Erro ao inicializar Cache Service:', error);
            this.isConnected = false;
            return false;
        }
    }

    // Método genérico para obter dados do cache
    async get(key) {
        if (!this.isConnected) {
            return null;
        }

        try {
            const data = await this.get(key);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro ao obter do cache:', error);
            return null;
        }
    }

    // Método genérico para salvar dados no cache
    async set(key, data, ttl = this.defaultTTL) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const serializedData = JSON.stringify(data);
            await this.set(key, serializedData, 'EX', ttl);
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar no cache:', error);
            return false;
        }
    }

    // Método para deletar do cache
    async delete(key) {
        if (!this.isConnected) {
            return false;
        }

        try {
            await this.del(key);
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar do cache:', error);
            return false;
        }
    }

    // Método para verificar se existe no cache
    async exists(key) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const result = await this.exists(key);
            return result === 1;
        } catch (error) {
            console.error('❌ Erro ao verificar existência no cache:', error);
            return false;
        }
    }

    // Cache específico para produtos
    async getProduto(produtoId) {
        const key = `produto:${produtoId}`;
        return await this.get(key);
    }

    async setProduto(produtoId, produto, ttl = 1800) { // 30 minutos
        const key = `produto:${produtoId}`;
        return await this.set(key, produto, ttl);
    }

    async deleteProduto(produtoId) {
        const key = `produto:${produtoId}`;
        return await this.delete(key);
    }

    // Cache específico para vendedores
    async getVendedor(vendedorId) {
        const key = `vendedor:${vendedorId}`;
        return await this.get(key);
    }

    async setVendedor(vendedorId, vendedor, ttl = 3600) { // 1 hora
        const key = `vendedor:${vendedorId}`;
        return await this.set(key, vendedor, ttl);
    }

    async deleteVendedor(vendedorId) {
        const key = `vendedor:${vendedorId}`;
        return await this.delete(key);
    }

    // Cache específico para estatísticas
    async getEstatisticas(tipo, periodo = 'hoje') {
        const key = `estatisticas:${tipo}:${periodo}`;
        return await this.get(key);
    }

    async setEstatisticas(tipo, periodo, dados, ttl = 300) { // 5 minutos
        const key = `estatisticas:${tipo}:${periodo}`;
        return await this.set(key, dados, ttl);
    }

    // Cache específico para vendas
    async getVendas(vendedorId, limite = 50, offset = 0) {
        const key = `vendas:${vendedorId}:${limite}:${offset}`;
        return await this.get(key);
    }

    async setVendas(vendedorId, limite, offset, vendas, ttl = 600) { // 10 minutos
        const key = `vendas:${vendedorId}:${limite}:${offset}`;
        return await this.set(key, vendas, ttl);
    }

    // Cache específico para receitas
    async getReceita(vendedorId) {
        const key = `receita:${vendedorId}`;
        return await this.get(key);
    }

    async setReceita(vendedorId, receita, ttl = 300) { // 5 minutos
        const key = `receita:${vendedorId}`;
        return await this.set(key, receita, ttl);
    }

    async deleteReceita(vendedorId) {
        const key = `receita:${vendedorId}`;
        return await this.delete(key);
    }

    // Cache específico para configurações
    async getConfiguracao(chave) {
        const key = `config:${chave}`;
        return await this.get(key);
    }

    async setConfiguracao(chave, valor, ttl = 7200) { // 2 horas
        const key = `config:${chave}`;
        return await this.set(key, valor, ttl);
    }

    // Cache específico para sessões
    async getSessao(sessionId) {
        const key = `session:${sessionId}`;
        return await this.get(key);
    }

    async setSessao(sessionId, dados, ttl = 86400) { // 24 horas
        const key = `session:${sessionId}`;
        return await this.set(key, dados, ttl);
    }

    async deleteSessao(sessionId) {
        const key = `session:${sessionId}`;
        return await this.delete(key);
    }

    // Cache específico para rate limiting
    async getRateLimit(key) {
        const cacheKey = `ratelimit:${key}`;
        return await this.get(cacheKey);
    }

    async setRateLimit(key, count, ttl = 900) { // 15 minutos
        const cacheKey = `ratelimit:${key}`;
        return await this.set(cacheKey, count, ttl);
    }

    // Método para invalidar cache por padrão
    async invalidatePattern(pattern) {
        if (!this.isConnected) {
            return false;
        }

        try {
            const keys = await this.keys(pattern);
            if (keys.length > 0) {
                await this.del(...keys);
                console.log(`✅ Cache invalidado para padrão: ${pattern} (${keys.length} chaves)`);
            }
            return true;
        } catch (error) {
            console.error('❌ Erro ao invalidar cache por padrão:', error);
            return false;
        }
    }

    // Método para limpar todo o cache
    async clearAll() {
        if (!this.isConnected) {
            return false;
        }

        try {
            await this.flushdb();
            console.log('✅ Cache limpo completamente');
            return true;
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error);
            return false;
        }
    }

    // Método para obter estatísticas do cache
    async getStats() {
        if (!this.isConnected) {
            return null;
        }

        try {
            const info = await this.client.info('memory');
            const keyspace = await this.client.info('keyspace');
            
            return {
                connected: this.isConnected,
                memory: info,
                keyspace: keyspace,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas do cache:', error);
            return null;
        }
    }

    // Método para fechar conexão
    async close() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
            console.log('✅ Cache Service fechado');
        }
    }
}

// Instância singleton
const cacheService = new CacheService();

module.exports = cacheService;
