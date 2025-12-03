-- Migração: Adicionar campos slug, nome e atributos à tabela upsell_pages
-- Data: 2024
-- Descrição: Adiciona ID de referência (slug), nome interno e atributos editados

DO $$ 
BEGIN
    -- Adicionar coluna slug (ID de referência único por vendedor)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'upsell_pages' AND column_name = 'slug'
    ) THEN
        ALTER TABLE upsell_pages ADD COLUMN slug VARCHAR(255);
        COMMENT ON COLUMN upsell_pages.slug IS 'ID de referência único (URL slug) para a página de upsell';
        RAISE NOTICE 'Coluna slug adicionada à tabela upsell_pages';
    ELSE
        RAISE NOTICE 'Coluna slug já existe na tabela upsell_pages';
    END IF;

    -- Adicionar coluna nome (nome interno para identificação)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'upsell_pages' AND column_name = 'nome'
    ) THEN
        ALTER TABLE upsell_pages ADD COLUMN nome VARCHAR(255);
        COMMENT ON COLUMN upsell_pages.nome IS 'Nome interno da página para identificação no painel';
        RAISE NOTICE 'Coluna nome adicionada à tabela upsell_pages';
    ELSE
        RAISE NOTICE 'Coluna nome já existe na tabela upsell_pages';
    END IF;

    -- Adicionar coluna atributos (JSONB para armazenar todos os campos editados)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'upsell_pages' AND column_name = 'atributos'
    ) THEN
        ALTER TABLE upsell_pages ADD COLUMN atributos JSONB DEFAULT '{}';
        COMMENT ON COLUMN upsell_pages.atributos IS 'Atributos editados do template em formato JSON';
        RAISE NOTICE 'Coluna atributos adicionada à tabela upsell_pages';
    ELSE
        RAISE NOTICE 'Coluna atributos já existe na tabela upsell_pages';
    END IF;

    -- Criar índice único para slug por vendedor (cada vendedor pode ter slugs únicos)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_upsell_pages_vendedor_slug'
    ) THEN
        CREATE UNIQUE INDEX idx_upsell_pages_vendedor_slug ON upsell_pages(vendedor_id, slug) WHERE slug IS NOT NULL;
        RAISE NOTICE 'Índice único idx_upsell_pages_vendedor_slug criado';
    ELSE
        RAISE NOTICE 'Índice idx_upsell_pages_vendedor_slug já existe';
    END IF;

    -- Criar índice para busca por slug
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_upsell_pages_slug'
    ) THEN
        CREATE INDEX idx_upsell_pages_slug ON upsell_pages(slug);
        RAISE NOTICE 'Índice idx_upsell_pages_slug criado';
    ELSE
        RAISE NOTICE 'Índice idx_upsell_pages_slug já existe';
    END IF;

    -- Atualizar páginas existentes com slug gerado a partir do título
    UPDATE upsell_pages 
    SET slug = LOWER(REGEXP_REPLACE(
        REGEXP_REPLACE(titulo, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
    )) || '-' || SUBSTRING(id::text, 1, 8)
    WHERE slug IS NULL AND titulo IS NOT NULL;
    
    RAISE NOTICE 'Slugs gerados para páginas existentes';

    -- Atualizar nome com título para páginas existentes
    UPDATE upsell_pages 
    SET nome = titulo
    WHERE nome IS NULL AND titulo IS NOT NULL;
    
    RAISE NOTICE 'Nomes atualizados para páginas existentes';

END $$;

-- Adicionar comentário na tabela
COMMENT ON TABLE upsell_pages IS 'Páginas de upsell criadas pelos vendedores com suporte a templates editáveis';

