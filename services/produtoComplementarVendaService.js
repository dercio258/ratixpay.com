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
                    nome: produto.nome,
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
                where: { public_id: publicId }
            });
            
            if (!venda) {
                console.log('⚠️ Venda não encontrada com public_id:', publicId);
                return [];
            }
            
            // Buscar produtos complementares da venda
            const produtosComplementares = await this.buscarProdutosComplementaresPorVenda(venda.id);
            
            console.log(`📦 Encontrados ${produtosComplementares.length} produtos complementares para venda ${publicId}`);
            return produtosComplementares;
            
        } catch (error) {
            console.error('❌ Erro ao buscar produtos complementares por public_id:', error);
            throw new Error(`Erro ao buscar produtos complementares: ${error.message}`);
        }
    }
    
    /**
     * Formata os produtos complementares para exibição na payment-success
     * @param {Array} produtosComplementares - Array de produtos complementares do banco
     * @returns {Array} - Array formatado para exibição
     */
    static formatarProdutosComplementares(produtosComplementares) {
        return produtosComplementares.map(produto => {
            console.log('🔄 Formatando produto complementar:', {
                id: produto.id,
                produto_complementar_id: produto.produto_complementar_id,
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
            
            return {
                id: produto.produto_complementar_id,
                produto_complementar_id: produto.produto_complementar_id,
                nome: produto.nome,
                preco: parseFloat(produto.preco),
                desconto: parseFloat(produto.desconto || 0),
                imagem: produto.imagem || '',
                miniatura: produto.miniatura || '',
                link_conteudo: produto.link_conteudo || '',
                descricao: produto.descricao || '',
                tipo: produto.tipo || 'digital',
                vendedor_id: produto.vendedor_id
            };
        });
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
