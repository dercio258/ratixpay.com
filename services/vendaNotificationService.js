/**
 * Serviço de Notificações de Vendas
 * Gerencia notificações automáticas para o painel do vendedor
 */

const { Venda, Produto, Usuario, Notificacao } = require('../config/database');
const professionalEmailService = require('./professionalEmailService');
const emailMonitorService = require('./emailMonitorService');

class VendaNotificationService {
    constructor() {
        this.emailService = professionalEmailService;
        this.initializeServices();
    }

    /**
     * Formatar valor monetário de forma segura e robusta
     * @param {any} valor - Valor a ser formatado
     * @returns {string} Valor formatado com 2 casas decimais
     */
    formatarValorMonetario(valor) {
        try {
            // Log para debug
            console.log('🔍 Formatando valor monetário:', { valor, tipo: typeof valor });
            
            // Tratar diferentes tipos de entrada
            let valorNumerico;
            
            if (valor === null || valor === undefined || valor === '') {
                console.log('⚠️ Valor nulo/indefinido, retornando 0,00 MZN');
                return '0,00 MZN';
            }
            
            if (typeof valor === 'string') {
                // Remover caracteres não numéricos exceto vírgula e ponto
                const valorLimpo = valor.replace(/[^\d,.-]/g, '');
                valorNumerico = parseFloat(valorLimpo.replace(',', '.'));
            } else if (typeof valor === 'number') {
                valorNumerico = valor;
            } else {
                valorNumerico = parseFloat(valor);
            }
            
            if (isNaN(valorNumerico) || valorNumerico < 0) {
                console.log('⚠️ Valor inválido ou negativo, retornando 0,00 MZN');
                return '0,00 MZN';
            }
            
            // Formatar com 2 casas decimais e separador de milhares em formato moçambicano
            const valorFormatado = valorNumerico.toLocaleString('pt-MZ', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            
            // Adicionar a moeda MZN
            const valorComMoeda = `${valorFormatado} MZN`;
            
            console.log('✅ Valor formatado:', valorComMoeda);
            return valorComMoeda;
        } catch (error) {
            console.error('❌ Erro ao formatar valor monetário:', error);
            return '0,00 MZN';
        }
    }

    /**
     * Obter valor pago do produto de forma segura
     * @param {Object} venda - Objeto da venda
     * @param {Object} produto - Objeto do produto
     * @returns {Object} Objeto com valor pago e valor formatado
     */
    obterValorPagoProduto(venda, produto) {
        try {
            console.log('🔍 Obtendo valor pago do produto:', {
                venda_id: venda?.id,
                produto_id: produto?.id,
                valor_total_pago: venda?.valor_total_pago,
                paid_amount: venda?.paid_amount,
                pagamento_valor: venda?.pagamento_valor,
                valor_final: venda?.valor_final,
                venda_valor: venda?.valor,
                produto_preco: produto?.preco
            });

            // Prioridade: valor_total_pago > paid_amount (e2Payments) > valor_final > pagamento_valor > valor (calculando total) > produto.preco
            let valorPago = 0;
            let fonteValor = '';

            // Verificar se há valor_total_pago (valor total pago pelo cliente com desconto) - maior prioridade
            if (venda?.valor_total_pago && venda.valor_total_pago > 0) {
                valorPago = parseFloat(venda.valor_total_pago);
                fonteValor = 'valor_total_pago';
            } else if (venda?.paid_amount && venda.paid_amount > 0) {
                valorPago = venda.paid_amount;
                fonteValor = 'paid_amount_e2payments';
            } else if (venda?.valor_final && venda.valor_final > 0) {
                valorPago = venda.valor_final;
                fonteValor = 'valor_final';
            } else if (venda?.pagamento_valor && venda.pagamento_valor > 0) {
                valorPago = venda.pagamento_valor;
                fonteValor = 'pagamento_valor';
            } else if (venda?.valor && venda.valor > 0) {
                // IMPORTANTE: venda.valor é 90% do valor total pago (com desconto)
                // Então o valor total pago = valor / 0.9
                valorPago = parseFloat((parseFloat(venda.valor) / 0.9).toFixed(2));
                fonteValor = 'valor_calculado_total';
            } else if (produto?.preco && produto.preco > 0) {
                valorPago = produto.preco;
                fonteValor = 'produto_preco';
            } else {
                console.log('⚠️ Nenhum valor válido encontrado, usando 0');
                valorPago = 0;
                fonteValor = 'default';
            }

            const valorFormatado = this.formatarValorMonetario(valorPago);

            console.log('✅ Valor pago obtido:', {
                valor: valorPago,
                formatado: valorFormatado,
                fonte: fonteValor,
                venda_valor_original: venda?.valor
            });

            return {
                valor: valorPago,
                valorFormatado: valorFormatado,
                fonte: fonteValor
            };
        } catch (error) {
            console.error('❌ Erro ao obter valor pago do produto:', error);
            return {
                valor: 0,
                valorFormatado: '0,00 MZN',
                fonte: 'error'
            };
        }
    }

    /**
     * Inicializar serviços
     */
    async initializeServices() {
        try {
            // Serviços já estão inicializados como instâncias globais
            console.log('✅ Serviços de notificação inicializados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar serviços:', error);
        }
    }

    /**
     * Enviar notificação automática de conteúdo pronto para cliente
     * @param {string} vendaId - ID da venda
     */
    async enviarNotificacaoConteudoPronto(vendaId) {
        try {
            console.log(`📦 Enviando notificação de conteúdo pronto: ${vendaId}`);

            // Verificar se é um número (public_id) ou UUID
            let venda;
            if (/^\d+$/.test(vendaId)) {
                // É um número, buscar pelo public_id
                console.log(`🔍 Buscando venda pelo public_id: ${vendaId}`);
                venda = await Venda.findOne({
                    where: { public_id: vendaId },
                    include: [{
                        model: Produto,
                        as: 'produto'
                    }]
                });
            } else {
                // É um UUID, buscar pelo id
                console.log(`🔍 Buscando venda pelo id (UUID): ${vendaId}`);
                venda = await Venda.findByPk(vendaId, {
                    include: [{
                        model: Produto,
                        as: 'produto'
                    }]
                });
            }
            
            console.log('🔍 Venda encontrada:', venda ? 'Sim' : 'Não');
            if (venda) {
                console.log('🔍 Produto encontrado:', venda.produto ? 'Sim' : 'Não');
                if (venda.produto) {
                    console.log('🔍 Link do conteúdo:', venda.produto.link_conteudo ? 'Sim' : 'Não');
                }
            }

            if (!venda) {
                throw new Error('Venda não encontrada');
            }

            if (!venda.produto) {
                throw new Error('Produto não encontrado para a venda');
            }

            // Verificar se o produto tem conteúdo
            if (!venda.produto.link_conteudo) {
                console.log('⚠️ Produto não tem conteúdo disponível ainda - aguardando vendedor adicionar conteúdo');
                // Criar notificação para o vendedor sobre pendência de conteúdo
                await this.notificarVendedorConteudoPendente(venda);
                return;
            }

            // Buscar vendas relacionadas (order bump)
            const vendasRelacionadas = await this.buscarVendasRelacionadas(venda);
            console.log(`🔍 Vendas relacionadas para cliente: ${vendasRelacionadas.length}`);

            // Preparar dados da notificação
            const dadosNotificacao = {
                venda: {
                    id: venda.id,
                    vendedor_id: venda.vendedor_id, // Incluir vendedor_id da venda
                    cliente_nome: venda.cliente_nome,
                    cliente_email: venda.cliente_email,
                    cliente_telefone: venda.cliente_telefone,
                    cliente_whatsapp: venda.cliente_whatsapp,
                    pagamento_valor: venda.pagamento_valor || venda.valor,
                    pagamento_transacao_id: venda.pagamento_transacao_id,
                    pagamento_referencia: venda.pagamento_referencia,
                    numero_pedido: venda.numero_pedido,
                    data_venda: venda.data_venda,
                    created_at: venda.created_at
                },
                produto: {
                    id: venda.produto.id,
                    nome: venda.produto.nome,
                    link_conteudo: venda.produto.link_conteudo,
                    tipo: venda.produto.tipo,
                    vendedor_id: venda.produto.vendedor_id || venda.vendedor_id, // Incluir vendedor_id do produto ou da venda
                    preco: venda.produto.preco,
                    expert_id: venda.produto.expert_id
                },
                vendasRelacionadas: vendasRelacionadas,
                temOrderBump: vendasRelacionadas.length > 0
            };

            // Enviar notificações para o cliente - PRODUTO PRINCIPAL PRIMEIRO
            console.log('📧 Iniciando envio de notificações para o cliente...');
            console.log('📧 Email do cliente:', venda.cliente_email);
            console.log('📧 Telefone do cliente:', venda.cliente_telefone);
            
            // Validar dados essenciais antes de enviar
            if (!venda || !venda.cliente_email) {
                console.warn('⚠️ Cliente não tem email configurado. Pulando envio de email.');
            } else {
                // 1. Enviar email do PRODUTO PRINCIPAL primeiro
            try {
                    await this.enviarEmailClienteProdutoPrincipal(dadosNotificacao);
                    console.log('✅ Email do produto principal enviado para cliente');
            } catch (emailError) {
                    console.error('❌ Erro ao enviar email do produto principal:', emailError);
                    // Continuar sem falhar o processo
                }

                // 2. Produtos bônus agora são incluídos no email principal (não enviar emails separados)
                // Os produtos bônus serão incluídos no email de confirmação de compra
            }
            
            // WhatsApp do cliente é enviado via função principal enviarProdutoViaWhatsApp em routes/pagamento.js
            // Não duplicar envio aqui para evitar mensagens duplicadas

            console.log('✅ Notificações de conteúdo pronto processadas');

        } catch (error) {
            console.error('❌ Erro ao enviar notificação de conteúdo pronto:', error);
            throw error;
        }
    }


    /**
     * Enviar notificação automática de nova venda
     * @param {string} vendaId - ID da venda
     */
    async enviarNotificacaoNovaVenda(vendaId) {
        try {
            console.log(`🔔 Enviando notificação de nova venda: ${vendaId}`);

            // Buscar dados da venda (recarregar do banco para garantir dados atualizados)
            const venda = await Venda.findByPk(vendaId, {
                include: [{
                    model: Produto,
                    as: 'produto',
                    required: false
                }]
            });

            if (!venda) {
                console.error(`❌ Venda não encontrada com ID: ${vendaId}`);
                throw new Error(`Venda não encontrada com ID: ${vendaId}`);
            }
            
            // Log detalhado para debug
            console.log(`🔍 Dados da venda encontrada:`, {
                id: venda.id,
                status: venda.status,
                vendedor_id: venda.vendedor_id,
                produto_id: venda.produto_id,
                tem_produto: !!venda.produto
            });

            // Não enviar emails para vendas com status Pendente - apenas Aprovada ou Pago
            // Incluir todas as variações de status aprovado (incluindo APROVADO em maiúsculas)
            const statusValidos = ['Aprovada', 'Aprovado', 'APROVADO', 'APROVADA', 'aprovada', 'aprovado', 'Pago', 'pago', 'PAGO', 'approved', 'paid'];
            if (venda.status === 'Pendente' || !statusValidos.includes(venda.status)) {
                console.log(`⚠️ Venda ${vendaId} tem status inválido para notificação: ${venda.status}`);
                console.log(`ℹ️ Emails serão enviados apenas quando o status for: ${statusValidos.join(', ')}`);
                console.log(`🔍 Status atual da venda: ${venda.status}`);
                return null;
            }
            
            // Log para debug
            console.log(`🔍 Status da venda para notificação: ${venda.status}`);
            console.log(`🔍 Vendedor ID: ${venda.vendedor_id}`);

            // Buscar dados do vendedor (incluindo push_subscription)
            if (!venda.vendedor_id) {
                console.error(`❌ Venda ${vendaId} não tem vendedor_id definido`);
                throw new Error('Venda não tem vendedor_id definido');
            }
            
            const vendedor = await Usuario.findByPk(venda.vendedor_id, {
                attributes: ['id', 'email', 'telefone', 'role', 'push_subscription', 'nome_completo', 'nome']
            });

            if (!vendedor) {
                console.error(`❌ Vendedor não encontrado com ID: ${venda.vendedor_id}`);
                throw new Error(`Vendedor não encontrado com ID: ${venda.vendedor_id}`);
            }
            
            console.log(`✅ Vendedor encontrado: ${vendedor.nome_completo || vendedor.nome || vendedor.email}`);

            // Não enviar notificações para códigos (apenas vendedores)
            if (vendedor.role === 'codigo') {
                console.log(`⚠️ Usuário ${vendedor.id} é um código, pulando notificações push`);
            }

            // Verificar se é uma venda com order bump (buscar vendas relacionadas)
            const vendasRelacionadas = await this.buscarVendasRelacionadas(venda);
            console.log(`🔍 Vendas relacionadas encontradas: ${vendasRelacionadas.length}`);

            // Preparar dados da notificação (com suporte a order bump)
            const dadosNotificacao = this.prepararDadosNotificacaoComOrderBump(venda, vendedor, vendasRelacionadas);

            // Criar notificação no painel
            const notificacao = await this.criarNotificacaoPainel(vendedor.id, dadosNotificacao);

            // Enviar por email
            await this.enviarEmailVendedor(vendedor, dadosNotificacao);

            // Enviar por WhatsApp (apenas uma notificação completa)
            await this.enviarWhatsAppVendedor(vendedor, dadosNotificacao);

            // Removido: enviarWhatsAppBotVendedor - estava causando duplicação
            // A função enviarWhatsAppVendedor já envia notificação completa com todos os dados

            // Enviar push notification (apenas para vendedores, não códigos)
            if (vendedor.role !== 'codigo') {
                await this.enviarPushNotificationVenda(vendedor, dadosNotificacao, venda);
            }

            // Atualizar contador de notificações
            await this.atualizarContadorNotificacoes(vendedor.id);

            console.log(`✅ Notificação de venda enviada para vendedor: ${vendedor.nome_completo}`);
            return notificacao;

        } catch (error) {
            console.error('❌ Erro ao enviar notificação de venda:', error);
            throw error;
        }
    }

    /**
     * Buscar vendas relacionadas (order bump) - ordenadas por ordem de criação
     */
    async buscarVendasRelacionadas(venda) {
        try {
            // Buscar vendas com a mesma referência de pagamento (sem filtrar por tipo_venda que não existe)
            const vendasRelacionadas = await Venda.findAll({
                where: {
                    referencia_pagamento: venda.referencia_pagamento,
                    vendedor_id: venda.vendedor_id,
                    id: { [require('sequelize').Op.ne]: venda.id } // Excluir a venda atual
                },
                include: [{
                    model: Produto,
                    as: 'produto'
                }],
                order: [
                    ['created_at', 'ASC'] // Ordem de criação (primeiro orderbump1, depois orderbump2...)
                ]
            });

            // Filtrar apenas as vendas que são order bumps (verificar nas observações)
            const orderBumps = vendasRelacionadas.filter(v => 
                v.observacoes && v.observacoes.includes('Order Bump')
            );

            // Ordenar também por ordem extraída das observações (Order Bump 1, 2, 3...)
            orderBumps.sort((a, b) => {
                const ordemA = this.extrairOrdemOrderBump(a.observacoes);
                const ordemB = this.extrairOrdemOrderBump(b.observacoes);
                if (ordemA !== null && ordemB !== null) {
                    return ordemA - ordemB;
                }
                // Se não conseguir extrair ordem, usar created_at
                return new Date(a.created_at) - new Date(b.created_at);
            });

            console.log(`🔍 Vendas relacionadas encontradas (ordenadas): ${orderBumps.length}`);
            orderBumps.forEach((v, index) => {
                console.log(`   📦 Order Bump ${index + 1}: ${v.produto?.nome || 'Produto'} - Link: ${v.produto?.link_conteudo || 'SEM LINK'}`);
            });
            return orderBumps;
        } catch (error) {
            console.error('❌ Erro ao buscar vendas relacionadas:', error);
            return [];
        }
    }

    /**
     * Extrair ordem do orderbump das observações
     */
    extrairOrdemOrderBump(observacoes) {
        if (!observacoes) return null;
        const match = observacoes.match(/Order Bump (\d+):/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Preparar dados da notificação com suporte a order bump
     */
    prepararDadosNotificacaoComOrderBump(venda, vendedor, vendasRelacionadas) {
        // Calcular valor total (venda principal + order bumps)
        const valorVendaPrincipal = this.obterValorPagoProduto(venda, venda.produto);
        let valorTotal = valorVendaPrincipal.valor;
        let valorTotalFormatado = valorVendaPrincipal.valorFormatado;
        
        // Somar valores dos order bumps
        let produtosOrderBump = [];
        if (vendasRelacionadas.length > 0) {
            vendasRelacionadas.forEach(vendaRelacionada => {
                const valorRelacionado = this.obterValorPagoProduto(vendaRelacionada, vendaRelacionada.produto);
                valorTotal += valorRelacionado.valor;
                produtosOrderBump.push({
                    id: vendaRelacionada.produto?.id || vendaRelacionada.produto_id,
                    nome: vendaRelacionada.produto?.nome || 'Produto',
                    valor: valorRelacionado.valor,
                    valor_formatado: valorRelacionado.valorFormatado,
                    link_conteudo: vendaRelacionada.produto?.link_conteudo || ''
                });
            });
            
            // Reformatar valor total
            valorTotalFormatado = this.formatarValorMonetario(valorTotal);
        }

        // Calcular valor que o vendedor receberá (90% do total)
        const valorVendedor = valorTotal * 0.90;
        const valorVendedorFormatado = this.formatarValorMonetario(valorVendedor);

        console.log('🔍 Preparando dados com order bump:', {
            valor_principal: valorVendaPrincipal.valor,
            valor_order_bumps: vendasRelacionadas.length,
            valor_total: valorTotal,
            valor_vendedor: valorVendedor,
            produtos_order_bump: produtosOrderBump.length
        });

        const nomeProduto = venda.produto?.nome || 'Produto';
        const nomeCliente = venda.cliente_nome || 'Cliente';
        const statusPagamento = venda.pagamento_status || 'Pendente';
        
        // Usar WhatsApp do cliente se disponível, senão usar telefone
        const whatsappCliente = venda.cliente_whatsapp || venda.cliente_telefone || 'Não informado';

        // Usar hora atual no título para evitar agrupamento de mensagens
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        return {
            titulo: `Nova Venda Realizada! - ${horaAtual}`,
            mensagem: `${nomeCliente} comprou "${nomeProduto}" por ${valorTotalFormatado}. Você receberá ${valorVendedorFormatado} (90%). Status: ${statusPagamento}`,
            tipo: 'venda',
            prioridade: 'alta',
            temOrderBump: vendasRelacionadas.length > 0,
            produtosOrderBump: produtosOrderBump,
            dadosExtras: {
                venda_id: venda.id,
                produto_id: venda.produto_id,
                produto_nome: nomeProduto,
                cliente_nome: nomeCliente,
                cliente_email: venda.cliente_email,
                cliente_whatsapp: whatsappCliente,
                valor: valorTotal,
                valor_formatado: valorTotalFormatado,
                valor_recebido: valorVendedorFormatado,
                fonte_valor: valorVendaPrincipal.fonte,
                status_pagamento: statusPagamento,
                data_venda: venda.data_venda || venda.created_at,
                metodo_pagamento: venda.pagamento_metodo || 'Não informado',
                numero_pedido: venda.numero_pedido || (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6 ? venda.pagamento_transacao_id : null) || (venda.pagamento_referencia && venda.pagamento_referencia.length === 6 ? venda.pagamento_referencia : null) || venda.id
            }
        };
    }

    /**
     * Preparar dados da notificação
     */
    prepararDadosNotificacao(venda, vendedor) {
        // Usar o novo método para obter valor pago de forma segura
        const valorPago = this.obterValorPagoProduto(venda, venda.produto);
        
        // Calcular valor que o vendedor receberá (90% do valor total)
        const valorVendedor = valorPago.valor * 0.90; // 90% do valor total
        const valorVendedorFormatado = this.formatarValorMonetario(valorVendedor);
        
        console.log('🔍 Preparando dados de notificação:', {
            valor_venda_total: valorPago.valor,
            valor_vendedor: valorVendedor,
            valor_vendedor_formatado: valorVendedorFormatado,
            fonte_valor: valorPago.fonte,
            venda_id: venda.id
        });

        const nomeProduto = venda.produto?.nome || 'Produto';
        const nomeCliente = venda.cliente_nome || 'Cliente';
        const statusPagamento = venda.pagamento_status || 'Pendente';
        
        // Usar WhatsApp do cliente se disponível, senão usar telefone
        const whatsappCliente = venda.cliente_whatsapp || venda.cliente_telefone || 'Não informado';

        // Usar hora atual no título para evitar agrupamento
        const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        return {
            titulo: ` Nova Venda Realizada! - ${horaAtual}`,
            mensagem: `${nomeCliente} comprou "${nomeProduto}" por ${valorPago.valorFormatado}. Você receberá ${valorVendedorFormatado} (90%). Status: ${statusPagamento}`,
            tipo: 'venda',
            prioridade: 'alta',
            dadosExtras: {
                venda_id: venda.id,
                produto_id: venda.produto_id,
                produto_nome: nomeProduto,
                cliente_nome: nomeCliente,
                cliente_email: venda.cliente_email,
                cliente_whatsapp: whatsappCliente,
                valor: valorPago.valor,
                valor_formatado: valorPago.valorFormatado,
                valor_recebido: valorVendedorFormatado, // Valor que o vendedor receberá (90%)
                fonte_valor: valorPago.fonte,
                status_pagamento: statusPagamento,
                data_venda: venda.data_venda || venda.created_at,
                metodo_pagamento: venda.pagamento_metodo || 'Não informado',
                numero_pedido: venda.numero_pedido || (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6 ? venda.pagamento_transacao_id : null) || (venda.pagamento_referencia && venda.pagamento_referencia.length === 6 ? venda.pagamento_referencia : null) || venda.id
            }
        };
    }

    /**
     * Criar notificação no painel
     */
    async criarNotificacaoPainel(vendedorId, dadosNotificacao) {
        try {
            const notificacao = await Notificacao.create({
                vendedor_id: vendedorId,
                tipo: dadosNotificacao.tipo,
                titulo: dadosNotificacao.titulo,
                mensagem: dadosNotificacao.mensagem,
                prioridade: dadosNotificacao.prioridade,
                status: 'unread',
                enviada: true,
                dados_extras: dadosNotificacao.dadosExtras,
                url_redirecionamento: '/gestao-vendas.html'
            });

            console.log(`✅ Notificação criada no painel: ${notificacao.id}`);
            return notificacao;

        } catch (error) {
            console.error('❌ Erro ao criar notificação no painel:', error);
            throw error;
        }
    }

    /**
     * Enviar email do PRODUTO PRINCIPAL para o cliente
     * @param {Object} dadosNotificacao - Dados da notificação
     */
    async enviarEmailClienteProdutoPrincipal(dadosNotificacao) {
        try {
            console.log('📧 Enviando email do PRODUTO PRINCIPAL...');
            const { venda, produto } = dadosNotificacao;
            
            // Validar dados essenciais
            if (!venda || !produto) {
                console.error('❌ Dados incompletos para envio de email do produto principal');
                return;
            }
            
            if (!venda.cliente_email) {
                console.log('⚠️ Cliente não tem email configurado');
                return;
            }

            // Buscar dados do vendedor
            let vendedor = null;
            const vendedorId = produto.vendedor_id || venda.vendedor_id;
            if (vendedorId) {
                vendedor = await Usuario.findByPk(vendedorId);
            }

            // Buscar expert se houver
            let expert = null;
            if (produto.expert_id) {
                const { Expert } = require('../config/database');
                expert = await Expert.findByPk(produto.expert_id);
            }

            const pedidoId = venda.numero_pedido || venda.pagamento_transacao_id || venda.pagamento_referencia || venda.id;
            const valorPago = this.obterValorPagoProduto(venda, produto);
            
            // Carregar template
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-confirmacao-compra.html');
            
            let emailContent = '';
            if (fs.existsSync(templatePath)) {
                emailContent = fs.readFileSync(templatePath, 'utf8');
            } else {
                emailContent = this.getFallbackClienteEmailTemplate(venda, produto, vendedor, pedidoId);
            }

            const contatoNome = expert ? expert.nome : (vendedor?.nome_completo || 'Vendedor');
            const contatoEmail = expert ? expert.email : (vendedor?.email || 'suporte@ratixpay.com');
            const vendedorNome = vendedor?.nome_completo || 'Vendedor';

            // Buscar produtos bônus (orderbumps) se existirem
            const vendasRelacionadas = dadosNotificacao.vendasRelacionadas || [];
            
            // Botão para produto principal
            let botoesAcesso = `
                <div class="access-button-container">
                    <a href="${produto.link_conteudo || '#'}" class="access-button">
                        🎯 Clique aqui para acessar o conteúdo
                    </a>
                </div>
            `;
            
            // Adicionar seção de produtos bônus se existirem
            let produtosBonusHtml = '';
            if (vendasRelacionadas && vendasRelacionadas.length > 0) {
                produtosBonusHtml = '<div style="margin-top: 30px; padding-top: 30px; border-top: 2px solid #e0e0e0;"><h3 style="color: #F64C00; margin-bottom: 20px;">🎁 Produtos Bônus Incluídos:</h3>';
                
                vendasRelacionadas.forEach((vendaRel, index) => {
                    const produtoBonus = vendaRel.produto;
                    if (produtoBonus && produtoBonus.link_conteudo) {
                        produtosBonusHtml += `
                            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #f59e0b;">
                                <h4 style="margin: 0 0 10px 0; color: #333;">🎁 Incluindo bônus: ${produtoBonus.nome || 'Produto Bônus'}</h4>
                                <a href="${produtoBonus.link_conteudo}" style="background-color: #f59e0b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: bold; margin-top: 10px;">
                                    📥 Acessar Produto Bônus
                                </a>
                            </div>
                        `;
                    }
                });
                
                produtosBonusHtml += '</div>';
            }

            // Substituir variáveis no template
            const emailFinal = emailContent
                .replace(/{{nome_completo}}/g, venda.cliente_nome || 'Cliente')
                .replace(/{{nome_produto}}/g, produto.nome || 'Produto')
                .replace(/{{valor}}/g, valorPago.valorFormatado || '0,00 MZN')
                .replace(/{{nome_produtor}}/g, contatoNome)
                .replace(/{{nome_vendedor}}/g, vendedorNome)
                .replace(/{{email_produtor}}/g, contatoEmail)
                .replace(/{{url_acesso_produto}}/g, produto.link_conteudo || '#')
                .replace(/{{botoes_acesso}}/g, botoesAcesso)
                .replace(/{{produtos_bonus}}/g, produtosBonusHtml)
                .replace(/{{url_suporte}}/g, 'https://wa.me/258842363948')
                .replace(/{{url_plataforma}}/g, 'https://ratixpay.com')
                .replace(/{{url_termos}}/g, 'https://ratixpay.com/termos');

            const idPedidoFormatado = pedidoId ? 
                (pedidoId.toString().startsWith('TXP_') ? pedidoId : `TXP_${pedidoId}`) : 
                venda.pagamento_transacao_id;
            const assunto = `🎉 Confirmação da compra - ${produto.nome} - ID${idPedidoFormatado}`;
            
            // Enviar email
            const professionalEmailService = require('./professionalEmailService');
            await professionalEmailService.enviarEmailVendas(
                venda.cliente_email,
                assunto,
                emailFinal,
                'confirmacao_compra'
            );
            console.log(`✅ Email do produto principal enviado: ${venda.cliente_email}`);

        } catch (error) {
            console.error('❌ Erro ao enviar email do produto principal:', error);
            throw error;
        }
    }

    /**
     * Enviar email de PRODUTO COMPLEMENTAR (orderbump) para o cliente
     * @param {Object} vendaRelacionada - Venda do produto complementar
     * @param {number} ordem - Ordem do orderbump (1, 2, 3...)
     * @param {string} clienteEmail - Email do cliente
     * @param {string} clienteNome - Nome do cliente
     */
    async enviarEmailClienteProdutoComplementar(vendaRelacionada, ordem, clienteEmail, clienteNome) {
        try {
            console.log(`📧 Enviando email do PRODUTO COMPLEMENTAR ${ordem}...`);
            
            if (!vendaRelacionada || !vendaRelacionada.produto) {
                console.error('❌ Dados incompletos para envio de email do produto complementar');
                return;
            }

            const produto = vendaRelacionada.produto;
            
            if (!produto.link_conteudo) {
                console.log(`⚠️ Produto complementar ${ordem} não tem link de conteúdo`);
                return;
            }

            // Buscar dados do vendedor
            let vendedor = null;
            const vendedorId = produto.vendedor_id || vendaRelacionada.vendedor_id;
            if (vendedorId) {
                vendedor = await Usuario.findByPk(vendedorId);
            }

            // Buscar expert se houver
            let expert = null;
            if (produto.expert_id) {
                const { Expert } = require('../config/database');
                expert = await Expert.findByPk(produto.expert_id);
            }

            const valorPago = this.obterValorPagoProduto(vendaRelacionada, produto);
            const contatoNome = expert ? expert.nome : (vendedor?.nome_completo || 'Vendedor');
            const contatoEmail = expert ? expert.email : (vendedor?.email || 'suporte@ratixpay.com');

            // Carregar template
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-produto-complementar.html');
            
            let emailContent = '';
            if (fs.existsSync(templatePath)) {
                emailContent = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Template fallback para produto complementar
                emailContent = this.getFallbackProdutoComplementarTemplate(
                    clienteNome,
                    produto,
                    valorPago,
                    contatoNome,
                    contatoEmail,
                    ordem
                );
            }

            // Substituir variáveis no template
            const emailFinal = emailContent
                .replace(/{{nome_completo}}/g, clienteNome || 'Cliente')
                .replace(/{{nome_produto}}/g, produto.nome || 'Produto Complementar')
                .replace(/{{valor}}/g, valorPago.valorFormatado || '0,00 MZN')
                .replace(/{{nome_produtor}}/g, contatoNome)
                .replace(/{{email_produtor}}/g, contatoEmail)
                .replace(/{{url_acesso_produto}}/g, produto.link_conteudo || '#')
                .replace(/{{ordem}}/g, ordem.toString())
                .replace(/{{url_suporte}}/g, 'https://wa.me/258842363948')
                .replace(/{{url_plataforma}}/g, 'https://ratixpay.com')
                .replace(/{{url_termos}}/g, 'https://ratixpay.com/termos');

            const assunto = `🎁 Produto Complementar ${ordem} - ${produto.nome}`;
            
            // Enviar email
            const professionalEmailService = require('./professionalEmailService');
            await professionalEmailService.enviarEmailVendas(
                clienteEmail,
                assunto,
                emailFinal,
                'produto_complementar'
            );
            console.log(`✅ Email do produto complementar ${ordem} enviado: ${clienteEmail}`);

        } catch (error) {
            console.error(`❌ Erro ao enviar email do produto complementar ${ordem}:`, error);
            throw error;
        }
    }

    /**
     * Template fallback para produto complementar
     */
    getFallbackProdutoComplementarTemplate(clienteNome, produto, valorPago, contatoNome, contatoEmail, ordem) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Produto Complementar - RatixPay</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🎁 Produto Complementar ${ordem}</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>Olá <strong>${clienteNome}</strong>!</p>
                    <p>Parabéns! Você adquiriu o produto complementar:</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #F64C00;">
                        <h2 style="margin-top: 0; color: #F64C00;">${produto.nome}</h2>
                        <p style="color: #666; margin-bottom: 0;">Valor: <strong>${valorPago.valorFormatado || '0,00 MZN'}</strong></p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${produto.link_conteudo || '#'}" style="background-color: #F64C00; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold;">
                            📥 Acessar Produto Complementar
                        </a>
                    </div>
                    <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                        Este é um produto complementar da sua compra. Guarde este email em local seguro.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="color: #6c757d; font-size: 12px; text-align: center;">
                        Dúvidas? Entre em contato: <a href="mailto:${contatoEmail}" style="color: #F64C00;">${contatoEmail}</a><br>
                        <a href="https://ratixpay.com" style="color: #F64C00;">RatixPay</a> - Sua plataforma de vendas digitais
                    </p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Enviar email de confirmação de compra para o cliente usando template profissional
     * @param {Object} dadosNotificacao - Dados da notificação
     * @deprecated Use enviarEmailClienteProdutoPrincipal e enviarEmailClienteProdutoComplementar
     */
    async enviarEmailClienteConteudoPronto(dadosNotificacao) {
        try {
            console.log('📧 Iniciando envio de email para cliente...');
            const { venda, produto, vendasRelacionadas, temOrderBump } = dadosNotificacao;
            
            // Validar dados essenciais
            if (!venda || !produto) {
                console.error('❌ Dados de notificação incompletos. Venda ou produto não encontrado.');
                console.error('❌ venda:', venda ? 'existe' : 'não existe');
                console.error('❌ produto:', produto ? 'existe' : 'não existe');
                return;
            }
            
            console.log('📧 Dados da venda:', {
                cliente_email: venda.cliente_email,
                cliente_nome: venda.cliente_nome,
                produto_nome: produto.nome,
                produto_id: produto.id,
                vendedor_id: produto.vendedor_id || venda.vendedor_id
            });
            
            if (!venda.cliente_email) {
                console.log('⚠️ Cliente não tem email configurado');
                return;
            }
            
            // Buscar dados do vendedor - tentar múltiplas fontes
            let vendedor = null;
            const vendedorId = produto.vendedor_id || venda.vendedor_id;
            
            if (vendedorId) {
                vendedor = await Usuario.findByPk(vendedorId);
                console.log('🔍 Buscando vendedor com ID:', vendedorId, vendedor ? 'encontrado' : 'não encontrado');
            } else {
                console.warn('⚠️ Produto e venda não têm vendedor_id definido');
            }
            
            // Buscar expert associado ao produto (se houver)
            let expert = null;
            if (produto.expert_id) {
                const { Expert } = require('../config/database');
                expert = await Expert.findByPk(produto.expert_id);
                console.log('🔍 Expert encontrado:', expert ? expert.nome : 'Nenhum');
            }
            
            // Usar numero_pedido (ID do pedido de 6 dígitos) se disponível, senão transactionId
            const pedidoId = venda.numero_pedido || venda.pagamento_transacao_id || venda.pagamento_referencia || venda.id;
            console.log('🔍 ID do pedido usado:', pedidoId);
            
            // Carregar template de confirmação de compra
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-confirmacao-compra.html');
            
            let emailContent = '';
            if (fs.existsSync(templatePath)) {
                emailContent = fs.readFileSync(templatePath, 'utf8');
                console.log('✅ Template principal carregado:', templatePath);
            } else {
                // Fallback para template inline se arquivo não existir
                emailContent = this.getFallbackClienteEmailTemplate(venda, produto, vendedor, pedidoId);
                console.log('⚠️ Template principal não encontrado, usando fallback');
            }
            
            // Validar se emailContent foi gerado corretamente
            if (!emailContent || emailContent.trim().length === 0) {
                console.error('❌ Template de email vazio. Criando template básico...');
                emailContent = this.getFallbackClienteEmailTemplate(venda, produto, vendedor, pedidoId);
            }

            // Debug: Log dos dados da venda
            console.log('🔍 Dados da venda para email:', {
                cliente_nome: venda.cliente_nome,
                produto_nome: produto.nome,
                produto_preco: produto.preco,
                pagamento_valor: venda.pagamento_valor,
                vendedor_nome: vendedor?.nome_completo,
                vendedor_email: vendedor?.email,
                pedido_id: pedidoId
            });

            // Usar o novo método para obter valor pago de forma segura
            const valorPago = this.obterValorPagoProduto(venda, produto);
            console.log(' Valor do produto formatado para email:', valorPago.valorFormatado);

            // Determinar informações de contato (expert ou vendedor)
            const contatoNome = expert ? expert.nome : (vendedor?.nome_completo || 'Vendedor');
            const contatoEmail = expert ? expert.email : (vendedor?.email || 'suporte@ratixpay.com');
            const vendedorNome = vendedor?.nome_completo || 'Vendedor';
            
            // Preparar lista de produtos (principal + order bumps)
            let listaProdutos = produto.nome || 'Produto';
            let botoesAcesso = '';
            
            if (temOrderBump && vendasRelacionadas && vendasRelacionadas.length > 0) {
                // Adicionar produtos de order bump à lista
                const produtosOrderBump = vendasRelacionadas.map(vendaRel => vendaRel.produto?.nome || 'Produto').join(', ');
                listaProdutos += `, ${produtosOrderBump}`;
                
                // Criar botões para cada produto
                botoesAcesso = `
                    <div class="access-button-container">
                        <a href="${produto.link_conteudo || '#'}" class="access-button">
                            🎯 Acessar ${produto.nome}
                        </a>
                    </div>
                `;
                
                vendasRelacionadas.forEach(vendaRel => {
                    if (vendaRel.produto?.link_conteudo) {
                        botoesAcesso += `
                            <div class="access-button-container">
                                <a href="${vendaRel.produto.link_conteudo}" class="access-button">
                                    🎁 Acessar ${vendaRel.produto.nome} (Complementar)
                                </a>
                            </div>
                        `;
                    }
                });
            } else {
                // Botão único para produto principal
                botoesAcesso = `
                    <div class="access-button-container">
                        <a href="${produto.link_conteudo || '#'}" class="access-button">
                            🎯 Clique aqui para acessar o conteúdo
                        </a>
                    </div>
                `;
            }
            
            console.log('📧 Informações de contato para email:', {
                tem_expert: !!expert,
                contato_nome: contatoNome,
                contato_email: contatoEmail,
                vendedor_nome: vendedorNome,
                tem_order_bump: temOrderBump,
                produtos_count: vendasRelacionadas ? vendasRelacionadas.length + 1 : 1
            });

            // Usar transaction_id da e2Payments se disponível
            const transactionId = venda.pagamento_transacao_id || venda.pagamento_referencia || venda.id;
            
            // Debug: Log dos valores antes da substituição
            console.log('🔍 Debug - Valores para template:', {
                valorPago: valorPago,
                valorFormatado: valorPago.valorFormatado,
                transactionId: transactionId,
                venda_id: venda.id,
                venda_valor: venda.valor,
                venda_pagamento_valor: venda.pagamento_valor,
                venda_valor_final: venda.valor_final,
                produto_preco: produto.preco,
                fonte_valor: valorPago.fonte
            });

            // Substituir variáveis no template
            const emailFinal = emailContent
                .replace(/{{nome_completo}}/g, venda.cliente_nome || 'Cliente')
                .replace(/{{nome_produto}}/g, listaProdutos) // Lista de todos os produtos
                .replace(/{{valor}}/g, valorPago.valorFormatado || '0,00 MZN')
                .replace(/{{nome_produtor}}/g, contatoNome) // Nome do expert ou vendedor
                .replace(/{{nome_vendedor}}/g, vendedorNome) // Nome do vendedor (sempre presente)
                .replace(/{{email_produtor}}/g, contatoEmail) // Email do expert ou vendedor
                .replace(/{{url_acesso_produto}}/g, produto.link_conteudo || '#')
                .replace(/{{botoes_acesso}}/g, botoesAcesso) // Múltiplos botões para order bump
                .replace(/{{url_suporte}}/g, 'https://wa.me/258842363948')
                .replace(/{{url_plataforma}}/g, 'https://ratixpay.com')
                .replace(/{{url_termos}}/g, 'https://ratixpay.com/termos');
            // Formatar ID do pedido para o assunto
            const idPedidoFormatado = pedidoId ? 
                (pedidoId.toString().startsWith('TXP_') ? pedidoId : `TXP_${pedidoId}`) : 
                transactionId;
            const assunto = `Confirmação da compra - ID${idPedidoFormatado}`;
            
            // Validar se emailFinal foi gerado corretamente
            if (!emailFinal || emailFinal.trim().length === 0) {
                console.error('❌ Conteúdo do email vazio. Não será enviado.');
                return;
            }
            
            try {
                // Usar sistema de emails profissionais para vendas
                console.log('📧 Usando serviço profissional de email...');
                const professionalEmailService = require('./professionalEmailService');
                await professionalEmailService.enviarEmailVendas(
                    venda.cliente_email,
                    assunto,
                    emailFinal,
                    'confirmacao_compra'
                );
                console.log(`✅ Email de confirmação de compra enviado para cliente: ${venda.cliente_email}`);
            } catch (emailError) {
                console.error('❌ Erro ao enviar email via sistema profissional:', emailError);
                // Continuar sem falhar o processo - email não é crítico
            }

        } catch (error) {
            console.error('❌ Erro ao enviar email de confirmação de compra:', error);
            throw error;
        }
    }

    /**


    /**
     * Enviar email para vendedor usando template profissional
     */
    async enviarEmailVendedor(vendedor, dadosNotificacao) {
        try {
            // Validações iniciais
            if (!vendedor || !vendedor.email) {
                console.log('⚠️ Vendedor não tem email configurado');
                return;
            }

            // Validar dados de notificação
            if (!dadosNotificacao || !dadosNotificacao.dadosExtras) {
                console.error('❌ Dados de notificação inválidos ou incompletos. Não será enviado email.');
                console.error('❌ dadosNotificacao:', dadosNotificacao);
                return;
            }

            const { dadosExtras } = dadosNotificacao;
            
            // Validar dados essenciais
            if (!dadosExtras.produto_nome || !dadosExtras.valor_formatado || !dadosExtras.cliente_nome) {
                console.error('❌ Dados essenciais faltando na notificação. Não será enviado email.');
                console.error('❌ dadosExtras:', dadosExtras);
                return;
            }
            
            // Carregar template de recibo de venda
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-recibo-venda.html');
            
            let emailContent = '';
            if (fs.existsSync(templatePath)) {
                emailContent = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Fallback para template inline se arquivo não existir
                emailContent = this.getFallbackEmailTemplate(dadosNotificacao, vendedor, dadosExtras);
            }

            // Debug: Log dos dados para email
            console.log('🔍 Dados para email de venda:', {
                valor: dadosExtras.valor,
                valor_formatado: dadosExtras.valor_formatado,
                cliente_nome: dadosExtras.cliente_nome,
                produto_nome: dadosExtras.produto_nome
            });

            // Buscar vendas relacionadas para obter links de conteúdo dos produtos bônus
            let vendasRelacionadas = [];
            if (dadosExtras.venda_id) {
                try {
                    const venda = await Venda.findByPk(dadosExtras.venda_id, {
                        include: [{
                            model: Produto,
                            as: 'produto'
                        }]
                    });
                    if (venda) {
                        vendasRelacionadas = await this.buscarVendasRelacionadas(venda);
                    }
                } catch (error) {
                    console.error('❌ Erro ao buscar vendas relacionadas para email:', error);
                }
            }
            
            // Preparar lista de produtos bônus para incluir nos detalhes da transação
            let produtosOrderBumpHtml = '';
            let produtosBonusTexto = '';
            let produtosBonusDetalhesCompra = '';
            let botoesBonusHtml = '';
            
            if (dadosNotificacao.temOrderBump && dadosNotificacao.produtosOrderBump && dadosNotificacao.produtosOrderBump.length > 0) {
                // Mapear produtos bônus com links de conteúdo das vendas relacionadas
                const produtosComLinks = await Promise.all(dadosNotificacao.produtosOrderBump.map(async (produto, index) => {
                    // Tentar encontrar link na venda relacionada correspondente
                    let linkConteudo = '';
                    
                    if (vendasRelacionadas[index] && vendasRelacionadas[index].produto) {
                        linkConteudo = vendasRelacionadas[index].produto.link_conteudo || '';
                    }
                    
                    // Se não encontrou na venda relacionada, tentar buscar do produto original
                    if (!linkConteudo && produto.id) {
                        try {
                            const produtoOriginal = await Produto.findByPk(produto.id);
                            if (produtoOriginal && produtoOriginal.link_conteudo) {
                                linkConteudo = produtoOriginal.link_conteudo;
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao buscar produto original para link_conteudo:`, error);
                        }
                    }
                    
                    // Se ainda não encontrou, usar o que veio no produto
                    if (!linkConteudo) {
                        linkConteudo = produto.link_conteudo || '';
                    }
                    
                    return {
                        nome: produto.nome,
                        valor_formatado: produto.valor_formatado,
                        link_conteudo: linkConteudo
                    };
                }));
                
                // HTML para detalhes da transação
                produtosOrderBumpHtml = produtosComLinks.map(produto => 
                    `<div class="detail-row">
                        <span class="detail-label">Bonus:</span>
                        <span class="detail-value">${produto.nome}</span>
                    </div>`
                ).join('');
                
                // Texto para detalhes de compra (+bonus {nome})
                produtosBonusDetalhesCompra = produtosComLinks.map(p => `+bonus ${p.nome}`).join(', ');
                
                // Botões de download para cada produto bônus
                botoesBonusHtml = produtosComLinks.map((produto, index) => {
                    if (produto.link_conteudo && produto.link_conteudo.trim() !== '') {
                        return `
                            <div class="button-container" style="margin-bottom: 15px;">
                                <a href="${produto.link_conteudo}" class="cta-button" style="background: #f59e0b;">
                                    📥 Baixar Produto Bônus: ${produto.nome}
                                </a>
                            </div>
                        `;
                    }
                    return '';
                }).filter(html => html !== '').join('');
                
                // Texto para incluir na descrição da transação
                const nomesBonus = produtosComLinks.map(p => p.nome).join(', ');
                produtosBonusTexto = ` Incluindo produto bônus: ${nomesBonus}`;
            }

            // Substituir variáveis no template
            const emailFinal = emailContent
                .replace(/{{valor}}/g, dadosExtras.valor_formatado || '0,00')
                .replace(/{{valor_recebido}}/g, dadosExtras.valor_recebido || dadosExtras.valor_formatado || '0,00')
                .replace(/{{nome_comprador}}/g, dadosExtras.cliente_nome || 'Cliente')
                .replace(/{{email_comprador}}/g, dadosExtras.cliente_email || 'N/A')
                .replace(/{{whatsapp_comprador}}/g, dadosExtras.cliente_telefone || dadosExtras.cliente_whatsapp || 'N/A')
                .replace(/{{transacao_id}}/g, dadosExtras.numero_pedido || 'N/A')
                .replace(/{{numero_pedido}}/g, dadosExtras.numero_pedido || 'N/A')
                .replace(/{{produto_nome}}/g, dadosExtras.produto_nome || 'Produto')
                .replace(/{{vendedor_nome}}/g, vendedor.nome_completo || vendedor.nome || 'Vendedor')
                .replace(/{{vendedor_email}}/g, vendedor.email || 'N/A')
                .replace(/{{data_inicio}}/g, new Date(dadosExtras.data_venda).toLocaleDateString('pt-BR') || new Date().toLocaleDateString('pt-BR'))
                .replace(/{{data_liberacao}}/g, new Date().toLocaleDateString('pt-BR'))
                .replace(/{{data_liberacao_completa}}/g, new Date().toLocaleString('pt-BR'))
                .replace(/{{produto_descricao}}/g, (dadosExtras.produto_nome || 'Produto vendido com sucesso') + produtosBonusTexto)
                .replace(/{{produtos_order_bump}}/g, produtosOrderBumpHtml)
                .replace(/{{tem_order_bump}}/g, dadosNotificacao.temOrderBump ? 'block' : 'none')
                .replace(/{{produtos_bonus_texto}}/g, produtosBonusTexto)
                .replace(/{{produtos_bonus_detalhes_compra}}/g, produtosBonusDetalhesCompra)
                .replace(/{{botoes_bonus}}/g, botoesBonusHtml);

            // Validar se emailFinal foi gerado corretamente
            if (!emailFinal || emailFinal.trim().length === 0) {
                console.error('❌ Conteúdo do email vazio. Não será enviado.');
                return;
            }

            // Formatar ID do pedido para o assunto
            const idPedidoFormatado = dadosExtras.numero_pedido || dadosExtras.transacao_id || 'N/A';
            const idPedidoParaAssunto = idPedidoFormatado.toString().startsWith('TXP_') 
                ? idPedidoFormatado 
                : `TXP_${idPedidoFormatado}`;
            const assunto = `Venda Realizada - ID${idPedidoParaAssunto}`;

            try {
                // Usar sistema de emails profissionais para vendas
                await this.emailService.enviarEmailVendas(
                    vendedor.email,
                    assunto,
                    emailFinal,
                    'recibo_venda'
                );
                const emailMonitorService = require('./emailMonitorService');
                emailMonitorService.registrarTentativa('venda_vendedor', true, vendedor.email);
                console.log(`✅ Email de recibo de venda enviado para vendedor: ${vendedor.email}`);
            } catch (emailError) {
                console.error('❌ Erro ao enviar email via sistema profissional:', emailError);
                const emailMonitorService = require('./emailMonitorService');
                emailMonitorService.registrarTentativa('venda_vendedor', false, vendedor.email, emailError.message);
                // Não enviar WhatsApp como fallback para evitar duplicação
                // O WhatsApp já é enviado separadamente em enviarNotificacaoNovaVenda
            }

        } catch (error) {
            console.error('❌ Erro ao enviar email para vendedor:', error);
            // Não falhar a notificação por erro de email
        }
    }

    /**
     * Enviar WhatsApp para vendedor
     */
    async enviarWhatsAppVendedor(vendedor, dadosNotificacao) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado');
                return;
            }

            // Validar se dadosNotificacao tem dados válidos
            if (!dadosNotificacao || !dadosNotificacao.dadosExtras) {
                console.error('❌ Dados de notificação inválidos ou incompletos. Não será enviado WhatsApp.');
                console.error('❌ dadosNotificacao:', dadosNotificacao);
                return;
            }

            // Validar se dadosExtras tem informações essenciais
            const { dadosExtras } = dadosNotificacao;
            if (!dadosExtras.produto_nome || !dadosExtras.valor_formatado || !dadosExtras.cliente_nome) {
                console.error('❌ Dados essenciais faltando na notificação. Não será enviado WhatsApp.');
                console.error('❌ dadosExtras:', dadosExtras);
                return;
            }

            const mensagem = this.formatarMensagemWhatsApp(dadosNotificacao);
            
            if (!mensagem || mensagem.trim().length === 0) {
                console.error('❌ Mensagem WhatsApp vazia. Não será enviado.');
                return;
            }
            
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp
        }
    }

    /**
     * Formatar mensagem para WhatsApp
     */
    /**
     * Censurar nome do produto (mostrar apenas 3 primeiras letras)
     * @param {string} nomeProduto - Nome completo do produto
     * @returns {string} - Nome censurado
     */
    censurarNomeProduto(nomeProduto) {
        if (!nomeProduto || nomeProduto.length <= 3) {
            return nomeProduto || 'Produto';
        }
        
        // Pegar as 3 primeiras letras
        const primeiras3Letras = nomeProduto.substring(0, 3);
        // Resto do nome substituído por asteriscos
        const restoCensurado = '*'.repeat(Math.min(nomeProduto.length - 3, 10)); // Máximo 10 asteriscos
        
        return `${primeiras3Letras}${restoCensurado}`;
    }

    formatarMensagemWhatsApp(dadosNotificacao) {
        const { dadosExtras } = dadosNotificacao;
        
        // Valor que o vendedor recebeu (90% do total)
        // Se valor_recebido já está formatado, usar diretamente, senão formatar
        let valorRecebido = dadosExtras.valor_recebido;
        if (!valorRecebido || (typeof valorRecebido === 'number')) {
            // Se for número ou não estiver formatado, formatar
            const valorNumerico = typeof valorRecebido === 'number' ? valorRecebido : 
                                 (dadosExtras.valor || dadosExtras.valor_vendedor || 0);
            valorRecebido = this.formatarValorMonetario(valorNumerico);
        }
        
        // Censurar nome do produto (mostrar apenas 3 primeiras letras)
        const nomeProdutoCensurado = this.censurarNomeProduto(dadosExtras.produto_nome);
        
        // Preparar texto de produtos bônus se houver
        let produtosBonusTexto = '';
        if (dadosNotificacao.temOrderBump && dadosNotificacao.produtosOrderBump && dadosNotificacao.produtosOrderBump.length > 0) {
            const nomesBonus = dadosNotificacao.produtosOrderBump.map(p => p.nome).join(', ');
            produtosBonusTexto = `\nIncluindo produto bônus: ${nomesBonus}`;
        }
        
        return `🎉 *Nova Venda realizada*

Parabéns você recebeu ${valorRecebido} confira no seu painel de vendas.

👤 anônimo

💰 +${valorRecebido}

📦 ${nomeProdutoCensurado}${produtosBonusTexto}

RatixPay`;
    }

    /**
     * Enviar notificação via WhatsApp Bot
     */
    async enviarWhatsAppBotVendedor(venda, vendedor) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado para WhatsApp Bot');
                return;
            }

            // Enviar notificação via WhatsApp Session Manager
            const whatsappManager = require('./whatsappManager');
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
            const valorVendedor = parseFloat(venda.valor_total || 0) * 0.9;
            
            const mensagem = `🎉 *Nova Venda*

📦 ${venda.produto_nome || 'Produto'}
💰 MZN ${valorVendedor.toFixed(2)}

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp de venda enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp Bot para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp Bot
        }
    }

    /**
     * Atualizar contador de notificações
     */
    async atualizarContadorNotificacoes(vendedorId) {
        try {
            await Usuario.increment('notificacoes', {
                where: { id: vendedorId }
            });
            console.log(`✅ Contador de notificações atualizado para vendedor: ${vendedorId}`);
        } catch (error) {
            console.error('❌ Erro ao atualizar contador de notificações:', error);
        }
    }

    /**
     * Enviar notificação de venda cancelada
     * @param {string} vendaId - ID da venda
     */
    async enviarNotificacaoVendaCancelada(vendaId) {
        try {
            console.log(`🚨 Enviando notificação de venda cancelada: ${vendaId}`);

            // Buscar dados da venda
            const venda = await Venda.findByPk(vendaId, {
                include: [{
                    model: Produto,
                    as: 'produto'
                }]
            });

            if (!venda) {
                throw new Error('Venda não encontrada');
            }

            // Buscar dados do vendedor
            const vendedor = await Usuario.findByPk(venda.vendedor_id, {
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            });

            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }

            // Preparar dados da notificação
            const dadosNotificacao = this.prepararDadosNotificacaoCancelada(venda, vendedor);

            // Criar notificação no painel
            const notificacao = await this.criarNotificacaoPainel(vendedor.id, dadosNotificacao);

            // Enviar por email
            await this.enviarEmailVendedorCancelada(vendedor, dadosNotificacao);

            // Enviar por WhatsApp (apenas uma notificação completa)
            await this.enviarWhatsAppVendedorCancelada(vendedor, dadosNotificacao);

            // Removido: enviarWhatsAppBotVendedorCancelada - estava causando duplicação
            // A função enviarWhatsAppVendedorCancelada já envia notificação completa com todos os dados

            // Atualizar contador de notificações
            await this.atualizarContadorNotificacoes(vendedor.id);

            console.log(`✅ Notificação de venda cancelada enviada para vendedor: ${vendedor.nome_completo}`);
            return notificacao;

        } catch (error) {
            console.error('❌ Erro ao enviar notificação de venda cancelada:', error);
            throw error;
        }
    }

    /**
     * Preparar dados da notificação de venda cancelada
     */
    prepararDadosNotificacaoCancelada(venda, vendedor) {
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(venda.valor_final || venda.pagamento_valor || 0);

        const nomeProduto = venda.produto?.nome || 'Produto';
        const nomeCliente = venda.cliente_nome || 'Cliente';
        const statusPagamento = venda.pagamento_status || 'Cancelada';
        
        // Usar WhatsApp do cliente se disponível, senão usar telefone
        const whatsappCliente = venda.cliente_whatsapp || venda.cliente_telefone || 'Não informado';

        return {
            titulo: '🚨 Venda Cancelada',
            mensagem: `Olá ${vendedor.nome_completo}, ${nomeCliente} tentou realizar pagamento do produto "${nomeProduto}" que custa ${valorFormatado}.`,
            tipo: 'cancelamento',
            prioridade: 'alta',
            dadosExtras: {
                venda_id: venda.id,
                produto_id: venda.produto_id,
                produto_nome: nomeProduto,
                cliente_nome: nomeCliente,
                cliente_email: venda.cliente_email,
                cliente_whatsapp: whatsappCliente,
                valor: venda.valor_final || venda.pagamento_valor,
                valor_formatado: valorFormatado,
                status_pagamento: statusPagamento,
                data_venda: venda.data_venda || venda.created_at,
                metodo_pagamento: venda.pagamento_metodo || 'Não informado',
                motivo_cancelamento: venda.falha_motivo || 'Pagamento cancelado'
            }
        };
    }

    /**
     * Enviar email para vendedor sobre venda cancelada
     */
    async enviarEmailVendedorCancelada(vendedor, dadosNotificacao) {
        try {
            if (!vendedor.email) {
                console.log('⚠️ Vendedor não tem email configurado');
                return;
            }

            const { dadosExtras } = dadosNotificacao;
            
            // Criar conteúdo HTML do email
            const emailContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${dadosNotificacao.titulo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #f44336, #d32f2f); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .sale-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .sale-item { margin: 10px 0; padding: 10px; background: #fff3e0; border-left: 4px solid #f44336; }
                        .whatsapp-link { color: #25d366; text-decoration: none; font-weight: bold; }
                        .whatsapp-link:hover { text-decoration: underline; }
                        .button { display: inline-block; background: #f44336; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
                        .alert { background: #ffebee; border: 1px solid #f44336; border-radius: 5px; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚨 ${dadosNotificacao.titulo}</h1>
                        </div>
                        <div class="content">
                            <p>Olá <strong>${vendedor.nome_completo}</strong>,</p>
                            <p>${dadosNotificacao.mensagem}</p>
                            
                            <div class="alert">
                                <strong>⚠️ Atenção:</strong> Esta venda foi cancelada. Contacte o cliente e faça a sua venda novamente!
                            </div>
                            
                            <div class="sale-info">
                                <h3>📋 Detalhes da Venda Cancelada:</h3>
                                <div class="sale-item">
                                    <strong>📦 Nome do Produto:</strong> ${dadosExtras.produto_nome}
                                </div>
                                <div class="sale-item">
                                    <strong>💰 Valor:</strong> ${dadosExtras.valor_formatado}
                                </div>
                                <div class="sale-item">
                                    <strong>👤 Cliente:</strong> ${dadosExtras.cliente_nome}
                                </div>
                                <div class="sale-item">
                                    <strong>📧 Email do Cliente:</strong> ${dadosExtras.cliente_email}
                                </div>
                                <div class="sale-item">
                                    <strong>📱 WhatsApp do Cliente:</strong> 
                                    <a href="https://wa.me/${dadosExtras.cliente_whatsapp.replace(/\D/g, '')}" class="whatsapp-link" target="_blank">
                                        ${dadosExtras.cliente_whatsapp}
                                    </a>
                                </div>
                                <div class="sale-item">
                                    <strong>💳 Status:</strong> ${dadosExtras.status_pagamento}
                                </div>
                                <div class="sale-item">
                                    <strong>📅 Data:</strong> ${new Date(dadosExtras.data_venda).toLocaleString('pt-BR')}
                                </div>
                                <div class="sale-item">
                                    <strong>💳 Método de Pagamento:</strong> ${dadosExtras.metodo_pagamento}
                                </div>
                                <div class="sale-item">
                                    <strong>❌ Motivo do Cancelamento:</strong> ${dadosExtras.motivo_cancelamento}
                                </div>
                            </div>
                            
                            <p>
                                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/gestao-vendas.html" class="button">
                                    📊 Acessar Painel de Vendas
                                </a>
                            </p>
                            
                            <p><strong>💡 Dica:</strong> Contacte o cliente e faça a sua venda novamente!</p>
                        </div>
                        <div class="footer">
                            <p>RatixPay - Sistema de Vendas</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await this.emailService.enviarEmailVendas(
                vendedor.email,
                dadosNotificacao.titulo,
                emailContent,
                'venda_realizada'
            );
            
            console.log(`✅ Email de venda cancelada enviado para vendedor: ${vendedor.email}`);

        } catch (error) {
            console.error('❌ Erro ao enviar email de venda cancelada para vendedor:', error);
            // Não falhar a notificação por erro de email
        }
    }

    /**
     * Enviar WhatsApp para vendedor sobre venda cancelada
     */
    async enviarWhatsAppVendedorCancelada(vendedor, dadosNotificacao) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado');
                return;
            }

            const mensagem = this.formatarMensagemWhatsAppCancelada(dadosNotificacao);
            
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp de venda cancelada enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de venda cancelada para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp
        }
    }

    /**
     * Formatar mensagem para WhatsApp de venda cancelada
     */
    formatarMensagemWhatsAppCancelada(dadosNotificacao) {
        const { dadosExtras } = dadosNotificacao;
        
        return `🚨 *Venda Cancelada*

📦 ${dadosExtras.produto_nome}
💰 ${dadosExtras.valor_formatado}
👤 ${dadosExtras.cliente_nome}

RatixPay`;
    }

    /**
     * Enviar notificação via WhatsApp Bot para venda cancelada
     */
    async enviarWhatsAppBotVendedorCancelada(venda, vendedor) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado para WhatsApp Bot');
                return;
            }

            // Enviar notificação via WhatsApp Session Manager
            const whatsappManager = require('./whatsappManager');
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
            
            const mensagem = `❌ *Venda Cancelada*

📦 ${venda.produto_nome || 'Produto'}

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp de venda cancelada enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp Bot de venda cancelada para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp Bot
        }
    }

    /**
     * Enviar notificação de pedido de saque para administrador
     * @param {Object} saqueData - Dados do pedido de saque
     */
    async enviarNotificacaoPedidoSaqueAdmin(saqueData) {
        try {
            console.log(`💰 Enviando notificação de pedido de saque para admin: ${saqueData.id}`);

            // Buscar dados do vendedor
            const vendedor = await Usuario.findByPk(saqueData.vendedor_id, {
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            });

            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }

            // Preparar dados da notificação
            const dadosNotificacao = this.prepararDadosNotificacaoPedidoSaque(saqueData, vendedor);

            // Enviar por email para admin
            await this.enviarEmailAdminPedidoSaque(dadosNotificacao);

            // Enviar por WhatsApp para admin
            await this.enviarWhatsAppAdminPedidoSaque(dadosNotificacao);

            console.log(`✅ Notificação de pedido de saque enviada para admin`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao enviar notificação de pedido de saque para admin:', error);
            throw error;
        }
    }

    /**
     * Preparar dados da notificação de pedido de saque
     */
    prepararDadosNotificacaoPedidoSaque(saqueData, vendedor) {
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(saqueData.valor || 0);

        return {
            titulo: `💰 Pedido de Saque ${valorFormatado}`,
            mensagem: `${vendedor.nome_completo} fez pedido de saque com ID ${saqueData.id}`,
            tipo: 'saque',
            prioridade: 'alta',
            dadosExtras: {
                saque_id: saqueData.id,
                vendedor_id: vendedor.id,
                vendedor_nome: vendedor.nome_completo,
                vendedor_email: vendedor.email,
                vendedor_telefone: vendedor.telefone,
                valor: saqueData.valor,
                valor_formatado: valorFormatado,
                metodo: saqueData.metodo || 'Não informado',
                status: saqueData.status || 'Pendente',
                data_pedido: saqueData.created_at || new Date(),
                carteira_dados: saqueData.carteira_dados || {}
            }
        };
    }

    /**
     * Enviar email para administrador sobre pedido de saque
     */
    async enviarEmailAdminPedidoSaque(dadosNotificacao) {
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'sistema@ratixpay.com';
            const { dadosExtras } = dadosNotificacao;
            
            // Criar conteúdo HTML do email
            const emailContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${dadosNotificacao.titulo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #2196F3, #1976D2); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .saque-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .saque-item { margin: 10px 0; padding: 10px; background: #e3f2fd; border-left: 4px solid #2196F3; }
                        .button { display: inline-block; background: #2196F3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
                        .urgent { background: #fff3e0; border: 1px solid #ff9800; border-radius: 5px; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>💰 ${dadosNotificacao.titulo}</h1>
                        </div>
                        <div class="content">
                            <p>Olá <strong>Administrador</strong>,</p>
                            <p>${dadosNotificacao.mensagem}</p>
                            
                            <div class="urgent">
                                <strong>⚠️ Ação Necessária:</strong> Processe este pedido de saque o mais rápido possível!
                            </div>
                            
                            <div class="saque-info">
                                <h3>📋 Detalhes do Pedido de Saque:</h3>
                                <div class="saque-item">
                                    <strong>🆔 ID do Saque:</strong> ${dadosExtras.saque_id}
                                </div>
                                <div class="saque-item">
                                    <strong>👤 Nome do Vendedor:</strong> ${dadosExtras.vendedor_nome}
                                </div>
                                <div class="saque-item">
                                    <strong>💰 Valor de Saque:</strong> ${dadosExtras.valor_formatado}
                                </div>
                                <div class="saque-item">
                                    <strong>💳 Método:</strong> ${dadosExtras.metodo}
                                </div>
                                <div class="saque-item">
                                    <strong>📱 Contato do Vendedor:</strong> ${dadosExtras.vendedor_telefone}
                                </div>
                                <div class="saque-item">
                                    <strong>📧 Email do Vendedor:</strong> ${dadosExtras.vendedor_email}
                                </div>
                                <div class="saque-item">
                                    <strong>📊 Status do Pedido:</strong> ${dadosExtras.status}
                                </div>
                                <div class="saque-item">
                                    <strong>📅 Data do Pedido:</strong> ${new Date(dadosExtras.data_pedido).toLocaleString('pt-BR')}
                                </div>
                            </div>
                            
                            <p>
                                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/admin/gestao-saques.html" class="button">
                                    📊 Gerenciar Saques
                                </a>
                            </p>
                            
                            <p><strong>💡 Lembrete:</strong> Processe este saque para manter a confiança do vendedor!</p>
                        </div>
                        <div class="footer">
                            <p>RatixPay - Sistema de Vendas</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await this.emailService.enviarEmailSistema(
                adminEmail,
                dadosNotificacao.titulo,
                emailContent,
                'venda_admin'
            );
            
            console.log(`✅ Email de pedido de saque enviado para admin: ${adminEmail}`);

        } catch (error) {
            console.error('❌ Erro ao enviar email de pedido de saque para admin:', error);
            // Não falhar a notificação por erro de email
        }
    }

    /**
     * Enviar WhatsApp para administrador sobre pedido de saque
     */
    async enviarWhatsAppAdminPedidoSaque(dadosNotificacao) {
        try {
            const adminWhatsApp = process.env.ADMIN_WHATSAPP || '258867792543';
            const mensagem = this.formatarMensagemWhatsAppPedidoSaque(dadosNotificacao);
            
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(adminWhatsApp, mensagem, null, 'sistema');
            console.log(`✅ WhatsApp de pedido de saque enviado para admin: ${adminWhatsApp}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de pedido de saque para admin:', error);
            // Não falhar a notificação por erro de WhatsApp
        }
    }

    /**
     * Formatar mensagem para WhatsApp de pedido de saque
     */
    formatarMensagemWhatsAppPedidoSaque(dadosNotificacao) {
        const { dadosExtras } = dadosNotificacao;
        
        return `💰 *Novo Saque*

👤 ${dadosExtras.vendedor_nome}
💰 ${dadosExtras.valor_formatado}

RatixPay`;
    }

    /**
     * Enviar notificação de saque processado para vendedor
     * @param {Object} saqueData - Dados do saque processado
     */
    async enviarNotificacaoSaqueProcessado(saqueData) {
        try {
            console.log(`✅ Enviando notificação de saque processado: ${saqueData.id}`);

            // Buscar dados do vendedor (incluindo push_subscription e role)
            const vendedor = await Usuario.findByPk(saqueData.vendedor_id, {
                attributes: ['id', 'nome_completo', 'email', 'telefone', 'role', 'push_subscription']
            });

            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }

            // Não enviar notificações para códigos (apenas vendedores)
            if (vendedor.role === 'codigo') {
                console.log(`⚠️ Usuário ${vendedor.id} é um código, pulando notificações push`);
            }

            // Preparar dados da notificação
            const dadosNotificacao = this.prepararDadosNotificacaoSaqueProcessado(saqueData, vendedor);

            // Criar notificação no painel
            const notificacao = await this.criarNotificacaoPainel(vendedor.id, dadosNotificacao);

            // Enviar por email
            await this.enviarEmailVendedorSaqueProcessado(vendedor, dadosNotificacao);

            // Enviar por WhatsApp (apenas uma notificação completa)
            await this.enviarWhatsAppVendedorSaqueProcessado(vendedor, dadosNotificacao);

            // Removido: enviarWhatsAppBotVendedorSaqueProcessado - estava causando duplicação
            // A função enviarWhatsAppVendedorSaqueProcessado já envia notificação completa com todos os dados

            // Enviar push notification (apenas para vendedores, não códigos)
            if (vendedor.role !== 'codigo') {
                await this.enviarPushNotificationSaque(vendedor, dadosNotificacao, saqueData);
            }

            // Atualizar contador de notificações
            await this.atualizarContadorNotificacoes(vendedor.id);

            console.log(`✅ Notificação de saque processado enviada para vendedor: ${vendedor.nome_completo}`);
            return notificacao;

        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque processado:', error);
            throw error;
        }
    }

    /**
     * Preparar dados da notificação de saque processado
     */
    prepararDadosNotificacaoSaqueProcessado(saqueData, vendedor) {
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(saqueData.valor_liquido || saqueData.valor || 0);

        const status = saqueData.status === 'Pago' ? 'aprovado' : 'cancelado';
        const titulo = status === 'aprovado' ? '✅ Seu Saque foi Aprovado!' : '❌ Seu Saque foi Cancelado';

        return {
            titulo: titulo,
            mensagem: status === 'aprovado' ? 
                `Oi ${vendedor.nome_completo}, acabas de receber na sua conta ${saqueData.metodo}, um valor de ${valorFormatado} no número ${saqueData.contato_carteira}.` :
                `Oi ${vendedor.nome_completo}, seu pedido de saque foi cancelado.`,
            tipo: 'saque_processado',
            prioridade: 'alta',
            dadosExtras: {
                saque_id: saqueData.id,
                vendedor_id: vendedor.id,
                vendedor_nome: vendedor.nome_completo,
                valor: saqueData.valor_liquido || saqueData.valor,
                valor_formatado: valorFormatado,
                metodo: saqueData.metodo,
                contato_carteira: saqueData.contato_carteira,
                status: saqueData.status,
                data_processamento: saqueData.updated_at || new Date(),
                motivo: saqueData.motivo || null
            }
        };
    }

    /**
     * Enviar email para vendedor sobre saque processado via vendas@ratixpay.com
     */
    async enviarEmailVendedorSaqueProcessado(vendedor, dadosNotificacao) {
        try {
            if (!vendedor.email) {
                console.log('⚠️ Vendedor não tem email configurado');
                return;
            }

            const { dadosExtras } = dadosNotificacao;
            const isAprovado = dadosExtras.status === 'Pago';
            
            // Usar serviço de email de vendas profissional
            const vendasEmailService = require('./vendasEmailService');
            
            const dadosEmail = {
                email: vendedor.email,
                nome: vendedor.nome_completo,
                titulo: dadosNotificacao.titulo,
                mensagem: dadosNotificacao.mensagem,
                tipo: 'saque_aprovado',
                dadosExtras: dadosExtras
            };
            
            console.log('📧 Enviando confirmação de saque via vendas@ratixpay.com...');
            const resultado = await vendasEmailService.enviarConfirmacaoSaque(dadosEmail);
            
            if (resultado) {
                console.log('✅ Confirmação de saque enviada com sucesso via vendas@ratixpay.com');
                return resultado;
            } else {
                console.log('⚠️ Falha ao enviar via vendas, usando método alternativo...');
                // Fallback para método original se necessário
                return await this.enviarEmailVendedorSaqueProcessadoFallback(vendedor, dadosNotificacao);
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de confirmação de saque:', error);
            throw error;
        }
    }

    /**
     * Método fallback para envio de email de saque processado
     */
    async enviarEmailVendedorSaqueProcessadoFallback(vendedor, dadosNotificacao) {
        try {
            const { dadosExtras } = dadosNotificacao;
            const isAprovado = dadosExtras.status === 'Pago';
            
            // Criar conteúdo HTML do email
            const emailContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${dadosNotificacao.titulo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, ${isAprovado ? '#4CAF50, #45a049' : '#f44336, #d32f2f'}); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .saque-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .saque-item { margin: 10px 0; padding: 10px; background: ${isAprovado ? '#e8f5e8' : '#ffebee'}; border-left: 4px solid ${isAprovado ? '#4CAF50' : '#f44336'}; }
                        .button { display: inline-block; background: ${isAprovado ? '#4CAF50' : '#f44336'}; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9rem; }
                        .success { background: #e8f5e8; border: 1px solid #4CAF50; border-radius: 5px; padding: 15px; margin: 20px 0; }
                        .error { background: #ffebee; border: 1px solid #f44336; border-radius: 5px; padding: 15px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>${dadosNotificacao.titulo}</h1>
                        </div>
                        <div class="content">
                            <p>${dadosNotificacao.mensagem}</p>
                            
                            ${isAprovado ? 
                                `<div class="success">
                                    <strong>🎉 Parabéns!</strong> Seu saque foi processado com sucesso!
                                </div>` :
                                `<div class="error">
                                    <strong>❌ Saque Cancelado:</strong> ${dadosExtras.motivo || 'Motivo não informado'}
                                </div>`
                            }
                            
                            <div class="saque-info">
                                <h3>📋 Detalhes do Saque:</h3>
                                <div class="saque-item">
                                    <strong>🆔 ID do Saque:</strong> ${dadosExtras.saque_id}
                                </div>
                                <div class="saque-item">
                                    <strong>💰 Valor:</strong> ${dadosExtras.valor_formatado}
                                </div>
                                <div class="saque-item">
                                    <strong>💳 Método:</strong> ${dadosExtras.metodo}
                                </div>
                                <div class="saque-item">
                                    <strong>📱 Conta:</strong> ${dadosExtras.contato_carteira}
                                </div>
                                <div class="saque-item">
                                    <strong>📊 Status:</strong> ${dadosExtras.status}
                                </div>
                                <div class="saque-item">
                                    <strong>📅 Data de Processamento:</strong> ${new Date(dadosExtras.data_processamento).toLocaleString('pt-BR')}
                                </div>
                            </div>
                            
                            <p>
                                <a href="${process.env.BASE_URL || 'http://localhost:3000'}/gestao-vendas.html" class="button">
                                    📊 Acessar Painel de Vendas
                                </a>
                            </p>
                            
                            ${isAprovado ? 
                                '<p><strong>💡 Obrigado por usar o RatixPay!</strong> Continue vendendo e fazendo saques!</p>' :
                                '<p><strong>💡 Dica:</strong> Verifique os dados da sua carteira e tente novamente!</p>'
                            }
                        </div>
                        <div class="footer">
                            <p>RatixPay - Sistema de Vendas</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;

            await this.emailService.enviarEmailVendas(
                vendedor.email,
                dadosNotificacao.titulo,
                emailContent,
                'venda_realizada'
            );
            
            console.log(`✅ Email de saque processado enviado para vendedor: ${vendedor.email}`);

        } catch (error) {
            console.error('❌ Erro ao enviar email de saque processado para vendedor:', error);
            // Não falhar a notificação por erro de email
        }
    }

    /**
     * Enviar WhatsApp para vendedor sobre saque processado
     */
    async enviarWhatsAppVendedorSaqueProcessado(vendedor, dadosNotificacao) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado');
                return;
            }

            const mensagem = this.formatarMensagemWhatsAppSaqueProcessado(dadosNotificacao);
            
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp de saque processado enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de saque processado para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp
        }
    }

    /**
     * Formatar mensagem para WhatsApp de saque processado
     */
    formatarMensagemWhatsAppSaqueProcessado(dadosNotificacao) {
        const { dadosExtras } = dadosNotificacao;
        const isAprovado = dadosExtras.status === 'Pago';
        
        return `${isAprovado ? '✅' : '❌'} *Saque ${isAprovado ? 'Pago' : 'Cancelado'}*

💰 ${dadosExtras.valor_formatado}

RatixPay`;
    }

    /**
     * Enviar notificação via WhatsApp Bot para saque processado
     */
    async enviarWhatsAppBotVendedorSaqueProcessado(saqueData, vendedor) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado para WhatsApp Bot');
                return;
            }

            // Enviar notificação via WhatsApp Session Manager
            const whatsappManager = require('./whatsappManager');
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
            const valorSaque = parseFloat(saqueData.valor || 0);
            
            const mensagem = `✅ *Saque Pago*

💰 MZN ${valorSaque.toFixed(2)}

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'default');
            console.log(`✅ WhatsApp de saque processado enviado para vendedor: ${vendedor.telefone}`);

        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp Bot de saque processado para vendedor:', error);
            // Não falhar a notificação por erro de WhatsApp Bot
        }
    }

    /**
     * Enviar push notification de nova venda
     * @param {Object} vendedor - Dados do vendedor
     * @param {Object} dadosNotificacao - Dados da notificação
     * @param {Object} venda - Dados da venda
     */
    async enviarPushNotificationVenda(vendedor, dadosNotificacao, venda) {
        try {
            // Verificar se vendedor tem push subscription
            if (!vendedor.push_subscription) {
                console.log(`ℹ️ Vendedor ${vendedor.id} não tem push subscription registrada`);
                return;
            }

            // Usar novo serviço de push notifications (suporta múltiplos dispositivos)
            const pushNotificationService = require('../services/pushNotificationService');
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
            // Calcular valor do vendedor (90% do total ou usar valor já calculado)
            const valorVendedor = dadosNotificacao.dadosExtras?.valor_recebido || dadosNotificacao.dadosExtras?.valor_vendedor || venda.valor;
            const valorFormatado = this.formatarValorMonetario(valorVendedor);
            
            // Censurar nome do produto
            const nomeProduto = dadosNotificacao.dadosExtras?.produto_nome || 'Produto';
            const nomeProdutoCensurado = this.censurarNomeProduto(nomeProduto);
            
            // Preparar texto de produtos bônus se houver
            let produtosBonusTexto = '';
            if (dadosNotificacao.temOrderBump && dadosNotificacao.produtosOrderBump && dadosNotificacao.produtosOrderBump.length > 0) {
                const nomesBonus = dadosNotificacao.produtosOrderBump.map(p => p.nome).join(', ');
                produtosBonusTexto = `\nIncluindo produto bônus: ${nomesBonus}`;
            }
            
            // Formatar corpo da notificação seguindo a estrutura solicitada
            const body = `Parabéns você recebeu ${valorFormatado} confira no seu painel de vendas.

👤 anônimo

💰 +${valorFormatado}

📦 ${nomeProdutoCensurado}${produtosBonusTexto}

RatixPay`;

            const notification = {
                title: '🎉 Nova Venda realizada',
                body: body,
                icon: '/assets/images/icons/icon-192x192.png',
                badge: '/assets/images/icons/icon-48x48.png',
                tag: `venda-${venda.id}`,
                url: `${baseUrl}/gestao-vendas.html`,
                sound: '/assets/sounds/alert.mp3', // Som da notificação
                vibrate: [200, 100, 200, 100, 200], // Padrão de vibração: vibrar 200ms, pausa 100ms, vibrar 200ms, pausa 100ms, vibrar 200ms
                silent: false, // Fazer som/vibração
                data: {
                    tipo: 'venda',
                    evento: 'nova_venda',
                    venda_id: venda.id,
                    produto_id: dadosNotificacao.dadosExtras?.produto_id,
                    produto_nome: dadosNotificacao.dadosExtras?.produto_nome,
                    valor: dadosNotificacao.dadosExtras?.valor_recebido || dadosNotificacao.dadosExtras?.valor_vendedor || venda.valor,
                    valor_formatado: valorFormatado,
                    timestamp: new Date().toISOString()
                }
            };

            await pushNotificationService.sendToUser(vendedor.id, notification);
            console.log(`✅ Push notification de venda enviada para vendedor ${vendedor.id}`);

        } catch (error) {
            console.error('❌ Erro ao enviar push notification de venda:', error);
            // Não falhar a notificação por erro de push
        }
    }

    /**
     * Enviar push notification de saque processado
     * @param {Object} vendedor - Dados do vendedor
     * @param {Object} dadosNotificacao - Dados da notificação
     * @param {Object} saqueData - Dados do saque
     */
    async enviarPushNotificationSaque(vendedor, dadosNotificacao, saqueData) {
        try {
            // Verificar se vendedor tem push subscription
            if (!vendedor.push_subscription) {
                console.log(`ℹ️ Vendedor ${vendedor.id} não tem push subscription registrada`);
                return;
            }

            // Usar novo serviço de push notifications (suporta múltiplos dispositivos)
            const pushNotificationService = require('../services/pushNotificationService');
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
            const isAprovado = dadosNotificacao.dadosExtras?.status === 'Pago';
            const valorFormatado = dadosNotificacao.dadosExtras?.valor_formatado || 
                this.formatarValorMonetario(saqueData.valor_liquido || saqueData.valor);

            const notification = {
                title: isAprovado ? '✅ Saque Aprovado!' : '❌ Saque Cancelado',
                body: isAprovado ? 
                    `Você recebeu ${valorFormatado} na sua conta ${dadosNotificacao.dadosExtras?.metodo || 'M-Pesa'}` :
                    dadosNotificacao.mensagem,
                icon: '/assets/images/icons/icon-192x192.png',
                badge: '/assets/images/icons/icon-48x48.png',
                tag: `saque-${saqueData.id}`,
                url: `${baseUrl}/saques.html`,
                sound: '/assets/sounds/alert.mp3',
                vibrate: [200, 100, 200, 100, 200],
                silent: false,
                data: {
                    tipo: 'saque',
                    evento: 'saque_processado',
                    saque_id: saqueData.id,
                    status: dadosNotificacao.dadosExtras?.status,
                    valor: saqueData.valor_liquido || saqueData.valor,
                    valor_formatado: valorFormatado,
                    metodo: dadosNotificacao.dadosExtras?.metodo,
                    timestamp: new Date().toISOString()
                }
            };

            await pushNotificationService.sendToUser(vendedor.id, notification);
            console.log(`✅ Push notification de saque enviada para vendedor ${vendedor.id}`);

        } catch (error) {
            console.error('❌ Erro ao enviar push notification de saque:', error);
            // Não falhar a notificação por erro de push
        }
    }

    /**
     * Template fallback para email do cliente - Design moderno e elegante
     */
    getFallbackClienteEmailTemplate(venda, produto, vendedor, pedidoId) {
        const valorFormatado = this.formatarValorMonetario(venda.pagamento_valor || produto.preco || 0);
        const dataCompra = new Date(venda.data_venda || venda.created_at || new Date());
        const dataFormatada = dataCompra.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const horaFormatada = dataCompra.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const dataHoraCompleta = `${dataFormatada}, ${horaFormatada}`;
        
        // Formatar ID do pedido (TXP_ ou número)
        const idPedidoFormatado = pedidoId ? 
            (pedidoId.toString().startsWith('TXP_') ? pedidoId : `TXP_${pedidoId}`) : 
            'N/A';
        
        const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
        const clienteNome = venda.cliente_nome || 'Cliente';
        const produtoNome = produto.nome || 'Produto';
        const vendedorNome = vendedor ? (vendedor.nome_completo || vendedor.nome || 'Vendedor') : 'Suporte';
        
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Confirmação de Compra - RatixPay</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Poppins', 'Segoe UI', 'Roboto', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .header {
            padding: 30px 20px;
            text-align: center;
        }
        
        .logo-container {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .logo {
            max-width: 150px;
            height: auto;
            margin: 0 auto;
            display: block;
        }
        
    
        
        .content {
            padding: 30px 25px;
            background-color: #ffffff;
        }
        
        .greeting {
            font-size: 18px;
            color: #333333;
            margin-bottom: 20px;
            font-weight: 500;
        }
        
        .greeting strong {
            color: #F64C00;
            font-weight: 600;
        }
        
        .success-message {
            background: #fff5f0;
            border-left: 4px solid #F64C00;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
            animation: slideIn 0.6s ease-out;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        .success-message .icon {
            font-size: 24px;
            margin-right: 10px;
        }
        
        .success-message .text {
            font-size: 16px;
            color: #333333;
            font-weight: 500;
            line-height: 1.6;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #333333;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .details-box {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #e0e0e0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e8e8e8;
            align-items: flex-start;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            font-size: 14px;
            color: #666666;
            font-weight: 500;
            flex: 0 0 40%;
        }
        
        .detail-value {
            font-size: 14px;
            color: #333333;
            font-weight: 600;
            text-align: right;
            flex: 1;
            word-break: break-word;
        }
        
        .support-link {
            color: #F64C00;
            text-decoration: none;
            font-weight: 500;
        }
        
        .support-link:hover {
            text-decoration: underline;
        }
        
        .cta-button {
            display: inline-block;
            background: #F64C00;
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 25px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(246, 76, 0, 0.3);
            width: 100%;
            max-width: 100%;
        }
        
        .cta-button:hover {
            background: #e04500;
            box-shadow: 0 6px 16px rgba(246, 76, 0, 0.4);
            transform: translateY(-2px);
        }
        
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        
        .warning-box {
            background: #fff5f0;
            border-left: 4px solid #F64C00;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
        }
        
        .warning-box .title {
            font-size: 16px;
            font-weight: 600;
            color: #F64C00;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .warning-box .list {
            font-size: 14px;
            color: #333333;
            line-height: 1.8;
            padding-left: 20px;
        }
        
        .warning-box .list li {
            margin-bottom: 8px;
        }
        
        .footer {
            background-color: #f9f9f9;
            padding: 25px 20px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #666666;
            margin: 5px 0;
            line-height: 1.6;
        }
        
        .footer-brand {
            font-weight: 600;
            color: #007bff;
        }
        
        .footer-support {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e0e0e0;
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-wrapper {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 25px 15px;
            }
            
            .content {
                padding: 20px 15px;
            }
            
            .detail-row {
                flex-direction: column;
                gap: 5px;
            }
            
            .detail-label {
                flex: 1;
            }
            
            .detail-value {
                text-align: left;
            }
            
            .cta-button {
                display: block;
                width: 100%;
                padding: 18px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div style="padding: 20px 0; background-color: #f5f5f5;">
        <div class="email-wrapper">
            <!-- Header -->
            <div class="header">
                <div class="logo-container">
                    <img src="https://txipay.shop/uploads/produtos/originals/1762556330954_0c35c39ec0cb445f_ratixpay_completo.png" alt="RatixPay Logo" class="logo" onerror="this.style.display='none'">
                </div>

            </div>
            
            <!-- Content -->
            <div class="content">
                <p class="greeting">
                    Olá, <strong>${clienteNome}</strong>! a sua compra do produto <strong>"${produtoNome}"</strong>! foi confirmada! 🎉
                </p>
                <!-- Detalhes da Compra -->
                <h2 class="section-title">
                    📋 Detalhes da Compra
                </h2>
                
                <div class="details-box">
                    <div class="detail-row">
                        <span class="detail-label">ID Pedido:</span>
                        <span class="detail-value">${idPedidoFormatado}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Produto:</span>
                        <span class="detail-value">${produtoNome}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Valor Pago:</span>
                        <span class="detail-value">${valorFormatado}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Data da Compra:</span>
                        <span class="detail-value">${dataHoraCompleta}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Suporte:</span>
                        <span class="detail-value">
                            <a href="https://wa.me/258842363948" class="support-link">Falar com suporte</a>
                        </span>
                    </div>
                </div>
                
                ${produto.link_conteudo ? `
                <!-- Botão Principal -->
                <div class="button-container">
                    <a href="${produto.link_conteudo}" class="cta-button">
                        📥 Acessar Conteúdo do Produto
                    </a>
                </div>
                ` : ''}
                
                <!-- Avisos Importantes -->
                <div class="warning-box">
                    <div class="title">
                        <span>⚠️</span>
                        Importante:
                    </div>
                    <ul class="list">
                        <li>Guarde este e-mail como comprovante de sua compra.</li>
                        <li>O link do conteúdo é válido por tempo indeterminado.</li>
                        <li>Em caso de dúvidas, entre em contato com o suporte: <strong>${vendedorNome}</strong>.</li>
                    </ul>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p class="footer-text">
                    Obrigado por escolher <span class="footer-brand">RatixPay</span>!
                </p>
                <p class="footer-text">
                    Este é um e-mail automático. Para suporte, entre em contato conosco.
                </p>
                <div class="footer-support">
                    <p class="footer-text" style="margin-top: 15px; font-size: 11px; color: #999;">
                        © ${new Date().getFullYear()} RatixPay / Txi-pay – Sistema de Pagamentos
                    </p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Template fallback para email do vendedor - Design moderno e elegante
     */
    getFallbackEmailTemplate(dadosNotificacao, vendedor, dadosExtras) {
        const dataAprovacao = new Date(dadosExtras.data_venda || new Date());
        const dataFormatada = dataAprovacao.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        const horaFormatada = dataAprovacao.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        const dataHoraCompleta = `${dataFormatada}, ${horaFormatada}`;
        
        const valorCreditado = dadosExtras.valor_recebido || dadosExtras.valor_formatado || '0,00 MZN';
        const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
        
        // Preparar produtos bônus se existirem
        let produtosBonusDetalhesCompra = '';
        let produtosBonusDetalhesTransacao = '';
        let botoesBonusHtml = '';
        
        if (dadosNotificacao.temOrderBump && dadosNotificacao.produtosOrderBump && dadosNotificacao.produtosOrderBump.length > 0) {
            // Texto para detalhes de compra (+bonus {nome})
            produtosBonusDetalhesCompra = ' ' + dadosNotificacao.produtosOrderBump.map(p => `+bonus ${p.nome}`).join(', ');
            
            // HTML para detalhes da transação (Bonus: {nome})
            produtosBonusDetalhesTransacao = dadosNotificacao.produtosOrderBump.map(produto => 
                `<div class="detail-row">
                    <span class="detail-label">Bonus:</span>
                    <span class="detail-value">${produto.nome}</span>
                </div>`
            ).join('');
            
            // Botões de download para cada produto bônus (se tiver link)
            // Buscar links de conteúdo das vendas relacionadas se disponível
            botoesBonusHtml = dadosNotificacao.produtosOrderBump.map((produto, index) => {
                // Tentar obter link do produto
                let linkConteudo = produto.link_conteudo || '';
                
                // Se não tiver link, tentar buscar do produto original pelo ID
                if (!linkConteudo && produto.id) {
                    // O link será buscado na função enviarEmailVendedor antes de chamar este template
                    // Por enquanto, usar o que veio no produto
                    linkConteudo = produto.link_conteudo || '';
                }
                
                if (linkConteudo && linkConteudo.trim() !== '') {
                    return `
                        <div class="button-container" style="margin-bottom: 15px;">
                            <a href="${linkConteudo}" class="cta-button" style="background: #f59e0b; border: none;">
                                📥 Baixar Produto Bônus: ${produto.nome}
                            </a>
                        </div>
                    `;
                }
                return '';
            }).filter(html => html !== '').join('');
        }
        
        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Venda Realizada - RatixPay</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Poppins', 'Segoe UI', 'Roboto', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f5f5f5;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
        
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
            animation: fadeIn 0.5s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .header {
            background: transparent;
            color: #333333;
            padding: 30px 20px;
            text-align: center;
        }
        
        .logo-container {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .logo {
            max-width: 150px;
            height: auto;
            margin: 0 auto;
            display: block;
        }
        
        .content {
            padding: 30px 25px;
            background-color: #ffffff;
        }
        
        .greeting {
            font-size: 16px;
            color: #333333;
            margin-bottom: 25px;
        }
        
        .greeting strong {
            color: #F64C00;
            font-weight: 600;
        }
        
        .value-highlight {
            background: #fff5f0;
            border-left: 4px solid #F64C00;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
            text-align: center;
            animation: slideIn 0.6s ease-out;
        }
        
        @keyframes slideIn {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        .value-highlight .label {
            font-size: 14px;
            color: #666666;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .value-highlight .amount {
            font-size: 32px;
            font-weight: 700;
            color: #F64C00;
            margin: 0;
        }
        
        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #333333;
            margin: 30px 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .details-box {
            background-color: #f9f9f9;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border: 1px solid #e0e0e0;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #e8e8e8;
            align-items: flex-start;
        }
        
        .detail-row:last-child {
            border-bottom: none;
        }
        
        .detail-label {
            font-size: 14px;
            color: #666666;
            font-weight: 500;
            flex: 0 0 40%;
        }
        
        .detail-value {
            font-size: 14px;
            color: #333333;
            font-weight: 600;
            text-align: right;
            flex: 1;
            word-break: break-word;
        }
        
        .congratulations-box {
            background: #fff5f0;
            border-left: 4px solid #F64C00;
            padding: 20px;
            margin: 25px 0;
            border-radius: 6px;
        }
        
        .congratulations-box .icon {
            font-size: 24px;
            margin-right: 10px;
        }
        
        .congratulations-box .title {
            font-size: 18px;
            font-weight: 600;
            color: #F64C00;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        
        .congratulations-box .message {
            font-size: 14px;
            color: #333333;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            background: #F64C00;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 15px;
            text-align: center;
            margin: 25px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px rgba(246, 76, 0, 0.3);
        }
        
        .cta-button:hover {
            background: #e04500;
            box-shadow: 0 6px 16px rgba(246, 76, 0, 0.4);
            transform: translateY(-2px);
        }
        
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        
        .footer {
            background-color: #f9f9f9;
            padding: 25px 20px;
            text-align: center;
            border-top: 1px solid #e0e0e0;
        }
        
        .footer-text {
            font-size: 12px;
            color: #666666;
            margin: 5px 0;
            line-height: 1.6;
        }
        
        .footer-brand {
            font-weight: 600;
            color: #F64C00;
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-wrapper {
                margin: 0;
                border-radius: 0;
            }
            
            .header {
                padding: 25px 15px;
            }
            
            .content {
                padding: 20px 15px;
            }
            
            .value-highlight .amount {
                font-size: 28px;
            }
            
            .detail-row {
                flex-direction: column;
                gap: 5px;
            }
            
            .detail-label {
                flex: 1;
            }
            
            .detail-value {
                text-align: left;
            }
            
            .cta-button {
                display: block;
                width: 100%;
                padding: 16px;
            }
        }
    </style>
</head>
<body>
    <div style="padding: 20px 0; background-color: #f5f5f5;">
        <div class="email-wrapper">
            <!-- Header -->
            <div class="header">
                <div class="logo-container">
                    <img src="https://txipay.shop/uploads/produtos/originals/1762556330954_0c35c39ec0cb445f_ratixpay_completo.png" alt="RatixPay Logo" class="logo" onerror="this.style.display='none'">
                </div>
            </div>
            
            <!-- Content -->
            <div class="content">
                <p class="greeting">
                    Olá <strong>${vendedor.nome_completo || vendedor.nome || 'prezado parceiro'}</strong>,
                </p>
                
                <!-- Valor Creditado -->
                <div class="value-highlight">
                    <div class="label">💰 Valor creditado na sua conta</div>
                    <div class="amount">${valorCreditado}</div>
                </div>
                
                <!-- Detalhes da Transação -->
                <h2 class="section-title">
                    📋 Detalhes da Transação
                </h2>
                
                <div class="details-box">
                    <div class="detail-row">
                        <span class="detail-label">Nome do Comprador:</span>
                        <span class="detail-value">${dadosExtras.cliente_nome || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email do Comprador:</span>
                        <span class="detail-value">${dadosExtras.cliente_email || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">WhatsApp do Comprador:</span>
                        <span class="detail-value">${dadosExtras.cliente_whatsapp || dadosExtras.cliente_telefone || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Número da Transação:</span>
                        <span class="detail-value">#${dadosExtras.numero_pedido || dadosExtras.transacao_id || 'N/A'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Nome do Produto:</span>
                        <span class="detail-value">${dadosExtras.produto_nome || 'Produto'}${produtosBonusDetalhesCompra}</span>
                    </div>
                    ${produtosBonusDetalhesTransacao}
                    <div class="detail-row">
                        <span class="detail-label">Data de Aprovação:</span>
                        <span class="detail-value">${dataHoraCompleta}</span>
                    </div>
                </div>
                
                <!-- Botão CTA Principal -->
                <div class="button-container">
                    <a href="${baseUrl}/gestao-vendas.html" class="cta-button">
                        Ver no Painel da RatixPay
                    </a>
                </div>
                
                ${botoesBonusHtml}
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <p class="footer-text">
                    <span class="footer-brand">RatixPay</span> - Sistema de Vendas
                </p>
                <p class="footer-text">
                    Este é um email automático, por favor não responda.
                </p>
                <p class="footer-text" style="margin-top: 15px; font-size: 11px; color: #999;">
                    © ${new Date().getFullYear()} RatixPay. Todos os direitos reservados.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
        `;
    }

}

module.exports = new VendaNotificationService();
