const { v4: uuidv4 } = require('uuid');
const { databaseManager } = require('../config/database');

class UUIDUtils {
    /**
     * Gerar UUID v4
     * @returns {string} UUID v4
     */
    static generateUUID() {
        return uuidv4();
    }

    /**
     * Gerar public_id único de 6 dígitos
     * @param {string} tableName - Nome da tabela
     * @param {number} maxAttempts - Máximo de tentativas (padrão: 5)
     * @returns {Promise<string>} Public ID único
     */
    static async generatePublicId(tableName, maxAttempts = 5) {
        const sequelize = databaseManager.getPool();
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Gerar número aleatório de 6 dígitos (000000 a 999999)
                const publicId = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
                
                // Verificar se já existe usando query direta
                const checkQuery = `SELECT COUNT(*) as count FROM ${tableName} WHERE public_id = '${publicId}'`;
                const result = await sequelize.query(checkQuery, {
                    type: sequelize.QueryTypes.SELECT
                });
                
                if (parseInt(result[0].count) === 0) {
                    return publicId;
                }
                
                console.log(`Tentativa ${attempt}: Public ID ${publicId} já existe, tentando novamente...`);
            } catch (error) {
                console.error(`Erro na tentativa ${attempt} de gerar public_id:`, error);
                if (attempt === maxAttempts) {
                    throw new Error(`Falha ao gerar public_id único após ${maxAttempts} tentativas`);
                }
            }
        }
        
        throw new Error(`Não foi possível gerar public_id único após ${maxAttempts} tentativas`);
    }

    /**
     * Verificar se public_id existe
     * @param {string} tableName - Nome da tabela
     * @param {string} publicId - Public ID para verificar
     * @returns {Promise<boolean>} True se existe, false caso contrário
     */
    static async publicIdExists(tableName, publicId) {
        const sequelize = databaseManager.getPool();
        const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE public_id = '${publicId}'`;
        const result = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
        });
        return parseInt(result[0].count) > 0;
    }

    /**
     * Buscar registro por public_id
     * @param {string} tableName - Nome da tabela
     * @param {string} publicId - Public ID
     * @returns {Promise<Object|null>} Registro encontrado ou null
     */
    static async findByPublicId(tableName, publicId) {
        const sequelize = databaseManager.getPool();
        const query = `SELECT * FROM ${tableName} WHERE public_id = '${publicId}'`;
        const result = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
        });
        return result[0] || null;
    }

    /**
     * Converter UUID para formato mais legível (opcional)
     * @param {string} uuid - UUID para formatar
     * @returns {string} UUID formatado
     */
    static formatUUID(uuid) {
        return uuid.replace(/-/g, '').toUpperCase();
    }

    /**
     * Validar se string é UUID válido
     * @param {string} uuid - String para validar
     * @returns {boolean} True se é UUID válido
     */
    static isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    /**
     * Validar se string é public_id válido (6 dígitos)
     * @param {string} publicId - String para validar
     * @returns {boolean} True se é public_id válido
     */
    static isValidPublicId(publicId) {
        const publicIdRegex = /^\d{6}$/;
        return publicIdRegex.test(publicId);
    }
}

module.exports = UUIDUtils;
