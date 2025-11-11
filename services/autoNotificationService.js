const professionalEmailService = require('./professionalEmailService');
const { Notificacao, Usuario } = require('../config/database');
const adminConfig = require('../config/admin-config');

/**
 * Serviço de Notificações Automáticas
 * Envia notificações por email e WhatsApp para vendedores e administradores
 */
class AutoNotificationService {
    
    /**
     * Enviar notificação automática para vendedor
     * @param {Object} data - Dados da notificação
     * @param {string} data.vendedorId - ID do vendedor
     * @param {string} data.tipo - Tipo da notificação
     * @param {string} data.titulo - Título da notificação
     * @param {string} data.mensagem - Mensagem da notificação
     * @param {Object} data.dadosExtras - Dados extras (valor, saque, etc.)
     */
    static async enviarNotificacaoVendedor(data) {
        try {
            console.log(`🔔 Enviando notificação automática para vendedor ${data.vendedorId}...`);
            
            // Buscar dados do vendedor
            const vendedor = await Usuario.findByPk(data.vendedorId, {
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            });
            
            if (!vendedor) {
                throw new Error('Vendedor não encontrado');
            }
            
            // Criar notificação no banco
            const notificacao = await Notificacao.create({
                vendedor_id: vendedor.id,
                tipo: data.tipo,
                titulo: data.titulo,
                mensagem: data.mensagem,
                prioridade: data.prioridade || 'media',
                status: 'unread',
                enviada: true,
                dados_extras: data.dadosExtras || {}
            });
            
            // Enviar por email
            if (vendedor.email) {
                try {
                    await this.enviarEmailVendedor(vendedor, data);
                    console.log(`✅ Email enviado para vendedor: ${vendedor.email}`);
                } catch (emailError) {
                    console.error('❌ Erro ao enviar email:', emailError);
                }
            }
            
            // Enviar por WhatsApp
            if (vendedor.telefone) {
                try {
                    await this.enviarWhatsAppVendedor(vendedor, data);
                    console.log(`✅ WhatsApp enviado para vendedor: ${vendedor.telefone}`);
                } catch (whatsappError) {
                    console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
                }
            }
            
            // Atualizar contador de notificações
            await Usuario.increment('notificacoes', {
                where: { id: vendedor.id }
            });
            
            console.log(`✅ Notificação automática enviada para vendedor ${vendedor.nome_completo}`);
            return notificacao;
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação automática para vendedor:', error);
            throw error;
        }
    }
    
    /**
     * Enviar notificação automática para administrador
     * @param {Object} data - Dados da notificação
     * @param {string} data.tipo - Tipo da notificação
     * @param {string} data.titulo - Título da notificação
     * @param {string} data.mensagem - Mensagem da notificação
     * @param {Object} data.dadosExtras - Dados extras
     */
    static async enviarNotificacaoAdmin(data) {
        try {
            console.log(`🔔 Enviando notificação automática para administrador...`);
            
            // Enviar por email
            try {
                await this.enviarEmailAdmin(data);
                console.log(`✅ Email enviado para admin: ${adminConfig.admin.email}`);
            } catch (emailError) {
                console.error('❌ Erro ao enviar email para admin:', emailError);
            }
            
            // Enviar por WhatsApp
            try {
                await this.enviarWhatsAppAdmin(data);
                console.log(`✅ WhatsApp enviado para admin: ${adminConfig.admin.whatsapp}`);
            } catch (whatsappError) {
                console.error('❌ Erro ao enviar WhatsApp para admin:', whatsappError);
            }
            
            console.log(`✅ Notificação automática enviada para administrador`);
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação automática para admin:', error);
            throw error;
        }
    }
    
