/**
 * Serviço para saques diretos sem pendências
 * Sistema direto: escolher carteira, inserir valor, confirmar com código
 * O saque é processado imediatamente e vai direto para o saldo do administrador
 */

const { Carteira, Pagamento, Usuario, SaldoAdmin, sequelize } = require('../config/database');
const CarteiraService = require('./carteiraService');
const SaldoAdminService = require('./saldoAdminService');
const ReceitaService = require('./receitaService');
const { Op } = require('sequelize');

class SaqueSimplificadoService {

    /**
     * Processar saque direto (sem pendência)
     * 1. Escolher carteira
     * 2. Inserir valor
     * 3. Confirmar com código
     * 4. Processar imediatamente
     * 5. Subtrair da receita do vendedor
     * 6. Transferir para saldo do admin
     */
    static async processarSaqueDirecto(vendedorId, carteiraId, valor, codigoAutenticacao) {
        let transaction = null; // Declarar no escopo do método
        try {
            console.log(`🔄 Processando saque direto para vendedor ${vendedorId}...`);

            // ========== VERIFICAÇÕES PRÉ-TRANSACAÇÃO ==========
            // Fazer todas as verificações ANTES de iniciar a transação para evitar conflitos

            // 1. Verificar carteira (SEM transação)
            // IMPORTANTE: Buscar todos os campos para garantir acesso aos dados novos
            const carteira = await Carteira.findOne({
                where: {
                    id: carteiraId,
                    vendedorId: vendedorId,
                    ativa: true
                }
            });

            if (!carteira) {
                throw new Error('Carteira não encontrada ou inativa');
            }

            // Garantir que os campos estejam disponíveis (reload se necessário)
            // await carteira.reload();

            // Determinar campos baseados no método de saque (ou padrão Mpesa)
            const metodo = carteira.metodoSaque || carteira.metodo_saque || 'Mpesa';
            let nomeTitular = null;
            let contacto = null;

            // Tentar obter dados dos novos campos (snake_case ou camelCase)
            if (metodo.toLowerCase().includes('emola')) {
                nomeTitular = carteira.nome_titular_emola || carteira.nomeTitularEmola || carteira.get?.('nome_titular_emola');
                contacto = carteira.contacto_emola || carteira.contactoEmola || carteira.get?.('contacto_emola');
            } else {
                // Padrão Mpesa
                nomeTitular = carteira.nome_titular_mpesa || carteira.nomeTitularMpesa || carteira.get?.('nome_titular_mpesa');
                contacto = carteira.contacto_mpesa || carteira.contactoMpesa || carteira.get?.('contacto_mpesa');
            }

            // Fallback para campos legados se os novos estiverem vazios
            if (!nomeTitular || nomeTitular.trim() === '') {
                nomeTitular = carteira.nomeTitular || carteira.nome_titular || carteira.get?.('nome_titular');
            }

            if (!contacto || contacto.trim() === '') {
                contacto = carteira.contacto || carteira.get?.('contacto');
            }

            // Último fallback: buscar nome do usuário se ainda não tiver nome do titular
            if (!nomeTitular || nomeTitular.trim() === '' || nomeTitular === 'N/A') {
                try {
                    const usuario = await Usuario.findByPk(vendedorId, {
                        attributes: ['nome_completo', 'nomeCompleto']
                    });
                    if (usuario) {
                        nomeTitular = usuario.nome_completo || usuario.nomeCompleto || usuario.get?.('nome_completo');
                    }
                } catch (usuarioError) {
                    console.warn('⚠️ Erro ao buscar nome do usuário:', usuarioError.message);
                }
            }

            // Normalizar valores vazios
            if (!nomeTitular || nomeTitular.trim() === '') {
                nomeTitular = null;
            }
            if (!contacto || contacto.trim() === '') {
                contacto = null;
            }

            console.log('📋 Carteira carregada:', {
                id: carteira.id,
                nome: carteira.nome,
                nomeTitular: nomeTitular,
                contacto: contacto,
                metodoSaque: metodo,
                rawData: {
                    nome_titular_mpesa: carteira.get?.('nome_titular_mpesa'),
                    nome_titular_emola: carteira.get?.('nome_titular_emola'),
                    nome_titular: carteira.get?.('nome_titular')
                }
            });

            // 2. Verificar código de autenticação (SEM transação)
            const codigoValido = await CarteiraService.verificarCodigoSaque(
                vendedorId,
                codigoAutenticacao
            );

            if (!codigoValido) {
                throw new Error('Código de autenticação inválido');
            }

            // 3. Verificar se já existe um saque pendente (SEM transação)
            const saquePendente = await Pagamento.findOne({
                where: {
                    vendedor_id: vendedorId,
                    status: 'pendente'
                }
            });

            if (saquePendente) {
                throw new Error('Você já possui um saque pendente. Aguarde a confirmação do administrador antes de solicitar outro saque.');
            }

            // 4. Verificar se vendedor tem receita suficiente (SEM transação)
            const receitaAtual = await ReceitaService.buscarReceitaTotal(vendedorId);

            if (receitaAtual.receitaDisponivel < valor) {
                throw new Error(`Receita insuficiente. Disponível: MZN ${receitaAtual.receitaDisponivel.toFixed(2)}, Solicitado: MZN ${valor.toFixed(2)}`);
            }

            // ========== INICIAR TRANSAÇÃO APENAS PARA OPERAÇÕES CRÍTICAS ==========
            // Usar retry para criar transação em caso de erro 25P02
            for (let attempt = 0; attempt <= 2; attempt++) {
                try {
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                        console.log(`🔄 Tentativa ${attempt + 1} de criar transação...`);
                    }
                    transaction = await sequelize.transaction();
                    break; // Sucesso, sair do loop
                } catch (error) {
                    if ((error.code === '25P02' ||
                        (error.parent && error.parent.code === '25P02') ||
                        (error.message && error.message.includes('transação atual foi interrompida'))) &&
                        attempt < 2) {
                        console.log(`⚠️ Erro de transação pendente ao criar transação, tentando novamente...`);
                        continue;
                    }
                    throw error;
                }
            }

            // 5. Calcular taxas (5% para admin, 95% para vendedor)
            // IMPORTANTE: Apenas calcular, não processar ainda - será processado quando admin aprovar
            const taxaAdmin = valor * 0.05; // 5% para admin
            const valorLiquidoVendedor = valor * 0.95; // 95% para vendedor

            console.log(`💰 Cálculo de taxas do saque:`);
            console.log(`   💼 Taxa do administrador (5%): MZN ${taxaAdmin.toFixed(2)}`);
            console.log(`   👤 Valor líquido do vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`);
            console.log(`   📝 Total solicitado: MZN ${valor.toFixed(2)}`);

            const idSaque = Math.floor(100000 + Math.random() * 900000).toString();

            // Criar registro de saque com status 'pendente' e informações de taxas calculadas
            // IMPORTANTE: conta_destino deve conter o nome do titular, não o contacto
            // Variáveis nomeTitular e contacto já foram definidas no início da função

            console.log('📝 Dados do saque a serem salvos:', {
                nomeTitular: nomeTitular,
                contacto: contacto,
                metodo: carteira.metodoSaque || carteira.metodo_saque
            });

            // Validação: garantir que temos o nome do titular
            if (!nomeTitular || nomeTitular.trim() === '' || nomeTitular === 'N/A') {
                const metodoDisplay = metodo || 'Mpesa';
                const campoEsperado = metodoDisplay.toLowerCase().includes('emola') ? 'nome_titular_emola' : 'nome_titular_mpesa';
                throw new Error(
                    `Nome do titular da carteira não encontrado. ` +
                    `Verifique a configuração da carteira. ` +
                    `Campo esperado: ${campoEsperado} (método: ${metodoDisplay}). ` +
                    `Por favor, atualize os dados da carteira antes de solicitar o saque.`
                );
            }

            // Validação: garantir que temos o contacto
            if (!contacto || contacto.trim() === '' || contacto === 'N/A') {
                const metodoDisplay = metodo || 'Mpesa';
                const campoEsperado = metodoDisplay.toLowerCase().includes('emola') ? 'contacto_emola' : 'contacto_mpesa';
                throw new Error(
                    `Contacto da carteira não encontrado. ` +
                    `Verifique a configuração da carteira. ` +
                    `Campo esperado: ${campoEsperado} (método: ${metodoDisplay}). ` +
                    `Por favor, atualize os dados da carteira antes de solicitar o saque.`
                );
            }

            const saque = await Pagamento.create({
                vendedor_id: vendedorId,
                valor: valor, // Valor total solicitado
                metodo: carteira.metodoSaque || carteira.metodo_saque || 'Mpesa',
                conta_destino: nomeTitular, // Nome do titular (não o contacto!)
                telefone_titular: contacto, // Contacto/telefone do titular
                status: 'pendente', // IMPORTANTE: Status pendente - aguardando aprovação do admin
                data_solicitacao: new Date(),
                observacoes: `Saque via carteira: ${carteira.nome} - ID: ${idSaque}\n` +
                    `Nome do Titular: ${nomeTitular}\n` +
                    `Contacto: ${contacto}\n` +
                    `Taxa admin (5%): MZN ${taxaAdmin.toFixed(2)}\n` +
                    `Valor líquido vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`
            }, { transaction });

            // Garantir que o status seja 'pendente' após criação (proteção adicional)
            if (saque.status !== 'pendente') {
                await saque.update({ status: 'pendente' }, { transaction });
                console.log('⚠️ Status do saque foi corrigido para "pendente"');
            }

            // 6. Atualizar última utilização da carteira
            await carteira.update({
                ultima_utilizacao: new Date()
            }, { transaction });

            // Commit da transação
            await transaction.commit();

            console.log(`✅ Saque criado com sucesso: ID ${saque.id}, Status: ${saque.status}, Valor: MZN ${valor.toFixed(2)}`);

            // 7. Atualizar receita do vendedor (depois do commit, sem transação)
            try {
                await ReceitaService.atualizarReceitaTotal(vendedorId);
            } catch (receitaError) {
                console.error('⚠️ Erro ao atualizar receita total (não crítico):', receitaError.message);
            }

            // 8. Enviar notificação para o admin sobre o saque pendente (sem transação)
            try {
                const SaqueNotificationService = require('./saqueNotificationService');
                await SaqueNotificationService.notificarAdminSaquePendente(saque);
                console.log(`✅ Notificação de saque pendente enviada para admin`);
            } catch (notificationError) {
                console.error('⚠️ Erro ao enviar notificação de saque (não crítico):', notificationError.message);
            }

            console.log(`⏳ Status: PENDENTE - aguardando aprovação do admin`);
            console.log(`📱 As taxas serão processadas quando o admin aprovar o saque`);

            // Buscar receita atualizada após criar o saque
            const receitaAtualizada = await ReceitaService.buscarReceitaTotal(vendedorId);

            return {
                success: true,
                message: 'Saque solicitado com sucesso. Aguardando aprovação do administrador.',
                saque: {
                    id: saque.id,
                    valor: valor, // Valor total solicitado
                    valorLiquido: valorLiquidoVendedor, // 95% que o vendedor receberá após aprovação
                    taxaAdmin: taxaAdmin, // 5% que vai para o admin (calculado mas não processado ainda)
                    status: 'pendente',
                    dataSolicitacao: saque.data_solicitacao || new Date(),
                    carteira: carteira.nome,
                    metodoPagamento: carteira.metodoSaque || carteira.metodo_saque
                },
                calculoTaxas: {
                    valorTotal: valor,
                    taxaAdmin: taxaAdmin,
                    percentualTaxa: 5,
                    valorLiquidoVendedor: valorLiquidoVendedor,
                    percentualVendedor: 95
                },
                receitaAtual: {
                    receitaTotal: receitaAtualizada.receitaTotal,
                    receitaDisponivel: receitaAtualizada.receitaDisponivel,
                    valorSolicitado: valor
                }
            };

        } catch (error) {
            // Fazer rollback apenas se a transação foi criada
            if (transaction && !transaction.finished) {
                try {
                    await transaction.rollback();
                } catch (rollbackError) {
                    console.error('⚠️ Erro ao fazer rollback (não crítico):', rollbackError.message);
                }
            }
            console.error('❌ Erro ao processar saque direto:', error);
            throw error;
        }
    }

    /**
     * Gerar código de autenticação para saque
     */
    static async gerarCodigoSaque(vendedorId, carteiraId, emailCarteira) {
        try {
            console.log(`🔄 Gerando código de saque para vendedor ${vendedorId}, carteira ${carteiraId}`);

            // Verificar carteira (usar vendedorId em camelCase)
            // IMPORTANTE: Buscar todos os campos necessários, incluindo nomeTitular e email
            const carteira = await Carteira.findOne({
                where: {
                    id: carteiraId,
                    vendedorId: vendedorId,
                    ativa: true
                },
                attributes: [
                    'id', 'nome', 'metodoSaque', 'contacto',
                    'nomeTitular', 'email', 'ativa',
                    'contactoMpesa', 'nomeTitularMpesa',
                    'contactoEmola', 'nomeTitularEmola'
                ]
            });

            console.log('🔍 Carteira encontrada:', carteira ? 'Sim' : 'Não');

            if (!carteira) {
                throw new Error('Carteira não encontrada ou inativa');
            }

            // Garantir que os campos estejam disponíveis (reload se necessário)
            await carteira.reload();

            // Usar email passado como parâmetro ou buscar da carteira
            const emailTitular = emailCarteira || carteira.email || carteira.get('email') || carteira.emailTitular || carteira.get('email_titular');
            const nomeTitular = carteira.nomeTitular || carteira.get('nome_titular') || carteira.nomeTitularMpesa || carteira.get('nome_titular_mpesa');
            const metodoSaque = carteira.metodoSaque || carteira.metodo_saque;
            const contacto = carteira.contactoMpesa || carteira.contactoEmola || carteira.contacto || carteira.get('contacto');

            console.log('📧 Email do titular:', emailTitular);
            console.log('📧 Email válido:', emailTitular && emailTitular.includes('@'));

            // Verificar se o email é válido
            if (!emailTitular || !emailTitular.includes('@')) {
                throw new Error('Email da carteira inválido ou não configurado');
            }

            // Gerar código
            console.log('🔄 Chamando CarteiraService.gerarCodigoSaque...');
            const resultado = await CarteiraService.gerarCodigoSaque(
                vendedorId,
                emailTitular
            );

            console.log('✅ Código gerado com sucesso:', resultado);

            // Enviar código via WhatsApp também
            try {
                const whatsappManager = require('./whatsappManager');

                const mensagemWhatsApp = `🔐 *Código de Autenticação*

*${resultado.codigo}*

⏰ Válido por 10 minutos

RatixPay`;

                const telefone = carteira.contacto || carteira.telefoneTitular || carteira.telefone_titular;
                if (telefone) {
                    await whatsappManager.sendNotificationSafely(telefone, mensagemWhatsApp, null, 'sistema');
                    console.log('✅ Código enviado via WhatsApp com sucesso');
                } else {
                    console.log('⚠️ Telefone não encontrado para envio via WhatsApp');
                }
            } catch (whatsappError) {
                console.error('❌ Erro ao enviar código via WhatsApp:', whatsappError);
                // Não falhar o processo por erro no WhatsApp
            }

            return resultado;

        } catch (error) {
            console.error('❌ Erro ao gerar código de saque:', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Verificar se vendedor pode fazer saque
     */
    static async verificarDisponibilidadeSaque(vendedorId) {
        try {
            // Verificar se tem carteiras ativas
            const carteiras = await Carteira.findAll({
                where: {
                    vendedor_id: vendedorId,
                    ativa: true
                }
            });

            if (carteiras.length === 0) {
                return {
                    podeSacar: false,
                    motivo: 'Nenhuma carteira configurada. Configure uma carteira primeiro.'
                };
            }

            // Verificar receita disponível
            const receita = await ReceitaService.buscarReceitaTotal(vendedorId);

            if (receita.receitaDisponivel <= 0) {
                return {
                    podeSacar: false,
                    motivo: 'Receita insuficiente para saque.'
                };
            }

            return {
                podeSacar: true,
                carteiras: carteiras,
                receitaDisponivel: receita.receitaDisponivel,
                mensagem: 'Vendedor pode realizar saques'
            };

        } catch (error) {
            console.error('❌ Erro ao verificar disponibilidade de saque:', error);
            throw error;
        }
    }

    /**
     * Listar histórico de saques (apenas processados/pagos)
     */
    static async listarHistoricoSaques(vendedorId) {
        try {
            console.log(`🔄 Listando histórico de saques do vendedor ${vendedorId}...`);

            const saques = await Pagamento.findAll({
                where: {
                    vendedor_id: vendedorId,
                    status: {
                        [Op.in]: ['aprovado', 'pago']
                    }
                },
                order: [['data_solicitacao', 'DESC']],
                attributes: [
                    'id', 'valor_solicitado', 'valor_liquido', 'status',
                    'data_solicitacao', 'data_processamento', 'metodo_pagamento',
                    'nome_titular', 'telefone_titular', 'observacoes'
                ]
            });

            console.log(`✅ ${saques.length} saques encontrados no histórico`);

            return saques.map(saque => ({
                id: saque.id,
                valor: parseFloat(saque.valor_solicitado),
                valorLiquido: parseFloat(saque.valor_liquido),
                status: saque.status,
                dataSolicitacao: saque.data_solicitacao,
                dataProcessamento: saque.data_processamento,
                metodoPagamento: saque.metodo_pagamento,
                nomeTitular: saque.nome_titular,
                telefoneTitular: saque.telefone_titular,
                observacoes: saque.observacoes
            }));

        } catch (error) {
            console.error('❌ Erro ao listar histórico de saques:', error);
            throw error;
        }
    }
}

module.exports = SaqueSimplificadoService;
