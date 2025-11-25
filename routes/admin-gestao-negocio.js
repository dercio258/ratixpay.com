const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { databaseManager, Venda, Usuario, Produto, Pagamento, EstatisticasVendedor } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// Rate limiting específico para aprovação de transações
const aprovacaoRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 solicitações de OTP por admin em 15 minutos
    message: {
        success: false,
        error: 'Muitas solicitações de aprovação. Tente novamente em 15 minutos.',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Usar admin ID + IP para identificar unicamente
        return `aprovacao_${req.user?.id || req.ip}_${req.ip}`;
    },
    skip: (req) => {
        // Não aplicar rate limit em desenvolvimento
        return process.env.NODE_ENV === 'development';
    }
});

// Rate limiting para confirmação de OTP (proteção contra brute force)
const confirmacaoOTPRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 tentativas de confirmação por admin em 15 minutos
    message: {
        success: false,
        error: 'Muitas tentativas de confirmação. Tente novamente em 15 minutos.',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return `confirmacao_otp_${req.user?.id || req.ip}_${req.ip}`;
    },
    skip: (req) => {
        return process.env.NODE_ENV === 'development';
    }
});

// Rota principal de gestão de negócio
router.get('/gestao-negocio', authenticateToken, isAdmin, async (req, res) => {
    try {
        // Buscar estatísticas gerais
        const estatisticas = await getEstatisticasGerais();
        
        // Buscar transações recentes
        const transacoes = await getTransacoesRecentes();
        
        res.json({
            success: true,
            data: {
                estatisticas,
                transacoes
            }
        });
    } catch (error) {
        console.error('Erro ao buscar dados de gestão de negócio:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Rota para estatísticas detalhadas
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const estatisticas = await getEstatisticasGerais();
        res.json({
            success: true,
            data: estatisticas
        });
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Rota para vendas
router.get('/vendas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, dataInicio, dataFim } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        
        if (status) {
            whereClause.status = status;
        }
        
        if (dataInicio && dataFim) {
            whereClause.created_at = {
                [Op.between]: [new Date(dataInicio), new Date(dataFim)]
            };
        }
        
        const vendas = await Venda.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Usuario,
                    as: 'vendedorProduto',
                    attributes: ['id', 'nome_completo', 'email']
                },
                {
                    model: Produto,
                    attributes: ['id', 'public_id', 'custom_id', 'nome', 'preco']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: {
                vendas: vendas.rows,
                total: vendas.count,
                page: parseInt(page),
                totalPages: Math.ceil(vendas.count / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar vendas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Rota para vendedores
router.get('/vendedores', authenticateToken, isAdmin, async (req, res) => {
    try {
        const vendedores = await Usuario.findAll({
            where: {
                role: 'user',
                ativo: true
            },
            include: [
                {
                    model: EstatisticasVendedor,
                    as: 'estatisticas'
                }
            ],
            attributes: ['id', 'nome_completo', 'email', 'telefone', 'status', 'ultimo_login']
        });
        
        res.json({
            success: true,
            data: vendedores
        });
    } catch (error) {
        console.error('Erro ao buscar vendedores:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Rota para produtos
router.get('/produtos', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, ativo } = req.query;
        const offset = (page - 1) * limit;
        
        const whereClause = {};
        if (ativo !== undefined) {
            whereClause.ativo = ativo === 'true';
        }
        
        const produtos = await Produto.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Usuario,
                    as: 'vendedorProduto',
                    attributes: ['id', 'nome_completo']
                }
            ],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: {
                produtos: produtos.rows,
                total: produtos.count,
                page: parseInt(page),
                totalPages: Math.ceil(produtos.count / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// Função para buscar estatísticas gerais
async function getEstatisticasGerais() {
    try {
        console.log('🔄 Calculando estatísticas gerais...');
        
        // Total de vendas
        const totalVendas = await Venda.count();
        console.log('📊 Total de vendas:', totalVendas);
        
        // Status que indicam aprovação (incluindo APROVADO)
        const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
        
        // Vendas aprovadas
        const vendasAprovadas = await Venda.count({
            where: { 
                status: {
                    [Op.in]: statusAprovados
                }
            }
        });
        console.log('✅ Vendas aprovadas:', vendasAprovadas);
        
        // Receita total (soma de todas as vendas aprovadas)
        const receitaTotal = await Venda.sum('valor', {
            where: { 
                status: {
                    [Op.in]: statusAprovados
                }
            }
        });
        console.log('💰 Receita total:', receitaTotal);
        
        // Vendedores ativos
        const vendedoresAtivos = await Usuario.count({
            where: {
                role: 'user',
                ativo: true
            }
        });
        console.log('👥 Vendedores ativos:', vendedoresAtivos);
        
        // Produtos ativos
        const produtosAtivos = await Produto.count({
            where: { ativo: true }
        });
        console.log('📦 Produtos ativos:', produtosAtivos);
        
        // Média de venda (baseada em vendas aprovadas)
        const mediaVenda = vendasAprovadas > 0 ? (receitaTotal || 0) / vendasAprovadas : 0;
        console.log('📈 Média por venda:', mediaVenda);
        
        const estatisticas = {
            receitaTotal: parseFloat(receitaTotal || 0),
            totalTransacoes: totalVendas,
            vendasAprovadas,
            vendedoresAtivos,
            produtosAtivos,
            mediaVenda: parseFloat(mediaVenda.toFixed(2))
        };
        
        console.log('📋 Estatísticas calculadas:', estatisticas);
        return estatisticas;
        
    } catch (error) {
        console.error('❌ Erro ao calcular estatísticas:', error);
        return {
            receitaTotal: 0,
            totalTransacoes: 0,
            vendasAprovadas: 0,
            vendedoresAtivos: 0,
            produtosAtivos: 0,
            mediaVenda: 0
        };
    }
}

// Função para buscar transações recentes (PayMoz)
async function getTransacoesRecentes() {
    try {
        const vendas = await Venda.findAll({
            include: [
                {
                    model: Usuario,
                    as: 'vendedorVenda',
                    attributes: ['id', 'nome_completo', 'telefone']
                },
                {
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'public_id', 'custom_id', 'nome']
                }
            ],
            order: [['created_at', 'DESC']]
        });
        
        return vendas.map(venda => ({
            id: venda.id,
            vendedor_id: venda.vendedor_id,
            vendedor_nome: venda.vendedorVenda?.nome_completo || 'N/A',
            vendedor_telefone: venda.vendedorVenda?.telefone || 'N/A',
            produto_nome: venda.produto?.nome || 'N/A',
            valor: parseFloat(venda.valor || 0),
            transacao_id: venda.referencia_pagamento || venda.id_pedido || `TXN${String(venda.id).padStart(6, '0')}`,
            data_hora: venda.created_at,
            status: venda.status,
            cliente_nome: venda.cliente_nome,
            cliente_email: venda.cliente_email,
            cliente_telefone: venda.cliente_telefone,
            cliente_whatsapp: venda.cliente_whatsapp,
            metodo_pagamento: venda.metodo_pagamento || 'N/A'
        }));
    } catch (error) {
        console.error('Erro ao buscar transações recentes:', error);
        return [];
    }
}

// Rota para buscar transações PayMoz (sem limite - todas as transações)
router.post('/paymoz/transacoes', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Requisição para buscar todas as transações PayMoz recebida');
        
        // Buscar TODAS as vendas do banco de dados (sem limite de paginação)
        const { count, rows } = await Venda.findAndCountAll({
            include: [
                {
                    model: Usuario,
                    as: 'vendedorVenda',
                    attributes: ['id', 'nome_completo', 'telefone']
                },
                {
                    model: Produto,
                    as: 'produto',
                    attributes: ['id', 'public_id', 'custom_id', 'nome']
                }
            ],
            order: [['created_at', 'DESC']]
            // Sem limit e offset - carregar todas as transações
        });
        
        console.log(`📊 Total de transações encontradas: ${count}`);
        
        // Formatar transações para o formato esperado pelo frontend
        const transacoes = rows.map(venda => {
            // Função para formatar transaction_id do PayMoz como TXP_{8 últimos números}
            const formatarTransactionIdPayMoz = (transactionId) => {
                if (!transactionId || transactionId === 'N/A') return transactionId;
                const txStr = String(transactionId);
                
                // Extrair apenas números da transaction_id
                const numeros = txStr.replace(/\D/g, '');
                
                // Pegar os últimos 8 números
                const ultimos8Numeros = numeros.length > 8 ? numeros.slice(-8) : numeros;
                
                // Se não houver números suficientes, usar o que tiver (preencher com zeros à esquerda se necessário)
                const numerosFormatados = ultimos8Numeros.padStart(Math.min(8, numeros.length), '0');
                
                // Adicionar prefixo TXP_
                return `TXP_${numerosFormatados}`;
            };
            
            const transactionId = venda.referencia_pagamento || venda.id_pedido || `TXN${String(venda.id).padStart(6, '0')}`;
            
            return {
                id: venda.id,
                trans_id: transactionId,
                transaction_id: formatarTransactionIdPayMoz(transactionId),
                produto_custom_id: venda.produto?.custom_id || 'N/A',
                produto_public_id: venda.produto?.public_id || 'N/A',
                produto_nome: venda.produto?.nome || 'N/A',
                amount: parseFloat(venda.valor || 0),
                cliente_telefone: venda.cliente_telefone || 'N/A',
                cliente_nome: venda.cliente_nome || 'N/A',
                created_at: venda.created_at,
                data_pagamento: venda.data_pagamento || null,
                status: (venda.status === 'Aprovada' || venda.status === 'Aprovado' || venda.status === 'APROVADO' || venda.status === 'aprovado' || venda.status === 'aprovada' || venda.status === 'APROVADA' || venda.status === 'Pago' || venda.status === 'pago' || venda.status === 'PAGO' || venda.status === 'approved' || venda.status === 'paid') ? 'Success' : 
                       (venda.status === 'Cancelada' || venda.status === 'cancelada' || venda.status === 'CANCELADA') ? 'Error' : 
                       (venda.status === 'Pendente' || venda.status === 'pendente' || venda.status === 'PENDENTE') ? 'Pending' : venda.status,
                metodo_pagamento: venda.metodo_pagamento || 'N/A',
                vendedor_nome: venda.vendedorVenda?.nome_completo || 'N/A'
            };
        });
        
        console.log(`✅ Transações PayMoz encontradas: ${transacoes.length} de ${count} total`);
        
        res.json({
            success: true,
            data: {
                data: transacoes,
                total: count,
                loaded: transacoes.length
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar transações PayMoz:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao buscar transações PayMoz',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ========== ROTAS DE APROVAÇÃO MANUAL DE TRANSAÇÕES ==========

const aprovacaoTransacaoService = require('../services/aprovacaoTransacaoService');

/**
 * POST /api/admin/transacoes/:id/solicitar-aprovacao
 * Solicita aprovação de transação cancelada (gera OTP e envia email)
 */
router.post('/transacoes/:id/solicitar-aprovacao', authenticateToken, isAdmin, aprovacaoRateLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const adminId = req.user.id;

        console.log(`🔐 Solicitação de aprovação para transação ${id} pelo admin ${adminId}`);

        const resultado = await aprovacaoTransacaoService.solicitarAprovacao(id, adminId);

        res.json({
            success: true,
            ...resultado
        });
    } catch (error) {
        console.error('❌ Erro ao solicitar aprovação:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao solicitar aprovação',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/transacoes/:id/confirmar-aprovacao
 * Confirma aprovação de transação com OTP
 */
router.post('/transacoes/:id/confirmar-aprovacao', authenticateToken, isAdmin, confirmacaoOTPRateLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;
        const adminId = req.user.id;
        const ip = req.ip || req.connection.remoteAddress;

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'Código OTP é obrigatório'
            });
        }

        // Validação básica do formato do OTP
        if (!/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Código OTP inválido. Deve conter exatamente 6 dígitos numéricos.'
            });
        }

        console.log(`✅ Confirmação de aprovação para transação ${id} pelo admin ${adminId} (IP: ${ip})`);

        const resultado = await aprovacaoTransacaoService.confirmarAprovacao(id, otp, adminId, ip);

        res.json({
            success: true,
            ...resultado
        });
    } catch (error) {
        console.error('❌ Erro ao confirmar aprovação:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Erro ao confirmar aprovação',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/transacoes/canceladas
 * Busca transações canceladas que podem ser aprovadas
 */
router.get('/transacoes/canceladas', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { dataInicio, dataFim, clienteNome, transactionId, limit } = req.query;

        const filtros = {
            dataInicio,
            dataFim,
            clienteNome,
            transactionId,
            limit: limit ? parseInt(limit) : 50
        };

        const transacoes = await aprovacaoTransacaoService.buscarTransacoesCanceladas(filtros);

        res.json({
            success: true,
            data: transacoes,
            total: transacoes.length
        });
    } catch (error) {
        console.error('❌ Erro ao buscar transações canceladas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar transações canceladas',
            error: error.message
        });
    }
});

module.exports = router;
