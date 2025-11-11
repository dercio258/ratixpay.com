/**
 * Modelo WhatsappMessage
 * Responsável por operações relacionadas às mensagens de WhatsApp no banco de dados
 */

const db = require('../config/database');

class WhatsappMessage {
    constructor(data = {}) {
        this.id = data.id;
        this.vendaId = data.venda_id;
        this.messageType = data.message_type;
        this.messageContent = data.message_content;
        this.sentAt = data.sent_at;
    }

    /**
     * Cria a tabela de mensagens WhatsApp se não existir
     */
    static async createTableIfNotExists() {
        const pool = db.getPool();
        try {
            // Verificar se a tabela existe
            const checkTable = `
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'whatsapp_messages'
                );
            `;
            const tableExists = await pool.query(checkTable);
            
            // Criar tabela se não existir
            if (!tableExists.rows[0].exists) {
                const createTable = `
                    CREATE TABLE whatsapp_messages (
                        id SERIAL PRIMARY KEY,
                        venda_id INTEGER REFERENCES vendas(id),
                        message_type VARCHAR(50) NOT NULL,
                        message_content TEXT,
                        sent_at TIMESTAMP DEFAULT NOW()
                    );
                `;
                await pool.query(createTable);
                console.log('✅ Tabela whatsapp_messages criada com sucesso');
            }
            return true;
        } catch (error) {
            console.error('❌ Erro ao verificar/criar tabela whatsapp_messages:', error);
            return false;
        }
    }

    /**
     * Registra uma mensagem enviada
     * @param {Object} messageData - Dados da mensagem
     * @returns {Promise<WhatsappMessage>} - Mensagem registrada
     */
    static async create(messageData) {
        const pool = db.getPool();
        try {
            // Garantir que a tabela existe
            await this.createTableIfNotExists();
            
            const query = `
                INSERT INTO whatsapp_messages (venda_id, message_type, message_content)
                VALUES ($1, $2, $3)
                RETURNING *
            `;
            
            const values = [
                messageData.vendaId,
                messageData.messageType,
                messageData.messageContent
            ];
            
            const result = await pool.query(query, values);
            return new WhatsappMessage(result.rows[0]);
        } catch (error) {
            console.error('❌ Erro ao registrar mensagem WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Busca mensagens por ID da venda
     * @param {number} vendaId - ID da venda
     * @returns {Promise<Array<WhatsappMessage>>} - Lista de mensagens
     */
    static async findByVendaId(vendaId) {
        const pool = db.getPool();
        try {
            const query = `
                SELECT * FROM whatsapp_messages
                WHERE venda_id = $1
                ORDER BY sent_at DESC
            `;
            
            const result = await pool.query(query, [vendaId]);
            return result.rows.map(row => new WhatsappMessage(row));
        } catch (error) {
            console.error('❌ Erro ao buscar mensagens WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Busca mensagens por tipo
     * @param {string} messageType - Tipo da mensagem
     * @param {Object} options - Opções de filtro
     * @returns {Promise<Array<WhatsappMessage>>} - Lista de mensagens
     */
    static async findByType(messageType, options = {}) {
        const pool = db.getPool();
        try {
            let query = `
                SELECT wm.*, v.cliente_nome, v.cliente_email, v.cliente_telefone, v.pagamento_transacao_id
                FROM whatsapp_messages wm
                JOIN vendas v ON wm.venda_id = v.id
                WHERE wm.message_type = $1
            `;
            
            const params = [messageType];
            let paramIndex = 2;
            
            // Adicionar filtros adicionais
            if (options.startDate) {
                query += ` AND wm.sent_at >= $${paramIndex}`;
                params.push(options.startDate);
                paramIndex++;
            }
            
            if (options.endDate) {
                query += ` AND wm.sent_at <= $${paramIndex}`;
                params.push(options.endDate);
                paramIndex++;
            }
            
            // Ordenação e limite
            query += ` ORDER BY wm.sent_at DESC`;
            
            if (options.limit) {
                query += ` LIMIT $${paramIndex}`;
                params.push(options.limit);
                paramIndex++;
            }
            
            if (options.offset) {
                query += ` OFFSET $${paramIndex}`;
                params.push(options.offset);
            }
            
            const result = await pool.query(query, params);
            return result.rows.map(row => {
                const message = new WhatsappMessage(row);
                message.clienteNome = row.cliente_nome;
                message.clienteEmail = row.cliente_email;
                message.clienteTelefone = row.cliente_telefone;
                message.transacaoId = row.pagamento_transacao_id;
                return message;
            });
        } catch (error) {
            console.error('❌ Erro ao buscar mensagens por tipo:', error);
            throw error;
        }
    }

    /**
     * Obtém estatísticas de mensagens enviadas
     * @param {Object} options - Opções de filtro
     * @returns {Promise<Object>} - Estatísticas
     */
    static async getStats(options = {}) {
        const pool = db.getPool();
        try {
            let query = `
                SELECT 
                    message_type, 
                    COUNT(*) as total,
                    MIN(sent_at) as first_sent,
                    MAX(sent_at) as last_sent
                FROM whatsapp_messages
            `;
            
            const params = [];
            let paramIndex = 1;
            
            // Adicionar filtros
            const conditions = [];
            
            if (options.messageType) {
                conditions.push(`message_type = $${paramIndex}`);
                params.push(options.messageType);
                paramIndex++;
            }
            
            if (options.startDate) {
                conditions.push(`sent_at >= $${paramIndex}`);
                params.push(options.startDate);
                paramIndex++;
            }
            
            if (options.endDate) {
                conditions.push(`sent_at <= $${paramIndex}`);
                params.push(options.endDate);
                paramIndex++;
            }
            
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            
            query += ' GROUP BY message_type ORDER BY total DESC';
            
            const result = await pool.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de mensagens:', error);
            throw error;
        }
    }
}

module.exports = WhatsappMessage;