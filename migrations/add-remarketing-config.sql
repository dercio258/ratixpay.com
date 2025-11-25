-- Migração: Adicionar coluna remarketing_config à tabela produtos
-- Execute este script como superusuário do PostgreSQL ou com permissões adequadas

-- Adicionar coluna remarketing_config se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'remarketing_config'
    ) THEN
        ALTER TABLE produtos ADD COLUMN remarketing_config JSON;
        COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}';
        RAISE NOTICE 'Coluna remarketing_config adicionada à tabela produtos';
    ELSE
        RAISE NOTICE 'Coluna remarketing_config já existe na tabela produtos';
    END IF;
END $$;

