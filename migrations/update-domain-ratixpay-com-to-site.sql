-- =====================================================
-- SCRIPT DE ATUALIZAÇÃO DE DOMÍNIO
-- ratixpay.com → ratixpay.site
-- =====================================================
-- Este script atualiza todas as URLs no banco de dados
-- de ratixpay.com para ratixpay.site
--
-- IDEMPOTENTE: Pode ser executado múltiplas vezes
-- =====================================================
--
-- USO:
--   psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql
--
-- IMPORTANTE: Faça backup antes de executar!
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ATUALIZAR URLs EM PRODUTOS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar link_conteudo
    UPDATE produtos
    SET link_conteudo = REPLACE(link_conteudo, 'ratixpay.com', 'ratixpay.site')
    WHERE link_conteudo LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Produtos.link_conteudo: % registros atualizados', updated_count;
    
    -- Atualizar imagem_url
    UPDATE produtos
    SET imagem_url = REPLACE(imagem_url, 'ratixpay.com', 'ratixpay.site')
    WHERE imagem_url LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Produtos.imagem_url: % registros atualizados', updated_count;
    
    -- Atualizar em campos JSON (se houver)
    UPDATE produtos
    SET remarketing_config = (
        SELECT jsonb_set(
            COALESCE(remarketing_config, '{}'::jsonb),
            '{base_url}',
            to_jsonb(REPLACE(COALESCE(remarketing_config->>'base_url', ''), 'ratixpay.com', 'ratixpay.site'))
        )
    )
    WHERE remarketing_config::text LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Produtos.remarketing_config: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 2. ATUALIZAR URLs EM AFILIADOS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar link_afiliado
    UPDATE afiliados
    SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
    WHERE link_afiliado LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Afiliados.link_afiliado: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 3. ATUALIZAR URLs EM LINK_TRACKINGS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar link_original
    UPDATE link_trackings
    SET link_original = REPLACE(link_original, 'ratixpay.com', 'ratixpay.site')
    WHERE link_original LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Link_trackings.link_original: % registros atualizados', updated_count;
    
    -- Atualizar link_afiliado
    UPDATE link_trackings
    SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
    WHERE link_afiliado LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Link_trackings.link_afiliado: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 4. ATUALIZAR URLs EM BLOG
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar image em blog_posts
    UPDATE blog_posts
    SET image = REPLACE(image, 'ratixpay.com', 'ratixpay.site')
    WHERE image LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Blog_posts.image: % registros atualizados', updated_count;
    
    -- Atualizar URLs em content (HTML)
    UPDATE blog_posts
    SET content = REPLACE(content, 'ratixpay.com', 'ratixpay.site')
    WHERE content LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Blog_posts.content: % registros atualizados', updated_count;
    
    -- Atualizar URLs em blog_pages
    UPDATE blog_pages
    SET content = REPLACE(content, 'ratixpay.com', 'ratixpay.site')
    WHERE content LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Blog_pages.content: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 5. ATUALIZAR URLs EM UPSELL PAGES
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'upsell_pages'
    ) THEN
        -- Atualizar template_html se existir
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'upsell_pages' 
            AND column_name = 'template_html'
        ) THEN
            UPDATE upsell_pages
            SET template_html = REPLACE(template_html, 'ratixpay.com', 'ratixpay.site')
            WHERE template_html LIKE '%ratixpay.com%';
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '✅ Upsell_pages.template_html: % registros atualizados', updated_count;
        END IF;
        
        -- Atualizar em campos JSON se existirem
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'upsell_pages' 
            AND column_name = 'config'
        ) THEN
            UPDATE upsell_pages
            SET config = (
                SELECT jsonb_set(
                    COALESCE(config, '{}'::jsonb),
                    '{base_url}',
                    to_jsonb(REPLACE(COALESCE(config->>'base_url', ''), 'ratixpay.com', 'ratixpay.site'))
                )
            )
            WHERE config::text LIKE '%ratixpay.com%';
            
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            RAISE NOTICE '✅ Upsell_pages.config: % registros atualizados', updated_count;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 6. ATUALIZAR URLs EM VENDAS (se houver campos de URL)
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Atualizar em campos JSON se existirem
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'vendas' 
        AND column_name = 'metadata'
    ) THEN
        UPDATE vendas
        SET metadata = (
            SELECT jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{url}',
                to_jsonb(REPLACE(COALESCE(metadata->>'url', ''), 'ratixpay.com', 'ratixpay.site'))
            )
        )
        WHERE metadata::text LIKE '%ratixpay.com%';
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✅ Vendas.metadata: % registros atualizados', updated_count;
    END IF;
END $$;

-- =====================================================
-- 7. ATUALIZAR URLs EM WEBHOOKS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'webhooks'
    ) THEN
        UPDATE webhooks
        SET url = REPLACE(url, 'ratixpay.com', 'ratixpay.site')
        WHERE url LIKE '%ratixpay.com%';
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✅ Webhooks.url: % registros atualizados', updated_count;
    END IF;
END $$;

COMMIT;

-- =====================================================
-- RELATÓRIO FINAL
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ATUALIZAÇÃO DE DOMÍNIO CONCLUÍDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Domínio atualizado: ratixpay.com → ratixpay.site';
    RAISE NOTICE '';
    RAISE NOTICE 'Tabelas atualizadas:';
    RAISE NOTICE '  ✅ produtos';
    RAISE NOTICE '  ✅ afiliados';
    RAISE NOTICE '  ✅ link_trackings';
    RAISE NOTICE '  ✅ blog_posts';
    RAISE NOTICE '  ✅ blog_pages';
    RAISE NOTICE '  ✅ upsell_pages (se existir)';
    RAISE NOTICE '  ✅ vendas.metadata (se existir)';
    RAISE NOTICE '  ✅ webhooks (se existir)';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- Exibir resumo de registros atualizados
SELECT 
    'produtos' as tabela,
    COUNT(*) as total_com_ratixpay_com
FROM produtos
WHERE 
    (link_conteudo LIKE '%ratixpay.com%' OR imagem_url LIKE '%ratixpay.com%')
    OR (remarketing_config::text LIKE '%ratixpay.com%')
UNION ALL
SELECT 
    'afiliados',
    COUNT(*)
FROM afiliados
WHERE link_afiliado LIKE '%ratixpay.com%'
UNION ALL
SELECT 
    'link_trackings',
    COUNT(*)
FROM link_trackings
WHERE link_original LIKE '%ratixpay.com%' OR link_afiliado LIKE '%ratixpay.com%'
UNION ALL
SELECT 
    'blog_posts',
    COUNT(*)
FROM blog_posts
WHERE image LIKE '%ratixpay.com%' OR content LIKE '%ratixpay.com%';

