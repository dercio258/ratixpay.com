const express = require('express');
const router = express.Router();
const { BlogPost, BlogComment, BlogPage, BlogNewsletter, Usuario, sequelize } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// ======================== ROTAS PÚBLICAS ========================

// ROTAS DE POSTS REMOVIDAS
/*
// GET /api/blog/posts - Listar posts publicados
router.get('/posts', async (req, res) => {
    try {
        const { page = 1, limit = 12, category, search, sort = 'published_at' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            status: 'published'
        };

        // Filtro por categoria
        if (category) {
            where.category = category;
        }

        // Busca por texto
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { subtitle: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Ordenação
        let order = [['published_at', 'DESC']];
        if (sort === 'views') order = [['views', 'DESC']];
        if (sort === 'likes') order = [['likes', 'DESC']];
        if (sort === 'title') order = [['title', 'ASC']];

        const { count, rows } = await BlogPost.findAndCountAll({
            where,
            include: [{
                model: Usuario,
                as: 'author',
                attributes: ['id', 'nome_completo', 'email']
            }],
            order,
            limit: parseInt(limit),
            offset,
            attributes: ['id', 'title', 'slug', 'subtitle', 'image', 'category', 'tags', 'views', 'likes', 'published_at', 'created_at']
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao listar posts:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar posts', error: error.message });
    }
});

// GET /api/blog/posts/:slug - Obter post por slug
router.get('/posts/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const post = await BlogPost.findOne({
            where: {
                slug,
                status: 'published'
            },
            include: [
                {
                    model: Usuario,
                    as: 'author',
                    attributes: ['id', 'nome_completo', 'email']
                },
                {
                    model: BlogComment,
                    as: 'comments',
                    where: { status: 'approved' },
                    required: false,
                    include: [
                        {
                            model: Usuario,
                            as: 'user',
                            attributes: ['id', 'nome_completo', 'email'],
                            required: false
                        },
                        {
                            model: BlogComment,
                            as: 'replies',
                            where: { status: 'approved' },
                            required: false,
                            include: [{
                                model: Usuario,
                                as: 'user',
                                attributes: ['id', 'nome_completo', 'email'],
                                required: false
                            }]
                        }
                    ],
                    order: [['created_at', 'ASC']]
                }
            ]
        });

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Não incrementar visualizações aqui - será feito via endpoint separado
        // para permitir controle no frontend com localStorage

        // Buscar posts relacionados (mesma categoria)
        const relatedPosts = await BlogPost.findAll({
            where: {
                category: post.category,
                status: 'published',
                id: { [Op.ne]: post.id }
            },
            limit: 3,
            order: [['views', 'DESC']],
            attributes: ['id', 'title', 'slug', 'subtitle', 'image', 'category', 'views', 'published_at']
        });

        res.json({
            success: true,
            data: {
                post,
                relatedPosts
            }
        });
    } catch (error) {
        console.error('Erro ao obter post:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter post', error: error.message });
    }
});

// GET /api/blog/categories - Listar categorias
router.get('/categories', async (req, res) => {
    try {
        const categories = await BlogPost.findAll({
            where: { status: 'published' },
            attributes: [
                [sequelize.fn('DISTINCT', sequelize.col('category')), 'category'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['category'],
            having: sequelize.where(sequelize.col('category'), { [Op.ne]: null }),
            raw: true
        });

        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar categorias', error: error.message });
    }
});

// GET /api/blog/popular - Posts mais populares
router.get('/popular', async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const posts = await BlogPost.findAll({
            where: { status: 'published' },
            order: [['views', 'DESC']],
            limit: parseInt(limit),
            attributes: ['id', 'title', 'slug', 'subtitle', 'image', 'category', 'views', 'published_at'],
            include: [{
                model: Usuario,
                as: 'author',
                attributes: ['id', 'nome_completo']
            }]
        });

        res.json({
            success: true,
            data: posts
        });
    } catch (error) {
        console.error('Erro ao obter posts populares:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter posts populares', error: error.message });
    }
});

// POST /api/blog/posts/:id/like - Curtir post
router.post('/posts/:id/like', async (req, res) => {
    try {
        const { id } = req.params;

        const post = await BlogPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        await post.increment('likes');
        
        // Recarregar para obter o valor atualizado
        await post.reload();

        res.json({
            success: true,
            data: { likes: post.likes }
        });
    } catch (error) {
        console.error('Erro ao curtir post:', error);
        res.status(500).json({ success: false, message: 'Erro ao curtir post', error: error.message });
    }
});

// POST /api/blog/posts/:id/view - Registrar visualização
router.post('/posts/:id/view', async (req, res) => {
    try {
        const { id } = req.params;

        const post = await BlogPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        await post.increment('views');
        
        // Recarregar para obter o valor atualizado
        await post.reload();

        res.json({
            success: true,
            data: { views: post.views }
        });
    } catch (error) {
        console.error('Erro ao registrar visualização:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar visualização', error: error.message });
    }
});

// POST /api/blog/comments - Criar comentário
router.post('/comments', async (req, res) => {
    try {
        const { post_id, name, email, comment, parent_id } = req.body;

        if (!post_id || !name || !email || !comment) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios: post_id, name, email, comment' });
        }

        // Verificar se o post existe
        const post = await BlogPost.findByPk(post_id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Verificar se parent_id existe (se for resposta)
        if (parent_id) {
            const parentComment = await BlogComment.findByPk(parent_id);
            if (!parentComment) {
                return res.status(404).json({ success: false, message: 'Comentário pai não encontrado' });
            }
        }

        const user_id = req.user ? req.user.id : null;
        const ip_address = req.ip || req.connection.remoteAddress;

        const newComment = await BlogComment.create({
            post_id,
            user_id,
            name,
            email,
            comment,
            parent_id: parent_id || null,
            status: 'approved', // Aprovação automática
            ip_address
        });

        // Se for uma resposta, notificar o autor do comentário original
        if (parent_id) {
            try {
                const parentComment = await BlogComment.findByPk(parent_id, {
                    include: [{
                        model: BlogPost,
                        as: 'post',
                        attributes: ['id', 'title', 'slug']
                    }]
                });

                if (parentComment && parentComment.email) {
                    // Verificar se o usuário está inscrito na newsletter e quer receber notificações de respostas
                    const newsletterSub = await BlogNewsletter.findOne({
                        where: {
                            email: parentComment.email,
                            status: 'ativo',
                            notificar_respostas: true
                        }
                    });

                    if (newsletterSub) {
                        const emailManagerService = require('../services/emailManagerService');
                        const baseUrl = process.env.BASE_URL || 'https://ratixpay.site';
                        const postUrl = `${baseUrl}/blog-post.html?slug=${parentComment.post.slug}`;

                        await emailManagerService.enviarEmailSistema('resposta_comentario_blog', {
                            email: parentComment.email,
                            nome: parentComment.name,
                            comentario_original: parentComment.comment,
                            resposta: comment,
                            autor_resposta: name,
                            post: {
                                title: parentComment.post.title,
                                slug: parentComment.post.slug,
                                url: postUrl
                            }
                        });

                        console.log(`📧 Notificação de resposta enviada para ${parentComment.email}`);
                    }
                }
            } catch (notificationError) {
                console.error('⚠️ Erro ao enviar notificação de resposta:', notificationError);
                // Não falhar a criação do comentário por erro na notificação
            }
        }

        // Notificar sobre reações se o comentário recebeu uma reação
        // (Isso será feito quando a reação for adicionada, não aqui)

        res.json({
            success: true,
            message: 'Comentário publicado com sucesso!',
            data: newComment
        });
    } catch (error) {
        console.error('Erro ao criar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar comentário', error: error.message });
    }
});

// POST /api/blog/comments/:id/reaction - Adicionar reação ao comentário
// Autenticação opcional - permite reações anônimas
router.post('/comments/:id/reaction', async (req, res, next) => {
    try {
        // Tentar extrair usuário do token se presente (opcional)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded; // Adicionar usuário ao request se token válido
            } catch (jwtError) {
                // Token inválido, continuar sem autenticação (reações anônimas permitidas)
                req.user = null;
            }
        }
        next();
    } catch (error) {
        next();
    }
}, async (req, res) => {
    try {
        const { id } = req.params;
        const { reaction } = req.body; // 'like', 'bad', 'heart', 'fire'

        // Validar tipo de reação
        if (!reaction || !['like', 'bad', 'heart', 'fire'].includes(reaction)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reação inválida. Use: like, bad, heart ou fire' 
            });
        }

        const comment = await BlogComment.findByPk(id);
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comentário não encontrado' 
            });
        }

        // Obter reações atuais ou inicializar
        const reactions = comment.reactions || { like: 0, bad: 0, heart: 0, fire: 0 };
        
        // Incrementar reação
        reactions[reaction] = (reactions[reaction] || 0) + 1;

        // Atualizar comentário
        await comment.update({ reactions });

        res.json({
            success: true,
            message: 'Reação adicionada com sucesso',
            data: { 
                reactions,
                user_id: req.user ? req.user.id : null // Incluir ID do usuário se autenticado
            }
        });
    } catch (error) {
        console.error('Erro ao adicionar reação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao adicionar reação', 
            error: error.message 
        });
    }
});

// GET /api/blog/pages/:slug - Obter página estática
router.get('/pages/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const page = await BlogPage.findOne({
            where: {
                slug,
                status: 'published'
            }
        });

        if (!page) {
            return res.status(404).json({ success: false, message: 'Página não encontrada' });
        }

        res.json({
            success: true,
            data: page
        });
    } catch (error) {
        console.error('Erro ao obter página:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter página', error: error.message });
    }
});

// ======================== ROTAS ADMINISTRATIVAS ========================

// ROTAS ADMIN DE POSTS REMOVIDAS
/*
// GET /api/blog/admin/posts - Listar todos os posts (admin)
router.get('/admin/posts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, category, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (category) where.category = category;
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { subtitle: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { count, rows } = await BlogPost.findAndCountAll({
            where,
            include: [{
                model: Usuario,
                as: 'author',
                attributes: ['id', 'nome_completo', 'email']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao listar posts (admin):', error);
        res.status(500).json({ success: false, message: 'Erro ao listar posts', error: error.message });
    }
});

// POST /api/blog/admin/posts - Criar novo post
router.post('/admin/posts', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, subtitle, content, image, category, tags, status, published_at, meta_description, meta_keywords } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Título e conteúdo são obrigatórios' });
        }

        // Gerar slug a partir do título
        const slug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Verificar se slug já existe
        const existingPost = await BlogPost.findOne({ where: { slug } });
        if (existingPost) {
            return res.status(400).json({ success: false, message: 'Já existe um post com este título' });
        }

        const post = await BlogPost.create({
            title,
            slug,
            subtitle,
            content,
            image,
            category,
            tags: tags || [],
            author_id: req.user.id,
            status: status || 'draft',
            published_at: published_at || (status === 'published' ? new Date() : null),
            meta_description,
            meta_keywords
        });

        const postWithAuthor = await BlogPost.findByPk(post.id, {
            include: [{
                model: Usuario,
                as: 'author',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });

        // Notificar todos os usuários se o post foi publicado
        if (status === 'published') {
            try {
                const emailManagerService = require('../services/emailManagerService');
                const { Op } = require('sequelize');
                
                // Buscar todos os usuários ativos (exceto admins)
                const usuarios = await Usuario.findAll({
                    where: {
                        [Op.and]: [
                            { email: { [Op.ne]: null } },
                            { 
                                [Op.or]: [
                                    { tipo_conta: { [Op.ne]: 'admin' } },
                                    { role: { [Op.ne]: 'admin' } },
                                    { tipo_conta: null },
                                    { role: null }
                                ]
                            }
                        ]
                    },
                    attributes: ['id', 'nome_completo', 'email']
                });

                console.log(`📧 Enviando notificações de novo post para ${usuarios.length} usuários...`);

                // Enviar notificação para cada usuário
                const notificacoesPromises = usuarios.map(usuario => {
                    return emailManagerService.enviarEmailSistema('novo_post_blog', {
                        email: usuario.email,
                        nome: usuario.nome_completo || 'Usuário',
                        post: {
                            title: post.title,
                            subtitle: post.subtitle,
                            slug: post.slug,
                            image: post.image,
                            category: post.category
                        }
                    }).catch(error => {
                        console.error(`⚠️ Erro ao enviar notificação para ${usuario.email}:`, error);
                        return null; // Não falhar todas as notificações por causa de um erro
                    });
                });

                await Promise.allSettled(notificacoesPromises);
                console.log(`✅ Notificações de novo post processadas`);
            } catch (notificationError) {
                console.error('⚠️ Erro ao enviar notificações de novo post:', notificationError);
                // Não falhar a criação do post por erro nas notificações
            }
        }

        res.json({
            success: true,
            message: 'Post criado com sucesso',
            data: postWithAuthor
        });
    } catch (error) {
        console.error('Erro ao criar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar post', error: error.message });
    }
});

// PUT /api/blog/admin/posts/:id - Atualizar post
router.put('/admin/posts/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, content, image, category, tags, status, published_at, meta_description, meta_keywords } = req.body;

        const post = await BlogPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Se o título mudou, atualizar slug
        let slug = post.slug;
        if (title && title !== post.title) {
            slug = title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            // Verificar se novo slug já existe
            const existingPost = await BlogPost.findOne({ where: { slug, id: { [Op.ne]: id } } });
            if (existingPost) {
                return res.status(400).json({ success: false, message: 'Já existe um post com este título' });
            }
        }

        const statusAnterior = post.status;
        const foiPublicado = (status === 'published' && statusAnterior !== 'published') || 
                           (status === 'published' && !post.published_at);

        await post.update({
            title: title || post.title,
            slug,
            subtitle: subtitle !== undefined ? subtitle : post.subtitle,
            content: content !== undefined ? content : post.content,
            image: image !== undefined ? image : post.image,
            category: category !== undefined ? category : post.category,
            tags: tags !== undefined ? tags : post.tags,
            status: status || post.status,
            published_at: published_at !== undefined ? published_at : (foiPublicado ? new Date() : post.published_at),
            meta_description: meta_description !== undefined ? meta_description : post.meta_description,
            meta_keywords: meta_keywords !== undefined ? meta_keywords : post.meta_keywords
        });

        const updatedPost = await BlogPost.findByPk(id, {
            include: [{
                model: Usuario,
                as: 'author',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });

        // Notificar todos os usuários se o post foi publicado agora
        if (foiPublicado) {
            try {
                const emailManagerService = require('../services/emailManagerService');
                const { Op } = require('sequelize');
                
                // Buscar assinantes da newsletter que querem receber notificações de novos posts
                const newsletterSubscribers = await BlogNewsletter.findAll({
                    where: {
                        status: 'ativo',
                        notificar_novos_posts: true
                    },
                    attributes: ['id', 'email', 'nome']
                });

                console.log(`📧 Enviando notificações de novo post para ${newsletterSubscribers.length} assinantes da newsletter...`);

                // Enviar notificação para cada assinante
                const notificacoesPromises = newsletterSubscribers.map(subscriber => {
                    return emailManagerService.enviarEmailSistema('novo_post_blog', {
                        email: subscriber.email,
                        nome: subscriber.nome || 'Assinante',
                        post: {
                            title: updatedPost.title,
                            subtitle: updatedPost.subtitle,
                            slug: updatedPost.slug,
                            image: updatedPost.image,
                            category: updatedPost.category
                        }
                    }).catch(error => {
                        console.error(`⚠️ Erro ao enviar notificação para ${subscriber.email}:`, error);
                        return null;
                    });
                });

                await Promise.allSettled(notificacoesPromises);
                console.log(`✅ Notificações de novo post processadas`);
            } catch (notificationError) {
                console.error('⚠️ Erro ao enviar notificações de novo post:', notificationError);
            }
        }

        res.json({
            success: true,
            message: 'Post atualizado com sucesso',
            data: updatedPost
        });
    } catch (error) {
        console.error('Erro ao atualizar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar post', error: error.message });
    }
});

// DELETE /api/blog/admin/posts/:id - Deletar post
router.delete('/admin/posts/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const post = await BlogPost.findByPk(id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        await post.destroy();

        res.json({
            success: true,
            message: 'Post deletado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar post', error: error.message });
    }
});

// GET /api/blog/admin/comments - Listar comentários (admin)
router.get('/admin/comments', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, post_id } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (status) where.status = status;
        if (post_id) where.post_id = post_id;

        const { count, rows } = await BlogComment.findAndCountAll({
            where,
            include: [
                {
                    model: BlogPost,
                    as: 'post',
                    attributes: ['id', 'title', 'slug']
                },
                {
                    model: Usuario,
                    as: 'user',
                    attributes: ['id', 'nome_completo', 'email'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        res.json({
            success: true,
            data: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Erro ao listar comentários (admin):', error);
        res.status(500).json({ success: false, message: 'Erro ao listar comentários', error: error.message });
    }
});

// PUT /api/blog/admin/comments/:id/approve - Aprovar comentário
router.put('/admin/comments/:id/approve', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const comment = await BlogComment.findByPk(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        await comment.update({ status: 'approved' });

        res.json({
            success: true,
            message: 'Comentário aprovado com sucesso',
            data: comment
        });
    } catch (error) {
        console.error('Erro ao aprovar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao aprovar comentário', error: error.message });
    }
});

// PUT /api/blog/admin/comments/:id/reject - Rejeitar comentário
router.put('/admin/comments/:id/reject', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const comment = await BlogComment.findByPk(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        await comment.update({ status: 'rejected' });

        res.json({
            success: true,
            message: 'Comentário rejeitado com sucesso',
            data: comment
        });
    } catch (error) {
        console.error('Erro ao rejeitar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao rejeitar comentário', error: error.message });
    }
});

// DELETE /api/blog/admin/comments/:id - Deletar comentário
router.delete('/admin/comments/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const comment = await BlogComment.findByPk(id);
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        await comment.destroy();

        res.json({
            success: true,
            message: 'Comentário deletado com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar comentário:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar comentário', error: error.message });
    }
});

// GET /api/blog/admin/pages - Listar páginas (admin)
router.get('/admin/pages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const pages = await BlogPage.findAll({
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: pages
        });
    } catch (error) {
        console.error('Erro ao listar páginas (admin):', error);
        res.status(500).json({ success: false, message: 'Erro ao listar páginas', error: error.message });
    }
});

// POST /api/blog/admin/pages - Criar página
router.post('/admin/pages', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { title, content, status, meta_description, meta_keywords } = req.body;

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Título e conteúdo são obrigatórios' });
        }

        // Gerar slug
        const slug = title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        // Verificar se slug já existe
        const existingPage = await BlogPage.findOne({ where: { slug } });
        if (existingPage) {
            return res.status(400).json({ success: false, message: 'Já existe uma página com este título' });
        }

        const page = await BlogPage.create({
            title,
            slug,
            content,
            status: status || 'draft',
            meta_description,
            meta_keywords
        });

        res.json({
            success: true,
            message: 'Página criada com sucesso',
            data: page
        });
    } catch (error) {
        console.error('Erro ao criar página:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar página', error: error.message });
    }
});

// PUT /api/blog/admin/pages/:id - Atualizar página
router.put('/admin/pages/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, status, meta_description, meta_keywords } = req.body;

        const page = await BlogPage.findByPk(id);
        if (!page) {
            return res.status(404).json({ success: false, message: 'Página não encontrada' });
        }

        // Se o título mudou, atualizar slug
        let slug = page.slug;
        if (title && title !== page.title) {
            slug = title
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');

            // Verificar se novo slug já existe
            const existingPage = await BlogPage.findOne({ where: { slug, id: { [Op.ne]: id } } });
            if (existingPage) {
                return res.status(400).json({ success: false, message: 'Já existe uma página com este título' });
            }
        }

        await page.update({
            title: title || page.title,
            slug,
            content: content || page.content,
            status: status || page.status,
            meta_description: meta_description !== undefined ? meta_description : page.meta_description,
            meta_keywords: meta_keywords !== undefined ? meta_keywords : page.meta_keywords
        });

        res.json({
            success: true,
            message: 'Página atualizada com sucesso',
            data: page
        });
    } catch (error) {
        console.error('Erro ao atualizar página:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar página', error: error.message });
    }
});

// DELETE /api/blog/admin/pages/:id - Deletar página
router.delete('/admin/pages/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const page = await BlogPage.findByPk(id);
        if (!page) {
            return res.status(404).json({ success: false, message: 'Página não encontrada' });
        }

        await page.destroy();

        res.json({
            success: true,
            message: 'Página deletada com sucesso'
        });
    } catch (error) {
        console.error('Erro ao deletar página:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar página', error: error.message });
    }
});

// GET /api/blog/admin/stats - Estatísticas do blog (admin)
router.get('/admin/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const totalPosts = await BlogPost.count();
        const publishedPosts = await BlogPost.count({ where: { status: 'published' } });
        const draftPosts = await BlogPost.count({ where: { status: 'draft' } });
        const totalViews = await BlogPost.sum('views') || 0;
        const totalLikes = await BlogPost.sum('likes') || 0;
        const totalComments = await BlogComment.count();
        const pendingComments = await BlogComment.count({ where: { status: 'pending' } });
        const totalPages = await BlogPage.count();

        res.json({
            success: true,
            data: {
                posts: {
                    total: totalPosts,
                    published: publishedPosts,
                    draft: draftPosts
                },
                views: totalViews,
                likes: totalLikes,
                comments: {
                    total: totalComments,
                    pending: pendingComments
                },
                pages: totalPages
            }
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ success: false, message: 'Erro ao obter estatísticas', error: error.message });
    }
});

// ======================== NEWSLETTER ========================

// POST /api/blog/newsletter/subscribe - Inscrever na newsletter
router.post('/newsletter/subscribe', async (req, res) => {
    try {
        const { email, nome, notificar_novos_posts, notificar_reacoes, notificar_respostas } = req.body;
        const user_id = req.user ? req.user.id : null;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório' });
        }

        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Email inválido' });
        }

        // Gerar token de unsubscribe
        const crypto = require('crypto');
        const token_unsubscribe = crypto.randomBytes(32).toString('hex');

        // Verificar se já existe
        const existing = await BlogNewsletter.findOne({ where: { email } });
        
        if (existing) {
            // Atualizar assinatura existente
            await existing.update({
                nome: nome || existing.nome,
                user_id: user_id || existing.user_id,
                notificar_novos_posts: notificar_novos_posts !== undefined ? notificar_novos_posts : existing.notificar_novos_posts,
                notificar_reacoes: notificar_reacoes !== undefined ? notificar_reacoes : existing.notificar_reacoes,
                notificar_respostas: notificar_respostas !== undefined ? notificar_respostas : existing.notificar_respostas,
                status: 'ativo',
                token_unsubscribe: existing.token_unsubscribe || token_unsubscribe
            });

            return res.json({
                success: true,
                message: 'Assinatura atualizada com sucesso!',
                data: existing
            });
        }

        // Criar nova assinatura
        const subscription = await BlogNewsletter.create({
            email,
            nome,
            user_id,
            notificar_novos_posts: notificar_novos_posts !== undefined ? notificar_novos_posts : true,
            notificar_reacoes: notificar_reacoes !== undefined ? notificar_reacoes : true,
            notificar_respostas: notificar_respostas !== undefined ? notificar_respostas : true,
            token_unsubscribe
        });

        res.json({
            success: true,
            message: 'Inscrito na newsletter com sucesso!',
            data: subscription
        });
    } catch (error) {
        console.error('Erro ao inscrever na newsletter:', error);
        res.status(500).json({ success: false, message: 'Erro ao inscrever na newsletter', error: error.message });
    }
});

// POST /api/blog/newsletter/unsubscribe - Cancelar assinatura
router.post('/newsletter/unsubscribe', async (req, res) => {
    try {
        const { email, token } = req.body;

        if (!email && !token) {
            return res.status(400).json({ success: false, message: 'Email ou token é obrigatório' });
        }

        const where = {};
        if (email) where.email = email;
        if (token) where.token_unsubscribe = token;

        const subscription = await BlogNewsletter.findOne({ where });
        
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Assinatura não encontrada' });
        }

        await subscription.update({ status: 'cancelado' });

        res.json({
            success: true,
            message: 'Assinatura cancelada com sucesso!'
        });
    } catch (error) {
        console.error('Erro ao cancelar assinatura:', error);
        res.status(500).json({ success: false, message: 'Erro ao cancelar assinatura', error: error.message });
    }
});

// GET /api/blog/newsletter/status - Verificar status da assinatura
// Middleware opcional para extrair usuário do token quando presente
router.get('/newsletter/status', async (req, res, next) => {
    try {
        // Tentar extrair usuário do token se presente
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded; // Adicionar usuário ao request
            } catch (jwtError) {
                // Token inválido, continuar sem autenticação
                req.user = null;
            }
        }
        next();
    } catch (error) {
        next();
    }
}, async (req, res) => {
    try {
        const { email } = req.query;
        const user_id = req.user ? req.user.id : null;

        // Se não tem email nem user_id, retornar false (não inscrito) ao invés de erro
        if (!email && !user_id) {
            return res.json({
                success: true,
                subscribed: false,
                message: 'Usuário não autenticado'
            });
        }

        const where = {};
        if (email) where.email = email;
        if (user_id) where.user_id = user_id;

        const subscription = await BlogNewsletter.findOne({ where });

        if (!subscription) {
            return res.json({
                success: true,
                subscribed: false
            });
        }

        res.json({
            success: true,
            subscribed: subscription.status === 'ativo',
            data: subscription
        });
    } catch (error) {
        console.error('Erro ao verificar status da newsletter:', error);
        res.status(500).json({ success: false, message: 'Erro ao verificar status', error: error.message });
    }
});

module.exports = router;

