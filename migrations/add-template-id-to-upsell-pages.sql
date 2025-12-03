-- Adicionar campo template_id à tabela upsell_pages
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'upsell_pages' AND column_name = 'template_id'
    ) THEN
        ALTER TABLE upsell_pages ADD COLUMN template_id VARCHAR(100) DEFAULT 'default';
        COMMENT ON COLUMN upsell_pages.template_id IS 'ID do template selecionado para esta página de upsell';
        RAISE NOTICE 'Coluna template_id adicionada à tabela upsell_pages';
    ELSE
        RAISE NOTICE 'Coluna template_id já existe na tabela upsell_pages';
    END IF;
END $$;

