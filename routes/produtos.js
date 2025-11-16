const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const LocalImageService = require('../services/localImageService');
const LargeFileService = require('../services/largeFileService');
const GeminiService = require('../services/geminiService');
const { Produto, Usuario } = require('../config/database');
const { Op } = require('sequelize');
const { authenticateToken, isAdmin, isVendedorOrAdmin } = require('../middleware/auth');
const { convertProdutoPublicId } = require('../middleware/uuidConverter');

// Rota pública simples para listar todos os produtos (para admin)
router.get('/public', async (req, res) => {
  try {
    console.log('📋 Carregando todos os produtos (endpoint público)...');
    
    const produtos = await Produto.findAll({
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }],
      order: [['created_at', 'DESC']]
    });
    
    console.log(`✅ Encontrados ${produtos.length} produtos`);
    
    res.json({
      success: true,
      data: produtos,
      total: produtos.length
    });
  } catch (error) {
    console.error('❌ Erro ao carregar produtos públicos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar produtos',
      data: []
    });
  }
});

// Rota para produtos que permitem afiliados (para página de afiliados)
router.get('/afiliados', async (req, res) => {
  try {
    console.log('📋 Carregando produtos que permitem afiliados...');
    
    const produtos = await Produto.findAll({
      where: {
        permitir_afiliados: true,
        ativo: true
      },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }],
      order: [['created_at', 'DESC']]
    });
    
    console.log(`✅ Encontrados ${produtos.length} produtos com afiliados permitidos`);
    
    res.json({
      success: true,
      data: produtos,
      total: produtos.length
    });
  } catch (error) {
    console.error('❌ Erro ao carregar produtos para afiliados:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar produtos',
      data: []
    });
  }
});

