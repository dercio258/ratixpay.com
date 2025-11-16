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
        
        const statusAnterior = produto.ativo;
        await produto.update({ ativo });
        
        const vendedor = await Usuario.findByPk(produto.vendedor_id);
        
        // Se o produto foi desativado, enviar notificação ao vendedor
        if (statusAnterior && !ativo) {
            if (vendedor && vendedor.email) {
                try {
                    const emailManagerService = require('../services/emailManagerService');
                    await emailManagerService.enviarEmailSistema('notificacao_produto_deletado', {
                        email: vendedor.email,
                        nome: vendedor.nome_completo || vendedor.email,
                        produtos: [{
                            custom_id: produto.custom_id || 'N/A',
                            nome: produto.nome,
                            acao: 'desativado'
                        }]
                    });
                    console.log(`📧 Notificação de desativação enviada para: ${vendedor.email}`);
                } catch (emailError) {
                    console.error('⚠️ Erro ao enviar notificação:', emailError);
                    // Não bloquear a operação se o email falhar
                }
            }
        }
        
        // Se o produto foi ativado, enviar notificação ao vendedor
        if (!statusAnterior && ativo) {
            if (vendedor && vendedor.email) {
                try {
                    const emailManagerService = require('../services/emailManagerService');
                    await emailManagerService.enviarEmailSistema('notificacao_produto_ativado', {
                        email: vendedor.email,
                        nome: vendedor.nome_completo || vendedor.email,
                        produtos: [{
                            custom_id: produto.custom_id || 'N/A',
                            nome: produto.nome
                        }]
                    });
                    console.log(`📧 Notificação de ativação enviada para: ${vendedor.email}`);
                } catch (emailError) {
                    console.error('⚠️ Erro ao enviar notificação:', emailError);
                    // Não bloquear a operação se o email falhar
                }
            }
        }
        
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

