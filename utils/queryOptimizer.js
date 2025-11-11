const { Op } = require('sequelize');

class QueryOptimizer {
    constructor() {
        this.queryCache = new Map();
        this.queryStats = new Map();
        this.maxCacheSize = 1000;
        this.cacheTimeout = 300000; // 5 minutos
    }

    // Otimizar query de produtos com cache
    async getProdutosOptimized(filters = {}) {
        const cacheKey = `produtos_${JSON.stringify(filters)}`;
        
        // Verificar cache
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.updateQueryStats('produtos', 'cache_hit');
                return cached.data;
            }
        }
        
        try {
            const { Produto, Usuario } = require('../config/database');
            
            // Construir query otimizada
            const whereClause = this.buildProdutoWhereClause(filters);
            
            const produtos = await Produto.findAll({
                where: whereClause,
                include: [{
                    model: Usuario,
                    as: 'vendedor',
                    attributes: ['id', 'nome', 'telefone', 'email']
                }],
                attributes: [
                    'id', 'nome', 'descricao', 'preco', 'categoria', 
                    'imagem', 'status', 'createdAt', 'updatedAt'
                ],
                order: [['createdAt', 'DESC']],
                limit: filters.limit || 50,
                offset: filters.offset || 0
            });
            
            // Cachear resultado
            this.cacheQuery(cacheKey, produtos);
            this.updateQueryStats('produtos', 'cache_miss');
            
            return produtos;
        } catch (error) {
            console.error('❌ Erro ao buscar produtos:', error);
            throw error;
        }
    }

    // Otimizar query de vendas com agregação
    async getVendasOptimized(filters = {}) {
        const cacheKey = `vendas_${JSON.stringify(filters)}`;
        
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.updateQueryStats('vendas', 'cache_hit');
                return cached.data;
            }
        }
        
        try {
            const { Venda, Produto, Usuario, Cliente } = require('../config/database');
            
            const whereClause = this.buildVendaWhereClause(filters);
            
            const vendas = await Venda.findAll({
                where: whereClause,
                include: [
                    {
                        model: Produto,
                        as: 'produto',
                        attributes: ['id', 'nome', 'preco', 'categoria']
                    },
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome', 'telefone']
                    },
                    {
                        model: Cliente,
                        as: 'cliente',
                        attributes: ['id', 'nome', 'telefone']
                    }
                ],
                attributes: [
                    'id', 'quantidade', 'precoTotal', 'status', 
                    'createdAt', 'updatedAt'
                ],
                order: [['createdAt', 'DESC']],
                limit: filters.limit || 100,
                offset: filters.offset || 0
            });
            
            this.cacheQuery(cacheKey, vendas);
            this.updateQueryStats('vendas', 'cache_miss');
            
            return vendas;
        } catch (error) {
            console.error('❌ Erro ao buscar vendas:', error);
            throw error;
        }
    }

    // Otimizar query de estatísticas com agregação
    async getEstatisticasOptimized(filters = {}) {
        const cacheKey = `estatisticas_${JSON.stringify(filters)}`;
        
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.updateQueryStats('estatisticas', 'cache_hit');
                return cached.data;
            }
        }
        
        try {
            const { Venda, Produto, Usuario } = require('../config/database');
            
            const whereClause = this.buildEstatisticaWhereClause(filters);
            
            // Query otimizada com agregação
            const estatisticas = await Venda.findAll({
                where: whereClause,
                include: [{
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'nome', 'categoria']
                }],
                attributes: [
                    'produtoId',
                    [Venda.sequelize.fn('COUNT', Venda.sequelize.col('Venda.id')), 'totalVendas'],
                    [Venda.sequelize.fn('SUM', Venda.sequelize.col('Venda.quantidade')), 'totalQuantidade'],
                    [Venda.sequelize.fn('SUM', Venda.sequelize.col('Venda.precoTotal')), 'totalFaturamento'],
                    [Venda.sequelize.fn('AVG', Venda.sequelize.col('Venda.precoTotal')), 'precoMedio']
                ],
                group: ['produtoId', 'produto.id'],
                order: [[Venda.sequelize.fn('SUM', Venda.sequelize.col('Venda.precoTotal')), 'DESC']],
                limit: filters.limit || 20
            });
            
            this.cacheQuery(cacheKey, estatisticas);
            this.updateQueryStats('estatisticas', 'cache_miss');
            
            return estatisticas;
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);
            throw error;
        }
    }

    // Otimizar query de usuários com paginação
    async getUsuariosOptimized(filters = {}) {
        const cacheKey = `usuarios_${JSON.stringify(filters)}`;
        
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.updateQueryStats('usuarios', 'cache_hit');
                return cached.data;
            }
        }
        
        try {
            const { Usuario } = require('../config/database');
            
            const whereClause = this.buildUsuarioWhereClause(filters);
            
            const usuarios = await Usuario.findAll({
                where: whereClause,
                attributes: [
                    'id', 'nome', 'email', 'telefone', 'status', 
                    'createdAt', 'updatedAt'
                ],
                order: [['createdAt', 'DESC']],
                limit: filters.limit || 50,
                offset: filters.offset || 0
            });
            
            this.cacheQuery(cacheKey, usuarios);
            this.updateQueryStats('usuarios', 'cache_miss');
            
            return usuarios;
        } catch (error) {
            console.error('❌ Erro ao buscar usuários:', error);
            throw error;
        }
    }

    // Otimizar query de pagamentos com filtros
    async getPagamentosOptimized(filters = {}) {
        const cacheKey = `pagamentos_${JSON.stringify(filters)}`;
        
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                this.updateQueryStats('pagamentos', 'cache_hit');
                return cached.data;
            }
        }
        
        try {
            const { Pagamento, Venda, Usuario } = require('../config/database');
            
            const whereClause = this.buildPagamentoWhereClause(filters);
            
            const pagamentos = await Pagamento.findAll({
                where: whereClause,
                include: [
                    {
                        model: Venda,
                        as: 'venda',
                        attributes: ['id', 'quantidade', 'precoTotal']
                    },
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome', 'telefone']
                    }
                ],
                attributes: [
                    'id', 'valor', 'status', 'metodo', 'referencia',
                    'createdAt', 'updatedAt'
                ],
                order: [['createdAt', 'DESC']],
                limit: filters.limit || 100,
                offset: filters.offset || 0
            });
            
            this.cacheQuery(cacheKey, pagamentos);
            this.updateQueryStats('pagamentos', 'cache_miss');
            
            return pagamentos;
        } catch (error) {
            console.error('❌ Erro ao buscar pagamentos:', error);
            throw error;
        }
    }

    // Construir cláusula WHERE para produtos
    buildProdutoWhereClause(filters) {
        const where = {};
        
        if (filters.categoria) {
            where.categoria = filters.categoria;
        }
        
        if (filters.status) {
            where.status = filters.status;
        }
        
        if (filters.precoMin || filters.precoMax) {
            where.preco = {};
            if (filters.precoMin) {
                where.preco[Op.gte] = filters.precoMin;
            }
            if (filters.precoMax) {
                where.preco[Op.lte] = filters.precoMax;
            }
        }
        
        if (filters.busca) {
            where[Op.or] = [
                { nome: { [Op.iLike]: `%${filters.busca}%` } },
                { descricao: { [Op.iLike]: `%${filters.busca}%` } }
            ];
        }
        
        if (filters.vendedorId) {
            where.vendedorId = filters.vendedorId;
        }
        
        return where;
    }

    // Construir cláusula WHERE para vendas
    buildVendaWhereClause(filters) {
        const where = {};
        
        if (filters.status) {
            where.status = filters.status;
        }
        
        if (filters.vendedorId) {
            where.vendedorId = filters.vendedorId;
        }
        
        if (filters.clienteId) {
            where.clienteId = filters.clienteId;
        }
        
        if (filters.produtoId) {
            where.produtoId = filters.produtoId;
        }
        
        if (filters.dataInicio || filters.dataFim) {
            where.createdAt = {};
            if (filters.dataInicio) {
                where.createdAt[Op.gte] = new Date(filters.dataInicio);
            }
            if (filters.dataFim) {
                where.createdAt[Op.lte] = new Date(filters.dataFim);
            }
        }
        
        if (filters.valorMin || filters.valorMax) {
            where.precoTotal = {};
            if (filters.valorMin) {
                where.precoTotal[Op.gte] = filters.valorMin;
            }
            if (filters.valorMax) {
                where.precoTotal[Op.lte] = filters.valorMax;
            }
        }
        
        return where;
    }

    // Construir cláusula WHERE para estatísticas
    buildEstatisticaWhereClause(filters) {
        const where = {};
        
        if (filters.vendedorId) {
            where.vendedorId = filters.vendedorId;
        }
        
        if (filters.produtoId) {
            where.produtoId = filters.produtoId;
        }
        
        if (filters.dataInicio || filters.dataFim) {
            where.createdAt = {};
            if (filters.dataInicio) {
                where.createdAt[Op.gte] = new Date(filters.dataInicio);
            }
            if (filters.dataFim) {
                where.createdAt[Op.lte] = new Date(filters.dataFim);
            }
        }
        
        if (filters.status) {
            where.status = filters.status;
        }
        
        return where;
    }

    // Construir cláusula WHERE para usuários
    buildUsuarioWhereClause(filters) {
        const where = {};
        
        if (filters.status) {
            where.status = filters.status;
        }
        
        if (filters.role) {
            where.role = filters.role;
        }
        
        if (filters.busca) {
            where[Op.or] = [
                { nome: { [Op.iLike]: `%${filters.busca}%` } },
                { email: { [Op.iLike]: `%${filters.busca}%` } },
                { telefone: { [Op.iLike]: `%${filters.busca}%` } }
            ];
        }
        
        if (filters.dataInicio || filters.dataFim) {
            where.createdAt = {};
            if (filters.dataInicio) {
                where.createdAt[Op.gte] = new Date(filters.dataInicio);
            }
            if (filters.dataFim) {
                where.createdAt[Op.lte] = new Date(filters.dataFim);
            }
        }
        
        return where;
    }

    // Construir cláusula WHERE para pagamentos
    buildPagamentoWhereClause(filters) {
        const where = {};
        
        if (filters.status) {
            where.status = filters.status;
        }
        
        if (filters.metodo) {
            where.metodo = filters.metodo;
        }
        
        if (filters.vendedorId) {
            where.vendedorId = filters.vendedorId;
        }
        
        if (filters.dataInicio || filters.dataFim) {
            where.createdAt = {};
            if (filters.dataInicio) {
                where.createdAt[Op.gte] = new Date(filters.dataInicio);
            }
            if (filters.dataFim) {
                where.createdAt[Op.lte] = new Date(filters.dataFim);
            }
        }
        
        if (filters.valorMin || filters.valorMax) {
            where.valor = {};
            if (filters.valorMin) {
                where.valor[Op.gte] = filters.valorMin;
            }
            if (filters.valorMax) {
                where.valor[Op.lte] = filters.valorMax;
            }
        }
        
        return where;
    }

    // Cachear query
    cacheQuery(key, data) {
        // Limpar cache se estiver muito grande
        if (this.queryCache.size >= this.maxCacheSize) {
            const firstKey = this.queryCache.keys().next().value;
            this.queryCache.delete(firstKey);
        }
        
        this.queryCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Atualizar estatísticas de query
    updateQueryStats(queryType, event) {
        if (!this.queryStats.has(queryType)) {
            this.queryStats.set(queryType, {
                total: 0,
                cacheHits: 0,
                cacheMisses: 0,
                errors: 0
            });
        }
        
        const stats = this.queryStats.get(queryType);
        stats.total++;
        
        switch (event) {
            case 'cache_hit':
                stats.cacheHits++;
                break;
            case 'cache_miss':
                stats.cacheMisses++;
                break;
            case 'error':
                stats.errors++;
                break;
        }
    }

    // Obter estatísticas de performance
    getQueryStats() {
        const stats = {};
        
        for (const [queryType, data] of this.queryStats) {
            stats[queryType] = {
                ...data,
                cacheHitRate: data.total > 0 ? (data.cacheHits / data.total * 100).toFixed(2) + '%' : '0%',
                errorRate: data.total > 0 ? (data.errors / data.total * 100).toFixed(2) + '%' : '0%'
            };
        }
        
        return {
            queryStats: stats,
            cacheSize: this.queryCache.size,
            cacheTimeout: this.cacheTimeout
        };
    }

    // Limpar cache
    clearCache() {
        this.queryCache.clear();
        console.log('🧹 Cache de queries limpo');
    }

    // Limpar cache expirado
    clearExpiredCache() {
        const now = Date.now();
        let cleared = 0;
        
        for (const [key, value] of this.queryCache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.queryCache.delete(key);
                cleared++;
            }
        }
        
        if (cleared > 0) {
            console.log(`🧹 ${cleared} entradas de cache expiradas removidas`);
        }
    }

    // Otimizar query com índices
    async optimizeIndexes() {
        try {
            const sequelize = require('../config/database').sequelize;
            
            // Criar índices para melhorar performance
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON "Produtos" (categoria)',
                'CREATE INDEX IF NOT EXISTS idx_produtos_status ON "Produtos" (status)',
                'CREATE INDEX IF NOT EXISTS idx_produtos_vendedor ON "Produtos" ("vendedorId")',
                'CREATE INDEX IF NOT EXISTS idx_vendas_status ON "Vendas" (status)',
                'CREATE INDEX IF NOT EXISTS idx_vendas_vendedor ON "Vendas" ("vendedorId")',
                'CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON "Vendas" ("clienteId")',
                'CREATE INDEX IF NOT EXISTS idx_vendas_produto ON "Vendas" ("produtoId")',
                'CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON "Vendas" ("createdAt")',
                'CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON "Pagamentos" (status)',
                'CREATE INDEX IF NOT EXISTS idx_pagamentos_vendedor ON "Pagamentos" ("vendedorId")',
                'CREATE INDEX IF NOT EXISTS idx_pagamentos_created_at ON "Pagamentos" ("createdAt")',
                'CREATE INDEX IF NOT EXISTS idx_usuarios_status ON "Usuarios" (status)',
                'CREATE INDEX IF NOT EXISTS idx_usuarios_role ON "Usuarios" (role)',
                'CREATE INDEX IF NOT EXISTS idx_usuarios_created_at ON "Usuarios" ("createdAt")'
            ];
            
            for (const index of indexes) {
                await sequelize.query(index);
            }
            
            console.log('✅ Índices otimizados criados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao criar índices:', error);
            throw error;
        }
    }

    // Otimizar query com análise de performance
    async analyzeQueryPerformance(query, params = {}) {
        try {
            const sequelize = require('../config/database').sequelize;
            
            // Habilitar logging para análise
            const originalLogging = sequelize.options.logging;
            sequelize.options.logging = console.log;
            
            const startTime = Date.now();
            const result = await sequelize.query(query, params);
            const endTime = Date.now();
            
            // Restaurar logging
            sequelize.options.logging = originalLogging;
            
            const executionTime = endTime - startTime;
            
            console.log(`📊 Query executada em ${executionTime}ms`);
            
            return {
                result,
                executionTime,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao analisar performance da query:', error);
            throw error;
        }
    }
}

// Instância singleton
const queryOptimizer = new QueryOptimizer();

module.exports = queryOptimizer;
