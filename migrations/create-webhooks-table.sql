-- Migração: Criar tabela webhooks
-- Execute este script como superusuário do PostgreSQL ou com permissões adequadas

-- Criar tabela webhooks se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'webhooks'
    ) THEN
        CREATE TABLE webhooks (
            id VARCHAR(255) PRIMARY KEY,
            user_id UUID NOT NULL,
            url TEXT NOT NULL,
            eventos JSON NOT NULL DEFAULT '[]',
            secret TEXT,
            ativo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_webhook_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
        CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
        CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
        
        COMMENT ON TABLE webhooks IS 'Webhooks configurados pelos usuários para receber notificações de eventos';
        COMMENT ON COLUMN webhooks.id IS 'ID único do webhook (gerado automaticamente)';
        COMMENT ON COLUMN webhooks.user_id IS 'ID do usuário que criou o webhook';
        COMMENT ON COLUMN webhooks.url IS 'URL onde o webhook será enviado';
        COMMENT ON COLUMN webhooks.eventos IS 'Array de eventos que o webhook deve receber';
        COMMENT ON COLUMN webhooks.secret IS 'Secret opcional para validação de segurança';
        COMMENT ON COLUMN webhooks.ativo IS 'Se o webhook está ativo';
        
        RAISE NOTICE 'Tabela webhooks criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela webhooks já existe';
    END IF;
END $$;

