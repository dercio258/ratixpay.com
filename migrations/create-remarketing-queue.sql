-- Migração: Criar tabela remarketing_queue
-- Execute este script como superusuário do PostgreSQL ou com permissões adequadas

-- Criar tabela remarketing_queue se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'remarketing_queue'
    ) THEN
        CREATE TABLE remarketing_queue (
            id SERIAL PRIMARY KEY,
            cliente_id UUID NOT NULL,
            cliente_nome VARCHAR(255) NOT NULL,
            produto_id UUID NOT NULL,
            produto_nome VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            telefone VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pendente' NOT NULL,
            data_cancelamento TIMESTAMP NOT NULL,
            tempo_envio INTEGER DEFAULT 0,
            data_agendada TIMESTAMP NOT NULL,
            tentativas INTEGER DEFAULT 0,
            motivo_ignorado TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_remarketing_queue_status ON remarketing_queue(status);
        CREATE INDEX idx_remarketing_queue_data_agendada ON remarketing_queue(data_agendada);
        CREATE INDEX idx_remarketing_queue_cliente_produto ON remarketing_queue(cliente_id, produto_id);
        CREATE INDEX idx_remarketing_queue_email ON remarketing_queue(email) WHERE email IS NOT NULL;
        
        COMMENT ON TABLE remarketing_queue IS 'Fila de remarketing para vendas canceladas';
        COMMENT ON COLUMN remarketing_queue.status IS 'Status: pendente, enviado, ignorado';
        COMMENT ON COLUMN remarketing_queue.tempo_envio IS 'Tempo em minutos até o envio';
        
        RAISE NOTICE 'Tabela remarketing_queue criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela remarketing_queue já existe';
    END IF;
END $$;
