/**
 * Serviço de Emails Profissionais RatixPay
 * Sistema organizado por categorias para envio profissional
 */

const nodemailer = require('nodemailer');

class ProfessionalEmailService {
    constructor() {
        this.transporters = {};
        this.initialized = false;
        this.recreating = new Set(); // Prevenir recriações simultâneas
        this.initializeTransporters();
    }

    /**
     * Obter configurações de email por categoria
     */
    getEmailConfigs() {
        return {
            vendas: {
                user: process.env.EMAIL_VENDAS_USER || 'vendas@ratixpay.com',
                pass: process.env.EMAIL_VENDAS_PASS || '',
                name: 'RatixPay Vendas',
                from: '"RatixPay Vendas" <vendas@ratixpay.com>'
            },
            sistema: {
                user: process.env.EMAIL_SISTEMA_USER || 'sistema@ratixpay.com',
                pass: process.env.EMAIL_SISTEMA_PASS || '',
                name: 'RatixPay Sistema',
                from: '"RatixPay Sistema" <sistema@ratixpay.com>'
            },
            suporte: {
                user: process.env.EMAIL_SUPORTE_USER || 'suporte@ratixpay.com',
                pass: process.env.EMAIL_SUPORTE_PASS || '',
                name: 'RatixPay Suporte',
                from: '"RatixPay Suporte" <suporte@ratixpay.com>'
            },
            ofertas: {
                user: process.env.EMAIL_OFERTAS_USER || 'ofertas@ratixpay.com',
                pass: process.env.EMAIL_OFERTAS_PASS || '',
                name: 'RatixPay Ofertas',
                from: '"RatixPay Ofertas" <ofertas@ratixpay.com>'
            }
        };
    }

    /**
     * Criar configuração de transporter (sem pool para evitar conflitos)
     */
    createTransporterConfig(config) {
        // Tentar porta 465 primeiro (SSL direto), se falhar, usar 587 (STARTTLS)
        const transporterConfig = {
            host: 'smtp.zoho.com',
            port: 465, // Porta SSL padrão
            secure: true, // true para SSL na porta 465
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: {
                rejectUnauthorized: false
                // Remover minVersion e ciphers para usar padrão do Node.js
            },
            connectionTimeout: 30000,
            greetingTimeout: 30000,
            socketTimeout: 60000,
            pool: false, // Desabilitar pool para evitar conflitos de conexão
            logger: false,
            debug: false
        };

        // Se for Gmail, usar configuração do Gmail
        if (config.user.includes('@gmail.com')) {
            transporterConfig.service = 'gmail';
            transporterConfig.host = 'smtp.gmail.com';
            transporterConfig.port = 465;
            transporterConfig.secure = true;
        }

        return transporterConfig;
    }

    /**
     * Inicializar transportadores para cada categoria
     */
    initializeTransporters() {
        const emailConfigs = this.getEmailConfigs();

        for (const [category, config] of Object.entries(emailConfigs)) {
            const transporterConfig = this.createTransporterConfig(config);
            this.transporters[category] = nodemailer.createTransport(transporterConfig);
            console.log(`✅ Transportador ${category} configurado: ${config.user}`);
        }
        
        this.initialized = true;
    }

    /**
     * Aguardar inicialização se necessário
     */
    async waitForInitialization() {
        while (!this.initialized) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    /**
     * Validar dados antes de enviar email
     */
    validateEmailData(destinatario, assunto, conteudo) {
        if (!destinatario || typeof destinatario !== 'string' || !destinatario.trim()) {
            throw new Error('Destinatário é obrigatório e deve ser um email válido');
        }

        // Validação básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(destinatario.trim())) {
            throw new Error('Email do destinatário inválido');
        }

        if (!assunto || typeof assunto !== 'string' || !assunto.trim()) {
            throw new Error('Assunto é obrigatório');
        }

        if (!conteudo || typeof conteudo !== 'string' || !conteudo.trim()) {
            throw new Error('Conteúdo é obrigatório');
        }

        return {
            destinatario: destinatario.trim(),
            assunto: assunto.trim(),
            conteudo: conteudo.trim()
        };
    }

