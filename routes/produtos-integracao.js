const express = require('express');
const router = express.Router();
const { Produto, Usuario } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Middleware de logging
const logProductRequest = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.url,
            userId: req.user?.id,
            duration: `${duration}ms`,
            status: res.statusCode,
            timestamp: new Date().toISOString()
        };
        
        if (duration > 1000) {
            console.warn(`⚠️ PRODUTOS LENTO:`, logData);
        } else {
            console.log(`📦 Product request:`, logData);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Aplicar middleware de logging
router.use(logProductRequest);

// Endpoint de teste
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de produtos para integrações funcionando',
        timestamp: new Date().toISOString()
    });
});

// GET - Produtos com propriedades específicas para integrações
router.get('/integracoes', authenticateToken, async (req, res) => {
    try {
        const { limite = 100, incluir_propriedades_integracao = true } = req.query;
        
        console.log(`🔄 Buscando produtos para integrações para usuário: ${req.user.id}`);
        
        // Construir condições de busca
        const whereConditions = {
            ativo: true
        };
        
        // Filtrar por vendedor se não for admin
        if (req.user.role !== 'admin') {
            whereConditions.vendedor_id = req.user.id;
        }
        
        // Buscar produtos com informações do vendedor
        const produtos = await Produto.findAll({
            where: whereConditions,
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }],
            attributes: [
                'id', 'public_id', 'custom_id', 'nome', 'descricao', 'categoria', 'tipo',
                'preco', 'preco_com_desconto', 'desconto', 'imagem_url', 'ativo',
                'disponivel_marketplace', 'vendedor_id', 'created_at', 'updated_at'
            ],
            limit: parseInt(limite),
            order: [['created_at', 'DESC']]
        });
        
        // Processar produtos para integrações
        const produtosIntegracao = produtos.map(produto => ({
            // IDs e identificadores
            id: produto.id,
            public_id: produto.public_id,
            custom_id: produto.custom_id,
            
            // Informações básicas
            nome: produto.nome,
            descricao: produto.descricao,
            categoria: produto.categoria,
            tipo: produto.tipo,
            
            // Preços e valores
            preco: produto.preco,
            preco_com_desconto: produto.preco_com_desconto,
            desconto: produto.desconto,
            valor_final: produto.preco_com_desconto || produto.preco,
            
            // Status e disponibilidade
            ativo: produto.ativo,
            disponivel_marketplace: produto.disponivel_marketplace,
            
            // Imagens
            imagem_url: produto.imagem_url,
            
            // Vendedor
            vendedor_id: produto.vendedor_id,
            vendedor_nome: produto.vendedorProduto?.nome_completo,
            vendedor_email: produto.vendedorProduto?.email,
            
            // Propriedades para Meta Pixel
            meta_pixel_properties: incluir_propriedades_integracao ? {
                content_name: produto.nome,
                content_category: produto.categoria || 'digital_product',
                content_type: 'product',
                value: produto.preco_com_desconto || produto.preco,
                currency: 'MZN',
                content_ids: [produto.public_id || produto.id],
                predicted_ltv: calcularPredictedLTV(produto),
                search_string: gerarSearchString(produto),
                custom_properties: {
                    tipo_produto: produto.tipo,
                    vendedor_id: produto.vendedor_id,
                    disponivel_marketplace: produto.disponivel_marketplace,
                    tem_desconto: produto.desconto > 0,
                    desconto_percentual: produto.desconto,
                    preco_original: produto.preco,
                    preco_final: produto.preco_com_desconto || produto.preco
                }
            } : null,
            
            // Propriedades para UMTFY
            umtfy_properties: incluir_propriedades_integracao ? {
                product_id: produto.public_id || produto.id,
                product_name: produto.nome,
                product_category: produto.categoria,
                product_value: produto.preco_com_desconto || produto.preco,
                currency: 'MZN',
                vendor_id: produto.vendedor_id,
                vendor_name: produto.vendedorProduto?.nome_completo,
                vendor_email: produto.vendedorProduto?.email,
                is_active: produto.ativo,
                has_discount: produto.desconto > 0,
                discount_percentage: produto.desconto,
                marketplace_available: produto.disponivel_marketplace
            } : null,
            
            // Propriedades para Google Analytics
            ga_properties: incluir_propriedades_integracao ? {
                item_id: produto.public_id || produto.id,
                item_name: produto.nome,
                item_category: produto.categoria,
                item_brand: produto.vendedorProduto?.nome_completo,
                price: produto.preco_com_desconto || produto.preco,
                currency: 'MZN',
                discount: produto.desconto,
                item_variant: produto.tipo
            } : null,
            
            // Timestamps
            created_at: produto.created_at,
            updated_at: produto.updated_at
        }));
        
        console.log(`✅ ${produtosIntegracao.length} produtos processados para integrações`);
        
        res.json({
            success: true,
            data: {
                produtos: produtosIntegracao,
                total: produtosIntegracao.length,
                filtros: {
                    limite: parseInt(limite),
                    incluir_propriedades: incluir_propriedades_integracao === 'true'
                },
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar produtos para integrações:`, error);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar produtos para integrações',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// GET - Produto específico com propriedades de integração
router.get('/integracoes/:produtoId', authenticateToken, async (req, res) => {
    try {
        const { produtoId } = req.params;
        
        console.log(`🔄 Buscando produto ${produtoId} para integrações`);
        
        // Buscar produto
        const produto = await Produto.findOne({
            where: { id: produtoId },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }
        
        // Verificar permissões
        if (req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado',
                message: 'Você não tem permissão para acessar este produto'
            });
        }
        
        // Processar produto para integrações
        const produtoIntegracao = {
            id: produto.id,
            public_id: produto.public_id,
            custom_id: produto.custom_id,
            nome: produto.nome,
            descricao: produto.descricao,
            categoria: produto.categoria,
            tipo: produto.tipo,
            preco: produto.preco,
            preco_com_desconto: produto.preco_com_desconto,
            desconto: produto.desconto,
            valor_final: produto.preco_com_desconto || produto.preco,
            ativo: produto.ativo,
            disponivel_marketplace: produto.disponivel_marketplace,
            imagem_url: produto.imagem_url,
            vendedor_id: produto.vendedor_id,
            vendedor_nome: produto.vendedorProduto?.nome_completo,
            vendedor_email: produto.vendedorProduto?.email,
            
            // Propriedades para integrações
            meta_pixel_properties: {
                content_name: produto.nome,
                content_category: produto.categoria || 'digital_product',
                content_type: 'product',
                value: produto.preco_com_desconto || produto.preco,
                currency: 'MZN',
                content_ids: [produto.public_id || produto.id],
                predicted_ltv: calcularPredictedLTV(produto),
                search_string: gerarSearchString(produto),
                custom_properties: {
                    tipo_produto: produto.tipo,
                    vendedor_id: produto.vendedor_id,
                    disponivel_marketplace: produto.disponivel_marketplace,
                    tem_desconto: produto.desconto > 0,
                    desconto_percentual: produto.desconto,
                    preco_original: produto.preco,
                    preco_final: produto.preco_com_desconto || produto.preco
                }
            },
            
            umtfy_properties: {
                product_id: produto.public_id || produto.id,
                product_name: produto.nome,
                product_category: produto.categoria,
                product_value: produto.preco_com_desconto || produto.preco,
                currency: 'MZN',
                vendor_id: produto.vendedor_id,
                vendor_name: produto.vendedorProduto?.nome_completo,
                vendor_email: produto.vendedorProduto?.email,
                is_active: produto.ativo,
                has_discount: produto.desconto > 0,
                discount_percentage: produto.desconto,
                marketplace_available: produto.disponivel_marketplace
            },
            
            created_at: produto.created_at,
            updated_at: produto.updated_at
        };
        
        res.json({
            success: true,
            data: {
                produto: produtoIntegracao,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar produto ${req.params.produtoId} para integrações:`, error);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar produto para integrações',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// Funções auxiliares
function calcularPredictedLTV(produto) {
    const preco = produto.preco_com_desconto || produto.preco;
    
    // Lógica para calcular LTV baseado no produto
    if (preco > 1000) return preco * 1.5;
    if (preco > 500) return preco * 1.3;
    if (preco > 100) return preco * 1.2;
    return preco * 1.1;
}

function gerarSearchString(produto) {
    const termos = [produto.nome];
    
    if (produto.categoria) termos.push(produto.categoria);
    if (produto.tipo) termos.push(produto.tipo);
    if (produto.vendedorProduto?.nome_completo) termos.push(produto.vendedorProduto.nome_completo);
    
    return termos.join(' ').toLowerCase();
}

module.exports = router;