// DELETE - Excluir produto (apenas admin)
router.delete('/produtos/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🗑️ Admin tentando excluir produto:', req.params.id);
        console.log('👤 Admin:', req.user.email);
        
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
        
        // Buscar informações do vendedor para log
        const vendedor = await Usuario.findByPk(produto.vendedor_id);
        console.log(`📦 Produto: ${produto.nome} | Vendedor: ${vendedor?.nome_completo || vendedor?.email || 'N/A'}`);
        
        // Verificar se o produto tem vendas
        const temVendas = await Venda.count({
            where: { produto_id: produto.id }
        });
        
        if (temVendas > 0) {
            // Admin pode forçar exclusão mesmo com vendas, mas vamos desativar por padrão
            // Se quiser forçar exclusão, pode passar ?force=true na query
            const forceDelete = req.query.force === 'true';
            
            const produtoInfo = {
                custom_id: produto.custom_id || 'N/A',
                nome: produto.nome
            };
            
            if (forceDelete) {
                console.log(`⚠️ Admin forçando exclusão de produto com ${temVendas} venda(s)`);
                await produto.destroy();
                
                // Enviar notificação ao vendedor
                if (vendedor && vendedor.email) {
                    try {
                        const emailManagerService = require('../services/emailManagerService');
                        await emailManagerService.enviarEmailSistema('notificacao_produto_deletado', {
                            email: vendedor.email,
                            nome: vendedor.nome_completo || vendedor.email,
                            produtos: [{
                                custom_id: produtoInfo.custom_id,
                                nome: produtoInfo.nome,
                                acao: 'excluído'
                            }]
                        });
                        console.log(`📧 Notificação de exclusão (forçada) enviada para: ${vendedor.email}`);
                    } catch (emailError) {
                        console.error('⚠️ Erro ao enviar notificação:', emailError);
                    }
                }
                
                return res.json({
                    success: true,
                    message: `Produto excluído com sucesso (forçado). O produto tinha ${temVendas} venda(s) associada(s).`
                });
            } else {
                // Se tem vendas, desativar o produto em vez de excluir
                await produto.update({ ativo: false });
                
                // Enviar notificação ao vendedor sobre desativação
                if (vendedor && vendedor.email) {
                    try {
                        const emailManagerService = require('../services/emailManagerService');
                        await emailManagerService.enviarEmailSistema('notificacao_produto_deletado', {
                            email: vendedor.email,
                            nome: vendedor.nome_completo || vendedor.email,
                            produtos: [{
                                custom_id: produtoInfo.custom_id,
                                nome: produtoInfo.nome,
                                acao: 'desativado'
                            }]
                        });
                        console.log(`📧 Notificação de desativação enviada para: ${vendedor.email}`);
                    } catch (emailError) {
                        console.error('⚠️ Erro ao enviar notificação:', emailError);
                    }
                }
                
                return res.json({
                    success: true,
                    message: `Produto desativado com sucesso. Não foi possível excluir porque possui ${temVendas} venda(s) associada(s). Use ?force=true para forçar a exclusão.`
                });
            }
        }
        
        // Excluir produto (sem vendas)
        const produtoInfo = {
            custom_id: produto.custom_id || 'N/A',
            nome: produto.nome
        };
        
        await produto.destroy();
        
        console.log(`✅ Produto ${produto.nome} excluído com sucesso pelo admin ${req.user.email}`);
        
        // Enviar notificação ao vendedor
        if (vendedor && vendedor.email) {
            try {
                const emailManagerService = require('../services/emailManagerService');
                await emailManagerService.enviarEmailSistema('notificacao_produto_deletado', {
                    email: vendedor.email,
                    nome: vendedor.nome_completo || vendedor.email,
                    produtos: [{
                        custom_id: produtoInfo.custom_id,
                        nome: produtoInfo.nome,
                        acao: 'excluído'
                    }]
                });
                console.log(`📧 Notificação de exclusão enviada para: ${vendedor.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        res.json({
            success: true,
            message: 'Produto excluído com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao excluir produto:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

// DELETE - Excluir múltiplos produtos
router.delete('/produtos/multiplos', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { produtosIds } = req.body;
        
        if (!Array.isArray(produtosIds) || produtosIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Lista de produtos é obrigatória'
            });
        }

        console.log(`🗑️ Admin tentando excluir ${produtosIds.length} produto(s):`, req.user.email);
        
        let excluidos = 0;
        let desativados = 0;
        let erros = [];
        const notificacoes = []; // Agrupar notificações por vendedor

        for (const produtoId of produtosIds) {
            try {
                let produto = await Produto.findByPk(produtoId);
                
                if (!produto) {
                    produto = await Produto.findOne({ where: { custom_id: produtoId } });
                }
                
                if (!produto) {
                    erros.push({ id: produtoId, erro: 'Produto não encontrado' });
                    continue;
                }

                const vendedor = await Usuario.findByPk(produto.vendedor_id);
                
                // Verificar se o produto tem vendas
                const temVendas = await Venda.count({
                    where: { produto_id: produto.id }
                });

                if (temVendas > 0) {
                    // Desativar em vez de excluir
                    await produto.update({ ativo: false });
                    desativados++;
                    
                    // Adicionar à lista de notificações
                    if (vendedor && vendedor.email) {
                        notificacoes.push({
                            email: vendedor.email,
                            nome: vendedor.nome_completo || vendedor.email,
                            custom_id: produto.custom_id || 'N/A',
                            nome: produto.nome,
                            acao: 'desativado'
                        });
                    }
                } else {
                    // Excluir produto
                    const produtoInfo = {
                        custom_id: produto.custom_id || 'N/A',
                        nome: produto.nome
                    };
                    
                    await produto.destroy();
                    excluidos++;
                    
                    // Adicionar à lista de notificações
                    if (vendedor && vendedor.email) {
                        notificacoes.push({
                            email: vendedor.email,
                            nome: vendedor.nome_completo || vendedor.email,
                            custom_id: produtoInfo.custom_id,
                            nome: produtoInfo.nome,
                            acao: 'excluído'
                        });
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao processar produto ${produtoId}:`, error);
                erros.push({ id: produtoId, erro: error.message });
            }
        }

        // Enviar notificações agrupadas por vendedor
        const emailManagerService = require('../services/emailManagerService');
        const notificacoesPorVendedor = {};
        
        for (const notif of notificacoes) {
            if (!notificacoesPorVendedor[notif.email]) {
                notificacoesPorVendedor[notif.email] = {
                    email: notif.email,
                    nome: notif.nome,
                    produtos: []
                };
            }
            notificacoesPorVendedor[notif.email].produtos.push({
                custom_id: notif.custom_id,
                nome: notif.nome,
                acao: notif.acao
            });
        }

        // Enviar email para cada vendedor
        for (const email in notificacoesPorVendedor) {
            try {
                const dados = notificacoesPorVendedor[email];
                await emailManagerService.enviarEmailSistema('notificacao_produto_deletado', dados);
                console.log(`📧 Notificação enviada para: ${email}`);
            } catch (emailError) {
                console.error(`⚠️ Erro ao enviar notificação para ${email}:`, emailError);
            }
        }

        res.json({
            success: true,
            message: `${excluidos} produto(s) excluído(s) e ${desativados} produto(s) desativado(s)`,
            excluidos,
            desativados,
            erros: erros.length > 0 ? erros : undefined
        });

    } catch (error) {
        console.error('❌ Erro ao excluir múltiplos produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// PUT - Aprovar ou rejeitar produto pendente de aprovação
router.put('/produtos/:id/aprovacao', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { acao, motivo } = req.body; // acao: 'aprovar' ou 'rejeitar'
        
        if (!acao || !['aprovar', 'rejeitar'].includes(acao)) {
            return res.status(400).json({
                success: false,
                message: 'Ação inválida. Use "aprovar" ou "rejeitar".'
            });
        }
        
        const produto = await Produto.findByPk(id);
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado.'
            });
        }
        
        if (produto.status_aprovacao !== 'pendente_aprovacao') {
            return res.status(400).json({
                success: false,
                message: 'Este produto não está pendente de aprovação.'
            });
        }
        
        // Buscar vendedor
        const vendedor = await Usuario.findByPk(produto.vendedor_id);
        
        if (acao === 'aprovar') {
            // Aprovar produto
            produto.status_aprovacao = 'aprovado';
            produto.ativo = true;
            produto.motivo_rejeicao = null;
            await produto.save();
            
            // Notificar vendedor
            try {
                const emailManagerService = require('../services/emailManagerService');
                if (vendedor && vendedor.email) {
                    await emailManagerService.enviarEmailSistema('notificacao_produto_aprovado_admin', {
                        email: vendedor.email,
                        nome: vendedor.nome_completo || vendedor.email,
                        produto: {
                            id: produto.id,
                            custom_id: produto.custom_id,
                            nome: produto.nome
                        }
                    });
                    console.log(`📧 Notificação de aprovação enviada para vendedor: ${vendedor.email}`);
                }
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de aprovação:', emailError);
            }
            
            return res.json({
                success: true,
                message: 'Produto aprovado com sucesso!',
                produto: {
                    id: produto.id,
                    custom_id: produto.custom_id,
                    nome: produto.nome,
                    status_aprovacao: produto.status_aprovacao,
                    ativo: produto.ativo
                }
            });
        } else {
            // Rejeitar produto
            produto.status_aprovacao = 'rejeitado';
            produto.ativo = false;
            produto.motivo_rejeicao = motivo || 'Rejeitado pelo administrador';
            await produto.save();
            
            return res.json({
                success: true,
                message: 'Produto rejeitado.',
                produto: {
                    id: produto.id,
                    custom_id: produto.custom_id,
                    nome: produto.nome,
                    status_aprovacao: produto.status_aprovacao,
                    ativo: produto.ativo,
                    motivo_rejeicao: produto.motivo_rejeicao
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar aprovação/rejeição:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET - Listar produtos pendentes de aprovação
router.get('/produtos-pendentes', authenticateToken, isAdmin, async (req, res) => {
    try {
        const produtos = await Produto.findAll({
            where: {
                status_aprovacao: 'pendente_aprovacao'
            },
            order: [['created_at', 'DESC']]
        });
        
        // Buscar vendedores para cada produto
        const produtosComVendedor = await Promise.all(produtos.map(async (p) => {
            let vendedor = null;
            if (p.vendedor_id) {
                try {
                    const v = await Usuario.findByPk(p.vendedor_id);
                    if (v) {
                        vendedor = {
                            id: v.id,
                            nome: v.nome_completo || v.email,
                            email: v.email
                        };
                    }
                } catch (err) {
                    console.error(`Erro ao buscar vendedor ${p.vendedor_id}:`, err);
                }
            }
            
            return {
                id: p.id,
                custom_id: p.custom_id,
                nome: p.nome,
                categoria: p.categoria,
                tipo: p.tipo,
                descricao: p.descricao,
                imagem_url: p.imagem_url,
                preco: p.preco,
                preco_final: p.preco_final,
                status_aprovacao: p.status_aprovacao,
                motivo_rejeicao: p.motivo_rejeicao,
                ativo: p.ativo,
                created_at: p.created_at,
                vendedor: vendedor
            };
        }));
        
        return res.json({
            success: true,
            produtos: produtosComVendedor
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produtos pendentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
