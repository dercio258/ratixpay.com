-- ===========================================
-- Script para atualizar domínio de ratixpay.com para ratixpay.site
-- Atualiza nomes de arquivos e URLs no banco de dados
-- ===========================================

-- Atualizar URLs em produtos (imagem_url)
UPDATE produtos 
SET imagem_url = REPLACE(imagem_url, 'ratixpay.com', 'ratixpay.site')
WHERE imagem_url LIKE '%ratixpay.com%';

-- Atualizar URLs em produtos (link_conteudo)
UPDATE produtos 
SET link_conteudo = REPLACE(link_conteudo, 'ratixpay.com', 'ratixpay.site')
WHERE link_conteudo LIKE '%ratixpay.com%';

-- Atualizar URLs em vendas (se houver campos de URL)
-- Verificar se a coluna existe antes de atualizar
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'vendas' AND column_name = 'url_produto') THEN
        UPDATE vendas 
        SET url_produto = REPLACE(url_produto, 'ratixpay.com', 'ratixpay.site')
        WHERE url_produto LIKE '%ratixpay.com%';
    END IF;
END $$;

-- Atualizar URLs em afiliados (link_afiliado)
UPDATE afiliados 
SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
WHERE link_afiliado LIKE '%ratixpay.com%';

-- Atualizar URLs em link_trackings (link_original e link_afiliado)
UPDATE link_trackings 
SET link_original = REPLACE(link_original, 'ratixpay.com', 'ratixpay.site')
WHERE link_original LIKE '%ratixpay.com%';

UPDATE link_trackings 
SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
WHERE link_afiliado LIKE '%ratixpay.com%';

-- Atualizar qualquer campo JSON que possa conter URLs
-- Exemplo: tracking_data em vendas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'vendas' AND column_name = 'tracking_data') THEN
        UPDATE vendas 
        SET tracking_data = jsonb_set(
            tracking_data::jsonb,
            '{url}',
            to_jsonb(REPLACE(tracking_data->>'url', 'ratixpay.com', 'ratixpay.site'))
        )::jsonb
        WHERE tracking_data::text LIKE '%ratixpay.com%';
    END IF;
END $$;

-- Mostrar estatísticas das atualizações
SELECT 
    'produtos.imagem_url' as tabela_coluna,
    COUNT(*) as registros_atualizados
FROM produtos 
WHERE imagem_url LIKE '%ratixpay.site%'
UNION ALL
SELECT 
    'produtos.link_conteudo' as tabela_coluna,
    COUNT(*) as registros_atualizados
FROM produtos 
WHERE link_conteudo LIKE '%ratixpay.site%'
UNION ALL
SELECT 
    'afiliados.link_afiliado' as tabela_coluna,
    COUNT(*) as registros_atualizados
FROM afiliados 
WHERE link_afiliado LIKE '%ratixpay.site%'
UNION ALL
SELECT 
    'link_trackings.link_original' as tabela_coluna,
    COUNT(*) as registros_atualizados
FROM link_trackings 
WHERE link_original LIKE '%ratixpay.site%'
UNION ALL
SELECT 
    'link_trackings.link_afiliado' as tabela_coluna,
    COUNT(*) as registros_atualizados
FROM link_trackings 
WHERE link_afiliado LIKE '%ratixpay.site%';

