const geminiService = require('./geminiService');
const { Pedido, Produto } = require('../config/database');

class ChatbotService {
    constructor() {
        this.sessoes = new Map(); // Armazena sessões por id_pedido
        this.tempoExpiracao = 30 * 60 * 1000; // 30 minutos
        
        // Limpar sessões expiradas a cada 5 minutos
        setInterval(() => {
            this.limparSessoesExpiradas();
        }, 5 * 60 * 1000);
        
        console.log('🤖 ChatbotService inicializado');
    }

    /**
     * Inicializa uma nova sessão de chat para um pedido
     * @param {string} idPedido - ID do pedido
     * @returns {Promise<Object>} - Dados da sessão inicializada
     */
    async inicializarSessao(idPedido) {
        try {
            console.log('🔄 Inicializando sessão para pedido:', idPedido);
            
            // Buscar dados do pedido (pode ser ID do pedido, ID da venda ou número do pedido)
            let pedido = await Pedido.findOne({
                where: { id: idPedido }
            });
            
            // Se não encontrou por ID, tenta buscar por venda_id (se for UUID)
            if (!pedido && idPedido.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                pedido = await Pedido.findOne({
                    where: { venda_id: idPedido }
                });
            }
            
            // Se não encontrou, tenta buscar por numero_pedido
            if (!pedido) {
                pedido = await Pedido.findOne({
                    where: { numero_pedido: idPedido }
                });
            }

            if (!pedido) {
                throw new Error('Pedido não encontrado');
            }

            // Buscar dados completos do produto através da venda
            let produtoCompleto = null;
            if (pedido.venda_id) {
                try {
                    const { Venda, Produto } = require('../config/database');
                    const venda = await Venda.findOne({
                        where: { id: pedido.venda_id },
                        include: [{
                            model: Produto,
                            as: 'produto',
                            attributes: ['id', 'nome', 'descricao', 'preco', 'categoria', 'tipo', 'imagem', 'link_conteudo']
                        }]
                    });
                    
                    if (venda && venda.produto) {
                        produtoCompleto = venda.produto;
                        console.log('✅ Produto completo encontrado:', produtoCompleto.nome);
                    }
                } catch (error) {
                    console.log('⚠️ Erro ao buscar produto completo:', error.message);
                }
            }
            
            // Criar objeto produto com dados completos ou fallback
            const produto = {
                id: produtoCompleto?.id || pedido.id,
                nome: produtoCompleto?.nome || pedido.produto_nome,
                descricao: produtoCompleto?.descricao || 'Produto adquirido via RatixPay',
                preco: produtoCompleto?.preco || pedido.valor_pedido,
                categoria: produtoCompleto?.categoria || 'Produto Digital',
                tipo: produtoCompleto?.tipo || 'Digital',
                imagem: produtoCompleto?.imagem || pedido.produto_imagem,
                link_conteudo: produtoCompleto?.link_conteudo || pedido.conteudo_link,
                // Informações da página
                pagina_atual: 'Página de Sucesso do Pagamento',
                funcionalidades_pagina: [
                    'Botão de download do produto',
                    'Informações de contato do vendedor',
                    'Opções de suporte via WhatsApp',
                    'Detalhes da transação',
                    'Chat de suporte inteligente'
                ]
            };
            
            console.log('📋 Produto carregado para chatbot:', {
                nome: produto.nome,
                descricao: produto.descricao?.substring(0, 100) + '...',
                preco: produto.preco,
                categoria: produto.categoria,
                temDescricaoCompleta: !!produtoCompleto?.descricao
            });

            // Criar sessão
            const sessao = {
                idPedido: idPedido,
                produto: {
                    id: produto.id,
                    nome: produto.nome,
                    descricao: produto.descricao || 'Descrição não disponível',
                    preco: produto.preco,
                    categoria: produto.categoria,
                    tipo: produto.tipo
                },
                historico: [],
                dataCriacao: new Date(),
                ultimaAtividade: new Date()
            };

            // Armazenar sessão
            this.sessoes.set(idPedido, sessao);
            
            console.log('✅ Sessão inicializada:', {
                idPedido,
                produto: produto.nome,
                timestamp: new Date().toISOString()
            });

            return {
                sucesso: true,
                produto: sessao.produto,
                mensagem: `Suporte inicializado para ${produto.nome}`
            };

        } catch (error) {
            console.error('❌ Erro ao inicializar sessão:', error);
            return {
                sucesso: false,
                erro: error.message
            };
        }
    }

