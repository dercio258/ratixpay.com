/**
 * Script de Migração para Corrigir Campos da Tabela carteiras
 * Corrige todos os campos legados obrigatórios: contacto, nome_titular, email_titular, metodo_saque
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function migrateCarteiraFields() {
    try {
        console.log('🔄 Iniciando migração dos campos da tabela carteiras...');
        console.log('='.repeat(60));
        
        // Verificar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida\n');
        
        // ============================================
        // 1. ATUALIZAR REGISTROS EXISTENTES
        // ============================================
        console.log('📝 Passo 1: Atualizando registros existentes...');
        
        // Atualizar contacto
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
        console.log('   ✅ Contactos atualizados');
        
        // Atualizar nome_titular
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
        console.log('   ✅ Nomes titulares atualizados');
        
        // Atualizar email_titular
        const [updateEmailTitular] = await sequelize.query(`
            UPDATE carteiras 
            SET email_titular = COALESCE(
                NULLIF(email_titular, ''),
                email,
                ''
            )
            WHERE email_titular IS NULL OR email_titular = '';
        `);
        console.log('   ✅ Emails titulares atualizados');
        
        // Atualizar metodo_saque
        const [updateMetodoSaque] = await sequelize.query(`
            UPDATE carteiras 
            SET metodo_saque = COALESCE(
                NULLIF(metodo_saque, ''),
                'Mpesa'
            )
            WHERE metodo_saque IS NULL OR metodo_saque = '';
        `);
        console.log('   ✅ Métodos de saque atualizados\n');
        
        // ============================================
        // 2. CORRIGIR/CRIAR COLUNAS
        // ============================================
        console.log('🔧 Passo 2: Corrigindo estrutura das colunas...');
        
        const colunasParaCorrigir = [
            {
                nome: 'contacto',
                tipo: 'VARCHAR(20)',
                defaultValue: "''"
            },
            {
                nome: 'nome_titular',
                tipo: 'VARCHAR(255)',
                defaultValue: "''"
            },
            {
                nome: 'email_titular',
                tipo: 'VARCHAR(255)',
                defaultValue: "''"
            },
            {
                nome: 'metodo_saque',
                tipo: 'VARCHAR(50)',
                defaultValue: "'Mpesa'"
            }
        ];
        
        for (const coluna of colunasParaCorrigir) {
            // Verificar se coluna existe
            const [columns] = await sequelize.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = 'carteiras' 
                AND column_name = '${coluna.nome}'
            `);
            
            if (columns.length === 0) {
                // Criar coluna se não existir
                console.log(`   📝 Criando coluna ${coluna.nome}...`);
                await sequelize.query(`
                    ALTER TABLE carteiras 
                    ADD COLUMN ${coluna.nome} ${coluna.tipo} NOT NULL DEFAULT ${coluna.defaultValue};
                `);
                console.log(`   ✅ Coluna ${coluna.nome} criada`);
            } else {
                const col = columns[0];
                console.log(`   📋 Coluna ${coluna.nome} existe`);
                
                // Adicionar DEFAULT se não existir
                if (!col.column_default || col.column_default === null || col.column_default === 'null') {
                    console.log(`   🔧 Adicionando DEFAULT para ${coluna.nome}...`);
                    await sequelize.query(`
                        ALTER TABLE carteiras 
                        ALTER COLUMN ${coluna.nome} 
                        SET DEFAULT ${coluna.defaultValue};
                    `);
                    console.log(`   ✅ DEFAULT adicionado para ${coluna.nome}`);
                }
                
                // Garantir NOT NULL
                if (col.is_nullable === 'YES') {
                    console.log(`   🔧 Alterando ${coluna.nome} para NOT NULL...`);
                    
                    // Atualizar NULLs antes de alterar
                    if (coluna.nome === 'contacto') {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna.nome} = COALESCE(
                                NULLIF(${coluna.nome}, ''),
                                contacto_mpesa,
                                contacto_emola,
                                ''
                            )
                            WHERE ${coluna.nome} IS NULL;
                        `);
                    } else if (coluna.nome === 'nome_titular') {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna.nome} = COALESCE(
                                NULLIF(${coluna.nome}, ''),
                                nome_titular_mpesa,
                                nome_titular_emola,
                                ''
                            )
                            WHERE ${coluna.nome} IS NULL;
                        `);
                    } else if (coluna.nome === 'email_titular') {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna.nome} = COALESCE(
                                NULLIF(${coluna.nome}, ''),
                                email,
                                ''
                            )
                            WHERE ${coluna.nome} IS NULL;
                        `);
                    } else if (coluna.nome === 'metodo_saque') {
                        await sequelize.query(`
                            UPDATE carteiras 
                            SET ${coluna.nome} = COALESCE(
                                NULLIF(${coluna.nome}, ''),
                                'Mpesa'
                            )
                            WHERE ${coluna.nome} IS NULL;
                        `);
                    }
                    
                    // Alterar para NOT NULL
                    await sequelize.query(`
                        ALTER TABLE carteiras 
                        ALTER COLUMN ${coluna.nome} 
                        SET NOT NULL;
                    `);
                    console.log(`   ✅ ${coluna.nome} alterado para NOT NULL`);
                } else {
                    console.log(`   ✅ ${coluna.nome} já é NOT NULL`);
                }
            }
        }
        
        console.log('\n');
        
        // ============================================
        // 3. GARANTIR QUE TODOS OS REGISTROS ESTÃO PREENCHIDOS
        // ============================================
        console.log('📝 Passo 3: Garantindo que todos os registros estão preenchidos...');
        
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
        console.log('   ✅ Contactos verificados');
        
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
        console.log('   ✅ Nomes titulares verificados');
        
        await sequelize.query(`
            UPDATE carteiras 
            SET email_titular = COALESCE(
                NULLIF(email_titular, ''),
                email,
                ''
            )
            WHERE email_titular IS NULL OR email_titular = '';
        `);
        console.log('   ✅ Emails titulares verificados');
        
        await sequelize.query(`
            UPDATE carteiras 
            SET metodo_saque = COALESCE(
                NULLIF(metodo_saque, ''),
                'Mpesa'
            )
            WHERE metodo_saque IS NULL OR metodo_saque = '';
        `);
        console.log('   ✅ Métodos de saque verificados\n');
        
        // ============================================
        // 4. VERIFICAR ESTRUTURA FINAL
        // ============================================
        console.log('📊 Passo 4: Verificando estrutura final...');
        
        const [estrutura] = await sequelize.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'carteiras' 
            AND column_name IN ('contacto', 'nome_titular', 'email_titular', 'metodo_saque')
            ORDER BY column_name;
        `);
        
        console.log('\n   Estrutura das colunas:');
        estrutura.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type}, NULL: ${col.is_nullable}, DEFAULT: ${col.column_default || 'N/A'}`);
        });
        
        // ============================================
        // 5. VERIFICAR ESTATÍSTICAS
        // ============================================
        console.log('\n📊 Passo 5: Estatísticas finais...');
        
        const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_carteiras,
                COUNT(contacto) as com_contacto,
                COUNT(CASE WHEN contacto IS NULL OR contacto = '' THEN 1 END) as sem_contacto,
                COUNT(nome_titular) as com_nome_titular,
                COUNT(CASE WHEN nome_titular IS NULL OR nome_titular = '' THEN 1 END) as sem_nome_titular,
                COUNT(email_titular) as com_email_titular,
                COUNT(CASE WHEN email_titular IS NULL OR email_titular = '' THEN 1 END) as sem_email_titular,
                COUNT(metodo_saque) as com_metodo_saque,
                COUNT(CASE WHEN metodo_saque IS NULL OR metodo_saque = '' THEN 1 END) as sem_metodo_saque
            FROM carteiras;
        `);
        
        const estatisticas = stats[0];
        console.log(`\n   📈 Estatísticas:`);
        console.log(`   - Total de carteiras: ${estatisticas.total_carteiras || 0}`);
        console.log(`   - Com contacto: ${estatisticas.com_contacto || 0} | Sem: ${estatisticas.sem_contacto || 0}`);
        console.log(`   - Com nome_titular: ${estatisticas.com_nome_titular || 0} | Sem: ${estatisticas.sem_nome_titular || 0}`);
        console.log(`   - Com email_titular: ${estatisticas.com_email_titular || 0} | Sem: ${estatisticas.sem_email_titular || 0}`);
        console.log(`   - Com metodo_saque: ${estatisticas.com_metodo_saque || 0} | Sem: ${estatisticas.sem_metodo_saque || 0}`);
        
        // Verificar se há problemas
        const problemas = [];
        if (estatisticas.sem_contacto > 0) problemas.push(`${estatisticas.sem_contacto} carteiras sem contacto`);
        if (estatisticas.sem_nome_titular > 0) problemas.push(`${estatisticas.sem_nome_titular} carteiras sem nome_titular`);
        if (estatisticas.sem_email_titular > 0) problemas.push(`${estatisticas.sem_email_titular} carteiras sem email_titular`);
        if (estatisticas.sem_metodo_saque > 0) problemas.push(`${estatisticas.sem_metodo_saque} carteiras sem metodo_saque`);
        
        if (problemas.length > 0) {
            console.log(`\n   ⚠️  Avisos: ${problemas.join(', ')}`);
        } else {
            console.log(`\n   ✅ Todas as carteiras estão com os campos preenchidos!`);
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ Migração concluída com sucesso!');
        console.log('='.repeat(60));
        
        await sequelize.close();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Erro durante a migração:', error.message);
        console.error('Stack:', error.stack);
        
        try {
            await sequelize.close();
        } catch (closeError) {
            console.error('Erro ao fechar conexão:', closeError);
        }
        
        process.exit(1);
    }
}

// Executar migração
console.log('🚀 Iniciando migração da tabela carteiras...\n');
migrateCarteiraFields();

