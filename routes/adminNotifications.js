/**
 * Rotas para Gestão de Notificações - Admin
 */

const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Usuario } = require('../config/database');

// Aplicar middleware de autenticação e verificação de admin em todas as rotas
router.use(authenticateToken);
router.use(isAdmin);

/**
 * GET /api/admin/notificacoes/historico
 * Buscar histórico de notificações
 */
router.get('/historico', async (req, res) => {
    try {
        const { limit = 100, offset = 0, tipo, prioridade } = req.query;
        
        const notificacoes = await notificationService.buscarHistoricoAdmin({
            limit,
            offset,
            tipo,
            prioridade
        });

        res.json({
            success: true,
            notificacoes,
            total: notificacoes.length
        });

    } catch (error) {
        console.error('Erro ao buscar histórico de notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar histórico de notificações',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/notificacoes/enviar
 * Enviar notificação para vendedores
 */
router.post('/enviar', async (req, res) => {
    try {
        const { titulo, mensagem, tipo, prioridade, vendedores_ids, url_redirecionamento } = req.body;

        // Validar dados obrigatórios
        if (!titulo || !mensagem || !tipo || !vendedores_ids || vendedores_ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }

        // Validar tipo
        const tiposValidos = ['sistema', 'promocao', 'venda', 'pagamento'];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de notificação inválido'
            });
        }

        // Validar prioridade
        const prioridadesValidas = ['baixa', 'media', 'alta'];
        if (prioridade && !prioridadesValidas.includes(prioridade)) {
            return res.status(400).json({
                success: false,
                message: 'Prioridade inválida'
            });
        }

        const result = await notificationService.enviarNotificacao({
            titulo,
            mensagem,
            tipo,
            prioridade: prioridade || 'media',
            vendedores_ids,
            url_redirecionamento
        });

        res.json({
            success: true,
            message: 'Notificação enviada com sucesso',
            ...result
        });

    } catch (error) {
        console.error('Erro ao enviar notificação:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar notificação',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/notificacoes/estatisticas
 * Buscar estatísticas de notificações
 */
router.get('/estatisticas', async (req, res) => {
    try {
        const estatisticas = await notificationService.buscarEstatisticas();

        res.json({
            success: true,
            estatisticas
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas de notificações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
});

/**
 * DELETE /api/admin/notificacoes/:id
 * Deletar notificação
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await notificationService.deletarNotificacao(id);

        res.json({
            success: true,
            message: 'Notificação deletada com sucesso'
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
 * GET /api/admin/vendedores
 * Buscar vendedores para seleção
 */
router.get('/vendedores', async (req, res) => {
    try {
        const vendedores = await Usuario.findAll({
            where: {
                role: 'user',
                ativo: true
            },
            attributes: ['id', 'nome_completo', 'email', 'status', 'created_at'],
            order: [['nome_completo', 'ASC']]
        });

        res.json({
            success: true,
            vendedores
        });

    } catch (error) {
        console.error('Erro ao buscar vendedores:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar vendedores',
            error: error.message
        });
    }
});

module.exports = router;
