const express = require('express');
const router = express.Router();
const { Afiliado, VendaAfiliado, LinkTracking, Venda, Produto, BannerAfiliado, sequelize } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { authenticateAfiliado } = require('../middleware/authAfiliado');
const { Op } = require('sequelize');
const afiliadoClickService = require('../services/afiliadoClickService');
const fraudeDetectionService = require('../services/fraudeDetectionService');

// Função para gerar código de afiliado único
function gerarCodigoAfiliado() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
}

// GET - Teste simples
router.get('/teste', async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Rota de teste funcionando',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro interno'
        });
    }
});

// GET - Teste de vendas simples
router.get('/teste-vendas', async (req, res) => {
    try {
        console.log('📊 Teste de vendas chamado!');
        res.json({
            success: true,
            message: 'Rota de teste de vendas funcionando!',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Erro no teste de vendas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET - Meus links (requer autenticação)
router.get('/meus-links', authenticateAfiliado, async (req, res) => {
    try {
        console.log('🔍 Buscando links do afiliado:', req.afiliado.nome);
        
        const afiliadoId = req.afiliado.id;
        
        const { LinkTracking, Produto } = require('../config/database');
        
        const links = await LinkTracking.findAll({
            where: { afiliado_id: afiliadoId },
            include: [{
                model: Produto,
                as: 'produto',
                attributes: ['id', 'nome', 'custom_id', 'preco'],
                required: false
            }],
            order: [['created_at', 'DESC']]
        });
        
        // Calcular estatísticas para cada link
        const linksComStats = await Promise.all(links.map(async (link) => {
            const taxaConversao = link.cliques > 0 ? (link.conversoes / link.cliques * 100).toFixed(2) : '0.00';
            const cliquesPendentes = link.cliques - link.cliques_pagos;
            const creditosPendentes = Math.floor(cliquesPendentes / 10) * 1.00;
            const cliquesParaProximoCredito = 10 - (cliquesPendentes % 10);
            
            return {
                id: link.id,
                link_afiliado: link.link_afiliado,
                link_original: link.link_original,
                produto_id: link.produto_id,
                produto: link.produto ? {
                    id: link.produto.id,
                    nome: link.produto.nome,
                    custom_id: link.produto.custom_id,
                    preco: link.produto.preco
                } : null,
                cliques: link.cliques,
                cliques_pagos: link.cliques_pagos,
                cliques_pendentes: cliquesPendentes,
                creditos_gerados: parseFloat(link.creditos_gerados || 0),
                creditos_pendentes: creditosPendentes,
                cliques_para_proximo_credito: cliquesParaProximoCredito,
                conversoes: link.conversoes,
                taxa_conversao: `${taxaConversao}%`,
                ultimo_clique: link.ultimo_clique,
                created_at: link.created_at
            };
        }));
        
        res.json({
            success: true,
            data: linksComStats,
            total: linksComStats.length
        });
        
    } catch (error) {
        console.error('Erro ao buscar links do afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Listar todos os afiliados (admin)
router.get('/', async (req, res) => {
    try {
        console.log('📋 Carregando lista de afiliados...');
        
        const afiliados = await Afiliado.findAll({
            order: [['data_cadastro', 'DESC']]
        });

        console.log(`✅ Encontrados ${afiliados.length} afiliados`);
        res.json({
            success: true,
            data: afiliados,
            total: afiliados.length
        });
    } catch (error) {
        console.error('❌ Erro ao carregar afiliados:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar afiliados',
            error: error.message
        });
    }
});

// GET - Estatísticas de afiliados (público para teste)
router.get('/estatisticas', async (req, res) => {
    try {
        console.log('📊 Carregando estatísticas de afiliados...');
        
        // Total de afiliados
        const totalAfiliados = await Afiliado.count();
        
        // Afiliados ativos
        const afiliadosAtivos = await Afiliado.count({
            where: { status: 'ativo' }
        });
        
        // Total de vendas via afiliados
        const totalVendas = await VendaAfiliado.count({
            where: { status: 'pago' }
        });
        
        // Total de comissões pagas
        const totalComissoes = await VendaAfiliado.sum('valor_comissao', {
            where: { status: 'pago' }
        }) || 0;
        
        // Comissões pendentes
        const comissoesPendentes = await VendaAfiliado.sum('valor_comissao', {
            where: { status: 'pendente' }
        }) || 0;
        
        // Saldo total disponível para afiliados
        const saldoTotal = await Afiliado.sum('saldo_disponivel') || 0;
        
        // Top 5 afiliados por vendas
        const topAfiliados = await Afiliado.findAll({
            attributes: [
                'id', 'nome', 'codigo_afiliado', 'total_vendas', 
                'total_comissoes', 'saldo_disponivel'
            ],
            order: [['total_vendas', 'DESC']],
            limit: 5
        });

        res.json({
            success: true,
            data: {
                totalAfiliados,
                afiliadosAtivos,
                totalVendas,
                totalComissoes: parseFloat(totalComissoes),
                comissoesPendentes: parseFloat(comissoesPendentes),
                saldoTotal: parseFloat(saldoTotal),
                topAfiliados
            }
        });
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao carregar estatísticas',
            error: error.message
        });
    }
});

// POST - Criar novo afiliado (admin)
router.post('/', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('➕ Criando novo afiliado...');
        
        const { nome, email, telefone, comissao_percentual, link_afiliado } = req.body;
        
        // Validar dados obrigatórios
        if (!nome || !email || !link_afiliado) {
            return res.status(400).json({
                success: false,
                message: 'Nome, email e link de afiliado são obrigatórios'
            });
        }
        
        // Verificar se email já existe
        const afiliadoExistente = await Afiliado.findOne({
            where: { email }
        });
        
        if (afiliadoExistente) {
            return res.status(400).json({
                success: false,
                message: 'Email já está cadastrado'
            });
        }
        
        // Gerar código único
        let codigoAfiliado;
        let tentativas = 0;
        do {
            codigoAfiliado = gerarCodigoAfiliado();
            tentativas++;
        } while (await Afiliado.findOne({ where: { codigo_afiliado } }) && tentativas < 10);
        
        if (tentativas >= 10) {
            return res.status(500).json({
                success: false,
                message: 'Erro ao gerar código único'
            });
        }
        
        // Criar afiliado
        const afiliado = await Afiliado.create({
            nome,
            email,
            telefone: telefone || null,
            codigo_afiliado: codigoAfiliado,
            link_afiliado,
            comissao_percentual: comissao_percentual || 10.00,
            status: 'ativo'
        });
        
        console.log('✅ Afiliado criado:', afiliado.codigo_afiliado);
        res.status(201).json({
            success: true,
            message: 'Afiliado criado com sucesso',
            data: afiliado
        });
    } catch (error) {
        console.error('❌ Erro ao criar afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar afiliado',
            error: error.message
        });
    }
});

// GET - Minhas vendas (requer autenticação)
router.get('/minhas-vendas', authenticateAfiliado, async (req, res) => {
    try {
        console.log('📊 Carregando vendas do afiliado:', req.afiliado.nome);
        
        // Buscar vendas do afiliado autenticado
        const vendas = await VendaAfiliado.findAll({
            where: { afiliado_id: req.afiliado.id },
            order: [['created_at', 'DESC']],
            limit: 100 // Limitar a 100 vendas mais recentes
        });
        
        console.log(`✅ Encontradas ${vendas.length} vendas`);
        
        // Formatar dados para o frontend
        const vendasFormatadas = [];
        for (const vendaAfiliado of vendas) {
            try {
                const venda = await Venda.findByPk(vendaAfiliado.venda_id);
                const produto = venda ? await Produto.findByPk(venda.produto_id) : null;
                
                vendasFormatadas.push({
                    id: vendaAfiliado.id,
                    data_venda: vendaAfiliado.created_at,
                    produto_nome: produto?.nome || 'Produto não encontrado',
                    valor_venda: vendaAfiliado.valor_venda,
                    valor_comissao: vendaAfiliado.valor_comissao,
                    status: vendaAfiliado.status,
                    transaction_id: venda?.transaction_id || 'N/A',
                    link_afiliado: venda?.link_afiliado || 'N/A'
                });
            } catch (vendaError) {
                console.error('❌ Erro ao processar venda:', vendaError);
                // Continuar com a próxima venda
            }
        }
        
        res.json({
            success: true,
            data: vendasFormatadas,
            total: vendasFormatadas.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar vendas do afiliado:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET - Meu saldo (requer autenticação)
router.get('/meu-saldo', authenticateAfiliado, async (req, res) => {
    try {
        console.log('💰 Carregando saldo do afiliado:', req.afiliado.nome);
        
        // Buscar afiliado atualizado com dados de cliques
        const afiliadoAtualizado = await Afiliado.findByPk(req.afiliado.id);
        
        // Obter estatísticas de cliques
        const statsCliques = await afiliadoClickService.obterEstatisticasCliques(req.afiliado.id);
        
        res.json({
            success: true,
            data: {
                saldo_disponivel: parseFloat(afiliadoAtualizado.saldo_disponivel),
                total_comissoes: parseFloat(afiliadoAtualizado.total_comissoes),
                total_vendas: afiliadoAtualizado.total_vendas,
                comissao_percentual: afiliadoAtualizado.comissao_percentual,
                // Estatísticas de cliques
                cliques: {
                    total_cliques: afiliadoAtualizado.total_cliques,
                    cliques_pagos: afiliadoAtualizado.cliques_pagos,
                    cliques_pendentes: statsCliques.cliquesPendentes,
                    creditos_gerados: parseFloat(afiliadoAtualizado.creditos_cliques || 0),
                    creditos_pendentes: statsCliques.creditosPendentes,
                    cliques_para_proximo_credito: statsCliques.cliquesParaProximoCredito,
                    regra: '10 cliques = 1 MZN'
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar saldo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Estatísticas de cliques (requer autenticação)
router.get('/estatisticas-cliques', authenticateAfiliado, async (req, res) => {
    try {
        const stats = await afiliadoClickService.obterEstatisticasCliques(req.afiliado.id);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de cliques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST - Solicitar saque (requer autenticação)
router.post('/solicitar-saque', authenticateAfiliado, async (req, res) => {
    try {
        const { valor, metodo, numero_conta, nome_completo, observacoes } = req.body;
        
        console.log('💰 Processando solicitação de saque para:', req.afiliado.nome);
        
        // Validar dados obrigatórios
        if (!valor || !metodo || !numero_conta || !nome_completo) {
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios',
                errors: {
                    valor: !valor ? 'Valor é obrigatório' : null,
                    metodo: !metodo ? 'Método de pagamento é obrigatório' : null,
                    numero_conta: !numero_conta ? 'Número da conta é obrigatório' : null,
                    nome_completo: !nome_completo ? 'Nome completo é obrigatório' : null
                }
        });
        }

        // Validar valor mínimo
        const valorMinimo = 50.00; // MZN 50 mínimo
        const valorFloat = parseFloat(valor);
        
        if (isNaN(valorFloat) || valorFloat < valorMinimo) {
            return res.status(400).json({
                success: false,
                message: `O valor mínimo para saque é MZN ${valorMinimo.toFixed(2)}`
            });
        }
        
        // Verificar se tem saldo suficiente
        if (valorFloat > parseFloat(req.afiliado.saldo_disponivel)) {
            return res.status(400).json({
                success: false,
                message: 'Saldo insuficiente',
                saldo_disponivel: parseFloat(req.afiliado.saldo_disponivel)
            });
        }
        
        // Validar método de pagamento
        const metodosValidos = ['mpesa', 'emola', 'bank_transfer'];
        if (!metodosValidos.includes(metodo.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Método de pagamento inválido',
                metodos_validos: metodosValidos
            });
        }
        
        // Criar registro de saque
        const saque = {
            afiliado_id: req.afiliado.id,
            valor: valorFloat,
            metodo: metodo.toLowerCase(),
            numero_conta: numero_conta.trim(),
            nome_completo: nome_completo.trim(),
            observacoes: observacoes ? observacoes.trim() : null,
            status: 'pendente',
            data_solicitacao: new Date().toISOString()
        };
        
        console.log('✅ Solicitação de saque criada:', saque);
        
        // TODO: Criar registro na tabela de saques de afiliados quando implementada
        // await SaqueAfiliado.create(saque);
        
        // Enviar notificação de saque pendente
        const { enviarNotificacaoSaqueAfiliado } = require('./pagamento');
        try {
            await enviarNotificacaoSaqueAfiliado(req.afiliado, valorFloat, 'pendente', numero_conta);
        } catch (error) {
            console.error('⚠️ Erro ao enviar notificação de saque (não crítico):', error);
        }
        
        res.json({
            success: true,
            message: 'Solicitação de saque enviada com sucesso. Aguarde aprovação.',
            data: {
                ...saque,
                saldo_restante: parseFloat(req.afiliado.saldo_disponivel) - valorFloat
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao processar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET - Meu histórico de saques (requer autenticação)
router.get('/meus-saques', authenticateAfiliado, async (req, res) => {
    try {
        console.log('📋 Carregando histórico de saques de:', req.afiliado.nome);
        
        // TODO: Buscar saques reais do banco quando a tabela for criada
        // const saques = await SaqueAfiliado.findAll({
        //     where: { afiliado_id: req.afiliado.id },
        //     order: [['data_solicitacao', 'DESC']]
        // });
        
        // Por enquanto, retornar array vazio
        const saques = [];
        
        res.json({
            success: true,
            data: saques,
            total: saques.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar saques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Buscar afiliado por ID (admin)
router.get('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const afiliado = await Afiliado.findByPk(id);
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }
        
        // Buscar vendas do afiliado
        const vendas = await VendaAfiliado.findAll({
            where: { afiliado_id: id },
            include: [{
                model: Venda,
                as: 'venda',
                include: [{
                    model: Produto,
                    as: 'produto'
                }]
            }],
            order: [['created_at', 'DESC']]
        });
        
        // Buscar links de tracking
        const links = await LinkTracking.findAll({
            where: { afiliado_id: id },
            order: [['created_at', 'DESC']]
        });
        
        res.json({
            success: true,
            data: {
                afiliado,
                vendas,
                links
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar afiliado',
            error: error.message
        });
    }
});

// PUT - Atualizar afiliado (admin)
router.put('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, email, telefone, comissao_percentual, status, link_afiliado } = req.body;
        
        const afiliado = await Afiliado.findByPk(id);
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }
        
        // Verificar se email já existe em outro afiliado
        if (email && email !== afiliado.email) {
            const emailExistente = await Afiliado.findOne({
                where: { 
                    email,
                    id: { [Op.ne]: id }
                }
            });
            
            if (emailExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Email já está cadastrado em outro afiliado'
                });
            }
        }
        
        // Atualizar dados
        await afiliado.update({
            nome: nome || afiliado.nome,
            email: email || afiliado.email,
            telefone: telefone !== undefined ? telefone : afiliado.telefone,
            comissao_percentual: comissao_percentual || afiliado.comissao_percentual,
            status: status || afiliado.status,
            link_afiliado: link_afiliado || afiliado.link_afiliado
        });
        
        console.log('✅ Afiliado atualizado:', afiliado.codigo_afiliado);
        res.json({
            success: true,
            message: 'Afiliado atualizado com sucesso',
            data: afiliado
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar afiliado',
            error: error.message
        });
    }
});

// PUT - Toggle status do afiliado (admin)
router.put('/:id/toggle-status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const afiliado = await Afiliado.findByPk(id);
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }
        
        await afiliado.update({ status });
        
        console.log(`✅ Status do afiliado ${afiliado.codigo_afiliado} alterado para: ${status}`);
        res.json({
            success: true,
            message: `Afiliado ${status === 'ativo' ? 'ativado' : 'suspenso'} com sucesso`,
            data: afiliado
        });
    } catch (error) {
        console.error('❌ Erro ao alterar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao alterar status',
            error: error.message
        });
    }
});

// DELETE - Excluir afiliado (admin)
router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const afiliado = await Afiliado.findByPk(id);
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }
        
        // Verificar se há vendas associadas
        const vendasAssociadas = await VendaAfiliado.count({
            where: { afiliado_id: id }
        });
        
        if (vendasAssociadas > 0) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível excluir afiliado com vendas associadas'
            });
        }
        
        // Excluir links de tracking
        await LinkTracking.destroy({
            where: { afiliado_id: id }
        });
        
        // Excluir afiliado
        await afiliado.destroy();
        
        console.log('✅ Afiliado excluído:', afiliado.codigo_afiliado);
        res.json({
            success: true,
            message: 'Afiliado excluído com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao excluir afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao excluir afiliado',
            error: error.message
        });
    }
});

// POST - Gerar link de afiliado (alias para compatibilidade com frontend)
// IMPORTANTE: Esta rota deve vir ANTES de /:id/gerar-link para evitar conflitos
router.post('/gerar-link', authenticateAfiliado, async (req, res) => {
    try {
        console.log('🔗 Rota /gerar-link chamada');
        console.log('📋 Body recebido:', req.body);
        console.log('👤 Afiliado autenticado:', req.afiliado?.nome);
        
        const { produto_id, produto_nome, preco } = req.body;
        
        if (!produto_id) {
            return res.status(400).json({
                success: false,
                message: 'ID do produto é obrigatório'
            });
        }
        
        // Buscar produto
        const produto = await Produto.findByPk(produto_id);
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Verificar se já existe link para este produto e afiliado (garantir um link por produto)
        let linkTracking = await LinkTracking.findOne({
            where: {
                afiliado_id: req.afiliado.id,
                produto_id: produto_id
            }
        });
        
        if (linkTracking) {
            // Link já existe, retornar o existente
            return res.json({
                success: true,
                message: 'Link já existe para este produto',
                link_afiliado: linkTracking.link_afiliado,
                codigo_link: req.afiliado.codigo_afiliado,
                produto_id: linkTracking.produto_id,
                produto_custom_id: produto.custom_id,
                produto_nome: produto_nome || produto.nome,
                preco: preco || produto.preco,
                link_id: linkTracking.id,
                cliques: linkTracking.cliques,
                cliques_pagos: linkTracking.cliques_pagos,
                creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0)
            });
        }
        
        // Gerar link de afiliado usando o código do afiliado
        const linkOriginal = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?produto=${produto.custom_id}`;
        const linkAfiliado = `${linkOriginal}&ref=${req.afiliado.codigo_afiliado}`;
        
        // Criar novo link (garantindo um link por produto)
        linkTracking = await LinkTracking.create({
            afiliado_id: req.afiliado.id,
            produto_id: produto_id,
            link_original: linkOriginal,
            link_afiliado: linkAfiliado,
            cliques: 0,
            cliques_pagos: 0,
            creditos_gerados: 0.00,
            conversoes: 0
        });
        
        console.log(`✅ Link criado para afiliado ${req.afiliado.nome} e produto ${produto.nome}`);
        
        res.json({
            success: true,
            link_afiliado: linkTracking.link_afiliado,
            codigo_link: req.afiliado.codigo_afiliado,
            produto_id: linkTracking.produto_id,
            produto_custom_id: produto.custom_id,
            produto_nome: produto_nome || produto.nome,
            preco: preco || produto.preco,
            link_id: linkTracking.id,
            cliques: linkTracking.cliques,
            cliques_pagos: linkTracking.cliques_pagos,
            creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0)
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar link de afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});
            
// POST - Gerar link de afiliado para produto (requer autenticação)
router.post('/gerar-link-produto', authenticateAfiliado, async (req, res) => {
    try {
        const { produto_id } = req.body;
        
        if (!produto_id) {
            return res.status(400).json({
                success: false,
                message: 'ID do produto é obrigatório'
            });
        }
        
        // Buscar produto
        const produto = await Produto.findByPk(produto_id);
        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }
        
        // Verificar se já existe link para este produto e afiliado (garantir um link por produto)
        let linkTracking = await LinkTracking.findOne({
            where: {
                afiliado_id: req.afiliado.id,
                produto_id: produto_id
            }
            });
            
        if (linkTracking) {
            // Link já existe, retornar o existente
            return res.json({
                success: true,
                message: 'Link já existe para este produto',
                data: {
                    id: linkTracking.id,
                    link_afiliado: linkTracking.link_afiliado,
                    link_original: linkTracking.link_original,
                    produto_id: linkTracking.produto_id,
                    cliques: linkTracking.cliques,
                    cliques_pagos: linkTracking.cliques_pagos,
                    creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0),
                    created_at: linkTracking.created_at
                }
            });
        }
        
        // Gerar link de afiliado usando o código do afiliado
        const linkOriginal = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?produto=${produto.custom_id}`;
        const linkAfiliado = `${linkOriginal}&ref=${req.afiliado.codigo_afiliado}`;
        
        // Criar novo link (garantindo um link por produto)
        linkTracking = await LinkTracking.create({
            afiliado_id: req.afiliado.id,
            produto_id: produto_id,
            link_original: linkOriginal,
            link_afiliado: linkAfiliado,
            cliques: 0,
            cliques_pagos: 0,
            creditos_gerados: 0.00,
            conversoes: 0
        });
        
        console.log(`✅ Link criado para afiliado ${req.afiliado.nome} e produto ${produto.nome}`);
        
        res.json({
            success: true,
            message: 'Link gerado com sucesso',
            data: {
                id: linkTracking.id,
                link_afiliado: linkTracking.link_afiliado,
                link_original: linkTracking.link_original,
                produto_id: linkTracking.produto_id,
                produto: {
                    id: produto.id,
                    nome: produto.nome,
                    custom_id: produto.custom_id,
                    preco: produto.preco
                },
                cliques: linkTracking.cliques,
                cliques_pagos: linkTracking.cliques_pagos,
                creditos_gerados: parseFloat(linkTracking.creditos_gerados || 0),
                created_at: linkTracking.created_at
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao gerar link de afiliado:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST - Gerar link de afiliado (admin)
router.post('/:id/gerar-link', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { link_original, produto_id } = req.body;
        
        const afiliado = await Afiliado.findByPk(id);
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado'
            });
        }
        
        // Verificar se já existe link para este produto e afiliado (garantir um link por produto)
        if (produto_id) {
            const linkExistente = await LinkTracking.findOne({
                where: {
                    afiliado_id: id,
                    produto_id: produto_id
                }
            });
            
            if (linkExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Já existe um link para este produto e afiliado. Cada afiliado pode ter apenas um link por produto.'
                });
            }
        }
        
        // Gerar link de afiliado
        const linkAfiliado = `${link_original}?ref=${afiliado.codigo_afiliado}`;
        
        // Criar tracking
        const linkTracking = await LinkTracking.create({
                afiliado_id: id,
            produto_id: produto_id || null,
                link_original: link_original,
                link_afiliado: linkAfiliado,
                cliques: 0,
            cliques_pagos: 0,
            creditos_gerados: 0.00,
                conversoes: 0
            });
        
        console.log('✅ Link de afiliado gerado:', linkAfiliado);
        res.json({
            success: true,
            message: 'Link de afiliado gerado com sucesso',
            data: {
                link_original: link_original,
                link_afiliado: linkAfiliado,
                codigo_afiliado: afiliado.codigo_afiliado,
                tracking_id: linkTracking.id
            }
        });
    } catch (error) {
        console.error('❌ Erro ao gerar link:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar link de afiliado',
            error: error.message
        });
    }
});

// GET - Rastrear clique no link de afiliado (DESABILITADO - cliques agora são rastreados apenas no botão "Pagar Agora")
// Esta rota foi desabilitada para evitar contagem duplicada de cliques
// Os cliques agora são rastreados apenas quando o cliente clica em "Pagar Agora" no checkout
router.get('/track/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params; // Usar req.params para parâmetros de rota
        const { produto, url } = req.query;
        
        // Apenas redirecionar para o checkout sem rastrear clique
        // O clique será rastreado apenas quando o cliente clicar em "Pagar Agora"
        const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000';
        let linkCheckout = `${baseUrl}/checkout.html`;
        
        // Adicionar parâmetros se existirem
        const params = new URLSearchParams();
        if (produto) params.append('produto', produto);
        if (codigo) params.append('ref', codigo);
        if (params.toString()) {
            linkCheckout += `?${params.toString()}`;
        }
        
        console.log(`🔗 Redirecionando para checkout com código de afiliado: ${codigo} (clique será rastreado apenas no botão "Pagar Agora")`);
        
        return res.redirect(linkCheckout);
    } catch (error) {
        console.error('❌ Erro ao redirecionar:', error);
        // Em caso de erro, redirecionar para checkout sem referência
        const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000';
        const linkCheckout = `${baseUrl}/checkout.html${req.query.produto ? `?produto=${req.query.produto}` : ''}`;
        return res.redirect(linkCheckout);
    }
});

// POST - Registrar venda via afiliado
router.post('/venda', async (req, res) => {
    try {
        const { codigo_afiliado, venda_id, valor_venda } = req.body;
        
        // Buscar afiliado
        const afiliado = await Afiliado.findOne({
            where: { 
                codigo_afiliado,
                status: 'ativo'
            }
        });
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Código de afiliado inválido'
            });
        }
        
        // Calcular comissão
        const valorComissao = (valor_venda * afiliado.comissao_percentual) / 100;
        
        // Criar registro de venda do afiliado
        const vendaAfiliado = await VendaAfiliado.create({
            afiliado_id: afiliado.id,
            venda_id: venda_id,
            valor_venda: valor_venda,
            comissao_percentual: afiliado.comissao_percentual,
            valor_comissao: valorComissao,
            status: 'pendente'
        });
        
        // Atualizar estatísticas do afiliado
        await afiliado.increment('total_vendas');
        await afiliado.increment('total_comissoes', { by: valorComissao });
        await afiliado.increment('saldo_disponivel', { by: valorComissao });
        
        // Atualizar conversões nos links de tracking
        await LinkTracking.increment('conversoes', {
            where: { afiliado_id: afiliado.id }
        });
        
        console.log(`✅ Venda registrada para afiliado ${codigo_afiliado}: MZN ${valorComissao.toFixed(2)}`);
        res.json({
            success: true,
            message: 'Venda registrada com sucesso',
            data: {
                venda_afiliado_id: vendaAfiliado.id,
                valor_comissao: valorComissao,
                afiliado: {
                    nome: afiliado.nome,
                    codigo: afiliado.codigo_afiliado
                }
            }
        });
    } catch (error) {
        console.error('❌ Erro ao registrar venda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar venda',
            error: error.message
        });
    }
});

