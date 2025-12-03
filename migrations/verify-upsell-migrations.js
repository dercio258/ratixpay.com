/**
 * Script para verificar se as migrações foram aplicadas corretamente
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false
});

async function verifyMigrations() {
    try {
        console.log('🔍 Verificando colunas na tabela upsell_pages...\n');
        
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'upsell_pages' 
            AND column_name IN ('template_id', 'template_html')
            ORDER BY column_name
        `);
        
        if (results.length === 0) {
            console.log('❌ Nenhuma das colunas foi encontrada!');
            process.exit(1);
        }
        
        console.log('✅ Colunas encontradas na tabela upsell_pages:\n');
        results.forEach(col => {
            const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            console.log(`   ✓ ${col.column_name}: ${col.data_type}${length}`);
        });
        
        if (results.length === 2) {
            console.log('\n🎉 Todas as colunas foram criadas com sucesso!');
        } else {
            console.log(`\n⚠️  Apenas ${results.length} de 2 colunas foram encontradas.`);
        }
        
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao verificar migrações:', error.message);
        process.exit(1);
    }
}

verifyMigrations();

