/**
 * Serviço para gerenciar carteiras dos vendedores
 * Permite criar, editar e gerenciar carteiras para saques
 */

const { Carteira, CodigoAutenticacao, Usuario, sequelize } = require('../config/database');
const { Op, Transaction } = require('sequelize');
const professionalEmailService = require('./professionalEmailService');

class CarteiraService {
    
    /**
     * Criar ou atualizar carteira única para um vendedor
     * Garante apenas uma carteira por usuário
     */
    static async criarOuAtualizarCarteira(vendedorId, dadosCarteira) {
        try {
            // Verificar conexão
            await sequelize.authenticate();
            
            // Validar campos obrigatórios (email não é mais obrigatório, será obtido do usuário)
            const camposObrigatorios = [
                'contactoMpesa', 'nomeTitularMpesa',
                'contactoEmola', 'nomeTitularEmola'
            ];
            
            for (const campo of camposObrigatorios) {
                if (!dadosCarteira[campo] || typeof dadosCarteira[campo] !== 'string' || dadosCarteira[campo].trim() === '') {
                    throw new Error(`Campo obrigatório ausente ou inválido: ${campo}`);
                }
            }
            
            // Obter email do usuário se não foi fornecido nos dados
            let emailParaSalvar = dadosCarteira.email ? dadosCarteira.email.trim().toLowerCase() : null;
            
            // Se não tem email nos dados, buscar do usuário
            if (!emailParaSalvar) {
                const usuario = await Usuario.findByPk(vendedorId, {
                    attributes: ['id', 'email', 'email_usuario']
                });
                
                if (usuario) {
                    emailParaSalvar = (usuario.email || usuario.email_usuario || '').trim().toLowerCase();
                }
            }
            
            // Validar email se foi encontrado
            if (emailParaSalvar) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailParaSalvar)) {
                    throw new Error('Email inválido');
                }
            }
            
            // Validar contactos (formato moçambicano: 8[4-7] seguido de 7 dígitos)
            const contactoRegex = /^8[4-7]\d{7}$/;
            if (!contactoRegex.test(dadosCarteira.contactoMpesa.replace(/\s+/g, ''))) {
                throw new Error('Contacto Mpesa inválido. Deve ser um número moçambicano válido (84, 85, 86 ou 87 seguido de 7 dígitos)');
            }
            if (!contactoRegex.test(dadosCarteira.contactoEmola.replace(/\s+/g, ''))) {
                throw new Error('Contacto Emola inválido. Deve ser um número moçambicano válido (84, 85, 86 ou 87 seguido de 7 dígitos)');
            }
            
            // Buscar carteira existente primeiro (abordagem mais robusta que findOrCreate)
            let carteira = await Carteira.findOne({
                where: { vendedorId: vendedorId }
            });
            
            const dadosAtualizados = {
                contactoMpesa: dadosCarteira.contactoMpesa.trim().replace(/\s+/g, ''),
                nomeTitularMpesa: dadosCarteira.nomeTitularMpesa.trim(),
                contactoEmola: dadosCarteira.contactoEmola.trim().replace(/\s+/g, ''),
                nomeTitularEmola: dadosCarteira.nomeTitularEmola.trim(),
                ultimaAtualizacao: new Date()
            };
            
            // Email e email_titular sempre vêm do usuário autenticado
            if (emailParaSalvar) {
                dadosAtualizados.email = emailParaSalvar;
                dadosAtualizados.emailTitular = emailParaSalvar; // Email do usuário usado como email_titular
            }
            
            // Atualizar metodo_saque apenas se fornecido explicitamente
            if (dadosCarteira.metodoSaque) {
                dadosAtualizados.metodoSaque = dadosCarteira.metodoSaque.trim();
            }
            
            // Preencher campo 'contacto' (legado) com contacto Mpesa ao atualizar
            dadosAtualizados.contacto = dadosAtualizados.contactoMpesa || '';
            
            // Preencher campo 'nome_titular' (legado) com nome titular Mpesa ao atualizar
            dadosAtualizados.nomeTitular = dadosAtualizados.nomeTitularMpesa || '';
            
            if (carteira) {
                // Atualizar carteira existente
                // Preservar metodo_saque se não foi fornecido na atualização
                if (!dadosAtualizados.metodoSaque) {
                    dadosAtualizados.metodoSaque = carteira.metodoSaque || carteira.metodo_saque || 'Mpesa';
                }
                // Garantir que contacto seja preenchido na atualização também
                if (!dadosAtualizados.contacto || dadosAtualizados.contacto === '') {
                    dadosAtualizados.contacto = dadosAtualizados.contactoMpesa || carteira.contacto || '';
                }
                // Garantir que nome_titular seja preenchido na atualização também
                if (!dadosAtualizados.nomeTitular || dadosAtualizados.nomeTitular === '') {
                    dadosAtualizados.nomeTitular = dadosAtualizados.nomeTitularMpesa || carteira.nomeTitular || carteira.nome_titular || '';
                }
                // Garantir que email_titular seja preenchido na atualização também
                if (!dadosAtualizados.emailTitular || dadosAtualizados.emailTitular === '') {
                    dadosAtualizados.emailTitular = emailParaSalvar || dadosAtualizados.email || carteira.emailTitular || carteira.email_titular || carteira.email || '';
                }
                await carteira.update(dadosAtualizados);
                console.log(`✅ Carteira atualizada com sucesso para vendedor ${vendedorId}`);
            } else {
                // Criar nova carteira
                dadosAtualizados.vendedorId = vendedorId;
                dadosAtualizados.ativa = true;
                dadosAtualizados.nome = 'Carteira Principal'; // Nome padrão para a carteira única
                
                // Definir metodo_saque padrão como 'Mpesa' (campo obrigatório no BD)
                // Como a carteira tem ambos Mpesa e Emola, usamos 'Mpesa' como padrão
                // IMPORTANTE: Sempre definir explicitamente para evitar erro NOT NULL
                dadosAtualizados.metodoSaque = (dadosCarteira.metodoSaque || 'Mpesa').trim();
                
                // Preencher campo 'contacto' (legado) com o contacto Mpesa
                // Este campo é obrigatório no banco, usar contacto Mpesa como padrão
                dadosAtualizados.contacto = dadosAtualizados.contactoMpesa || '';
                
                // Preencher campo 'nome_titular' (legado) com o nome titular Mpesa
                // Este campo é obrigatório no banco, usar nome_titular_mpesa como padrão
                dadosAtualizados.nomeTitular = dadosAtualizados.nomeTitularMpesa || '';
                
                // Garantir que email seja sempre preenchido (obrigatório)
                // O email vem do usuário autenticado (routes/carteiras.js)
                if (!emailParaSalvar) {
                    throw new Error('Email do usuário é obrigatório para criar carteira. Faça login novamente.');
                }
                
                    dadosAtualizados.email = emailParaSalvar;
                
                // Preencher campo 'email_titular' (legado) com o email do usuário autenticado
                // Este campo é obrigatório no banco, usar email do usuário como padrão
                dadosAtualizados.emailTitular = emailParaSalvar;
                
                // Garantir que contacto seja sempre preenchido (obrigatório no BD)
                if (!dadosAtualizados.contacto || dadosAtualizados.contacto === '') {
                    throw new Error('Contacto Mpesa é obrigatório para criar carteira');
                }
                
                // Garantir que nome_titular seja sempre preenchido (obrigatório no BD)
                if (!dadosAtualizados.nomeTitular || dadosAtualizados.nomeTitular === '') {
                    throw new Error('Nome titular Mpesa é obrigatório para criar carteira');
                }
                
                console.log(`🔍 Dados para criar carteira:`, JSON.stringify({
                    ...dadosAtualizados,
                    metodoSaque: dadosAtualizados.metodoSaque // Garantir que aparece no log
                }, null, 2));
                
                carteira = await Carteira.create(dadosAtualizados, {
                    // Garantir que todos os campos obrigatórios sejam validados
                    validate: true
                });
                console.log(`✅ Carteira criada com sucesso para vendedor ${vendedorId}`);
            }
            
            // Recarregar carteira para garantir que todos os campos estão disponíveis
            await carteira.reload();
            
            return carteira;
            
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
            // Retornar apenas uma carteira (a única do usuário)
            const carteira = await Carteira.findOne({
                where: {
                    vendedorId: vendedorId,
                    ativa: true
                },
                order: [['dataCriacao', 'ASC']]
            });
            
            // Retornar array com a carteira ou array vazio
            return carteira ? [carteira] : [];
            
        } catch (error) {
            console.error('❌ Erro ao listar carteiras:', error);
            throw error;
        }
    }
    
    /**
     * Buscar carteira única de um vendedor
     */
    static async buscarCarteiraUnica(vendedorId) {
        try {
            const carteira = await Carteira.findOne({
                where: {
                    vendedorId: vendedorId,
                    ativa: true
                },
                order: [['dataCriacao', 'ASC']]
            });
            
            return carteira;
            
        } catch (error) {
            console.error('❌ Erro ao buscar carteira única:', error);
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
