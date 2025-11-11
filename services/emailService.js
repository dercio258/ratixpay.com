/**
 * Serviço de Email para RatixPay
 * Envio de emails de notificação e desbloqueio
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
        this.initialize();
    }

    /**
     * Inicializar o serviço de email
     */
    async initialize() {
        try {
            // Configuração do transporter
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false, // true para 465, false para outras portas
                auth: {
                    user: process.env.SMTP_USER || process.env.EMAIL_USER || 'ratixpay.moz@gmail.com',
                    pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verificar conexão
            await this.transporter.verify();
            this.isInitialized = true;
            // Email Service inicializado com sucesso
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Email Service:', error);
            this.isInitialized = false;
        }
    }

    /**
     * Enviar email de desbloqueio de conta
     */
    async enviarEmailDesbloqueio(email, nome, tokenDesbloqueio) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            const linkDesbloqueio = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/desbloquear-conta?token=${tokenDesbloqueio}`;
            
            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: email,
                subject: '🔓 Desbloqueio de Conta - RatixPay',
                html: `
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Desbloqueio de Conta - RatixPay</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                background-color: #f4f4f4;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 30px;
                                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 3px solid #e74c3c;
                            }
                            .logo {
                                font-size: 2rem;
                                font-weight: bold;
                                color: #2c3e50;
                                margin-bottom: 10px;
                            }
                            .title {
                                color: #e74c3c;
                                font-size: 1.5rem;
                                margin-bottom: 20px;
                            }
                            .content {
                                margin-bottom: 30px;
                            }
                            .button {
                                display: inline-block;
                                background: linear-gradient(135deg, #e74c3c, #c0392b);
                                color: white;
                                padding: 15px 30px;
                                text-decoration: none;
                                border-radius: 25px;
                                font-weight: bold;
                                text-align: center;
                                margin: 20px 0;
                                transition: transform 0.3s ease;
                            }
                            .button:hover {
                                transform: translateY(-2px);
                            }
                            .warning {
                                background: #fff3cd;
                                border: 1px solid #ffeaa7;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                                color: #856404;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #eee;
                                color: #666;
                                font-size: 0.9rem;
                            }
                            .contact-info {
                                background: #f8f9fa;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">RATIXPAY</div>
                                <h1 class="title">🔓 Desbloqueio de Conta</h1>
                            </div>
                            
                            <div class="content">
                                <p>Olá <strong>${nome}</strong>,</p>
                                
                                <p>Sua conta foi bloqueada por motivos de segurança após múltiplas tentativas de login incorretas.</p>
                                
                                <p>Para desbloquear sua conta, clique no botão abaixo:</p>
                                
                                <div style="text-align: center;">
                                    <a href="${linkDesbloqueio}" class="button">
                                        🔓 DESBLOQUEAR MINHA CONTA
                                    </a>
                                </div>
                                
                                <div class="warning">
                                    <strong>⚠️ Importante:</strong>
                                    <ul>
                                        <li>Este link é válido por 24 horas</li>
                                        <li>Use apenas uma vez</li>
                                        <li>Não compartilhe este link com ninguém</li>
                                    </ul>
                                </div>
                                
                                <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
                                <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                                    ${linkDesbloqueio}
                                </p>
                            </div>
                            
                            <div class="contact-info">
                                <h3>📞 Precisa de Ajuda?</h3>
                                <p><strong>WhatsApp:</strong> <a href="https://wa.me/2588621277274">+258 86 2127 7274</a></p>
                                <p><strong>Email:</strong> <a href="mailto:ratixpay.moz@gmail.com">ratixpay.moz@gmail.com</a></p>
                            </div>
                            
                            <div class="footer">
                                <p>Este é um email automático do sistema RatixPay.</p>
                                <p>Se você não solicitou este desbloqueio, ignore este email.</p>
                                <p>&copy; 2024 RatixPay. Todos os direitos reservados.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email de desbloqueio enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email de desbloqueio:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de notificação de bloqueio
     */
    async enviarEmailNotificacaoBloqueio(email, nome) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: email,
                subject: '🔒 Conta Bloqueada - RatixPay',
                html: `
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Conta Bloqueada - RatixPay</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                background-color: #f4f4f4;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 30px;
                                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 3px solid #e74c3c;
                            }
                            .logo {
                                font-size: 2rem;
                                font-weight: bold;
                                color: #2c3e50;
                                margin-bottom: 10px;
                            }
                            .title {
                                color: #e74c3c;
                                font-size: 1.5rem;
                                margin-bottom: 20px;
                            }
                            .content {
                                margin-bottom: 30px;
                            }
                            .alert {
                                background: #f8d7da;
                                border: 1px solid #f5c6cb;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                                color: #721c24;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #eee;
                                color: #666;
                                font-size: 0.9rem;
                            }
                            .contact-info {
                                background: #f8f9fa;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">RATIXPAY</div>
                                <h1 class="title">🔒 Conta Bloqueada</h1>
                            </div>
                            
                            <div class="content">
                                <p>Olá <strong>${nome}</strong>,</p>
                                
                                <div class="alert">
                                    <strong>⚠️ ATENÇÃO:</strong> Sua conta foi bloqueada por motivos de segurança após múltiplas tentativas de login incorretas.
                                </div>
                                
                                <p>Um link de desbloqueio será enviado para este email em breve. Verifique sua caixa de entrada e spam.</p>
                                
                                <p><strong>Motivos comuns para bloqueio:</strong></p>
                                <ul>
                                    <li>Múltiplas tentativas de login com senha incorreta</li>
                                    <li>Atividade suspeita detectada</li>
                                    <li>Violation dos termos de uso</li>
                                </ul>
                            </div>
                            
                            <div class="contact-info">
                                <h3>📞 Precisa de Ajuda?</h3>
                                <p><strong>WhatsApp:</strong> <a href="https://wa.me/2588621277274">+258 86 2127 7274</a></p>
                                <p><strong>Email:</strong> <a href="mailto:ratixpay.moz@gmail.com">ratixpay.moz@gmail.com</a></p>
                            </div>
                            
                            <div class="footer">
                                <p>Este é um email automático do sistema RatixPay.</p>
                                <p>&copy; 2024 RatixPay. Todos os direitos reservados.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email de notificação de bloqueio enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email de notificação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de tentativa de acesso com conta bloqueada
     */
    async enviarEmailTentativaAcessoBloqueado(email, nome, tokenDesbloqueio) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            const linkDesbloqueio = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/desbloquear-conta?token=${tokenDesbloqueio}`;
            
            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: email,
                subject: '🔓 Novo Link de Desbloqueio - RatixPay',
                html: `
                    <!DOCTYPE html>
                    <html lang="pt-BR">
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Novo Link de Desbloqueio - RatixPay</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                                background-color: #f4f4f4;
                            }
                            .container {
                                background: white;
                                border-radius: 10px;
                                padding: 30px;
                                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                            }
                            .header {
                                text-align: center;
                                margin-bottom: 30px;
                                padding-bottom: 20px;
                                border-bottom: 3px solid #e74c3c;
                            }
                            .logo {
                                font-size: 2rem;
                                font-weight: bold;
                                color: #2c3e50;
                                margin-bottom: 10px;
                            }
                            .title {
                                color: #e74c3c;
                                font-size: 1.5rem;
                                margin-bottom: 20px;
                            }
                            .content {
                                margin-bottom: 30px;
                            }
                            .button {
                                display: inline-block;
                                background: linear-gradient(135deg, #e74c3c, #c0392b);
                                color: white;
                                padding: 15px 30px;
                                text-decoration: none;
                                border-radius: 25px;
                                font-weight: bold;
                                text-align: center;
                                margin: 20px 0;
                                transition: transform 0.3s ease;
                            }
                            .button:hover {
                                transform: translateY(-2px);
                            }
                            .warning {
                                background: #fff3cd;
                                border: 1px solid #ffeaa7;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                                color: #856404;
                            }
                            .info {
                                background: #d1ecf1;
                                border: 1px solid #bee5eb;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                                color: #0c5460;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #eee;
                                color: #666;
                                font-size: 0.9rem;
                            }
                            .contact-info {
                                background: #f8f9fa;
                                border-radius: 5px;
                                padding: 15px;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">RATIXPAY</div>
                                <h1 class="title">🔓 Novo Link de Desbloqueio</h1>
                            </div>
                            
                            <div class="content">
                                <p>Olá <strong>${nome}</strong>,</p>
                                
                                <div class="info">
                                    <strong>ℹ️ Informação:</strong> Detectamos uma tentativa de acesso à sua conta que está bloqueada por motivos de segurança.
                                </div>
                                
                                <p>Para sua segurança, enviamos um novo link de desbloqueio. Clique no botão abaixo para desbloquear sua conta:</p>
                                
                                <div style="text-align: center;">
                                    <a href="${linkDesbloqueio}" class="button">
                                        🔓 DESBLOQUEAR MINHA CONTA
                                    </a>
                                </div>
                                
                                <div class="warning">
                                    <strong>⚠️ Importante:</strong>
                                    <ul>
                                        <li>Este link é válido por 24 horas</li>
                                        <li>Use apenas uma vez</li>
                                        <li>Não compartilhe este link com ninguém</li>
                                        <li>Se não solicitou este desbloqueio, ignore este email</li>
                                    </ul>
                                </div>
                                
                                <p>Se o botão não funcionar, copie e cole o link abaixo no seu navegador:</p>
                                <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
                                    ${linkDesbloqueio}
                                </p>
                            </div>
                            
                            <div class="contact-info">
                                <h3>📞 Precisa de Ajuda?</h3>
                                <p><strong>WhatsApp:</strong> <a href="https://wa.me/2588621277274">+258 86 2127 7274</a></p>
                                <p><strong>Email:</strong> <a href="mailto:ratixpay.moz@gmail.com">ratixpay.moz@gmail.com</a></p>
                            </div>
                            
                            <div class="footer">
                                <p>Este é um email automático do sistema RatixPay.</p>
                                <p>Se você não tentou acessar sua conta, ignore este email.</p>
                                <p>&copy; 2024 RatixPay. Todos os direitos reservados.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email de tentativa de acesso bloqueado enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email de tentativa de acesso:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de código de desbloqueio
     */
    async enviarEmailCodigoDesbloqueio(email, nome, codigoDesbloqueio) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            // Carregar template HTML
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-codigo-verificacao.html');
            
            let htmlTemplate = '';
            if (fs.existsSync(templatePath)) {
                htmlTemplate = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Template fallback se o arquivo não existir
                htmlTemplate = this.getFallbackEmailTemplate();
            }

            // Substituir variáveis no template
            const htmlContent = htmlTemplate
                .replace(/{{NOME_USUARIO}}/g, nome)
                .replace(/{{MOTIVO_EMAIL}}/g, 'desbloqueio de conta')
                .replace(/{{CODIGO_VERIFICACAO}}/g, codigoDesbloqueio)
                .replace(/{{TEMPO_EXPIRACAO}}/g, '15');

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: email,
                subject: '🔓 Código de Desbloqueio - RatixPay',
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email de código de desbloqueio enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email de código de desbloqueio:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Template fallback para email de código
     */
    getFallbackEmailTemplate() {
        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Código de Verificação - RatixPay</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
                    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .header { background-color: #000000; padding: 30px 20px; text-align: center; }
                    .logo { max-width: 200px; height: auto; display: block; margin: 0 auto; }
                    .content { padding: 40px 30px; background-color: #ffffff; }
                    .greeting { font-size: 18px; color: #333; margin-bottom: 20px; font-weight: 600; }
                    .message { font-size: 16px; color: #555; margin-bottom: 30px; line-height: 1.6; }
                    .code-container { background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0; }
                    .verification-code { font-size: 32px; font-weight: bold; color: #000; letter-spacing: 8px; margin: 15px 0; font-family: 'Courier New', monospace; background-color: #ffffff; padding: 15px 20px; border-radius: 6px; border: 1px solid #dee2e6; display: inline-block; min-width: 200px; }
                    .expiry-warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; color: #856404; font-size: 14px; }
                    .footer { background-color: #ffffff; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
                    .footer-message { font-size: 16px; color: #333; margin-bottom: 15px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="/assets/images/external/ratixpay-logo.png" alt="RatixPay Logo" class="logo">
                    </div>
                    <div class="content">
                        <div class="greeting">Olá, {{NOME_USUARIO}}!</div>
                        <div class="message">Recebemos uma solicitação para {{MOTIVO_EMAIL}} em sua conta RatixPay. Para sua segurança, enviamos este código de verificação.</div>
                        <div class="code-container">
                            <div class="verification-code">{{CODIGO_VERIFICACAO}}</div>
                        </div>
                        <div class="expiry-warning"><strong>⏰ Importante:</strong> Este código expira em <strong>{{TEMPO_EXPIRACAO}} minutos</strong> e só pode ser usado uma vez.</div>
                    </div>
                    <div class="footer">
                        <div class="footer-message">Abraços, Equipe RatixPay</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Enviar código de autenticação usando template profissional
     */
    async enviarCodigoAutenticacao(email, codigo, motivo, vendedor) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            // Carregar template HTML profissional simples
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/email-codigo-verificacao-simples.html');
            
            let htmlTemplate = '';
            if (fs.existsSync(templatePath)) {
                htmlTemplate = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Template fallback se o arquivo não existir
                htmlTemplate = this.getFallbackEmailTemplate();
            }

            // Substituir variáveis no template
            const htmlContent = htmlTemplate
                .replace(/{{NOME_USUARIO}}/g, vendedor?.nome_completo || 'Usuário')
                .replace(/{{MOTIVO_EMAIL}}/g, motivo || 'autenticação')
                .replace(/{{CODIGO_VERIFICACAO}}/g, codigo)
                .replace(/{{TEMPO_EXPIRACAO}}/g, '15');

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: email,
                subject: '🔐 Código de Autenticação - RatixPay',
                html: htmlContent
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email de código de autenticação enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email de código de autenticação:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email genérico
     */
    async enviarEmail(destinatario, assunto, conteudo, isHtml = true) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.moz@gmail.com'}>`,
                to: destinatario,
                subject: assunto,
                [isHtml ? 'html' : 'text']: conteudo
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('✅ Email enviado:', result.messageId);
            return { success: true, messageId: result.messageId };

        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
