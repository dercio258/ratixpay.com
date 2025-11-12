/**
 * Serviço de Gerenciamento de Sessão WhatsApp usando Baileys
 * 
 * Versão simplificada com sessão única 'default':
 * - Protocolo nativo do WhatsApp (sem Puppeteer)
 * - Sessão única 'default' para todas as notificações
 * - Reconexão automática com retry e backoff exponencial
 * - Health check/heartbeat periódico
 * - Fila de mensagens quando desconectado
 * - Rate limiting para evitar sobrecarga
 * - Persistência de estado
 * - Logging detalhado
 * - Graceful shutdown
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, ConnectionState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class WhatsAppBaileysManager {
    constructor() {
        // Sessão única 'default'
        this.DEFAULT_SESSION_ID = 'default';
        this.session = null; // { socket, state, ... }
        
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
        this.stateFile = path.join(__dirname, '../../.whatsapp-baileys-state.json');
        
        // Sistema de logs
        this.logs = [];
        this.maxLogs = 500;
        this.notificationSent = false; // boolean
        
        // Logger do Baileys (silencioso por padrão)
        this.logger = pino({ level: process.env.WHATSAPP_DEBUG === 'true' ? 'debug' : 'silent' });
        
        this.init();
    }

    /**
     * Inicializa o gerenciador
     */
    async init() {
        console.log('📱 Inicializando WhatsApp Baileys Manager (Sessão Única)...');
        
        // Garantir que o diretório de autenticação existe
        const authBaseDir = path.join(__dirname, '../../.baileys_auth');
        try {
            await fs.access(authBaseDir);
        } catch {
            await fs.mkdir(authBaseDir, { recursive: true });
        }
        
        // Carregar estado persistido se existir
        await this.loadPersistedState();
        
        // Iniciar persistência periódica de estado
        this.startStatePersistence();
        
        // Configurar graceful shutdown
        this.setupGracefulShutdown();
        
        console.log('✅ WhatsApp Baileys Manager inicializado');
    }

    /**
     * Inicializa ou obtém a sessão WhatsApp (sempre 'default')
     * @param {string} sessionId - Ignorado, sempre usa 'default'
     * @returns {Object} Objeto com informações da sessão
     * NÃO gera QR code automaticamente - apenas quando solicitado explicitamente
     */
    async initialize(sessionId = 'default') {
        // Sempre usar 'default', ignorar sessionId passado
        sessionId = this.DEFAULT_SESSION_ID;
        
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                throw new Error('Baileys não disponível');
            }
            
            // Se a sessão já existe e está pronta, retornar
            if (this.session && this.session.isReady && this.session.isConnected) {
                return this.session;
            }

            // Se existe mas não está pronta, retornar status
            if (this.session && !this.session.isReady && this.session.status !== 'connecting') {
                return this.session;
            }

            // Criar nova sessão (mas não gerar QR automaticamente)
            return await this.createSession(sessionId);
        } catch (error) {
            // Se Baileys não estiver disponível, retornar sessão vazia
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module') || error.message.includes('Baileys não disponível')) {
                console.warn('⚠️ Baileys não disponível - sessão não inicializada');
                return {
                    sessionId: this.DEFAULT_SESSION_ID,
                    isReady: false,
                    isConnected: false,
                    status: 'unavailable',
                    error: 'Baileys não disponível'
                };
            }
            throw error;
        }
    }

    /**
     * Cria uma nova sessão WhatsApp (sempre 'default')
     * @param {string} sessionId - Ignorado, sempre usa 'default'
     * NÃO gera QR code automaticamente - apenas quando solicitado explicitamente
     */
    async createSession(sessionId) {
        // Sempre usar 'default'
        sessionId = this.DEFAULT_SESSION_ID;
        
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                throw new Error('Baileys não disponível');
            }
            
            console.log(`📱 Criando sessão WhatsApp Baileys: ${sessionId}`);
        
            const authDir = path.join(__dirname, '../../.baileys_auth', sessionId);
            await fs.mkdir(authDir, { recursive: true });
        
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        
        // Obter versão mais recente do Baileys
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            logger: this.logger,
            auth: state,
            browser: ['RatixPay', 'Chrome', '1.0.0'],
            getMessage: async (key) => {
                // Implementar cache de mensagens se necessário
                return null;
                },
                // Não gerar QR automaticamente - apenas quando necessário
                printQRInTerminal: false
        });

        // Criar objeto de sessão
        this.session = {
            sessionId: this.DEFAULT_SESSION_ID,
            socket: sock,
            saveCreds,
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
            logs: [], // Logs específicos desta sessão
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
        this.setupSocketListeners(this.session);

        // Salvar credenciais quando atualizadas
        sock.ev.on('creds.update', saveCreds);

        // Iniciar health check
        this.startHealthCheck();

        return this.session;
        } catch (error) {
            // Se Baileys não estiver disponível, retornar sessão vazia
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module') || error.message.includes('Baileys não disponível')) {
                console.warn('⚠️ Baileys não disponível - não criando sessão');
                return {
                    sessionId,
                    isReady: false,
                    isConnected: false,
                    status: 'unavailable',
                    error: 'Baileys não disponível'
                };
            }
            throw error;
        }
    }

    /**
     * Configura event listeners do socket Baileys
     */
    setupSocketListeners(session) {
        const { socket, sessionId } = session;

        // QR Code
        socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`📱 QR Code gerado para sessão ${sessionId}`);
                this.addLog('info', `QR Code gerado para sessão ${sessionId}. Escaneie com seu WhatsApp.`, sessionId);
                session.qrCode = qr;
                // Gerar base64 automaticamente para exibição
                try {
                    session.qrCodeBase64 = await this.generateQRBase64(qr);
                    console.log('✅ QR Code base64 gerado com sucesso');
                } catch (error) {
                    console.error('❌ Erro ao gerar QR code base64:', error);
                    session.qrCodeBase64 = null;
                }
                session.status = 'waiting_qr';
                this.emitSessionUpdate(sessionId);
            }

            if (connection === 'close') {
                const error = lastDisconnect?.error;
                const shouldReconnect = error && error.output?.statusCode !== DisconnectReason.loggedOut;
                
                session.isReady = false;
                session.isConnected = false;
                session.status = 'disconnected';
                
                if (lastDisconnect?.error) {
                    const error = lastDisconnect.error;
                    const errorMessage = error.message || error.toString() || 'Desconexão desconhecida';
                    session.lastError = errorMessage;
                    this.addLog('error', `Sessão ${sessionId} desconectada: ${errorMessage}`, sessionId);
                    
                    if (error.output?.statusCode === DisconnectReason.loggedOut) {
                        console.log(`⚠️ Sessão desconectada (logged out). Removendo...`);
                        this.session = null;
                        return;
                    }
                }

                if (shouldReconnect) {
                    console.log(`🔄 Tentando reconectar sessão...`);
                    this.scheduleReconnect();
                } else {
                    console.log(`❌ Sessão não será reconectada (logged out)`);
                }
            } else if (connection === 'open') {
                console.log(`✅ Sessão conectada!`);
                this.addLog('success', `Sessão conectada com sucesso!`);
                
                session.isReady = true;
                session.isConnected = true;
                session.status = 'connected';
                session.connectedAt = new Date();
                session.qrCode = null;
                session.qrCodeBase64 = null;
                session.lastError = null;
                session.reconnectAttempts = 0;
                session.healthCheck.lastCheck = new Date();
                session.healthCheck.isHealthy = true;
                session.healthCheck.consecutiveFailures = 0;
                
                // Processar fila de mensagens pendentes
                this.processMessageQueue();
                
                // Enviar notificações quando a sessão estiver conectada
                if (!this.notificationSent) {
                    await this.sendInitializationNotifications();
                    this.notificationSent = true;
                }
                
                this.emitSessionUpdate();
                this.saveState();
            } else if (connection === 'connecting') {
                session.status = 'connecting';
                this.addLog('info', `Sessão conectando...`);
            }
        });

        // Mensagens recebidas
        socket.ev.on('messages.upsert', async (m) => {
            if (process.env.WHATSAPP_DEBUG === 'true') {
                console.log(`📨 Mensagem recebida:`, m);
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
            console.error(`❌ Máximo de tentativas de reconexão atingido`);
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

        console.log(`🔄 Tentando reconectar sessão...`);
        this.session.status = 'reconnecting';

        try {
            // Destruir socket antigo
            try {
                if (this.session.socket) {
                    this.session.socket.end(undefined);
                }
            } catch (e) {
                console.warn(`Aviso ao destruir socket antigo: ${e.message}`);
            }

            // Recriar sessão
            await this.createSession(this.DEFAULT_SESSION_ID);
        } catch (error) {
            console.error(`❌ Erro ao reconectar sessão:`, error.message);
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
            // Verificar se o socket está ativo
            if (this.session.socket && this.session.isReady && this.session.isConnected) {
                // Verificar estado da conexão
                const isHealthy = this.session.status === 'connected';
                this.session.healthCheck.lastCheck = new Date();
                this.session.healthCheck.isHealthy = isHealthy;
                this.session.healthCheck.consecutiveFailures = isHealthy ? 0 : this.session.healthCheck.consecutiveFailures + 1;

                if (!isHealthy && this.session.healthCheck.consecutiveFailures >= 3) {
                    console.warn(`⚠️ Health check falhou 3 vezes consecutivas. Tentando reconectar...`);
                    this.scheduleReconnect();
                }
            } else {
                this.session.healthCheck.isHealthy = false;
                this.session.healthCheck.consecutiveFailures++;
            }
        } catch (error) {
            console.error(`❌ Erro no health check:`, error.message);
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
            console.warn(`⚠️ Fila de mensagens cheia. Descartando mensagem mais antiga.`);
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
     * Obtém status da sessão (sempre 'default')
     */
    getStatus(sessionId = 'default') {
        // Sempre usar 'default', ignorar sessionId passado
        if (!this.session) {
            return {
                exists: false,
                status: 'not_initialized',
                sessionId: this.DEFAULT_SESSION_ID
            };
        }

        const now = Date.now();
        const connectedAt = this.session.connectedAt ? new Date(this.session.connectedAt).getTime() : null;
        const uptime = connectedAt ? now - connectedAt : 0;

        return {
            exists: true,
            sessionId: this.DEFAULT_SESSION_ID,
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
     * Obtém status de todas as sessões (compatibilidade - sempre retorna apenas 'default')
     */
    getAllSessionsStatus() {
        return {
            [this.DEFAULT_SESSION_ID]: this.getStatus()
        };
    }

    /**
     * Envia mensagem (sempre usa sessão 'default')
     * @param {string} phoneNumber - Número de telefone (formato: 258XXXXXXXXX ou sem código)
     * @param {string} message - Mensagem de texto
     * @param {Object|null} media - Objeto com {url, mimetype} ou null
     * @param {string} sessionId - Ignorado, sempre usa 'default'
     */
    async sendMessage(phoneNumber, message, media = null, sessionId = 'default') {
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            
            // Garantir que a sessão está inicializada (sem gerar QR automaticamente)
            if (!this.session) {
                // Tentar inicializar, mas não falhar se não conseguir
                try {
                    await this.initialize();
                } catch (initError) {
                    console.warn('⚠️ Erro ao inicializar sessão WhatsApp - ignorando:', initError.message);
                    return { success: false, error: 'Sessão não disponível', ignored: true };
                }
            }

            if (!this.session) {
                return { success: false, error: 'Sessão não encontrada', ignored: true };
            }

            // Se a sessão não está pronta, ignorar silenciosamente (não enfileirar)
            if (!this.session.isReady || !this.session.isConnected) {
                // Não logar - apenas ignorar silenciosamente
                return { success: false, error: 'Sessão não conectada', ignored: true };
            }

            // Verificar rate limit
            if (!this.checkRateLimit()) {
                // Se excedeu rate limit, ignorar silenciosamente
                return { success: false, error: 'Rate limit excedido', ignored: true };
            }

            return await this.sendMessageInternal(phoneNumber, message, media);
        } catch (error) {
            // Ignorar silenciosamente se Baileys não estiver disponível
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            // Logar apenas erros não relacionados à disponibilidade
            console.warn('⚠️ Erro ao enviar mensagem WhatsApp - ignorando:', error.message);
            return { success: false, error: error.message, ignored: true };
        }
    }

    /**
     * Método interno para enviar mensagem (sem verificações de fila/rate limit)
     */
    async sendMessageInternal(phoneNumber, message, media = null) {
        if (!this.session || !this.session.isReady) {
            throw new Error(`Sessão não está pronta`);
        }

        try {
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;

            if (media) {
                // Enviar mídia
                if (media.url) {
                    // URL externa - Baileys pode baixar automaticamente
                    try {
                        const response = await axios.get(media.url, { responseType: 'arraybuffer' });
                        const buffer = Buffer.from(response.data);
                        const mimetype = response.headers['content-type'] || 'application/octet-stream';
                        
                        await this.session.socket.sendMessage(jid, {
                            document: buffer,
                            mimetype: mimetype,
                            fileName: media.filename || 'arquivo',
                            caption: message
                        });
                    } catch (urlError) {
                        // Se falhar ao baixar, enviar como texto com URL
                        await this.session.socket.sendMessage(jid, { 
                            text: `${message}\n\n🔗 Link: ${media.url}` 
                        });
                    }
                } else if (media.data && media.mimetype) {
                    // Dados base64
                    const buffer = Buffer.from(media.data, 'base64');
                    await this.session.socket.sendMessage(jid, {
                        document: buffer,
                        mimetype: media.mimetype,
                        fileName: media.filename || 'arquivo',
                        caption: message
                    });
                } else {
                    // Formato desconhecido, enviar como texto
                    await this.session.socket.sendMessage(jid, { text: message });
                }
            } else {
                // Enviar texto
                await this.session.socket.sendMessage(jid, { text: message });
            }

            // Atualizar estatísticas
            this.session.stats.messagesSent++;
            this.session.stats.lastMessageAt = new Date();

            return { success: true, message: 'Mensagem enviada com sucesso' };
        } catch (error) {
            console.error(`Erro ao enviar mensagem:`, error);
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
        
        return cleaned;
    }

    /**
     * Reseta a sessão (sempre 'default')
     */
    async reset(sessionId = 'default') {
        // Sempre usar 'default'
        sessionId = this.DEFAULT_SESSION_ID;
        
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

                // Desconectar socket
                if (this.session.socket) {
                    try {
                        this.session.socket.end(undefined);
                    } catch (e) {
                        // Ignorar erros
                    }
                }

                // Remover autenticação local
                const authPath = path.join(__dirname, '../../.baileys_auth', sessionId);
                try {
                    await fs.rm(authPath, { recursive: true, force: true });
                } catch (error) {
                    console.log(`Não foi possível remover auth:`, error.message);
                }

                // Remover sessão
                this.session = null;
                this.notificationSent = false;
                
                console.log(`✅ Sessão resetada com sucesso`);
                
                // Criar nova sessão
                return await this.initialize();
            } catch (error) {
                console.error(`Erro ao resetar sessão:`, error);
                throw error;
            }
        } else {
            // Criar nova sessão se não existir
            return await this.initialize();
        }
    }

    /**
     * Apaga a sessão completamente (sempre 'default')
     */
    async delete(sessionId = 'default') {
        // Sempre usar 'default'
        sessionId = this.DEFAULT_SESSION_ID;
        
        // Cancelar timers
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.session && this.session.socket) {
            try {
                this.session.socket.end(undefined);
            } catch (e) {
                // Ignorar erros
            }
        }

        // Remover autenticação local
        const authPath = path.join(__dirname, '../../.baileys_auth', sessionId);
        try {
            await fs.rm(authPath, { recursive: true, force: true });
        } catch (error) {
            console.log(`Não foi possível remover auth:`, error.message);
        }

        // Remover sessão
        this.session = null;
        this.notificationSent = false;
        
        console.log(`✅ Sessão apagada com sucesso`);
        
        return { success: true, message: `Sessão apagada com sucesso` };
    }

    /**
     * Testa a sessão enviando mensagem de teste (sempre 'default')
     */
    async test(testPhoneNumber, sessionId = 'default') {
        if (!testPhoneNumber) {
            throw new Error('Número de telefone de teste é obrigatório');
        }

        const testMessage = `🧪 *Teste de Sessão WhatsApp Baileys*\n\n` +
            `Esta é uma mensagem de teste\n` +
            `Enviada em: ${new Date().toLocaleString('pt-BR')}\n\n` +
            `Se você recebeu esta mensagem, a sessão está funcionando corretamente! ✅`;

        return await this.sendMessage(testPhoneNumber, testMessage, null);
    }

    /**
     * Emite evento de atualização de sessão
     */
    emitSessionUpdate() {
        // Placeholder para futuras implementações de WebSocket
        if (process.env.WHATSAPP_DEBUG === 'true') {
            console.log(`📡 Atualização de sessão WhatsApp`);
        }
    }

    /**
     * Obtém QR Code da sessão (sempre 'default')
     */
    getQRCode(sessionId = 'default') {
        if (!this.session) {
            return null;
        }

        return {
            qrCode: this.session.qrCode,
            qrCodeBase64: this.session.qrCodeBase64,
            status: this.session.status,
            sessionId: this.DEFAULT_SESSION_ID
        };
    }

    /**
     * Adiciona log ao sistema
     * @param {string} type - Tipo do log (info, success, warning, error, debug)
     * @param {string} message - Mensagem do log
     * @param {string} sessionId - Ignorado (compatibilidade)
     */
    addLog(type, message, sessionId = null) {
        const logEntry = {
            timestamp: new Date(),
            type: type,
            message: message
        };
        
        // Adicionar log à sessão se existir
        if (this.session) {
            if (!this.session.logs || !Array.isArray(this.session.logs)) {
                this.session.logs = [];
            }
            this.session.logs.push(logEntry);
            
            // Limitar tamanho do array de logs da sessão
            if (this.session.logs.length > this.maxLogs) {
                this.session.logs.shift();
            }
        }
        
        // Sempre adicionar aos logs globais também
        if (!this.logs || !Array.isArray(this.logs)) {
            this.logs = [];
        }
        this.logs.push(logEntry);
        
        // Limitar tamanho do array de logs global
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
        
        console.log(`${emoji} [WhatsApp Baileys] ${message}`);
    }

    /**
     * Obtém logs da sessão
     * @param {number} limit - Limite de logs a retornar
     * @param {string} sessionId - Ignorado (compatibilidade)
     */
    getLogs(limit = 100, sessionId = null) {
        try {
            // Se sessão existe, retornar logs da sessão
            if (this.session && this.session.logs && Array.isArray(this.session.logs)) {
                const sessionLogs = this.session.logs.slice(-limit);
                return sessionLogs.map(log => {
                    if (!log || typeof log !== 'object') {
                        return null;
                    }
                    return {
                        timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : (log.timestamp || new Date().toISOString()),
                        type: log.type || 'info',
                        message: log.message || ''
                    };
                }).filter(log => log !== null);
            }
            
            // Logs globais (fallback)
            if (!this.logs) {
                this.logs = [];
            }
            
            if (!Array.isArray(this.logs)) {
                this.logs = [];
            }
            
            if (this.logs.length === 0) {
                return [];
            }
            
            const logs = this.logs.slice(-limit);
            return logs.map(log => {
                if (!log || typeof log !== 'object') {
                    return null;
                }
                
                return {
                    timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : (log.timestamp || new Date().toISOString()),
                    type: log.type || 'info',
                    message: log.message || ''
                };
            }).filter(log => log !== null);
        } catch (error) {
            console.error('Erro ao obter logs:', error);
            return [];
        }
    }

    /**
     * Envia notificações de inicialização quando a sessão estiver conectada
     */
    async sendInitializationNotifications() {
        try {
            this.addLog('info', `Enviando notificações de inicialização...`);
            
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
            
            // Preparar mensagem
            const mensagem = `✅ Sessão WhatsApp Baileys do RatixPay foi inicializada e está pronta para uso!\n\n` +
                `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `O sistema de notificações WhatsApp está ativo e funcionando corretamente.`;
            
            // Enviar WhatsApp para admin
            const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
            try {
                await this.sendMessage(adminPhone, mensagem, null);
                this.addLog('success', `WhatsApp enviado para admin: ${adminPhone}`);
            } catch (error) {
                this.addLog('warning', `Erro ao enviar WhatsApp para admin: ${error.message}`);
            }
            
            this.addLog('success', `Notificações de inicialização enviadas com sucesso!`);
            
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
            const state = {
                timestamp: new Date().toISOString(),
                session: null
            };

            if (this.session) {
                state.session = {
                    stats: this.session.stats,
                    reconnectAttempts: this.session.reconnectAttempts,
                    lastReconnectAttempt: this.session.lastReconnectAttempt,
                    connectedAt: this.session.connectedAt
                };
            }

            await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('Erro ao salvar estado:', error.message);
        }
    }

    /**
     * Carrega estado persistido das sessões
     */
    async loadPersistedState() {
        try {
            const data = await fs.readFile(this.stateFile, 'utf8');
            const state = JSON.parse(data);
            
            // Estado será aplicado quando as sessões forem criadas
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
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
            }
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
            }
            if (this.statePersistInterval) clearInterval(this.statePersistInterval);

            // Salvar estado final
            await this.saveState();

            // Desconectar sessão
            if (this.session && this.session.socket) {
                try {
                    await Promise.race([
                        new Promise((resolve) => {
                            this.session.socket.end(undefined);
                            resolve();
                        }),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Timeout')), this.config.gracefulShutdownTimeout)
                        )
                    ]);
                } catch (error) {
                    console.warn(`Timeout no graceful shutdown. Forçando encerramento...`);
                }
            }

            console.log('✅ Graceful shutdown concluído');
            process.exit(0);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Helper para enviar notificação de forma segura
     * Verifica se a sessão está conectada antes de enviar
     * Se não estiver disponível, ignora silenciosamente
     */
    async sendNotificationSafely(phoneNumber, message, media = null, sessionId = 'default') {
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            
            const status = this.getStatus();
            if (!status.exists || !status.isConnected) {
                // Não logar warning - apenas ignorar silenciosamente
                return { success: false, error: 'Sessão não conectada', ignored: true };
            }
            return await this.sendMessage(phoneNumber, message, media);
        } catch (error) {
            // Ignorar silenciosamente se Baileys não estiver disponível
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            // Logar apenas erros não relacionados à disponibilidade
            this.addLog('error', `Erro ao enviar notificação para ${phoneNumber}: ${error.message}`);
            return { success: false, error: error.message, ignored: true };
        }
    }

    // Métodos de compatibilidade com API antiga (para manter compatibilidade)
    async getSession(sessionId = 'default') {
        return await this.initialize(sessionId);
    }

    getSessionStatus(sessionId = 'default') {
        return this.getStatus(sessionId);
    }

    // Método já implementado acima, não precisa duplicar

    getValidSessionTypes() {
        return ['default'];
    }

    isValidSessionType(sessionId) {
        // Sempre aceitar 'default', ignorar outros
        return sessionId === 'default' || !sessionId;
    }

    async resetSession(sessionId = 'default') {
        return await this.reset(sessionId);
    }

    async deleteSession(sessionId = 'default') {
        return await this.delete(sessionId);
    }

    async testSession(testPhoneNumber, sessionId = 'default') {
        return await this.test(testPhoneNumber, sessionId);
    }
}

// Exportar instância singleton
module.exports = new WhatsAppBaileysManager();

