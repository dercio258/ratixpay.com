/**
 * Serviço de Aprovação Manual de Transações com OTP
 * Gerencia aprovação manual de transações canceladas quando a API PayMoz não responde corretamente
 */

const { sequelize, Venda, Usuario, Produto } = require('../config/database');
const professionalEmailService = require('./professionalEmailService');
const vendaNotificationService = require('./vendaNotificationService');
const SaldoAdminService = require('./saldoAdminService');
const SaldoVendedorService = require('./saldoVendedorService');
const { Op } = require('sequelize');

// Armazenamento temporário de OTPs (em produção, usar Redis ou banco de dados)
const otpStorage = new Map();

// Controle de tentativas de OTP (proteção contra brute force)
const tentativasOTP = new Map(); // { vendaId: { tentativas: number, bloqueadoAte: timestamp } }

class AprovacaoTransacaoService {
    constructor() {
        this.otpExpirationTime = 1 * 60 * 1000; // 1 minuto
        this.cleanupInterval = 60 * 60 * 1000; // Limpar OTPs expirados a cada hora
        this.maxTentativasOTP = 5; // Máximo de tentativas de OTP inválido
        this.tempoBloqueioOTP = 15 * 60 * 1000; // 15 minutos de bloqueio após muitas tentativas
        this.maxSolicitacoesOTP = 3; // Máximo de solicitações de OTP por venda em 1 hora
        this.tempoLimiteSolicitacoes = 60 * 60 * 1000; // 1 hora
        
        // Iniciar limpeza automática de OTPs expirados
        setInterval(() => this.limparOtpsExpirados(), this.cleanupInterval);
        // Limpar tentativas antigas
        setInterval(() => this.limparTentativasAntigas(), 30 * 60 * 1000); // A cada 30 minutos
    }

    /**
     * Gera código OTP de 6 dígitos
     * @returns {string} Código OTP
     */
    gerarOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Busca email do admin
     * @returns {Promise<string>} Email do admin
     */
    async buscarEmailAdmin() {
        try {
            const admin = await Usuario.findOne({
                where: { role: 'admin' },
                order: [['created_at', 'ASC']], // Primeiro admin criado
                attributes: ['email']
            });
            
            if (!admin || !admin.email) {
                // Fallback para email padrão
                return process.env.ADMIN_EMAIL || 'ratixpay.mz@gmail.com';
            }
            
            return admin.email;
        } catch (error) {
            console.error('❌ Erro ao buscar email do admin:', error);
            return process.env.ADMIN_EMAIL || 'ratixpay.mz@gmail.com';
        }
    }

