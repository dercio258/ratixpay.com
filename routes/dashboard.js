const express = require('express');
const router = express.Router();
const { Venda, Produto, Pedido, Usuario, sequelize } = require('../config/database');
const { authenticateToken, requireAdmin, isAdmin, isVendedorOrAdmin } = require('../middleware/auth');
const Pagamento = require('../config/database').Pagamento; // Added missing import
const EstatisticasService = require('../services/estatisticasService'); // Added missing import
const ReceitaService = require('../services/receitaService'); // Added missing import
const dashboardService = require('../services/dashboardService'); // Dashboard otimizado

// GET - Estatísticas do vendedor logado
router.get('/vendedor/estatisticas', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const { Op } = require('sequelize');
    
    // Status que indicam aprovação (incluindo APROVADO)
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Receita total do vendedor
    const vendasAprovadas = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id
      },
      attributes: ['valor']
    });
    
    const receitaTotal = vendasAprovadas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
         // Total de vendas = vendas aprovadas (conforme solicitado)
     const totalVendas = vendasAprovadas.length;
    
    // Produtos ativos do vendedor
    const produtosAtivos = await Produto.count({ 
      where: { 
        ativo: true,
        vendedor_id: req.user.id
      } 
    });
    
    // Clientes únicos do vendedor
    const clientesUnicos = await Venda.count({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id
      },
      distinct: true,
      col: 'cliente_email'
    });
    
    // Vendas do mês do vendedor
    const vendasMes = await Venda.count({ 
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id,
        created_at: {
          [Op.gte]: inicioMes
        }
      }
    });
    
    // Receita do mês do vendedor
    const vendasMesPagas = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id,
        created_at: {
          [Op.gte]: inicioMes
        }
      },
      attributes: ['valor']
    });
    
    const receitaMes = vendasMesPagas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    // Crescimento comparado ao mês anterior
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    
    const vendasMesAnterior = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id,
        created_at: {
          [Op.between]: [mesAnterior, fimMesAnterior]
        }
      },
      attributes: ['valor']
    });
    
    const receitaMesAnterior = vendasMesAnterior.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    const crescimento = receitaMesAnterior > 0 ? 
      ((receitaMes - receitaMesAnterior) / receitaMesAnterior * 100).toFixed(1) : 0;

    // Métodos de pagamento mais usados pelo vendedor
    const metodosPagamento = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id
      },
      attributes: [
        'metodo_pagamento',
        [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'quantidade'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'valorTotal']
      ],
      group: ['metodo_pagamento'],
      order: [[Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'DESC']]
    });

         // Top produtos vendidos pelo vendedor
     const produtosVendidos = await Venda.sequelize.query(`
       SELECT 
         v.produto_id,
         COUNT(v.id) as quantidade,
         SUM(v.valor) as valorTotal,
         p.nome as produto_nome,
         p.custom_id as produto_custom_id
       FROM vendas v
       LEFT JOIN produtos p ON v.produto_id = p.id
       WHERE v.status IN ('Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid') AND v.vendedor_id = :vendedor_id
       GROUP BY v.produto_id, p.nome, p.custom_id
       ORDER BY COUNT(v.id) DESC
       LIMIT 5
     `, { 
       type: Venda.sequelize.QueryTypes.SELECT,
       replacements: { vendedor_id: req.user.id }
     });

    res.json({
      success: true,
             data: {
         receitaTotal: parseFloat(receitaTotal),
         totalVendas: totalVendas,
         produtosAtivos: produtosAtivos,
        clientesUnicos: clientesUnicos,
        vendasMes: vendasMes,
        receitaMes: parseFloat(receitaMes),
        crescimento: parseFloat(crescimento),
        metodosPagamento: metodosPagamento.map(m => ({
          metodo: m.metodo_pagamento,
          quantidade: parseInt(m.dataValues.quantidade),
          valorTotal: parseFloat(m.dataValues.valorTotal || 0)
        })),
        produtosVendidos: produtosVendidos.map(p => ({
          produto_id: p.produto_id,
          nome: p.produto_nome || 'Produto não encontrado',
          custom_id: p.produto_custom_id || 'N/A',
          quantidade: parseInt(p.quantidade),
          valorTotal: parseFloat(p.valorTotal || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estatísticas do vendedor',
      error: error.message 
    });
  }
});

// GET - Estatísticas gerais do dashboard (apenas admin)
router.get('/estatisticas', authenticateToken, isAdmin, async (req, res) => {
  try {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const { Op } = require('sequelize');
    
    // Status que indicam aprovação (incluindo APROVADO)
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Receita total
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
    
    // Contar vendas aprovadas
    const totalVendasAprovadas = vendasAprovadas.length;
    
    // Produtos ativos
    const produtosAtivos = await Produto.count({ where: { ativo: true } });
    
    // Clientes únicos
    const clientesUnicos = await Venda.count({
      where: { 
        status: {
          [Op.in]: statusAprovados
        }
      },
      distinct: true,
      col: 'cliente_email'
    });
    
    // Vendas do mês
    const vendasMes = await Venda.count({ 
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        created_at: {
          [Op.gte]: inicioMes
        }
      }
    });
    
    // Receita do mês
    const vendasMesPagas = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        created_at: {
          [Op.gte]: inicioMes
        }
      },
      attributes: ['valor']
    });
    
    const receitaMes = vendasMesPagas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    // Crescimento comparado ao mês anterior
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    
    const vendasMesAnterior = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        created_at: {
          [Op.between]: [mesAnterior, fimMesAnterior]
        }
      },
      attributes: ['valor']
    });
    
    const receitaMesAnterior = vendasMesAnterior.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    const crescimento = receitaMesAnterior > 0 ? 
      ((receitaMes - receitaMesAnterior) / receitaMesAnterior * 100).toFixed(1) : 0;

    // Métodos de pagamento mais usados
    const metodosPagamento = await Venda.findAll({
      where: { status: 'Aprovado' },
      attributes: [
        'metodo_pagamento',
        [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'quantidade'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'valorTotal']
      ],
      group: ['metodo_pagamento'],
      order: [[Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'DESC']]
    });

    // Top produtos vendidos
    const produtosVendidos = await Venda.sequelize.query(`
      SELECT 
        v.produto_id,
        COUNT(v.id) as vendas,
        SUM(v.valor) as receita,
        p.nome as produto_nome,
        p.custom_id as produto_custom_id
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE v.status IN ('Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid')
      GROUP BY v.produto_id, p.nome, p.custom_id
      ORDER BY COUNT(v.id) DESC
      LIMIT 10
    `, { type: Venda.sequelize.QueryTypes.SELECT });

    // Formatar dados para resposta
    const metodosPagamentoFormatados = metodosPagamento.map(item => ({
      metodo: item.metodo_pagamento,
      quantidade: parseInt(item.dataValues.quantidade),
      valorTotal: parseFloat(item.dataValues.valorTotal || 0)
    }));

    const produtosVendidosFormatados = produtosVendidos.map(item => ({
      nome: item.produto_nome || 'Produto não encontrado',
      customId: item.produto_custom_id || 'N/A',
      vendas: parseInt(item.vendas),
      receita: parseFloat(item.receita || 0)
    }));

    res.json({
      success: true,
      data: {
        receitaTotal: parseFloat(receitaTotal),
        vendasAprovadas: totalVendasAprovadas,
        produtosAtivos: produtosAtivos,
        totalClientes: clientesUnicos,
        vendasMes: vendasMes,
        receitaMes: parseFloat(receitaMes),
        crescimentoMes: parseFloat(crescimento),
        metodosPagamento: metodosPagamentoFormatados,
        produtosVendidos: produtosVendidosFormatados
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar estatísticas',
      error: error.message 
    });
  }
});

// GET - Vendas da semana (para gráfico - filtradas por vendedor se autenticado)
router.get('/vendas-semana', authenticateToken, async (req, res) => {
  try {
    const hoje = new Date();
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - 7);
    const { Op } = require('sequelize');
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    const where = {
      status: 'Aprovado',
      created_at: {
        [Op.gte]: inicioSemana
      }
    };
    
    // Filtrar por vendedor se não for admin
    if (!isAdmin) {
      where.vendedor_id = req.user.id;
    }
    
    const vendas = await Venda.findAll({
      where,
      attributes: [
        [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'data'],
        [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'vendas'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'receita']
      ],
      group: [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at'))],
      order: [[Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'ASC']]
    });
    
    // Preencher dias sem vendas com zero
    const vendasPorDia = {};
    for (let i = 0; i < 7; i++) {
      const data = new Date(inicioSemana);
      data.setDate(inicioSemana.getDate() + i);
      const dataStr = data.toISOString().split('T')[0];
      vendasPorDia[dataStr] = {
        _id: dataStr,
        vendas: 0,
        receita: 0
      };
    }
    
    vendas.forEach(venda => {
      const dataStr = venda.dataValues.data;
      vendasPorDia[dataStr] = {
        _id: dataStr,
        vendas: parseInt(venda.dataValues.vendas),
        receita: parseFloat(venda.dataValues.receita || 0)
      };
    });
    
    res.json({
      success: true,
      data: Object.values(vendasPorDia)
    });
  } catch (error) {
    console.error('Erro ao buscar vendas da semana:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar vendas da semana',
      error: error.message 
    });
  }
});

// GET - Últimas vendas (filtradas por vendedor se autenticado)
router.get('/ultimas-vendas', authenticateToken, async (req, res) => {
  try {
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    const where = { status: 'Aprovado' };
    
    // Filtrar por vendedor se não for admin
    if (!isAdmin) {
      where.vendedor_id = req.user.id;
    }
    
    const vendas = await Venda.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    const ultimasVendas = vendas.map(venda => venda.toJSON());
    
    res.json({
      success: true,
      data: ultimasVendas
    });
  } catch (error) {
    console.error('Erro ao buscar últimas vendas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar últimas vendas',
      error: error.message 
    });
  }
});