    /**
     * Fechar e remover transporter antigo
     */
    async closeTransporter(category) {
        if (this.transporters[category]) {
            try {
                const transporter = this.transporters[category];
                // Fechar conexão se tiver método close
                if (typeof transporter.close === 'function') {
                    transporter.close();
                }
            } catch (e) {
                // Ignorar erros ao fechar
            }
            delete this.transporters[category];
        }
    }

    /**
     * Criar novo transporter para uma categoria
     */
    async createNewTransporter(category) {
        const emailConfigs = this.getEmailConfigs();
        const config = emailConfigs[category];
        
        if (!config) {
            throw new Error(`Configuração não encontrada para categoria: ${category}`);
        }
        
        // Fechar transporter antigo primeiro
        await this.closeTransporter(category);
        
        // Aguardar um pouco para garantir que conexão antiga foi fechada
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const transporterConfig = this.createTransporterConfig(config);
        this.transporters[category] = nodemailer.createTransport(transporterConfig);
        console.log(`✅ Novo transportador ${category} criado`);
    }

    /**
     * Recriar transporter de forma segura (evita race conditions)
     */
    async recreateTransporterSafely(category) {
        // Evitar recriações simultâneas
        if (this.recreating.has(category)) {
            return;
        }

        this.recreating.add(category);
        
        try {
            await this.createNewTransporter(category);
        } catch (error) {
            console.warn(`⚠️ Erro ao recriar transporter ${category}:`, error.message);
        } finally {
            this.recreating.delete(category);
        }
    }

    /**
     * Método genérico para enviar email (usado por todos os métodos específicos)
     */
    async enviarEmailGenerico(category, destinatario, assunto, conteudo, tipo = category) {
        await this.waitForInitialization();

        // Validar dados
        const validated = this.validateEmailData(destinatario, assunto, conteudo);

        const emailConfigs = this.getEmailConfigs();
        const config = emailConfigs[category];
        
        if (!config) {
            return { success: false, error: `Configuração não encontrada para categoria: ${category}` };
        }

        const mailOptions = {
            from: config.from,
            to: validated.destinatario,
            subject: validated.assunto,
            html: this.formatarEmail(category, validated.conteudo, tipo)
        };

        // Tentar enviar com retry
        let lastError;
        const maxRetries = 3;
        const emailTimeout = 60000; // 60 segundos
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Obter ou criar transporter a cada tentativa
                let transporter = this.transporters[category];
                
                if (!transporter) {
                    await this.createNewTransporter(category);
                    transporter = this.transporters[category];
                }
                
                const result = await Promise.race([
                    transporter.sendMail(mailOptions),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout ao enviar email')), emailTimeout)
                    )
                ]);
                