    /**
     * Solicita aprovação de transação (gera OTP e envia email)
     * @param {string} vendaId - ID da venda
     * @param {string} adminId - ID do admin que está solicitando
     * @returns {Promise<Object>} Resultado da solicitação
     */
    async solicitarAprovacao(vendaId, adminId) {
        try {
            // Verificar rate limiting de solicitações
            const solicitacoes = this.verificarSolicitacoesOTP(vendaId);
            if (solicitacoes.bloqueado) {
                throw new Error(`Muitas solicitações de OTP. Tente novamente após ${new Date(solicitacoes.bloqueadoAte).toLocaleString('pt-BR')}`);
            }

            // Buscar venda
            const venda = await Venda.findByPk(vendaId, {
                include: [
                    {
                        model: Produto,
                        as: 'produto',
                        attributes: ['id', 'nome', 'vendedor_id', 'custom_id']
                    }
                ]
            });

            if (!venda) {
                throw new Error('Venda não encontrada');
            }

            // Verificar se a venda está cancelada
            if (venda.status !== 'Cancelada') {
                throw new Error(`Venda não está cancelada. Status atual: ${venda.status}`);
            }

            // Verificar se já foi aprovada (race condition protection)
            if (venda.status === 'APROVADO' || venda.status === 'Pago') {
                throw new Error('Esta venda já foi aprovada');
            }

            // Verificar se já existe OTP pendente para esta venda
            const otpExistente = Array.from(otpStorage.values()).find(
                otp => otp.vendaId === vendaId && otp.expirado === false
            );

            if (otpExistente) {
                // Verificar se ainda é válido
                if (Date.now() < otpExistente.expiraEm) {
                    return {
                        sucesso: true,
                        otpEnviado: true,
                        mensagem: 'OTP já foi enviado. Verifique seu email.',
                        expiraEm: new Date(otpExistente.expiraEm).toISOString()
                    };
                } else {
                    // OTP expirado, remover e gerar novo
                    otpStorage.delete(otpExistente.otp);
                }
            }

            // Gerar novo OTP
            const otp = this.gerarOTP();
            const expiraEm = Date.now() + this.otpExpirationTime;

            // Armazenar OTP com informações de segurança
            otpStorage.set(otp, {
                vendaId,
                adminId, // Admin que solicitou (para validação)
                otp,
                expiraEm,
                criadoEm: Date.now(),
                usado: false,
                expirado: false,
                ipSolicitacao: null, // Será preenchido pela rota se disponível
                tentativasConfirmacao: 0
            });

            // Registrar solicitação para rate limiting
            this.registrarSolicitacaoOTP(vendaId);

            // Buscar email do admin
            const emailAdmin = await this.buscarEmailAdmin();

            // Preparar dados da venda para o email
            const dadosVenda = {
                id: venda.id,
                transactionId: venda.referencia_pagamento || venda.id_pedido || `TXN${String(venda.id).padStart(6, '0')}`,
                clienteNome: venda.cliente_nome || 'N/A',
                clienteEmail: venda.cliente_email || 'N/A',
                produtoNome: venda.produto?.nome || 'N/A',
                valor: parseFloat(venda.valor || 0),
                dataVenda: venda.created_at,
                metodoPagamento: venda.metodo_pagamento || 'N/A'
            };

            // Enviar email com OTP
            const assunto = `🔐 Código de Aprovação de Transação - ${dadosVenda.transactionId}`;
            const conteudo = this.gerarTemplateEmailOTP(otp, dadosVenda);

            await professionalEmailService.enviarEmailSistema(
                emailAdmin,
                assunto,
                conteudo,
                'sistema'
            );

            console.log(`✅ OTP gerado e enviado para aprovação de venda ${vendaId}`);
            console.log(`   OTP: ${otp}`);
            console.log(`   Expira em: ${new Date(expiraEm).toLocaleString('pt-BR')}`);

            return {
                sucesso: true,
                otpEnviado: true,
                mensagem: 'Código OTP enviado para seu email',
                expiraEm: new Date(expiraEm).toISOString()
            };

        } catch (error) {
            console.error('❌ Erro ao solicitar aprovação:', error);
            throw error;
        }
    }

