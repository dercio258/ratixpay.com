const { Produto, Usuario, Venda } = require('../config/database');
const cacheService = require('./cacheService');
const { Op } = require('sequelize');

class OptimizedProdutoService {
    constructor() {
        this.cachePrefix = 'produto';
        this.defaultCacheTTL = 1800; // 30 minutos
    }

    // Buscar produto com cache otimizado
    async buscarProdutoPorId(produtoId, useCache = true) {
        const cacheKey = `${this.cachePrefix}:${produtoId}`;
        
        // Tentar obter do cache primeiro
        if (useCache) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            // Query otimizada com includes necessários
            const produto = await Produto.findByPk(produtoId, {
                attributes: [
                    'id', 'public_id', 'custom_id', 'vendedor_id', 'nome', 
                    'tipo', 'categoria', 'preco', 'desconto', 'preco_com_desconto',
                    'descricao', 'link_conteudo', 'imagem_url', 'ativo', 'vendas'
                ],
                include: [
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome_completo', 'email', 'telefone'],
                        required: false
                    }
                ],
                // Otimizações de query
                raw: false,
                nest: true
            });

            if (produto) {
                // Salvar no cache
                await cacheService.set(cacheKey, produto, this.defaultCacheTTL);
            }

            return produto;
        } catch (error) {
            console.error('❌ Erro ao buscar produto:', error);
            throw error;
        }
    }

    // Buscar produto por public_id com cache
    async buscarProdutoPorPublicId(publicId, useCache = true) {
        const cacheKey = `${this.cachePrefix}:public:${publicId}`;
        
        if (useCache) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const produto = await Produto.findOne({
                where: { public_id: publicId },
                attributes: [
                    'id', 'public_id', 'custom_id', 'vendedor_id', 'nome', 
                    'tipo', 'categoria', 'preco', 'desconto', 'preco_com_desconto',
                    'descricao', 'link_conteudo', 'imagem_url', 'ativo', 'vendas'
                ],
                include: [
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome_completo', 'email', 'telefone'],
                        required: false
                    }
                ]
            });

            if (produto) {
                await cacheService.set(cacheKey, produto, this.defaultCacheTTL);
            }

            return produto;
        } catch (error) {
            console.error('❌ Erro ao buscar produto por public_id:', error);
            throw error;
        }
    }

    // Listar produtos com paginação otimizada
    async listarProdutos(filtros = {}, paginacao = {}) {
        const {
            vendedorId,
            categoria,
            ativo = true,
            busca,
            ordenarPor = 'created_at',
            ordem = 'DESC'
        } = filtros;

        const {
            limite = 20,
            offset = 0
        } = paginacao;

        // Criar chave de cache baseada nos filtros
        const cacheKey = `produtos:list:${JSON.stringify(filtros)}:${limite}:${offset}`;
        
        try {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }

            // Construir where clause otimizada
            const whereClause = {};
            
            if (vendedorId) {
                whereClause.vendedor_id = vendedorId;
            }
            
            if (categoria) {
                whereClause.categoria = categoria;
            }
            
            if (ativo !== undefined) {
                whereClause.ativo = ativo;
            }
            
            if (busca) {
                whereClause[Op.or] = [
                    { nome: { [Op.iLike]: `%${busca}%` } },
                    { descricao: { [Op.iLike]: `%${busca}%` } }
                ];
            }

            // Query otimizada
            const { count, rows } = await Produto.findAndCountAll({
                where: whereClause,
                attributes: [
                    'id', 'public_id', 'custom_id', 'nome', 'tipo', 'categoria',
                    'preco', 'desconto', 'preco_com_desconto', 'imagem_url', 
                    'ativo', 'vendas', 'created_at'
                ],
                include: [
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome_completo'],
                        required: false
                    }
                ],
                order: [[ordenarPor, ordem]],
                limit: parseInt(limite),
                offset: parseInt(offset),
                // Otimizações
                distinct: true,
                subQuery: false
            });

            const resultado = {
                produtos: rows,
                total: count,
                pagina: Math.floor(offset / limite) + 1,
                totalPaginas: Math.ceil(count / limite),
                limite: parseInt(limite)
            };

            // Cache por 10 minutos para listas
            await cacheService.set(cacheKey, resultado, 600);

            return resultado;
        } catch (error) {
            console.error('❌ Erro ao listar produtos:', error);
            throw error;
        }
    }

    // Buscar produtos por vendedor com cache
    async buscarProdutosPorVendedor(vendedorId, useCache = true) {
        const cacheKey = `produtos:vendedor:${vendedorId}`;
        
        if (useCache) {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const produtos = await Produto.findAll({
                where: { 
                    vendedor_id: vendedorId,
                    ativo: true
                },
                attributes: [
                    'id', 'public_id', 'custom_id', 'nome', 'tipo', 'categoria',
                    'preco', 'desconto', 'preco_com_desconto', 'imagem_url', 'vendas'
                ],
                order: [['created_at', 'DESC']]
            });

            // Cache por 30 minutos
            await cacheService.set(cacheKey, produtos, this.defaultCacheTTL);

            return produtos;
        } catch (error) {
            console.error('❌ Erro ao buscar produtos por vendedor:', error);
            throw error;
        }
    }

    // Criar produto com invalidação de cache
    async criarProduto(dadosProduto) {
        try {
            const produto = await Produto.create(dadosProduto);
            
            // Invalidar caches relacionados
            await this.invalidarCacheVendedor(produto.vendedor_id);
            await this.invalidarCacheLista();
            
            return produto;
        } catch (error) {
            console.error('❌ Erro ao criar produto:', error);
            throw error;
        }
    }

    // Atualizar produto com invalidação de cache
    async atualizarProduto(produtoId, dadosAtualizacao) {
        try {
            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                throw new Error('Produto não encontrado');
            }

            await produto.update(dadosAtualizacao);
            
            // Invalidar caches específicos
            await this.invalidarCacheProduto(produtoId);
            await this.invalidarCacheVendedor(produto.vendedor_id);
            await this.invalidarCacheLista();
            
            return produto;
        } catch (error) {
            console.error('❌ Erro ao atualizar produto:', error);
            throw error;
        }
    }

    // Deletar produto com invalidação de cache
    async deletarProduto(produtoId) {
        try {
            const produto = await Produto.findByPk(produtoId);
            if (!produto) {
                throw new Error('Produto não encontrado');
            }

            const vendedorId = produto.vendedor_id;
            await produto.destroy();
            
            // Invalidar caches
            await this.invalidarCacheProduto(produtoId);
            await this.invalidarCacheVendedor(vendedorId);
            await this.invalidarCacheLista();
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar produto:', error);
            throw error;
        }
    }

    // Obter estatísticas de produtos com cache
    async obterEstatisticasProdutos(vendedorId = null) {
        const cacheKey = `estatisticas:produtos:${vendedorId || 'global'}`;
        
        try {
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                return cached;
            }

            const whereClause = vendedorId ? { vendedor_id: vendedorId } : {};
            
            const [
                totalProdutos,
                produtosAtivos,
                produtosInativos,
                totalVendas,
                receitaTotal
            ] = await Promise.all([
                Produto.count({ where: whereClause }),
                Produto.count({ where: { ...whereClause, ativo: true } }),
                Produto.count({ where: { ...whereClause, ativo: false } }),
                Produto.sum('vendas', { where: whereClause }),
                Produto.sum('preco_com_desconto', { 
                    where: { ...whereClause, ativo: true } 
                })
            ]);

            const estatisticas = {
                totalProdutos: totalProdutos || 0,
                produtosAtivos: produtosAtivos || 0,
                produtosInativos: produtosInativos || 0,
                totalVendas: totalVendas || 0,
                receitaTotal: receitaTotal || 0,
                vendedorId: vendedorId,
                atualizadoEm: new Date().toISOString()
            };

            // Cache por 5 minutos
            await cacheService.set(cacheKey, estatisticas, 300);

            return estatisticas;
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de produtos:', error);
            throw error;
        }
    }

    // Métodos de invalidação de cache
    async invalidarCacheProduto(produtoId) {
        const keys = [
            `${this.cachePrefix}:${produtoId}`,
            `${this.cachePrefix}:public:*`
        ];
        
        for (const key of keys) {
            await cacheService.invalidatePattern(key);
        }
    }

    async invalidarCacheVendedor(vendedorId) {
        const keys = [
            `produtos:vendedor:${vendedorId}`,
            `estatisticas:produtos:${vendedorId}`
        ];
        
        for (const key of keys) {
            await cacheService.invalidatePattern(key);
        }
    }

    async invalidarCacheLista() {
        await cacheService.invalidatePattern('produtos:list:*');
        await cacheService.invalidatePattern('estatisticas:produtos:*');
    }

    // Método para warm-up do cache
    async warmUpCache(vendedorId = null) {
        try {
            console.log('🔥 Iniciando warm-up do cache de produtos...');
            
            // Buscar produtos mais acessados
            const produtosPopulares = await Produto.findAll({
                where: { ativo: true },
                order: [['vendas', 'DESC']],
                limit: 50,
                attributes: ['id', 'public_id']
            });

            // Pré-carregar no cache
            for (const produto of produtosPopulares) {
                await this.buscarProdutoPorId(produto.id, true);
                await this.buscarProdutoPorPublicId(produto.public_id, true);
            }

            // Pré-carregar listas
            await this.listarProdutos({ ativo: true }, { limite: 20, offset: 0 });
            
            if (vendedorId) {
                await this.buscarProdutosPorVendedor(vendedorId, true);
                await this.obterEstatisticasProdutos(vendedorId);
            }

            console.log('✅ Warm-up do cache concluído');
        } catch (error) {
            console.error('❌ Erro no warm-up do cache:', error);
        }
    }
}

module.exports = new OptimizedProdutoService();
