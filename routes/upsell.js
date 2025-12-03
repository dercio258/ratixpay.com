/**
 * Rotas da API para Sistema de Upsell
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const { Produto } = require('../config/database');

/**
 * GET /api/upsell/pages
 * Lista todas as páginas de upsell do vendedor
 */
router.get('/pages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        let query = `
            SELECT 
                up.*,
                p.nome as produto_nome_relacionado,
                p.custom_id as produto_custom_id,
                (
                    SELECT COUNT(*)::int
                    FROM produto_upsell pu
                    WHERE pu.upsell_page_id = up.id
                      AND pu.ativo = true
                ) as quantidade_produtos_relacionados
            FROM upsell_pages up
            LEFT JOIN produtos p ON p.id = up.produto_id
            WHERE ${isAdmin ? '1=1' : 'up.vendedor_id = :userId'}
            ORDER BY up.ordem ASC, up.created_at DESC
        `;

        const pages = await sequelize.query(query, {
            replacements: { userId },
            type: sequelize.QueryTypes.SELECT
        });

        // Para cada página, buscar produtos relacionados
        const pagesWithProducts = await Promise.all(
            pages.map(async (page) => {
                const [produtosRelacionados] = await sequelize.query(
                    `SELECT 
                        pu.id,
                        pu.produto_id,
                        pu.upsell_page_id,
                        pu.ordem,
                        pu.ativo,
                        pu.created_at,
                        pu.updated_at,
                        p.nome,
                        p.custom_id,
                        p.preco,
                        p.imagem_url
                    FROM produto_upsell pu
                    INNER JOIN produtos p ON p.id = pu.produto_id
                    WHERE pu.upsell_page_id = :page_id
                      AND pu.ativo = true
                      AND p.ativo = true
                    ORDER BY pu.ordem ASC`,
                    {
                        replacements: { page_id: page.id },
                        type: sequelize.QueryTypes.SELECT
                    }
                );

                return {
                    ...page,
                    produtos_relacionados: produtosRelacionados || [],
                    quantidade_produtos: produtosRelacionados?.length || 0
                };
            })
        );

        res.json({
            success: true,
            pages: pagesWithProducts || []
        });
    } catch (error) {
        console.error('❌ Erro ao listar páginas de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar páginas de upsell',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/pages/:id
 * Busca uma página de upsell específica
 */
router.get('/pages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [page] = await sequelize.query(
            `SELECT 
                up.*,
                p.nome as produto_nome_relacionado,
                p.custom_id as produto_custom_id
            FROM upsell_pages up
            LEFT JOIN produtos p ON p.id = up.produto_id
            WHERE up.id = :id 
              AND ${isAdmin ? '1=1' : 'up.vendedor_id = :userId'}`,
            {
                replacements: { id, userId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!page) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Buscar produtos relacionados
        const [produtosRelacionados] = await sequelize.query(
            `SELECT 
                pu.id,
                pu.produto_id,
                pu.upsell_page_id,
                pu.ordem,
                pu.ativo,
                pu.created_at,
                pu.updated_at,
                p.nome,
                p.custom_id,
                p.preco,
                p.imagem_url
            FROM produto_upsell pu
            INNER JOIN produtos p ON p.id = pu.produto_id
            WHERE pu.upsell_page_id = :id
              AND pu.ativo = true
            ORDER BY pu.ordem ASC`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        res.json({
            success: true,
            page: {
                ...page,
                produtos_relacionados: produtosRelacionados || []
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar página de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar página de upsell',
            error: error.message
        });
    }
});

/**
 * POST /api/upsell/pages
 * Cria uma nova página de upsell
 */
router.post('/pages', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { titulo, nome, slug, nome_produto, video_url, video_public_id, video_embed, link_checkout, produto_id, ativo, ordem, template_id, template_html, atributos } = req.body;

        if (!titulo && !nome) {
            return res.status(400).json({
                success: false,
                message: 'Título ou nome é obrigatório'
            });
        }

        // Verificar se slug já existe para este vendedor (apenas se slug foi fornecido)
        if (slug) {
            try {
                // Verificar se a coluna slug existe antes de usar
                const [columnCheck] = await sequelize.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'slug'
                `);
                
                if (columnCheck && columnCheck.length > 0) {
                    const [existingSlug] = await sequelize.query(
                        `SELECT id FROM upsell_pages WHERE vendedor_id = :userId AND slug = :slug`,
                        {
                            replacements: { userId, slug },
                            type: sequelize.QueryTypes.SELECT
                        }
                    );
                    
                    if (existingSlug) {
                        return res.status(400).json({
                            success: false,
                            message: 'Este slug já está em uso. Escolha outro ID de referência.'
                        });
                    }
                }
            } catch (checkError) {
                // Se a coluna não existir, apenas logar e continuar sem validação de slug
                console.log('⚠️ Coluna slug não encontrada, pulando validação:', checkError.message);
            }
        }

        // Construir query dinamicamente para incluir campos opcionais
        const campos = ['vendedor_id', 'titulo', 'nome_produto', 'video_url', 'video_public_id', 'video_embed', 'link_checkout', 'produto_id', 'ativo', 'ordem'];
        const valores = [':vendedor_id', ':titulo', ':nome_produto', ':video_url', ':video_public_id', ':video_embed', ':link_checkout', ':produto_id', ':ativo', ':ordem'];
        const replacements = {
                    vendedor_id: userId,
            titulo: titulo || nome || 'Oferta Especial',
            nome_produto: nome_produto || '',
                    video_url: video_url || null,
                    video_public_id: video_public_id || null,
                    video_embed: video_embed || null,
                    link_checkout: link_checkout || null,
                    produto_id: produto_id || null,
                    ativo: ativo !== undefined ? ativo : true,
                    ordem: ordem || 0
        };

        // Adicionar novos campos (apenas se fornecidos)
        if (nome !== undefined && nome !== null && nome !== '') {
            campos.push('nome');
            valores.push(':nome');
            replacements.nome = nome;
        }
        if (slug !== undefined && slug !== null && slug !== '') {
            campos.push('slug');
            valores.push(':slug');
            replacements.slug = slug;
        }
        if (atributos !== undefined && atributos !== null) {
            campos.push('atributos');
            valores.push(':atributos');
            replacements.atributos = typeof atributos === 'string' ? atributos : JSON.stringify(atributos);
        }

        // Adicionar campos opcionais existentes
        const { subheadline, reforco_final } = req.body;
        if (subheadline !== undefined) {
            campos.push('subheadline');
            valores.push(':subheadline');
            replacements.subheadline = subheadline;
        }
        if (reforco_final !== undefined) {
            campos.push('reforco_final');
            valores.push(':reforco_final');
            replacements.reforco_final = reforco_final;
        }
        if (template_id !== undefined) {
            campos.push('template_id');
            valores.push(':template_id');
            replacements.template_id = template_id || 'default';
        }
        if (template_html !== undefined) {
            campos.push('template_html');
            valores.push(':template_html');
            replacements.template_html = template_html || null;
        }

        const [result] = await sequelize.query(
            `INSERT INTO upsell_pages 
             (${campos.join(', ')})
             VALUES (${valores.join(', ')})
             RETURNING *`,
            {
                replacements,
                type: sequelize.QueryTypes.INSERT
            }
        );

        console.log('✅ Página de upsell criada:', {
            id: result[0]?.id,
            slug: result[0]?.slug,
            nome: result[0]?.nome,
            template_id: result[0]?.template_id
        });

        res.json({
            success: true,
            page: result[0]
        });
    } catch (error) {
        console.error('❌ Erro ao criar página de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar página de upsell',
            error: error.message
        });
    }
});

