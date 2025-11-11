/**
 * Rotas para Notificações - Vendedores
 */

const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken } = require('../middleware/auth');

// Aplicar middleware de autenticação em todas as rotas
router.use(authenticateToken);

/**
 * GET /api/notificacoes
 * Buscar notificações do vendedor logado
 */
router.get('/', async (req, res) => {
    try {
        const vendedorId = req.user.id;
        const { limit = 50, offset = 0, status, tipo } = req.query;

        const notificacoes = await notificationService.buscarNotificacoesVendedor(vendedorId, {
            limit,
            offset,
            status,
            tipo
        });

        res.json({
            success: true,
            notificacoes,
            total: notificacoes.length
        });

    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar notificações',
            error: error.message
        });
    }
});

/**
 * GET /api/notificacoes/nao-lidas
 * Buscar apenas notificações não lidas
 */
router.get('/nao-lidas', async (req, res) => {
    try {
        const vendedorId = req.user.id;
        const { limit = 20 } = req.query;

        const notificacoes = await notificationService.buscarNotificacoesVendedor(vendedorId, {
            limit,
            offset: 0,
            status: 'unread'
        });

        res.json({
            success: true,
            notificacoes,
            total: notificacoes.length
        });

    } catch (error) {
        console.error('Erro ao buscar notificações não lidas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar notificações não lidas',
            error: error.message
        });
    }
});

/**
 * PUT /api/notificacoes/:id/marcar-lida
 * Marcar notificação como lida
 */
router.put('/:id/marcar-lida', async (req, res) => {
    try {
        const vendedorId = req.user.id;
        const { id } = req.params;

        const result = await notificationService.marcarComoLida(id, vendedorId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar notificação como lida',
            error: error.message
        });
    }
});

/**
 * PUT /api/notificacoes/marcar-todas-lidas
 * Marcar todas as notificações como lidas
 */
router.put('/marcar-todas-lidas', async (req, res) => {
    try {
        const vendedorId = req.user.id;

        const result = await notificationService.marcarTodasComoLidas(vendedorId);

        res.json({
            success: true,
            message: result.message,
            atualizadas: result.atualizadas
        });

    } catch (error) {
        console.error('Erro ao marcar todas as notificações como lidas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar todas as notificações como lidas',
            error: error.message
        });
    }
});

/**
 * DELETE /api/notificacoes/:id
 * Deletar notificação
 */
router.delete('/:id', async (req, res) => {
    try {
        const vendedorId = req.user.id;
        const { id } = req.params;

        const result = await notificationService.deletarNotificacao(id, vendedorId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Erro ao deletar notificação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar notificação',
            error: error.message
        });
    }
});

/**
 * GET /api/notificacoes/contador
 * Buscar contador de notificações não lidas
 */
router.get('/contador', async (req, res) => {
    try {
        const vendedorId = req.user.id;

        const notificacoes = await notificationService.buscarNotificacoesVendedor(vendedorId, {
            limit: 1,
            offset: 0,
            status: 'unread'
        });

        // Buscar contador real do banco
        const { Usuario } = require('../config/database');
        const usuario = await Usuario.findByPk(vendedorId, {
            attributes: ['notificacoes']
        });

        res.json({
            success: true,
            contador: usuario ? usuario.notificacoes : 0
        });

    } catch (error) {
        console.error('Erro ao buscar contador de notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar contador de notificações',
            error: error.message
        });
    }
});

module.exports = router;