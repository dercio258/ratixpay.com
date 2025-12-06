-- =====================================================
-- Script de Migração: Tabela Webhooks
-- Execute este script no PostgreSQL da VPS
-- =====================================================
-- 
-- Uso:
--   psql -U postgres -d ratixpay -f migrations/migrate-webhooks-vps.sql
-- 
-- Ou execute diretamente:
--   sudo -u postgres psql -d ratixpay -f migrations/migrate-webhooks-vps.sql
-- =====================================================

BEGIN;

-- Verificar se a tabela já existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'webhooks'
    ) THEN
        -- Criar tabela webhooks
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
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
        CREATE INDEX idx_webhooks_produto_id ON webhooks(produto_id);
        CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
        CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
        
        -- Adicionar comentários
        COMMENT ON TABLE webhooks IS 'Webhooks configurados pelos usuários para receber notificações de eventos';
        COMMENT ON COLUMN webhooks.id IS 'ID único do webhook (gerado automaticamente)';
        COMMENT ON COLUMN webhooks.user_id IS 'ID do usuário que criou o webhook';
        COMMENT ON COLUMN webhooks.produto_id IS 'ID do produto (opcional, NULL para webhooks globais)';
        COMMENT ON COLUMN webhooks.url IS 'URL onde o webhook será enviado';
        COMMENT ON COLUMN webhooks.eventos IS 'Array de eventos que o webhook deve receber';
        COMMENT ON COLUMN webhooks.secret IS 'Secret opcional para validação de segurança';
        COMMENT ON COLUMN webhooks.ativo IS 'Se o webhook está ativo';
        
        RAISE NOTICE '✅ Tabela webhooks criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela webhooks já existe';
        
        -- Verificar se a coluna produto_id existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'webhooks' 
            AND column_name = 'produto_id'
        ) THEN
            -- Adicionar coluna produto_id se não existir
            ALTER TABLE webhooks 
            ADD COLUMN produto_id UUID,
            ADD CONSTRAINT fk_webhook_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_webhooks_produto_id ON webhooks(produto_id);
            
            COMMENT ON COLUMN webhooks.produto_id IS 'ID do produto (opcional, NULL para webhooks globais)';
            
            RAISE NOTICE '✅ Coluna produto_id adicionada com sucesso!';
        ELSE
            RAISE NOTICE 'ℹ️ Coluna produto_id já existe';
        END IF;
    END IF;
END $$;

COMMIT;

-- Verificar estrutura final
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'webhooks'
ORDER BY ordinal_position;

-- Verificar índices
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'webhooks';

RAISE NOTICE '✅ Migração da tabela webhooks concluída!';

