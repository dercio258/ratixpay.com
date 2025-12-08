-- =====================================================
-- SCRIPT DE ATUALIZAÇÃO DE PRODUTOS, IMAGENS E ARQUIVOS
-- =====================================================
-- Este script atualiza URLs de produtos, imagens e arquivos
-- para o novo domínio ratixpay.site
--
-- IDEMPOTENTE: Pode ser executado múltiplas vezes
-- =====================================================
--
-- USO:
--   psql -U postgres -d ratixpay -f migrations/update-products-images-files.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ATUALIZAR IMAGENS DE PRODUTOS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
    total_updated INTEGER := 0;
BEGIN
    RAISE NOTICE '🖼️ Atualizando imagens de produtos...';
    
    -- Atualizar imagem_url
    UPDATE produtos
    SET 
        imagem_url = REPLACE(imagem_url, 'ratixpay.com', 'ratixpay.site'),
        updated_at = CURRENT_TIMESTAMP
    WHERE imagem_url LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    total_updated := total_updated + updated_count;
    RAISE NOTICE '  ✅ imagem_url: % registros atualizados', updated_count;
    
    -- Atualizar em campos de configuração JSON
    UPDATE produtos
    SET 
        remarketing_config = jsonb_set(
            COALESCE(remarketing_config, '{}'::jsonb),
            '{imagem}',
            to_jsonb(REPLACE(COALESCE(remarketing_config->>'imagem', ''), 'ratixpay.com', 'ratixpay.site'))
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE remarketing_config::text LIKE '%ratixpay.com%'
    AND remarketing_config->>'imagem' IS NOT NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    total_updated := total_updated + updated_count;
    RAISE NOTICE '  ✅ remarketing_config.imagem: % registros atualizados', updated_count;
    
    RAISE NOTICE '✅ Total de imagens atualizadas: %', total_updated;
END $$;

-- =====================================================
-- 2. ATUALIZAR LINKS DE CONTEÚDO
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Atualizando links de conteúdo...';
    
    UPDATE produtos
    SET 
        link_conteudo = REPLACE(link_conteudo, 'ratixpay.com', 'ratixpay.site'),
        updated_at = CURRENT_TIMESTAMP
    WHERE link_conteudo LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '  ✅ link_conteudo: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 3. ATUALIZAR ARQUIVOS E DOWNLOADS
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📁 Atualizando URLs de arquivos...';
    
    -- Verificar se há campo de arquivos/dowloads em JSON
    UPDATE produtos
    SET 
        remarketing_config = (
            SELECT jsonb_object_agg(
                key,
                CASE 
                    WHEN jsonb_typeof(value) = 'string' 
                    THEN to_jsonb(REPLACE(value::text, 'ratixpay.com', 'ratixpay.site'))
                    ELSE value
                END
            )
            FROM jsonb_each(COALESCE(remarketing_config, '{}'::jsonb))
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE remarketing_config::text LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '  ✅ Configurações JSON: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 4. ATUALIZAR URLs EM CAMPOS DE DESCRIÇÃO
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📝 Atualizando URLs em descrições...';
    
    -- Atualizar descrição se contiver URLs
    UPDATE produtos
    SET 
        descricao = REPLACE(descricao, 'ratixpay.com', 'ratixpay.site'),
        updated_at = CURRENT_TIMESTAMP
    WHERE descricao LIKE '%ratixpay.com%';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '  ✅ descricao: % registros atualizados', updated_count;
END $$;

-- =====================================================
-- 5. ATUALIZAR ORDER BUMP PRODUTOS (se houver URLs)
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎁 Atualizando URLs em Order Bumps...';
    
    -- Verificar se há campo order_bump_produtos
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'produtos' 
        AND column_name = 'order_bump_produtos'
    ) THEN
        -- Atualizar em campos JSON de order_bump
        UPDATE produtos
        SET 
            order_bump_produtos = (
                SELECT jsonb_agg(
                    CASE 
                        WHEN value::jsonb->>'imagem_url' IS NOT NULL THEN
                            jsonb_set(
                                value::jsonb,
                                '{imagem_url}',
                                to_jsonb(REPLACE(value::jsonb->>'imagem_url', 'ratixpay.com', 'ratixpay.site'))
                            )
                        ELSE value::jsonb
                    END
                )
                FROM jsonb_array_elements(COALESCE(order_bump_produtos, '[]'::jsonb))
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE order_bump_produtos::text LIKE '%ratixpay.com%';
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '  ✅ order_bump_produtos: % registros atualizados', updated_count;
    END IF;
END $$;

COMMIT;

-- =====================================================
-- RELATÓRIO FINAL
-- =====================================================
DO $$ 
DECLARE
    total_produtos INTEGER;
    produtos_com_urls INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_produtos FROM produtos;
    
    SELECT COUNT(*) INTO produtos_com_urls
    FROM produtos
    WHERE 
        imagem_url LIKE '%ratixpay.site%'
        OR link_conteudo LIKE '%ratixpay.site%'
        OR descricao LIKE '%ratixpay.site%';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ATUALIZAÇÃO DE PRODUTOS CONCLUÍDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Total de produtos: %', total_produtos;
    RAISE NOTICE '🔄 Produtos com URLs atualizadas: %', produtos_com_urls;
    RAISE NOTICE '';
    RAISE NOTICE 'Campos atualizados:';
    RAISE NOTICE '  ✅ imagem_url';
    RAISE NOTICE '  ✅ link_conteudo';
    RAISE NOTICE '  ✅ descricao';
    RAISE NOTICE '  ✅ remarketing_config';
    RAISE NOTICE '  ✅ order_bump_produtos';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

-- Exibir produtos que ainda podem ter URLs antigas
SELECT 
    id,
    nome,
    CASE 
        WHEN imagem_url LIKE '%ratixpay.com%' THEN '⚠️ imagem_url'
        WHEN link_conteudo LIKE '%ratixpay.com%' THEN '⚠️ link_conteudo'
        WHEN descricao LIKE '%ratixpay.com%' THEN '⚠️ descricao'
        ELSE 'OK'
    END as campo_com_url_antiga
FROM produtos
WHERE 
    imagem_url LIKE '%ratixpay.com%'
    OR link_conteudo LIKE '%ratixpay.com%'
    OR descricao LIKE '%ratixpay.com%'
LIMIT 10;

