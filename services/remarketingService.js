/**
 * Serviço de Remarketing Automático
 * Gerencia fila de notificações para vendas canceladas
 */

const { sequelize, Produto } = require('../config/database');
const { QueryTypes } = require('sequelize');
const emailManagerService = require('./emailManagerService');
const whatsappService = require('./whatsappService');

class RemarketingService {
    constructor() {
        this.tableName = 'remarketing_queue';
    }

    /**
     * Adicionar venda cancelada à fila de remarketing
     * @param {Object} dados - Dados da venda cancelada
     * @param {string} dados.cliente_id - ID do cliente
     * @param {string} dados.cliente_nome - Nome do cliente
     * @param {string} dados.produto_id - ID do produto
     * @param {string} dados.produto_nome - Nome do produto
     * @param {string} dados.email - Email do cliente (opcional)
     * @param {string} dados.telefone - Telefone do cliente (opcional)
     */
    async adicionarVendaCancelada(dados) {
        try {
            const { cliente_id, cliente_nome, produto_id, produto_nome, email, telefone } = dados;

            // Verificar se o produto tem remarketing ativado
            const produto = await Produto.findByPk(produto_id);
            if (!produto || !produto.remarketing_config || !produto.remarketing_config.enabled) {
                console.log(`⚠️ Remarketing não está ativado para o produto ${produto_id}`);
                return { success: false, message: 'Remarketing não está ativado para este produto' };
            }

            // Verificar antispam: não enviar mais de uma notificação por produto/cliente no mesmo dia
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            
            const [notificacoesHoje] = await sequelize.query(`
                SELECT COUNT(*) as count
                FROM ${this.tableName}
                WHERE cliente_id = :cliente_id
                AND produto_id = :produto_id
                AND data_cancelamento >= :hoje
                AND status IN ('pendente', 'enviado')
            `, {
                replacements: {
                    cliente_id,
                    produto_id,
                    hoje: hoje.toISOString()
                },
                type: QueryTypes.SELECT
            });

            if (notificacoesHoje && parseInt(notificacoesHoje.count) > 0) {
                console.log(`⚠️ Cliente ${cliente_id} já recebeu notificação para produto ${produto_id} hoje`);
                return { success: false, message: 'Notificação já enviada hoje para este cliente/produto' };
            }

            // Obter tempo de envio da configuração do produto
            const tempoEnvio = produto.remarketing_config.tempo_minutos || 0;

            // Calcular data_agendada: data_cancelamento + tempo_envio minutos
            const dataCancelamento = new Date();
            const dataAgendada = new Date(dataCancelamento.getTime() + (tempoEnvio * 60 * 1000));

            // Inserir na fila
            const [result] = await sequelize.query(`
                INSERT INTO ${this.tableName} 
                (cliente_id, cliente_nome, produto_id, produto_nome, email, telefone, status, data_cancelamento, tempo_envio, data_agendada)
                VALUES (:cliente_id, :cliente_nome, :produto_id, :produto_nome, :email, :telefone, 'pendente', :data_cancelamento, :tempo_envio, :data_agendada)
                RETURNING id, data_agendada
            `, {
                replacements: {
                    cliente_id,
                    cliente_nome,
                    produto_id,
                    produto_nome,
                    email: email || null,
                    telefone: telefone || null,
                    data_cancelamento: dataCancelamento.toISOString(),
                    tempo_envio: tempoEnvio,
                    data_agendada: dataAgendada.toISOString()
                },
                type: QueryTypes.INSERT
            });

            console.log(`✅ Venda cancelada adicionada à fila de remarketing: ID ${result[0].id}, agendado para ${result[0].data_agendada}`);

            return {
                success: true,
                queueId: result[0].id,
                dataAgendada: result[0].data_agendada
            };

        } catch (error) {
            console.error('❌ Erro ao adicionar venda cancelada à fila:', error);
            throw error;
        }
    }

    /**
     * Processar fila de remarketing (chamado pelo cron job)
     * Envia notificações para itens cuja data_agendada já passou
     */
    async processarFila() {
        try {
            console.log('🔄 Processando fila de remarketing...');

            // Buscar itens pendentes cuja data_agendada já passou
            const agora = new Date().toISOString();
            
            const [itensPendentes] = await sequelize.query(`
                SELECT 
                    id,
                    cliente_id,
                    cliente_nome,
                    produto_id,
                    produto_nome,
                    email,
                    telefone,
                    data_cancelamento,
                    data_agendada
                FROM ${this.tableName}
                WHERE status = 'pendente'
                AND data_agendada <= :agora
                ORDER BY data_agendada ASC
                LIMIT 50
            `, {
                replacements: { agora },
                type: QueryTypes.SELECT
            });

            if (!itensPendentes || itensPendentes.length === 0) {
                console.log('✅ Nenhum item pendente na fila de remarketing');
                return { processados: 0, enviados: 0, erros: 0 };
            }

            console.log(`📋 Encontrados ${itensPendentes.length} itens para processar`);

            let enviados = 0;
            let erros = 0;

            for (const item of itensPendentes) {
                try {
                    // Verificar antispam novamente (pode ter mudado desde que foi adicionado)
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    
                    const [notificacoesHoje] = await sequelize.query(`
                        SELECT COUNT(*) as count
                        FROM ${this.tableName}
                        WHERE cliente_id = :cliente_id
                        AND produto_id = :produto_id
                        AND data_cancelamento >= :hoje
                        AND status = 'enviado'
                    `, {
                        replacements: {
                            cliente_id: item.cliente_id,
                            produto_id: item.produto_id,
                            hoje: hoje.toISOString()
                        },
                        type: QueryTypes.SELECT
                    });

                    if (notificacoesHoje && parseInt(notificacoesHoje.count) > 0) {
                        console.log(`⚠️ Ignorando item ${item.id}: notificação já enviada hoje`);
                        await this.marcarComoIgnorado(item.id, 'Notificação já enviada hoje (antispam)');
                        continue;
                    }

                    // Enviar notificação
                    const resultado = await this.enviarNotificacao(item);

                    if (resultado.success) {
                        await this.marcarComoEnviado(item.id);
                        enviados++;
                        console.log(`✅ Notificação enviada para item ${item.id}`);
                    } else {
                        await this.marcarComoIgnorado(item.id, resultado.message || 'Erro ao enviar');
                        erros++;
                        console.log(`❌ Erro ao enviar notificação para item ${item.id}: ${resultado.message}`);
                    }

                } catch (error) {
                    console.error(`❌ Erro ao processar item ${item.id}:`, error);
                    await this.marcarComoIgnorado(item.id, error.message);
                    erros++;
                }
            }

            console.log(`✅ Fila processada: ${enviados} enviados, ${erros} erros`);

            return {
                processados: itensPendentes.length,
                enviados,
                erros
            };

        } catch (error) {
            console.error('❌ Erro ao processar fila de remarketing:', error);
            throw error;
        }
    }

