-- Script SQL para corrigir estrutura da coluna contacto na tabela carteiras
-- Garante que contacto tenha DEFAULT value e seja compatível com o modelo

-- 1. Atualizar registros existentes que são NULL ou vazios
UPDATE carteiras 
SET contacto = COALESCE(
    NULLIF(contacto, ''),
    contacto_mpesa,
    contacto_emola,
    ''
)
WHERE contacto IS NULL OR contacto = '';

-- Atualizar nome_titular também
UPDATE carteiras 
SET nome_titular = COALESCE(
    NULLIF(nome_titular, ''),
    nome_titular_mpesa,
    nome_titular_emola,
    ''
)
WHERE nome_titular IS NULL OR nome_titular = '';

-- 2. Verificar se a coluna existe e ajustar estrutura
DO $$ 
BEGIN
    -- Verificar se a coluna existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'contacto'
    ) THEN
        -- Adicionar DEFAULT se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'carteiras' 
            AND column_name = 'contacto'
            AND column_default IS NOT NULL
            AND column_default != 'null'
        ) THEN
            ALTER TABLE carteiras 
            ALTER COLUMN contacto 
            SET DEFAULT '';
            RAISE NOTICE 'DEFAULT value adicionado à coluna contacto';
        ELSE
            RAISE NOTICE 'Coluna contacto já tem DEFAULT value';
        END IF;
        
        -- Garantir que não permite NULL
        ALTER TABLE carteiras 
        ALTER COLUMN contacto 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna contacto configurada corretamente';
    ELSE
        -- Criar coluna se não existir
        ALTER TABLE carteiras 
        ADD COLUMN contacto VARCHAR(20) NOT NULL DEFAULT '';
        RAISE NOTICE 'Coluna contacto criada';
    END IF;
    
    -- Verificar e configurar nome_titular
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'nome_titular'
    ) THEN
        -- Adicionar DEFAULT se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'carteiras' 
            AND column_name = 'nome_titular'
            AND column_default IS NOT NULL
            AND column_default != 'null'
        ) THEN
            ALTER TABLE carteiras 
            ALTER COLUMN nome_titular 
            SET DEFAULT '';
            RAISE NOTICE 'DEFAULT value adicionado à coluna nome_titular';
        END IF;
        
        -- Garantir que não permite NULL
        ALTER TABLE carteiras 
        ALTER COLUMN nome_titular 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna nome_titular configurada corretamente';
    ELSE
        -- Criar coluna se não existir
        ALTER TABLE carteiras 
        ADD COLUMN nome_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'Coluna nome_titular criada';
    END IF;
END $$;

-- 3. Garantir que todos os registros tenham contacto e nome_titular preenchidos
UPDATE carteiras 
SET contacto = COALESCE(
    NULLIF(contacto, ''),
    contacto_mpesa,
    contacto_emola,
    ''
)
WHERE contacto IS NULL OR contacto = '';

UPDATE carteiras 
SET nome_titular = COALESCE(
    NULLIF(nome_titular, ''),
    nome_titular_mpesa,
    nome_titular_emola,
    ''
)
WHERE nome_titular IS NULL OR nome_titular = '';

-- 4. Verificar estrutura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'carteiras' 
AND column_name IN ('contacto', 'nome_titular')
ORDER BY column_name;

-- 5. Verificar estatísticas
SELECT 
    COUNT(*) as total_carteiras,
    COUNT(contacto) as com_contacto,
    COUNT(CASE WHEN contacto IS NULL OR contacto = '' THEN 1 END) as sem_contacto,
    COUNT(nome_titular) as com_nome_titular,
    COUNT(CASE WHEN nome_titular IS NULL OR nome_titular = '' THEN 1 END) as sem_nome_titular
FROM carteiras;

