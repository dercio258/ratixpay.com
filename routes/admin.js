const express = require('express');
const router = express.Router();
const { Usuario, Venda, Pagamento, EstatisticasVendedor, TransferenciaB2C, sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');
const ReceitaService = require('../services/receitaService');
const SaldoAdminService = require('../services/saldoAdminService'); // Novo serviço unificado
const emailManagerService = require('../services/emailManagerService');

// Middleware para verificar acesso de administrador
const checkAdminAccess = async (req, res, next) => {
    try {
        console.log('🔍 checkAdminAccess local: Verificando acesso para:', req.user?.email);
        console.log('🔍 checkAdminAccess local: Dados do usuário:', {
            email: req.user?.email,
            role: req.user?.role,
            tipo_conta: req.user?.tipo_conta
        });
        
        // Verificação especial para email administrativo principal
        const isMainAdmin = req.user.email === 'ratixpay.mz@gmail.com';
        const isRegularAdmin = req.user.role === 'admin' || req.user.tipo_conta === 'admin';
        
        console.log('🔍 checkAdminAccess local: Verificações:', {
            isMainAdmin,
            isRegularAdmin
        });
        
        if (!isMainAdmin && !isRegularAdmin) {
            console.log('❌ checkAdminAccess local: Acesso negado - não é admin');
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Apenas administradores.'
            });
        }
        
        // Se for o email principal, garantir que seja reconhecido como admin
        if (isMainAdmin) {
            console.log('🔑 Acesso administrativo concedido para ratixpay.mz@gmail.com');
        }
        
        console.log('✅ checkAdminAccess local: Acesso autorizado');
        next();
    } catch (error) {
        console.error('❌ Erro ao verificar acesso de admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

// GET - Dashboard administrativo com receita atualizada automaticamente
router.get('/dashboard', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Carregando dashboard administrativo...');
        
        // Atualizar automaticamente receita de todos os vendedores
        const receitasAtualizadas = await ReceitaService.buscarReceitaTodosVendedores();
        
        // Estatísticas gerais
        const totalVendedores = receitasAtualizadas.length;
        const receitaTotalSistema = receitasAtualizadas.reduce((total, v) => total + v.receitaTotal, 0);
        const receitaDisponivelSistema = receitasAtualizadas.reduce((total, v) => total + v.receitaDisponivel, 0);
        
        // Contar saques por status
        const saquesPendentes = await Pagamento.count({
            where: { status: 'pendente' }
        });
        
        const saquesAprovados = await Pagamento.count({
            where: { status: 'aprovado' }
        });
        
        const saquesPagos = await Pagamento.count({
            where: { status: 'pago' }
        });
        
        const saquesCancelados = await Pagamento.count({
            where: { status: 'cancelado' }
        });
        
        console.log('✅ Dashboard administrativo carregado com sucesso');
        
        res.json({
            success: true,
            data: {
                totalVendedores: totalVendedores,
                receitaTotalSistema: parseFloat(receitaTotalSistema),
                receitaDisponivelSistema: parseFloat(receitaDisponivelSistema),
                saquesPendentes: saquesPendentes,
                saquesAprovados: saquesAprovados,
                saquesPagos: saquesPagos,
                saquesCancelados: saquesCancelados,
                receitasVendedores: receitasAtualizadas,
                ultimaAtualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard administrativo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dashboard administrativo',
            error: error.message
        });
    }
});

// GET - Buscar receita total de um vendedor específico (com atualização automática)
router.get('/vendedores/:id/receita', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Buscando receita total do vendedor ${id}...`);
        
        // Usar ReceitaService para garantir sincronização
        const receitaAtualizada = await ReceitaService.buscarReceitaTotal(id);
        
        console.log(`✅ Receita total do vendedor ${id}: MZN ${receitaAtualizada.receitaTotal}`);
        
        res.json({
            success: true,
            data: {
                receitaTotal: parseFloat(receitaAtualizada.receitaTotal),
                receitaDisponivel: parseFloat(receitaAtualizada.receitaDisponivel),
                totalVendas: parseInt(receitaAtualizada.totalVendas),
                valorSaquesPendentes: parseFloat(receitaAtualizada.valorSaquesPendentes),
                ultimaAtualizacao: receitaAtualizada.ultimaAtualizacao
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar receita do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar receita do vendedor',
            error: error.message
        });
    }
});

// POST - Sincronização manual de receita total (para admin)
router.post('/sincronizar-receita', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Iniciando sincronização manual de receita total...');
        
        // Executar sincronização global
        const resultado = await ReceitaService.sincronizarReceitaGlobal();
        
        console.log('✅ Sincronização manual concluída com sucesso');
        
        res.json({
            success: true,
            message: 'Receita total sincronizada com sucesso',
            data: resultado
        });
        
    } catch (error) {
        console.error('❌ Erro na sincronização manual:', error);
        res.status(500).json({
            success: false,
            message: 'Erro na sincronização manual',
            error: error.message
        });
    }
});

// GET - Listar todos os vendedores com receita atualizada
router.get('/vendedores', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Listando vendedores com receita atualizada...');
        console.log('🔍 Rota /vendedores chamada com usuário:', req.user?.email);
        
        // Buscar vendedores com informações completas do banco
        const vendedores = await Usuario.findAll({
            where: {
                role: 'user'
            },
            attributes: [
                'id', 'public_id', 'nome', 'nome_completo', 'email', 'telefone', 
                'whatsapp_contact', 'whatsapp_enabled', 'google_user', 'google_id',
                'role', 'status', 'ativo', 'suspenso', 'motivo_suspensao',
                'ultimo_login', 'created_at', 'updated_at'
            ],
            order: [['created_at', 'DESC']]
        });
        
        console.log(`📊 ${vendedores.length} vendedores encontrados no banco`);
        
        // Buscar receita atualizada para cada vendedor
        const vendedoresComReceita = [];
        
        for (const vendedor of vendedores) {
            try {
                const receita = await ReceitaService.atualizarReceitaTotal(vendedor.id);
                
                vendedoresComReceita.push({
                    // Campos do banco de dados
                    id: vendedor.id,
                    public_id: vendedor.public_id,
                    nome_completo: vendedor.nome_completo,
                    email: vendedor.email,
                    telefone: vendedor.telefone,
                    whatsapp_contact: vendedor.whatsapp_contact,
                    whatsapp_enabled: vendedor.whatsapp_enabled,
                    google_user: vendedor.google_user,
                    google_id: vendedor.google_id,
                    role: vendedor.role,
                    status: vendedor.status,
                    ativo: vendedor.ativo,
                    suspenso: vendedor.suspenso,
                    motivo_suspensao: vendedor.motivo_suspensao,
                    ultimo_login: vendedor.ultimo_login,
                    created_at: vendedor.created_at,
                    updated_at: vendedor.updated_at,
                    
                    // Campos de receita calculados
                    receitaTotal: receita.receitaTotal,
                    receitaDisponivel: receita.receitaDisponivel,
                    totalVendas: receita.totalVendas,
                    valorSaquesProcessados: receita.valorSaquesProcessados,
                    ultimaAtualizacao: receita.ultimaAtualizacao
                });
                
            } catch (error) {
                console.error(`❌ Erro ao buscar receita do vendedor ${vendedor.id}:`, error);
                
                // Adicionar vendedor mesmo com erro de receita
                vendedoresComReceita.push({
                    // Campos do banco de dados
                    id: vendedor.id,
                    public_id: vendedor.public_id,
                    nome_completo: vendedor.nome_completo,
                    email: vendedor.email,
                    telefone: vendedor.telefone,
                    whatsapp_contact: vendedor.whatsapp_contact,
                    whatsapp_enabled: vendedor.whatsapp_enabled,
                    google_user: vendedor.google_user,
                    google_id: vendedor.google_id,
                    role: vendedor.role,
                    status: vendedor.status,
                    ativo: vendedor.ativo,
                    suspenso: vendedor.suspenso,
                    motivo_suspensao: vendedor.motivo_suspensao,
                    ultimo_login: vendedor.ultimo_login,
                    created_at: vendedor.created_at,
                    updated_at: vendedor.updated_at,
                    
                    // Campos de receita com valores padrão
                    receitaTotal: 0,
                    receitaDisponivel: 0,
                    totalVendas: 0,
                    valorSaquesProcessados: 0,
                    ultimaAtualizacao: new Date(),
                    error: error.message
                });
            }
        }
        
        console.log(`✅ ${vendedoresComReceita.length} vendedores listados com sucesso`);
        
        res.json({
            success: true,
            vendedores: vendedoresComReceita
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar vendedores:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar vendedores',
            error: error.message
        });
    }
});

// PUT - Atualizar vendedor
router.put('/vendedores/:id', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome_completo, email, telefone, ativo } = req.body;
        
        console.log(`🔄 Atualizando vendedor ${id}...`);
        console.log('📝 Dados recebidos:', { nome_completo, email, telefone, ativo });
        
        // Verificar se o vendedor existe
        const vendedor = await Usuario.findOne({
            where: {
                id: id,
                role: 'user'
            }
        });
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        // Atualizar dados
        const updateData = {};
        if (nome_completo !== undefined) updateData.nome_completo = nome_completo;
        if (email !== undefined) updateData.email = email;
        if (telefone !== undefined) updateData.telefone = telefone;
        if (ativo !== undefined) updateData.ativo = ativo;
        
        await vendedor.update(updateData);
        
        console.log(`✅ Vendedor ${id} atualizado com sucesso`);
        
        res.json({
            success: true,
            message: 'Vendedor atualizado com sucesso',
            vendedor: {
                id: vendedor.id,
                nome_completo: vendedor.nome_completo,
                email: vendedor.email,
                telefone: vendedor.telefone,
                ativo: vendedor.ativo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar vendedor',
            error: error.message
        });
    }
});

// PUT - Alterar status do vendedor
router.put('/vendedores/:id/status', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { ativo } = req.body;
        
        console.log(`🔄 Alterando status do vendedor ${id} para ${ativo ? 'ativo' : 'inativo'}...`);
        
        // Verificar se o vendedor existe
        const vendedor = await Usuario.findOne({
            where: {
                id: id,
                role: 'user'
            }
        });
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        // Atualizar status
        const statusAnterior = vendedor.ativo;
        await vendedor.update({
            ativo: ativo
        });
        
        // Se o usuário foi bloqueado (ativo = false), enviar email de notificação com fundos congelados
        if (statusAnterior && !ativo && vendedor.email) {
            try {
                await emailManagerService.enviarEmailSistema('notificacao_bloqueio_conta', {
                    email: vendedor.email,
                    nome: vendedor.nome_completo || vendedor.email,
                    numeroVendedor: vendedor.vendedor_id || 'N/A'
                });
                console.log(`📧 Notificação de bloqueio (com fundos congelados) enviada para: ${vendedor.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de bloqueio:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        // Se o usuário foi desbloqueado (ativo = true), enviar email de notificação
        if (!statusAnterior && ativo && vendedor.email) {
            try {
                await emailManagerService.enviarEmailSistema('notificacao_desbloqueio_conta', {
                    email: vendedor.email,
                    nome: vendedor.nome_completo || vendedor.email,
                    numeroVendedor: vendedor.vendedor_id || 'N/A'
                });
                console.log(`📧 Notificação de desbloqueio enviada para: ${vendedor.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de desbloqueio:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        console.log(`✅ Status do vendedor ${id} alterado para ${ativo ? 'ativo' : 'inativo'}`);
        
        res.json({
            success: true,
            message: `Vendedor ${ativo ? 'ativado' : 'desativado'} com sucesso`,
            vendedor: {
                id: vendedor.id,
                nome_completo: vendedor.nome_completo,
                ativo: vendedor.ativo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao alterar status do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao alterar status do vendedor',
            error: error.message
        });
    }
});

// POST - Atualizar estatísticas de todos os vendedores
router.post('/vendedores/atualizar-estatisticas', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Atualizando estatísticas de todos os vendedores...');
        
        // Buscar todos os vendedores
        const vendedores = await Usuario.findAll({
            where: {
                role: 'user'
            },
            attributes: ['id', 'nome_completo', 'email']
        });
        
        console.log(`📊 Encontrados ${vendedores.length} vendedores para atualizar`);
        
        // Atualizar estatísticas de cada vendedor
        const resultados = [];
        for (const vendedor of vendedores) {
            try {
                await ReceitaService.atualizarEstatisticasVendedor(vendedor.id);
                resultados.push({
                    id: vendedor.id,
                    nome: vendedor.nome_completo,
                    status: 'sucesso'
                });
                console.log(`✅ Estatísticas atualizadas para ${vendedor.nome_completo}`);
            } catch (error) {
                console.error(`❌ Erro ao atualizar estatísticas de ${vendedor.nome_completo}:`, error.message);
                resultados.push({
                    id: vendedor.id,
                    nome: vendedor.nome_completo,
                    status: 'erro',
                    erro: error.message
                });
            }
        }
        
        const sucessos = resultados.filter(r => r.status === 'sucesso').length;
        const erros = resultados.filter(r => r.status === 'erro').length;
        
        console.log(`✅ Atualização concluída: ${sucessos} sucessos, ${erros} erros`);
        
        res.json({
            success: true,
            message: `Estatísticas atualizadas: ${sucessos} sucessos, ${erros} erros`,
            data: {
                total: vendedores.length,
                sucessos,
                erros,
                resultados
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// ==================== ROTAS DE SAQUES ====================

// GET - Listar todos os saques (admin)
router.get('/saques', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando saques...');
        
        // Buscar todos os saques com dados do vendedor
        const saques = await Pagamento.findAll({
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }],
            order: [['data_solicitacao', 'DESC']]
        });
        
        // Formatar dados para resposta
        const saquesFormatados = saques.map(saque => ({
            id: saque.id,
            id_saque: saque.id_saque,
            vendedor_id: saque.vendedor_id,
            vendedor_nome: saque.vendedor?.nome_completo || 'Vendedor não encontrado',
            vendedor_email: saque.vendedor?.email || 'N/A',
            valor_solicitado: parseFloat(saque.valor_solicitado || 0),
            valor: parseFloat(saque.valor || 0),
            taxa: parseFloat(saque.taxa || 0),
            nome_titular: saque.nome_titular,
            telefone_titular: saque.telefone_titular,
            metodo: saque.metodo,
            status: saque.status,
            data_solicitacao: saque.data_solicitacao,
            data_aprovacao: saque.data_aprovacao,
            data_entrega: saque.data_entrega,
            codigo_transacao: saque.codigo_transacao,
            observacoes: saque.observacoes
        }));
        
        console.log(`✅ ${saquesFormatados.length} saques encontrados`);
        
        res.json({
            success: true,
            saques: saquesFormatados
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar saques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar saques',
            error: error.message
        });
    }
});

// PUT - Atualizar saque (admin)
router.put('/saques/:id', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, codigo_transacao, observacoes } = req.body;
        
        console.log(`🔄 Atualizando saque ${id}...`);
        
        // Verificar se o saque existe
        const saque = await Pagamento.findByPk(id, {
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        // Preparar dados para atualização
        const updateData = {
            status: status
        };
        
        // Adicionar data de aprovação se mudou para aprovado
        if (status === 'aprovado' && saque.status !== 'aprovado') {
            updateData.data_aprovacao = new Date();
        }
        
        // Adicionar data de entrega se mudou para pago
        if (status === 'pago' && saque.status !== 'pago') {
            updateData.data_entrega = new Date();
        }
        
        // Adicionar código de transação se fornecido
        if (codigo_transacao) {
            updateData.codigo_transacao = codigo_transacao;
        }
        
        // Adicionar observações se fornecidas
        if (observacoes) {
            updateData.observacoes = observacoes;
        }
        
        // Atualizar saque
        await saque.update(updateData);
        
        // Criar registro no histórico de saques se mudou para aprovado ou pago
        if (status === 'aprovado' || status === 'pago') {
            try {
                const EstatisticasService = require('../services/estatisticasService');
                await EstatisticasService.adicionarHistoricoSaque({
                    id: saque.id,
                    vendedor_id: saque.vendedor_id,
                    id_saque: saque.id_saque,
                    valor_solicitado: saque.valor_solicitado,
                    valor: saque.valor,
                    taxa: saque.taxa,
                    nome_titular: saque.nome_titular,
                    telefone_titular: saque.telefone_titular,
                    metodo: saque.metodo,
                    status: status,
                    data_solicitacao: saque.data_solicitacao,
                    data_aprovacao: status === 'aprovado' ? new Date() : saque.data_aprovacao,
                    data_pagamento: status === 'pago' ? new Date() : saque.data_pagamento,
                    observacoes: saque.observacoes,
                    processado_por: req.user.id,
                    codigo_transacao: codigo_transacao,
                    ip_solicitacao: saque.ip_solicitacao,
                    user_agent: saque.user_agent
                });
                console.log(`📝 Histórico de saque criado para ${saque.id_saque}`);
            } catch (error) {
                console.error('⚠️ Erro ao criar histórico de saque:', error);
            }
        }
        
        console.log(`✅ Saque ${id} atualizado para status: ${status}`);
        
        // Notificar vendedor sobre mudança de status (opcional)
        if (saque.vendedor) {
            console.log(`📧 Notificação enviada para vendedor ${saque.vendedor.email}`);
            // Aqui você pode implementar notificação por email, SMS, etc.
        }
        
        res.json({
            success: true,
            message: 'Saque atualizado com sucesso',
            saque: {
                id: saque.id,
                id_saque: saque.id_saque,
                status: saque.status,
                vendedor_nome: saque.vendedor?.nome_completo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar saque',
            error: error.message
        });
    }
});

// POST - Aprovar saque
router.post('/saques/:id/aprovar', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Aprovando saque ${id}...`);
        
        // Verificar se o saque existe e está pendente
        const saque = await Pagamento.findOne({
            where: {
                id: id,
                status: 'pendente'
            },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado ou já não está pendente'
            });
        }
        
        // Aprovar saque
        await saque.update({
            status: 'aprovado',
            data_aprovacao: new Date(),
            processado_por: req.user.id
        });
        
        // Criar registro no histórico de saques
        try {
            const EstatisticasService = require('../services/estatisticasService');
            await EstatisticasService.adicionarHistoricoSaque({
                id: saque.id,
                vendedor_id: saque.vendedor_id,
                id_saque: saque.id_saque,
                valor_solicitado: saque.valor_solicitado,
                valor: saque.valor,
                taxa: saque.taxa,
                nome_titular: saque.nome_titular,
                telefone_titular: saque.telefone_titular,
                metodo: saque.metodo,
                status: 'aprovado',
                data_solicitacao: saque.data_solicitacao,
                data_aprovacao: new Date(),
                observacoes: saque.observacoes,
                processado_por: req.user.id,
                ip_solicitacao: saque.ip_solicitacao,
                user_agent: saque.user_agent
            });
            console.log(`📝 Histórico de saque criado para ${saque.id_saque}`);
        } catch (error) {
            console.error('⚠️ Erro ao criar histórico de saque:', error);
        }
        
        console.log(`✅ Saque ${id} aprovado com sucesso`);
        
        res.json({
            success: true,
            message: 'Saque aprovado com sucesso',
            saque: {
                id: saque.id,
                id_saque: saque.id_saque,
                status: saque.status,
                vendedor_nome: saque.vendedor?.nome_completo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao aprovar saque',
            error: error.message
        });
    }
});

// POST - Cancelar saque
router.post('/saques/:id/cancelar', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Cancelando saque ${id}...`);
        
        // Verificar se o saque existe e está pendente
        const saque = await Pagamento.findOne({
            where: {
                id: id,
                status: 'pendente'
            },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado ou já não está pendente'
            });
        }
        
        // Cancelar saque
        await saque.update({
            status: 'cancelado'
        });
        
        console.log(`✅ Saque ${id} cancelado com sucesso`);
        
        res.json({
            success: true,
            message: 'Saque cancelado com sucesso',
            saque: {
                id: saque.id,
                id_saque: saque.id_saque,
                status: saque.status,
                vendedor_nome: saque.vendedor?.nome_completo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao cancelar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao cancelar saque',
            error: error.message
        });
    }
});

// POST - Rejeitar saque
router.post('/saques/:id/rejeitar', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        
        console.log(`🔄 Rejeitando saque ${id}...`);
        
        // Verificar se o saque existe e está pendente
        const saque = await Pagamento.findOne({
            where: {
                id: id,
                status: 'pendente'
            },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado ou já não está pendente'
            });
        }
        
        // Validar que motivo foi fornecido
        if (!motivo || motivo.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Motivo da rejeição é obrigatório'
            });
        }
        
        // Rejeitar saque com motivo
        await saque.update({
            status: 'rejeitado',
            motivo_rejeicao: motivo.trim(),
            data_processamento: new Date(),
            processado_por: req.user.id,
            observacoes: `${saque.observacoes || ''}\n\n=== REJEITADO ===\nData: ${new Date().toLocaleString('pt-BR', { timeZone: 'Africa/Maputo' })}\nMotivo: ${motivo.trim()}\nProcessado por: ${req.user.nome_completo || req.user.email}`.trim()
        });
        
        // Recarregar saque para obter dados atualizados
        await saque.reload();
        
        // Buscar vendedor para notificação
        const vendedor = await Usuario.findByPk(saque.vendedor_id, {
            attributes: ['id', 'nome_completo', 'email', 'telefone']
        });
        
        // Enviar notificação ao vendedor sobre a rejeição
        try {
            const SaqueNotificationService = require('../services/saqueNotificationService');
            await SaqueNotificationService.notificarVendedorSaqueRejeitado(saque, vendedor, motivo.trim());
            console.log(`✅ Notificação de rejeição enviada para vendedor: ${vendedor.email}`);
        } catch (notificationError) {
            console.error('❌ Erro ao enviar notificação de rejeição:', notificationError);
            // Não falhar a operação por erro de notificação
        }
        
        // IMPORTANTE: O saldo já foi subtraído quando o saque foi criado
        // Não precisa reverter, pois o saldo deve permanecer subtraído mesmo quando recusado
        console.log(`✅ Saque ${id} rejeitado com sucesso. Saldo permanece subtraído.`);
        
        res.json({
            success: true,
            message: 'Saque rejeitado com sucesso',
            saque: {
                id: saque.id,
                public_id: saque.public_id,
                status: saque.status,
                motivo_rejeicao: saque.motivo_rejeicao,
                vendedor_nome: vendedor?.nome_completo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao rejeitar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao rejeitar saque',
            error: error.message
        });
    }
});

// GET - Buscar detalhes de um saque específico
router.get('/saques/:id', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Buscando detalhes do saque ${id}...`);
        
        const saque = await Pagamento.findOne({
            where: { id: id },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        console.log(`✅ Detalhes do saque ${id} carregados com sucesso`);
        
        res.json({
            success: true,
            saque: saque
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar detalhes do saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar detalhes do saque',
            error: error.message
        });
    }
});

// POST - Marcar saque como pago
router.post('/saques/:id/pagar', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_transacao } = req.body;
        
        console.log(`🔄 Marcando saque ${id} como pago...`);
        
        // Verificar se o saque existe e está aprovado
        const saque = await Pagamento.findOne({
            where: {
                id: id,
                status: 'aprovado'
            },
            include: [{
                model: Usuario,
                as: 'vendedorProduto',
                attributes: ['id', 'nome_completo', 'email']
            }]
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado ou não está aprovado'
            });
        }
        
        // IMPORTANTE: Quando marcado como pago, o dinheiro vai para o ADMIN, não para o cliente
        // Atualizar estatísticas do vendedor para refletir que o saque foi pago
        const estatisticasVendedor = await EstatisticasVendedor.findOne({
            where: { vendedor_id: saque.vendedor_id }
        });
        
        if (estatisticasVendedor) {
            // Atualizar estatísticas - saques processados são subtraídos da receita
            await estatisticasVendedor.update({
                valor_saques_pendentes: 0, // SEMPRE ZERO
                saques_pagos: parseInt(estatisticasVendedor.saques_pagos || 0) + 1,
                valor_saques_pagos: 0, // SEMPRE ZERO - saques processados são subtraídos da receita
                ultima_atualizacao: new Date()
            });
        }
        
        // Marcar como pago
        await saque.update({
            status: 'pago',
            data_pagamento: new Date(),
            codigo_transacao: codigo_transacao || `PAY-${Date.now()}`,
            processado_por: req.user.id
        });
        
        // Criar registro no histórico de saques
        try {
            const EstatisticasService = require('../services/estatisticasService');
            await EstatisticasService.adicionarHistoricoSaque({
                id: saque.id,
                vendedor_id: saque.vendedor_id,
                id_saque: saque.id_saque,
                valor_solicitado: saque.valor_solicitado,
                valor: saque.valor,
                taxa: saque.taxa,
                nome_titular: saque.nome_titular,
                telefone_titular: saque.telefone_titular,
                metodo: saque.metodo,
                status: 'pago',
                data_solicitacao: saque.data_solicitacao,
                data_aprovacao: saque.data_aprovacao,
                data_pagamento: new Date(),
                observacoes: saque.observacoes,
                processado_por: req.user.id,
                codigo_transacao: codigo_transacao || `PAY-${Date.now()}`,
                ip_solicitacao: saque.ip_solicitacao,
                user_agent: saque.user_agent
            });
            console.log(`📝 Histórico de saque criado para ${saque.id_saque}`);
        } catch (error) {
            console.error('⚠️ Erro ao criar histórico de saque:', error);
        }
        
        // Atualizar saldo do administrador (subtrair valor pago)
        try {
            await SaldoAdminService.processarSaquePago(saque.id, saque.valor);
            console.log(`💰 Saldo do administrador atualizado após saque pago`);
        } catch (error) {
            console.error('⚠️ Erro ao atualizar saldo do admin, mas saque foi processado:', error);
        }
        
        console.log(`💰 Saque ${id} pago - Dinheiro transferido para conta do ADMIN`);
        console.log(`📊 Estatísticas do vendedor atualizadas`);
        
        console.log(`✅ Saque ${id} marcado como pago com sucesso`);
        
        res.json({
            success: true,
            message: 'Saque marcado como pago com sucesso',
            saque: {
                id: saque.id,
                id_saque: saque.id_saque,
                status: saque.status,
                codigo_transacao: saque.codigo_transacao,
                vendedor_nome: saque.vendedor?.nome_completo
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao marcar saque como pago:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar saque como pago',
            error: error.message
        });
    }
});

