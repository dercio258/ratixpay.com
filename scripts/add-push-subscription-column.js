/**
 * Script para adicionar a coluna push_subscription à tabela usuarios
 * Execute: node scripts/add-push-subscription-column.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: console.log
});

async function addPushSubscriptionColumn() {
    try {
        console.log('🔄 Conectando ao banco de dados...');
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida com sucesso');

        // Verificar se a coluna já existe
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'push_subscription'
        `);

        if (results.length > 0) {
            console.log('ℹ️  A coluna push_subscription já existe na tabela usuarios');
            return;
        }

        // Adicionar a coluna
        console.log('📝 Adicionando coluna push_subscription...');
        await sequelize.query(`
            ALTER TABLE usuarios 
            ADD COLUMN push_subscription TEXT
        `);

        console.log('✅ Coluna push_subscription adicionada com sucesso!');
        console.log('📋 A coluna foi criada como TEXT para armazenar JSON das subscriptions');

    } catch (error) {
        console.error('❌ Erro ao adicionar coluna:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('🔌 Conexão fechada');
    }
}

// Executar
addPushSubscriptionColumn();

