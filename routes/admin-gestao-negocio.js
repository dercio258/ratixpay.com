const express = require('express');
const router = express.Router();
const { databaseManager, Venda, Usuario, Produto, Pagamento, EstatisticasVendedor } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

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
        
        // Vendas aprovadas
        const vendasAprovadas = await Venda.count({
            where: { status: 'Aprovada' }
        });
        console.log('✅ Vendas aprovadas:', vendasAprovadas);
        
        // Receita total (soma de todas as vendas aprovadas)
        const receitaTotal = await Venda.sum('valor', {
            where: { status: 'Aprovada' }
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
                status: venda.status === 'Aprovada' || venda.status === 'Pago' ? 'Success' : 
                       venda.status === 'Cancelada' ? 'Error' : 
                       venda.status === 'Pendente' ? 'Pending' : venda.status,
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

module.exports = router;
