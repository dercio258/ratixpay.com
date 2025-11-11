const express = require('express');
const router = express.Router();
const { Venda, Produto, Cliente, VendaAfiliado, Afiliado } = require('../config/database');
const { authenticateToken, isAdmin, isVendedorOrAdmin } = require('../middleware/auth');
const { convertVendaPublicId, convertProdutoPublicId } = require('../middleware/uuidConverter');
const fetch = require('node-fetch');
const whatsappService = require('../services/whatsappService');
require('dotenv').config();

// GET - Listar vendas do vendedor logado
router.get('/vendedor', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Buscando vendas do vendedor:', req.user.id);
    console.log('📋 User object:', { id: req.user.id, role: req.user.role, email: req.user.email });
    
    const { status, metodo, limite = 50, pagina = 1, dataInicio, dataFim, produtoId, email } = req.query;
    
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    
    // Construir condições de busca - sempre filtrar por vendedor logado
    const where = {
      vendedor_id: req.user.id
    };
    
    if (status) where.status = status;
    if (metodo) where.metodo_pagamento = metodo;
    if (produtoId) where.produto_id = produtoId;
    if (email) where.cliente_email = email;
    
    console.log('📋 Condições de busca:', JSON.stringify(where, null, 2));
    
    // Verificar se os modelos estão disponíveis
    if (!Venda) {
      throw new Error('Modelo Venda não está disponível');
    }
    if (!Produto) {
      throw new Error('Modelo Produto não está disponível');
    }
    
    console.log('🔍 Iniciando busca de vendas...');
    
    // Buscar vendas com produto e informações de afiliado
    let vendasResult;
    try {
      // Tentar usar o relacionamento definido (as: 'produto')
      // Incluir explicitamente created_at e updated_at nos attributes
      vendasResult = await Venda.findAndCountAll({
        where,
        attributes: {
          exclude: [], // Não excluir nenhum campo
          include: ['created_at', 'updated_at'] // Garantir que timestamps sejam incluídos
        },
        include: [
          {
            model: Produto,
            as: 'produto', // Usar o alias do relacionamento
            attributes: ['id', 'nome', 'custom_id'],
            required: false // LEFT JOIN para não excluir vendas sem produto
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limite),
        offset: offset,
        raw: false // Manter como objeto Sequelize para ter acesso aos métodos
      });
    } catch (queryError) {
      console.error('❌ Erro na query findAndCountAll:', queryError);
      console.error('❌ Stack trace da query:', queryError.stack);
      console.error('❌ Detalhes do erro:', {
        name: queryError.name,
        message: queryError.message,
        original: queryError.original?.message,
        sql: queryError.sql
      });
      
      // Tentar sem o include se houver erro de relacionamento
      if (queryError.name === 'SequelizeEagerLoadingError' || queryError.message.includes('is not associated')) {
        console.log('⚠️ Tentando buscar vendas sem include de produto...');
        try {
          vendasResult = await Venda.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit: parseInt(limite),
            offset: offset
          });
          console.log('✅ Busca sem include funcionou');
        } catch (fallbackError) {
          console.error('❌ Erro mesmo sem include:', fallbackError);
          throw queryError; // Lançar o erro original
        }
      } else {
        throw queryError;
      }
    }
    
    console.log(`✅ Encontradas ${vendasResult.count} vendas, processando ${vendasResult.rows.length}...`);
    
    // Verificar se created_at está sendo retornado (debug)
    if (vendasResult.rows.length > 0) {
      const primeiraVenda = vendasResult.rows[0].toJSON();
      console.log('🔍 Debug primeira venda:', {
        id: primeiraVenda.id,
        created_at: primeiraVenda.created_at,
        createdAt: primeiraVenda.createdAt,
        updated_at: primeiraVenda.updated_at,
        updatedAt: primeiraVenda.updatedAt,
        tipo_created_at: typeof primeiraVenda.created_at,
        tipo_createdAt: typeof primeiraVenda.createdAt,
        todas_chaves: Object.keys(primeiraVenda).filter(k => k.includes('created') || k.includes('date') || k.includes('time'))
      });
    }
    
    // Buscar informações de afiliado para cada venda
    const vendasComAfiliado = await Promise.all(vendasResult.rows.map(async (venda, index) => {
      try {
        // Tentar múltiplas formas de obter os dados
        let vendaData;
        
        // Método 1: toJSON() padrão
        try {
          vendaData = venda.toJSON();
        } catch (e) {
          // Método 2: get() com plain
          vendaData = venda.get ? venda.get({ plain: true }) : venda;
        }
        
        // Método 3: Acessar diretamente os atributos do Sequelize
        if (!vendaData.created_at && !vendaData.createdAt) {
          // Tentar acessar diretamente do objeto Sequelize
          if (venda.dataValues && venda.dataValues.created_at) {
            vendaData.created_at = venda.dataValues.created_at;
          } else if (venda.dataValues && venda.dataValues.createdAt) {
            vendaData.created_at = venda.dataValues.createdAt;
          } else if (venda.created_at) {
            vendaData.created_at = venda.created_at;
          } else if (venda.createdAt) {
            vendaData.created_at = venda.createdAt;
          } else {
            // Método 4: Buscar diretamente do banco usando query raw
            try {
              const rawVendas = await Venda.sequelize.query(`
                SELECT created_at, updated_at 
                FROM vendas 
                WHERE id = :venda_id
                LIMIT 1
              `, {
                replacements: { venda_id: vendaData.id },
                type: Venda.sequelize.QueryTypes.SELECT
              });
              
              if (rawVendas && rawVendas.length > 0) {
                const rawVenda = rawVendas[0];
                if (rawVenda && rawVenda.created_at) {
                  vendaData.created_at = rawVenda.created_at;
                  console.log(`✅ created_at encontrado via query raw para venda ${vendaData.id}:`, rawVenda.created_at);
                }
                if (rawVenda && rawVenda.updated_at) {
                  vendaData.updated_at = rawVenda.updated_at;
                }
              } else {
                console.warn(`⚠️ Nenhum resultado encontrado na query raw para venda ${vendaData.id}`);
              }
            } catch (rawError) {
              console.warn(`⚠️ Erro ao buscar created_at via query raw para venda ${vendaData.id}:`, rawError.message);
            }
          }
        }
        
        // Garantir que created_at existe - tentar ambas as formas (snake_case e camelCase)
        if (!vendaData.created_at && !vendaData.createdAt) {
          // Se ainda não encontrou, usar updated_at ou data atual como fallback
          vendaData.created_at = vendaData.updated_at || vendaData.updatedAt || new Date();
          console.warn(`⚠️ Venda ${vendaData.id} não tem created_at/createdAt no banco, usando fallback:`, vendaData.created_at);
        } else if (!vendaData.created_at && vendaData.createdAt) {
          // Se está em camelCase, converter para snake_case para manter consistência
          vendaData.created_at = vendaData.createdAt;
        }
        
        // Garantir updated_at também
        if (!vendaData.updated_at && !vendaData.updatedAt) {
          // Tentar acessar diretamente do objeto Sequelize
          if (venda.dataValues && venda.dataValues.updated_at) {
            vendaData.updated_at = venda.dataValues.updated_at;
          } else if (venda.dataValues && venda.dataValues.updatedAt) {
            vendaData.updated_at = venda.dataValues.updatedAt;
          } else if (venda.updated_at) {
            vendaData.updated_at = venda.updated_at;
          } else if (venda.updatedAt) {
            vendaData.updated_at = venda.updatedAt;
          } else {
            vendaData.updated_at = vendaData.created_at || new Date();
          }
        } else if (!vendaData.updated_at && vendaData.updatedAt) {
          vendaData.updated_at = vendaData.updatedAt;
        }
        
        // Buscar venda de afiliado se existir
        let afiliadoInfo = null;
        
        // Só buscar afiliado se houver referência e os modelos estiverem disponíveis
        if (vendaData.afiliado_ref && Afiliado && VendaAfiliado) {
          try {
            // Buscar afiliado pelo código
            const afiliado = await Afiliado.findOne({
              where: { codigo_afiliado: vendaData.afiliado_ref }
            }).catch(err => {
              console.warn(`⚠️ Erro ao buscar afiliado ${vendaData.afiliado_ref}:`, err.message);
              return null;
            });
            
            if (afiliado) {
              try {
                // Buscar registro de venda de afiliado
                const vendaAfiliado = await VendaAfiliado.findOne({
                  where: {
                    venda_id: vendaData.id,
                    afiliado_id: afiliado.id
                  }
                }).catch(err => {
                  console.warn(`⚠️ Erro ao buscar venda de afiliado para venda ${vendaData.id}:`, err.message);
                  return null;
                });
                
                if (vendaAfiliado) {
                  afiliadoInfo = {
                    id: afiliado.id,
                    nome: afiliado.nome,
                    codigo: afiliado.codigo_afiliado,
                    email: afiliado.email,
                    comissao_percentual: parseFloat(vendaAfiliado.comissao_percentual || 0),
                    valor_comissao: parseFloat(vendaAfiliado.valor_comissao || 0),
                    status_comissao: vendaAfiliado.status || 'pendente'
                  };
                } else {
                  // Se não encontrou registro, mas tem código, criar info básica
                  afiliadoInfo = {
                    id: afiliado.id,
                    nome: afiliado.nome,
                    codigo: afiliado.codigo_afiliado,
                    email: afiliado.email,
                    comissao_percentual: parseFloat(afiliado.comissao_percentual || 30.00),
                    valor_comissao: null,
                    status_comissao: 'pendente'
                  };
                }
              } catch (vendaAfiliadoError) {
                console.warn(`⚠️ Erro ao processar venda de afiliado para venda ${vendaData.id}:`, vendaAfiliadoError.message);
                // Continuar sem informações de afiliado
              }
            }
          } catch (afiliadoError) {
            console.warn(`⚠️ Erro ao buscar afiliado para venda ${vendaData.id}:`, afiliadoError.message);
            // Continuar sem informações de afiliado
          }
        }
      
        // Calcular valor total pago (valor é 90% do total, então total = valor / 0.9)
        // Proteger contra divisão por zero
        let valorTotalPago = 0;
        if (vendaData.valor && parseFloat(vendaData.valor) > 0) {
          try {
            valorTotalPago = parseFloat((parseFloat(vendaData.valor) / 0.9).toFixed(2));
          } catch (calcError) {
            console.warn(`⚠️ Erro ao calcular valor total pago para venda ${vendaData.id}:`, calcError.message);
            valorTotalPago = parseFloat(vendaData.valor || 0);
          }
        } else {
          valorTotalPago = parseFloat(vendaData.valor || 0);
        }
        
        // Tentar acessar produto de diferentes formas (dependendo do relacionamento)
        let produtoNome = vendaData.produto?.nome || vendaData.Produto?.nome;
        let produtoCustomId = vendaData.produto?.custom_id || vendaData.Produto?.custom_id;
        
        // Se não encontrou produto no include, buscar separadamente
        if (!produtoNome && vendaData.produto_id && Produto) {
          try {
            const produto = await Produto.findByPk(vendaData.produto_id);
            if (produto) {
              produtoNome = produto.nome || 'Produto não encontrado';
              produtoCustomId = produto.custom_id || 'N/A';
            }
          } catch (produtoError) {
            console.warn(`⚠️ Erro ao buscar produto ${vendaData.produto_id}:`, produtoError.message);
          }
        }
        
        produtoNome = produtoNome || 'Produto não encontrado';
        produtoCustomId = produtoCustomId || 'N/A';
        
        // Garantir que created_at sempre tenha um valor válido
        let created_at_final = vendaData.created_at || vendaData.createdAt;
        if (!created_at_final) {
          // Se não tem created_at, usar updated_at ou data atual como fallback
          created_at_final = vendaData.updated_at || vendaData.updatedAt || new Date();
          console.warn(`⚠️ Venda ${vendaData.id} sem created_at, usando fallback:`, created_at_final);
        }
        
        // Garantir que updated_at sempre tenha um valor
        let updated_at_final = vendaData.updated_at || vendaData.updatedAt;
        if (!updated_at_final) {
          updated_at_final = created_at_final || new Date();
        }
        
        // Converter para ISO string se for Date object
        if (created_at_final instanceof Date) {
          created_at_final = created_at_final.toISOString();
        } else if (typeof created_at_final === 'string' && !created_at_final.includes('T')) {
          // Se for string sem formato ISO, tentar converter
          try {
            created_at_final = new Date(created_at_final).toISOString();
          } catch (e) {
            created_at_final = new Date().toISOString();
          }
        }
        
        if (updated_at_final instanceof Date) {
          updated_at_final = updated_at_final.toISOString();
        } else if (typeof updated_at_final === 'string' && !updated_at_final.includes('T')) {
          try {
            updated_at_final = new Date(updated_at_final).toISOString();
          } catch (e) {
            updated_at_final = created_at_final || new Date().toISOString();
          }
        }
        
        return {
          id: vendaData.id,
          produto_id: vendaData.produto_id,
          produto_nome: produtoNome,
          produto_custom_id: produtoCustomId,
          cliente_nome: vendaData.cliente_nome || '',
          cliente_email: vendaData.cliente_email || '',
          cliente_telefone: vendaData.cliente_telefone || '',
          status: vendaData.status || 'Pendente',
          valor: parseFloat(vendaData.valor || 0), // Valor que o vendedor recebe (90%)
          valor_total_pago: valorTotalPago, // Valor total pago pelo cliente (com desconto)
          metodo_pagamento: vendaData.metodo_pagamento || '',
          referencia_pagamento: vendaData.referencia_pagamento || '',
          created_at: created_at_final, // Sempre retornar um valor
          updated_at: updated_at_final, // Sempre retornar um valor
          // Informações de afiliado
          afiliado: afiliadoInfo,
          afiliado_ref: vendaData.afiliado_ref || null
        };
      } catch (vendaError) {
        console.error(`❌ Erro ao processar venda ${index}:`, vendaError);
        console.error('Stack trace:', vendaError.stack);
        
        // Retornar venda básica sem informações de afiliado em caso de erro
        try {
          const vendaData = venda.toJSON();
          
          // Calcular valor total pago com proteção
          let valorTotalPago = 0;
          if (vendaData.valor && parseFloat(vendaData.valor) > 0) {
            valorTotalPago = parseFloat((parseFloat(vendaData.valor) / 0.9).toFixed(2));
          } else {
            valorTotalPago = parseFloat(vendaData.valor || 0);
          }
          
          // Tentar acessar produto de diferentes formas
          const produtoNomeFallback = vendaData.produto?.nome || vendaData.Produto?.nome || 'Produto não encontrado';
          const produtoCustomIdFallback = vendaData.produto?.custom_id || vendaData.Produto?.custom_id || 'N/A';
          
          // Garantir que created_at sempre tenha um valor válido
          let created_at_fallback = vendaData.created_at || vendaData.createdAt || vendaData.updated_at || vendaData.updatedAt || new Date();
          let updated_at_fallback = vendaData.updated_at || vendaData.updatedAt || created_at_fallback || new Date();
          
          // Converter para ISO string se for Date object
          if (created_at_fallback instanceof Date) {
            created_at_fallback = created_at_fallback.toISOString();
          } else if (typeof created_at_fallback === 'string' && !created_at_fallback.includes('T')) {
            try {
              created_at_fallback = new Date(created_at_fallback).toISOString();
            } catch (e) {
              created_at_fallback = new Date().toISOString();
            }
          }
          
          if (updated_at_fallback instanceof Date) {
            updated_at_fallback = updated_at_fallback.toISOString();
          } else if (typeof updated_at_fallback === 'string' && !updated_at_fallback.includes('T')) {
            try {
              updated_at_fallback = new Date(updated_at_fallback).toISOString();
            } catch (e) {
              updated_at_fallback = created_at_fallback || new Date().toISOString();
            }
          }
          
          return {
            id: vendaData.id,
            produto_id: vendaData.produto_id,
            produto_nome: produtoNomeFallback,
            produto_custom_id: produtoCustomIdFallback,
            cliente_nome: vendaData.cliente_nome || '',
            cliente_email: vendaData.cliente_email || '',
            cliente_telefone: vendaData.cliente_telefone || '',
            status: vendaData.status || 'Pendente',
            valor: parseFloat(vendaData.valor || 0),
            valor_total_pago: valorTotalPago,
            metodo_pagamento: vendaData.metodo_pagamento || '',
            referencia_pagamento: vendaData.referencia_pagamento || '',
            created_at: created_at_fallback,
            updated_at: updated_at_fallback,
            afiliado: null,
            afiliado_ref: vendaData.afiliado_ref || null
          };
        } catch (fallbackError) {
          console.error('❌ Erro crítico ao processar venda no fallback:', fallbackError);
          // Retornar objeto mínimo para não quebrar a resposta
          return {
            id: venda.id || null,
            produto_id: null,
            produto_nome: 'Erro ao carregar',
            produto_custom_id: 'N/A',
            cliente_nome: '',
            cliente_email: '',
            cliente_telefone: '',
            status: 'Erro',
            valor: 0,
            valor_total_pago: 0,
            metodo_pagamento: '',
            referencia_pagamento: '',
            created_at: new Date(),
            afiliado: null,
            afiliado_ref: null
          };
        }
      }
    }));
    
    console.log(`✅ Processadas ${vendasComAfiliado.length} vendas com sucesso`);
    
    res.json({
      success: true,
      data: {
        vendas: vendasComAfiliado,
        total: vendasResult.count,
        pagina: parseInt(pagina),
        totalPaginas: Math.ceil(vendasResult.count / parseInt(limite)),
        formatacao: 'MZN'
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar vendas do vendedor:', error);
    console.error('❌ Tipo do erro:', error.constructor.name);
    console.error('❌ Mensagem do erro:', error.message);
    console.error('❌ Stack trace completo:', error.stack);
    
    // Log adicional para erros de banco de dados
    if (error.name === 'SequelizeDatabaseError') {
      console.error('❌ Erro de banco de dados:', error.original);
    }
    if (error.name === 'SequelizeValidationError') {
      console.error('❌ Erro de validação:', error.errors);
    }
    if (error.name === 'SequelizeConnectionError') {
      console.error('❌ Erro de conexão com banco de dados');
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar vendas do vendedor',
      error: error.message,
      errorType: error.name || error.constructor.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      details: process.env.NODE_ENV === 'development' ? {
        original: error.original?.message,
        sql: error.sql
      } : undefined
    });
  }
});

