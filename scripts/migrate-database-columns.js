/**
 * Script de Migração Automática de Colunas do Banco de Dados
 * Conecta usando credenciais do .env e atualiza colunas necessárias
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuração do banco de dados a partir do .env
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ratixpay',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
};

// Criar conexão Sequelize
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging
    }
);

// Migrações necessárias
const migrations = [
    {
        name: 'add_cliente_whatsapp_to_vendas',
        sql: `
            -- Adicionar coluna cliente_whatsapp na tabela vendas se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'cliente_whatsapp'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN cliente_whatsapp VARCHAR(255);
                    RAISE NOTICE 'Coluna cliente_whatsapp adicionada à tabela vendas';
                ELSE
                    RAISE NOTICE 'Coluna cliente_whatsapp já existe na tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_carteira_fields',
        sql: `
            -- Adicionar campos de carteira se não existirem
            DO $$ 
            BEGIN
                -- Verificar se tabela carteiras existe
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras') THEN
                    -- Adicionar coluna tipo_carteira se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'tipo_carteira'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN tipo_carteira VARCHAR(50) DEFAULT 'mpesa';
                        RAISE NOTICE 'Coluna tipo_carteira adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna status se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'status'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN status VARCHAR(20) DEFAULT 'ativo';
                        RAISE NOTICE 'Coluna status adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna created_at se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'created_at'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                        RAISE NOTICE 'Coluna created_at adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna updated_at se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'updated_at'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                        RAISE NOTICE 'Coluna updated_at adicionada à tabela carteiras';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela carteiras não existe, pulando migração';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_tracking_data_to_vendas',
        sql: `
            -- Adicionar coluna tracking_data (JSONB) se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'tracking_data'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN tracking_data JSONB;
                    RAISE NOTICE 'Coluna tracking_data adicionada à tabela vendas';
                ELSE
                    RAISE NOTICE 'Coluna tracking_data já existe na tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_timestamps_to_vendas',
        sql: `
            -- Adicionar timestamps se não existirem
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'created_at'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    RAISE NOTICE 'Coluna created_at adicionada à tabela vendas';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'updated_at'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    RAISE NOTICE 'Coluna updated_at adicionada à tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_email_verification_to_afiliados',
        sql: `
            -- Adicionar campos de verificação de email na tabela afiliados
            DO $$ 
            BEGIN
                -- Verificar se tabela afiliados existe
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'afiliados') THEN
                    -- Adicionar coluna email_verificado se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'email_verificado'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN email_verificado BOOLEAN DEFAULT false NOT NULL;
                        RAISE NOTICE 'Coluna email_verificado adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna email_verificado já existe na tabela afiliados';
                    END IF;

                    -- Adicionar coluna codigo_verificacao se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'codigo_verificacao'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN codigo_verificacao VARCHAR(10);
                        RAISE NOTICE 'Coluna codigo_verificacao adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna codigo_verificacao já existe na tabela afiliados';
                    END IF;

                    -- Adicionar coluna codigo_verificacao_expira se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'codigo_verificacao_expira'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN codigo_verificacao_expira TIMESTAMP;
                        RAISE NOTICE 'Coluna codigo_verificacao_expira adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna codigo_verificacao_expira já existe na tabela afiliados';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela afiliados não existe, pulando migração';
                END IF;
            END $$;
        `
    }
];

// Tabela para rastrear migrações executadas
async function createMigrationsTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    await sequelize.query(createTableSQL);
    console.log('✅ Tabela de migrações verificada/criada');
}

// Verificar se migração já foi executada
async function isMigrationExecuted(migrationName) {
    try {
        const [results] = await sequelize.query(
            `SELECT COUNT(*)::int as count FROM schema_migrations WHERE migration_name = :name`,
            {
                replacements: { name: migrationName },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        
        return results && results.count > 0;
    } catch (error) {
        // Se a tabela não existe ainda, retornar false
        return false;
    }
}

// Registrar migração como executada
async function markMigrationAsExecuted(migrationName) {
    await sequelize.query(
        `INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT (migration_name) DO NOTHING`,
        {
            replacements: { name: migrationName }
        }
    );
}

// Executar migração
async function runMigration(migration) {
    try {
        console.log(`\n🔄 Executando migração: ${migration.name}...`);
        
        // Verificar se já foi executada
        const executed = await isMigrationExecuted(migration.name);
        if (executed) {
            console.log(`⏭️  Migração ${migration.name} já foi executada anteriormente`);
            return true;
        }

        // Executar SQL da migração
        await sequelize.query(migration.sql);
        
        // Registrar como executada
        await markMigrationAsExecuted(migration.name);
        
        console.log(`✅ Migração ${migration.name} executada com sucesso!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao executar migração ${migration.name}:`, error.message);
        
        // Se for erro de coluna já existe, considerar como sucesso
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('já existe')) {
            console.log(`⚠️  Coluna já existe, marcando migração como executada...`);
            await markMigrationAsExecuted(migration.name);
            return true;
        }
        
        return false;
    }
}

// Função principal
async function runMigrations() {
    try {
        console.log('🚀 Iniciando migrações automáticas do banco de dados...\n');
        console.log(`📊 Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Criar tabela de migrações
        await createMigrationsTable();

        // Executar todas as migrações
        let successCount = 0;
        let failCount = 0;

        for (const migration of migrations) {
            const success = await runMigration(migration);
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
        console.error('   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (ou DB_PASS)');
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };

