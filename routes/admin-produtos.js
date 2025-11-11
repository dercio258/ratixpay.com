const express = require('express');
const router = express.Router();
const { Produto, Usuario, Venda } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');

// Middleware para verificar acesso de administrador
const isAdmin = (req, res, next) => {
    console.log('🔍 isAdmin (admin-produtos): Verificando acesso para:', req.user?.email);
    console.log('🔍 isAdmin (admin-produtos): Dados do usuário:', {
        email: req.user?.email,
        role: req.user?.role,
        tipo_conta: req.user?.tipo_conta
    });
    
    // Verificação especial para email administrativo principal
    const isMainAdmin = req.user.email === 'ratixpay.mz@gmail.com';
    const isRegularAdmin = req.user.role === 'admin' || req.user.tipo_conta === 'admin';
    
    console.log('🔍 isAdmin (admin-produtos): Verificações:', {
        isMainAdmin,
        isRegularAdmin
    });
    
    if (!isMainAdmin && !isRegularAdmin) {
        console.log('❌ isAdmin (admin-produtos): Acesso negado - não é admin');
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas administradores.'
        });
    }
    
    // Se for o email principal, garantir que seja reconhecido como admin
    if (isMainAdmin) {
        console.log('🔑 Acesso administrativo concedido para ratixpay.mz@gmail.com');
    }
    
    console.log('✅ isAdmin (admin-produtos): Acesso autorizado');
    next();
};

// GET - Estatísticas de produtos
router.get('/estatisticas-produtos', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Carregando estatísticas de produtos...');
        console.log('🔍 Rota /estatisticas-produtos chamada com usuário:', req.user?.email);
        
        const totalProdutos = await Produto.count();
        const produtosAtivos = await Produto.count({ where: { ativo: true } });
        const produtosInativos = await Produto.count({ where: { ativo: false } });
        
        // Contar vendedores que têm produtos
        const vendedoresComProdutos = await Usuario.count({
            where: { 
                role: 'user',
                ativo: true
            },
            include: [{
                model: Produto,
                as: 'produtos',
                required: true
            }],
            distinct: true
        });
        
        res.json({
            success: true,
            data: {
                totalProdutos,
                produtosAtivos,
                produtosInativos,
                totalVendedores: vendedoresComProdutos
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas de produtos:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET - Listar todos os produtos com informações do vendedor
router.get('/produtos', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Carregando lista de produtos...');
        
        const { page = 1, limit = 50, status, vendedor, categoria, busca } = req.query;
        const offset = (page - 1) * limit;
        
        // Construir condições de busca
        let whereClause = {};
        
        if (status) {
            whereClause.ativo = status === 'ativo';
        }
        
        if (vendedor) {
            whereClause.vendedor_id = vendedor;
        }
        
        if (categoria) {
            whereClause.categoria = categoria;
        }
        
        if (busca) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${busca}%` } },
                { descricao: { [Op.iLike]: `%${busca}%` } }
            ];
        }
        
        const produtos = await Produto.findAll({
            where: whereClause,
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email', 'telefone'],
                required: false // LEFT JOIN para não falhar se não houver vendedor
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        // Para cada produto, calcular total de vendas
        const produtosComVendas = await Promise.all(
            produtos.map(async (produto) => {
                const totalVendas = await Venda.count({
                    where: {
                        produto_id: produto.id,
                        status: 'Aprovado'
                    }
                });
                
                return {
                    ...produto.toJSON(),
                    total_vendas: totalVendas
                };
            })
        );
        
        const totalProdutos = await Produto.count({ where: whereClause });
        
        res.json({
            success: true,
            data: {
                produtos: produtosComVendas,
                totalProdutos,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalProdutos / limit)
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET - Detalhes de um produto específico
router.get('/produtos/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const produto = await Produto.findByPk(id, {
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            }]
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Buscar vendas do produto
        const vendas = await Venda.findAll({
            where: { produto_id: id },
            order: [['created_at', 'DESC']],
            limit: 10
        });
        
        const totalVendas = await Venda.count({
            where: {
                produto_id: id,
                status: 'Aprovado'
            }
        });
        
        const receitaTotal = await Venda.sum('valor', {
            where: {
                produto_id: id,
                status: 'Aprovado'
            }
        });
        
        res.json({
            success: true,
            data: {
                produto: produto.toJSON(),
                vendas: vendas,
                estatisticas: {
                    totalVendas,
                    receitaTotal: parseFloat(receitaTotal || 0)
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar detalhes do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// PUT - Atualizar status do produto
router.put('/produtos/:id/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { ativo } = req.body;
        
        const produto = await Produto.findByPk(id);
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        await produto.update({ ativo });
        
        res.json({
            success: true,
            message: `Produto ${ativo ? 'ativado' : 'desativado'} com sucesso`
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DELETE - Excluir produto
router.delete('/produtos/:id', authenticateToken, async (req, res) => {
    try {
        console.log('🗑️ Tentativa de exclusão de produto:', req.params.id);
        console.log('👤 Usuário:', req.user);
        
        const { id } = req.params;
        
        // Tentar buscar por UUID primeiro, depois por custom_id
        let produto = await Produto.findByPk(id);
        
        if (!produto) {
            produto = await Produto.findOne({ where: { custom_id: id } });
        }
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Verificar se o usuário é admin ou se é o dono do produto
        const isAdmin = req.user.role === 'admin';
        const isOwner = produto.vendedor_id === req.user.id;
        
        if (!isAdmin && !isOwner) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Você só pode excluir seus próprios produtos.'
            });
        }
        
        // Verificar se o produto tem vendas
        const temVendas = await Venda.count({
            where: { produto_id: id }
        });
        
        if (temVendas > 0) {
            // Se tem vendas, desativar o produto em vez de excluir
            await produto.update({ ativo: false });
            
            return res.json({
                success: true,
                message: `Produto desativado com sucesso. Não foi possível excluir porque possui ${temVendas} venda(s) associada(s).`
            });
        }
        
        await produto.destroy();
        
        res.json({
            success: true,
            message: 'Produto excluído com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao excluir produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Produtos por vendedor
router.get('/vendedores/:vendedorId/produtos', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        const vendedor = await Usuario.findByPk(vendedorId);
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        const produtos = await Produto.findAll({
            where: { vendedor_id: vendedorId },
            order: [['created_at', 'DESC']]
        });
        
        // Calcular estatísticas para cada produto
        const produtosComStats = await Promise.all(
            produtos.map(async (produto) => {
                const totalVendas = await Venda.count({
                    where: {
                        produto_id: produto.id,
                        status: 'Aprovado'
                    }
                });
                
                const receitaTotal = await Venda.sum('valor', {
                    where: {
                        produto_id: produto.id,
                        status: 'Aprovado'
                    }
                });
                
                return {
                    ...produto.toJSON(),
                    total_vendas: totalVendas,
                    receita_total: parseFloat(receitaTotal || 0)
                };
            })
        );
        
        res.json({
            success: true,
            data: {
                vendedor: {
                    id: vendedor.id,
                    nome_completo: vendedor.nome_completo,
                    email: vendedor.email
                },
                produtos: produtosComStats
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
