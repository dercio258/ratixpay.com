const express = require('express');
const router = express.Router();
const EstatisticasService = require('../services/estatisticasService');

const { Venda, Produto } = require('../config/database');

// GET - Estatísticas gerais
router.get('/', async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        if (dataInicio && dataFim) {
            // Se foram fornecidas datas, buscar por período
            const estatisticas = await EstatisticaVenda.obterEstatisticasPorPeriodo(dataInicio, dataFim);
            res.json(estatisticas);
        } else {
            // Caso contrário, buscar estatísticas recentes
            const estatisticas = await EstatisticaVenda.obterEstatisticasRecentes();
            res.json(estatisticas);
        }
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Estatísticas por período
router.get('/periodo', async (req, res) => {
    try {
        const { dataInicio, dataFim } = req.query;
        
        if (!dataInicio || !dataFim) {
            return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
        }
        
        const estatisticas = await EstatisticaVenda.obterEstatisticasPorPeriodo(dataInicio, dataFim);
        res.json(estatisticas);
    } catch (error) {
        console.error('Erro ao obter estatísticas por período:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Estatísticas agrupadas por dia
router.get('/agrupadas', async (req, res) => {
    try {
        const { dias = 30 } = req.query;
        const estatisticas = await EstatisticaVenda.obterEstatisticasAgrupadas(parseInt(dias));
        res.json(estatisticas);
    } catch (error) {
        console.error('Erro ao obter estatísticas agrupadas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});



// GET - Estatísticas recentes
router.get('/recentes', async (req, res) => {
    try {
        const estatisticas = await EstatisticaVenda.obterEstatisticasRecentes();
        res.json(estatisticas);
    } catch (error) {
        console.error('Erro ao obter estatísticas recentes:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Gráfico de vendas
router.get('/grafico', async (req, res) => {
    try {
        const { dias = 7 } = req.query;
        const dados = await EstatisticaVenda.obterDadosGrafico(parseInt(dias));
        res.json(dados);
    } catch (error) {
        console.error('Erro ao obter dados do gráfico:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET - Erros de transação
router.get('/erros', async (req, res) => {
    try {
        const erros = await EstatisticaVenda.obterErrosTransacao();
        res.json(erros);
    } catch (error) {
        console.error('Erro ao obter erros de transação:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
