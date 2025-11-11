/**
 * Serviço para processar cliques válidos de afiliados e gerar créditos
 * Sistema: 10 cliques válidos = 1 MZN (reinicia contagem após crédito)
 */

const { Afiliado, LinkTracking, CliqueValidoAfiliado } = require('../config/database');
const { Op } = require('sequelize');

class AfiliadoClickService {
    constructor() {
        this.CLICKS_POR_CREDITO = 10; // 10 cliques = 1 MZN
        this.VALOR_CREDITO = 1.00; // 1 MZN por 10 cliques
    }

    /**
     * Processar clique válido e gerar créditos se necessário
     * @param {string} linkTrackingId - ID do link tracking
     * @param {string} afiliadoId - ID do afiliado
     * @param {string} produtoId - ID do produto
     * @param {Object} dadosFraude - Dados de fraude (ip, userAgent, etc)
     * @returns {Promise<Object>} Resultado do processamento
     */
    async processarCliqueValido(linkTrackingId, afiliadoId, produtoId, dadosFraude) {
        try {
            // Buscar link tracking
            const linkTracking = await LinkTracking.findByPk(linkTrackingId);
            if (!linkTracking) {
                throw new Error('Link tracking não encontrado');
            }

            // Buscar afiliado
            const afiliado = await Afiliado.findByPk(afiliadoId);
            if (!afiliado || afiliado.status !== 'ativo') {
                throw new Error('Afiliado não encontrado ou inativo');
            }

            // Criar registro de clique válido
            const cliqueValido = await CliqueValidoAfiliado.create({
                afiliado_id: afiliadoId,
                link_tracking_id: linkTrackingId,
                produto_id: produtoId,
                ip_address: dadosFraude.ipAddress,
                user_agent: dadosFraude.userAgent,
                navegador: dadosFraude.navegador,
                sistema_operacional: dadosFraude.sistema,
                dispositivo: dadosFraude.dispositivo,
                fingerprint: dadosFraude.fingerprint,
                valido: dadosFraude.valido,
                motivo_rejeicao: dadosFraude.motivoRejeicao || null,
                referer: dadosFraude.referer || null,
                session_id: dadosFraude.sessionId || null
            });

            // Se o clique não é válido, apenas registrar e retornar
            if (!dadosFraude.valido) {
                console.log(`⚠️ Clique inválido registrado para afiliado ${afiliado.nome}: ${dadosFraude.motivoRejeicao}`);
                return {
                    cliqueRegistrado: true,
                    valido: false,
                    motivo: dadosFraude.motivoRejeicao
                };
            }

            // Incrementar cliques válidos
            await linkTracking.increment('cliques');
            await linkTracking.update({
                ultimo_clique: new Date()
            });

            // Atualizar total de cliques do afiliado
            await afiliado.increment('total_cliques');
            await afiliado.update({
                ultima_atividade: new Date()
            });

            // Recarregar dados atualizados
            await linkTracking.reload();
            await afiliado.reload();

            // Contar cliques válidos não pagos (apenas cliques válidos)
            const cliquesValidosNaoPagos = linkTracking.cliques - linkTracking.cliques_pagos;
            
            // Verificar se atingiu múltiplo de 10
            if (cliquesValidosNaoPagos >= this.CLICKS_POR_CREDITO) {
                const creditosGerar = Math.floor(cliquesValidosNaoPagos / this.CLICKS_POR_CREDITO);
                const valorCredito = creditosGerar * this.VALOR_CREDITO;
                const cliquesParaPagar = creditosGerar * this.CLICKS_POR_CREDITO;

                // Atualizar link tracking (marcar cliques como pagos e reiniciar contagem)
                await linkTracking.update({
                    cliques_pagos: linkTracking.cliques_pagos + cliquesParaPagar,
                    creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0) + valorCredito
                });

                // Atualizar afiliado
                await afiliado.update({
                    cliques_pagos: afiliado.cliques_pagos + cliquesParaPagar,
                    creditos_cliques: parseFloat(afiliado.creditos_cliques || 0) + valorCredito,
                    saldo_disponivel: parseFloat(afiliado.saldo_disponivel || 0) + valorCredito
                });

                await afiliado.reload();

                console.log(`💰 Crédito gerado para afiliado ${afiliado.nome}: ${valorCredito} MZN (${cliquesParaPagar} cliques válidos). Contagem reiniciada.`);

                return {
                    cliqueRegistrado: true,
                    valido: true,
                    creditosGerados: true,
                    valorCredito: valorCredito,
                    cliquesPagos: cliquesParaPagar,
                    cliquesRestantes: 0, // Reiniciado
                    saldoAtual: parseFloat(afiliado.saldo_disponivel)
                };
            }

            // Ainda não atingiu 10 cliques válidos
            const cliquesRestantes = this.CLICKS_POR_CREDITO - (cliquesValidosNaoPagos % this.CLICKS_POR_CREDITO);

            return {
                cliqueRegistrado: true,
                valido: true,
                creditosGerados: false,
                cliquesRestantes: cliquesRestantes,
                cliquesAtuais: cliquesValidosNaoPagos
            };

        } catch (error) {
            console.error('❌ Erro ao processar clique válido:', error);
            throw error;
        }
    }

    /**
     * Processar múltiplos cliques (útil para processamento em lote)
     * @param {string} linkTrackingId - ID do link tracking
     * @param {number} quantidade - Quantidade de cliques
     */
    async processarMultiplosCliques(linkTrackingId, quantidade) {
        try {
            const linkTracking = await LinkTracking.findByPk(linkTrackingId);
            if (!linkTracking) {
                throw new Error('Link tracking não encontrado');
            }

            const afiliado = await Afiliado.findByPk(linkTracking.afiliado_id);
            if (!afiliado || afiliado.status !== 'ativo') {
                throw new Error('Afiliado não encontrado ou inativo');
            }

            // Incrementar cliques
            await linkTracking.increment('cliques', { by: quantidade });
            await afiliado.increment('total_cliques', { by: quantidade });

            // Calcular créditos
            const cliquesNaoPagos = linkTracking.cliques + quantidade - linkTracking.cliques_pagos;
            const creditosGerar = Math.floor(cliquesNaoPagos / this.CLICKS_POR_CREDITO);
            
            if (creditosGerar > 0) {
                const valorCredito = creditosGerar * this.VALOR_CREDITO;
                const cliquesParaPagar = creditosGerar * this.CLICKS_POR_CREDITO;

                await linkTracking.increment('cliques_pagos', { by: cliquesParaPagar });
                await linkTracking.increment('creditos_gerados', { by: valorCredito });

                await afiliado.increment('cliques_pagos', { by: cliquesParaPagar });
                await afiliado.increment('creditos_cliques', { by: valorCredito });
                await afiliado.increment('saldo_disponivel', { by: valorCredito });

                console.log(`💰 Créditos gerados: ${valorCredito} MZN para ${afiliado.nome}`);
            }

            return {
                cliquesProcessados: quantidade,
                creditosGerados: creditosGerar * this.VALOR_CREDITO
            };

        } catch (error) {
            console.error('❌ Erro ao processar múltiplos cliques:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de cliques de um afiliado
     * @param {string} afiliadoId - ID do afiliado
     */
    async obterEstatisticasCliques(afiliadoId) {
        try {
            const afiliado = await Afiliado.findByPk(afiliadoId);
            if (!afiliado) {
                throw new Error('Afiliado não encontrado');
            }

            const links = await LinkTracking.findAll({
                where: { afiliado_id: afiliadoId }
            });

            const totalCliques = links.reduce((sum, link) => sum + link.cliques, 0);
            const totalCliquesPagos = links.reduce((sum, link) => sum + link.cliques_pagos, 0);
            const totalCreditos = links.reduce((sum, link) => sum + parseFloat(link.creditos_gerados), 0);
            const cliquesPendentes = totalCliques - totalCliquesPagos;
            const creditosPendentes = Math.floor(cliquesPendentes / this.CLICKS_POR_CREDITO) * this.VALOR_CREDITO;

            return {
                totalCliques: totalCliques,
                totalCliquesPagos: totalCliquesPagos,
                cliquesPendentes: cliquesPendentes,
                creditosGerados: totalCreditos,
                creditosPendentes: creditosPendentes,
                cliquesParaProximoCredito: this.CLICKS_POR_CREDITO - (cliquesPendentes % this.CLICKS_POR_CREDITO),
                links: links.map(link => ({
                    produto_id: link.produto_id,
                    cliques: link.cliques,
                    cliques_pagos: link.cliques_pagos,
                    creditos_gerados: parseFloat(link.creditos_gerados),
                    ultimo_clique: link.ultimo_clique
                }))
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }
}

module.exports = new AfiliadoClickService();