// Rota para servir imagens dos produtos
router.get('/imagem/:customId', async (req, res) => {
  try {
    const { customId } = req.params;
    
    // Buscar produto pelo custom_id
    const produto = await Produto.findOne({
      where: { custom_id: customId }
    });
    
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    if (!produto.imagem_url) {
      // Retornar imagem padrão se não tiver imagem
      return res.redirect('/assets/images/ratixpay-logo.png');
    }
    
    // Redirecionar para a URL da imagem
    res.redirect(produto.imagem_url);
    
  } catch (error) {
    console.error('Erro ao buscar imagem do produto:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, 'imagem-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// ======================== ROTAS DE IA ========================

// Rota para gerar perguntas com IA
router.post('/ai/generate-questions', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { productType, category } = req.body;
    
    if (!productType || !category) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios não fornecidos',
        message: 'Tipo de produto e categoria são obrigatórios'
      });
    }

    const perguntas = await GeminiService.gerarPerguntasProduto({
      tipo: productType,
      categoria: category
    });

    res.json({
      success: true,
      questions: perguntas
    });

  } catch (error) {
    console.error('❌ Erro ao gerar perguntas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// ======================== ROTA UNIFICADA DE CRIAÇÃO ========================

// Rota para criar produto com configurações integradas
router.post('/', authenticateToken, isVendedorOrAdmin, upload.any(), async (req, res) => {
  try {
    console.log('🔄 Criando produto com configurações integradas...');
    console.log('📋 Dados recebidos:', req.body);
    console.log('🔍 Verificando configurações específicas:');
    console.log('  - discount_config:', req.body.discount_config);
    console.log('  - timer_config:', req.body.timer_config);
    console.log('  - blackfriday_config:', req.body.blackfriday_config);

    // Extrair dados do produto
  const {
      type,
      name,
      category,
      description,
      price,
      finalPrice,
      marketplace,
      contentLink,
      observations,
      imagem_url,
      // Configuração Order Bump (opcionais)
      order_bump_ativo,
      order_bump_produtos,
      // Configurações integradas
      discount_config,
      timer_config,
      blackfriday_config,
      remarketing_config,
      // Configurações de afiliados
      permitir_afiliados,
      comissao_afiliados,
      comissao_minima,
      tipo_comissao,
      tier_config,
      // Solicitação de aprovação manual
      solicitar_aprovacao
    } = req.body;

    // Validações
    if (!name || !category || !description || !price || !finalPrice) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios não fornecidos',
        message: 'Nome, categoria, descrição, preço e preço final são obrigatórios'
      });
    }

    // Validar se há imagem (obrigatória)
    console.log('🔍 Verificando imagem:', { imagem_url, imagemBase64: req.body.imagemBase64 ? 'presente' : 'ausente' });
    
    if (!imagem_url) {
      console.log('❌ Produto rejeitado: sem imagem');
      return res.status(400).json({
        success: false,
        error: 'IMAGEM_OBRIGATORIA',
        message: 'É obrigatório fornecer uma imagem para o produto'
      });
    }

    // Verificar se já existe um produto com o mesmo nome para este vendedor
    const existingProduct = await Produto.findOne({
      where: {
        nome: name,
        vendedor_id: req.user.id
      }
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        error: 'PRODUCT_EXISTS',
        message: 'Já existe um produto com este nome no seu catálogo. Escolha um nome diferente.'
      });
    }

    // Gerar custom_id único
    let customId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      customId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const existing = await Produto.findOne({ where: { custom_id: customId } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Não foi possível gerar um ID único para o produto');
    }

    // Verificar se o Gemini AI está disponível e ativo
    const geminiService = GeminiService;
    let verificacaoGemini = null;
    
    try {
      // Verificar se a API key do Gemini está configurada (suporta ambas as variáveis)
      const geminiApiKey = process.env.Google_gimine_key_api || process.env.GEMINI_API_KEY;
      
      if (geminiApiKey && geminiApiKey !== 'sua_chave_gemini_aqui' && geminiApiKey.trim() !== '') {
        console.log('🤖 Verificando produto com Gemini AI...');
        
        const dadosVerificacao = {
          nome: name,
          tipo: type || 'digital',
          categoria: category || '',
          descricao: description,
          conteudo_link: contentLink || null,
          conteudo_arquivo_nome: null // Sem arquivo na criação simples
        };
        
        verificacaoGemini = await geminiService.verificarProduto(dadosVerificacao);
        
        if (!verificacaoGemini.aprovado) {
          console.log('❌ Produto rejeitado pelo Gemini AI:', verificacaoGemini.motivo);
          
          // Verificar se o usuário quer solicitar aprovação manual
          const solicitarAprovacao = solicitar_aprovacao === 'true' || solicitar_aprovacao === true;
          
          if (solicitarAprovacao) {
            // Salvar produto como rascunho pendente de aprovação
            console.log('📝 Salvando produto como rascunho pendente de aprovação manual...');
            
            const publicId = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Processar configurações integradas
            let discountConfig = null;
            let timerConfig = null;
            let blackFridayConfig = null;
            let remarketingConfig = null;

            if (discount_config) {
              try {
                discountConfig = typeof discount_config === 'string' ? JSON.parse(discount_config) : discount_config;
              } catch (error) {
                console.log('❌ Erro ao processar discount_config:', error);
              }
            }

            if (timer_config) {
              try {
                timerConfig = typeof timer_config === 'string' ? JSON.parse(timer_config) : timer_config;
              } catch (error) {
                console.log('❌ Erro ao processar timer_config:', error);
              }
            }

            if (blackfriday_config) {
              try {
                blackFridayConfig = typeof blackfriday_config === 'string' ? JSON.parse(blackfriday_config) : blackfriday_config;
              } catch (error) {
                console.log('❌ Erro ao processar blackfriday_config:', error);
              }
            }

            if (remarketing_config) {
              try {
                remarketingConfig = typeof remarketing_config === 'string' ? JSON.parse(remarketing_config) : remarketing_config;
              } catch (error) {
                console.log('❌ Erro ao processar remarketing_config:', error);
              }
            }
            
            const produto = await Produto.create({
              public_id: publicId,
              custom_id: customId,
              vendedor_id: req.user.id,
              nome: name,
              categoria: category,
              descricao: description,
              preco: parseFloat(price),
              preco_final: parseFloat(finalPrice),
              tipo: type || 'digital',
              imagem_url: imagem_url,
              imagem_public_id: imagem_url ? imagem_url.split('/').pop().split('.')[0] : null,
              conteudo_link: contentLink || null,
              conteudo_arquivo: null,
              conteudo_arquivo_nome: null,
              link_conteudo: contentLink || null,
              marketplace: marketplace === 'true',
              observacoes: observations || null,
              ativo: false, // Produto inativo até aprovação
              status_aprovacao: 'pendente_aprovacao',
              motivo_rejeicao: verificacaoGemini.motivo,
              order_bump_ativo: order_bump_ativo === true || order_bump_ativo === 'true' || false,
              permitir_afiliados: permitir_afiliados === true || permitir_afiliados === 'true' || false,
              comissao_afiliados: parseFloat(comissao_afiliados) || 0,
              comissao_minima: parseFloat(comissao_minima) || 0,
              tipo_comissao: tipo_comissao || 'percentual',
              tier_config: tier_config ? JSON.parse(tier_config) : null,
              order_bump_produtos: Array.isArray(order_bump_produtos) ? order_bump_produtos : null,
              discount_config: discountConfig,
              timer_config: timerConfig,
              blackfriday_config: blackFridayConfig,
              remarketing_config: remarketingConfig
            });
            
            // Notificar admin sobre solicitação de aprovação
            try {
              const emailManagerService = require('../services/emailManagerService');
              const { Usuario } = require('../config/database');
              const vendedor = await Usuario.findByPk(req.user.id);
              
              // Buscar admin (verificar múltiplos campos possíveis)
              const admin = await Usuario.findOne({ 
                where: {
                  [Op.or]: [
                    { role: 'admin' },
                    { tipo_conta: 'admin' },
                    { email: 'ratixpay.mz@gmail.com' }
                  ]
                },
                order: [['created_at', 'DESC']]
              });
              
              if (admin && admin.email) {
                await emailManagerService.enviarEmailSistema('solicitacao_aprovacao_produto', {
                  email: admin.email,
                  nome: admin.nome_completo || 'Administrador',
                  produto: {
                    id: produto.id,
                    custom_id: produto.custom_id,
                    nome: produto.nome,
                    descricao: produto.descricao,
                    categoria: produto.categoria,
                    tipo: produto.tipo,
                    imagem_url: produto.imagem_url
                  },
                  vendedor: {
                    nome: vendedor.nome_completo || vendedor.email,
                    email: vendedor.email
                  },
                  motivo_rejeicao: verificacaoGemini.motivo
                });
                console.log(`📧 Notificação de solicitação de aprovação enviada para admin: ${admin.email}`);
              }
            } catch (emailError) {
              console.error('⚠️ Erro ao enviar notificação de solicitação de aprovação:', emailError);
            }
            
            return res.status(200).json({
              success: true,
              message: 'Produto salvo como rascunho e enviado para aprovação manual do administrador',
              produto: {
                id: produto.id,
                custom_id: produto.custom_id,
                nome: produto.nome,
                status_aprovacao: produto.status_aprovacao,
                ativo: produto.ativo
              },
              verificacao: {
                aprovado: false,
                motivo: verificacaoGemini.motivo,
                score: verificacaoGemini.score || 0,
                resposta_ia: verificacaoGemini.resposta_ia,
                timestamp: verificacaoGemini.timestamp || new Date().toISOString()
              },
              pendente_aprovacao: true
            });
          }
          
          // Se não solicitou aprovação, retornar erro
          return res.status(400).json({
            success: false,
            error: 'PRODUTO_REJEITADO',
            message: `Produto não aprovado pela verificação automática: ${verificacaoGemini.motivo || 'Não atende aos critérios da plataforma'}`,
            verificacao: {
              aprovado: false,
              motivo: verificacaoGemini.motivo,
              score: verificacaoGemini.score || 0,
              resposta_ia: verificacaoGemini.resposta_ia,
              timestamp: verificacaoGemini.timestamp || new Date().toISOString()
            },
            pode_solicitar_aprovacao: true
          });
        }
        
        console.log('✅ Produto aprovado pelo Gemini AI (Score:', verificacaoGemini.score || 100, ')');
      } else {
        console.log('⚠️ Gemini AI não configurado - produto será criado sem verificação automática');
        console.log('💡 Configure Google_gimine_key_api no arquivo .env para ativar verificação automática');
      }
    } catch (error) {
      console.error('❌ Erro na verificação do Gemini AI:', error);
      // Em caso de erro, aprovar automaticamente o produto
      console.log('⚠️ Gemini AI indisponível - Aprovando produto automaticamente');
      verificacaoGemini = {
        aprovado: true,
        motivo: 'Aprovado automaticamente devido a erro na verificação do Gemini AI',
        score: 100,
        resposta_ia: 'Erro técnico na verificação - produto aprovado automaticamente',
        timestamp: new Date().toISOString(),
        erro: error.message
      };
    }

    // Gerar public_id único (6 dígitos)
    const publicId = Math.floor(100000 + Math.random() * 900000).toString();

    // Processar configurações integradas
    console.log('🔧 Processando configurações integradas...');
    console.log('📋 discount_config recebido:', discount_config);
    console.log('📋 timer_config recebido:', timer_config);
    console.log('📋 blackfriday_config recebido:', blackfriday_config);
    console.log('📋 remarketing_config recebido:', remarketing_config);
    
    let discountConfig = null;
    let timerConfig = null;
    let blackFridayConfig = null;
    let remarketingConfig = null;

    if (discount_config) {
      try {
        discountConfig = typeof discount_config === 'string' ? JSON.parse(discount_config) : discount_config;
        console.log('✅ discount_config processado:', discountConfig);
      } catch (error) {
        console.log('❌ Erro ao processar discount_config:', error);
      }
    }

    if (timer_config) {
      try {
        timerConfig = typeof timer_config === 'string' ? JSON.parse(timer_config) : timer_config;
        console.log('✅ timer_config processado:', timerConfig);
      } catch (error) {
        console.log('❌ Erro ao processar timer_config:', error);
      }
    }

    if (blackfriday_config) {
      try {
        blackFridayConfig = typeof blackfriday_config === 'string' ? JSON.parse(blackfriday_config) : blackfriday_config;
        console.log('✅ blackfriday_config processado:', blackFridayConfig);
      } catch (error) {
        console.log('❌ Erro ao processar blackfriday_config:', error);
      }
    }

    if (remarketing_config) {
      try {
        remarketingConfig = typeof remarketing_config === 'string' ? JSON.parse(remarketing_config) : remarketing_config;
        console.log('✅ remarketing_config processado:', remarketingConfig);
      } catch (error) {
        console.log('❌ Erro ao processar remarketing_config:', error);
      }
    }

    // Criar produto
    console.log('💾 Salvando produto no banco de dados...');
    console.log('🔧 Configurações que serão salvas:');
    console.log('  - discount_config:', discountConfig);
    console.log('  - timer_config:', timerConfig);
    console.log('  - blackfriday_config:', blackFridayConfig);
    
    const produto = await Produto.create({
      public_id: publicId,
      custom_id: customId,
      vendedor_id: req.user.id,
      nome: name,
      categoria: category,
      descricao: description,
      preco: parseFloat(price),
      preco_final: parseFloat(finalPrice),
      tipo: type || 'digital',
      imagem_url: imagem_url, // Usar imagem enviada
      imagem_public_id: imagem_url ? imagem_url.split('/').pop().split('.')[0] : null,
      conteudo_link: contentLink || null,
      conteudo_arquivo: null,
      conteudo_arquivo_nome: null,
      link_conteudo: contentLink || null,
      marketplace: marketplace === 'true',
      observacoes: observations || null,
      ativo: true,
      status_aprovacao: 'aprovado', // Aprovado automaticamente pelo Gemini
      // Persistir configuração Order Bump se enviada
      order_bump_ativo: order_bump_ativo === true || order_bump_ativo === 'true' || false,
      // Configurações de afiliados
      permitir_afiliados: permitir_afiliados === true || permitir_afiliados === 'true' || false,
      comissao_afiliados: parseFloat(comissao_afiliados) || 0,
      comissao_minima: parseFloat(comissao_minima) || 0,
      tipo_comissao: tipo_comissao || 'percentual',
      tier_config: tier_config ? JSON.parse(tier_config) : null,
      order_bump_produtos: Array.isArray(order_bump_produtos) ? order_bump_produtos : null,
      // Configurações integradas
      discount_config: discountConfig,
      timer_config: timerConfig,
      blackfriday_config: blackFridayConfig,
      remarketing_config: remarketingConfig
    });
    
    console.log('✅ Produto criado com sucesso!');
    console.log('📊 Configurações salvas no banco:');
    console.log('  - discount_config:', produto.discount_config);
    console.log('  - timer_config:', produto.timer_config);
    console.log('  - blackfriday_config:', produto.blackfriday_config);

    console.log(`✅ Produto criado com sucesso: ${produto.custom_id}`);

    // Enviar notificação de criação de produto ao vendedor
    try {
      const { Usuario } = require('../config/database');
      const vendedor = await Usuario.findByPk(req.user.id);
      if (vendedor && vendedor.email) {
        const emailManagerService = require('../services/emailManagerService');
        await emailManagerService.enviarEmailSistema('notificacao_produto_criado', {
          email: vendedor.email,
          nome: vendedor.nome_completo || vendedor.email,
          produto: {
            id: produto.id,
            custom_id: produto.custom_id,
            nome: produto.nome,
            preco: produto.preco
          }
        });
        console.log(`📧 Notificação de criação de produto enviada para: ${vendedor.email}`);
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar notificação de criação de produto:', emailError);
      // Não bloquear a operação se o email falhar
    }

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: produto.preco,
        preco_final: produto.preco_final,
        imagem_url: produto.imagem_url,
        ativo: produto.ativo
      },
      verificacao: verificacaoGemini ? {
        aprovado: verificacaoGemini.aprovado,
        motivo: verificacaoGemini.motivo,
        score: verificacaoGemini.score,
        resposta_ia: verificacaoGemini.resposta_ia,
        timestamp: verificacaoGemini.timestamp
      } : null
    });

  } catch (error) {
    console.error('❌ Erro ao criar produto simples:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// Rota para criar produto com upload de arquivos grandes (nova página unificada)
router.post('/unificado', authenticateToken, isVendedorOrAdmin, LargeFileService.getUploadMiddleware(), async (req, res) => {
  try {
    console.log('🔄 Criando produto unificado...');
    console.log('📋 Dados recebidos:', req.body);
    console.log('📁 Arquivos recebidos:', req.files);

    // Processar uploads
    const uploads = await LargeFileService.processProductUploads(req);
    console.log('✅ Uploads processados:', uploads);

    // Extrair dados do produto
    const {
      type,
      name,
      category,
      description,
      price,
      finalPrice,
      marketplace,
      contentLink,
      observations,
      solicitar_aprovacao
    } = req.body;

    // Validações
    if (!name || !category || !description || !price || !finalPrice) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios não fornecidos',
        message: 'Nome, categoria, descrição, preço e preço final são obrigatórios'
      });
    }

    if (!uploads.image) {
      return res.status(400).json({
        success: false,
        error: 'Imagem obrigatória',
        message: 'Uma imagem do produto é obrigatória'
      });
    }

    // Gerar custom_id único
    let customId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      customId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const existing = await Produto.findOne({ where: { custom_id: customId } });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error('Não foi possível gerar um ID único para o produto');
    }

    // Verificar se o Gemini AI está disponível e ativo
    const geminiService = GeminiService;
    let verificacaoGemini = null;
    
    try {
      // Verificar se a API key do Gemini está configurada (suporta ambas as variáveis)
      const geminiApiKey = process.env.Google_gimine_key_api || process.env.GEMINI_API_KEY;
      
      if (geminiApiKey && geminiApiKey !== 'sua_chave_gemini_aqui' && geminiApiKey.trim() !== '') {
        console.log('🤖 Verificando produto com Gemini AI...');
        
        const dadosVerificacao = {
          nome: name,
          tipo: type || 'digital',
          categoria: category || '',
          descricao: description,
          conteudo_link: contentLink || null,
          conteudo_arquivo_nome: uploads.contentFile ? uploads.contentFile.fileName : null
        };
        
        verificacaoGemini = await geminiService.verificarProduto(dadosVerificacao);
        
        if (!verificacaoGemini.aprovado) {
          console.log('❌ Produto rejeitado pelo Gemini AI:', verificacaoGemini.motivo);
          
          // Verificar se o usuário quer solicitar aprovação manual
          const solicitarAprovacao = solicitar_aprovacao === 'true' || solicitar_aprovacao === true;
          
          if (solicitarAprovacao) {
            // Salvar produto como rascunho pendente de aprovação
            console.log('📝 Salvando produto como rascunho pendente de aprovação manual...');
            
            const publicId = Math.floor(100000 + Math.random() * 900000).toString();
            
            const produto = await Produto.create({
              public_id: publicId,
              custom_id: customId,
              vendedor_id: req.user.id,
              nome: name,
              categoria: category,
              descricao: description,
              preco: parseFloat(price),
              preco_final: parseFloat(finalPrice),
              tipo: type || 'digital',
              imagem_url: uploads.image.url,
              imagem_public_id: uploads.image.publicId || null,
              conteudo_link: contentLink || null,
              conteudo_arquivo: uploads.contentFile ? uploads.contentFile.url : null,
              conteudo_arquivo_nome: uploads.contentFile ? uploads.contentFile.fileName : null,
              link_conteudo: contentLink || null,
              marketplace: marketplace === 'true',
              observacoes: observations || null,
              ativo: false, // Produto inativo até aprovação
              status_aprovacao: 'pendente_aprovacao',
              motivo_rejeicao: verificacaoGemini.motivo
            });
            
            // Notificar admin sobre solicitação de aprovação
            try {
              const emailManagerService = require('../services/emailManagerService');
              const { Usuario } = require('../config/database');
              const vendedor = await Usuario.findByPk(req.user.id);
              
              // Buscar admin (verificar múltiplos campos possíveis)
              const admin = await Usuario.findOne({ 
                where: {
                  [Op.or]: [
                    { role: 'admin' },
                    { tipo_conta: 'admin' },
                    { email: 'ratixpay.mz@gmail.com' }
                  ]
                },
                order: [['created_at', 'DESC']]
              });
              
              if (admin && admin.email) {
                await emailManagerService.enviarEmailSistema('solicitacao_aprovacao_produto', {
                  email: admin.email,
                  nome: admin.nome_completo || 'Administrador',
                  produto: {
                    id: produto.id,
                    custom_id: produto.custom_id,
                    nome: produto.nome,
                    descricao: produto.descricao,
                    categoria: produto.categoria,
                    tipo: produto.tipo,
                    imagem_url: produto.imagem_url
                  },
                  vendedor: {
                    nome: vendedor.nome_completo || vendedor.email,
                    email: vendedor.email
                  },
                  motivo_rejeicao: verificacaoGemini.motivo
                });
                console.log(`📧 Notificação de solicitação de aprovação enviada para admin: ${admin.email}`);
              }
            } catch (emailError) {
              console.error('⚠️ Erro ao enviar notificação de solicitação de aprovação:', emailError);
            }
            
            return res.status(200).json({
              success: true,
              message: 'Produto salvo como rascunho e enviado para aprovação manual do administrador',
              produto: {
                id: produto.id,
                custom_id: produto.custom_id,
                nome: produto.nome,
                status_aprovacao: produto.status_aprovacao,
                ativo: produto.ativo
              },
              verificacao: {
                aprovado: false,
                motivo: verificacaoGemini.motivo,
                score: verificacaoGemini.score || 0,
                resposta_ia: verificacaoGemini.resposta_ia,
                timestamp: verificacaoGemini.timestamp || new Date().toISOString()
              },
              pendente_aprovacao: true
            });
          }
          
          // Se não solicitou aprovação, retornar erro
          return res.status(400).json({
            success: false,
            error: 'PRODUTO_REJEITADO',
            message: `Produto não aprovado pela verificação automática: ${verificacaoGemini.motivo || 'Não atende aos critérios da plataforma'}`,
            verificacao: {
              aprovado: false,
              motivo: verificacaoGemini.motivo,
              score: verificacaoGemini.score || 0,
              resposta_ia: verificacaoGemini.resposta_ia,
              timestamp: verificacaoGemini.timestamp || new Date().toISOString()
            },
            pode_solicitar_aprovacao: true
          });
        }
        
        console.log('✅ Produto aprovado pelo Gemini AI (Score:', verificacaoGemini.score || 100, ')');
      } else {
        console.log('⚠️ Gemini AI não configurado - produto será criado sem verificação automática');
        console.log('💡 Configure Google_gimine_key_api no arquivo .env para ativar verificação automática');
      }
    } catch (error) {
      console.error('❌ Erro na verificação do Gemini AI:', error);
      // Em caso de erro, aprovar automaticamente o produto
      console.log('⚠️ Gemini AI indisponível - Aprovando produto automaticamente');
      verificacaoGemini = {
        aprovado: true,
        motivo: 'Aprovado automaticamente devido a erro na verificação do Gemini AI',
        score: 100,
        resposta_ia: 'Erro técnico na verificação - produto aprovado automaticamente',
        timestamp: new Date().toISOString(),
        erro: error.message
      };
    }

    // Gerar public_id único (6 dígitos)
    const publicId = Math.floor(100000 + Math.random() * 900000).toString();

    // Criar produto
    const produto = await Produto.create({
      public_id: publicId,
      custom_id: customId,
      vendedor_id: req.user.id,
      nome: name,
      categoria: category,
      descricao: description,
      preco: parseFloat(price),
      preco_final: parseFloat(finalPrice),
      tipo: type || 'digital',
      imagem_url: uploads.image.url,
      imagem_public_id: uploads.image.fileName,
      conteudo_link: contentLink || (uploads.contentFile ? uploads.contentFile.url : null),
      conteudo_arquivo: uploads.contentFile ? uploads.contentFile.url : null,
      conteudo_arquivo_nome: uploads.contentFile ? uploads.contentFile.fileName : null,
      link_conteudo: contentLink || (uploads.contentFile ? uploads.contentFile.url : null),
      marketplace: marketplace === 'true',
      observacoes: observations || null,
      ativo: true
    });

    console.log(`✅ Produto criado com sucesso: ${produto.custom_id}`);

    // Enviar notificação de criação de produto ao vendedor
    try {
      const { Usuario } = require('../config/database');
      const vendedor = await Usuario.findByPk(req.user.id);
      if (vendedor && vendedor.email) {
        const emailManagerService = require('../services/emailManagerService');
        await emailManagerService.enviarEmailSistema('notificacao_produto_criado', {
          email: vendedor.email,
          nome: vendedor.nome_completo || vendedor.email,
          produto: {
            id: produto.id,
            custom_id: produto.custom_id,
            nome: produto.nome,
            preco: produto.preco
          }
        });
        console.log(`📧 Notificação de criação de produto enviada para: ${vendedor.email}`);
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar notificação de criação de produto:', emailError);
      // Não bloquear a operação se o email falhar
    }

    res.status(201).json({
      success: true,
      message: 'Produto criado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        categoria: produto.categoria,
        preco: produto.preco,
        preco_final: produto.preco_final,
        imagem_url: produto.imagem_url,
        ativo: produto.ativo
      },
      verificacao: verificacaoGemini ? {
        aprovado: verificacaoGemini.aprovado,
        motivo: verificacaoGemini.motivo,
        score: verificacaoGemini.score,
        resposta_ia: verificacaoGemini.resposta_ia,
        timestamp: verificacaoGemini.timestamp
      } : null
    });

  } catch (error) {
    console.error('❌ Erro ao criar produto unificado:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

// ======================== ROTAS DE CONSULTA ========================

// Rota para upload de imagem (usada durante a criação)
router.post('/upload-imagem', authenticateToken, isVendedorOrAdmin, upload.single('imagem'), async (req, res) => {
  try {
    let imagemBase64 = null;
    
    // Processar imagem (arquivo ou base64)
    if (req.file) {
      const filePath = req.file.path;
      const fileContent = fs.readFileSync(filePath);
      imagemBase64 = `data:${req.file.mimetype};base64,${fileContent.toString('base64')}`;
      fs.unlinkSync(filePath); // Remover arquivo temporário
    } else if (req.body.imagemBase64) {
      imagemBase64 = req.body.imagemBase64;
    } else {
      return res.status(400).json({ erro: 'Nenhuma imagem fornecida' });
    }
    
    // Upload para armazenamento local
    const resultado = await LocalImageService.uploadImagem(
      imagemBase64, 
      'produtos', 
      `temp_${Date.now()}.jpg` // Nome do arquivo temporário com extensão
    );
    
    console.log(`✅ Imagem temporária salva localmente`);
    
    res.json({
      url: resultado.url,
      imagemUrl: resultado.url,
      publicId: resultado.publicId
    });
  } catch (error) {
    console.error('Erro ao fazer upload de imagem temporária:', error);
    res.status(500).json({ erro: 'Erro ao processar o upload da imagem' });
  }
});

// Rota para listar produtos (OTIMIZADA - filtrada por vendedor se autenticado)
router.get('/', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Buscando produtos para usuário:', req.user.id, 'Role:', req.user.role);
    
    // Construir query otimizada
    const whereClause = {};
    const queryOptions = {
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: Math.min(parseInt(req.query.limite) || 50, 100), // Máximo 100 produtos
      offset: parseInt(req.query.offset) || 0
    };
    
    // SEGURANÇA CRÍTICA: Filtrar por vendedor se não for admin
    if (req.user.role !== 'admin') {
      if (!req.user.id) {
        console.error('❌ ID do usuário não encontrado:', req.user);
        return res.status(400).json({ 
          success: false,
          message: 'ID do usuário não encontrado',
          data: [] 
        });
      }
      
      whereClause.vendedor_id = req.user.id;
      console.log('🔒 Filtrando produtos APENAS para vendedor:', req.user.id);
      } else {
      console.log('👑 Usuário admin - carregando todos os produtos');
    }
    
    // Filtro de status
    if (req.query.ativo !== undefined) {
      whereClause.ativo = req.query.ativo === 'true';
    } else {
      whereClause.ativo = true; // Por padrão, apenas produtos ativos
    }
    
    // Buscar produtos com query otimizada
    const produtos = await Produto.findAll(queryOptions);
    
    console.log(`✅ Encontrados ${produtos.length} produtos para o usuário ${req.user.id}`);
    
    res.json({ 
      success: true,
      data: produtos,
      total: produtos.length,
      usuario_id: req.user.id
    });
  } catch (error) {
    console.error('❌ Erro ao buscar produtos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro interno do servidor ao buscar produtos',
      data: []
    });
  }
});

