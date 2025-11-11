const express = require('express');
const router = express.Router();
const vendedorCache = require('../services/vendedorCache');
const { ReceitaService } = require('../services/receitaService');

/**
 * Middleware de autenticação para admin
 */
const requireAdmin = (req, res, next) => {
    // Verificar se é admin (implementar conforme sua lógica de auth)
    const isAdmin = req.headers['x-admin'] === 'true' || req.query.admin === 'true';
    if (!isAdmin) {
        return res.status(403).json({ 
            success: false, 
            message: 'Acesso restrito a administradores' 
        });
    }
    next();
};

/**
 * GET /api/cache/stats
 * Obter estatísticas do cache
 */
router.get('/stats', requireAdmin, (req, res) => {
    try {
        const stats = vendedorCache.getCacheStats();
        
        res.json({
            success: true,
            data: {
                cache: stats,
                timestamp: new Date(),
                uptime: process.uptime()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas do cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * DELETE /api/cache/clear
 * Limpar todo o cache
 */
router.delete('/clear', requireAdmin, (req, res) => {
    try {
        ReceitaService.clearAllCache();
        
        res.json({
            success: true,
            message: 'Cache limpo com sucesso',
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * DELETE /api/cache/clear/:vendedorId
 * Limpar cache de um vendedor específico
 */
router.delete('/clear/:vendedorId', requireAdmin, (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        ReceitaService.clearVendedorCache(vendedorId);
        
        res.json({
            success: true,
            message: `Cache limpo para vendedor ${vendedorId}`,
            vendedorId: vendedorId,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('❌ Erro ao limpar cache do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/cache/health
 * Verificar saúde do sistema de cache
 */
router.get('/health', (req, res) => {
    try {
        const stats = vendedorCache.getCacheStats();
        const memoryUsage = process.memoryUsage();
        
        const health = {
            status: 'healthy',
            cache: {
                vendedores: stats.vendedores,
                stats: stats.stats,
                memoryUsage: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
                }
            },
            timestamp: new Date(),
            uptime: process.uptime()
        };
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar saúde do cache:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

module.exports = router;