    /**
     * Enviar email para vendedor
     */
    static async enviarEmailVendedor(vendedor, data) {
        const assunto = `🔔 ${data.titulo} - RatixPay`;
        
        let corpoEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #F64C00 0%, #E55A00 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">RatixPay</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Olá, ${vendedor.nome_completo}!</h2>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #F64C00;">
                        <h3 style="color: #F64C00; margin-top: 0;">${data.titulo}</h3>
                        <p style="color: #666; line-height: 1.6;">${data.mensagem}</p>
                    </div>
        `;
        
        // Adicionar detalhes específicos baseados no tipo
        if (data.tipo === 'saque_aprovado' && data.dadosExtras.valor) {
            corpoEmail += `
                <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #155724; margin-top: 0;">💰 Detalhes do Saque</h4>
                    <p style="margin: 5px 0;"><strong>Valor:</strong> MZN ${data.dadosExtras.valor.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Data de Aprovação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Aprovado ✅</p>
                </div>
            `;
        } else if (data.tipo === 'saque_cancelado' && data.dadosExtras.valor) {
            corpoEmail += `
                <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #721c24; margin-top: 0;">❌ Detalhes do Saque</h4>
                    <p style="margin: 5px 0;"><strong>Valor:</strong> MZN ${data.dadosExtras.valor.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Data de Cancelamento:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Cancelado ❌</p>
                    ${data.dadosExtras.motivo ? `<p style="margin: 5px 0;"><strong>Motivo:</strong> ${data.dadosExtras.motivo}</p>` : ''}
                </div>
            `;
        }
        
        corpoEmail += `
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html" 
                           style="background: #F64C00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Acessar Dashboard
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 14px;">
                        <p>Esta é uma notificação automática do sistema RatixPay.</p>
                        <p>Se você não solicitou esta ação, entre em contato conosco.</p>
                    </div>
                </div>
            </div>
        `;
        
        await professionalEmailService.enviarEmailVendas(vendedor.email, assunto, corpoEmail, 'notificacao_vendedor');
    }
    
    /**
     * Enviar WhatsApp para vendedor
     */
    static async enviarWhatsAppVendedor(vendedor, data) {
        let mensagem = `🔔 *${data.titulo} - RatixPay*

Olá ${vendedor.nome_completo}!

${data.mensagem}`;
        
        // Adicionar detalhes específicos baseados no tipo
        if (data.tipo === 'saque_aprovado' && data.dadosExtras.valor) {
            mensagem += `

💰 *Detalhes do Saque:*
• Valor: MZN ${data.dadosExtras.valor.toFixed(2)}
• Data: ${new Date().toLocaleString('pt-BR')}
• Status: ✅ Aprovado

Seu saque foi processado com sucesso!`;
        } else if (data.tipo === 'saque_cancelado' && data.dadosExtras.valor) {
            mensagem += `

❌ *Detalhes do Saque:*
• Valor: MZN ${data.dadosExtras.valor.toFixed(2)}
• Data: ${new Date().toLocaleString('pt-BR')}
• Status: ❌ Cancelado
${data.dadosExtras.motivo ? `• Motivo: ${data.dadosExtras.motivo}` : ''}

Entre em contato conosco para mais informações.`;
        }
        
        mensagem += `

Acesse seu dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html

---
RatixPay - Sistema de Pagamentos`;

        const whatsappManager = require('./whatsappManager');
        await whatsappManager.sendNotificationSafely(vendedor.telefone, mensagem, null, 'vendas-vendedor');
    }
    
    /**
     * Enviar email para administrador
     */
    static async enviarEmailAdmin(data) {
        const assunto = `🚨 ${data.titulo} - RatixPay Admin`;
        
        let corpoEmail = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🚨 RatixPay Admin</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; margin-bottom: 20px;">Notificação Administrativa</h2>
                    
                    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
                        <h3 style="color: #dc3545; margin-top: 0;">${data.titulo}</h3>
                        <p style="color: #666; line-height: 1.6;">${data.mensagem}</p>
                    </div>
        `;
        
        // Adicionar detalhes específicos para pedido de saque
        if (data.tipo === 'solicitacao_saque' && data.dadosExtras) {
            corpoEmail += `
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #856404; margin-top: 0;">💰 Detalhes da Solicitação</h4>
                    <p style="margin: 5px 0;"><strong>Vendedor:</strong> ${data.dadosExtras.vendedorNome}</p>
                    <p style="margin: 5px 0;"><strong>Valor:</strong> MZN ${data.dadosExtras.valor.toFixed(2)}</p>
                    <p style="margin: 5px 0;"><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    <p style="margin: 5px 0;"><strong>ID do Saque:</strong> ${data.dadosExtras.saqueId}</p>
                </div>
            `;
        }
        
        corpoEmail += `
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin-dashboard.html" 
                           style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Acessar Admin Dashboard
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 14px;">
                        <p>Esta é uma notificação automática do sistema RatixPay.</p>
                        <p>Ação administrativa necessária.</p>
                    </div>
                </div>
            </div>
        `;
        
        await professionalEmailService.enviarEmailSistema(adminConfig.admin.email, assunto, corpoEmail, 'notificacao_admin');
    }
    
    /**
     * Enviar WhatsApp para administrador
     */
    static async enviarWhatsAppAdmin(data) {
        let mensagem = `🚨 *${data.titulo} - RatixPay Admin*

${data.mensagem}`;
        
        // Adicionar detalhes específicos para pedido de saque
        if (data.tipo === 'solicitacao_saque' && data.dadosExtras) {
            mensagem += `

💰 *Detalhes da Solicitação:*
• Vendedor: ${data.dadosExtras.vendedorNome}
• Valor: MZN ${data.dadosExtras.valor.toFixed(2)}
• Data: ${new Date().toLocaleString('pt-BR')}
• ID: ${data.dadosExtras.saqueId}

Ação administrativa necessária!`;
        }
        
        mensagem += `

Acesse o admin dashboard: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin-dashboard.html

---
RatixPay - Sistema Administrativo`;

        const whatsappManager = require('./whatsappManager');
        const adminPhone = process.env.ADMIN_WHATSAPP || adminConfig.admin.whatsapp || '258867792543';
        await whatsappManager.sendNotificationSafely(adminPhone, mensagem, null, 'sistema');
    }
    
    /**
     * Notificar saque aprovado para vendedor
     */
    static async notificarSaqueAprovado(saque, vendedor) {
        return await this.enviarNotificacaoVendedor({
            vendedorId: vendedor.id,
            tipo: 'saque_aprovado',
            titulo: 'Saque Aprovado ✅',
            mensagem: `Seu saque foi aprovado e processado com sucesso!`,
            prioridade: 'alta',
            dadosExtras: {
                valor: saque.valor_solicitado,
                saqueId: saque.id,
                dataAprovacao: new Date()
            }
        });
    }
    
    /**
     * Notificar saque cancelado para vendedor
     */
    static async notificarSaqueCancelado(saque, vendedor, motivo) {
        return await this.enviarNotificacaoVendedor({
            vendedorId: vendedor.id,
            tipo: 'saque_cancelado',
            titulo: 'Saque Cancelado ❌',
            mensagem: `Seu saque foi cancelado. Entre em contato conosco para mais informações.`,
            prioridade: 'alta',
            dadosExtras: {
                valor: saque.valor_solicitado,
                saqueId: saque.id,
                motivo: motivo,
                dataCancelamento: new Date()
            }
        });
    }
    
    /**
     * Notificar solicitação de saque para administrador
     */
    static async notificarSolicitacaoSaque(saque, vendedor) {
        return await this.enviarNotificacaoAdmin({
            tipo: 'solicitacao_saque',
            titulo: 'Nova Solicitação de Saque',
            mensagem: `O vendedor ${vendedor.nome_completo} solicitou um saque que precisa de aprovação.`,
            dadosExtras: {
                vendedorNome: vendedor.nome_completo,
                vendedorEmail: vendedor.email,
                valor: saque.valor_solicitado,
                saqueId: saque.id,
                dataSolicitacao: saque.created_at
            }
        });
    }
}

module.exports = AutoNotificationService;