// Rota pública para buscar um produto pelo public_id ou custom_id (usada no checkout)
router.get('/public/:productId', async (req, res) => {
  try {
    const productId = req.params.productId;
    
    // Buscar produto por public_id (6 dígitos), custom_id ou id (UUID)
    let whereClause;
    
    if (/^\d{6}$/.test(productId)) {
      // Se for 6 dígitos, buscar por public_id
      whereClause = { public_id: productId };
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
      // Se for UUID, buscar por id
      whereClause = { id: productId };
    } else {
      // Caso contrário, buscar por custom_id
      whereClause = { custom_id: productId };
    }

    // Buscar produto - Sequelize retorna todos os campos por padrão
    const produto = await Produto.findOne({ 
      where: whereClause,
      raw: false // Garantir que retorna instância do Sequelize (não objeto plano)
    });

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Verificar se o produto está ativo (tratar undefined como false)
    if (produto.ativo !== true) {
      return res.status(404).json({ erro: 'Produto não disponível' });
    }

    // Log para debug das configurações Utmify
    console.log(`📊 Produto ${produto.nome} - Configurações Utmify (antes de criar objeto):`, {
      utmfy_active: produto.utmfy_active,
      utmfy_api_key: produto.utmfy_api_key ? produto.utmfy_api_key.substring(0, 15) + '...' : 'null',
      utmfy_token_type: produto.utmfy_token_type,
      utmfy_events: produto.utmfy_events,
      has_utmfy_active: 'utmfy_active' in produto,
      has_utmfy_api_key: 'utmfy_api_key' in produto,
      allKeys: Object.keys(produto).filter(k => k.includes('utmfy'))
    });
    
    // Converter para objeto simples para garantir que todos os campos estão disponíveis
    const produtoData = produto.toJSON ? produto.toJSON() : produto;

    // Retornar apenas dados públicos do produto
    const produtoPublico = {
      id: produtoData.id,
      public_id: produtoData.public_id,
      custom_id: produtoData.custom_id,
      nome: produtoData.nome,
      tipo: produtoData.tipo,
      categoria: produtoData.categoria,
      preco: produtoData.preco,
      desconto: produtoData.desconto,
      preco_com_desconto: produtoData.preco_com_desconto,
      descricao: produtoData.descricao,
      imagem_url: produtoData.imagem_url,
      vendedor_id: produtoData.vendedor_id, // Importante para o checkout
      vendedor: produtoData.vendedor ? {
        id: produtoData.vendedor.id,
        nome_completo: produtoData.vendedor.nome_completo
      } : null,
      // Configurações integradas de marketing
      discount_config: produtoData.discount_config,
      timer_config: produtoData.timer_config,
      blackfriday_config: produtoData.blackfriday_config,
      // Configurações de Meta Pixel
      pixel_id: produtoData.pixel_id,
      pixel_events: produtoData.pixel_events,
      // Configurações de UTMify
      utmfy_api_key: produtoData.utmfy_api_key,
      utmfy_token_type: produtoData.utmfy_token_type,
      utmfy_events: produtoData.utmfy_events,
      utmfy_active: produtoData.utmfy_active
    };

    // Log final para debug
    console.log(`📤 Retornando produto público - Campos Utmify incluídos:`, {
      utmfy_active: produtoPublico.utmfy_active,
      utmfy_api_key: produtoPublico.utmfy_api_key ? produtoPublico.utmfy_api_key.substring(0, 15) + '...' : 'null',
      utmfy_token_type: produtoPublico.utmfy_token_type,
      utmfy_events: produtoPublico.utmfy_events
    });
    
    res.json(produtoPublico);
  } catch (error) {
    console.error('Erro ao buscar produto público:', error);
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

// ======================== ROTA PARA BUSCAR PRODUTO POR ID (UUID) ========================

// GET /produtos/:id - Buscar produto específico por ID (UUID)
router.get('/:id', authenticateToken, async (req, res) => {
  console.log(`🚀 [ROTA] GET /produtos/:id chamada com ID: ${req.params.id}`);
  try {
    const { id } = req.params;
    
    console.log(`🔍 [DEBUG] Buscando produto por ID: ${id}`);
    console.log(`🔍 [DEBUG] Usuário autenticado:`, req.user?.id, req.user?.tipo_usuario);
    
    // Verificar se é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.log(`❌ [DEBUG] ID inválido (não é UUID): ${id}`);
      return res.status(400).json({
        success: false,
        message: 'ID inválido'
      });
    }
    
    console.log(`✅ [DEBUG] UUID válido, buscando no banco...`);
    
    // Buscar produto por ID (UUID)
    const produto = await Produto.findByPk(id, {
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });
    
    if (!produto) {
      console.log(`❌ [DEBUG] Produto não encontrado no banco: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }
    
    console.log(`✅ [DEBUG] Produto encontrado: ${produto.nome}, vendedor_id: ${produto.vendedor_id}`);
    
    // Verificar se o usuário tem permissão para acessar este produto
    // Admin pode acessar qualquer produto, vendedor só pode acessar seus próprios produtos
    if (req.user.tipo_usuario !== 'admin' && produto.vendedor_id !== req.user.id) {
      console.log(`❌ [DEBUG] Usuário ${req.user.id} não tem permissão para acessar produto ${id} (vendedor: ${produto.vendedor_id})`);
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar este produto'
      });
    }
    
    console.log(`✅ [DEBUG] Permissão OK, retornando dados do produto`);
    
    res.json({
      success: true,
      data: produto
    });
  } catch (error) {
    console.error('❌ [DEBUG] Erro ao buscar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar produto',
      error: error.message
    });
  }
});

// Rota para buscar um produto pelo public_id ou UUID (requer autenticação)
router.get('/:publicId', authenticateToken, convertProdutoPublicId, async (req, res) => {
  try {
    const produtoId = req.produtoId; // UUID convertido pelo middleware
    
    const produto = await Produto.findByPk(produtoId);

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    // Verificar se o vendedor tem acesso ao produto (exceto admin)
    if (req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }

    res.json(produto);
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

// ======================== FLUXO DE CRIAÇÃO EM ETAPAS ========================

// ETAPA 1: Iniciar produto (gerar custom_id e criar registro inicial)
router.post('/iniciar', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { nome, tipo, categoria, preco } = req.body;
    
    if (!nome || !tipo) {
      return res.status(400).json({ erro: 'Nome e tipo são obrigatórios' });
    }
    
    // Gerar custom_id único
    const customId = generateProductId(tipo);
    
    // Gerar public_id único (6 dígitos)
    const publicId = generatePublicId();
    
    // Verificar se o custom_id já existe
    const produtoExistente = await Produto.findOne({ where: { custom_id: customId } });
    if (produtoExistente) {
      return res.status(409).json({ erro: 'ID do produto já existe, tente novamente' });
    }
    
    // Verificar se o public_id já existe
    const produtoExistentePublicId = await Produto.findOne({ where: { public_id: publicId } });
    if (produtoExistentePublicId) {
      return res.status(409).json({ erro: 'Erro interno, tente novamente' });
    }
    
    // Criar produto com status inicial
    const produtoData = {
      public_id: publicId,
      custom_id: customId,
      vendedor_id: req.user.id, // Associar ao vendedor logado
      nome,
      tipo,
      categoria: categoria || '',
      preco: preco !== undefined ? parseFloat(preco) : 0,
      desconto: 0,
      preco_com_desconto: 0,
      descricao: '',
      ativo: false, // Produto não está ativo até ser finalizado
      status_criacao: 'iniciado' // Status para controle do fluxo
    };
    
    const produto = await Produto.create(produtoData);
    
    console.log(`✅ Produto iniciado com custom_id: ${customId} pelo vendedor: ${req.user.id}`);
    
    res.status(201).json({
      mensagem: 'Produto iniciado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        tipo: produto.tipo,
        categoria: produto.categoria,
        status_criacao: produto.status_criacao
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar produto:', error);
    res.status(500).json({ erro: 'Erro ao iniciar produto' });
  }
});

// ETAPA 2: Upload de imagem (apenas se produto foi iniciado)
router.post('/:customId/imagem', authenticateToken, isVendedorOrAdmin, upload.single('imagem'), async (req, res) => {
  try {
    const { customId } = req.params;
    
    if (!customId) {
      return res.status(400).json({ erro: 'Custom ID é obrigatório' });
    }
    
    // Buscar produto pelo custom_id
    const produto = await Produto.findOne({ where: { custom_id: customId } });
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    // Verificar se o vendedor tem acesso ao produto (admins podem editar qualquer produto)
    if (req.user.tipo_conta !== 'admin' && req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }
    
    // Verificar se o produto foi iniciado
    if (produto.status_criacao !== 'iniciado' && produto.status_criacao !== 'imagem_adicionada') {
      return res.status(400).json({ erro: 'Produto deve estar no status correto para receber imagem' });
    }
    
    let imagemBase64 = null;
    
    // Processar imagem (arquivo ou base64)
    if (req.file) {
      const filePath = req.file.path;
      const fileContent = fs.readFileSync(filePath);
      imagemBase64 = `data:${req.file.mimetype};base64,${fileContent.toString('base64')}`;
      fs.unlinkSync(filePath); // Remover arquivo temporário
    } else if (req.body.imagemBase64) {
      imagemBase64 = req.body.imagemBase64;
    } else {
      return res.status(400).json({ erro: 'Nenhuma imagem fornecida' });
    }
    
    // Upload para armazenamento local usando sistema aprimorado
    const EnhancedImageService = require('../services/enhancedImageService');
    const resultado = await EnhancedImageService.uploadBase64Image(
      imagemBase64, 
      'produtos', 
      `${customId}_${Date.now()}`
    );
    
    // Atualizar produto
    produto.imagem_url = resultado.original.url;
    produto.imagem_public_id = resultado.original.filename.split('.')[0];
    produto.status_criacao = 'imagem_adicionada';
    await produto.save();
    
    console.log(`✅ Imagem adicionada ao produto ${customId}`);
    
    res.json({
      mensagem: 'Imagem do produto atualizada com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        imagem_url: produto.imagem_url,
        status_criacao: produto.status_criacao
      }
    });
  } catch (error) {
    console.error('Erro ao fazer upload de imagem:', error);
    res.status(500).json({ erro: 'Erro ao processar o upload da imagem' });
  }
});

// ETAPA 3: Adicionar conteúdo (apenas se imagem foi adicionada)
router.post('/:customId/conteudo', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { customId } = req.params;
    const { linkConteudo } = req.body;
    
    if (!customId) {
      return res.status(400).json({ erro: 'Custom ID é obrigatório' });
    }
    
    if (!linkConteudo) {
      return res.status(400).json({ erro: 'Link de conteúdo é obrigatório' });
    }
    
    // Buscar produto pelo custom_id
    const produto = await Produto.findOne({ where: { custom_id: customId } });
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    // Verificar se o vendedor tem acesso ao produto (admins podem editar qualquer produto)
    if (req.user.tipo_conta !== 'admin' && req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }
    
    // Verificar se o produto tem imagem
    if (produto.status_criacao !== 'imagem_adicionada') {
      return res.status(400).json({ erro: 'Produto deve ter imagem antes de adicionar conteúdo' });
    }
    
    // Atualizar conteúdo
    produto.link_conteudo = linkConteudo;
    produto.status_criacao = 'conteudo_adicionado';
    await produto.save();
    
    console.log(`✅ Conteúdo adicionado ao produto ${customId}`);
    
        // Enviar notificações automáticas para clientes que compraram este produto
        try {
            const vendaNotificationService = require('../services/vendaNotificationService');
            
            // Buscar todas as vendas aprovadas deste produto que ainda não receberam notificação de conteúdo
            const { Venda } = require('../config/database');
            const vendasAprovadas = await Venda.findAll({
                where: {
                    produto_id: produto.id,
                    status: 'Pago',
                    pagamento_status: 'Aprovado'
                }
            });
            
            console.log(`📦 Enviando notificações de conteúdo pronto para ${vendasAprovadas.length} clientes`);
            
            // Enviar notificação para cada cliente
            for (const venda of vendasAprovadas) {
                try {
                    await vendaNotificationService.enviarNotificacaoConteudoPronto(venda.id);
                    console.log(`✅ Notificação enviada para venda ${venda.id}`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar notificação para venda ${venda.id}:`, error);
                    // Continuar com as outras notificações mesmo se uma falhar
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificações de conteúdo pronto:', error);
            // Não falhar a operação principal por erro de notificação
        }
    
    res.json({
      mensagem: 'Conteúdo do produto atualizado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        link_conteudo: produto.link_conteudo,
        status_criacao: produto.status_criacao
      }
    });
  } catch (error) {
    console.error('Erro ao adicionar conteúdo:', error);
    res.status(500).json({ erro: 'Erro ao adicionar conteúdo ao produto' });
  }
});

// ETAPA 4: Finalizar produto (apenas se conteúdo foi adicionado)
router.post('/:customId/finalizar', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const { customId } = req.params;
    const { preco, desconto, descricao } = req.body;
    
    if (!customId) {
      return res.status(400).json({ erro: 'Custom ID é obrigatório' });
    }
    
    // Buscar produto pelo custom_id
    const produto = await Produto.findOne({ where: { custom_id: customId } });
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    // Verificar se o vendedor tem acesso ao produto (admins podem editar qualquer produto)
    if (req.user.tipo_conta !== 'admin' && req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }
    
    // Verificar se o produto tem conteúdo
    if (produto.status_criacao !== 'conteudo_adicionado') {
      return res.status(400).json({ erro: 'Produto deve ter conteúdo antes de ser finalizado' });
    }
    
    // Verificar se tem imagem
    if (!produto.imagem_url) {
      return res.status(400).json({ erro: 'Produto deve ter imagem antes de ser finalizado' });
    }
    
    // Verificar se tem conteúdo
    if (!produto.link_conteudo) {
      return res.status(400).json({ erro: 'Produto deve ter conteúdo antes de ser finalizado' });
    }
    
    // Calcular preço com desconto
    const precoNum = parseFloat(preco || produto.preco);
    const descontoNum = parseFloat(desconto || 0);
    const precoComDesconto = descontoNum > 0 ? precoNum - (precoNum * descontoNum / 100) : precoNum;
    
    // Finalizar produto
    produto.preco = precoNum;
    produto.desconto = descontoNum;
    produto.preco_com_desconto = precoComDesconto;
    produto.descricao = descricao || produto.descricao;
    produto.ativo = true;
    produto.status_criacao = 'finalizado';
    await produto.save();
    
    console.log(`✅ Produto ${customId} finalizado com sucesso`);
    
    res.json({
      mensagem: 'Produto finalizado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        preco: produto.preco,
        preco_com_desconto: produto.preco_com_desconto,
        ativo: produto.ativo,
        status_criacao: produto.status_criacao
      }
    });
  } catch (error) {
    console.error('Erro ao finalizar produto:', error);
    res.status(500).json({ erro: 'Erro ao finalizar produto' });
  }
});

