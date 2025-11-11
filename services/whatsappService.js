
/**
 * Serviço para integração com WhatsApp usando WhatsApp Bot Service
 * ATIVADO - Usando WhatsApp Bot Service
 */
const path = require('path');
const fs = require('fs');

// Importar modelos necessários
const Venda = require('../models/Venda.js');
const Produto = require('../models/Produto.js');

// Importar WhatsApp Bot Service (instância)
const whatsappBotService = require('./whatsappBotService');

class WhatsAppService {
    constructor() {
        this.status = 'enabled';
        this.faqData = this.loadFAQData();
        this.botService = whatsappBotService;
        this.isInitialized = false;
    }

    /**
     * Inicializa o cliente WhatsApp
     * ATIVADO - Usando WhatsApp Bot Service
     */
    async initialize() {
        try {
            console.log('📱 Inicializando WhatsApp Service com Bot Service...');
            const success = await this.botService.initialize();
            if (success) {
                this.status = 'connected';
                this.isInitialized = true;
                // WhatsApp Service inicializado com sucesso
            } else {
                this.status = 'error';
                console.log('❌ Falha ao inicializar WhatsApp Bot Service');
            }
            return success;
        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp Service:', error);
            this.status = 'error';
            return false;
        }
    }

    /**
     * Formata número de telefone para WhatsApp
     */
    formatWhatsAppNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        // Remover espaços, hífens e outros caracteres
        let cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
        
        // Se já tem @s.whatsapp.net, retornar como está
        if (cleanNumber.includes('@s.whatsapp.net')) {
            return cleanNumber;
        }
        
        // Se começa com +, remover
        if (cleanNumber.startsWith('+')) {
            cleanNumber = cleanNumber.substring(1);
        }
        
        // Se começa com 258, manter
        if (cleanNumber.startsWith('258')) {
            return `${cleanNumber}@s.whatsapp.net`;
        }
        
        // Se começa com 0, remover e adicionar 258
        if (cleanNumber.startsWith('0')) {
            cleanNumber = cleanNumber.substring(1);
        }
        
        // Se tem 9 dígitos (número moçambicano sem código do país), adicionar 258
        if (cleanNumber.length === 9) {
            return `258${cleanNumber}@s.whatsapp.net`;
        }
        
        // Se tem 12 dígitos (com código do país), usar como está
        if (cleanNumber.length === 12) {
            return `${cleanNumber}@s.whatsapp.net`;
        }
        
        // Caso padrão: adicionar 258 se não tiver
        if (!cleanNumber.startsWith('258')) {
            cleanNumber = `258${cleanNumber}`;
        }
        