/**
 * PUT /api/upsell/pages/:id
 * Atualiza uma página de upsell
 */
router.put('/pages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const { titulo, nome, slug, nome_produto, video_url, video_public_id, video_embed, link_checkout, produto_id, ativo, ordem, subheadline, reforco_final, template_id, template_html, atributos } = req.body;

        // Verificar se a página pertence ao vendedor
        // Usar query que funciona mesmo se slug não existir
        let existing;
        try {
            const [result] = await sequelize.query(
                `SELECT id, vendedor_id, slug FROM upsell_pages 
             WHERE id = :id AND ${isAdmin ? '1=1' : 'vendedor_id = :userId'}`,
            {
                replacements: { id, userId },
                type: sequelize.QueryTypes.SELECT
            }
        );
            existing = result;
        } catch (error) {
            // Se slug não existir, tentar sem ele
            if (error.message.includes('slug')) {
                const [result] = await sequelize.query(
                    `SELECT id, vendedor_id FROM upsell_pages 
                     WHERE id = :id AND ${isAdmin ? '1=1' : 'vendedor_id = :userId'}`,
                    {
                        replacements: { id, userId },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
                existing = result;
                if (existing) existing.slug = null; // Adicionar slug como null
            } else {
                throw error;
            }
        }

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Verificar se slug já existe para este vendedor (exceto a própria página)
        // Apenas se slug foi fornecido e a coluna existe
        if (slug && slug !== existing.slug) {
            try {
                const [existingSlug] = await sequelize.query(
                    `SELECT id FROM upsell_pages WHERE vendedor_id = :vendedorId AND slug = :slug AND id != :id`,
                    {
                        replacements: { vendedorId: existing.vendedor_id, slug, id },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
                
                if (existingSlug) {
                    return res.status(400).json({
                        success: false,
                        message: 'Este slug já está em uso. Escolha outro ID de referência.'
                    });
                }
            } catch (slugError) {
                // Se a coluna slug não existir, apenas logar e continuar
                if (slugError.message.includes('slug')) {
                    console.log('⚠️ Coluna slug não encontrada, pulando validação de duplicidade');
                } else {
                    throw slugError;
                }
            }
        }

        const updates = [];
        const replacements = { id };

        if (titulo !== undefined) {
            updates.push('titulo = :titulo');
            replacements.titulo = titulo;
        }
        if (nome !== undefined) {
            updates.push('nome = :nome');
            replacements.nome = nome;
        }
        if (slug !== undefined) {
            updates.push('slug = :slug');
            replacements.slug = slug;
        }
        if (nome_produto !== undefined) {
            updates.push('nome_produto = :nome_produto');
            replacements.nome_produto = nome_produto;
        }
        if (video_url !== undefined) {
            updates.push('video_url = :video_url');
            replacements.video_url = video_url;
        }
        if (video_public_id !== undefined) {
            updates.push('video_public_id = :video_public_id');
            replacements.video_public_id = video_public_id;
        }
        if (video_embed !== undefined) {
            updates.push('video_embed = :video_embed');
            replacements.video_embed = video_embed;
        }
        if (link_checkout !== undefined) {
            updates.push('link_checkout = :link_checkout');
            replacements.link_checkout = link_checkout;
        }
        if (produto_id !== undefined) {
            updates.push('produto_id = :produto_id');
            replacements.produto_id = produto_id;
        }
        if (ativo !== undefined) {
            updates.push('ativo = :ativo');
            replacements.ativo = ativo;
        }
        if (ordem !== undefined) {
            updates.push('ordem = :ordem');
            replacements.ordem = ordem;
        }
        if (subheadline !== undefined) {
            updates.push('subheadline = :subheadline');
            replacements.subheadline = subheadline;
        }
        if (reforco_final !== undefined) {
            updates.push('reforco_final = :reforco_final');
            replacements.reforco_final = reforco_final;
        }
        if (template_id !== undefined) {
            updates.push('template_id = :template_id');
            replacements.template_id = template_id;
        }
        if (template_html !== undefined) {
            updates.push('template_html = :template_html');
            replacements.template_html = template_html;
        }
        if (atributos !== undefined) {
            updates.push('atributos = :atributos');
            replacements.atributos = JSON.stringify(atributos);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        if (updates.length === 1) { // Apenas o updated_at
            return res.status(400).json({
                success: false,
                message: 'Nenhum campo para atualizar'
            });
        }

        await sequelize.query(
            `UPDATE upsell_pages 
             SET ${updates.join(', ')}
             WHERE id = :id`,
            {
                replacements,
                type: sequelize.QueryTypes.UPDATE
            }
        );

        // Buscar página atualizada
        const [updated] = await sequelize.query(
            `SELECT * FROM upsell_pages WHERE id = :id`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        console.log('✅ Página de upsell atualizada:', {
            id: updated?.id,
            slug: updated?.slug,
            nome: updated?.nome,
            template_id: updated?.template_id
        });

        res.json({
            success: true,
            page: updated
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar página de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar página de upsell',
            error: error.message
        });
    }
});

/**
 * DELETE /api/upsell/pages/:id
 * Exclui uma página de upsell
 */
router.delete('/pages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Verificar se a página pertence ao vendedor
        const [existing] = await sequelize.query(
            `SELECT id FROM upsell_pages 
             WHERE id = :id AND ${isAdmin ? '1=1' : 'vendedor_id = :userId'}`,
            {
                replacements: { id, userId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        await sequelize.query(
            `DELETE FROM upsell_pages WHERE id = :id`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.DELETE
            }
        );

        res.json({
            success: true,
            message: 'Página de upsell excluída com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao excluir página de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir página de upsell',
            error: error.message
        });
    }
});

/**
 * POST /api/upsell/pages/:id/produtos
 * Relaciona produtos com uma página de upsell
 */
router.post('/pages/:id/produtos', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const { produto_ids } = req.body; // Array de IDs de produtos

        console.log('🔗 Relacionando produtos à página de upsell:', {
            pageId: id,
            userId,
            isAdmin,
            produtoIds: produto_ids,
            quantidade: produto_ids?.length || 0
        });

        if (!Array.isArray(produto_ids)) {
            return res.status(400).json({
                success: false,
                message: 'produto_ids deve ser um array'
            });
        }

        // Verificar se a página pertence ao vendedor
        const [page] = await sequelize.query(
            `SELECT id FROM upsell_pages 
             WHERE id = :id AND ${isAdmin ? '1=1' : 'vendedor_id = :userId'}`,
            {
                replacements: { id, userId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!page) {
            console.error('❌ Página de upsell não encontrada ou sem permissão:', id);
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Validar e verificar se os produtos pertencem ao vendedor
        if (produto_ids.length > 0) {
            // Filtrar IDs vazios ou inválidos
            const validProdutoIds = produto_ids.filter(id => id && id.trim() !== '');
            
            if (validProdutoIds.length === 0) {
                // Se não há IDs válidos, apenas remover relacionamentos existentes
        await sequelize.query(
            `DELETE FROM produto_upsell WHERE upsell_page_id = :id`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.DELETE
            }
        );

                return res.json({
                    success: true,
                    message: 'Relacionamentos removidos com sucesso'
                });
            }

            // Verificar se os produtos existem e pertencem ao vendedor
            const produtosQuery = isAdmin 
                ? `SELECT id FROM produtos WHERE id IN (:produto_ids) AND ativo = true`
                : `SELECT id FROM produtos WHERE id IN (:produto_ids) AND vendedor_id = :userId AND ativo = true`;
            
            const produtosValidos = await sequelize.query(
                produtosQuery,
                {
                    replacements: { produto_ids: validProdutoIds, userId },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            const produtosIdsValidos = produtosValidos.map(p => p.id);
            
            if (produtosIdsValidos.length === 0 && validProdutoIds.length > 0) {
                console.error('❌ Nenhum produto válido encontrado para o vendedor');
                return res.status(400).json({
                    success: false,
                    message: 'Nenhum produto válido encontrado. Verifique se os produtos pertencem a você e estão ativos.'
                });
            }

            // Usar transação para garantir consistência
            const transaction = await sequelize.transaction();
            
            try {
                // Remover relacionamentos existentes
                const deleteResult = await sequelize.query(
                    `DELETE FROM produto_upsell WHERE upsell_page_id = :id`,
                    {
                        replacements: { id },
                        type: sequelize.QueryTypes.DELETE,
                        transaction
                    }
                );
                console.log(`🗑️ Relacionamentos antigos removidos para página ${id}`);

                // Adicionar novos relacionamentos apenas com produtos válidos
                const produtosInseridos = [];
                for (let i = 0; i < produtosIdsValidos.length; i++) {
                    try {
                        const insertResult = await sequelize.query(
                            `INSERT INTO produto_upsell (produto_id, upsell_page_id, ordem, ativo, created_at, updated_at)
                             VALUES (:produto_id, :upsell_page_id, :ordem, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                             RETURNING id, produto_id, upsell_page_id, ordem, ativo`,
                    {
                        replacements: {
                                    produto_id: produtosIdsValidos[i],
                            upsell_page_id: id,
                            ordem: i
                        },
                                type: sequelize.QueryTypes.INSERT,
                                transaction
                            }
                        );
                        
                        if (insertResult && insertResult[0] && insertResult[0][0]) {
                            produtosInseridos.push(insertResult[0][0]);
                            console.log(`✅ Produto ${produtosIdsValidos[i]} relacionado com sucesso:`, insertResult[0][0]);
                        }
                    } catch (insertError) {
                        console.error(`❌ Erro ao inserir produto ${produtosIdsValidos[i]}:`, insertError);
                        throw insertError; // Re-throw para fazer rollback
                    }
                }

                // Confirmar transação
                await transaction.commit();
                console.log('✅ Transação confirmada - dados salvos no banco de dados');
                
                // Aguardar um pouco para garantir que o commit foi processado
                await new Promise(resolve => setTimeout(resolve, 50));
                
                // Verificar se os dados foram salvos corretamente
                const [verificacao] = await sequelize.query(
                    `SELECT COUNT(*)::int as total FROM produto_upsell WHERE upsell_page_id = :id AND ativo = true`,
                    {
                        replacements: { id },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
                
                console.log(`✅ ${produtosIdsValidos.length} produto(s) relacionado(s) com sucesso`);
                console.log(`📊 Verificação COUNT: ${verificacao.total} relacionamento(s) ativo(s) na tabela produto_upsell`);
                
                if (parseInt(verificacao.total) !== produtosIdsValidos.length) {
                    console.warn(`⚠️ Aviso: Esperado ${produtosIdsValidos.length} relacionamentos, mas encontrado ${verificacao.total}`);
                }

                // Buscar relacionamentos salvos para retornar na resposta
                // Usar query direta sem transação (já foi commitada)
                const relacionamentosQuery = await sequelize.query(
                    `SELECT 
                        pu.id,
                        pu.produto_id,
                        pu.upsell_page_id,
                        pu.ordem,
                        pu.ativo,
                        pu.created_at,
                        pu.updated_at,
                        p.nome as produto_nome,
                        p.custom_id as produto_custom_id
                    FROM produto_upsell pu
                    INNER JOIN produtos p ON p.id = pu.produto_id
                    WHERE pu.upsell_page_id = :id
                      AND pu.ativo = true
                    ORDER BY pu.ordem ASC`,
                    {
                        replacements: { id },
                        type: sequelize.QueryTypes.SELECT
                    }
                );

                // sequelize.query com QueryTypes.SELECT retorna diretamente um array de resultados
                // Não retorna [resultados, metadata] como outras queries
                const relacionamentosArray = Array.isArray(relacionamentosQuery)
                    ? relacionamentosQuery
                    : [];
                
                console.log('📋 Relacionamentos confirmados no banco de dados:', relacionamentosArray.length);
                if (relacionamentosArray.length > 0) {
                    console.log('💾 Dados salvos no banco:');
                    relacionamentosArray.forEach((rel, index) => {
                        console.log(`   ${index + 1}. ID: ${rel.id}, Produto: ${rel.produto_nome} (${rel.produto_custom_id}), Ordem: ${rel.ordem}`);
                    });
                } else {
                    console.log('⚠️ Nenhum relacionamento encontrado no banco após salvar');
                }

                return res.json({
            success: true,
                    message: produto_ids.length > 0 
                        ? `${produto_ids.length} produto(s) relacionado(s) com sucesso e salvos no banco de dados`
                        : 'Relacionamentos atualizados com sucesso',
                    relacionamentos_salvos: relacionamentosArray || [],
                    total_salvos: relacionamentosArray.length || 0,
                    dados_confirmados: true
                });
            } catch (error) {
                // Reverter transação em caso de erro
                await transaction.rollback();
                console.error('❌ Erro na transação, revertendo alterações:', error);
                throw error;
            }
        } else {
            // Se não há produtos, apenas remover relacionamentos existentes
            await sequelize.query(
                `DELETE FROM produto_upsell WHERE upsell_page_id = :id`,
                {
                    replacements: { id },
                    type: sequelize.QueryTypes.DELETE
                }
            );
            console.log('✅ Relacionamentos removidos (nenhum produto selecionado)');
            
            return res.json({
                success: true,
                message: 'Relacionamentos atualizados com sucesso (nenhum produto selecionado)',
                relacionamentos_salvos: [],
                total_salvos: 0,
                dados_confirmados: true
            });
        }
    } catch (error) {
        console.error('❌ Erro ao relacionar produtos:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro ao relacionar produtos',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/produtos
 * Lista produtos do vendedor para seleção
 */
router.get('/produtos', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const produtos = await Produto.findAll({
            where: {
                vendedor_id: userId,
                ativo: true
            },
            attributes: ['id', 'nome', 'custom_id', 'preco', 'imagem_url'],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            produtos: produtos.map(p => ({
                id: p.id,
                nome: p.nome,
                custom_id: p.custom_id,
                preco: p.preco,
                imagem_url: p.imagem_url
            }))
        });
    } catch (error) {
        console.error('❌ Erro ao listar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar produtos',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/pages/slug/:slug
 * Busca página de upsell pública pelo slug (sem autenticação)
 */
router.get('/pages/slug/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const [page] = await sequelize.query(
            `SELECT 
                up.*,
                p.nome as produto_nome_relacionado,
                p.custom_id as produto_custom_id
            FROM upsell_pages up
            LEFT JOIN produtos p ON p.id = up.produto_id
            WHERE up.slug = :slug AND up.ativo = true`,
            {
                replacements: { slug },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!page) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Buscar produtos relacionados
        console.log('🔍 Buscando produtos relacionados para página (slug):', slug);
        
        const produtosRelacionadosResult = await sequelize.query(
            `SELECT 
                p.id,
                p.id as produto_id,
                pu.id as relacionamento_id,
                pu.upsell_page_id,
                pu.ordem,
                pu.ativo as relacionamento_ativo,
                p.nome,
                p.custom_id,
                p.preco,
                p.imagem_url,
                p.descricao,
                p.vendedor_id,
                p.ativo as produto_ativo
            FROM produto_upsell pu
            INNER JOIN produtos p ON p.id = pu.produto_id
            WHERE pu.upsell_page_id = :id
              AND pu.ativo = true
              AND p.ativo = true
            ORDER BY pu.ordem ASC`,
            {
                replacements: { id: page.id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        const produtosRelacionados = Array.isArray(produtosRelacionadosResult) 
            ? produtosRelacionadosResult 
            : (produtosRelacionadosResult ? [produtosRelacionadosResult] : []);

        console.log('📦 Produtos relacionados encontrados (slug):', produtosRelacionados.length);

        res.json({
            success: true,
            page: {
                ...page,
                produtos_relacionados: produtosRelacionados
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar página de upsell por slug:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar página de upsell',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/pages/public/:id
 * Busca página de upsell pública por ID (sem autenticação)
 */
router.get('/pages/public/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [page] = await sequelize.query(
            `SELECT 
                up.*,
                p.nome as produto_nome_relacionado,
                p.custom_id as produto_custom_id
            FROM upsell_pages up
            LEFT JOIN produtos p ON p.id = up.produto_id
            WHERE up.id = :id AND up.ativo = true`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!page) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Buscar produtos relacionados
        console.log('🔍 Buscando produtos relacionados para página pública:', id);
        
        const produtosRelacionadosResult = await sequelize.query(
            `SELECT 
                p.id,
                p.id as produto_id,
                pu.id as relacionamento_id,
                pu.upsell_page_id,
                pu.ordem,
                pu.ativo as relacionamento_ativo,
                p.nome,
                p.custom_id,
                p.preco,
                p.imagem_url,
                p.descricao,
                p.vendedor_id,
                p.ativo as produto_ativo
            FROM produto_upsell pu
            INNER JOIN produtos p ON p.id = pu.produto_id
            WHERE pu.upsell_page_id = :id
              AND pu.ativo = true
              AND p.ativo = true
            ORDER BY pu.ordem ASC`,
            {
                replacements: { id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Garantir que sempre seja um array
        const produtosRelacionados = Array.isArray(produtosRelacionadosResult) 
            ? produtosRelacionadosResult 
            : (produtosRelacionadosResult ? [produtosRelacionadosResult] : []);

        console.log('📦 Produtos relacionados encontrados (pública):', produtosRelacionados.length);
        console.log('📦 Tipo do resultado:', Array.isArray(produtosRelacionadosResult) ? 'array' : typeof produtosRelacionadosResult);
        if (produtosRelacionados.length > 0) {
            console.log('📦 Primeiro produto (pública):', produtosRelacionados[0]);
        } else {
            console.warn('⚠️ Nenhum produto relacionado encontrado para a página pública:', id);
        }

        res.json({
            success: true,
            page: {
                ...page,
                produtos_relacionados: produtosRelacionados
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar página de upsell pública:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar página de upsell',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/produto/:produto_id
 * Busca página de upsell ativa relacionada a um produto específico (público)
 * Usa a nova tabela produto_upsell_page para relacionar produto comprado → página de upsell
 */
router.get('/produto/:produto_id', async (req, res) => {
    try {
        const { produto_id } = req.params;

        // Buscar página de upsell relacionada ao produto através da nova tabela
        const [relacionamento] = await sequelize.query(
            `SELECT 
                pup.upsell_page_id,
                up.*
            FROM produto_upsell_page pup
            INNER JOIN upsell_pages up ON up.id = pup.upsell_page_id
            WHERE pup.produto_id = :produto_id 
              AND pup.ativo = true
              AND up.ativo = true
            LIMIT 1`,
            {
                replacements: { produto_id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!relacionamento) {
            return res.json({
                success: true,
                hasUpsell: false,
                page: null
            });
        }

        // Buscar produtos relacionados (produtos bônus) da página de upsell
        const upsellPageId = relacionamento.upsell_page_id || relacionamento.id;
        console.log('🔍 Buscando produtos relacionados para página de upsell:', upsellPageId);
        
        const produtosRelacionadosResult = await sequelize.query(
            `SELECT 
                p.id,
                p.id as produto_id,
                pu.id as relacionamento_id,
                pu.upsell_page_id,
                pu.ordem,
                pu.ativo as relacionamento_ativo,
                p.nome,
                p.custom_id,
                p.preco,
                p.imagem_url,
                p.descricao,
                p.ativo as produto_ativo
            FROM produto_upsell pu
            INNER JOIN produtos p ON p.id = pu.produto_id
            WHERE pu.upsell_page_id = :page_id
              AND pu.ativo = true
              AND p.ativo = true
            ORDER BY pu.ordem ASC`,
            {
                replacements: { page_id: upsellPageId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        // Garantir que sempre seja um array
        const produtosRelacionados = Array.isArray(produtosRelacionadosResult) 
            ? produtosRelacionadosResult 
            : (produtosRelacionadosResult ? [produtosRelacionadosResult] : []);

        console.log('📦 Produtos relacionados encontrados:', produtosRelacionados.length);
        console.log('📦 Tipo do resultado:', Array.isArray(produtosRelacionadosResult) ? 'array' : typeof produtosRelacionadosResult);
        if (produtosRelacionados.length > 0) {
            console.log('📦 Primeiro produto:', produtosRelacionados[0]);
        } else {
            console.warn('⚠️ Nenhum produto relacionado encontrado para a página de upsell:', upsellPageId);
        }

        res.json({
            success: true,
            hasUpsell: true,
            page: {
                ...relacionamento,
                produtos_relacionados: produtosRelacionados
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar upsell por produto:', error);
        res.status(500).json({
            success: false,
            hasUpsell: false,
            message: 'Erro ao buscar página de upsell',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/produtos/:produto_id/pagina
 * Busca página de upsell relacionada a um produto (autenticado)
 */
router.get('/produtos/:produto_id/pagina', authenticateToken, async (req, res) => {
    try {
        const { produto_id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Verificar se o produto pertence ao vendedor
        const produtoQuery = isAdmin 
            ? `SELECT id FROM produtos WHERE id = :produto_id AND ativo = true`
            : `SELECT id FROM produtos WHERE id = :produto_id AND vendedor_id = :userId AND ativo = true`;

        const [produto] = await sequelize.query(produtoQuery, {
            replacements: { produto_id, userId },
            type: sequelize.QueryTypes.SELECT
        });

        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Buscar página de upsell relacionada
        const [relacionamento] = await sequelize.query(
            `SELECT 
                pup.upsell_page_id,
                up.*
            FROM produto_upsell_page pup
            INNER JOIN upsell_pages up ON up.id = pup.upsell_page_id
            WHERE pup.produto_id = :produto_id 
              AND pup.ativo = true
              AND up.ativo = true
            LIMIT 1`,
            {
                replacements: { produto_id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!relacionamento) {
            return res.json({
                success: true,
                hasUpsell: false,
                page: null
            });
        }

        res.json({
            success: true,
            hasUpsell: true,
            page: relacionamento
        });
    } catch (error) {
        console.error('❌ Erro ao buscar página de upsell do produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar página de upsell',
            error: error.message
        });
    }
});

/**
 * POST /api/upsell/produtos/:produto_id/pagina
 * Relaciona uma página de upsell a um produto
 */
router.post('/produtos/:produto_id/pagina', authenticateToken, async (req, res) => {
    try {
        const { produto_id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';
        const { upsell_page_id } = req.body;

        if (!upsell_page_id) {
            return res.status(400).json({
                success: false,
                message: 'upsell_page_id é obrigatório'
            });
        }

        // Verificar se o produto pertence ao vendedor
        const produtoQuery = isAdmin 
            ? `SELECT id FROM produtos WHERE id = :produto_id AND ativo = true`
            : `SELECT id FROM produtos WHERE id = :produto_id AND vendedor_id = :userId AND ativo = true`;

        const [produto] = await sequelize.query(produtoQuery, {
            replacements: { produto_id, userId },
            type: sequelize.QueryTypes.SELECT
        });

        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Verificar se a página de upsell pertence ao vendedor
        const [page] = await sequelize.query(
            `SELECT id FROM upsell_pages 
             WHERE id = :upsell_page_id 
               AND ${isAdmin ? '1=1' : 'vendedor_id = :userId'}
               AND ativo = true`,
            {
                replacements: { upsell_page_id, userId },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!page) {
            return res.status(404).json({
                success: false,
                message: 'Página de upsell não encontrada'
            });
        }

        // Inserir ou atualizar relacionamento
        const [result] = await sequelize.query(
            `INSERT INTO produto_upsell_page (produto_id, upsell_page_id, ativo, created_at, updated_at)
             VALUES (:produto_id, :upsell_page_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (produto_id, upsell_page_id) 
             DO UPDATE SET ativo = true, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            {
                replacements: { produto_id, upsell_page_id },
                type: sequelize.QueryTypes.INSERT
            }
        );

        res.json({
            success: true,
            message: 'Página de upsell relacionada com sucesso',
            relacionamento: result[0]
        });
    } catch (error) {
        console.error('❌ Erro ao relacionar página de upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao relacionar página de upsell',
            error: error.message
        });
    }
});

/**
 * DELETE /api/upsell/produtos/:produto_id/pagina
 * Remove relacionamento entre produto e página de upsell
 */
router.delete('/produtos/:produto_id/pagina', authenticateToken, async (req, res) => {
    try {
        const { produto_id } = req.params;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        // Verificar se o produto pertence ao vendedor
        const produtoQuery = isAdmin 
            ? `SELECT id FROM produtos WHERE id = :produto_id`
            : `SELECT id FROM produtos WHERE id = :produto_id AND vendedor_id = :userId`;

        const [produto] = await sequelize.query(produtoQuery, {
            replacements: { produto_id, userId },
            type: sequelize.QueryTypes.SELECT
        });

        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Desativar relacionamento
        await sequelize.query(
            `UPDATE produto_upsell_page 
             SET ativo = false, updated_at = CURRENT_TIMESTAMP
             WHERE produto_id = :produto_id`,
            {
                replacements: { produto_id },
                type: sequelize.QueryTypes.UPDATE
            }
        );

        res.json({
            success: true,
            message: 'Relacionamento removido com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao remover relacionamento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover relacionamento',
            error: error.message
        });
    }
});

/**
 * GET /api/upsell/pedido/:pedido_id
 * Busca informações do pedido para one-click upsell
 */
router.get('/pedido/:pedido_id', async (req, res) => {
    try {
        const { pedido_id } = req.params;

        // Buscar venda pela referencia_pagamento, id ou public_id
        const [venda] = await sequelize.query(
            `SELECT v.*, 
                    c.nome as cliente_nome, 
                    c.email as cliente_email, 
                    c.telefone as cliente_telefone,
                    COALESCE(v.cliente_nome, c.nome) as nome_cliente,
                    COALESCE(v.cliente_email, c.email) as email_cliente,
                    COALESCE(v.cliente_telefone, c.telefone) as telefone_cliente
             FROM vendas v
             LEFT JOIN clientes c ON c.id = v.cliente_id
             WHERE v.id::text = :pedido_id 
                OR v.referencia_pagamento = :pedido_id
                OR v.public_id::text = :pedido_id
             LIMIT 1`,
            {
                replacements: { pedido_id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }

        // Extrair telefone (remover caracteres não numéricos, exceto +)
        let telefone = (venda.telefone_cliente || venda.cliente_telefone || '').toString().replace(/[^\d+]/g, '');
        // Se não começar com +, garantir formato correto (84XXXXXXXXX)
        if (telefone && !telefone.startsWith('+')) {
            telefone = telefone.replace(/^258/, ''); // Remover código do país se presente
            if (!telefone.startsWith('84') && !telefone.startsWith('85') && !telefone.startsWith('86') && !telefone.startsWith('87')) {
                telefone = '84' + telefone.replace(/^84/, ''); // Garantir que comece com 84
            }
        }

        // Normalizar método de pagamento
        let metodoPagamento = (venda.metodo_pagamento || venda.pagamento_metodo || 'mpesa').toLowerCase().trim();
        
        // Mapear variações comuns para valores padrão
        const metodoMap = {
            'm-pesa': 'mpesa',
            'mpesa': 'mpesa',
            'emola': 'emola',
            'e-mola': 'emola',
            'mcel': 'mpesa', // MCel geralmente usa M-Pesa
            'vodacom': 'mpesa' // Vodacom geralmente usa M-Pesa
        };
        
        // Normalizar método de pagamento
        if (metodoMap[metodoPagamento]) {
            metodoPagamento = metodoMap[metodoPagamento];
        } else if (!metodoPagamento || metodoPagamento === '') {
            metodoPagamento = 'mpesa'; // Padrão
        }
        
        console.log('💳 Método de pagamento original:', venda.metodo_pagamento || venda.pagamento_metodo);
        console.log('💳 Método de pagamento normalizado:', metodoPagamento);

        res.json({
            success: true,
            pedido: {
                id: venda.id,
                transaction_id: venda.referencia_pagamento || venda.id,
                cliente: {
                    nome: venda.nome_cliente || venda.cliente_nome || '',
                    email: venda.email_cliente || venda.cliente_email || '',
                    telefone: telefone
                },
                pagamento: {
                    metodo: metodoPagamento,
                    status: venda.status || venda.pagamento_status || 'Pendente',
                    valor: parseFloat(venda.valor || venda.pagamento_valor || 0)
                }
            }
        });

    } catch (error) {
        console.error('❌ Erro ao buscar pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar informações do pedido',
            error: error.message
        });
    }
});

/**
 * POST /api/upsell/processar
 * Processa pagamento one-click upsell usando PayMoz diretamente
 */
router.post('/processar', async (req, res) => {
    try {
        const { pedido_id, produto_id, valor } = req.body;

        if (!pedido_id || !produto_id || !valor) {
            return res.status(400).json({
                success: false,
                message: 'Dados incompletos para processar upsell'
            });
        }

        // Buscar informações do pedido original
        const [pedido] = await sequelize.query(
            `SELECT v.*, 
                    c.nome as cliente_nome, 
                    c.email as cliente_email, 
                    c.telefone as cliente_telefone,
                    COALESCE(v.cliente_nome, c.nome) as nome_cliente,
                    COALESCE(v.cliente_email, c.email) as email_cliente,
                    COALESCE(v.cliente_telefone, c.telefone) as telefone_cliente
             FROM vendas v
             LEFT JOIN clientes c ON c.id = v.cliente_id
             WHERE v.id::text = :pedido_id 
                OR v.referencia_pagamento = :pedido_id
                OR v.public_id::text = :pedido_id
             LIMIT 1`,
            {
                replacements: { pedido_id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (!pedido) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }

        // Buscar produto do upsell (suporta UUID, public_id ou custom_id)
        let produto = null;
        
        // Converter produto_id para string para comparações
        const produtoIdStr = String(produto_id).trim();
        
        // Verificar se é UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(produtoIdStr)) {
            // Buscar por UUID
            produto = await Produto.findByPk(produtoIdStr);
        } else if (/^\d{6}$/.test(produtoIdStr)) {
            // Se for 6 dígitos, buscar por public_id
            produto = await Produto.findOne({ where: { public_id: produtoIdStr } });
        } else {
            // Caso contrário, buscar por custom_id (sempre como string)
            produto = await Produto.findOne({ where: { custom_id: produtoIdStr } });
        }
        
        if (!produto || !produto.ativo) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado ou inativo'
            });
        }

        // Extrair telefone do cliente
        let telefone = (pedido.telefone_cliente || pedido.cliente_telefone || '').toString().replace(/[^\d+]/g, '');
        if (!telefone) {
            return res.status(400).json({
                success: false,
                message: 'Telefone do cliente não encontrado no pedido original'
            });
        }

        // Formatar telefone (remover código do país se presente, garantir formato 84XXXXXXXXX)
        if (telefone.startsWith('+258')) {
            telefone = telefone.replace('+258', '');
        } else if (telefone.startsWith('258')) {
            telefone = telefone.replace('258', '');
        }
        
        // Garantir que comece com 84, 85, 86 ou 87
        if (!telefone.match(/^8[4-7]/)) {
            telefone = '84' + telefone.replace(/^84/, '');
        }

        // Obter método de pagamento do pedido original
        let metodoPagamento = (pedido.metodo_pagamento || pedido.pagamento_metodo || pedido.pagamento?.metodo || 'mpesa').toLowerCase().trim();
        
        console.log('💳 Método de pagamento recebido do pedido:', pedido.metodo_pagamento || pedido.pagamento_metodo || pedido.pagamento?.metodo);
        console.log('💳 Método de pagamento após toLowerCase:', metodoPagamento);
        
        // Mapear variações comuns para valores padrão
        const metodoMap = {
            'm-pesa': 'mpesa',
            'mpesa': 'mpesa',
            'emola': 'emola',
            'e-mola': 'emola',
            'mcel': 'mpesa', // MCel geralmente usa M-Pesa
            'vodacom': 'mpesa' // Vodacom geralmente usa M-Pesa
        };
        
        // Normalizar método de pagamento
        if (metodoMap[metodoPagamento]) {
            metodoPagamento = metodoMap[metodoPagamento];
        } else if (!metodoPagamento || metodoPagamento === '') {
            metodoPagamento = 'mpesa'; // Padrão
        }
        
        console.log('💳 Método de pagamento normalizado:', metodoPagamento);
        
        // Validar método
        if (metodoPagamento !== 'mpesa' && metodoPagamento !== 'emola') {
            console.error('❌ Método de pagamento inválido:', metodoPagamento);
            return res.status(400).json({
                success: false,
                message: `Método de pagamento inválido: "${metodoPagamento}". Use mpesa ou emola.`
            });
        }

        // Criar referência externa única para o upsell
        const referenciaExterna = `upsell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Processar pagamento DIRETO via PayMoz (one-click upsell)
        const paymozService = require('../services/paymozService');
        const paymozResult = await paymozService.processPayment(
            metodoPagamento,
            parseFloat(valor),
            telefone,
            referenciaExterna
        );

        // Verificar se o pagamento foi processado com sucesso
        if (!paymozResult.success) {
            return res.status(400).json({
                success: false,
                message: paymozResult.message || 'Erro ao processar pagamento via PayMoz',
                error: paymozResult.error || 'Falha na comunicação com PayMoz'
            });
        }

        // Obter transaction_id real do PayMoz
        const transactionIdPayMoz = paymozResult.transaction_id || 
                                   paymozResult.output_ThirdPartyReference || 
                                   paymozResult.output_TransactionID || 
                                   referenciaExterna;

        // Criar nova venda para o upsell
        const { Venda } = require('../config/database');
        const { Cliente } = require('../config/database');
        
        // Buscar ou criar cliente
        const emailCliente = pedido.email_cliente || pedido.cliente_email || '';
        let cliente = null;
        
        if (emailCliente) {
            cliente = await Cliente.findOne({
                where: { email: emailCliente }
            });
        }

        if (!cliente) {
            cliente = await Cliente.create({
                nome: pedido.nome_cliente || pedido.cliente_nome || 'Cliente',
                email: emailCliente,
                telefone: telefone
            });
        }

        // Criar venda do upsell com status baseado na resposta do PayMoz
        const statusPagamento = paymozResult.status === 'approved' ? 'Aprovado' : 
                               paymozResult.status === 'pending' ? 'Pendente' : 'Pendente';
        const statusVenda = paymozResult.status === 'approved' ? 'Pago' : 'Pendente';

        // Calcular valores (90% vendedor, 10% admin)
        const valorTotal = parseFloat(valor);
        const valorVendedor = Math.round(valorTotal * 0.9 * 100) / 100; // 90% do valor
        const taxaAdmin = Math.round(valorTotal * 0.1 * 100) / 100; // 10% do valor

        // Gerar public_id único (6 dígitos)
        let publicId;
        let tentativas = 0;
        do {
            publicId = String(Math.floor(Math.random() * 900000) + 100000);
            const existe = await Venda.findOne({ where: { public_id: publicId } });
            if (!existe) break;
            tentativas++;
            if (tentativas > 10) {
                throw new Error('Não foi possível gerar ID único para a venda');
            }
        } while (true);

        const vendaUpsell = await Venda.create({
            public_id: publicId,
            vendedor_id: produto.vendedor_id,
            produto_id: produto.id,
            cliente_id: cliente.id,
            valor: valorVendedor, // Valor que o vendedor recebe (90%)
            valor_vendedor: valorVendedor,
            taxa_admin: taxaAdmin,
            metodo_pagamento: metodoPagamento,
            pagamento_metodo: metodoPagamento,
            pagamento_status: statusPagamento,
            pagamento_valor: valorTotal, // Valor total pago pelo cliente
            status: statusVenda,
            referencia_pagamento: transactionIdPayMoz, // Usar transaction_id real do PayMoz
            cliente_nome: cliente.nome,
            cliente_email: cliente.email,
            cliente_telefone: cliente.telefone,
            observacoes: `Upsell do pedido ${pedido_id} - Pagamento direto via PayMoz`
        });

        // Se o pagamento foi aprovado imediatamente, processar automaticamente
        if (paymozResult.status === 'approved') {
            const { processarPagamentoAprovado } = require('../routes/pagamento');
            await processarPagamentoAprovado(
                vendaUpsell,
                produto,
                cliente,
                parseFloat(valor),
                metodoPagamento,
                transactionIdPayMoz
            );
            
            // Enviar notificações para vendedor e cliente após processar upsell
            try {
                console.log('📧 Enviando notificações para vendedor e cliente do upsell...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                
                // 1. Notificar vendedor sobre nova venda (upsell)
                await vendaNotificationService.enviarNotificacaoNovaVenda(vendaUpsell.id);
                console.log('✅ Notificação enviada para vendedor sobre upsell');
                
                // 2. Enviar email para cliente com link do conteúdo do produto upsell
                await vendaNotificationService.enviarNotificacaoConteudoPronto(vendaUpsell.id);
                console.log('✅ Email enviado para cliente com link do conteúdo do upsell');
            } catch (notificacaoError) {
                console.error('❌ Erro ao enviar notificações do upsell:', notificacaoError);
                // Não falhar o processo por erro de notificação
            }
        }

        res.json({
            success: true,
            message: paymozResult.status === 'approved' 
                ? 'Pagamento processado com sucesso!' 
                : 'Pagamento pendente. Aguarde confirmação no seu celular.',
            venda_id: vendaUpsell.id,
            transaction_id: transactionIdPayMoz,
            status: paymozResult.status,
            paymoz_response: paymozResult
        });

    } catch (error) {
        console.error('❌ Erro ao processar one-click upsell:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao processar pagamento do upsell',
            error: error.message
        });
    }
});

module.exports = router;

