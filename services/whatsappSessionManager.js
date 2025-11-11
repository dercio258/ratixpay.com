/**
 * Serviço de Gerenciamento de Sessão WhatsApp - Versão Robusta
 * 
 * Gerencia uma única sessão WhatsApp estável e robusta com:
 * - Reconexão automática com retry e backoff exponencial
 * - Health check/heartbeat periódico
 * - Fila de mensagens quando desconectado
 * - Rate limiting para evitar sobrecarga
 * - Persistência de estado
 * - Logging detalhado
 * - Graceful shutdown
 */

// DESABILITADO: whatsapp-web.js removido - usar Baileys em vez disso
// const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
// const browserDetector = require('../utils/whatsappBrowserDetector');

class WhatsAppSessionManager {
    constructor() {
        // DESABILITADO: whatsapp-web.js removido - usar Baileys em vez disso
        // Não inicializar automaticamente para evitar erros
        this.session = null;
        this.client = null;
        
        // Configurações
        this.config = {
            maxReconnectAttempts: 10,
            reconnectDelay: 5000, // 5 segundos inicial
            maxReconnectDelay: 300000, // 5 minutos máximo
            healthCheckInterval: 60000, // 1 minuto
            messageQueueMaxSize: 1000,
            rateLimitMaxMessages: 20, // por minuto
            rateLimitWindow: 60000, // 1 minuto
            statePersistInterval: 30000, // 30 segundos
            gracefulShutdownTimeout: 10000 // 10 segundos
        };
        
        // Timers e intervalos
        this.healthCheckInterval = null;
        this.reconnectTimer = null;
        this.statePersistInterval = null;
        this.isShuttingDown = false;
        
        // Estado persistido
        this.stateFile = path.join(__dirname, '../../.whatsapp-session-state.json');
        
        // Sistema de logs - INICIALIZAR SEMPRE PRIMEIRO
        this.logs = [];
        this.maxLogs = 500;
        this.notificationSent = false; // Flag para evitar envio duplicado de notificações
        
        // Garantir que logs está sempre inicializado
        if (!Array.isArray(this.logs)) {
            this.logs = [];
        }
        
        // NÃO inicializar automaticamente - usar Baileys em vez disso
        // this.init();
    }

    /**
     * Inicializa o gerenciador e carrega sessão existente
     */
    async init() {
        console.log('📱 Inicializando WhatsApp Session Manager (Versão Robusta - Sessão Única)...');
        
        // Garantir que o diretório de autenticação existe
        const authDir = path.join(__dirname, '../../.wwebjs_auth');
        try {
            await fs.access(authDir);
        } catch {
            await fs.mkdir(authDir, { recursive: true });
        }
        
        // Carregar estado persistido se existir
        await this.loadPersistedState();
        
        // Iniciar persistência periódica de estado
        this.startStatePersistence();
        
        // Configurar graceful shutdown
        this.setupGracefulShutdown();
        
        console.log('✅ WhatsApp Session Manager inicializado');
    }

    /**
     * Inicializa ou obtém a sessão WhatsApp
     * @returns {Object} Objeto com informações da sessão
     */
    async initialize() {
        // Se a sessão já existe e está pronta, retornar
        if (this.session && this.session.isReady && this.session.isConnected) {
            return this.session;
        }

        // Se existe mas não está pronta, tentar reconectar
        if (this.session && !this.session.isReady && this.session.status !== 'connecting') {
            this.scheduleReconnect();
            return this.session;
        }

        // Criar nova sessão
        return await this.createSession();
    }

