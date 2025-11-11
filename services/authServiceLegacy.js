const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Usuario } = require('../config/database');
const { Op } = require('sequelize');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_aqui_2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

class AuthService {
    /**
     * Verificar token JWT
     */
    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    /**
     * Buscar usuário por ID
     */
    static async getUserById(userId) {
        try {
            const user = await Usuario.findByPk(userId);
            if (!user) return null;

            return {
                id: user.id,
                email: user.email,
                nome: user.nome,
                role: user.role,
                authProvider: user.auth_provider,
                contactConfigured: user.contact_configured
            };
        } catch (error) {
            console.error('❌ Erro ao buscar usuário:', error);
            return null;
        }
    }

    /**
     * Registrar novo usuário
     */
    static async register(userData) {
        try {
            const { password, nome, email, telefone } = userData;

            // Verificar se email já existe
            const existingUser = await Usuario.findOne({
                where: { email: email.toLowerCase() }
            });

            if (existingUser) {
                throw new Error('Email já está em uso');
            }

            // Hash da senha
            const passwordHash = await bcrypt.hash(password, 12);

            // Gerar IDs únicos
            const publicId = Math.floor(100000 + Math.random() * 900000).toString();
            const vendedorId = `V${Date.now()}${Math.floor(Math.random() * 100)}`;

            // Criar usuário
            const user = await Usuario.create({
                public_id: publicId,
                password_hash: passwordHash,
                nome: nome,
                nome_completo: nome,
                email: email.toLowerCase(),
                telefone: telefone || null,
                auth_provider: 'local',
                role: 'user',
                vendedor_id: vendedorId,
                status: 'Ativa',
                ativo: true,
                contact_configured: false,
                email_verificado: false
            });

            // Gerar token
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    nome: user.nome,
                    role: user.role,
                    authProvider: user.auth_provider,
                    contactConfigured: user.contact_configured
                },
                token: token
            };

        } catch (error) {
            console.error('❌ Erro no registro:', error);
            throw error;
        }
    }

    /**
     * Login local
     */
    static async login(credentials) {
        try {
            const { email, password } = credentials;

            // Buscar usuário
            const user = await Usuario.findOne({
                where: { email: email.toLowerCase() }
            });

            if (!user) {
                throw new Error('Credenciais inválidas');
            }

            if (!user.ativo) {
                throw new Error('Conta desativada');
            }

            // Verificar senha
            const passwordMatch = await bcrypt.compare(password, user.password_hash || user.password);
            
            if (!passwordMatch) {
                throw new Error('Credenciais inválidas');
            }

            // Atualizar último login
            await user.update({
                last_login: new Date(),
                login_attempts: 0,
                locked_until: null
            });

            // Gerar token
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    nome: user.nome,
                    role: user.role,
                    authProvider: user.auth_provider,
                    contactConfigured: user.contact_configured
                },
                token: token
            };

        } catch (error) {
            console.error('❌ Erro no login:', error);
            throw error;
        }
    }

    /**
     * Verificar código de verificação
     */
    static async verifyCode(userId, code) {
        try {
            const user = await Usuario.findByPk(userId);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            if (user.codigo_verificacao !== code) {
                throw new Error('Código inválido');
            }

            if (user.codigo_verificacao_expira < new Date()) {
                throw new Error('Código expirado');
            }

            // Marcar email como verificado
            await user.update({
                email_verificado: true,
                codigo_verificacao: null,
                codigo_verificacao_expira: null
            });

            return {
                success: true,
                message: 'Email verificado com sucesso'
            };

        } catch (error) {
            console.error('❌ Erro na verificação:', error);
            throw error;
        }
    }

    /**
     * Reenviar código de verificação
     */
    static async resendVerificationCode(userId) {
        try {
            const user = await Usuario.findByPk(userId);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            if (user.email_verificado) {
                throw new Error('Email já verificado');
            }

            // Gerar novo código
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            await user.update({
                codigo_verificacao: code,
                codigo_verificacao_expira: expiresAt
            });

            // Aqui você enviaria o email com o código
            console.log(`📧 Código de verificação para ${user.email}: ${code}`);

            return {
                success: true,
                message: 'Código reenviado com sucesso'
            };

        } catch (error) {
            console.error('❌ Erro ao reenviar código:', error);
            throw error;
        }
    }

    /**
     * Solicitar reset de senha
     */
    static async requestPasswordReset(identifier) {
        try {
            const user = await Usuario.findOne({
                where: { email: identifier.toLowerCase() }
            });

            if (!user) {
                throw new Error('Email não encontrado');
            }

            // Gerar código de reset
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            await user.update({
                reset_token: code,
                reset_token_expira: expiresAt
            });

            // Aqui você enviaria o email com o código
            console.log(`📧 Código de reset para ${user.email}: ${code}`);

            return {
                success: true,
                message: 'Código de reset enviado'
            };

        } catch (error) {
            console.error('❌ Erro ao solicitar reset:', error);
            throw error;
        }
    }

    /**
     * Verificar código de reset
     */
    static async verifyPasswordResetCode(identifier, code) {
        try {
            const user = await Usuario.findOne({
                where: { email: identifier.toLowerCase() }
            });

            if (!user) {
                throw new Error('Email não encontrado');
            }

            if (user.reset_token !== code) {
                throw new Error('Código inválido');
            }

            if (user.reset_token_expira < new Date()) {
                throw new Error('Código expirado');
            }

            return {
                success: true,
                message: 'Código válido'
            };

        } catch (error) {
            console.error('❌ Erro na verificação do código:', error);
            throw error;
        }
    }

    /**
     * Resetar senha
     */
    static async resetPassword(identifier, code, newPassword) {
        try {
            const user = await Usuario.findOne({
                where: { email: identifier.toLowerCase() }
            });

            if (!user) {
                throw new Error('Email não encontrado');
            }

            if (user.reset_token !== code) {
                throw new Error('Código inválido');
            }

            if (user.reset_token_expira < new Date()) {
                throw new Error('Código expirado');
            }

            // Hash da nova senha
            const passwordHash = await bcrypt.hash(newPassword, 12);

            // Atualizar senha
            await user.update({
                password_hash: passwordHash,
                reset_token: null,
                reset_token_expira: null
            });

            return {
                success: true,
                message: 'Senha alterada com sucesso'
            };

        } catch (error) {
            console.error('❌ Erro ao resetar senha:', error);
            throw error;
        }
    }

    /**
     * Atualizar perfil
     */
    static async updateProfile(userId, profileData) {
        try {
            const user = await Usuario.findByPk(userId);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Atualizar apenas campos permitidos
            const allowedFields = ['nome', 'telefone', 'whatsapp_contact', 'whatsapp_enabled'];
            const updateData = {};

            allowedFields.forEach(field => {
                if (profileData[field] !== undefined) {
                    updateData[field] = profileData[field];
                }
            });

            await user.update(updateData);

            return {
                success: true,
                message: 'Perfil atualizado com sucesso',
                user: {
                    id: user.id,
                    email: user.email,
                    nome: user.nome,
                    telefone: user.telefone,
                    whatsapp_contact: user.whatsapp_contact,
                    whatsapp_enabled: user.whatsapp_enabled
                }
            };

        } catch (error) {
            console.error('❌ Erro ao atualizar perfil:', error);
            throw error;
        }
    }

    /**
     * Alterar senha
     */
    static async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await Usuario.findByPk(userId);
            
            if (!user) {
                throw new Error('Usuário não encontrado');
            }

            // Verificar senha atual
            const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash || user.password);
            
            if (!passwordMatch) {
                throw new Error('Senha atual incorreta');
            }

            // Hash da nova senha
            const passwordHash = await bcrypt.hash(newPassword, 12);

            // Atualizar senha
            await user.update({
                password_hash: passwordHash
            });

            return {
                success: true,
                message: 'Senha alterada com sucesso'
            };

        } catch (error) {
            console.error('❌ Erro ao alterar senha:', error);
            throw error;
        }
    }
}

module.exports = AuthService;