// GET - Listar vendas (filtradas por vendedor)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, metodo, limite = 50, pagina = 1, dataInicio, dataFim, produtoId, email } = req.query;
    
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    
    // Construir condições de busca
    const where = {};
    
    // Filtrar por vendedor se não for admin
    if (req.user.role !== 'admin') {
      where.vendedor_id = req.user.id;
    }
    
    if (status) where.status = status;
    if (metodo) where.metodo_pagamento = metodo;
    if (produtoId) where.produto_id = produtoId;
    if (email) where.cliente_email = email;
    
    // Buscar vendas com produto
    const vendasResult = await Venda.findAndCountAll({
      where,
      include: [{
        model: Produto,
        attributes: ['id', 'nome', 'custom_id']
      }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limite),
      offset: offset
    });
    
    // Formatar os dados para o frontend
    const vendas = vendasResult.rows.map(venda => {
      const vendaData = venda.toJSON();
      return {
        id: vendaData.id,
      produto: {
          id: vendaData.produto_id,
          nome: vendaData.Produto?.nome || 'Produto não encontrado',
          customId: vendaData.Produto?.custom_id || 'N/A'
      },
      cliente: {
          nome: vendaData.cliente_nome,
          email: vendaData.cliente_email,
          telefone: vendaData.cliente_telefone
      },
      pagamento: {
          status: vendaData.status,
          valor: vendaData.valor,
          valorFormatado: `MZN ${parseFloat(vendaData.valor || 0).toFixed(2)}`,
          transacaoId: vendaData.referencia_pagamento
        },
        dataVenda: vendaData.created_at,
        status: vendaData.status
      };
    });
    
    res.json({
      success: true,
      data: {
      vendas,
        total: vendasResult.count,
      pagina: parseInt(pagina),
        totalPaginas: Math.ceil(vendasResult.count / parseInt(limite)),
      formatacao: 'MZN'
      }
    });
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar vendas',
      error: error.message 
    });
  }
});

