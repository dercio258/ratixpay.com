/**
 * Script para corrigir estrutura da coluna contacto na tabela carteiras
 * Garante que contacto tenha DEFAULT value e seja compatível com o modelo
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function fixContactoColumn() {
    try {
        console.log('🔄 Iniciando correção da coluna contacto...');
        
        // Verificar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // 1. Atualizar registros existentes que são NULL
        console.log('📝 Atualizando registros existentes com contacto NULL...');
        const [updateContacto] = await sequelize.query(`
            UPDATE carteiras 
            SET contacto = COALESCE(
                NULLIF(contacto, ''),
                contacto_mpesa,
                contacto_emola,
                ''
            )
            WHERE contacto IS NULL OR contacto = '';
        `);
        console.log(`✅ Contactos atualizados`);
        
        console.log('📝 Atualizando registros existentes com nome_titular NULL...');
        const [updateNomeTitular] = await sequelize.query(`
            UPDATE carteiras 
            SET nome_titular = COALESCE(
                NULLIF(nome_titular, ''),
                nome_titular_mpesa,
                nome_titular_emola,
                ''
            )
            WHERE nome_titular IS NULL OR nome_titular = '';
        `);
        console.log(`✅ Nomes titulares atualizados`);
        
        // 2. Verificar e corrigir estrutura das colunas contacto e nome_titular
        const colunasParaCorrigir = ['contacto', 'nome_titular'];
        
        for (const coluna of colunasParaCorrigir) {
            const tipoColuna = coluna === 'contacto' ? 'VARCHAR(20)' : 'VARCHAR(255)';
            const [columns] = await sequelize.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = 'carteiras' 
                AND column_name = '${coluna}'
            `);
        
            if (columns.length === 0) {
                console.log(`📝 Coluna ${coluna} não existe. Criando...`);
                // Criar coluna se não existir
                await sequelize.query(`
                    ALTER TABLE carteiras 
                    ADD COLUMN ${coluna} ${tipoColuna} NOT NULL DEFAULT '';
                `);
                console.log(`✅ Coluna ${coluna} criada com DEFAULT`);
            } else {
                const col = columns[0];
                console.log(`📋 Coluna ${coluna} existe:`);
                console.log(`   - Tipo: ${col.data_type}`);
                console.log(`   - Nullable: ${col.is_nullable}`);
                console.log(`   - Default: ${col.column_default}`);
                
                // Verificar se tem DEFAULT
                if (!col.column_default || col.column_default === null || col.column_default === 'null') {
                    console.log(`🔧 Adicionando DEFAULT value para ${coluna}...`);
                    
                    // Adicionar DEFAULT
                    await sequelize.query(`
                        ALTER TABLE carteiras 
                        ALTER COLUMN ${coluna} 
                        SET DEFAULT '';
                    `);
                    
                    console.log(`✅ DEFAULT value adicionado para ${coluna}`);
                }
                
                // Verificar se permite NULL (não deve permitir)
                if (col.is_nullable === 'YES') {
                    console.log(`🔧 Alterando ${coluna} para NOT NULL...`);
                    
                    // Garantir que não há NULLs antes de alterar
                    if (coluna === 'contacto') {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna} = COALESCE(
                                NULLIF(${coluna}, ''),
                                contacto_mpesa,
                                contacto_emola,
                                ''
                            )
                            WHERE ${coluna} IS NULL;
                        `);
                    } else {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna} = COALESCE(
                                NULLIF(${coluna}, ''),
                                nome_titular_mpesa,
                                nome_titular_emola,
                                ''
                            )
                            WHERE ${coluna} IS NULL;
                        `);
                    }
                    
                    // Alterar para NOT NULL
                    await sequelize.query(`
                        ALTER TABLE carteiras 
                        ALTER COLUMN ${coluna} 
                        SET NOT NULL;
                    `);
                    
                    console.log(`✅ Coluna ${coluna} alterada para NOT NULL`);
                }
            }
        }
        
        // 3. Garantir que todos os registros tenham contacto e nome_titular preenchidos
        console.log('📝 Garantindo que todos os registros tenham contacto e nome_titular...');
        await sequelize.query(`
            UPDATE carteiras 
            SET contacto = COALESCE(
                NULLIF(contacto, ''),
                contacto_mpesa,
                contacto_emola,
                ''
            )
            WHERE contacto IS NULL OR contacto = '';
        `);
        
        await sequelize.query(`
            UPDATE carteiras 
            SET nome_titular = COALESCE(
                NULLIF(nome_titular, ''),
                nome_titular_mpesa,
                nome_titular_emola,
                ''
            )
            WHERE nome_titular IS NULL OR nome_titular = '';
        `);
        
        console.log('✅ Estrutura das colunas contacto e nome_titular corrigida com sucesso');
        
        // 4. Verificar estrutura final
        const [finalCheck] = await sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(contacto) as com_contacto,
                COUNT(CASE WHEN contacto IS NULL OR contacto = '' THEN 1 END) as sem_contacto,
                COUNT(nome_titular) as com_nome_titular,
                COUNT(CASE WHEN nome_titular IS NULL OR nome_titular = '' THEN 1 END) as sem_nome_titular
            FROM carteiras
        `);
        
        console.log('\n📊 Estatísticas finais:');
        console.log(`   - Total de carteiras: ${finalCheck[0]?.total || 0}`);
        console.log(`   - Com contacto: ${finalCheck[0]?.com_contacto || 0}`);
        console.log(`   - Sem contacto: ${finalCheck[0]?.sem_contacto || 0}`);
        console.log(`   - Com nome_titular: ${finalCheck[0]?.com_nome_titular || 0}`);
        console.log(`   - Sem nome_titular: ${finalCheck[0]?.sem_nome_titular || 0}`);
        
        await sequelize.close();
        console.log('\n✅ Script concluído com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao corrigir estrutura:', error);
        console.error('Stack:', error.stack);
        await sequelize.close();
        process.exit(1);
    }
}

// Executar
fixContactoColumn();

