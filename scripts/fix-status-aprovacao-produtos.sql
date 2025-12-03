-- ===========================================
-- CORREÇÃO URGENTE: Adicionar coluna status_aprovacao
-- ===========================================
-- Este script adiciona a coluna status_aprovacao que está faltando
-- e causando erro 500 ao carregar produtos

-- Verificar e adicionar coluna status_aprovacao
DO $$ 
BEGIN
    -- Adicionar coluna status_aprovacao se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'status_aprovacao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN status_aprovacao VARCHAR(50) DEFAULT 'aprovado';
        
        -- Adicionar constraint CHECK
        ALTER TABLE produtos 
        ADD CONSTRAINT produtos_status_aprovacao_check 
        CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));
        
        COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação do produto: aprovado (automático), rejeitado, pendente_aprovacao (aguardando admin)';
        
        RAISE NOTICE 'Coluna status_aprovacao adicionada à tabela produtos';
    ELSE
        RAISE NOTICE 'Coluna status_aprovacao já existe na tabela produtos';
    END IF;

    -- Adicionar coluna motivo_rejeicao se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'motivo_rejeicao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN motivo_rejeicao TEXT;
        COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';
        RAISE NOTICE 'Coluna motivo_rejeicao adicionada à tabela produtos';
    ELSE
        RAISE NOTICE 'Coluna motivo_rejeicao já existe na tabela produtos';
    END IF;

    -- Atualizar produtos existentes
    UPDATE produtos 
    SET status_aprovacao = 'aprovado' 
    WHERE status_aprovacao IS NULL AND ativo = true;

    UPDATE produtos 
    SET status_aprovacao = 'rejeitado' 
    WHERE status_aprovacao IS NULL AND ativo = false;
    
    RAISE NOTICE 'Produtos existentes atualizados com status_aprovacao';
END $$;

SELECT 'Coluna status_aprovacao adicionada com sucesso!' AS status;

