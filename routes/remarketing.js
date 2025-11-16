/**
 * Rotas da API para Remarketing Automático
 */

const express = require('express');
const router = express.Router();
const remarketingService = require('../services/remarketingService');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * POST /api/remarketing/adicionar
 * Adiciona venda cancelada à fila de remarketing
 * Requer autenticação
 */
router.post('/adicionar', authenticateToken, async (req, res) => {
    try {
        const {
            cliente_id,
            cliente_nome,
            produto_id,
            produto_nome,
            email,
            telefone
        } = req.body;

        // Validações
        if (!cliente_id || !cliente_nome || !produto_id || !produto_nome) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos: cliente_id, cliente_nome, produto_id, produto_nome'
            });
        }

        // Adicionar à fila
        const resultado = await remarketingService.adicionarVendaCancelada({
            cliente_id,
            cliente_nome,
            produto_id,
            produto_nome,
            email,
            telefone
        });

        if (resultado.ignorado) {
            return res.json({
                success: true,
                ignorado: true,
                motivo: resultado.motivo
            });
        }

        res.json({
            success: true,
            item: resultado.item
        });
    } catch (error) {
        console.error('❌ Erro ao adicionar à fila de remarketing:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar à fila de remarketing',
            error: error.message
        });
    }
});

/**
 * POST /api/remarketing/processar
 * Processa a fila manualmente
 * Requer secret de cron job
 */
router.post('/processar', async (req, res) => {
    try {
        const cronSecret = req.headers.authorization?.replace('Bearer ', '');
        const expectedSecret = process.env.CRON_SECRET || 'cron-secret-key';

        if (cronSecret !== expectedSecret) {
            return res.status(401).json({
                success: false,
                message: 'Não autorizado'
            });
        }

        const stats = await remarketingService.processarFila();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('❌ Erro ao processar fila de remarketing:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar fila',
            error: error.message
        });
    }
});

/**
 * GET /api/remarketing/estatisticas
 * Retorna estatísticas da fila
 * Requer autenticação + admin
 */
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await remarketingService.obterEstatisticas();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de remarketing:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas',
            error: error.message
        });
    }
});

module.exports = router;

