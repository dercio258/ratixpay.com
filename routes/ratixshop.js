const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { Produto, Usuario, Venda } = require('../config/database');

/**
 * GET /api/ratixshop/produtos
 * Busca todos os produtos disponíveis na RatixShop
 */
router.get('/produtos', async (req, res) => {
    try {
        
        const { categoria, preco_min, preco_max, busca, ordenar = 'created_at', direcao = 'DESC' } = req.query;
        
        // Construir filtros
        const whereClause = {
            ativo: true // Apenas produtos ativos
        };
        
        if (categoria) {
            whereClause.categoria = categoria;
        }
        
        if (preco_min || preco_max) {
            whereClause.preco = {};
            if (preco_min) whereClause.preco[Op.gte] = parseFloat(preco_min);
            if (preco_max) whereClause.preco[Op.lte] = parseFloat(preco_max);
        }
        
        if (busca) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${busca}%` } },
                { descricao: { [Op.iLike]: `%${busca}%` } },
                { categoria: { [Op.iLike]: `%${busca}%` } }
            ];
        }
        
        // Buscar produtos com informações do vendedor
        const produtos = await Produto.findAll({
            where: whereClause,
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email'],
                required: false
            }],
            order: [
                ['tipo', 'ASC'], // Primeiro eBooks, depois Cursos
                [ordenar, direcao.toUpperCase()]
            ],
            limit: 50 // Limitar para performance
        });
        
        
        res.json({
            success: true,
            produtos: produtos.map(produto => ({
                id: produto.id,
                custom_id: produto.custom_id,
                nome: produto.nome,
                descricao: produto.descricao,
                preco: produto.preco,
                categoria: produto.categoria,
                tipo: produto.tipo,
                imagem: produto.imagem_url,
                link_conteudo: produto.link_conteudo,
                data_criacao: produto.created_at,
                vendedor: {
                    id: produto.vendedorProduto?.id,
                    nome: produto.vendedorProduto?.nome_completo,
                    email: produto.vendedorProduto?.email
                },
                // Estatísticas do produto
                total_vendas: produto.vendas || 0,
                avaliacao_media: 0 // Campo não existe no modelo Produto
            }))
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produtos da RatixShop:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos'
        });
    }
});

/**
 * GET /api/ratixshop/categorias
 * Busca todas as categorias disponíveis
 */
router.get('/categorias', async (req, res) => {
    try {
        
        const categorias = await Produto.findAll({
            attributes: ['categoria'],
            where: {
                ativo: true,
                categoria: { [Op.ne]: null }
            },
            group: ['categoria'],
            order: [['categoria', 'ASC']]
        });
        
        const listaCategorias = categorias.map(cat => cat.categoria).filter(Boolean);
        
        
        res.json({
            success: true,
            categorias: listaCategorias
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar categorias:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar categorias'
        });
    }
});

/**
 * GET /api/ratixshop/produto/:id
 * Busca detalhes de um produto específico
 */
router.get('/produto/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        
        const produto = await Produto.findOne({
            where: { 
                id: id,
                ativo: true 
            },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email'],
                required: false
            }]
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        
        res.json({
            success: true,
            produto: {
                id: produto.id,
                custom_id: produto.custom_id,
                nome: produto.nome,
                descricao: produto.descricao,
                preco: produto.preco,
                categoria: produto.categoria,
                tipo: produto.tipo,
                imagem: produto.imagem_url,
                link_conteudo: produto.link_conteudo,
                data_criacao: produto.created_at,
                vendedor: {
                    id: produto.vendedorProduto?.id,
                    nome: produto.vendedorProduto?.nome_completo,
                    email: produto.vendedorProduto?.email
                },
                total_vendas: produto.vendas || 0,
                avaliacao_media: 0 // Campo não existe no modelo Produto
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar produto'
        });
    }
});

module.exports = router;
