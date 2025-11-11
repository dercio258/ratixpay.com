const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { Usuario, Produto, Venda, sequelize } = require('../config/database');
const router = express.Router();

// Modelo Webhook (simulado - em produção seria uma tabela no banco)
const webhooks = new Map();

/**
 * POST - Criar webhook
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { url, eventos, secret } = req.body;
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

        const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const webhook = {
            id: webhookId,
            user_id: userId,
            url,
            eventos,
            secret: secret || null,
            ativo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        webhooks.set(webhookId, webhook);

        console.log(`✅ Webhook criado: ${webhookId} para ${url}`);

        res.json({
            success: true,
            message: 'Webhook configurado com sucesso',
            webhook
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
        const userId = req.user.id;
        
        const userWebhooks = Array.from(webhooks.values())
            .filter(webhook => webhook.user_id === userId);

        res.json({
            success: true,
            webhooks: userWebhooks
        });

    } catch (error) {
        console.error('❌ Erro ao listar webhooks:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
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

        const webhook = webhooks.get(id);
        
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

        webhook.ativo = !webhook.ativo;
        webhook.updated_at = new Date().toISOString();
        webhooks.set(id, webhook);

        res.json({
            success: true,
            message: `Webhook ${webhook.ativo ? 'ativado' : 'desativado'} com sucesso`,
            webhook
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

        const webhook = webhooks.get(id);
        
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

        webhooks.delete(id);

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
 * Função para enviar webhook (será chamada por outros módulos)
 */
async function enviarWebhook(evento, dados) {
    try {
        console.log(`🔄 Enviando webhook para evento: ${evento}`);
        
        const webhooksAtivos = Array.from(webhooks.values())
            .filter(webhook => webhook.ativo && webhook.eventos.includes(evento));

        if (webhooksAtivos.length === 0) {
            console.log('📭 Nenhum webhook ativo para este evento');
            return;
        }

        const payload = {
            evento,
            timestamp: new Date().toISOString(),
            dados
        };

        // Enviar para todos os webhooks ativos
        for (const webhook of webhooksAtivos) {
            try {
                const response = await fetch(webhook.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'RatixPay-Webhook/1.0',
                        ...(webhook.secret && { 'X-Webhook-Secret': webhook.secret })
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    console.log(`✅ Webhook enviado com sucesso para: ${webhook.url}`);
                } else {
                    console.error(`❌ Erro ao enviar webhook para ${webhook.url}: ${response.status}`);
                }
            } catch (error) {
                console.error(`❌ Erro ao enviar webhook para ${webhook.url}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Erro ao processar webhooks:', error);
    }
}

module.exports = { router, enviarWebhook };
