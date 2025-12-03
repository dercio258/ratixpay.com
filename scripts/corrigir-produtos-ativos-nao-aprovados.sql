-- ===========================================
-- CORREÇÃO: Produtos Ativos Não Aprovados
-- ===========================================

DO $$ 
DECLARE
    produtos_afetados INTEGER;
BEGIN
    -- Contar produtos que precisam ser corrigidos
    SELECT COUNT(*) INTO produtos_afetados
    FROM produtos
    WHERE ativo = true AND status_aprovacao != 'aprovado';
    
    IF produtos_afetados > 0 THEN
        RAISE NOTICE 'Encontrados % produtos ativos que não estão aprovados. Corrigindo...', produtos_afetados;
        
        -- Corrigir produtos ativos para status aprovado
        UPDATE produtos 
        SET status_aprovacao = 'aprovado', 
            motivo_rejeicao = NULL
        WHERE ativo = true 
        AND status_aprovacao != 'aprovado';
        
        RAISE NOTICE '✅ % produtos corrigidos para status aprovado', produtos_afetados;
    ELSE
        RAISE NOTICE '✅ Nenhum produto ativo não aprovado encontrado. Tudo está correto!';
    END IF;
END $$;

-- Verificar resultado
SELECT 
    COUNT(*) as produtos_ativos_nao_aprovados
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';

-- Se retornar 0, está tudo correto!
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Todos os produtos ativos estão aprovados!'
        ELSE '⚠️ Ainda existem ' || COUNT(*) || ' produtos ativos não aprovados'
    END as status
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';

