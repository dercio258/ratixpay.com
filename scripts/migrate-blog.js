const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateBlog() {
    try {
        console.log('🔄 Iniciando migração do blog...');
        
        // Ler o arquivo SQL
        const sqlPath = path.join(__dirname, '..', 'migrations', 'migrate-blog-completo-vps.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Executar o SQL
        await sequelize.query(sql);
        
        console.log('✅ Migração do blog concluída com sucesso!');
        console.log('📊 Tabelas criadas:');
        console.log('   - blog_posts');
        console.log('   - blog_comments');
        console.log('   - blog_pages');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        process.exit(1);
    }
}

migrateBlog();


