/**
 * Script para adicionar colunas created_at e updated_at na tabela vendas
 * Execute: node scripts/add-timestamps-vendas.js
 * 
 * Este script verifica se as colunas created_at e updated_at existem na tabela vendas
 * e as adiciona caso não existam, além de criar índices para melhorar performance.
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

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

async function addTimestampsToVendas() {
    const transaction = await sequelize.transaction();
    
    try {
        console.log('🔄 Conectando ao banco de dados...');
        console.log(`📊 Host: ${dbHost}`);
        console.log(`📊 Port: ${dbPort}`);
        console.log(`📊 Database: ${dbName}`);
        console.log(`📊 User: ${dbUser}\n`);
        
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida com sucesso\n');

        // Verificar se a coluna created_at existe
        console.log('📝 Verificando coluna created_at na tabela vendas...');
        const [createdAtCheck] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            AND column_name = 'created_at'
        `, { transaction });

        if (createdAtCheck.length === 0) {
            console.log('➕ Coluna created_at não existe. Adicionando...');
            
            // Adicionar coluna created_at
            await sequelize.query(`
                ALTER TABLE vendas 
                ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            `, { transaction });
            
            // Atualizar registros existentes com a data atual
            const [updateResult] = await sequelize.query(`
                UPDATE vendas 
                SET created_at = CURRENT_TIMESTAMP 
                WHERE created_at IS NULL
            `, { transaction });
            
            console.log(`✅ Coluna created_at adicionada. ${updateResult[1] || 0} registros atualizados.`);
        } else {
            console.log('ℹ️  Coluna created_at já existe.');
        }

        // Verificar se a coluna updated_at existe
        console.log('\n📝 Verificando coluna updated_at na tabela vendas...');
        const [updatedAtCheck] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            AND column_name = 'updated_at'
        `, { transaction });

        if (updatedAtCheck.length === 0) {
            console.log('➕ Coluna updated_at não existe. Adicionando...');
            
            // Adicionar coluna updated_at
            await sequelize.query(`
                ALTER TABLE vendas 
                ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
            `, { transaction });
            
            // Atualizar registros existentes com a data atual
            const [updateResult] = await sequelize.query(`
                UPDATE vendas 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE updated_at IS NULL
            `, { transaction });
            
            console.log(`✅ Coluna updated_at adicionada. ${updateResult[1] || 0} registros atualizados.`);
        } else {
            console.log('ℹ️  Coluna updated_at já existe.');
        }

        // Criar índices para melhorar performance
        console.log('\n📝 Criando índices para melhorar performance...');
        
        try {
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON vendas(created_at DESC)
            `, { transaction });
            console.log('✅ Índice idx_vendas_created_at criado/verificado.');
        } catch (error) {
            console.warn('⚠️  Erro ao criar índice idx_vendas_created_at:', error.message);
        }

        try {
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_vendas_updated_at ON vendas(updated_at DESC)
            `, { transaction });
            console.log('✅ Índice idx_vendas_updated_at criado/verificado.');
        } catch (error) {
            console.warn('⚠️  Erro ao criar índice idx_vendas_updated_at:', error.message);
        }

        // Verificar resultado final
        console.log('\n📊 Verificando colunas criadas...');
        const [columns] = await sequelize.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            AND column_name IN ('created_at', 'updated_at')
            ORDER BY column_name
        `, { transaction });

        if (columns.length > 0) {
            console.log('\n✅ Colunas encontradas:');
            columns.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'N/A'})`);
            });
        } else {
            console.log('⚠️  Nenhuma coluna encontrada (isso não deveria acontecer)');
        }

        // Commit da transação
        await transaction.commit();
        console.log('\n✅ Migração concluída com sucesso!');
        
    } catch (error) {
        await transaction.rollback();
        console.error('\n❌ Erro durante a migração:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Conexão fechada.');
    }
}

// Executar migração
console.log('🚀 Iniciando migração para adicionar timestamps na tabela vendas...\n');
addTimestampsToVendas()
    .then(() => {
        console.log('\n✨ Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