// GET - Estatísticas para gestão de vendas (usando estatísticas do banco)
router.get('/estatisticas', authenticateToken, async (req, res) => {
  try {
    const EstatisticasService = require('../services/estatisticasService');
    
    // Buscar estatísticas do vendedor
    const estatisticas = await EstatisticasService.buscarEstatisticasVendedor(req.user.id);
    
    res.json({
      success: true,
      data: {
        totalVendas: parseInt(estatisticas.total_vendas || 0), // Total = aprovadas + pendentes + canceladas
        vendasAprovadas: parseInt(estatisticas.vendas_aprovadas || 0),
        vendasPendentes: parseInt(estatisticas.vendas_pendentes || 0),
        vendasCanceladas: parseInt(estatisticas.vendas_canceladas || 0),
        receitaTotal: parseFloat(estatisticas.receita_disponivel || 0), // Usar receita disponível
        receitaBruta: parseFloat(estatisticas.receita_total || 0), // Manter receita bruta para referência
        saquesPendentes: parseFloat(estatisticas.valor_saques_pendentes || 0),
        formatacao: 'MZN'
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

// GET - Produtos vendidos (filtrados por vendedor)
router.get('/produtos-vendidos', authenticateToken, async (req, res) => {
  try {
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    // Buscar produtos vendidos usando query raw para evitar problemas de colunas ambíguas
    const [produtosVendidos] = await Venda.sequelize.query(`
      SELECT 
        v.produto_id,
        COUNT(v.id) as quantidade,
        SUM(v.valor) as receita,
        p.nome as produto_nome,
        p.custom_id as produto_custom_id
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE v.status = 'Pago' ${isAdmin ? '' : 'AND v.vendedor_id = :vendedor_id'}
      GROUP BY v.produto_id, p.nome, p.custom_id
      ORDER BY quantidade DESC
    `, {
      replacements: isAdmin ? {} : { vendedor_id: req.user.id }
    });
    
    const resultado = produtosVendidos.map(item => {
      return {
        produto: {
          id: item.produto_id,
          nome: item.produto_nome || 'Produto não encontrado',
          customId: item.produto_custom_id || 'N/A'
        },
        quantidade: parseInt(item.quantidade),
        receita: parseFloat(item.receita || 0),
        receitaFormatada: `MZN ${parseFloat(item.receita || 0).toFixed(2)}`
      };
    });
    
    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    console.error('Erro ao buscar produtos vendidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produtos vendidos',
      error: error.message 
    });
  }
});

// GET - Clientes (filtrados por vendedor)
router.get('/clientes', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query;
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    let whereClause = isAdmin ? 'WHERE 1=1' : 'WHERE v.vendedor_id = :vendedor_id';
    let replacements = isAdmin ? {} : { vendedor_id: req.user.id };
    
    if (search) {
      whereClause += ` AND (v.cliente_nome LIKE :search OR v.cliente_email LIKE :search OR v.cliente_telefone LIKE :search)`;
      replacements.search = `%${search}%`;
    }
    
    // Buscar clientes usando query raw para evitar problemas de colunas ambíguas
    const [clientes] = await Venda.sequelize.query(`
      SELECT 
        v.cliente_nome,
        v.cliente_email,
        v.cliente_telefone,
        v.produto_id,
        v.status,
        v.created_at,
        COUNT(v.id) as total_compras,
        p.nome as produto_nome
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      ${whereClause}
      GROUP BY v.cliente_email, v.cliente_nome, v.cliente_telefone, v.produto_id, v.status, v.created_at, p.nome
      ORDER BY v.created_at DESC
    `, { replacements });
    
    const resultado = clientes.map(cliente => {
      return {
        nome: cliente.cliente_nome,
        email: cliente.cliente_email,
        telefone: cliente.cliente_telefone,
        produtoPago: cliente.produto_nome || 'Produto não encontrado',
        comprasFeitas: parseInt(cliente.total_compras),
        statusCompra: cliente.status,
        hora: cliente.created_at ? new Date(cliente.created_at).toLocaleTimeString('pt-BR') : 'N/A'
      };
    });
    
    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar clientes',
      error: error.message 
    });
  }
});

// POST - Criar nova venda
router.post('/', authenticateToken, async (req, res) => {
  try {
    const vendaData = req.body;
    
    // Gerar public_id único (6 dígitos)
    const publicId = String(Math.floor(Math.random() * 900000) + 100000);
    
    // Criar a venda usando Sequelize
    const novaVenda = await Venda.create({
      public_id: publicId,
      produto_id: vendaData.produto_id,
      vendedor_id: req.user.id, // Adicionar vendedor_id
      cliente_nome: vendaData.cliente_nome,
      cliente_email: vendaData.cliente_email,
      cliente_telefone: vendaData.cliente_telefone,
      cliente_cpf: vendaData.cliente_cpf,
      cliente_endereco: vendaData.cliente_endereco,
      cliente_cidade: vendaData.cliente_cidade,
      cliente_pais: vendaData.cliente_pais,
      cliente_ip: vendaData.cliente_ip,
      cliente_user_agent: vendaData.cliente_user_agent,
      cliente_dispositivo: vendaData.cliente_dispositivo,
      cliente_navegador: vendaData.cliente_navegador,
      metodo_pagamento: vendaData.metodo_pagamento,
      valor: vendaData.valor,
      valor_original: vendaData.valor_original,
      pagamento_desconto: vendaData.pagamento_desconto,
      pagamento_cupom: vendaData.pagamento_cupom,
      status: vendaData.status,
      referencia_pagamento: vendaData.referencia_pagamento,
      pagamento_gateway: vendaData.pagamento_gateway,
      pagamento_data_processamento: vendaData.pagamento_data_processamento,
      pagamento_referencia: vendaData.pagamento_referencia,
      pagamento_comprovante: vendaData.pagamento_comprovante,
      afiliado_codigo: vendaData.afiliado_codigo,
      afiliado_comissao: vendaData.afiliado_comissao,
      status: vendaData.status,
      created_at: vendaData.created_at,
      data_entrega: vendaData.data_entrega,
      observacoes: vendaData.observacoes,
      ip: vendaData.ip,
      user_agent: vendaData.user_agent,
      canal_venda: vendaData.canal_venda,
      origem_trafico: vendaData.origem_trafico,
      campanha: vendaData.campanha,
      utm_source: vendaData.utm_source,
      utm_medium: vendaData.utm_medium,
      utm_campaign: vendaData.utm_campaign
    });
    
    res.status(201).json({
      success: true,
      message: 'Venda criada com sucesso',
      venda: novaVenda.toJSON()
    });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ erro: 'Erro ao criar venda' });
  }
});

