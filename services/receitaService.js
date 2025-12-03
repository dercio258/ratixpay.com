const { Venda, Pagamento, Usuario, EstatisticasVendedor, HistoricoSaques, SaldoAdmin } = require('../config/database');
const { Op } = require('sequelize');
// WhatsApp Session Manager será usado quando necessário
const professionalEmailService = require('./professionalEmailService');
const SaldoAdminService = require('./saldoAdminService');
const vendedorCache = require('./vendedorCache');

class ReceitaService {
    
    /**
     * Atualiza a receita total de um vendedor específico
     * NOVA LÓGICA: Tudo é receita total, não há mais saques pendentes
     * Quando um saque é processado, é subtraído da receita e vai direto para o admin
     */
    static async atualizarReceitaTotal(vendedorId) {
        try {
            console.log(`🔄 Atualizando receita total do vendedor ${vendedorId}...`);
            
            // Verificar cache primeiro
            const cachedStats = vendedorCache.getStats(vendedorId);
            if (cachedStats) {
                console.log(`📋 Usando estatísticas do cache para vendedor ${vendedorId}`);
                return cachedStats;
            }
            
            // Verificar se o vendedor existe
            let vendedor = vendedorCache.getVendedor(vendedorId);
            if (!vendedor) {
                vendedor = await Usuario.findByPk(vendedorId);
                if (!vendedor) {
                    throw new Error(`Vendedor com ID ${vendedorId} não encontrado`);
                }
                vendedorCache.setVendedor(vendedorId, vendedor);
            }
            
            console.log(`✅ Vendedor encontrado: ${vendedor.nome_completo || vendedor.email}`);
            
            // Buscar todas as vendas aprovadas do vendedor
            console.log(`🔍 Buscando vendas aprovadas...`);
            const vendasAprovadas = await Venda.findAll({
                where: { 
                    vendedor_id: vendedorId,
                    status: {
                        [Op.in]: ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'approved', 'paid']
                    }
                },
                attributes: ['valor', 'created_at']
            });
            
            console.log(`📊 ${vendasAprovadas.length} vendas aprovadas encontradas`);
            
            // Calcular receita total das vendas aprovadas
            // O pagamento_valor já é 90% do valor original, então usamos diretamente
            const receitaTotalVendas = vendasAprovadas.reduce((total, venda) => {
                const valor = parseFloat(venda.valor || 0);
                return total + (isNaN(valor) ? 0 : valor);
            }, 0);
            
            // Buscar saques processados (pagos) e pendentes do vendedor para subtrair da receita
            console.log(`🔍 Buscando saques processados e pendentes...`);
            const saquesProcessados = await Pagamento.findAll({
                where: { 
                    vendedor_id: vendedorId,
                    status: {
                        [Op.in]: ['aprovado', 'pago', 'pendente']
                    }
                },
                attributes: ['valor']
            });
            
            console.log(`📤 ${saquesProcessados.length} saques (processados + pendentes) encontrados`);
            
            // Calcular valor total dos saques processados
            const valorSaquesProcessados = saquesProcessados.reduce((total, saque) => {
                const valor = parseFloat(saque.valor || 0);
                return total + (isNaN(valor) ? 0 : valor);
            }, 0);
            
            // NOVA LÓGICA: A receita disponível é a receita total MENOS os saques processados e pendentes
            const receitaDisponivel = Math.max(0, receitaTotalVendas - valorSaquesProcessados);
            
            console.log(`📊 Vendedor ${vendedorId}:`);
            console.log(`💰 Receita total das vendas: MZN ${receitaTotalVendas.toFixed(2)}`);
            console.log(`📤 Saques processados: MZN ${valorSaquesProcessados.toFixed(2)}`);
            console.log(`💳 Receita disponível: MZN ${receitaDisponivel.toFixed(2)} (receita total - saques processados e pendentes)`);
            
            // Atualizar ou criar estatísticas do vendedor
            console.log(`💾 Atualizando estatísticas do vendedor...`);
            const [estatisticas, created] = await EstatisticasVendedor.findOrCreate({
                where: { vendedor_id: vendedorId },
                defaults: {
                    receita_total: parseFloat(receitaTotalVendas.toFixed(2)),
                    receita_disponivel: parseFloat(receitaDisponivel.toFixed(2)),
                    total_vendas: vendasAprovadas.length,
                    valor_saques_pagos: 0, // SEMPRE ZERO - saques processados são subtraídos da receita
                    valor_saques_pendentes: 0, // ZERO - não há mais saques pendentes
                    ultima_atualizacao: new Date()
                }
            });
            
            if (!created) {
                await estatisticas.update({
                    receita_total: parseFloat(receitaTotalVendas.toFixed(2)),
                    receita_disponivel: parseFloat(receitaDisponivel.toFixed(2)),
                    total_vendas: vendasAprovadas.length,
                    valor_saques_pagos: 0, // SEMPRE ZERO - saques processados são subtraídos da receita
                    valor_saques_pendentes: 0, // ZERO - não há mais saques pendentes
                    ultima_atualizacao: new Date()
                });
            }
            
            console.log(`✅ Receita atualizada para vendedor ${vendedorId}`);
            
            const result = {
                receitaTotal: parseFloat(receitaTotalVendas.toFixed(2)),
                receitaDisponivel: parseFloat(receitaDisponivel.toFixed(2)),
                valorSaquesProcessados: 0, // SEMPRE ZERO - saques processados são subtraídos da receita
                totalVendas: vendasAprovadas.length,
                ultimaAtualizacao: new Date()
            };
            
            // Salvar no cache
            vendedorCache.setStats(vendedorId, result);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Erro ao atualizar receita do vendedor ${vendedorId}:`, error);
            console.error(`📋 Stack trace:`, error.stack);
            throw error;
        }
    }
    
    /**
     * Limpar cache de um vendedor específico
     * Usado quando há mudanças que afetam a receita
     */
    static clearVendedorCache(vendedorId) {
        vendedorCache.clearVendedor(vendedorId);
        console.log(`🗑️ Cache limpo para vendedor ${vendedorId}`);
    }
    
    /**
     * Limpar todo o cache de vendedores
     */
    static clearAllCache() {
        vendedorCache.clearAll();
        console.log(`🗑️ Todo o cache de vendedores foi limpo`);
    }
    
    /**
     * Busca a receita total atualizada de um vendedor
     * Sempre atualiza antes de retornar para garantir sincronização
     */
    static async buscarReceitaTotal(vendedorId) {
        try {
            // Sempre atualizar antes de buscar para garantir sincronização
            const receitaAtualizada = await this.atualizarReceitaTotal(vendedorId);
            return receitaAtualizada;
        } catch (error) {
            console.error('❌ Erro ao buscar receita total:', error);
            throw error;
        }
    }
    
    /**
     * Busca receita total de todos os vendedores (para admin)
     * Com atualização automática
     */
    static async buscarReceitaTodosVendedores() {
        try {
            console.log('🔄 Buscando receita total de todos os vendedores...');
            
            // Buscar todos os vendedores
            const vendedores = await Usuario.findAll({
                where: { 
                    [Op.or]: [
                        { role: 'user' },
                        { tipo_conta: 'vendedor' }
                    ]
                },
                attributes: ['id', 'nome_completo', 'email', 'telefone', 'role', 'tipo_conta']
            });
            
            const receitasVendedores = [];
            
            // Atualizar e buscar receita de cada vendedor
            for (const vendedor of vendedores) {
                try {
                    const receita = await this.atualizarReceitaTotal(vendedor.id);
                    receitasVendedores.push({
                        vendedorId: vendedor.id,
                        vendedorNome: vendedor.nome_completo,
                        vendedorEmail: vendedor.email,
                        vendedorTelefone: vendedor.telefone,
                        receitaTotal: receita.receitaTotal,
                        receitaDisponivel: receita.receitaDisponivel,
                        totalVendas: receita.totalVendas,
                        valorSaquesProcessados: receita.valorSaquesProcessados,
                        ultimaAtualizacao: receita.ultimaAtualizacao
                    });
                } catch (error) {
                    console.error(`❌ Erro ao buscar receita do vendedor ${vendedor.id}:`, error);
                    // Continuar com outros vendedores
                }
            }
            
            console.log(`✅ Receita de ${receitasVendedores.length} vendedores atualizada`);
            return receitasVendedores;
            
        } catch (error) {
            console.error('❌ Erro ao buscar receita de todos os vendedores:', error);
            throw error;
        }
    }
    
    /**
     * Processa solicitação de saque e atualiza receita
     * NOVO: Verifica se há saque pendente antes de processar
     */
    static async processarSolicitacaoSaque(vendedorId, valorSolicitado, dadosSaque) {
        try {
            console.log(`🔄 Processando solicitação de saque para vendedor ${vendedorId}...`);
            
            // Verificar se há saque pendente
            const saquePendente = await Pagamento.findOne({
                where: {
                    vendedor_id: vendedorId,
                    status: 'pendente'
                }
            });
            
            if (saquePendente) {
                throw new Error('Você já possui um saque pendente. Aguarde a confirmação do administrador antes de solicitar outro saque.');
            }
            
            // Verificar se vendedor tem receita suficiente
            const receitaAtual = await this.buscarReceitaTotal(vendedorId);
            
            if (receitaAtual.receitaDisponivel < valorSolicitado) {
                throw new Error(`Receita disponível insuficiente. Disponível: MZN ${receitaAtual.receitaDisponivel.toFixed(2)}, Solicitado: MZN ${valorSolicitado.toFixed(2)}`);
            }
            
            // Buscar dados do vendedor para preencher campos obrigatórios
            const vendedor = await Usuario.findByPk(vendedorId);
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            // Gerar ID público memorável (formato: apenas números de 6 dígitos, ex: 606734)
            function gerarPublicId() {
                const numero = Math.floor(100000 + Math.random() * 900000); // 6 dígitos (100000-999999)
                return numero.toString(); // Retornar apenas o número como string
            }
            
            let publicId = gerarPublicId();
            
            // Verificar se o ID já existe (evitar conflitos)
            let publicIdExists = await Pagamento.findOne({ where: { public_id: publicId } });
            
            // Se existir, gerar novo ID (máximo 10 tentativas)
            let tentativas = 0;
            while (publicIdExists && tentativas < 10) {
                publicId = gerarPublicId();
                publicIdExists = await Pagamento.findOne({ where: { public_id: publicId } });
                tentativas++;
            }
            
            if (tentativas >= 10) {
                throw new Error('Erro ao gerar ID público único. Tente novamente.');
            }
            
            // Calcular taxa e valor líquido (exemplo: 5% de taxa)
            const taxa = valorSolicitado * 0.05; // 5% de taxa
            const valorLiquido = valorSolicitado - taxa;
            
            console.log(`🔍 Dados do saque recebidos:`, dadosSaque);
            console.log(`🔍 Método de pagamento: ${dadosSaque.metodoPagamento}`);
            console.log(`🔍 Conta destino: ${dadosSaque.contaDestino}`);
            console.log(`🔍 Banco: ${dadosSaque.banco}`);
            console.log(`🔍 Observações: ${dadosSaque.observacoes}`);
            console.log(`🔍 Telefone titular: ${dadosSaque.telefoneTitular}`);
            
            // Preparar observações com dados completos da carteira
            let observacoesCompletas = dadosSaque.observacoes || '';
            
            // Adicionar dados completos da carteira nas observações para o admin
            if (dadosSaque.dadosCarteiraCompleta) {
                const dadosCarteira = dadosSaque.dadosCarteiraCompleta;
                observacoesCompletas += `\n\n=== DADOS COMPLETOS DA CARTEIRA ===\n`;
                observacoesCompletas += `\n📱 MPESA:\n`;
                observacoesCompletas += `   Contacto: ${dadosCarteira.mpesa.contacto}\n`;
                observacoesCompletas += `   Nome Titular: ${dadosCarteira.mpesa.nomeTitular}\n`;
                observacoesCompletas += `\n📱 EMOLA:\n`;
                observacoesCompletas += `   Contacto: ${dadosCarteira.emola.contacto}\n`;
                observacoesCompletas += `   Nome Titular: ${dadosCarteira.emola.nomeTitular}\n`;
                observacoesCompletas += `\n📧 Email: ${dadosCarteira.email}\n`;
                observacoesCompletas += `\n⏰ Data/Hora Solicitação: ${new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}\n`;
                observacoesCompletas += `🆔 ID Público: ${publicId}\n`;
            }
            
            // Criar registro de saque com todos os campos obrigatórios
            const saque = await Pagamento.create({
                public_id: publicId,
                vendedor_id: vendedorId,
                valor: valorSolicitado,
                valor_liquido: valorLiquido,
                taxa: taxa,
                nome_titular: dadosSaque.nomeTitular || vendedor.nome_completo || 'Nome não informado',
                telefone_titular: dadosSaque.telefoneTitular || vendedor.telefone || 'Telefone não informado',
                metodo: dadosSaque.metodoPagamento || 'Mpesa',
                status: 'pendente',
                data_solicitacao: new Date(),
                conta_destino: dadosSaque.contaDestino,
                banco: dadosSaque.banco,
                observacoes: observacoesCompletas,
                ip_solicitacao: dadosSaque.ipSolicitacao,
                user_agent: dadosSaque.userAgent
            });
            
            console.log(`✅ Saque criado com sucesso: ID ${saque.id}, Public ID: ${publicId}`);
            console.log(`💰 Valor solicitado: MZN ${valorSolicitado.toFixed(2)}`);
            console.log(`📅 Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}`);
            
            // IMPORTANTE: Subtrair saldo IMEDIATAMENTE ao criar o saque (independente de aprovação/recusa)
            // Isso garante que o saldo seja bloqueado assim que o saque é solicitado
            await this.atualizarReceitaTotal(vendedorId);
            console.log(`✅ Saldo subtraído imediatamente da receita disponível`);
            
            // Enviar notificações de saque pendente
            try {
                const SaqueNotificationService = require('./saqueNotificationService');
                await SaqueNotificationService.notificarAdminSaquePendente(saque);
            } catch (notificationError) {
                console.error('❌ Erro ao enviar notificação de saque pendente:', notificationError);
                // Não falhar o saque por erro de notificação
            }
            
            console.log(`✅ Solicitação de saque processada com sucesso: ID ${saque.id}`);
            
            // Retornar saque completo para notificações
            return {
                success: true,
                saqueId: saque.id,
                publicId: publicId,
                saque: saque, // Incluir objeto saque completo para notificações
                receitaAtualizada: await this.buscarReceitaTotal(vendedorId)
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar solicitação de saque:', error);
            throw error;
        }
    }
    
    /**
     * Processa aprovação/rejeição de saque pelo admin
     */
    static async processarAcaoAdmin(saqueId, acao, dadosAdmin) {
        try {
            console.log(`🔄 Processando ação de admin no saque ${saqueId}: ${acao}...`);
            
            // Buscar saque
            const saque = await Pagamento.findByPk(saqueId, {
                include: [{
                    model: Usuario,
                    as: 'vendedorPagamento',
                    attributes: ['id', 'nome_completo', 'email', 'telefone']
                }]
            });
            
            if (!saque) {
                throw new Error('Saque não encontrado');
            }
            
            // Atualizar status do saque
            const updateData = {
                status: acao === 'aprovar' ? 'aprovado' : 'rejeitado',
                data_processamento: new Date(),
                processado_por: dadosAdmin.adminId,
                observacoes_admin: dadosAdmin.observacoes
            };
            
            if (acao === 'aprovar') {
                updateData.data_aprovacao = new Date();
            } else if (acao === 'rejeitar') {
                updateData.motivo_rejeicao = dadosAdmin.motivoRejeicao;
            }
            
            await saque.update(updateData);
            
            // Atualizar receita do vendedor
            await this.atualizarReceitaTotal(saque.vendedor_id);
            
            // Registrar no histórico
            await HistoricoSaques.create({
                saque_id: saque.id,
                vendedor_id: saque.vendedor_id,
                valor_solicitado: saque.valor,
                status_anterior: saque.status,
                status_novo: updateData.status,
                acao_admin: acao,
                admin_id: dadosAdmin.adminId,
                observacoes: dadosAdmin.observacoes,
                data_alteracao: new Date()
            });
            
            // Enviar notificações específicas baseadas na ação
            try {
                const SaqueNotificationService = require('./saqueNotificationService');
                
                if (acao === 'aprovar') {
                    await SaqueNotificationService.notificarVendedorSaqueAprovado(saque);
                    // Aguardar um pouco antes de enviar notificação de confirmação
                    setTimeout(async () => {
                        await SaqueNotificationService.notificarVendedorConfirmarPagamento(saque);
                    }, 2000);
                }
            } catch (notificationError) {
                console.error('❌ Erro ao enviar notificações de saque:', notificationError);
                // Não falhar a operação por erro de notificação
            }
            
            console.log(`✅ Ação de admin processada: ${acao} no saque ${saqueId}`);
            
            return {
                success: true,
                saque: saque,
                receitaAtualizada: await this.buscarReceitaTotal(saque.vendedor_id)
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar ação de admin:', error);
            throw error;
        }
    }
    
    /**
     * Envia notificações por WhatsApp e email para saques
     */
    static async enviarNotificacoesSaque(saque, vendedor, tipoNotificacao) {
        try {
            console.log(`📱 Enviando notificações de saque: ${tipoNotificacao}...`);
            
            const valorFormatado = new Intl.NumberFormat('pt-MZ', {
                style: 'currency',
                currency: 'MZN'
            }).format(saque.valor);
            
            const dataFormatada = new Date(saque.data_solicitacao).toLocaleString('pt-MZ');
            
            // Mensagem base para WhatsApp
            let mensagemWhatsApp = '';
            
            switch (tipoNotificacao) {
                case 'solicitacao':
                    mensagemWhatsApp = `💰 *Novo Saque*

👤 ${vendedor.nome_completo}
💰 ${valorFormatado}

RatixPay`;
                    break;
                    
                case 'aprovar':
                    mensagemWhatsApp = `✅ *Saque Aprovado*

👤 ${vendedor.nome_completo}
💰 ${valorFormatado}

RatixPay`;
                    break;
                    
                case 'rejeitar':
                    mensagemWhatsApp = `❌ *Saque Rejeitado*

👤 ${vendedor.nome_completo}
💰 ${valorFormatado}

RatixPay`;
                    break;
            }
            
            // Enviar para admin
            if (tipoNotificacao === 'solicitacao') {
                try {
                    const whatsappManager = require('./whatsappManager');
                    const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
                    await whatsappManager.sendNotificationSafely(adminPhone, mensagemWhatsApp, null, 'sistema');
                } catch (whatsappError) {
                    console.error('❌ Erro ao enviar WhatsApp para admin:', whatsappError);
                    console.log(`📱 Mensagem que seria enviada para admin: ${mensagemWhatsApp}`);
                }
                
                // Email para admin
                try {
                    // Enviar email para admin sobre saque
                    await professionalEmailService.enviarEmailSistema(
                        'admin@ratixpay.com',
                        `💰 Novo Saque Solicitado - ${vendedor.nome_completo}`,
                        `Saque de ${saque.valor} MZN solicitado por ${vendedor.nome_completo}`,
                        'saque_admin'
                    );
                } catch (emailError) {
                    console.error('❌ Erro ao enviar email para admin:', emailError);
                }
            }
            
            // Enviar para vendedor
            if (vendedor.telefone) {
                try {
                    await this.enviarWhatsApp(vendedor.telefone, mensagemWhatsApp);
                } catch (whatsappError) {
                    console.error('❌ Erro ao enviar WhatsApp para vendedor:', whatsappError);
                    console.log(`📱 Mensagem que seria enviada para ${vendedor.telefone}: ${mensagemWhatsApp}`);
                }
            }
            
            if (vendedor.email) {
                try {
                    // Enviar email para vendedor sobre saque
                    await professionalEmailService.enviarEmailVendas(
                        vendedor.email,
                        `💰 Status do Saque - ${tipoNotificacao}`,
                        `Seu saque de ${saque.valor} MZN foi ${tipoNotificacao}`,
                        'saque_vendedor'
                    );
                } catch (emailError) {
                    console.error('❌ Erro ao enviar email para vendedor:', emailError);
                }
            }
            
            console.log('✅ Notificações de saque enviadas com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificações de saque:', error);
            // Não falhar o processo principal por erro de notificação
        }
    }
    
        /**
     * Envia mensagem WhatsApp
     */
    static async enviarWhatsApp(telefone, mensagem) {
        try {
            console.log(`📱 Tentando enviar WhatsApp para ${telefone}...`);
            
            const whatsappManager = require('./whatsappManager');
            await whatsappManager.sendNotificationSafely(telefone, mensagem, null, 'sistema');
            console.log(`✅ WhatsApp enviado com sucesso para ${telefone}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erro ao enviar WhatsApp para ${telefone}:`, error);
            console.log(`📱 Mensagem que seria enviada para ${telefone}:`);
            console.log(mensagem);
            return false;
        }
    }
    
    /**
     * Busca estatísticas administrativas para o painel admin
     */
    static async buscarEstatisticasAdmin() {
        try {
            console.log('🔄 Buscando estatísticas administrativas...');
            
            // Estatísticas gerais do sistema
            const totalVendedores = await Usuario.count({
                where: { role: 'user' }
            });
            
            const totalVendas = await Venda.count({
                where: { status: 'Pago' }
            });
            
            const totalSaques = await Pagamento.count({
                where: { status: 'pendente' }
            });
            
            const totalSaquesAprovados = await Pagamento.count({
                where: { status: 'aprovado' }
            });
            
            // Receita total do sistema
            const vendasAprovadas = await Venda.findAll({
                where: { status: 'Pago' },
                attributes: ['valor']
            });
            
            const receitaTotalSistema = vendasAprovadas.reduce((total, venda) => {
                const valor = parseFloat(venda.valor || 0);
                return total + (isNaN(valor) ? 0 : valor);
            }, 0);
            
            // Valor total de saques pendentes
            const saquesPendentes = await Pagamento.findAll({
                where: { status: 'pendente' },
                attributes: ['valor']
            });
            
            const valorSaquesPendentes = saquesPendentes.reduce((total, saque) => {
                const valor = parseFloat(saque.valor || 0);
                return total + (isNaN(valor) ? 0 : valor);
            }, 0);
            
            // Buscar saldo do administrador
            let saldoAdmin;
            try {
                saldoAdmin = await SaldoAdminService.buscarSaldo();
            } catch (error) {
                console.error('⚠️ Erro ao buscar saldo do admin, usando valores padrão:', error);
                saldoAdmin = {
                    saldo_total: 0,
                    comissao_percentual: 10,
                    total_vendas_aprovadas: 0,
                    valor_total_vendas: 0,
                    total_comissoes: 0,
                    total_saques_pagos: 0
                };
            }
            
            // Estatísticas por vendedor
            const vendedores = await Usuario.findAll({
                where: { role: 'user' },
                attributes: ['id', 'nome_completo', 'email']
            });
            
            const estatisticasVendedores = [];
            
                         for (const vendedor of vendedores) {
                 try {
                     const receita = await this.atualizarReceitaTotal(vendedor.id);
                     estatisticasVendedores.push({
                         vendedorId: vendedor.id,
                         vendedorNome: vendedor.nome_completo,
                         vendedorEmail: vendedor.email,
                         receitaTotal: receita.receitaTotal,
                         receitaDisponivel: receita.receitaDisponivel,
                         totalVendas: receita.totalVendas,
                         valorSaquesProcessados: receita.valorSaquesProcessados,
                         ultimaAtualizacao: receita.ultimaAtualizacao
                     });
                 } catch (error) {
                     console.error(`❌ Erro ao buscar estatísticas do vendedor ${vendedor.id}:`, error);
                     estatisticasVendedores.push({
                         vendedorId: vendedor.id,
                         vendedorNome: vendedor.nome_completo,
                         vendedorEmail: vendedor.email,
                         receitaTotal: 0, // Sempre 0
                         receitaDisponivel: 0, // Sempre 0
                         totalVendas: 0,
                         valorSaquesProcessados: 0,
                         error: error.message
                     });
                 }
             }
            
            const estatisticas = {
                sistema: {
                    totalVendedores,
                    totalVendas,
                    totalSaques,
                    totalSaquesAprovados,
                    receitaTotalSistema: parseFloat(receitaTotalSistema.toFixed(2)),
                    valorSaquesPendentes: parseFloat(valorSaquesPendentes.toFixed(2))
                },
                admin: {
                    saldoTotal: saldoAdmin.saldo_total,
                    comissaoPercentual: saldoAdmin.comissao_percentual,
                    totalVendasProcessadas: saldoAdmin.total_vendas_aprovadas,
                    valorTotalVendas: saldoAdmin.valor_total_vendas,
                    totalComissoes: saldoAdmin.total_comissoes,
                    totalSaquesPagos: saldoAdmin.total_saques_pagos,
                    ultimaAtualizacaoSaldo: saldoAdmin.ultima_atualizacao
                },
                vendedores: estatisticasVendedores,
                ultimaAtualizacao: new Date()
            };
            
            console.log('✅ Estatísticas administrativas calculadas com sucesso');
            console.log(`💰 Saldo do Admin: MZN ${saldoAdmin.saldo_total.toFixed(2)}`);
            return estatisticas;
            
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas administrativas:', error);
            throw error;
        }
    }

    /**
     * Sincroniza receita total em todas as páginas
     * Para garantir consistência de dados
     */
    static async sincronizarReceitaGlobal() {
        try {
            console.log('🔄 Iniciando sincronização global de receita...');
            
            // Buscar todos os vendedores
            const vendedores = await Usuario.findAll({
                where: { role: 'user' },
                attributes: ['id']
            });
            
            const resultados = [];
            
            // Atualizar receita de cada vendedor
            for (const vendedor of vendedores) {
                try {
                    const receita = await this.atualizarReceitaTotal(vendedor.id);
                    resultados.push({
                        vendedorId: vendedor.id,
                        success: true,
                        receita: receita
                    });
                } catch (error) {
                    console.error(`❌ Erro ao sincronizar vendedor ${vendedor.id}:`, error);
                    resultados.push({
                        vendedorId: vendedor.id,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            console.log(`✅ Sincronização global concluída: ${resultados.filter(r => r.success).length}/${resultados.length} vendedores`);
            
            return {
                success: true,
                totalVendedores: vendedores.length,
                sincronizados: resultados.filter(r => r.success).length,
                resultados: resultados
            };
            
        } catch (error) {
            console.error('❌ Erro na sincronização global:', error);
            throw error;
        }
    }
}

module.exports = ReceitaService;