    /**
     * Confirma aprovação de transação com OTP
     * @param {string} vendaId - ID da venda
     * @param {string} otp - Código OTP
     * @param {string} adminId - ID do admin que está aprovando
     * @returns {Promise<Object>} Resultado da aprovação
     */
    async confirmarAprovacao(vendaId, otp, adminId, ip = null) {
        const transaction = await sequelize.transaction();
        
        try {
            // Verificar se a venda está bloqueada por muitas tentativas
            const tentativas = tentativasOTP.get(vendaId);
            if (tentativas && tentativas.bloqueadoAte && Date.now() < tentativas.bloqueadoAte) {
                const tempoRestante = Math.ceil((tentativas.bloqueadoAte - Date.now()) / 1000 / 60);
                throw new Error(`Muitas tentativas de OTP inválidas. Tente novamente em ${tempoRestante} minutos.`);
            }

            // Verificar OTP
            const otpData = otpStorage.get(otp);

            if (!otpData) {
                this.registrarTentativaOTPInvalida(vendaId);
                throw new Error('Código OTP inválido');
            }

            if (otpData.vendaId !== vendaId) {
                this.registrarTentativaOTPInvalida(vendaId);
                throw new Error('Código OTP não corresponde a esta transação');
            }

            // SEGURANÇA: Verificar se o admin que confirma é o mesmo que solicitou
            if (otpData.adminId !== adminId) {
                console.warn(`⚠️ Tentativa de usar OTP de outro admin. Admin solicitante: ${otpData.adminId}, Admin tentando usar: ${adminId}`);
                this.registrarTentativaOTPInvalida(vendaId);
                throw new Error('Código OTP inválido. Este código foi solicitado por outro administrador.');
            }

            if (otpData.usado) {
                throw new Error('Código OTP já foi usado');
            }

            if (otpData.expirado || Date.now() > otpData.expiraEm) {
                otpData.expirado = true;
                throw new Error('Código OTP expirado. Solicite um novo código.');
            }

            // Buscar venda
            const venda = await Venda.findByPk(vendaId, {
                include: [
                    {
                        model: Produto,
                        as: 'produto',
                        attributes: ['id', 'nome', 'vendedor_id', 'custom_id', 'preco', 'link_conteudo']
                    }
                ],
                transaction
            });

            if (!venda) {
                throw new Error('Venda não encontrada');
            }

            if (venda.status !== 'Cancelada') {
                throw new Error(`Venda não está cancelada. Status atual: ${venda.status}`);
            }

            // Marcar OTP como usado
            otpData.usado = true;
            otpData.aprovadoEm = Date.now();
            otpData.aprovadoPor = adminId;

            // Atualizar status da venda para APROVADO
            // Atualizar tanto 'status' quanto 'pagamento_status' para garantir consistência
            await venda.update({
                status: 'APROVADO',
                pagamento_status: 'APROVADO', // Garantir que pagamento_status também seja atualizado
                data_aprovacao: new Date(),
                data_pagamento: new Date(), // Garantir que data_pagamento também seja atualizada
                observacoes: `${venda.observacoes || ''}\n\n[APROVAÇÃO MANUAL] Aprovado manualmente por admin em ${new Date().toLocaleString('pt-BR')} com OTP. Admin ID: ${adminId}`.trim()
            }, { transaction });

            // Buscar produto
            const produto = venda.produto;
            if (!produto) {
                throw new Error('Produto não encontrado');
            }

            // Calcular valores
            // venda.valor já é 90% do valor com desconto
            const valorTotalVenda = venda.valor / 0.9;
            const valorTotalParaCredito = valorTotalVenda;

            // Processar sistema de taxas (10% admin, 90% vendedor)
            try {
                const resultado = await SaldoAdminService.processarVendaAprovada(
                    venda.id,
                    valorTotalVenda,
                    produto.vendedor_id,
                    transaction
                );
                console.log('💰 Sistema de taxas processado na aprovação manual:');
                console.log(`   💳 Valor total: MZN ${valorTotalVenda.toFixed(2)}`);
                console.log(`   💼 Taxa admin (10%): MZN ${resultado.taxa_admin.toFixed(2)}`);
                console.log(`   👤 Receita vendedor (90%): MZN ${resultado.receita_vendedor.toFixed(2)}`);
            } catch (taxError) {
                console.error('⚠️ Erro ao processar taxas:', taxError.message);
                // Não falhar a aprovação por erro na taxa
            }

            // Creditar saldo do vendedor
            try {
                await SaldoVendedorService.creditarVenda(
                    produto.vendedor_id,
                    venda.id,
                    valorTotalParaCredito,
                    transaction
                );
                console.log(`✅ Saldo creditado ao vendedor: MZN ${venda.valor.toFixed(2)}`);
            } catch (creditError) {
                console.error('⚠️ Erro ao creditar saldo:', creditError.message);
                // Não falhar a aprovação por erro no crédito
            }

            // Incrementar vendas do produto
            await Produto.increment('vendas', {
                where: { id: produto.id },
                transaction
            });

            // Commit da transação
            await transaction.commit();

            // Atualizar receita e estatísticas do vendedor (fora da transação para não bloquear)
            try {
                const ReceitaService = require('./receitaService');
                const EstatisticasService = require('./estatisticasService');
                
                // Atualizar receita total do vendedor
                await ReceitaService.atualizarReceitaTotal(produto.vendedor_id);
                console.log(`✅ Receita total atualizada para o vendedor ${produto.vendedor_id}`);
                
                // Atualizar estatísticas completas do vendedor
                await EstatisticasService.atualizarEstatisticasVendedor(produto.vendedor_id);
                console.log(`✅ Estatísticas atualizadas para o vendedor ${produto.vendedor_id}`);
                
                // Recalcular agregados (saldo, receita do dia, etc.)
                SaldoVendedorService.recalcularAgregados(produto.vendedor_id).catch(() => {});
                console.log(`✅ Agregados recalculados para o vendedor ${produto.vendedor_id}`);
            } catch (statsError) {
                console.error('⚠️ Erro ao atualizar receita e estatísticas:', statsError.message);
                // Não falhar a aprovação por erro nas estatísticas
            }

            // Recarregar venda após commit para ter dados atualizados
            await venda.reload();

            // Enviar notificações (fora da transação para não bloquear)
            try {
                // Preparar dados do cliente
                const cliente = {
                    nome: venda.cliente_nome,
                    email: venda.cliente_email,
                    telefone: venda.cliente_telefone,
                    whatsapp: venda.cliente_whatsapp,
                    ip: venda.cliente_ip || '0.0.0.0'
                };

                // Usar vendaNotificationService para enviar notificações
                // Isso garante que todas as notificações sejam enviadas corretamente
                await vendaNotificationService.enviarNotificacaoConteudoPronto(venda.id);
                await vendaNotificationService.enviarNotificacaoNovaVenda(venda.id);

                // Enviar WhatsApp para o cliente após aprovação manual
                await this.enviarWhatsAppClienteAprovacaoManual(venda, produto);

                console.log('✅ Notificações enviadas para cliente e vendedor (email, WhatsApp e push)');
            } catch (notifError) {
                console.error('⚠️ Erro ao enviar notificações:', notifError.message);
                // Não falhar a aprovação por erro nas notificações
            }

            // Remover OTP usado
            otpStorage.delete(otp);

            console.log(`✅ Transação ${vendaId} aprovada manualmente com sucesso`);

            return {
                sucesso: true,
                mensagem: 'Transação aprovada com sucesso',
                venda: {
                    id: venda.id,
                    status: venda.status,
                    valor: venda.valor
                }
            };

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao confirmar aprovação:', error);
            throw error;
        }
    }

