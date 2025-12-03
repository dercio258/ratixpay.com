-- Script SQL completo para corrigir TODOS os campos legados da tabela carteiras
-- Garante que todos os campos obrigatórios tenham DEFAULT value e sejam NOT NULL

-- ============================================
-- 1. ATUALIZAR REGISTROS EXISTENTES
-- ============================================

-- Atualizar contacto
UPDATE carteiras 
SET contacto = COALESCE(
    NULLIF(contacto, ''),
    contacto_mpesa,
    contacto_emola,
    ''
)
WHERE contacto IS NULL OR contacto = '';

-- Atualizar nome_titular
UPDATE carteiras 
SET nome_titular = COALESCE(
    NULLIF(nome_titular, ''),
    nome_titular_mpesa,
    nome_titular_emola,
    ''
)
WHERE nome_titular IS NULL OR nome_titular = '';

-- Atualizar email_titular com email da carteira (se disponível)
UPDATE carteiras 
SET email_titular = COALESCE(
    NULLIF(email_titular, ''),
    email,
    ''
)
WHERE email_titular IS NULL OR email_titular = '';

-- ============================================
-- 2. CORRIGIR ESTRUTURA DAS COLUNAS
-- ============================================

DO $$ 
BEGIN
    -- ===== CONTACTO =====
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
        END IF;
        
        -- Garantir NOT NULL
        ALTER TABLE carteiras 
        ALTER COLUMN contacto 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna contacto configurada';
    ELSE
        ALTER TABLE carteiras 
        ADD COLUMN contacto VARCHAR(20) NOT NULL DEFAULT '';
        RAISE NOTICE 'Coluna contacto criada';
    END IF;
    
    -- ===== NOME_TITULAR =====
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
        
        -- Garantir NOT NULL
        ALTER TABLE carteiras 
        ALTER COLUMN nome_titular 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna nome_titular configurada';
    ELSE
        ALTER TABLE carteiras 
        ADD COLUMN nome_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'Coluna nome_titular criada';
    END IF;
    
    -- ===== EMAIL_TITULAR =====
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'email_titular'
    ) THEN
        -- Adicionar DEFAULT se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'carteiras' 
            AND column_name = 'email_titular'
            AND column_default IS NOT NULL
            AND column_default != 'null'
        ) THEN
            ALTER TABLE carteiras 
            ALTER COLUMN email_titular 
            SET DEFAULT '';
            RAISE NOTICE 'DEFAULT value adicionado à coluna email_titular';
        END IF;
        
        -- Garantir NOT NULL
        ALTER TABLE carteiras 
        ALTER COLUMN email_titular 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna email_titular configurada';
    ELSE
        ALTER TABLE carteiras 
        ADD COLUMN email_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'Coluna email_titular criada';
    END IF;
    
    -- ===== METODO_SAQUE =====
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
            AND column_default != 'null'
        ) THEN
            ALTER TABLE carteiras 
            ALTER COLUMN metodo_saque 
            SET DEFAULT 'Mpesa';
            RAISE NOTICE 'DEFAULT value adicionado à coluna metodo_saque';
        END IF;
        
        -- Garantir NOT NULL
        ALTER TABLE carteiras 
        ALTER COLUMN metodo_saque 
        SET NOT NULL;
        
        RAISE NOTICE 'Coluna metodo_saque configurada';
    ELSE
        ALTER TABLE carteiras 
        ADD COLUMN metodo_saque VARCHAR(50) NOT NULL DEFAULT 'Mpesa';
        RAISE NOTICE 'Coluna metodo_saque criada';
    END IF;
END $$;

-- ============================================
-- 3. GARANTIR QUE TODOS OS REGISTROS ESTÃO PREENCHIDOS
-- ============================================

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

UPDATE carteiras 
SET email_titular = COALESCE(
    NULLIF(email_titular, ''),
    email,
    ''
)
WHERE email_titular IS NULL OR email_titular = '';

UPDATE carteiras 
SET metodo_saque = COALESCE(
    NULLIF(metodo_saque, ''),
    'Mpesa'
)
WHERE metodo_saque IS NULL OR metodo_saque = '';

-- ============================================
-- 4. VERIFICAR ESTRUTURA FINAL
-- ============================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'carteiras' 
AND column_name IN ('contacto', 'nome_titular', 'email_titular', 'metodo_saque')
ORDER BY column_name;

-- ============================================
-- 5. VERIFICAR ESTATÍSTICAS
-- ============================================

SELECT 
    COUNT(*) as total_carteiras,
    COUNT(contacto) as com_contacto,
    COUNT(CASE WHEN contacto IS NULL OR contacto = '' THEN 1 END) as sem_contacto,
    COUNT(nome_titular) as com_nome_titular,
    COUNT(CASE WHEN nome_titular IS NULL OR nome_titular = '' THEN 1 END) as sem_nome_titular,
    COUNT(email_titular) as com_email_titular,
    COUNT(CASE WHEN email_titular IS NULL OR email_titular = '' THEN 1 END) as sem_email_titular,
    COUNT(metodo_saque) as com_metodo_saque,
    COUNT(CASE WHEN metodo_saque IS NULL OR metodo_saque = '' THEN 1 END) as sem_metodo_saque
FROM carteiras;

