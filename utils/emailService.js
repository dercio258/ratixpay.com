const nodemailer = require('nodemailer');
const adminConfig = require('../config/admin-config');
require('dotenv').config();

class EmailService {
    static getTransporter() {
        if (!EmailService.transporter) {
            // Usar Gmail com senha de app fornecida
            const gmailUser = 'ratixpay.mz@gmail.com';
            const gmailPass = 'jxlm jybx kofp gmhr';
            
            EmailService.transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: gmailUser,
                    pass: gmailPass
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            
            console.log('✅ Email Service (utils) configurado com Gmail (ratixpay.mz@gmail.com)');
        }
        return EmailService.transporter;
    }

    // Enviar email com link do conteúdo após pagamento bem-sucedido
    static async enviarLinkConteudo(venda, produto) {
        try {
            if (!EmailService.isConfigurado()) {
                console.log('⚠️ Email não configurado para envio de link de conteúdo');
                return false;
            }

            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: venda.clienteEmail,
                subject: `🎉 Pagamento Aprovado - Seu conteúdo está pronto!`,
                html: EmailService.gerarTemplateEmail(venda, produto)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Email enviado com sucesso:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar email:', error);
            throw error;
        }
    }

    // Método genérico para enviar email com tratamento de erros e retry
    static async enviarEmail(to, subject, html, isHtml = true, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (!EmailService.isConfigurado()) {
                    console.log('⚠️ Email não configurado para envio genérico');
                    return false;
                }

                const mailOptions = {
                    from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                    to: to,
                    subject: subject,
                    html: isHtml ? html : undefined,
                    text: isHtml ? undefined : html
                };

                const result = await EmailService.getTransporter().sendMail(mailOptions);
                console.log(`✅ Email enviado com sucesso (tentativa ${attempt}):`, result.messageId);
                return result;
            } catch (error) {
                lastError = error;
                console.error(`❌ Erro ao enviar email genérico (tentativa ${attempt}/${maxRetries}):`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        console.error(`❌ Falha ao enviar email após ${maxRetries} tentativas`);
        throw lastError;
    }

    // Gerar template HTML do email para o cliente
    static gerarTemplateEmail(venda, produto, produtosComplementares = []) {
        const dataFormatada = new Date().toLocaleDateString('pt-MZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Calcular preço com desconto se aplicável
        const precoComDesconto = produto && produto.preco_com_desconto ? produto.preco_com_desconto : venda.pagamentoValor;
        const valorFormatado = precoComDesconto.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });

        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Produto Disponível - RatixPay</title>
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
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 10px;
                }
                .title {
                    color: #2c3e50;
                    font-size: 24px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .content-link {
                    background-color: #3498db;
                    color: white;
                    padding: 18px 35px;
                    text-decoration: none;
                    border-radius: 8px;
                    display: inline-block;
                    margin: 20px 0;
                    font-weight: bold;
                    text-align: center;
                    transition: background-color 0.3s;
                    font-size: 16px;
                }
                .content-link:hover {
                    background-color: #2980b9;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e9ecef;
                    color: #6c757d;
                    font-size: 14px;
                }
                .warning {
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 5px;
                    padding: 15px;
                    margin: 20px 0;
                    color: #856404;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">RatixPay</div>
                    <h1 class="title">🎉 Produto Disponível!</h1>
                </div>

                <p>Olá, <strong>${venda.clienteNome}</strong>!</p>
                
                <p>Parabéns pela sua compra do produto <strong>'${produto ? produto.nome : 'Produto Digital'}'</strong>, no valor original de <strong>'${valorFormatado}'</strong>.</p>
                
                <p>Aqui está o link de acesso ao seu produto:</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${produto ? (produto.link_conteudo || produto.linkConteudo || '#') : '#'}" class="content-link" style="background: linear-gradient(135deg, #3498db, #2980b9); box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3); border: none; padding: 20px 40px; font-size: 18px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; transition: all 0.3s ease; color: white;">
                        📥 BAIXAR CONTEÚDO
                    </a>
                    <p style="margin-top: 15px; color: #6c757d; font-size: 14px; font-weight: 500;">
                        Clique no botão acima para acessar seu produto
                    </p>
                    <p style="margin-top: 10px; color: #95a5a6; font-size: 12px;">
                        Ou copie e cole este link: ${produto ? (produto.link_conteudo || produto.linkConteudo || 'Link não disponível') : 'Link não disponível'}
                    </p>
                </div>

                ${produtosComplementares && produtosComplementares.length > 0 ? `
                <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <h3 style="color: #333; margin-top: 0; font-size: 18px;">🎁 BÔNUS INCLUÍDOS:</h3>
                    ${produtosComplementares.map((produtoComp, index) => {
                        const valorCompFormatado = produtoComp.preco.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' });
                        return `
                        <div style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border: 1px solid #e9ecef;">
                            <h4 style="color: #333; margin: 0 0 10px 0; font-size: 16px;">${index + 1}. ${produtoComp.nome} - ${valorCompFormatado}</h4>
                            ${produtoComp.link_conteudo && produtoComp.link_conteudo.trim() !== '' ? `
                                <div style="text-align: center; margin: 15px 0;">
                                    <a href="${produtoComp.link_conteudo}" class="content-link" style="background: linear-gradient(135deg, #ffc107, #ff8c00); box-shadow: 0 4px 15px rgba(255, 193, 7, 0.3); border: none; padding: 15px 30px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 12px; display: inline-block; transition: all 0.3s ease; color: white;">
                                        📥 BAIXAR BÔNUS
                                    </a>
                                    <p style="margin-top: 10px; color: #6c757d; font-size: 12px;">
                                        Ou copie e cole este link: ${produtoComp.link_conteudo}
                                    </p>
                                </div>
                            ` : `
                                <p style="margin: 5px 0; color: #dc3545; font-size: 14px;">
                                    ⚠️ <strong>Link não disponível</strong> - entre em contato com o vendedor
                                </p>
                            `}
                        </div>
                        `;
                    }).join('')}
                    <p style="margin: 15px 0 0 0; color: #666; font-size: 14px; font-weight: bold;">
                        💡 <strong>Total de produtos:</strong> ${1 + produtosComplementares.length} (1 principal + ${produtosComplementares.length} bônus)
                    </p>
                </div>
                ` : ''}

                <div class="warning">
                    <strong>⚠️ Importante:</strong> Guarde este email em local seguro. O link do conteúdo é válido por tempo indeterminado.
                </div>

                <p>Se você tiver alguma dúvida ou precisar de suporte, entre em contato conosco através do email de suporte.</p>

                <div class="footer">
                    <p>Obrigado por escolher RatixPay!</p>
                    <p>Este é um email automático, não responda a esta mensagem.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Enviar email de notificação para administrador
    static async enviarNotificacaoAdmin(venda, produto) {
        try {
            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: adminConfig.admin.email,
                subject: `💰 Nova Venda Aprovada - Pedido #${venda.numero_pedido || (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6 ? venda.pagamento_transacao_id : null) || (venda.pagamento_referencia && venda.pagamento_referencia.length === 6 ? venda.pagamento_referencia : null) || venda.id}`,
                html: EmailService.gerarTemplateNotificacaoAdmin(venda, produto)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Notificação admin enviada:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação admin:', error);
            throw error;
        }
    }

    // Enviar email de notificação para o vendedor
    static async enviarNotificacaoVendedor(venda, produto, vendedor) {
        try {
            if (!vendedor || !vendedor.email) {
                console.log('⚠️ Vendedor sem email - notificação não enviada');
                return null;
            }

            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: vendedor.email,
                subject: `🎉 Nova Venda Realizada - Pedido #${venda.numero_pedido || (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6 ? venda.pagamento_transacao_id : null) || (venda.pagamento_referencia && venda.pagamento_referencia.length === 6 ? venda.pagamento_referencia : null) || venda.id}`,
                html: EmailService.gerarTemplateNotificacaoVendedor(venda, produto, vendedor)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Notificação vendedor enviada:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação vendedor:', error);
            throw error;
        }
    }

    // Gerar template para notificação do administrador
    static gerarTemplateNotificacaoAdmin(venda, produto) {
        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nova Venda Aprovada</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f8f9fa; }
                .info-row { margin: 10px 0; }
                .label { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💰 Nova Venda Aprovada</h1>
                </div>
                <div class="content">
                    <div class="info-row">
                        <span class="label">ID da Transação:</span> ${venda.pagamentoTransacaoId}
                    </div>
                    <div class="info-row">
                        <span class="label">Cliente:</span> ${venda.clienteNome} (${venda.clienteEmail})
                    </div>
                    <div class="info-row">
                        <span class="label">Produto:</span> ${produto ? produto.nome : 'Produto Digital'}
                    </div>
                    <div class="info-row">
                        <span class="label">Valor:</span> ${venda.pagamentoValor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}
                    </div>
                    <div class="info-row">
                        <span class="label">Método:</span> ${venda.pagamentoMetodo}
                    </div>
                    <div class="info-row">
                        <span class="label">Data:</span> ${new Date().toLocaleString('pt-MZ')}
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Gerar template para notificação do vendedor
    static gerarTemplateNotificacaoVendedor(venda, produto, vendedor) {
        const dataFormatada = new Date().toLocaleDateString('pt-MZ', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nova Venda Realizada</title>
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
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 10px;
                }
                .title {
                    color: #2c3e50;
                    font-size: 24px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .info-section {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 5px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                .info-row:last-child {
                    border-bottom: none;
                }
                .label {
                    font-weight: bold;
                    color: #495057;
                }
                .value {
                    color: #6c757d;
                }
                .dashboard-link {
                    background-color: #27ae60;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 8px;
                    display: inline-block;
                    margin: 20px 0;
                    font-weight: bold;
                    text-align: center;
                    transition: background-color 0.3s;
                }
                .dashboard-link:hover {
                    background-color: #229954;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e9ecef;
                    color: #6c757d;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">RatixPay</div>
                    <h1 class="title">🎉 Nova Venda Realizada!</h1>
                </div>

                <p>Olá, <strong>${vendedor.nome_completo}</strong>!</p>
                
                <p>Registamos uma nova venda! Acesse a página para ver os detalhes.</p>

                <div class="info-section">
                    <div class="info-row">
                        <span class="label">Produto:</span>
                        <span class="value">${produto ? produto.nome : 'Produto Digital'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Cliente:</span>
                        <span class="value">${venda.clienteNome}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Email do Cliente:</span>
                        <span class="value">${venda.clienteEmail}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Telefone:</span>
                        <span class="value">${venda.clienteTelefone || 'Não informado'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Valor da Venda:</span>
                        <span class="value">${venda.pagamentoValor.toLocaleString('pt-MZ', { style: 'currency', currency: 'MZN' })}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Método de Pagamento:</span>
                        <span class="value">${venda.pagamentoMetodo}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ID da Transação:</span>
                        <span class="value">${venda.pagamentoTransacaoId}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Data da Venda:</span>
                        <span class="value">${dataFormatada}</span>
                    </div>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="dashboard-link">
                        📊 Acessar Dashboard
                    </a>
                    <p style="margin-top: 10px; color: #6c757d; font-size: 14px;">
                        Clique no botão acima para acessar seu painel de vendas
                    </p>
                </div>

                <div class="footer">
                    <p>Obrigado por usar RatixPay!</p>
                    <p>Este é um email automático, não responda a esta mensagem.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Enviar código de verificação
    static async enviarCodigoVerificacao(email, codigo, tipo = 'verification') {
        try {
            const subject = tipo === 'password_reset' 
                ? '🔐 Código de Redefinição de Senha - RatixPay'
                : '✅ Código de Verificação - RatixPay';

            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: email,
                subject: subject,
                html: EmailService.gerarTemplateCodigoVerificacao(codigo, tipo)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Código de verificação enviado:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar código de verificação:', error);
            throw error;
        }
    }

    // Gerar template para código de verificação
    static gerarTemplateCodigoVerificacao(codigo, tipo) {
        let titulo, mensagem;
        
        switch (tipo) {
            case 'password_reset':
                titulo = 'Redefinição de Senha';
                mensagem = 'Você solicitou a redefinição da sua senha. Use o código abaixo para continuar:';
                break;
            case 'admin_verification':
                titulo = 'Verificação do Administrador';
                mensagem = '🔐 Código de verificação para acesso ao painel administrativo do RatixPay:';
                break;
            default:
                titulo = 'Verificação de Conta';
                mensagem = 'Para ativar sua conta, use o código de verificação abaixo:';
        }

        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titulo} - RatixPay</title>
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
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 28px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin-bottom: 10px;
                }
                .title {
                    color: #2c3e50;
                    font-size: 24px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .code-container {
                    background-color: #f8f9fa;
                    border: 2px dashed #3498db;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: center;
                }
                .verification-code {
                    font-size: 32px;
                    font-weight: bold;
                    color: #3498db;
                    letter-spacing: 4px;
                    font-family: 'Courier New', monospace;
                }
                .warning {
                    background-color: #fff3cd;
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
                    border-top: 1px solid #e9ecef;
                    color: #6c757d;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">RatixPay</div>
                    <h1 class="title">${titulo}</h1>
                </div>

                <p>${mensagem}</p>

                <div class="code-container">
                    <div class="verification-code">${codigo}</div>
                </div>

                <div class="warning">
                    <strong>⚠️ Importante:</strong> 
                    <ul>
                        <li>Este código é válido por 15 minutos</li>
                        <li>Não compartilhe este código com ninguém</li>
                        <li>Se você não solicitou este código, ignore este email</li>
                    </ul>
                </div>

                <div class="footer">
                    <p>Obrigado por escolher RatixPay!</p>
                    <p>Este é um email automático, não responda a esta mensagem.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Enviar conteúdo por e-mail (solicitação manual)
    static async enviarConteudoPorEmail(emailData) {
        try {
            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: emailData.to,
                subject: emailData.subject,
                html: EmailService.gerarTemplateConteudoPorEmail(emailData)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Conteúdo enviado por e-mail com sucesso:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar conteúdo por e-mail:', error);
            throw error;
        }
    }

    // Gerar template HTML para envio de conteúdo por e-mail
    static gerarTemplateConteudoPorEmail(emailData) {
        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Seu conteúdo está pronto! - RatixPay</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }
                .container {
                    background-color: #ffffff;
                    border-radius: 15px;
                    padding: 40px;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 32px;
                    font-weight: bold;
                    color: #667eea;
                    margin-bottom: 15px;
                }
                .title {
                    color: #2c3e50;
                    font-size: 28px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                .content-link {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px 40px;
                    text-decoration: none;
                    border-radius: 12px;
                    display: inline-block;
                    margin: 25px 0;
                    font-weight: bold;
                    text-align: center;
                    transition: transform 0.2s;
                    font-size: 18px;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
                }
                .content-link:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                }
                .order-info {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    padding: 25px;
                    margin: 25px 0;
                    border-left: 4px solid #667eea;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 25px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    color: #6c757d;
                    font-size: 14px;
                }
                .product-name {
                    font-size: 20px;
                    font-weight: bold;
                    color: #2c3e50;
                    margin: 15px 0;
                }
                .order-number {
                    background: #667eea;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎉 RatixPay</div>
                    <h1 class="title">Seu conteúdo está pronto!</h1>
                </div>

                <p>Olá <strong>${emailData.clientName}</strong>! 👋</p>
                
                <p>Obrigado por escolher a RatixPay! Seu conteúdo está pronto para download.</p>
                
                <div class="order-info">
                    <div class="product-name">${emailData.productName}</div>
                    <div class="order-number">Pedido #${emailData.orderNumber}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${emailData.contentLink}" class="content-link">
                        📥 Baixar Conteúdo
                    </a>
                </div>

                <p style="text-align: center; color: #6c757d; font-size: 14px; margin-top: 20px;">
                    💡 Se o botão não funcionar, copie este link: <br>
                    <span style="word-break: break-all; background-color: #f8f9fa; padding: 8px; border-radius: 5px; font-family: monospace; font-size: 12px;">
                        ${emailData.contentLink}
                    </span>
                </p>

                <div class="footer">
                    <p>🎉 Obrigado por escolher RatixPay!</p>
                    <p>Precisa de ajuda? Entre em contato conosco.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Enviar reclamação de suporte por e-mail
    static async enviarReclamacaoSuporte(emailData) {
        try {
            console.log('📧 Enviando reclamação de suporte por e-mail...');
            
            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: emailData.to,
                subject: emailData.subject,
                html: EmailService.gerarTemplateReclamacaoSuporte(emailData)
            };
            
            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Reclamação enviada com sucesso:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar reclamação:', error);
            throw error;
        }
    }
    
    // Gerar template HTML para reclamação de suporte
    static gerarTemplateReclamacaoSuporte(emailData) {
        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reclamação de Suporte - RatixPay</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f8f9fa;
                }
                .container {
                    background-color: #ffffff;
                    border-radius: 15px;
                    padding: 40px;
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 32px;
                    font-weight: bold;
                    color: #dc3545;
                    margin-bottom: 15px;
                }
                .title {
                    color: #dc3545;
                    font-size: 28px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                .alert-box {
                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 20px 0;
                    text-align: center;
                }
                .info-box {
                    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                    border-radius: 12px;
                    padding: 25px;
                    margin: 25px 0;
                    border-left: 4px solid #dc3545;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 25px;
                    border-top: 1px solid #dee2e6;
                    text-align: center;
                    color: #6c757d;
                    font-size: 14px;
                }
                .problem-type {
                    background: #dc3545;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    display: inline-block;
                    margin: 10px 0;
                }
                .description {
                    background: #f8f9fa;
                    padding: 15px;
                    border-radius: 8px;
                    border-left: 4px solid #dc3545;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🚨 RatixPay</div>
                    <h1 class="title">Reclamação de Suporte</h1>
                </div>

                <div class="alert-box">
                    <strong>Nova reclamação recebida!</strong><br>
                    Ação requerida imediata.
                </div>
                
                <div class="info-box">
                    <h3>📋 Informações do Cliente</h3>
                    <p><strong>Nome:</strong> ${emailData.clienteNome}</p>
                    <p><strong>Pedido:</strong> #${emailData.numeroPedido}</p>
                    <p><strong>Data/Hora:</strong> ${emailData.dataHora}</p>
                </div>
                
                <div class="info-box">
                    <h3>🚨 Tipo de Problema</h3>
                    <div class="problem-type">${EmailService.getProblemText(emailData.problema)}</div>
                </div>
                
                <div class="info-box">
                    <h3>📝 Descrição Detalhada</h3>
                    <div class="description">
                        ${emailData.descricao}
                    </div>
                </div>

                <div class="footer">
                    <p>⚠️ Esta é uma reclamação urgente que requer atenção imediata.</p>
                    <p>Entre em contato com o cliente o mais rápido possível.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
    
    // Obter texto do problema
    static getProblemText(problema) {
        const problemas = {
            'link_quebrado': '🔗 Link do produto quebrado',
            'produto_errado': '📦 Produto não corresponde à descrição',
            'fraude': '🚨 Fraude',
            'reembolso': '💰 Reembolso',
            'outro': '❓ Outro problema',
            'mais_info': '➕ Mais informações'
        };
        return problemas[problema] || problema;
    }
    
    // Verificar se o serviço de email está configurado
    static isConfigurado() {
        return EmailService.getTransporter() !== null;
    }

    // Enviar email com template personalizado
    static async enviarEmailTemplate(emailData) {
        try {
            if (!EmailService.isConfigurado()) {
                console.log('⚠️ Email não configurado para envio de template');
                return false;
            }

            const transporter = EmailService.getTransporter();
            if (!transporter) {
                throw new Error('Transporter de email não configurado');
            }

            const mailOptions = {
                from: `"${adminConfig.email.fromName}" <${adminConfig.email.from}>`,
                to: emailData.to,
                subject: emailData.subject,
                html: EmailService.gerarTemplateGenerico(emailData.data)
            };

            const result = await transporter.sendMail(mailOptions);
            console.log('✅ Email template enviado com sucesso:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar email template:', error);
            throw error;
        }
    }

    // Gerar template genérico para emails
    static gerarTemplateGenerico(data) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${data.titulo || 'Notificação RatixPay'}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f64c00 0%, #ff6b35 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🐭 RatixPay</h1>
                    <h2>${data.titulo || 'Notificação'}</h2>
                </div>
                <div class="content">
                    <p>${data.mensagem || 'Esta é uma notificação do sistema RatixPay.'}</p>
                    ${data.data ? `<p><strong>Data:</strong> ${data.data}</p>` : ''}
                </div>
                <div class="footer">
                    <p>© 2024 RatixPay - Sistema de Pagamentos</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Métodos estáticos para notificações de saque
    static async enviarNotificacaoSaqueAdmin(saque, vendedor) {
        try {
            if (!EmailService.isConfigurado()) {
                console.log('⚠️ Email não configurado para notificação de saque admin');
                return false;
            }

            const mailOptions = {
                from: `"${adminConfig.email.fromName} - Sistema de Saques" <${adminConfig.email.from}>`,
                to: adminConfig.admin.email,
                subject: `💰 Nova Solicitação de Saque - ${vendedor.nome_completo}`,
                html: EmailService.gerarTemplateNotificacaoSaqueAdmin(saque, vendedor)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Notificação de saque admin enviada por email:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque admin por email:', error);
            return false;
        }
    }

    static async enviarNotificacaoSaqueVendedor(saque, vendedor, tipoNotificacao) {
        try {
            if (!EmailService.isConfigurado()) {
                console.log('⚠️ Email não configurado para notificação de saque vendedor');
                return false;
            }

            if (!vendedor.email) {
                console.log('⚠️ Vendedor sem email para notificação');
                return false;
            }

            const mailOptions = {
                from: `"RatixPay - Sistema de Saques" <${process.env.GMAIL_SENDER || process.env.EMAIL_USER}>`,
                to: vendedor.email,
                subject: EmailService.getSubjectSaqueVendedor(tipoNotificacao),
                html: EmailService.gerarTemplateNotificacaoSaqueVendedor(saque, vendedor, tipoNotificacao)
            };

            const result = await EmailService.getTransporter().sendMail(mailOptions);
            console.log('✅ Notificação de saque vendedor enviada por email:', result.messageId);
            return result;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque vendedor por email:', error);
            return false;
        }
    }

    static getSubjectSaqueVendedor(tipoNotificacao) {
        switch (tipoNotificacao) {
            case 'solicitacao':
                return '📋 Solicitação de Saque Recebida - RatixPay';
            case 'aprovar':
                return '✅ Saque Aprovado - RatixPay';
            case 'rejeitar':
                return '❌ Saque Rejeitado - RatixPay';
            default:
                return '📋 Atualização de Saque - RatixPay';
        }
    }

    static gerarTemplateNotificacaoSaqueAdmin(saque, vendedor) {
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(saque.valor_solicitado);

        const dataFormatada = new Date(saque.data_solicitacao).toLocaleString('pt-MZ');

        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Nova Solicitação de Saque - RatixPay</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
                .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 5px; }
                .label { font-weight: bold; color: #2c3e50; }
                .value { color: #495057; }
                .action-btn { display: inline-block; padding: 12px 24px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
                .action-btn:hover { background: #2980b9; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>💰 Nova Solicitação de Saque</h1>
                    <p>RatixPay - Sistema de Gestão</p>
                </div>
                <div class="content">
                    <h2>Detalhes da Solicitação</h2>
                    
                    <div class="info-row">
                        <span class="label">Vendedor:</span>
                        <span class="value">${vendedor.nome_completo}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">ID do Vendedor:</span>
                        <span class="value">${vendedor.id}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Email:</span>
                        <span class="value">${vendedor.email}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Valor Solicitado:</span>
                        <span class="value">${valorFormatado}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Data da Solicitação:</span>
                        <span class="value">${dataFormatada}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Status:</span>
                        <span class="value">⏳ Pendente de Aprovação</span>
                    </div>
                    
                    <p><strong>Acesse o painel administrativo para processar esta solicitação.</strong></p>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.ADMIN_PANEL_URL || 'https://ratixpay.onrender.com/admin'}" class="action-btn">
                            🎛️ Painel Admin
                        </a>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    static gerarTemplateNotificacaoSaqueVendedor(saque, vendedor, tipoNotificacao) {
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(saque.valor_solicitado);

        const dataFormatada = new Date(saque.data_solicitacao).toLocaleString('pt-MZ');

        let titulo, mensagem, status;

        switch (tipoNotificacao) {
            case 'solicitacao':
                titulo = '📋 Solicitação de Saque Recebida';
                mensagem = 'Sua solicitação de saque foi recebida e está sendo analisada.';
                status = '⏳ Pendente de Aprovação';
                break;
            case 'aprovar':
                titulo = '✅ Saque Aprovado!';
                mensagem = 'Parabéns! Sua solicitação de saque foi aprovada.';
                status = '✅ Aprovado';
                break;
            case 'rejeitar':
                titulo = '❌ Saque Rejeitado';
                mensagem = 'Sua solicitação de saque foi rejeitada. Entre em contato para mais informações.';
                status = '❌ Rejeitado';
                break;
            default:
                titulo = '📋 Atualização de Saque';
                mensagem = 'Houve uma atualização em sua solicitação de saque.';
                status = '📋 Atualizado';
        }

        return `
        <!DOCTYPE html>
        <html lang="pt-MZ">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${titulo} - RatixPay</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 10px 10px; }
                .info-row { margin: 15px 0; padding: 10px; background: white; border-radius: 5px; }
                .label { font-weight: bold; color: #2c3e50; }
                .value { color: #495057; }
                .status { font-size: 18px; font-weight: bold; text-align: center; padding: 15px; border-radius: 5px; }
                .status.pendente { background: #fff3cd; color: #856404; }
                .status.aprovado { background: #d4edda; color: #155724; }
                .status.rejeitado { background: #f8d7da; color: #721c24; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${titulo}</h1>
                    <p>RatixPay - Sistema de Gestão</p>
                </div>
                <div class="content">
                    <p>Olá <strong>${vendedor.nome_completo}</strong>!</p>
                    
                    <p>${mensagem}</p>
                    
                    <div class="info-row">
                        <span class="label">Valor Solicitado:</span>
                        <span class="value">${valorFormatado}</span>
                    </div>
                    
                    <div class="info-row">
                        <span class="label">Data da Solicitação:</span>
                        <span class="value">${dataFormatada}</span>
                    </div>
                    
                    <div class="status ${tipoNotificacao}">
                        ${status}
                    </div>
                    
                    ${tipoNotificacao === 'rejeitar' ? `
                    <div class="info-row">
                        <span class="label">Motivo da Rejeição:</span>
                        <span class="value">${saque.motivo_rejeicao || 'Não informado'}</span>
                    </div>
                    ` : ''}
                    
                    <p>Para mais informações, entre em contato conosco através do painel ou por email.</p>
                    
                    <p>Atenciosamente,<br>Equipe RatixPay</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
    
    /**
     * Enviar código de autenticação por email usando serviço profissional
     */
    static async enviarCodigoAutenticacao(email, codigo, tipo, vendedor = null) {
        try {
            console.log(`🔄 EmailService.enviarCodigoAutenticacao chamado com:`, { email, codigo, tipo });
            
            // Usar o serviço de email profissional do sistema
            const sistemaEmailService = require('../services/sistemaEmailService');
            
            const dadosUsuario = {
                email: email,
                nome: vendedor ? vendedor.nome : 'Usuário',
                codigo: codigo,
                motivo: tipo === 'carteira' ? 'configurar sua carteira' : 'confirmar seu saque',
                tempoExpiracao: 10 // 10 minutos
            };
            
            console.log('📧 Enviando código via serviço profissional do sistema...');
            const resultado = await sistemaEmailService.enviarCodigoVerificacao(dadosUsuario);
            
            if (resultado) {
                console.log('✅ Código de autenticação enviado com sucesso via sistema@ratixpay.com');
                return resultado;
            } else {
                console.log('⚠️ Falha ao enviar via sistema, tentando WhatsApp como fallback...');
                
                // Enviar via WhatsApp como fallback
                if (vendedor && vendedor.telefone) {
                    console.log('📱 Enviando código via WhatsApp como fallback...');
                    await EmailService.enviarCodigoWhatsApp(vendedor.telefone, codigo, tipo);
                }
                return false;
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar código de autenticação:', error);
            console.error('❌ Stack trace completo:', error.stack);
            throw error;
        }
    }

    /**
     * Enviar código de autenticação via WhatsApp
     */
    static async enviarCodigoWhatsApp(telefone, codigo, tipo) {
        try {
            console.log(`📱 Enviando código via WhatsApp para: ${telefone}`);
            
            const whatsappSessionManager = require('../services/whatsappSessionManager');
            
            const tipoTexto = tipo === 'carteira' ? 'Carteira' : 'Saque';
            const mensagem = `🔐 *RatixPay - Código de Autenticação*

Olá! Seu código de autenticação para ${tipoTexto} é:

*${codigo}*

⏰ Este código expira em 10 minutos.

⚠️ *Importante:* Nunca compartilhe este código com terceiros.

Se você não solicitou este código, ignore esta mensagem.

---
RatixPay - Sistema de Pagamentos`;

            await whatsappSessionManager.sendNotificationSafely(telefone, mensagem);
            console.log('✅ Código enviado via WhatsApp');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Erro ao enviar código via WhatsApp:', error);
            throw error;
        }
    }
}

module.exports = EmailService; 
