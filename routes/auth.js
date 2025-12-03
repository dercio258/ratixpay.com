const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Usuario, TentativaLogin, BloqueioConta } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const advancedSecurity = require('../middleware/advancedSecurity');
const professionalEmailService = require('../services/professionalEmailService');
const emailManagerService = require('../services/emailManagerService');

const router = express.Router();

// Função para gerar JWT token
function generateJWTToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET || 'ratixpay-secret-key-2024',
        { expiresIn: '24h' }
    );
}

// Função para gerar código de verificação
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para enviar email de verificação
async function sendVerificationEmail(email, code, type = 'verification', userId = null) {
    try {
        const subject = type === 'unlock' ? 'Código de Desbloqueio - RatixPay' : 'Código de Verificação - RatixPay';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #F64C00;">${subject}</h2>
                <p>Seu código de ${type === 'unlock' ? 'desbloqueio' : 'verificação'} é:</p>
                <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; color: #F64C00; border-radius: 8px; margin: 20px 0;">
                    ${code}
                </div>
                <p>Este código expira em 10 minutos.</p>
                <p>Se você não solicitou este código, ignore este email.</p>
            </div>
        `;

        // Usar sistema de emails profissionais
        await professionalEmailService.enviarEmailSistema(email, subject, html);

        // Enviar também via WhatsApp se o usuário tiver telefone (usando Baileys)
        if (userId) {
            try {
                const user = await Usuario.findByPk(userId);
                if (user && user.telefone) {
                    // Tentar usar Baileys diretamente
                    try {
                        const baileysManager = require('../services/whatsappBaileysManager');
                    const tipoTexto = type === 'unlock' ? 'Desbloqueio' : 'Verificação';
                    const mensagemWhatsApp = `🔐 *Código de ${tipoTexto}*

*${code}*

⏰ Válido por 10 minutos

RatixPay`;

                        const result = await baileysManager.sendNotificationSafely(user.telefone, mensagemWhatsApp, null, 'default');
                        if (result.success && !result.ignored) {
                    console.log(`✅ Código de ${type} enviado via WhatsApp para ${user.telefone}`);
                        }
                        // Se result.ignored === true, não logar nada (ignorado silenciosamente)
                    } catch (baileysError) {
                        // Ignorar silenciosamente se Baileys não estiver disponível
                        if (baileysError.code === 'MODULE_NOT_FOUND' || baileysError.message.includes('Cannot find module')) {
                            // Não logar - Baileys não está disponível, ignorar
                        } else {
                            console.warn('⚠️ Erro ao enviar código via WhatsApp (continuando com email):', baileysError.message);
                        }
                    }
                }
            } catch (whatsappError) {
                // Ignorar silenciosamente - não quebrar o fluxo
            }
        }

        console.log(`✅ Email de ${type} enviado para: ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Erro ao enviar email:', error);
        return false;
    }
}

// Função para registrar tentativa de login
async function recordLoginAttempt(userId, email, ip, userAgent, success, reason = null) {
    try {
        await TentativaLogin.create({
            usuario_id: userId,
            email: email,
            ip_address: ip,
            user_agent: userAgent,
            sucesso: success,
            motivo_falha: success ? null : reason
        });
    } catch (error) {
        console.error('Erro ao registrar tentativa de login:', error);
    }
}

// Função para verificar se conta está bloqueada
async function checkAccountBlocked(email) {
    try {
        const bloqueio = await BloqueioConta.findOne({
            where: {
                email: email,
                ativo: true
            }
        });

        return bloqueio;
    } catch (error) {
        console.error('Erro ao verificar bloqueio de conta:', error);
        return null;
    }
}

// Função para criar bloqueio de conta
async function createAccountBlock(userId, email, tipo, motivo) {
    try {
        const codigo = generateVerificationCode();
        const token = crypto.randomBytes(32).toString('hex');
        
        const bloqueio = await BloqueioConta.create({
            usuario_id: userId,
            email: email,
            tipo_bloqueio: tipo,
            motivo: motivo,
            token_desbloqueio: token,
            codigo_desbloqueio: codigo,
            codigo_expira: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
            ativo: true
        });

        // Enviar código por email e WhatsApp
        await sendVerificationEmail(email, codigo, 'unlock', userId);

        return { bloqueio, codigo };
    } catch (error) {
        console.error('Erro ao criar bloqueio de conta:', error);
        return null;
    }
}

