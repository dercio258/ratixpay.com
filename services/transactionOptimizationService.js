const { Venda, Pagamento, Usuario } = require('../config/database');

class TransactionOptimizationService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.batchSize = 50; // Processar em lotes
        this.maxRetries = 3;
    }

    /**
     * Busca últimas transações otimizada
     */
    async getLatestTransactions(options = {}) {
        const {
            vendedorId,
            limit = 20,
            offset = 0,
            status = null,
            periodo = null,
            useCache = true
        } = options;

        const cacheKey = `transactions:${vendedorId}:${limit}:${offset}:${status}:${periodo}`;
        
        // Verificar cache primeiro
        if (useCache) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`✅ Transações carregadas do cache para vendedor: ${vendedorId}`);
                return cached;
            }
        }

        try {
            console.log(`🔄 Buscando últimas transações para vendedor: ${vendedorId}`);
            
            // Construir condições de busca
            const whereConditions = this.buildWhereConditions(vendedorId, status, periodo);
            
            // Buscar transações com otimizações
            const transactions = await this.fetchTransactionsOptimized(whereConditions, limit, offset);
            
            // Processar e formatar dados
            const processedTransactions = await this.processTransactions(transactions);
            
            // Salvar no cache
            this.setCache(cacheKey, processedTransactions);
            
            console.log(`✅ ${processedTransactions.length} transações carregadas para vendedor: ${vendedorId}`);
            return processedTransactions;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar transações para vendedor ${vendedorId}:`, error);
            throw error;
        }
    }

    /**
     * Busca transações com otimizações de performance
     */
    async fetchTransactionsOptimized(whereConditions, limit, offset) {
        try {
            // Usar query otimizada com índices
            const transactions = await Venda.findAll({
                where: whereConditions,
                attributes: [
                    'id', 'public_id', 'cliente_nome', 'cliente_email', 'cliente_telefone',
                    'valor_final', 'valor_original', 'status_pagamento', 'metodo_pagamento',
                    'referencia_pagamento', 'created_at', 'updated_at'
                ],
                order: [['created_at', 'DESC']],
                limit: Math.min(limit, 100), // Limitar máximo
                offset: offset,
                // Usar índices otimizados
                raw: false // Manter objetos Sequelize para processamento
            });

            return transactions;
            
        } catch (error) {
            console.error('❌ Erro na query otimizada de transações:', error);
            throw error;
        }
    }

    /**
     * Processa transações para formato otimizado
     */
    async processTransactions(transactions) {
        return transactions.map(transaction => ({
            id: transaction.id,
            publicId: transaction.public_id,
            cliente: {
                nome: transaction.cliente_nome,
                email: transaction.cliente_email,
                telefone: transaction.cliente_telefone
            },
            valor: {
                final: parseFloat(transaction.valor_final || 0),
                original: parseFloat(transaction.valor_original || 0)
            },
            status: transaction.status_pagamento,
            metodo: transaction.metodo_pagamento,
            numeroPedido: transaction.referencia_pagamento,
            dataVenda: transaction.created_at,
            dataAtualizacao: transaction.updated_at
        }));
    }

    /**
     * Constrói condições de busca otimizadas
     */
    buildWhereConditions(vendedorId, status, periodo) {
        const conditions = {
            vendedor_id: vendedorId
        };

        // Adicionar filtro de status se especificado
        if (status && status !== 'todos') {
            conditions.status_pagamento = status;
        }

        // Adicionar filtro de período se especificado
        if (periodo) {
            const { dataInicio, dataFim } = this.getPeriodoFiltro(periodo);
            conditions.created_at = {
                [require('sequelize').Op.between]: [dataInicio, dataFim]
            };
        }

        return conditions;
    }

    /**
     * Obtém filtro de período
     */
    getPeriodoFiltro(periodo) {
        const hoje = new Date();
        let dataInicio, dataFim;

        switch (periodo) {
            case 'hoje':
                dataInicio = new Date(hoje.setHours(0, 0, 0, 0));
                dataFim = new Date(hoje.setHours(23, 59, 59, 999));
                break;
            case 'ontem':
                const ontem = new Date(hoje);
                ontem.setDate(ontem.getDate() - 1);
                dataInicio = new Date(ontem.setHours(0, 0, 0, 0));
                dataFim = new Date(ontem.setHours(23, 59, 59, 999));
                break;
            case '7dias':
                const seteDias = new Date(hoje);
                seteDias.setDate(seteDias.getDate() - 7);
                dataInicio = new Date(seteDias.setHours(0, 0, 0, 0));
                dataFim = new Date();
                break;
            case '30dias':
                const trintaDias = new Date(hoje);
                trintaDias.setDate(trintaDias.getDate() - 30);
                dataInicio = new Date(trintaDias.setHours(0, 0, 0, 0));
                dataFim = new Date();
                break;
            case 'mes':
                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataInicio = new Date(inicioMes.setHours(0, 0, 0, 0));
                dataFim = new Date();
                break;
            default:
                dataInicio = new Date(hoje.setHours(0, 0, 0, 0));
                dataFim = new Date();
        }

        return { dataInicio, dataFim };
    }

    /**
     * Busca estatísticas de transações otimizada
     */
    async getTransactionStats(vendedorId, periodo = '30dias') {
        const cacheKey = `stats:${vendedorId}:${periodo}`;
        
        // Verificar cache
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const { dataInicio, dataFim } = this.getPeriodoFiltro(periodo);
            
            // Buscar estatísticas em paralelo
            const [totalVendas, vendasAprovadas, vendasPendentes, vendasCanceladas, receitaTotal] = await Promise.all([
                Venda.count({
                    where: {
                        vendedor_id: vendedorId,
                        created_at: { [require('sequelize').Op.between]: [dataInicio, dataFim] }
                    }
                }),
                Venda.count({
                    where: {
                        vendedor_id: vendedorId,
                        status_pagamento: 'Aprovado',
                        created_at: { [require('sequelize').Op.between]: [dataInicio, dataFim] }
                    }
                }),
                Venda.count({
                    where: {
                        vendedor_id: vendedorId,
                        status_pagamento: 'Pendente',
                        created_at: { [require('sequelize').Op.between]: [dataInicio, dataFim] }
                    }
                }),
                Venda.count({
                    where: {
                        vendedor_id: vendedorId,
                        status_pagamento: 'Cancelado',
                        created_at: { [require('sequelize').Op.between]: [dataInicio, dataFim] }
                    }
                }),
                Venda.sum('valor_final', {
                    where: {
                        vendedor_id: vendedorId,
                        status_pagamento: 'Aprovado',
                        created_at: { [require('sequelize').Op.between]: [dataInicio, dataFim] }
                    }
                })
            ]);

            const stats = {
                totalVendas,
                vendasAprovadas,
                vendasPendentes,
                vendasCanceladas,
                receitaTotal: parseFloat(receitaTotal || 0),
                taxaAprovacao: vendasAprovadas > 0 ? 
                    ((vendasAprovadas / (vendasAprovadas + vendasCanceladas)) * 100).toFixed(2) : 0,
                periodo,
                dataInicio,
                dataFim
            };

            // Salvar no cache
            this.setCache(cacheKey, stats);
            
            return stats;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar estatísticas para vendedor ${vendedorId}:`, error);
            throw error;
        }
    }

    /**
     * Busca transação específica otimizada
     */
    async getTransactionById(transactionId, vendedorId = null) {
        const cacheKey = `transaction:${transactionId}`;
        
        // Verificar cache
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const whereCondition = { id: transactionId };
            if (vendedorId) {
                whereCondition.vendedor_id = vendedorId;
            }

            const transaction = await Venda.findOne({
                where: whereCondition,
                attributes: [
                    'id', 'public_id', 'cliente_nome', 'cliente_email', 'cliente_telefone',
                    'valor_final', 'valor_original', 'status_pagamento', 'metodo_pagamento',
                    'referencia_pagamento', 'created_at', 'updated_at'
                ]
            });

            if (!transaction) {
                return null;
            }

            const processedTransaction = await this.processTransactions([transaction]);
            const result = processedTransaction[0];

            // Salvar no cache
            this.setCache(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar transação ${transactionId}:`, error);
            throw error;
        }
    }

    /**
     * Limpa cache de transações
     */
    clearTransactionCache(vendedorId = null) {
        if (vendedorId) {
            // Limpar cache específico do vendedor
            for (const [key, value] of this.cache.entries()) {
                if (key.includes(`:${vendedorId}:`)) {
                    this.cache.delete(key);
                }
            }
            console.log(`✅ Cache de transações limpo para vendedor: ${vendedorId}`);
        } else {
            // Limpar todo o cache
            this.cache.clear();
            console.log('✅ Cache de transações limpo completamente');
        }
    }

    /**
     * Sistema de cache
     */
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return cached.data;
        }
        // Remove cache expirado
        if (cached) {
            this.cache.delete(key);
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Otimiza índices do banco de dados
     */
    async optimizeDatabaseIndexes() {
        try {
            console.log('🔧 Otimizando índices para transações...');
            
            // Verificar se índices existem
            const indexes = [
                'idx_vendas_vendedor_id_created',
                'idx_vendas_status_pagamento',
                'idx_vendas_created_at',
                'idx_vendas_vendedor_id_status'
            ];

            for (const indexName of indexes) {
                try {
                    await require('../config/database').sequelize.query(
                        `CREATE INDEX IF NOT EXISTS ${indexName} ON vendas(${indexName.replace('idx_vendas_', '').replace('_', ', ')})`
                    );
                    console.log(`✅ Índice ${indexName} verificado/criado`);
                } catch (error) {
                    console.log(`ℹ️ Índice ${indexName} já existe ou erro:`, error.message);
                }
            }
            
            console.log('✅ Otimização de índices concluída');
            
        } catch (error) {
            console.error('❌ Erro na otimização de índices:', error);
        }
    }
}

module.exports = new TransactionOptimizationService();
