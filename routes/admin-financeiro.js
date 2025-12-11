/**
 * Rotas para gestão financeira do administrador
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { isAdmin } = require('../middleware/auth');
const CarteiraAdminService = require('../services/carteiraAdminService');

// Middleware para verificar acesso de administrador
const checkAdminAccess = async (req, res, next) => {
    try {
        const isMainAdmin = req.user.email === 'ratixpay.mz@gmail.com';
        const isRegularAdmin = req.user.role === 'admin' || req.user.tipo_conta === 'admin';
        
        if (!isMainAdmin && !isRegularAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Apenas administradores.'
            });
        }
        
        next();
    } catch (error) {
        console.error('Erro ao verificar acesso admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

// GET /api/admin/financeiro/carteiras - Listar todas as carteiras
router.get('/carteiras', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const carteiras = await CarteiraAdminService.buscarCarteiras();
        
        res.json({
            success: true,
            data: carteiras
        });
    } catch (error) {
        console.error('Erro ao listar carteiras:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar carteiras',
            error: error.message
        });
    }
});

// GET /api/admin/financeiro/resumo - Obter resumo financeiro
router.get('/resumo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const resumo = await CarteiraAdminService.obterResumoFinanceiro();
        
        res.json({
            success: true,
            data: resumo
        });
    } catch (error) {
        console.error('Erro ao obter resumo financeiro:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter resumo financeiro',
            error: error.message
        });
    }
});

// GET /api/admin/financeiro/carteira/:tipo - Buscar carteira por tipo
router.get('/carteira/:tipo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { tipo } = req.params;
        
        if (!['mpesa', 'emola'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de carteira inválido. Use: mpesa ou emola'
            });
        }
        
        const carteira = await CarteiraAdminService.buscarCarteiraPorTipo(tipo);
        
        res.json({
            success: true,
            data: carteira
        });
    } catch (error) {
        console.error('Erro ao buscar carteira:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar carteira',
            error: error.message
        });
    }
});

// PUT /api/admin/financeiro/carteira/:tipo - Atualizar carteira
router.put('/carteira/:tipo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { tipo } = req.params;
        const { nome, contacto, nome_titular, email, ativa, observacoes } = req.body;
        
        if (!['mpesa', 'emola'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de carteira inválido. Use: mpesa ou emola'
            });
        }
        
        const carteira = await CarteiraAdminService.atualizarCarteira(tipo, {
            nome,
            contacto,
            nome_titular,
            email,
            ativa,
            observacoes
        });
        
        res.json({
            success: true,
            message: 'Carteira atualizada com sucesso',
            data: carteira
        });
    } catch (error) {
        console.error('Erro ao atualizar carteira:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar carteira',
            error: error.message
        });
    }
});

// POST /api/admin/financeiro/carteira/:tipo/adicionar-saldo - Adicionar saldo
router.post('/carteira/:tipo/adicionar-saldo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { tipo } = req.params;
        const { valor, observacao } = req.body;
        
        if (!['mpesa', 'emola'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de carteira inválido. Use: mpesa ou emola'
            });
        }
        
        if (!valor || parseFloat(valor) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valor deve ser maior que zero'
            });
        }
        
        const carteira = await CarteiraAdminService.adicionarSaldo(tipo, valor, observacao);
        
        res.json({
            success: true,
            message: 'Saldo adicionado com sucesso',
            data: carteira
        });
    } catch (error) {
        console.error('Erro ao adicionar saldo:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar saldo',
            error: error.message
        });
    }
});

// POST /api/admin/financeiro/carteira/:tipo/subtrair-saldo - Subtrair saldo
router.post('/carteira/:tipo/subtrair-saldo', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { tipo } = req.params;
        const { valor, observacao } = req.body;
        
        if (!['mpesa', 'emola'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de carteira inválido. Use: mpesa ou emola'
            });
        }
        
        if (!valor || parseFloat(valor) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valor deve ser maior que zero'
            });
        }
        
        const carteira = await CarteiraAdminService.subtrairSaldo(tipo, valor, observacao);
        
        res.json({
            success: true,
            message: 'Saldo subtraído com sucesso',
            data: carteira
        });
    } catch (error) {
        console.error('Erro ao subtrair saldo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao subtrair saldo',
            error: error.message
        });
    }
});

module.exports = router;

