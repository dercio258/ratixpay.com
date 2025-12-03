-- Migração: Adicionar coluna vendedor_id à tabela afiliados
-- Data: 2025-11-28
-- Descrição: Adiciona coluna para vincular afiliados a vendedores (sistema integrado)

DO $$ 
BEGIN
    -- Verificar se a coluna já existe antes de adicionar
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'afiliados' 
        AND column_name = 'vendedor_id'
    ) THEN
        -- Adicionar coluna vendedor_id
        ALTER TABLE afiliados 
        ADD COLUMN vendedor_id UUID NULL;
        
        -- Adicionar comentário
        COMMENT ON COLUMN afiliados.vendedor_id IS 'ID do vendedor associado (se o afiliado for um vendedor)';
        
        -- Adicionar foreign key se a tabela usuarios existir
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
            ALTER TABLE afiliados
            ADD CONSTRAINT fk_afiliados_vendedor 
            FOREIGN KEY (vendedor_id) 
            REFERENCES usuarios(id) 
            ON DELETE SET NULL;
        END IF;
        
        RAISE NOTICE 'Coluna vendedor_id adicionada com sucesso à tabela afiliados';
    ELSE
        RAISE NOTICE 'Coluna vendedor_id já existe na tabela afiliados';
    END IF;
END $$;

