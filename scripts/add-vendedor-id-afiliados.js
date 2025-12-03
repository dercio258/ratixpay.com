const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || process.env.DB_PASSWORD || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: console.log
});

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
            console.log('⚠️ Coluna vendedor_id já existe!');
            console.log('ℹ️ Nenhuma alteração necessária.');
            await sequelize.close();
            return;
        }
        
        // Criar a coluna
        console.log('📝 Adicionando coluna vendedor_id...');
        await sequelize.query(`
            ALTER TABLE afiliados
            ADD COLUMN vendedor_id UUID NULL
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
                console.log('📝 Adicionando foreign key para usuarios...');
                await sequelize.query(`
                    ALTER TABLE afiliados
                    ADD CONSTRAINT fk_afiliados_vendedor 
                    FOREIGN KEY (vendedor_id) 
                    REFERENCES usuarios(id) 
                    ON DELETE SET NULL
                `);
                console.log('✅ Foreign key adicionada com sucesso!');
            } else {
                console.log('⚠️ Tabela usuarios não encontrada, pulando foreign key');
            }
        } catch (error) {
            if (error.message.includes('already exists') || error.message.includes('já existe')) {
                console.log('⚠️ Foreign key já existe');
            } else {
                console.log('⚠️ Não foi possível adicionar foreign key (não crítico):', error.message);
            }
        }
        
        console.log('\n✅ Migração concluída com sucesso!');
        await sequelize.close();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error.message);
        console.error('Stack trace:', error.stack);
        await sequelize.close();
        process.exit(1);
    }
}

// Executar migração
addVendedorIdColumn();

