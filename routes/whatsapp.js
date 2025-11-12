/**
 * Rotas para gerenciamento do WhatsApp
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const Venda = require('../models/Venda');
const Produto = require('../models/Produto');
const WhatsappMessage = require('../models/WhatsappMessage');
const { authenticateToken } = require('../middleware/auth');

// URL base para a API do bot WhatsApp
const BOT_API_URL = 'http://localhost:3001/api';

// Obter status do serviço WhatsApp
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const response = await axios.get(`${BOT_API_URL}/status`);
        res.json({
            success: true,
            status: response.data
        });
    } catch (error) {
        console.error('Erro ao obter status do WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter status do WhatsApp',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Reiniciar serviço WhatsApp
router.post('/restart', authenticateToken, async (req, res) => {
    try {
        // Chamar a API do bot para reiniciar
        const response = await axios.post(`${BOT_API_URL}/restart`);
        
        if (response.data.success) {
            res.json({
                success: true,
                message: 'Serviço WhatsApp reiniciado com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Erro ao reiniciar serviço WhatsApp'
            });
        }
    } catch (error) {
        console.error('Erro ao reiniciar WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao reiniciar serviço WhatsApp',
            error: error.message
        });
    }
});

// Enviar mensagem WhatsApp
router.post('/send-message', authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone e mensagem são obrigatórios'
            });
        }
        
        // Chamar a API do bot para enviar mensagem
        const response = await axios.post(`${BOT_API_URL}/send-message`, {
            phoneNumber,
            message
        });
        
        if (response.data.success) {
            res.json({
                success: true,
                message: 'Mensagem enviada com sucesso',
                data: response.data
            });
        } else {
            res.status(500).json({
                success: false,
                message: response.data.message || 'Erro ao enviar mensagem'
            });
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar mensagem WhatsApp',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Enviar confirmação de compra manualmente
router.post('/send-purchase-confirmation/:vendaId', authenticateToken, async (req, res) => {
    try {
        const { vendaId } = req.params;
        
        // Buscar venda
        const venda = await Venda.findById(vendaId);
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar produto
        const produto = await Produto.findById(venda.produtoId);
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Formatar mensagem de confirmação
        const mensagem = `✅ *Confirmação de Compra*\n\n` +
            `Olá ${venda.nomeCliente || 'Cliente'},\n\n` +
            `Sua compra do produto *${produto.nome}* foi confirmada!\n` +
            `*Valor:* ${venda.valor.toFixed(2)} ${venda.moeda}\n` +
            `*Data:* ${new Date(venda.dataVenda).toLocaleString('pt-BR')}\n\n` +
            `Obrigado pela preferência!`;
        
        // Chamar a API do bot para enviar confirmação
        const response = await axios.post(`${BOT_API_URL}/send-message`, {
            phoneNumber: venda.telefoneCliente,
            message: mensagem
        });
        
        if (response.data.success) {
            res.json({
                success: true,
                message: 'Confirmação de compra enviada com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: response.data.message || 'Erro ao enviar confirmação de compra'
            });
        }
    } catch (error) {
        console.error('Erro ao enviar confirmação de compra:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar confirmação de compra',
            error: error.message
        });
    }
});

// Enviar notificação de venda
router.post('/notify-sale', authenticateToken, async (req, res) => {
    try {
        const { vendaId } = req.body;
        
        if (!vendaId) {
            return res.status(400).json({
                success: false,
                message: 'ID da venda é obrigatório'
            });
        }
        
        // Buscar dados da venda
        const venda = await Venda.findById(vendaId);
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar dados do produto
        const produto = await Produto.findById(venda.produtoId);
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Formatar mensagem de notificação
        const numeroPedido = venda.numero_pedido || (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6 ? venda.pagamento_transacao_id : null) || (venda.pagamento_referencia && venda.pagamento_referencia.length === 6 ? venda.pagamento_referencia : null) || venda.id;
        const mensagem = `🎉 *Nova Venda Realizada! - Pedido #${numeroPedido}*\n\n` +
            `*Produto:* ${produto.nome}\n` +
            `*Valor:* ${venda.valor.toFixed(2)} ${venda.moeda}\n` +
            `*Cliente:* ${venda.nomeCliente || 'Não informado'}\n` +
            `*Status:* ${venda.status}\n` +
            `*Data:* ${new Date(venda.dataVenda).toLocaleString('pt-BR')}\n\n` +
            `Acesse o painel para mais detalhes.`;
        
        // Formatar número de telefone para notificação (número do administrador)
        const phoneNumber = process.env.ADMIN_PHONE || '258867792543';
        
        // Chamar a API do bot para enviar notificação
        const response = await axios.post(`${BOT_API_URL}/send-message`, {
            phoneNumber,
            message: mensagem
        });
        
        if (response.data.success) {
            res.json({
                success: true,
                message: 'Notificação de venda enviada com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: response.data.message || 'Erro ao enviar notificação de venda'
            });
        }
    } catch (error) {
        console.error('Erro ao enviar notificação de venda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar notificação de venda',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Obter histórico de mensagens por venda
router.get('/messages/:vendaId', authenticateToken, async (req, res) => {
    try {
        const { vendaId } = req.params;
        
        // Buscar venda para verificar se existe
        const venda = await Venda.findById(vendaId);
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar mensagens
        const messages = await WhatsappMessage.findByVendaId(vendaId);
        
        res.json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Erro ao obter histórico de mensagens:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter histórico de mensagens',
            error: error.message
        });
    }
});

// Obter estatísticas de mensagens
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, messageType } = req.query;
        
        const options = {};
        if (startDate) options.startDate = new Date(startDate);
        if (endDate) options.endDate = new Date(endDate);
        if (messageType) options.messageType = messageType;
        
        const stats = await WhatsappMessage.getStats(options);
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas de mensagens:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas de mensagens',
            error: error.message
        });
    }
});

// Obter QR Code para autenticação do WhatsApp
router.get('/qrcode', authenticateToken, async (req, res) => {
    try {
        // Usar o serviço WhatsApp Bot diretamente
        const whatsappBotService = require('../services/whatsappBotService');
        
        // Verificar se já existe um QR code
        let qrCode = whatsappBotService.getCurrentQR();
        
        if (!qrCode) {
            // Tentar gerar novo QR code
            console.log('📱 Gerando novo QR code...');
            const success = await whatsappBotService.generateManualQR();
            
            if (success) {
                // Aguardar um pouco para o QR ser processado
                await new Promise(resolve => setTimeout(resolve, 2000));
                qrCode = whatsappBotService.getCurrentQR();
            }
        }
        
        if (qrCode) {
            res.json({
                success: true,
                qrcode: qrCode,
                message: 'QR Code gerado com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'QR Code não disponível. Tente novamente em alguns segundos.'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao obter QR Code:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar QR Code',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Gerar novo QR Code manualmente
router.post('/qrcode/generate', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        
        console.log('📱 Gerando novo QR code manualmente...');
        const success = await whatsappBotService.generateManualQR();
        
        if (success) {
            // Aguardar um pouco para o QR ser processado
            await new Promise(resolve => setTimeout(resolve, 3000));
            const qrCode = whatsappBotService.getCurrentQR();
            
            if (qrCode) {
                res.json({
                    success: true,
                    qrcode: qrCode,
                    message: 'Novo QR Code gerado com sucesso'
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'QR Code não foi gerado. Tente novamente.'
                });
            }
        } else {
            res.status(500).json({
                success: false,
                message: 'Falha ao gerar QR Code'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao gerar QR Code:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar QR Code',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Obter status do WhatsApp Bot
router.get('/status', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        const status = whatsappBotService.getStatus();
        
        res.json({
            success: true,
            status
        });
    } catch (error) {
        console.error('❌ Erro ao obter status do WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter status',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Limpar sessões conflitantes
router.post('/cleanup-sessions', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        
        console.log('🧹 Limpeza manual de sessões conflitantes solicitada');
        await whatsappBotService.cleanupConflictingSessions();
        
        res.json({
            success: true,
            message: 'Sessões conflitantes removidas com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao limpar sessões conflitantes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao limpar sessões conflitantes',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Forçar reconexão
router.post('/force-reconnect', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        
        console.log('🔄 Reconexão forçada solicitada');
        const success = await whatsappBotService.forceReconnect();
        
        if (success) {
            res.json({
                success: true,
                message: 'Reconexão forçada realizada com sucesso'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Falha na reconexão forçada'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao forçar reconexão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao forçar reconexão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Parar reconexão automática
router.post('/stop-reconnection', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        
        console.log('🛑 Parada de reconexão solicitada');
        whatsappBotService.stopReconnection();
        
        res.json({
            success: true,
            message: 'Reconexão automática parada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao parar reconexão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao parar reconexão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// Gerar novo QR code
router.post('/generate-qr', authenticateToken, async (req, res) => {
    try {
        const whatsappBotService = require('../services/whatsappBotService');
        
        console.log('📱 Geração de QR code solicitada');
        const success = await whatsappBotService.generateManualQR();
        
        if (success) {
            const qrCode = whatsappBotService.getCurrentQR();
            res.json({
                success: true,
                message: 'QR code gerado com sucesso',
                qrCode: qrCode
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Falha ao gerar QR code'
            });
        }
    } catch (error) {
        console.error('❌ Erro ao gerar QR code:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar QR code',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// ==================== ROTAS DE GERENCIAMENTO DE SESSÃO WHATSAPP ====================

const whatsappManager = require('../services/whatsappManager');

// GET - Obter status da sessão
router.get('/session', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.query.sessionId || 'default';
        let status = whatsappManager.getStatus(sessionId);
        
        // Se tem QR string mas não tem base64, gerar agora
        if (status && status.qrCode === null) {
            const qrData = whatsappManager.getQRCode(sessionId);
            if (qrData && qrData.qrCode && !qrData.qrCodeBase64) {
                try {
                    const base64 = await whatsappManager.generateQRBase64(qrData.qrCode);
                    if (base64) {
                        // Atualizar status com QR Code base64
                        status.qrCode = base64;
                    }
                } catch (error) {
                    console.error('❌ Erro ao gerar QR code base64 na rota de status:', error);
                }
            } else if (qrData && qrData.qrCodeBase64) {
                status.qrCode = qrData.qrCodeBase64;
            }
        }
        
        res.json({
            success: true,
            session: status
        });
    } catch (error) {
        console.error('❌ Erro ao obter status da sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter status da sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// GET - Obter logs da sessão
router.get('/session/logs', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const sessionId = req.query.sessionId || 'default';
        
        // Obter logs com sessionId específico se suportado
        let logs;
        try {
            logs = whatsappManager.getLogs(limit, sessionId);
        } catch (e) {
            // Fallback para método sem sessionId
            logs = whatsappManager.getLogs(limit);
        }
        
        // Garantir que logs é um array
        const safeLogs = Array.isArray(logs) ? logs : [];
        
        // Cache headers para reduzir requisições desnecessárias
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        
        res.json({
            success: true,
            logs: safeLogs,
            count: safeLogs.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Erro ao obter logs da sessão:', error);
        
        // Retornar array vazio em caso de erro ao invés de 500
        res.json({
            success: true,
            logs: [],
            count: 0,
            error: error.message || 'Erro ao obter logs'
        });
    }
});

// POST - Criar/inicializar a sessão
router.post('/session', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.body.sessionId || 'default';
        console.log(`📱 Criando/inicializando sessão WhatsApp: ${sessionId}`);
        const session = await whatsappManager.initialize(sessionId);
        
        res.json({
            success: true,
            message: 'Sessão criada/inicializada com sucesso',
            session: whatsappManager.getStatus(sessionId)
        });
    } catch (error) {
        console.error('❌ Erro ao criar sessão:', error);
        
        let errorMessage = error.message || 'Erro desconhecido';
        let userMessage = 'Erro ao criar sessão';
        
        // Mensagem mais amigável para erro de Chromium
        if (error.message && (error.message.includes('Could not find expected browser') || error.message.includes('chromium'))) {
            userMessage = 'Chromium não encontrado';
            errorMessage = 'O Puppeteer precisa do Chromium instalado. Execute: npm install puppeteer';
        }
        
        res.status(500).json({
            success: false,
            message: userMessage,
            error: errorMessage,
            needsPuppeteerInstall: error.message && error.message.includes('Could not find expected browser')
        });
    }
});

// GET - Obter QR Code da sessão
router.get('/session/qrcode', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.query.sessionId || 'default';
        // Garantir que a sessão existe
        await whatsappManager.initialize(sessionId);
        
        const qrData = whatsappManager.getQRCode(sessionId);
        
        // Se tem QR string mas não tem base64, gerar agora
        if (qrData && qrData.qrCode && !qrData.qrCodeBase64) {
            try {
                const base64 = await whatsappManager.generateQRBase64(qrData.qrCode);
                if (base64) {
                    qrData.qrCodeBase64 = base64;
                }
            } catch (error) {
                console.error('❌ Erro ao gerar QR code base64 na rota:', error);
            }
        }
        
        if (qrData && qrData.qrCodeBase64) {
            res.json({
                success: true,
                qrCode: qrData.qrCodeBase64,
                qrCodeText: qrData.qrCode,
                status: qrData.status,
                sessionId: qrData.sessionId || sessionId
            });
        } else if (qrData && qrData.qrCode) {
            // Se tem QR string mas base64 falhou, retornar erro
            res.json({
                success: false,
                message: 'Erro ao gerar QR Code. Tente novamente.',
                qrCode: null,
                sessionId
            });
        } else {
            // Se não tem QR, verificar se está conectado
            const status = whatsappManager.getStatus(sessionId);
            if (status.isConnected) {
                res.json({
                    success: true,
                    message: 'Sessão já está conectada, não há QR code',
                    connected: true,
                    sessionId
                });
            } else {
                res.json({
                    success: false,
                    message: 'QR Code ainda não está disponível. Aguarde alguns segundos.',
                    qrCode: null,
                    sessionId
                });
            }
        }
    } catch (error) {
        console.error('❌ Erro ao obter QR code da sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter QR code',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Resetar a sessão
router.post('/session/reset', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.body.sessionId || 'default';
        console.log(`🔄 Resetando sessão WhatsApp: ${sessionId}`);
        const session = await whatsappManager.reset(sessionId);
        
        res.json({
            success: true,
            message: 'Sessão resetada com sucesso',
            session: whatsappManager.getStatus(sessionId)
        });
    } catch (error) {
        console.error('❌ Erro ao resetar sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao resetar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// DELETE - Apagar a sessão
router.delete('/session', authenticateToken, async (req, res) => {
    try {
        const sessionId = req.query.sessionId || 'default';
        console.log(`🗑️ Apagando sessão WhatsApp: ${sessionId}`);
        await whatsappManager.delete(sessionId);
        
        res.json({
            success: true,
            message: 'Sessão apagada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao apagar sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao apagar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Testar a sessão
router.post('/session/test', authenticateToken, async (req, res) => {
    try {
        const { testPhoneNumber } = req.body;
        
        if (!testPhoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone de teste é obrigatório'
            });
        }
        
        console.log(`🧪 Testando sessão WhatsApp com número: ${testPhoneNumber}`);
        const result = await whatsappManager.test(testPhoneNumber);
        
        res.json({
            success: true,
            message: 'Mensagem de teste enviada com sucesso',
            result: result
        });
    } catch (error) {
        console.error('❌ Erro ao testar sessão:', error);
        
        // Se for erro de sessão não existe ou não está pronta, retornar 400
        if (error.message && (error.message.includes('não existe') || error.message.includes('não está pronta'))) {
            return res.status(400).json({
                success: false,
                message: 'Erro ao testar sessão',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro ao testar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Enviar mensagem
router.post('/session/send', authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, message, media } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone e mensagem são obrigatórios'
            });
        }
        
        console.log('📤 Enviando mensagem via sessão WhatsApp');
        const result = await whatsappManager.sendMessage(phoneNumber, message, media);
        
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            result: result
        });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar mensagem',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// ==================== ROTAS COMPATIBILIDADE (MULTIPLAS SESSÕES) ====================
// Mantidas para compatibilidade com código existente, mas todas usam a mesma sessão única

// GET - Listar todas as sessões
router.get('/sessions', authenticateToken, async (req, res) => {
    try {
        const allSessions = whatsappManager.getAllSessionsStatus();
        res.json({
            success: true,
            sessions: {
                'whatsapp-session': status
            }
        });
    } catch (error) {
        console.error('❌ Erro ao listar sessões:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar sessões',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// GET - Obter status de uma sessão específica (compatibilidade)
router.get('/sessions/:sessionType', authenticateToken, async (req, res) => {
    try {
        const status = whatsappManager.getStatus();
        res.json({
            success: true,
            session: status
        });
    } catch (error) {
        console.error('❌ Erro ao obter status da sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter status da sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Criar/inicializar uma sessão (compatibilidade)
router.post('/sessions/:sessionType', authenticateToken, async (req, res) => {
    try {
        console.log('📱 Criando/inicializando sessão WhatsApp');
        const session = await whatsappManager.initialize();
        
        res.json({
            success: true,
            message: 'Sessão criada/inicializada com sucesso',
            session: whatsappManager.getStatus()
        });
    } catch (error) {
        console.error('❌ Erro ao criar sessão:', error);
        
        let errorMessage = error.message || 'Erro desconhecido';
        let userMessage = 'Erro ao criar sessão';
        
        if (error.message && (error.message.includes('Could not find expected browser') || error.message.includes('chromium'))) {
            userMessage = 'Chromium não encontrado';
            errorMessage = 'O Puppeteer precisa do Chromium instalado. Execute: npm install puppeteer';
        }
        
        res.status(500).json({
            success: false,
            message: userMessage,
            error: errorMessage,
            needsPuppeteerInstall: error.message && error.message.includes('Could not find expected browser')
        });
    }
});

// GET - Obter QR Code de uma sessão (compatibilidade)
router.get('/sessions/:sessionType/qrcode', authenticateToken, async (req, res) => {
    try {
        await whatsappManager.initialize();
        const qrData = whatsappManager.getQRCode();
        
        if (qrData && qrData.qrCodeBase64) {
            res.json({
                success: true,
                qrCode: qrData.qrCodeBase64,
                qrCodeText: qrData.qrCode,
                status: qrData.status
            });
        } else {
            const status = whatsappManager.getStatus();
            if (status.isConnected) {
                res.json({
                    success: true,
                    message: 'Sessão já está conectada, não há QR code',
                    connected: true
                });
            } else {
                res.json({
                    success: false,
                    message: 'QR Code ainda não está disponível. Aguarde alguns segundos.',
                    qrCode: null
                });
            }
        }
    } catch (error) {
        console.error('❌ Erro ao obter QR code da sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter QR code',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Resetar uma sessão (compatibilidade)
router.post('/sessions/:sessionType/reset', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Resetando sessão WhatsApp');
        const session = await whatsappManager.reset();
        
        res.json({
            success: true,
            message: 'Sessão resetada com sucesso',
            session: whatsappManager.getStatus()
        });
    } catch (error) {
        console.error('❌ Erro ao resetar sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao resetar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// DELETE - Apagar uma sessão (compatibilidade)
router.delete('/sessions/:sessionType', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ Apagando sessão WhatsApp');
        await whatsappManager.delete();
        
        res.json({
            success: true,
            message: 'Sessão apagada com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao apagar sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao apagar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Testar uma sessão (compatibilidade)
router.post('/sessions/:sessionType/test', authenticateToken, async (req, res) => {
    try {
        const { testPhoneNumber } = req.body;
        
        if (!testPhoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone de teste é obrigatório'
            });
        }
        
        console.log(`🧪 Testando sessão WhatsApp com número: ${testPhoneNumber}`);
        const result = await whatsappManager.test(testPhoneNumber);
        
        res.json({
            success: true,
            message: 'Mensagem de teste enviada com sucesso',
            result: result
        });
    } catch (error) {
        console.error('❌ Erro ao testar sessão:', error);
        
        if (error.message && (error.message.includes('não existe') || error.message.includes('não está pronta'))) {
            return res.status(400).json({
                success: false,
                message: 'Erro ao testar sessão',
                error: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro ao testar sessão',
            error: error.message || 'Erro desconhecido'
        });
    }
});

// POST - Enviar mensagem usando uma sessão específica (compatibilidade)
router.post('/sessions/:sessionType/send', authenticateToken, async (req, res) => {
    try {
        const { phoneNumber, message, media } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({
                success: false,
                message: 'Número de telefone e mensagem são obrigatórios'
            });
        }
        
        console.log('📤 Enviando mensagem via sessão WhatsApp');
        const result = await whatsappManager.sendMessage(phoneNumber, message, media);
        
        res.json({
            success: true,
            message: 'Mensagem enviada com sucesso',
            result: result
        });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar mensagem',
            error: error.message || 'Erro desconhecido'
        });
    }
});

module.exports = router;