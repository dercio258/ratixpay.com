const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const cancelamentoService = require('../services/cancelamentoService');
const { Venda } = require('../config/database');

// GET - Estatísticas de cancelamentos
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const estatisticas = await cancelamentoService.getEstatisticasCancelamento();
        
        res.json({
            success: true,
            data: estatisticas
        });
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de cancelamento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas de cancelamento',
            error: error.message
        });
    }
});

// GET - Listar vendas canceladas
router.get('/vendas-canceladas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, motivo } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {
            status: 'Cancelado'
        };
        
        if (motivo) {
            whereClause.falha_motivo = {
                [require('sequelize').Op.like]: `%${motivo}%`
            };
        }
        
        const vendas = await Venda.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: require('../config/database').Usuario,
                    as: 'vendedorProduto',
                    attributes: ['id', 'nome_completo', 'email']
                },
                {
                    model: require('../config/database').Produto,
                    attributes: ['id', 'public_id', 'custom_id', 'nome', 'preco']
                }
            ],
            order: [['falha_data', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: {
                vendas: vendas.rows,
                total: vendas.count,
                page: parseInt(page),
                totalPages: Math.ceil(vendas.count / limit)
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar vendas canceladas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar vendas canceladas',
            error: error.message
        });
    }
});

// POST - Cancelar venda manualmente
router.post('/cancelar-venda/:vendaId', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { vendaId } = req.params;
        const { motivo } = req.body;
        
        const resultado = await cancelamentoService.cancelarVendaPorId(vendaId, motivo || 'Cancelamento manual pelo administrador');
        
        if (resultado.success) {
            res.json({
                success: true,
                message: 'Venda cancelada com sucesso',
                data: resultado
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Erro ao cancelar venda',
                error: resultado.error
            });
        }
    } catch (error) {
        console.error('❌ Erro ao cancelar venda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar venda',
            error: error.message
        });
    }
});

// POST - Executar cancelamento manual de vendas pendentes
router.post('/executar-cancelamento', authenticateToken, isAdmin, async (req, res) => {
    try {
        await cancelamentoService.cancelarVendasPendentes();
        
        res.json({
            success: true,
            message: 'Cancelamento de vendas pendentes executado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao executar cancelamento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao executar cancelamento',
            error: error.message
        });
    }
});

// GET - Status do serviço de cancelamento
router.get('/status-servico', authenticateToken, isAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                isRunning: cancelamentoService.isRunning,
                message: cancelamentoService.isRunning ? 'Serviço ativo' : 'Serviço inativo'
            }
        });
    } catch (error) {
        console.error('❌ Erro ao obter status do serviço:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter status do serviço',
            error: error.message
        });
    }
});

module.exports = router;

