const express = require('express');
const multer = require('multer');
const router = express.Router();
const chatbotService = require('../services/chatbotService');
const geminiService = require('../services/geminiService');

// Configurar multer para upload de arquivos
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});

/**
 * POST /api/chatbot/inicializar
 * Inicializa uma nova sessão de chat para um pedido
 */
router.post('/inicializar', async (req, res) => {
    try {
        const { id_pedido } = req.body;
        
        if (!id_pedido) {
            return res.status(400).json({
                success: false,
                message: 'ID do pedido é obrigatório'
            });
        }

        
        const resultado = await chatbotService.inicializarSessao(id_pedido);
        
        if (resultado.sucesso) {
            res.json({
                success: true,
                message: resultado.mensagem,
                produto: resultado.produto
            });
        } else {
            res.status(404).json({
                success: false,
                message: resultado.erro
            });
        }

    } catch (error) {
        console.error('❌ Erro ao inicializar chatbot:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/chatbot/mensagem
 * Processa uma mensagem do cliente
 */
router.post('/mensagem', async (req, res) => {
    try {
        const { id_pedido, mensagem } = req.body;
        
        if (!id_pedido || !mensagem) {
            return res.status(400).json({
                success: false,
                message: 'ID do pedido e mensagem são obrigatórios'
            });
        }

        if (mensagem.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Mensagem não pode estar vazia'
            });
        }

        
        const resultado = await chatbotService.processarMensagem(id_pedido, mensagem.trim());
        
        if (resultado.sucesso) {
            res.json({
                success: true,
                resposta: resultado.resposta,
                produto: resultado.produto
            });
        } else {
            res.status(500).json({
                success: false,
                message: resultado.erro
            });
        }

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/chatbot/sessao/:id_pedido
 * Obtém dados da sessão atual
 */
router.get('/sessao/:id_pedido', async (req, res) => {
    try {
        const { id_pedido } = req.params;
        
        const sessao = chatbotService.obterSessao(id_pedido);
        
        if (sessao) {
            res.json({
                success: true,
                sessao: {
                    idPedido: sessao.idPedido,
                    produto: sessao.produto,
                    totalMensagens: sessao.historico.length,
                    dataCriacao: sessao.dataCriacao,
                    ultimaAtividade: sessao.ultimaAtividade
                }
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Sessão não encontrada'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao obter sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE /api/chatbot/sessao/:id_pedido
 * Remove uma sessão
 */
router.delete('/sessao/:id_pedido', async (req, res) => {
    try {
        const { id_pedido } = req.params;
        
        const removido = chatbotService.removerSessao(id_pedido);
        
        if (removido) {
            res.json({
                success: true,
                message: 'Sessão removida com sucesso'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Sessão não encontrada'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao remover sessão:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE /api/chatbot/historico/:id_pedido
 * Limpa o histórico de uma sessão
 */
router.delete('/historico/:id_pedido', async (req, res) => {
    try {
        const { id_pedido } = req.params;
        
        const limpo = chatbotService.limparHistorico(id_pedido);
        
        if (limpo) {
            res.json({
                success: true,
                message: 'Histórico limpo com sucesso'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Sessão não encontrada'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao limpar histórico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/chatbot/estatisticas
 * Obtém estatísticas das sessões (apenas para admin)
 */
router.get('/estatisticas', async (req, res) => {
    try {
        const estatisticas = chatbotService.obterEstatisticas();
        
        res.json({
            success: true,
            estatisticas: estatisticas
        });

    } catch (error) {
        console.error('❌ Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/chatbot/gerar-descricao
 * Gera descrição para um produto (para uso na criação de produtos)
 */
router.post('/gerar-descricao', async (req, res) => {
    try {
        const { nome, preco, categoria } = req.body;
        
        if (!nome || !preco) {
            return res.status(400).json({
                success: false,
                message: 'Nome e preço são obrigatórios'
            });
        }

        
        const produto = {
            nome: nome,
            preco: preco,
            categoria: categoria || 'Não especificada'
        };
        
        const descricao = await geminiService.gerarDescricaoProduto(produto);
        
        res.json({
            success: true,
            descricao: descricao,
            produto: produto
        });

    } catch (error) {
        console.error('❌ Erro ao gerar descrição:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/chatbot/gerar-perguntas-produto
 * Gera perguntas para facilitar a criação da descrição do produto
 */
router.post('/gerar-perguntas-produto', async (req, res) => {
    try {
        const { nome, categoria, preco } = req.body;
        
        if (!nome || !categoria || !preco) {
            return res.status(400).json({
                success: false,
                message: 'Nome, categoria e preço são obrigatórios'
            });
        }

        
        const perguntas = await geminiService.gerarPerguntasProduto({
            nome,
            categoria,
            preco
        });
        
        res.json({
            success: true,
            perguntas: perguntas
        });
    } catch (error) {
        console.error('❌ Erro ao gerar perguntas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar perguntas. Tente novamente.'
        });
    }
});

// Rota para enviar PDF da conversa para o vendedor
router.post('/enviar-pdf-vendedor', upload.single('pdf'), async (req, res) => {
    try {
        const { pedido_id, produto_nome, cliente_nome, conversa } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'PDF não fornecido' });
        }
        
        
        // Aqui você pode implementar o envio do PDF para o vendedor
        // Por exemplo, salvar no banco de dados, enviar por email, etc.
        
        // Por enquanto, vamos apenas logar as informações
        
        res.json({ 
            success: true, 
            message: 'PDF recebido com sucesso',
            dados: {
                pedido_id,
                produto_nome,
                cliente_nome,
                mensagens: JSON.parse(conversa).length
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao processar PDF:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar PDF' });
    }
});

module.exports = router;