// ==================== ROTAS DE ESTATÍSTICAS ====================

// GET - Estatísticas gerais para admin
router.get('/estatisticas', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando estatísticas administrativas...');
        
        // Usar o serviço de estatísticas
        const estatisticas = await ReceitaService.buscarEstatisticasAdmin();
        
        console.log('✅ Estatísticas calculadas com sucesso');
        
        res.json({
            success: true,
            data: estatisticas
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas',
            error: error.message
        });
    }
});

// ======================== ROTAS DE VENDAS ========================

// GET - Listar vendas pendentes para aprovação
router.get('/vendas/pendentes', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando vendas pendentes para aprovação...');
        
        const { Venda, Produto, Usuario } = require('../config/database');
        
        const vendasPendentes = await Venda.findAll({
            where: {
                status: 'Pendente'
            },
            include: [
                {
                    model: Produto,
                    attributes: ['nome', 'imagem_url']
                },
                {
                    model: Usuario,
                    as: 'vendedorProduto',
                    attributes: ['nome_completo', 'email']
                }
            ],
            order: [['created_at', 'DESC']]
        });
        
        console.log(`✅ ${vendasPendentes.length} vendas pendentes encontradas`);
        
        res.json({
            success: true,
            vendas: vendasPendentes.map(venda => ({
                id: venda.id,
                public_id: venda.public_id,
                cliente_nome: venda.cliente_nome,
                cliente_email: venda.cliente_email,
                valor: venda.valor || venda.valor_final,
                created_at: venda.created_at,
                produto: venda.Produto ? {
                    nome: venda.Produto.nome,
                    imagem: venda.Produto.imagem_url
                } : null,
                vendedor: venda.vendedor ? {
                    nome: venda.vendedor.nome_completo,
                    email: venda.vendedor.email
                } : null
            }))
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar vendas pendentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar vendas pendentes',
            error: error.message
        });
    }
});

