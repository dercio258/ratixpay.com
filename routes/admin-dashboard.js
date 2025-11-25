const express = require('express');
const router = express.Router();
const { Venda, Produto, Pedido, Usuario, Pagamento, SaldoAdmin, sequelize } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET - Teste de conectividade
router.get('/test', (req, res) => {
  console.log('🧪 Teste de rota admin-dashboard chamado');
  res.json({
    success: true,
    message: 'Rota admin-dashboard funcionando',
    timestamp: new Date().toISOString()
  });
});

// GET - Teste sem autenticação
router.get('/test-simple', (req, res) => {
  console.log('🧪 Teste simples chamado');
  res.json({
    success: true,
    message: 'Rota simples funcionando',
    timestamp: new Date().toISOString()
  });
});

// GET - Teste de estatísticas sem autenticação
router.get('/vendedores/estatisticas-test', async (req, res) => {
  try {
    console.log('🧪 Teste de estatísticas sem autenticação...');
    
    // Teste simples de contagem
    const totalVendedores = await Usuario.count({
      where: { 
        role: 'user'
      }
    });
    
    res.json({
      success: true,
      message: 'Teste de estatísticas funcionando',
      data: {
        totalVendedores
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro no teste de estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste de estatísticas',
      error: error.message
    });
  }
});

// GET - Estatísticas gerais do admin
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Iniciando carregamento de estatísticas do admin...');
    
    // Dados básicos com valores padrão
    const dadosBasicos = {
      totalVendas: 0,
      receitaTotal: 0,
      vendedoresAtivos: 0,
      saquesPendentes: 0,
      vendasHoje: 0,
      receitaHoje: 0,
      receitaDisponivelVendedores: 0,
      receitaDisponivel: 0,
      taxas: {
        taxasVendas: 0,
        taxasSaques: 0,
        totalTaxas: 0,
        percentualVendas: 10,
        percentualSaques: 5
      },
      saldoAdmin: {
        saldoTotal: 0,
        totalComissoes: 0,
        totalSaquesPagos: 0
      }
    };
    
    try {
      // Status que indicam aprovação (incluindo APROVADO)
      const { Op } = require('sequelize');
      const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
      
      // Total de vendas aprovadas
      console.log('🔍 Buscando total de vendas...');
      const totalVendas = await Venda.count({
        where: { 
          status: {
            [Op.in]: statusAprovados
          }
        }
      });
      console.log(`✅ Total de vendas encontradas: ${totalVendas}`);
      dadosBasicos.totalVendas = totalVendas;
      
      // Receita total do sistema
      const vendasAprovadas = await Venda.findAll({
        where: { 
          status: {
            [Op.in]: statusAprovados
          }
        },
        attributes: ['valor']
      });
      
      const receitaTotal = vendasAprovadas.reduce((total, venda) => {
        return total + parseFloat(venda.valor || 0);
      }, 0);
      dadosBasicos.receitaTotal = receitaTotal;
      dadosBasicos.receitaDisponivel = receitaTotal;
      dadosBasicos.receitaDisponivelVendedores = receitaTotal * 0.9;
      
      // Vendedores ativos
      const vendedoresAtivos = await Usuario.count({
        where: { 
          role: 'user',
          ativo: true
        }
      });
      dadosBasicos.vendedoresAtivos = vendedoresAtivos;
      
      // Saques pendentes
      const saquesPendentes = await Pagamento.count({
        where: {
          status: 'pendente'
        }
      });
      dadosBasicos.saquesPendentes = saquesPendentes;
      
      // Vendas de hoje
      const inicioHoje = new Date();
      inicioHoje.setHours(0, 0, 0, 0);
      const fimHoje = new Date();
      fimHoje.setHours(23, 59, 59, 999);
      
      const vendasHoje = await Venda.count({
        where: {
          status: 'Pago',
          created_at: {
            [Op.between]: [inicioHoje, fimHoje]
          }
        }
      });
      dadosBasicos.vendasHoje = vendasHoje;
      
      // Receita de hoje
      const vendasHojePagas = await Venda.findAll({
        where: {
          status: 'Pago',
          created_at: {
            [Op.between]: [inicioHoje, fimHoje]
          }
        },
        attributes: ['valor']
      });
      
      const receitaHoje = vendasHojePagas.reduce((total, venda) => {
        return total + parseFloat(venda.valor || 0);
      }, 0);
      dadosBasicos.receitaHoje = receitaHoje;
      
      // Buscar saldo do administrador
      console.log('🔍 Buscando saldo do administrador...');
      const { SaldoAdmin } = require('../config/database');
      const saldoAdmin = await SaldoAdmin.findOne();
      console.log(`✅ Saldo admin encontrado:`, saldoAdmin ? 'Sim' : 'Não');
      
      if (saldoAdmin) {
        dadosBasicos.saldoAdmin = {
          saldoTotal: parseFloat(saldoAdmin.saldo_total || 0),
          totalComissoes: parseFloat(saldoAdmin.total_comissoes || 0),
          totalSaquesPagos: parseFloat(saldoAdmin.total_saques_pagos || 0)
        };
      }
      
      // Calcular taxas
      const taxasVendas = receitaTotal * 0.10; // 10% das vendas
      const taxasSaques = saldoAdmin ? parseFloat(saldoAdmin.taxas_saques || 0) : 0; // 5% dos saques
      const totalTaxas = taxasVendas + taxasSaques;
      
      dadosBasicos.taxas = {
        taxasVendas: taxasVendas,
        taxasSaques: taxasSaques,
        totalTaxas: totalTaxas,
        percentualVendas: 10,
        percentualSaques: 5
      };
      
    } catch (dbError) {
      console.error('❌ Erro ao buscar dados do banco:', dbError);
      // Continuar com dados padrão
    }
    
    console.log('✅ Enviando resposta com dados:', dadosBasicos);
    res.json({
      success: true,
      data: dadosBasicos
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar estatísticas:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET - Histórico financeiro para gráfico
router.get('/historico-financeiro', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Carregando histórico financeiro...');
    
    // Gerar dados dos últimos 30 dias
    const labels = [];
    const saldoAdminData = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      
      // Dados simulados com crescimento
      const baseSaldo = 1000 + (i * 50);
      saldoAdminData.push(baseSaldo + Math.random() * 200 - 100);
    }
    
    const chartData = {
      labels: labels,
      datasets: [
        {
          label: 'Saldo Admin (MZN)',
          data: saldoAdminData,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };
    
    res.json({
      success: true,
      data: chartData
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar histórico financeiro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET - Dados para gráfico de vendas por período
router.get('/vendas-chart', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { periodo = '7d' } = req.query;
    
    let dias;
    switch (periodo) {
      case '7d':
        dias = 7;
        break;
      case '30d':
        dias = 30;
        break;
      case '90d':
        dias = 90;
        break;
      default:
        dias = 7;
    }
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    
    // Buscar vendas por dia
    const vendasPorDia = await Venda.findAll({
      where: {
        status: 'Pago',
        created_at: {
          [Op.gte]: dataInicio
        }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'data'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'vendas'],
        [sequelize.fn('SUM', sequelize.col('valor')), 'receita']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']]
    });
    
    // Gerar labels para os últimos dias
    const labels = [];
    const vendas = [];
    const receita = [];
    
    for (let i = dias - 1; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      
      labels.push(data.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }));
      
      const vendaDoDia = vendasPorDia.find(v => v.data === dataStr);
      vendas.push(vendaDoDia ? parseInt(vendaDoDia.vendas) : 0);
      receita.push(vendaDoDia ? parseFloat(vendaDoDia.receita) : 0);
    }
    
    res.json({
      success: true,
      data: {
        labels,
        vendas,
        receita
      }
    });
    
  } catch (error) {
    console.error('Erro ao carregar gráfico de vendas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Dados para gráfico de status das vendas
router.get('/status-chart', authenticateToken, isAdmin, async (req, res) => {
  try {
    const statusVendas = await Venda.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      group: ['status']
    });
    
    const labels = [];
    const values = [];
    
    statusVendas.forEach(status => {
      labels.push(status.status);
      values.push(parseInt(status.total));
    });
    
    res.json({
      success: true,
      data: {
        labels,
        values
      }
    });
    
  } catch (error) {
    console.error('Erro ao carregar gráfico de status:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Top vendedores
router.get('/top-vendedores', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Buscar vendedores ativos
    const vendedores = await Usuario.findAll({
      where: {
        role: 'user',
        ativo: true
      },
      attributes: ['id', 'nome_completo', 'email'],
      limit: 5
    });
    
    // Buscar estatísticas de vendas para cada vendedor
    const vendedoresComStats = await Promise.all(
      vendedores.map(async (vendedor) => {
        const vendas = await Venda.findAll({
          where: {
            vendedor_id: vendedor.id,
            status: 'Pago'
          },
          attributes: ['valor']
        });
        
        const totalVendas = vendas.length;
        const receitaTotal = vendas.reduce((total, venda) => {
          return total + parseFloat(venda.valor || 0);
        }, 0);
        
        return {
          id: vendedor.id,
          nome_completo: vendedor.nome_completo,
          email: vendedor.email,
          total_vendas: totalVendas,
          receita_total: receitaTotal
        };
      })
    );
    
    // Ordenar por receita total
    vendedoresComStats.sort((a, b) => b.receita_total - a.receita_total);
    
    res.json({
      success: true,
      data: vendedoresComStats
    });
    
  } catch (error) {
    console.error('Erro ao carregar top vendedores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Vendedores recentes
router.get('/vendedores-recentes', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Buscar vendedores recentes
    const vendedores = await Usuario.findAll({
      where: {
        role: 'user'
      },
      attributes: ['id', 'nome_completo', 'email', 'created_at'],
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    // Buscar estatísticas de vendas para cada vendedor
    const vendedoresComStats = await Promise.all(
      vendedores.map(async (vendedor) => {
        const vendas = await Venda.findAll({
          where: {
            vendedor_id: vendedor.id,
            status: 'Pago'
          },
          attributes: ['valor']
        });
        
        const totalVendas = vendas.length;
        const receitaTotal = vendas.reduce((total, venda) => {
          return total + parseFloat(venda.valor || 0);
        }, 0);
        
        return {
          id: vendedor.id,
          nome_completo: vendedor.nome_completo,
          email: vendedor.email,
          created_at: vendedor.created_at,
          total_vendas: totalVendas,
          receita_total: receitaTotal
        };
      })
    );
    
    res.json({
      success: true,
      data: vendedoresComStats
    });
    
  } catch (error) {
    console.error('Erro ao carregar vendedores recentes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Dados para gráfico de taxas coletadas (TaxService + SaldoAdminService)
router.get('/taxas-coletadas', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { periodo = '30d' } = req.query;
    
    let dias;
    switch (periodo) {
      case '7d':
        dias = 7;
        break;
      case '30d':
        dias = 30;
        break;
      case '90d':
        dias = 90;
        break;
      case '1y':
        dias = 365;
        break;
      default:
        dias = 30;
    }
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - dias);
    
    console.log(`📊 Buscando dados de taxas coletadas para período: ${periodo} (${dias} dias)`);
    
    // Buscar vendas aprovadas no período (TaxService - 10% das vendas)
    const vendasAprovadas = await Venda.findAll({
      where: {
        status: 'Pago',
        created_at: {
          [Op.gte]: dataInicio
        }
      },
      attributes: ['valor', 'created_at'],
      order: [['created_at', 'ASC']]
    });
    
    // Buscar saques pagos no período (SaldoAdminService - 5% dos saques)
    const saquesPagos = await Pagamento.findAll({
      where: {
        status: 'pago',
        created_at: {
          [Op.gte]: dataInicio
        }
      },
      attributes: ['valor', 'created_at'],
      order: [['created_at', 'ASC']]
    });
    
    // Preparar dados para o gráfico
    const labels = [];
    const taxasVendasData = []; // 10% das vendas
    const taxasSaquesData = []; // 5% dos saques
    const taxasTotaisData = []; // Soma das duas
    
    // Gerar dados baseado no período
    if (periodo === '7d') {
      // 7 dias: mostrar cada dia
      for (let i = dias - 1; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        labels.push(data.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit' 
        }));
        
        // Filtrar vendas do dia
        const vendasDia = vendasAprovadas.filter(v => 
          v.created_at.toISOString().split('T')[0] === dataStr
        );
        
        // Filtrar saques do dia
        const saquesDia = saquesPagos.filter(s => 
          s.created_at.toISOString().split('T')[0] === dataStr
        );
        
        // Calcular taxas do dia
        const receitaTotalDia = vendasDia.reduce((sum, v) => sum + parseFloat(v.valor), 0);
        const taxasVendasDia = receitaTotalDia * 0.10; // 10% das vendas
        const taxasSaquesDia = saquesDia.reduce((sum, s) => sum + parseFloat(s.valor), 0) * 0.05; // 5% dos saques
        const taxasTotaisDia = taxasVendasDia + taxasSaquesDia;
        
        taxasVendasData.push(parseFloat(taxasVendasDia.toFixed(2)));
        taxasSaquesData.push(parseFloat(taxasSaquesDia.toFixed(2)));
        taxasTotaisData.push(parseFloat(taxasTotaisDia.toFixed(2)));
      }
    } else if (periodo === '30d') {
      // 30 dias: mostrar 4 semanas (7 dias cada)
      for (let semana = 3; semana >= 0; semana--) {
        const inicioSemana = new Date();
        inicioSemana.setDate(inicioSemana.getDate() - (semana + 1) * 7);
        const fimSemana = new Date();
        fimSemana.setDate(fimSemana.getDate() - semana * 7);
        
        labels.push(`Semana ${4 - semana}`);
        
        // Filtrar vendas da semana
        const vendasSemana = vendasAprovadas.filter(v => {
          const dataVenda = new Date(v.created_at);
          return dataVenda >= inicioSemana && dataVenda <= fimSemana;
        });
        
        // Filtrar saques da semana
        const saquesSemana = saquesPagos.filter(s => {
          const dataSaque = new Date(s.created_at);
          return dataSaque >= inicioSemana && dataSaque <= fimSemana;
        });
        
        // Calcular totais da semana
        const receitaTotalSemana = vendasSemana.reduce((sum, v) => sum + parseFloat(v.valor), 0);
        const taxasVendasSemana = receitaTotalSemana * 0.10;
        const taxasSaquesSemana = saquesSemana.reduce((sum, s) => sum + parseFloat(s.valor), 0) * 0.05;
        const taxasTotaisSemana = taxasVendasSemana + taxasSaquesSemana;
        
        taxasVendasData.push(parseFloat(taxasVendasSemana.toFixed(2)));
        taxasSaquesData.push(parseFloat(taxasSaquesSemana.toFixed(2)));
        taxasTotaisData.push(parseFloat(taxasTotaisSemana.toFixed(2)));
      }
    } else if (periodo === '90d') {
      // 90 dias: mostrar 3 meses (30 dias cada)
      for (let mes = 2; mes >= 0; mes--) {
        const inicioMes = new Date();
        inicioMes.setDate(inicioMes.getDate() - (mes + 1) * 30);
        const fimMes = new Date();
        fimMes.setDate(fimMes.getDate() - mes * 30);
        
        labels.push(`Mês ${3 - mes}`);
        
        // Filtrar vendas do mês
        const vendasMes = vendasAprovadas.filter(v => {
          const dataVenda = new Date(v.created_at);
          return dataVenda >= inicioMes && dataVenda <= fimMes;
        });
        
        // Filtrar saques do mês
        const saquesMes = saquesPagos.filter(s => {
          const dataSaque = new Date(s.created_at);
          return dataSaque >= inicioMes && dataSaque <= fimMes;
        });
        
        // Calcular totais do mês
        const receitaTotalMes = vendasMes.reduce((sum, v) => sum + parseFloat(v.valor), 0);
        const taxasVendasMes = receitaTotalMes * 0.10;
        const taxasSaquesMes = saquesMes.reduce((sum, s) => sum + parseFloat(s.valor), 0) * 0.05;
        const taxasTotaisMes = taxasVendasMes + taxasSaquesMes;
        
        taxasVendasData.push(parseFloat(taxasVendasMes.toFixed(2)));
        taxasSaquesData.push(parseFloat(taxasSaquesMes.toFixed(2)));
        taxasTotaisData.push(parseFloat(taxasTotaisMes.toFixed(2)));
      }
    } else if (periodo === '1y') {
      // 1 ano: mostrar 4 trimestres (3 meses cada)
      for (let trimestre = 3; trimestre >= 0; trimestre--) {
        const inicioTrimestre = new Date();
        inicioTrimestre.setMonth(inicioTrimestre.getMonth() - (trimestre + 1) * 3);
        const fimTrimestre = new Date();
        fimTrimestre.setMonth(fimTrimestre.getMonth() - trimestre * 3);
        
        labels.push(`Q${4 - trimestre}`);
        
        // Filtrar vendas do trimestre
        const vendasTrimestre = vendasAprovadas.filter(v => {
          const dataVenda = new Date(v.created_at);
          return dataVenda >= inicioTrimestre && dataVenda <= fimTrimestre;
        });
        
        // Filtrar saques do trimestre
        const saquesTrimestre = saquesPagos.filter(s => {
          const dataSaque = new Date(s.created_at);
          return dataSaque >= inicioTrimestre && dataSaque <= fimTrimestre;
        });
        
        // Calcular totais do trimestre
        const receitaTotalTrimestre = vendasTrimestre.reduce((sum, v) => sum + parseFloat(v.valor), 0);
        const taxasVendasTrimestre = receitaTotalTrimestre * 0.10;
        const taxasSaquesTrimestre = saquesTrimestre.reduce((sum, s) => sum + parseFloat(s.valor), 0) * 0.05;
        const taxasTotaisTrimestre = taxasVendasTrimestre + taxasSaquesTrimestre;
        
        taxasVendasData.push(parseFloat(taxasVendasTrimestre.toFixed(2)));
        taxasSaquesData.push(parseFloat(taxasSaquesTrimestre.toFixed(2)));
        taxasTotaisData.push(parseFloat(taxasTotaisTrimestre.toFixed(2)));
      }
    }
    
    // Calcular totais do período
    const totalTaxasVendas = taxasVendasData.reduce((sum, val) => sum + val, 0);
    const totalTaxasSaques = taxasSaquesData.reduce((sum, val) => sum + val, 0);
    const totalTaxasColetadas = taxasTotaisData.reduce((sum, val) => sum + val, 0);
    
    // Calcular estatísticas
    const mediaTaxasVendas = totalTaxasVendas / dias;
    const mediaTaxasSaques = totalTaxasSaques / dias;
    const mediaTaxasTotais = totalTaxasColetadas / dias;
    const maiorTaxasVendas = Math.max(...taxasVendasData);
    const maiorTaxasSaques = Math.max(...taxasSaquesData);
    const maiorTaxasTotais = Math.max(...taxasTotaisData);
    
    res.json({
      success: true,
      data: {
        // Dados para gráfico
        labels,
        taxasVendas: taxasVendasData,
        taxasSaques: taxasSaquesData,
        taxasTotais: taxasTotaisData,
        
        // Totais do período
        totalTaxasVendas: parseFloat(totalTaxasVendas.toFixed(2)),
        totalTaxasSaques: parseFloat(totalTaxasSaques.toFixed(2)),
        totalTaxasColetadas: parseFloat(totalTaxasColetadas.toFixed(2)),
        
        // Estatísticas
        estatisticas: {
          periodo: {
            tipo: periodo,
            dias: dias,
            inicio: dataInicio.toISOString(),
            fim: new Date().toISOString()
          },
          mediaTaxasVendas: parseFloat(mediaTaxasVendas.toFixed(2)),
          mediaTaxasSaques: parseFloat(mediaTaxasSaques.toFixed(2)),
          mediaTaxasTotais: parseFloat(mediaTaxasTotais.toFixed(2)),
          maiorTaxasVendas: parseFloat(maiorTaxasVendas.toFixed(2)),
          maiorTaxasSaques: parseFloat(maiorTaxasSaques.toFixed(2)),
          maiorTaxasTotais: parseFloat(maiorTaxasTotais.toFixed(2)),
          vendasProcessadas: vendasAprovadas.length,
          saquesProcessados: saquesPagos.length,
          valorTotalVendas: parseFloat(vendasAprovadas.reduce((sum, v) => sum + parseFloat(v.valor), 0).toFixed(2)),
          valorTotalSaques: parseFloat(saquesPagos.reduce((sum, s) => sum + parseFloat(s.valor), 0).toFixed(2)),
          percentualTaxasVendas: totalTaxasColetadas > 0 ? parseFloat(((totalTaxasVendas / totalTaxasColetadas) * 100).toFixed(2)) : 0,
          percentualTaxasSaques: totalTaxasColetadas > 0 ? parseFloat(((totalTaxasSaques / totalTaxasColetadas) * 100).toFixed(2)) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao buscar dados de taxas coletadas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET - Estatísticas específicas para página de vendedores
router.get('/vendedores/estatisticas', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('📊 Carregando estatísticas de vendedores...');
    console.log('🔑 Token válido:', !!req.user);
    console.log('👤 Usuário admin:', req.user?.role);
    
    // Total de vendedores (todos os status)
    console.log('🔍 Contando total de vendedores...');
    const totalVendedores = await Usuario.count({
      where: { 
        role: 'user'
      }
    });
    console.log('✅ Total de vendedores:', totalVendedores);
    
    // Vendedores ativos
    console.log('🔍 Contando vendedores ativos...');
    const vendedoresAtivos = await Usuario.count({
      where: { 
        role: 'user',
        ativo: true,
        suspenso: false
      }
    });
    console.log('✅ Vendedores ativos:', vendedoresAtivos);
    
    // Vendedores suspensos
    console.log('🔍 Contando vendedores suspensos...');
    const vendedoresSuspensos = await Usuario.count({
      where: { 
        role: 'user',
        suspenso: true
      }
    });
    console.log('✅ Vendedores suspensos:', vendedoresSuspensos);
    
    // Vendedores excluídos (inativos)
    console.log('🔍 Contando vendedores excluídos...');
    const vendedoresExcluidos = await Usuario.count({
      where: { 
        role: 'user',
        ativo: false
      }
    });
    console.log('✅ Vendedores excluídos:', vendedoresExcluidos);
    
    // Receita total do sistema
    console.log('🔍 Buscando vendas aprovadas...');
    const vendasAprovadas = await Venda.findAll({
      where: { 
        status: 'Pago'
      },
      attributes: ['valor']
    });
    console.log('✅ Vendas aprovadas encontradas:', vendasAprovadas.length);
    
    const receitaTotal = vendasAprovadas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    console.log('✅ Receita total calculada:', receitaTotal);
    
    // Saldo disponível para vendedores (90% da receita total)
    const saldoDisponivel = receitaTotal * 0.9;
    
    // Buscar saldo do administrador (com tratamento de erro)
    let saldoAdmin = null;
    try {
      saldoAdmin = await SaldoAdmin.findOne();
    } catch (saldoError) {
      console.warn('⚠️ Erro ao buscar saldo do administrador:', saldoError.message);
      // Continuar sem falhar se a tabela não existir
    }
    
    res.json({
      success: true,
      data: {
        sistema: {
          totalVendedores,
          vendedoresAtivos,
          vendedoresSuspensos,
          vendedoresExcluidos,
          receitaTotalSistema: receitaTotal,
          saldoDisponivel
        },
        admin: {
          saldoTotal: saldoAdmin ? parseFloat(saldoAdmin.saldo_total || 0) : 0,
          totalComissoes: saldoAdmin ? parseFloat(saldoAdmin.total_comissoes || 0) : 0,
          totalSaquesPagos: saldoAdmin ? parseFloat(saldoAdmin.total_saques_pagos || 0) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('Erro ao carregar estatísticas de vendedores:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET - Relatório geral para exportação
router.get('/relatorio-geral', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Total de vendedores
    const totalVendedores = await Usuario.count({
      where: { role: 'user' }
    });
    
    // Vendedores ativos
    const vendedoresAtivos = await Usuario.count({
      where: { 
        role: 'user',
        ativo: true
      }
    });
    
    // Receita total do sistema
    const vendasAprovadas = await Venda.findAll({
      where: { 
        status: 'Pago'
      },
      attributes: ['valor']
    });
    
    const receitaTotalSistema = vendasAprovadas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    // Saldo admin (implementar conforme lógica de negócio)
    const saldoAdmin = 0; // Implementar lógica específica
    
    // Total de produtos
    const totalProdutos = await Produto.count();
    
    // Produtos ativos
    const produtosAtivos = await Produto.count({
      where: { ativo: true }
    });
    
    res.json({
      success: true,
      data: {
        totalVendedores,
        vendedoresAtivos,
        receitaTotalSistema,
        saldoAdmin,
        totalProdutos,
        produtosAtivos
      }
    });
    
  } catch (error) {
    console.error('Erro ao gerar relatório geral:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
