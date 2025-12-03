const { ProdutoComplementarVenda, Venda, Produto } = require('../config/database');

class ProdutoComplementarVendaService {
    
    /**
     * Salva os produtos complementares de uma venda
     * @param {string} vendaId - ID da venda
     * @param {Array} produtosComplementares - Array de produtos complementares
     * @returns {Promise<Array>} - Array de produtos complementares salvos
     */
    static async salvarProdutosComplementares(vendaId, produtosComplementares) {
        try {
            console.log('💾 Salvando produtos complementares para venda:', vendaId);
            console.log('📦 Produtos complementares:', produtosComplementares);
            
            if (!produtosComplementares || produtosComplementares.length === 0) {
                console.log('ℹ️ Nenhum produto complementar para salvar');
                return [];
            }
            
            const produtosSalvos = [];
            
            for (const produto of produtosComplementares) {
                console.log('🔍 Salvando produto complementar:', {
                    venda_id: vendaId,
                    produto_complementar_id: produto.id,
                    nome: produto.nome,
                    preco: produto.preco,
                    desconto: produto.desconto,
                    imagem: produto.imagem,
                    miniatura: produto.miniatura,
                    link_conteudo: produto.link_conteudo,
                    descricao: produto.descricao,
                    tipo: produto.tipo,
                    vendedor_id: produto.vendedor_id
                });
                
                const produtoComplementar = await ProdutoComplementarVenda.create({
                    venda_id: vendaId,
                    produto_complementar_id: produto.id,
                    nome_produto: produto.nome || 'Produto Complementar', // Campo correto do banco
                    nome: produto.nome || 'Produto Complementar', // Manter para compatibilidade
                    preco: produto.preco,
                    desconto: produto.desconto || 0,
                    imagem: produto.imagem || '',
                    miniatura: produto.miniatura || '',
                    link_conteudo: produto.link_conteudo || '',
                    descricao: produto.descricao || '',
                    tipo: produto.tipo || 'digital',
                    vendedor_id: produto.vendedor_id
                });
                
                produtosSalvos.push(produtoComplementar);
                console.log('✅ Produto complementar salvo:', produto.nome, 'com link_conteudo:', produto.link_conteudo);
            }
            
            console.log(`🎉 ${produtosSalvos.length} produtos complementares salvos com sucesso`);
            return produtosSalvos;
            
        } catch (error) {
            console.error('❌ Erro ao salvar produtos complementares:', error);
            throw new Error(`Erro ao salvar produtos complementares: ${error.message}`);
        }
    }
    
    /**
     * Busca os produtos complementares de uma venda
     * @param {string} vendaId - ID da venda
     * @returns {Promise<Array>} - Array de produtos complementares
     */
    static async buscarProdutosComplementaresPorVenda(vendaId) {
        try {
            console.log('🔍 Buscando produtos complementares para venda:', vendaId);
            
            const produtosComplementares = await ProdutoComplementarVenda.findAll({
                where: { venda_id: vendaId },
                order: [['created_at', 'ASC']]
            });
            
            console.log(`📦 Encontrados ${produtosComplementares.length} produtos complementares`);
            return produtosComplementares;
            
        } catch (error) {
            console.error('❌ Erro ao buscar produtos complementares:', error);
            throw new Error(`Erro ao buscar produtos complementares: ${error.message}`);
        }
    }
    
