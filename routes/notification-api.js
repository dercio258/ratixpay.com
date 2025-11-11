const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { Notificacao, Usuario } = require('../config/database');

/**
 * Middleware de autenticação
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Token de acesso necessário' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_jwt_secret');
        const user = await Usuario.findByPk(decoded.id);

        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Usuário não encontrado' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false, 
            message: 'Token inválido' 
        });
    }
};

/**
 * Middleware para verificar se é vendedor
 */
const requireSeller = (req, res, next) => {
    if (req.user.tipo_conta !== 'vendedor' && req.user.role !== 'user') {
        return res.status(403).json({ 
            success: false, 
            message: 'Acesso restrito a vendedores' 
        });
    }
    next();
};

/**
 * GET /api/notifications
 * Obter notificações do vendedor autenticado
 */
router.get('/', authenticateToken, requireSeller, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status = null,
            tipo = null,
            unread_only = false
        } = req.query;

        const offset = (page - 1) * limit;
        const sellerId = req.user.id;

        // Construir filtros
        const whereClause = { seller_id: sellerId };
        
        if (status) whereClause.status = status;
        if (tipo) whereClause.tipo = tipo;
        if (unread_only === 'true') whereClause.status = 'unread';

        const result = await Notificacao.findAndCountAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            data: {
                notifications: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: result.count,
                    pages: Math.ceil(result.count / limit),
                    hasNext: result.count > offset + parseInt(limit),
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Erro ao obter notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/unread
 * Obter apenas notificações não lidas
 */
router.get('/unread', authenticateToken, requireSeller, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const sellerId = req.user.id;

        const notifications = await Notificacao.findAll({
            where: {
                seller_id: sellerId,
                status: 'unread'
            },
            order: [['prioridade', 'DESC'], ['created_at', 'DESC']],
            limit: parseInt(limit)
        });

        res.json({
            success: true,
            data: {
                notifications,
                count: notifications.length
            }
        });

    } catch (error) {
        console.error('❌ Erro ao obter notificações não lidas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/stats
 * Obter estatísticas de notificações
 */
router.get('/stats', authenticateToken, requireSeller, async (req, res) => {
    try {
        const sellerId = req.user.id;

        // Contar notificações por status
        const statusStats = await Notificacao.findAll({
            where: { seller_id: sellerId },
            attributes: [
                'status',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        // Contar notificações por tipo
        const typeStats = await Notificacao.findAll({
            where: { seller_id: sellerId },
            attributes: [
                'tipo',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['tipo'],
            raw: true
        });

        // Contar notificações por prioridade
        const priorityStats = await Notificacao.findAll({
            where: { seller_id: sellerId },
            attributes: [
                'prioridade',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            group: ['prioridade'],
            raw: true
        });

        // Processar estatísticas
        const stats = {
            total: 0,
            unread: 0,
            read: 0,
            byType: {},
            byPriority: {}
        };

        statusStats.forEach(stat => {
            const count = parseInt(stat.count);
            stats.total += count;
            stats[stat.status] = count;
        });

        typeStats.forEach(stat => {
            stats.byType[stat.tipo] = parseInt(stat.count);
        });

        priorityStats.forEach(stat => {
            stats.byPriority[stat.prioridade] = parseInt(stat.count);
        });

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * PUT /api/notifications/:id/read
 * Marcar notificação como lida
 */
router.put('/:id/read', authenticateToken, requireSeller, async (req, res) => {
    try {
        const { id } = req.params;
        const sellerId = req.user.id;

        const notification = await Notificacao.findOne({
            where: {
                id: id,
                seller_id: sellerId
            }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }

        await Notificacao.update(
            {
                status: 'read',
                data_leitura: new Date()
            },
            { where: { id: id } }
        );

        res.json({
            success: true,
            message: 'Notificação marcada como lida',
            data: {
                id: id,
                status: 'read',
                readAt: new Date()
            }
        });

    } catch (error) {
        console.error('❌ Erro ao marcar notificação como lida:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * PUT /api/notifications/read-all
 * Marcar todas as notificações como lidas
 */
router.put('/read-all', authenticateToken, requireSeller, async (req, res) => {
    try {
        const sellerId = req.user.id;

        const updatedCount = await Notificacao.update(
            {
                status: 'read',
                data_leitura: new Date()
            },
            {
                where: {
                    seller_id: sellerId,
                    status: 'unread'
                }
            }
        );

        res.json({
            success: true,
            message: `${updatedCount[0]} notificações marcadas como lidas`,
            data: {
                updatedCount: updatedCount[0],
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Deletar notificação
 */
router.delete('/:id', authenticateToken, requireSeller, async (req, res) => {
    try {
        const { id } = req.params;
        const sellerId = req.user.id;

        const notification = await Notificacao.findOne({
            where: {
                id: id,
                seller_id: sellerId
            }
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }

        await Notificacao.destroy({
            where: { id: id }
        });

        res.json({
            success: true,
            message: 'Notificação deletada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao deletar notificação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * DELETE /api/notifications/clear-all
 * Limpar todas as notificações lidas
 */
router.delete('/clear-all', authenticateToken, requireSeller, async (req, res) => {
    try {
        const sellerId = req.user.id;

        const deletedCount = await Notificacao.destroy({
            where: {
                seller_id: sellerId,
                status: 'read'
            }
        });

        res.json({
            success: true,
            message: `${deletedCount} notificações lidas removidas`,
            data: {
                deletedCount,
                timestamp: new Date()
            }
        });

    } catch (error) {
        console.error('❌ Erro ao limpar notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/notifications/test
 * Endpoint para testar notificações (apenas para desenvolvimento)
 */
router.post('/test', authenticateToken, requireSeller, async (req, res) => {
    try {
        const { message = 'Notificação de teste', tipo = 'sistema' } = req.body;
        const sellerId = req.user.id;

        const notification = await Notificacao.create({
            seller_id: sellerId,
            tipo: tipo,
            titulo: 'Notificação de Teste',
            mensagem: message,
            status: 'unread',
            dados_extras: {
                test: true,
                timestamp: Date.now()
            },
            som: '/sounds/test.mp3',
            prioridade: 'media'
        });

        res.json({
            success: true,
            message: 'Notificação de teste criada',
            data: notification
        });

    } catch (error) {
        console.error('❌ Erro ao criar notificação de teste:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/notifications/health
 * Endpoint de saúde do sistema de notificações
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Sistema de notificações funcionando',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

module.exports = router;
