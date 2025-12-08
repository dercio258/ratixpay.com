/**
 * 🔔 SERVIÇO DE NOTIFICAÇÕES DE SAQUE - RATIXPAY
 * 
 * Gerencia notificações específicas para o sistema de saques:
 * - Push notifications
 * - WhatsApp
 * - Email
 * - Confirmação de pagamento
 */

const professionalEmailService = require('./professionalEmailService');
const whatsappManager = require('./whatsappManager');
// NotificationService não está disponível, usar apenas email e WhatsApp
let notificationService = null;
const { Usuario, Pagamento } = require('../config/database');

class SaqueNotificationService {
    
    /**
     * Enviar notificação de saque pendente para o administrador e vendedor
     */
    static async notificarAdminSaquePendente(saque) {
        try {
            console.log(`🔔 Enviando notificação de saque pendente para admin e vendedor...`);
            
            const vendedor = await Usuario.findByPk(saque.vendedor_id);
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            // Enviar email para admin
            await this.enviarEmailAdminSaquePendente(saque, vendedor);
            
            // Enviar WhatsApp para admin
            await this.enviarWhatsAppAdminSaquePendente(saque, vendedor);
            
            // Enviar notificação para o vendedor também
            await this.enviarNotificacaoVendedorSaquePendente(saque, vendedor);
            
            console.log(`✅ Notificações de saque pendente enviadas para admin e vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque pendente:', error);
        }
    }
    
    /**
     * Enviar notificação para o vendedor sobre saque pendente
     */
    static async enviarNotificacaoVendedorSaquePendente(saque, vendedor) {
        try {
            // Gerar ID amigável (últimos 6 caracteres do UUID)
            const idSaqueAmigavel = saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id;
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            
            // Enviar email para vendedor
            const assuntoVendedor = `Pedido de saque pendente ID ${idSaqueAmigavel}`;
            const conteudoVendedor = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Pedido de Saque Pendente</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #F64C00 0%, #e63946 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .info-box { background: #f8f9fa; border-left: 4px solid #F64C00; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .status { display: inline-block; background: #ffc107; color: #000; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>💰 Pedido de Saque Pendente</h1>
                        </div>
                        
                        <p>Olá <strong>${vendedor.nome_completo}</strong>,</p>
                        
                        <p>Seu pedido de saque foi criado com sucesso e está aguardando aprovação do administrador.</p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #F64C00;">📋 Detalhes do Pedido</h3>
                            <p><strong>ID do Pedido:</strong> ${idSaqueAmigavel}</p>
                            <p><strong>Valor Solicitado:</strong> MZN ${valorSolicitado.toFixed(2)}</p>
                            <p><strong>Método:</strong> ${metodo}</p>
                            <p><strong>Status:</strong> <span class="status">PENDENTE</span></p>
                        </div>
                        
                        <p style="background: #d1ecf1; padding: 15px; border-radius: 4px; border-left: 4px solid #0c5460;">
                            <strong>⏳ Aguardando Aprovação</strong><br>
                            Você receberá uma notificação quando o administrador aprovar ou cancelar seu pedido de saque.
                        </p>
                        
                        <div class="footer">
                            <p>RatixPay - Sistema de Pagamentos</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            if (vendedor.email) {
                await professionalEmailService.enviarEmailVendas(vendedor.email, assuntoVendedor, conteudoVendedor, 'saque_vendedor');
                console.log(`📧 Email de saque pendente enviado para vendedor: ${vendedor.email}`);
            }
            
            // Enviar WhatsApp para vendedor se tiver telefone
            if (vendedor.telefone) {
                const baseUrl = process.env.BASE_URL || 'https://ratixpay.site';
                
                const mensagemVendedor = `💰 *Saque Solicitado*

💰 MZN ${valorSolicitado.toFixed(2)}
⏳ Aguardando aprovação

RatixPay`;
                
                await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagemVendedor);
                console.log(`📱 WhatsApp de saque pendente enviado para vendedor: ${vendedor.telefone}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque pendente para vendedor:', error);
        }
    }
    
    /**
     * Enviar notificação de saque aprovado/pago para o vendedor
     */
    static async notificarVendedorSaqueAprovado(saque) {
        try {
            console.log(`🔔 Enviando notificação de saque pago para vendedor...`);
            
            const vendedor = await Usuario.findByPk(saque.vendedor_id);
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            // Enviar email para vendedor
            await this.enviarEmailVendedorSaqueAprovado(saque, vendedor);
            
            // Enviar WhatsApp para vendedor
            await this.enviarWhatsAppVendedorSaqueAprovado(saque, vendedor);
            
            console.log(`✅ Notificações de saque pago enviadas para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque aprovado:', error);
        }
    }
    
    /**
     * Enviar notificação de saque cancelado para o vendedor
     */
    static async notificarVendedorSaqueCancelado(saque) {
        try {
            console.log(`🔔 Enviando notificação de saque cancelado para vendedor...`);
            
            const vendedor = await Usuario.findByPk(saque.vendedor_id);
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            const dadosNotificacao = {
                tipo: 'saque_cancelado',
                titulo: '❌ Saque Cancelado',
                mensagem: `Seu saque de MZN ${parseFloat(saque.valor_solicitado).toFixed(2)} foi cancelado. Motivo: ${saque.motivo_cancelamento || 'Não informado'}`,
                dados: {
                    saqueId: saque.id,
                    valor: saque.valor_solicitado,
                    metodo: saque.metodo_pagamento,
                    motivo: saque.motivo_cancelamento,
                    dataCancelamento: saque.data_cancelamento
                }
            };
            
            // Enviar notificação push para vendedor
            await notificationService.sendNotification(vendedor.id, dadosNotificacao);
            
            // Enviar email para vendedor
            await this.enviarEmailVendedorSaqueCancelado(saque, vendedor);
            
            // Enviar WhatsApp para vendedor
            await this.enviarWhatsAppVendedorSaqueCancelado(saque, vendedor);
            
            console.log(`✅ Notificações de saque cancelado enviadas para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque cancelado:', error);
        }
    }
    
    /**
     * Enviar notificação de confirmação de pagamento para o vendedor
     */
    static async notificarVendedorConfirmarPagamento(saque) {
        try {
            console.log(`🔔 Enviando notificação de confirmação de pagamento para vendedor...`);
            
            const vendedor = await Usuario.findByPk(saque.vendedor_id);
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            const dadosNotificacao = {
                tipo: 'confirmar_pagamento',
                titulo: '💳 Confirme o Recebimento',
                mensagem: `Confirme o recebimento do seu saque de MZN ${parseFloat(saque.valor_solicitado).toFixed(2)}`,
                dados: {
                    saqueId: saque.id,
                    valor: saque.valor_solicitado,
                    metodo: saque.metodo_pagamento,
                    dataPagamento: saque.data_pagamento,
                    urlConfirmacao: `/confirmar-pagamento.html?saque=${saque.id}`
                }
            };
            
            // Enviar notificação push para vendedor
            await notificationService.sendNotification(vendedor.id, dadosNotificacao);
            
            // Enviar email para vendedor
            await this.enviarEmailVendedorConfirmarPagamento(saque, vendedor);
            
            // Enviar WhatsApp para vendedor
            await this.enviarWhatsAppVendedorConfirmarPagamento(saque, vendedor);
            
            console.log(`✅ Notificações de confirmação de pagamento enviadas para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de confirmação de pagamento:', error);
        }
    }
    
    /**
     * Enviar email para admin sobre saque pendente
     */
    static async enviarEmailAdminSaquePendente(saque, vendedor) {
        try {
            // Obter ID público (preferir public_id, senão usar últimos 6 caracteres do UUID)
            const idSaqueAmigavel = saque.public_id || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);
            
            // Obter dados do saque (valores podem estar em diferentes campos)
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const nomeTitular = saque.nome_titular || saque.conta_destino || 'N/A';
            const contacto = saque.telefone_titular || 'N/A';
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            const dataSolicitacao = saque.data_solicitacao || saque.createdAt || new Date();
            
            // Extrair dados completos da carteira das observações
            let dadosMpesa = { contacto: 'N/A', nomeTitular: 'N/A' };
            let dadosEmola = { contacto: 'N/A', nomeTitular: 'N/A' };
            let emailCarteira = 'N/A';
            
            if (saque.observacoes) {
                // Tentar extrair dados da carteira das observações
                const mpesaMatch = saque.observacoes.match(/MPESA:[\s\S]*?Contacto: ([^\n]+)[\s\S]*?Nome Titular: ([^\n]+)/i);
                const emolaMatch = saque.observacoes.match(/EMOLA:[\s\S]*?Contacto: ([^\n]+)[\s\S]*?Nome Titular: ([^\n]+)/i);
                const emailMatch = saque.observacoes.match(/Email: ([^\n]+)/i);
                
                if (mpesaMatch) {
                    dadosMpesa = { contacto: mpesaMatch[1].trim(), nomeTitular: mpesaMatch[2].trim() };
                }
                if (emolaMatch) {
                    dadosEmola = { contacto: emolaMatch[1].trim(), nomeTitular: emolaMatch[2].trim() };
                }
                if (emailMatch) {
                    emailCarteira = emailMatch[1].trim();
                }
            }
            
            const assunto = `Pedido de saque pendente ID ${idSaqueAmigavel}`;
            
            const conteudoHTML = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Pedido de Saque Pendente</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #F64C00 0%, #e63946 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .info-box { background: #f8f9fa; border-left: 4px solid #F64C00; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                        .info-row:last-child { border-bottom: none; }
                        .label { font-weight: bold; color: #555; }
                        .value { color: #333; }
                        .status { display: inline-block; background: #ffc107; color: #000; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>💰 Pedido de Saque Pendente</h1>
                        </div>
                        
                        <p>O <strong>${vendedor.nome_completo}</strong> realizou um pedido de saque de <strong>MZN ${valorSolicitado.toFixed(2)}</strong>.</p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #F64C00;">📋 Informações do Pedido</h3>
                            <div class="info-row">
                                <span class="label">🆔 ID Público:</span>
                                <span class="value"><strong>${idSaqueAmigavel}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">💰 Valor Solicitado:</span>
                                <span class="value"><strong style="color: #F64C00; font-size: 18px;">MZN ${valorSolicitado.toFixed(2)}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">📅 Data/Hora Solicitação:</span>
                                <span class="value">${new Date(dataSolicitacao).toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">💳 Método Escolhido:</span>
                                <span class="value"><strong>${metodo}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">👤 Nome do Titular (${metodo}):</span>
                                <span class="value">${nomeTitular}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">📱 Contacto (${metodo}):</span>
                                <span class="value">${contacto}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Status:</span>
                                <span class="value"><span class="status">PENDENTE</span></span>
                            </div>
                        </div>
                        
                        <div class="info-box" style="background: #e7f3ff; border-left-color: #0066cc;">
                            <h3 style="margin-top: 0; color: #0066cc;">📱 DADOS COMPLETOS DA CARTEIRA</h3>
                            <div style="margin-bottom: 15px;">
                                <h4 style="color: #0066cc; margin-bottom: 8px;">📱 MPESA:</h4>
                                <div class="info-row">
                                    <span class="label">Contacto:</span>
                                    <span class="value">${dadosMpesa.contacto}</span>
                                </div>
                                <div class="info-row">
                                    <span class="label">Nome Titular:</span>
                                    <span class="value">${dadosMpesa.nomeTitular}</span>
                                </div>
                            </div>
                            <div>
                                <h4 style="color: #0066cc; margin-bottom: 8px;">📱 EMOLA:</h4>
                                <div class="info-row">
                                    <span class="label">Contacto:</span>
                                    <span class="value">${dadosEmola.contacto}</span>
                                </div>
                                <div class="info-row">
                                    <span class="label">Nome Titular:</span>
                                    <span class="value">${dadosEmola.nomeTitular}</span>
                                </div>
                            </div>
                            <div class="info-row" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #b3d9ff;">
                                <span class="label">📧 Email:</span>
                                <span class="value">${emailCarteira}</span>
                            </div>
                        </div>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #F64C00;">👤 Informações do Vendedor</h3>
                            <div class="info-row">
                                <span class="label">Nome:</span>
                                <span class="value">${vendedor.nome_completo}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Email:</span>
                                <span class="value">${vendedor.email || 'N/A'}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Telefone:</span>
                                <span class="value">${vendedor.telefone || 'N/A'}</span>
                            </div>
                        </div>
                        
                        <p style="background: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107;">
                            <strong>⏳ Aguardando aprovação</strong><br>
                            Acesse o painel administrativo para revisar e aprovar este pedido de saque.
                        </p>
                        
                        <div class="footer">
                            <p>RatixPay - Sistema de Pagamentos</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            await professionalEmailService.enviarEmailSistema('ratixpay.mz@gmail.com', assunto, conteudoHTML, 'saque_admin');
            console.log(`📧 Email de saque pendente enviado para admin (ratixpay.mz@gmail.com)`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de saque pendente:', error);
        }
    }
    
    /**
     * Enviar email para vendedor sobre saque aprovado/pago
     */
    static async enviarEmailVendedorSaqueAprovado(saque, vendedor) {
        try {
            // Gerar ID amigável (últimos 6 caracteres do UUID)
            const idSaqueAmigavel = saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id;
            
            // Obter dados do saque
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            const dataPagamento = saque.data_pagamento || saque.data_aprovacao || new Date();
            
            const assunto = `Pedido de saque pago com ID:${idSaqueAmigavel}`;
            
            const conteudoHTML = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Pedido de Saque Pago</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .success-icon { font-size: 64px; margin: 20px 0; }
                        .info-box { background: #f8f9fa; border-left: 4px solid #28a745; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                        .info-row:last-child { border-bottom: none; }
                        .label { font-weight: bold; color: #555; }
                        .value { color: #333; }
                        .status { display: inline-block; background: #28a745; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                        .cta-box { background: linear-gradient(135deg, #F64C00 0%, #e63946 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
                        .cta-box h3 { margin: 0 0 10px 0; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="success-icon">✅</div>
                            <h1>💰 Pedido de Saque Pago</h1>
                        </div>
                        
                        <p>Olá <strong>${vendedor.nome_completo}</strong>,</p>
                        
                        <p style="font-size: 18px; font-weight: bold; color: #28a745;">
                            O seu pedido de saque foi pago na sua conta!
                        </p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #28a745;">📋 Detalhes do Pagamento</h3>
                            <div class="info-row">
                                <span class="label">ID do Pedido:</span>
                                <span class="value"><strong>${idSaqueAmigavel}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">Valor Pago:</span>
                                <span class="value"><strong style="color: #28a745;">MZN ${valorSolicitado.toFixed(2)}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">Método:</span>
                                <span class="value">${metodo}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Data do Pagamento:</span>
                                <span class="value">${new Date(dataPagamento).toLocaleString('pt-BR')}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Status:</span>
                                <span class="value"><span class="status">PAGO</span></span>
                            </div>
                        </div>
                        
                        <div class="cta-box">
                            <h3>🚀 Venda Mais na RatixPay!</h3>
                            <p style="margin: 0; font-size: 16px;">
                                Continue vendendo e aumente sua receita. O sistema RatixPay está aqui para apoiar seu negócio!
                            </p>
                        </div>
                        
                        <p style="background: #d1ecf1; padding: 15px; border-radius: 4px; border-left: 4px solid #0c5460;">
                            <strong>💡 Dica:</strong> Verifique sua conta bancária ou carteira móvel para confirmar o recebimento do valor.
                        </p>
                        
                        <div class="footer">
                            <p>RatixPay - Sistema de Pagamentos</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            if (vendedor.email) {
                await professionalEmailService.enviarEmailVendas(vendedor.email, assunto, conteudoHTML, 'saque_pago');
                console.log(`📧 Email de saque pago enviado para vendedor: ${vendedor.email}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de saque aprovado:', error);
        }
    }
    
    /**
     * Enviar email para vendedor sobre confirmação de pagamento
     */
    static async enviarEmailVendedorConfirmarPagamento(saque, vendedor) {
        try {
            const emailData = {
                to: vendedor.email,
                subject: `💳 Confirme o Recebimento - MZN ${parseFloat(saque.valor_solicitado).toFixed(2)}`,
                template: 'confirmar-pagamento-vendedor',
                data: {
                    vendedorNome: vendedor.nome_completo,
                    valor: parseFloat(saque.valor_solicitado).toFixed(2),
                    metodo: saque.metodo_pagamento,
                    dataPagamento: new Date(saque.data_pagamento).toLocaleString('pt-MZ'),
                    saqueId: saque.id,
                    urlConfirmacao: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmar-pagamento.html?saque=${saque.id}`
                }
            };
            
            await professionalEmailService.enviarEmailSistema(emailData.destinatario, emailData.assunto, emailData.conteudo, 'saque_admin');
            console.log(`📧 Email de confirmação de pagamento enviado para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de confirmação de pagamento:', error);
        }
    }
    
    /**
     * Enviar WhatsApp para admin sobre saque pendente
     */
    static async enviarWhatsAppAdminSaquePendente(saque, vendedor) {
        try {
            // Obter ID público (preferir public_id)
            const idSaqueAmigavel = saque.public_id || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);
            
            // Obter dados do saque (valores podem estar em diferentes campos)
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const nomeTitular = saque.nome_titular || saque.conta_destino || 'N/A';
            const contacto = saque.telefone_titular || 'N/A';
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            const dataSolicitacao = saque.data_solicitacao || saque.createdAt || new Date();
            
            // Extrair dados completos da carteira das observações
            let dadosMpesa = { contacto: 'N/A', nomeTitular: 'N/A' };
            let dadosEmola = { contacto: 'N/A', nomeTitular: 'N/A' };
            
            if (saque.observacoes) {
                const mpesaMatch = saque.observacoes.match(/MPESA:[\s\S]*?Contacto: ([^\n]+)[\s\S]*?Nome Titular: ([^\n]+)/i);
                const emolaMatch = saque.observacoes.match(/EMOLA:[\s\S]*?Contacto: ([^\n]+)[\s\S]*?Nome Titular: ([^\n]+)/i);
                
                if (mpesaMatch) {
                    dadosMpesa = { contacto: mpesaMatch[1].trim(), nomeTitular: mpesaMatch[2].trim() };
                }
                if (emolaMatch) {
                    dadosEmola = { contacto: emolaMatch[1].trim(), nomeTitular: emolaMatch[2].trim() };
                }
            }
            
            const mensagem = `💰 *NOVO SAQUE SOLICITADO*

🆔 *ID:* ${idSaqueAmigavel}
👤 *Vendedor:* ${vendedor.nome_completo}
💰 *Valor:* MZN ${valorSolicitado.toFixed(2)}
📅 *Data/Hora:* ${new Date(dataSolicitacao).toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}
💳 *Método Escolhido:* ${metodo}

📱 *DADOS DA CARTEIRA:*
*MPESA:*
   📞 ${dadosMpesa.contacto}
   👤 ${dadosMpesa.nomeTitular}

*EMOLA:*
   📞 ${dadosEmola.contacto}
   👤 ${dadosEmola.nomeTitular}

⏳ *Status:* PENDENTE

RatixPay`;
            
            // Enviar via sessão única WhatsApp
            const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
            await whatsappManager.sendNotificationSafely(adminPhone, mensagem);
            console.log(`📱 WhatsApp de saque pendente enviado para admin (${adminPhone})`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de saque pendente:', error);
        }
    }
    
    /**
     * Enviar WhatsApp para vendedor sobre saque aprovado/pago
     */
    static async enviarWhatsAppVendedorSaqueAprovado(saque, vendedor) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado para WhatsApp');
                return;
            }
            
            // Gerar ID amigável (últimos 6 caracteres do UUID)
            const idSaqueAmigavel = saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id;
            
            // Obter dados do saque
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            const dataPagamento = saque.data_pagamento || saque.data_aprovacao || new Date();
            
            // URL base do sistema
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.site';
            
            // Mensagem curta e objetiva
            const mensagem = `✅ *Saque Pago*

💰 MZN ${valorSolicitado.toFixed(2)}

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem);
            console.log(`📱 WhatsApp de saque pago enviado para vendedor: ${vendedor.telefone}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de saque aprovado:', error);
        }
    }
    
    /**
     * Enviar WhatsApp para vendedor sobre confirmação de pagamento
     */
    static async enviarWhatsAppVendedorConfirmarPagamento(saque, vendedor) {
        try {
            const whatsappData = {
                phoneNumber: vendedor.telefone || '867792543',
                message: `💳 *CONFIRME O RECEBIMENTO*

💰 *Valor:* MZN ${parseFloat(saque.valor_solicitado).toFixed(2)}
💳 *Método:* ${saque.metodo_pagamento}
📅 *Data Pagamento:* ${new Date(saque.data_pagamento).toLocaleString('pt-MZ')}
🆔 *ID Saque:* ${saque.id}

Acesse o link para confirmar o recebimento:
${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmar-pagamento.html?saque=${saque.id}`
            };
            
            await whatsappManager.sendNotificationSafely(whatsappData.phoneNumber, whatsappData.message);
            console.log(`📱 WhatsApp de confirmação de pagamento enviado para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de confirmação de pagamento:', error);
        }
    }
    
    /**
     * Enviar email para vendedor sobre saque cancelado
     */
    static async enviarEmailVendedorSaqueCancelado(saque, vendedor) {
        try {
            const emailData = {
                to: vendedor.email,
                subject: `❌ Saque Cancelado - MZN ${parseFloat(saque.valor_solicitado).toFixed(2)}`,
                template: 'saque-cancelado-vendedor',
                data: {
                    vendedorNome: vendedor.nome_completo,
                    valor: parseFloat(saque.valor_solicitado).toFixed(2),
                    metodo: saque.metodo_pagamento,
                    motivo: saque.motivo_cancelamento || 'Não informado',
                    dataCancelamento: new Date(saque.data_cancelamento).toLocaleString('pt-MZ'),
                    saqueId: saque.id
                }
            };
            
            await professionalEmailService.enviarEmailSistema(emailData.destinatario, emailData.assunto, emailData.conteudo, 'saque_admin');
            console.log(`📧 Email de saque cancelado enviado para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de saque cancelado:', error);
        }
    }
    
    /**
     * Enviar WhatsApp para vendedor sobre saque cancelado
     */
    static async enviarWhatsAppVendedorSaqueCancelado(saque, vendedor) {
        try {
            const whatsappData = {
                phoneNumber: vendedor.telefone || '867792543',
                message: `Seu saque de ID ${saque.id} foi cancelado. Motivo: ${saque.motivo_cancelamento || 'Não informado'}. Entre em contato com o suporte RatixPay.`
            };
            
            const baseUrl = process.env.BASE_URL || 'https://ratixpay.site';
            const mensagem = `❌ *Saque Cancelado*

💰 MZN ${parseFloat(saque.valor_solicitado).toFixed(2)}

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(whatsappData.phoneNumber, mensagem);
            console.log(`📱 WhatsApp de saque cancelado enviado para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de saque cancelado:', error);
        }
    }
    
    /**
     * Notificar vendedor sobre saque rejeitado com motivo
     */
    static async notificarVendedorSaqueRejeitado(saque, vendedor, motivo) {
        try {
            console.log(`🔔 Enviando notificação de saque rejeitado para vendedor...`);
            
            // Enviar email
            await this.enviarEmailVendedorSaqueRejeitado(saque, vendedor, motivo);
            
            // Enviar WhatsApp
            await this.enviarWhatsAppVendedorSaqueRejeitado(saque, vendedor, motivo);
            
            console.log(`✅ Notificações de saque rejeitado enviadas para vendedor`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque rejeitado:', error);
        }
    }
    
    /**
     * Enviar email para vendedor sobre saque rejeitado
     */
    static async enviarEmailVendedorSaqueRejeitado(saque, vendedor, motivo) {
        try {
            const idSaqueAmigavel = saque.public_id || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            const metodo = saque.metodo || saque.metodo_pagamento || 'N/A';
            const dataRejeicao = saque.data_processamento || new Date();
            
            const assunto = `❌ Saque Rejeitado - ID ${idSaqueAmigavel}`;
            
            const conteudoHTML = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Saque Rejeitado</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; margin: -30px -30px 20px -30px; }
                        .header h1 { margin: 0; font-size: 24px; }
                        .info-box { background: #f8f9fa; border-left: 4px solid #dc3545; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e0e0e0; }
                        .info-row:last-child { border-bottom: none; }
                        .label { font-weight: bold; color: #555; }
                        .value { color: #333; }
                        .motivo-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
                        .motivo-box h3 { margin-top: 0; color: #856404; }
                        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>❌ Saque Rejeitado</h1>
                        </div>
                        
                        <p>Olá <strong>${vendedor.nome_completo}</strong>,</p>
                        
                        <p>Infelizmente, seu pedido de saque foi <strong>rejeitado</strong> pelo administrador.</p>
                        
                        <div class="info-box">
                            <h3 style="margin-top: 0; color: #dc3545;">📋 Detalhes do Saque</h3>
                            <div class="info-row">
                                <span class="label">ID do Pedido:</span>
                                <span class="value"><strong>${idSaqueAmigavel}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="label">Valor Solicitado:</span>
                                <span class="value">MZN ${valorSolicitado.toFixed(2)}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Método:</span>
                                <span class="value">${metodo}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Data da Rejeição:</span>
                                <span class="value">${new Date(dataRejeicao).toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}</span>
                            </div>
                        </div>
                        
                        <div class="motivo-box">
                            <h3>📝 Motivo da Rejeição</h3>
                            <p style="margin: 0; font-size: 16px; color: #856404;">
                                ${motivo}
                            </p>
                        </div>
                        
                        <p style="background: #d1ecf1; padding: 15px; border-radius: 4px; border-left: 4px solid #0c5460;">
                            <strong>ℹ️ Importante:</strong><br>
                            O valor do saque foi subtraído da sua receita disponível. Se você acredita que houve um erro, entre em contato com o suporte RatixPay.
                        </p>
                        
                        <div class="footer">
                            <p>RatixPay - Sistema de Pagamentos</p>
                            <p>Este é um email automático, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            if (vendedor.email) {
                await professionalEmailService.enviarEmailVendas(vendedor.email, assunto, conteudoHTML, 'saque_rejeitado');
                console.log(`📧 Email de saque rejeitado enviado para vendedor: ${vendedor.email}`);
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar email de saque rejeitado:', error);
        }
    }
    
    /**
     * Enviar WhatsApp para vendedor sobre saque rejeitado
     */
    static async enviarWhatsAppVendedorSaqueRejeitado(saque, vendedor, motivo) {
        try {
            if (!vendedor.telefone) {
                console.log('⚠️ Vendedor não tem telefone configurado para WhatsApp');
                return;
            }
            
            const idSaqueAmigavel = saque.public_id || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);
            const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
            
            const mensagem = `❌ *SAQUE REJEITADO*

🆔 *ID:* ${idSaqueAmigavel}
💰 *Valor:* MZN ${valorSolicitado.toFixed(2)}

📝 *MOTIVO:*
${motivo}

ℹ️ O valor foi subtraído da sua receita disponível.

RatixPay`;
            
            await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem);
            console.log(`📱 WhatsApp de saque rejeitado enviado para vendedor: ${vendedor.telefone}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp de saque rejeitado:', error);
        }
    }
}

module.exports = SaqueNotificationService;
