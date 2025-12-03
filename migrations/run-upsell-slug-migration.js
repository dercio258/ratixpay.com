/**
 * Script para executar migração de slug, nome e atributos nas páginas de upsell
 * Execute: node migrations/run-upsell-slug-migration.js
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false
});

async function runMigration() {
    try {
        console.log('🚀 Iniciando migração: Adicionar slug, nome e atributos às páginas de upsell\n');
        console.log(`📊 Conectando ao banco: ${dbName}@${dbHost}:${dbPort}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, 'add-slug-nome-atributos-to-upsell-pages.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🔄 Executando migração...\n');

        // Executar migração
        await sequelize.query(sql);

        console.log('✅ Migração executada com sucesso!\n');

        // Verificar colunas
        console.log('🔍 Verificando colunas adicionadas...\n');
        
        const [columns] = await sequelize.query(`
            SELECT column_name, data_type, character_maximum_length, column_default
            FROM information_schema.columns 
            WHERE table_name = 'upsell_pages' 
            AND column_name IN ('slug', 'nome', 'atributos', 'template_id', 'template_html')
            ORDER BY column_name
        `);

        console.log('📋 Colunas na tabela upsell_pages:\n');
        columns.forEach(col => {
            const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            console.log(`   ✓ ${col.column_name}: ${col.data_type}${length}${defaultVal}`);
        });

        // Verificar índices
        const [indexes] = await sequelize.query(`
            SELECT indexname, indexdef
            FROM pg_indexes 
            WHERE tablename = 'upsell_pages'
            AND indexname LIKE '%slug%'
        `);

        if (indexes.length > 0) {
            console.log('\n📑 Índices de slug criados:\n');
            indexes.forEach(idx => {
                console.log(`   ✓ ${idx.indexname}`);
            });
        }

        // Verificar páginas atualizadas
        const [pages] = await sequelize.query(`
            SELECT COUNT(*) as total, 
                   COUNT(slug) as com_slug,
                   COUNT(nome) as com_nome
            FROM upsell_pages
        `);

        if (pages[0]) {
            console.log('\n📊 Estatísticas das páginas:\n');
            console.log(`   📄 Total de páginas: ${pages[0].total}`);
            console.log(`   🔗 Com slug: ${pages[0].com_slug}`);
            console.log(`   📝 Com nome: ${pages[0].com_nome}`);
        }

        console.log('\n🎉 Migração concluída com sucesso!\n');

        await sequelize.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao executar migração:', error.message);
        
        if (error.message.includes('already exists')) {
            console.log('\n⚠️  Algumas colunas/índices já existiam. Isso é normal em re-execuções.');
            process.exit(0);
        }
        
        process.exit(1);
    }
}

runMigration();

