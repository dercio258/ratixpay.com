const { Sequelize } = require('sequelize');
require('dotenv').config();

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
    dialectOptions: {
        ssl: false
    },
    logging: false
});

async function verificarTrackingData() {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 Verificando coluna tracking_data na tabela vendas...');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Verificar se a coluna existe
        const [results] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'vendas'
            AND column_name = 'tracking_data'
        `);
        
        if (results.length > 0) {
            console.log('✅ Coluna tracking_data encontrada!');
            console.log('📊 Informações da coluna:');
            console.log('   - Nome:', results[0].column_name);
            console.log('   - Tipo:', results[0].data_type);
            console.log('   - Permite NULL:', results[0].is_nullable);
            
            // Verificar estrutura da tabela completa
            const [allColumns] = await sequelize.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'vendas'
                ORDER BY ordinal_position
            `);
            
            console.log('\n📋 Estrutura completa da tabela vendas:');
            allColumns.forEach((col, index) => {
                console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - NULL: ${col.is_nullable}`);
            });
            
            // Verificar se há dados na coluna
            const [dataCheck] = await sequelize.query(`
                SELECT 
                    COUNT(*) as total_vendas,
                    COUNT(tracking_data) as vendas_com_tracking,
                    COUNT(*) - COUNT(tracking_data) as vendas_sem_tracking
                FROM vendas
            `);
            
            console.log('\n📊 Estatísticas de tracking_data:');
            console.log('   - Total de vendas:', dataCheck[0].total_vendas);
            console.log('   - Vendas com tracking_data:', dataCheck[0].vendas_com_tracking);
            console.log('   - Vendas sem tracking_data:', dataCheck[0].vendas_sem_tracking);
            
            // Mostrar exemplo de tracking_data se houver
            const [example] = await sequelize.query(`
                SELECT tracking_data
                FROM vendas
                WHERE tracking_data IS NOT NULL
                LIMIT 1
            `);
            
            if (example.length > 0 && example[0].tracking_data) {
                console.log('\n📦 Exemplo de tracking_data:');
                console.log(JSON.stringify(example[0].tracking_data, null, 2));
            }
            
        } else {
            console.log('❌ Coluna tracking_data NÃO encontrada!');
            console.log('\n🔧 Deseja criar a coluna? (Execute o script criar-tracking-data.js)');
            
            // Verificar estrutura atual da tabela
            const [allColumns] = await sequelize.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'vendas'
                ORDER BY ordinal_position
            `);
            
            console.log('\n📋 Estrutura atual da tabela vendas:');
            allColumns.forEach((col, index) => {
                console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - NULL: ${col.is_nullable}`);
            });
        }
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Verificação concluída!');
        console.log('═══════════════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ Erro ao verificar tracking_data:', error.message);
        console.error('📦 Stack:', error.stack);
    } finally {
        await sequelize.close();
    }
}

// Executar verificação
verificarTrackingData();

