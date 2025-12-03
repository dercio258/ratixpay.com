/**
 * Serviço Melhorado para processar cliques válidos de afiliados e gerar créditos
 * Sistema: 10 cliques válidos = 1 MZN (reinicia contagem após crédito)
 * REGRA: A cada 10 cliques, deve haver NO MÍNIMO 2 vendas aprovadas (conversões)
 * Se não houver 2 conversões, os cliques são invalidados e NÃO geram crédito
 * Melhorias: Transações atômicas, validações robustas, logs detalhados
 */

const { Afiliado, LinkTracking, CliqueValidoAfiliado, VendaAfiliado, sequelize } = require('../config/database');
const { Op } = require('sequelize');

class AfiliadoClickService {
    constructor() {
        this.CLICKS_POR_CREDITO = 10; // 10 cliques = 1 MZN
        this.VALOR_CREDITO = 1.00; // 1 MZN por 10 cliques
        this.TIMEOUT_DUPLICADO = 60000; // 60 segundos para considerar clique duplicado
        this.MIN_VENDAS_150MZN = 2; // Mínimo 2 vendas de 150MZN para converter cliques
        this.VALOR_MINIMO_VENDA = 150.00; // Valor mínimo de venda para qualificar (150MZN)
    }

    /**
     * Verificar conversões associadas aos cliques válidos de um lote específico
     * @param {number} afiliadoId - ID do afiliado
     * @param {number} produtoId - ID do produto
     * @param {Date} dataInicio - Data de início do lote
     * @param {Date} dataFim - Data de fim do lote
     * @param {Object} transaction - Transação do Sequelize
     * @returns {Promise<number>} Número de conversões no período
     */
    async contarConversoesNoPeriodo(afiliadoId, produtoId, dataInicio, dataFim, transaction) {
        try {
            const Venda = require('../config/database').Venda;
            
            // Buscar vendas aprovadas do afiliado para este produto no período
            const conversoes = await VendaAfiliado.count({
                where: {
                    afiliado_id: afiliadoId,
                    status: 'pago',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                include: [{
                    model: Venda,
                    as: 'venda',
                    where: {
                        produto_id: produtoId
                    },
                    required: true
                }],
                transaction
            });

            return conversoes;
        } catch (error) {
            console.error('❌ Erro ao contar conversões:', error);
            return 0; // Em caso de erro, retornar 0 (não gerar crédito por segurança)
        }
    }

    /**
     * Invalidar cliques sem conversões suficientes
     * @param {Array} cliquesIds - IDs dos cliques a invalidar
     * @param {string} motivo - Motivo da invalidação
     * @param {Object} transaction - Transação do Sequelize
     */
    async invalidarCliques(cliquesIds, motivo, transaction) {
        try {
            if (!cliquesIds || cliquesIds.length === 0) return;

            await CliqueValidoAfiliado.update(
                {
                    valido: false,
                    motivo_rejeicao: motivo
                },
                {
                    where: {
                        id: { [Op.in]: cliquesIds }
                    },
                    transaction
                }
            );

            console.log(`⚠️ ${cliquesIds.length} cliques invalidados: ${motivo}`);
        } catch (error) {
            console.error('❌ Erro ao invalidar cliques:', error);
            throw error;
        }
    }

    /**
     * Processar clique válido e gerar créditos se necessário (com transação atômica)
     * NOVA REGRA: A cada 10 cliques, deve haver pelo menos 2 conversões
     * @param {string} linkTrackingId - ID do link tracking
     * @param {string} afiliadoId - ID do afiliado
     * @param {string} produtoId - ID do produto
     * @param {Object} dadosFraude - Dados de fraude (ip, userAgent, etc)
     * @returns {Promise<Object>} Resultado do processamento
     */
    async processarCliqueValido(linkTrackingId, afiliadoId, produtoId, dadosFraude) {
        const transaction = await sequelize.transaction();
        
        try {
            // Validações iniciais
            if (!linkTrackingId || !afiliadoId) {
                throw new Error('linkTrackingId e afiliadoId são obrigatórios');
            }

            // Buscar link tracking com lock para evitar race conditions
            const linkTracking = await LinkTracking.findByPk(linkTrackingId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });
            
            if (!linkTracking) {
                throw new Error('Link tracking não encontrado');
            }

            // Verificar se o link pertence ao afiliado (comparar como strings para UUID)
            const linkAfiliadoId = String(linkTracking.afiliado_id);
            const afiliadoIdStr = String(afiliadoId);
            if (linkAfiliadoId !== afiliadoIdStr) {
                console.error(`❌ [CLIQUE VALIDO] Link tracking não pertence ao afiliado. Link afiliado_id: ${linkAfiliadoId}, esperado: ${afiliadoIdStr}`);
                throw new Error('Link tracking não pertence ao afiliado especificado');
            }

            // Buscar afiliado com lock
            const afiliado = await Afiliado.findByPk(afiliadoId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });
            
            if (!afiliado) {
                throw new Error('Afiliado não encontrado');
            }

            if (afiliado.status !== 'ativo') {
                throw new Error('Afiliado inativo');
            }

            // Verificar clique duplicado (mesmo fingerprint/IP em menos de 60 segundos)
            const cliqueDuplicado = await CliqueValidoAfiliado.findOne({
                where: {
                    link_tracking_id: linkTrackingId,
                    fingerprint: dadosFraude.fingerprint,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - this.TIMEOUT_DUPLICADO)
                    }
                },
                transaction
            });

            if (cliqueDuplicado) {
                console.log(`⚠️ Clique duplicado detectado para link ${linkTrackingId} (fingerprint: ${dadosFraude.fingerprint})`);
                await transaction.rollback();
                return {
                    cliqueRegistrado: false,
                    valido: false,
                    motivo: 'Clique duplicado detectado (mesmo dispositivo em menos de 60 segundos)',
                    duplicado: true
                };
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
            }, { transaction });

            // Se o clique não é válido, apenas registrar e retornar
            if (!dadosFraude.valido) {
                console.log(`⚠️ Clique inválido registrado para afiliado ${afiliado.nome}: ${dadosFraude.motivoRejeicao}`);
                await transaction.commit();
                return {
                    cliqueRegistrado: true,
                    valido: false,
                    motivo: dadosFraude.motivoRejeicao
                };
            }

            // Incrementar cliques válidos (atômico)
            await linkTracking.increment('cliques', { transaction });
            await linkTracking.update({
                ultimo_clique: new Date()
            }, { transaction });

            // Atualizar total de cliques do afiliado (atômico)
            await afiliado.increment('total_cliques', { transaction });
            await afiliado.update({
                ultima_atividade: new Date()
            }, { transaction });

            // Recarregar dados atualizados
            await linkTracking.reload({ transaction });
            await afiliado.reload({ transaction });

            // Contar cliques válidos não pagos (apenas cliques válidos)
            const cliquesValidosNaoPagos = linkTracking.cliques - linkTracking.cliques_pagos;
            
            // Verificar se atingiu múltiplo de 10
            if (cliquesValidosNaoPagos >= this.CLICKS_POR_CREDITO) {
                // Calcular quantos lotes de 10 cliques temos
                const totalLotes = Math.floor(cliquesValidosNaoPagos / this.CLICKS_POR_CREDITO);
                
                // Verificar cada lote de 10 cliques
                let lotesValidos = 0;
                let lotesInvalidos = 0;
                const cliquesParaInvalidar = [];

                // Buscar todos os cliques válidos não pagos
                const todosCliquesValidos = await CliqueValidoAfiliado.findAll({
                    where: {
                        link_tracking_id: linkTrackingId,
                        valido: true
                    },
                    order: [['created_at', 'ASC']],
                    limit: cliquesValidosNaoPagos,
                    transaction
                });

                // Agrupar em lotes de 10 e verificar conversões
                for (let i = 0; i < totalLotes; i++) {
                    const inicioLote = i * this.CLICKS_POR_CREDITO;
                    const fimLote = Math.min(inicioLote + this.CLICKS_POR_CREDITO, todosCliquesValidos.length);
                    const lote = todosCliquesValidos.slice(inicioLote, fimLote);
                    
                    if (lote.length < this.CLICKS_POR_CREDITO) {
                        break; // Lote incompleto, não processar ainda
                    }

                    const dataInicioLote = new Date(lote[0].created_at);
                    // Data fim: último clique do lote + 7 dias de tolerância (tempo para venda ser aprovada)
                    const dataFimLote = new Date(lote[lote.length - 1].created_at.getTime() + (7 * 24 * 60 * 60 * 1000));

                    // Buscar conversões neste período usando método auxiliar
                    const conversoesNoLote = await this.contarConversoesNoPeriodo(
                        afiliadoId,
                        produtoId,
                        dataInicioLote,
                        dataFimLote,
                        transaction
                    );

                    if (conversoesNoLote >= this.MIN_CONVERSOES_POR_10_CLIQUES) {
                        // Lote válido - pode gerar crédito
                        lotesValidos++;
                        console.log(`✅ Lote ${i + 1} válido: ${conversoesNoLote} conversões (mínimo: ${this.MIN_CONVERSOES_POR_10_CLIQUES})`);
                    } else {
                        // Lote inválido - invalidar cliques deste lote
                        lotesInvalidos++;
                        const idsParaInvalidar = lote.map(c => c.id);
                        cliquesParaInvalidar.push(...idsParaInvalidar);
                        
                        console.log(`⚠️ Lote ${i + 1} de 10 cliques inválido: apenas ${conversoesNoLote} conversões (mínimo: ${this.MIN_CONVERSOES_POR_10_CLIQUES})`);
                    }
                }

                // Invalidar cliques sem conversões suficientes
                if (cliquesParaInvalidar.length > 0) {
                    await this.invalidarCliques(
                        cliquesParaInvalidar,
                        `Lote sem conversões suficientes (mínimo ${this.MIN_CONVERSOES_POR_10_CLIQUES} conversões por 10 cliques)`,
                        transaction
                    );

                    // Recalcular cliques válidos após invalidação
                    await linkTracking.reload({ transaction });
                    const cliquesValidosAposInvalidacao = linkTracking.cliques - linkTracking.cliques_pagos;
                    
                    // Se ainda temos lotes válidos, processar créditos
                    if (lotesValidos > 0 && cliquesValidosAposInvalidacao >= this.CLICKS_POR_CREDITO) {
                        const creditosGerar = lotesValidos; // 1 crédito por lote válido
                        const valorCredito = creditosGerar * this.VALOR_CREDITO;
                        const cliquesParaPagar = lotesValidos * this.CLICKS_POR_CREDITO;

                        // Validar valores antes de atualizar
                        if (valorCredito <= 0 || cliquesParaPagar <= 0) {
                            throw new Error('Valores inválidos para crédito');
                        }

                        // Atualizar link tracking (marcar cliques como pagos e reiniciar contagem)
                        const novosCliquesPagos = linkTracking.cliques_pagos + cliquesParaPagar;
                        const novosCreditosGerados = parseFloat(linkTracking.creditos_gerados || 0) + valorCredito;

                        await linkTracking.update({
                            cliques_pagos: novosCliquesPagos,
                            creditos_gerados: novosCreditosGerados
                        }, { transaction });

                        // Atualizar afiliado
                        const novosCliquesPagosAfiliado = afiliado.cliques_pagos + cliquesParaPagar;
                        const novosCreditosCliques = parseFloat(afiliado.creditos_cliques || 0) + valorCredito;
                        const novoSaldo = parseFloat(afiliado.saldo_disponivel || 0) + valorCredito;

                        await afiliado.update({
                            cliques_pagos: novosCliquesPagosAfiliado,
                            creditos_cliques: novosCreditosCliques,
                            saldo_disponivel: novoSaldo
                        }, { transaction });

                        await afiliado.reload({ transaction });

                        // Commit da transação
                        await transaction.commit();

                        console.log(`💰 Crédito gerado para afiliado ${afiliado.nome}: ${valorCredito} MZN (${lotesValidos} lotes válidos de 10 cliques, ${lotesInvalidos} lotes invalidados)`);

                        return {
                            cliqueRegistrado: true,
                            valido: true,
                            creditosGerados: true,
                            valorCredito: valorCredito,
                            cliquesPagos: cliquesParaPagar,
                            lotesValidos: lotesValidos,
                            lotesInvalidos: lotesInvalidos,
                            cliquesInvalidados: cliquesParaInvalidar.length,
                            cliquesRestantes: 0, // Reiniciado
                            saldoAtual: parseFloat(afiliado.saldo_disponivel)
                        };
                    } else {
                        // Nenhum lote válido após invalidação
                        await transaction.commit();
                        return {
                            cliqueRegistrado: true,
                            valido: true,
                            creditosGerados: false,
                            motivo: `Nenhum lote válido: ${lotesInvalidos} lotes invalidados por falta de conversões (mínimo ${this.MIN_CONVERSOES_POR_10_CLIQUES} conversões por 10 cliques)`,
                            lotesInvalidos: lotesInvalidos,
                            cliquesInvalidados: cliquesParaInvalidar.length,
                            cliquesRestantes: cliquesValidosNaoPagos - cliquesParaInvalidar.length
                        };
                    }
                } else if (lotesValidos > 0) {
                    // Todos os lotes são válidos - processar normalmente
                    const creditosGerar = lotesValidos;
                    const valorCredito = creditosGerar * this.VALOR_CREDITO;
                    const cliquesParaPagar = lotesValidos * this.CLICKS_POR_CREDITO;

                    // Validar valores antes de atualizar
                    if (valorCredito <= 0 || cliquesParaPagar <= 0) {
                        throw new Error('Valores inválidos para crédito');
                    }

                    // Atualizar link tracking (marcar cliques como pagos e reiniciar contagem)
                    const novosCliquesPagos = linkTracking.cliques_pagos + cliquesParaPagar;
                    const novosCreditosGerados = parseFloat(linkTracking.creditos_gerados || 0) + valorCredito;

                    await linkTracking.update({
                        cliques_pagos: novosCliquesPagos,
                        creditos_gerados: novosCreditosGerados
                    }, { transaction });

                    // Atualizar afiliado
                    const novosCliquesPagosAfiliado = afiliado.cliques_pagos + cliquesParaPagar;
                    const novosCreditosCliques = parseFloat(afiliado.creditos_cliques || 0) + valorCredito;
                    const novoSaldo = parseFloat(afiliado.saldo_disponivel || 0) + valorCredito;

                    await afiliado.update({
                        cliques_pagos: novosCliquesPagosAfiliado,
                        creditos_cliques: novosCreditosCliques,
                        saldo_disponivel: novoSaldo
                    }, { transaction });

                    await afiliado.reload({ transaction });

                    // Commit da transação
                    await transaction.commit();

                    console.log(`💰 Crédito gerado para afiliado ${afiliado.nome}: ${valorCredito} MZN (${lotesValidos} lotes válidos de 10 cliques)`);

                    return {
                        cliqueRegistrado: true,
                        valido: true,
                        creditosGerados: true,
                        valorCredito: valorCredito,
                        cliquesPagos: cliquesParaPagar,
                        lotesValidos: lotesValidos,
                        cliquesRestantes: 0, // Reiniciado
                        saldoAtual: parseFloat(afiliado.saldo_disponivel)
                    };
                } else {
                    // Nenhum lote válido
                    await transaction.commit();
                    return {
                        cliqueRegistrado: true,
                        valido: true,
                        creditosGerados: false,
                        motivo: `Nenhum lote válido: ${lotesInvalidos} lotes sem conversões suficientes (mínimo ${this.MIN_CONVERSOES_POR_10_CLIQUES} conversões por 10 cliques)`,
                        lotesInvalidos: lotesInvalidos,
                        cliquesRestantes: cliquesValidosNaoPagos
                    };
                }
            }

            // Ainda não atingiu 10 cliques válidos
            const cliquesRestantes = this.CLICKS_POR_CREDITO - (cliquesValidosNaoPagos % this.CLICKS_POR_CREDITO);

            // Commit da transação
            await transaction.commit();

            return {
                cliqueRegistrado: true,
                valido: true,
                creditosGerados: false,
                cliquesRestantes: cliquesRestantes,
                cliquesAtuais: cliquesValidosNaoPagos
            };

        } catch (error) {
            // Rollback em caso de erro
            await transaction.rollback();
            console.error('❌ Erro ao processar clique válido:', error);
            throw error;
        }
    }

    /**
     * Processar múltiplos cliques (útil para processamento em lote) - com transação
     */
    async processarMultiplosCliques(linkTrackingId, quantidade) {
        const transaction = await sequelize.transaction();
        
        try {
            if (!linkTrackingId || quantidade <= 0) {
                throw new Error('Parâmetros inválidos');
            }

            const linkTracking = await LinkTracking.findByPk(linkTrackingId, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });
            
            if (!linkTracking) {
                throw new Error('Link tracking não encontrado');
            }

            const afiliado = await Afiliado.findByPk(linkTracking.afiliado_id, {
                lock: transaction.LOCK.UPDATE,
                transaction
            });
            
            if (!afiliado || afiliado.status !== 'ativo') {
                throw new Error('Afiliado não encontrado ou inativo');
            }

            // Incrementar cliques
            await linkTracking.increment('cliques', { by: quantidade, transaction });
            await afiliado.increment('total_cliques', { by: quantidade, transaction });

            // Recarregar para cálculos
            await linkTracking.reload({ transaction });
            await afiliado.reload({ transaction });

            // Calcular créditos (com validação de conversões)
            const cliquesNaoPagos = linkTracking.cliques - linkTracking.cliques_pagos;
            const totalLotes = Math.floor(cliquesNaoPagos / this.CLICKS_POR_CREDITO);
            
            if (totalLotes > 0) {
                // Buscar todos os cliques válidos não pagos
                const todosCliquesValidos = await CliqueValidoAfiliado.findAll({
                    where: {
                        link_tracking_id: linkTrackingId,
                        valido: true
                    },
                    order: [['created_at', 'ASC']],
                    limit: cliquesNaoPagos,
                    transaction
                });

                let lotesValidos = 0;
                let lotesInvalidos = 0;
                const cliquesParaInvalidar = [];

                // Verificar cada lote de 10 cliques
                for (let i = 0; i < totalLotes; i++) {
                    const inicioLote = i * this.CLICKS_POR_CREDITO;
                    const fimLote = Math.min(inicioLote + this.CLICKS_POR_CREDITO, todosCliquesValidos.length);
                    const lote = todosCliquesValidos.slice(inicioLote, fimLote);
                    
                    if (lote.length < this.CLICKS_POR_CREDITO) break;

                    const dataInicioLote = new Date(lote[0].created_at);
                    const dataFimLote = new Date(lote[lote.length - 1].created_at.getTime() + (7 * 24 * 60 * 60 * 1000));

                    const conversoesNoLote = await this.contarConversoesNoPeriodo(
                        linkTracking.afiliado_id,
                        linkTracking.produto_id,
                        dataInicioLote,
                        dataFimLote,
                        transaction
                    );

                    if (conversoesNoLote >= this.MIN_CONVERSOES_POR_10_CLIQUES) {
                        lotesValidos++;
                    } else {
                        lotesInvalidos++;
                        cliquesParaInvalidar.push(...lote.map(c => c.id));
                    }
                }

                // Invalidar cliques sem conversões
                if (cliquesParaInvalidar.length > 0) {
                    await this.invalidarCliques(
                        cliquesParaInvalidar,
                        `Lote sem conversões suficientes (mínimo ${this.MIN_CONVERSOES_POR_10_CLIQUES} conversões por 10 cliques)`,
                        transaction
                    );
                }
                
                if (lotesValidos > 0) {
                    const valorCredito = lotesValidos * this.VALOR_CREDITO;
                    const cliquesParaPagar = lotesValidos * this.CLICKS_POR_CREDITO;

                    await linkTracking.update({
                        cliques_pagos: linkTracking.cliques_pagos + cliquesParaPagar,
                        creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0) + valorCredito
                    }, { transaction });

                    await afiliado.update({
                        cliques_pagos: afiliado.cliques_pagos + cliquesParaPagar,
                        creditos_cliques: parseFloat(afiliado.creditos_cliques || 0) + valorCredito,
                        saldo_disponivel: parseFloat(afiliado.saldo_disponivel || 0) + valorCredito
                    }, { transaction });

                    console.log(`💰 Créditos gerados: ${valorCredito} MZN para ${afiliado.nome} (${lotesValidos} lotes válidos, ${lotesInvalidos} invalidados)`);
                }
            }

            await transaction.commit();

            return {
                cliquesProcessados: quantidade,
                creditosGerados: 0 // Será calculado pela validação de conversões
            };

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar múltiplos cliques:', error);
            throw error;
        }
    }

    /**
     * Obter estatísticas de cliques de um afiliado (com validações)
     */
    async obterEstatisticasCliques(afiliadoId) {
        try {
            if (!afiliadoId) {
                throw new Error('afiliadoId é obrigatório');
            }

            const afiliado = await Afiliado.findByPk(afiliadoId);
            if (!afiliado) {
                throw new Error('Afiliado não encontrado');
            }

            const links = await LinkTracking.findAll({
                where: { afiliado_id: afiliadoId },
                order: [['ultimo_clique', 'DESC']]
            });

            const totalCliques = links.reduce((sum, link) => sum + (link.cliques || 0), 0);
            const totalCliquesPagos = links.reduce((sum, link) => sum + (link.cliques_pagos || 0), 0);
            const totalCreditos = links.reduce((sum, link) => sum + parseFloat(link.creditos_gerados || 0), 0);
            const cliquesPendentes = totalCliques - totalCliquesPagos;
            const creditosPendentes = Math.floor(cliquesPendentes / this.CLICKS_POR_CREDITO) * this.VALOR_CREDITO;
            const cliquesParaProximoCredito = this.CLICKS_POR_CREDITO - (cliquesPendentes % this.CLICKS_POR_CREDITO);

            // Validar integridade dos dados
            const cliquesValidos = await CliqueValidoAfiliado.count({
                where: {
                    afiliado_id: afiliadoId,
                    valido: true
                }
            });

            const cliquesInvalidos = await CliqueValidoAfiliado.count({
                where: {
                    afiliado_id: afiliadoId,
                    valido: false
                }
            });

            // Buscar conversões (vendas aprovadas)
            const totalConversoes = await VendaAfiliado.count({
                where: {
                    afiliado_id: afiliadoId,
                    status: 'pago'
                }
            });

            return {
                totalCliques: totalCliques,
                totalCliquesPagos: totalCliquesPagos,
                cliquesPendentes: cliquesPendentes,
                cliquesValidos: cliquesValidos,
                cliquesInvalidos: cliquesInvalidos,
                totalConversoes: totalConversoes,
                creditosGerados: totalCreditos,
                creditosPendentes: creditosPendentes,
                cliquesParaProximoCredito: cliquesParaProximoCredito === this.CLICKS_POR_CREDITO ? 0 : cliquesParaProximoCredito,
                regra: {
                    clicksPorCredito: this.CLICKS_POR_CREDITO,
                    minConversoesPorLote: this.MIN_CONVERSOES_POR_10_CLIQUES,
                    valorCredito: this.VALOR_CREDITO
                },
                integridade: {
                    cliquesValidosRegistrados: cliquesValidos,
                    diferenca: totalCliques - cliquesValidos,
                    status: Math.abs(totalCliques - cliquesValidos) <= 5 ? 'ok' : 'verificar'
                },
                links: links.map(link => ({
                    id: link.id,
                    produto_id: link.produto_id,
                    cliques: link.cliques || 0,
                    cliques_pagos: link.cliques_pagos || 0,
                    creditos_gerados: parseFloat(link.creditos_gerados || 0),
                    conversoes: link.conversoes || 0,
                    ultimo_clique: link.ultimo_clique,
                    link_afiliado: link.link_afiliado
                }))
            };

        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }

    /**
     * Revalidar cliques quando uma venda é aprovada
     * Verifica se há lotes que agora podem ser validados após nova conversão
     * @param {number} afiliadoId - ID do afiliado
     * @param {number} produtoId - ID do produto
     */
    async revalidarCliquesAposConversao(afiliadoId, produtoId) {
        const transaction = await sequelize.transaction();
        
        try {
            // Buscar link tracking do produto e afiliado
            const linkTracking = await LinkTracking.findOne({
                where: {
                    afiliado_id: afiliadoId,
                    produto_id: produtoId
                },
                transaction
            });

            if (!linkTracking) {
                await transaction.rollback();
                return { revalidado: false, motivo: 'Link tracking não encontrado' };
            }

            // Buscar cliques válidos não pagos
            const cliquesValidosNaoPagos = linkTracking.cliques - linkTracking.cliques_pagos;
            
            if (cliquesValidosNaoPagos < this.CLICKS_POR_CREDITO) {
                await transaction.rollback();
                return { revalidado: false, motivo: 'Não há cliques suficientes para formar lote' };
            }

            // Buscar cliques válidos
            const todosCliquesValidos = await CliqueValidoAfiliado.findAll({
                where: {
                    link_tracking_id: linkTracking.id,
                    valido: true
                },
                order: [['created_at', 'ASC']],
                limit: cliquesValidosNaoPagos,
                transaction
            });

            const totalLotes = Math.floor(cliquesValidosNaoPagos / this.CLICKS_POR_CREDITO);
            let lotesValidos = 0;
            let lotesInvalidos = 0;
            const cliquesParaInvalidar = [];

            // Verificar cada lote
            for (let i = 0; i < totalLotes; i++) {
                const inicioLote = i * this.CLICKS_POR_CREDITO;
                const fimLote = Math.min(inicioLote + this.CLICKS_POR_CREDITO, todosCliquesValidos.length);
                const lote = todosCliquesValidos.slice(inicioLote, fimLote);
                
                if (lote.length < this.CLICKS_POR_CREDITO) break;

                const dataInicioLote = new Date(lote[0].created_at);
                const dataFimLote = new Date(lote[lote.length - 1].created_at.getTime() + (7 * 24 * 60 * 60 * 1000));

                const conversoesNoLote = await this.contarConversoesNoPeriodo(
                    afiliadoId,
                    produtoId,
                    dataInicioLote,
                    dataFimLote,
                    transaction
                );

                if (conversoesNoLote >= this.MIN_CONVERSOES_POR_10_CLIQUES) {
                    lotesValidos++;
                } else {
                    lotesInvalidos++;
                    cliquesParaInvalidar.push(...lote.map(c => c.id));
                }
            }

            // Invalidar cliques sem conversões
            if (cliquesParaInvalidar.length > 0) {
                await this.invalidarCliques(
                    cliquesParaInvalidar,
                    `Lote sem conversões suficientes (mínimo ${this.MIN_CONVERSOES_POR_10_CLIQUES} conversões por 10 cliques)`,
                    transaction
                );
            }

            // Se há lotes válidos, processar créditos
            if (lotesValidos > 0) {
                const afiliado = await Afiliado.findByPk(afiliadoId, {
                    lock: transaction.LOCK.UPDATE,
                    transaction
                });

                const valorCredito = lotesValidos * this.VALOR_CREDITO;
                const cliquesParaPagar = lotesValidos * this.CLICKS_POR_CREDITO;

                await linkTracking.update({
                    cliques_pagos: linkTracking.cliques_pagos + cliquesParaPagar,
                    creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0) + valorCredito
                }, { transaction });

                await afiliado.update({
                    cliques_pagos: afiliado.cliques_pagos + cliquesParaPagar,
                    creditos_cliques: parseFloat(afiliado.creditos_cliques || 0) + valorCredito,
                    saldo_disponivel: parseFloat(afiliado.saldo_disponivel || 0) + valorCredito
                }, { transaction });

                await transaction.commit();

                console.log(`💰 Créditos gerados após revalidação: ${valorCredito} MZN (${lotesValidos} lotes válidos)`);

                return {
                    revalidado: true,
                    creditosGerados: true,
                    valorCredito: valorCredito,
                    lotesValidos: lotesValidos,
                    lotesInvalidos: lotesInvalidos
                };
            }

            await transaction.commit();
            return {
                revalidado: true,
                creditosGerados: false,
                lotesValidos: 0,
                lotesInvalidos: lotesInvalidos
            };

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao revalidar cliques:', error);
            throw error;
        }
    }

    /**
     * Validar integridade dos dados de cliques de um afiliado
     */
    async validarIntegridade(afiliadoId) {
        try {
            const links = await LinkTracking.findAll({
                where: { afiliado_id: afiliadoId }
            });

            const problemas = [];

            for (const link of links) {
                // Verificar se cliques_pagos não é maior que cliques
                if (link.cliques_pagos > link.cliques) {
                    problemas.push({
                        link_id: link.id,
                        problema: 'cliques_pagos maior que cliques',
                        cliques: link.cliques,
                        cliques_pagos: link.cliques_pagos
                    });
                }

                // Verificar se créditos gerados são consistentes
                const creditosEsperados = Math.floor(link.cliques_pagos / this.CLICKS_POR_CREDITO) * this.VALOR_CREDITO;
                const diferenca = Math.abs(parseFloat(link.creditos_gerados || 0) - creditosEsperados);
                
                if (diferenca > 0.01) { // Tolerância para arredondamentos
                    problemas.push({
                        link_id: link.id,
                        problema: 'créditos inconsistentes',
                        creditos_gerados: link.creditos_gerados,
                        creditos_esperados: creditosEsperados,
                        diferenca: diferenca
                    });
                }

                // Verificar se há cliques sem conversões suficientes
                const cliquesNaoPagos = link.cliques - link.cliques_pagos;
                if (cliquesNaoPagos >= this.CLICKS_POR_CREDITO) {
                    const lotes = Math.floor(cliquesNaoPagos / this.CLICKS_POR_CREDITO);
                    
                    // Buscar cliques válidos
                    const cliquesValidos = await CliqueValidoAfiliado.findAll({
                        where: {
                            link_tracking_id: link.id,
                            valido: true
                        },
                        order: [['created_at', 'ASC']],
                        limit: cliquesNaoPagos
                    });

                    let lotesInvalidos = 0;
                    for (let i = 0; i < lotes; i++) {
                        const inicioLote = i * this.CLICKS_POR_CREDITO;
                        const lote = cliquesValidos.slice(inicioLote, inicioLote + this.CLICKS_POR_CREDITO);
                        if (lote.length < this.CLICKS_POR_CREDITO) break;

                        const dataInicio = new Date(lote[0].created_at);
                        const dataFim = new Date(lote[lote.length - 1].created_at.getTime() + (7 * 24 * 60 * 60 * 1000));
                        
                        const conversoes = await this.contarConversoesNoPeriodo(
                            link.afiliado_id,
                            link.produto_id,
                            dataInicio,
                            dataFim,
                            null
                        );

                        if (conversoes < this.MIN_CONVERSOES_POR_10_CLIQUES) {
                            lotesInvalidos++;
                        }
                    }
                    
                    if (lotesInvalidos > 0) {
                        problemas.push({
                            link_id: link.id,
                            problema: 'lotes sem conversões suficientes',
                            lotesInvalidos: lotesInvalidos,
                            totalLotes: lotes
                        });
                    }
                }
            }

            return {
                valido: problemas.length === 0,
                problemas: problemas,
                totalLinks: links.length
            };

        } catch (error) {
            console.error('❌ Erro ao validar integridade:', error);
            throw error;
        }
    }
}

module.exports = new AfiliadoClickService();
