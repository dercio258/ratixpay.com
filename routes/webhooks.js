const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const axios = require('axios');
const router = express.Router();

// Extrair modelos do database
const { Usuario, Produto, Venda, sequelize, Webhook } = db;

// Função helper para obter o modelo Webhook com verificação
function getWebhookModel() {
    // Tentar múltiplas formas de obter o modelo
    if (Webhook) {
        return Webhook;
    }
    
    if (db.Webhook) {
        return db.Webhook;
    }
    
    // Log detalhado para debug
    console.error('❌ ERRO: Modelo Webhook não está disponível');
    console.error('❌ Tipo de db:', typeof db);
    console.error('❌ Webhook (desestruturado):', typeof Webhook, Webhook);
    console.error('❌ db.Webhook:', typeof db.Webhook, db.Webhook);
    console.error('❌ Modelos disponíveis:', Object.keys(db).filter(key => key !== 'databaseManager' && key !== 'sequelize'));
    
    // Tentar acessar diretamente do require
    try {
        const dbCheck = require('../config/database');
        if (dbCheck.Webhook) {
            console.log('✅ Webhook encontrado via require direto');
            return dbCheck.Webhook;
        }
    } catch (err) {
        console.error('❌ Erro ao tentar require direto:', err.message);
    }
    
    throw new Error('Modelo Webhook não está disponível. Verifique se a tabela webhooks existe no banco de dados.');
}

// Verificar se Webhook está disponível no carregamento
if (!Webhook && !db.Webhook) {
    console.error('❌ ERRO CRÍTICO: Modelo Webhook não foi carregado corretamente do config/database.js');
    console.error('❌ Modelos disponíveis:', Object.keys(db).filter(key => key !== 'databaseManager' && key !== 'sequelize'));
    console.error('❌ Tentando recarregar o módulo...');
    
    // Tentar recarregar o módulo (útil em desenvolvimento)
    try {
        delete require.cache[require.resolve('../config/database')];
        const dbReloaded = require('../config/database');
        if (dbReloaded.Webhook) {
            console.log('✅ Webhook encontrado após recarregar módulo');
            // Atualizar referência
            Object.assign(db, { Webhook: dbReloaded.Webhook });
        }
    } catch (err) {
        console.error('❌ Erro ao recarregar módulo:', err.message);
    }
} else {
    console.log('✅ Modelo Webhook carregado com sucesso');
    console.log('✅ Webhook disponível via:', Webhook ? 'desestruturação' : 'db.Webhook');
}

/**
 * POST - Criar webhook
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { url, eventos, secret, produto_id } = req.body;
        const userId = req.user.id;

        if (!url || !eventos || eventos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'URL e eventos são obrigatórios'
            });
        }

        // Validar URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({
                success: false,
                error: 'URL inválida'
            });
        }

        // Se produto_id fornecido, validar que o produto existe e pertence ao usuário
        if (produto_id) {
            const produto = await Produto.findByPk(produto_id);
            if (!produto) {
                return res.status(404).json({
                    success: false,
                    error: 'Produto não encontrado'
                });
            }
            
            // Verificar se o produto pertence ao usuário (ou se é admin)
            if (produto.vendedor_id !== userId && req.user.tipo !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Você não tem permissão para configurar webhooks para este produto'
                });
            }
        }

        const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        
        // Criar webhook no banco de dados
        const webhook = await WebhookModel.create({
            id: webhookId,
            user_id: userId,
            produto_id: produto_id || null,
            url,
            eventos,
            secret: secret || null,
            ativo: true
        });

        console.log(`✅ Webhook criado: ${webhookId} para ${url}${produto_id ? ` (produto: ${produto_id})` : ' (global)'}`);

        res.json({
            success: true,
            message: 'Webhook configurado com sucesso',
            webhook: {
                id: webhook.id,
                user_id: webhook.user_id,
                produto_id: webhook.produto_id,
                url: webhook.url,
                eventos: webhook.eventos,
                secret: webhook.secret,
                ativo: webhook.ativo,
                created_at: webhook.created_at,
                updated_at: webhook.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Erro ao criar webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

/**
 * GET - Listar webhooks do usuário
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        const userId = req.user.id;
        
        // Buscar webhooks do usuário no banco de dados
        // Usar literal SQL para garantir compatibilidade com snake_case do banco
        const userWebhooks = await WebhookModel.findAll({
            where: { user_id: userId },
            order: [[sequelize.literal('created_at'), 'DESC']]
        });

        res.json({
            success: true,
            webhooks: userWebhooks.map(webhook => {
                // Garantir compatibilidade com ambos os formatos (camelCase e snake_case)
                const webhookData = webhook.toJSON ? webhook.toJSON() : webhook;
                return {
                    id: webhookData.id,
                    user_id: webhookData.user_id,
                    produto_id: webhookData.produto_id,
                    url: webhookData.url,
                    eventos: webhookData.eventos,
                    secret: webhookData.secret,
                    ativo: webhookData.ativo,
                    created_at: webhookData.created_at || webhookData.createdAt,
                    updated_at: webhookData.updated_at || webhookData.updatedAt
                };
            })
        });

    } catch (error) {
        console.error('❌ Erro ao listar webhooks:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ User ID:', req.user?.id);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);
        
        // Verificar se é erro de tabela não encontrada
        if (error.name === 'SequelizeDatabaseError' || error.message.includes('does not exist')) {
            return res.status(500).json({
                success: false,
                error: 'Tabela webhooks não encontrada. Execute a migração do banco de dados.',
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Erro ao carregar webhooks'
        });
    }
});

/**
 * PUT - Toggle status do webhook
 */
