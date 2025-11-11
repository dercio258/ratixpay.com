/**
 * Script de Migração do Banco de Dados - VPS
 * Execute: node scripts/migrate-database-vps.js
 * 
 * Este script atualiza as tabelas e colunas do banco de dados na VPS
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Configuração do banco de dados
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: false
        } : false
    }
});

async function migrateDatabase() {
    try {
        console.log('🔄 Conectando ao banco de dados...');
        console.log(`📊 Host: ${dbHost}`);
        console.log(`📊 Port: ${dbPort}`);
        console.log(`📊 Database: ${dbName}`);
        console.log(`📊 User: ${dbUser}`);
        
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida com sucesso\n');

        // 1. Adicionar coluna push_subscription na tabela usuarios
        console.log('📝 Verificando coluna push_subscription na tabela usuarios...');
        const [pushSubResults] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'push_subscription'
        `);

        if (pushSubResults.length === 0) {
            console.log('   ➕ Adicionando coluna push_subscription...');
            await sequelize.query(`
                ALTER TABLE usuarios 
                ADD COLUMN push_subscription TEXT
            `);
            await sequelize.query(`
                COMMENT ON COLUMN usuarios.push_subscription IS 'Subscription JSON para push notifications (Web Push API)'
            `);
            console.log('   ✅ Coluna push_subscription adicionada com sucesso');
        } else {
            console.log('   ℹ️  Coluna push_subscription já existe');
        }

        // 2. Adicionar coluna cliente_whatsapp na tabela vendas
        console.log('\n📝 Verificando coluna cliente_whatsapp na tabela vendas...');
        const [whatsappResults] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            AND column_name = 'cliente_whatsapp'
        `);

        if (whatsappResults.length === 0) {
            console.log('   ➕ Adicionando coluna cliente_whatsapp...');
            await sequelize.query(`
                ALTER TABLE vendas 
                ADD COLUMN cliente_whatsapp VARCHAR(20)
            `);
            await sequelize.query(`
                COMMENT ON COLUMN vendas.cliente_whatsapp IS 'Número de WhatsApp do cliente'
            `);
            console.log('   ✅ Coluna cliente_whatsapp adicionada com sucesso');
        } else {
            console.log('   ℹ️  Coluna cliente_whatsapp já existe');
        }

        // 3. Adicionar coluna afiliado_ref na tabela vendas
        console.log('\n📝 Verificando coluna afiliado_ref na tabela vendas...');
        const [afiliadoRefResults] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            AND column_name = 'afiliado_ref'
        `);

        if (afiliadoRefResults.length === 0) {
            console.log('   ➕ Adicionando coluna afiliado_ref...');
            await sequelize.query(`
                ALTER TABLE vendas 
                ADD COLUMN afiliado_ref VARCHAR(20)
            `);
            await sequelize.query(`
                COMMENT ON COLUMN vendas.afiliado_ref IS 'Código do afiliado que gerou a venda'
            `);
            console.log('   ✅ Coluna afiliado_ref adicionada com sucesso');
        } else {
            console.log('   ℹ️  Coluna afiliado_ref já existe');
        }

        // 4. Criar índice para afiliado_ref (se não existir)
        console.log('\n📝 Verificando índice idx_vendas_afiliado_ref...');
        const [indexResults] = await sequelize.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'vendas' 
            AND indexname = 'idx_vendas_afiliado_ref'
        `);

        if (indexResults.length === 0) {
            console.log('   ➕ Criando índice idx_vendas_afiliado_ref...');
            await sequelize.query(`
                CREATE INDEX idx_vendas_afiliado_ref ON vendas(afiliado_ref)
            `);
            console.log('   ✅ Índice criado com sucesso');
        } else {
            console.log('   ℹ️  Índice já existe');
        }

        // 5. Verificar estrutura das tabelas principais
        console.log('\n📊 Verificando estrutura das tabelas principais...');
        const tables = ['usuarios', 'vendas', 'afiliados', 'venda_afiliados'];
        
        for (const table of tables) {
            const [tableResults] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = '${table}'
            `);
            
            if (tableResults.length > 0) {
                console.log(`   ✅ Tabela ${table} existe`);
            } else {
                console.log(`   ⚠️  Tabela ${table} não encontrada`);
            }
        }

        console.log('\n✅ Migração concluída com sucesso!');
        console.log('\n📋 Resumo das alterações:');
        console.log('   - Coluna push_subscription na tabela usuarios');
        console.log('   - Coluna cliente_whatsapp na tabela vendas');
        console.log('   - Coluna afiliado_ref na tabela vendas');
        console.log('   - Índice idx_vendas_afiliado_ref para melhor performance');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        console.error('   Detalhes:', error.message);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Conexão fechada');
    }
}

// Executar migração
if (require.main === module) {
    migrateDatabase();
}

module.exports = { migrateDatabase };

