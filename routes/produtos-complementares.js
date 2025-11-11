const express = require('express');
const router = express.Router();
const ProdutoComplementarVendaService = require('../services/produtoComplementarVendaService');
const { Produto } = require('../config/database');

/**
 * GET /api/produtos-complementares/venda/:publicId
 * Busca produtos complementares de uma venda pelo ID público
 */
router.get('/venda/:publicId', async (req, res) => {
    try {
        const { publicId } = req.params;
        
        console.log('🔍 Buscando produtos complementares para venda:', publicId);
        
        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'ID público da venda é obrigatório'
            });
        }
        
        const produtosComplementares = await ProdutoComplementarVendaService.buscarProdutosComplementaresPorPublicId(publicId);
        
        // Buscar informações completas de cada produto complementar
        const produtosComInformacoesCompletas = [];
        
        for (const produtoComplementar of produtosComplementares) {
            console.log(`🔍 Buscando informações completas do produto: ${produtoComplementar.produto_complementar_id}`);
            
            try {
                // Buscar o produto original na tabela produtos
                const produtoOriginal = await Produto.findByPk(produtoComplementar.produto_complementar_id);
                
                if (produtoOriginal) {
                    console.log(`✅ Produto original encontrado: ${produtoOriginal.nome}`);
                    
                    // Combinar dados salvos com dados atuais do produto
                    const produtoCompleto = {
                        id: produtoComplementar.produto_complementar_id,
                        produto_complementar_id: produtoComplementar.produto_complementar_id,
                        nome: produtoComplementar.nome || produtoOriginal.nome,
                        preco: parseFloat(produtoComplementar.preco) || 0,
                        desconto: parseFloat(produtoComplementar.desconto || 0),
                        imagem: produtoComplementar.imagem || produtoOriginal.imagem_url || '',
                        miniatura: produtoComplementar.miniatura || '',
                        link_conteudo: produtoComplementar.link_conteudo || produtoOriginal.link_conteudo || '',
                        descricao: produtoComplementar.descricao || produtoOriginal.descricao || '',
                        tipo: produtoComplementar.tipo || produtoOriginal.tipo || 'digital',
                        vendedor_id: produtoComplementar.vendedor_id || produtoOriginal.vendedor_id
                    };
                    
                    console.log(`🔗 Link do conteúdo combinado: ${produtoCompleto.link_conteudo}`);
                    produtosComInformacoesCompletas.push(produtoCompleto);
                } else {
                    console.log(`⚠️ Produto original não encontrado para ID: ${produtoComplementar.produto_complementar_id}`);
                    // Usar apenas os dados salvos
                    produtosComInformacoesCompletas.push(produtoComplementar);
                }
            } catch (error) {
                console.error(`❌ Erro ao buscar produto original ${produtoComplementar.produto_complementar_id}:`, error);
                // Usar apenas os dados salvos
                produtosComInformacoesCompletas.push(produtoComplementar);
            }
        }
        
        console.log(`📦 Retornando ${produtosComInformacoesCompletas.length} produtos complementares com informações completas`);
        
        res.json({
            success: true,
            data: produtosComInformacoesCompletas,
            count: produtosComInformacoesCompletas.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produtos complementares:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/produtos-complementares/venda/:publicId/resumo
 * Busca resumo dos produtos complementares de uma venda
 */
router.get('/venda/:publicId/resumo', async (req, res) => {
    try {
        const { publicId } = req.params;
        
        console.log('🔍 Buscando resumo de produtos complementares para venda:', publicId);
        
        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'ID público da venda é obrigatório'
            });
        }
        
        const produtosComplementares = await ProdutoComplementarVendaService.buscarProdutosComplementaresPorPublicId(publicId);
        
        const produtosFormatados = ProdutoComplementarVendaService.formatarProdutosComplementares(produtosComplementares);
        
        // Calcular totais
        const totalComplementares = produtosFormatados.reduce((total, produto) => total + produto.preco, 0);
        const totalComDesconto = produtosFormatados.reduce((total, produto) => {
            const precoComDesconto = produto.desconto > 0 ? 
                produto.preco * (1 - produto.desconto / 100) : produto.preco;
            return total + precoComDesconto;
        }, 0);
        
        const resumo = {
            produtos: produtosFormatados,
            total_produtos: produtosFormatados.length,
            total_original: totalComplementares,
            total_com_desconto: totalComDesconto,
            total_desconto: totalComplementares - totalComDesconto
        };
        
        console.log('📊 Resumo calculado:', resumo);
        
        res.json({
            success: true,
            data: resumo
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar resumo de produtos complementares:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;