// GET - Últimas transações detalhadas com paginação (filtradas por vendedor se autenticado)
router.get('/ultimas-transacoes', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    let whereClause = {};
    
    // Filtrar por vendedor se não for admin
    if (!isAdmin) {
      whereClause.vendedor_id = req.user.id;
    }
    
    // Buscar total de transações para paginação
    const totalTransacoes = await Venda.count({ where: whereClause });
    const totalPages = Math.ceil(totalTransacoes / limit);
    
    // Buscar transações paginadas com includes otimizados e timeout
    const ultimasTransacoes = await Venda.findAll({
      where: whereClause,
      include: [
        {
          model: Produto,
          as: 'produto',
          attributes: ['id', 'nome', 'custom_id', 'public_id', 'tipo', 'imagem_url', 'preco'],
          required: false // LEFT JOIN para incluir vendas mesmo se produto não existir
        },
        {
          model: Usuario,
          as: 'vendedorVenda',
          attributes: ['nome_completo', 'email', 'telefone'],
          required: false // LEFT JOIN para incluir vendas mesmo se vendedor não existir
        }
      ],
      order: [[sequelize.literal('"Venda"."created_at"'), 'DESC']], // Usar alias "Venda" que o Sequelize cria para a tabela "vendas"
      limit: parseInt(limit),
      offset: parseInt(offset),
      timeout: 10000 // 10 segundos de timeout
    });
    
    // Processando transações encontradas
    
    // Log para debug - verificar se os includes estão funcionando
    if (ultimasTransacoes.length > 0) {
      const primeiraVenda = ultimasTransacoes[0].toJSON();
      // Debug - Primeira venda processada
    }
    
    // Processar transações de forma mais eficiente (sem Promise.all para evitar timeout)
    const transacoesFormatadas = [];
    
    for (const t of ultimasTransacoes) {
      try {
        const venda = t.toJSON();
        
        // Buscar número do pedido relacionado (otimizado - sem consulta adicional se possível)
        let numeroPedido = venda.referencia_pagamento || null;
        
        // Formatar valores monetários
        const valorVenda = parseFloat(venda.valor || 0);
        const valorFormatado = isNaN(valorVenda) ? 0 : valorVenda;
        
        // Determinar ponto de venda
        let pontoVenda = 'Site';
        if (venda.canal_venda) {
          pontoVenda = venda.canal_venda;
        } else if (venda.utm_source) {
          pontoVenda = `Campanha: ${venda.utm_source}`;
        }
        
        transacoesFormatadas.push({
          id: venda.id,
          transacao_id: venda.referencia_pagamento || `VENDA-${venda.public_id}`,
          referencia_pagamento: numeroPedido,
          produto: {
            nome: venda.produto?.nome || 'Produto não encontrado',
            custom_id: venda.produto?.custom_id || 'N/A',
            tipo: venda.produto?.tipo || 'N/A',
            preco: venda.produto?.preco || valorFormatado,
            imagem: venda.produto?.imagem_url || venda.produto?.imagem || null
          },
          vendedor: {
            nome: venda.vendedorVenda?.nome_completo || 'Vendedor não encontrado',
            email: venda.vendedorVenda?.email || 'N/A',
            telefone: venda.vendedorVenda?.telefone || 'N/A'
          },
          cliente: {
            nome: venda.cliente_nome || 'Cliente não informado',
            email: venda.cliente_email || 'Email não informado',
            telefone: venda.cliente_telefone || 'Telefone não informado',
            whatsapp: venda.cliente_whatsapp || null, // Adicionar campo WhatsApp
            cidade: venda.cliente_cidade || 'Cidade não informada',
            pais: venda.cliente_pais || 'País não informado'
          },
          pagamento: {
            metodo: venda.metodo_pagamento || 'Método não informado',
            valor: valorFormatado,
            valor_formatado: `MZN ${valorFormatado.toFixed(2)}`,
            status: venda.status || 'Status não informado',
            data_processamento: venda.data_pagamento || venda.createdAt || venda.created_at || new Date().toISOString(),
            referencia: venda.referencia_pagamento || 'N/A'
          },
          ponto_venda: pontoVenda,
          dispositivo: venda.cliente_dispositivo || 'Não identificado',
          navegador: venda.cliente_navegador || 'Não identificado',
          canal_venda: venda.canal_venda || 'Site',
          utm_source: venda.utm_source || null,
          utm_medium: venda.utm_medium || null,
          utm_campaign: venda.utm_campaign || null,
          created_at: venda.createdAt || venda.created_at || venda.data_pagamento || new Date().toISOString(),
          createdAt: venda.createdAt || venda.created_at || venda.data_pagamento || new Date().toISOString(),
          status: venda.status || 'Pendente',
          ip_cliente: venda.cliente_ip || 'N/A',
          user_agent: venda.cliente_user_agent || 'N/A'
        });
      } catch (error) {
        console.error(`❌ Erro ao formatar transação ${t.id}:`, error);
        transacoesFormatadas.push({
          id: t.id,
          erro: 'Erro ao processar transação',
          message: error.message
        });
      }
    }
    
    // Filtrar transações com erro
    const transacoesValidas = transacoesFormatadas.filter(t => !t.erro);
    const transacoesComErro = transacoesFormatadas.filter(t => t.erro);
    
    if (transacoesComErro.length > 0) {
      console.warn(`⚠️ ${transacoesComErro.length} transações tiveram erro no processamento`);
    }
    
    console.log(`✅ ${transacoesValidas.length} transações formatadas com sucesso`);
    
    res.json({
      success: true,
      data: {
        transacoes: transacoesValidas,
        totalTransacoes: totalTransacoes,
        totalPages: totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
        transacoesComErro: transacoesComErro.length
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar últimas transações:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao buscar últimas transações',
      message: error.message 
    });
  }
});

// GET - Análise de tráfego e conversão (filtrada por vendedor se autenticado)
router.get('/analise-trafico', authenticateToken, async (req, res) => {
  try {
    const pool = require('../config/database').getPool();
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    let whereClause = '';
    let replacements = {};
    
    // Filtrar por vendedor se não for admin
    if (!isAdmin) {
      whereClause = 'WHERE vendedor_id = :vendedor_id';
      replacements.vendedor_id = req.user.id;
    }
    
    // Análise por origem de tráfego
    const origemTraficoResult = await pool.query(`
      SELECT 
        COALESCE(origem_trafico, 'Direto') as origem,
        COUNT(*) as total_vendas,
        SUM(CASE WHEN status = 'Aprovada' THEN 1 ELSE 0 END) as vendas_aprovadas,
        SUM(CASE WHEN status = 'Aprovada' THEN valor ELSE 0 END) as receita
      FROM vendas
      ${whereClause}
      GROUP BY origem_trafico
      ORDER BY total_vendas DESC
    `, { replacements });

    // Análise por UTM Source
    const utmSourceResult = await pool.query(`
      SELECT 
        COALESCE(utm_source, 'Direto') as utm_source,
        COUNT(*) as total_vendas,
        SUM(CASE WHEN status = 'Aprovada' THEN 1 ELSE 0 END) as vendas_aprovadas,
        SUM(CASE WHEN status = 'Aprovada' THEN valor ELSE 0 END) as receita
      FROM vendas
      ${whereClause}
      GROUP BY utm_source
      ORDER BY total_vendas DESC
    `, { replacements });

    res.json({
      origem_trafico: origemTraficoResult.rows,
      utm_source: utmSourceResult.rows
    });
  } catch (error) {
    console.error('Erro ao buscar análise de tráfego:', error);
    res.status(500).json({ erro: 'Erro ao buscar análise de tráfego' });
  }
});

// GET - Clientes do vendedor logado
router.get('/vendedor/clientes', authenticateToken, async (req, res) => {
  try {
    const { status, dataInicio, dataFim, busca } = req.query;
    const { Op } = require('sequelize');
    
    // Construir condições de busca
    const where = {
      vendedor_id: req.user.id
    };
    
    if (status && status !== 'Todos') {
      where.status = status;
    }
    
    if (dataInicio && dataFim) {
      where.created_at = {
        [Op.between]: [new Date(dataInicio), new Date(dataFim)]
      };
    }
    
    if (busca) {
      where[Op.or] = [
        { cliente_nome: { [Op.like]: `%${busca}%` } },
        { cliente_email: { [Op.like]: `%${busca}%` } },
        { cliente_telefone: { [Op.like]: `%${busca}%` } },
        { cliente_whatsapp: { [Op.like]: `%${busca}%` } } // Adicionar busca por WhatsApp
      ];
    }
    
         // Buscar vendas do vendedor agrupadas por cliente
     const vendas = await Venda.findAll({
       where,
      attributes: [
        'cliente_nome',
        'cliente_email',
        'cliente_telefone',
        'cliente_whatsapp', // Adicionar campo WhatsApp
        [Venda.sequelize.fn('COUNT', Venda.sequelize.col('Venda.id')), 'totalCompras'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('Venda.valor')), 'valorTotalGasto'],
        [Venda.sequelize.fn('MAX', Venda.sequelize.col('Venda.created_at')), 'ultimaCompra']
      ],
       group: ['cliente_email'],
       order: [[Venda.sequelize.fn('SUM', Venda.sequelize.col('Venda.valor')), 'DESC']],
       limit: 20
     });
    
    const clientes = vendas.map(venda => ({
      nome: venda.cliente_nome || 'Cliente não identificado',
      email: venda.cliente_email,
      telefone: venda.cliente_telefone || 'Não informado',
      whatsapp: venda.cliente_whatsapp || null, // Adicionar campo WhatsApp
      totalCompras: parseInt(venda.dataValues.totalCompras),
      valorTotalGasto: parseFloat(venda.dataValues.valorTotalGasto || 0),
      ultimaCompra: venda.dataValues.ultimaCompra
    }));
    
    res.json({
      success: true,
      data: {
        clientes
      }
    });
  } catch (error) {
    console.error('Erro ao buscar clientes do vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar clientes do vendedor',
      error: error.message 
    });
  }
});

