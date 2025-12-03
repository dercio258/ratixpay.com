-- Migração para adicionar campo "nome" à tabela carteiras
-- Data: 2024-12-29

DO $$ 
BEGIN
    -- Verificar e adicionar coluna "nome" se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'nome'
    ) THEN
        ALTER TABLE carteiras 
        ADD COLUMN nome VARCHAR(255) NOT NULL DEFAULT 'Carteira Principal';
        
        COMMENT ON COLUMN carteiras.nome IS 'Nome da carteira';
        
        RAISE NOTICE 'Coluna nome adicionada com sucesso à tabela carteiras';
    ELSE
        -- Se a coluna já existe, garantir que registros sem nome tenham um valor padrão
        UPDATE carteiras 
        SET nome = 'Carteira Principal' 
        WHERE nome IS NULL OR nome = '';
        
        -- Garantir que a coluna não aceite NULL
        ALTER TABLE carteiras 
        ALTER COLUMN nome SET NOT NULL;
        
        -- Garantir que tenha valor padrão
        ALTER TABLE carteiras 
        ALTER COLUMN nome SET DEFAULT 'Carteira Principal';
        
        RAISE NOTICE 'Coluna nome já existe, valores padrão atualizados';
    END IF;
END $$;


