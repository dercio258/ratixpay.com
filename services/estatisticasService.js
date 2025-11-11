const { Venda, Produto, Pagamento, Usuario, EstatisticasVendedor, HistoricoSaques } = require('../config/database');
const { Op } = require('sequelize');

class EstatisticasService {
    
    /**
     * Atualiza as estatísticas de um vendedor específico
     */
    static async atualizarEstatisticasVendedor(vendedorId) {
        try {
            console.log(`🔄 Atualizando estatísticas do vendedor ${vendedorId}...`);
            
            // Buscar vendas do vendedor
            const vendas = await Venda.findAll({
                where: { vendedor_id: vendedorId },
                attributes: ['status', 'valor']
            });
            
            // Calcular estatísticas de vendas
            const vendasAprovadas = vendas.filter(v => v.status === 'Pago');
            const vendasPendentes = vendas.filter(v => v.status === 'Pendente');
            const vendasCanceladas = vendas.filter(v => v.status === 'Cancelada');
            
            // Calcular receita total do vendedor (90% das vendas aprovadas)
            // O valor já é 90% do valor original, então usamos diretamente
            const receitaTotal = vendasAprovadas.reduce((total, v) => total + parseFloat(v.valor || 0), 0);
            const totalVendas = vendasAprovadas.length + vendasPendentes.length + vendasCanceladas.length;
            
            // Buscar saques do vendedor
            const saques = await Pagamento.findAll({
                where: { vendedor_id: vendedorId },
                attributes: ['status', 'valor']
            });
            
            // Calcular estatísticas de saques
            const saquesPendentes = saques.filter(s => ['pendente', 'aprovado'].includes(s.status));
            const saquesPagos = saques.filter(s => s.status === 'pago');
            const saquesCancelados = saques.filter(s => s.status === 'cancelado');
            
            const valorTotalSaques = saques.reduce((total, s) => total + parseFloat(s.valor || 0), 0);
            const valorSaquesPendentes = saquesPendentes.reduce((total, s) => total + parseFloat(s.valor || 0), 0);
            const valorSaquesPagos = saquesPagos.reduce((total, s) => total + parseFloat(s.valor || 0), 0);
            
            // Calcular receita disponível (receita total - saques pendentes e aprovados)
            const receitaDisponivel = Math.max(0, receitaTotal - valorSaquesPendentes);
            
            console.log(`📊 Estatísticas do vendedor ${vendedorId}:`);
            console.log(`💰 Receita total: ${receitaTotal}`);
            console.log(`⏳ Saques pendentes: ${valorSaquesPendentes}`);
            console.log(`💳 Receita disponível: ${receitaDisponivel}`);
            
            // Contar produtos ativos
            const produtosAtivos = await Produto.count({
                where: { 
                    vendedor_id: vendedorId,
                    ativo: true
                }
            });
            
            // Contar clientes únicos
            const clientesUnicos = await Venda.count({
                where: { 
                    vendedor_id: vendedorId,
                    status: 'Pago'
                },
                distinct: true,
                col: 'cliente_email'
            });
            
            // Criar ou atualizar estatísticas
            const [estatisticas, created] = await EstatisticasVendedor.findOrCreate({
                where: { vendedor_id: vendedorId },
                defaults: {
                    vendedor_id: vendedorId,
                    receita_total: receitaTotal,
                    receita_disponivel: receitaDisponivel,
                    total_vendas: totalVendas,
                    vendas_aprovadas: vendasAprovadas.length,
                    vendas_pendentes: vendasPendentes.length,
                    vendas_canceladas: vendasCanceladas.length,
                    total_saques: saques.length,
                    saques_pendentes: saquesPendentes.length,
                    saques_aprovados: saques.filter(s => s.status === 'aprovado').length,
                    saques_pagos: saquesPagos.length,
                    saques_cancelados: saquesCancelados.length,
                    valor_total_saques: valorTotalSaques,
                    valor_saques_pendentes: valorSaquesPendentes,
                    valor_saques_pagos: valorSaquesPagos,
                    produtos_ativos: produtosAtivos,
                    clientes_unicos: clientesUnicos,
                    ultima_atualizacao: new Date()
                }
            });
            
            if (!created) {
                await estatisticas.update({
                    receita_total: receitaTotal,
                    receita_disponivel: receitaDisponivel,
                    total_vendas: totalVendas,
                    vendas_aprovadas: vendasAprovadas.length,
                    vendas_pendentes: vendasPendentes.length,
                    vendas_canceladas: vendasCanceladas.length,
                    total_saques: saques.length,
                    saques_pendentes: saquesPendentes.length,
                    saques_aprovados: saques.filter(s => s.status === 'aprovado').length,
                    saques_pagos: saquesPagos.length,
                    saques_cancelados: saquesCancelados.length,
                    valor_total_saques: valorTotalSaques,
                    valor_saques_pendentes: valorSaquesPendentes,
                    valor_saques_pagos: valorSaquesPagos,
                    produtos_ativos: produtosAtivos,
                    clientes_unicos: clientesUnicos,
                    ultima_atualizacao: new Date()
                });
            }
            
            console.log(`✅ Estatísticas do vendedor ${vendedorId} atualizadas com sucesso`);
            return estatisticas;
            
        } catch (error) {
            console.error(`❌ Erro ao atualizar estatísticas do vendedor ${vendedorId}:`, error);
            throw error;
        }
    }
    
