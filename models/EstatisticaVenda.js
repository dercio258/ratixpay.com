const { EstatisticaVenda: EstatisticaVendaModel } = require('../config/database');

class EstatisticaVenda {
    constructor(data = {}) {
        this.id = data.id;
        this.total_vendas = data.total_vendas || 0;
        this.vendas_aprovadas = data.vendas_aprovadas || 0;
        this.vendas_pendentes = data.vendas_pendentes || 0;
        this.vendas_canceladas = data.vendas_canceladas || 0;
        this.receita_total = data.receita_total || 0;
        this.id_transacao = data.id_transacao;
        this.valor_transacao = data.valor_transacao;
        this.status = data.status;
        this.data = data.data;
        this.hora = data.hora;
        this.observacoes = data.observacoes;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Criar uma nova estatística de venda
     * @param {Object} data - Dados da estatística
     * @returns {Promise<EstatisticaVenda>}
     */
    static async create(data) {
        try {
            const estatistica = await EstatisticaVendaModel.create({
                total_vendas: data.total_vendas || 0,
                vendas_aprovadas: data.vendas_aprovadas || 0,
                vendas_pendentes: data.vendas_pendentes || 0,
                vendas_canceladas: data.vendas_canceladas || 0,
                receita_total: data.receita_total || 0,
                id_transacao: data.id_transacao,
                valor_transacao: data.valor_transacao,
                status: data.status,
                data: data.data,
                hora: data.hora,
                observacoes: data.observacoes || null
            });

            return new EstatisticaVenda(estatistica.toJSON());
        } catch (error) {
            console.error('Erro ao criar estatística de venda:', error);
            throw error;
        }
    }

    /**
     * Registrar transação pendente
     * @param {string} idTransacao - ID da transação
     * @param {number} valor - Valor da transação
     * @returns {Promise<EstatisticaVenda>}
     */
    static async registrarTransacaoPendente(idTransacao, valor) {
        try {
            const hoje = new Date();
            const data = hoje.toLocaleDateString('pt-BR');
            const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return await this.create({
                total_vendas: 1,
                vendas_pendentes: 1,
                receita_total: valor,
                id_transacao: idTransacao,
                valor_transacao: valor,
                status: 'pendente',
                data: data,
                hora: hora
            });
        } catch (error) {
            console.error('Erro ao registrar transação pendente:', error);
            throw error;
        }
    }

    /**
     * Registrar transação aprovada
     * @param {string} idTransacao - ID da transação
     * @param {number} valor - Valor da transação
     * @returns {Promise<EstatisticaVenda>}
     */
    static async registrarTransacaoAprovada(idTransacao, valor) {
        try {
            const hoje = new Date();
            const data = hoje.toLocaleDateString('pt-BR');
            const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return await this.create({
                total_vendas: 1,
                vendas_aprovadas: 1,
                receita_total: valor,
                id_transacao: idTransacao,
                valor_transacao: valor,
                status: 'aprovado',
                data: data,
                hora: hora
            });
        } catch (error) {
            console.error('Erro ao registrar transação aprovada:', error);
            throw error;
        }
    }

    /**
     * Registrar transação cancelada
     * @param {string} idTransacao - ID da transação
     * @param {number} valor - Valor da transação
     * @param {string} motivo - Motivo do cancelamento
     * @returns {Promise<EstatisticaVenda>}
     */
    static async registrarTransacaoCancelada(idTransacao, valor, motivo = 'Cancelado pelo usuário') {
        try {
            const hoje = new Date();
            const data = hoje.toLocaleDateString('pt-BR');
            const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return await this.create({
                total_vendas: 1,
                vendas_canceladas: 1,
                receita_total: 0, // Não conta para receita
                id_transacao: idTransacao,
                valor_transacao: valor,
                status: 'cancelado',
                data: data,
                hora: hora,
                observacoes: motivo
            });
        } catch (error) {
            console.error('Erro ao registrar transação cancelada:', error);
            throw error;
        }
    }

    /**
     * Registrar erro de transação
     * @param {string} idTransacao - ID da transação
     * @param {number} valor - Valor da transação
     * @param {string} erro - Descrição do erro
     * @param {string} tipo - Tipo do erro
     * @returns {Promise<EstatisticaVenda>}
     */
    static async registrarErroTransacao(idTransacao, valor, erro, tipo = 'erro_pagamento') {
        try {
            const hoje = new Date();
            const data = hoje.toLocaleDateString('pt-BR');
            const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return await this.create({
                total_vendas: 1,
                vendas_canceladas: 1,
                receita_total: 0,
                id_transacao: idTransacao,
                valor_transacao: valor,
                status: 'cancelado',
                data: data,
                hora: hora,
                observacoes: `[${tipo}] ${erro}`
            });
        } catch (error) {
            console.error('Erro ao registrar erro de transação:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas recentes
     * @returns {Promise<Object>}
     */
    static async obterEstatisticasRecentes() {
        try {
            const estatisticas = await EstatisticaVendaModel.findAll({
                order: [['created_at', 'DESC']],
                limit: 1
            });

            if (estatisticas.length === 0) {
            return {
                total_vendas: 0,
                vendas_aprovadas: 0,
                vendas_pendentes: 0,
                vendas_canceladas: 0,
                receita_total: 0
            };
        }

            const ultima = estatisticas[0].toJSON();
            return {
                total_vendas: ultima.total_vendas,
                vendas_aprovadas: ultima.vendas_aprovadas,
                vendas_pendentes: ultima.vendas_pendentes,
                vendas_canceladas: ultima.vendas_canceladas,
                receita_total: ultima.receita_total
            };
        } catch (error) {
            console.error('Erro ao obter estatísticas recentes:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas por período
     * @param {string} dataInicio - Data de início (DD/MM/YYYY)
     * @param {string} dataFim - Data de fim (DD/MM/YYYY)
     * @returns {Promise<Object>}
     */
    static async obterEstatisticasPorPeriodo(dataInicio, dataFim) {
        try {
            
            const inicio = this.converterDataParaSQLite(dataInicio);
            const fim = this.converterDataParaSQLite(dataFim);

            const estatisticas = await EstatisticaVendaModel.findAll({
                where: {
                    created_at: {
                        [require('sequelize').Op.between]: [inicio, fim]
                    }
                },
                order: [['created_at', 'DESC']]
            });

            // Calcular totais
            const totais = estatisticas.reduce((acc, estat) => {
                const dados = estat.toJSON();
                acc.total_vendas += dados.total_vendas || 0;
                acc.vendas_aprovadas += dados.vendas_aprovadas || 0;
                acc.vendas_pendentes += dados.vendas_pendentes || 0;
                acc.vendas_canceladas += dados.vendas_canceladas || 0;
                acc.receita_total += parseFloat(dados.receita_total || 0);
                return acc;
            }, {
                total_vendas: 0,
                vendas_aprovadas: 0,
                vendas_pendentes: 0,
                vendas_canceladas: 0,
                receita_total: 0
            });

            return totais;
        } catch (error) {
            console.error('Erro ao obter estatísticas por período:', error);
            throw error;
        }
    }

    /**
     * Obter erros de transação
     * @returns {Promise<Array>}
     */
    static async obterErrosTransacao() {
        try {
            const erros = await EstatisticaVendaModel.findAll({
                where: {
                    status: 'cancelado',
                    observacoes: {
                        [require('sequelize').Op.not]: null
                    }
                },
                order: [['created_at', 'DESC']],
                limit: 10
            });

            return erros.map(erro => {
                const dados = erro.toJSON();
                return {
                    id: dados.id,
                    id_transacao: dados.id_transacao,
                    valor: dados.valor_transacao,
                    data: dados.data,
                    hora: dados.hora,
                    mensagem: dados.observacoes || ''
                };
            });
        } catch (error) {
            console.error('Erro ao obter erros de transação:', error);
            throw error;
        }
    }

    /**
     * Converter data do formato brasileiro para SQLite
     * @param {string} dataBR - Data no formato DD/MM/YYYY
     * @returns {string} Data no formato YYYY-MM-DD
     */
    static converterDataParaSQLite(dataBR) {
        if (!dataBR) return null;
        
        const partes = dataBR.split('/');
        if (partes.length !== 3) return null;
        
        const [dia, mes, ano] = partes;
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    /**
     * Obter dados para gráfico de vendas
     * @param {number} dias - Número de dias para buscar
     * @returns {Promise<Array>}
     */
    static async obterDadosGrafico(dias = 7) {
        try {
            const { Venda } = require('../config/database');
            const { Op } = require('sequelize');
            
            const dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - dias);
            
            // Buscar vendas dos últimos X dias
            const vendas = await Venda.findAll({
                where: {
                    created_at: {
                        [Op.gte]: dataInicio
                    }
                },
                order: [['created_at', 'ASC']]
            });

            // Agrupar por dia
            const dadosPorDia = {};
            const hoje = new Date();
            
            // Inicializar todos os dias com zero
            for (let i = 0; i < dias; i++) {
                const data = new Date(hoje);
                data.setDate(data.getDate() - i);
                const dataStr = data.toISOString().split('T')[0];
                dadosPorDia[dataStr] = {
                    data: dataStr,
                    vendas: 0,
                    receita: 0
                };
            }

            // Preencher com dados reais
            vendas.forEach(venda => {
                const dataVenda = new Date(venda.created_at);
                const dataStr = dataVenda.toISOString().split('T')[0];
                
                if (dadosPorDia[dataStr]) {
                    dadosPorDia[dataStr].vendas += 1;
                    if (venda.status === 'Pago') {
                        dadosPorDia[dataStr].receita += parseFloat(venda.pagamento_valor || 0);
                    }
                }
            });

            // Converter para array e ordenar
            return Object.values(dadosPorDia).sort((a, b) => a.data.localeCompare(b.data));
        } catch (error) {
            console.error('Erro ao obter dados do gráfico:', error);
            throw error;
        }
    }

    /**
     * Atualizar estatísticas baseadas nas vendas reais
     * @returns {Promise<void>}
     */
    static async atualizarEstatisticasReais() {
        try {
            const { Venda } = require('../config/database');
            
            // Contar vendas por status
            const totalVendas = await Venda.count();
            const vendasAprovadas = await Venda.count({ where: { status: 'Pago' } });
            const vendasPendentes = await Venda.count({ where: { status: 'Aguardando Pagamento' } });
            const vendasCanceladas = await Venda.count({ where: { status: 'Cancelado' } });
            
            // Calcular receita total (apenas vendas pagas)
            const vendasPagas = await Venda.findAll({
                where: { status: 'Pago' },
                attributes: ['pagamento_valor']
            });
            
            const receitaTotal = vendasPagas.reduce((total, venda) => {
                return total + parseFloat(venda.pagamento_valor || 0);
            }, 0);

            // Criar nova estatística consolidada
            await this.create({
                total_vendas: totalVendas,
                vendas_aprovadas: vendasAprovadas,
                vendas_pendentes: vendasPendentes,
                vendas_canceladas: vendasCanceladas,
                receita_total: receitaTotal,
                id_transacao: 'CONSOLIDADO',
                valor_transacao: 0,
                status: 'consolidado',
                data: new Date().toLocaleDateString('pt-BR'),
                hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                observacoes: 'Estatísticas consolidadas das vendas reais'
            });

            console.log('✅ Estatísticas reais atualizadas com sucesso');
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas reais:', error);
            throw error;
        }
    }
}

module.exports = EstatisticaVenda;