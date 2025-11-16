/**
 * Serviço para rastrear vendas de afiliados e creditar comissões
 */

const { Afiliado, VendaAfiliado, LinkTracking, Venda, Produto, CliqueValidoAfiliado } = require('../config/database');
const { Op } = require('sequelize');
const afiliadoClickService = require('./afiliadoClickService');

class AfiliadoVendaService {
    /**
     * Processar venda de afiliado e creditar comissão
     * @param {Object} venda - Objeto da venda
     * @param {Object} produto - Objeto do produto
     * @param {number} valorTotal - Valor total da venda
     * @param {string} transactionId - ID da transação
     * @param {string} codigoAfiliado - Código do afiliado (opcional, será buscado se não fornecido)
     * @returns {Promise<Object>} Resultado do processamento
     */
    async processarVendaAfiliado(venda, produto, valorTotal, transactionId, codigoAfiliado = null) {
        try {
            console.log('🔗 Processando venda de afiliado...');
            
            // Buscar código de afiliado se não fornecido
            let codigoAfiliadoFinal = codigoAfiliado || venda.afiliado_ref || null;
            
            // Se ainda não encontrou, buscar na sessão ou URL (será passado pelo frontend)
            if (!codigoAfiliadoFinal) {
                console.log('ℹ️ Nenhum código de afiliado encontrado na venda');
                return { processado: false, motivo: 'Nenhum código de afiliado encontrado' };
            }
            
            // Buscar afiliado
            const afiliado = await Afiliado.findOne({
                where: { 
                    codigo_afiliado: codigoAfiliadoFinal,
                    status: 'ativo'
                }
            });
            
            if (!afiliado) {
                console.log('⚠️ Afiliado não encontrado ou inativo:', codigoAfiliadoFinal);
                return { processado: false, motivo: 'Afiliado não encontrado ou inativo' };
            }
            
            console.log('✅ Afiliado encontrado:', afiliado.nome, '(', afiliado.codigo_afiliado, ')');
            
            // Verificar se já existe registro de venda para este afiliado e venda (evitar duplicatas)
            const vendaAfiliadoExistente = await VendaAfiliado.findOne({
                where: {
                    afiliado_id: afiliado.id,
                    venda_id: venda.id
                }
            });
            
            if (vendaAfiliadoExistente) {
                console.log('⚠️ Venda já registrada para este afiliado');
                return { 
                    processado: true, 
                    jaExistia: true,
                    vendaAfiliado: vendaAfiliadoExistente
                };
            }
            
            // Calcular comissão
            const valorComissao = (valorTotal * afiliado.comissao_percentual) / 100;
            
            // Buscar link tracking específico do produto e afiliado
            let linkTracking = null;
            if (produto && produto.id) {
                linkTracking = await LinkTracking.findOne({
                    where: {
                        afiliado_id: afiliado.id,
                        produto_id: produto.id
                    }
                });
            }
            
            // Salvar código do afiliado na venda
            await venda.update({
                afiliado_ref: codigoAfiliadoFinal
            });
            
            // Criar registro de venda do afiliado
            const vendaAfiliado = await VendaAfiliado.create({
                afiliado_id: afiliado.id,
                venda_id: venda.id,
                valor_venda: valorTotal,
                comissao_percentual: afiliado.comissao_percentual,
                valor_comissao: valorComissao,
                status: 'pendente'
            });
            
            // Atualizar estatísticas do afiliado
            await afiliado.increment('total_vendas');
            await afiliado.increment('total_comissoes', { by: valorComissao });
            await afiliado.increment('saldo_disponivel', { by: valorComissao });
            await afiliado.update({
                ultima_atividade: new Date()
            });
            
            // Atualizar conversões no link tracking específico
            if (linkTracking) {
                await linkTracking.increment('conversoes');
                console.log(`✅ Conversão registrada no link tracking: ${linkTracking.id}`);
            } else {
                // Incrementar conversões em todos os links do afiliado (fallback)
                await LinkTracking.increment('conversoes', {
                    where: { afiliado_id: afiliado.id }
                });
                console.log('✅ Conversão registrada em todos os links do afiliado (link específico não encontrado)');
            }
            
            // Marcar clique válido como convertido (se houver)
            if (linkTracking) {
                await this.marcarCliqueValidoComoConvertido(afiliado.id, produto.id, venda.id);
            }
            
            console.log(`✅ Venda de afiliado processada: ${afiliado.nome} - Comissão: MZN ${valorComissao.toFixed(2)}`);
            
            return {
                processado: true,
                vendaAfiliado: vendaAfiliado,
                afiliado: {
                    id: afiliado.id,
                    nome: afiliado.nome,
                    codigo: afiliado.codigo_afiliado
                },
                comissao: valorComissao,
                linkTracking: linkTracking ? {
                    id: linkTracking.id,
                    produto_id: linkTracking.produto_id
                } : null
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar venda de afiliado:', error);
            throw error;
        }
    }
    
    /**
     * Marcar clique válido como convertido (quando uma venda é realizada)
     */
    async marcarCliqueValidoComoConvertido(afiliadoId, produtoId, vendaId) {
        try {
            // Buscar clique válido mais recente do afiliado para este produto
            const cliqueValido = await CliqueValidoAfiliado.findOne({
                where: {
                    afiliado_id: afiliadoId,
                    produto_id: produtoId,
                    valido: true
                },
                order: [['created_at', 'DESC']]
            });
            
            if (cliqueValido) {
                // Podemos adicionar um campo para rastrear conversões se necessário
                // Por enquanto, apenas logamos
                console.log(`✅ Clique válido ${cliqueValido.id} associado à venda ${vendaId}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao marcar clique válido como convertido:', error);
            // Não falhar o processo por erro aqui
        }
    }
    
    /**
     * Atualizar status da venda de afiliado (quando pagamento é aprovado/cancelado)
     */
    async atualizarStatusVenda(vendaId, status) {
        try {
            const vendaAfiliado = await VendaAfiliado.findOne({
                where: { venda_id: vendaId },
                include: [{
                    model: Afiliado,
                    as: 'afiliado',
                    attributes: ['id', 'nome', 'codigo_afiliado', 'saldo_disponivel']
                }]
            });
            
            if (!vendaAfiliado) {
                return { atualizado: false, motivo: 'Venda de afiliado não encontrada' };
            }
            
            const statusAnterior = vendaAfiliado.status;
            
            // Atualizar status
            await vendaAfiliado.update({ status });
            
            // Se a venda foi aprovada e estava pendente, garantir que comissão está creditada
            if (status === 'pago' && statusAnterior === 'pendente') {
                const afiliado = vendaAfiliado.afiliado;
                
                // Verificar se comissão já foi creditada (pode ter sido creditada no processamento inicial)
                // Se não foi, creditar agora
                const saldoAtual = parseFloat(afiliado.saldo_disponivel || 0);
                const comissaoEsperada = parseFloat(vendaAfiliado.valor_comissao || 0);
                
                // Se o saldo não inclui a comissão, creditar
                // (Isso é uma verificação de segurança, normalmente já está creditado)
                await afiliado.reload();
                const novoSaldo = parseFloat(afiliado.saldo_disponivel || 0);
                
                if (novoSaldo < saldoAtual + comissaoEsperada) {
                    await afiliado.increment('saldo_disponivel', { by: comissaoEsperada });
                    console.log(`💰 Comissão creditada no status update: MZN ${comissaoEsperada.toFixed(2)}`);
                }

                // Revalidar cliques após conversão aprovada
                // Verificar se há lotes de cliques que agora podem ser validados
                try {
                    const venda = await Venda.findByPk(vendaAfiliado.venda_id);
                    if (venda && venda.produto_id) {
                        await afiliadoClickService.revalidarCliquesAposConversao(
                            afiliado.id,
                            venda.produto_id
                        );
                    }
                } catch (error) {
                    console.error('⚠️ Erro ao revalidar cliques após conversão (não crítico):', error);
                    // Não falhar o processo por erro na revalidação de cliques
                }
            }
            
            // Se a venda foi cancelada e estava paga, reverter comissão
            if (status === 'cancelado' && statusAnterior === 'pago') {
                const afiliado = vendaAfiliado.afiliado;
                const comissao = parseFloat(vendaAfiliado.valor_comissao || 0);
                
                await afiliado.decrement('saldo_disponivel', { by: comissao });
                await afiliado.decrement('total_comissoes', { by: comissao });
                await afiliado.decrement('total_vendas');
                
                console.log(`⚠️ Comissão revertida devido ao cancelamento: MZN ${comissao.toFixed(2)}`);
            }
            
            return {
                atualizado: true,
                vendaAfiliado: vendaAfiliado,
                statusAnterior,
                statusNovo: status
            };
            
        } catch (error) {
            console.error('❌ Erro ao atualizar status da venda de afiliado:', error);
            throw error;
        }
    }
    
    /**
     * Obter estatísticas de vendas de um afiliado
     */
    async obterEstatisticasVendas(afiliadoId, periodo = '30d') {
        try {
            const afiliado = await Afiliado.findByPk(afiliadoId);
            if (!afiliado) {
                throw new Error('Afiliado não encontrado');
            }
            
            // Calcular data inicial baseado no período
            const dataInicial = new Date();
            if (periodo === '7d') {
                dataInicial.setDate(dataInicial.getDate() - 7);
            } else if (periodo === '30d') {
                dataInicial.setDate(dataInicial.getDate() - 30);
            } else if (periodo === '90d') {
                dataInicial.setDate(dataInicial.getDate() - 90);
            } else {
                dataInicial.setFullYear(dataInicial.getFullYear() - 1); // 1 ano
            }
            
            // Buscar vendas do período
            const vendas = await VendaAfiliado.findAll({
                where: {
                    afiliado_id: afiliadoId,
                    created_at: {
                        [Op.gte]: dataInicial
                    }
                },
                include: [{
                    model: Venda,
                    as: 'venda',
                    attributes: ['id', 'public_id', 'status', 'created_at']
                }],
                order: [['created_at', 'DESC']]
            });
            
            const totalVendas = vendas.length;
            const vendasAprovadas = vendas.filter(v => v.status === 'pago').length;
            const totalComissoes = vendas
                .filter(v => v.status === 'pago')
                .reduce((sum, v) => sum + parseFloat(v.valor_comissao || 0), 0);
            
            const totalValorVendas = vendas
                .filter(v => v.status === 'pago')
                .reduce((sum, v) => sum + parseFloat(v.valor_venda || 0), 0);
            
            return {
                periodo,
                totalVendas,
                vendasAprovadas,
                vendasPendentes: vendas.filter(v => v.status === 'pendente').length,
                vendasCanceladas: vendas.filter(v => v.status === 'cancelado').length,
                totalComissoes,
                totalValorVendas,
                taxaConversao: totalVendas > 0 ? ((vendasAprovadas / totalVendas) * 100).toFixed(2) : '0.00',
                vendas: vendas.map(v => ({
                    id: v.id,
                    venda_id: v.venda_id,
                    public_id: v.venda?.public_id,
                    valor_venda: parseFloat(v.valor_venda),
                    valor_comissao: parseFloat(v.valor_comissao),
                    status: v.status,
                    data: v.created_at
                }))
            };
            
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de vendas:', error);
            throw error;
        }
    }
}

module.exports = new AfiliadoVendaService();