// POST - Aprovar venda manualmente (para casos especiais)
router.post('/vendas/:id/aprovar', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { observacoes } = req.body;
        
        console.log(`🔄 Aprovando venda ${id} manualmente...`);
        
        // Buscar a venda
        const { Venda } = require('../config/database');
        const venda = await Venda.findByPk(id);
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        if (venda.status === 'Aprovada') {
            return res.status(400).json({
                success: false,
                message: 'Venda já está aprovada'
            });
        }
        
        // Aprovar a venda
        await venda.update({
            status: 'Aprovado',
            status: 'Pago',
            pagamento_data_processamento: new Date(),
            observacoes: observacoes ? `${venda.observacoes || ''}\n\nAprovada manualmente em: ${new Date().toLocaleString('pt-BR')}\nObservações: ${observacoes}`.trim() : venda.observacoes
        });
        
        // Adicionar comissão ao saldo do administrador
        try {
            const SaldoAdminService = require('../services/saldoAdminService');
            await SaldoAdminService.processarVendaAprovada(venda.id, venda.valor || venda.valor_final);
            console.log('💰 Comissão adicionada ao saldo do administrador');
        } catch (error) {
            console.error('⚠️ Erro ao processar comissão do admin:', error);
            // Não falhar a aprovação por erro na comissão
        }
        
        console.log(`✅ Venda ${id} aprovada manualmente com sucesso`);
        
        res.json({
            success: true,
            message: 'Venda aprovada manualmente com sucesso',
            venda: {
                id: venda.id,
                public_id: venda.public_id,
                status: venda.status,
                valor: venda.valor || venda.valor_final
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar venda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao aprovar venda',
            error: error.message
        });
    }
});

