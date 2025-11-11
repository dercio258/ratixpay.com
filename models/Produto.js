const { Produto: ProdutoModel } = require('../config/database');
const UUIDUtils = require('../utils/uuidUtils');

class Produto {
    constructor(data = {}) {
        this.id = data.id;
        this.public_id = data.public_id;
        this.legacy_id = data.legacy_id;
        this.custom_id = data.custom_id;
        this.vendedor_id = data.vendedor_id;
        this.vendedor_legacy_id = data.vendedor_legacy_id;
        this.nome = data.nome;
        this.tipo = data.tipo;
        this.preco = data.preco;
        this.desconto = data.desconto || 0;
        this.preco_com_desconto = data.preco_com_desconto;
        this.descricao = data.descricao;
        this.imagem_url = data.imagem_url;
        this.imagem_conteudo = data.imagem_conteudo;
        this.imagem_tipo = data.imagem_tipo;
        this.link_conteudo = data.link_conteudo;
        this.ativo = data.ativo !== undefined ? data.ativo : true;
        this.vendas = data.vendas || 0;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    /**
     * Buscar todos os produtos
     * @param {Object} options - Opções de consulta
     * @returns {Promise<Array>}
     */
    static async findAll(options = {}) {
        try {
            const where = {};
            
            if (options.ativo !== undefined) {
                where.ativo = options.ativo;
            }

            const produtos = await ProdutoModel.findAll({
                where,
                limit: options.limit,
                offset: options.offset,
                order: [['created_at', 'DESC']]
            });

            return produtos.map(produto => new Produto(produto.toJSON()));
        } catch (error) {
            console.error('Erro ao buscar produtos:', error);
            throw error;
        }
    }

    /**
     * Buscar produto por ID (UUID)
     * @param {string} id - UUID do produto
     * @returns {Promise<Produto|null>}
     */
    static async findById(id) {
        try {
            const produto = await ProdutoModel.findByPk(id);
            return produto ? new Produto(produto.toJSON()) : null;
        } catch (error) {
            console.error('Erro ao buscar produto por ID:', error);
            throw error;
        }
    }

    /**
     * Buscar produto por public_id
     * @param {string} publicId - Public ID do produto
     * @returns {Promise<Produto|null>}
     */
    static async findByPublicId(publicId) {
        try {
            const produto = await ProdutoModel.findOne({
                where: { public_id: publicId }
            });
            return produto ? new Produto(produto.toJSON()) : null;
        } catch (error) {
            console.error('Erro ao buscar produto por public_id:', error);
            throw error;
        }
    }

    /**
     * Buscar produto por legacy_id (para compatibilidade durante migração)
     * @param {number} legacyId - Legacy ID do produto
     * @returns {Promise<Produto|null>}
     */
    static async findByLegacyId(legacyId) {
        try {
            const produto = await ProdutoModel.findOne({
                where: { legacy_id: legacyId }
            });
            return produto ? new Produto(produto.toJSON()) : null;
        } catch (error) {
            console.error('Erro ao buscar produto por legacy_id:', error);
            throw error;
        }
    }

    /**
     * Buscar produto por custom_id
     * @param {string} customId - Custom ID do produto
     * @returns {Promise<Produto|null>}
     */
    static async findByCustomId(customId) {
        try {
            const produto = await ProdutoModel.findOne({
                where: { custom_id: customId }
            });
            return produto ? new Produto(produto.toJSON()) : null;
        } catch (error) {
            console.error('Erro ao buscar produto por custom_id:', error);
            throw error;
        }
    }

    /**
     * Criar novo produto
     * @param {Object} data - Dados do produto
     * @returns {Promise<Produto>}
     */
    static async create(data) {
        try {
            // Gerar public_id se não fornecido
            const public_id = data.public_id || await UUIDUtils.generatePublicId('produtos');
            
            const produto = await ProdutoModel.create({
                public_id: public_id,
                custom_id: data.customId,
                vendedor_id: data.vendedor_id,
                nome: data.nome,
                tipo: data.tipo,
                preco: data.preco,
                desconto: data.desconto || 0,
                preco_com_desconto: data.precoComDesconto,
                descricao: data.descricao,
                imagem_url: data.imagemUrl,
                imagem_conteudo: data.imagemConteudo,
                imagem_tipo: data.imagemTipo,
                link_conteudo: data.linkConteudo,
                ativo: data.ativo !== undefined ? data.ativo : true,
                vendas: data.vendas || 0
            });

            return new Produto(produto.toJSON());
        } catch (error) {
            console.error('Erro ao criar produto:', error);
            throw error;
        }
    }

    /**
     * Atualizar produto
     * @param {number} id - ID do produto
     * @param {Object} data - Dados para atualizar
     * @returns {Promise<Produto|null>}
     */
    static async update(id, data) {
        try {
            const produto = await ProdutoModel.findByPk(id);
            if (!produto) {
                return null;
            }

            await produto.update({
                nome: data.nome,
                tipo: data.tipo,
                preco: data.preco,
                desconto: data.desconto,
                preco_com_desconto: data.precoComDesconto,
                descricao: data.descricao,
                imagem_url: data.imagemUrl,
                imagem_conteudo: data.imagemConteudo,
                imagem_tipo: data.imagemTipo,
                link_conteudo: data.linkConteudo,
                ativo: data.ativo,
                vendas: data.vendas
            });

            return new Produto(produto.toJSON());
        } catch (error) {
            console.error('Erro ao atualizar produto:', error);
            throw error;
        }
    }

    /**
     * Deletar produto
     * @param {number} id - ID do produto
     * @returns {Promise<boolean>}
     */
    static async delete(id) {
        try {
            const produto = await ProdutoModel.findByPk(id);
            if (!produto) {
                return false;
            }

            await produto.destroy();
            return true;
        } catch (error) {
            console.error('Erro ao deletar produto:', error);
            throw error;
        }
    }

    /**
     * Buscar produtos por tipo
     * @param {string} tipo - Tipo do produto
     * @returns {Promise<Array>}
     */
    static async findByType(tipo) {
        try {
            const produtos = await ProdutoModel.findAll({
                where: { tipo, ativo: true },
                order: [['created_at', 'DESC']]
            });

            return produtos.map(produto => new Produto(produto.toJSON()));
        } catch (error) {
            console.error('Erro ao buscar produtos por tipo:', error);
            throw error;
        }
    }

    /**
     * Buscar produtos ativos
     * @returns {Promise<Array>}
     */
    static async findActive() {
        try {
            const produtos = await ProdutoModel.findAll({
                where: { ativo: true },
                order: [['created_at', 'DESC']]
            });

            return produtos.map(produto => new Produto(produto.toJSON()));
        } catch (error) {
            console.error('Erro ao buscar produtos ativos:', error);
            throw error;
        }
    }

    /**
     * Incrementar contador de vendas
     * @param {number} id - ID do produto
     * @returns {Promise<boolean>}
     */
    static async incrementSales(id) {
        try {
            const produto = await ProdutoModel.findByPk(id);
            if (!produto) {
                return false;
            }

            await produto.increment('vendas');
            return true;
        } catch (error) {
            console.error('Erro ao incrementar vendas:', error);
            throw error;
        }
    }

    /**
     * Gerar custom ID único
     * @param {string} tipo - Tipo do produto
     * @returns {string}
     */
    static generateCustomId(tipo) {
        const prefix = tipo === 'Curso Online' ? 'CURSO' : 'EBOOK';
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${prefix}-${timestamp}-${random}`.toUpperCase();
    }

    /**
     * Verificar se custom ID existe
     * @param {string} customId - Custom ID para verificar
     * @returns {Promise<boolean>}
     */
    static async customIdExists(customId) {
        try {
            const produto = await ProdutoModel.findOne({
                where: { custom_id: customId }
            });
            return !!produto;
        } catch (error) {
            console.error('Erro ao verificar custom ID:', error);
            throw error;
        }
    }
}

module.exports = Produto;

