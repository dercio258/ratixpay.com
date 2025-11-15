/**
 * Script de migração para criar tabela de fila de remarketing
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

async function createRemarketingQueueTable() {
    try {
        console.log('🔄 Criando tabela remarketing_queue...');
        
        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, '..', 'migrations', 'create-remarketing-queue.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Executar SQL
        await sequelize.query(sql, { type: QueryTypes.RAW });
        
        console.log('✅ Tabela remarketing_queue criada com sucesso');
        
        // Verificar se foi criada
        const [results] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'remarketing_queue'
            );
        `, { type: QueryTypes.SELECT });
        
        if (results.exists) {
            console.log('✅ Verificação: Tabela existe no banco de dados');
        } else {
            console.log('⚠️ Aviso: Tabela pode não ter sido criada');
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar tabela remarketing_queue:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    createRemarketingQueueTable()
        .then(() => {
            console.log('✅ Migração concluída');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro na migração:', error);
            process.exit(1);
        });
}

module.exports = { createRemarketingQueueTable };

