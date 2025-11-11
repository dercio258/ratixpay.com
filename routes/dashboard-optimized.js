const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const { authenticateToken } = require('../middleware/auth');

// Middleware de logging e monitoramento
const logRequest = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.url,
            vendedorId: req.params.vendedorId,
            duration: `${duration}ms`,
            status: res.statusCode,
            timestamp: new Date().toISOString()
        };
        
        // Log de performance
        if (duration > 2000) {
            console.warn(`⚠️ REQUISIÇÃO LENTA:`, logData);
        } else {
            console.log(`📊 Dashboard request:`, logData);
        }
        
        // Log de erro se status >= 400
        if (res.statusCode >= 400) {
            console.error(`❌ ERRO NO DASHBOARD:`, logData);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Aplicar middleware de logging
router.use(logRequest);

// GET - Dashboard consolidado para vendedor
router.get('/:vendedorId', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        const { periodo, limit, offset } = req.query;
        
        // Validar vendedorId
        if (!vendedorId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendedorId)) {
            return res.status(400).json({
                success: false,
                error: 'ID do vendedor inválido',
                message: 'O ID do vendedor deve ser um UUID válido'
            });
        }
        
        // Verificar se o usuário tem acesso ao vendedor
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado',
                message: 'Você não tem permissão para acessar os dados deste vendedor'
            });
        }
        
        console.log(`🔄 Carregando dashboard para vendedor: ${vendedorId}`);
        
        // Opções para o dashboard
        const options = {
            periodo: periodo || '30dias',
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        };
        
        // Buscar dados consolidados
        const dashboardData = await dashboardService.getDashboardData(vendedorId, options);
        
        // Formatar resposta unificada
        const response = {
            success: true,
            data: {
                vendedorId: dashboardData.vendedorId,
                vendedor: dashboardData.vendedor,
                resumo: {
                    nome: dashboardData.vendedor?.nome || 'Vendedor',
                    totalVendas: dashboardData.resumo.totalVendas,
                    receitaTotal: dashboardData.resumo.receitaTotal,
                    saquesPendentes: dashboardData.saques.pendentes.reduce((sum, saque) => sum + saque.valor, 0),
                    vendasAprovadas: dashboardData.resumo.vendasAprovadas,
                    vendasPendentes: dashboardData.resumo.vendasPendentes,
                    vendasCanceladas: dashboardData.resumo.vendasCanceladas,
                    taxaAprovacao: dashboardData.resumo.taxaAprovacao
                },
                vendas: dashboardData.vendas,
                saques: {
                    pendentes: dashboardData.saques.pendentes,
                    historico: dashboardData.saques.historico
                },
                periodo: options.periodo,
                timestamp: dashboardData.timestamp,
                cached: dashboardData.cached
            }
        };
        
        // Adicionar warnings se houver erros parciais
        if (dashboardData.errors && dashboardData.errors.length > 0) {
            response.warnings = dashboardData.errors.map(error => ({
                query: error.query,
                message: error.error
            }));
        }
        
        console.log(`✅ Dashboard carregado com sucesso para vendedor: ${vendedorId}`);
        res.json(response);
        
    } catch (error) {
        console.error(`❌ Erro no dashboard para vendedor ${req.params.vendedorId}:`, error);
        
        // Resposta de erro padronizada
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar dados do dashboard',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// GET - Limpar cache do dashboard
router.delete('/:vendedorId/cache', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado',
                message: 'Você não tem permissão para limpar o cache deste vendedor'
            });
        }
        
        await dashboardService.clearCache(vendedorId);
        
        res.json({
            success: true,
            message: 'Cache limpo com sucesso',
            vendedorId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ Erro ao limpar cache para vendedor ${req.params.vendedorId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Erro ao limpar cache',
            message: error.message
        });
    }
});

// GET - Estatísticas de performance do dashboard
router.get('/:vendedorId/stats', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        // Aqui você pode implementar estatísticas de performance
        // Por exemplo, tempo médio de resposta, hits de cache, etc.
        
        res.json({
            success: true,
            data: {
                vendedorId,
                cacheEnabled: dashboardService.cacheEnabled,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar estatísticas para vendedor ${req.params.vendedorId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar estatísticas',
            message: error.message
        });
    }
});

// Middleware de tratamento de erros específico do dashboard
router.use((error, req, res, next) => {
    console.error(`❌ Erro no dashboard:`, {
        vendedorId: req.params.vendedorId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: 'Falha no processamento do dashboard',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