                console.log(`✅ Email de ${category} enviado para: ${validated.destinatario}`);
                return { success: true, messageId: result.messageId };
            } catch (error) {
                lastError = error;
                const isTimeout = error.message.includes('Timeout');
                const isConnectionError = error.code === 'ECONNECTION' || 
                                        error.code === 'ETIMEDOUT' || 
                                        error.message.includes('Connection closed') ||
                                        error.message.includes('Connection closed unexpectedly');
                
                console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou para ${category}:`, error.message);
                
                if (isConnectionError || isTimeout) {
                    if (attempt < maxRetries) {
                        console.log(`🔄 Recriando conexão SMTP para ${category}...`);
                        try {
                            await this.recreateTransporterSafely(category);
                            // Backoff exponencial: 2s, 4s, 6s
                            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                        } catch (recreateError) {
                            console.warn(`⚠️ Erro ao recriar transporter ${category}:`, recreateError.message);
                        }
                    }
                } else {
                    // Se não for erro de conexão/timeout, não tentar novamente
                    break;
                }
            }
        }
        
        console.error(`❌ Todas as ${maxRetries} tentativas falharam para ${category}`);
        return { success: false, error: lastError?.message || 'Falha ao enviar email', code: lastError?.code };
    }

    /**
     * Enviar email de vendas (conteúdo, pedido de saque, confirmação)
     */
    async enviarEmailVendas(destinatario, assunto, conteudo, tipo = 'vendas') {
        return await this.enviarEmailGenerico('vendas', destinatario, assunto, conteudo, tipo);
    }

    /**
     * Enviar email de sistema (códigos, boas-vindas)
     */
    async enviarEmailSistema(destinatario, assunto, conteudo, tipo = 'sistema') {
        return await this.enviarEmailGenerico('sistema', destinatario, assunto, conteudo, tipo);
    }

    /**
     * Enviar email de suporte (reclamações, sugestões, reembolso)
     */
    async enviarEmailSuporte(destinatario, assunto, conteudo, tipo = 'suporte') {
        return await this.enviarEmailGenerico('suporte', destinatario, assunto, conteudo, tipo);
    }

    /**
     * Enviar email de ofertas (promoções, marketing)
     */
    async enviarEmailOfertas(destinatario, assunto, conteudo, tipo = 'ofertas') {
        return await this.enviarEmailGenerico('ofertas', destinatario, assunto, conteudo, tipo);
    }

    /**
     * Gerar template de confirmação de compra (mesmo padrão usado em vendas)
     */
    gerarTemplateConfirmacaoCompra({ clienteNome, produtoNome, valorPago, linkConteudo, vendedorNome, numeroPedido }) {
        const numeroPedidoFinal = numeroPedido || 'N/A';
        return `
            <h2>Olá, ${this.escapeHtml(clienteNome)}!</h2>
            <p>Parabéns pela sua compra do produto <strong>${this.escapeHtml(produtoNome)}</strong>!</p>
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📋 Detalhes da Compra</h3>
                <p><strong>Número do Pedido:</strong> #${this.escapeHtml(String(numeroPedidoFinal))}</p>
                <p><strong>Produto:</strong> ${this.escapeHtml(produtoNome)}</p>
                <p><strong>Valor Pago:</strong> ${this.escapeHtml(String(valorPago))}</p>
                <p><strong>Vendedor:</strong> ${this.escapeHtml(vendedorNome || 'Vendedor')}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${this.escapeHtml(linkConteudo || '#')}" style="background-color: #F64C00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    📥 Acessar Conteúdo do Produto
                </a>
            </div>
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>⚠️ Importante:</strong> Guarde este email em local seguro. O link do conteúdo é válido por tempo indeterminado.
            </div>
        `;
    }

    /**
     * Enviar confirmação de compra para cliente via vendas@ratixpay.com
     */
    async enviarConfirmacaoCompraCliente(dadosVenda) {
        const { clienteEmail, clienteNome, produtoNome, valorPago, linkConteudo, vendedorNome, numeroPedido, transacao_id, pagamento_referencia, venda_id } = dadosVenda || {};
        const numeroPedidoFinal = numeroPedido
            || (transacao_id && String(transacao_id).length === 6 ? transacao_id : null)
            || (pagamento_referencia && String(pagamento_referencia).length === 6 ? pagamento_referencia : null)
            || venda_id
            || 'N/A';

        const assunto = `🎉 Confirmação de Compra - Pedido #${numeroPedidoFinal}`;
        const conteudo = this.gerarTemplateConfirmacaoCompra({ clienteNome, produtoNome, valorPago, linkConteudo, vendedorNome, numeroPedido: numeroPedidoFinal });
        return await this.enviarEmailVendas(clienteEmail, assunto, conteudo, 'conteudo');
    }

    /**
     * Escapar HTML para prevenir XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Formatar email baseado na categoria
     */
    formatarEmail(category, conteudo, tipo) {
        // Verificar se o conteúdo já é um template HTML completo
        if (conteudo.includes('<!DOCTYPE html>') || conteudo.includes('<html') || conteudo.includes('email-wrapper')) {
            console.log('📧 Template HTML completo detectado - enviando sem cabeçalho adicional');
            return conteudo;
        }

        const templates = {
            vendas: {
                headerColor: '#F64C00',
                title: 'RatixPay',
                footerText: 'RatixPay - Sua plataforma de pagamentos digital',
                footerLink: 'suporte@ratixpay.com'
            },
            sistema: {
                headerColor: '#F64C00',
                title: 'RatixPay Sistema',
                footerText: 'Para suporte: Suporte',
                footerLink: 'suporte@ratixpay.com'
            },
            suporte: {
                headerColor: '#dc3545',
                title: '🛠️ RatixPay Suporte',
                footerText: 'RatixPay - Central de Suporte',
                footerLink: 'suporte@ratixpay.com'
            },
            ofertas: {
                headerColor: '#ffc107',
                title: '🎯 RatixPay Ofertas',
                footerText: 'RatixPay - Ofertas Especiais',
                footerLink: 'ofertas@ratixpay.com'
            }
        };

        const template = templates[category] || templates.vendas;
        const cores = {
            vendas: '#F64C00',
            conteudo: '#28a745',
            saque: '#007bff',
            confirmacao: '#17a2b8'
        };
        const corHeader = cores[tipo] || template.headerColor;

        return `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${template.title}</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
                    .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                    .header { background: linear-gradient(135deg, ${corHeader} 0%, ${this.darkenColor(corHeader)} 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                    .content { padding: 30px; background-color: #ffffff; }
                    .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${template.title}</h1>
                    </div>
                    <div class="content">
                        ${conteudo}
                    </div>
                    <div class="footer">
                        <p>${template.footerText}</p>
                        <p>Para suporte: <a href="mailto:${template.footerLink}">${template.footerLink}</a></p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Escurecer cor para gradiente
     */
    darkenColor(color) {
        // Simplificação: retornar cor escurecida baseada na categoria
        const darkenMap = {
            '#F64C00': '#E55A00',
            '#28a745': '#218838',
            '#007bff': '#0056b3',
            '#17a2b8': '#138496',
            '#dc3545': '#c82333',
            '#ffc107': '#e0a800'
        };
        return darkenMap[color] || '#333';
    }

    /**
     * Método genérico para enviar email por categoria
     */
    async enviarEmail(categoria, destinatario, assunto, conteudo, tipo = categoria) {
        switch (categoria.toLowerCase()) {
            case 'vendas':
                return await this.enviarEmailVendas(destinatario, assunto, conteudo, tipo);
            case 'sistema':
                return await this.enviarEmailSistema(destinatario, assunto, conteudo, tipo);
            case 'suporte':
                return await this.enviarEmailSuporte(destinatario, assunto, conteudo, tipo);
            case 'ofertas':
                return await this.enviarEmailOfertas(destinatario, assunto, conteudo, tipo);
            default:
                throw new Error(`Categoria de email inválida: ${categoria}`);
        }
    }

    /**
     * Verificar status dos transportadores
     */
    async verificarStatus() {
        const status = {};
        
        for (const [categoria, transporter] of Object.entries(this.transporters)) {
            try {
                // Tentar verificar conexão com timeout
                await Promise.race([
                    transporter.verify(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), 5000)
                    )
                ]);
                status[categoria] = { 
                    status: 'conectado', 
                    email: transporter.options?.auth?.user || 'N/A' 
                };
            } catch (error) {
                status[categoria] = { 
                    status: 'erro', 
                    error: error.message 
                };
            }
        }
        
        return status;
    }

    /**
     * Fechar todas as conexões (útil para shutdown graceful)
     */
    async closeAll() {
        for (const [category] of Object.keys(this.transporters)) {
            await this.closeTransporter(category);
            console.log(`✅ Conexão ${category} fechada`);
        }
    }
}

// Criar instância única do serviço
const professionalEmailService = new ProfessionalEmailService();

module.exports = professionalEmailService;
