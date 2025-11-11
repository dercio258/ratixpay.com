/**
 * Script de migração para adicionar campos faltantes na tabela carteiras
 * Execute: node scripts/migrate-add-carteira-fields.js
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function addCarteiraFields() {
    try {
        console.log('🔄 Iniciando migração para adicionar campos na tabela carteiras...');
        
        // Verificar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Adicionar colunas usando SQL direto
        const queries = [
            // Adicionar coluna 'nome' se não existir
            `DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'carteiras' AND column_name = 'nome') THEN
                    ALTER TABLE carteiras ADD COLUMN nome VARCHAR(255) NOT NULL DEFAULT 'Carteira';
                    RAISE NOTICE 'Coluna nome adicionada';
                ELSE
                    RAISE NOTICE 'Coluna nome já existe';
                END IF;
            END $$;`,
            
            // Adicionar coluna 'metodo_saque' se não existir
            `DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'carteiras' AND column_name = 'metodo_saque') THEN
                    ALTER TABLE carteiras ADD COLUMN metodo_saque VARCHAR(50) NOT NULL DEFAULT 'Mpesa';
                    RAISE NOTICE 'Coluna metodo_saque adicionada';
                ELSE
                    RAISE NOTICE 'Coluna metodo_saque já existe';
                END IF;
            END $$;`,
            
            // Adicionar coluna 'contacto' se não existir
            `DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'carteiras' AND column_name = 'contacto') THEN
                    ALTER TABLE carteiras ADD COLUMN contacto VARCHAR(20) NOT NULL DEFAULT '';
                    RAISE NOTICE 'Coluna contacto adicionada';
                ELSE
                    RAISE NOTICE 'Coluna contacto já existe';
                END IF;
            END $$;`,
            
            // Adicionar coluna 'nome_titular' se não existir
            `DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'carteiras' AND column_name = 'nome_titular') THEN
                    ALTER TABLE carteiras ADD COLUMN nome_titular VARCHAR(255) NOT NULL DEFAULT '';
                    RAISE NOTICE 'Coluna nome_titular adicionada';
                ELSE
                    RAISE NOTICE 'Coluna nome_titular já existe';
                END IF;
            END $$;`,
            
            // Adicionar coluna 'email_titular' se não existir
            `DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                               WHERE table_name = 'carteiras' AND column_name = 'email_titular') THEN
                    ALTER TABLE carteiras ADD COLUMN email_titular VARCHAR(255) NOT NULL DEFAULT '';
                    RAISE NOTICE 'Coluna email_titular adicionada';
                ELSE
                    RAISE NOTICE 'Coluna email_titular já existe';
                END IF;
            END $$;`
        ];
        
        // Executar cada query
        for (const query of queries) {
            try {
                await sequelize.query(query);
            } catch (error) {
                // Ignorar erros de coluna já existente
                if (error.message && error.message.includes('already exists')) {
                    console.log('⚠️  Coluna já existe, pulando...');
                } else {
                    throw error;
                }
            }
        }
        
        console.log('✅ Migração concluída com sucesso!');
        console.log('📋 Colunas adicionadas: nome, metodo_saque, contacto, nome_titular, email_titular');
        
        // Verificar colunas existentes
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'carteiras'
            ORDER BY ordinal_position;
        `);
        
        console.log('\n📊 Estrutura atual da tabela carteiras:');
        results.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar migração
addCarteiraFields();

