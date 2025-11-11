const express = require('express');
const router = express.Router();
const transactionService = require('../services/transactionOptimizationService');
const { authenticateToken } = require('../middleware/auth');

// Middleware de logging e monitoramento
const logTransactionRequest = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.url,
            vendedorId: req.params.vendedorId || req.user?.id,
            duration: `${duration}ms`,
            status: res.statusCode,
            timestamp: new Date().toISOString()
        };
        
        // Log de performance
        if (duration > 1000) {
            console.warn(`⚠️ BUSCA DE TRANSAÇÕES LENTA:`, logData);
        } else {
            console.log(`📊 Transaction request:`, logData);
        }
        
        // Log de erro se status >= 400
        if (res.statusCode >= 400) {
            console.error(`❌ ERRO NA BUSCA DE TRANSAÇÕES:`, logData);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// Aplicar middleware de logging
router.use(logTransactionRequest);

// GET - Últimas transações otimizada
router.get('/vendedor/:vendedorId/ultimas', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        const { limit, offset, status, periodo, useCache } = req.query;
        
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
                message: 'Você não tem permissão para acessar as transações deste vendedor'
            });
        }
        
        console.log(`🔄 Buscando últimas transações para vendedor: ${vendedorId}`);
        
        // Opções para a busca
        const options = {
            vendedorId,
            limit: parseInt(limit) || 20,
            offset: parseInt(offset) || 0,
            status: status || null,
            periodo: periodo || '30dias',
            useCache: useCache !== 'false'
        };
        
        // Buscar transações otimizadas
        const transactions = await transactionService.getLatestTransactions(options);
        
        // Formatar resposta
        const response = {
            success: true,
            data: {
                vendedorId,
                transactions,
                pagination: {
                    limit: options.limit,
                    offset: options.offset,
                    total: transactions.length,
                    hasMore: transactions.length === options.limit
                },
                filters: {
                    status: options.status,
                    periodo: options.periodo
                },
                timestamp: new Date().toISOString(),
                cached: options.useCache
            }
        };
        
        console.log(`✅ ${transactions.length} transações carregadas para vendedor: ${vendedorId}`);
        res.json(response);
        
    } catch (error) {
        console.error(`❌ Erro ao buscar transações para vendedor ${req.params.vendedorId}:`, error);
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar transações',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// GET - Estatísticas de transações
router.get('/vendedor/:vendedorId/estatisticas', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        const { periodo } = req.query;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        console.log(`🔄 Buscando estatísticas para vendedor: ${vendedorId}`);
        
        // Buscar estatísticas
        const stats = await transactionService.getTransactionStats(vendedorId, periodo || '30dias');
        
        res.json({
            success: true,
            data: {
                vendedorId,
                estatisticas: stats,
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

// GET - Transação específica
router.get('/:transactionId', authenticateToken, async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { vendedorId } = req.query;
        
        console.log(`🔄 Buscando transação: ${transactionId}`);
        
        // Buscar transação
        const transaction = await transactionService.getTransactionById(
            transactionId, 
            vendedorId || req.user.id
        );
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada',
                message: 'A transação solicitada não foi encontrada'
            });
        }
        
        res.json({
            success: true,
            data: {
                transaction,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error(`❌ Erro ao buscar transação ${req.params.transactionId}:`, error);
        
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar transação',
            message: error.message
        });
    }
});

// DELETE - Limpar cache de transações
router.delete('/vendedor/:vendedorId/cache', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        // Limpar cache
        transactionService.clearTransactionCache(vendedorId);
        
        res.json({
            success: true,
            message: 'Cache de transações limpo com sucesso',
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

// POST - Otimizar índices do banco
router.post('/otimizar-indices', authenticateToken, async (req, res) => {
    try {
        // Verificar se é admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado',
                message: 'Apenas administradores podem otimizar índices'
            });
        }
        
        console.log('🔧 Iniciando otimização de índices...');
        
        // Otimizar índices
        await transactionService.optimizeDatabaseIndexes();
        
        res.json({
            success: true,
            message: 'Índices otimizados com sucesso',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Erro na otimização de índices:', error);
        
        res.status(500).json({
            success: false,
            error: 'Erro na otimização',
            message: error.message
        });
    }
});

// Middleware de tratamento de erros específico
router.use((error, req, res, next) => {
    console.error(`❌ Erro nas transações:`, {
        vendedorId: req.params.vendedorId,
        transactionId: req.params.transactionId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: 'Falha no processamento das transações',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
