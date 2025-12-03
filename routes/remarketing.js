/**
 * Rotas da API para Remarketing Automático
 */

const express = require('express');
const router = express.Router();
const remarketingService = require('../services/remarketingService');
const remarketingConversaoService = require('../services/remarketingConversaoService');
const { authenticateToken } = require('../middleware/auth');
const { Produto } = require('../config/database');

/**
 * GET /api/remarketing/estatisticas
 * Busca estatísticas de conversão de remarketing
 * Requer autenticação
 */
router.get('/estatisticas', authenticateToken, async (req, res) => {
    try {
        const { produto_id, data_inicio, data_fim } = req.query;
        const userId = req.user.id;

        // Se não for admin, filtrar apenas produtos do vendedor
        const filtros = {
            vendedor_id: req.user.role !== 'admin' ? userId : undefined,
            produto_id: produto_id || undefined,
            data_inicio: data_inicio || undefined,
            data_fim: data_fim || undefined
        };

        const estatisticas = await remarketingConversaoService.buscarEstatisticas(filtros);

        res.json({
            success: true,
            data: estatisticas
        });
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas de remarketing:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
});

/**
 * GET /api/remarketing/produtos
 * Lista produtos do vendedor com remarketing ativo
 * Requer autenticação
 */
router.get('/produtos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const incluirTodos = req.query.todos === 'true';

        const produtos = await Produto.findAll({
            where: {
                vendedor_id: userId,
                ...(req.user.role !== 'admin' ? {} : {})
            },
            attributes: ['id', 'nome', 'custom_id', 'remarketing_config'],
            order: [['created_at', 'DESC']]
        });

        // Filtrar apenas produtos com remarketing ativo, a menos que incluirTodos seja true
        const produtosComRemarketing = incluirTodos ? produtos : produtos.filter(p => {
            const config = p.remarketing_config;
            return config && config.enabled === true;
        });

        res.json({
            success: true,
            produtos: produtosComRemarketing.map(p => ({
                id: p.id,
                nome: p.nome,
                custom_id: p.custom_id,
                remarketing_config: p.remarketing_config
            }))
        });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos',
            error: error.message
        });
    }
});

/**
 * PUT /api/remarketing/produtos/:id/config
 * Atualiza configuração de remarketing de um produto
 */
router.put('/produtos/:id/config', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { enabled, tempo_minutos } = req.body;

        let produto;
        if (/^[0-9a-fA-F-]{36}$/.test(id)) {
            produto = await Produto.findByPk(id);
        } else {
            produto = await Produto.findOne({ where: { custom_id: id } });
        }

        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Apenas o dono do produto (ou admin) pode atualizar
        if (req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Você não tem permissão para atualizar este produto'
            });
        }

        const tempo = Number.isFinite(Number(tempo_minutos)) ? parseInt(tempo_minutos, 10) : 0;

        produto.remarketing_config = {
            enabled: enabled === true || enabled === 'true',
            tempo_minutos: Math.max(0, tempo)
        };

        await produto.save();

        res.json({
            success: true,
            message: 'Configuração de remarketing atualizada com sucesso',
            produto: {
                id: produto.id,
                nome: produto.nome,
                remarketing_config: produto.remarketing_config
            }
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar configuração de remarketing:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar configuração de remarketing',
            error: error.message
        });
    }
});

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
            telefone,
            venda_cancelada_id
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
            telefone,
            venda_cancelada_id
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
        const { secret } = req.body;
        
        // Verificar secret (pode ser configurado no .env)
        const expectedSecret = process.env.REMARKETING_CRON_SECRET || 'default-secret-change-in-production';
        if (secret !== expectedSecret) {
            return res.status(401).json({
                success: false,
                message: 'Secret inválido'
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

module.exports = router;
