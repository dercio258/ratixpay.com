-- Adicionar campo template_html à tabela upsell_pages
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'upsell_pages' AND column_name = 'template_html'
    ) THEN
        ALTER TABLE upsell_pages ADD COLUMN template_html TEXT;
        COMMENT ON COLUMN upsell_pages.template_html IS 'HTML completo do template modificado pelo usuário';
        RAISE NOTICE 'Coluna template_html adicionada à tabela upsell_pages';
    ELSE
        RAISE NOTICE 'Coluna template_html já existe na tabela upsell_pages';
    END IF;
END $$;

