-- ===========================================
-- CORRIGIR TODOS OS PRODUTOS ATIVOS
-- ===========================================
-- Este script força aprovação de TODOS os produtos ativos
-- Use: su - postgres -c "psql -d ratixpay -f scripts/corrigir-todos-produtos-ativos.sql"

-- Mostrar produtos ativos que não estão aprovados
SELECT 
    'PRODUTOS COM PROBLEMA' as tipo,
    custom_id,
    public_id,
    nome,
    ativo,
    status_aprovacao,
    motivo_rejeicao
FROM produtos
WHERE ativo = true 
AND status_aprovacao != 'aprovado'
ORDER BY updated_at DESC;

-- CORRIGIR: Forçar aprovação de TODOS os produtos ativos
UPDATE produtos 
SET 
    status_aprovacao = 'aprovado',
    motivo_rejeicao = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

-- Mostrar resultado
SELECT 
    'RESULTADO' as tipo,
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

-- Verificar se ainda há problemas (deve retornar 0)
SELECT 
    COUNT(*) as produtos_com_problema,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCESSO: Todos os produtos ativos estão aprovados!'
        ELSE '⚠️ AINDA HÁ ' || COUNT(*) || ' PRODUTOS ATIVOS NÃO APROVADOS!'
    END as resultado
FROM produtos
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