    /**
     * Busca os produtos complementares por ID público da venda
     * @param {string} publicId - ID público da venda
     * @returns {Promise<Array>} - Array de produtos complementares
     */
    static async buscarProdutosComplementaresPorPublicId(publicId) {
        try {
            console.log('🔍 Buscando produtos complementares por public_id:', publicId);
            
            // Primeiro, encontrar a venda pelo public_id
            const venda = await Venda.findOne({
                where: { public_id: publicId },
                include: [{
                    model: Produto,
                    as: 'produto'
                }]
            });
            
            if (!venda) {
                console.log('⚠️ Venda não encontrada com public_id:', publicId);
                return [];
            }
            
            // Buscar produtos complementares da venda (order bumps)
            const produtosComplementares = await this.buscarProdutosComplementaresPorVenda(venda.id);
            
            // Buscar também vendas upsell relacionadas (mesmo cliente, mesmo vendedor)
            // Identificar upsells pelas observações contendo "Upsell" ou "upsell"
            const { Op } = require('sequelize');
            const vendasUpsell = await Venda.findAll({
                where: {
                    cliente_id: venda.cliente_id,
                    vendedor_id: venda.vendedor_id,
                    id: { [Op.ne]: venda.id },
                    status: { [Op.in]: ['Pago', 'Aprovado', 'approved', 'success', 'completed'] },
                    [Op.or]: [
                        { observacoes: { [Op.iLike]: '%Upsell%' } },
                        { observacoes: { [Op.iLike]: '%upsell%' } }
                    ]
                },
                include: [{
                    model: Produto,
                    as: 'produto'
                }],
                order: [['created_at', 'ASC']]
            });
            
            // Converter vendas upsell para formato de produtos complementares
            const produtosUpsell = vendasUpsell.map(vendaUpsell => {
                return {
                    id: vendaUpsell.id,
                    venda_id: vendaUpsell.id,
                    produto_complementar_id: vendaUpsell.produto_id,
                    nome_produto: vendaUpsell.produto?.nome || 'Produto Upsell',
                    nome: vendaUpsell.produto?.nome || 'Produto Upsell',
                    preco: parseFloat(vendaUpsell.valor || vendaUpsell.pagamento_valor || 0),
                    desconto: 0,
                    imagem: vendaUpsell.produto?.imagem_url || '',
                    miniatura: '',
                    link_conteudo: vendaUpsell.produto?.link_conteudo || '',
                    descricao: vendaUpsell.produto?.descricao || '',
                    tipo: vendaUpsell.produto?.tipo || 'digital',
                    vendedor_id: vendaUpsell.vendedor_id,
                    created_at: vendaUpsell.created_at,
                    is_upsell: true // Marcar como upsell (campo virtual, não salvo no banco)
                };
            });
            
            // Combinar produtos complementares (order bumps) e upsells
            const todosProdutos = [...produtosComplementares, ...produtosUpsell];
            
            console.log(`📦 Encontrados ${produtosComplementares.length} produtos complementares (order bumps)`);
            console.log(`🎯 Encontrados ${produtosUpsell.length} produtos upsell`);
            console.log(`📦 Total: ${todosProdutos.length} produtos para venda ${publicId}`);
            
            return todosProdutos;
            
        } catch (error) {
            console.error('❌ Erro ao buscar produtos complementares por public_id:', error);
            throw new Error(`Erro ao buscar produtos complementares: ${error.message}`);
        }
    }
    
    /**
     * Formata os produtos complementares para exibição na payment-success
     * @param {Array} produtosComplementares - Array de produtos complementares do banco
     * @returns {Promise<Array>} - Array formatado para exibição
     */
    static async formatarProdutosComplementares(produtosComplementares) {
        const produtosFormatados = [];
        
        for (const produto of produtosComplementares) {
            // Se não tiver link_conteudo salvo, buscar do produto original
            let linkConteudo = produto.link_conteudo || '';
            
            if (!linkConteudo && produto.produto_complementar_id) {
                try {
                    const produtoOriginal = await Produto.findByPk(produto.produto_complementar_id);
                    if (produtoOriginal && produtoOriginal.link_conteudo) {
                        linkConteudo = produtoOriginal.link_conteudo;
                        console.log(`✅ Link de conteúdo recuperado do produto original: ${produtoOriginal.nome}`);
                    }
                } catch (error) {
                    console.error(`❌ Erro ao buscar produto original para link_conteudo:`, error);
                }
            }
            
            console.log('🔄 Formatando produto complementar:', {
                id: produto.id,
                produto_complementar_id: produto.produto_complementar_id,
                nome: produto.nome,
                preco: produto.preco,
                desconto: produto.desconto,
                imagem: produto.imagem,
                miniatura: produto.miniatura,
                link_conteudo: linkConteudo,
                descricao: produto.descricao,
                tipo: produto.tipo,
                vendedor_id: produto.vendedor_id
            });
            
            produtosFormatados.push({
                id: produto.produto_complementar_id,
                produto_complementar_id: produto.produto_complementar_id,
                nome: produto.nome || 'Produto Complementar',
                preco: parseFloat(produto.preco),
                desconto: parseFloat(produto.desconto || 0),
                imagem: produto.imagem || '',
                miniatura: produto.miniatura || '',
                link_conteudo: linkConteudo,
                descricao: produto.descricao || '',
                tipo: produto.tipo || 'digital',
                vendedor_id: produto.vendedor_id
        });
        }
        
        return produtosFormatados;
    }
    
    /**
     * Remove produtos complementares de uma venda (para casos de cancelamento)
     * @param {string} vendaId - ID da venda
     * @returns {Promise<number>} - Número de registros removidos
     */
    static async removerProdutosComplementares(vendaId) {
        try {
            console.log('🗑️ Removendo produtos complementares da venda:', vendaId);
            
            const removidos = await ProdutoComplementarVenda.destroy({
                where: { venda_id: vendaId }
            });
            
            console.log(`✅ ${removidos} produtos complementares removidos`);
            return removidos;
            
        } catch (error) {
            console.error('❌ Erro ao remover produtos complementares:', error);
            throw new Error(`Erro ao remover produtos complementares: ${error.message}`);
        }
    }
}

module.exports = ProdutoComplementarVendaService;
