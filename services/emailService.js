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
     * Usa Gmail como padrão com senha de app
     */
    async initialize() {
        try {
            // Configuração do transporter usando Gmail com senha de app
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false, // true para 465, false para outras portas
                auth: {
                    user: process.env.SMTP_USER || process.env.EMAIL_USER || 'ratixpay.mz@gmail.com',
                    pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || 'jxlm jybx kofp gmhr'
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verificar conexão
            await this.transporter.verify();
            this.isInitialized = true;
            console.log('✅ Email Service inicializado com Gmail (ratixpay.mz@gmail.com)');

        } catch (error) {
            console.error('❌ Erro ao inicializar Email Service:', error);
            this.isInitialized = false;
        }
    }

    const fs = require('fs');
    const path = require('path');

    // ... (rest of imports)

    /**
     * Carregar template do arquivo
     */
    loadTemplate(templateName) {
        try {
            const templatePath = path.join(__dirname, '../templates/emails', templateName);
            return fs.readFileSync(templatePath, 'utf8');
        } catch (error) {
            console.error(`Erro ao carregar template ${templateName}:`, error);
            return null;
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

            let htmlContent = this.loadTemplate('desbloqueio-conta.html');
            if (!htmlContent) {
                throw new Error('Template de email não encontrado: desbloqueio-conta.html');
            }

            htmlContent = htmlContent
                .replace(/{{nome}}/g, nome)
                .replace(/{{linkDesbloqueio}}/g, linkDesbloqueio);

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
                to: email,
                subject: '🔓 Desbloqueio de Conta - RatixPay',
                html: htmlContent
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

            let htmlContent = this.loadTemplate('notificacao-bloqueio.html');
            if (!htmlContent) {
                throw new Error('Template de email não encontrado: notificacao-bloqueio.html');
            }

            htmlContent = htmlContent.replace(/{{nome}}/g, nome);

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
                to: email,
                subject: '🔒 Conta Bloqueada - RatixPay',
                html: htmlContent
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

            let htmlContent = this.loadTemplate('tentativa-acesso-bloqueado.html');
            if (!htmlContent) {
                throw new Error('Template de email não encontrado: tentativa-acesso-bloqueado.html');
            }

            htmlContent = htmlContent
                .replace(/{{nome}}/g, nome)
                .replace(/{{linkDesbloqueio}}/g, linkDesbloqueio);

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
                to: email,
                subject: '🔓 Novo Link de Desbloqueio - RatixPay',
                html: htmlContent
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

            let htmlTemplate = this.loadTemplate('codigo-verificacao.html');
            if (!htmlTemplate) {
                // Tentar carregar o antigo se o novo não existir (compatibilidade)
                try {
                    const oldPath = path.join(__dirname, '../templates/email-codigo-verificacao.html');
                    if (fs.existsSync(oldPath)) {
                        htmlTemplate = fs.readFileSync(oldPath, 'utf8');
                    }
                } catch (e) { }
            }

            if (!htmlTemplate) {
                throw new Error('Template de email não encontrado');
            }

            // Substituir variáveis no template
            const htmlContent = htmlTemplate
                .replace(/{{NOME_USUARIO}}/g, nome)
                .replace(/{{MOTIVO_EMAIL}}/g, 'desbloqueio de conta')
                .replace(/{{CODIGO_VERIFICACAO}}/g, codigoDesbloqueio)
                .replace(/{{TEMPO_EXPIRACAO}}/g, '15');

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
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
     * Enviar código de autenticação usando template profissional
     */
    async enviarCodigoAutenticacao(email, codigo, motivo, vendedor) {
        try {
            if (!this.isInitialized) {
                throw new Error('Email Service não inicializado');
            }

            // Tentar carregar template simples ou padrão
            let htmlTemplate = this.loadTemplate('codigo-verificacao.html');

            // Tentar carregar o antigo se existir
            try {
                const oldPath = path.join(__dirname, '../templates/email-codigo-verificacao-simples.html');
                if (fs.existsSync(oldPath)) {
                    htmlTemplate = fs.readFileSync(oldPath, 'utf8');
                }
            } catch (e) { }

            if (!htmlTemplate) {
                throw new Error('Template de email não encontrado');
            }

            // Substituir variáveis no template
            const htmlContent = htmlTemplate
                .replace(/{{NOME_USUARIO}}/g, vendedor?.nome_completo || 'Usuário')
                .replace(/{{MOTIVO_EMAIL}}/g, motivo || 'autenticação')
                .replace(/{{CODIGO_VERIFICACAO}}/g, codigo)
                .replace(/{{TEMPO_EXPIRACAO}}/g, '15');

            const mailOptions = {
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
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
                from: `"RatixPay" <${process.env.SMTP_USER || 'ratixpay.mz@gmail.com'}>`,
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
}

module.exports = new EmailService();
