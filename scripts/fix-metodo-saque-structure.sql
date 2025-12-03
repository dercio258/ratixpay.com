-- Script SQL para corrigir estrutura da coluna metodo_saque na tabela carteiras
-- Garante que a coluna tenha DEFAULT value para evitar erros NOT NULL

-- 1. Atualizar registros existentes que são NULL
UPDATE carteiras 
SET metodo_saque = 'Mpesa' 
WHERE metodo_saque IS NULL;

-- 2. Garantir que a coluna tenha DEFAULT (se não tiver)
DO $$ 
BEGIN
    -- Verificar se a coluna existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'metodo_saque'
    ) THEN
        -- Adicionar DEFAULT se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'carteiras' 
            AND column_name = 'metodo_saque'
            AND column_default IS NOT NULL
        ) THEN
            ALTER TABLE carteiras 
            ALTER COLUMN metodo_saque 
            SET DEFAULT 'Mpesa';
            RAISE NOTICE 'DEFAULT value adicionado à coluna metodo_saque';
        ELSE
            RAISE NOTICE 'Coluna metodo_saque já tem DEFAULT value';
        END IF;
        
        -- Garantir que não permite NULL
        ALTER TABLE carteiras 
        ALTER COLUMN metodo_saque 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna metodo_saque configurada corretamente';
    ELSE
        -- Criar coluna se não existir
        ALTER TABLE carteiras 
        ADD COLUMN metodo_saque VARCHAR(50) NOT NULL DEFAULT 'Mpesa';
        RAISE NOTICE 'Coluna metodo_saque criada';
    END IF;
END $$;

