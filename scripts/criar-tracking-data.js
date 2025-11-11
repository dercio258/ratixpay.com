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
    logging: console.log
});

async function criarTrackingData() {
    try {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔧 Criando coluna tracking_data na tabela vendas...');
        console.log('═══════════════════════════════════════════════════════════');
        
        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Verificar se a coluna já existe
        const [results] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'vendas'
            AND column_name = 'tracking_data'
        `);
        
        if (results.length > 0) {
            console.log('⚠️ Coluna tracking_data já existe!');
            console.log('ℹ️ Nenhuma alteração necessária.');
            return;
        }
        
        // Criar a coluna
        console.log('📝 Adicionando coluna tracking_data...');
        await sequelize.query(`
            ALTER TABLE vendas
            ADD COLUMN tracking_data JSONB NULL
        `);
        
        console.log('✅ Coluna tracking_data criada com sucesso!');
        
        // Adicionar comentário na coluna
        try {
            await sequelize.query(`
                COMMENT ON COLUMN vendas.tracking_data IS 'Parâmetros UTM e de rastreamento (utm_source, utm_campaign, etc)'
            `);
            console.log('✅ Comentário adicionado à coluna');
        } catch (commentError) {
            console.log('⚠️ Não foi possível adicionar comentário (pode ser ignorado)');
        }
        
        // Verificar se foi criada corretamente
        const [verify] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'vendas'
            AND column_name = 'tracking_data'
        `);
        
        if (verify.length > 0) {
            console.log('\n📊 Informações da coluna criada:');
            console.log('   - Nome:', verify[0].column_name);
            console.log('   - Tipo:', verify[0].data_type);
            console.log('   - Permite NULL:', verify[0].is_nullable);
        }
        
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Migração concluída com sucesso!');
        console.log('═══════════════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ Erro ao criar tracking_data:', error.message);
        console.error('📦 Stack:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar criação
criarTrackingData();