        return `${cleanNumber}@s.whatsapp.net`;
    }

    /**
     * Carrega dados do FAQ de um arquivo JSON
     */
    loadFAQData() {
        try {
            const faqPath = path.join(__dirname, '..', 'data', 'faq.json');
            if (fs.existsSync(faqPath)) {
                return JSON.parse(fs.readFileSync(faqPath, 'utf8'));
            }

            // FAQ padrão
            const defaultFAQ = [
                {
                    keywords: ['pagamento', 'pagar', 'metodo', 'método'],
                    response: `💳 *Métodos de Pagamento*\n\nAceitamos M-Pesa e e-Mola.`
                },
                {
                    keywords: ['entrega', 'receber', 'produto', 'digital'],
                    response: `🚚 *Entrega de Produtos*\nProdutos digitais entregues automaticamente após pagamento.`
                },
                {
                    keywords: ['suporte', 'ajuda', 'problema', 'dificuldade'],
                    response: `🆘 *Suporte Técnico*\nEmail: suporte@ratixpay.com\nTel: +258841234567`
                },
                {
                    keywords: ['reembolso', 'devolução', 'devolver', 'cancelar'],
                    response: `💰 *Política de Reembolso*\nSolicite reembolso em até 7 dias após a compra.`
                }
            ];

            const dataDir = path.join(__dirname, '..', 'data');
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            fs.writeFileSync(faqPath, JSON.stringify(defaultFAQ, null, 2));

            return defaultFAQ;
        } catch (error) {
            console.error('Erro ao carregar FAQ:', error);
            return [];
        }
    }

    /**
     * Encontra resposta do FAQ com base nas palavras-chave
     */
    findFAQResponse(text) {
        if (!this.faqData || !Array.isArray(this.faqData)) return null;

        for (const item of this.faqData) {
            if (item.keywords && Array.isArray(item.keywords)) {
                const hasKeyword = item.keywords.some(keyword =>
                    text.toLowerCase().includes(keyword.toLowerCase())
                );
                if (hasKeyword) return item.response;
            }
        }
        return null;
    }

    /**
     * Envia confirmação de compra
     */
    async sendPurchaseConfirmation(venda, produto) {
        try {
            if (!this.isInitialized || !this.botService.isConnected()) {
                console.log('⚠️ WhatsApp não conectado. Não foi possível enviar confirmação.');
                console.log(`ℹ️ Venda: ID ${venda.id}, Cliente: ${venda.clienteNome}, Produto: ${produto?.nome || 'N/A'}`);
                return false;
            }

            return await this.botService.sendPurchaseConfirmation(venda, produto);
        } catch (error) {
            console.error('❌ Erro ao enviar confirmação de compra:', error);
            return false;
        }
    }

    /**
     * Envia atualização de status de pagamento
     */
    async sendPaymentStatusUpdate(venda, produto) {
        console.log('⚠️ Serviço de WhatsApp desativado. Não foi possível enviar atualização de status.');
        console.log(`ℹ️ Venda: ID ${venda.id}, Cliente: ${venda.clienteNome}, Status: ${venda.pagamentoStatus}`);
        return false;
    }

    /**
     * Envia mensagem de texto para um número
     */
    async sendText(to, message) {
        try {
            if (!this.isInitialized || this.status !== 'connected') {
                console.log('⚠️ WhatsApp não está conectado. Tentando inicializar...');
                await this.initialize();
            }
            
            if (this.status !== 'connected') {
                console.log('⚠️ WhatsApp não está disponível. Mensagem não enviada.');
                console.log(`ℹ️ Destinatário: ${to}, Mensagem: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
                return false;
            }
            
            console.log(`📱 Enviando WhatsApp para: ${to}`);
            const result = await this.botService.enviarMensagem(to, message);
            
            if (result) {
                console.log(`✅ WhatsApp enviado com sucesso para: ${to}`);
                return true;
            } else {
                console.log(`❌ Falha ao enviar WhatsApp para: ${to}`);
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao enviar WhatsApp:', error);
            return false;
        }
    }

    /**
     * Enviar código de verificação por WhatsApp
     */
    async enviarCodigoVerificacao(numero, nome, codigo, motivo = 'verificação de conta', tempoExpiracao = 15) {
        try {
            // Carregar template de WhatsApp
            const fs = require('fs');
            const path = require('path');
            const templatePath = path.join(__dirname, '../templates/whatsapp-codigo-verificacao.txt');
            
            let template = '';
            if (fs.existsSync(templatePath)) {
                template = fs.readFileSync(templatePath, 'utf8');
            } else {
                // Template fallback
                template = `🔐 *CÓDIGO DE VERIFICAÇÃO - RATIXPAY*

Olá, {{NOME_USUARIO}}!

Recebemos uma solicitação para {{MOTIVO_EMAIL}} em sua conta.

*Código:* \`{{CODIGO_VERIFICACAO}}\`

⏰ *Expira em:* {{TEMPO_EXPIRACAO}} minutos
🔒 *Use apenas uma vez*

⚠️ *Nunca compartilhe este código com ninguém.*

Precisa de ajuda? 
📱 https://wa.me/258867792543

---
*RatixPay - Sistema Seguro*`;
            }

            // Substituir variáveis no template
            const mensagem = template
                .replace(/{{NOME_USUARIO}}/g, nome)
                .replace(/{{MOTIVO_EMAIL}}/g, motivo)
                .replace(/{{CODIGO_VERIFICACAO}}/g, codigo)
                .replace(/{{TEMPO_EXPIRACAO}}/g, tempoExpiracao);

            return await this.sendText(numero, mensagem);

        } catch (error) {
            console.error('❌ Erro ao enviar código de verificação por WhatsApp:', error);
            return false;
        }
    }

    /**
     * Envia mensagem (alias para sendText - compatibilidade com AuthService)
     */
    async enviarMensagem(to, message) {
        return await this.sendText(to, message);
    }

    /**
     * Registra mensagem enviada
     */
    async logMessageSent(vendaId, messageType, messageContent) {
        console.log(`⚠️ Serviço de WhatsApp desativado. Não foi possível registrar mensagem para venda ${vendaId}`);
    }

    /**
     * Desconecta o cliente WhatsApp
     */
    async disconnect() {
        this.status = 'disabled';
        console.log('⚠️ Serviço de WhatsApp temporariamente desativado');
    }

    /**
     * Retorna status atual
     */
    getStatus() {
        if (this.isInitialized && this.botService.isConnected()) {
            return {
                status: 'connected',
                message: 'WhatsApp conectado e funcionando'
            };
        } else if (this.isInitialized) {
            return {
                status: 'initialized',
                message: 'WhatsApp inicializado, aguardando conexão'
            };
        } else {
            return {
                status: 'disabled',
                message: 'WhatsApp não inicializado'
            };
        }
    }

    /**
     * Verifica se o serviço está conectado
     */
    isConnected() {
        return this.isInitialized && this.botService.isConnected();
    }

    /**
     * Envia conteúdo por WhatsApp (solicitação manual)
     */
    async enviarConteudoPorWhatsApp(whatsappData) {
        try {
            if (!this.isInitialized || !this.botService.isConnected()) {
                console.log('⚠️ WhatsApp não conectado. Simulando envio de conteúdo.');
                console.log(`ℹ️ Dados do envio:`, {
                    phoneNumber: whatsappData.phoneNumber,
                    productName: whatsappData.productName,
                    orderNumber: whatsappData.orderNumber,
                    contentLink: whatsappData.contentLink,
                    produtosComplementares: whatsappData.produtosComplementares || []
                });

                // Construir mensagem com produtos complementares
                let message = `🎉 *Seu conteúdo está pronto!*

📦 *Produto:* ${whatsappData.productName}
🔢 *Pedido:* #${whatsappData.orderNumber}

🔗 *Acesse seu conteúdo:*

📥 *[BAIXAR CONTEÚDO](${whatsappData.contentLink})*`;

                // Adicionar produtos complementares se existirem
                if (whatsappData.produtosComplementares && whatsappData.produtosComplementares.length > 0) {
                    message += `\n\n🎁 *BÔNUS INCLUÍDOS:*\n`;
                    
                    whatsappData.produtosComplementares.forEach((produtoComp, index) => {
                        message += `\n${index + 1}. *${produtoComp.nome}*`;
                        
                        if (produtoComp.link_conteudo && produtoComp.link_conteudo.trim() !== '') {
                            message += `\n   📥 *[BAIXAR BÔNUS](${produtoComp.link_conteudo})*`;
                        } else {
                            message += `\n   ⚠️ *Link não disponível - entre em contato com o vendedor*`;
                        }
                    });
                    
                    message += `\n\n💡 *Total de produtos:* ${1 + whatsappData.produtosComplementares.length} (1 principal + ${whatsappData.produtosComplementares.length} bônus)`;
                }

                message += `\n\n💡 *Como usar:*
• Clique no link acima
• Faça o download
• Aproveite seu conteúdo!

Obrigado por escolher RatixPay! 🚀

Precisa de ajuda? Entre em contato conosco.`;

                console.log(`📱 Mensagem que seria enviada para ${whatsappData.phoneNumber}:`);
                console.log(message);

                return true;
            }

            // Formatar número de telefone
            const formattedNumber = this.formatWhatsAppNumber(whatsappData.phoneNumber);
            if (!formattedNumber) {
                throw new Error('Número de telefone inválido');
            }

            // Construir mensagem com produtos complementares
            let message = `🎉 *Seu conteúdo está pronto!*

📦 *Produto:* ${whatsappData.productName}
🔢 *Pedido:* #${whatsappData.orderNumber}

🔗 *Acesse seu conteúdo:*

📥 *[BAIXAR CONTEÚDO](${whatsappData.contentLink})*`;

            // Adicionar produtos complementares se existirem
            if (whatsappData.produtosComplementares && whatsappData.produtosComplementares.length > 0) {
                message += `\n\n🎁 *BÔNUS INCLUÍDOS:*\n`;
                
                whatsappData.produtosComplementares.forEach((produtoComp, index) => {
                    message += `\n${index + 1}. *${produtoComp.nome}*`;
                    
                    if (produtoComp.link_conteudo && produtoComp.link_conteudo.trim() !== '') {
                        message += `\n   📥 *[BAIXAR BÔNUS](${produtoComp.link_conteudo})*`;
                    } else {
                        message += `\n   ⚠️ *Link não disponível - entre em contato com o vendedor*`;
                    }
                });
                
                message += `\n\n💡 *Total de produtos:* ${1 + whatsappData.produtosComplementares.length} (1 principal + ${whatsappData.produtosComplementares.length} bônus)`;
            }

            message += `\n\n💡 *Como usar:*
• Clique no link acima
• Faça o download
• Aproveite seu conteúdo!

Obrigado por escolher RatixPay! 🚀

Precisa de ajuda? Entre em contato conosco.`;

            // Enviar mensagem usando o bot service
            await this.botService.sock.sendMessage(formattedNumber, { text: message });
            console.log(`✅ Conteúdo enviado por WhatsApp para ${formattedNumber}`);

            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar conteúdo por WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Envia reclamação de suporte por WhatsApp
     */
    async enviarReclamacaoSuporte(whatsappData) {
        try {
            if (!this.isInitialized || !this.botService.isConnected()) {
                console.log('⚠️ WhatsApp não conectado. Simulando envio de reclamação de suporte.');
                
                // Simular envio de reclamação por WhatsApp
                const message = `🚨 *NOVA RECLAMAÇÃO DE SUPORTE*

📋 *Informações do Cliente:*
• Nome: ${whatsappData.clienteNome}
• Pedido: #${whatsappData.numeroPedido}
• Data/Hora: ${whatsappData.dataHora}

🚨 *Tipo de Problema:*
${this.getProblemText(whatsappData.problema)}

📝 *Descrição Detalhada:*
${whatsappData.descricao}

⚠️ *AÇÃO URGENTE REQUERIDA*
Entre em contato com o cliente imediatamente!`;

                console.log(`📱 Reclamação que seria enviada para ${whatsappData.phoneNumber}:`);
                console.log(message);
                
                return true;
            }

            // Formatar número de telefone
            const formattedNumber = this.formatWhatsAppNumber(whatsappData.phoneNumber);
            if (!formattedNumber) {
                throw new Error('Número de telefone inválido');
            }

            // Criar mensagem de reclamação
            const message = `🚨 *NOVA RECLAMAÇÃO DE SUPORTE*

📋 *Informações do Cliente:*
• Nome: ${whatsappData.clienteNome}
• Pedido: #${whatsappData.numeroPedido}
• Data/Hora: ${whatsappData.dataHora}

🚨 *Tipo de Problema:*
${this.getProblemText(whatsappData.problema)}

📝 *Descrição Detalhada:*
${whatsappData.descricao}

⚠️ *AÇÃO URGENTE REQUERIDA*
Entre em contato com o cliente imediatamente!`;

            // Enviar mensagem usando o bot service
            await this.botService.sock.sendMessage(formattedNumber, { text: message });
            console.log(`✅ Reclamação enviada por WhatsApp para ${formattedNumber}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao enviar reclamação por WhatsApp:', error);
            throw error;
        }
    }
    
    /**
     * Obter texto do problema
     */
    getProblemText(problema) {
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
    
    /**
     * Verifica se o serviço está configurado
     */
    isConfigurado() {
        const isConnected = this.isConnected();
        console.log(`📱 WhatsApp ${isConnected ? 'conectado' : 'não conectado'}`);
        return isConnected;
    }
}

// Instância única do serviço
const whatsappService = new WhatsAppService();

// Inicialização automática controlada por env
const WHATSAPP_AUTO_INIT = process.env.WHATSAPP_AUTO_INIT === 'true';
if (WHATSAPP_AUTO_INIT) {
    whatsappService.initialize().then(success => {
        if (success) {
            // WhatsApp Service inicializado automaticamente
        } else {
            console.log('⚠️ WhatsApp Service não pôde ser inicializado automaticamente');
        }
    }).catch(error => {
        console.error('❌ Erro ao inicializar WhatsApp Service:', error);
    });
}

module.exports = whatsappService;
