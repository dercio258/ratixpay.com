const express = require('express');
const router = express.Router();
const { Configuracao } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// GET - Listar todas as configurações
router.get('/', authenticateToken, async (req, res) => {
    try {
        const configuracoes = await Configuracao.findAll({
            order: [['chave', 'ASC']]
        });

        const configFormatada = configuracoes.reduce((acc, config) => {
            acc[config.chave] = {
                valor: config.valor,
                descricao: config.descricao
            };
            return acc;
        }, {});

        res.json({
            success: true,
            data: configFormatada
        });
    } catch (error) {
        console.error('Erro ao buscar configurações:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar configurações',
            error: error.message
        });
    }
});

// GET - Buscar configuração específica
router.get('/:chave', authenticateToken, async (req, res) => {
    try {
        const { chave } = req.params;
        
        const config = await Configuracao.findOne({
            where: { chave }
        });

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        res.json({
            success: true,
            data: {
                chave: config.chave,
                valor: config.valor,
                descricao: config.descricao
            }
        });
    } catch (error) {
        console.error('Erro ao buscar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar configuração',
            error: error.message
        });
    }
});

// PUT - Atualizar configuração
router.put('/:chave', authenticateToken, async (req, res) => {
    try {
        const { chave } = req.params;
        const { valor, descricao } = req.body;

        const config = await Configuracao.findOne({
            where: { chave }
        });

        if (!config) {
            return res.status(404).json({
                success: false,
                message: 'Configuração não encontrada'
            });
        }

        await config.update({
            valor: valor || config.valor,
            descricao: descricao || config.descricao
        });

        res.json({
            success: true,
            message: 'Configuração atualizada com sucesso',
            data: {
                chave: config.chave,
                valor: config.valor,
                descricao: config.descricao
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar configuração:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar configuração',
            error: error.message
        });
    }
});

module.exports = router;
