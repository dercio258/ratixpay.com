/**
 * Script de teste para validar a estrutura das tabelas upsell e webhooks
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'ratixpay_local',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);

async function checkTable(tableName) {
    const [result] = await sequelize.query(`
        SELECT 
            table_name,
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = :tableName) as column_count
        FROM information_schema.tables 
        WHERE table_name = :tableName
    `, {
        replacements: { tableName },
        type: Sequelize.QueryTypes.SELECT
    });

    return result;
}

async function getTableColumns(tableName) {
    const columns = await sequelize.query(`
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns 
        WHERE table_name = :tableName
        ORDER BY ordinal_position
    `, {
        replacements: { tableName },
        type: Sequelize.QueryTypes.SELECT
    });

    return columns;
}

async function getTableIndexes(tableName) {
    const indexes = await sequelize.query(`
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes 
        WHERE tablename = :tableName
    `, {
        replacements: { tableName },
        type: Sequelize.QueryTypes.SELECT
    });

    return indexes;
}

async function testUpsellWebhooksSchema() {
    try {
        await sequelize.authenticate();
        console.log('✅ Conectado ao banco de dados\n');

        const tables = ['upsell_pages', 'produto_upsell', 'webhooks'];
        
        for (const tableName of tables) {
            console.log(`\n📊 Verificando tabela: ${tableName}`);
            console.log('─'.repeat(50));
            
            const table = await checkTable(tableName);
            
            if (!table || !table.table_name) {
                console.log(`❌ Tabela ${tableName} NÃO existe!`);
                console.log(`💡 Execute: node scripts/migrate-database-columns.js`);
                continue;
            }

            console.log(`✅ Tabela ${tableName} existe`);
            console.log(`   Colunas: ${table.column_count}`);

            // Listar colunas
            const columns = await getTableColumns(tableName);
            console.log('\n   Colunas:');
            columns.forEach(col => {
                const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
                console.log(`   - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
            });

            // Listar índices
            const indexes = await getTableIndexes(tableName);
            if (indexes.length > 0) {
                console.log('\n   Índices:');
                indexes.forEach(idx => {
                    console.log(`   - ${idx.indexname}`);
                });
            }

            // Testar query simples
            try {
                const [count] = await sequelize.query(
                    `SELECT COUNT(*)::int as count FROM ${tableName}`,
                    { type: Sequelize.QueryTypes.SELECT }
                );
                console.log(`\n   ✅ Query testada com sucesso (${count.count} registros)`);
            } catch (error) {
                console.log(`\n   ❌ Erro ao testar query: ${error.message}`);
            }
        }

        // Testar relacionamentos
        console.log('\n\n🔗 Verificando relacionamentos...');
        console.log('─'.repeat(50));

        // Verificar foreign keys
        const fks = await sequelize.query(`
            SELECT 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND (tc.table_name IN ('upsell_pages', 'produto_upsell', 'webhooks'))
            ORDER BY tc.table_name, kcu.column_name
        `, { type: Sequelize.QueryTypes.SELECT });

        if (fks.length > 0) {
            console.log('✅ Foreign Keys encontradas:');
            fks.forEach(fk => {
                console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
            });
        } else {
            console.log('⚠️  Nenhuma foreign key encontrada');
        }

        await sequelize.close();
        console.log('\n\n✅ Teste concluído!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await sequelize.close();
        process.exit(1);
    }
}

testUpsellWebhooksSchema();