// ======================== ROTAS DE SALDO DO ADMINISTRADOR ========================

// GET - Buscar saldo do administrador
router.get('/saldo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando saldo do administrador...');
        
        const saldo = await SaldoAdminService.buscarSaldo();
        
        console.log('✅ Saldo do administrador buscado com sucesso');
        
        res.json({
            success: true,
            data: saldo
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar saldo do administrador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar saldo do administrador',
            error: error.message
        });
    }
});

// POST - Recalcular saldo do administrador
router.post('/saldo/recalcular', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Recalculando saldo do administrador...');
        
        const saldo = await SaldoAdminService.recalcularSaldo();
        
        console.log('✅ Saldo do administrador recalculado com sucesso');
        
        res.json({
            success: true,
            message: 'Saldo recalculado com sucesso',
            data: saldo
        });
        
    } catch (error) {
        console.error('❌ Erro ao recalcular saldo do administrador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao recalcular saldo do administrador',
            error: error.message
        });
    }
});

// PUT - Atualizar comissão do administrador
router.put('/saldo/comissao', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { percentual } = req.body;
        
        if (!percentual || percentual < 0 || percentual > 100) {
            return res.status(400).json({
                success: false,
                message: 'Percentual de comissão deve estar entre 0 e 100'
            });
        }
        
        console.log(`🔄 Atualizando comissão para ${percentual}%...`);
        
        const saldo = await SaldoAdminService.atualizarComissao(percentual);
        
        console.log(`✅ Comissão atualizada para ${percentual}%`);
        
        res.json({
            success: true,
            message: `Comissão atualizada para ${percentual}%`,
            data: saldo
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar comissão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar comissão',
            error: error.message
        });
    }
});

// ==================== ROTAS DE GERENCIAMENTO DE VENDEDORES ====================

