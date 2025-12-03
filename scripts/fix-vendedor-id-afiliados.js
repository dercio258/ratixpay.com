/**
 * Script para adicionar coluna vendedor_id à tabela afiliados
 * Usa o sequelize já configurado do projeto
 */

const { sequelize } = require('../config/database');

async function addVendedorIdColumn() {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔧 Adicionando coluna vendedor_id à tabela afiliados...');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Verificar se a coluna já existe
        const [results] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'vendedor_id'
        `);
        
        if (results.length > 0) {
            console.log('✅ Coluna vendedor_id já existe!');
            console.log('ℹ️ Nenhuma alteração necessária.');
            return;
        }
        
        // Criar a coluna usando DO block para evitar erro se já existir
        console.log('📝 Adicionando coluna vendedor_id...');
        await sequelize.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'afiliados' 
                    AND column_name = 'vendedor_id'
                ) THEN
                    ALTER TABLE afiliados ADD COLUMN vendedor_id UUID NULL;
                    RAISE NOTICE 'Coluna vendedor_id adicionada com sucesso';
                ELSE
                    RAISE NOTICE 'Coluna vendedor_id já existe';
                END IF;
            END $$;
        `);
        
        console.log('✅ Coluna vendedor_id criada com sucesso!');
        
        // Adicionar comentário na coluna
        try {
            await sequelize.query(`
                COMMENT ON COLUMN afiliados.vendedor_id IS 'ID do vendedor associado (se o afiliado for um vendedor)'
            `);
            console.log('✅ Comentário adicionado à coluna');
        } catch (error) {
            console.log('⚠️ Não foi possível adicionar comentário (não crítico)');
        }
        
        // Adicionar foreign key se a tabela usuarios existir
        try {
            const [tables] = await sequelize.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'usuarios'
            `);
            
            if (tables.length > 0) {
                console.log('📝 Verificando foreign key...');
                
                // Verificar se a constraint já existe
                const [constraints] = await sequelize.query(`
                    SELECT constraint_name
                    FROM information_schema.table_constraints
                    WHERE table_name = 'afiliados'
                    AND constraint_name = 'fk_afiliados_vendedor'
                `);
                
                if (constraints.length === 0) {
                    await sequelize.query(`
                        ALTER TABLE afiliados
                        ADD CONSTRAINT fk_afiliados_vendedor 
                        FOREIGN KEY (vendedor_id) 
                        REFERENCES usuarios(id) 
                        ON DELETE SET NULL
                    `);
                    console.log('✅ Foreign key adicionada com sucesso!');
                } else {
                    console.log('⚠️ Foreign key já existe');
                }
            } else {
                console.log('⚠️ Tabela usuarios não encontrada, pulando foreign key');
            }
        } catch (error) {
            if (error.message.includes('already exists') || 
                error.message.includes('já existe') ||
                error.message.includes('duplicate')) {
                console.log('⚠️ Foreign key já existe');
            } else {
                console.log('⚠️ Não foi possível adicionar foreign key (não crítico):', error.message);
            }
        }
        
        console.log('\n✅ Migração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Executar migração
if (require.main === module) {
    addVendedorIdColumn()
        .then(() => {
            console.log('\n🎉 Processo concluído!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Falha na migração:', error);
            process.exit(1);
        });
}

module.exports = { addVendedorIdColumn };