// Rota de login
router.post('/login', advancedSecurity.validateAuth(), async (req, res) => {
    try {
        const { email, telefone, password } = req.body;
        const ip = req.ip;
        const userAgent = req.get('User-Agent') || '';

        // Debug: Log dos dados recebidos
        console.log('📥 [LOGIN] Dados recebidos:', {
            hasEmail: !!email,
            hasTelefone: !!telefone,
            hasPassword: !!password,
            emailValue: email ? email.substring(0, 5) + '...' : null,
            telefoneValue: telefone ? telefone.substring(0, 5) + '...' : null,
            passwordLength: password ? password.length : 0,
            bodyKeys: Object.keys(req.body)
        });

        // Validar dados - verificar se password não está vazio após trim
        const passwordTrimmed = password ? password.trim() : '';
        const emailTrimmed = email ? email.trim() : '';
        const telefoneTrimmed = telefone ? telefone.trim() : '';

        if (!passwordTrimmed || passwordTrimmed.length === 0 || (!emailTrimmed && !telefoneTrimmed)) {
            console.error('❌ [LOGIN] Validação falhou:', {
                passwordEmpty: !passwordTrimmed || passwordTrimmed.length === 0,
                emailEmpty: !emailTrimmed,
                telefoneEmpty: !telefoneTrimmed,
                noEmailOrTelefone: !emailTrimmed && !telefoneTrimmed
            });
            return res.status(400).json({
                success: false,
                error: 'Email/telefone e senha são obrigatórios'
            });
        }

        // Buscar usuário - usar valores trimmed
        let user;
        if (emailTrimmed) {
            user = await Usuario.findOne({ where: { email: emailTrimmed } });
        } else {
            user = await Usuario.findOne({ where: { telefone: telefoneTrimmed } });
        }

        if (!user) {
            await recordLoginAttempt(null, emailTrimmed || telefoneTrimmed, ip, userAgent, false, 'Usuário não encontrado');
            advancedSecurity.recordFailedAttempt(ip, 'USER_NOT_FOUND');
      return res.status(401).json({
        success: false,
                error: 'Credenciais inválidas'
            });
        }

        // Verificar se conta está ativa
        if (!user.ativo) {
            await recordLoginAttempt(user.id, emailTrimmed || telefoneTrimmed, ip, userAgent, false, 'Conta inativa');
            return res.status(401).json({
        success: false,
                error: 'Conta inativa'
            });
        }

        // Todos os usuários são automaticamente vendedores (role: 'user')
        // Não há validação de tipo_conta - todos podem fazer login

        // Verificar se conta está bloqueada
        const bloqueio = await checkAccountBlocked(user.email);
        if (bloqueio) {
            return res.status(403).json({
            success: false,
                error: 'Conta bloqueada por segurança',
                bloqueada: true,
                codigo_enviado: true,
                email: user.email
            });
        }

        // Verificar senha - usar password trimmed
        const passwordToCheck = user.password_hash || user.password;
        const validPassword = await bcrypt.compare(passwordTrimmed, passwordToCheck);
        if (!validPassword) {
            await recordLoginAttempt(user.id, emailTrimmed || telefoneTrimmed, ip, userAgent, false, 'Senha incorreta');
            advancedSecurity.recordFailedAttempt(ip, 'INVALID_PASSWORD');
            
            // Não bloquear automaticamente - bloqueios serão feitos manualmente pelo admin
            return res.status(401).json({
                success: false,
                error: 'Credenciais inválidas'
            });
        }


        // Verificar se precisa de verificação
        if (!user.email_verificado) {
            const codigo = generateVerificationCode();
            user.codigo_verificacao = codigo;
            user.codigo_verificacao_expira = new Date(Date.now() + 10 * 60 * 1000);
            await user.save();

            await sendVerificationEmail(user.email, codigo, 'verification', user.id);

            await recordLoginAttempt(user.id, emailTrimmed || telefoneTrimmed, ip, userAgent, true);
            return res.json({
                success: true,
                requiresVerification: true,
                userId: user.id,
                message: 'Código de verificação enviado para seu email'
            });
        }

        // Login bem-sucedido
        user.tentativas_login = 0;
        user.ultimo_login = new Date();
        await user.save();

        const token = generateJWTToken(user);
        
        await recordLoginAttempt(user.id, emailTrimmed || telefoneTrimmed, ip, userAgent, true);

        // Enviar notificação de login por email
        try {
            await emailManagerService.enviarEmailSistema('notificacao_login', {
                email: user.email,
                nome: user.nome_completo || user.email,
                ip: ip,
                userAgent: userAgent,
                dataHora: new Date().toLocaleString('pt-BR', { 
                    timeZone: 'Africa/Maputo',
                    dateStyle: 'full',
                    timeStyle: 'long'
                })
            });
            console.log(`📧 Notificação de login enviada para: ${user.email}`);
        } catch (emailError) {
            console.error('⚠️ Erro ao enviar notificação de login:', emailError);
            // Não bloquear o login se o email falhar
        }

        // Determinar página de redirecionamento
        let redirectPage = 'index.html';
        
        // Verificação especial para email administrativo principal
        const isMainAdmin = user.email === 'ratixpay.mz@gmail.com';
        
        if (user.role === 'admin' || isMainAdmin) {
            redirectPage = 'admin-dashboard.html';
            console.log('🔑 Redirecionando para admin-dashboard.html (email principal)');
        } else if (user.role === 'user') {
            redirectPage = 'dashboard.html';
        }

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                nome_completo: user.nome_completo,
                // tipo_conta removido - usar role diretamente
                role: user.role,
                vendedor_id: user.vendedor_id
            },
            redirectPage: redirectPage
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de verificação de código
router.post('/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            return res.status(400).json({
                success: false,
                error: 'ID do usuário e código são obrigatórios'
            });
        }

        const user = await Usuario.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar código
        if (user.codigo_verificacao !== code) {
            return res.status(400).json({
    success: false,
                error: 'Código inválido'
            });
        }

        // Verificar expiração
        if (new Date() > user.codigo_verificacao_expira) {
            return res.status(400).json({
        success: false,
                error: 'Código expirado'
            });
        }

        // Marcar email como verificado
        user.email_verificado = true;
        user.codigo_verificacao = null;
        user.codigo_verificacao_expira = null;
        await user.save();

        const token = generateJWTToken(user);

        // Determinar página de redirecionamento
        let redirectPage = 'index.html';
        
        // Verificação especial para email administrativo principal
        const isMainAdmin = user.email === 'ratixpay.mz@gmail.com';
        
        if (user.role === 'admin' || user.role === 'admin' || isMainAdmin) {
            redirectPage = 'admin-dashboard.html';
            console.log('🔑 Redirecionando para admin-dashboard.html (email principal)');
        } else if (user.role === 'user') {
            redirectPage = 'dashboard.html';
        }

        res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                nome_completo: user.nome_completo,
                // tipo_conta removido - usar role diretamente
                role: user.role,
                vendedor_id: user.vendedor_id
            },
            redirectPage: redirectPage
        });

  } catch (error) {
        console.error('Erro na verificação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Rota de desbloqueio de conta
router.post('/desbloquear-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;

        if (!email || !codigo) {
            return res.status(400).json({
                success: false,
                error: 'Email e código são obrigatórios'
            });
        }

        const bloqueio = await BloqueioConta.findOne({
            where: {
                email: email,
                codigo_desbloqueio: codigo,
                ativo: true
            }
        });

        if (!bloqueio) {
            return res.status(400).json({
                success: false,
                error: 'Código inválido'
            });
        }

        // Verificar expiração
        if (new Date() > bloqueio.codigo_expira) {
            return res.status(400).json({
                success: false,
                error: 'Código expirado'
            });
        }

        // Desbloquear conta
        bloqueio.ativo = false;
        bloqueio.data_desbloqueio = new Date();
        await bloqueio.save();

        // Resetar tentativas de login do usuário
        const user = await Usuario.findByPk(bloqueio.usuario_id);
        if (user) {
            user.tentativas_login = 0;
            await user.save();
        }

            res.json({
                success: true,
            message: 'Conta desbloqueada com sucesso'
        });

    } catch (error) {
        console.error('Erro no desbloqueio:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de reenvio de código de verificação
router.post('/resend-verification', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'ID do usuário é obrigatório'
            });
        }

        const user = await Usuario.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        const codigo = generateVerificationCode();
        user.codigo_verificacao = codigo;
        user.codigo_verificacao_expira = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendVerificationEmail(user.email, codigo, 'verification', user.id);

        res.json({
            success: true,
            message: 'Código reenviado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao reenviar código:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de verificação de token
router.get('/verify-token', authenticateToken, (req, res) => {
        res.json({
            success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            nome_completo: req.user.nome_completo,
            role: req.user.role,
            vendedor_id: req.user.vendedor_id
        }
    });
});

// Rota de registro
router.post('/register', async (req, res) => {
    try {
        const { email, password, nome_completo, telefone } = req.body;
        const ip = req.ip;
        const userAgent = req.get('User-Agent') || '';

        // Debug: Log dos dados recebidos
        console.log('📋 Dados recebidos no registro:', {
            email: !!email,
            password: !!password,
            nome_completo: !!nome_completo,
            telefone: !!telefone
        });

        // Validar dados obrigatórios
        if (!email || !password || !nome_completo) {
                return res.status(400).json({
                    success: false,
                error: 'Todos os campos obrigatórios devem ser preenchidos',
                debug: {
                    email: !!email,
                    password: !!password,
                    nome_completo: !!nome_completo
                }
            });
        }

        // Verificar se usuário já existe
        const existingUser = await Usuario.findOne({
            where: {
                email: email
            }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Email já cadastrado'
            });
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Gerar public_id único (6 dígitos) - verificar se não existe
        let publicId;
        let isUnique = false;
        while (!isUnique) {
            publicId = Math.floor(100000 + Math.random() * 900000).toString();
            const existingUser = await Usuario.findOne({ where: { public_id: publicId } });
            if (!existingUser) {
                isUnique = true;
            }
        }
        
        // Gerar vendedor_id único - verificar se não existe
        let vendedorId;
        let isVendedorIdUnique = false;
        while (!isVendedorIdUnique) {
            vendedorId = 'V' + Math.floor(100000 + Math.random() * 900000).toString();
            const existingVendedor = await Usuario.findOne({ where: { vendedor_id: vendedorId } });
            if (!existingVendedor) {
                isVendedorIdUnique = true;
            }
        }

        // Criar usuário
        const user = await Usuario.create({
            public_id: publicId,
            email: email,
            password: password, // Campo obrigatório no banco (deprecated)
            password_hash: hashedPassword, // Hash bcrypt
            nome: nome_completo.split(' ')[0], // Primeiro nome
            nome_completo: nome_completo,
            telefone: telefone || null,
            vendedor_id: vendedorId,
            role: 'user', // Todos os usuários são criados como 'user'
            email_verificado: false,
            ativo: true,
            suspenso: false,
            tentativas_login: 0
        });

        // Gerar código de verificação
        const codigo = generateVerificationCode();
        user.codigo_verificacao = codigo;
        user.codigo_verificacao_expira = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        // Enviar email de verificação
        await sendVerificationEmail(email, codigo, 'verification', user.id);

        res.json({
            success: true,
            message: 'Conta criada com sucesso. Verifique seu email para ativar a conta.',
            userId: user.id,
            requiresVerification: true
        });

    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de recuperação de senha - ENVIA CÓDIGO
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        // Buscar usuário
        const user = await Usuario.findOne({ where: { email: email } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Email não encontrado'
            });
        }

        // Gerar código de recuperação (6 dígitos)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        // Salvar código no banco
        user.codigo_verificacao = resetCode;
        user.codigo_verificacao_expira = resetExpires;
        await user.save();

        // Enviar email com código de recuperação
        const subject = 'Código de Recuperação de Senha - RatixPay';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #F64C00;">Recuperação de Senha</h2>
                <p>Você solicitou a recuperação de senha para sua conta RatixPay.</p>
                <p>Use o código abaixo para redefinir sua senha:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="background: #F64C00; color: white; padding: 20px; font-size: 24px; font-weight: bold; border-radius: 8px; display: inline-block; letter-spacing: 5px;">
                        ${resetCode}
                    </div>
                </div>
                <p>Este código expira em 15 minutos.</p>
                <p>Se você não solicitou esta recuperação, ignore este email.</p>
            </div>
        `;

        // Usar sistema de emails profissionais
        await professionalEmailService.enviarEmailSistema(email, subject, html);

        // Enviar código também via WhatsApp se o usuário tiver telefone (usando Baileys)
        if (user.telefone) {
            try {
                // Tentar usar Baileys diretamente
                try {
                    const baileysManager = require('../services/whatsappBaileysManager');
                const mensagemWhatsApp = `🔐 *Código de Recuperação*

*${resetCode}*

⏰ Válido por 15 minutos

RatixPay`;

                    const result = await baileysManager.sendNotificationSafely(user.telefone, mensagemWhatsApp, null, 'default');
                    if (result.success && !result.ignored) {
                console.log(`✅ Código de redefinição de senha enviado via WhatsApp para ${user.telefone}`);
                    }
                    // Se result.ignored === true, não logar nada (ignorado silenciosamente)
                } catch (baileysError) {
                    // Ignorar silenciosamente se Baileys não estiver disponível
                    if (baileysError.code === 'MODULE_NOT_FOUND' || baileysError.message.includes('Cannot find module')) {
                        // Não logar - Baileys não está disponível, ignorar
                    } else {
                        console.warn('⚠️ Erro ao enviar código via WhatsApp (continuando com email):', baileysError.message);
                    }
                }
            } catch (whatsappError) {
                // Ignorar silenciosamente - não quebrar o fluxo
            }
        }

        res.json({
            success: true,
            message: 'Código de recuperação enviado para seu email' + (user.telefone ? ' e WhatsApp' : '')
        });

    } catch (error) {
        console.error('Erro na recuperação de senha:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota para verificar código de recuperação
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                error: 'Email e código são obrigatórios'
            });
        }

        // Buscar usuário
        const user = await Usuario.findOne({ where: { email: email } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar código
        if (user.codigo_verificacao !== code) {
            return res.status(400).json({
                success: false,
                error: 'Código inválido'
            });
        }

        // Verificar expiração
        if (new Date() > user.codigo_verificacao_expira) {
            return res.status(400).json({
                success: false,
                error: 'Código expirado'
            });
        }

        res.json({
            success: true,
            message: 'Código verificado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao verificar código:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de redefinição de senha - USA CÓDIGO
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        // Debug: Log dos dados recebidos
        console.log('🔍 Dados recebidos no reset-password:', {
            email: email,
            code: code,
            newPassword: !!newPassword
        });

        if (!email || !code || !newPassword) {
            console.log('❌ Dados obrigatórios não fornecidos:', {
                email: !!email,
                code: !!code,
                newPassword: !!newPassword
            });
            return res.status(400).json({
                success: false,
                error: 'Dados obrigatórios não fornecidos'
            });
        }

        // Buscar usuário
        const user = await Usuario.findOne({ where: { email: email } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar código
        if (user.codigo_verificacao !== code) {
            return res.status(400).json({
                success: false,
                error: 'Código inválido'
            });
        }

        // Verificar expiração
        if (new Date() > user.codigo_verificacao_expira) {
            return res.status(400).json({
                success: false,
                error: 'Código expirado'
            });
        }

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Atualizar senha (usar password_hash como campo principal)
        user.password_hash = hashedPassword;
        user.password = hashedPassword; // Manter compatibilidade
        user.codigo_verificacao = null;
        user.codigo_verificacao_expira = null;
        await user.save();
        
        console.log('✅ Senha atualizada com sucesso para usuário:', user.email);

        res.json({
            success: true,
            message: 'Senha alterada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota de logout
router.post('/logout', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Logout realizado com sucesso'
    });
});

// Rota de verificação de email
router.post('/verify-email', async (req, res) => {
    try {
        const { code, userId } = req.body;

        if (!code || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Código e ID do usuário são obrigatórios'
            });
        }

        // Buscar usuário
        const user = await Usuario.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Verificar se código está correto e não expirou
        if (!user.codigo_verificacao || user.codigo_verificacao !== code) {
            return res.status(400).json({
                success: false,
                error: 'Código de verificação inválido'
            });
        }

        if (!user.codigo_verificacao_expira || new Date() > user.codigo_verificacao_expira) {
            return res.status(400).json({
                success: false,
                error: 'Código de verificação expirado'
            });
        }

        // Marcar email como verificado
        user.email_verificado = true;
        user.codigo_verificacao = null;
        user.codigo_verificacao_expira = null;
        await user.save();

        res.json({
            success: true,
            message: 'Email verificado com sucesso'
        });

    } catch (error) {
        console.error('Erro na verificação:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota para reenviar código de verificação
router.post('/resend-verification', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'ID do usuário é obrigatório'
            });
        }

        // Buscar usuário
        const user = await Usuario.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }

        // Gerar novo código
        const codigo = generateVerificationCode();
        user.codigo_verificacao = codigo;
        user.codigo_verificacao_expira = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
        await user.save();

        // Enviar email e WhatsApp
        await sendVerificationEmail(user.email, codigo, 'verification', user.id);

        res.json({
            success: true,
            message: 'Código reenviado com sucesso'
        });

    } catch (error) {
        console.error('Erro ao reenviar código:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota para obter dados do usuário autenticado
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        
        // Remover dados sensíveis
        const userData = {
            id: user.id,
            public_id: user.public_id,
            email: user.email,
            nome: user.nome,
            nome_completo: user.nome_completo,
            telefone: user.telefone,
            whatsapp_contact: user.whatsapp_contact,
            whatsapp_enabled: user.whatsapp_enabled,
            whatsapp_notification_types: user.whatsapp_notification_types || [],
            role: user.role,
            vendedor_id: user.vendedor_id,
            status: user.status,
            email_verificado: user.email_verificado,
            telefone_verificado: user.telefone_verificado,
            ativo: user.ativo,
            suspenso: user.suspenso,
            ultimo_login: user.ultimo_login,
            last_login: user.last_login,
            contact_configured: user.contact_configured,
            auth_provider: user.auth_provider,
            google_user: user.google_user,
            created_at: user.created_at
        };

        res.json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Erro ao obter dados do usuário:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota para obter perfil do usuário
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        console.log(`🔍 Obtendo perfil do usuário ${userId}...`);
        
        // Buscar usuário com dados completos
        const user = await Usuario.findByPk(userId, {
            attributes: [
                'id', 'nome', 'nome_completo', 'email', 'telefone', 'whatsapp_contact', 
                'whatsapp_enabled', 'whatsapp_notification_types', 'avatar_url', 'role', 'ativo',
                'created_at', 'updated_at'
            ]
        });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: user.id,
                nome: user.nome,
                nome_completo: user.nome_completo,
                email: user.email,
                telefone: user.telefone,
                whatsapp_contact: user.whatsapp_contact,
                whatsapp_enabled: user.whatsapp_enabled,
                whatsapp_notification_types: user.whatsapp_notification_types || [],
                avatar_url: user.avatar_url,
                role: user.role,
                ativo: user.ativo,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter perfil:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// Rota para atualizar perfil do usuário
router.put('/profile', authenticateToken, async (req, res) => {
    console.log('🔍 Rota /profile acessada:', req.method, req.url);
    try {
        const userId = req.user.id;
        const { nome, nome_completo, telefone, whatsapp_contact, whatsapp_enabled, whatsapp_notification_types, avatar_url } = req.body;
        
        console.log(`🔄 Atualizando perfil do usuário ${userId}...`);
        console.log('📝 Dados recebidos:', { nome, nome_completo, telefone, whatsapp_contact, whatsapp_enabled, whatsapp_notification_types, avatar_url });
        
        // Buscar usuário
        const user = await Usuario.findByPk(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado'
            });
        }
        
        // Atualizar apenas campos fornecidos
        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (nome_completo !== undefined) updateData.nome_completo = nome_completo;
        if (telefone !== undefined) updateData.telefone = telefone;
        if (whatsapp_contact !== undefined) updateData.whatsapp_contact = whatsapp_contact;
        if (whatsapp_enabled !== undefined) updateData.whatsapp_enabled = whatsapp_enabled;
        if (whatsapp_notification_types !== undefined) updateData.whatsapp_notification_types = whatsapp_notification_types;
        if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
        
        await user.update(updateData);
        
        console.log(`✅ Perfil do usuário ${userId} atualizado com sucesso`);
        
        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            user: {
                id: user.id,
                nome: user.nome,
                nome_completo: user.nome_completo,
                telefone: user.telefone,
                whatsapp_contact: user.whatsapp_contact,
                whatsapp_enabled: user.whatsapp_enabled,
                whatsapp_notification_types: user.whatsapp_notification_types || [],
                avatar_url: user.avatar_url
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar perfil:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;