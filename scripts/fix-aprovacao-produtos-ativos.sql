-- ===========================================
-- CORREÇÃO: Garantir estrutura correta de aprovação
-- e evitar pedir aprovação de produtos ativos já aprovados
-- ===========================================

DO $$ 
BEGIN
    -- 1. Verificar e corrigir estrutura da coluna status_aprovacao
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'status_aprovacao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN status_aprovacao VARCHAR(50) DEFAULT 'aprovado';
        RAISE NOTICE 'Coluna status_aprovacao adicionada';
    END IF;

    -- 2. Adicionar constraint CHECK se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'produtos_status_aprovacao_check'
    ) THEN
        ALTER TABLE produtos 
        ADD CONSTRAINT produtos_status_aprovacao_check 
        CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));
        RAISE NOTICE 'Constraint CHECK adicionada';
    END IF;

    -- 3. Garantir que produtos ATIVOS e já aprovados permaneçam aprovados
    -- Produtos ativos devem ter status_aprovacao = 'aprovado'
    UPDATE produtos 
    SET status_aprovacao = 'aprovado'
    WHERE ativo = true 
    AND status_aprovacao IS NULL;

    -- Produtos ativos com status diferente de 'aprovado' devem ser corrigidos
    UPDATE produtos 
    SET status_aprovacao = 'aprovado', 
        motivo_rejeicao = NULL
    WHERE ativo = true 
    AND status_aprovacao != 'aprovado'
    AND status_aprovacao IS NOT NULL;

    RAISE NOTICE 'Produtos ativos corrigidos para status aprovado';

    -- 4. Garantir que produtos inativos tenham status apropriado
    -- Se estiver inativo sem status, definir como rejeitado apenas se não tiver vendas
    UPDATE produtos 
    SET status_aprovacao = 'rejeitado'
    WHERE ativo = false 
    AND status_aprovacao IS NULL
    AND (vendas IS NULL OR vendas = 0);

    -- 5. Produtos inativos mas com vendas devem manter status aprovado (já foram aprovados antes)
    UPDATE produtos 
    SET status_aprovacao = 'aprovado'
    WHERE ativo = false 
    AND (vendas IS NOT NULL AND vendas > 0)
    AND status_aprovacao != 'aprovado';

    RAISE NOTICE 'Produtos inativos com vendas mantidos como aprovados';

    -- 6. Adicionar comentário nas colunas se não existir
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'status_aprovacao'
    ) THEN
        COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação: aprovado (produtos ativos devem estar aprovados), rejeitado, pendente_aprovacao (apenas novos produtos)';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'motivo_rejeicao'
    ) THEN
        COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';
    END IF;

    RAISE NOTICE 'Estrutura de aprovação corrigida com sucesso!';
END $$;

-- Verificar resultados
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

-- Verificar se há produtos ativos que não estão aprovados (erro crítico)
SELECT 
    COUNT(*) as produtos_ativos_nao_aprovados
FROM produtos
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