// PUT - Atualizar venda
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const venda = await Venda.findByPk(id);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }
    
    await venda.update(updateData);
    
    res.json({
      success: true,
      message: 'Venda atualizada com sucesso',
      venda: venda.toJSON()
    });
  } catch (error) {
    console.error('Erro ao atualizar venda:', error);
    res.status(500).json({ erro: 'Erro ao atualizar venda' });
  }
});

// DELETE - Deletar venda
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const venda = await Venda.findByPk(id);
    if (!venda) {
      return res.status(404).json({ erro: 'Venda não encontrada' });
    }
    
    await venda.destroy();
    
    res.json({
      success: true,
      message: 'Venda deletada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar venda:', error);
    res.status(500).json({ erro: 'Erro ao deletar venda' });
  }
});

// GET - Dados para gráficos dinâmicos (filtrados por vendedor)
router.get('/graficos', authenticateToken, async (req, res) => {
  try {
    const { periodo = '7dias' } = req.query;
    
    // Construir condições de busca baseadas no vendedor
    const isAdmin = req.user.role === 'admin';
    
    let dataWhere = '';
    let dataParam = '';
    const hoje = new Date();
    
    switch (periodo) {
      case '7dias':
        const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
        dataWhere = 'AND v.created_at >= :data_inicio';
        dataParam = seteDiasAtras.toISOString();
        break;
      case '30dias':
        const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
        dataWhere = 'AND v.created_at >= :data_inicio';
        dataParam = trintaDiasAtras.toISOString();
        break;
      case '90dias':
        const noventaDiasAtras = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);
        dataWhere = 'AND v.created_at >= :data_inicio';
        dataParam = noventaDiasAtras.toISOString();
        break;
      default:
        dataWhere = 'AND v.created_at >= :data_inicio';
        dataParam = seteDiasAtras.toISOString();
    }
    
    const replacements = {
      data_inicio: dataParam,
      ...(isAdmin ? {} : { vendedor_id: req.user.id })
    };
    
    const vendedorWhere = isAdmin ? '' : 'AND v.vendedor_id = :vendedor_id';
    
    // Vendas por dia
    const [vendasPorDia] = await Venda.sequelize.query(`
      SELECT 
        DATE(v.created_at) as data,
        COUNT(v.id) as quantidade,
        SUM(CASE WHEN v.status = 'Pago' THEN v.valor ELSE 0 END) as receita
      FROM vendas v
      WHERE v.status IN ('Pago', 'Pendente') ${vendedorWhere} ${dataWhere}
      GROUP BY DATE(v.created_at)
      ORDER BY data DESC
      LIMIT 30
    `, { replacements });
    
    // Vendas por status
    const [vendasPorStatus] = await Venda.sequelize.query(`
      SELECT 
        v.status as status,
        COUNT(v.id) as quantidade,
        SUM(CASE WHEN v.status = 'Pago' THEN v.valor ELSE 0 END) as receita
      FROM vendas v
      WHERE 1=1 ${vendedorWhere} ${dataWhere}
      GROUP BY v.status
    `, { replacements });
    
    // Top produtos
    const [topProdutos] = await Venda.sequelize.query(`
      SELECT 
        p.nome as produto_nome,
        COUNT(v.id) as vendas,
        SUM(CASE WHEN v.status = 'Pago' THEN v.valor ELSE 0 END) as receita
      FROM vendas v
      LEFT JOIN produtos p ON v.produto_id = p.id
      WHERE v.status = 'Pago' ${vendedorWhere} ${dataWhere}
      GROUP BY v.produto_id, p.nome
      ORDER BY vendas DESC
      LIMIT 10
    `, { replacements });
    
    // Métodos de pagamento
    const [metodosPagamento] = await Venda.sequelize.query(`
      SELECT 
        v.metodo_pagamento as metodo,
        COUNT(v.id) as quantidade,
        SUM(CASE WHEN v.status = 'Pago' THEN v.valor ELSE 0 END) as receita
      FROM vendas v
      WHERE v.status = 'Pago' ${vendedorWhere} ${dataWhere}
      GROUP BY v.metodo_pagamento
    `, { replacements });
    
    res.json({
      success: true,
      data: {
        vendasPorDia: vendasPorDia.reverse(), // Ordenar do mais antigo para o mais recente
        vendasPorStatus,
        topProdutos,
        metodosPagamento,
        periodo
      }
    });
  } catch (error) {
    console.error('Erro ao buscar dados dos gráficos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados dos gráficos',
      error: error.message 
    });
  }
});