    /**
     * Enviar notificação de remarketing
     * @param {Object} item - Item da fila
     */
    async enviarNotificacao(item) {
        try {
            const { cliente_id, cliente_nome, produto_id, produto_nome, email, telefone } = item;

            // Buscar produto para obter configurações
            const produto = await Produto.findByPk(produto_id);
            if (!produto) {
                return { success: false, message: 'Produto não encontrado' };
            }

            // Gerar link do checkout usando custom_id do produto
            const baseUrl = process.env.FRONTEND_URL || 'https://ratixpay.com';
            const produtoId = produto.custom_id || produto.public_id || produto_id;
            const checkoutLink = `${baseUrl}/checkout.html?produto=${produtoId}`;

            // Preparar mensagem
            const mensagem = this.prepararMensagem(cliente_nome, produto_nome, checkoutLink);

            let emailEnviado = false;
            let whatsappEnviado = false;
            const metodosUsados = [];

            // Enviar por email (se disponível)
            if (email) {
                try {
                    await emailManagerService.enviarEmailOfertas('campanha_remarketing', {
                        email,
                        nome: cliente_nome,
                        produtoInteresse: produto_nome,
                        linkProduto: checkoutLink,
                        ofertaEspecial: 'Finalize agora com desconto especial!'
                    });
                    emailEnviado = true;
                    metodosUsados.push('email');
                    console.log(`✅ Email de remarketing enviado para ${email}`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar email de remarketing: ${error.message}`);
                    // Continuar mesmo se email falhar
                }
            }

            // Enviar por WhatsApp (se disponível)
            if (telefone) {
                try {
                    await whatsappService.enviarMensagem(telefone, mensagem);
                    whatsappEnviado = true;
                    metodosUsados.push('whatsapp');
                    console.log(`✅ WhatsApp de remarketing enviado para ${telefone}`);
                } catch (error) {
                    console.error(`❌ Erro ao enviar WhatsApp de remarketing: ${error.message}`);
                    // Continuar mesmo se WhatsApp falhar
                }
            }

            // Verificar se pelo menos um método foi usado
            if (emailEnviado || whatsappEnviado) {
                return { 
                    success: true, 
                    metodo: metodosUsados.join(' e '),
                    emailEnviado,
                    whatsappEnviado
                };
            }

            return { 
                success: false, 
                message: 'Nenhum método de contato disponível ou todos falharam (email ou telefone)' 
            };

        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Preparar mensagem de remarketing
     */
    prepararMensagem(nomeCliente, nomeProduto, linkCheckout) {
        return `Olá ${nomeCliente},

Vimos que você tentou comprar ${nomeProduto}, mas não concluiu.

👉 Finalize agora com desconto especial:

${linkCheckout}

A oferta é por tempo limitado!`;
    }

    /**
     * Marcar item como enviado
     */
    async marcarComoEnviado(queueId) {
        try {
            await sequelize.query(`
                UPDATE ${this.tableName}
                SET status = 'enviado',
                    data_envio = :agora,
                    updated_at = :agora
                WHERE id = :id
            `, {
                replacements: {
                    id: queueId,
                    agora: new Date().toISOString()
                },
                type: QueryTypes.UPDATE
            });
        } catch (error) {
            console.error(`❌ Erro ao marcar item ${queueId} como enviado:`, error);
            throw error;
        }
    }

    /**
     * Marcar item como ignorado
     */
    async marcarComoIgnorado(queueId, motivo) {
        try {
            await sequelize.query(`
                UPDATE ${this.tableName}
                SET status = 'ignorado',
                    updated_at = :agora
                WHERE id = :id
            `, {
                replacements: {
                    id: queueId,
                    agora: new Date().toISOString()
                },
                type: QueryTypes.UPDATE
            });
        } catch (error) {
            console.error(`❌ Erro ao marcar item ${queueId} como ignorado:`, error);
            throw error;
        }
    }

    /**
     * Obter estatísticas da fila
     */
    async obterEstatisticas() {
        try {
            const [stats] = await sequelize.query(`
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
                    COUNT(*) FILTER (WHERE status = 'enviado') as enviados,
                    COUNT(*) FILTER (WHERE status = 'ignorado') as ignorados,
                    COUNT(*) as total
                FROM ${this.tableName}
            `, {
                type: QueryTypes.SELECT
            });

            return stats || { pendentes: 0, enviados: 0, ignorados: 0, total: 0 };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            throw error;
        }
    }
}

module.exports = new RemarketingService();


