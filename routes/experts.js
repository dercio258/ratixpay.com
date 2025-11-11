const express = require('express');
const router = express.Router();
const ExpertService = require('../services/expertService');
const { authenticateToken, isVendedorOrAdmin } = require('../middleware/auth');

/**
 * POST /api/experts - Criar novo expert
 */
router.post('/', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        console.log(`🔄 Criando expert para vendedor ${req.user.id}...`);
        
        const { nome, email, whatsapp, profissao } = req.body;
        
        // Validar dados obrigatórios
        if (!nome || !email || !whatsapp || !profissao) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios: nome, email, whatsapp, profissao'
            });
        }
        
        const resultado = await ExpertService.criarExpert(req.user.id, {
            nome,
            email,
            whatsapp,
            profissao
        });
        
        if (resultado.success) {
            res.status(201).json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/experts - Listar experts do vendedor
 */
router.get('/', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        console.log(`🔄 Listando experts do vendedor ${req.user.id}...`);
        
        const incluirInativos = req.query.incluirInativos === 'true';
        
        const resultado = await ExpertService.listarExperts(req.user.id, incluirInativos);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao listar experts:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/experts/:id - Buscar expert por ID
 */
router.get('/:id', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 Buscando expert ${id} do vendedor ${req.user.id}...`);
        
        const resultado = await ExpertService.buscarExpertPorId(id, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(404).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * PUT /api/experts/:id - Atualizar expert
 */
router.put('/:id', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 Atualizando expert ${id}...`);
        
        const { nome, email, whatsapp, profissao, ativo } = req.body;
        
        const dadosAtualizacao = {};
        if (nome !== undefined) dadosAtualizacao.nome = nome;
        if (email !== undefined) dadosAtualizacao.email = email;
        if (whatsapp !== undefined) dadosAtualizacao.whatsapp = whatsapp;
        if (profissao !== undefined) dadosAtualizacao.profissao = profissao;
        if (ativo !== undefined) dadosAtualizacao.ativo = ativo;
        
        const resultado = await ExpertService.atualizarExpert(id, req.user.id, dadosAtualizacao);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao atualizar expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE /api/experts/:id - Excluir expert
 */
router.delete('/:id', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 Excluindo expert ${id}...`);
        
        const resultado = await ExpertService.excluirExpert(id, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao excluir expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/experts/:id/associar-produto - Associar expert a um produto
 */
router.post('/:id/associar-produto', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { id: expertId } = req.params;
        const { produtoId } = req.body;
        
        console.log(`🔄 Associando expert ${expertId} ao produto ${produtoId}...`);
        
        if (!produtoId) {
            return res.status(400).json({
                success: false,
                message: 'ID do produto é obrigatório'
            });
        }
        
        const resultado = await ExpertService.associarExpertAoProduto(produtoId, expertId, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao associar expert ao produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE /api/experts/:id/desassociar-produto - Desassociar expert de um produto
 */
router.delete('/:id/desassociar-produto', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { produtoId } = req.body;
        
        console.log(`🔄 Desassociando expert do produto ${produtoId}...`);
        
        if (!produtoId) {
            return res.status(400).json({
                success: false,
                message: 'ID do produto é obrigatório'
            });
        }
        
        const resultado = await ExpertService.desassociarExpertDoProduto(produtoId, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao desassociar expert do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/experts/:id/associar-produtos - Associar múltiplos produtos a um expert
 */
router.post('/:id/associar-produtos', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { id: expertId } = req.params;
        const { produtoIds } = req.body;
        
        console.log(`🔄 Associando expert ${expertId} a ${produtoIds?.length || 0} produtos...`);
        
        if (!produtoIds || !Array.isArray(produtoIds) || produtoIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de IDs dos produtos é obrigatória'
            });
        }
        
        const resultado = await ExpertService.associarProdutosAoExpert(produtoIds, expertId, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao associar produtos ao expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/experts/produto/:produtoId - Buscar expert de um produto
 */
router.get('/produto/:produtoId', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const { produtoId } = req.params;
        console.log(`🔄 Buscando expert do produto ${produtoId}...`);
        
        const resultado = await ExpertService.buscarExpertDoProduto(produtoId, req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(404).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar expert do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/experts/produtos/sem-expert - Listar produtos sem expert
 */
router.get('/produtos/sem-expert', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        console.log(`🔄 Listando produtos sem expert do vendedor ${req.user.id}...`);
        
        const resultado = await ExpertService.listarProdutosSemExpert(req.user.id);
        
        if (resultado.success) {
            res.json(resultado);
        } else {
            res.status(400).json(resultado);
        }
        
    } catch (error) {
        console.error('❌ Erro ao listar produtos sem expert:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
