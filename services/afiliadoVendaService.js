/**
 * Serviço para rastrear vendas de afiliados e creditar comissões
 */

const { Afiliado, VendaAfiliado, LinkTracking, Venda, Produto, CliqueValidoAfiliado, Notificacao, Usuario, sequelize } = require('../config/database');
const { Op } = require('sequelize');
const afiliadoClickService = require('./afiliadoClickService');
const { enviarWebhook } = require('../routes/webhooks');

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
            
            // Buscar link tracking específico do produto e afiliado (garantir que sempre existe)
            let linkTracking = null;
            if (produto && produto.id) {
                linkTracking = await LinkTracking.findOne({
                    where: {
                        afiliado_id: afiliado.id,
                        produto_id: produto.id
                    }
                });
                
                console.log(`🔍 [VENDA AFILIADO] Busca de link tracking para afiliado ${afiliado.id} e produto ${produto.id}: ${linkTracking ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);
                
                if (!linkTracking) {
                    console.log(`⚠️ [VENDA AFILIADO] Link tracking não encontrado. Buscando todos os links do afiliado...`);
                    const todosLinks = await LinkTracking.findAll({
                        where: { afiliado_id: afiliado.id },
                        attributes: ['id', 'produto_id', 'cliques', 'conversoes', 'link_afiliado']
                    });
                    console.log(`📊 [VENDA AFILIADO] Links encontrados para afiliado ${afiliado.id}:`, todosLinks.length);
                    todosLinks.forEach(link => {
                        console.log(`  - Link ${link.id}: Produto ${link.produto_id}, ${link.cliques} cliques, ${link.conversoes} conversões, link: ${link.link_afiliado?.substring(0, 80)}...`);
                    });
                    
                    // Criar um link tracking básico se não existir
                    console.log(`🔧 [VENDA AFILIADO] Criando link tracking para afiliado ${afiliado.id} e produto ${produto.id}...`);
                    const produtoCustomId = produto.custom_id || produto.id;
                    const linkOriginal = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?produto=${produtoCustomId}`;
                    const linkAfiliado = `${linkOriginal}&ref=${afiliado.codigo_afiliado}`;
                    
                    try {
                        linkTracking = await LinkTracking.create({
                            afiliado_id: afiliado.id,
                            produto_id: produto.id,
                            link_original: linkOriginal,
                            link_afiliado: linkAfiliado,
                            cliques: 0,
                            cliques_pagos: 0,
                            creditos_gerados: 0.00,
                            conversoes: 0
                        });
                        console.log(`✅ [VENDA AFILIADO] Link tracking criado: ${linkTracking.id}, link: ${linkAfiliado}`);
                    } catch (createError) {
                        // Se falhar por constraint única, tentar buscar novamente
                        if (createError.name === 'SequelizeUniqueConstraintError' || createError.message.includes('duplicate')) {
                            console.log(`⚠️ [VENDA AFILIADO] Link já existe (constraint), buscando novamente...`);
                            linkTracking = await LinkTracking.findOne({
                                where: {
                                    afiliado_id: afiliado.id,
                                    produto_id: produto.id
                                }
                            });
                            if (linkTracking) {
                                console.log(`✅ [VENDA AFILIADO] Link encontrado após tentativa de criação: ${linkTracking.id}`);
                            }
                        } else {
                            console.error(`❌ [VENDA AFILIADO] Erro ao criar link tracking:`, createError);
                            // Continuar mesmo sem link tracking - a venda será processada
                        }
                    }
                } else {
                    // Verificar e atualizar link_afiliado se necessário
                    const produtoCustomId = produto.custom_id || produto.id;
                    const linkOriginalEsperado = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?produto=${produtoCustomId}`;
                    const linkAfiliadoEsperado = `${linkOriginalEsperado}&ref=${afiliado.codigo_afiliado}`;
                    
                    if (linkTracking.link_afiliado !== linkAfiliadoEsperado || linkTracking.link_original !== linkOriginalEsperado) {
                        console.log(`🔄 [VENDA AFILIADO] Atualizando link_afiliado para o formato correto...`);
                        try {
                            await linkTracking.update({
                                link_original: linkOriginalEsperado,
                                link_afiliado: linkAfiliadoEsperado
                            });
                            console.log(`✅ [VENDA AFILIADO] Link atualizado: ${linkAfiliadoEsperado}`);
                        } catch (updateError) {
                            console.error(`❌ [VENDA AFILIADO] Erro ao atualizar link:`, updateError);
                        }
                    }
                    
                    console.log(`✅ [VENDA AFILIADO] Link tracking encontrado: ${linkTracking.id} (${linkTracking.cliques} cliques, ${linkTracking.conversoes} conversões)`);
                }
            }
            
            // Carregar produto completo se necessário para obter comissão
            let produtoCompleto = produto;
            if (!produto || !produto.comissao_afiliados) {
                produtoCompleto = await Produto.findByPk(produto?.id || venda.produto_id);
                if (!produtoCompleto) {
                    console.error('⚠️ Produto não encontrado para calcular comissão');
                    return { processado: false, motivo: 'Produto não encontrado' };
                }
            }
            
            // Verificar se produto permite afiliação
            if (!produtoCompleto.permitir_afiliados) {
                console.log('⚠️ Produto não permite afiliação:', produtoCompleto.id);
                return { processado: false, motivo: 'Produto não permite afiliação' };
            }
            
            // Calcular comissão usando a comissão do PRODUTO (não do afiliado)
            let valorComissao = 0;
            let comissaoPercentualUsado = 0;
            
            // Prioridade: comissao_afiliados do produto > comissão padrão do afiliado
            if (produtoCompleto.comissao_afiliados && produtoCompleto.comissao_afiliados > 0) {
                // Comissão percentual do produto
                comissaoPercentualUsado = parseFloat(produtoCompleto.comissao_afiliados);
                valorComissao = (valorTotal * comissaoPercentualUsado) / 100;
                
                // Verificar comissão mínima se configurada
                if (produtoCompleto.comissao_minima && produtoCompleto.comissao_minima > 0) {
                    const comissaoMinima = parseFloat(produtoCompleto.comissao_minima);
                    if (valorComissao < comissaoMinima) {
                        valorComissao = comissaoMinima;
                        console.log(`💰 Comissão ajustada para mínimo: MZN ${comissaoMinima.toFixed(2)}`);
                    }
                }
            } else if (produtoCompleto.comissao_minima && produtoCompleto.comissao_minima > 0) {
                // Apenas comissão fixa
                valorComissao = parseFloat(produtoCompleto.comissao_minima);
                console.log(`💰 Comissão fixa aplicada: MZN ${valorComissao.toFixed(2)}`);
            } else if (afiliado.comissao_percentual && afiliado.comissao_percentual > 0) {
                // Fallback: usar comissão padrão do afiliado
                comissaoPercentualUsado = parseFloat(afiliado.comissao_percentual);
                valorComissao = (valorTotal * comissaoPercentualUsado) / 100;
                console.log(`⚠️ Usando comissão padrão do afiliado (produto não tem comissão configurada): ${comissaoPercentualUsado}%`);
            } else {
                console.error('⚠️ Nenhuma comissão configurada para produto ou afiliado');
                return { processado: false, motivo: 'Nenhuma comissão configurada' };
            }
            
            console.log(`💰 Comissão calculada: MZN ${valorComissao.toFixed(2)} (${comissaoPercentualUsado > 0 ? comissaoPercentualUsado + '%' : 'fixa'})`);
            
            // Validar valores antes de processar
            if (valorComissao <= 0) {
                console.error('⚠️ Comissão inválida ou zero:', valorComissao);
                return { processado: false, motivo: 'Comissão inválida ou zero' };
            }
            
            // Salvar código do afiliado na venda (se ainda não estiver salvo)
            if (!venda.afiliado_ref) {
                await venda.update({
                    afiliado_ref: codigoAfiliadoFinal
                });
            }
            
            // Criar registro de venda do afiliado (com transação para garantir consistência)
            const transaction = await sequelize.transaction();
            try {
                const vendaAfiliado = await VendaAfiliado.create({
                    afiliado_id: afiliado.id,
                    venda_id: venda.id,
                    produto_id: produtoCompleto.id,
                    valor_venda: valorTotal,
                    comissao_percentual: comissaoPercentualUsado || null,
                    valor_comissao: valorComissao,
                    status: 'pendente'
                }, { transaction });
                
                // Atualizar estatísticas do afiliado (dentro da transação)
                await afiliado.increment('total_vendas', { transaction });
                await afiliado.increment('total_comissoes', { by: valorComissao, transaction });
                await afiliado.increment('saldo_disponivel', { by: valorComissao, transaction });
                await afiliado.update({
                    ultima_atividade: new Date()
                }, { transaction });
                
                // Atualizar conversões no link tracking específico (dentro da transação)
                if (linkTracking) {
                    await linkTracking.increment('conversoes', { transaction });
                    console.log(`✅ Conversão registrada no link tracking: ${linkTracking.id}`);
                } else {
                    // Incrementar conversões em todos os links do afiliado (fallback)
                    await LinkTracking.increment('conversoes', {
                        where: { afiliado_id: afiliado.id },
                        transaction
                    });
                    console.log('✅ Conversão registrada em todos os links do afiliado (link específico não encontrado)');
                }
                
                // Commit da transação
                await transaction.commit();
                console.log(`✅ Transação de venda de afiliado confirmada: ${venda.id}`);
                
            } catch (transactionError) {
                await transaction.rollback();
                console.error('❌ Erro na transação de venda de afiliado, revertendo:', transactionError);
                throw transactionError;
            }
            
            // Buscar vendaAfiliado criada para retornar (recarregar após commit)
            const vendaAfiliadoRetorno = await VendaAfiliado.findOne({
                where: {
                    afiliado_id: afiliado.id,
                    venda_id: venda.id
                }
            });
            
            if (!vendaAfiliadoRetorno) {
                throw new Error('Venda de afiliado não foi criada corretamente');
            }
            
            // Validar e contar clique apenas quando a venda é criada (validação rigorosa)
            // (fora da transação para não bloquear)
            if (linkTracking) {
                try {
                    await this.validarEContarCliqueNaVenda(afiliado, produtoCompleto, venda, linkTracking);
                } catch (clickError) {
                    console.error('⚠️ Erro ao validar clique (não crítico):', clickError);
                }
            }
            
            // Enviar notificação para o afiliado sobre a nova venda (fora da transação)
            try {
                await this.enviarNotificacaoVendaAfiliado(afiliado, produtoCompleto, vendaAfiliadoRetorno, valorComissao);
            } catch (notifError) {
                console.error('⚠️ Erro ao enviar notificação (não crítico):', notifError);
            }
            
            // Verificar e liberar comissões automaticamente se atingir 50MZN (apenas se afiliado for vendedor)
            if (afiliado.vendedor_id) {
                try {
                    const { MovimentoSaldo, SaldoVendedor, sequelize } = require('../config/database');
                    const { Op } = require('sequelize');
                    
                    // Buscar todas as comissões pendentes do afiliado
                    const comissoesPendentes = await VendaAfiliado.findAll({
                        where: {
                            afiliado_id: afiliado.id,
                            status: 'pendente'
                        },
                        order: [['created_at', 'ASC']]
                    });

                    // Calcular total acumulado
                    const totalAcumulado = comissoesPendentes.reduce((sum, va) => {
                        return sum + parseFloat(va.valor_comissao || 0);
                    }, 0);

                    // Se o total acumulado for >= 50MZN, liberar
                    if (totalAcumulado >= 50) {
                        const transaction = await sequelize.transaction();
                        try {
                            // Criar movimento de saldo para o vendedor
                            await MovimentoSaldo.create({
                                vendedor_id: afiliado.vendedor_id,
                                tipo: 'credito',
                                origem: 'comissao_afiliado',
                                referencia_id: afiliado.id,
                                valor: totalAcumulado,
                                descricao: `Comissão aprovada de afiliado (acumulado: MZN ${totalAcumulado.toFixed(2)})`
                            }, { transaction });

                            // Atualizar saldo do vendedor
                            const saldo = await SaldoVendedor.findOne({ 
                                where: { vendedor_id: afiliado.vendedor_id }, 
                                transaction 
                            });
                            
                            if (!saldo) {
                                await SaldoVendedor.create({
                                    vendedor_id: afiliado.vendedor_id,
                                    saldo_atual: totalAcumulado,
                                    receita_total: totalAcumulado,
                                    receita_hoje: 0,
                                    receita_ontem: 0,
                                    receita_semana: 0,
                                    receita_mes: 0
                                }, { transaction });
                            } else {
                                saldo.saldo_atual = +((parseFloat(saldo.saldo_atual || 0)) + totalAcumulado).toFixed(2);
                                saldo.receita_total = +((parseFloat(saldo.receita_total || 0)) + totalAcumulado).toFixed(2);
                                await saldo.save({ transaction });
                            }

                            // Atualizar status das vendas para 'pago'
                            await VendaAfiliado.update(
                                { 
                                    status: 'pago',
                                    data_pagamento: new Date()
                                },
                                {
                                    where: { 
                                        afiliado_id: afiliado.id,
                                        status: 'pendente'
                                    },
                                    transaction
                                }
                            );

                            await transaction.commit();
                            console.log(`✅ Comissões liberadas automaticamente: MZN ${totalAcumulado.toFixed(2)} para vendedor ${afiliado.vendedor_id}`);

                            // Disparar webhook de comissões aprovadas para afiliado
                            try {
                                await enviarWebhook('afiliado_comissoes_liberadas', {
                                    afiliado_id: afiliado.id,
                                    afiliado_nome: afiliado.nome,
                                    afiliado_codigo: afiliado.codigo_afiliado,
                                    valor_total_comissoes: totalAcumulado,
                                    vendedor_id: afiliado.vendedor_id,
                                    data_aprovacao: new Date().toISOString()
                                }, afiliado.vendedor_id || null);
                            } catch (webhookError) {
                                console.error('⚠️ Erro ao enviar webhook de comissões de afiliado (não crítico):', webhookError.message);
                            }
                        } catch (error) {
                            await transaction.rollback();
                            console.error('❌ Erro ao liberar comissões automaticamente:', error);
                            // Não falhar o processamento da venda por erro na liberação
                        }
                    }
                } catch (error) {
                    console.error('⚠️ Erro ao verificar liberação automática (não crítico):', error);
                    // Não falhar o processamento da venda por erro na verificação
                }
            }
            
            console.log(`✅ Venda de afiliado processada: ${afiliado.nome} - Comissão: MZN ${valorComissao.toFixed(2)}`);

            // Disparar webhook de nova venda de afiliado (se houver vendedor vinculado)
            try {
                const userId = afiliado.vendedor_id || null;
                await enviarWebhook('afiliado_venda_criada', {
                    venda_id: venda.id,
                    venda_public_id: venda.public_id,
                    valor_venda: valorTotal,
                    valor_comissao: valorComissao,
                    comissao_percentual: comissaoPercentualUsado || null,
                    afiliado_nome: afiliado.nome,
                    afiliado_codigo: afiliado.codigo_afiliado,
                    produto_nome: produtoCompleto?.nome,
                    produto_categoria: produtoCompleto?.categoria,
                    status: 'pendente',
                    data_venda: venda.created_at || new Date().toISOString()
                }, userId);
            } catch (webhookError) {
                console.error('⚠️ Erro ao enviar webhook de venda de afiliado (não crítico):', webhookError.message);
            }

            return {
                processado: true,
                vendaAfiliado: vendaAfiliadoRetorno,
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
     * Validar e contar clique apenas quando uma venda é criada (validação rigorosa)
     * Verifica se IP, user agent, nome, contato e email não foram usados anteriormente
     */
    async validarEContarCliqueNaVenda(afiliado, produto, venda, linkTracking) {
        const transaction = await sequelize.transaction();
        try {
            // Buscar dados da venda para validação
            const trackingData = venda.tracking_data || {};
            const ipAddress = trackingData.ip || venda.ip_address || 'unknown';
            const userAgent = trackingData.user_agent || trackingData.userAgent || 'unknown';
            const nomeCliente = venda.cliente_nome || '';
            const contatoCliente = venda.cliente_telefone || '';
            const emailCliente = venda.cliente_email || '';
            
            // Validar duplicatas usando o serviço de detecção de fraude
            const fraudeDetectionService = require('./fraudeDetectionService');
            const validacaoDuplicatas = await fraudeDetectionService.verificarDuplicatasCliente(
                nomeCliente,
                contatoCliente,
                emailCliente,
                ipAddress,
                userAgent
            );
            
            if (!validacaoDuplicatas.valido) {
                console.log(`⚠️ Clique inválido: ${validacaoDuplicatas.motivo}`);
                await transaction.commit();
                return { valido: false, motivo: validacaoDuplicatas.motivo };
            }
            
            // Validar clique completo (IP, user agent, fingerprint, etc)
            const fingerprint = trackingData.fingerprint || fraudeDetectionService.gerarFingerprint(userAgent, ipAddress, trackingData.referer);
            const dadosFraude = {
                ipAddress,
                userAgent,
                afiliadoId: afiliado.id,
                produtoId: produto.id,
                referer: trackingData.referer || null,
                fingerprint,
                screen_info: trackingData.screen_info || null,
                timezone: trackingData.timezone || null,
                language: trackingData.language || null
            };
            
            const validacaoCompleta = await fraudeDetectionService.validarClique(dadosFraude);
            
            if (!validacaoCompleta.valido) {
                console.log(`⚠️ Clique inválido: ${validacaoCompleta.motivo}`);
                await transaction.commit();
                return { valido: false, motivo: validacaoCompleta.motivo };
            }
            
            // Criar registro de clique válido
            const cliqueValido = await CliqueValidoAfiliado.create({
                afiliado_id: afiliado.id,
                link_tracking_id: linkTracking.id,
                produto_id: produto.id,
                ip_address: ipAddress,
                user_agent: userAgent,
                navegador: validacaoCompleta.navegador,
                sistema_operacional: validacaoCompleta.sistema,
                dispositivo: validacaoCompleta.dispositivo,
                fingerprint: validacaoCompleta.fingerprint,
                valido: true,
                motivo_rejeicao: null,
                referer: trackingData.referer || null,
                session_id: trackingData.sessionId || null
            }, { transaction });
            
            // Incrementar cliques válidos no link tracking
            await linkTracking.increment('cliques', { transaction });
            await linkTracking.update({
                ultimo_clique: new Date()
            }, { transaction });
            
            // Incrementar total de cliques do afiliado
            await afiliado.increment('total_cliques', { transaction });
            await afiliado.update({
                ultima_atividade: new Date()
            }, { transaction });
            
            await transaction.commit();
            console.log(`✅ Clique válido registrado e contabilizado para venda ${venda.id}`);
            
            // Verificar se deve converter cliques em comissão (10 cliques válidos + 2 vendas de 150MZN)
            await this.verificarConversaoCliquesEmComissao(afiliado.id, produto.id, linkTracking.id);
            
            return { valido: true, cliqueValido };
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao validar e contar clique na venda:', error);
            // Não falhar o processamento da venda por erro no clique
            return { valido: false, motivo: error.message };
        }
    }

    /**
     * Verificar se deve converter cliques em comissão
     * Regra: 10 cliques válidos + pelo menos 2 vendas de no mínimo 150MZN cada = 1MZN de comissão
     */
    async verificarConversaoCliquesEmComissao(afiliadoId, produtoId, linkTrackingId) {
        try {
            const afiliadoClickService = require('./afiliadoClickService');
            const linkTracking = await LinkTracking.findByPk(linkTrackingId);
            
            if (!linkTracking) return;
            
            // Buscar cliques válidos não pagos
            const cliquesValidosNaoPagos = await CliqueValidoAfiliado.findAll({
                where: {
                    afiliado_id: afiliadoId,
                    produto_id: produtoId,
                    link_tracking_id: linkTrackingId,
                    valido: true
                },
                order: [['created_at', 'ASC']]
            });
            
            const totalCliquesValidos = cliquesValidosNaoPagos.length;
            
            // Verificar se há pelo menos 10 cliques válidos
            if (totalCliquesValidos < 10) {
                return; // Ainda não atingiu 10 cliques
            }
            
            // Buscar vendas do afiliado para este produto com valor >= 150MZN
            const vendasQualificadas = await VendaAfiliado.findAll({
                where: {
                    afiliado_id: afiliadoId,
                    status: 'pago'
                },
                include: [{
                    model: Venda,
                    as: 'venda',
                    where: {
                        produto_id: produtoId
                    },
                    required: true
                }],
                order: [['created_at', 'DESC']]
            });
            
            // Filtrar vendas com valor >= 150MZN
            const vendas150MZN = vendasQualificadas.filter(va => {
                const valorVenda = parseFloat(va.valor_venda || 0);
                return valorVenda >= 150;
            });
            
            // Verificar se há pelo menos 2 vendas de 150MZN
            if (vendas150MZN.length < 2) {
                console.log(`⚠️ Cliques não convertidos: ${totalCliquesValidos} cliques válidos, mas apenas ${vendas150MZN.length} venda(s) de 150MZN (mínimo: 2)`);
                return; // Não atende aos requisitos
            }
            
            // Calcular quantos lotes de 10 cliques podem ser convertidos
            const totalLotes = Math.floor(totalCliquesValidos / 10);
            const cliquesParaPagar = totalLotes * 10;
            const valorCredito = totalLotes * 1.00; // 1MZN por lote de 10 cliques
            
            if (cliquesParaPagar > 0) {
                const transaction = await sequelize.transaction();
                try {
                    // Marcar cliques como pagos
                    const cliquesParaMarcar = cliquesValidosNaoPagos.slice(0, cliquesParaPagar);
                    const cliquesIds = cliquesParaMarcar.map(c => c.id);
                    
                    await CliqueValidoAfiliado.update(
                        { valido: false }, // Marcar como processado
                        {
                            where: { id: { [Op.in]: cliquesIds } },
                            transaction
                        }
                    );
                    
                    // Atualizar link tracking
                    await linkTracking.increment('cliques_pagos', { by: cliquesParaPagar, transaction });
                    await linkTracking.increment('creditos_gerados', { by: valorCredito, transaction });
                    
                    // Creditar comissão no afiliado
                    const afiliado = await Afiliado.findByPk(afiliadoId, { transaction });
                    await afiliado.increment('creditos_cliques', { by: valorCredito, transaction });
                    await afiliado.increment('saldo_disponivel', { by: valorCredito, transaction });
                    
                    await transaction.commit();
                    console.log(`✅ ${cliquesParaPagar} cliques convertidos em MZN ${valorCredito.toFixed(2)} de comissão para afiliado ${afiliadoId}`);
                } catch (error) {
                    await transaction.rollback();
                    console.error('❌ Erro ao converter cliques em comissão:', error);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao verificar conversão de cliques:', error);
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

    /**
     * Enviar notificação para afiliado sobre nova venda
     */
    async enviarNotificacaoVendaAfiliado(afiliado, produto, vendaAfiliado, valorComissao) {
        try {
            // Se o afiliado for um vendedor, enviar notificação para ele
            if (afiliado.vendedor_id) {
                const vendedor = await Usuario.findByPk(afiliado.vendedor_id);
                if (vendedor) {
                    // Criar notificação no painel
                    await Notificacao.create({
                        vendedor_id: vendedor.id,
                        tipo: 'venda_afiliado',
                        titulo: '💰 Nova Venda de Afiliado!',
                        mensagem: `Você recebeu uma nova venda através do seu link de afiliado!\n\n` +
                                 `📦 Produto: ${produto?.nome || 'N/A'}\n` +
                                 `💵 Comissão: MZN ${parseFloat(valorComissao).toFixed(2)}\n` +
                                 `📊 Status: Pendente (acumulando para liberação)`,
                        prioridade: 'alta',
                        status: 'unread',
                        url_redirecionamento: '/afiliados-transacoes.html',
                        dados_extras: {
                            produto_id: produto?.id,
                            produto_nome: produto?.nome,
                            venda_afiliado_id: vendaAfiliado.id,
                            valor_comissao: valorComissao
                        }
                    });

                    // Atualizar contador de notificações
                    await Usuario.increment('notificacoes', {
                        where: { id: vendedor.id }
                    });

                    console.log(`✅ Notificação de venda enviada para afiliado ${afiliado.nome}`);
                }
            }

            // Enviar email e WhatsApp (se configurado)
            try {
                if (afiliado.vendedor_id) {
                    const vendedor = await Usuario.findByPk(afiliado.vendedor_id);
                    if (vendedor) {
                        // Enviar email
                        if (vendedor.email) {
                            try {
                                const emailService = require('./professionalEmailService');
                                await emailService.enviarEmail({
                                    to: vendedor.email,
                                    subject: '💰 Nova Venda de Afiliado - RatixPay',
                                    template: 'venda_afiliado',
                                    data: {
                                        nome: vendedor.nome_completo || vendedor.nome,
                                        produto_nome: produto?.nome || 'N/A',
                                        valor_comissao: parseFloat(valorComissao).toFixed(2),
                                        link_transacoes: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/afiliados-transacoes.html`
                                    }
                                }).catch(err => console.warn('⚠️ Erro ao enviar email para afiliado:', err));
                            } catch (emailErr) {
                                console.warn('⚠️ Erro ao enviar email (não crítico):', emailErr);
                            }
                        }

                        // Enviar WhatsApp
                        if (vendedor.telefone) {
                            try {
                                const whatsappManager = require('./whatsappManager');
                                const mensagem = `💰 *Nova Venda de Afiliado!*\n\n` +
                                              `Olá ${vendedor.nome_completo || vendedor.nome},\n\n` +
                                              `Você recebeu uma nova venda através do seu link de afiliado!\n\n` +
                                              `📦 *Produto:* ${produto?.nome || 'N/A'}\n` +
                                              `💵 *Comissão:* MZN ${parseFloat(valorComissao).toFixed(2)}\n` +
                                              `📊 *Status:* Pendente (acumulando para liberação)\n\n` +
                                              `Acompanhe suas vendas em: ${process.env.FRONTEND_URL || 'http://localhost:4000'}/afiliados-transacoes.html`;
                                
                                await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default')
                                    .catch(err => console.warn('⚠️ Erro ao enviar WhatsApp para afiliado:', err));
                            } catch (whatsappErr) {
                                console.warn('⚠️ Erro ao enviar WhatsApp (não crítico):', whatsappErr);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn('⚠️ Erro ao enviar email/WhatsApp para afiliado (não crítico):', error);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de venda para afiliado:', error);
            // Não falhar o processamento da venda por erro na notificação
        }
    }

    /**
     * Enviar notificação para afiliado sobre comissões aprovadas
     */
    async enviarNotificacaoComissoesAprovadas(afiliado, valorTotal) {
        try {
            // Se o afiliado for um vendedor, enviar notificação para ele
            if (afiliado.vendedor_id) {
                const vendedor = await Usuario.findByPk(afiliado.vendedor_id);
                if (vendedor) {
                    // Criar notificação no painel
                    await Notificacao.create({
                        vendedor_id: vendedor.id,
                        tipo: 'comissao_aprovada',
                        titulo: '✅ Comissões Aprovadas e Disponíveis!',
                        mensagem: `Suas comissões de afiliado foram aprovadas e estão disponíveis para saque!\n\n` +
                                 `💰 Valor Total: MZN ${parseFloat(valorTotal).toFixed(2)}\n` +
                                 `📊 Status: Aprovado\n` +
                                 `💳 As comissões foram creditadas na sua conta e estão disponíveis para saque.`,
                        prioridade: 'alta',
                        status: 'unread',
                        url_redirecionamento: '/afiliados-transacoes.html',
                        dados_extras: {
                            valor_total: valorTotal,
                            data_aprovacao: new Date().toISOString()
                        }
                    });

                    // Atualizar contador de notificações
                    await Usuario.increment('notificacoes', {
                        where: { id: vendedor.id }
                    });

                    console.log(`✅ Notificação de comissões aprovadas enviada para afiliado ${afiliado.nome}`);

                    // Enviar email
                    try {
                        if (vendedor.email) {
                            const emailService = require('./professionalEmailService');
                            await emailService.enviarEmail({
                                to: vendedor.email,
                                subject: '✅ Comissões de Afiliado Aprovadas - RatixPay',
                                template: 'comissao_aprovada',
                                data: {
                                    nome: vendedor.nome_completo || vendedor.nome,
                                    valor_total: parseFloat(valorTotal).toFixed(2),
                                    link_transacoes: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/afiliados-transacoes.html`,
                                    link_saque: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/solicitar-saque.html`
                                }
                            }).catch(err => console.warn('⚠️ Erro ao enviar email de comissão aprovada:', err));
                        }
                    } catch (emailError) {
                        console.warn('⚠️ Erro ao enviar email de comissão aprovada (não crítico):', emailError);
                    }

                    // Enviar WhatsApp
                    try {
                        if (vendedor.telefone) {
                            const whatsappManager = require('./whatsappManager');
                            const mensagem = `✅ *Comissões Aprovadas e Disponíveis!*\n\n` +
                                          `Olá ${vendedor.nome_completo || vendedor.nome},\n\n` +
                                          `Suas comissões de afiliado foram aprovadas e estão disponíveis para saque!\n\n` +
                                          `💰 *Valor Total:* MZN ${parseFloat(valorTotal).toFixed(2)}\n` +
                                          `📊 *Status:* Aprovado\n\n` +
                                          `💳 As comissões foram creditadas na sua conta e estão disponíveis para saque.\n\n` +
                                          `Acompanhe suas transações: ${process.env.FRONTEND_URL || 'http://localhost:4000'}/afiliados-transacoes.html\n` +
                                          `Solicitar saque: ${process.env.FRONTEND_URL || 'http://localhost:4000'}/solicitar-saque.html`;
                            
                            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default')
                                .catch(err => console.warn('⚠️ Erro ao enviar WhatsApp de comissão aprovada:', err));
                        }
                    } catch (whatsappError) {
                        console.warn('⚠️ Erro ao enviar WhatsApp de comissão aprovada (não crítico):', whatsappError);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de comissões aprovadas:', error);
            // Não falhar o processamento por erro na notificação
        }
    }
}

module.exports = new AfiliadoVendaService();

