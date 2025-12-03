-- ===========================================
-- VERIFICAR E CORRIGIR PRODUTOS ATIVOS
-- ===========================================

-- Primeiro, mostrar o estado atual
SELECT 
    'ESTADO ATUAL' as tipo,
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

-- Mostrar produtos ativos que NÃO estão aprovados (PROBLEMA!)
SELECT 
    'PROBLEMAS ENCONTRADOS' as tipo,
    id,
    custom_id,
    nome,
    ativo,
    status_aprovacao,
    vendas
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado'
ORDER BY created_at DESC;

-- CORRIGIR: Forçar aprovação de TODOS os produtos ativos
UPDATE produtos 
SET status_aprovacao = 'aprovado', 
    motivo_rejeicao = NULL
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

-- Mostrar resultado após correção
SELECT 
    'APÓS CORREÇÃO' as tipo,
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

-- Verificar se ainda há problemas (deve retornar 0)
SELECT 
    COUNT(*) as produtos_ativos_nao_aprovados,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Tudo correto! Todos os produtos ativos estão aprovados.'
        ELSE '⚠️ Ainda há ' || COUNT(*) || ' produtos ativos não aprovados!'
    END as resultado
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';