// ======================== ROTAS DE ATUALIZAÇÃO ========================

// Rota para atualizar um produto existente
router.put('/:id', authenticateToken, isVendedorOrAdmin, upload.single('imagem'), async (req, res) => {
  try {
    const id = req.params.id;
    const { 
      nome, tipo, preco, desconto, descricao, linkConteudo, ativo,
      categoria, tags, imagem_url, visibilidade, meta_title, meta_description,
      estoque, estoque_minimo, custo, margem, tempo_entrega, custo_entrega,
      comissao, conteudo, arquivo_url, configuracoes,
      // Configuração Order Bump (opcionais na atualização)
      order_bump_ativo, order_bump_produtos
    } = req.body;
    let imagemBase64 = null;
    
    // Buscar produto
    let produto;
    
    // Verificar se é UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(id)) {
      produto = await Produto.findByPk(id);
    } else if (/^\d+$/.test(id)) {
      produto = await Produto.findByPk(parseInt(id));
    } else {
      produto = await Produto.findOne({ where: { custom_id: id } });
    }
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    // Verificar se o vendedor tem acesso ao produto (admins podem editar qualquer produto)
    if (req.user.tipo_conta !== 'admin' && req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }
    
    // Processar imagem se fornecida
    if (req.file) {
      const filePath = req.file.path;
      const fileContent = fs.readFileSync(filePath);
      imagemBase64 = `data:${req.file.mimetype};base64,${fileContent.toString('base64')}`;
      fs.unlinkSync(filePath);
    } else if (req.body.imagemBase64) {
      imagemBase64 = req.body.imagemBase64;
    }
    
    // Atualizar dados do produto (apenas campos que existem no modelo)
    if (nome !== undefined) produto.nome = nome;
    if (tipo !== undefined) produto.tipo = tipo;
    if (preco !== undefined) produto.preco = parseFloat(preco);
    if (desconto !== undefined) produto.desconto = parseFloat(desconto);
    if (descricao !== undefined) produto.descricao = descricao;
    if (linkConteudo !== undefined) produto.link_conteudo = linkConteudo;
    if (ativo !== undefined) produto.ativo = ativo === 'true' || ativo === true;
    if (categoria !== undefined) produto.categoria = categoria;
    if (imagem_url !== undefined) produto.imagem_url = imagem_url;
    // Atualizar configuração Order Bump
    if (order_bump_ativo !== undefined) {
      produto.order_bump_ativo = order_bump_ativo === true || order_bump_ativo === 'true';
    }
    if (order_bump_produtos !== undefined) {
      try {
        const parsed = typeof order_bump_produtos === 'string' ? JSON.parse(order_bump_produtos) : order_bump_produtos;
        produto.order_bump_produtos = Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        // Se payload vier inválido, ignorar sem quebrar
        console.warn('Payload inválido para order_bump_produtos');
      }
    }
    
    // Calcular preço com desconto se necessário
    if (preco !== undefined || desconto !== undefined) {
      const precoAtual = produto.preco || 0;
      const descontoAtual = produto.desconto || 0;
      produto.preco_com_desconto = precoAtual - (precoAtual * descontoAtual / 100);
    }
    
    // Upload de nova imagem se fornecida
    if (imagemBase64) {
      try {
        // Usar o novo sistema de upload aprimorado
        const EnhancedImageService = require('../services/enhancedImageService');
        
        let resultado;
        
        if (produto.imagem_public_id) {
          // Atualizar imagem existente
          resultado = await EnhancedImageService.uploadBase64Image(
            imagemBase64, 
            'produtos', 
            `${produto.custom_id}_${Date.now()}`
          );
        } else {
          // Upload de nova imagem
          resultado = await EnhancedImageService.uploadBase64Image(
            imagemBase64, 
            'produtos', 
            `${produto.custom_id}_${Date.now()}`
          );
        }
        
        produto.imagem_url = resultado.original.url;
        produto.imagem_public_id = resultado.original.filename.split('.')[0];
        
        console.log('✅ Imagem atualizada com sistema aprimorado:', produto.imagem_url);
      } catch (imageError) {
        console.error('Erro ao fazer upload da imagem:', imageError);
        return res.status(500).json({ erro: 'Erro ao processar imagem' });
      }
    }
    
    await produto.save();
    
    res.json({
      mensagem: 'Produto atualizado com sucesso',
      produto: {
        id: produto.id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        preco: produto.preco,
        ativo: produto.ativo,
        order_bump_ativo: produto.order_bump_ativo,
        order_bump_produtos: produto.order_bump_produtos
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
});

// ======================== ROTAS DE EXCLUSÃO ========================

// Rota para deletar um produto
router.delete('/:id', authenticateToken, isVendedorOrAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    
    let produto;
    if (/^\d+$/.test(id)) {
      produto = await Produto.findByPk(parseInt(id));
    } else {
      produto = await Produto.findOne({ where: { custom_id: id } });
    }
    
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    
    // Verificar se o vendedor tem acesso ao produto (admins podem editar qualquer produto)
    if (req.user.tipo_conta !== 'admin' && req.user.role !== 'admin' && produto.vendedor_id !== req.user.id) {
      return res.status(403).json({ erro: 'Acesso negado. Este produto não pertence ao seu catálogo.' });
    }
    
    // Se o produto tem imagem local, excluir
    if (produto.imagem_public_id) {
      try {
        await LocalImageService.excluirImagem(produto.imagem_public_id, 'produtos');
        console.log(`✅ Imagem do produto ${produto.custom_id} excluída localmente`);
      } catch (imageError) {
        console.error('Erro ao excluir imagem local:', imageError);
        // Continuar mesmo se falhar ao excluir a imagem
      }
    }
    
    await produto.destroy();
    
    res.json({
      mensagem: 'Produto deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
});

// ======================== ROTA PARA ADICIONAR ARQUIVO DE CONTEÚDO ========================

// POST /produtos/:customId/conteudo - Adicionar arquivo de conteúdo ao produto
router.post('/:customId/conteudo', authenticateToken, async (req, res) => {
  const { customId } = req.params;
  const { contentUrl } = req.body;

  try {
    console.log(`📁 Adicionando arquivo de conteúdo ao produto ${customId}...`);

    // Buscar produto
    const produto = await Produto.findOne({
      where: { custom_id: customId, vendedor_id: req.user.id }
    });

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    if (!contentUrl) {
      return res.status(400).json({ erro: 'URL do conteúdo é obrigatória' });
    }

    // Atualizar produto com link de conteúdo em múltiplos campos
    produto.link_conteudo = contentUrl;
    produto.conteudo_link = contentUrl;
    produto.conteudo_arquivo = contentUrl;
    produto.status_criacao = 'conteudo_adicionado';
    await produto.save();

    console.log('✅ Arquivo de conteúdo adicionado ao produto:', contentUrl);

    res.json({
      success: true,
      message: 'Arquivo de conteúdo adicionado com sucesso',
      produto: {
        custom_id: produto.custom_id,
        nome: produto.nome,
        link_conteudo: produto.link_conteudo
      }
    });

  } catch (error) {
    console.error('❌ Erro ao adicionar arquivo de conteúdo:', error);
    res.status(500).json({ erro: 'Erro ao adicionar arquivo de conteúdo' });
  }
});

// POST /produtos/:customId/salvar-conteudo - Salvar URL de arquivo automaticamente
router.post('/:customId/salvar-conteudo', authenticateToken, async (req, res) => {
  const { customId } = req.params;
  const { contentUrl } = req.body;

  try {
    console.log(`💾 Salvando URL de conteúdo automaticamente para produto ${customId}...`);

    // Buscar produto
    const produto = await Produto.findOne({
      where: { custom_id: customId, vendedor_id: req.user.id }
    });

    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }

    if (!contentUrl) {
      return res.status(400).json({ erro: 'URL do conteúdo é obrigatória' });
    }

    // Atualizar produto com URL do arquivo em múltiplos campos
    produto.link_conteudo = contentUrl;
    produto.conteudo_link = contentUrl;
    produto.conteudo_arquivo = contentUrl;
    await produto.save();

    console.log('✅ URL de conteúdo salva automaticamente:', contentUrl);

    res.json({
      success: true,
      message: 'URL de conteúdo salva automaticamente',
      produto: {
        custom_id: produto.custom_id,
        nome: produto.nome,
        link_conteudo: produto.link_conteudo
      }
    });

  } catch (error) {
    console.error('❌ Erro ao salvar URL de conteúdo:', error);
    res.status(500).json({ erro: 'Erro ao salvar URL de conteúdo' });
  }
});

// ======================== UTMFY MANAGEMENT ========================

// PUT - Atualizar configurações UTMfy de um produto
router.put('/:id/utmfy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey, tokenType, events, active } = req.body;
    const userId = req.user.id;

    console.log(`🎯 Atualizando configurações UTMfy para produto ${id}:`, { apiKey, tokenType, events, active });

    // Valores pré-definidos: sempre utmify, sempre ativo quando há API Key, todos os eventos
    const normalizedTokenType = 'utmify'; // Sempre utmify
    const defaultEvents = ['page_view', 'purchase_completed', 'cart_abandoned', 'checkout_started']; // Todos os eventos
    
    // Se API Key fornecida, ativar automaticamente e usar todos os eventos
    const shouldBeActive = !!apiKey;
    const finalEvents = shouldBeActive ? defaultEvents : (events || null);
    const finalActive = shouldBeActive ? true : (active !== undefined ? active : false);

    // Validar eventos se fornecidos (mas não usaremos se apiKey existir)
    if (events && !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'Events deve ser um array'
      });
    }

    // Buscar produto
    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar este produto'
      });
    }

    // Atualizar configurações UTMfy com valores pré-definidos
    produto.utmfy_api_key = apiKey || null;
    produto.utmfy_token_type = normalizedTokenType; // Sempre 'utmify'
    produto.utmfy_events = finalEvents; // Todos os eventos quando ativo
    produto.utmfy_active = finalActive; // Sempre true quando há API Key
    
    await produto.save();

    console.log(`✅ Configurações UTMfy atualizadas para produto ${produto.nome}`);

    res.json({
      success: true,
      message: 'Configurações UTMfy atualizadas com sucesso',
      produto: {
        id: produto.id,
        nome: produto.nome,
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configurações UTMfy:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Buscar configurações UTMfy de um produto
router.get('/:id/utmfy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Buscando configurações UTMfy do produto ${id}...`);

    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar este produto'
      });
    }

    console.log(`✅ Configurações UTMfy encontradas para produto: ${produto.nome}`);

    res.json({
      success: true,
      utmfy_config: {
        id: produto.id,
        nome: produto.nome,
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configurações UTMfy:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Buscar produto público com configurações UTMfy (para checkout)
router.get('/public/:id/utmfy', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Buscando configurações UTMfy públicas do produto ${id}...`);

    const produto = await Produto.findOne({
      where: { 
        [Op.or]: [
          { id },
          { public_id: id },
          { custom_id: id }
        ]
      },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    console.log(`✅ Configurações UTMfy públicas encontradas para produto: ${produto.nome}`);

    res.json({
      success: true,
      produto: {
        id: produto.id,
        public_id: produto.public_id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configurações UTMfy públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ======================== UTMFY PROXY (PARA EVITAR CORS) ========================

// POST - Proxy para enviar eventos ao Utmify (evita problemas de CORS)
router.post('/utmfy/proxy/track', async (req, res) => {
  try {
    const { api_key, event, ...eventData } = req.body;

    if (!api_key || !event) {
      return res.status(400).json({
        success: false,
        message: 'api_key e event são obrigatórios'
      });
    }

    // Validar api_key
    if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
      console.error('❌ api_key inválido ou vazio');
      return res.status(400).json({
        success: false,
        message: 'api_key é obrigatório e deve ser uma string não vazia'
      });
    }

    console.log(`🔄 Proxying evento Utmify: ${event}`, {
      api_key_length: api_key.length,
      api_key_preview: api_key.substring(0, 20) + '...',
      event: event,
      hasEventData: Object.keys(eventData).length > 0
    });

    // Montar payload para Utmify
    // IMPORTANTE: A autenticação é feita via header Authorization, NÃO via api_key no body
    // Remover api_key de eventData se existir para evitar duplicação
    const { api_key: eventDataApiKey, ...cleanEventData } = eventData;
    
    const payload = {
      // NÃO incluir api_key no body - autenticação é feita via header Authorization
      event: event,
      timestamp: eventData.timestamp || new Date().toISOString(),
      ...cleanEventData // eventData sem api_key
    };

    // URL correta da API UTMfy
    const apiUrl = 'https://api.utmify.com.br/v1/track';

    try {
      console.log(`📤 Enviando para ${apiUrl}...`, {
        has_api_key: !!payload.api_key,
        api_key_length: payload.api_key ? payload.api_key.length : 0,
        api_key_preview: payload.api_key ? payload.api_key.substring(0, 20) + '...' : 'não fornecido',
        event: payload.event,
        payload_keys: Object.keys(payload)
      });
      
      // Timeout de 5 segundos para evitar travamentos
      let timeoutId;
      let timeoutRejected = false;
      const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
              timeoutRejected = true;
              reject(new Error('ETIMEDOUT'));
          }, 5000);
      });
      
      // Enviar para UTMfy com autenticação correta no header
      // A API UTMfy requer Authorization: Bearer <token>
      // IMPORTANTE: O token deve sempre ter o prefixo "Bearer " no header
      const trimmedApiKey = api_key.trim();
      
      // Garantir que o header Authorization sempre tenha o formato "Bearer <token>"
      // Se o token já começar com "Bearer ", usar diretamente, senão adicionar
      const authToken = trimmedApiKey.startsWith('Bearer ') 
        ? trimmedApiKey 
        : trimmedApiKey.startsWith('Bearer') 
          ? `Bearer ${trimmedApiKey.substring(6).trim()}` // Remover "Bearer" sem espaço e adicionar com espaço
          : `Bearer ${trimmedApiKey}`;
      
      console.log(`🔑 Formato do token de autenticação:`, {
        original_length: api_key.length,
        trimmed_length: trimmedApiKey.length,
        has_bearer_prefix: trimmedApiKey.startsWith('Bearer '),
        auth_token_format: authToken.substring(0, 20) + '...'
      });
      
      const fetchPromise = fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
          'User-Agent': 'RatixPay-Server/1.0'
        },
        body: JSON.stringify(payload)
      });

      let response;
      try {
          response = await Promise.race([fetchPromise, timeoutPromise]);
          clearTimeout(timeoutId);
      } catch (raceError) {
          clearTimeout(timeoutId);
          if (timeoutRejected || raceError.message === 'ETIMEDOUT') {
              throw new Error('ETIMEDOUT');
          }
          throw raceError;
      }

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Evento Utmify ${event} enviado com sucesso via proxy`);
          return res.json({
            success: true,
            message: 'Evento enviado com sucesso',
            result: result
          });
        } else {
          const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        // Erros 401/403 são de autenticação - não críticos
        if (response.status === 401 || response.status === 403) {
          console.log(`ℹ️ UTMfy: Erro de autenticação (não crítico) - evento ${event} não foi enviado:`, {
            status: response.status,
            error: errorData,
            api_key_length: api_key.length,
            api_key_starts_with: api_key.substring(0, 10),
            payload_has_api_key: !!payload.api_key,
            payload_api_key_length: payload.api_key ? payload.api_key.length : 0
          });
          return res.json({
            success: true,
            message: 'Evento processado (UTMfy: erro de autenticação)',
            warning: 'UTMfy authentication error',
            debug: process.env.NODE_ENV === 'development' ? {
              api_key_length: api_key.length,
              error_message: errorData.message
            } : undefined
          });
        }
          console.warn(`⚠️ Resposta não OK de ${apiUrl}:`, response.status, errorText);
        // Retornar sucesso silencioso para não afetar UX
        return res.json({
          success: true,
          message: 'Evento processado (UTMfy retornou erro não crítico)',
          warning: 'UTMfy returned non-OK status'
        });
        }
      } catch (fetchError) {
      // Verificar se é erro de conexão (não crítico)
      const isConnectionError = fetchError.name === 'AbortError' || 
                               fetchError.message === 'ETIMEDOUT' ||
                               fetchError.message.includes('ENOTFOUND') ||
                               fetchError.message.includes('ECONNREFUSED') ||
                               fetchError.message.includes('ETIMEDOUT') ||
                               fetchError.code === 'ENOTFOUND' ||
                               fetchError.code === 'ECONNREFUSED' ||
                               fetchError.code === 'ETIMEDOUT';
      
      if (isConnectionError) {
        console.log(`ℹ️ UTMfy temporariamente indisponível (não crítico) - evento ${event} não foi enviado:`, fetchError.message);
        // Retornar sucesso silencioso para não afetar a experiência do usuário
        return res.json({
          success: true,
          message: 'Evento processado (UTMfy temporariamente indisponível)',
          warning: 'UTMfy service temporarily unavailable'
        });
      }
      
      // Outros erros - retornar 502 mas com mensagem mais amigável
      console.error(`❌ Erro ao enviar evento Utmify:`, fetchError.message);
    return res.status(502).json({
      success: false,
      message: 'Não foi possível conectar com a API do Utmify',
        error: fetchError.message
    });
    }

  } catch (error) {
    console.error('❌ Erro no proxy Utmify:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// ======================== META PIXEL MANAGEMENT ========================

// PUT - Atualizar Pixel ID e eventos de um produto
router.put('/:id/pixel', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pixelId, pixelEvents } = req.body;
    const userId = req.user.id;

    console.log(`🎯 Atualizando configuração do Pixel para produto ${id}:`, { pixelId, pixelEvents });

    // Validar Pixel ID (deve ter 15-16 dígitos)
    if (pixelId && !/^\d{15,16}$/.test(pixelId)) {
      return res.status(400).json({
        success: false,
        message: 'Pixel ID deve ter 15-16 dígitos numéricos'
      });
    }

    // Valores pré-definidos: todos os eventos ativos quando há Pixel ID
    const eventosValidos = ['Purchase', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead'];
    const defaultEvents = eventosValidos; // Todos os eventos por padrão
    
    // Se Pixel ID fornecida, ativar todos os eventos automaticamente
    const finalEvents = pixelId ? defaultEvents : (pixelEvents || null);
    
    // Validar eventos do pixel se fornecidos (mas não usaremos se pixelId existir)
    if (pixelEvents && Array.isArray(pixelEvents)) {
      const eventosInvalidos = pixelEvents.filter(evento => !eventosValidos.includes(evento));
      if (eventosInvalidos.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Eventos inválidos: ${eventosInvalidos.join(', ')}. Eventos válidos: ${eventosValidos.join(', ')}`
        });
      }
    }

    // Buscar produto
    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar este produto'
      });
    }

    // Atualizar Pixel ID e eventos com valores pré-definidos
    produto.pixel_id = pixelId || null;
    produto.pixel_events = finalEvents; // Todos os eventos quando há Pixel ID
    await produto.save();

    console.log(`✅ Configuração do Pixel atualizada para produto ${produto.nome}:`, { 
      pixelId, 
      eventos: finalEvents 
    });

    const mensagem = pixelId 
      ? `Meta Pixel configurado: ID ${pixelId}, todos os eventos ativados`
      : 'Configuração do Meta Pixel removida';

    res.json({
      success: true,
      message: mensagem,
      produto: {
        id: produto.id,
        nome: produto.nome,
        pixel_id: produto.pixel_id,
        pixel_events: produto.pixel_events
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configuração do Pixel:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Buscar produto por ID com Pixel ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Buscando produto ${id}...`);

    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para acessar este produto'
      });
    }

    console.log(`✅ Produto encontrado: ${produto.nome}`);

    res.json({
      success: true,
      produto: {
        id: produto.id,
        public_id: produto.public_id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        descricao: produto.descricao,
        categoria: produto.categoria,
        tipo: produto.tipo,
        preco: produto.preco,
        preco_com_desconto: produto.preco_com_desconto,
        desconto: produto.desconto,
        valor_final: produto.preco_com_desconto || produto.preco,
        ativo: produto.ativo,
        imagem_url: produto.imagem_url,
        link_conteudo: produto.link_conteudo,
        pixel_id: produto.pixel_id,
        pixel_events: produto.pixel_events,
        vendedor_id: produto.vendedor_id,
        vendedor_nome: produto.vendedorProduto?.nome_completo,
        vendedor_email: produto.vendedorProduto?.email,
        created_at: produto.created_at,
        updated_at: produto.updated_at
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar produto:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET - Buscar produto por ID público (para checkout)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Buscando produto público ${id}...`);

    const produto = await Produto.findOne({
      where: { 
        [Op.or]: [
          { id },
          { public_id: id },
          { custom_id: id }
        ]
      },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    console.log(`✅ Produto público encontrado: ${produto.nome}`);

    res.json({
      success: true,
      produto: {
        id: produto.id,
        public_id: produto.public_id,
        custom_id: produto.custom_id,
        nome: produto.nome,
        descricao: produto.descricao,
        categoria: produto.categoria,
        tipo: produto.tipo,
        preco: produto.preco,
        preco_com_desconto: produto.preco_com_desconto,
        desconto: produto.desconto,
        valor_final: produto.preco_com_desconto || produto.preco,
        ativo: produto.ativo,
        imagem_url: produto.imagem_url,
        link_conteudo: produto.link_conteudo,
        pixel_id: produto.pixel_id,
        pixel_events: produto.pixel_events,
        vendedor_id: produto.vendedor_id,
        vendedor_nome: produto.vendedorProduto?.nome_completo,
        vendedor_email: produto.vendedorProduto?.email,
        // Configurações de UTMify
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar produto público:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// ======================== FUNÇÕES AUXILIARES ========================

// Função para gerar ID personalizado do produto
function generateProductId(tipo) {
  const tipoPrefix = tipo === 'Curso Online' ? 'C' : 'B';
  const posicao = Math.floor(Math.random() * 90) + 10;
  const doisNumeros = Math.floor(Math.random() * 90) + 10;
  const umNumero = Math.floor(Math.random() * 10);
  return `${tipoPrefix}${posicao}${doisNumeros}${umNumero}`;
}

// ========================================
// ENDPOINTS UTMFY
// ========================================

// PUT /:id/utmfy - Atualizar configurações UTMfy de um produto
router.put('/:id/utmfy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey, tokenType, events, active } = req.body;
    const userId = req.user.id;

    console.log(`🎯 Atualizando configurações UTMfy para produto ${id}:`, { apiKey, tokenType, events, active });

    // Valores pré-definidos: sempre utmify, sempre ativo quando há API Key, todos os eventos
    const normalizedTokenType = 'utmify'; // Sempre utmify
    const defaultEvents = ['page_view', 'purchase_completed', 'cart_abandoned', 'checkout_started']; // Todos os eventos
    
    // Se API Key fornecida, ativar automaticamente e usar todos os eventos
    const shouldBeActive = !!apiKey;
    const finalEvents = shouldBeActive ? defaultEvents : (events || null);
    const finalActive = shouldBeActive ? true : (active !== undefined ? active : false);

    // Validar eventos se fornecidos (mas não usaremos se apiKey existir)
    if (events && !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        message: 'Eventos devem ser um array'
      });
    }

    // Buscar produto
    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para editar este produto'
      });
    }

    // Atualizar configurações UTMfy com valores pré-definidos
    produto.utmfy_api_key = apiKey || null;
    produto.utmfy_token_type = normalizedTokenType; // Sempre 'utmify'
    produto.utmfy_events = finalEvents; // Todos os eventos quando ativo
    produto.utmfy_active = finalActive; // Sempre true quando há API Key
    
    await produto.save();

    console.log(`✅ Configurações UTMfy atualizadas para produto ${produto.nome}`);

    res.json({
      success: true,
      message: 'Configurações UTMfy atualizadas com sucesso',
      produto: {
        id: produto.id,
        nome: produto.nome,
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configurações UTMfy:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// GET /:id/utmfy - Obter configurações UTMfy de um produto
router.get('/:id/utmfy', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Buscando configurações UTMfy para produto ${id}`);

    // Buscar produto
    const produto = await Produto.findOne({
      where: { id },
      include: [{
        model: Usuario,
        as: 'vendedorProduto',
        attributes: ['id', 'nome_completo', 'email']
      }]
    });

    if (!produto) {
      return res.status(404).json({
        success: false,
        message: 'Produto não encontrado'
      });
    }

    // Verificar se o usuário é o vendedor do produto ou admin
    if (produto.vendedor_id !== userId && req.user.tipo_usuario !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Você não tem permissão para visualizar este produto'
      });
    }

    res.json({
      success: true,
      produto: {
        id: produto.id,
        nome: produto.nome,
        utmfy_api_key: produto.utmfy_api_key,
        utmfy_token_type: produto.utmfy_token_type,
        utmfy_events: produto.utmfy_events,
        utmfy_active: produto.utmfy_active
      }
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configurações UTMfy:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Função para gerar public_id único (6 dígitos)
function generatePublicId() {
  return String(Math.floor(Math.random() * 900000) + 100000);
}

module.exports = router;