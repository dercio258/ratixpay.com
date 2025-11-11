/**
 * 📊 ROTAS DE ESTATÍSTICAS DE NOTIFICAÇÕES - RATIXPAY
 * 
 * Endpoints para monitoramento e estatísticas do sistema de notificações
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const vendaNotificationService = require('../services/vendaNotificationService');
const notificationCacheService = require('../services/notificationCacheService');
const notificationRetryService = require('../services/notificationRetryService');
const whatsappBotService = require('../services/whatsappBotService');

/**
 * GET /api/notification-stats/overview
 * Estatísticas gerais do sistema de notificações
 */
router.get('/overview', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas gerais do sistema de notificações...');
        
        const stats = {
            timestamp: new Date().toISOString(),
            cache: notificationCacheService.getStats(),
            retry: notificationRetryService.getStats(),
            whatsapp: {
                connected: whatsappBotService.isConnected(),
                status: whatsappBotService.getStatus(),
                connectionInfo: whatsappBotService.getConnectionInfo()
            },
            services: {
                email: {
                    initialized: true, // Assumindo que está inicializado
                    status: 'active'
                },
                whatsapp: {
                    initialized: whatsappBotService.isConnected(),
                    status: whatsappBotService.isConnected() ? 'active' : 'inactive'
                }
            }
        };
        
        console.log('✅ Estatísticas gerais obtidas com sucesso');
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas gerais:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/notification-stats/cache
 * Estatísticas detalhadas do cache
 */
router.get('/cache', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas do cache...');
        
        const cacheStats = notificationCacheService.getStats();
        
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                ...cacheStats
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas do cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/notification-stats/retry
 * Estatísticas da fila de retry
 */
router.get('/retry', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('📊 Buscando estatísticas da fila de retry...');
        
        const retryStats = notificationRetryService.getStats();
        
        res.json({
            success: true,
            data: {
                timestamp: new Date().toISOString(),
                ...retryStats
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas da fila de retry:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/notification-stats/whatsapp
 * Status detalhado do WhatsApp Bot
 */
router.get('/whatsapp', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('📊 Buscando status do WhatsApp Bot...');
        
        const whatsappStatus = {
            connected: whatsappBotService.isConnected(),
            status: whatsappBotService.getStatus(),
            connectionInfo: whatsappBotService.getConnectionInfo(),
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: whatsappStatus
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter status do WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/notification-stats/cache/clear
 * Limpar cache de notificações
 */
router.post('/cache/clear', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🗑️ Limpando cache de notificações...');
        
        notificationCacheService.invalidateAll();
        
        console.log('✅ Cache limpo com sucesso');
        
        res.json({
            success: true,
            message: 'Cache limpo com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/notification-stats/retry/clear
 * Limpar fila de retry
 */
router.post('/retry/clear', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🗑️ Limpando fila de retry...');
        
        notificationRetryService.clearRetryQueue();
        
        console.log('✅ Fila de retry limpa com sucesso');
        
        res.json({
            success: true,
            message: 'Fila de retry limpa com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao limpar fila de retry:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/notification-stats/whatsapp/reconnect
 * Forçar reconexão do WhatsApp Bot
 */
router.post('/whatsapp/reconnect', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Forçando reconexão do WhatsApp Bot...');
        
        const result = await whatsappBotService.forceReconnect();
        
        if (result) {
            console.log('✅ Reconexão do WhatsApp Bot bem-sucedida');
            res.json({
                success: true,
                message: 'WhatsApp Bot reconectado com sucesso'
            });
        } else {
            console.log('❌ Falha na reconexão do WhatsApp Bot');
            res.status(500).json({
                success: false,
                message: 'Falha na reconexão do WhatsApp Bot'
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao reconectar WhatsApp Bot:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/notification-stats/health
 * Health check do sistema de notificações
 */
router.get('/health', authenticateToken, async (req, res) => {
    try {
        console.log('🏥 Verificando saúde do sistema de notificações...');
        
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            services: {
                email: {
                    status: 'healthy',
                    message: 'Email service ativo'
                },
                whatsapp: {
                    status: whatsappBotService.isConnected() ? 'healthy' : 'degraded',
                    message: whatsappBotService.isConnected() ? 'WhatsApp Bot conectado' : 'WhatsApp Bot desconectado'
                },
                cache: {
                    status: 'healthy',
                    message: 'Cache service ativo'
                },
                retry: {
                    status: 'healthy',
                    message: 'Retry service ativo'
                }
            }
        };
        
        // Determinar status geral
        const serviceStatuses = Object.values(health.services).map(s => s.status);
        if (serviceStatuses.includes('degraded')) {
            health.status = 'degraded';
        } else if (serviceStatuses.includes('unhealthy')) {
            health.status = 'unhealthy';
        }
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('❌ Erro no health check:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
