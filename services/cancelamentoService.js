const { Venda } = require('../config/database');

class CancelamentoService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.activeTransactions = new Set(); // Rastrear transações ativas
        this.lastCheckTime = null;
    }

    /**
     * Inicia o serviço de cancelamento automático apenas quando necessário
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Serviço de cancelamento já está rodando');
            return;
        }

        console.log('🔄 Iniciando serviço de cancelamento automático de vendas pendentes...');
        
        // Executar a cada 30 segundos
        this.intervalId = setInterval(() => {
            this.cancelarVendasPendentes();
        }, 30000); // 30 segundos

        this.isRunning = true;
        console.log('✅ Serviço de cancelamento automático iniciado');
    }

    /**
     * Inicia o serviço apenas se houver transações ativas
     */
    startIfNeeded() {
        if (this.activeTransactions.size > 0 && !this.isRunning) {
            console.log(`🔄 Iniciando serviço de cancelamento - ${this.activeTransactions.size} transações ativas`);
            this.start();
        }
    }

    /**
     * Para o serviço de cancelamento automático
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🛑 Serviço de cancelamento automático parado');
    }

    /**
     * Registra uma transação como ativa e inicia o serviço se necessário
     */
    registrarTransacaoAtiva(transactionId) {
        this.activeTransactions.add(transactionId);
        console.log(`📝 Transação ${transactionId} registrada como ativa`);
        
        // Iniciar o serviço se não estiver rodando
        this.startIfNeeded();
    }

    /**
     * Remove uma transação das ativas e para o serviço se não há mais transações
     */
    removerTransacaoAtiva(transactionId) {
        this.activeTransactions.delete(transactionId);
        console.log(`📝 Transação ${transactionId} removida das ativas`);
        
        // Se não há mais transações ativas, parar o serviço
        if (this.activeTransactions.size === 0 && this.isRunning) {
            console.log('🛑 Parando serviço de cancelamento - nenhuma transação ativa');
            this.stop();
        }
    }

    /**
     * Cancela vendas pendentes há mais de 5 minutos
     * Só executa se houver transações ativas ou se for a primeira verificação
     */
    async cancelarVendasPendentes() {
        try {
            // Se não há transações ativas e já foi verificado antes, pular
            if (this.activeTransactions.size === 0 && this.lastCheckTime) {
                const tempoDesdeUltimaVerificacao = Date.now() - this.lastCheckTime;
                // Só verificar a cada 5 minutos se não há transações ativas
                if (tempoDesdeUltimaVerificacao < 5 * 60 * 1000) {
                    return;
                }
            }

            this.lastCheckTime = Date.now();
            const agora = new Date();
            const cincoMinutosAtras = new Date(agora.getTime() - (5 * 60 * 1000)); // 5 minutos atrás

            if (isCancelamentoDebug) {
                console.log('🔍 Verificando vendas pendentes para cancelamento...');
            }

            // Buscar vendas pendentes há mais de 5 minutos
            const vendasPendentes = await Venda.findAll({
                where: {
                    status: 'Pendente',
                    created_at: {
                        [require('sequelize').Op.lt]: cincoMinutosAtras
                    }
                }
            });

            if (vendasPendentes.length === 0) {
                console.log('✅ Nenhuma venda pendente para cancelar');
                
                // Se não há transações ativas e não há vendas pendentes, parar o serviço
                if (this.activeTransactions.size === 0) {
                    console.log('🛑 Parando serviço de cancelamento - nenhuma transação ativa ou venda pendente');
                    this.stop();
                }
                return;
            }

            console.log(`🔄 Encontradas ${vendasPendentes.length} vendas pendentes para cancelar`);

            // Cancelar cada venda
            for (const venda of vendasPendentes) {
                await this.cancelarVenda(venda);
                // Remover da lista de transações ativas se estiver lá
                this.removerTransacaoAtiva(venda.referencia_pagamento);
            }

            console.log(`✅ ${vendasPendentes.length} vendas canceladas automaticamente`);

        } catch (error) {
            console.error('❌ Erro ao cancelar vendas pendentes:', error);
        }
    }

    /**
     * Cancela uma venda específica
     */
    async cancelarVenda(venda) {
        try {
            const motivo = 'Venda cancelada automaticamente após 5 minutos sem pagamento';
            const falhaId = `AUTO-CANCEL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

            await venda.update({
                status: 'Cancelada',
                falha_motivo: motivo,
                falha_data: new Date().toISOString(),
                falha_id: falhaId,
                pagamento_data_processamento: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            console.log(`✅ Venda ${venda.public_id} cancelada automaticamente`);

            // Log detalhado para auditoria
            console.log(`📋 Detalhes do cancelamento:`, {
                venda_id: venda.id,
                public_id: venda.public_id,
                cliente: venda.cliente_nome,
                valor: venda.pagamento_valor,
                motivo: motivo,
                falha_id: falhaId
            });

        } catch (error) {
            console.error(`❌ Erro ao cancelar venda ${venda.public_id}:`, error);
        }
    }

    /**
     * Cancela uma venda automaticamente por timeout ou erro de conexão E2Payment
     */
    async cancelarVendaPorTimeout(venda, motivo, tipoErro = 'timeout') {
        try {
            const falhaId = `${tipoErro.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

            await venda.update({
                status: 'Cancelada',
                falha_motivo: motivo,
                falha_data: new Date().toISOString(),
                falha_id: falhaId,
                pagamento_data_processamento: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            // Remover da lista de transações ativas
            this.removerTransacaoAtiva(venda.pagamento_transacao_id);

            console.log(`✅ Venda ${venda.public_id} cancelada automaticamente por ${tipoErro}`);

            // Log detalhado para auditoria
            console.log(`📋 Detalhes do cancelamento automático:`, {
                venda_id: venda.id,
                public_id: venda.public_id,
                cliente: venda.cliente_nome,
                valor: venda.pagamento_valor,
                motivo: motivo,
                tipo_erro: tipoErro,
                falha_id: falhaId
            });

            // Notificar frontend em tempo real sobre o cancelamento
            if (global.emitUpdate) {
                global.emitUpdate(`venda_${venda.id}`, 'payment_cancelled', {
                    vendaId: venda.id,
                    publicId: venda.public_id,
                    motivo: motivo,
                    tipoErro: tipoErro,
                    timestamp: new Date().toISOString()
                });
            }

            return true;
        } catch (error) {
            console.error(`❌ Erro ao cancelar venda ${venda.public_id} por ${tipoErro}:`, error);
            return false;
        }
    }

    /**
     * Cancela uma venda específica por ID
     */
    async cancelarVendaPorId(vendaId, motivo = 'Cancelamento manual') {
        try {
            const venda = await Venda.findByPk(vendaId);
            
            if (!venda) {
                throw new Error('Venda não encontrada');
            }

            if (venda.status !== 'Pendente') {
                throw new Error('Venda não está pendente');
            }

            await this.cancelarVenda(venda);
            return { success: true, message: 'Venda cancelada com sucesso' };

        } catch (error) {
            console.error('❌ Erro ao cancelar venda por ID:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtém estatísticas de cancelamentos
     */
    async getEstatisticasCancelamento() {
        try {
            const agora = new Date();
            const ultimas24h = new Date(agora.getTime() - (24 * 60 * 60 * 1000));

            const cancelamentos = await Venda.findAll({
                where: {
                    status: 'Cancelada',
                    falha_data: {
                        [require('sequelize').Op.gte]: ultimas24h
                    }
                },
                attributes: [
                    'falha_motivo',
                    [require('sequelize').fn('COUNT', '*'), 'total']
                ],
                group: ['falha_motivo']
            });

            return {
                total_cancelamentos_24h: cancelamentos.reduce((sum, item) => sum + parseInt(item.dataValues.total), 0),
                por_motivo: cancelamentos.map(item => ({
                    motivo: item.falha_motivo,
                    total: parseInt(item.dataValues.total)
                }))
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de cancelamento:', error);
            return null;
        }
    }
}

// Instância singleton
const cancelamentoService = new CancelamentoService();
const isCancelamentoDebug = process.env.CANCELAMENTO_DEBUG === 'true';

module.exports = cancelamentoService;