// NOTA: Login e registro foram movidos para /api/afiliados/auth/login e /api/afiliados/auth/register
// Esta rota foi removida para evitar duplicação

// PUT - Atualizar status da venda
router.put('/vendas/atualizar-status', async (req, res) => {
    try {
        const { transaction_id, status } = req.body;
        
        console.log('🔄 Atualizando status da venda:', { transaction_id, status });
        
        // Buscar venda pelo transaction_id
        const venda = await Venda.findOne({
            where: { transaction_id }
        });
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar venda do afiliado
        const vendaAfiliado = await VendaAfiliado.findOne({
            where: { venda_id: venda.id }
        });
        
        if (!vendaAfiliado) {
            return res.status(404).json({
                success: false,
                message: 'Venda de afiliado não encontrada'
            });
        }
        
        // Atualizar status
        await vendaAfiliado.update({ status });
        
        // Se a venda foi aprovada, creditar comissão no saldo do afiliado
        if (status === 'pago') {
            const afiliado = await Afiliado.findByPk(vendaAfiliado.afiliado_id);
            if (afiliado) {
                await afiliado.increment('saldo_disponivel', { by: vendaAfiliado.valor_comissao });
                console.log('✅ Comissão creditada no saldo do afiliado:', vendaAfiliado.valor_comissao);
            }
        }
        
        console.log('✅ Status da venda atualizado para:', status);
        res.json({
            success: true,
            message: 'Status da venda atualizado com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status da venda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST - Registrar clique válido (quando usuário clica em "Pagar Agora" no checkout)
router.post('/registrar-clique-valido', async (req, res) => {
    try {
        const { 
            codigo_afiliado, 
            produto_id, 
            produto_custom_id,
            ip_address: ipAddressClient,
            fingerprint: fingerprintClient,
            screen_info,
            timezone,
            language
        } = req.body;
        
        // Obter informações do cliente (priorizar IP do cliente, depois do servidor)
        const ipAddress = ipAddressClient || 
                         req.ip || 
                         req.connection.remoteAddress || 
                         req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                         req.headers['x-real-ip'] ||
                         'unknown';
        
        const userAgent = req.headers['user-agent'] || 'unknown';
        const referer = req.headers.referer || req.headers.referrer || req.body.referer || null;

        // Validar dados obrigatórios
        if (!codigo_afiliado) {
            return res.status(400).json({
                success: false,
                message: 'Código de afiliado é obrigatório'
            });
        }
        
        // Buscar afiliado
        const afiliado = await Afiliado.findOne({
            where: { 
                codigo_afiliado: codigo_afiliado,
                status: 'ativo'
            }
        });
        
        if (!afiliado) {
            return res.status(404).json({
                success: false,
                message: 'Afiliado não encontrado ou inativo'
            });
        }
        
        // Buscar produto se produto_id ou produto_custom_id fornecido
        let produto = null;
        if (produto_id) {
            produto = await Produto.findByPk(produto_id);
        } else if (produto_custom_id) {
            produto = await Produto.findOne({ where: { custom_id: produto_custom_id } });
        }

        // Buscar link tracking
        let linkTracking = null;
        if (produto) {
            linkTracking = await LinkTracking.findOne({
                where: {
                    afiliado_id: afiliado.id,
                    produto_id: produto.id
                }
            });
        }

        // Se não encontrou link tracking, criar um básico
        if (!linkTracking && produto) {
            const linkOriginal = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?produto=${produto.custom_id}`;
            const linkAfiliado = `${linkOriginal}&ref=${afiliado.codigo_afiliado}`;
            
            linkTracking = await LinkTracking.create({
                afiliado_id: afiliado.id,
                produto_id: produto.id,
                link_original: linkOriginal,
                link_afiliado: linkAfiliado,
                cliques: 0,
                cliques_pagos: 0,
                creditos_gerados: 0.00,
                conversoes: 0
            });
        }
        
        // Validar clique contra fraudes (com dados adicionais)
        const validacao = await fraudeDetectionService.validarClique({
            ipAddress,
            userAgent,
            afiliadoId: afiliado.id,
            produtoId: produto?.id || null,
            referer,
            fingerprint: fingerprintClient,
            screen_info: screen_info,
            timezone: timezone,
            language: language
        });

        // Preparar dados de fraude
        const dadosFraude = {
            ipAddress,
            userAgent,
            navegador: validacao.navegador,
            sistema: validacao.sistema,
            dispositivo: validacao.dispositivo,
            fingerprint: validacao.fingerprint,
            valido: validacao.valido,
            motivoRejeicao: validacao.motivo || null,
            referer,
            sessionId: req.sessionID || null
        };

        // Processar clique válido
        if (linkTracking) {
            const resultado = await afiliadoClickService.processarCliqueValido(
                linkTracking.id,
                afiliado.id,
                produto?.id || null,
                dadosFraude
            );

            return res.json({
            success: true,
                cliqueRegistrado: true,
                valido: resultado.valido,
                creditosGerados: resultado.creditosGerados || false,
                valorCredito: resultado.valorCredito || 0,
                cliquesRestantes: resultado.cliquesRestantes || 0,
                cliquesAtuais: resultado.cliquesAtuais || 0,
                motivo: resultado.motivo || null
            });
        } else {
            // Se não há link tracking, apenas registrar o clique válido sem processar créditos
            const { CliqueValidoAfiliado } = require('../config/database');
            await CliqueValidoAfiliado.create({
                afiliado_id: afiliado.id,
                link_tracking_id: null,
                produto_id: produto?.id || null,
                ip_address: ipAddress,
                user_agent: userAgent,
                navegador: validacao.navegador,
                sistema_operacional: validacao.sistema,
                dispositivo: validacao.dispositivo,
                fingerprint: validacao.fingerprint,
                valido: validacao.valido,
                motivo_rejeicao: validacao.motivo || null,
                referer,
                session_id: req.sessionID || null
            });

            return res.json({
                success: true,
                cliqueRegistrado: true,
                valido: validacao.valido,
                creditosGerados: false,
                motivo: validacao.motivo || null,
                message: validacao.valido ? 'Clique registrado, mas link tracking não encontrado' : 'Clique inválido'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao registrar clique válido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// PUT - Atualizar status da venda de afiliado
router.put('/venda/:vendaId/status', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { vendaId } = req.params;
        const { status } = req.body;
        
        if (!['pendente', 'pago', 'cancelado'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status inválido. Use: pendente, pago ou cancelado'
            });
        }
        
        const resultado = await afiliadoVendaService.atualizarStatusVenda(vendaId, status);
        
        if (!resultado.atualizado) {
            return res.status(404).json({
                success: false,
                message: resultado.motivo
            });
        }
        
        res.json({
            success: true,
            message: 'Status da venda atualizado com sucesso',
            data: resultado
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status da venda:', error);
        res.status(500).json({
                success: false,
            message: 'Erro interno do servidor',
            error: error.message
            });
        }
});

// GET - Estatísticas de vendas do afiliado (requer autenticação)
router.get('/minhas-vendas-estatisticas', authenticateAfiliado, async (req, res) => {
    try {
        console.log(`📊 [ESTATISTICAS] Carregando estatísticas de vendas para afiliado: ${req.afiliado.nome} (${req.afiliado.id})`);
        const { periodo = '30d' } = req.query;
        
        const stats = await afiliadoVendaService.obterEstatisticasVendas(req.afiliado.id, periodo);
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de vendas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// ==================== ROTAS DE BANNERS ====================

// GET - Listar banners do afiliado
router.get('/banners', authenticateAfiliado, async (req, res) => {
    try {
        const banners = await BannerAfiliado.findAll({
            where: {
                afiliado_id: req.afiliado.id
            },
            include: [
                {
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'nome', 'custom_id', 'imagem_url']
                },
                {
                    model: LinkTracking,
                    as: 'linkTracking',
                    attributes: ['id', 'link_afiliado', 'cliques', 'conversoes']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        res.json({
            success: true,
            data: banners
        });
    } catch (error) {
        console.error('❌ Erro ao listar banners:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar banners',
            error: error.message
        });
    }
});

// POST - Criar banner
router.post('/banners', authenticateAfiliado, async (req, res) => {
    try {
        const { titulo, mensagem, imagem_url, link_tracking_id, produto_id } = req.body;

        if (!titulo || !imagem_url) {
            return res.status(400).json({
                success: false,
                message: 'Título e imagem são obrigatórios'
            });
        }

        // Buscar link tracking se fornecido
        let linkTracking = null;
        let linkAfiliado = null;
        
        if (link_tracking_id) {
            linkTracking = await LinkTracking.findOne({
                where: {
                    id: link_tracking_id,
                    afiliado_id: req.afiliado.id
                }
            });
            
            if (!linkTracking) {
                return res.status(404).json({
                    success: false,
                    message: 'Link de tracking não encontrado'
                });
            }
            
            linkAfiliado = linkTracking.link_afiliado;
        } else if (produto_id) {
            // Buscar link tracking do produto
            linkTracking = await LinkTracking.findOne({
                where: {
                    produto_id: produto_id,
                    afiliado_id: req.afiliado.id
                }
            });
            
            if (linkTracking) {
                linkAfiliado = linkTracking.link_afiliado;
            } else {
                // Gerar link básico se não existir
                const produto = await Produto.findByPk(produto_id);
                if (produto) {
                    const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000';
                    linkAfiliado = `${baseUrl}/checkout.html?produto=${produto.custom_id}&ref=${req.afiliado.codigo_afiliado}`;
                }
            }
        } else {
            // Gerar link genérico
            const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000';
            linkAfiliado = `${baseUrl}/checkout.html?ref=${req.afiliado.codigo_afiliado}`;
        }

        if (!linkAfiliado) {
            return res.status(400).json({
                success: false,
                message: 'Não foi possível gerar link de afiliado'
            });
        }

        // Gerar código HTML do banner
        const codigoHtml = `
<a href="${linkAfiliado}" target="_blank" style="display: inline-block; text-decoration: none;">
    <div style="border: 2px solid #F64C00; border-radius: 12px; overflow: hidden; max-width: 100%; background: white;">
        <img src="${imagem_url}" alt="${titulo}" style="width: 100%; height: auto; display: block;">
        ${mensagem ? `<div style="padding: 15px; background: linear-gradient(135deg, #F64C00 0%, #E04500 100%); color: white; text-align: center; font-weight: bold;">
            ${mensagem}
        </div>` : ''}
    </div>
</a>`;

        // Criar banner
        const banner = await BannerAfiliado.create({
            afiliado_id: req.afiliado.id,
            link_tracking_id: linkTracking?.id || null,
            produto_id: produto_id || null,
            titulo: titulo,
            mensagem: mensagem || null,
            imagem_url: imagem_url,
            link_afiliado: linkAfiliado,
            codigo_html: codigoHtml,
            ativo: true,
            cliques: 0
        });

        // Recarregar com relacionamentos
        await banner.reload({
            include: [
                {
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'nome', 'custom_id', 'imagem_url']
                },
                {
                    model: LinkTracking,
                    as: 'linkTracking',
                    attributes: ['id', 'link_afiliado', 'cliques', 'conversoes']
                }
            ]
        });

        res.json({
            success: true,
            message: 'Banner criado com sucesso',
            data: banner
        });
    } catch (error) {
        console.error('❌ Erro ao criar banner:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar banner',
            error: error.message
        });
    }
});

// PUT - Atualizar banner
router.put('/banners/:id', authenticateAfiliado, async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, mensagem, imagem_url, ativo } = req.body;

        const banner = await BannerAfiliado.findOne({
            where: {
                id: id,
                afiliado_id: req.afiliado.id
            }
        });

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner não encontrado'
            });
        }

        // Atualizar campos
        if (titulo !== undefined) banner.titulo = titulo;
        if (mensagem !== undefined) banner.mensagem = mensagem;
        if (imagem_url !== undefined) banner.imagem_url = imagem_url;
        if (ativo !== undefined) banner.ativo = ativo;

        // Regenerar código HTML se necessário
        if (titulo || mensagem || imagem_url) {
            const codigoHtml = `
<a href="${banner.link_afiliado}" target="_blank" style="display: inline-block; text-decoration: none;">
    <div style="border: 2px solid #F64C00; border-radius: 12px; overflow: hidden; max-width: 100%; background: white;">
        <img src="${banner.imagem_url}" alt="${banner.titulo}" style="width: 100%; height: auto; display: block;">
        ${banner.mensagem ? `<div style="padding: 15px; background: linear-gradient(135deg, #F64C00 0%, #E04500 100%); color: white; text-align: center; font-weight: bold;">
            ${banner.mensagem}
        </div>` : ''}
    </div>
</a>`;
            banner.codigo_html = codigoHtml;
        }

        await banner.save();

        // Recarregar com relacionamentos
        await banner.reload({
            include: [
                {
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'nome', 'custom_id', 'imagem_url']
                },
                {
                    model: LinkTracking,
                    as: 'linkTracking',
                    attributes: ['id', 'link_afiliado', 'cliques', 'conversoes']
                }
            ]
        });

        res.json({
            success: true,
            message: 'Banner atualizado com sucesso',
            data: banner
        });
    } catch (error) {
        console.error('❌ Erro ao atualizar banner:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar banner',
            error: error.message
        });
    }
});

// DELETE - Deletar banner
router.delete('/banners/:id', authenticateAfiliado, async (req, res) => {
    try {
        const { id } = req.params;

        const banner = await BannerAfiliado.findOne({
            where: {
                id: id,
                afiliado_id: req.afiliado.id
            }
        });

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner não encontrado'
            });
        }

        await banner.destroy();

        res.json({
            success: true,
            message: 'Banner deletado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao deletar banner:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar banner',
            error: error.message
        });
    }
});

// POST - Upload de imagem para banner
router.post('/banners/upload-imagem', authenticateAfiliado, async (req, res) => {
    try {
        const multer = require('multer');
        const path = require('path');
        const fs = require('fs');
        const LocalImageService = require('../services/localImageService');

        // Configurar multer
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const baseDir = LocalImageService.ensureUploadsDir();
                const dest = path.join(baseDir, 'banners');
                fs.mkdirSync(dest, { recursive: true });
                cb(null, dest);
            },
            filename: (req, file, cb) => {
                const timestamp = Date.now();
                const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
                cb(null, `banner_${req.afiliado.id}_${timestamp}_${safeName}`);
            }
        });

        const upload = multer({
            storage,
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            fileFilter: (req, file, cb) => {
                const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (allowed.includes(file.mimetype)) return cb(null, true);
                cb(new Error('Tipo de arquivo não suportado. Use: JPEG, PNG, GIF ou WebP'));
            }
        });

        // Processar upload
        upload.single('imagem')(req, res, (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    message: err.message
                });
            }

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhuma imagem fornecida'
                });
            }

            try {
                const uploadsDir = LocalImageService.getUploadsDir();
                const relativePath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
                const publicUrl = LocalImageService.buildPublicUrl(relativePath);

                res.json({
                    success: true,
                    url: publicUrl,
                    path: relativePath
                });
            } catch (error) {
                console.error('Erro ao processar upload:', error);
                res.status(500).json({
                    success: false,
                    message: 'Erro ao processar upload da imagem'
                });
            }
        });
    } catch (error) {
        console.error('❌ Erro no upload de imagem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer upload da imagem',
            error: error.message
        });
    }
});

module.exports = router;