// GET - Produtos mais vendidos do vendedor logado
router.get('/vendedor/produtos', authenticateToken, async (req, res) => {
  try {
    const { status, dataInicio, dataFim } = req.query;
    const { Op } = require('sequelize');
    
    // Construir condições de busca
    const where = {
      vendedor_id: req.user.id
    };
    
    if (status && status !== 'Todos') {
      where.status = status;
    }
    
    if (dataInicio && dataFim) {
      where.created_at = {
        [Op.between]: [new Date(dataInicio), new Date(dataFim)]
      };
    }
    
         // Buscar vendas do vendedor com produtos
     const vendas = await Venda.sequelize.query(`
       SELECT 
         v.produto_id,
         COUNT(v.id) as quantidadeVendida,
         SUM(v.valor) as receitaPorProduto,
         p.nome as produto_nome,
         p.custom_id as produto_custom_id
       FROM vendas v
       LEFT JOIN produtos p ON v.produto_id = p.id
       WHERE v.vendedor_id = :vendedor_id
       GROUP BY v.produto_id, p.nome, p.custom_id
       ORDER BY COUNT(v.id) DESC
       LIMIT 10
     `, { 
       type: Venda.sequelize.QueryTypes.SELECT,
       replacements: { vendedor_id: req.user.id }
     });
    
    const produtos = vendas.map(venda => ({
      nome: venda.produto_nome || 'Produto não encontrado',
      custom_id: venda.produto_custom_id || 'N/A',
      quantidadeVendida: parseInt(venda.quantidadeVendida),
      receitaPorProduto: parseFloat(venda.receitaPorProduto || 0)
    }));
    
    res.json({
      success: true,
      data: {
        produtos
      }
    });
  } catch (error) {
    console.error('Erro ao buscar produtos do vendedor:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar produtos do vendedor',
      error: error.message 
    });
  }
});

// GET - Produtos mais vendidos (apenas produtos ativos e públicos)
router.get('/produtos-populares', async (req, res) => {
  try {
    // Buscar apenas produtos ativos e públicos
    const produtos = await Produto.findAll({
      where: {
        ativo: true,
        publico: true // Adicionar filtro para produtos públicos
      },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'vendedor_id']
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });
    
    // Formatar dados para resposta
    const produtosFormatados = produtos.map(produto => ({
      id: produto.id,
      custom_id: produto.custom_id,
      nome: produto.nome,
      tipo: produto.tipo,
      categoria: produto.categoria,
      preco: produto.preco,
      preco_com_desconto: produto.preco_com_desconto,
      descricao: produto.descricao,
      vendedor: {
        id: produto.vendedor?.id,
        nome: produto.vendedor?.nome_completo,
        vendedor_id: produto.vendedor?.vendedor_id
      }
    }));
    
    res.json(produtosFormatados);
  } catch (error) {
    console.error('Erro ao buscar produtos populares:', error);
    res.status(500).json({ erro: 'Erro ao buscar produtos populares' });
  }
});

// GET - Métodos de pagamento mais usados (filtrados por vendedor se autenticado)
router.get('/metodos-pagamento', authenticateToken, async (req, res) => {
  try {
    const pool = require('../config/database').getPool();
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    let whereClause = 'WHERE status = \'Aprovado\'';
    let replacements = {};
    
    // Filtrar por vendedor se não for admin
    if (!isAdmin) {
      whereClause += ' AND vendedor_id = :vendedor_id';
      replacements.vendedor_id = req.user.id;
    }
    
    const metodosResult = await pool.query(`
      SELECT 
        metodo_pagamento,
        COUNT(id) as quantidade,
        SUM(valor) as valor_total
      FROM vendas
      ${whereClause}
      GROUP BY metodo_pagamento
      ORDER BY quantidade DESC
    `, { replacements });
    
    res.json(metodosResult.rows);
  } catch (error) {
    console.error('Erro ao buscar métodos de pagamento:', error);
    res.status(500).json({ erro: 'Erro ao buscar métodos de pagamento' });
  }
});

