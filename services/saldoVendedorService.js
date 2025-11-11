const { sequelize, SaldoVendedor, MovimentoSaldo } = require('../config/database');
const { Op } = require('sequelize');

class SaldoVendedorService {
    static async creditarVenda(vendedorId, vendaId, valorOriginal, externalTransaction = null) {
        const t = externalTransaction || await sequelize.transaction();
        try {
            const valorOriginalNum = parseFloat(valorOriginal || 0);
            const credito = +(valorOriginalNum * 0.90).toFixed(2);

            // Idempotência: não duplicar crédito para a mesma venda
            const existente = await MovimentoSaldo.findOne({
                where: { vendedor_id: vendedorId, origem: 'venda', referencia_id: vendaId },
                transaction: t
            });
            if (existente) {
                if (!externalTransaction) await t.commit();
                return { idempotent: true, credito };
            }

            await MovimentoSaldo.create({
                vendedor_id: vendedorId,
                tipo: 'credito',
                origem: 'venda',
                referencia_id: vendaId,
                valor: credito,
                descricao: 'Crédito de 90% por venda aprovada'
            }, { transaction: t });

            // Upsert do saldo
            const saldo = await SaldoVendedor.findOne({ where: { vendedor_id: vendedorId }, transaction: t });
            const now = new Date();
            if (!saldo) {
                await SaldoVendedor.create({
                    vendedor_id: vendedorId,
                    saldo_atual: credito,
                    receita_total: credito,
                    receita_hoje: 0,
                    receita_ontem: 0,
                    receita_semana: 0,
                    receita_mes: 0
                }, { transaction: t });
            } else {
                saldo.saldo_atual = +((parseFloat(saldo.saldo_atual || 0)) + credito).toFixed(2);
                saldo.receita_total = +((parseFloat(saldo.receita_total || 0)) + credito).toFixed(2);
                await saldo.save({ transaction: t });
            }

            // Não atualiza buckets aqui; delegar aos agregadores para consistência

            if (!externalTransaction) await t.commit();
            return { idempotent: false, credito };
        } catch (e) {
            if (!externalTransaction) await t.rollback();
            throw e;
        }
    }

    static async debitarSaque(vendedorId, saqueId, valor, externalTransaction = null) {
        const t = externalTransaction || await sequelize.transaction();
        try {
            const valorNum = +parseFloat(valor || 0).toFixed(2);

            // Idempotência: não duplicar débito para o mesmo saque
            const existente = await MovimentoSaldo.findOne({
                where: { vendedor_id: vendedorId, origem: 'saque', referencia_id: saqueId },
                transaction: t
            });
            if (existente) {
                if (!externalTransaction) await t.commit();
                return { idempotent: true };
            }

            // Debitar
            await MovimentoSaldo.create({
                vendedor_id: vendedorId,
                tipo: 'debito',
                origem: 'saque',
                referencia_id: saqueId,
                valor: valorNum,
                descricao: 'Débito por saque do vendedor'
            }, { transaction: t });

            const saldo = await SaldoVendedor.findOne({ where: { vendedor_id: vendedorId }, transaction: t, lock: t.LOCK.UPDATE });
            if (!saldo || parseFloat(saldo.saldo_atual) < valorNum) {
                throw new Error('Saldo insuficiente para saque');
            }
            saldo.saldo_atual = +((parseFloat(saldo.saldo_atual || 0)) - valorNum).toFixed(2);
            await saldo.save({ transaction: t });

            if (!externalTransaction) await t.commit();
            return { debito: valorNum };
        } catch (e) {
            if (!externalTransaction) await t.rollback();
            throw e;
        }
    }

    // Recalcular agregados por janelas (consistente, a partir de movimentos)
    static async recalcularAgregados(vendedorId) {
        const t = await sequelize.transaction();
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfYesterday = new Date(startOfDay.getTime() - 24*60*60*1000);
            const endOfYesterday = new Date(startOfDay.getTime() - 1);
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // domingo
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const whereBase = { vendedor_id: vendedorId, tipo: 'credito', origem: 'venda' };

            const [
                hoje,
                ontem,
                semana,
                mes,
                total
            ] = await Promise.all([
                MovimentoSaldo.sum('valor', { where: { ...whereBase, created_at: { [Op.gte]: startOfDay } }, transaction: t }),
                MovimentoSaldo.sum('valor', { where: { ...whereBase, created_at: { [Op.between]: [startOfYesterday, endOfYesterday] } }, transaction: t }),
                MovimentoSaldo.sum('valor', { where: { ...whereBase, created_at: { [Op.gte]: startOfWeek } }, transaction: t }),
                MovimentoSaldo.sum('valor', { where: { ...whereBase, created_at: { [Op.gte]: startOfMonth } }, transaction: t }),
                MovimentoSaldo.sum('valor', { where: whereBase, transaction: t })
            ]);

            const saldo = await SaldoVendedor.findOne({ where: { vendedor_id: vendedorId }, transaction: t });
            if (!saldo) {
                await SaldoVendedor.create({
                    vendedor_id: vendedorId,
                    saldo_atual: 0,
                    receita_total: +(total || 0).toFixed(2),
                    receita_hoje: +(hoje || 0).toFixed(2),
                    receita_ontem: +(ontem || 0).toFixed(2),
                    receita_semana: +(semana || 0).toFixed(2),
                    receita_mes: +(mes || 0).toFixed(2)
                }, { transaction: t });
            } else {
                saldo.receita_total = +(total || 0).toFixed(2);
                saldo.receita_hoje = +(hoje || 0).toFixed(2);
                saldo.receita_ontem = +(ontem || 0).toFixed(2);
                saldo.receita_semana = +(semana || 0).toFixed(2);
                saldo.receita_mes = +(mes || 0).toFixed(2);
                await saldo.save({ transaction: t });
            }

            await t.commit();
            return {
                receita_total: +(total || 0).toFixed(2),
                receita_hoje: +(hoje || 0).toFixed(2),
                receita_ontem: +(ontem || 0).toFixed(2),
                receita_semana: +(semana || 0).toFixed(2),
                receita_mes: +(mes || 0).toFixed(2)
            };
        } catch (e) {
            await t.rollback();
            throw e;
        }
    }
}

module.exports = SaldoVendedorService;


