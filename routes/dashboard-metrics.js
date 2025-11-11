const express = require('express');
const router = express.Router();
const { authenticateToken, isVendedorOrAdmin } = require('../middleware/auth');
const { MovimentoSaldo, SaldoVendedor, Venda, sequelize } = require('../config/database');
const { Op } = require('sequelize');

function rangeFor(periodo) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch ((periodo || 'hoje').toLowerCase()) {
        case 'ontem':
            return [new Date(startOfDay.getTime() - 24*60*60*1000), new Date(startOfDay.getTime() - 1)];
        case 'semana': {
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            return [startOfWeek, now];
        }
        case 'mes':
            return [new Date(now.getFullYear(), now.getMonth(), 1), now];
        case '30dias':
            return [new Date(now.getTime() - 30*24*60*60*1000), now];
        case 'hoje':
        default:
            return [startOfDay, now];
    }
}

// GET /api/dashboard/metrics?periodo=hoje|ontem|semana|mes|30dias
router.get('/metrics', authenticateToken, isVendedorOrAdmin, async (req, res) => {
    try {
        const periodo = req.query.periodo || 'hoje';
        const [inicio, fim] = rangeFor(periodo);
        const vendedorId = req.user.id;

        // Receita por MovimentoSaldo (somente créditos de venda)
        const receitaPeriodo = await MovimentoSaldo.sum('valor', {
            where: {
                vendedor_id: vendedorId,
                tipo: 'credito',
                origem: 'venda',
                created_at: { [Op.between]: [inicio, fim] }
            }
        });

        // Buckets totais do saldo (cálculo rápido)
        const saldo = await SaldoVendedor.findOne({ where: { vendedor_id: vendedorId } });

        // Contagem de vendas por status no período
        const vendas = await Venda.findAll({
            where: {
                vendedor_id: vendedorId,
                created_at: { [Op.between]: [inicio, fim] }
            },
            attributes: ['status', 'pagamentoStatus']
        });

        const counts = { aprovadas: 0, canceladas: 0, pendentes: 0 };
        vendas.forEach(v => {
            const s = (v.status || v.pagamentoStatus || '').toLowerCase();
            if (s.includes('pago') || s.includes('aprov')) counts.aprovadas++;
            else if (s.includes('cancel') || s.includes('rej')) counts.canceladas++;
            else counts.pendentes++;
        });

        res.json({
            success: true,
            data: {
                periodo: { inicio, fim, nome: periodo },
                receita: {
                    hoje: +(saldo?.receita_hoje || 0),
                    ontem: +(saldo?.receita_ontem || 0),
                    semana: +(saldo?.receita_semana || 0),
                    mes: +(saldo?.receita_mes || 0),
                    total: +(saldo?.receita_total || 0),
                    periodoAtual: +(receitaPeriodo || 0)
                },
                vendas: counts
            }
        });
    } catch (e) {
        console.error('❌ Erro ao montar métricas do dashboard:', e);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

module.exports = router;