    /**
     * Processa uma mensagem do cliente
     * @param {string} idPedido - ID do pedido
     * @param {string} mensagem - Mensagem do cliente
     * @returns {Promise<Object>} - Resposta do chatbot
     */
    async processarMensagem(idPedido, mensagem) {
        try {
            console.log('🔄 Processando mensagem para pedido:', idPedido);
            
            // Verificar se a sessão existe
            const sessao = this.sessoes.get(idPedido);
            if (!sessao) {
                // Tentar inicializar sessão
                const inicializacao = await this.inicializarSessao(idPedido);
                if (!inicializacao.sucesso) {
                    return {
                        sucesso: false,
                        erro: 'Sessão não encontrada e não foi possível inicializar'
                    };
                }
            }

            const sessaoAtual = this.sessoes.get(idPedido);
            
            // Atualizar última atividade
            sessaoAtual.ultimaAtividade = new Date();
            
            // Validar se a pergunta é sobre o produto específico
            const perguntaValida = geminiService.validarPergunta(mensagem, sessaoAtual.produto);
            
            if (!perguntaValida) {
                const resposta = "Só posso ajudar com o produto comprado.";
                this.adicionarAoHistorico(sessaoAtual, mensagem, resposta);
                
                return {
                    sucesso: true,
                    resposta: resposta,
                    produto: sessaoAtual.produto
                };
            }

            // Gerar resposta usando Gemini
            const resposta = await geminiService.gerarRespostaChatbot(
                mensagem, 
                sessaoAtual.produto,
                `Histórico: ${sessaoAtual.historico.slice(-3).map(h => `${h.pergunta} -> ${h.resposta}`).join('; ')}`
            );

            // Adicionar ao histórico
            this.adicionarAoHistorico(sessaoAtual, mensagem, resposta);

            console.log('✅ Resposta gerada:', resposta);

            return {
                sucesso: true,
                resposta: resposta,
                produto: sessaoAtual.produto
            };

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
            return {
                sucesso: false,
                erro: 'Erro interno do servidor'
            };
        }
    }

    /**
     * Adiciona mensagem ao histórico da sessão
     * @param {Object} sessao - Sessão atual
     * @param {string} pergunta - Pergunta do cliente
     * @param {string} resposta - Resposta do chatbot
     */
    adicionarAoHistorico(sessao, pergunta, resposta) {
        sessao.historico.push({
            pergunta: pergunta,
            resposta: resposta,
            timestamp: new Date()
        });

        // Manter apenas as últimas 10 interações
        if (sessao.historico.length > 10) {
            sessao.historico = sessao.historico.slice(-10);
        }
    }

    /**
     * Obtém dados da sessão
     * @param {string} idPedido - ID do pedido
     * @returns {Object|null} - Dados da sessão ou null
     */
    obterSessao(idPedido) {
        const sessao = this.sessoes.get(idPedido);
        if (sessao) {
            sessao.ultimaAtividade = new Date();
        }
        return sessao;
    }

    /**
     * Limpa o histórico de uma sessão
     * @param {string} idPedido - ID do pedido
     * @returns {boolean} - Se a operação foi bem-sucedida
     */
    limparHistorico(idPedido) {
        const sessao = this.sessoes.get(idPedido);
        if (sessao) {
            sessao.historico = [];
            sessao.ultimaAtividade = new Date();
            console.log('🧹 Histórico limpo para pedido:', idPedido);
            return true;
        }
        return false;
    }

    /**
     * Remove uma sessão
     * @param {string} idPedido - ID do pedido
     * @returns {boolean} - Se a operação foi bem-sucedida
     */
    removerSessao(idPedido) {
        const removido = this.sessoes.delete(idPedido);
        if (removido) {
            console.log('🗑️ Sessão removida para pedido:', idPedido);
        }
        return removido;
    }

    /**
     * Limpa sessões expiradas
     */
    limparSessoesExpiradas() {
        const agora = new Date();
        let removidas = 0;

        for (const [idPedido, sessao] of this.sessoes.entries()) {
            const tempoInativo = agora - sessao.ultimaAtividade;
            if (tempoInativo > this.tempoExpiracao) {
                this.sessoes.delete(idPedido);
                removidas++;
            }
        }

        if (removidas > 0) {
            console.log(`🧹 ${removidas} sessões expiradas removidas`);
        }
    }

    /**
     * Obtém estatísticas das sessões
     * @returns {Object} - Estatísticas
     */
    obterEstatisticas() {
        return {
            totalSessoes: this.sessoes.size,
            sessoes: Array.from(this.sessoes.entries()).map(([id, sessao]) => ({
                idPedido: id,
                produto: sessao.produto.nome,
                totalMensagens: sessao.historico.length,
                ultimaAtividade: sessao.ultimaAtividade,
                tempoInativo: new Date() - sessao.ultimaAtividade
            }))
        };
    }
}

module.exports = new ChatbotService();