    /**
     * Busca estatísticas de um vendedor específico
     */
    static async buscarEstatisticasVendedor(vendedorId) {
        try {
            let estatisticas = await EstatisticasVendedor.findOne({
                where: { vendedor_id: vendedorId }
            });
            
            // Se não existir, criar
            if (!estatisticas) {
                estatisticas = await this.atualizarEstatisticasVendedor(vendedorId);
            }
            
            return estatisticas;
            
        } catch (error) {
            console.error(`❌ Erro ao buscar estatísticas do vendedor ${vendedorId}:`, error);
            throw error;
        }
    }
    
    /**
     * Adiciona um registro ao histórico de saques
     */
    static async adicionarHistoricoSaque(saqueData) {
        try {
            console.log(`📝 Adicionando saque ${saqueData.id_saque} ao histórico...`);
            
            // Gerar public_id único (6 dígitos) para o histórico
            const publicId = String(Math.floor(Math.random() * 900000) + 100000);
            
            const historico = await HistoricoSaques.create({
                public_id: publicId,
                vendedor_id: saqueData.vendedor_id,
                saque_id: saqueData.id,
                id_saque: saqueData.id_saque,
                valor_solicitado: saqueData.valor,
                valor_liquido: saqueData.valor_liquido,
                taxa: saqueData.taxa,
                nome_titular: saqueData.nome_titular,
                telefone_titular: saqueData.telefone_titular,
                metodo_pagamento: saqueData.metodo_pagamento,
                status: saqueData.status,
                data_solicitacao: saqueData.data_solicitacao,
                data_aprovacao: saqueData.data_aprovacao,
                data_rejeicao: saqueData.data_rejeicao,
                data_pagamento: saqueData.data_pagamento,
                motivo_rejeicao: saqueData.motivo_rejeicao,
                observacoes: saqueData.observacoes,
                processado_por: saqueData.processado_por,
                codigo_transacao: saqueData.codigo_transacao,
                ip_solicitacao: saqueData.ip_solicitacao,
                user_agent: saqueData.user_agent
            });
            
            console.log(`✅ Saque ${saqueData.id_saque} adicionado ao histórico`);
            return historico;
            
        } catch (error) {
            console.error(`❌ Erro ao adicionar saque ao histórico:`, error);
            throw error;
        }
    }
    
    /**
     * Atualiza um registro no histórico de saques
     */
    static async atualizarHistoricoSaque(saqueId, dadosAtualizados) {
        try {
            console.log(`🔄 Atualizando histórico do saque ${saqueId}...`);
            
            const historico = await HistoricoSaques.findOne({
                where: { saque_id: saqueId }
            });
            
            if (!historico) {
                throw new Error(`Histórico não encontrado para o saque ${saqueId}`);
            }
            
            await historico.update(dadosAtualizados);
            
            console.log(`✅ Histórico do saque ${saqueId} atualizado`);
            return historico;
            
        } catch (error) {
            console.error(`❌ Erro ao atualizar histórico do saque ${saqueId}:`, error);
            throw error;
        }
    }
    
    /**
     * Busca histórico de saques de um vendedor
     */
    static async buscarHistoricoSaques(vendedorId, limite = 50, pagina = 1) {
        try {
            const offset = (pagina - 1) * limite;
            
            const historico = await HistoricoSaques.findAll({
                where: { vendedor_id: vendedorId },
                order: [['data_solicitacao', 'DESC']],
                limit: limite,
                offset: offset
            });
            
            const total = await HistoricoSaques.count({
                where: { vendedor_id: vendedorId }
            });
            
            return {
                historico,
                total,
                pagina,
                limite,
                totalPaginas: Math.ceil(total / limite)
            };
            
        } catch (error) {
            console.error(`❌ Erro ao buscar histórico de saques do vendedor ${vendedorId}:`, error);
            throw error;
        }
    }
    
    /**
     * Atualiza estatísticas de todos os vendedores
     */
    static async atualizarEstatisticasTodosVendedores() {
        try {
            console.log('🔄 Atualizando estatísticas de todos os vendedores...');
            
            const vendedores = await Usuario.findAll({
                where: { role: 'vendedor' },
                attributes: ['id']
            });
            
            for (const vendedor of vendedores) {
                await this.atualizarEstatisticasVendedor(vendedor.id);
            }
            
            console.log(`✅ Estatísticas de ${vendedores.length} vendedores atualizadas`);
            
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas de todos os vendedores:', error);
            throw error;
        }
    }
    
    /**
     * Busca estatísticas resumidas para o admin
     */
    static async buscarEstatisticasAdmin() {
        try {
            const estatisticas = await EstatisticasVendedor.findAll();
            
            const resumo = {
                receitaTotal: 0,
                saquesPagos: 0,
                saquesPendentes: 0,
                vendedoresAtivos: 0,
                totalVendedores: estatisticas.length,
                saquesAprovados: 0,
                saquesCancelados: 0
            };
            
            estatisticas.forEach(estat => {
                resumo.receitaTotal += parseFloat(estat.receita_total || 0);
                resumo.saquesPagos += parseInt(estat.saques_pagos || 0);
                resumo.saquesPendentes += parseInt(estat.saques_pendentes || 0);
                resumo.saquesAprovados += parseInt(estat.saques_aprovados || 0);
                resumo.saquesCancelados += parseInt(estat.saques_cancelados || 0);
                
                if (parseFloat(estat.receita_total || 0) > 0) {
                    resumo.vendedoresAtivos++;
                }
            });
            
            return resumo;
            
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas admin:', error);
            throw error;
        }
    }
}

module.exports = EstatisticasService;
