const express = require('express');
const router = express.Router();
const whatsappBotService = require('../services/whatsappBotService');

// Rota para verificar status do WhatsApp Bot
router.get('/status', async (req, res) => {
    try {
        const status = whatsappBotService.getStatus();
        res.json(status);
    } catch (error) {
        console.error('Erro ao verificar status do WhatsApp Bot:', error);
        res.json({
            connected: false,
            error: 'Erro de conexão com o bot',
            qr: null
        });
    }
});

// Rota para resetar conexão do WhatsApp Bot
router.post('/reset', async (req, res) => {
    try {
        const success = await whatsappBotService.reset();
        if (success) {
            res.json({ success: true, message: 'Conexão resetada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao resetar conexão' });
        }
    } catch (error) {
        console.error('Erro ao resetar WhatsApp Bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para enviar notificação de teste
router.post('/test', async (req, res) => {
    try {
        const success = await whatsappBotService.sendTestNotification();
        if (success) {
            res.json({ success: true, message: 'Notificação de teste enviada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao enviar notificação de teste' });
        }
    } catch (error) {
        console.error('Erro ao enviar notificação de teste:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para inicializar WhatsApp Bot (apenas quando solicitado manualmente)
router.post('/initialize', async (req, res) => {
    try {
        console.log('🤖 Inicialização manual do WhatsApp Bot solicitada via API...');
        const success = await whatsappBotService.manualInitialize();
        if (success) {
            res.json({ success: true, message: 'WhatsApp Bot inicializado com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao inicializar WhatsApp Bot' });
        }
    } catch (error) {
        console.error('Erro ao inicializar WhatsApp Bot:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para obter estatísticas do WhatsApp Bot
router.get('/stats', async (req, res) => {
    try {
        const status = whatsappBotService.getStatus();
        const stats = {
            connected: status.connected,
            lastUpdate: status.lastUpdate,
            hasError: !!status.error,
            errorMessage: status.error,
            hasQR: !!status.qr,
            uptime: status.lastUpdate ? new Date(status.lastUpdate) : null
        };
        res.json(stats);
    } catch (error) {
        console.error('Erro ao obter estatísticas do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota para obter status detalhado do WhatsApp Bot
router.get('/status-detailed', async (req, res) => {
    try {
        const detailedStatus = await whatsappBotService.getDetailedStatus();
        res.json({
            success: true,
            data: detailedStatus
        });
    } catch (error) {
        console.error('Erro ao obter status detalhado do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter status detalhado' });
    }
});

// Rota para forçar reconexão do WhatsApp Bot
router.post('/reconnect', async (req, res) => {
    try {
        console.log('🔄 Forçando reconexão do WhatsApp Bot via API...');
        const success = await whatsappBotService.forceReconnect();

        if (success) {
            res.json({ success: true, message: 'Reconexão iniciada com sucesso' });
        } else {
            res.status(500).json({ success: false, message: 'Erro ao forçar reconexão' });
        }
    } catch (error) {
        console.error('Erro ao forçar reconexão do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao forçar reconexão' });
    }
});

// Rota para verificar saúde da conexão do WhatsApp Bot
router.get('/health', async (req, res) => {
    try {
        const isHealthy = await whatsappBotService.checkConnectionHealth();
        res.json({
            success: true,
            data: {
                healthy: isHealthy,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Erro ao verificar saúde da conexão:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar saúde da conexão' });
    }
});

// Rota para gerar QR code do WhatsApp
router.post('/generate-qr', async (req, res) => {
    try {
        console.log('📱 Gerando QR code do WhatsApp via API...');
        const success = await whatsappBotService.generateManualQR();

        if (success) {
            // Aguardar um pouco para o QR ser gerado
            await new Promise(resolve => setTimeout(resolve, 3000));

            const qrCode = whatsappBotService.getCurrentQR();
            if (qrCode) {
                res.json({
                    success: true,
                    message: 'QR code gerado com sucesso',
                    qrCode: qrCode
                });
            } else {
                res.json({
                    success: false,
                    message: 'QR code não foi gerado, tente novamente'
                });
            }
        } else {
            res.status(500).json({ success: false, message: 'Erro ao gerar QR code' });
        }
    } catch (error) {
        console.error('Erro ao gerar QR code do WhatsApp:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar QR code' });
    }
});

// Rota para obter QR code atual
router.get('/qr', async (req, res) => {
    try {
        const qrCode = whatsappBotService.getCurrentQR();
        const status = whatsappBotService.getStatus();

        res.json({
            success: true,
            data: {
                qrCode: qrCode,
                connected: status.connected,
                error: status.error,
                lastUpdate: status.lastUpdate
            }
        });
    } catch (error) {
        console.error('Erro ao obter QR code:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter QR code' });
    }
});

module.exports = router;
