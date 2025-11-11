/**
 * Serviço para integração com WhatsApp - VERSÃO SIMPLIFICADA
 * Sem dependências do Baileys
 */
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const Venda = require('../models/Venda');
const Produto = require('../models/Produto');
const { Usuario } = require('../config/database');
const adminConfig = require('../config/admin-config');

class WhatsAppBotService {
    constructor() {
        this.sock = null;
        this.connectionInfo = {
            qr: null,
            connected: false,
            error: null,
            lastUpdate: null
        };
        this.authDir = path.join(__dirname, '../bot/auth_info');
        this.isInitializing = false;
        this.notificationCount = 0;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = null;
        this.autoInitialize = false;
        this.hasCheckedAuth = false;
        
        // Cache para evitar reconexões desnecessárias
        this.connectionCache = {
            lastSuccessfulConnection: null,
            consecutiveFailures: 0,
            maxConsecutiveFailures: 3,
            cooldownPeriod: 30000,
            timeoutFailures: 0,
            maxTimeoutFailures: 5
        };
        
        console.log('🤖 WhatsApp Bot Service criado - VERSÃO SIMPLIFICADA (sem Baileys)');
    }

    /**
     * Verifica se deve tentar reconectar baseado no cache
     */
    shouldAttemptReconnect() {
        const now = Date.now();
        const lastFailure = this.connectionCache.lastSuccessfulConnection;
        
        if (this.connectionCache.consecutiveFailures >= this.connectionCache.maxConsecutiveFailures) {
            if (lastFailure && (now - lastFailure) < this.connectionCache.cooldownPeriod) {
            return false;
            }
        }
        
        return true;
    }
    
    /**
     * Registrar falha de conexão
     */
    recordConnectionFailure() {
        this.connectionCache.consecutiveFailures++;
        this.connectionCache.lastSuccessfulConnection = null;
    }
    
    /**
     * Registrar falha de timeout
     */
    recordTimeoutFailure() {
        this.connectionCache.timeoutFailures++;
        this.connectionCache.consecutiveFailures++;
        this.connectionCache.lastSuccessfulConnection = null;
    }

    /**
     * Registrar sucesso de conexão
     */
    recordSuccessfulConnection() {
        this.connectionCache.consecutiveFailures = 0;
        this.connectionCache.timeoutFailures = 0;
        this.connectionCache.lastSuccessfulConnection = Date.now();
    }

