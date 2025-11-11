/**
 * Serviço de Notificações
 * Gerencia o envio e recebimento de notificações para vendedores
 */

const { Notificacao, Usuario } = require('../config/database');

class NotificationService {
    /**
     * Enviar notificação para um ou mais vendedores
     * @param {Object} notificationData - Dados da notificação
     * @param {string} notificationData.titulo - Título da notificação
     * @param {string} notificationData.mensagem - Mensagem da notificação
     * @param {string} notificationData.tipo - Tipo da notificação
     * @param {string} notificationData.prioridade - Prioridade da notificação
     * @param {Array} notificationData.vendedores_ids - IDs dos vendedores
     * @param {string} notificationData.url_redirecionamento - URL opcional
     * @returns {Promise<Object>} Resultado do envio
     */
    async enviarNotificacao(notificationData) {
        try {
            const { titulo, mensagem, tipo, prioridade, vendedores_ids, url_redirecionamento } = notificationData;

            // Validar dados
            if (!titulo || !mensagem || !tipo || !vendedores_ids || vendedores_ids.length === 0) {
                throw new Error('Dados obrigatórios não fornecidos');
            }

            // Verificar se os vendedores existem
            const vendedores = await Usuario.findAll({
                where: {
                    id: vendedores_ids,
                    role: 'vendedor',
                    ativo: true
                },
                attributes: ['id', 'nome_completo', 'email']
            });

            if (vendedores.length === 0) {
                throw new Error('Nenhum vendedor válido encontrado');
            }

            // Criar notificações para cada vendedor
            const notificacoes = [];
            for (const vendedor of vendedores) {
                const notificacao = await Notificacao.create({
                    vendedor_id: vendedor.id,
                    tipo: tipo,
                    titulo: titulo,
                    mensagem: mensagem,
                    prioridade: prioridade || 'media',
                    url_redirecionamento: url_redirecionamento,
                    status: 'unread',
                    enviada: true,
                    dados_extras: {
                        vendedor_nome: vendedor.nome_completo,
                        vendedor_email: vendedor.email
                    }
                });

                notificacoes.push(notificacao);

                // Atualizar contador de notificações do vendedor
                await Usuario.increment('notificacoes', {
                    where: { id: vendedor.id }
                });
            }

            return {
                success: true,
                enviadas: notificacoes.length,
                notificacoes: notificacoes.map(n => ({
                    id: n.id,
                    vendedor_id: n.vendedor_id,
                    titulo: n.titulo,
                    tipo: n.tipo,
                    prioridade: n.prioridade
                }))
            };

        } catch (error) {
            console.error('Erro ao enviar notificação:', error);
            throw error;
        }
    }

    /**
     * Buscar notificações de um vendedor
     * @param {string} vendedorId - ID do vendedor
     * @param {Object} options - Opções de busca
     * @returns {Promise<Array>} Lista de notificações
     */
    async buscarNotificacoesVendedor(vendedorId, options = {}) {
        try {
            const { limit = 50, offset = 0, status = null, tipo = null } = options;

            const whereClause = {
                vendedor_id: vendedorId
            };

            if (status) {
                whereClause.status = status;
            }

            if (tipo) {
                whereClause.tipo = tipo;
            }

            const notificacoes = await Notificacao.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: [
                    'id', 'tipo', 'titulo', 'mensagem', 'prioridade', 
                    'status', 'url_redirecionamento', 'created_at', 'data_leitura'
                ]
            });

