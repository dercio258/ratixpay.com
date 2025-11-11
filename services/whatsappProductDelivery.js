/**
 * Serviço de Envio Automático de Produtos via WhatsApp
 * 
 * Este serviço é responsável por enviar automaticamente o produto comprado
 * para o cliente via WhatsApp após a confirmação do pagamento.
 * 
 * Funcionalidades:
 * - Verifica se o cliente forneceu WhatsApp no checkout
 * - Detecta se o produto é arquivo ou URL
 * - Para arquivos: baixa e envia como mídia com mensagem formatada
 * - Para URLs: envia apenas a URL
 * 
 * @requires whatsapp-web.js
 * @requires fs, path (Node.js)
 */

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const https = require('https');
const http = require('http');
const browserDetector = require('../utils/whatsappBrowserDetector');

class WhatsAppProductDelivery {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.isReady = false;
        this.readyResolve = null;
        this.readyPromise = new Promise((resolve) => {
            this.readyResolve = resolve;
        });
        
        // WhatsApp de suporte (configurável via variável de ambiente)
        this.supportWhatsApp = process.env.SUPPORT_WHATSAPP || '25884460571';
    }

    /**
     * Inicializa o cliente WhatsApp
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('📱 WhatsApp Product Delivery já está inicializado');
            return;
        }

        try {
            console.log('📱 Inicializando WhatsApp Product Delivery...');
            
            // Obter configuração otimizada do Puppeteer (usa Chrome do sistema se disponível)
            const puppeteerConfig = browserDetector.getPuppeteerConfig();
            
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'product-delivery'
                }),
                puppeteer: puppeteerConfig
            });

            // Event listeners
            this.client.on('qr', (qr) => {
                console.log('📱 QR Code gerado para WhatsApp Product Delivery');
                // QR code pode ser acessado via API se necessário
            });

            this.client.on('ready', () => {
                console.log('✅ WhatsApp Product Delivery pronto!');
                this.isReady = true;
                this.isInitialized = true;
                if (this.readyResolve) {
                    this.readyResolve();
                }
            });

            this.client.on('authenticated', () => {
                console.log('✅ WhatsApp Product Delivery autenticado');
            });

            this.client.on('auth_failure', (msg) => {
                console.error('❌ Falha na autenticação WhatsApp Product Delivery:', msg);
                this.isReady = false;
            });

            this.client.on('disconnected', (reason) => {
                console.log('⚠️ WhatsApp Product Delivery desconectado:', reason);
                this.isReady = false;
                // Tentar reconectar após 5 segundos
                setTimeout(() => this.initialize(), 5000);
            });

            // Iniciar cliente
            await this.client.initialize();
            
        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp Product Delivery:', error);
            throw error;
        }
    }

    /**
     * Aguarda o cliente estar pronto
     */
    async waitForReady() {
        if (this.isReady) {
            return;
        }
        
        // Aguardar no máximo 60 segundos
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout aguardando WhatsApp estar pronto')), 60000);
        });
        
        await Promise.race([this.readyPromise, timeout]);
    }

    /**
     * Formata número de telefone para formato WhatsApp (258XXXXXXXXX)
     * Remove espaços, caracteres especiais e garante código do país
     */
    formatPhoneNumber(phone) {
        if (!phone) return null;
        
        // Remover todos os caracteres não numéricos
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Se já começa com 258 (código de Moçambique), usar direto
        if (cleanPhone.startsWith('258')) {
            return cleanPhone;
        }
        
        // Se começa com 0, remover e adicionar 258
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        
        // Se não tem código do país, adicionar 258 (Moçambique)
        if (!cleanPhone.startsWith('258')) {
            cleanPhone = '258' + cleanPhone;
        }
        
        return cleanPhone;
    }

    /**
     * Verifica se uma URL é um arquivo local ou externo
     */
    isLocalFile(url) {
        if (!url) return false;
        
        // Se começa com http/https, é URL externa
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return false;
        }
        
        // Se começa com /uploads ou caminho relativo, é arquivo local
        if (url.startsWith('/uploads/') || url.startsWith('./') || url.startsWith('../')) {
            return true;
        }
        
        // Verificar se é caminho absoluto de arquivo
        if (path.isAbsolute(url) && fs.existsSync(url)) {
            return true;
        }
        
        return false;
    }

    /**
     * Baixa arquivo de uma URL
     */
    async downloadFile(url, outputPath) {
        try {
            console.log(`📥 Baixando arquivo de ${url}...`);
            
            // Se é arquivo local, copiar
            if (this.isLocalFile(url)) {
                const localPath = url.startsWith('/') 
                    ? path.join(__dirname, '..', 'public', url)
                    : url;
                
                if (fs.existsSync(localPath)) {
                    fs.copyFileSync(localPath, outputPath);
                    console.log(`✅ Arquivo copiado: ${localPath} -> ${outputPath}`);
                    return outputPath;
                } else {
                    throw new Error(`Arquivo local não encontrado: ${localPath}`);
                }
            }
            
            // Se é URL externa, fazer download
            const response = await axios({
                url: url,
                method: 'GET',
                responseType: 'stream',
                timeout: 30000, // 30 segundos
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false // Para URLs com SSL auto-assinado
                })
            });
            
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            
            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`✅ Arquivo baixado: ${outputPath}`);
                    resolve(outputPath);
                });
                writer.on('error', reject);
            });
            
        } catch (error) {
            console.error(`❌ Erro ao baixar arquivo de ${url}:`, error.message);
            throw error;
        }
    }

    /**
     * Detecta o tipo MIME do arquivo baseado na extensão
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mp3': 'audio/mpeg',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Envia produto para o cliente via WhatsApp
     * 
     * @param {Object} orderData - Dados do pedido
     * @param {string} orderData.whatsappCliente - WhatsApp do cliente
     * @param {string} orderData.nomeCliente - Nome do cliente
     * @param {string} orderData.idPedido - ID do pedido
     * @param {string} orderData.linkConteudo - Link do conteúdo (URL ou caminho de arquivo)
     * @param {string} orderData.nomeProduto - Nome do produto
     */
    async sendProductToClient(orderData) {
        try {
            // Validar dados
            if (!orderData.whatsappCliente) {
                console.log('⚠️ Cliente não forneceu WhatsApp. Produto não será enviado via WhatsApp.');
                return {
                    success: false,
                    message: 'WhatsApp do cliente não fornecido',
                    skipped: true
                };
            }

            if (!orderData.linkConteudo) {
                console.log('⚠️ Produto não possui link de conteúdo. Nada a enviar.');
                return {
                    success: false,
                    message: 'Produto não possui link de conteúdo',
                    skipped: true
                };
            }

            // Aguardar WhatsApp estar pronto
            await this.waitForReady();

            // Formatar número do cliente
            const clientPhone = this.formatPhoneNumber(orderData.whatsappCliente);
            if (!clientPhone) {
                throw new Error('Número de WhatsApp inválido');
            }

            console.log(`📤 Enviando produto para WhatsApp: ${clientPhone}`);

            // Verificar se é arquivo local ou URL
            const isFile = this.isLocalFile(orderData.linkConteudo);
            
            let messageText;
            let media = null;

            if (isFile) {
                // É arquivo local - baixar/preparar e enviar como mídia
                console.log('📁 Detectado arquivo local, preparando envio...');
                
                // Criar diretório temporário se não existir
                const tempDir = path.join(__dirname, '..', 'temp', 'whatsapp-delivery');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }

                // Caminho temporário para o arquivo
                const fileName = path.basename(orderData.linkConteudo) || `produto_${orderData.idPedido}${path.extname(orderData.linkConteudo) || ''}`;
                const tempFilePath = path.join(tempDir, fileName);

                try {
                    // Baixar/copiar arquivo
                    await this.downloadFile(orderData.linkConteudo, tempFilePath);

                    // Criar MessageMedia
                    const mimeType = this.getMimeType(tempFilePath);
                    const fileBuffer = fs.readFileSync(tempFilePath);
                    const base64File = fileBuffer.toString('base64');
                    
                    media = new MessageMedia(mimeType, base64File, fileName);

                    // Mensagem formatada
                    messageText = `Oi! ${orderData.nomeCliente || 'Cliente'}, estamos a processar tua compra com Pedido número ${orderData.idPedido}.\n\n` +
                                 `O produto *${orderData.nomeProduto || 'Produto'}* está anexado.\n\n` +
                                 `Caso tenha dúvida contacte para suporte ${this.supportWhatsApp}.`;

                    // Enviar mensagem com mídia
                    await this.client.sendMessage(`${clientPhone}@c.us`, media, {
                        caption: messageText
                    });

                    console.log(`✅ Produto enviado como mídia para ${clientPhone}`);

                    // Limpar arquivo temporário após envio
                    setTimeout(() => {
                        if (fs.existsSync(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                            console.log(`🗑️ Arquivo temporário removido: ${tempFilePath}`);
                        }
                    }, 5000);

                    return {
                        success: true,
                        message: 'Produto enviado com sucesso via WhatsApp (arquivo)',
                        method: 'media',
                        phone: clientPhone
                    };

                } catch (fileError) {
                    console.error('❌ Erro ao processar arquivo:', fileError);
                    // Fallback: enviar apenas a URL se for possível acessar
                    throw fileError;
                }

            } else {
                // É URL externa - enviar apenas a URL
                console.log('🔗 Detectado URL externa, enviando link...');
                
                messageText = orderData.linkConteudo;

                await this.client.sendMessage(`${clientPhone}@c.us`, messageText);

                console.log(`✅ URL do produto enviada para ${clientPhone}`);

                return {
                    success: true,
                    message: 'Produto enviado com sucesso via WhatsApp (URL)',
                    method: 'url',
                    phone: clientPhone
                };
            }

        } catch (error) {
            console.error('❌ Erro ao enviar produto via WhatsApp:', error);
            return {
                success: false,
                message: error.message || 'Erro desconhecido ao enviar produto',
                error: error
            };
        }
    }

    /**
     * Envia produto automaticamente após pagamento aprovado
     * Esta função é chamada automaticamente pelo sistema após confirmação de pagamento
     * 
     * @param {Object} venda - Dados da venda
     * @param {Object} produto - Dados do produto
     * @param {Object} cliente - Dados do cliente
     * @param {string} idPedido - ID do pedido
     */
    async sendProductAfterPayment(venda, produto, cliente, idPedido) {
        try {
            // Verificar se WhatsApp está disponível (verificação rápida sem espera)
            if (!this.isReady) {
                console.log('ℹ️ WhatsApp não está pronto. Ignorando envio via WhatsApp (não bloqueia o processo).');
                return {
                    success: false,
                    skipped: true,
                    message: 'WhatsApp não está inicializado. Produto não será enviado via WhatsApp.'
                };
            }

            // Preparar dados do pedido
            const orderData = {
                whatsappCliente: venda.cliente_whatsapp || cliente.whatsapp || cliente.whatsappCliente || null,
                nomeCliente: venda.cliente_nome || cliente.nome || cliente.nomeCliente || 'Cliente',
                idPedido: idPedido || venda.numero_pedido || venda.id || 'N/A',
                linkConteudo: produto.link_conteudo || produto.linkConteudo || null,
                nomeProduto: produto.nome || 'Produto'
            };

            console.log('📦 Dados do pedido preparados para envio:', {
                whatsapp: orderData.whatsappCliente ? 'fornecido' : 'não fornecido',
                nome: orderData.nomeCliente,
                pedido: orderData.idPedido,
                produto: orderData.nomeProduto,
                link: orderData.linkConteudo ? 'presente' : 'ausente'
            });

            // Enviar produto
            const result = await this.sendProductToClient(orderData);

            if (result.success) {
                console.log(`✅ Produto enviado com sucesso via WhatsApp para pedido ${idPedido}`);
            } else if (result.skipped) {
                console.log(`ℹ️ Envio via WhatsApp pulado: ${result.message}`);
            } else {
                console.error(`❌ Falha ao enviar produto via WhatsApp: ${result.message}`);
            }

            return result;

        } catch (error) {
            console.error('❌ Erro ao enviar produto após pagamento:', error);
            return {
                success: false,
                message: error.message || 'Erro ao enviar produto via WhatsApp',
                error: error
            };
        }
    }

    /**
     * Verifica status do serviço
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            ready: this.isReady,
            supportWhatsApp: this.supportWhatsApp
        };
    }
}

// Criar instância singleton
const whatsappProductDelivery = new WhatsAppProductDelivery();

// Inicializar automaticamente quando módulo for carregado
if (process.env.AUTO_INIT_WHATSAPP_DELIVERY !== 'false') {
    whatsappProductDelivery.initialize().catch(error => {
        console.error('❌ Erro ao inicializar WhatsApp Product Delivery automaticamente:', error);
    });
}

module.exports = whatsappProductDelivery;

