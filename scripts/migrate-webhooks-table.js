/**
 * Script de Migração: Criar tabela webhooks
 * Execute este script para criar a tabela webhooks no banco de dados PostgreSQL
 * 
 * Uso:
 *   node scripts/migrate-webhooks-table.js
 * 
 * Ou execute o SQL diretamente no PostgreSQL:
 *   psql -U postgres -d ratixpay -f migrations/create-webhooks-table.sql
 */

const { sequelize } = require('../config/database');

async function migrateWebhooksTable() {
    try {
        console.log('🔄 Iniciando migração da tabela webhooks...');
        
        // Verificar se a tabela já existe
        const [results] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'webhooks'
            );
        `);
        
        const tableExists = results[0].exists;
        
        if (tableExists) {
            console.log('✅ Tabela webhooks já existe');
            
            // Verificar se a coluna produto_id existe
            const [columnResults] = await sequelize.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'webhooks' 
                    AND column_name = 'produto_id'
                );
            `);
            
            const produtoIdExists = columnResults[0].exists;
            
            if (!produtoIdExists) {
                console.log('🔄 Adicionando coluna produto_id...');
                await sequelize.query(`
                    ALTER TABLE webhooks 
                    ADD COLUMN produto_id UUID,
                    ADD CONSTRAINT fk_webhook_produto 
                    FOREIGN KEY (produto_id) 
                    REFERENCES produtos(id) 
                    ON DELETE CASCADE;
                `);
                
                await sequelize.query(`
                    CREATE INDEX IF NOT EXISTS idx_webhooks_produto_id 
                    ON webhooks(produto_id);
                `);
                
                console.log('✅ Coluna produto_id adicionada com sucesso');
            } else {
                console.log('✅ Coluna produto_id já existe');
            }
            
            console.log('✅ Migração concluída - tabela webhooks está atualizada');
            return;
        }
        
        // Criar tabela webhooks
        console.log('🔄 Criando tabela webhooks...');
        
        await sequelize.query(`
            CREATE TABLE webhooks (
                id VARCHAR(255) PRIMARY KEY,
                user_id UUID NOT NULL,
                produto_id UUID,
                url TEXT NOT NULL,
                eventos JSON NOT NULL DEFAULT '[]',
                secret TEXT,
                ativo BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_webhook_user 
                    FOREIGN KEY (user_id) 
                    REFERENCES usuarios(id) 
                    ON DELETE CASCADE,
                CONSTRAINT fk_webhook_produto 
                    FOREIGN KEY (produto_id) 
                    REFERENCES produtos(id) 
                    ON DELETE CASCADE
            );
        `);
        
        // Criar índices
        console.log('🔄 Criando índices...');
        
        await sequelize.query(`
            CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
        `);
        
        await sequelize.query(`
            CREATE INDEX idx_webhooks_produto_id ON webhooks(produto_id);
        `);
        
        await sequelize.query(`
            CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
        `);
        
        await sequelize.query(`
            CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
        `);
        
        // Adicionar comentários
        console.log('🔄 Adicionando comentários...');
        
        await sequelize.query(`
            COMMENT ON TABLE webhooks IS 'Webhooks configurados pelos usuários para receber notificações de eventos';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.id IS 'ID único do webhook (gerado automaticamente)';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.user_id IS 'ID do usuário que criou o webhook';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.produto_id IS 'ID do produto (opcional, NULL para webhooks globais)';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.url IS 'URL onde o webhook será enviado';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.eventos IS 'Array de eventos que o webhook deve receber';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.secret IS 'Secret opcional para validação de segurança';
        `);
        
        await sequelize.query(`
            COMMENT ON COLUMN webhooks.ativo IS 'Se o webhook está ativo';
        `);
        
        console.log('✅ Tabela webhooks criada com sucesso!');
        console.log('✅ Índices criados com sucesso!');
        console.log('✅ Comentários adicionados com sucesso!');
        console.log('✅ Migração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        console.error('❌ Stack trace:', error.stack);
        throw error;
    }
}

// Executar migração se o script for chamado diretamente
if (require.main === module) {
    migrateWebhooksTable()
        .then(() => {
            console.log('✅ Script de migração executado com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro ao executar script de migração:', error);
            process.exit(1);
        });
}

module.exports = { migrateWebhooksTable };