    /**
     * Gera template HTML para email com OTP
     * @param {string} otp - Código OTP
     * @param {Object} dadosVenda - Dados da venda
     * @returns {string} HTML do email
     */
    gerarTemplateEmailOTP(otp, dadosVenda) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #F64C00 0%, #e63900 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
                    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
                    .otp-box { background: white; border: 3px solid #F64C00; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #F64C00; letter-spacing: 5px; }
                    .info-box { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #F64C00; }
                    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                    .info-label { font-weight: bold; color: #666; }
                    .info-value { color: #333; }
                    .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Código de Aprovação de Transação</h1>
                        <p>RatixPay - Sistema de Gestão</p>
                    </div>
                    <div class="content">
                        <p>Olá Administrador,</p>
                        <p>Foi solicitada a aprovação manual de uma transação cancelada. Use o código abaixo para confirmar a aprovação:</p>
                        
                        <div class="otp-box">
                            <div style="font-size: 14px; color: #666; margin-bottom: 10px;">CÓDIGO DE APROVAÇÃO</div>
                            <div class="otp-code">${otp}</div>
                            <div style="font-size: 12px; color: #666; margin-top: 10px;">Válido por 1 minuto</div>
                        </div>

                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #F64C00;">📋 Detalhes da Transação</h3>
                            <div class="info-row">
                                <span class="info-label">ID da Transação:</span>
                                <span class="info-value">${dadosVenda.transactionId}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Cliente:</span>
                                <span class="info-value">${dadosVenda.clienteNome}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Email:</span>
                                <span class="info-value">${dadosVenda.clienteEmail}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Produto:</span>
                                <span class="info-value">${dadosVenda.produtoNome}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Valor:</span>
                                <span class="info-value">MZN ${dadosVenda.valor.toFixed(2)}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Método de Pagamento:</span>
                                <span class="info-value">${dadosVenda.metodoPagamento}</span>
                            </div>
                            <div class="info-row" style="border-bottom: none;">
                                <span class="info-label">Data da Venda:</span>
                                <span class="info-value">${new Date(dadosVenda.dataVenda).toLocaleString('pt-BR')}</span>
                            </div>
                        </div>

                        <div class="warning">
                            <strong>⚠️ ATENÇÃO:</strong>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Este código expira em <strong>1 minuto</strong></li>
                                <li>Use este código apenas na página de gestão de negócio</li>
                                <li>Não compartilhe este código com ninguém</li>
                                <li>A aprovação irá creditar o valor na receita do vendedor e enviar notificações</li>
                            </ul>
                        </div>

                        <p style="margin-top: 30px;">
                            <strong>Como usar:</strong><br>
                            1. Acesse a página de Gestão de Negócio<br>
                            2. Localize a transação na tabela<br>
                            3. Clique em "Aprovar Transação"<br>
                            4. Digite o código acima quando solicitado
                        </p>
                    </div>
                    <div class="footer">
                        <p>Este é um email automático do sistema RatixPay. Não responda este email.</p>
                        <p>&copy; ${new Date().getFullYear()} RatixPay. Todos os direitos reservados.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Limpa OTPs expirados do armazenamento
     */
    limparOtpsExpirados() {
        const agora = Date.now();
        let removidos = 0;

        for (const [otp, data] of otpStorage.entries()) {
            if (agora > data.expiraEm || data.usado) {
                otpStorage.delete(otp);
                removidos++;
            }
        }

        if (removidos > 0) {
            console.log(`🧹 Limpeza automática: ${removidos} OTP(s) expirado(s) removido(s)`);
        }
    }

    /**
     * Registra tentativa de OTP inválida (proteção contra brute force)
     */
    registrarTentativaOTPInvalida(vendaId) {
        const agora = Date.now();
        const tentativas = tentativasOTP.get(vendaId) || { tentativas: 0, bloqueadoAte: null };

        tentativas.tentativas++;

        // Se exceder o limite, bloquear por 15 minutos
        if (tentativas.tentativas >= this.maxTentativasOTP) {
            tentativas.bloqueadoAte = agora + this.tempoBloqueioOTP;
            console.warn(`🔒 Venda ${vendaId} bloqueada por muitas tentativas de OTP inválidas. Bloqueio até: ${new Date(tentativas.bloqueadoAte).toLocaleString('pt-BR')}`);
        }

        tentativasOTP.set(vendaId, tentativas);
    }

    /**
     * Verifica e registra solicitações de OTP (rate limiting)
     */
    verificarSolicitacoesOTP(vendaId) {
        const agora = Date.now();
        const chave = `solicitacoes_${vendaId}`;
        const solicitacoes = otpStorage.get(chave) || { count: 0, primeiraSolicitacao: agora };

        // Resetar contador se passou o tempo limite
        if (agora - solicitacoes.primeiraSolicitacao > this.tempoLimiteSolicitacoes) {
            solicitacoes.count = 0;
            solicitacoes.primeiraSolicitacao = agora;
        }

        // Verificar se excedeu o limite
        if (solicitacoes.count >= this.maxSolicitacoesOTP) {
            const tempoRestante = this.tempoLimiteSolicitacoes - (agora - solicitacoes.primeiraSolicitacao);
            return {
                bloqueado: true,
                bloqueadoAte: new Date(agora + tempoRestante)
            };
        }

        return { bloqueado: false };
    }

    /**
     * Registra uma solicitação de OTP
     */
    registrarSolicitacaoOTP(vendaId) {
        const agora = Date.now();
        const chave = `solicitacoes_${vendaId}`;
        const solicitacoes = otpStorage.get(chave) || { count: 0, primeiraSolicitacao: agora };

        solicitacoes.count++;
        if (solicitacoes.count === 1) {
            solicitacoes.primeiraSolicitacao = agora;
        }

        otpStorage.set(chave, solicitacoes);
    }

    /**
     * Limpa tentativas antigas do armazenamento
     */
    limparTentativasAntigas() {
        const agora = Date.now();
        let removidos = 0;

        for (const [vendaId, tentativas] of tentativasOTP.entries()) {
            // Remover se o bloqueio expirou e não há mais tentativas recentes
            if (tentativas.bloqueadoAte && agora > tentativas.bloqueadoAte) {
                // Manter por mais 1 hora após desbloqueio para histórico
                if (agora > tentativas.bloqueadoAte + (60 * 60 * 1000)) {
                    tentativasOTP.delete(vendaId);
                    removidos++;
                }
            }
        }

        if (removidos > 0) {
            console.log(`🧹 Limpeza automática: ${removidos} registro(s) de tentativas antigas removido(s)`);
        }
    }

    /**
     * Busca transações canceladas que podem ser aprovadas
     * @param {Object} filtros - Filtros de busca
     * @returns {Promise<Array>} Lista de transações
     */
    async buscarTransacoesCanceladas(filtros = {}) {
        try {
            const whereClause = {
                status: 'Cancelada'
            };

            // Filtros opcionais
            if (filtros.dataInicio && filtros.dataFim) {
                whereClause.created_at = {
                    [Op.between]: [new Date(filtros.dataInicio), new Date(filtros.dataFim)]
                };
            }

            if (filtros.clienteNome) {
                whereClause.cliente_nome = {
                    [Op.iLike]: `%${filtros.clienteNome}%`
                };
            }

            if (filtros.transactionId) {
                whereClause[Op.or] = [
                    { referencia_pagamento: { [Op.iLike]: `%${filtros.transactionId}%` } },
                    { id_pedido: { [Op.iLike]: `%${filtros.transactionId}%` } }
                ];
            }

            const vendas = await Venda.findAll({
                where: whereClause,
                include: [
                    {
                        model: Produto,
                        as: 'produto',
                        attributes: ['id', 'nome', 'custom_id', 'vendedor_id']
                    },
                    {
                        model: Usuario,
                        as: 'vendedorVenda',
                        attributes: ['id', 'nome_completo']
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: filtros.limit || 50
            });

            return vendas.map(venda => ({
                id: venda.id,
                transactionId: venda.referencia_pagamento || venda.id_pedido || `TXN${String(venda.id).padStart(6, '0')}`,
                clienteNome: venda.cliente_nome,
                clienteEmail: venda.cliente_email,
                produtoNome: venda.produto?.nome || 'N/A',
                valor: parseFloat(venda.valor || 0),
                dataVenda: venda.created_at,
                metodoPagamento: venda.metodo_pagamento || 'N/A',
                vendedorNome: venda.vendedorVenda?.nome_completo || 'N/A',
                temOtpPendente: Array.from(otpStorage.values()).some(
                    otp => otp.vendaId === venda.id && !otp.usado && !otp.expirado && Date.now() < otp.expiraEm
                )
            }));

        } catch (error) {
            console.error('❌ Erro ao buscar transações canceladas:', error);
            throw error;
        }
    }

    /**
     * Enviar WhatsApp para o cliente após aprovação manual
     * @param {Object} venda - Dados da venda
     * @param {Object} produto - Dados do produto
     */
    async enviarWhatsAppClienteAprovacaoManual(venda, produto) {
        try {
            // Verificar se cliente forneceu WhatsApp
            const whatsappCliente = venda.cliente_whatsapp || venda.cliente_telefone;
            if (!whatsappCliente) {
                console.log('ℹ️ Cliente não forneceu WhatsApp. WhatsApp não será enviado.');
                return;
            }

            // Verificar se produto tem link de conteúdo
            const linkConteudo = produto.link_conteudo;
            if (!linkConteudo) {
                console.log('ℹ️ Produto não possui link de conteúdo. WhatsApp não será enviado.');
                return;
            }

            console.log('📱 Preparando envio de WhatsApp para cliente após aprovação manual...');
            console.log('   Cliente:', venda.cliente_nome);
            console.log('   WhatsApp:', whatsappCliente);
            console.log('   Pedido:', venda.numero_pedido);
            console.log('   Produto:', produto.nome);
            console.log('   Link:', linkConteudo);

            // Carregar serviço de sessão WhatsApp
            const whatsappManager = require('./whatsappManager');
            const sessionId = 'default';
            const sessionStatus = whatsappManager.getStatus(sessionId);
            if (!sessionStatus.exists || !sessionStatus.isConnected) {
                console.log('ℹ️ Sessão WhatsApp não está conectada. WhatsApp não será enviado.');
                return;
            }

            // Formatar número do cliente para WhatsApp
            function formatPhoneNumber(phone) {
                if (!phone) return null;
                let cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = cleanPhone.substring(1);
                }
                if (!cleanPhone.startsWith('258')) {
                    cleanPhone = '258' + cleanPhone;
                }
                return cleanPhone;
            }

            const clientPhone = formatPhoneNumber(whatsappCliente);
            if (!clientPhone) {
                console.log('⚠️ Número de WhatsApp inválido:', whatsappCliente);
                return;
            }

            // Obter valor da venda
            const valorTotal = venda.valor || produto.preco || 0;

            // Enviar recibo de compra
            const reciboMensagem = `📋 *RECIBO DE COMPRA - RatixPay*

Olá *${venda.cliente_nome || 'Cliente'}*!

✅ *Compra Confirmada*
📦 *Produto:* ${produto.nome || 'Produto'}
🔢 *Pedido:* #${venda.numero_pedido || venda.id}
💰 *Valor Pago:* MZN ${valorTotal.toFixed(2)}
📅 *Data:* ${new Date().toLocaleString('pt-BR')}

Obrigado por sua compra! 🎉

*RatixPay - Sistema de Pagamentos*`;

            try {
                // 1. Enviar recibo de compra
                console.log('📋 Enviando recibo de compra para:', clientPhone);
                await whatsappManager.sendMessage(clientPhone, reciboMensagem, null, sessionId);
                console.log('✅ Recibo de compra enviado via WhatsApp');

                // 2. Enviar link do produto
                const mensagemProduto = `📦 *Seu Produto está Pronto!*

*${produto.nome || 'Produto'}*

🔗 *Acesse seu conteúdo:*
${linkConteudo}

Se tiver alguma dúvida, entre em contato conosco.

*RatixPay*`;

                console.log('📦 Enviando link do produto para:', clientPhone);
                await whatsappManager.sendMessage(clientPhone, mensagemProduto, null, sessionId);
                console.log('✅ Link do produto enviado via WhatsApp');

                console.log('✅ WhatsApp enviado com sucesso para o cliente após aprovação manual');
            } catch (whatsappError) {
                console.error('❌ Erro ao enviar WhatsApp para cliente:', whatsappError);
                // Não falhar a aprovação por erro de WhatsApp
            }
        } catch (error) {
            console.error('❌ Erro ao preparar envio de WhatsApp para cliente:', error);
            // Não falhar a aprovação por erro de WhatsApp
        }
    }
}

module.exports = new AprovacaoTransacaoService();

