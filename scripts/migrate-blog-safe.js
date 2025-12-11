/**
 * Script de Migração Segura do Blog
 * 
 * Este script executa a migração do banco de dados do blog de forma segura,
 * verificando se as tabelas existem antes de criar e tratando erros.
 * 
 * Uso:
 *   node scripts/migrate-blog-safe.js
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuração do banco de dados
const sequelize = new Sequelize(
    process.env.DB_NAME || 'ratixpay',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false, // Desabilitar logs do Sequelize
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

async function migrateBlog() {
    console.log('🚀 Iniciando migração do banco de dados do blog...\n');
    
    try {
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida\n');
        
        // Ler arquivo SQL de migração
        const migrationFile = path.join(__dirname, '..', 'migrations', 'migrate-blog-completo-seguro.sql');
        
        if (!fs.existsSync(migrationFile)) {
            throw new Error(`Arquivo de migração não encontrado: ${migrationFile}`);
        }
        
        const sql = fs.readFileSync(migrationFile, 'utf8');
        
        // Executar migração
        console.log('📝 Executando migração SQL...\n');
        await sequelize.query(sql);
        
        // Verificar se as tabelas foram criadas
        console.log('\n🔍 Verificando tabelas criadas...\n');
        
        const tables = ['blog_posts', 'blog_comments', 'blog_pages', 'blog_newsletter'];
        
        for (const table of tables) {
            const [results] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '${table}'
                );
            `);
            
            if (results[0].exists) {
                console.log(`✅ Tabela ${table}: OK`);
            } else {
                console.log(`⚠️  Tabela ${table}: NÃO ENCONTRADA`);
            }
        }
        
        console.log('\n========================================');
        console.log('✅ Migração concluída com sucesso!');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n❌ Erro durante a migração:');
        console.error(error.message);
        
        if (error.original) {
            console.error('\nDetalhes do erro:');
            console.error(error.original);
        }
        
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar migração
if (require.main === module) {
    migrateBlog()
        .then(() => {
            console.log('✅ Script finalizado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { migrateBlog };




