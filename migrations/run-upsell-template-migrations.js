/**
 * Script para executar migrações de templates de upsell
 * Execute: node migrations/run-upsell-template-migrations.js
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || process.env.DB_NAME || 'ratixpay';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false // Desabilitar logs SQL detalhados
});

async function runMigration(sqlFile, migrationName) {
    try {
        console.log(`\n🔄 Executando migração: ${migrationName}...`);
        
        const sqlPath = path.join(__dirname, sqlFile);
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        await sequelize.query(sql);
        
        console.log(`✅ Migração ${migrationName} executada com sucesso!`);
        return true;
    } catch (error) {
        // Se a coluna já existe, considerar como sucesso
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('já existe') ||
            error.message.includes('already exists')) {
            console.log(`⚠️  ${migrationName}: Coluna já existe, pulando...`);
            return true;
        }
        
        console.error(`❌ Erro ao executar migração ${migrationName}:`, error.message);
        return false;
    }
}

async function runAllMigrations() {
    try {
        console.log('🚀 Iniciando migrações de templates de upsell...\n');
        console.log(`📊 Conectando ao banco: ${dbName}@${dbHost}:${dbPort}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Executar migrações
        const migrations = [
            {
                file: 'add-template-id-to-upsell-pages.sql',
                name: 'Adicionar template_id à tabela upsell_pages'
            },
            {
                file: 'add-template-html-to-upsell-pages.sql',
                name: 'Adicionar template_html à tabela upsell_pages'
            }
        ];

        let successCount = 0;
        let failCount = 0;

        for (const migration of migrations) {
            const success = await runMigration(migration.file, migration.name);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log('\n📊 Resumo das migrações:');
        console.log(`   ✅ Sucesso: ${successCount}`);
        console.log(`   ❌ Falhas: ${failCount}`);
        console.log(`   📦 Total: ${migrations.length}`);

        if (failCount === 0) {
            console.log('\n🎉 Todas as migrações foram executadas com sucesso!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Algumas migrações falharam. Verifique os erros acima.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Erro fatal ao executar migrações:', error.message);
        console.error('\n📋 Verifique:');
        console.error('   1. Credenciais do banco no arquivo .env');
        console.error('   2. Conexão com o banco de dados');
        console.error('   3. Permissões do usuário do banco');
        console.error('\n💡 Variáveis necessárias no .env:');
        console.error('   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS (ou DB_PASSWORD)');
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runAllMigrations();
}

module.exports = { runAllMigrations };

