/**
 * Rotas de Autenticação para Afiliados
 * Sistema completo de registro, login e recuperação de senha
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { Afiliado, VendaAfiliado, LinkTracking } = require('../config/database');
const { Op } = require('sequelize');
const professionalEmailService = require('../services/professionalEmailService');

// Configurações
const JWT_SECRET = process.env.JWT_SECRET || 'ratixpay-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'; // 30 dias para afiliados
const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://ratixpay.com';

// Rate Limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas por IP
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 registros por IP por hora
    message: {
        success: false,
        message: 'Muitas tentativas de registro. Tente novamente mais tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 solicitações por IP por hora
    message: {
        success: false,
        message: 'Muitas solicitações de recuperação. Tente novamente em 1 hora.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Função para gerar código de afiliado único
function gerarCodigoAfiliado() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
}

// Função para validar senha forte
function validarSenha(senha) {
    if (senha.length < 8) {
        return { valida: false, mensagem: 'A senha deve ter pelo menos 8 caracteres' };
    }
    if (!/[A-Z]/.test(senha)) {
        return { valida: false, mensagem: 'A senha deve conter pelo menos uma letra maiúscula' };
    }
    if (!/[a-z]/.test(senha)) {
        return { valida: false, mensagem: 'A senha deve conter pelo menos uma letra minúscula' };
    }
    if (!/[0-9]/.test(senha)) {
        return { valida: false, mensagem: 'A senha deve conter pelo menos um número' };
    }
    return { valida: true };
}

// Função para enviar email de boas-vindas
async function enviarEmailBoasVindas(afiliado) {
    try {
        const assunto = '🎉 Bem-vindo ao Programa de Afiliados RatixPay!';
        const conteudo = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f8f9fa;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                    }
                    .code-box {
                        background: white;
                        border: 2px dashed #F64C00;
                        padding: 20px;
                        text-align: center;
                        margin: 20px 0;
                        border-radius: 8px;
                    }
                    .code {
                        font-size: 32px;
                        font-weight: bold;
                        color: #F64C00;
                        letter-spacing: 5px;
                        font-family: 'Courier New', monospace;
                    }
                    .button {
                        display: inline-block;
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 25px;
                        margin: 20px 0;
                        font-weight: bold;
                    }
                    .info-box {
                        background: #e7f3ff;
                        border-left: 4px solid #2196F3;
                        padding: 15px;
                        margin: 20px 0;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎉 Bem-vindo ao Programa de Afiliados!</h1>
                </div>
                <div class="content">
                    <p>Olá <strong>${afiliado.nome}</strong>,</p>
                    
                    <p>Parabéns! Sua conta de afiliado foi criada com sucesso no RatixPay.</p>
                    
                    <h2>📋 Seu Código de Afiliado:</h2>
                    <div class="code-box">
                        <div class="code">${afiliado.codigo_afiliado}</div>
                    </div>
                    
                    <p>Use este código para compartilhar produtos e ganhar comissões!</p>
                    
                    <div class="info-box">
                        <strong>💡 Como funciona:</strong>
                        <ul>
                            <li>Compartilhe links com seu código: <code>?ref=${afiliado.codigo_afiliado}</code></li>
                            <li>Ganhe <strong>${afiliado.comissao_percentual}%</strong> de comissão em cada venda</li>
                            <li>Acompanhe suas vendas e comissões no painel</li>
                            <li>Saques disponíveis quando atingir o valor mínimo</li>
                        </ul>
                    </div>
                    
                    <p style="text-align: center;">
                        <a href="${BASE_URL}/afiliado-dashboard.html" class="button">
                            Acessar Painel do Afiliado
                        </a>
                    </p>
                    
                    <p>Seu link de afiliado personalizado:</p>
                    <p style="background: white; padding: 15px; border-radius: 5px; word-break: break-all;">
                        ${BASE_URL}/?ref=${afiliado.codigo_afiliado}
                    </p>
                    
                    <p>Boa sorte nas vendas! 🚀</p>
                    
                    <p>Atenciosamente,<br><strong>Equipe RatixPay</strong></p>
                </div>
            </body>
            </html>
        `;

        await professionalEmailService.enviarEmailVendas(
            afiliado.email,
            assunto,
            conteudo,
            'boas_vindas_afiliado'
        );

        console.log(`✅ Email de boas-vindas enviado para: ${afiliado.email}`);
    } catch (error) {
        console.error('❌ Erro ao enviar email de boas-vindas:', error);
        // Não falhar o registro por erro de email
    }
}

// Função para enviar email de recuperação de senha
async function enviarEmailRecuperacaoSenha(afiliado, resetToken) {
    try {
        const resetUrl = `${BASE_URL}/afiliado-reset-password.html?token=${resetToken}`;
        const assunto = '🔑 Recuperação de Senha - Programa de Afiliados RatixPay';
        
        const conteudo = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f8f9fa;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                    }
                    .button {
                        display: inline-block;
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 25px;
                        margin: 20px 0;
                        font-weight: bold;
                    }
                    .warning-box {
                        background: #fff3cd;
                        border-left: 4px solid #ffc107;
                        padding: 15px;
                        margin: 20px 0;
                    }
                    .token-box {
                        background: white;
                        border: 1px solid #ddd;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 5px;
                        word-break: break-all;
                        font-family: monospace;
                        font-size: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔑 Recuperação de Senha</h1>
                </div>
                <div class="content">
                    <p>Olá <strong>${afiliado.nome}</strong>,</p>
                    
                    <p>Recebemos uma solicitação para redefinir a senha da sua conta de afiliado.</p>
                    
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="button">
                            Redefinir Senha
                        </a>
                    </p>
                    
                    <p>Ou copie e cole este link no seu navegador:</p>
                    <div class="token-box">${resetUrl}</div>
                    
                    <div class="warning-box">
                        <strong>⚠️ Importante:</strong>
                        <ul>
                            <li>Este link expira em <strong>1 hora</strong></li>
                            <li>Se você não solicitou esta recuperação, ignore este email</li>
                            <li>Nunca compartilhe este link com ninguém</li>
                        </ul>
                    </div>
                    
                    <p>Se você não solicitou esta recuperação, pode ignorar este email com segurança.</p>
                    
                    <p>Atenciosamente,<br><strong>Equipe RatixPay</strong></p>
                </div>
            </body>
            </html>
        `;

        await professionalEmailService.enviarEmailSistema(
            afiliado.email,
            assunto,
            conteudo,
            'recuperacao_senha_afiliado'
        );

        console.log(`✅ Email de recuperação enviado para: ${afiliado.email}`);
    } catch (error) {
        console.error('❌ Erro ao enviar email de recuperação:', error);
        throw error; // Falhar se não conseguir enviar email
    }
}

// POST - Registrar novo afiliado
router.post('/register', registerLimiter, async (req, res) => {
    try {
        console.log('📝 Registrando novo afiliado...');
        
        const { nome, email, telefone, senha, confirmarSenha } = req.body;
        
        // Validar dados obrigatórios
        if (!nome || !email || !senha) {
            return res.status(400).json({
                success: false,
                message: 'Nome, email e senha são obrigatórios',
                errors: {
                    nome: !nome ? 'Nome é obrigatório' : null,
                    email: !email ? 'Email é obrigatório' : null,
                    senha: !senha ? 'Senha é obrigatória' : null
                }
            });
        }

        // Validar confirmação de senha
        if (confirmarSenha && senha !== confirmarSenha) {
            return res.status(400).json({
                success: false,
                message: 'As senhas não coincidem'
            });
        }
        
        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de email inválido'
            });
        }

        // Validar nome (mínimo 3 caracteres)
        if (nome.trim().length < 3) {
            return res.status(400).json({
                success: false,
                message: 'O nome deve ter pelo menos 3 caracteres'
            });
        }
        
        // Validar senha forte
        const validacaoSenha = validarSenha(senha);
        if (!validacaoSenha.valida) {
            return res.status(400).json({
                success: false,
                message: validacaoSenha.mensagem
            });
        }
        
        // Verificar se email já existe
        const afiliadoExistente = await Afiliado.findOne({
            where: { email: email.toLowerCase() }
        });
        
        if (afiliadoExistente) {
            return res.status(400).json({
                success: false,
                message: 'Email já está cadastrado. Faça login ou recupere sua senha.',
                code: 'EMAIL_EXISTS'
            });
        }
        
        // Gerar código único
        let codigoAfiliado;
        let tentativas = 0;
        do {
            codigoAfiliado = gerarCodigoAfiliado();
            tentativas++;
        } while (await Afiliado.findOne({ where: { codigo_afiliado: codigoAfiliado } }) && tentativas < 20);
        
        if (tentativas >= 20) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao gerar código único. Tente novamente.'
            });
        }
        
        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, 12);
        
        // Criar link de afiliado personalizado
        const linkAfiliado = `${BASE_URL}/?ref=${codigoAfiliado}`;
        
        // Criar afiliado
        const afiliado = await Afiliado.create({
            nome: nome.trim(),
            email: email.toLowerCase().trim(),
            telefone: telefone ? telefone.trim() : null,
            senha: senhaHash,
            codigo_afiliado: codigoAfiliado,
            link_afiliado: linkAfiliado,
            comissao_percentual: 15.00, // Comissão padrão
            status: 'ativo',
            data_cadastro: new Date(),
            ultima_atividade: new Date()
        });
        
        console.log('✅ Afiliado registrado:', afiliado.codigo_afiliado);
        
        // Enviar email de boas-vindas (não bloquear se falhar)
        await enviarEmailBoasVindas(afiliado).catch(err => {
            console.error('⚠️ Erro ao enviar email de boas-vindas (não crítico):', err);
        });
        
        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: afiliado.id, 
                email: afiliado.email,
                tipo: 'afiliado'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        res.status(201).json({
            success: true,
            message: 'Afiliado registrado com sucesso! Verifique seu email para mais informações.',
            token,
            afiliado: {
                id: afiliado.id,
                nome: afiliado.nome,
                email: afiliado.email,
                codigo: afiliado.codigo_afiliado,
                link_afiliado: afiliado.link_afiliado,
                comissao_percentual: afiliado.comissao_percentual,
                total_vendas: afiliado.total_vendas,
                total_comissoes: parseFloat(afiliado.total_comissoes),
                saldo_disponivel: parseFloat(afiliado.saldo_disponivel)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao registrar afiliado:', error);
        
        // Tratar erros específicos do banco
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                success: false,
                message: 'Email ou código já está em uso'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor. Tente novamente mais tarde.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST - Login do afiliado
router.post('/login', loginLimiter, async (req, res) => {
    try {
        console.log('🔐 Tentativa de login de afiliado...');
        
        const { email, senha } = req.body;
        
        if (!email || !senha) {
            return res.status(400).json({
                success: false,
                message: 'Email e senha são obrigatórios'
            });
        }
        
        // Buscar afiliado pelo email
        const afiliado = await Afiliado.findOne({
            where: { 
                email: email.toLowerCase().trim()
            }
        });
        
        if (!afiliado) {
            console.log('❌ Login falhou: Email não encontrado');
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Verificar status da conta
        if (afiliado.status === 'suspenso') {
            console.log('❌ Login bloqueado: Conta suspensa');
            return res.status(403).json({
                success: false,
                message: 'Sua conta está suspensa. Entre em contato com o suporte.',
                status: 'suspenso'
            });
        }

        if (afiliado.status === 'inativo') {
            console.log('❌ Login bloqueado: Conta inativa');
            return res.status(403).json({
                success: false,
                message: 'Sua conta está inativa. Entre em contato com o suporte.',
                status: 'inativo'
            });
        }
        
        // Verificar senha
        const senhaValida = await bcrypt.compare(senha, afiliado.senha);
        
        if (!senhaValida) {
            console.log('❌ Login falhou: Senha inválida');
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        // Atualizar última atividade
        await afiliado.update({
            ultima_atividade: new Date()
        });
        
        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: afiliado.id, 
                email: afiliado.email,
                tipo: 'afiliado'
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
        
        console.log('✅ Login realizado com sucesso:', afiliado.nome);
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            afiliado: {
                id: afiliado.id,
                nome: afiliado.nome,
                email: afiliado.email,
                codigo: afiliado.codigo_afiliado,
                link_afiliado: afiliado.link_afiliado,
                comissao_percentual: afiliado.comissao_percentual,
                total_vendas: afiliado.total_vendas,
                total_comissoes: parseFloat(afiliado.total_comissoes),
                saldo_disponivel: parseFloat(afiliado.saldo_disponivel),
                status: afiliado.status
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST - Esqueci senha
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
        console.log('🔑 Solicitação de reset de senha...');
        
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email é obrigatório'
            });
        }

        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de email inválido'
            });
        }
        
        // Buscar afiliado pelo email
        const afiliado = await Afiliado.findOne({
            where: { 
                email: email.toLowerCase().trim()
            }
        });
        
        // Por segurança, sempre retornar sucesso (mesmo se não encontrar)
        if (!afiliado) {
            console.log('⚠️ Reset solicitado para email não cadastrado:', email);
            return res.json({
                success: true,
                message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha'
            });
        }

        // Verificar se já existe um token válido (evitar spam)
        if (afiliado.token_reset_senha && afiliado.token_reset_expires && afiliado.token_reset_expires > new Date()) {
            const minutosRestantes = Math.ceil((afiliado.token_reset_expires - new Date()) / 60000);
            return res.status(429).json({
                success: false,
                message: `Já existe uma solicitação de recuperação ativa. Aguarde ${minutosRestantes} minutos ou verifique seu email.`
            });
        }
        
        // Gerar token de reset
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hora
        
        // Salvar token no banco
        await afiliado.update({
            token_reset_senha: resetToken,
            token_reset_expires: resetExpires
        });
        
        // Enviar email com link de reset
        await enviarEmailRecuperacaoSenha(afiliado, resetToken);
        
        console.log('✅ Email de recuperação enviado para:', afiliado.email);
        
        res.json({
            success: true,
            message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha'
        });
    } catch (error) {
        console.error('❌ Erro ao solicitar reset:', error);
        
        // Se falhar ao enviar email, ainda retornar sucesso (por segurança)
        if (error.message && error.message.includes('email')) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao enviar email. Tente novamente mais tarde.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST - Resetar senha
router.post('/reset-password', async (req, res) => {
    try {
        console.log('🔄 Resetando senha...');
        
        const { token, novaSenha, confirmarSenha } = req.body;
        
        if (!token || !novaSenha) {
            return res.status(400).json({
                success: false,
                message: 'Token e nova senha são obrigatórios'
            });
        }

        // Validar confirmação de senha
        if (confirmarSenha && novaSenha !== confirmarSenha) {
            return res.status(400).json({
                success: false,
                message: 'As senhas não coincidem'
            });
        }
        
        // Validar senha forte
        const validacaoSenha = validarSenha(novaSenha);
        if (!validacaoSenha.valida) {
            return res.status(400).json({
                success: false,
                message: validacaoSenha.mensagem
            });
        }
        
        // Buscar afiliado pelo token
        const afiliado = await Afiliado.findOne({
            where: {
                token_reset_senha: token,
                token_reset_expires: {
                    [Op.gt]: new Date()
                }
            }
        });
        
        if (!afiliado) {
            return res.status(400).json({
                success: false,
                message: 'Token inválido ou expirado. Solicite uma nova recuperação de senha.'
            });
        }
        
        // Verificar se a nova senha é diferente da atual
        const mesmaSenha = await bcrypt.compare(novaSenha, afiliado.senha);
        if (mesmaSenha) {
            return res.status(400).json({
                success: false,
                message: 'A nova senha deve ser diferente da senha atual'
            });
        }
        
        // Hash da nova senha
        const senhaHash = await bcrypt.hash(novaSenha, 12);
        
        // Atualizar senha e limpar token
        await afiliado.update({
            senha: senhaHash,
            token_reset_senha: null,
            token_reset_expires: null
        });
        
        console.log('✅ Senha resetada com sucesso:', afiliado.email);
        
        res.json({
            success: true,
            message: 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.'
        });
    } catch (error) {
        console.error('❌ Erro ao resetar senha:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET - Verificar token (para validar se está logado)
router.get('/verify', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token não fornecido'
            });
        }
        
        // Verificar token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.tipo !== 'afiliado') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido para afiliado'
            });
        }
        
        // Buscar afiliado
        const afiliado = await Afiliado.findByPk(decoded.id);
        
        if (!afiliado) {
            return res.status(401).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }

        if (afiliado.status !== 'ativo') {
            return res.status(403).json({
                success: false,
                message: `Sua conta está ${afiliado.status}. Entre em contato com o suporte.`,
                status: afiliado.status
            });
        }
        
        res.json({
            success: true,
            afiliado: {
                id: afiliado.id,
                nome: afiliado.nome,
                email: afiliado.email,
                codigo: afiliado.codigo_afiliado,
                link_afiliado: afiliado.link_afiliado,
                comissao_percentual: afiliado.comissao_percentual,
                total_vendas: afiliado.total_vendas,
                total_comissoes: parseFloat(afiliado.total_comissoes),
                saldo_disponivel: parseFloat(afiliado.saldo_disponivel),
                status: afiliado.status
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado. Faça login novamente.'
            });
        }
        
        console.error('❌ Erro ao verificar token:', error);
        res.status(401).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

module.exports = router;
