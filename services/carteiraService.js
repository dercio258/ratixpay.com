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
            // Log dos dados recebidos no serviço
            console.log('🔍 [CarteiraService] Dados recebidos no serviço:', JSON.stringify(dadosCarteira, null, 2));
            console.log('🔍 [CarteiraService] Tipo dos dados:', typeof dadosCarteira);
            console.log('🔍 [CarteiraService] Keys dos dados:', Object.keys(dadosCarteira || {}));
            
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

            // Buscar carteira existente antes de validar (para preservar valores se necessário)
            let carteira = await Carteira.findOne({
                where: { vendedorId: vendedorId }
            });

            // Validar que contactos não sejam null ou vazios antes de processar
            // Se for atualização e os campos estiverem vazios, usar valores existentes
            if (carteira) {
                // Atualização: usar valores existentes se novos estiverem vazios
                if (!dadosCarteira.contactoMpesa || dadosCarteira.contactoMpesa.trim() === '') {
                    dadosCarteira.contactoMpesa = carteira.contacto_mpesa || carteira.contactoMpesa || '';
                }
                if (!dadosCarteira.contactoEmola || dadosCarteira.contactoEmola.trim() === '') {
                    dadosCarteira.contactoEmola = carteira.contacto_emola || carteira.contactoEmola || '';
                }
                if (!dadosCarteira.nomeTitularMpesa || dadosCarteira.nomeTitularMpesa.trim() === '') {
                    dadosCarteira.nomeTitularMpesa = carteira.nome_titular_mpesa || carteira.nomeTitularMpesa || '';
                }
                if (!dadosCarteira.nomeTitularEmola || dadosCarteira.nomeTitularEmola.trim() === '') {
                    dadosCarteira.nomeTitularEmola = carteira.nome_titular_emola || carteira.nomeTitularEmola || '';
                }
            }

            // Validação final: garantir que todos os campos obrigatórios tenham valores
            if (!dadosCarteira.contactoMpesa || dadosCarteira.contactoMpesa.trim() === '') {
                throw new Error('Contacto Mpesa é obrigatório');
            }
            if (!dadosCarteira.contactoEmola || dadosCarteira.contactoEmola.trim() === '') {
                throw new Error('Contacto Emola é obrigatório');
            }
            if (!dadosCarteira.nomeTitularMpesa || dadosCarteira.nomeTitularMpesa.trim() === '') {
                throw new Error('Nome do titular Mpesa é obrigatório');
            }
            if (!dadosCarteira.nomeTitularEmola || dadosCarteira.nomeTitularEmola.trim() === '') {
                throw new Error('Nome do titular Emola é obrigatório');
            }

            // Log antes de mapear os dados
            console.log('🔍 [CarteiraService] Valores antes de mapear:', {
                contactoMpesa: dadosCarteira.contactoMpesa,
                nomeTitularMpesa: dadosCarteira.nomeTitularMpesa,
                contactoEmola: dadosCarteira.contactoEmola,
                nomeTitularEmola: dadosCarteira.nomeTitularEmola
            });
            
            const dadosAtualizados = {
                contacto_mpesa: dadosCarteira.contactoMpesa.trim().replace(/\s+/g, ''),
                nome_titular_mpesa: dadosCarteira.nomeTitularMpesa.trim(),
                contacto_emola: dadosCarteira.contactoEmola.trim().replace(/\s+/g, ''),
                nome_titular_emola: dadosCarteira.nomeTitularEmola.trim(),
                ultima_atualizacao: new Date()
            };
            
            // Log após mapear os dados
            console.log('🔍 [CarteiraService] Dados mapeados para o banco:', JSON.stringify(dadosAtualizados, null, 2));

            // Atualizar nome se fornecido
            if (dadosCarteira.nome) {
                dadosAtualizados.nome = dadosCarteira.nome.trim();
            }

            // Email e email_titular sempre vêm do usuário autenticado
            if (emailParaSalvar) {
                dadosAtualizados.email = emailParaSalvar;
                dadosAtualizados.email_titular = emailParaSalvar; // Email do usuário usado como email_titular
            }

            // Atualizar metodo_saque (obrigatório)
            dadosAtualizados.metodo_saque = (dadosCarteira.metodoSaque || 'Mpesa').trim();

            // Preencher campos legados para compatibilidade
            // contacto (legado) = contacto_mpesa (padrão)
            dadosAtualizados.contacto = dadosAtualizados.contacto_mpesa || '';
            
            // nome_titular (legado) = nome_titular_mpesa (padrão) ou nome_titular_emola se método for Emola
            if (dadosAtualizados.metodo_saque.toLowerCase().includes('emola')) {
                dadosAtualizados.nome_titular = dadosAtualizados.nome_titular_emola || dadosAtualizados.nome_titular_mpesa || '';
            } else {
                dadosAtualizados.nome_titular = dadosAtualizados.nome_titular_mpesa || '';
            }

            if (carteira) {
                // Atualizar carteira existente
                // Preservar metodo_saque se não foi fornecido na atualização
                if (!dadosAtualizados.metodo_saque) {
                    dadosAtualizados.metodo_saque = carteira.metodo_saque || 'Mpesa';
                }
                // Garantir que email_titular seja preenchido na atualização também
                if (!dadosAtualizados.email_titular || dadosAtualizados.email_titular === '') {
                    dadosAtualizados.email_titular = emailParaSalvar || dadosAtualizados.email || carteira.email_titular || carteira.email || '';
                }
                // Preservar ativa = true (não permitir desativar pela atualização)
                dadosAtualizados.ativa = true;
                
                // Mapear para camelCase para o Sequelize (o modelo espera camelCase)
                const dadosParaUpdate = {
                    contactoMpesa: dadosAtualizados.contacto_mpesa,
                    nomeTitularMpesa: dadosAtualizados.nome_titular_mpesa,
                    contactoEmola: dadosAtualizados.contacto_emola,
                    nomeTitularEmola: dadosAtualizados.nome_titular_emola,
                    metodoSaque: dadosAtualizados.metodo_saque,
                    contacto: dadosAtualizados.contacto,
                    nomeTitular: dadosAtualizados.nome_titular,
                    email: dadosAtualizados.email,
                    emailTitular: dadosAtualizados.email_titular,
                    ultimaAtualizacao: dadosAtualizados.ultima_atualizacao,
                    ativa: dadosAtualizados.ativa
                };
                
                // Adicionar nome se foi fornecido
                if (dadosCarteira.nome) {
                    dadosParaUpdate.nome = dadosCarteira.nome.trim();
                }
                
                console.log('🔍 [CarteiraService] Dados que serão salvos no update (camelCase):', JSON.stringify(dadosParaUpdate, null, 2));
                
                await carteira.update(dadosParaUpdate);
                
                // Recarregar para verificar o que foi salvo
                await carteira.reload();
                console.log('🔍 [CarteiraService] Dados salvos no banco após update:', {
                    contacto_mpesa: carteira.contacto_mpesa || carteira.contactoMpesa,
                    contacto_emola: carteira.contacto_emola || carteira.contactoEmola,
                    nome_titular_mpesa: carteira.nome_titular_mpesa || carteira.nomeTitularMpesa,
                    nome_titular_emola: carteira.nome_titular_emola || carteira.nomeTitularEmola
                });
                
                console.log(`✅ Carteira atualizada com sucesso para vendedor ${vendedorId}`);
            } else {
                // Criar nova carteira
                dadosAtualizados.vendedorId = vendedorId;
                dadosAtualizados.ativa = true;
                dadosAtualizados.nome = (dadosCarteira.nome || 'Carteira Principal').trim(); // Nome da carteira

                // Definir metodo_saque (campo obrigatório no BD)
                dadosAtualizados.metodo_saque = (dadosCarteira.metodoSaque || 'Mpesa').trim();

                // Preencher campos legados para compatibilidade
                // contacto (legado) = contacto_mpesa (padrão)
                dadosAtualizados.contacto = dadosAtualizados.contacto_mpesa || '';
                
                // nome_titular (legado) = nome_titular_mpesa (padrão) ou nome_titular_emola se método for Emola
                if (dadosAtualizados.metodo_saque.toLowerCase().includes('emola')) {
                    dadosAtualizados.nome_titular = dadosAtualizados.nome_titular_emola || dadosAtualizados.nome_titular_mpesa || '';
                } else {
                    dadosAtualizados.nome_titular = dadosAtualizados.nome_titular_mpesa || '';
                }

                // Garantir que email seja sempre preenchido (obrigatório)
                if (!emailParaSalvar) {
                    throw new Error('Email do usuário é obrigatório para criar carteira. Faça login novamente.');
                }

                dadosAtualizados.email = emailParaSalvar;

                // Preencher campo 'email_titular' (legado) com o email do usuário autenticado
                dadosAtualizados.email_titular = emailParaSalvar;

                // Garantir que contacto seja sempre preenchido (obrigatório no BD)
                // if (!dadosAtualizados.contacto || dadosAtualizados.contacto === '') {
                //     throw new Error('Contacto Mpesa é obrigatório para criar carteira');
                // }

                // Garantir que nome_titular seja sempre preenchido (obrigatório no BD)
                // if (!dadosAtualizados.nome_titular || dadosAtualizados.nome_titular === '') {
                //     throw new Error('Nome titular Mpesa é obrigatório para criar carteira');
                // }

                // Mapear para camelCase para o Sequelize (o modelo espera camelCase)
                const dadosParaCreate = {
                    vendedorId: vendedorId,
                    nome: dadosAtualizados.nome,
                    contactoMpesa: dadosAtualizados.contacto_mpesa,
                    nomeTitularMpesa: dadosAtualizados.nome_titular_mpesa,
                    contactoEmola: dadosAtualizados.contacto_emola,
                    nomeTitularEmola: dadosAtualizados.nome_titular_emola,
                    metodoSaque: dadosAtualizados.metodo_saque,
                    contacto: dadosAtualizados.contacto,
                    nomeTitular: dadosAtualizados.nome_titular,
                    email: dadosAtualizados.email,
                    emailTitular: dadosAtualizados.email_titular,
                    ativa: dadosAtualizados.ativa
                };

                console.log(`🔍 [CarteiraService] Dados para criar carteira (camelCase):`, JSON.stringify(dadosParaCreate, null, 2));

                carteira = await Carteira.create(dadosParaCreate, {
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

            // Atualizar carteira (usar snake_case conforme banco)
            await carteira.update({
                nome: dadosCarteira.nome || carteira.nome,
                metodo_saque: dadosCarteira.metodoSaque || carteira.metodo_saque,
                // contacto: dadosCarteira.contacto || carteira.contacto, // Removido legado
                // nome_titular: dadosCarteira.nomeTitular || carteira.nome_titular, // Removido legado
                email_titular: dadosCarteira.emailTitular || carteira.email_titular
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