// GET - Detalhes de um vendedor específico
router.get('/vendedores/:id', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Carregando detalhes do vendedor ${id}...`);
        
        const vendedor = await Usuario.findByPk(id, {
            where: { role: 'user' },
            attributes: ['id', 'nome_completo', 'email', 'telefone', 'ativo', 'created_at', 'updated_at']
        });
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        // Buscar estatísticas do vendedor
        const vendas = await Venda.findAll({
            where: {
                vendedor_id: id,
                status: 'Aprovado'
            },
            attributes: [
                [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'total_vendas'],
                [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'receita_total']
            ],
            raw: true
        });
        
        const stats = vendas[0] || { total_vendas: 0, receita_total: 0 };
        
        res.json({
            success: true,
            data: {
                vendedor: {
                    ...vendedor.toJSON(),
                    total_vendas: parseInt(stats.total_vendas || 0),
                    receita_total: parseFloat(stats.receita_total || 0),
                    receita_disponivel: parseFloat(stats.receita_total || 0) // Simplificado
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar detalhes do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Produtos de um vendedor
router.get('/vendedores/:id/produtos', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Carregando produtos do vendedor ${id}...`);
        
        const { Produto } = require('../config/database');
        
        const produtos = await Produto.findAll({
            where: { vendedor_id: id },
            order: [['created_at', 'DESC']]
        });
        
        // Calcular vendas para cada produto
        const produtosComStats = await Promise.all(
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
        
        res.json({
            success: true,
            data: {
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

// GET - Gráfico de vendas do vendedor
router.get('/vendedores/:id/vendas-grafico', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { periodo = '30' } = req.query; // dias
        
        console.log(`🔄 Carregando gráfico de vendas do vendedor ${id}...`);
        
        const dataInicio = new Date();
        dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
        
        // Buscar vendas por dia
        const vendas = await Venda.findAll({
            where: {
                vendedor_id: id,
                status: 'Aprovado',
                created_at: {
                    [Op.gte]: dataInicio
                }
            },
            attributes: [
                [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'data'],
                [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'total_vendas'],
                [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'receita']
            ],
            group: [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at'))],
            order: [[Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'ASC']],
            raw: true
        });
        
        res.json({
            success: true,
            data: {
                vendas: vendas.map(v => ({
                    data: v.data,
                    total_vendas: parseInt(v.total_vendas || 0),
                    receita: parseFloat(v.receita || 0)
                }))
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar gráfico de vendas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// PUT - Toggle status do vendedor (ativar/bloquear)
router.put('/vendedores/:id/toggle-status', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        const { ativo, suspenso, motivo_suspensao, data_suspensao, data_reativacao } = req.body;
        
        console.log(`🔄 ${ativo ? 'Ativando' : 'Bloqueando'} vendedor ${id}...`);
        
        const vendedor = await Usuario.findByPk(id, {
            where: { role: 'user' }
        });
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        // Atualizar campos de status
        const statusAnterior = vendedor.ativo;
        const updateData = { ativo };
        
        if (suspenso !== undefined) {
            updateData.suspenso = suspenso;
        }
        
        if (motivo_suspensao) {
            updateData.motivo_suspensao = motivo_suspensao;
        }
        
        if (data_suspensao) {
            updateData.data_suspensao = data_suspensao;
        }
        
        if (data_reativacao) {
            updateData.data_reativacao = data_reativacao;
        }
        
        await vendedor.update(updateData);
        
        // Se o usuário foi bloqueado (ativo = false), enviar email de notificação com fundos congelados
        if (statusAnterior && !ativo && vendedor.email) {
            try {
                await emailManagerService.enviarEmailSistema('notificacao_bloqueio_conta', {
                    email: vendedor.email,
                    nome: vendedor.nome_completo || vendedor.email,
                    numeroVendedor: vendedor.vendedor_id || 'N/A'
                });
                console.log(`📧 Notificação de bloqueio (com fundos congelados) enviada para: ${vendedor.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de bloqueio:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        // Se o usuário foi desbloqueado (ativo = true), enviar email de notificação
        if (!statusAnterior && ativo && vendedor.email) {
            try {
                await emailManagerService.enviarEmailSistema('notificacao_desbloqueio_conta', {
                    email: vendedor.email,
                    nome: vendedor.nome_completo || vendedor.email,
                    numeroVendedor: vendedor.vendedor_id || 'N/A'
                });
                console.log(`📧 Notificação de desbloqueio enviada para: ${vendedor.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de desbloqueio:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        res.json({
            success: true,
            message: `Vendedor ${ativo ? 'ativado' : 'bloqueado'} com sucesso`
        });
        
    } catch (error) {
        console.error('❌ Erro ao alterar status do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// DELETE - Excluir vendedor
router.delete('/vendedores/:id', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Excluindo vendedor ${id}...`);
        
        const vendedor = await Usuario.findByPk(id, {
            where: { role: 'user' }
        });
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                message: 'Vendedor não encontrado'
            });
        }
        
        // Verificar se o vendedor tem vendas
        const temVendas = await Venda.count({
            where: { vendedor_id: id }
        });
        
        if (temVendas > 0) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir vendedor que possui vendas associadas'
            });
        }
        
        // Salvar informações do vendedor antes de excluir (para notificação)
        const vendedorInfo = {
            email: vendedor.email,
            nome: vendedor.nome_completo || vendedor.email,
            numeroVendedor: vendedor.vendedor_id || 'N/A'
        };
        
        // Excluir produtos do vendedor
        const { Produto } = require('../config/database');
        await Produto.destroy({
            where: { vendedor_id: id }
        });
        
        // Excluir vendedor
        await vendedor.destroy();
        
        // Enviar notificação de exclusão (se tiver email)
        if (vendedorInfo.email) {
            try {
                await emailManagerService.enviarEmailSistema('notificacao_exclusao_conta', vendedorInfo);
                console.log(`📧 Notificação de exclusão de conta enviada para: ${vendedorInfo.email}`);
            } catch (emailError) {
                console.error('⚠️ Erro ao enviar notificação de exclusão:', emailError);
                // Não bloquear a operação se o email falhar
            }
        }
        
        res.json({
            success: true,
            message: 'Vendedor excluído com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao excluir vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Relatório geral para exportação
router.get('/relatorio-geral', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Gerando relatório geral...');
        
        // Buscar estatísticas gerais
        const totalVendedores = await Usuario.count({
            where: { role: 'user' }
        });
        
        const vendedoresAtivos = await Usuario.count({
            where: { 
                role: 'user',
                ativo: true
            }
        });
        
        const { Produto } = require('../config/database');
        const totalProdutos = await Produto.count();
        const produtosAtivos = await Produto.count({
            where: { ativo: true }
        });
        
        // Receita total do sistema
        const vendasAprovadas = await Venda.findAll({
            where: { status: 'Aprovado' },
            attributes: ['valor']
        });
        
        const receitaTotalSistema = vendasAprovadas.reduce((total, venda) => {
            return total + parseFloat(venda.valor || 0);
        }, 0);
        
        // Saldo do admin (simplificado)
        const saldoAdmin = receitaTotalSistema * 0.1; // 10% do total como exemplo
        
        res.json({
            success: true,
            data: {
                totalVendedores,
                vendedoresAtivos,
                receitaTotalSistema: parseFloat(receitaTotalSistema),
                saldoAdmin: parseFloat(saldoAdmin),
                totalProdutos,
                produtosAtivos,
                dataGeracao: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar relatório geral:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// ==================== ROTAS DE TRANSFERÊNCIA B2C ====================

// GET - Buscar saldo da carteira Emola (saldo do admin)
router.get('/saldo-emola', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando saldo da carteira Emola...');
        
        const saldo = await SaldoAdminService.buscarSaldo();
        
        console.log('✅ Saldo da carteira Emola buscado com sucesso');
        
        res.json({
            success: true,
            saldo: saldo.saldoDisponivel || 0
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar saldo da carteira Emola:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar saldo da carteira Emola',
            error: error.message
        });
    }
});

// GET - Buscar total de saques (M-Pesa)
router.get('/total-saques', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando total de saques...');
        
        const totalSaques = await Pagamento.sum('valor_solicitado', {
            where: { status: 'pago' }
        });
        
        console.log('✅ Total de saques buscado com sucesso');
        
        res.json({
            success: true,
            total: totalSaques || 0
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar total de saques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar total de saques',
            error: error.message
        });
    }
});

// POST - Transferência B2C para Emola
router.post('/transferencia-b2c/emola', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { valor, telefone, nome } = req.body;
        
        console.log(`🔄 Iniciando transferência B2C para Emola: MZN ${valor}`);
        
        // Validar dados
        if (!valor || valor <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valor inválido'
            });
        }
        
        // Verificar saldo disponível
        const saldo = await SaldoAdminService.buscarSaldo();
        if (saldo.saldoDisponivel < valor) {
            return res.status(400).json({
                success: false,
                message: 'Saldo insuficiente'
            });
        }
        
        // Fazer transferência via E2Payment API
        const E2PaymentService = require('../services/e2paymentService');
        const resultado = await E2PaymentService.transferirB2C({
            valor: valor,
            telefone: telefone,
            nome: nome,
            metodo: 'emola'
        });
        
        if (resultado.success) {
            // Verificar se há saques suficientes para transferir
            const totalSaquesEmola = await Pagamento.sum('valor', {
                where: { 
                    status: 'pago',
                    metodo: 'Emola'
                }
            });
            
            const totalTransferenciasEmola = await TransferenciaB2C.sum('valor', {
                where: { 
                    metodo: 'emola',
                    status: 'sucesso'
                }
            });
            
            const saldoDisponivelEmola = (totalSaquesEmola || 0) - (totalTransferenciasEmola || 0);
            
            if (valor > saldoDisponivelEmola) {
                return res.status(400).json({
                    success: false,
                    message: `Valor insuficiente. Disponível: MZN ${saldoDisponivelEmola.toFixed(2)}`
                });
            }
            
            // Criar registro na tabela de transferências B2C
            await TransferenciaB2C.create({
                id_transacao: `B2C-${Date.now()}`,
                metodo: 'emola',
                valor: valor,
                nome_destinatario: nome,
                telefone: telefone,
                status: 'sucesso',
                id_transacao_e2payment: resultado.transacao_id,
                resposta_e2payment: JSON.stringify(resultado),
                observacoes: 'Transferência B2C Emola realizada com sucesso',
                data_processamento: new Date(),
                processado_por: req.user.id
            });
            
            // Subtrair valor do saldo do admin
            await SaldoAdminService.subtrairSaldo(valor, 'Transferência B2C Emola');
            
            console.log(`✅ Transferência B2C para Emola realizada com sucesso: MZN ${valor}`);
            
            res.json({
                success: true,
                message: 'Transferência realizada com sucesso',
                data: {
                    valor: valor,
                    telefone: telefone,
                    nome: nome,
                    metodo: 'emola',
                    transacao_id: resultado.transacao_id,
                    saldo_restante: saldoDisponivelEmola - valor
                }
            });
        } else {
            console.log(`❌ Erro na transferência B2C para Emola: ${resultado.message}`);
            
            res.status(400).json({
                success: false,
                message: resultado.message || 'Erro na transferência'
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na transferência B2C para Emola:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST - Transferência B2C para M-Pesa
router.post('/transferencia-b2c/mpesa', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { valor, telefone, nome } = req.body;
        
        console.log(`🔄 Iniciando transferência B2C para M-Pesa: MZN ${valor}`);
        
        // Validar dados
        if (!valor || valor <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valor inválido'
            });
        }
        
        // Verificar total de saques disponível
        const totalSaques = await Pagamento.sum('valor_solicitado', {
            where: { status: 'pago' }
        });
        
        if (totalSaques < valor) {
            return res.status(400).json({
                success: false,
                message: 'Valor excede o total de saques disponível'
            });
        }
        
        // Validar telefone - apenas 843357697 é permitido para MPESA nesta página
        if (!telefone || telefone.trim() !== '843357697') {
            return res.status(400).json({
                success: false,
                message: 'Para transferências B2C M-Pesa, apenas o número 843357697 é permitido nesta página'
            });
        }
        
        // Fazer transferência via GibraPay API (para MPESA)
        const gibrapayService = require('../services/gibrapayService');
        const reference = `b2c_mpesa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const resultado = await gibrapayService.processB2C(
            valor,
            telefone,
            reference
        );
        
        if (resultado.success) {
            // Verificar se há saques suficientes para transferir
            const totalSaquesMpesa = await Pagamento.sum('valor', {
                where: { 
                    status: 'pago',
                    metodo: 'Mpesa'
                }
            });
            
            const totalTransferenciasMpesa = await TransferenciaB2C.sum('valor', {
                where: { 
                    metodo: 'mpesa',
                    status: 'sucesso'
                }
            });
            
            const saldoDisponivelMpesa = (totalSaquesMpesa || 0) - (totalTransferenciasMpesa || 0);
            
            if (valor > saldoDisponivelMpesa) {
                return res.status(400).json({
                    success: false,
                    message: `Valor insuficiente. Disponível: MZN ${saldoDisponivelMpesa.toFixed(2)}`
                });
            }
            
            // Criar registro na tabela de transferências B2C
            await TransferenciaB2C.create({
                id_transacao: resultado.transaction_id || `B2C-${Date.now()}`,
                metodo: 'mpesa',
                valor: valor,
                nome_destinatario: nome || 'Destinatário M-Pesa',
                telefone: telefone,
                status: 'sucesso',
                id_transacao_e2payment: resultado.transaction_id,
                resposta_e2payment: JSON.stringify(resultado),
                observacoes: 'Transferência B2C M-Pesa realizada com sucesso via GibraPay',
                data_processamento: new Date(),
                processado_por: req.user.id
            });
            
            // Subtrair valor do saldo do admin
            await SaldoAdminService.subtrairSaldo(valor, 'Transferência B2C M-Pesa (GibraPay)');
            
            console.log(`✅ Transferência B2C para M-Pesa via GibraPay realizada com sucesso: MZN ${valor}`);
            
            res.json({
                success: true,
                message: 'Transferência B2C M-Pesa realizada com sucesso via GibraPay',
                data: {
                    valor: valor,
                    telefone: telefone,
                    nome: nome,
                    metodo: 'mpesa',
                    transacao_id: resultado.transaction_id,
                    referencia: resultado.reference,
                    saldo_restante: saldoDisponivelMpesa - valor
                }
            });
        } else {
            console.log(`❌ Erro na transferência B2C para M-Pesa: ${resultado.message}`);
            
            res.status(400).json({
                success: false,
                message: resultado.message || 'Erro na transferência'
            });
        }
        
    } catch (error) {
        console.error('❌ Erro na transferência B2C para M-Pesa:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// ==================== ROTAS DE HISTÓRICO DE TRANSFERÊNCIAS B2C ====================

// GET - Listar transferências B2C realizadas
router.get('/transferencias-b2c', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando transferências B2C...');
        
        // Buscar transferências B2C da tabela dedicada
        const transferencias = await TransferenciaB2C.findAll({
            order: [['data_transferencia', 'DESC']]
        });
        
        console.log(`✅ ${transferencias.length} transferências B2C encontradas`);
        
        res.json({
            success: true,
            transferencias: transferencias
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar transferências B2C:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar transferências B2C',
            error: error.message
        });
    }
});

// GET - Totais de transferências B2C por método
router.get('/transferencias-b2c/totais', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Calculando totais de transferências B2C...');
        
        // Calcular totais por método da tabela dedicada
        const transferenciasEmola = await TransferenciaB2C.sum('valor', {
            where: { 
                metodo: 'emola',
                status: 'sucesso'
            }
        });
        
        const transferenciasMpesa = await TransferenciaB2C.sum('valor', {
            where: { 
                metodo: 'mpesa',
                status: 'sucesso'
            }
        });
        
        console.log('✅ Totais calculados com sucesso');
        
        res.json({
            success: true,
            emola: transferenciasEmola || 0,
            mpesa: transferenciasMpesa || 0
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular totais de transferências:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular totais de transferências',
            error: error.message
        });
    }
});

// ==================== ROTAS DE SALDO E RECEITAS ORGANIZADAS ====================

// GET - Receita Disponível de todos os vendedores
router.get('/receita-disponivel-todos', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Calculando receita disponível de todos os vendedores...');
        
        // Buscar todas as vendas aprovadas
        const vendasAprovadas = await Venda.findAll({
            where: { status: 'Aprovado' },
            attributes: ['vendedor_id', 'valor']
        });
        
        // Buscar todos os saques processados (pagos)
        const saquesProcessados = await Pagamento.findAll({
            where: { status: 'pago' },
            attributes: ['vendedor_id', 'valor_solicitado']
        });
        
        // Calcular receita total por vendedor
        const receitaPorVendedor = {};
        vendasAprovadas.forEach(venda => {
            const vendedorId = venda.vendedor_id;
            if (!receitaPorVendedor[vendedorId]) {
                receitaPorVendedor[vendedorId] = 0;
            }
            receitaPorVendedor[vendedorId] += parseFloat(venda.valor || 0);
        });
        
        // Calcular saques processados por vendedor
        const saquesPorVendedor = {};
        saquesProcessados.forEach(saque => {
            const vendedorId = saque.vendedor_id;
            if (!saquesPorVendedor[vendedorId]) {
                saquesPorVendedor[vendedorId] = 0;
            }
            saquesPorVendedor[vendedorId] += parseFloat(saque.valor_solicitado || 0);
        });
        
        // Calcular receita disponível total
        let receitaDisponivelTotal = 0;
        const vendedoresComReceita = [];
        
        for (const vendedorId in receitaPorVendedor) {
            const receitaTotal = receitaPorVendedor[vendedorId];
            const saquesProcessados = saquesPorVendedor[vendedorId] || 0;
            const receitaDisponivel = Math.max(0, receitaTotal - saquesProcessados);
            
            receitaDisponivelTotal += receitaDisponivel;
            
            vendedoresComReceita.push({
                vendedor_id: vendedorId,
                receita_total: receitaTotal,
                saques_processados: saquesProcessados,
                receita_disponivel: receitaDisponivel
            });
        }
        
        console.log(`✅ Receita disponível total: MZN ${receitaDisponivelTotal.toFixed(2)}`);
        
        res.json({
            success: true,
            data: {
                receita_disponivel_total: parseFloat(receitaDisponivelTotal.toFixed(2)),
                total_vendedores: vendedoresComReceita.length,
                vendedores: vendedoresComReceita,
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular receita disponível:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular receita disponível',
            error: error.message
        });
    }
});

// GET - Receita Total de todos os vendedores
router.get('/receita-total-todos', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Calculando receita total de todos os vendedores...');
        
        // Buscar todas as vendas aprovadas
        const vendasAprovadas = await Venda.findAll({
            where: { status: 'Aprovado' },
            attributes: ['vendedor_id', 'valor']
        });
        
        // Calcular receita total por vendedor
        const receitaPorVendedor = {};
        vendasAprovadas.forEach(venda => {
            const vendedorId = venda.vendedor_id;
            if (!receitaPorVendedor[vendedorId]) {
                receitaPorVendedor[vendedorId] = 0;
            }
            receitaPorVendedor[vendedorId] += parseFloat(venda.valor || 0);
        });
        
        // Calcular receita total geral
        const receitaTotalGeral = Object.values(receitaPorVendedor).reduce((total, receita) => total + receita, 0);
        
        const vendedoresComReceita = Object.entries(receitaPorVendedor).map(([vendedorId, receita]) => ({
            vendedor_id: vendedorId,
            receita_total: receita
        }));
        
        console.log(`✅ Receita total geral: MZN ${receitaTotalGeral.toFixed(2)}`);
        
        res.json({
            success: true,
            data: {
                receita_total_geral: parseFloat(receitaTotalGeral.toFixed(2)),
                total_vendedores: vendedoresComReceita.length,
                vendedores: vendedoresComReceita,
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular receita total:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular receita total',
            error: error.message
        });
    }
});

// GET - Saldo ADM (soma de valores sacados pelos vendedores)
router.get('/saldo-adm', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Calculando saldo ADM (valores sacados pelos vendedores)...');
        
        // Buscar todos os saques pagos
        const saquesPagos = await Pagamento.findAll({
            where: { status: 'pago' },
            attributes: ['valor', 'metodo', 'created_at']
        });
        
        // Calcular total de saques pagos
        const totalSaquesPagos = saquesPagos.reduce((total, saque) => {
            return total + parseFloat(saque.valor || 0);
        }, 0);
        
        // Calcular por método de pagamento
        const saquesPorMetodo = {};
        saquesPagos.forEach(saque => {
            const metodo = saque.metodo || 'Outros';
            if (!saquesPorMetodo[metodo]) {
                saquesPorMetodo[metodo] = 0;
            }
            saquesPorMetodo[metodo] += parseFloat(saque.valor || 0);
        });
        
        console.log(`✅ Saldo ADM total: MZN ${totalSaquesPagos.toFixed(2)}`);
        
        res.json({
            success: true,
            data: {
                saldo_adm_total: parseFloat(totalSaquesPagos.toFixed(2)),
                total_saques: saquesPagos.length,
                saques_por_metodo: saquesPorMetodo,
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular saldo ADM:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular saldo ADM',
            error: error.message
        });
    }
});

// GET - Saldo de Transferências B2C (valor levantado)
router.get('/saldo-transferencias-b2c', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Calculando saldo de transferências B2C...');
        
        // Buscar todas as transferências B2C realizadas
        const transferenciasB2C = await TransferenciaB2C.findAll({
            where: { status: 'sucesso' },
            attributes: ['valor', 'metodo', 'created_at']
        });
        
        // Calcular total de transferências B2C
        const totalTransferenciasB2C = transferenciasB2C.reduce((total, transferencia) => {
            return total + parseFloat(transferencia.valor || 0);
        }, 0);
        
        // Calcular por método
        const transferenciasPorMetodo = {};
        transferenciasB2C.forEach(transferencia => {
            const metodo = transferencia.metodo || 'Outros';
            if (!transferenciasPorMetodo[metodo]) {
                transferenciasPorMetodo[metodo] = 0;
            }
            transferenciasPorMetodo[metodo] += parseFloat(transferencia.valor || 0);
        });
        
        console.log(`✅ Total transferências B2C: MZN ${totalTransferenciasB2C.toFixed(2)}`);
        
        res.json({
            success: true,
            data: {
                saldo_transferencias_b2c: parseFloat(totalTransferenciasB2C.toFixed(2)),
                total_transferencias: transferenciasB2C.length,
                transferencias_por_metodo: transferenciasPorMetodo,
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular saldo de transferências B2C:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular saldo de transferências B2C',
            error: error.message
        });
    }
});

// GET - Resumo completo de saldos e receitas
router.get('/resumo-saldos-receitas', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Gerando resumo completo de saldos e receitas...');
        
        // Buscar dados em paralelo
        const [vendasAprovadas, saquesPagos, transferenciasB2C] = await Promise.all([
            Venda.findAll({
                where: { status: 'Aprovado' },
                attributes: ['vendedor_id', 'valor']
            }),
            Pagamento.findAll({
                where: { status: 'pago' },
                attributes: ['vendedor_id', 'valor', 'metodo']
            }),
            TransferenciaB2C.findAll({
                where: { status: 'sucesso' },
                attributes: ['valor', 'metodo']
            })
        ]);
        
        // 1. Receita Total de todos os vendedores
        const receitaTotalGeral = vendasAprovadas.reduce((total, venda) => {
            return total + parseFloat(venda.valor || 0);
        }, 0);
        
        // 2. Receita Disponível de todos os vendedores
        const receitaPorVendedor = {};
        vendasAprovadas.forEach(venda => {
            const vendedorId = venda.vendedor_id;
            if (!receitaPorVendedor[vendedorId]) {
                receitaPorVendedor[vendedorId] = 0;
            }
            receitaPorVendedor[vendedorId] += parseFloat(venda.valor || 0);
        });
        
        const saquesPorVendedor = {};
        saquesPagos.forEach(saque => {
            const vendedorId = saque.vendedor_id;
            if (!saquesPorVendedor[vendedorId]) {
                saquesPorVendedor[vendedorId] = 0;
            }
            saquesPorVendedor[vendedorId] += parseFloat(saque.valor || 0);
        });
        
        const receitaDisponivelTotal = Object.keys(receitaPorVendedor).reduce((total, vendedorId) => {
            const receitaTotal = receitaPorVendedor[vendedorId];
            const saquesProcessados = saquesPorVendedor[vendedorId] || 0;
            const receitaDisponivel = Math.max(0, receitaTotal - saquesProcessados);
            return total + receitaDisponivel;
        }, 0);
        
        // 3. Saldo ADM (soma de valores sacados)
        const saldoAdmTotal = saquesPagos.reduce((total, saque) => {
            return total + parseFloat(saque.valor || 0);
        }, 0);
        
        // 4. Saldo de Transferências B2C
        const saldoTransferenciasB2C = transferenciasB2C.reduce((total, transferencia) => {
            return total + parseFloat(transferencia.valor || 0);
        }, 0);
        
        console.log('✅ Resumo de saldos e receitas gerado com sucesso');
        
        res.json({
            success: true,
            data: {
                receita_disponivel_todos: parseFloat(receitaDisponivelTotal.toFixed(2)),
                receita_total_todos: parseFloat(receitaTotalGeral.toFixed(2)),
                saldo_adm: parseFloat(saldoAdmTotal.toFixed(2)),
                saldo_transferencias_b2c: parseFloat(saldoTransferenciasB2C.toFixed(2)),
                estatisticas: {
                    total_vendas_aprovadas: vendasAprovadas.length,
                    total_saques_pagos: saquesPagos.length,
                    total_transferencias_b2c: transferenciasB2C.length,
                    total_vendedores_com_receita: Object.keys(receitaPorVendedor).length
                },
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar resumo de saldos e receitas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar resumo de saldos e receitas',
            error: error.message
        });
    }
});

// ==================== ROTAS DE GESTÃO FINANCEIRA ====================

// GET - Dados financeiros com filtros de período
router.get('/dados-financeiros', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { periodo = 'mensal', data_inicio, data_fim } = req.query;
        
        console.log(`🔄 Carregando dados financeiros - Período: ${periodo}`);
        
        // Calcular datas baseado no período
        let dataInicio, dataFim;
        const hoje = new Date();
        
        switch (periodo) {
            case 'diario':
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
                break;
            case 'semanal':
                const inicioSemana = hoje.getDate() - hoje.getDay();
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana + 6, 23, 59, 59);
                break;
            case 'mensal':
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
                break;
            case 'personalizado':
                if (data_inicio && data_fim) {
                    dataInicio = new Date(data_inicio);
                    dataFim = new Date(data_fim);
                } else {
                    dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
                }
                break;
            default:
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
        }
        
        console.log(`📅 Período: ${dataInicio.toLocaleDateString('pt-BR')} - ${dataFim.toLocaleDateString('pt-BR')}`);
        
        // Buscar dados em paralelo
        const [vendasAprovadas, saquesPagos, transferenciasB2C, vendasPorDia, saquesPorDia, transferenciasPorDia] = await Promise.all([
            // Vendas aprovadas no período
            Venda.findAll({
                where: { 
                    status: 'Aprovado',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: ['valor', 'created_at', 'vendedor_id']
            }),
            
            // Saques pagos no período
            Pagamento.findAll({
                where: { 
                    status: 'pago',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: ['valor', 'created_at', 'metodo', 'vendedor_id']
            }),
            
            // Transferências B2C no período
            TransferenciaB2C.findAll({
                where: { 
                    status: 'sucesso',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: ['valor', 'created_at', 'metodo']
            }),
            
            // Vendas por dia para gráfico
            Venda.findAll({
                where: { 
                    status: 'Aprovado',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
                    [sequelize.fn('SUM', sequelize.col('valor')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'quantidade']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
            }),
            
            // Saques por dia para gráfico
            Pagamento.findAll({
                where: { 
                    status: 'pago',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
                    [sequelize.fn('SUM', sequelize.col('valor')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'quantidade']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
            }),
            
            // Transferências por dia para gráfico
            TransferenciaB2C.findAll({
                where: { 
                    status: 'sucesso',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
                    [sequelize.fn('SUM', sequelize.col('valor')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'quantidade']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
            })
        ]);
        
        // Calcular totais
        const totalVendas = vendasAprovadas.reduce((total, venda) => total + parseFloat(venda.valor || 0), 0);
        const totalSaques = saquesPagos.reduce((total, saque) => total + parseFloat(saque.valor || 0), 0);
        const totalTransferencias = transferenciasB2C.reduce((total, transferencia) => total + parseFloat(transferencia.valor || 0), 0);
        
        // Calcular por método de pagamento
        const saquesPorMetodo = {};
        saquesPagos.forEach(saque => {
            const metodo = saque.metodo || 'Outros';
            if (!saquesPorMetodo[metodo]) {
                saquesPorMetodo[metodo] = { total: 0, quantidade: 0 };
            }
            saquesPorMetodo[metodo].total += parseFloat(saque.valor || 0);
            saquesPorMetodo[metodo].quantidade += 1;
        });
        
        const transferenciasPorMetodo = {};
        transferenciasB2C.forEach(transferencia => {
            const metodo = transferencia.metodo || 'Outros';
            if (!transferenciasPorMetodo[metodo]) {
                transferenciasPorMetodo[metodo] = { total: 0, quantidade: 0 };
            }
            transferenciasPorMetodo[metodo].total += parseFloat(transferencia.valor || 0);
            transferenciasPorMetodo[metodo].quantidade += 1;
        });
        
        // Calcular top vendedores
        const vendedoresPorReceita = {};
        vendasAprovadas.forEach(venda => {
            const vendedorId = venda.vendedor_id;
            if (!vendedoresPorReceita[vendedorId]) {
                vendedoresPorReceita[vendedorId] = 0;
            }
            vendedoresPorReceita[vendedorId] += parseFloat(venda.valor || 0);
        });
        
        const topVendedores = Object.entries(vendedoresPorReceita)
            .map(([vendedorId, receita]) => ({ vendedor_id: vendedorId, receita }))
            .sort((a, b) => b.receita - a.receita)
            .slice(0, 10);
        
        console.log('✅ Dados financeiros carregados com sucesso');
        
        res.json({
            success: true,
            data: {
                periodo: {
                    tipo: periodo,
                    data_inicio: dataInicio,
                    data_fim: dataFim
                },
                totais: {
                    vendas: parseFloat(totalVendas.toFixed(2)),
                    saques: parseFloat(totalSaques.toFixed(2)),
                    transferencias: parseFloat(totalTransferencias.toFixed(2)),
                    quantidade_vendas: vendasAprovadas.length,
                    quantidade_saques: saquesPagos.length,
                    quantidade_transferencias: transferenciasB2C.length
                },
                graficos: {
                    vendas_por_dia: vendasPorDia.map(item => ({
                        data: item.data,
                        total: parseFloat(item.total || 0),
                        quantidade: parseInt(item.quantidade || 0)
                    })),
                    saques_por_dia: saquesPorDia.map(item => ({
                        data: item.data,
                        total: parseFloat(item.total || 0),
                        quantidade: parseInt(item.quantidade || 0)
                    })),
                    transferencias_por_dia: transferenciasPorDia.map(item => ({
                        data: item.data,
                        total: parseFloat(item.total || 0),
                        quantidade: parseInt(item.quantidade || 0)
                    }))
                },
                distribuicao: {
                    saques_por_metodo: saquesPorMetodo,
                    transferencias_por_metodo: transferenciasPorMetodo
                },
                top_vendedores: topVendedores,
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados financeiros:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dados financeiros',
            error: error.message
        });
    }
});

// GET - Estatísticas comparativas (período anterior)
router.get('/estatisticas-comparativas', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { periodo = 'mensal' } = req.query;
        
        console.log(`🔄 Carregando estatísticas comparativas - Período: ${periodo}`);
        
        const hoje = new Date();
        let dataInicioAtual, dataFimAtual, dataInicioAnterior, dataFimAnterior;
        
        switch (periodo) {
            case 'diario':
                dataInicioAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
                dataFimAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
                dataInicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
                dataFimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 23, 59, 59);
                break;
            case 'semanal':
                const inicioSemana = hoje.getDate() - hoje.getDay();
                dataInicioAtual = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana);
                dataFimAtual = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana + 6, 23, 59, 59);
                dataInicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana - 7);
                dataFimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), inicioSemana - 1, 23, 59, 59);
                break;
            case 'mensal':
                dataInicioAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFimAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
                dataInicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dataFimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59);
                break;
        }
        
        // Buscar dados do período atual e anterior
        const [vendasAtual, saquesAtual, vendasAnterior, saquesAnterior] = await Promise.all([
            Venda.sum('valor', {
                where: { 
                    status: 'Aprovado',
                    created_at: { [Op.between]: [dataInicioAtual, dataFimAtual] }
                }
            }),
            Pagamento.sum('valor', {
                where: { 
                    status: 'pago',
                    created_at: { [Op.between]: [dataInicioAtual, dataFimAtual] }
                }
            }),
            Venda.sum('valor', {
                where: { 
                    status: 'Aprovado',
                    created_at: { [Op.between]: [dataInicioAnterior, dataFimAnterior] }
                }
            }),
            Pagamento.sum('valor', {
                where: { 
                    status: 'pago',
                    created_at: { [Op.between]: [dataInicioAnterior, dataFimAnterior] }
                }
            })
        ]);
        
        // Calcular variações percentuais
        const variacaoVendas = vendasAnterior > 0 ? ((vendasAtual - vendasAnterior) / vendasAnterior) * 100 : 0;
        const variacaoSaques = saquesAnterior > 0 ? ((saquesAtual - saquesAnterior) / saquesAnterior) * 100 : 0;
        
        res.json({
            success: true,
            data: {
                periodo_atual: {
                    vendas: parseFloat((vendasAtual || 0).toFixed(2)),
                    saques: parseFloat((saquesAtual || 0).toFixed(2))
                },
                periodo_anterior: {
                    vendas: parseFloat((vendasAnterior || 0).toFixed(2)),
                    saques: parseFloat((saquesAnterior || 0).toFixed(2))
                },
                variacoes: {
                    vendas_percentual: parseFloat(variacaoVendas.toFixed(2)),
                    saques_percentual: parseFloat(variacaoSaques.toFixed(2))
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas comparativas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar estatísticas comparativas',
            error: error.message
        });
    }
});

// ==================== ROTAS DE GRÁFICO DE RECEITAS ====================

// GET - Histórico financeiro para gráfico do dashboard
router.get('/dashboard/historico-financeiro', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Carregando histórico financeiro para dashboard...');
        
        // Gerar dados dos últimos 30 dias
        const labels = [];
        const saldoAdminData = [];
        const taxasData = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            
            // Buscar dados reais para este dia
            const dataInicio = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
            const dataFim = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
            
            // Buscar saques pagos (saldo admin)
            const saquesPagos = await Pagamento.sum('valor', {
                where: {
                    status: 'pago',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                }
            });
            
            // Buscar taxas (simplificado - 10% das vendas aprovadas)
            const vendasAprovadas = await Venda.sum('valor', {
                where: {
                    status: 'Aprovado',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                }
            });
            
            const taxas = (vendasAprovadas || 0) * 0.1; // 10% de taxa
            
            saldoAdminData.push(parseFloat(saquesPagos || 0));
            taxasData.push(parseFloat(taxas));
        }
        
        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: 'Saldo Admin (MZN)',
                    data: saldoAdminData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Taxas Coletadas (MZN)',
                    data: taxasData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        };
        
        console.log('✅ Histórico financeiro carregado com sucesso');
        
        res.json({
            success: true,
            data: chartData
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar histórico financeiro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar histórico financeiro',
            error: error.message
        });
    }
});

// GET - Teste de conectividade
router.get('/test', authenticateToken, checkAdminAccess, async (req, res) => {
    res.json({
        success: true,
        message: 'Endpoint de receitas funcionando',
        timestamp: new Date()
    });
});

// GET - Dados de receitas para gráfico com filtros específicos
router.get('/receitas-grafico', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { periodo = '7d' } = req.query;
        
        console.log(`🔄 Carregando dados de receitas para gráfico - Período: ${periodo}`);
        
        // Calcular datas baseado no período
        let dataInicio, dataFim;
        const hoje = new Date();
        
        switch (periodo) {
            case 'hoje':
                // Hoje: 00:00:00 até 23:59:59
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
                break;
            case 'ontem':
                // Ontem: 00:00:00 até 23:59:59
                const ontem = new Date(hoje);
                ontem.setDate(hoje.getDate() - 1);
                dataInicio = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 0, 0, 0);
                dataFim = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59);
                break;
            case '7d':
                // 7 dias: desde 6 dias atrás até hoje (inclusive)
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6, 0, 0, 0);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
                break;
            case '30d':
                // 30 dias: desde 29 dias atrás até hoje (inclusive)
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29, 0, 0, 0);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
                break;
            default:
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6, 0, 0, 0);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        }
        
        console.log(`📅 Período: ${dataInicio.toLocaleDateString('pt-BR')} - ${dataFim.toLocaleDateString('pt-BR')}`);
        
        let vendasData;
        
        if (periodo === 'hoje' || periodo === 'ontem') {
            // Para hoje e ontem, agrupar por hora
            vendasData = await Venda.findAll({
                where: { 
                    status: 'Aprovado',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: [
                    [sequelize.fn('HOUR', sequelize.col('created_at')), 'hora'],
                    [sequelize.fn('SUM', sequelize.col('valor')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'quantidade']
                ],
                group: [sequelize.fn('HOUR', sequelize.col('created_at'))],
                order: [[sequelize.fn('HOUR', sequelize.col('created_at')), 'ASC']]
            });
        } else {
            // Para 7d e 30d, agrupar por data
            vendasData = await Venda.findAll({
                where: { 
                    status: 'Aprovado',
                    created_at: {
                        [Op.between]: [dataInicio, dataFim]
                    }
                },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
                    [sequelize.fn('SUM', sequelize.col('valor')), 'total'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'quantidade']
                ],
                group: [sequelize.fn('DATE', sequelize.col('created_at'))],
                order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
            });
        }
        
        // Processar dados para o gráfico
        let labels = [];
        let valores = [];
        let quantidades = [];
        
        if (periodo === 'hoje' || periodo === 'ontem') {
            // Criar array de 24 horas (0-23)
            for (let i = 0; i < 24; i++) {
                labels.push(`${i.toString().padStart(2, '0')}h`);
                valores.push(0);
                quantidades.push(0);
            }
            
            // Preencher com dados reais
            vendasData.forEach(item => {
                const hora = parseInt(item.hora);
                if (hora >= 0 && hora < 24) {
                    const valor = Math.max(0, parseFloat(item.total || 0)); // Garantir que nunca seja negativo
                    valores[hora] = valor;
                    quantidades[hora] = parseInt(item.quantidade || 0);
                }
            });
        } else {
            // Para períodos de dias, criar array com todas as datas
            const dataAtual = new Date(dataInicio);
            const dataFinal = new Date(dataFim);
            
            while (dataAtual <= dataFinal) {
                const dataStr = dataAtual.toISOString().split('T')[0];
                labels.push(dataAtual.toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit',
                    year: periodo === '30d' ? '2-digit' : undefined
                }));
                
                const dadosDia = vendasData.find(item => item.data === dataStr);
                const valor = dadosDia ? Math.max(0, parseFloat(dadosDia.total || 0)) : 0; // Garantir que nunca seja negativo
                valores.push(valor);
                quantidades.push(dadosDia ? parseInt(dadosDia.quantidade || 0) : 0);
                
                dataAtual.setDate(dataAtual.getDate() + 1);
            }
        }
        
        // Calcular total do período
        const totalPeriodo = valores.reduce((total, valor) => total + valor, 0);
        const totalVendas = quantidades.reduce((total, qtd) => total + qtd, 0);
        
        console.log(`✅ Dados de receitas carregados - Total: MZN ${totalPeriodo.toFixed(2)}`);
        
        res.json({
            success: true,
            data: {
                periodo: {
                    tipo: periodo,
                    data_inicio: dataInicio,
                    data_fim: dataFim
                },
                grafico: {
                    labels: labels,
                    valores: valores,
                    quantidades: quantidades
                },
                totais: {
                    receita_total: parseFloat(totalPeriodo.toFixed(2)),
                    total_vendas: totalVendas
                },
                ultima_atualizacao: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados de receitas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar dados de receitas',
            error: error.message
        });
    }
});

