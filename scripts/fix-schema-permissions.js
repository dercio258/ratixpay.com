/**
 * Script para corrigir permissões do schema public no PostgreSQL
 * Resolve o erro "permission denied for schema public"
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ratixpay',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    dialect: 'postgres',
    logging: false
};

// Criar conexão Sequelize como superusuário
// IMPORTANTE: Este script deve ser executado com um usuário que tenha privilégios de superusuário
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: false
    }
);

async function fixPermissions() {
    try {
        console.log('🔧 Corrigindo permissões do schema public...\n');
        console.log(`📊 Conectando como: ${dbConfig.username}@${dbConfig.host}:${dbConfig.port}`);
        console.log(`📊 Banco: ${dbConfig.database}\n`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida!\n');

        // Obter o usuário do banco de dados (do .env)
        const dbUser = process.env.DB_USER || 'ratixpay';
        
        console.log(`🔐 Concedendo permissões ao usuário: ${dbUser}\n`);

        // SQL para corrigir permissões
        const fixPermissionsSQL = `
            -- Conceder uso do schema public
            GRANT USAGE ON SCHEMA public TO ${dbUser};

            -- Conceder criação no schema public
            GRANT CREATE ON SCHEMA public TO ${dbUser};

            -- Conceder todas as permissões em todas as tabelas existentes
            GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${dbUser};

            -- Conceder todas as permissões em todas as sequências existentes
            GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${dbUser};

            -- Conceder permissões padrão para objetos futuros
            ALTER DEFAULT PRIVILEGES IN SCHEMA public 
                GRANT ALL PRIVILEGES ON TABLES TO ${dbUser};

            ALTER DEFAULT PRIVILEGES IN SCHEMA public 
                GRANT ALL PRIVILEGES ON SEQUENCES TO ${dbUser};
        `;

        // Executar correções
        await sequelize.query(fixPermissionsSQL);
        
        console.log('✅ Permissões corrigidas com sucesso!\n');
        console.log('🚀 Agora você pode executar novamente:');
        console.log('   node scripts/migrate-database-columns.js\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao corrigir permissões:', error.message);
        console.error('\n💡 Este script precisa ser executado com um usuário PostgreSQL que tenha privilégios de superusuário.');
        console.error('\n📋 Alternativas:');
        console.error('   1. Execute como usuário postgres:');
        console.error('      sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql');
        console.error('\n   2. Ou conecte manualmente:');
        console.error('      sudo -u postgres psql -d ratixpay');
        console.error('      Depois execute os comandos GRANT do arquivo fix-schema-permissions.sql');
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    fixPermissions();
}

module.exports = { fixPermissions };

