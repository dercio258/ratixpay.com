-- Migração: Adicionar campos de aprovação à tabela produtos
-- Data: 2025-11-15

-- Adicionar coluna status_aprovacao
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(50) DEFAULT 'aprovado' 
CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));

-- Adicionar coluna motivo_rejeicao
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;

-- Adicionar comentário nas colunas
COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação do produto: aprovado (automático), rejeitado, pendente_aprovacao (aguardando admin)';
COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';

-- Atualizar produtos existentes para terem status 'aprovado' se estiverem ativos
UPDATE produtos 
SET status_aprovacao = 'aprovado' 
WHERE status_aprovacao IS NULL AND ativo = true;

-- Atualizar produtos existentes para terem status 'rejeitado' se estiverem inativos e não tiverem status
UPDATE produtos 
SET status_aprovacao = 'rejeitado' 
WHERE status_aprovacao IS NULL AND ativo = false;

-- Garantir que produtos ativos tenham status aprovado
UPDATE produtos 
SET status_aprovacao = 'aprovado' 
WHERE ativo = true AND status_aprovacao != 'aprovado';

