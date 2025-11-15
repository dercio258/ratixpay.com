/**
 * Rotas para Remarketing
 */

const express = require('express');
const router = express.Router();
const remarketingService = require('../services/remarketingService');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * POST /api/remarketing/adicionar
 * Adicionar venda cancelada à fila de remarketing
 */
router.post('/adicionar', authenticateToken, async (req, res) => {
    try {
        const { cliente_id, cliente_nome, produto_id, produto_nome, email, telefone } = req.body;

        if (!cliente_id || !cliente_nome || !produto_id || !produto_nome) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }

        const resultado = await remarketingService.adicionarVendaCancelada({
            cliente_id,
            cliente_nome,
            produto_id,
            produto_nome,
            email,
            telefone
        });

        if (resultado.success) {
            res.json({
                success: true,
                message: 'Venda cancelada adicionada à fila de remarketing',
                data: resultado
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado.message || 'Erro ao adicionar à fila'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao adicionar venda cancelada à fila:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/remarketing/processar
 * Processar fila de remarketing (chamado pelo cron job)
 */
router.post('/processar', async (req, res) => {
    try {
        // Verificar se é chamado internamente ou por cron job autorizado
        const authHeader = req.headers.authorization;
        const cronSecret = process.env.CRON_SECRET || 'cron-secret-key';
        
        if (authHeader !== `Bearer ${cronSecret}`) {
            return res.status(401).json({
                success: false,
                message: 'Não autorizado'
            });
        }

        const resultado = await remarketingService.processarFila();

        res.json({
            success: true,
            message: 'Fila processada com sucesso',
            data: resultado
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
 * Obter estatísticas da fila de remarketing
 */
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = await remarketingService.obterEstatisticas();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas',
            error: error.message
        });
    }
});

module.exports = router;