// ==================== ROTAS DE SAQUES POR MÉTODO ====================

// GET - Total de saques por método (Emola)
router.get('/saques-por-metodo/emola', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando total de saques Emola...');
        
        const totalSaquesEmola = await Pagamento.sum('valor', {
            where: { 
                status: 'pago',
                metodo: 'Emola'
            }
        });
        
        const totalTransferenciasEmola = await TransferenciaB2C.sum('valor', {
            where: { 
                metodo: 'emola',
                status: 'sucesso'
            }
        });
        
        const saldoDisponivel = (totalSaquesEmola || 0) - (totalTransferenciasEmola || 0);
        
        console.log('✅ Total de saques Emola calculado com sucesso');
        
        res.json({
            success: true,
            total: saldoDisponivel,
            total_saques: totalSaquesEmola || 0,
            total_transferencias: totalTransferenciasEmola || 0,
            metodo: 'emola'
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular total de saques Emola:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular total de saques Emola',
            error: error.message
        });
    }
});

// GET - Total de saques por método (M-Pesa)
router.get('/saques-por-metodo/mpesa', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Buscando total de saques M-Pesa...');
        
        const totalSaquesMpesa = await Pagamento.sum('valor', {
            where: { 
                status: 'pago',
                metodo: 'Mpesa'
            }
        });
        
        const totalTransferenciasMpesa = await TransferenciaB2C.sum('valor', {
            where: { 
                metodo: 'mpesa',
                status: 'sucesso'
            }
        });
        
        const saldoDisponivel = (totalSaquesMpesa || 0) - (totalTransferenciasMpesa || 0);
        
        console.log('✅ Total de saques M-Pesa calculado com sucesso');
        
        res.json({
            success: true,
            total: saldoDisponivel,
            total_saques: totalSaquesMpesa || 0,
            total_transferencias: totalTransferenciasMpesa || 0,
            metodo: 'mpesa'
        });
        
    } catch (error) {
        console.error('❌ Erro ao calcular total de saques M-Pesa:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao calcular total de saques M-Pesa',
            error: error.message
        });
    }
});

module.exports = router;

