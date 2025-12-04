-- ===========================================
-- VERIFICAR E CORRIGIR PRODUTO ESPECÍFICO
-- ===========================================
-- Use: su - postgres -c "psql -d ratixpay -f scripts/verificar-produto-especifico.sql"

-- Verificar produto com custom_id = 'AI2B34PT7'
SELECT 
    id,
    custom_id,
    public_id,
    nome,
    ativo,
    status_aprovacao,
    motivo_rejeicao,
    vendedor_id,
    created_at,
    updated_at
FROM produtos
WHERE custom_id = 'AI2B34PT7' 
   OR public_id = 'AI2B34PT7'
   OR id::text LIKE '%AI2B34PT7%';

-- Verificar se produto está ativo mas não aprovado
SELECT 
    CASE 
        WHEN ativo = true AND status_aprovacao != 'aprovado' THEN '⚠️ PROBLEMA: Produto ativo mas não aprovado'
        WHEN ativo = true AND status_aprovacao = 'aprovado' THEN '✅ OK: Produto ativo e aprovado'
        WHEN ativo = false AND status_aprovacao = 'aprovado' THEN '⚠️ Produto inativo mas aprovado'
        ELSE '❌ Produto inativo e não aprovado'
    END as status,
    custom_id,
    nome,
    ativo,
    status_aprovacao
FROM produtos
WHERE custom_id = 'AI2B34PT7' 
   OR public_id = 'AI2B34PT7';

-- CORRIGIR: Se produto estiver ativo, garantir que está aprovado
UPDATE produtos 
SET 
    status_aprovacao = 'aprovado',
    motivo_rejeicao = NULL
WHERE (custom_id = 'AI2B34PT7' OR public_id = 'AI2B34PT7')
  AND ativo = true 
  AND status_aprovacao != 'aprovado';

-- Verificar resultado após correção
SELECT 
    'APÓS CORREÇÃO' as tipo,
    custom_id,
    nome,
    ativo,
    status_aprovacao,
    motivo_rejeicao
FROM produtos
WHERE custom_id = 'AI2B34PT7' 
   OR public_id = 'AI2B34PT7';

