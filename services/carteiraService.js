/**
 * Serviço para gerenciar carteiras dos vendedores
 * Permite criar, editar e gerenciar carteiras para saques
 */

const { Carteira, CodigoAutenticacao, Usuario, sequelize } = require('../config/database');
const { Op, Transaction } = require('sequelize');
const professionalEmailService = require('./professionalEmailService');

class CarteiraService {
    
    /**
     * Criar nova carteira para um vendedor
     */
    static async criarCarteira(vendedorId, dadosCarteira) {
        // IMPORTANTE: Fazer verificações ANTES de iniciar a transação
        // para evitar problemas com transações pendentes do PostgreSQL
        
        // Função auxiliar para fazer verificações com retry em caso de erro de transação
        const fazerVerificacaoComRetry = async (queryFn, maxRetries = 2) => {
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    // Aguardar um pouco antes de tentar novamente (exceto na primeira tentativa)
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                        console.log(`🔄 Tentativa ${attempt + 1} de verificação após erro de transação...`);
                    }
                    
                    return await queryFn();
                } catch (error) {
                    // Se for erro de transação pendente (25P02), tentar novamente
                    if (error.code === '25P02' || 
                        (error.parent && error.parent.code === '25P02') ||
                        (error.message && error.message.includes('transação atual foi interrompida'))) {
                        
                        if (attempt < maxRetries) {
                            console.log(`⚠️ Erro de transação pendente detectado, tentando novamente...`);
                            continue;
                        }
                    }
                    throw error;
                }
            }
        };
        
        try {
            // Verificar conexão
            await sequelize.authenticate();
            
            // IMPORTANTE: Fazer verificações SEM transação para evitar problemas
            // com transações pendentes do PostgreSQL (erro 25P02)
            // As verificações são rápidas e não precisam de transação
            
            // Verificar se o vendedor já tem 2 carteiras (SEM transação) com retry
            const carteirasExistentes = await fazerVerificacaoComRetry(async () => {
                return await Carteira.count({
                    where: { 
                        vendedorId: vendedorId,
                        ativa: true
                    }
                });
            });
            
            if (carteirasExistentes >= 2) {
                throw new Error('Limite máximo de 2 carteiras atingido');
            }
            
            // Verificar se o nome da carteira já existe para este vendedor (SEM transação) com retry
            const carteiraExistente = await fazerVerificacaoComRetry(async () => {
                return await Carteira.findOne({
                    where: {
                        vendedorId: vendedorId,
                        nome: dadosCarteira.nome
                    }
                });
            });
            
            if (carteiraExistente) {
                throw new Error('Já existe uma carteira com este nome');
            }
            
            // Agora sim, criar transação APENAS para a criação da carteira
            // Com retry para garantir que não haja transação pendente
            let transaction = null;
            let carteira = null;
            
            for (let attempt = 0; attempt <= 2; attempt++) {
                try {
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
                        console.log(`🔄 Tentativa ${attempt + 1} de criar transação...`);
                    }
                    
                    // Criar transação simples sem especificar nível de isolamento
                    // (o Sequelize usa READ COMMITTED por padrão no PostgreSQL)
                    transaction = await sequelize.transaction();
                    
                    // Criar carteira dentro da transação
                    // Usar camelCase conforme definição do modelo (Sequelize converterá para snake_case)
                    carteira = await Carteira.create({
                        vendedorId: vendedorId,
                        nome: dadosCarteira.nome,
                        metodoSaque: dadosCarteira.metodoSaque,
                        contacto: dadosCarteira.contacto,
                        nomeTitular: dadosCarteira.nomeTitular,
                        emailTitular: dadosCarteira.emailTitular,
                        ativa: true
                    }, { transaction });
            
                    await transaction.commit();
                    
                    // Recarregar carteira para garantir que todos os campos estão disponíveis
                    await carteira.reload();
                    
                    console.log(`✅ Carteira criada com sucesso: ${carteira.nome}`);
                    console.log(`📋 Dados da carteira criada:`, {
                        nome: carteira.nome,
                        metodoSaque: carteira.metodoSaque,
                        contacto: carteira.contacto,
                        nomeTitular: carteira.nomeTitular,
                        emailTitular: carteira.emailTitular
                    });
                    return carteira;
                    
                } catch (createError) {
                    // Se for erro de transação pendente, tentar novamente
                    if ((createError.code === '25P02' || 
                         (createError.parent && createError.parent.code === '25P02') ||
                         (createError.message && createError.message.includes('transação atual foi interrompida'))) &&
                        attempt < 2) {
                        
                        if (transaction && !transaction.finished) {
                            try {
                                await transaction.rollback();
                            } catch (rollbackErr) {
                                // Ignorar erro de rollback
                            }
                        }
                        transaction = null;
                        continue; // Tentar novamente
                    }
                    
                    // Rollback apenas se a criação falhar e não for erro de transação pendente
                    if (transaction && !transaction.finished) {
                        await transaction.rollback();
                    }
                    throw createError;
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao criar carteira:', error);
            console.error('❌ Stack trace:', error.stack);
            
            // Limpar mensagem de erro se for relacionada a transação
            let errorMessage = error.message || 'Erro ao criar carteira';
            if (errorMessage.includes('transação') || errorMessage.includes('transaction') || 
                errorMessage.includes('interrompida') || errorMessage.includes('interrupted') ||
                error.code === '25P02' || (error.parent && error.parent.code === '25P02')) {
                errorMessage = 'Erro ao processar solicitação. Por favor, aguarde alguns instantes e tente novamente.';
            }
            
            // Criar novo erro com mensagem limpa
            const cleanError = new Error(errorMessage);
            cleanError.originalError = error;
            throw cleanError;
        }
    }
    
    /**
     * Editar carteira existente
     */
    static async editarCarteira(carteiraId, vendedorId, dadosCarteira) {
        const transaction = await sequelize.transaction();
        
        try {
            // Buscar carteira
            const carteira = await Carteira.findOne({
                where: {
                    id: carteiraId,
                    vendedorId: vendedorId
                },
                transaction
            });
            
            if (!carteira) {
                throw new Error('Carteira não encontrada');
            }
            
            // Verificar se o nome já existe em outra carteira
            if (dadosCarteira.nome && dadosCarteira.nome !== carteira.nome) {
                const nomeExistente = await Carteira.findOne({
                    where: {
                        vendedorId: vendedorId,
                        nome: dadosCarteira.nome,
                        id: { [Op.ne]: carteiraId }
                    },
                    transaction
                });
                
                if (nomeExistente) {
                    throw new Error('Já existe uma carteira com este nome');
                }
            }
            
            // Atualizar carteira (usar camelCase conforme modelo)
            await carteira.update({
                nome: dadosCarteira.nome || carteira.nome,
                metodoSaque: dadosCarteira.metodoSaque || carteira.metodoSaque,
                contacto: dadosCarteira.contacto || carteira.contacto,
                nomeTitular: dadosCarteira.nomeTitular || carteira.nomeTitular,
                emailTitular: dadosCarteira.emailTitular || carteira.emailTitular
            }, { transaction });
            
            await transaction.commit();
            
            console.log(`✅ Carteira atualizada: ${carteira.nome}`);
            return carteira;
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao editar carteira:', error);
            throw error;
        }
    }
    
    /**
     * Desativar carteira
     */
    static async desativarCarteira(carteiraId, vendedorId) {
        try {
            const carteira = await Carteira.findOne({
                where: {
                    id: carteiraId,
                    vendedorId: vendedorId
                }
            });
            
            if (!carteira) {
                throw new Error('Carteira não encontrada');
            }
            
            await carteira.update({ ativa: false });
            
            console.log(`✅ Carteira desativada: ${carteira.nome}`);
            return carteira;
            
        } catch (error) {
            console.error('❌ Erro ao desativar carteira:', error);
            throw error;
        }
    }
    
    /**
     * Listar carteiras de um vendedor
     */
    static async listarCarteiras(vendedorId) {
        try {
            const carteiras = await Carteira.findAll({
                where: {
                    vendedorId: vendedorId,
                    ativa: true
                },
                order: [['dataCriacao', 'ASC']]
            });
            
            return carteiras;
            
        } catch (error) {
            console.error('❌ Erro ao listar carteiras:', error);
            throw error;
        }
    }
    
    /**
     * Gerar código de autenticação para carteira
     */
    static async gerarCodigoCarteira(vendedorId, emailTitular) {
        const transaction = await sequelize.transaction();
        
        try {
            // Gerar código de 6 dígitos
            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Definir expiração (10 minutos)
            const expiraEm = new Date(Date.now() + 10 * 60 * 1000);
            
            // Criar código de autenticação
            const codigoAuth = await CodigoAutenticacao.create({
                vendedor_id: vendedorId,
                tipo: 'carteira',
                codigo: codigo,
                destinatario: emailTitular,
                metodo_envio: 'email',
                expira_em: expiraEm
            }, { transaction });
            
            // Enviar código por email e WhatsApp
            try {
                // Buscar dados do vendedor para WhatsApp
                const vendedor = await Usuario.findByPk(vendedorId);
                
                await professionalEmailService.enviarEmailSistema(
                    emailTitular,
                    '🔐 Código de Autenticação - Carteira',
                    `Seu código de autenticação é: ${codigo}`,
                    'autenticacao'
                );
                console.log(`✅ Código enviado para: ${emailTitular}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar email:', emailError);
                // Não falhar o processo por erro de email
            }
            
            await transaction.commit();
            
            return {
                codigoId: codigoAuth.id,
                expiraEm: expiraEm,
                mensagem: 'Código de autenticação enviado para seu email'
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao gerar código de carteira:', error);
            throw error;
        }
    }
    
    /**
     * Verificar código de autenticação para carteira
     */
    static async verificarCodigoCarteira(vendedorId, codigo) {
        try {
            const codigoAuth = await CodigoAutenticacao.findOne({
                where: {
                    vendedor_id: vendedorId,
                    tipo: 'carteira',
                    codigo: codigo,
                    usado: false,
                    expira_em: { [Op.gt]: new Date() }
                }
            });
            
            if (!codigoAuth) {
                throw new Error('Código inválido, expirado ou já utilizado');
            }
            
            // Marcar como usado
            await codigoAuth.update({ usado: true });
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao verificar código de carteira:', error);
            throw error;
        }
    }
    
    /**
     * Gerar código de autenticação para saque
     */
    static async gerarCodigoSaque(vendedorId, emailTitular) {
        console.log(`🔄 CarteiraService.gerarCodigoSaque chamado com:`, { vendedorId, emailTitular });
        
        const transaction = await sequelize.transaction();
        
        try {
            // Gerar código de 6 dígitos
            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            console.log('🔐 Código gerado:', codigo);
            
            // Definir expiração (10 minutos)
            const expiraEn = new Date(Date.now() + 10 * 60 * 1000);
            console.log('⏰ Expira em:', expiraEn);
            
            // Criar código de autenticação
            console.log('💾 Criando código de autenticação no banco...');
            const codigoAuth = await CodigoAutenticacao.create({
                vendedor_id: vendedorId,
                tipo: 'saque',
                codigo: codigo,
                destinatario: emailTitular,
                metodo_envio: 'email',
                expira_em: expiraEn
            }, { transaction });
            
            console.log('✅ Código de autenticação criado no banco:', codigoAuth.id);
            
            // Enviar código por email e WhatsApp
            console.log('📧 Tentando enviar código por email...');
            try {
                // Buscar dados do vendedor para WhatsApp
                const vendedor = await Usuario.findByPk(vendedorId);
                
                const emailResult = await professionalEmailService.enviarEmailSistema(
                    emailTitular,
                    '🔐 Código de Autenticação - Saque',
                    `Seu código de autenticação é: ${codigo}`,
                    'autenticacao'
                );
                console.log(`✅ Código de saque enviado para: ${emailTitular}`, emailResult);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar email de saque:', emailError);
                console.error('⚠️ Stack trace do email:', emailError.stack);
                // Não vamos falhar a operação por causa do email
            }
            
            console.log('💾 Commitando transação...');
            await transaction.commit();
            console.log('✅ Transação commitada com sucesso');
            
            const resultado = {
                codigoId: codigoAuth.id,
                codigo: codigo,
                expiraEm: expiraEn,
                mensagem: 'Código de autenticação para saque enviado para seu email'
            };
            
            console.log('🎯 Resultado final:', resultado);
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro ao gerar código de saque:', error);
            console.error('❌ Stack trace completo:', error.stack);
            console.log('🔄 Fazendo rollback da transação...');
            await transaction.rollback();
            console.log('✅ Rollback concluído');
            throw error;
        }
    }
    
    /**
     * Verificar código de autenticação para saque
     */
    static async verificarCodigoSaque(vendedorId, codigo) {
        try {
            const codigoAuth = await CodigoAutenticacao.findOne({
                where: {
                    vendedor_id: vendedorId,
                    tipo: 'saque',
                    codigo: codigo,
                    usado: false,
                    expira_em: { [Op.gt]: new Date() }
                }
            });
            
            if (!codigoAuth) {
                throw new Error('Código inválido, expirado ou já utilizado');
            }
            
            // Marcar como usado
            await codigoAuth.update({ usado: true });
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao verificar código de saque:', error);
            throw error;
        }
    }
}

module.exports = CarteiraService;