            return notificacoes;

        } catch (error) {
            console.error('Erro ao buscar notificações do vendedor:', error);
            throw error;
        }
    }

    /**
     * Marcar notificação como lida
     * @param {string} notificacaoId - ID da notificação
     * @param {string} vendedorId - ID do vendedor
     * @returns {Promise<Object>} Resultado da operação
     */
    async marcarComoLida(notificacaoId, vendedorId) {
        try {
            const notificacao = await Notificacao.findOne({
                where: {
                    id: notificacaoId,
                    vendedor_id: vendedorId
                }
            });

            if (!notificacao) {
                throw new Error('Notificação não encontrada');
            }

            if (notificacao.status === 'read') {
                return { success: true, message: 'Notificação já estava marcada como lida' };
            }

            await notificacao.update({
                status: 'read',
                data_leitura: new Date()
            });

            // Decrementar contador de notificações do vendedor
            await Usuario.decrement('notificacoes', {
                where: { id: vendedorId }
            });

            return { success: true, message: 'Notificação marcada como lida' };

        } catch (error) {
            console.error('Erro ao marcar notificação como lida:', error);
            throw error;
        }
    }

    /**
     * Marcar todas as notificações como lidas
     * @param {string} vendedorId - ID do vendedor
     * @returns {Promise<Object>} Resultado da operação
     */
    async marcarTodasComoLidas(vendedorId) {
        try {
            const result = await Notificacao.update(
                {
                    status: 'read',
                    data_leitura: new Date()
                },
                {
                    where: {
                        vendedor_id: vendedorId,
                        status: 'unread'
                    }
                }
            );

            // Zerar contador de notificações do vendedor
            await Usuario.update(
                { notificacoes: 0 },
                { where: { id: vendedorId } }
            );

            return {
                success: true,
                atualizadas: result[0],
                message: `${result[0]} notificações marcadas como lidas`
            };

        } catch (error) {
            console.error('Erro ao marcar todas as notificações como lidas:', error);
            throw error;
        }
    }

    /**
     * Buscar histórico de notificações para admin
     * @param {Object} options - Opções de busca
     * @returns {Promise<Array>} Lista de notificações com detalhes
     */
    async buscarHistoricoAdmin(options = {}) {
        try {
            const { limit = 100, offset = 0, tipo = null, prioridade = null } = options;

            const whereClause = {};
            if (tipo) {
                whereClause.tipo = tipo;
            }
            if (prioridade) {
                whereClause.prioridade = prioridade;
            }

            // Buscar notificações agrupadas por título e data
            const notificacoes = await Notificacao.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset),
                attributes: [
                    'id', 'tipo', 'titulo', 'mensagem', 'prioridade', 
                    'status', 'created_at', 'dados_extras'
                ],
                include: [
                    {
                        model: Usuario,
                        as: 'vendedor',
                        attributes: ['id', 'nome_completo', 'email']
                    }
                ]
            });

            // Agrupar notificações por título e data
            const notificacoesAgrupadas = {};
            notificacoes.forEach(notif => {
                const key = `${notif.titulo}_${notif.created_at.toDateString()}`;
                if (!notificacoesAgrupadas[key]) {
                    notificacoesAgrupadas[key] = {
                        id: notif.id,
                        titulo: notif.titulo,
                        mensagem: notif.mensagem,
                        tipo: notif.tipo,
                        prioridade: notif.prioridade,
                        created_at: notif.created_at,
                        destinatario_count: 0,
                        destinatarios: []
                    };
                }
                notificacoesAgrupadas[key].destinatario_count++;
                if (notif.vendedor) {
                    notificacoesAgrupadas[key].destinatarios.push({
                        id: notif.vendedor.id,
                        nome: notif.vendedor.nome_completo,
                        email: notif.vendedor.email
                    });
                }
            });

            return Object.values(notificacoesAgrupadas);

        } catch (error) {
            console.error('Erro ao buscar histórico de notificações:', error);
            throw error;
        }
    }

    /**
     * Buscar estatísticas de notificações
     * @returns {Promise<Object>} Estatísticas das notificações
     */
    async buscarEstatisticas() {
        try {
            const total = await Notificacao.count();
            const naoLidas = await Notificacao.count({ where: { status: 'unread' } });
            const lidas = await Notificacao.count({ where: { status: 'read' } });

            const porTipo = await Notificacao.findAll({
                attributes: [
                    'tipo',
                    [Notificacao.sequelize.fn('COUNT', Notificacao.sequelize.col('id')), 'count']
                ],
                group: ['tipo'],
                raw: true
            });

            const porPrioridade = await Notificacao.findAll({
                attributes: [
                    'prioridade',
                    [Notificacao.sequelize.fn('COUNT', Notificacao.sequelize.col('id')), 'count']
                ],
                group: ['prioridade'],
                raw: true
            });

            return {
                total,
                naoLidas,
                lidas,
                porTipo: porTipo.reduce((acc, item) => {
                    acc[item.tipo] = parseInt(item.count);
                    return acc;
                }, {}),
                porPrioridade: porPrioridade.reduce((acc, item) => {
                    acc[item.prioridade] = parseInt(item.count);
                    return acc;
                }, {})
            };

        } catch (error) {
            console.error('Erro ao buscar estatísticas de notificações:', error);
            throw error;
        }
    }

    /**
     * Deletar notificação
     * @param {string} notificacaoId - ID da notificação
     * @param {string} vendedorId - ID do vendedor (opcional para admin)
     * @returns {Promise<Object>} Resultado da operação
     */
    async deletarNotificacao(notificacaoId, vendedorId = null) {
        try {
            const whereClause = { id: notificacaoId };
            if (vendedorId) {
                whereClause.vendedor_id = vendedorId;
            }

            const notificacao = await Notificacao.findOne({ where: whereClause });
            if (!notificacao) {
                throw new Error('Notificação não encontrada');
            }

            await notificacao.destroy();

            // Se a notificação não estava lida, decrementar contador
            if (notificacao.status === 'unread' && vendedorId) {
                await Usuario.decrement('notificacoes', {
                    where: { id: vendedorId }
                });
            }

            return { success: true, message: 'Notificação deletada com sucesso' };

        } catch (error) {
            console.error('Erro ao deletar notificação:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService();