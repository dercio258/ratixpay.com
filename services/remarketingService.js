/**
 * Serviço de Remarketing Automático
 * Gerencia fila de notificações de remarketing para vendas canceladas
 */

const { sequelize } = require('../config/database');
const { Produto } = require('../config/database');
const emailManagerService = require('./emailManagerService');
const whatsappService = require('./whatsappService');

class RemarketingService {
    constructor() {
        this.tableName = 'remarketing_queue';
        this.maxItensPorExecucao = 50;
        this.intervaloProcessamento = 5 * 60 * 1000; // 5 minutos
    }

    /**
     * Adiciona venda cancelada à fila de remarketing
     * @param {Object} dados - Dados da venda cancelada
     * @returns {Promise<Object>} Item adicionado à fila
     */
    async adicionarVendaCancelada(dados) {
        const {
            cliente_id,
            cliente_nome,
            produto_id,
            produto_nome,
            email,
            telefone
        } = dados;

        try {
            // Buscar produto para verificar se remarketing está ativo
            const produto = await Produto.findByPk(produto_id);
            
            if (!produto) {
                throw new Error('Produto não encontrado');
            }

            // Verificar se remarketing está ativado
            const remarketingConfig = produto.remarketing_config;
            if (!remarketingConfig || !remarketingConfig.enabled) {
                return { ignorado: true, motivo: 'Remarketing não ativado para este produto' };
            }

            // Verificar antispam (máximo 1 notificação por cliente/produto/dia)
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const amanha = new Date(hoje);
            amanha.setDate(amanha.getDate() + 1);

            const antispamCheck = await sequelize.query(
                `SELECT id FROM ${this.tableName} 
                 WHERE cliente_id = :cliente_id 
                   AND produto_id = :produto_id 
                   AND DATE(data_cancelamento) = DATE(:hoje)
                   AND status IN ('pendente', 'enviado')
                 LIMIT 1`,
                {
                    replacements: {
                        cliente_id,
                        produto_id,
                        hoje: hoje.toISOString()
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (antispamCheck.length > 0) {
                return { ignorado: true, motivo: 'Antispam: já existe notificação para este cliente/produto hoje' };
            }

            // Calcular data_agendada
            const tempoMinutos = remarketingConfig.tempo_minutos || 0;
            const dataCancelamento = new Date();
            const dataAgendada = new Date(dataCancelamento.getTime() + (tempoMinutos * 60 * 1000));

            // Inserir na fila
            const [result] = await sequelize.query(
                `INSERT INTO ${this.tableName} 
                 (cliente_id, cliente_nome, produto_id, produto_nome, email, telefone, 
                  status, data_cancelamento, tempo_envio, data_agendada, created_at, updated_at)
                 VALUES (:cliente_id, :cliente_nome, :produto_id, :produto_nome, :email, :telefone,
                         'pendente', :data_cancelamento, :tempo_envio, :data_agendada, NOW(), NOW())
                 RETURNING *`,
                {
                    replacements: {
                        cliente_id,
                        cliente_nome,
                        produto_id,
                        produto_nome,
                        email: email || null,
                        telefone: telefone || null,
                        data_cancelamento: dataCancelamento.toISOString(),
                        tempo_envio: tempoMinutos,
                        data_agendada: dataAgendada.toISOString()
                    },
                    type: sequelize.QueryTypes.INSERT
                }
            );

            return { sucesso: true, item: result[0] };
        } catch (error) {
            console.error('❌ Erro ao adicionar venda cancelada à fila:', error);
            throw error;
        }
    }

    /**
     * Processa a fila de remarketing
     * Busca itens pendentes cuja data_agendada já passou
     * @returns {Promise<Object>} Estatísticas do processamento
     */
    async processarFila() {
        const agora = new Date();
        const stats = {
            processados: 0,
            enviados: 0,
            ignorados: 0,
            erros: 0
        };

        try {
            // Buscar itens pendentes cuja data_agendada já passou
            const itens = await sequelize.query(
                `SELECT * FROM ${this.tableName}
                 WHERE status = 'pendente'
                   AND data_agendada <= :agora
                 ORDER BY data_agendada ASC
                 LIMIT :limite`,
                {
                    replacements: {
                        agora: agora.toISOString(),
                        limite: this.maxItensPorExecucao
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (itens.length === 0) {
                return stats;
            }

            // Processar cada item
            for (const item of itens) {
                stats.processados++;

                try {
                    // Verificar antispam novamente antes de enviar
                    const hoje = new Date(item.data_cancelamento);
                    hoje.setHours(0, 0, 0, 0);

                    const antispamCheck = await sequelize.query(
                        `SELECT id FROM ${this.tableName}
                         WHERE cliente_id = :cliente_id
                           AND produto_id = :produto_id
                           AND DATE(data_cancelamento) = DATE(:hoje)
                           AND status = 'enviado'
                           AND id != :item_id
                         LIMIT 1`,
                        {
                            replacements: {
                                cliente_id: item.cliente_id,
                                produto_id: item.produto_id,
                                hoje: hoje.toISOString(),
                                item_id: item.id
                            },
                            type: sequelize.QueryTypes.SELECT
                        }
                    );

                    if (antispamCheck.length > 0) {
                        await this.marcarComoIgnorado(item.id, 'Antispam: notificação já enviada hoje');
                        stats.ignorados++;
                        continue;
                    }

                    // Enviar notificação
                    const resultado = await this.enviarNotificacao(item);
                    
                    if (resultado.sucesso) {
                        await this.marcarComoEnviado(item.id);
                        stats.enviados++;
                    } else {
                        await this.marcarComoIgnorado(item.id, resultado.motivo || 'Erro ao enviar');
                        stats.ignorados++;
                    }
                } catch (error) {
                    console.error(`❌ Erro ao processar item ${item.id}:`, error);
                    stats.erros++;
                    
                    // Incrementar tentativas
                    await sequelize.query(
                        `UPDATE ${this.tableName}
                         SET tentativas = tentativas + 1,
                             updated_at = NOW()
                         WHERE id = :id`,
                        {
                            replacements: { id: item.id }
                        }
                    );

                    // Se exceder 3 tentativas, marcar como ignorado
                    if ((item.tentativas || 0) >= 2) {
                        await this.marcarComoIgnorado(item.id, 'Máximo de tentativas excedido');
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('❌ Erro ao processar fila de remarketing:', error);
            throw error;
        }
    }

    /**
     * Envia notificação de remarketing
     * @param {Object} item - Item da fila
     * @returns {Promise<Object>} Resultado do envio
     */
    async enviarNotificacao(item) {
        try {
            // Buscar dados do produto
            const produto = await Produto.findByPk(item.produto_id);
            if (!produto) {
                return { sucesso: false, motivo: 'Produto não encontrado' };
            }

            // Gerar link do checkout
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            const linkCheckout = `${baseUrl}/checkout.html?produto=${produto.custom_id}`;

            // Preparar mensagem
            const mensagem = this.prepararMensagem(
                item.cliente_nome,
                item.produto_nome,
                linkCheckout
            );

            let sucessoEmail = false;
            let sucessoWhatsApp = false;

            // Enviar por email (se disponível)
            if (item.email) {
                try {
                    await emailManagerService.enviarEmailOfertas('campanha_remarketing', {
                        email: item.email,
                        nome: item.cliente_nome,
                        assunto: `Finalize sua compra: ${item.produto_nome}`,
                        mensagem: mensagem,
                        linkCheckout: linkCheckout
                    });
                    sucessoEmail = true;
                } catch (error) {
                    console.error(`⚠️ Erro ao enviar email para ${item.email}:`, error.message);
                }
            }

            // Enviar por WhatsApp (se disponível)
            if (item.telefone) {
                try {
                    await whatsappService.enviarMensagem(item.telefone, mensagem);
                    sucessoWhatsApp = true;
                } catch (error) {
                    console.error(`⚠️ Erro ao enviar WhatsApp para ${item.telefone}:`, error.message);
                }
            }

            // Retornar sucesso se pelo menos um método funcionou
            if (sucessoEmail || sucessoWhatsApp) {
                return { sucesso: true, email: sucessoEmail, whatsapp: sucessoWhatsApp };
            } else {
                return { sucesso: false, motivo: 'Nenhum canal de envio disponível ou funcionou' };
            }
        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
            return { sucesso: false, motivo: error.message };
        }
    }

    /**
     * Prepara mensagem padrão de remarketing
     * @param {string} nomeCliente - Nome do cliente
     * @param {string} nomeProduto - Nome do produto
     * @param {string} linkCheckout - Link do checkout
     * @returns {string} Mensagem formatada
     */
    prepararMensagem(nomeCliente, nomeProduto, linkCheckout) {
        return `Olá ${nomeCliente},

Vimos que você tentou comprar "${nomeProduto}", mas não concluiu.

👉 Finalize agora com desconto especial:
${linkCheckout}

A oferta é por tempo limitado!`;
    }

    /**
     * Marca item como enviado
     * @param {string} queueId - ID do item na fila
     */
    async marcarComoEnviado(queueId) {
        await sequelize.query(
            `UPDATE ${this.tableName}
             SET status = 'enviado',
                 data_envio = NOW(),
                 updated_at = NOW()
             WHERE id = :id`,
            {
                replacements: { id: queueId }
            }
        );
    }

    /**
     * Marca item como ignorado
     * @param {string} queueId - ID do item na fila
     * @param {string} motivo - Motivo da ignorância
     */
    async marcarComoIgnorado(queueId, motivo) {
        await sequelize.query(
            `UPDATE ${this.tableName}
             SET status = 'ignorado',
                 motivo_ignorado = :motivo,
                 updated_at = NOW()
             WHERE id = :id`,
            {
                replacements: { id: queueId, motivo }
            }
        );
    }

    /**
     * Obtém estatísticas da fila
     * @returns {Promise<Object>} Estatísticas
     */
    async obterEstatisticas() {
        const [result] = await sequelize.query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
                COUNT(*) FILTER (WHERE status = 'enviado') as enviados,
                COUNT(*) FILTER (WHERE status = 'ignorado') as ignorados,
                COUNT(*) as total
             FROM ${this.tableName}`,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );

        return {
            pendentes: parseInt(result.pendentes) || 0,
            enviados: parseInt(result.enviados) || 0,
            ignorados: parseInt(result.ignorados) || 0,
            total: parseInt(result.total) || 0
        };
    }
}

module.exports = new RemarketingService();