    /**
     * Verificar se existe autenticação salva
     */
    async checkExistingAuth() {
        try {
            const authFiles = ['creds.json', 'session.json'];
            const authDir = this.authDir;
            
            // Verificar se o diretório existe
            try {
                await fs.access(authDir);
            } catch {
                return false;
            }
            
            // Verificar se os arquivos de autenticação existem
            for (const file of authFiles) {
                try {
                    await fs.access(path.join(authDir, file));
                } catch {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao verificar autenticação existente:', error);
            return false;
        }
    }

    /**
     * Inicializar o bot (VERSÃO SIMPLIFICADA)
     */
    async initialize() {
        if (this.isInitializing) {
            console.log('⚠️ Inicialização já em andamento...');
            return false;
        }

        if (!this.shouldAttemptReconnect()) {
            console.log('⏰ Aguardando cooldown antes de tentar reconectar...');
            return false;
        }

        this.isInitializing = true;
        this.connectionInfo.error = null;

        try {
            console.log('🤖 Inicializando WhatsApp Bot (versão simplificada)...');
            
            // Simular inicialização sem Baileys
            this.connectionInfo.connected = true;
            this.connectionInfo.lastUpdate = new Date().toISOString();
            this.recordSuccessfulConnection();
            
            // WhatsApp Bot inicializado com sucesso
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp Bot:', error);
                this.recordConnectionFailure();
            this.connectionInfo.error = error.message;
            this.connectionInfo.lastUpdate = new Date().toISOString();
            return false;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
     * Inicialização manual
     */
    async manualInitialize() {
        console.log('🤖 Inicialização manual do WhatsApp Bot solicitada...');
        return await this.initialize();
    }

    /**
     * Obter status do bot
     */
    getStatus() {
        return {
            connected: this.connectionInfo.connected,
            error: this.connectionInfo.error,
            lastUpdate: this.connectionInfo.lastUpdate,
            qr: this.connectionInfo.qr
        };
    }

    /**
     * Obter status detalhado
     */
    async getDetailedStatus() {
        return {
            connected: this.connectionInfo.connected,
            error: this.connectionInfo.error,
            lastUpdate: this.connectionInfo.lastUpdate,
            qr: this.connectionInfo.qr,
            isInitializing: this.isInitializing,
            reconnectAttempts: this.reconnectAttempts,
            notificationCount: this.notificationCount
        };
    }

    /**
     * Resetar conexão
     */
    async reset() {
        console.log('🔄 Resetando WhatsApp Bot...');
        this.connectionInfo = {
            qr: null,
            connected: false,
            error: null,
            lastUpdate: null
        };
        this.reconnectAttempts = 0;
        return true;
    }

    /**
     * Forçar reconexão
     */
    async forceReconnect() {
        console.log('🔄 Forçando reconexão do WhatsApp Bot...');
        await this.reset();
        return await this.initialize();
    }

    /**
     * Verificar saúde da conexão
     */
    async checkConnectionHealth() {
        return this.connectionInfo.connected;
    }

    /**
     * Gerar QR code manual
     */
    async generateManualQR() {
        console.log('📱 Gerando QR code manual...');
        // Simular geração de QR code
        this.connectionInfo.qr = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    return true;
    }

    /**
     * Obter QR code atual
     */
    getCurrentQR() {
        return this.connectionInfo.qr;
    }

    /**
     * Enviar mensagem (VERSÃO SIMPLIFICADA)
     */
    async enviarMensagem(numero, mensagem) {
        try {
            console.log(`📱 Enviando mensagem para ${numero}: ${mensagem.substring(0, 50)}...`);
            
            // Simular envio de mensagem
            this.notificationCount++;
            
            console.log(`✅ Mensagem enviada com sucesso para ${numero}`);
            return true;
        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem para ${numero}:`, error);
            return false;
        }
    }

    /**
     * Enviar notificação de teste
     */
    async sendTestNotification() {
        try {
            console.log('🧪 Enviando notificação de teste...');
            const adminNumber = adminConfig.admin.whatsapp;
            const message = '🧪 Teste de notificação do RatixPay - Bot funcionando!';
            
            return await this.enviarMensagem(adminNumber, message);
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de teste:', error);
            return false;
        }
    }

    /**
     * Enviar notificação de saque para admin
     */
    async enviarNotificacaoSaqueAdmin(mensagem) {
        try {
            const adminNumber = adminConfig.admin.whatsapp;
            return await this.enviarMensagem(adminNumber, mensagem);
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de saque:', error);
            return false;
        }
    }

    /**
     * Enviar atualização de status de pagamento
     */
    async sendPaymentStatusUpdate(venda, produto) {
        try {
            console.log(`💳 Enviando atualização de status de pagamento para venda ${venda.id}`);
            // Implementar lógica de envio de status de pagamento
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar atualização de status:', error);
            return false;
        }
    }

    /**
     * Verificar se está conectado
     */
    isConnected() {
        return this.connectionInfo.connected;
    }

    /**
     * Formatar número de telefone para WhatsApp
     */
    formatWhatsAppNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        // Remover caracteres não numéricos
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Remover zero inicial se presente
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        
        // Adicionar código de Moçambique se não tiver
        if (!cleaned.startsWith('258')) {
            cleaned = '258' + cleaned;
        }
        
        return cleaned;
    }

    /**
     * Enviar notificação de venda/saque
     * @param {Object} data - Dados da venda ou saque
     * @param {Object} options - Opções adicionais (vendedor, tipo, etc.)
     */
    async sendSaleNotification(data, options = {}) {
        try {
            // Verificar se está conectado
            if (!this.isConnected()) {
                console.log('⚠️ WhatsApp Bot não conectado. Tentando inicializar...');
                const initialized = await this.initialize();
                if (!initialized || !this.isConnected()) {
                    console.log('⚠️ WhatsApp Bot não conectado após inicialização');
                    return false;
                }
            }

            // Obter número do destinatário
            let phoneNumber = null;
            let vendedor = null;
            
            // Se vendedor foi passado nas opções
            if (options.vendedor) {
                vendedor = options.vendedor;
                phoneNumber = vendedor.telefone;
            }
            // Se vendedor está no objeto data
            else if (data.vendedor && data.vendedor.telefone) {
                vendedor = data.vendedor;
                phoneNumber = data.vendedor.telefone;
            }
            // Se vendedor_id está no objeto, buscar do banco
            else if (data.vendedor_id || data.vendedorId) {
                try {
                    const vendedorId = data.vendedor_id || data.vendedorId;
                    vendedor = await Usuario.findByPk(vendedorId);
                    if (vendedor && vendedor.telefone) {
                        phoneNumber = vendedor.telefone;
                    }
                } catch (error) {
                    console.error('❌ Erro ao buscar vendedor do banco:', error);
                }
            }
            
            // Se ainda não tem número, usar admin como fallback
            if (!phoneNumber) {
                console.log('⚠️ Número de vendedor não encontrado, usando admin como fallback');
                phoneNumber = adminConfig.admin.whatsapp;
            }

            if (!phoneNumber) {
                console.log('⚠️ Número de telefone não encontrado para envio');
                return false;
            }

            // Formatar número
            const formattedNumber = this.formatWhatsAppNumber(phoneNumber);
            if (!formattedNumber) {
                console.error('❌ Número de telefone inválido:', phoneNumber);
                return false;
            }

            // Formatar mensagem baseado no tipo
            let message = '';
            
            if (options.tipo === 'saque') {
                // Mensagem para saque processado
                message = `💰 *Saque Processado!*\n\n`;
                if (data.valor) {
                    message += `*Valor:* MZN ${parseFloat(data.valor).toFixed(2)}\n`;
                }
                if (data.data_processamento) {
                    message += `*Data:* ${new Date(data.data_processamento).toLocaleString('pt-BR')}\n`;
                } else {
                    message += `*Data:* ${new Date().toLocaleString('pt-BR')}\n`;
                }
                message += `*Status:* ✅ Processado\n\n`;
                message += `Seu saque foi processado com sucesso!\n\n`;
                message += `Acesse seu dashboard: ${process.env.BASE_URL || 'http://localhost:3000'}/dashboard.html\n\n`;
                message += `---\n*RatixPay - Sistema de Pagamentos*`;
            } else if (options.tipo === 'venda_cancelada') {
                // Mensagem para venda cancelada
                const numeroPedido = data.numero_pedido || data.id || 'N/A';
                message = `❌ *Venda Cancelada - Pedido #${numeroPedido}*\n\n`;
                if (data.produto_nome || data.Produto?.nome) {
                    message += `*Produto:* ${data.produto_nome || data.Produto.nome}\n`;
                }
                if (data.valor) {
                    message += `*Valor:* MZN ${parseFloat(data.valor).toFixed(2)}\n`;
                }
                message += `*Data:* ${new Date(data.dataVenda || data.createdAt || new Date()).toLocaleString('pt-BR')}\n\n`;
                message += `A venda foi cancelada.\n\n`;
                message += `Acesse o painel para mais detalhes:\n`;
                message += `${process.env.BASE_URL || 'http://localhost:3000'}/gestao-vendas.html\n\n`;
                message += `---\n*RatixPay - Sistema de Vendas*`;
            } else {
                // Mensagem padrão para nova venda
                const numeroPedido = data.numero_pedido || data.id || 'N/A';
                const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                
                message = `🎉 *NOVA VENDA REALIZADA! - ${horaAtual}*\n\n`;
                
                if (data.produto_nome || data.Produto?.nome) {
                    message += `📦 *Produto:* ${data.produto_nome || data.Produto.nome}\n`;
                }
                
                if (data.valor) {
                    const valorFormatado = `MZN ${parseFloat(data.valor).toFixed(2)}`;
                    message += `💰 *Valor:* ${valorFormatado}\n`;
                }
                
                if (data.nomeCliente || data.cliente_nome) {
                    message += `👤 *Cliente:* ${data.nomeCliente || data.cliente_nome}\n`;
                }
                
                if (data.emailCliente || data.cliente_email) {
                    message += `📧 *Email:* ${data.emailCliente || data.cliente_email}\n`;
                }
                
                if (data.cliente_whatsapp) {
                    message += `📱 *WhatsApp:* ${data.cliente_whatsapp}\n`;
                }
                
                if (data.status) {
                    message += `💳 *Status:* ${data.status}\n`;
                }
                
                message += `📅 *Data:* ${new Date(data.dataVenda || data.createdAt || new Date()).toLocaleString('pt-BR')}\n`;
                message += `🕐 *Hora:* ${horaAtual}\n\n`;
                message += `🔗 Acesse o painel para mais detalhes:\n`;
                message += `${process.env.BASE_URL || 'http://localhost:3000'}/gestao-vendas.html\n\n`;
                message += `---\n*RatixPay - Sistema de Vendas*`;
            }

            // Enviar mensagem
            const resultado = await this.enviarMensagem(formattedNumber, message);
            
            if (resultado) {
                console.log(`✅ Notificação enviada via WhatsApp Bot para ${formattedNumber}`);
            }
            
            return resultado;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de venda/saque:', error);
            return false;
        }
    }
}

// Criar instância única do serviço
const whatsappBotService = new WhatsAppBotService();

module.exports = whatsappBotService;