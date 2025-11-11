/**
 * Rotas para Emails Profissionais
 * API para gerenciar envio de emails por categoria
 */

const express = require('express');
const router = express.Router();
const emailManagerService = require('../services/emailManagerService');

/**
 * POST /api/email/vendas
 * Enviar email de vendas
 */
router.post('/vendas', async (req, res) => {
    try {
        const { tipo, dados } = req.body;

        if (!tipo || !dados) {
            return res.status(400).json({
                success: false,
                message: 'Tipo e dados são obrigatórios'
            });
        }

        const result = await emailManagerService.enviarEmailVendas(tipo, dados);

        res.json({
            success: result.success,
            message: result.success ? 'Email de vendas enviado com sucesso' : 'Erro ao enviar email',
            data: result
        });

    } catch (error) {
        console.error('Erro ao enviar email de vendas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/email/sistema
 * Enviar email de sistema
 */
router.post('/sistema', async (req, res) => {
    try {
        const { tipo, dados } = req.body;

        if (!tipo || !dados) {
            return res.status(400).json({
                success: false,
                message: 'Tipo e dados são obrigatórios'
            });
        }

        const result = await emailManagerService.enviarEmailSistema(tipo, dados);

        res.json({
            success: result.success,
            message: result.success ? 'Email de sistema enviado com sucesso' : 'Erro ao enviar email',
            data: result
        });

    } catch (error) {
        console.error('Erro ao enviar email de sistema:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/email/suporte
 * Enviar email de suporte
 */
router.post('/suporte', async (req, res) => {
    try {
        const { tipo, dados } = req.body;

        if (!tipo || !dados) {
            return res.status(400).json({
                success: false,
                message: 'Tipo e dados são obrigatórios'
            });
        }

        const result = await emailManagerService.enviarEmailSuporte(tipo, dados);

        res.json({
            success: result.success,
            message: result.success ? 'Email de suporte enviado com sucesso' : 'Erro ao enviar email',
            data: result
        });

    } catch (error) {
        console.error('Erro ao enviar email de suporte:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/email/ofertas
 * Enviar email de ofertas
 */
router.post('/ofertas', async (req, res) => {
    try {
        const { tipo, dados } = req.body;

        if (!tipo || !dados) {
            return res.status(400).json({
                success: false,
                message: 'Tipo e dados são obrigatórios'
            });
        }

        const result = await emailManagerService.enviarEmailOfertas(tipo, dados);

        res.json({
            success: result.success,
            message: result.success ? 'Email de ofertas enviado com sucesso' : 'Erro ao enviar email',
            data: result
        });

    } catch (error) {
        console.error('Erro ao enviar email de ofertas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * POST /api/email/enviar
 * Método genérico para enviar email
 */
router.post('/enviar', async (req, res) => {
    try {
        const { categoria, tipo, dados } = req.body;

        if (!categoria || !tipo || !dados) {
            return res.status(400).json({
                success: false,
                message: 'Categoria, tipo e dados são obrigatórios'
            });
        }

        const result = await emailManagerService.enviarEmail(categoria, tipo, dados);

        res.json({
            success: result.success,
            message: result.success ? `Email ${categoria}/${tipo} enviado com sucesso` : 'Erro ao enviar email',
            data: result
        });

    } catch (error) {
        console.error('Erro ao enviar email:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * GET /api/email/status
 * Verificar status dos serviços de email
 */
router.get('/status', async (req, res) => {
    try {
        const status = await emailManagerService.verificarStatus();
        
        res.json({
            success: true,
            message: 'Status dos serviços de email',
            data: status
        });

    } catch (error) {
        console.error('Erro ao verificar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status',
            error: error.message
        });
    }
});

/**
 * GET /api/email/estatisticas
 * Obter estatísticas dos emails
 */
router.get('/estatisticas', async (req, res) => {
    try {
        const estatisticas = await emailManagerService.obterEstatisticas();
        
        res.json({
            success: true,
            message: 'Estatísticas dos emails profissionais',
            data: estatisticas
        });

    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas',
            error: error.message
        });
    }
});

/**
 * GET /api/email/tipos
 * Listar tipos de email disponíveis
 */
router.get('/tipos', async (req, res) => {
    try {
        const estatisticas = await emailManagerService.obterEstatisticas();
        
        res.json({
            success: true,
            message: 'Tipos de email disponíveis',
            data: estatisticas.categorias
        });

    } catch (error) {
        console.error('Erro ao listar tipos:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao listar tipos',
            error: error.message
        });
    }
});

module.exports = router;