// GET - Buscar venda específica por public_id
router.get('/:publicId', authenticateToken, convertVendaPublicId, async (req, res) => {
  try {
    const vendaId = req.vendaId; // UUID convertido pelo middleware
    
    const venda = await Venda.findByPk(vendaId, {
      include: [{
        model: Produto,
        attributes: ['id', 'nome', 'custom_id', 'public_id']
      }]
    });

    if (!venda) {
      return res.status(404).json({ 
        success: false, 
        message: 'Venda não encontrada' 
      });
    }

    // Verificar se o vendedor tem acesso à venda (exceto admin)
    if (req.user.role !== 'admin' && venda.vendedor_id !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Acesso negado. Esta venda não pertence ao seu catálogo.' 
      });
    }

    // Formatar dados da venda
    const vendaFormatada = {
      public_id: venda.public_id,
      produto_id: venda.produto_id,
      produto_nome: venda.Produto?.nome || 'Produto não encontrado',
      produto_custom_id: venda.Produto?.custom_id || 'N/A',
      produto_public_id: venda.Produto?.public_id || null,
      cliente_nome: venda.cliente_nome,
      cliente_email: venda.cliente_email,
      cliente_telefone: venda.cliente_telefone,
      status: venda.status,
      valor: venda.valor,
      metodo_pagamento: venda.metodo_pagamento,
      referencia_pagamento: venda.referencia_pagamento,
      created_at: venda.created_at
    };

    res.json({
      success: true,
      data: vendaFormatada
    });
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao buscar venda',
      error: error.message 
    });
  }
});

module.exports = router;

