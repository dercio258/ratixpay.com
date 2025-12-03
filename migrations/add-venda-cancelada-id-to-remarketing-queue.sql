-- Migração: Adicionar campo venda_cancelada_id à tabela remarketing_queue
-- Para referenciar a venda cancelada original

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'remarketing_queue' 
        AND column_name = 'venda_cancelada_id'
    ) THEN
        ALTER TABLE remarketing_queue ADD COLUMN venda_cancelada_id UUID;
        ALTER TABLE remarketing_queue ADD CONSTRAINT fk_remarketing_venda_cancelada 
            FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE SET NULL;
        CREATE INDEX idx_remarketing_queue_venda_cancelada ON remarketing_queue(venda_cancelada_id);
        
        COMMENT ON COLUMN remarketing_queue.venda_cancelada_id IS 'ID da venda cancelada que originou este item de remarketing';
        
        RAISE NOTICE 'Coluna venda_cancelada_id adicionada à tabela remarketing_queue com sucesso';
    ELSE
        RAISE NOTICE 'Coluna venda_cancelada_id já existe na tabela remarketing_queue';
    END IF;
END $$;