// GET - Resumo de vendas do vendedor logado (versão corrigida)
router.get('/vendedor/resumo', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Buscando resumo do vendedor ${req.user.id}...`);
    console.log(`📋 Query params:`, req.query);
    
    // Verificar se o usuário tem as propriedades necessárias
    if (!req.user || !req.user.id) {
      console.error('❌ Usuário inválido na requisição');
      return res.status(400).json({
        success: false,
        message: 'Usuário inválido'
      });
    }
    
    const { periodo = 'hoje' } = req.query;
    const { Op } = require('sequelize');
    
    // Calcular período baseado no parâmetro
    const agora = new Date();
    let inicioPeriodo;
    let fimPeriodo = new Date();

    switch (periodo) {
      case 'hoje':
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
        break;
      case 'ontem':
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
        fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        break;
      case '7dias':
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7);
        break;
      case '30dias':
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 30);
        break;
      default:
        // Se período não reconhecido, usar hoje como padrão
        inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
        fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
    }
    
    console.log(`📅 Período selecionado: ${periodo} (${inicioPeriodo.toISOString()} - ${fimPeriodo.toISOString()})`);
    
    // Buscar TODAS as vendas do vendedor (sem filtro de período para estatísticas totais)
    const todasVendas = await Venda.findAll({
      where: { vendedor_id: req.user.id },
      attributes: ['id', 'status', 'valor', 'created_at']
    });
    
    // Buscar vendas do período específico
    const vendasPeriodo = await Venda.findAll({
      where: {
        vendedor_id: req.user.id,
        created_at: {
          [Op.gte]: inicioPeriodo,
          [Op.lt]: fimPeriodo
        }
      },
      attributes: ['id', 'status', 'valor', 'created_at']
    });
    
    console.log(`📊 Total de vendas: ${todasVendas.length}, Vendas no período: ${vendasPeriodo.length}`);
    
    // Status que indicam aprovação (incluindo APROVADO)
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Calcular estatísticas TOTAIS (todas as vendas)
    const totalVendas = todasVendas.length;
    const totalVendasAprovadas = todasVendas.filter(v => statusAprovados.includes(v.status)).length;
    const totalVendasPendentes = todasVendas.filter(v => v.status === 'Pendente').length;
    const totalVendasCanceladas = todasVendas.filter(v => v.status === 'Cancelada').length;
    
    console.log(`📊 Estatísticas totais: Total=${totalVendas}, Aprovadas=${totalVendasAprovadas}, Pendentes=${totalVendasPendentes}, Canceladas=${totalVendasCanceladas}`);
    
    const receitaTotal = todasVendas
      .filter(v => statusAprovados.includes(v.status))
      .reduce((total, v) => total + parseFloat(v.valor || 0), 0);
    
    const valorReembolsos = todasVendas
      .filter(v => v.status === 'Cancelada')
      .reduce((total, v) => total + parseFloat(v.valor || 0), 0);
    
    // Calcular estatísticas do PERÍODO específico
    const vendasAprovadasPeriodo = vendasPeriodo.filter(v => statusAprovados.includes(v.status)).length;
    const vendasPendentesPeriodo = vendasPeriodo.filter(v => v.status === 'Pendente').length;
    const vendasCanceladasPeriodo = vendasPeriodo.filter(v => v.status === 'Cancelada').length;
    
    // statusAprovados já declarado acima
    const receitaPeriodo = vendasPeriodo
      .filter(v => statusAprovados.includes(v.status))
      .reduce((total, v) => total + parseFloat(v.valor || 0), 0);
    
    console.log(`📊 Estatísticas do período ${periodo}: Aprovadas=${vendasAprovadasPeriodo}, Pendentes=${vendasPendentesPeriodo}, Canceladas=${vendasCanceladasPeriodo}, Receita=${receitaPeriodo}`);
    
    // Calcular receita disponível (receita total - saques já processados)
    let receitaDisponivel = receitaTotal;
    try {
      // Buscar o email do vendedor para fazer a consulta
      const vendedor = await Usuario.findByPk(req.user.id, {
        attributes: ['email']
      });
      
      if (vendedor && vendedor.email) {
        const saquesProcessados = await sequelize.query(`
          SELECT COALESCE(SUM(valor_solicitado), 0) as total_saques
          FROM historico_saques 
          WHERE vendedor_id = :vendedorId 
          AND status = 'pago'
        `, {
          replacements: { vendedorId: req.user.id },
          type: sequelize.QueryTypes.SELECT
        });
        
        const totalSaques = parseFloat(saquesProcessados[0]?.total_saques || 0);
        receitaDisponivel = Math.max(0, receitaTotal - totalSaques);
        
        console.log(`💰 Receita total: ${receitaTotal} MZN, Saques processados: ${totalSaques} MZN, Disponível: ${receitaDisponivel} MZN`);
      } else {
        console.log('⚠️ Vendedor não encontrado, usando receita total como disponível');
      }
    } catch (saquesError) {
      console.error('❌ Erro ao calcular saques:', saquesError);
      // Manter receita total como disponível se houver erro
    }
    
    // Resumo do vendedor carregado com sucesso

    res.json({
      success: true,
      data: {
        // Estatísticas totais (todas as vendas)
        totalVendas: totalVendas,
        vendasAprovadas: totalVendasAprovadas,
        vendasPendentes: totalVendasPendentes,
        vendasCanceladas: totalVendasCanceladas,
        receitaTotal: parseFloat(receitaTotal),
        receitaDisponivel: parseFloat(receitaDisponivel),
        valorReembolsos: parseFloat(valorReembolsos),
        
        // Estatísticas do período específico
        periodo: {
          nome: periodo,
          vendasAprovadas: vendasAprovadasPeriodo,
          vendasPendentes: vendasPendentesPeriodo,
          vendasCanceladas: vendasCanceladasPeriodo,
          receita: parseFloat(receitaPeriodo),
          inicio: inicioPeriodo.toISOString(),
          fim: fimPeriodo.toISOString()
        },
        
        ultimaAtualizacao: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar resumo do vendedor:', error);
    console.error('📋 Stack trace:', error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar resumo do vendedor',
      error: error.message 
    });
  }
});

// GET - Resumo de vendas por período
router.get('/resumo-periodo', async (req, res) => {
  try {
    const { periodo = '30' } = req.query;
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - parseInt(periodo));
    
    const pool = require('../config/database').getPool();
    
    const resumoResult = await pool.query(`
      SELECT 
        COUNT(id) as total_vendas,
        SUM(CASE WHEN status IN ('Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid') THEN 1 ELSE 0 END) as vendas_aprovadas,
        SUM(CASE WHEN status = 'Pendente' THEN 1 ELSE 0 END) as vendas_pendentes,
        SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as vendas_rejeitadas,
        SUM(CASE WHEN status IN ('Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid') THEN valor ELSE 0 END) as receita_total,
        AVG(CASE WHEN status IN ('Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid') THEN valor ELSE NULL END) as ticket_medio
      FROM vendas
      WHERE created_at >= $1
    `, [dataInicio.toISOString()]);
    
    res.json(resumoResult.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar resumo do período:', error);
    res.status(500).json({ erro: 'Erro ao buscar resumo do período' });
  }
});

// Rota duplicada removida - usar routes/admin-dashboard.js

// GET - Gráfico de vendas semanais (apenas vendas aprovadas)
router.get('/vendedor/grafico-vendas-semanais', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const hoje = new Date();
    const { Op } = require('sequelize');
    
    // Calcular início da semana (segunda-feira)
    const diaSemana = hoje.getDay(); // 0 = domingo, 1 = segunda, etc.
    const diasParaSegunda = diaSemana === 0 ? 6 : diaSemana - 1; // Se for domingo, voltar 6 dias
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - diasParaSegunda);
    inicioSemana.setHours(0, 0, 0, 0);
    
    // Calcular fim da semana (domingo)
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);
    
    console.log(`📊 Buscando vendas da semana: ${inicioSemana.toISOString()} até ${fimSemana.toISOString()}`);
    
    // Status que indicam aprovação (incluindo APROVADO)
    // Op já foi declarado acima
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Buscar vendas aprovadas da semana atual
    const vendasSemana = await Venda.findAll({
      where: {
        vendedor_id: req.user.id,
        status: {
          [Op.in]: statusAprovados
        },
        created_at: {
          [Op.between]: [inicioSemana, fimSemana]
        }
      },
      attributes: [
        [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'data'],
        [Venda.sequelize.fn('COUNT', Venda.sequelize.col('id')), 'quantidade'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'valor']
      ],
      group: [Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at'))],
      order: [[Venda.sequelize.fn('DATE', Venda.sequelize.col('created_at')), 'ASC']]
    });
    
    // Criar array com todos os dias da semana
    const diasSemana = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    const vendasPorDia = [];
    
    for (let i = 0; i < 7; i++) {
      const data = new Date(inicioSemana);
      data.setDate(inicioSemana.getDate() + i);
      const dataStr = data.toISOString().split('T')[0];
      
      // Encontrar vendas para este dia
      const vendasDia = vendasSemana.find(v => v.dataValues.data === dataStr);
      
      vendasPorDia.push({
        dia: diasSemana[i],
        data: dataStr,
        quantidade: vendasDia ? parseInt(vendasDia.dataValues.quantidade) : 0,
        valor: vendasDia ? parseFloat(vendasDia.dataValues.valor || 0) : 0
      });
    }
    
    res.json({
      success: true,
      data: {
        vendasSemanais: vendasPorDia,
        periodo: {
          inicio: inicioSemana.toISOString(),
          fim: fimSemana.toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar gráfico de vendas semanais:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar gráfico de vendas semanais',
      error: error.message 
    });
  }
});

// GET - Gráfico de vendas do vendedor (NOVA LÓGICA: Receita Disponível por hora)
router.get('/vendedor/grafico-vendas', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { periodo = 'hoje' } = req.query;
    const hoje = new Date();
    const { Op } = require('sequelize');
    
    let inicioPeriodo, fimPeriodo;
    
    // Definir período baseado no parâmetro
    switch (periodo) {
      case 'hoje':
        inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
        fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      case 'ontem':
        const ontem = new Date(hoje.getTime() - 24 * 60 * 60 * 1000);
        inicioPeriodo = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 0, 0, 0);
        fimPeriodo = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59);
        break;
      case '7dias':
        inicioPeriodo = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        fimPeriodo = new Date(hoje);
        break;
      case '30dias':
        inicioPeriodo = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        fimPeriodo = new Date(hoje);
        break;
      default:
        inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
        fimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    }
    
    console.log(`📊 Buscando receita disponível para período: ${periodo} (${inicioPeriodo.toISOString()} até ${fimPeriodo.toISOString()})`);
    
    // Status que indicam aprovação (incluindo APROVADO)
    // Op já foi declarado acima
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Buscar vendas aprovadas no período
    const vendasPeriodo = await Venda.findAll({
      where: {
        vendedor_id: req.user.id,
        status: {
          [Op.in]: statusAprovados
        },
        created_at: {
          [Op.between]: [inicioPeriodo, fimPeriodo]
        }
      },
      attributes: [
        [Venda.sequelize.fn('DATE_TRUNC', 'hour', Venda.sequelize.col('created_at')), 'hora'],
        [Venda.sequelize.fn('SUM', Venda.sequelize.col('valor')), 'valor_vendas']
      ],
      group: [Venda.sequelize.fn('DATE_TRUNC', 'hour', Venda.sequelize.col('created_at'))],
      order: [[Venda.sequelize.fn('DATE_TRUNC', 'hour', Venda.sequelize.col('created_at')), 'ASC']]
    });
    
    // Buscar saques processados no período
    const saquesPeriodo = await Pagamento.findAll({
      where: {
        vendedor_id: req.user.id,
        status: 'pago',
        data_pagamento: {
          [Op.between]: [inicioPeriodo, fimPeriodo]
        }
      },
      attributes: [
        [Pagamento.sequelize.fn('DATE_TRUNC', 'hour', Pagamento.sequelize.col('data_pagamento')), 'hora'],
        [Pagamento.sequelize.fn('SUM', Pagamento.sequelize.col('valor_liquido')), 'valor_saques']
      ],
      group: [Pagamento.sequelize.fn('DATE_TRUNC', 'hour', Pagamento.sequelize.col('data_pagamento'))],
      order: [[Pagamento.sequelize.fn('DATE_TRUNC', 'hour', Pagamento.sequelize.col('data_pagamento')), 'ASC']]
    });
    
    // Criar mapa de dados por hora
    const dadosPorHora = new Map();
    
    // Processar vendas
    vendasPeriodo.forEach(venda => {
      const hora = new Date(venda.dataValues.hora);
      const chave = hora.toISOString();
      if (!dadosPorHora.has(chave)) {
        dadosPorHora.set(chave, {
          hora: hora,
          vendas: 0,
          saques: 0,
          receitaDisponivel: 0
        });
      }
      dadosPorHora.get(chave).vendas = parseFloat(venda.dataValues.valor_vendas || 0);
    });
    
    // Processar saques
    saquesPeriodo.forEach(saque => {
      const hora = new Date(saque.dataValues.hora);
      const chave = hora.toISOString();
      if (!dadosPorHora.has(chave)) {
        dadosPorHora.set(chave, {
          hora: hora,
          vendas: 0,
          saques: 0,
          receitaDisponivel: 0
        });
      }
      dadosPorHora.get(chave).saques = parseFloat(saque.dataValues.valor_saques || 0);
    });
    
    // Calcular receita disponível acumulada
    let receitaAcumulada = 0;
    const dadosOrdenados = Array.from(dadosPorHora.values())
      .sort((a, b) => a.hora - b.hora)
      .map(dado => {
        receitaAcumulada += dado.vendas - dado.saques;
        dado.receitaDisponivel = Math.max(0, receitaAcumulada); // Garantir que nunca seja negativo
        
        // Formatar hora baseado no período
        let horaFormatada;
        if (periodo === 'hoje' || periodo === 'ontem') {
          // Para períodos de hoje/ontem, mostrar apenas hora
          horaFormatada = dado.hora.toLocaleString('pt-BR', { 
            hour: '2-digit'
          }) + 'h';
        } else {
          // Para períodos de 7dias/30dias, mostrar data
          horaFormatada = dado.hora.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit'
          });
        }
        
        return {
          hora: horaFormatada,
          receitaDisponivel: Math.max(0, dado.receitaDisponivel), // Garantir que nunca seja negativo
          vendas: Math.max(0, dado.vendas), // Garantir que nunca seja negativo
          saques: Math.max(0, dado.saques) // Garantir que nunca seja negativo
        };
      });
    
    // Se não há dados, criar dados de exemplo baseado no período
    if (dadosOrdenados.length === 0) {
      const agora = new Date();
      
      if (periodo === 'hoje' || periodo === 'ontem') {
        // Para hoje/ontem, criar 24 horas
        for (let i = 0; i < 24; i++) {
          const hora = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), i, 0, 0);
          dadosOrdenados.push({
            hora: `${i.toString().padStart(2, '0')}h`,
            receitaDisponivel: 0,
            vendas: 0,
            saques: 0
          });
        }
      } else if (periodo === '7dias') {
        // Para 7 dias, criar 7 dias
        for (let i = 6; i >= 0; i--) {
          const data = new Date(agora.getTime() - i * 24 * 60 * 60 * 1000);
          dadosOrdenados.push({
            hora: data.toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit' 
            }),
            receitaDisponivel: 0,
            vendas: 0,
            saques: 0
          });
        }
      } else if (periodo === '30dias') {
        // Para 30 dias, criar 30 dias
        for (let i = 29; i >= 0; i--) {
          const data = new Date(agora.getTime() - i * 24 * 60 * 60 * 1000);
          dadosOrdenados.push({
            hora: data.toLocaleDateString('pt-BR', { 
              day: '2-digit', 
              month: '2-digit' 
            }),
            receitaDisponivel: 0,
            vendas: 0,
            saques: 0
          });
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        labels: dadosOrdenados.map(d => d.hora),
        data: dadosOrdenados.map(d => d.receitaDisponivel),
        vendas: dadosOrdenados.map(d => d.vendas),
        saques: dadosOrdenados.map(d => d.saques),
        periodo: periodo,
        totalPontos: dadosOrdenados.length
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar gráfico de receita disponível:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar gráfico de receita disponível',
      error: error.message 
    });
  }
});

// GET - Receita total unificada (NOVA LÓGICA: receita total 100% disponível para saques)
router.get('/vendedor/receita-unificada', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    // Status que indicam aprovação (incluindo APROVADO)
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Buscar vendas aprovadas do vendedor
    const vendasAprovadas = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id
      },
      attributes: ['valor']
    });
    
    // Calcular receita total das vendas
    const receitaTotalVendas = vendasAprovadas.reduce((total, venda) => {
      return total + parseFloat(venda.valor || 0);
    }, 0);
    
    console.log(`📊 Vendas aprovadas encontradas: ${vendasAprovadas.length}`);
    console.log(`💰 Receita total das vendas: MZN ${receitaTotalVendas.toFixed(2)}`);
    
    // Buscar saques processados (pagos) do vendedor (apenas para histórico)
    const saquesProcessados = await Pagamento.findAll({
      where: { 
        vendedor_id: req.user.id,
        status: {
          [Op.in]: ['aprovado', 'pago']
        }
      },
      attributes: ['valor']
    });
    
    // Calcular valor total dos saques processados (apenas para histórico)
    const valorSaquesProcessados = saquesProcessados.reduce((total, saque) => {
      return total + parseFloat(saque.valor || 0);
    }, 0);
    
    console.log(`📤 Saques processados encontrados: ${saquesProcessados.length}`);
    console.log(`💸 Valor total dos saques processados: MZN ${valorSaquesProcessados.toFixed(2)}`);
    
    // LÓGICA CORRETA: A receita disponível é o total das vendas menos os saques processados
    const receitaDisponivel = Math.max(0, receitaTotalVendas - valorSaquesProcessados);
    
    console.log(`💳 Receita disponível calculada: MZN ${receitaDisponivel.toFixed(2)}`);
    
    // Buscar estatísticas do vendedor
    const estatisticas = await EstatisticasService.buscarEstatisticasVendedor(req.user.id);
    
    res.json({
      success: true,
      data: {
        receitaTotal: parseFloat(receitaTotalVendas),           // Total das vendas aprovadas
        receitaDisponivel: parseFloat(receitaDisponivel),       // 100% disponível para saques
        valorSaquesProcessados: parseFloat(valorSaquesProcessados), // Apenas para histórico
        totalVendas: vendasAprovadas.length,
        totalSaquesProcessados: saquesProcessados.length,
        ultimaAtualizacao: estatisticas?.ultima_atualizacao || new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar receita unificada:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Receita para página de gestão de vendas (consistente com painel e pagamento)
router.get('/vendedor/receita-gestao-vendas', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    console.log(`🔄 Buscando receita para gestão de vendas - vendedor ${req.user.id}...`);
    
    // Usar ReceitaService para garantir sincronização
    const receitaAtualizada = await ReceitaService.buscarReceitaTotal(req.user.id);
    
    console.log(`✅ Receita gestão vendas: Total ${receitaAtualizada.receitaTotal}, Disponível ${receitaAtualizada.receitaDisponivel}`);
    
    res.json({
      success: true,
      data: {
        receitaTotal: parseFloat(receitaAtualizada.receitaTotal || 0),
        receitaDisponivel: parseFloat(receitaAtualizada.receitaDisponivel || 0),
        totalVendas: parseInt(receitaAtualizada.totalVendas || 0),
        valorSaquesProcessados: parseFloat(receitaAtualizada.valorSaquesProcessados || 0),
        ultimaAtualizacao: receitaAtualizada.ultimaAtualizacao
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar receita para gestão de vendas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar receita para gestão de vendas',
      error: error.message
    });
  }
});

// GET - Endpoint unificado para receita (usado por todas as páginas)
router.get('/vendedor/receita-unificada-todas-paginas', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    console.log(`🔄 Buscando receita unificada para todas as páginas - vendedor ${req.user.id}...`);
    
    // Usar EstatisticasService para obter dados completos
    const EstatisticasService = require('../services/estatisticasService');
    
    // Atualizar estatísticas primeiro
    await EstatisticasService.atualizarEstatisticasVendedor(req.user.id);
    
    // Buscar estatísticas atualizadas
    const estatisticas = await EstatisticasService.buscarEstatisticasVendedor(req.user.id);
    
    console.log(`✅ Estatísticas completas: Total ${estatisticas.total_vendas}, Aprovadas ${estatisticas.vendas_aprovadas}, Pendentes ${estatisticas.vendas_pendentes}, Canceladas ${estatisticas.vendas_canceladas}`);
    
    res.json({
      success: true,
      data: {
        receitaTotal: parseFloat(estatisticas.receita_total || 0),
        receitaDisponivel: parseFloat(estatisticas.receita_disponivel || 0),
        valorSaquesProcessados: parseFloat(estatisticas.valor_saques_pagos || 0),
        totalVendas: parseInt(estatisticas.total_vendas || 0),
        vendasAprovadas: parseInt(estatisticas.vendas_aprovadas || 0),
        vendasPendentes: parseInt(estatisticas.vendas_pendentes || 0),
        vendasCanceladas: parseInt(estatisticas.vendas_canceladas || 0),
        ultimaAtualizacao: estatisticas.ultima_atualizacao,
        fonte: 'EstatisticasService - Completo'
      }
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar receita unificada:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar receita unificada',
      error: error.message
    });
  }
});

// GET - Listar pontos de venda do vendedor
router.get('/pontos-venda', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    console.log(`🔄 Listando pontos de venda do vendedor ${vendedorId}...`);
    
    const { PontoVenda } = require('../config/database');
    
    const pontosVenda = await PontoVenda.findAll({
      where: { 
        vendedor_id: vendedorId,
        ativo: true
      },
      order: [['created_at', 'DESC']]
    });
    
    console.log(`✅ ${pontosVenda.length} pontos de venda encontrados`);
    
    res.json({
      success: true,
      data: pontosVenda
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar pontos de venda:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao listar pontos de venda',
      message: error.message 
    });
  }
});

// POST - Criar novo ponto de venda
router.post('/pontos-venda', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    const {
      nome,
      tipo,
      endereco,
      cidade,
      pais,
      coordenadas,
      telefone,
      email,
      website,
      horario_funcionamento,
      descricao
    } = req.body;
    
    console.log(`🔄 Criando ponto de venda para vendedor ${vendedorId}...`);
    
    // Validar dados obrigatórios
    if (!nome || !tipo) {
      return res.status(400).json({
        success: false,
        message: 'Nome e tipo são obrigatórios'
      });
    }
    
    const { PontoVenda } = require('../config/database');
    
    // Gerar public_id único
    let publicId;
    let tentativas = 0;
    do {
      publicId = Math.floor(100000 + Math.random() * 900000).toString();
      tentativas++;
      
      const existe = await PontoVenda.findOne({ where: { public_id: publicId } });
      if (!existe) break;
      
      if (tentativas > 10) {
        throw new Error('Não foi possível gerar ID único para ponto de venda');
      }
    } while (true);
    
    const pontoVenda = await PontoVenda.create({
      public_id: publicId,
      vendedor_id: vendedorId,
      nome,
      tipo,
      endereco,
      cidade,
      pais: pais || 'MZ',
      coordenadas,
      telefone,
      email,
      website,
      horario_funcionamento,
      descricao,
      status: 'ativo',
      ativo: true
    });
    
    console.log(`✅ Ponto de venda criado com sucesso: ID ${pontoVenda.id}`);
    
    res.json({
      success: true,
      message: 'Ponto de venda criado com sucesso',
      data: pontoVenda
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar ponto de venda:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao criar ponto de venda',
      message: error.message 
    });
  }
});

// PUT - Atualizar ponto de venda
router.put('/pontos-venda/:id', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    const pontoVendaId = req.params.id;
    
    console.log(`🔄 Atualizando ponto de venda ${pontoVendaId} do vendedor ${vendedorId}...`);
    
    const { PontoVenda } = require('../config/database');
    
    // Verificar se o ponto de venda pertence ao vendedor
    const pontoVenda = await PontoVenda.findOne({
      where: { 
        id: pontoVendaId,
        vendedor_id: vendedorId
      }
    });
    
    if (!pontoVenda) {
      return res.status(404).json({
        success: false,
        message: 'Ponto de venda não encontrado'
      });
    }
    
    // Atualizar dados
    const dadosAtualizados = req.body;
    delete dadosAtualizados.vendedor_id; // Não permitir alterar vendedor
    delete dadosAtualizados.public_id; // Não permitir alterar public_id
    
    await pontoVenda.update(dadosAtualizados);
    
    console.log(`✅ Ponto de venda ${pontoVendaId} atualizado com sucesso`);
    
    res.json({
      success: true,
      message: 'Ponto de venda atualizado com sucesso',
      data: pontoVenda
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar ponto de venda:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao atualizar ponto de venda',
      message: error.message 
    });
  }
});

// DELETE - Desativar ponto de venda
router.delete('/pontos-venda/:id', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    const pontoVendaId = req.params.id;
    
    console.log(`🔄 Desativando ponto de venda ${pontoVendaId} do vendedor ${vendedorId}...`);
    
    const { PontoVenda } = require('../config/database');
    
    // Verificar se o ponto de venda pertence ao vendedor
    const pontoVenda = await PontoVenda.findOne({
      where: { 
        id: pontoVendaId,
        vendedor_id: vendedorId
      }
    });
    
    if (!pontoVenda) {
      return res.status(404).json({
        success: false,
        message: 'Ponto de venda não encontrado'
      });
    }
    
    // Desativar (soft delete)
    await pontoVenda.update({ ativo: false, status: 'inativo' });
    
    console.log(`✅ Ponto de venda ${pontoVendaId} desativado com sucesso`);
    
    res.json({
      success: true,
      message: 'Ponto de venda desativado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao desativar ponto de venda:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao desativar ponto de venda',
      message: error.message 
    });
  }
});

// GET - Dados de receita diária para gráficos (últimos 30 dias)
router.get('/receita-diaria', authenticateToken, async (req, res) => {
  try {
    const vendedorId = req.user.id;
    const { periodo = '30dias' } = req.query;
    
    console.log(`🔄 Buscando dados de receita para período: ${periodo} - vendedor ${vendedorId}...`);
    
    const { Op } = require('sequelize');
    
    // Calcular datas baseado no período
    const hoje = new Date();
    let dataInicio, dataFim, agrupamento, formatoData;
    
    switch (periodo) {
      case 'hoje':
        dataInicio = new Date(hoje);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(hoje);
        dataFim.setHours(23, 59, 59, 999);
        agrupamento = 'hora';
        formatoData = 'HH:mm';
        break;
        
      case 'ontem':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 1);
        dataInicio.setHours(0, 0, 0, 0);
        dataFim = new Date(dataInicio);
        dataFim.setHours(23, 59, 59, 999);
        agrupamento = 'hora';
        formatoData = 'HH:mm';
        break;
        
      case '7dias':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 7);
        dataFim = hoje;
        agrupamento = 'dia';
        formatoData = 'DD/MM';
        break;
        
      case '15dias':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 15);
        dataFim = hoje;
        agrupamento = 'dia';
        formatoData = 'DD/MM';
        break;
        
      case '30dias':
      default:
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 30);
        dataFim = hoje;
        agrupamento = 'dia';
        formatoData = 'DD/MM';
        break;
        
      case '60dias':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 60);
        dataFim = hoje;
        agrupamento = 'dia';
        formatoData = 'DD/MM';
        break;
        
      case '90dias':
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 90);
        dataFim = hoje;
        agrupamento = 'dia';
        formatoData = 'DD/MM';
        break;
    }
    
    // Buscar receita total atual para definir valor máximo do gráfico
    const ReceitaService = require('../services/receitaService');
    const receitaTotal = await ReceitaService.buscarReceitaTotal(vendedorId);
    
    let vendasPorPeriodo;
    
    // Status que indicam aprovação (incluindo APROVADO)
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    if (agrupamento === 'hora') {
      // Para hoje/ontem: agrupar por hora
      vendasPorPeriodo = await Venda.findAll({
        where: {
          vendedor_id: vendedorId,
          status: {
            [Op.in]: statusAprovados
          },
          created_at: {
            [Op.gte]: dataInicio,
            [Op.lte]: dataFim
          }
        },
        attributes: [
          [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('created_at')), 'periodo'],
          [sequelize.fn('SUM', sequelize.col('valor')), 'receita_periodo'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_vendas']
        ],
        group: [sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE_TRUNC', 'hour', sequelize.col('created_at')), 'ASC']],
        raw: true
      });
      
      // Criar array com todas as horas (incluindo horas sem vendas)
      const dadosCompletos = [];
      const dataAtual = new Date(dataInicio);
      
      while (dataAtual <= dataFim) {
        const horaStr = dataAtual.toISOString().slice(0, 13) + ':00:00.000Z';
        
        // Buscar dados da hora
        const dadosHora = vendasPorPeriodo.find(v => v.periodo === horaStr);
        
        if (dadosHora) {
          dadosCompletos.push({
            periodo: horaStr,
            periodo_formatado: dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            receita: parseFloat(dadosHora.receita_periodo || 0),
            receita_formatada: `MZN ${parseFloat(dadosHora.receita_periodo || 0).toFixed(2)}`,
            total_vendas: parseInt(dadosHora.total_vendas || 0),
            percentual_receita_total: receitaTotal.receitaTotal > 0 ? 
              ((parseFloat(dadosHora.receita_periodo || 0) / receitaTotal.receitaTotal) * 100).toFixed(2) : 0
          });
        } else {
          // Hora sem vendas
          dadosCompletos.push({
            periodo: horaStr,
            periodo_formatado: dataAtual.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            receita: 0,
            receita_formatada: 'MZN 0.00',
            total_vendas: 0,
            percentual_receita_total: 0
          });
        }
        
        dataAtual.setHours(dataAtual.getHours() + 1);
      }
      
      // Calcular estatísticas
      const totalReceitaPeriodo = dadosCompletos.reduce((total, hora) => total + hora.receita, 0);
      const mediaReceitaHora = dadosCompletos.length > 0 ? totalReceitaPeriodo / dadosCompletos.length : 0;
      const horasComVendas = dadosCompletos.filter(hora => hora.receita > 0).length;
      const maiorReceitaHora = Math.max(...dadosCompletos.map(hora => hora.receita));
      const menorReceitaHora = Math.min(...dadosCompletos.filter(hora => hora.receita > 0).map(hora => hora.receita) || [0]);
      
      // Dados de receita por hora carregados
      
      res.json({
        success: true,
        data: {
          receita_periodo: dadosCompletos,
          estatisticas: {
            receita_total_atual: receitaTotal.receitaTotal,
            receita_total_formatada: `MZN ${receitaTotal.receitaTotal.toFixed(2)}`,
            receita_periodo: totalReceitaPeriodo,
            receita_periodo_formatada: `MZN ${totalReceitaPeriodo.toFixed(2)}`,
            media_periodo: mediaReceitaHora,
            media_periodo_formatada: `MZN ${mediaReceitaHora.toFixed(2)}`,
            periodos_com_vendas: horasComVendas,
            periodos_sem_vendas: dadosCompletos.length - horasComVendas,
            maior_receita_periodo: maiorReceitaHora,
            maior_receita_periodo_formatada: `MZN ${maiorReceitaHora.toFixed(2)}`,
            menor_receita_periodo: menorReceitaHora,
            menor_receita_periodo_formatada: `MZN ${menorReceitaHora.toFixed(2)}`,
            percentual_periodo: receitaTotal.receitaTotal > 0 ? 
              ((totalReceitaPeriodo / receitaTotal.receitaTotal) * 100).toFixed(2) : 0
          },
          configuracao_grafico: {
            valor_maximo: receitaTotal.receitaTotal,
            valor_maximo_formatado: `MZN ${receitaTotal.receitaTotal.toFixed(2)}`,
            periodo: periodo,
            agrupamento: agrupamento,
            formato_data: formatoData,
            data_inicio: dataInicio.toISOString(),
            data_fim: dataFim.toISOString(),
            moeda: 'MZN'
          }
        }
      });
      
    } else {
      // Para dias: agrupar por dia
      // statusAprovados já declarado acima
      vendasPorPeriodo = await Venda.findAll({
        where: {
          vendedor_id: vendedorId,
          status: {
            [Op.in]: statusAprovados
          },
          created_at: {
            [Op.gte]: dataInicio,
            [Op.lte]: dataFim
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'periodo'],
          [sequelize.fn('SUM', sequelize.col('valor')), 'receita_periodo'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'total_vendas']
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });
      
      // Criar array com todos os dias (incluindo dias sem vendas)
      const dadosCompletos = [];
      const dataAtual = new Date(dataInicio);
      
      while (dataAtual <= dataFim) {
        const dataStr = dataAtual.toISOString().split('T')[0];
        
        // Buscar dados do dia
        const dadosDia = vendasPorPeriodo.find(v => v.periodo === dataStr);
        
        if (dadosDia) {
          dadosCompletos.push({
            periodo: dataStr,
            periodo_formatado: dataAtual.toLocaleDateString('pt-BR'),
            receita: parseFloat(dadosDia.receita_periodo || 0),
            receita_formatada: `MZN ${parseFloat(dadosDia.receita_periodo || 0).toFixed(2)}`,
            total_vendas: parseInt(dadosDia.total_vendas || 0),
            percentual_receita_total: receitaTotal.receitaTotal > 0 ? 
              ((parseFloat(dadosDia.receita_periodo || 0) / receitaTotal.receitaTotal) * 100).toFixed(2) : 0
          });
        } else {
          // Dia sem vendas
          dadosCompletos.push({
            periodo: dataStr,
            periodo_formatado: dataAtual.toLocaleDateString('pt-BR'),
            receita: 0,
            receita_formatada: 'MZN 0.00',
            total_vendas: 0,
            percentual_receita_total: 0
          });
        }
        
        dataAtual.setDate(dataAtual.getDate() + 1);
      }
      
      // Calcular estatísticas
      const totalReceitaPeriodo = dadosCompletos.reduce((total, dia) => total + dia.receita, 0);
      const mediaReceitaDiaria = dadosCompletos.length > 0 ? totalReceitaPeriodo / dadosCompletos.length : 0;
      const diasComVendas = dadosCompletos.filter(dia => dia.receita > 0).length;
      const maiorReceitaDia = Math.max(...dadosCompletos.map(dia => dia.receita));
      const menorReceitaDia = Math.min(...dadosCompletos.filter(dia => dia.receita > 0).map(dia => dia.receita) || [0]);
      
      // Dados de receita diária carregados
      
      res.json({
        success: true,
        data: {
          receita_periodo: dadosCompletos,
          estatisticas: {
            receita_total_atual: receitaTotal.receitaTotal,
            receita_total_formatada: `MZN ${receitaTotal.receitaTotal.toFixed(2)}`,
            receita_periodo: totalReceitaPeriodo,
            receita_periodo_formatada: `MZN ${totalReceitaPeriodo.toFixed(2)}`,
            media_periodo: mediaReceitaDiaria,
            media_periodo_formatada: `MZN ${mediaReceitaDiaria.toFixed(2)}`,
            periodos_com_vendas: diasComVendas,
            periodos_sem_vendas: dadosCompletos.length - diasComVendas,
            maior_receita_periodo: maiorReceitaDia,
            maior_receita_periodo_formatada: `MZN ${maiorReceitaDia.toFixed(2)}`,
            menor_receita_periodo: menorReceitaDia,
            menor_receita_periodo_formatada: `MZN ${menorReceitaDia.toFixed(2)}`,
            percentual_periodo: receitaTotal.receitaTotal > 0 ? 
              ((totalReceitaPeriodo / receitaTotal.receitaTotal) * 100).toFixed(2) : 0
          },
          configuracao_grafico: {
            valor_maximo: receitaTotal.receitaTotal,
            valor_maximo_formatado: `MZN ${receitaTotal.receitaTotal.toFixed(2)}`,
            periodo: periodo,
            agrupamento: agrupamento,
            formato_data: formatoData,
            data_inicio: dataInicio.toISOString(),
            data_fim: dataFim.toISOString(),
            moeda: 'MZN'
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao buscar receita por período:', error);
    res.status(500).json({ 
      success: false,
      erro: 'Erro ao buscar receita por período',
      message: error.message 
    });
  }
});

// Função auxiliar para formatar períodos
function formatarPeriodo(periodo, tipo) {
  const data = new Date(periodo);
  
  switch (tipo) {
    case 'hora':
      return data.toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'semana':
      return `Semana ${data.getWeek()} - ${data.getFullYear()}`;
    case 'mes':
      return data.toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
      });
    default: // dia
      return data.toLocaleDateString('pt-BR');
  }
}

// Extensão para obter semana do ano
Date.prototype.getWeek = function() {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};

// ========================================
// DASHBOARD OTIMIZADO - ENDPOINT CONSOLIDADO
// ========================================

// Middleware de logging e monitoramento
const logDashboardRequest = (req, res, next) => {
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
        if (duration > 2000) {
            console.warn(`⚠️ DASHBOARD LENTO:`, logData);
        } else {
            console.log(`📊 Dashboard request:`, logData);
        }
        
        // Log de erro se status >= 400
        if (res.statusCode >= 400) {
            console.error(`❌ ERRO NO DASHBOARD:`, logData);
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

// GET - Dashboard consolidado otimizado para vendedor específico
router.get('/vendedor/:vendedorId/consolidado', authenticateToken, logDashboardRequest, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        const { periodo, limit, offset } = req.query;
        
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
                message: 'Você não tem permissão para acessar os dados deste vendedor'
            });
        }
        
        console.log(`🔄 Carregando dashboard consolidado para vendedor: ${vendedorId}`);
        
        // Opções para o dashboard
        const options = {
            periodo: periodo || '30dias',
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        };
        
        // Buscar dados consolidados usando o serviço otimizado
        const dashboardData = await dashboardService.getDashboardData(vendedorId, options);
        
        // Formatar resposta unificada
        const response = {
            success: true,
            data: {
                vendedorId: dashboardData.vendedorId,
                vendedor: dashboardData.vendedor,
                resumo: {
                    nome: dashboardData.vendedor?.nome || 'Vendedor',
                    totalVendas: dashboardData.resumo.totalVendas,
                    receitaTotal: dashboardData.resumo.receitaTotal,
                    saquesPendentes: dashboardData.saques.pendentes.reduce((sum, saque) => sum + saque.valor, 0),
                    vendasAprovadas: dashboardData.resumo.vendasAprovadas,
                    vendasPendentes: dashboardData.resumo.vendasPendentes,
                    vendasCanceladas: dashboardData.resumo.vendasCanceladas,
                    taxaAprovacao: dashboardData.resumo.taxaAprovacao
                },
                vendas: dashboardData.vendas,
                saques: {
                    pendentes: dashboardData.saques.pendentes,
                    historico: dashboardData.saques.historico
                },
                periodo: options.periodo,
                timestamp: dashboardData.timestamp,
                cached: dashboardData.cached
            }
        };
        
        // Adicionar warnings se houver erros parciais
        if (dashboardData.errors && dashboardData.errors.length > 0) {
            response.warnings = dashboardData.errors.map(error => ({
                query: error.query,
                message: error.error
            }));
        }
        
        // Dashboard consolidado carregado com sucesso
        res.json(response);
        
    } catch (error) {
        console.error(`❌ Erro no dashboard consolidado para vendedor ${req.params.vendedorId}:`, error);
        
        // Resposta de erro padronizada
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar dados do dashboard consolidado',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// GET - Dashboard consolidado para o vendedor logado
router.get('/vendedor/consolidado', authenticateToken, logDashboardRequest, async (req, res) => {
    try {
        const { periodo, limit, offset } = req.query;
        
        console.log(`🔄 Carregando dashboard consolidado para vendedor logado: ${req.user.id}`);
        
        // Opções para o dashboard
        const options = {
            periodo: periodo || '30dias',
            limit: parseInt(limit) || 10,
            offset: parseInt(offset) || 0
        };
        
        // Buscar dados consolidados usando o serviço otimizado
        const dashboardData = await dashboardService.getDashboardData(req.user.id, options);
        
        // Formatar resposta unificada
        const response = {
            success: true,
            data: {
                vendedorId: dashboardData.vendedorId,
                vendedor: dashboardData.vendedor,
                resumo: {
                    nome: dashboardData.vendedor?.nome || 'Vendedor',
                    totalVendas: dashboardData.resumo.totalVendas,
                    receitaTotal: dashboardData.resumo.receitaTotal,
                    saquesPendentes: dashboardData.saques.pendentes.reduce((sum, saque) => sum + saque.valor, 0),
                    vendasAprovadas: dashboardData.resumo.vendasAprovadas,
                    vendasPendentes: dashboardData.resumo.vendasPendentes,
                    vendasCanceladas: dashboardData.resumo.vendasCanceladas,
                    taxaAprovacao: dashboardData.resumo.taxaAprovacao
                },
                vendas: dashboardData.vendas,
                saques: {
                    pendentes: dashboardData.saques.pendentes,
                    historico: dashboardData.saques.historico
                },
                periodo: options.periodo,
                timestamp: dashboardData.timestamp,
                cached: dashboardData.cached
            }
        };
        
        // Adicionar warnings se houver erros parciais
        if (dashboardData.errors && dashboardData.errors.length > 0) {
            response.warnings = dashboardData.errors.map(error => ({
                query: error.query,
                message: error.error
            }));
        }
        
        // Dashboard consolidado carregado com sucesso
        res.json(response);
        
    } catch (error) {
        console.error(`❌ Erro no dashboard consolidado para vendedor logado ${req.user.id}:`, error);
        
        // Resposta de erro padronizada
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Falha ao carregar dados do dashboard consolidado',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// DELETE - Limpar cache do dashboard
router.delete('/vendedor/:vendedorId/cache', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado',
                message: 'Você não tem permissão para limpar o cache deste vendedor'
            });
        }
        
        await dashboardService.clearCache(vendedorId);
        
        res.json({
            success: true,
            message: 'Cache limpo com sucesso',
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

// GET - Estatísticas de performance do dashboard
router.get('/vendedor/:vendedorId/stats', authenticateToken, async (req, res) => {
    try {
        const { vendedorId } = req.params;
        
        // Verificar permissões
        if (req.user.id !== vendedorId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }
        
        res.json({
            success: true,
            data: {
                vendedorId,
                cacheEnabled: dashboardService.cacheEnabled,
                cacheSize: dashboardService.memoryCache.size,
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

// ======================== ROTA DE GRÁFICO DE VENDAS AVANÇADO ========================

// GET - Gráfico de vendas com métricas avançadas
router.get('/vendedor/vendas-grafico', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { periodo = '7d', tipo = 'receita' } = req.query;
    const { Op } = require('sequelize');
    
    console.log(`🔄 Carregando dados de vendas para gráfico - Vendedor: ${req.user.id}, Período: ${periodo}, Tipo: ${tipo}`);
    
    // Calcular datas baseado no período
    let dataInicio, dataFim;
    const hoje = new Date();
    
    switch (periodo) {
      case 'hoje':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      case 'ontem':
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        dataInicio = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 0, 0, 0);
        dataFim = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59);
        break;
      case '7d':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      case '30d':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      case '90d':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 89, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
        break;
      default:
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6, 0, 0, 0);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    }
    
    console.log(`📅 Período: ${dataInicio.toLocaleDateString('pt-BR')} - ${dataFim.toLocaleDateString('pt-BR')}`);
    
    // Status que indicam aprovação (incluindo APROVADO)
    // Op já foi declarado acima
    const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
    
    // Buscar dados de vendas
    const vendasData = await Venda.findAll({
      where: { 
        status: {
          [Op.in]: statusAprovados
        },
        vendedor_id: req.user.id,
        created_at: {
          [Op.between]: [dataInicio, dataFim]
        }
      },
      attributes: [
        'id', 'valor', 'created_at', 'produto_id', 'categoria'
      ],
      include: [{
        model: Produto,
        as: 'produto',
        attributes: ['nome', 'categoria', 'tipo']
      }],
      order: [['created_at', 'ASC']]
    });
    
    // Buscar dados de vendas pendentes e canceladas para métricas
    const vendasPendentes = await Venda.count({
      where: { 
        status: 'Pendente',
        vendedor_id: req.user.id,
        created_at: {
          [Op.between]: [dataInicio, dataFim]
        }
      }
    });
    
    const vendasCanceladas = await Venda.count({
      where: { 
        status: 'Cancelada',
        vendedor_id: req.user.id,
        created_at: {
          [Op.between]: [dataInicio, dataFim]
        }
      }
    });
    
    // Processar dados baseado no tipo de agrupamento
    let dadosProcessados;
    
    if (periodo === 'hoje' || periodo === 'ontem') {
      // Agrupar por hora
      dadosProcessados = processarDadosPorHora(vendasData);
    } else if (periodo === '7d') {
      // Agrupar por dia
      dadosProcessados = processarDadosPorDia(vendasData, dataInicio, dataFim);
    } else {
      // Agrupar por semana para períodos maiores
      dadosProcessados = processarDadosPorSemana(vendasData, dataInicio, dataFim);
    }
    
    // Calcular métricas avançadas
    const metricas = calcularMetricasAvancadas(vendasData, vendasPendentes, vendasCanceladas, dataInicio, dataFim);
    
    // Dados por categoria
    const dadosCategoria = processarDadosPorCategoria(vendasData);
    
    // Dados por tipo de produto
    const dadosTipo = processarDadosPorTipo(vendasData);
    
    const resultado = {
      grafico: dadosProcessados,
      metricas: metricas,
      categorias: dadosCategoria,
      tipos: dadosTipo,
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
        tipo: periodo
      }
    };
    
    console.log(`✅ Dados do gráfico processados - Receita: MZN ${metricas.receitaTotal.toFixed(2)}, Vendas: ${metricas.totalVendas}`);
    
    res.json({
      success: true,
      data: resultado
    });
    
  } catch (error) {
    console.error('❌ Erro ao carregar dados do gráfico de vendas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Funções auxiliares para processamento de dados
function processarDadosPorHora(vendasData) {
  const dados = {};
  
  // Inicializar todas as horas
  for (let i = 0; i < 24; i++) {
    dados[i] = {
      hora: `${i.toString().padStart(2, '0')}:00`,
      receita: 0,
      vendas: 0,
      ticketMedio: 0
    };
  }
  
  // Processar vendas
  vendasData.forEach(venda => {
    const hora = new Date(venda.created_at).getHours();
    dados[hora].receita += parseFloat(venda.valor);
    dados[hora].vendas += 1;
  });
  
  // Calcular ticket médio
  Object.keys(dados).forEach(hora => {
    if (dados[hora].vendas > 0) {
      dados[hora].ticketMedio = dados[hora].receita / dados[hora].vendas;
    }
  });
  
  return {
    labels: Object.values(dados).map(d => d.hora),
    receitas: Object.values(dados).map(d => d.receita),
    vendas: Object.values(dados).map(d => d.vendas),
    ticketMedio: Object.values(dados).map(d => d.ticketMedio)
  };
}

function processarDadosPorDia(vendasData, dataInicio, dataFim) {
  const dados = {};
  const dataAtual = new Date(dataInicio);
  
  // Inicializar todos os dias
  while (dataAtual <= dataFim) {
    const dataStr = dataAtual.toISOString().split('T')[0];
    dados[dataStr] = {
      data: dataAtual.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      receita: 0,
      vendas: 0,
      ticketMedio: 0
    };
    dataAtual.setDate(dataAtual.getDate() + 1);
  }
  
  // Processar vendas
  vendasData.forEach(venda => {
    const dataStr = new Date(venda.created_at).toISOString().split('T')[0];
    if (dados[dataStr]) {
      dados[dataStr].receita += parseFloat(venda.valor);
      dados[dataStr].vendas += 1;
    }
  });
  
  // Calcular ticket médio
  Object.keys(dados).forEach(data => {
    if (dados[data].vendas > 0) {
      dados[data].ticketMedio = dados[data].receita / dados[data].vendas;
    }
  });
  
  return {
    labels: Object.values(dados).map(d => d.data),
    receitas: Object.values(dados).map(d => d.receita),
    vendas: Object.values(dados).map(d => d.vendas),
    ticketMedio: Object.values(dados).map(d => d.ticketMedio)
  };
}

function processarDadosPorSemana(vendasData, dataInicio, dataFim) {
  const dados = {};
  
  // Agrupar por semana
  vendasData.forEach(venda => {
    const dataVenda = new Date(venda.created_at);
    const semana = getSemanaAno(dataVenda);
    
    if (!dados[semana]) {
      dados[semana] = {
        semana: `Semana ${semana}`,
        receita: 0,
        vendas: 0,
        ticketMedio: 0
      };
    }
    
    dados[semana].receita += parseFloat(venda.valor);
    dados[semana].vendas += 1;
  });
  
  // Calcular ticket médio
  Object.keys(dados).forEach(semana => {
    if (dados[semana].vendas > 0) {
      dados[semana].ticketMedio = dados[semana].receita / dados[semana].vendas;
    }
  });
  
  return {
    labels: Object.values(dados).map(d => d.semana),
    receitas: Object.values(dados).map(d => d.receita),
    vendas: Object.values(dados).map(d => d.vendas),
    ticketMedio: Object.values(dados).map(d => d.ticketMedio)
  };
}

function calcularMetricasAvancadas(vendasData, vendasPendentes, vendasCanceladas, dataInicio, dataFim) {
  const receitaTotal = vendasData.reduce((total, venda) => total + parseFloat(venda.valor), 0);
  const totalVendas = vendasData.length;
  const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;
  
  // Calcular crescimento (comparar com período anterior)
  const diasPeriodo = Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24));
  const receitaDiaria = receitaTotal / diasPeriodo;
  
  // Taxa de conversão (vendas aprovadas / total de tentativas)
  const totalTentativas = totalVendas + vendasPendentes + vendasCanceladas;
  const taxaConversao = totalTentativas > 0 ? (totalVendas / totalTentativas) * 100 : 0;
  
  // Vendas por hora (média)
  const horasPeriodo = diasPeriodo * 24;
  const vendasPorHora = totalVendas / horasPeriodo;
  
  // Produto mais vendido
  const produtosVendidos = {};
  vendasData.forEach(venda => {
    const produtoNome = venda.produto?.nome || 'Produto Desconhecido';
    produtosVendidos[produtoNome] = (produtosVendidos[produtoNome] || 0) + 1;
  });
  
  const produtoMaisVendido = Object.keys(produtosVendidos).reduce((a, b) => 
    produtosVendidos[a] > produtosVendidos[b] ? a : b, 'Nenhum'
  );
  
  return {
    receitaTotal,
    totalVendas,
    ticketMedio,
    receitaDiaria,
    taxaConversao,
    vendasPorHora,
    produtoMaisVendido,
    vendasPendentes,
    vendasCanceladas,
    totalTentativas
  };
}

function processarDadosPorCategoria(vendasData) {
  const categorias = {};
  
  vendasData.forEach(venda => {
    const categoria = venda.produto?.categoria || 'Sem Categoria';
    if (!categorias[categoria]) {
      categorias[categoria] = {
        nome: categoria,
        receita: 0,
        vendas: 0
      };
    }
    categorias[categoria].receita += parseFloat(venda.valor);
    categorias[categoria].vendas += 1;
  });
  
  return Object.values(categorias).sort((a, b) => b.receita - a.receita);
}

function processarDadosPorTipo(vendasData) {
  const tipos = {};
  
  vendasData.forEach(venda => {
    const tipo = venda.produto?.tipo || 'digital';
    if (!tipos[tipo]) {
      tipos[tipo] = {
        nome: tipo,
        receita: 0,
        vendas: 0
      };
    }
    tipos[tipo].receita += parseFloat(venda.valor);
    tipos[tipo].vendas += 1;
  });
  
  return Object.values(tipos).sort((a, b) => b.receita - a.receita);
}

function getSemanaAno(data) {
  const inicioAno = new Date(data.getFullYear(), 0, 1);
  const dias = Math.floor((data - inicioAno) / (24 * 60 * 60 * 1000));
  return Math.ceil((dias + inicioAno.getDay() + 1) / 7);
}

module.exports = router;