router.put('/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        
        // Buscar webhook no banco de dados
        const webhook = await WebhookModel.findByPk(id);
        
        if (!webhook) {
            return res.status(404).json({
                success: false,
                error: 'Webhook não encontrado'
            });
        }

        if (webhook.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        // Alternar status
        webhook.ativo = !webhook.ativo;
        await webhook.save();

        res.json({
            success: true,
            message: `Webhook ${webhook.ativo ? 'ativado' : 'desativado'} com sucesso`,
            webhook: {
                id: webhook.id,
                user_id: webhook.user_id,
                produto_id: webhook.produto_id,
                url: webhook.url,
                eventos: webhook.eventos,
                secret: webhook.secret,
                ativo: webhook.ativo,
                created_at: webhook.created_at,
                updated_at: webhook.updated_at
            }
        });

    } catch (error) {
        console.error('❌ Erro ao alterar webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE - Excluir webhook
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        
        // Buscar webhook no banco de dados
        const webhook = await WebhookModel.findByPk(id);
        
        if (!webhook) {
            return res.status(404).json({
                success: false,
                error: 'Webhook não encontrado'
            });
        }

        if (webhook.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        // Excluir webhook
        await webhook.destroy();

        res.json({
            success: true,
            message: 'Webhook excluído com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao excluir webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

/**
 * POST - Testar webhook (enviar payload de teste)
 */
router.post('/:id/testar', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        
        // Buscar webhook no banco de dados
        const webhook = await WebhookModel.findByPk(id);
        
        if (!webhook) {
            return res.status(404).json({
                success: false,
                error: 'Webhook não encontrado'
            });
        }

        if (webhook.user_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Acesso negado'
            });
        }

        // Criar payload de teste baseado no primeiro evento configurado
        const eventos = Array.isArray(webhook.eventos) ? webhook.eventos : 
                       (typeof webhook.eventos === 'string' ? JSON.parse(webhook.eventos) : []);
        
        const eventoTeste = eventos.length > 0 ? eventos[0] : 'venda_aprovada';
        
        // Criar dados de teste
        const dadosTeste = {
            tipo: 'teste',
            mensagem: 'Este é um webhook de teste enviado pela interface do RatixPay',
            timestamp: new Date().toISOString(),
            webhook_id: webhook.id,
            evento: eventoTeste,
            dados_exemplo: {
                venda: {
                    id: 'test_' + Date.now(),
                    valor: 100.00,
                    status: 'Aprovado',
                    data: new Date().toISOString()
                },
                cliente: {
                    nome: 'Cliente Teste',
                    email: 'teste@exemplo.com',
                    telefone: '841234567'
                },
                produto: {
                    id: 'produto_teste',
                    nome: 'Produto de Teste',
                    preco: 100.00
                }
            }
        };

        const payload = {
            evento: eventoTeste,
            timestamp: new Date().toISOString(),
            dados: dadosTeste
        };

        // Enviar webhook de teste
        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'RatixPay-Webhook/1.0',
                'X-Webhook-Event': eventoTeste,
                'X-Webhook-Id': webhook.id,
                'X-Webhook-Test': 'true'
            };
            
            if (webhook.secret) {
                headers['X-Webhook-Secret'] = webhook.secret;
            }

            const startTime = Date.now();
            const response = await axios.post(webhook.url, payload, {
                headers: headers,
                timeout: 10000
            });
            const endTime = Date.now();
            const duration = endTime - startTime;

            res.json({
                success: true,
                message: 'Webhook testado com sucesso',
                resultado: {
                    status: response.status,
                    tempoResposta: duration,
                    url: webhook.url,
                    evento: eventoTeste
                }
            });

        } catch (error) {
            let erroMensagem = 'Erro ao enviar webhook de teste';
            if (error.response) {
                erroMensagem = `Erro HTTP ${error.response.status}: ${error.response.statusText}`;
            } else if (error.request) {
                erroMensagem = 'Sem resposta do servidor de destino';
            } else {
                erroMensagem = error.message;
            }

            res.status(400).json({
                success: false,
                error: erroMensagem,
                resultado: {
                    erro: erroMensagem,
                    url: webhook.url,
                    evento: eventoTeste
                }
            });
        }

    } catch (error) {
        console.error('❌ Erro ao testar webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

/**
 * GET - Produtos do vendedor para webhooks
 */
router.get('/produtos/vendedor', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar produtos do vendedor
        const produtos = await Produto.findAll({
            where: { vendedor_id: userId },
            attributes: [
                'id', 'nome', 'preco', 'descricao', 'imagem_url', 
                'categoria', 'status', 'vendas', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        console.log(`📦 ${produtos.length} produtos encontrados para webhooks`);

        res.json({
            success: true,
            produtos: produtos.map(produto => ({
                id: produto.id,
                nome: produto.nome,
                preco: produto.preco,
                descricao: produto.descricao,
                imagem_url: produto.imagem_url,
                categoria: produto.categoria,
                status: produto.status,
                vendas: produto.vendas,
                created_at: produto.created_at
            }))
        });

    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

/**
 * Função para sanitizar dados do webhook - Remove IDs e dados sensíveis
 * @param {object} dados - Dados brutos do evento
 * @returns {object} Dados sanitizados
 */
function sanitizarDadosWebhook(dados) {
    if (!dados || typeof dados !== 'object') {
        return {};
    }
    
    // Criar cópia dos dados para não modificar o original
    const dadosSanitizados = { ...dados };
    
    // Remover IDs
    delete dadosSanitizados.venda_id;
    delete dadosSanitizados.produto_id;
    delete dadosSanitizados.vendedor_id;
    delete dadosSanitizados.cliente_id;
    delete dadosSanitizados.afiliado_id;
    delete dadosSanitizados.id;
    delete dadosSanitizados.transaction_id;
    
    // Remover dados sensíveis
    delete dadosSanitizados.cliente_email;
    delete dadosSanitizados.cliente_telefone;
    delete dadosSanitizados.cliente_whatsapp;
    delete dadosSanitizados.cliente_cpf;
    delete dadosSanitizados.cliente_endereco;
    delete dadosSanitizados.cliente_ip;
    delete dadosSanitizados.email;
    delete dadosSanitizados.telefone;
    delete dadosSanitizados.whatsapp;
    delete dadosSanitizados.cpf;
    delete dadosSanitizados.ip;
    
    // Manter apenas dados não sensíveis
    const dadosPermitidos = {
        // Informações gerais (sem IDs)
        valor: dadosSanitizados.valor,
        valor_original: dadosSanitizados.valor_original,
        valor_vendedor: dadosSanitizados.valor_vendedor,
        metodo_pagamento: dadosSanitizados.metodo_pagamento,
        status: dadosSanitizados.status,
        status_anterior: dadosSanitizados.status_anterior,
        motivo: dadosSanitizados.motivo,
        
        // Informações do cliente (apenas primeiro nome, sem dados pessoais)
        cliente_nome: dadosSanitizados.cliente_nome ? (() => {
            const partes = dadosSanitizados.cliente_nome.trim().split(' ');
            if (partes.length > 1) {
                // Primeiro nome + inicial do último sobrenome
                return partes[0] + ' ' + partes[partes.length - 1].charAt(0).toUpperCase() + '.';
            }
            return partes[0]; // Apenas primeiro nome se houver apenas uma palavra
        })() : null,
        
        // Informações do produto (sem ID)
        produto_nome: dadosSanitizados.produto_nome,
        produto_categoria: dadosSanitizados.produto_categoria,
        
        // Datas
        data_aprovacao: dadosSanitizados.data_aprovacao,
        data_cancelamento: dadosSanitizados.data_cancelamento,
        data_venda: dadosSanitizados.data_venda,
        
        // Outros dados não sensíveis
        canal_venda: dadosSanitizados.canal_venda,
        origem_trafico: dadosSanitizados.origem_trafico
    };
    
    // Remover valores undefined/null
    Object.keys(dadosPermitidos).forEach(key => {
        if (dadosPermitidos[key] === undefined || dadosPermitidos[key] === null) {
            delete dadosPermitidos[key];
        }
    });
    
    return dadosPermitidos;
}

/**
 * Função para enviar webhook (será chamada por outros módulos)
 * ROBUSTA: Nunca lança erros que possam quebrar o fluxo de pagamento
 * @param {string} evento - Nome do evento (ex: 'venda_aprovada', 'venda_cancelada')
 * @param {object} dados - Dados do evento
 * @param {string} userId - ID do usuário (opcional, para filtrar webhooks do usuário)
 * @param {string} produtoId - ID do produto (opcional, para filtrar webhooks do produto)
 */
async function enviarWebhook(evento, dados, userId = null, produtoId = null) {
    // VALIDAÇÃO INICIAL: Garantir que não falhe por dados inválidos
    if (!evento || typeof evento !== 'string') {
        console.error('❌ [WEBHOOK] Evento inválido ou não fornecido:', evento);
        return; // Retornar silenciosamente sem quebrar o fluxo
    }
    
    if (!dados || typeof dados !== 'object') {
        console.error('❌ [WEBHOOK] Dados inválidos ou não fornecidos:', dados);
        return; // Retornar silenciosamente sem quebrar o fluxo
    }
    
    // Sanitizar dados antes de enviar (remover IDs e dados sensíveis)
    const dadosSanitizados = sanitizarDadosWebhook(dados);
    
    try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔄 [WEBHOOK DEBUG] ===== INÍCIO DO PROCESSAMENTO =====`);
        console.log(`🔄 [WEBHOOK DEBUG] Evento: ${evento}`);
        console.log(`🔄 [WEBHOOK DEBUG] User ID: ${userId || 'NÃO FORNECIDO (buscará todos os usuários)'}`);
        console.log(`🔄 [WEBHOOK DEBUG] Produto ID: ${produtoId || 'NÃO FORNECIDO (buscará webhooks globais e do produto)'}`);
        console.log(`🔄 [WEBHOOK DEBUG] Dados recebidos:`, JSON.stringify(dados, null, 2));
        console.log(`🔄 [WEBHOOK DEBUG] Timestamp: ${new Date().toISOString()}`);
        console.log(`${'='.repeat(80)}\n`);
        
        // Buscar webhooks ativos do banco de dados
        const { Op } = require('sequelize');
        const whereClause = {
            ativo: true  // SEMPRE verificar se está ativo (conforme configuração)
        };
        
        // Se userId fornecido, filtrar apenas webhooks desse usuário (conforme configuração)
        if (userId) {
            whereClause.user_id = userId;
        }
        
        // Se produtoId fornecido, buscar webhooks específicos do produto OU webhooks globais (produto_id IS NULL)
        if (produtoId) {
            whereClause[Op.or] = [
                { produto_id: produtoId },
                { produto_id: null } // Webhooks globais também devem receber eventos de produtos específicos
            ];
        }
        
        console.log(`🔍 [WEBHOOK DEBUG] Buscando webhooks no banco de dados...`);
        console.log(`🔍 [WEBHOOK DEBUG] Filtros WHERE:`, JSON.stringify(whereClause, null, 2));
        
        // Obter modelo Webhook com verificação
        const WebhookModel = getWebhookModel();
        
        const webhooksAtivos = await WebhookModel.findAll({
            where: whereClause
        });

        console.log(`🔍 [WEBHOOK DEBUG] Query executada. Resultados encontrados: ${webhooksAtivos ? webhooksAtivos.length : 0}`);
        
        if (!webhooksAtivos || webhooksAtivos.length === 0) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📭 [WEBHOOK DEBUG] ===== NENHUM WEBHOOK ENCONTRADO =====`);
            console.log(`📭 [WEBHOOK DEBUG] Nenhum webhook ativo encontrado para os filtros aplicados`);
            console.log(`📭 [WEBHOOK DEBUG] Filtros usados:`, JSON.stringify(whereClause, null, 2));
            if (userId) {
                console.log(`💡 [WEBHOOK DEBUG] Dica: Verifique se existem webhooks ativos para o usuário ${userId}`);
                console.log(`💡 [WEBHOOK DEBUG] Execute no banco: SELECT * FROM webhooks WHERE user_id = '${userId}' AND ativo = true;`);
            } else {
                console.log(`💡 [WEBHOOK DEBUG] Dica: Execute no banco: SELECT * FROM webhooks WHERE ativo = true;`);
            }
            console.log(`${'='.repeat(80)}\n`);
            return;
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`📋 [WEBHOOK DEBUG] ===== WEBHOOKS ENCONTRADOS =====`);
        console.log(`📋 [WEBHOOK DEBUG] Total encontrado: ${webhooksAtivos.length}`);
        
        // Debug detalhado de cada webhook encontrado
        webhooksAtivos.forEach((webhook, index) => {
            console.log(`\n📋 [WEBHOOK DEBUG] Webhook #${index + 1}:`);
            console.log(`   └─ ID: ${webhook.id}`);
            console.log(`   └─ URL: ${webhook.url}`);
            console.log(`   └─ User ID: ${webhook.user_id}`);
            console.log(`   └─ Ativo: ${webhook.ativo}`);
            console.log(`   └─ Eventos (tipo): ${typeof webhook.eventos}`);
            console.log(`   └─ Eventos (raw):`, webhook.eventos);
            console.log(`   └─ Secret: ${webhook.secret ? 'Configurado' : 'Não configurado'}`);
        });
        console.log(`${'='.repeat(80)}\n`);

        // Filtrar webhooks que incluem o evento configurado
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔍 [WEBHOOK DEBUG] ===== FILTRANDO POR EVENTO =====`);
        console.log(`🔍 [WEBHOOK DEBUG] Evento procurado: "${evento}"`);
        console.log(`${'='.repeat(80)}\n`);
        
        const webhooksFiltrados = webhooksAtivos.filter(webhook => {
            let eventos = [];
            
            console.log(`🔍 [WEBHOOK DEBUG] Analisando webhook ${webhook.id}...`);
            console.log(`   └─ Tipo de eventos: ${typeof webhook.eventos}`);
            console.log(`   └─ Eventos raw:`, webhook.eventos);
            
            // Tratar diferentes formatos de eventos no banco (JSON pode vir em diferentes formatos)
            if (Array.isArray(webhook.eventos)) {
                eventos = webhook.eventos;
                console.log(`   └─ Eventos é Array: [${eventos.join(', ')}]`);
            } else if (typeof webhook.eventos === 'string') {
                try {
                    eventos = JSON.parse(webhook.eventos);
                    // Garantir que é um array
                    if (!Array.isArray(eventos)) {
                        eventos = eventos ? [eventos] : [];
                    }
                    console.log(`   └─ Eventos parseado de string: [${eventos.join(', ')}]`);
                } catch (e) {
                    console.error(`   ⚠️ [WEBHOOK DEBUG] Erro ao parsear eventos do webhook ${webhook.id}:`, e);
                    console.error(`   ⚠️ [WEBHOOK DEBUG] Eventos raw:`, webhook.eventos);
                    eventos = [];
                }
            } else if (webhook.eventos !== null && webhook.eventos !== undefined) {
                // Última tentativa: tratar como valor único
                eventos = [webhook.eventos];
                console.log(`   └─ Eventos tratado como valor único: [${eventos.join(', ')}]`);
            } else {
                console.log(`   └─ Eventos é null/undefined, usando array vazio`);
            }
            
            // Verificar se o evento está na lista de eventos configurados
            const incluiEvento = Array.isArray(eventos) && eventos.includes(evento);
            
            console.log(`   └─ Evento "${evento}" está na lista? ${incluiEvento ? 'SIM ✓' : 'NÃO ✗'}`);
            console.log(`   └─ Eventos configurados: [${eventos.join(', ')}]`);
            
            if (incluiEvento) {
                console.log(`   ✅ [WEBHOOK DEBUG] Webhook ${webhook.id} SERÁ ENVIADO`);
            } else {
                console.log(`   ❌ [WEBHOOK DEBUG] Webhook ${webhook.id} NÃO SERÁ ENVIADO (evento não configurado)`);
            }
            console.log(``);
            
            return incluiEvento;
        });

        if (webhooksFiltrados.length === 0) {
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📭 [WEBHOOK DEBUG] ===== NENHUM WEBHOOK FILTRADO =====`);
            console.log(`📭 [WEBHOOK DEBUG] Nenhum webhook ativo configurado para o evento: ${evento}`);
            console.log(`📭 [WEBHOOK DEBUG] Total de webhooks encontrados: ${webhooksAtivos.length}`);
            console.log(`📭 [WEBHOOK DEBUG] Total de webhooks filtrados: 0`);
            console.log(`💡 [WEBHOOK DEBUG] Dica: Verifique se algum webhook tem o evento "${evento}" na lista de eventos configurados`);
            console.log(`💡 [WEBHOOK DEBUG] Execute no banco: SELECT id, url, eventos, ativo FROM webhooks WHERE ativo = true;`);
            console.log(`${'='.repeat(80)}\n`);
            return;
        }

        console.log(`\n${'='.repeat(80)}`);
        console.log(`📤 [WEBHOOK DEBUG] ===== PREPARANDO ENVIO =====`);
        console.log(`📤 [WEBHOOK DEBUG] Total de webhooks que receberão o evento: ${webhooksFiltrados.length}`);
        console.log(`${'='.repeat(80)}\n`);

        // Usar dados sanitizados (sem IDs e dados sensíveis)
        const payload = {
            evento,
            timestamp: new Date().toISOString(),
            dados: dadosSanitizados
        };
        
        console.log(`📦 [WEBHOOK DEBUG] Payload preparado (dados sanitizados):`);
        console.log(JSON.stringify(payload, null, 2));
        console.log(`🔒 [WEBHOOK DEBUG] IDs e dados sensíveis removidos para segurança`);
        console.log(``);

        // Enviar para todos os webhooks filtrados (conforme configurações)
        const promises = webhooksFiltrados.map(async (webhook, index) => {
            try {
                console.log(`\n${'='.repeat(80)}`);
                console.log(`📡 [WEBHOOK DEBUG] ===== ENVIANDO WEBHOOK #${index + 1}/${webhooksFiltrados.length} =====`);
                console.log(`📡 [WEBHOOK DEBUG] URL: ${webhook.url}`);
                console.log(`📡 [WEBHOOK DEBUG] Webhook ID: ${webhook.id}`);
                console.log(`📡 [WEBHOOK DEBUG] Evento: ${evento}`);
                
                const headers = {
                    'Content-Type': 'application/json',
                    'User-Agent': 'RatixPay-Webhook/1.0',
                    'X-Webhook-Event': evento,
                    'X-Webhook-Id': webhook.id
                };
                
                // Adicionar secret se configurado
                if (webhook.secret) {
                    headers['X-Webhook-Secret'] = webhook.secret;
                    console.log(`📡 [WEBHOOK DEBUG] Secret configurado: SIM`);
                } else {
                    console.log(`📡 [WEBHOOK DEBUG] Secret configurado: NÃO`);
                }
                
                console.log(`📡 [WEBHOOK DEBUG] Headers:`, JSON.stringify(headers, null, 2));
                console.log(`📡 [WEBHOOK DEBUG] Payload:`, JSON.stringify(payload, null, 2));
                console.log(`📡 [WEBHOOK DEBUG] Fazendo requisição POST...`);

                const startTime = Date.now();
                const response = await axios.post(webhook.url, payload, {
                    headers: headers,
                    timeout: 10000, // 10 segundos de timeout
                    validateStatus: function (status) {
                        return status >= 200 && status < 300; // Aceitar apenas 2xx
                    }
                });
                const endTime = Date.now();
                const duration = endTime - startTime;

                console.log(`✅ [WEBHOOK DEBUG] ===== SUCESSO =====`);
                console.log(`✅ [WEBHOOK DEBUG] URL: ${webhook.url}`);
                console.log(`✅ [WEBHOOK DEBUG] Status HTTP: ${response.status}`);
                console.log(`✅ [WEBHOOK DEBUG] Tempo de resposta: ${duration}ms`);
                console.log(`✅ [WEBHOOK DEBUG] Evento: ${evento}`);
                console.log(`✅ [WEBHOOK DEBUG] Webhook ID: ${webhook.id}`);
                if (response.data) {
                    console.log(`✅ [WEBHOOK DEBUG] Resposta do servidor:`, JSON.stringify(response.data, null, 2));
                }
                console.log(`${'='.repeat(80)}\n`);
                
                return { success: true, url: webhook.url, status: response.status, webhookId: webhook.id, duration };

            } catch (error) {
                console.log(`\n${'='.repeat(80)}`);
                console.log(`❌ [WEBHOOK DEBUG] ===== ERRO AO ENVIAR =====`);
                console.log(`❌ [WEBHOOK DEBUG] URL: ${webhook.url}`);
                console.log(`❌ [WEBHOOK DEBUG] Webhook ID: ${webhook.id}`);
                
                if (error.response) {
                    // Resposta recebida com erro
                    console.error(`❌ [WEBHOOK DEBUG] Status HTTP: ${error.response.status}`);
                    console.error(`❌ [WEBHOOK DEBUG] Status Text: ${error.response.statusText}`);
                    console.error(`❌ [WEBHOOK DEBUG] Resposta:`, JSON.stringify(error.response.data, null, 2));
                    console.error(`❌ [WEBHOOK DEBUG] Headers da resposta:`, JSON.stringify(error.response.headers, null, 2));
                } else if (error.request) {
                    // Requisição feita mas sem resposta
                    console.error(`❌ [WEBHOOK DEBUG] Tipo: Sem resposta do servidor`);
                    console.error(`❌ [WEBHOOK DEBUG] Erro: ${error.message}`);
                    console.error(`❌ [WEBHOOK DEBUG] Request config:`, JSON.stringify(error.config, null, 2));
                } else {
                    // Erro na configuração
                    console.error(`❌ [WEBHOOK DEBUG] Tipo: Erro na configuração`);
                    console.error(`❌ [WEBHOOK DEBUG] Erro: ${error.message}`);
                    console.error(`❌ [WEBHOOK DEBUG] Stack:`, error.stack);
                }
                console.log(`${'='.repeat(80)}\n`);
                
                return { success: false, url: webhook.url, error: error.message, webhookId: webhook.id };
            }
        });

        // Aguardar todos os envios
        console.log(`⏳ [WEBHOOK DEBUG] Aguardando envio de ${promises.length} webhook(s)...`);
        const resultados = await Promise.allSettled(promises);
        
        const sucessos = resultados.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const falhas = resultados.length - sucessos;
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 [WEBHOOK DEBUG] ===== RESUMO FINAL =====`);
        console.log(`📊 [WEBHOOK DEBUG] Evento: ${evento}`);
        console.log(`📊 [WEBHOOK DEBUG] Total de webhooks encontrados: ${webhooksAtivos.length}`);
        console.log(`📊 [WEBHOOK DEBUG] Total de webhooks filtrados: ${webhooksFiltrados.length}`);
        console.log(`📊 [WEBHOOK DEBUG] Total de envios: ${resultados.length}`);
        console.log(`📊 [WEBHOOK DEBUG] Sucessos: ${sucessos}`);
        console.log(`📊 [WEBHOOK DEBUG] Falhas: ${falhas}`);
        
        // Detalhar cada resultado
        resultados.forEach((resultado, index) => {
            if (resultado.status === 'fulfilled') {
                const value = resultado.value;
                if (value.success) {
                    console.log(`   ✅ Webhook #${index + 1}: ${value.url} - Status ${value.status}`);
                } else {
                    console.log(`   ❌ Webhook #${index + 1}: ${value.url} - Erro: ${value.error}`);
                }
            } else {
                console.log(`   ❌ Webhook #${index + 1}: Erro na promise - ${resultado.reason}`);
            }
        });
        
        if (falhas > 0) {
            console.log(`⚠️ [WEBHOOK DEBUG] Alguns webhooks falharam. Verifique os logs acima para detalhes.`);
        }
        console.log(`${'='.repeat(80)}\n`);

    } catch (error) {
        console.error(`\n${'='.repeat(80)}`);
        console.error('❌ [WEBHOOK DEBUG] ===== ERRO CRÍTICO =====');
        console.error('❌ [WEBHOOK DEBUG] Erro ao processar webhooks:', error);
        console.error('❌ [WEBHOOK DEBUG] Mensagem:', error.message);
        console.error('❌ [WEBHOOK DEBUG] Stack:', error.stack);
        console.error(`${'='.repeat(80)}\n`);
    }
}

module.exports = { router, enviarWebhook };
