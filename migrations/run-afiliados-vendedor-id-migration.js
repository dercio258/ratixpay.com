const fs = require('fs');
const path = require('path');
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
    logging: console.log
});

async function runMigration() {
    try {
        console.log('🔄 Iniciando migração: Adicionar vendedor_id à tabela afiliados...');
        
        const sqlPath = path.join(__dirname, 'add-vendedor-id-to-afiliados.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await sequelize.query(sql);
        
        console.log('✅ Migração executada com sucesso!');
        
        // Verificar se a coluna foi criada
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'afiliados' 
            AND column_name = 'vendedor_id';
        `);
        
        if (results.length > 0) {
            console.log('✅ Coluna vendedor_id verificada:', results[0]);
        } else {
            console.log('⚠️  Coluna vendedor_id não encontrada após migração');
        }
        
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        // Se a coluna já existe, considerar como sucesso
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('já existe') ||
            error.message.includes('already exists') ||
            error.message.includes('coluna') && error.message.includes('já existe')) {
            console.log('⚠️  Coluna vendedor_id já existe, migração não necessária');
            await sequelize.close();
            process.exit(0);
        }
        
        console.error('❌ Erro ao executar migração:', error.message);
        console.error('Stack:', error.stack);
        await sequelize.close();
        process.exit(1);
    }
}

runMigration();

