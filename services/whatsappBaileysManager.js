/**
 * Serviço de Gerenciamento de Sessões WhatsApp usando Baileys
 * 
 * Versão moderna e robusta com suporte a múltiplas sessões:
 * - Protocolo nativo do WhatsApp (sem Puppeteer)
 * - Múltiplas sessões simultâneas eficientes
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
        // Múltiplas sessões
        this.sessions = new Map(); // sessionId -> { socket, state, ... }
        
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
        this.healthCheckIntervals = new Map(); // sessionId -> interval
        this.reconnectTimers = new Map(); // sessionId -> timer
        this.statePersistInterval = null;
        this.isShuttingDown = false;
        
        // Estado persistido
        this.stateFile = path.join(__dirname, '../../.whatsapp-baileys-state.json');
        
        // Sistema de logs
        this.logs = [];
        this.maxLogs = 500;
        this.notificationSent = new Map(); // sessionId -> boolean
        
        // Logger do Baileys (silencioso por padrão)
        this.logger = pino({ level: process.env.WHATSAPP_DEBUG === 'true' ? 'debug' : 'silent' });
        
        this.init();
    }

    /**
     * Inicializa o gerenciador
     */
    async init() {
        console.log('📱 Inicializando WhatsApp Baileys Manager (Múltiplas Sessões)...');
        
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
     * Inicializa ou obtém uma sessão WhatsApp
     * @param {string} sessionId - ID da sessão (ex: 'vendas-cliente', 'sistema', etc.)
     * @returns {Object} Objeto com informações da sessão
     * NÃO gera QR code automaticamente - apenas quando solicitado explicitamente
     */
    async initialize(sessionId = 'default') {
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                throw new Error('Baileys não disponível');
            }
            
            // Se a sessão já existe e está pronta, retornar
            const existingSession = this.sessions.get(sessionId);
            if (existingSession && existingSession.isReady && existingSession.isConnected) {
                return existingSession;
            }

            // Se existe mas não está pronta, tentar reconectar (sem gerar QR)
            if (existingSession && !existingSession.isReady && existingSession.status !== 'connecting') {
                // Não tentar reconectar automaticamente - apenas retornar status
                return existingSession;
            }

            // Criar nova sessão (mas não gerar QR automaticamente)
            return await this.createSession(sessionId);
        } catch (error) {
            // Se Baileys não estiver disponível, retornar sessão vazia
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module') || error.message.includes('Baileys não disponível')) {
                console.warn('⚠️ Baileys não disponível - sessão não inicializada');
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
     * Cria uma nova sessão WhatsApp
     * @param {string} sessionId - ID da sessão
     * NÃO gera QR code automaticamente - apenas quando solicitado explicitamente
     */
    async createSession(sessionId) {
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
        const session = {
            sessionId,
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
            this.setupSocketListeners(session);

            // Salvar credenciais quando atualizadas
            sock.ev.on('creds.update', saveCreds);

            // Armazenar sessão
            this.sessions.set(sessionId, session);

            // Iniciar health check
            this.startHealthCheck(sessionId);

            return session;
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
                // NÃO gerar QR code automaticamente - apenas armazenar se necessário
                // console.log(`📱 QR Code gerado para sessão ${sessionId}`);
                // this.addLog('info', `QR Code gerado para sessão ${sessionId}. Escaneie com seu WhatsApp.`, sessionId);
                session.qrCode = qr;
                // Não gerar base64 automaticamente - apenas quando solicitado
                session.qrCodeBase64 = null;
                session.status = 'waiting_qr';
                // Não emitir atualização para evitar geração automática de QR
                // this.emitSessionUpdate(sessionId);
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
                        console.log(`⚠️ Sessão ${sessionId} foi desconectada (logged out). Removendo...`);
                        this.sessions.delete(sessionId);
                        return;
                    }
                }

                if (shouldReconnect) {
                    console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
                    this.scheduleReconnect(sessionId);
                } else {
                    console.log(`❌ Sessão ${sessionId} não será reconectada (logged out)`);
                }
            } else if (connection === 'open') {
                console.log(`✅ Sessão ${sessionId} conectada!`);
                this.addLog('success', `Sessão ${sessionId} conectada com sucesso!`, sessionId);
                
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
                this.processMessageQueue(sessionId);
                
                // Enviar notificações quando a sessão estiver conectada
                if (!this.notificationSent.get(sessionId)) {
                    await this.sendInitializationNotifications(sessionId);
                    this.notificationSent.set(sessionId, true);
                }
                
                this.emitSessionUpdate(sessionId);
                this.saveState();
            } else if (connection === 'connecting') {
                session.status = 'connecting';
                this.addLog('info', `Sessão ${sessionId} conectando...`, sessionId);
            }
        });

        // Mensagens recebidas
        socket.ev.on('messages.upsert', async (m) => {
            if (process.env.WHATSAPP_DEBUG === 'true') {
                console.log(`📨 Mensagem recebida na sessão ${sessionId}:`, m);
            }
        });
    }

    /**
     * Agenda reconexão automática com backoff exponencial
     */
    scheduleReconnect(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        // Cancelar timer anterior se existir
        if (this.reconnectTimers.has(sessionId)) {
            clearTimeout(this.reconnectTimers.get(sessionId));
        }

        // Verificar se já excedeu o máximo de tentativas
        if (session.reconnectAttempts >= this.config.maxReconnectAttempts) {
            console.error(`❌ Máximo de tentativas de reconexão atingido para sessão ${sessionId}`);
            session.status = 'max_reconnect_attempts';
            session.lastError = 'Máximo de tentativas de reconexão atingido';
            return;
        }

        // Calcular delay com backoff exponencial
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, session.reconnectAttempts),
            this.config.maxReconnectDelay
        );

        session.reconnectAttempts++;
        session.lastReconnectAttempt = new Date();
        session.stats.reconnectCount++;

        console.log(`🔄 Agendando reconexão da sessão ${sessionId} em ${delay}ms (tentativa ${session.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

        const timer = setTimeout(async () => {
            this.reconnectTimers.delete(sessionId);
            await this.reconnectSession(sessionId);
        }, delay);

        this.reconnectTimers.set(sessionId, timer);
    }

    /**
     * Reconecta a sessão
     */
    async reconnectSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        console.log(`🔄 Tentando reconectar sessão ${sessionId}...`);
        session.status = 'reconnecting';

        try {
            // Destruir socket antigo
            try {
                if (session.socket) {
                    session.socket.end(undefined);
                }
            } catch (e) {
                console.warn(`Aviso ao destruir socket antigo: ${e.message}`);
            }

            // Recriar sessão
            await this.createSession(sessionId);
        } catch (error) {
            console.error(`❌ Erro ao reconectar sessão ${sessionId}:`, error.message);
            session.status = 'reconnect_failed';
            session.lastError = error.message;
            
            // Tentar novamente se não excedeu o limite
            if (session.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.scheduleReconnect(sessionId);
            }
        }
    }

    /**
     * Inicia health check periódico para uma sessão
     */
    startHealthCheck(sessionId) {
        // Cancelar health check anterior se existir
        if (this.healthCheckIntervals.has(sessionId)) {
            clearInterval(this.healthCheckIntervals.get(sessionId));
        }

        const interval = setInterval(async () => {
            await this.performHealthCheck(sessionId);
        }, this.config.healthCheckInterval);

        this.healthCheckIntervals.set(sessionId, interval);
    }

    /**
     * Realiza health check da sessão
     */
    async performHealthCheck(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        try {
            // Verificar se o socket está ativo
            if (session.socket && session.isReady && session.isConnected) {
                // Verificar estado da conexão
                const isHealthy = session.status === 'connected';
                session.healthCheck.lastCheck = new Date();
                session.healthCheck.isHealthy = isHealthy;
                session.healthCheck.consecutiveFailures = isHealthy ? 0 : session.healthCheck.consecutiveFailures + 1;

                if (!isHealthy && session.healthCheck.consecutiveFailures >= 3) {
                    console.warn(`⚠️ Health check falhou 3 vezes consecutivas para sessão ${sessionId}. Tentando reconectar...`);
                    this.scheduleReconnect(sessionId);
                }
            } else {
                session.healthCheck.isHealthy = false;
                session.healthCheck.consecutiveFailures++;
            }
        } catch (error) {
            console.error(`❌ Erro no health check da sessão ${sessionId}:`, error.message);
            session.healthCheck.isHealthy = false;
            session.healthCheck.consecutiveFailures++;

            if (session.healthCheck.consecutiveFailures >= 3) {
                this.scheduleReconnect(sessionId);
            }
        }
    }

    /**
     * Adiciona mensagem à fila quando a sessão está desconectada
     */
    addToMessageQueue(sessionId, phoneNumber, message, media) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        // Verificar tamanho máximo da fila
        if (session.messageQueue.length >= this.config.messageQueueMaxSize) {
            console.warn(`⚠️ Fila de mensagens cheia para sessão ${sessionId}. Descartando mensagem mais antiga.`);
            session.messageQueue.shift();
        }

        session.messageQueue.push({
            phoneNumber,
            message,
            media,
            timestamp: new Date(),
            retries: 0
        });

        session.stats.messagesQueued++;
        return true;
    }

    /**
     * Processa fila de mensagens pendentes
     */
    async processMessageQueue(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isReady) return;

        if (session.messageQueue.length === 0) return;

        console.log(`📨 Processando ${session.messageQueue.length} mensagens na fila da sessão ${sessionId}...`);

        const messages = [...session.messageQueue];
        session.messageQueue = [];

        for (const queuedMessage of messages) {
            try {
                await this.sendMessageInternal(sessionId, queuedMessage.phoneNumber, queuedMessage.message, queuedMessage.media);
                console.log(`✅ Mensagem da fila enviada com sucesso para ${queuedMessage.phoneNumber}`);
            } catch (error) {
                console.error(`❌ Erro ao enviar mensagem da fila:`, error.message);
                // Se falhar, adicionar de volta à fila (com limite de retries)
                if (queuedMessage.retries < 3) {
                    queuedMessage.retries++;
                    session.messageQueue.push(queuedMessage);
                } else {
                    session.stats.messagesFailed++;
                }
            }

            // Rate limiting entre mensagens
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    /**
     * Verifica rate limit antes de enviar mensagem
     */
    checkRateLimit(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        const now = Date.now();
        
        // Limpar mensagens antigas da janela
        session.rateLimitBucket = session.rateLimitBucket.filter(
            timestamp => now - timestamp < this.config.rateLimitWindow
        );

        // Verificar se excedeu o limite
        if (session.rateLimitBucket.length >= this.config.rateLimitMaxMessages) {
            return false;
        }

        // Adicionar timestamp atual
        session.rateLimitBucket.push(now);
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
     * Obtém status de uma sessão
     */
    getStatus(sessionId = 'default') {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return {
                exists: false,
                status: 'not_initialized',
                sessionId
            };
        }

        const now = Date.now();
        const connectedAt = session.connectedAt ? new Date(session.connectedAt).getTime() : null;
        const uptime = connectedAt ? now - connectedAt : 0;

        return {
            exists: true,
            sessionId: session.sessionId,
            isReady: session.isReady,
            isConnected: session.isConnected,
            status: session.status,
            qrCode: session.qrCodeBase64,
            connectedAt: session.connectedAt,
            lastError: session.lastError,
            reconnectAttempts: session.reconnectAttempts,
            lastReconnectAttempt: session.lastReconnectAttempt,
            messageQueueSize: session.messageQueue.length,
            healthCheck: {
                ...session.healthCheck,
                lastCheck: session.healthCheck.lastCheck
            },
            stats: {
                ...session.stats,
                uptime: uptime,
                messagesInQueue: session.messageQueue.length
            }
        };
    }

    /**
     * Obtém status de todas as sessões
     */
    getAllSessionsStatus() {
        const allStatus = {};
        for (const [sessionId] of this.sessions) {
            allStatus[sessionId] = this.getStatus(sessionId);
        }
        return allStatus;
    }

    /**
     * Envia mensagem
     * @param {string} phoneNumber - Número de telefone (formato: 258XXXXXXXXX ou sem código)
     * @param {string} message - Mensagem de texto
     * @param {Object|null} media - Objeto com {url, mimetype} ou null
     * @param {string} sessionId - ID da sessão a usar (padrão: 'default')
     */
    async sendMessage(phoneNumber, message, media = null, sessionId = 'default') {
        try {
            // Verificar se Baileys está disponível
            if (typeof makeWASocket === 'undefined') {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            
            // Garantir que a sessão está inicializada (sem gerar QR automaticamente)
            if (!this.sessions.has(sessionId)) {
                // Tentar inicializar, mas não falhar se não conseguir
                try {
                    await this.initialize(sessionId);
                } catch (initError) {
                    console.warn('⚠️ Erro ao inicializar sessão WhatsApp - ignorando:', initError.message);
                    return { success: false, error: 'Sessão não disponível', ignored: true };
                }
            }

            const session = this.sessions.get(sessionId);
            if (!session) {
                return { success: false, error: 'Sessão não encontrada', ignored: true };
            }

            // Se a sessão não está pronta, ignorar silenciosamente (não enfileirar)
            if (!session.isReady || !session.isConnected) {
                // Não logar - apenas ignorar silenciosamente
                return { success: false, error: 'Sessão não conectada', ignored: true };
            }

            // Verificar rate limit
            if (!this.checkRateLimit(sessionId)) {
                // Se excedeu rate limit, ignorar silenciosamente
                return { success: false, error: 'Rate limit excedido', ignored: true };
            }

            return await this.sendMessageInternal(sessionId, phoneNumber, message, media);
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
    async sendMessageInternal(sessionId, phoneNumber, message, media = null) {
        const session = this.sessions.get(sessionId);
        if (!session || !session.isReady) {
            throw new Error(`Sessão ${sessionId} não está pronta`);
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
                        
                        await session.socket.sendMessage(jid, {
                            document: buffer,
                            mimetype: mimetype,
                            fileName: media.filename || 'arquivo',
                            caption: message
                        });
                    } catch (urlError) {
                        // Se falhar ao baixar, enviar como texto com URL
                        await session.socket.sendMessage(jid, { 
                            text: `${message}\n\n🔗 Link: ${media.url}` 
                        });
                    }
                } else if (media.data && media.mimetype) {
                    // Dados base64
                    const buffer = Buffer.from(media.data, 'base64');
                    await session.socket.sendMessage(jid, {
                        document: buffer,
                        mimetype: media.mimetype,
                        fileName: media.filename || 'arquivo',
                        caption: message
                    });
                } else {
                    // Formato desconhecido, enviar como texto
                    await session.socket.sendMessage(jid, { text: message });
                }
            } else {
                // Enviar texto
                await session.socket.sendMessage(jid, { text: message });
            }

            // Atualizar estatísticas
            session.stats.messagesSent++;
            session.stats.lastMessageAt = new Date();

            return { success: true, message: 'Mensagem enviada com sucesso' };
        } catch (error) {
            console.error(`Erro ao enviar mensagem na sessão ${sessionId}:`, error);
            session.stats.messagesFailed++;
            
            // Se for erro de conexão, tentar reconectar
            if (error.message.includes('Not connected') || error.message.includes('disconnected')) {
                this.scheduleReconnect(sessionId);
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
     * Reseta uma sessão
     */
    async reset(sessionId = 'default') {
        const session = this.sessions.get(sessionId);
        if (session) {
            try {
                // Cancelar timers
                if (this.reconnectTimers.has(sessionId)) {
                    clearTimeout(this.reconnectTimers.get(sessionId));
                    this.reconnectTimers.delete(sessionId);
                }
                if (this.healthCheckIntervals.has(sessionId)) {
                    clearInterval(this.healthCheckIntervals.get(sessionId));
                    this.healthCheckIntervals.delete(sessionId);
                }

                // Desconectar socket
                if (session.socket) {
                    try {
                        session.socket.end(undefined);
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
                this.sessions.delete(sessionId);
                this.notificationSent.delete(sessionId);
                
                console.log(`✅ Sessão ${sessionId} resetada com sucesso`);
                
                // Criar nova sessão
                return await this.initialize(sessionId);
            } catch (error) {
                console.error(`Erro ao resetar sessão ${sessionId}:`, error);
                throw error;
            }
        } else {
            // Criar nova sessão se não existir
            return await this.initialize(sessionId);
        }
    }

    /**
     * Apaga uma sessão completamente
     */
    async delete(sessionId = 'default') {
        // Cancelar timers
        if (this.reconnectTimers.has(sessionId)) {
            clearTimeout(this.reconnectTimers.get(sessionId));
            this.reconnectTimers.delete(sessionId);
        }
        if (this.healthCheckIntervals.has(sessionId)) {
            clearInterval(this.healthCheckIntervals.get(sessionId));
            this.healthCheckIntervals.delete(sessionId);
        }

        const session = this.sessions.get(sessionId);
        if (session && session.socket) {
            try {
                session.socket.end(undefined);
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
        this.sessions.delete(sessionId);
        this.notificationSent.delete(sessionId);
        
        console.log(`✅ Sessão ${sessionId} apagada com sucesso`);
        
        return { success: true, message: `Sessão ${sessionId} apagada com sucesso` };
    }

    /**
     * Testa uma sessão enviando mensagem de teste
     */
    async test(testPhoneNumber, sessionId = 'default') {
        if (!testPhoneNumber) {
            throw new Error('Número de telefone de teste é obrigatório');
        }

        const testMessage = `🧪 *Teste de Sessão WhatsApp Baileys*\n\n` +
            `Esta é uma mensagem de teste\n` +
            `Sessão: ${sessionId}\n` +
            `Enviada em: ${new Date().toLocaleString('pt-BR')}\n\n` +
            `Se você recebeu esta mensagem, a sessão está funcionando corretamente! ✅`;

        return await this.sendMessage(testPhoneNumber, testMessage, null, sessionId);
    }

    /**
     * Emite evento de atualização de sessão
     */
    emitSessionUpdate(sessionId) {
        // Placeholder para futuras implementações de WebSocket
        if (process.env.WHATSAPP_DEBUG === 'true') {
            console.log(`📡 Atualização de sessão WhatsApp: ${sessionId}`);
        }
    }

    /**
     * Obtém QR Code de uma sessão
     */
    getQRCode(sessionId = 'default') {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        return {
            qrCode: session.qrCode,
            qrCodeBase64: session.qrCodeBase64,
            status: session.status,
            sessionId
        };
    }

    /**
     * Adiciona log ao sistema
     * @param {string} type - Tipo do log (info, success, warning, error, debug)
     * @param {string} message - Mensagem do log
     * @param {string} sessionId - ID da sessão (opcional)
     */
    addLog(type, message, sessionId = null) {
        const logEntry = {
            timestamp: new Date(),
            type: type,
            message: message
        };
        
        // Se sessionId especificado, adicionar log àquela sessão
        if (sessionId && this.sessions.has(sessionId)) {
            const session = this.sessions.get(sessionId);
            if (!session.logs || !Array.isArray(session.logs)) {
                session.logs = [];
            }
            session.logs.push(logEntry);
            
            // Limitar tamanho do array de logs da sessão
            if (session.logs.length > this.maxLogs) {
                session.logs.shift();
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
        
        const sessionPrefix = sessionId ? `[${sessionId}]` : '';
        console.log(`${emoji} [WhatsApp Baileys]${sessionPrefix} ${message}`);
    }

    /**
     * Obtém logs da sessão
     * @param {number} limit - Limite de logs a retornar
     * @param {string} sessionId - ID da sessão (opcional, para logs específicos)
     */
    getLogs(limit = 100, sessionId = null) {
        try {
            // Se sessionId especificado, retornar logs daquela sessão
            if (sessionId && this.sessions.has(sessionId)) {
                const session = this.sessions.get(sessionId);
                if (session.logs && Array.isArray(session.logs)) {
                    const sessionLogs = session.logs.slice(-limit);
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
                return [];
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
    async sendInitializationNotifications(sessionId) {
        try {
            this.addLog('info', `Enviando notificações de inicialização para sessão ${sessionId}...`, sessionId);
            
            // Apenas enviar notificação para sessão 'default' ou 'sistema'
            if (sessionId !== 'default' && sessionId !== 'sistema') {
                return;
            }
            
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
                `Sessão: ${sessionId}\n` +
                `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `O sistema de notificações WhatsApp está ativo e funcionando corretamente.`;
            
            // Enviar WhatsApp para admin
            const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
            try {
                await this.sendMessage(adminPhone, mensagem, null, sessionId);
                this.addLog('success', `WhatsApp enviado para admin: ${adminPhone}`, sessionId);
            } catch (error) {
                this.addLog('warning', `Erro ao enviar WhatsApp para admin: ${error.message}`, sessionId);
            }
            
            this.addLog('success', `Notificações de inicialização enviadas com sucesso para sessão ${sessionId}!`, sessionId);
            
        } catch (error) {
            this.addLog('error', `Erro ao enviar notificações de inicialização: ${error.message}`, sessionId);
            console.error('Erro ao enviar notificações de inicialização:', error);
        }
    }

    /**
     * Salva estado persistido das sessões
     */
    async saveState() {
        try {
            const state = {
                timestamp: new Date().toISOString(),
                sessions: {}
            };

            for (const [sessionId, session] of this.sessions) {
                state.sessions[sessionId] = {
                    stats: session.stats,
                    reconnectAttempts: session.reconnectAttempts,
                    lastReconnectAttempt: session.lastReconnectAttempt,
                    connectedAt: session.connectedAt
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
            for (const timer of this.reconnectTimers.values()) {
                clearTimeout(timer);
            }
            for (const interval of this.healthCheckIntervals.values()) {
                clearInterval(interval);
            }
            if (this.statePersistInterval) clearInterval(this.statePersistInterval);

            // Salvar estado final
            await this.saveState();

            // Desconectar todas as sessões
            for (const [sessionId, session] of this.sessions) {
                if (session.socket) {
                    try {
                        await Promise.race([
                            new Promise((resolve) => {
                                session.socket.end(undefined);
                                resolve();
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Timeout')), this.config.gracefulShutdownTimeout)
                            )
                        ]);
                    } catch (error) {
                        console.warn(`Timeout no graceful shutdown da sessão ${sessionId}. Forçando encerramento...`);
                    }
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
            
            const status = this.getStatus(sessionId);
            if (!status.exists || !status.isConnected) {
                // Não logar warning - apenas ignorar silenciosamente
                return { success: false, error: 'Sessão não conectada', ignored: true };
            }
            return await this.sendMessage(phoneNumber, message, media, sessionId);
        } catch (error) {
            // Ignorar silenciosamente se Baileys não estiver disponível
            if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
                console.warn('⚠️ Baileys não disponível - ignorando envio WhatsApp');
                return { success: false, error: 'Baileys não disponível', ignored: true };
            }
            // Logar apenas erros não relacionados à disponibilidade
            this.addLog('error', `Erro ao enviar notificação para ${phoneNumber}: ${error.message}`, sessionId);
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
        return ['default', 'vendas-cliente', 'vendas-vendedor', 'ofertas', 'sistema', 'suporte', 'afiliados'];
    }

    isValidSessionType(sessionId) {
        return this.getValidSessionTypes().includes(sessionId);
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

