/**
 * Script para corrigir estrutura da tabela carteiras
 * Garante que metodo_saque tenha DEFAULT value e seja compatível com o modelo
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function fixMetodoSaqueColumn() {
    try {
        console.log('🔄 Iniciando correção da coluna metodo_saque...');
        
        // Verificar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Verificar se a coluna existe e sua estrutura atual
        const [columns] = await sequelize.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'carteiras' 
            AND column_name = 'metodo_saque'
        `);
        
        if (columns.length === 0) {
            console.log('📝 Coluna metodo_saque não existe. Criando...');
            // Criar coluna se não existir
            await sequelize.query(`
                ALTER TABLE carteiras 
                ADD COLUMN metodo_saque VARCHAR(50) NOT NULL DEFAULT 'Mpesa';
            `);
            console.log('✅ Coluna metodo_saque criada com DEFAULT');
        } else {
            const col = columns[0];
            console.log(`📋 Coluna metodo_saque existe:`);
            console.log(`   - Tipo: ${col.data_type}`);
            console.log(`   - Nullable: ${col.is_nullable}`);
            console.log(`   - Default: ${col.column_default}`);
            
            // Verificar se tem DEFAULT
            if (!col.column_default || col.column_default === null) {
                console.log('🔧 Adicionando DEFAULT value...');
                
                // Primeiro, atualizar registros existentes que são NULL
                await sequelize.query(`
                    UPDATE carteiras 
                    SET metodo_saque = 'Mpesa' 
                    WHERE metodo_saque IS NULL;
                `);
                
                // Adicionar DEFAULT
                await sequelize.query(`
                    ALTER TABLE carteiras 
                    ALTER COLUMN metodo_saque 
                    SET DEFAULT 'Mpesa';
                `);
                
                console.log('✅ DEFAULT value adicionado');
            }
            
            // Verificar se permite NULL (não deve permitir)
            if (col.is_nullable === 'YES') {
                console.log('🔧 Alterando para NOT NULL...');
                
                // Primeiro, garantir que não há NULLs
                await sequelize.query(`
                    UPDATE carteiras 
                    SET metodo_saque = 'Mpesa' 
                    WHERE metodo_saque IS NULL;
                `);
                
                // Alterar para NOT NULL
                await sequelize.query(`
                    ALTER TABLE carteiras 
                    ALTER COLUMN metodo_saque 
                    SET NOT NULL;
                `);
                
                console.log('✅ Coluna alterada para NOT NULL');
            }
        }
        
        console.log('✅ Estrutura da coluna metodo_saque corrigida com sucesso');
        
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao corrigir estrutura:', error);
        console.error('Stack:', error.stack);
        await sequelize.close();
        process.exit(1);
    }
}

// Executar
fixMetodoSaqueColumn();

