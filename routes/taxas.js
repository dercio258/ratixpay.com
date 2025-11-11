const express = require('express');
const router = express.Router();
const TaxService = require('../services/taxService');
const SaldoAdminService = require('../services/saldoAdminService');

// Middleware para autenticação JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso necessário' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'seu_jwt_secret');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};

// Middleware para verificar acesso de administrador
const checkAdminAccess = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado - apenas administradores' });
    }
    next();
};

// GET /api/taxas/estatisticas - Obter estatísticas de taxas (apenas admin)
router.get('/estatisticas', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('📊 Obtendo estatísticas de taxas...');
        
        const estatisticas = await TaxService.obterEstatisticasTaxas();
        const saldoAdmin = await SaldoAdminService.buscarSaldo();
        
        res.json({
            success: true,
            data: {
                ...estatisticas,
                saldo_admin: saldoAdmin,
                resumo: {
                    total_taxas_coletadas: estatisticas.total_taxas,
                    total_vendas_processadas: estatisticas.total_vendas,
                    valor_total_vendas: estatisticas.valor_total_vendas,
                    percentual_taxa: estatisticas.percentual_taxa,
                    percentual_vendedor: estatisticas.percentual_vendedor,
                    exemplo: {
                        venda_100mzn: {
                            taxa_admin: 10,
                            receita_vendedor: 90
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de taxas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/taxas/recalcular - Recalcular todas as taxas (apenas admin)
router.post('/recalcular', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('🔄 Recalculando todas as taxas...');
        
        const resultado = await TaxService.recalcularTaxas();
        
        res.json({
            success: true,
            message: 'Taxas recalculadas com sucesso',
            data: resultado
        });
        
    } catch (error) {
        console.error('❌ Erro ao recalcular taxas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/taxas/saldo-admin - Obter saldo do administrador com taxas (apenas admin)
router.get('/saldo-admin', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        console.log('💰 Obtendo saldo do administrador...');
        
        const saldoAdmin = await SaldoAdminService.buscarSaldo();
        
        res.json({
            success: true,
            data: {
                saldo_total: saldoAdmin.saldo_total,
                taxas_coletadas: saldoAdmin.taxas,
                total_vendas: saldoAdmin.total_vendas_aprovadas,
                valor_total_vendas: saldoAdmin.valor_total_vendas,
                total_saques_pagos: saldoAdmin.total_saques_pagos,
                ultima_atualizacao: saldoAdmin.ultima_atualizacao,
                resumo_taxas: {
                    percentual_taxa: 10,
                    percentual_vendedor: 90,
                    exemplo_venda_100: {
                        taxa_admin: 10,
                        receita_vendedor: 90
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao obter saldo do administrador:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST /api/taxas/teste - Testar sistema de taxas com valor simulado (apenas admin)
router.post('/teste', authenticateToken, checkAdminAccess, async (req, res) => {
    try {
        const { valor_teste, vendedor_id_teste, tipo_teste } = req.body;
        
        if (!valor_teste || !vendedor_id_teste) {
            return res.status(400).json({
                success: false,
                error: 'valor_teste e vendedor_id_teste são obrigatórios'
            });
        }
        
        console.log(`🧪 Testando sistema de taxas: valor ${valor_teste}, vendedor ${vendedor_id_teste}, tipo ${tipo_teste || 'venda'}`);
        
        let resultado;
        let explicacao;
        
        if (tipo_teste === 'saque') {
            // Teste de taxa de saque (5%)
            resultado = await TaxService.processarSaqueComTaxa(
                'teste-saque-' + Date.now(),
                valor_teste,
                vendedor_id_teste
            );
            
            explicacao = {
                valor_total: valor_teste,
                taxa_admin_5_percent: resultado.taxa_saque,
                valor_liquido_vendedor_95_percent: resultado.valor_liquido_vendedor,
                calculo: `${valor_teste} * 0.05 = ${resultado.taxa_saque} (admin) | ${valor_teste} * 0.95 = ${resultado.valor_liquido_vendedor} (vendedor)`
            };
        } else {
            // Teste de taxa de venda (10%)
            resultado = await TaxService.processarVendaComTaxas(
                'teste-venda-' + Date.now(),
                valor_teste,
                vendedor_id_teste
            );
            
            explicacao = {
                valor_total: valor_teste,
                taxa_admin_10_percent: resultado.taxa_admin,
                receita_vendedor_90_percent: resultado.receita_vendedor,
                calculo: `${valor_teste} * 0.10 = ${resultado.taxa_admin} (admin) | ${valor_teste} * 0.90 = ${resultado.receita_vendedor} (vendedor)`
            };
        }
        
        res.json({
            success: true,
            message: `Teste de taxas ${tipo_teste || 'venda'} executado com sucesso`,
            data: {
                tipo_teste: tipo_teste || 'venda',
                valor_teste: valor_teste,
                resultado: resultado,
                explicacao: explicacao
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao testar sistema de taxas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET /api/taxas/info - Informações sobre o sistema de taxas
router.get('/info', (req, res) => {
    res.json({
        success: true,
        data: {
            sistema: 'Sistema de Taxas RATIXPAY',
            versao: '2.0.0',
            descricao: 'Sistema que distribui taxas para o administrador em vendas (10%) e saques (5%)',
            regras: {
                vendas: {
                    percentual_taxa_admin: 10,
                    percentual_receita_vendedor: 90,
                    exemplo: {
                        venda_100_mzn: {
                            taxa_admin: 10,
                            receita_vendedor: 90
                        },
                        venda_50_mzn: {
                            taxa_admin: 5,
                            receita_vendedor: 45
                        },
                        venda_200_mzn: {
                            taxa_admin: 20,
                            receita_vendedor: 180
                        }
                    }
                },
                saques: {
                    percentual_taxa_admin: 5,
                    percentual_valor_liquido_vendedor: 95,
                    exemplo: {
                        saque_100_mzn: {
                            taxa_admin: 5,
                            valor_liquido_vendedor: 95
                        },
                        saque_50_mzn: {
                            taxa_admin: 2.5,
                            valor_liquido_vendedor: 47.5
                        },
                        saque_200_mzn: {
                            taxa_admin: 10,
                            valor_liquido_vendedor: 190
                        }
                    }
                }
            },
            endpoints: {
                estatisticas: 'GET /api/taxas/estatisticas',
                recalcular: 'POST /api/taxas/recalcular',
                saldo_admin: 'GET /api/taxas/saldo-admin',
                teste: 'POST /api/taxas/teste (tipo_teste: venda ou saque)',
                info: 'GET /api/taxas/info'
            }
        }
    });
});

module.exports = router;
