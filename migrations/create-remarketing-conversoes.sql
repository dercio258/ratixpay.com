-- Migração: Criar tabela remarketing_conversoes
-- Rastreia conversões de remarketing (quando uma venda cancelada que recebeu remarketing é convertida em venda aprovada)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'remarketing_conversoes'
    ) THEN
        CREATE TABLE remarketing_conversoes (
            id SERIAL PRIMARY KEY,
            remarketing_queue_id INTEGER NOT NULL,
            venda_cancelada_id UUID NOT NULL,
            venda_aprovada_id UUID NOT NULL,
            cliente_id UUID,
            cliente_nome VARCHAR(255) NOT NULL,
            produto_id UUID NOT NULL,
            produto_nome VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            telefone VARCHAR(50),
            data_cancelamento TIMESTAMP NOT NULL,
            data_remarketing_enviado TIMESTAMP,
            data_conversao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            valor_venda_cancelada DECIMAL(10, 2),
            valor_venda_aprovada DECIMAL(10, 2),
            tempo_ate_conversao_minutos INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_remarketing_queue FOREIGN KEY (remarketing_queue_id) REFERENCES remarketing_queue(id) ON DELETE CASCADE,
            CONSTRAINT fk_venda_cancelada FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE CASCADE,
            CONSTRAINT fk_venda_aprovada FOREIGN KEY (venda_aprovada_id) REFERENCES vendas(id) ON DELETE CASCADE,
            CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_remarketing_conversoes_queue ON remarketing_conversoes(remarketing_queue_id);
        CREATE INDEX idx_remarketing_conversoes_venda_cancelada ON remarketing_conversoes(venda_cancelada_id);
        CREATE INDEX idx_remarketing_conversoes_venda_aprovada ON remarketing_conversoes(venda_aprovada_id);
        CREATE INDEX idx_remarketing_conversoes_cliente ON remarketing_conversoes(cliente_id) WHERE cliente_id IS NOT NULL;
        CREATE INDEX idx_remarketing_conversoes_produto ON remarketing_conversoes(produto_id);
        CREATE INDEX idx_remarketing_conversoes_data_conversao ON remarketing_conversoes(data_conversao);
        CREATE INDEX idx_remarketing_conversoes_email ON remarketing_conversoes(email) WHERE email IS NOT NULL;
        CREATE INDEX idx_remarketing_conversoes_telefone ON remarketing_conversoes(telefone) WHERE telefone IS NOT NULL;
        
        COMMENT ON TABLE remarketing_conversoes IS 'Rastreia conversões de remarketing: quando uma venda cancelada que recebeu remarketing é convertida em venda aprovada';
        COMMENT ON COLUMN remarketing_conversoes.remarketing_queue_id IS 'ID do item na fila de remarketing';
        COMMENT ON COLUMN remarketing_conversoes.venda_cancelada_id IS 'ID da venda cancelada original';
        COMMENT ON COLUMN remarketing_conversoes.venda_aprovada_id IS 'ID da venda aprovada (conversão)';
        COMMENT ON COLUMN remarketing_conversoes.tempo_ate_conversao_minutos IS 'Tempo em minutos entre o envio do remarketing e a conversão';
        
        RAISE NOTICE 'Tabela remarketing_conversoes criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela remarketing_conversoes já existe';
    END IF;
END $$;

