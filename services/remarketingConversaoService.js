/**
 * Serviço de Detecção de Conversões de Remarketing
 * Detecta quando uma venda cancelada que recebeu remarketing é convertida em venda aprovada
 */

const { sequelize } = require('../config/database');
const { Venda } = require('../config/database');

class RemarketingConversaoService {
    constructor() {
        this.tableName = 'remarketing_conversoes';
        this.queueTableName = 'remarketing_queue';
    }

    /**
     * Detecta e registra conversão de remarketing quando uma venda é aprovada
     * @param {Object} vendaAprovada - Venda que foi aprovada
     * @returns {Promise<Object|null>} Conversão registrada ou null se não for conversão
     */
    async detectarConversao(vendaAprovada) {
        try {
            if (!vendaAprovada || !vendaAprovada.id) {
                return null;
            }

            // Buscar dados da venda aprovada
            const venda = await Venda.findByPk(vendaAprovada.id);
            if (!venda) {
                return null;
            }

            const produtoId = venda.produto_id;
            const clienteNome = venda.cliente_nome || '';
            const clienteEmail = venda.cliente_email || '';
            const clienteTelefone = venda.cliente_telefone || venda.cliente_whatsapp || '';
            const clienteId = venda.cliente_id;

            // Verificar se há remarketing enviado para este cliente/produto
            // Buscar na fila de remarketing por:
            // 1. Mesmo produto
            // 2. Mesmo cliente (ID, nome, email ou telefone)
            // 3. Status 'enviado' (remarketing já foi enviado)
            // 4. Data de envio anterior à aprovação

            // Normalizar telefone para comparação (remover caracteres especiais)
            const normalizarTelefone = (tel) => {
                if (!tel) return null;
                return tel.toString().replace(/[^\d+]/g, '');
            };

            const telefoneNormalizado = normalizarTelefone(clienteTelefone);

            let query = `
                SELECT rq.*, vc.id as venda_cancelada_id, vc.valor as valor_cancelado
                FROM ${this.queueTableName} rq
                LEFT JOIN vendas vc ON vc.id = rq.venda_cancelada_id
                WHERE rq.produto_id = :produtoId
                  AND rq.status = 'enviado'
                  AND (
                    (:clienteId IS NOT NULL AND rq.cliente_id = :clienteId)
                    OR (:clienteEmail IS NOT NULL AND :clienteEmail != '' AND LOWER(TRIM(rq.email)) = LOWER(TRIM(:clienteEmail)))
                    OR (:clienteTelefone IS NOT NULL AND :clienteTelefone != '' AND REPLACE(REPLACE(REPLACE(REPLACE(rq.telefone, ' ', ''), '-', ''), '(', ''), ')', '') = REPLACE(REPLACE(REPLACE(REPLACE(:clienteTelefone, ' ', ''), '-', ''), '(', ''), ')', ''))
                    OR (:clienteNome IS NOT NULL AND :clienteNome != '' AND LOWER(TRIM(rq.cliente_nome)) = LOWER(TRIM(:clienteNome)))
                  )
                  AND (rq.data_envio IS NOT NULL AND rq.data_envio <= :dataAprovacao OR rq.data_agendada <= :dataAprovacao)
                ORDER BY COALESCE(rq.data_envio, rq.data_agendada) DESC
                LIMIT 1
            `;

            const resultados = await sequelize.query(query, {
                replacements: {
                    produtoId,
                    clienteId: clienteId || null,
                    clienteEmail: clienteEmail || null,
                    clienteTelefone: clienteTelefone || null,
                    clienteNome: clienteNome || null,
                    dataAprovacao: venda.data_pagamento || venda.data_aprovacao || new Date()
                },
                type: sequelize.QueryTypes.SELECT
            });

            // sequelize.query retorna um array diretamente com SELECT
            if (!resultados || resultados.length === 0) {
                return null; // Não é uma conversão de remarketing
            }

            const itemRemarketing = resultados[0];
            
            // Verificar se itemRemarketing existe e tem id
            if (!itemRemarketing || !itemRemarketing.id) {
                console.log('ℹ️ Item de remarketing inválido ou sem ID');
                return null;
            }

            // Verificar se já existe uma conversão registrada para este item
            const conversaoExistente = await sequelize.query(
                `SELECT id FROM ${this.tableName} 
                 WHERE remarketing_queue_id = :queueId 
                   AND venda_aprovada_id = :vendaAprovadaId
                 LIMIT 1`,
                {
                    replacements: {
                        queueId: itemRemarketing.id,
                        vendaAprovadaId: venda.id
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (conversaoExistente && conversaoExistente.length > 0) {
                console.log(`ℹ️ Conversão já registrada para venda ${venda.id}`);
                return null; // Já registrado
            }

            // Calcular tempo até conversão
            const dataRemarketing = new Date(itemRemarketing.data_agendada);
            const dataAprovacao = new Date(venda.data_pagamento || venda.data_aprovacao || new Date());
            const tempoMinutos = Math.round((dataAprovacao - dataRemarketing) / (1000 * 60));

            // Registrar conversão
            const conversao = await sequelize.query(
                `INSERT INTO ${this.tableName} (
                    remarketing_queue_id,
                    venda_cancelada_id,
                    venda_aprovada_id,
                    cliente_id,
                    cliente_nome,
                    produto_id,
                    produto_nome,
                    email,
                    telefone,
                    data_cancelamento,
                    data_remarketing_enviado,
                    data_conversao,
                    valor_venda_cancelada,
                    valor_venda_aprovada,
                    tempo_ate_conversao_minutos
                ) VALUES (
                    :remarketingQueueId,
                    :vendaCanceladaId,
                    :vendaAprovadaId,
                    :clienteId,
                    :clienteNome,
                    :produtoId,
                    :produtoNome,
                    :email,
                    :telefone,
                    :dataCancelamento,
                    :dataRemarketingEnviado,
                    :dataConversao,
                    :valorCancelado,
                    :valorAprovado,
                    :tempoMinutos
                ) RETURNING *`,
                {
                    replacements: {
                        remarketingQueueId: itemRemarketing.id,
                        vendaCanceladaId: itemRemarketing.venda_cancelada_id || venda.id, // Fallback se não tiver
                        vendaAprovadaId: venda.id,
                        clienteId: clienteId || null,
                        clienteNome: clienteNome || itemRemarketing.cliente_nome,
                        produtoId: produtoId,
                        produtoNome: itemRemarketing.produto_nome,
                        email: clienteEmail || itemRemarketing.email || null,
                        telefone: clienteTelefone || itemRemarketing.telefone || null,
                        dataCancelamento: itemRemarketing.data_cancelamento,
                        dataRemarketingEnviado: itemRemarketing.data_agendada,
                        dataConversao: dataAprovacao,
                        valorCancelado: itemRemarketing.valor_cancelado || 0,
                        valorAprovado: venda.valor || 0,
                        tempoMinutos: tempoMinutos
                    },
                    type: sequelize.QueryTypes.INSERT
                }
            );

            console.log(`✅ Conversão de remarketing registrada: Venda ${venda.id} convertida após ${tempoMinutos} minutos`);

            return {
                success: true,
                conversao: conversao[0][0]
            };

        } catch (error) {
            console.error('❌ Erro ao detectar conversão de remarketing:', error);
            // Não falhar o processo de aprovação por erro na detecção de conversão
            return null;
        }
    }

    /**
     * Busca estatísticas de conversão de remarketing
     * @param {Object} filtros - Filtros para busca (produto_id, data_inicio, data_fim, vendedor_id)
     * @returns {Promise<Object>} Estatísticas de conversão
     */
    async buscarEstatisticas(filtros = {}) {
        try {
            const { produto_id, data_inicio, data_fim, vendedor_id } = filtros;

            let whereClause = '1=1';
            const replacements = {};

            if (produto_id) {
                whereClause += ' AND rc.produto_id = :produto_id';
                replacements.produto_id = produto_id;
            }

            if (data_inicio) {
                whereClause += ' AND rc.data_conversao >= :data_inicio';
                replacements.data_inicio = data_inicio;
            }

            if (data_fim) {
                whereClause += ' AND rc.data_conversao <= :data_fim';
                replacements.data_fim = data_fim;
            }

            if (vendedor_id) {
                whereClause += ' AND p.vendedor_id = :vendedor_id';
                replacements.vendedor_id = vendedor_id;
            }

            // Total de conversões
            const [totalConversoes] = await sequelize.query(
                `SELECT COUNT(*) as total
                 FROM ${this.tableName} rc
                 LEFT JOIN produtos p ON p.id = rc.produto_id
                 WHERE ${whereClause}`,
                {
                    replacements,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Total de remarketings enviados (para calcular taxa de conversão)
            let whereQueue = 'rq.status = \'enviado\'';
            if (produto_id) {
                whereQueue += ' AND rq.produto_id = :produto_id';
            }
            if (data_inicio) {
                whereQueue += ' AND rq.data_agendada >= :data_inicio';
            }
            if (data_fim) {
                whereQueue += ' AND rq.data_agendada <= :data_fim';
            }

            const [totalRemarketings] = await sequelize.query(
                `SELECT COUNT(*) as total
                 FROM ${this.queueTableName} rq
                 LEFT JOIN produtos p ON p.id = rq.produto_id
                 WHERE ${whereQueue}${vendedor_id ? ' AND p.vendedor_id = :vendedor_id' : ''}`,
                {
                    replacements,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Total de vendas canceladas (com remarketing ativo)
            let whereCanceladas = 'v.status = \'Cancelada\'';
            if (produto_id) {
                whereCanceladas += ' AND v.produto_id = :produto_id';
            }
            if (data_inicio) {
                whereCanceladas += ' AND v.created_at >= :data_inicio';
            }
            if (data_fim) {
                whereCanceladas += ' AND v.created_at <= :data_fim';
            }

            const [totalCanceladas] = await sequelize.query(
                `SELECT COUNT(*) as total
                 FROM vendas v
                 LEFT JOIN produtos p ON p.id = v.produto_id
                 WHERE ${whereCanceladas}${vendedor_id ? ' AND p.vendedor_id = :vendedor_id' : ''}
                   AND (p.remarketing_config->>'enabled')::boolean = true`,
                {
                    replacements,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Valor total convertido
            const [valorTotal] = await sequelize.query(
                `SELECT COALESCE(SUM(rc.valor_venda_aprovada), 0) as total
                 FROM ${this.tableName} rc
                 LEFT JOIN produtos p ON p.id = rc.produto_id
                 WHERE ${whereClause}`,
                {
                    replacements,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            // Taxa de conversão
            const totalEnviados = parseInt(totalRemarketings.total) || 0;
            const totalConvertidos = parseInt(totalConversoes.total) || 0;
            const taxaConversao = totalEnviados > 0 ? (totalConvertidos / totalEnviados) * 100 : 0;

            // Conversões por período (últimos 30 dias)
            const conversoesPorDia = await sequelize.query(
                `SELECT 
                    DATE(rc.data_conversao) as data,
                    COUNT(*) as total,
                    COALESCE(SUM(rc.valor_venda_aprovada), 0) as valor_total
                 FROM ${this.tableName} rc
                 LEFT JOIN produtos p ON p.id = rc.produto_id
                 WHERE ${whereClause}
                   AND rc.data_conversao >= CURRENT_DATE - INTERVAL '30 days'
                 GROUP BY DATE(rc.data_conversao)
                 ORDER BY data ASC`,
                {
                    replacements,
                    type: sequelize.QueryTypes.SELECT
                }
            );

            return {
                total_conversoes: totalConvertidos,
                total_remarketings_enviados: totalEnviados,
                total_vendas_canceladas: parseInt(totalCanceladas.total) || 0,
                valor_total_convertido: parseFloat(valorTotal.total) || 0,
                taxa_conversao: parseFloat(taxaConversao.toFixed(2)),
                conversoes_por_dia: conversoesPorDia
            };

        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas de conversão:', error);
            throw error;
        }
    }
}

module.exports = new RemarketingConversaoService();

