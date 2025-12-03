-- ===========================================
-- FORÇAR APROVAÇÃO DE TODOS OS PRODUTOS ATIVOS
-- ===========================================

DO $$ 
DECLARE
    produtos_corrigidos INTEGER;
    produtos_afetados INTEGER;
BEGIN
    -- Contar produtos que precisam ser corrigidos
    SELECT COUNT(*) INTO produtos_afetados
    FROM produtos
    WHERE ativo = true AND status_aprovacao != 'aprovado';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Forçar Aprovação de Produtos Ativos';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Produtos ativos encontrados que não estão aprovados: %', produtos_afetados;
    
    IF produtos_afetados > 0 THEN
        -- FORÇAR aprovação de TODOS os produtos ativos
        UPDATE produtos 
        SET status_aprovacao = 'aprovado', 
            motivo_rejeicao = NULL
        WHERE ativo = true 
        AND status_aprovacao != 'aprovado';
        
        GET DIAGNOSTICS produtos_corrigidos = ROW_COUNT;
        
        RAISE NOTICE '✅ % produtos ativos foram APROVADOS automaticamente', produtos_corrigidos;
    ELSE
        RAISE NOTICE '✅ Nenhum produto ativo precisa ser corrigido. Tudo está correto!';
    END IF;
    
    -- Também garantir que produtos inativos com vendas sejam mantidos como aprovados
    UPDATE produtos 
    SET status_aprovacao = 'aprovado'
    WHERE ativo = false 
    AND (vendas IS NOT NULL AND vendas > 0)
    AND status_aprovacao != 'aprovado';
    
    RAISE NOTICE '========================================';
END $$;

-- Verificar resultado final
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

-- Verificar se ainda há produtos ativos não aprovados (deve retornar 0)
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCESSO: Todos os produtos ativos estão aprovados!'
        ELSE '⚠️ ATENÇÃO: Ainda existem ' || COUNT(*) || ' produtos ativos não aprovados'
    END as resultado
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';

-- Listar produtos ativos que ainda não estão aprovados (se houver)
SELECT 
    id,
    custom_id,
    nome,
    ativo,
    status_aprovacao,
    vendas
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado'
LIMIT 10;

