const { Venda, Pagamento, HistoricoSaques, Usuario } = require('../config/database');
const { Op } = require('sequelize');

class DashboardService {
    constructor() {
        this.memoryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.cacheEnabled = true;
        // Dashboard Service inicializado com cache em memória
    }

    async getCache(key) {
        if (!this.cacheEnabled) return null;
        
        try {
            const cached = this.memoryCache.get(key);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
                return cached.data;
            }
            // Remove cache expirado
            if (cached) {
                this.memoryCache.delete(key);
            }
            return null;
        } catch (error) {
            console.error('❌ Erro ao buscar cache:', error.message);
            return null;
        }
    }

    async setCache(key, data, ttl = 300) { // 5 minutos por padrão
        if (!this.cacheEnabled) return;
        
        try {
            this.memoryCache.set(key, {
                data: data,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('❌ Erro ao salvar cache:', error.message);
        }
    }

    async getDashboardData(vendedorId, options = {}) {
        const startTime = Date.now();
        const cacheKey = `dashboard:${vendedorId}:${JSON.stringify(options)}`;
        
        try {
            console.log(`🔄 Buscando dados do dashboard para vendedor: ${vendedorId}`);
            
            // Verificar cache primeiro
            const cached = await this.getCache(cacheKey);
            if (cached) {
                console.log(`✅ Dados do dashboard carregados do cache para vendedor: ${vendedorId}`);
                return cached;
            }

            // Executar todas as consultas em paralelo
            const [
                vendedor,
                resumoVendas,
                vendasRecentes,
                saquesPendentes,
                historicoSaques
            ] = await Promise.allSettled([
                this.getVendedorInfo(vendedorId),
                this.getResumoVendas(vendedorId, options),
                this.getVendasRecentes(vendedorId, options),
                this.getSaquesPendentes(vendedorId),
                this.getHistoricoSaques(vendedorId, options)
            ]);

            // Processar resultados
            const result = {
                vendedorId,
                vendedor: vendedor.status === 'fulfilled' ? vendedor.value : null,
                resumo: resumoVendas.status === 'fulfilled' ? resumoVendas.value : this.getDefaultResumo(),
                vendas: vendasRecentes.status === 'fulfilled' ? vendasRecentes.value : [],
                saques: {
                    pendentes: saquesPendentes.status === 'fulfilled' ? saquesPendentes.value : [],
                    historico: historicoSaques.status === 'fulfilled' ? historicoSaques.value : []
                },
                errors: this.extractErrors([vendedor, resumoVendas, vendasRecentes, saquesPendentes, historicoSaques]),
                timestamp: new Date().toISOString(),
                cached: false
            };

            // Salvar no cache
            await this.setCache(cacheKey, result);

            const duration = Date.now() - startTime;
            console.log(`✅ Dashboard carregado para vendedor ${vendedorId} em ${duration}ms`);

            // Log de performance
            if (duration > 2000) {
                console.warn(`⚠️ Dashboard lento para vendedor ${vendedorId}: ${duration}ms`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Erro ao carregar dashboard para vendedor ${vendedorId}:`, error);
            throw new Error(`Falha ao carregar dados do dashboard: ${error.message}`);
        }
    }

    async getVendedorInfo(vendedorId) {
        try {
            const vendedor = await Usuario.findByPk(vendedorId, {
                attributes: ['id', 'nome_completo', 'email', 'telefone', 'whatsapp', 'created_at']
            });

            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }

            return {
                id: vendedor.id,
                nome: vendedor.nome_completo,
                email: vendedor.email,
                telefone: vendedor.telefone,
                whatsapp: vendedor.whatsapp,
                dataCadastro: vendedor.created_at
            };
        } catch (error) {
            console.error(`❌ Erro ao buscar vendedor ${vendedorId}:`, error.message);
            throw error;
        }
    }

    async getResumoVendas(vendedorId, options = {}) {
        try {
            const whereClause = { vendedor_id: vendedorId };
            
            // Adicionar filtro de período se especificado
            if (options.periodo) {
                const { dataInicio, dataFim } = this.getPeriodoFiltro(options.periodo);
                whereClause.created_at = {
                    [require('sequelize').Op.between]: [dataInicio, dataFim]
                };
            }

            // Status que indicam aprovação (incluindo APROVADO)
            const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
            const statusPendentes = ['Pendente', 'pendente', 'PENDENTE', 'Aguardando Pagamento'];
            const statusCancelados = ['Cancelada', 'cancelada', 'CANCELADA', 'Cancelado', 'cancelado', 'CANCELADO', 'Rejeitado', 'rejeitado', 'REJEITADO'];
            
            const [vendasAprovadas, vendasPendentes, vendasCanceladas] = await Promise.all([
                Venda.count({
                    where: { 
                        ...whereClause, 
                        status: { [Op.in]: statusAprovados }
                    }
                }),
                Venda.count({
                    where: { 
                        ...whereClause, 
                        status: { [Op.in]: statusPendentes }
                    }
                }),
                Venda.count({
                    where: { 
                        ...whereClause, 
                        status: { [Op.in]: statusCancelados }
                    }
                })
            ]);

            // Usar 'valor' em vez de 'pagamento_valor' pois é o campo correto no modelo
            const receitaTotal = await Venda.sum('valor', {
                where: { 
                    ...whereClause, 
                    status: { [Op.in]: statusAprovados }
                }
            }) || 0;

            return {
                totalVendas: vendasAprovadas + vendasPendentes + vendasCanceladas,
                vendasAprovadas,
                vendasPendentes,
                vendasCanceladas,
                receitaTotal: parseFloat(receitaTotal),
                taxaAprovacao: vendasAprovadas > 0 ? 
                    ((vendasAprovadas / (vendasAprovadas + vendasCanceladas)) * 100).toFixed(2) : 0
            };
        } catch (error) {
            console.error(`❌ Erro ao buscar resumo de vendas para vendedor ${vendedorId}:`, error.message);
            throw error;
        }
    }

    async getVendasRecentes(vendedorId, options = {}) {
        try {
            const limit = options.limit || 10;
            const offset = options.offset || 0;

            const whereClause = { vendedor_id: vendedorId };
            
            if (options.periodo) {
                const { dataInicio, dataFim } = this.getPeriodoFiltro(options.periodo);
                whereClause.created_at = {
                    [require('sequelize').Op.between]: [dataInicio, dataFim]
                };
            }

            const vendas = await Venda.findAll({
                where: whereClause,
                attributes: [
                    'id', 'public_id', 'cliente_nome', 'cliente_email', 'cliente_telefone',
                    'pagamento_valor', 'pagamento_status', 'pagamento_metodo', 
                    'referencia_pagamento', 'created_at'
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            return vendas.map(venda => ({
                id: venda.id,
                publicId: venda.public_id,
                cliente: {
                    nome: venda.cliente_nome,
                    email: venda.cliente_email,
                    telefone: venda.cliente_telefone
                },
                valor: parseFloat(venda.pagamento_valor || 0),
                status: venda.pagamento_status,
                metodo: venda.pagamento_metodo,
                numeroPedido: venda.referencia_pagamento,
                dataVenda: venda.created_at
            }));
        } catch (error) {
            console.error(`❌ Erro ao buscar vendas recentes para vendedor ${vendedorId}:`, error.message);
            throw error;
        }
    }

    async getSaquesPendentes(vendedorId) {
        try {
            const saques = await Pagamento.findAll({
                where: {
                    vendedor_id: vendedorId,
                    status: 'Pendente'
                },
                attributes: [
                    'id', 'valor_solicitado', 'status', 'data_solicitacao', 
                    'metodo_saque', 'observacoes'
                ],
                order: [['data_solicitacao', 'DESC']]
            });

            return saques.map(saque => ({
                id: saque.id,
                valor: parseFloat(saque.valor_solicitado || 0),
                status: saque.status,
                dataSolicitacao: saque.data_solicitacao,
                metodo: saque.metodo_saque,
                observacoes: saque.observacoes
            }));
        } catch (error) {
            console.error(`❌ Erro ao buscar saques pendentes para vendedor ${vendedorId}:`, error.message);
            throw error;
        }
    }

    async getHistoricoSaques(vendedorId, options = {}) {
        try {
            const limit = options.limit || 20;
            const offset = options.offset || 0;

            const whereClause = { vendedor_id: vendedorId };
            
            if (options.periodo) {
                const { dataInicio, dataFim } = this.getPeriodoFiltro(options.periodo);
                whereClause.created_at = {
                    [require('sequelize').Op.between]: [dataInicio, dataFim]
                };
            }

            const saques = await HistoricoSaques.findAll({
                where: whereClause,
                attributes: [
                    'id', 'valor', 'status', 'metodo_saque', 'data_solicitacao',
                    'data_processamento', 'observacoes'
                ],
                order: [['data_solicitacao', 'DESC']],
                limit,
                offset
            });

            return saques.map(saque => ({
                id: saque.id,
                valor: parseFloat(saque.valor || 0),
                status: saque.status,
                metodo: saque.metodo_saque,
                dataSolicitacao: saque.data_solicitacao,
                dataProcessamento: saque.data_processamento,
                observacoes: saque.observacoes
            }));
        } catch (error) {
            console.error(`❌ Erro ao buscar histórico de saques para vendedor ${vendedorId}:`, error.message);
            throw error;
        }
    }

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

    getDefaultResumo() {
        return {
            totalVendas: 0,
            vendasAprovadas: 0,
            vendasPendentes: 0,
            vendasCanceladas: 0,
            receitaTotal: 0,
            taxaAprovacao: 0
        };
    }

    extractErrors(results) {
        const errors = [];
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                errors.push({
                    query: index,
                    error: result.reason.message
                });
            }
        });
        return errors;
    }

    async clearCache(vendedorId) {
        if (!this.cacheEnabled) return;
        
        try {
            const pattern = `dashboard:${vendedorId}:`;
            let cleared = 0;
            
            for (const [key, value] of this.memoryCache.entries()) {
                if (key.startsWith(pattern)) {
                    this.memoryCache.delete(key);
                    cleared++;
                }
            }
            
            if (cleared > 0) {
                console.log(`✅ Cache limpo para vendedor ${vendedorId}: ${cleared} entradas removidas`);
            }
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error.message);
        }
    }
}

module.exports = new DashboardService();