    /**
     * Cria uma nova sessão WhatsApp
     */
    async createSession() {
        console.log('📱 Criando sessão WhatsApp...');
        
        // Obter configuração otimizada do Puppeteer
        const puppeteerConfig = browserDetector.getPuppeteerConfig();
        
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: 'whatsapp-session' }),
            puppeteer: puppeteerConfig,
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html'
            }
        });

        this.session = {
            client: this.client,
            isReady: false,
            isConnected: false,
            qrCode: null,
            qrCodeBase64: null,
            connectedAt: null,
            status: 'initializing',
            lastError: null,
            reconnectAttempts: 0,
            lastReconnectAttempt: null,
            messageQueue: [],
            rateLimitBucket: [],
            stats: {
                messagesSent: 0,
                messagesFailed: 0,
                messagesQueued: 0,
                lastMessageAt: null,
                lastHealthCheck: null,
                uptime: 0,
                reconnectCount: 0
            },
            healthCheck: {
                lastCheck: null,
                isHealthy: false,
                consecutiveFailures: 0
            }
        };

        // Configurar event listeners
        this.setupClientListeners();

        // Inicializar cliente com tratamento de erros e retry
        await this.initializeClient();

        // Iniciar health check
        this.startHealthCheck();

        return this.session;
    }

    /**
     * Inicializa o cliente com retry logic
     */
    async initializeClient() {
        let retryCount = 0;
        const maxRetries = 3;
        let lastError = null;

        while (retryCount <= maxRetries) {
            try {
                this.session.status = 'connecting';
                console.log(`🔄 Tentando inicializar sessão WhatsApp (tentativa ${retryCount + 1}/${maxRetries + 1})...`);
                await this.client.initialize();
                break; // Sucesso, sair do loop
            } catch (error) {
                lastError = error;
                console.error(`❌ Erro ao inicializar cliente WhatsApp (tentativa ${retryCount + 1}):`, error.message);
                
                // Verificar se é erro de Chromium não encontrado
                if (error.message.includes('Could not find expected browser') || error.message.includes('chromium')) {
                    this.session.lastError = 'Chromium não encontrado. Execute: npm install puppeteer';
                    this.session.status = 'error';
                    console.error('💡 Solução: Execute "npm install puppeteer" para instalar o Chromium necessário');
                    throw error;
                }

                // Verificar se é erro de protocolo (sessão fechada)
                if (error.message.includes('Session closed') || error.message.includes('Protocol error')) {
                    console.warn('⚠️ Erro de protocolo detectado. Pode ser problema de configuração do Chrome.');
                    
                    if (retryCount < maxRetries) {
                        // Aguardar antes de tentar novamente (backoff exponencial)
                        const waitTime = Math.min(1000 * Math.pow(2, retryCount), 10000);
                        console.log(`⏳ Aguardando ${waitTime}ms antes de tentar novamente...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Destruir cliente antigo e criar novo
                        try {
                            await this.client.destroy();
                        } catch (e) {
                            // Ignorar erros ao destruir
                        }
                        
                        // Na última tentativa, usar configuração simplificada
                        const useSimplified = retryCount === maxRetries - 1;
                        const puppeteerConfig = browserDetector.getPuppeteerConfig(useSimplified);
                        if (useSimplified) {
                            console.log('🔄 Tentando com configuração simplificada do Puppeteer...');
                        }
                        
                        this.client = new Client({
                            authStrategy: new LocalAuth({ clientId: 'whatsapp-session' }),
                            puppeteer: puppeteerConfig,
                            webVersionCache: {
                                type: 'remote',
                                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html'
                            }
                        });
                        
                        this.session.client = this.client;
                        
                        // Reconfigurar event listeners
                        this.setupClientListeners();
                    } else {
                        this.session.lastError = `Erro de protocolo: ${error.message}. Verifique se o Chrome está instalado corretamente.`;
                        this.session.status = 'error';
                        console.error('❌ Máximo de tentativas atingido para inicialização.');
                        throw error;
                    }
                } else {
                    // Outro tipo de erro
                    this.session.status = 'error';
                    this.session.lastError = error.message;
                    if (retryCount >= maxRetries) {
                    throw error;
                    }
                }
                
                retryCount++;
            }
        }
    }

    /**
     * Configura event listeners do cliente WhatsApp
     */
    setupClientListeners() {
        if (!this.client) return;

        // Remover listeners anteriores se existirem
        this.client.removeAllListeners();

        this.client.on('qr', async (qr) => {
            console.log('📱 QR Code gerado para sessão WhatsApp');
            this.addLog('info', 'QR Code gerado. Escaneie com seu WhatsApp.');
            this.session.qrCode = qr;
            try {
                this.session.qrCodeBase64 = await this.generateQRBase64(qr);
            } catch (error) {
                console.error('Erro ao gerar QR code base64:', error);
            }
            this.session.status = 'waiting_qr';
            this.emitSessionUpdate();
        });

        this.client.on('ready', async () => {
            console.log('✅ Sessão WhatsApp conectada!');
            this.addLog('success', 'Sessão WhatsApp conectada com sucesso!');
            
            this.session.isReady = true;
            this.session.isConnected = true;
            this.session.status = 'connected';
            this.session.connectedAt = new Date();
            this.session.qrCode = null;
            this.session.qrCodeBase64 = null;
            this.session.lastError = null;
            this.session.reconnectAttempts = 0;
            this.session.healthCheck.lastCheck = new Date();
            this.session.healthCheck.isHealthy = true;
            this.session.healthCheck.consecutiveFailures = 0;
            
            // Processar fila de mensagens pendentes
            this.processMessageQueue();
            
            // Enviar notificações quando a sessão estiver conectada
            if (!this.notificationSent) {
                await this.sendInitializationNotifications();
                this.notificationSent = true;
            }
            
            this.emitSessionUpdate();
            this.saveState();
        });

        this.client.on('authenticated', () => {
            console.log('✅ Sessão WhatsApp autenticada');
            this.addLog('success', 'Sessão WhatsApp autenticada com sucesso');
            this.session.status = 'authenticated';
        });

        this.client.on('auth_failure', (msg) => {
            console.error('❌ Falha na autenticação da sessão WhatsApp:', msg);
            this.addLog('error', `Falha na autenticação: ${msg}`);
            this.session.isReady = false;
            this.session.isConnected = false;
            this.session.status = 'auth_failure';
            this.session.lastError = msg;
            this.session.healthCheck.isHealthy = false;
            this.notificationSent = false; // Resetar flag para tentar novamente
            this.emitSessionUpdate();
            
            // Tentar reconectar após falha de autenticação
            this.scheduleReconnect();
        });

        this.client.on('disconnected', (reason) => {
            console.log('⚠️ Sessão WhatsApp desconectada:', reason);
            this.addLog('warning', `Sessão desconectada: ${reason}`);
            this.session.isReady = false;
            this.session.isConnected = false;
            this.session.status = 'disconnected';
            this.session.lastError = reason;
            this.session.healthCheck.isHealthy = false;
            this.notificationSent = false; // Resetar flag para tentar novamente
            this.emitSessionUpdate();
            
            // Tentar reconectar automaticamente
            this.scheduleReconnect();
        });

        this.client.on('change_state', (state) => {
            console.log(`📡 Sessão WhatsApp mudou de estado: ${state}`);
            this.session.status = state;
        });

        this.client.on('message', async (msg) => {
            // Log de mensagens recebidas (opcional, para debugging)
            if (process.env.WHATSAPP_DEBUG === 'true') {
                console.log('📨 Mensagem recebida:', msg.from);
            }
        });
    }

    /**
     * Agenda reconexão automática com backoff exponencial
     */
    scheduleReconnect() {
        if (!this.session) return;

        // Cancelar timer anterior se existir
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        // Verificar se já excedeu o máximo de tentativas
        if (this.session.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            this.session.status = 'max_reconnect_attempts';
            this.session.lastError = 'Máximo de tentativas de reconexão atingido';
            return;
        }

        // Calcular delay com backoff exponencial
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.session.reconnectAttempts),
            this.config.maxReconnectDelay
        );

        this.session.reconnectAttempts++;
        this.session.lastReconnectAttempt = new Date();
        this.session.stats.reconnectCount++;

        console.log(`🔄 Agendando reconexão em ${delay}ms (tentativa ${this.session.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(async () => {
            this.reconnectTimer = null;
            await this.reconnectSession();
        }, delay);
    }

    /**
     * Reconecta a sessão
     */
    async reconnectSession() {
        if (!this.session) return;

        console.log('🔄 Tentando reconectar sessão WhatsApp...');
        this.session.status = 'reconnecting';

        try {
            // Destruir cliente antigo
            try {
                if (this.client) {
                    await this.client.destroy();
                }
            } catch (e) {
                console.warn(`Aviso ao destruir cliente antigo: ${e.message}`);
            }

            // Criar novo cliente
            const puppeteerConfig = browserDetector.getPuppeteerConfig();
            this.client = new Client({
                authStrategy: new LocalAuth({ clientId: 'whatsapp-session' }),
                puppeteer: puppeteerConfig,
                webVersionCache: {
                    type: 'remote',
                    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51-beta.html'
                }
            });

            this.session.client = this.client;
            this.setupClientListeners();

            // Inicializar
            await this.initializeClient();
        } catch (error) {
            console.error('❌ Erro ao reconectar sessão WhatsApp:', error.message);
            this.session.status = 'reconnect_failed';
            this.session.lastError = error.message;
            
            // Tentar novamente se não excedeu o limite
            if (this.session.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        }
    }

    /**
     * Inicia health check periódico
     */
    startHealthCheck() {
        // Cancelar health check anterior se existir
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    /**
     * Realiza health check da sessão
     */
    async performHealthCheck() {
        if (!this.session) return;

        try {
            // Verificar se o cliente está ativo
            if (this.client && this.session.isReady) {
                // Tentar obter informações do cliente como health check
                const state = await this.client.getState();
                this.session.healthCheck.lastCheck = new Date();
                this.session.healthCheck.isHealthy = state === 'CONNECTED' || state === 'OPENING';
                this.session.healthCheck.consecutiveFailures = this.session.healthCheck.isHealthy ? 0 : this.session.healthCheck.consecutiveFailures + 1;

                if (!this.session.healthCheck.isHealthy && this.session.healthCheck.consecutiveFailures >= 3) {
                    console.warn('⚠️ Health check falhou 3 vezes consecutivas. Tentando reconectar...');
                    this.scheduleReconnect();
                }
            } else {
                this.session.healthCheck.isHealthy = false;
                this.session.healthCheck.consecutiveFailures++;
            }
        } catch (error) {
            console.error('❌ Erro no health check:', error.message);
            this.session.healthCheck.isHealthy = false;
            this.session.healthCheck.consecutiveFailures++;

            if (this.session.healthCheck.consecutiveFailures >= 3) {
                this.scheduleReconnect();
            }
        }
    }

    /**
     * Adiciona mensagem à fila quando a sessão está desconectada
     */
    addToMessageQueue(phoneNumber, message, media) {
        if (!this.session) return false;

        // Verificar tamanho máximo da fila
        if (this.session.messageQueue.length >= this.config.messageQueueMaxSize) {
            console.warn('⚠️ Fila de mensagens cheia. Descartando mensagem mais antiga.');
            this.session.messageQueue.shift();
        }

        this.session.messageQueue.push({
            phoneNumber,
            message,
            media,
            timestamp: new Date(),
            retries: 0
        });

        this.session.stats.messagesQueued++;
        return true;
    }

    /**
     * Processa fila de mensagens pendentes
     */
    async processMessageQueue() {
        if (!this.session || !this.session.isReady) return;

        if (this.session.messageQueue.length === 0) return;

        console.log(`📨 Processando ${this.session.messageQueue.length} mensagens na fila...`);

        const messages = [...this.session.messageQueue];
        this.session.messageQueue = [];

        for (const queuedMessage of messages) {
            try {
                await this.sendMessageInternal(queuedMessage.phoneNumber, queuedMessage.message, queuedMessage.media);
                console.log(`✅ Mensagem da fila enviada com sucesso para ${queuedMessage.phoneNumber}`);
            } catch (error) {
                console.error(`❌ Erro ao enviar mensagem da fila:`, error.message);
                // Se falhar, adicionar de volta à fila (com limite de retries)
                if (queuedMessage.retries < 3) {
                    queuedMessage.retries++;
                    this.session.messageQueue.push(queuedMessage);
                } else {
                    this.session.stats.messagesFailed++;
                }
            }

            // Rate limiting entre mensagens
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    /**
     * Verifica rate limit antes de enviar mensagem
     */
    checkRateLimit() {
        if (!this.session) return false;

        const now = Date.now();
        
        // Limpar mensagens antigas da janela
        this.session.rateLimitBucket = this.session.rateLimitBucket.filter(
            timestamp => now - timestamp < this.config.rateLimitWindow
        );

        // Verificar se excedeu o limite
        if (this.session.rateLimitBucket.length >= this.config.rateLimitMaxMessages) {
            return false;
        }

        // Adicionar timestamp atual
        this.session.rateLimitBucket.push(now);
        return true;
    }

    /**
     * Gera QR Code em base64 para exibição no frontend
     */
    async generateQRBase64(qrString) {
        try {
            const qrBuffer = await QRCode.toBuffer(qrString);
            return `data:image/png;base64,${qrBuffer.toString('base64')}`;
        } catch (error) {
            console.error('Erro ao gerar QR code em base64:', error);
            return null;
        }
    }

    /**
     * Obtém status da sessão
     */
    getStatus() {
        if (!this.session) {
            return {
                exists: false,
                status: 'not_initialized'
            };
        }

        const now = Date.now();
        const connectedAt = this.session.connectedAt ? new Date(this.session.connectedAt).getTime() : null;
        const uptime = connectedAt ? now - connectedAt : 0;

        return {
            exists: true,
            isReady: this.session.isReady,
            isConnected: this.session.isConnected,
            status: this.session.status,
            qrCode: this.session.qrCodeBase64,
            connectedAt: this.session.connectedAt,
            lastError: this.session.lastError,
            reconnectAttempts: this.session.reconnectAttempts,
            lastReconnectAttempt: this.session.lastReconnectAttempt,
            messageQueueSize: this.session.messageQueue.length,
            healthCheck: {
                ...this.session.healthCheck,
                lastCheck: this.session.healthCheck.lastCheck
            },
            stats: {
                ...this.session.stats,
                uptime: uptime,
                messagesInQueue: this.session.messageQueue.length
            }
        };
    }

    /**
     * Envia mensagem
     * @param {string} phoneNumber - Número de telefone (formato: 258XXXXXXXXX ou sem código)
     * @param {string} message - Mensagem de texto
     * @param {MessageMedia|Object|null} media - Objeto MessageMedia ou objeto com {url} ou null
     */
    async sendMessage(phoneNumber, message, media = null) {
        // Garantir que a sessão está inicializada
        if (!this.session) {
            await this.initialize();
        }

        // Se a sessão não está pronta, adicionar à fila
        if (!this.session.isReady || !this.session.isConnected) {
            console.log('📋 Sessão WhatsApp não está pronta. Adicionando mensagem à fila...');
            if (this.addToMessageQueue(phoneNumber, message, media)) {
                return { 
                    success: true, 
                    queued: true,
                    message: 'Mensagem adicionada à fila. Será enviada quando a sessão estiver conectada.' 
                };
            } else {
                throw new Error('Não foi possível adicionar mensagem à fila');
            }
        }

        // Verificar rate limit
        if (!this.checkRateLimit()) {
            // Se excedeu rate limit, adicionar à fila
            console.warn('⚠️ Rate limit excedido. Adicionando à fila...');
            if (this.addToMessageQueue(phoneNumber, message, media)) {
                return { 
                    success: true, 
                    queued: true,
                    message: 'Mensagem adicionada à fila devido ao rate limit.' 
                };
            }
        }

        return await this.sendMessageInternal(phoneNumber, message, media);
    }

    /**
     * Método interno para enviar mensagem (sem verificações de fila/rate limit)
     */
    async sendMessageInternal(phoneNumber, message, media = null) {
        if (!this.session || !this.session.isReady) {
            throw new Error('Sessão WhatsApp não está pronta');
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const chat = await this.client.getChatById(formattedNumber);

            if (media) {
                let messageMedia;
                
                // Se já é uma instância de MessageMedia, usar diretamente
                if (media instanceof MessageMedia) {
                    messageMedia = media;
                } else if (media.url) {
                    // Se é um objeto com URL, criar MessageMedia
                    messageMedia = await MessageMedia.fromUrl(media.url);
                } else {
                    throw new Error('Formato de mídia inválido');
                }
                
                await chat.sendMessage(messageMedia, { caption: message });
            } else {
                await chat.sendMessage(message);
            }

            // Atualizar estatísticas
            this.session.stats.messagesSent++;
            this.session.stats.lastMessageAt = new Date();

            return { success: true, message: 'Mensagem enviada com sucesso' };
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            this.session.stats.messagesFailed++;
            
            // Se for erro de conexão, tentar reconectar
            if (error.message.includes('Not connected') || error.message.includes('disconnected')) {
                this.scheduleReconnect();
            }
            
            throw error;
        }
    }

    /**
     * Formata número de telefone para formato WhatsApp
     */
    formatPhoneNumber(number) {
        let cleaned = number.replace(/\D/g, '');
        
        // Remover zero inicial se presente
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        
        // Adicionar código de Moçambique se não tiver
        if (!cleaned.startsWith('258')) {
            cleaned = '258' + cleaned;
        }
        
        return cleaned + '@c.us';
    }

    /**
     * Reseta a sessão
     */
    async reset() {
        if (this.session) {
            try {
                // Cancelar timers
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
                if (this.healthCheckInterval) {
                    clearInterval(this.healthCheckInterval);
                    this.healthCheckInterval = null;
                }

                // Desconectar cliente
                if (this.client) {
                    try {
                        await this.client.logout();
                    } catch (e) {
                        // Ignorar erros
                    }
                    try {
                        await this.client.destroy();
                    } catch (e) {
                        // Ignorar erros
                    }
                }

                // Remover autenticação local
                const authPath = path.join(__dirname, '../../.wwebjs_auth');
                try {
                    const files = await fs.readdir(authPath);
                    for (const file of files) {
                        if (file.includes('whatsapp-session') || file === 'whatsapp-session') {
                            const filePath = path.join(authPath, file);
                            await fs.rm(filePath, { recursive: true, force: true });
                        }
                    }
                } catch (error) {
                    console.log(`Não foi possível remover auth:`, error.message);
                }

                // Limpar sessão
                this.session = null;
                this.client = null;
                
                console.log('✅ Sessão WhatsApp resetada com sucesso');
                
                // Criar nova sessão
                return await this.initialize();
            } catch (error) {
                console.error('Erro ao resetar sessão:', error);
                throw error;
            }
        } else {
            // Criar nova sessão se não existir
            return await this.initialize();
        }
    }

    /**
     * Apaga a sessão completamente
     */
    async delete() {
        // Cancelar timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.session && this.client) {
            try {
                // Desconectar cliente
                try {
                    await this.client.logout();
                } catch (e) {
                    // Ignorar erros
                }
                try {
                    await this.client.destroy();
                } catch (e) {
                    // Ignorar erros
                }
            } catch (error) {
                console.log(`Erro ao desconectar cliente:`, error.message);
            }
        }

        // Remover autenticação local
        const authPath = path.join(__dirname, '../../.wwebjs_auth');
        try {
            const files = await fs.readdir(authPath);
            for (const file of files) {
                if (file.includes('whatsapp-session') || file === 'whatsapp-session') {
                    const filePath = path.join(authPath, file);
                    await fs.rm(filePath, { recursive: true, force: true });
                }
            }
        } catch (error) {
            console.log(`Não foi possível remover auth:`, error.message);
        }

        // Limpar sessão
        this.session = null;
        this.client = null;
        
        console.log('✅ Sessão WhatsApp apagada com sucesso');
        
        return { success: true, message: 'Sessão apagada com sucesso' };
    }

    /**
     * Testa a sessão enviando mensagem de teste
     */
    async test(testPhoneNumber) {
        if (!testPhoneNumber) {
            throw new Error('Número de telefone de teste é obrigatório');
        }

        const testMessage = `🧪 *Teste de Sessão WhatsApp*\n\n` +
            `Esta é uma mensagem de teste\n` +
            `Enviada em: ${new Date().toLocaleString('pt-BR')}\n\n` +
            `Se você recebeu esta mensagem, a sessão está funcionando corretamente! ✅`;

        return await this.sendMessage(testPhoneNumber, testMessage);
    }

    /**
     * Emite evento de atualização de sessão
     */
    emitSessionUpdate() {
        // Placeholder para futuras implementações de WebSocket
        if (process.env.WHATSAPP_DEBUG === 'true') {
            console.log('📡 Atualização de sessão WhatsApp');
        }
    }

    /**
     * Obtém QR Code da sessão
     */
    getQRCode() {
        if (!this.session) {
            return null;
        }

        return {
            qrCode: this.session.qrCode,
            qrCodeBase64: this.session.qrCodeBase64,
            status: this.session.status
        };
    }

    /**
     * Adiciona log ao sistema
     */
    addLog(type, message) {
        // Garantir que logs está inicializado
        if (!this.logs || !Array.isArray(this.logs)) {
            this.logs = [];
        }
        
        const logEntry = {
            timestamp: new Date(),
            type: type, // 'info', 'success', 'warning', 'error', 'debug'
            message: message
        };
        
        this.logs.push(logEntry);
        
        // Limitar tamanho do array de logs
        if (this.maxLogs && this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Log no console também
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'debug': '🔍'
        }[type] || '📝';
        
        console.log(`${emoji} [WhatsApp] ${message}`);
    }

    /**
     * Obtém logs da sessão
     */
    getLogs(limit = 100) {
        try {
            // Garantir que logs está inicializado
            if (!this.logs) {
                this.logs = [];
            }
            
            // Garantir que é um array
            if (!Array.isArray(this.logs)) {
                this.logs = [];
            }
            
            // Se não há logs, retornar array vazio
            if (this.logs.length === 0) {
                return [];
            }
            
            // Retornar apenas os últimos logs e serializar timestamps para strings
            const logs = this.logs.slice(-limit);
            return logs.map(log => {
                // Garantir que cada log tem a estrutura correta
                if (!log || typeof log !== 'object') {
                    return null;
                }
                
                return {
                    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : (log.timestamp || new Date().toISOString()),
                    type: log.type || 'info',
                    message: log.message || ''
                };
            }).filter(log => log !== null); // Remover logs inválidos
        } catch (error) {
            console.error('Erro ao obter logs:', error);
            // Retornar array vazio em caso de erro
            this.logs = [];
            return [];
        }
    }

    /**
     * Envia notificações de inicialização quando a sessão estiver conectada
     */
    async sendInitializationNotifications() {
        try {
            this.addLog('info', 'Enviando notificações de inicialização...');
            
            // Importar serviços necessários
            const emailManagerService = require('./emailManagerService');
            const { Usuario } = require('../models');
            const { Op } = require('sequelize');
            
            // Buscar emails de administradores
            const adminEmails = await Usuario.findAll({
                where: {
                    role: 'admin',
                    email: { [Op.ne]: null }
                },
                attributes: ['email', 'nome_completo']
            });
            
            // Buscar vendedores ativos
            const vendedoresAtivos = await Usuario.findAll({
                where: {
                    tipo_conta: 'vendedor',
                    email: { [Op.ne]: null },
                    ativo: true
                },
                attributes: ['email', 'nome_completo', 'telefone'],
                limit: 10
            });
            
            // Preparar mensagem
            const mensagem = `✅ Sessão WhatsApp do RatixPay foi inicializada e está pronta para uso!\n\n` +
                `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `O sistema de notificações WhatsApp está ativo e funcionando corretamente.`;
            
            // Enviar email para administradores
            for (const admin of adminEmails) {
                try {
                    await emailManagerService.enviarEmail('sistema', 'notificacao', {
                        email: admin.email,
                        assunto: 'Sessão WhatsApp Inicializada - RatixPay',
                        conteudo: `
                            <h2>Sessão WhatsApp Inicializada</h2>
                            <p>A sessão WhatsApp do sistema RatixPay foi inicializada com sucesso e está pronta para uso.</p>
                            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                            <p>O sistema de notificações WhatsApp está ativo e funcionando corretamente.</p>
                        `
                    });
                    this.addLog('success', `Email enviado para admin: ${admin.email}`);
                } catch (error) {
                    this.addLog('error', `Erro ao enviar email para admin ${admin.email}: ${error.message}`);
                }
            }
            
            // Enviar WhatsApp para admin
            const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
            try {
                await this.sendMessage(adminPhone, mensagem);
                this.addLog('success', `WhatsApp enviado para admin: ${adminPhone}`);
            } catch (error) {
                this.addLog('warning', `Erro ao enviar WhatsApp para admin: ${error.message}`);
            }
            
            // Enviar notificação para primeiros vendedores
            for (const vendedor of vendedoresAtivos.slice(0, 5)) {
                try {
                    // Email
                    await emailManagerService.enviarEmail('sistema', 'notificacao', {
                        email: vendedor.email,
                        assunto: 'Sistema RatixPay - WhatsApp Ativo',
                        conteudo: `
                            <h2>WhatsApp Ativo</h2>
                            <p>Olá ${vendedor.nome_completo},</p>
                            <p>O sistema de notificações WhatsApp do RatixPay está ativo e funcionando.</p>
                            <p>Você receberá notificações sobre vendas, saques e outras atualizações importantes via WhatsApp.</p>
                        `
                    });
                    
                    // WhatsApp (se tiver telefone)
                    if (vendedor.telefone) {
                        try {
                            await this.sendMessage(vendedor.telefone, 
                                `Olá ${vendedor.nome_completo}!\n\n${mensagem}\n\nVocê receberá notificações sobre vendas, saques e outras atualizações importantes.`);
                        } catch (error) {
                            this.addLog('warning', `Erro ao enviar WhatsApp para vendedor: ${error.message}`);
                        }
                    }
                    
                    this.addLog('success', `Notificação enviada para vendedor: ${vendedor.nome_completo}`);
                } catch (error) {
                    this.addLog('error', `Erro ao enviar notificação para vendedor: ${error.message}`);
                }
            }
            
            this.addLog('success', 'Notificações de inicialização enviadas com sucesso!');
            
        } catch (error) {
            this.addLog('error', `Erro ao enviar notificações de inicialização: ${error.message}`);
            console.error('Erro ao enviar notificações de inicialização:', error);
        }
    }

    /**
     * Salva estado persistido da sessão
     */
    async saveState() {
        try {
            if (!this.session) return;

            const state = {
                timestamp: new Date().toISOString(),
                stats: this.session.stats,
                reconnectAttempts: this.session.reconnectAttempts,
                lastReconnectAttempt: this.session.lastReconnectAttempt,
                connectedAt: this.session.connectedAt
            };

            await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Erro ao salvar estado:', error.message);
        }
    }

    /**
     * Carrega estado persistido da sessão
     */
    async loadPersistedState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const state = JSON.parse(data);
            
            // Carregar estatísticas se a sessão já existir
            if (this.session) {
                this.session.stats = { ...this.session.stats, ...state.stats };
                this.session.reconnectAttempts = state.reconnectAttempts || 0;
            }
            
            console.log('✅ Estado persistido carregado');
        } catch (error) {
            // Arquivo não existe ou erro ao ler - não é crítico
            if (error.code !== 'ENOENT') {
                console.warn('⚠️ Erro ao carregar estado persistido:', error.message);
            }
        }
    }

    /**
     * Inicia persistência periódica de estado
     */
    startStatePersistence() {
        if (this.statePersistInterval) {
            clearInterval(this.statePersistInterval);
        }

        this.statePersistInterval = setInterval(() => {
            this.saveState();
        }, this.config.statePersistInterval);
    }

    /**
     * Configura graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;

            console.log(`\n🛑 Recebido sinal ${signal}. Iniciando graceful shutdown...`);

            // Cancelar todos os timers
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
            if (this.statePersistInterval) clearInterval(this.statePersistInterval);

            // Salvar estado final
            await this.saveState();

            // Desconectar sessão
            if (this.client) {
                try {
                    await Promise.race([
                        this.client.destroy(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), this.config.gracefulShutdownTimeout)
                        )
                    ]);
                } catch (error) {
                    console.warn('Timeout no graceful shutdown. Forçando encerramento...');
                }
            }

            console.log('✅ Graceful shutdown concluído');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    // Métodos de compatibilidade com API antiga (para manter compatibilidade)
    async getSession() {
        return await this.initialize();
    }

    getSessionStatus() {
        return this.getStatus();
    }

    getAllSessionsStatus() {
        return {
            'whatsapp-session': this.getStatus()
        };
    }

    getValidSessionTypes() {
        return ['whatsapp-session'];
    }

    isValidSessionType() {
        return true;
    }

    async resetSession() {
        return await this.reset();
    }

    async deleteSession() {
        return await this.delete();
    }

    async testSession(testPhoneNumber) {
        return await this.test(testPhoneNumber);
    }

    /**
     * Helper para enviar notificação de forma segura
     * DESABILITADO: whatsapp-web.js removido - usar Baileys em vez disso
     * Retorna erro silencioso para não quebrar o fluxo
     */
    async sendNotificationSafely(phoneNumber, message, media = null) {
        // Tentar usar Baileys se disponível
        try {
            const baileysManager = require('./whatsappBaileysManager');
            return await baileysManager.sendNotificationSafely(phoneNumber, message, media, 'default');
        } catch (error) {
            // Se Baileys não estiver disponível ou falhar, ignorar silenciosamente
            console.warn('⚠️ WhatsApp não disponível (Baileys):', error.message);
            return { success: false, error: 'WhatsApp não disponível', ignored: true };
        }
    }
    
    /**
     * Método sendMessage desabilitado - usar Baileys
     */
    async sendMessage(phoneNumber, message, media = null) {
        // Tentar usar Baileys se disponível
        try {
            const baileysManager = require('./whatsappBaileysManager');
            return await baileysManager.sendMessage(phoneNumber, message, media, 'default');
        } catch (error) {
            // Se Baileys não estiver disponível ou falhar, ignorar silenciosamente
            console.warn('⚠️ WhatsApp não disponível (Baileys):', error.message);
            return { success: false, error: 'WhatsApp não disponível', ignored: true };
        }
    }
}

// Exportar instância singleton
module.exports = new WhatsAppSessionManager();
