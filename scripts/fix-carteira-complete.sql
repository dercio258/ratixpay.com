-- ============================================
-- SCRIPT COMPLETO PARA CORRIGIR CARTEIRAS
-- Corrige todos os campos legados obrigatórios
-- ============================================

-- 1. ATUALIZAR REGISTROS EXISTENTES
UPDATE carteiras 
SET contacto = COALESCE(NULLIF(contacto, ''), contacto_mpesa, contacto_emola, '')
WHERE contacto IS NULL OR contacto = '';

UPDATE carteiras 
SET nome_titular = COALESCE(NULLIF(nome_titular, ''), nome_titular_mpesa, nome_titular_emola, '')
WHERE nome_titular IS NULL OR nome_titular = '';

UPDATE carteiras 
SET email_titular = COALESCE(NULLIF(email_titular, ''), email, '')
WHERE email_titular IS NULL OR email_titular = '';

UPDATE carteiras 
SET metodo_saque = COALESCE(NULLIF(metodo_saque, ''), 'Mpesa')
WHERE metodo_saque IS NULL OR metodo_saque = '';

-- 2. CORRIGIR/CRIAR COLUNAS COM DEFAULT
DO $$ 
BEGIN
    -- contacto
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'contacto') THEN
        ALTER TABLE carteiras ALTER COLUMN contacto SET DEFAULT '';
        ALTER TABLE carteiras ALTER COLUMN contacto SET NOT NULL;
        RAISE NOTICE 'contacto configurado';
    ELSE
        ALTER TABLE carteiras ADD COLUMN contacto VARCHAR(20) NOT NULL DEFAULT '';
        RAISE NOTICE 'contacto criado';
    END IF;
    
    -- nome_titular
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'nome_titular') THEN
        ALTER TABLE carteiras ALTER COLUMN nome_titular SET DEFAULT '';
        ALTER TABLE carteiras ALTER COLUMN nome_titular SET NOT NULL;
        RAISE NOTICE 'nome_titular configurado';
    ELSE
        ALTER TABLE carteiras ADD COLUMN nome_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'nome_titular criado';
    END IF;
    
    -- email_titular
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'email_titular') THEN
        ALTER TABLE carteiras ALTER COLUMN email_titular SET DEFAULT '';
        ALTER TABLE carteiras ALTER COLUMN email_titular SET NOT NULL;
        RAISE NOTICE 'email_titular configurado';
    ELSE
        ALTER TABLE carteiras ADD COLUMN email_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'email_titular criado';
    END IF;
    
    -- metodo_saque
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'metodo_saque') THEN
        ALTER TABLE carteiras ALTER COLUMN metodo_saque SET DEFAULT 'Mpesa';
        ALTER TABLE carteiras ALTER COLUMN metodo_saque SET NOT NULL;
        RAISE NOTICE 'metodo_saque configurado';
    ELSE
        ALTER TABLE carteiras ADD COLUMN metodo_saque VARCHAR(50) NOT NULL DEFAULT 'Mpesa';
        RAISE NOTICE 'metodo_saque criado';
    END IF;
END $$;

-- 3. GARANTIR QUE TODOS ESTÃO PREENCHIDOS
UPDATE carteiras 
SET contacto = COALESCE(NULLIF(contacto, ''), contacto_mpesa, '')
WHERE contacto IS NULL OR contacto = '';

UPDATE carteiras 
SET nome_titular = COALESCE(NULLIF(nome_titular, ''), nome_titular_mpesa, '')
WHERE nome_titular IS NULL OR nome_titular = '';

UPDATE carteiras 
SET email_titular = COALESCE(NULLIF(email_titular, ''), email, '')
WHERE email_titular IS NULL OR email_titular = '';

-- 4. VERIFICAR
SELECT 
    COUNT(*) as total,
    COUNT(contacto) as com_contacto,
    COUNT(nome_titular) as com_nome_titular,
    COUNT(email_titular) as com_email_titular,
    COUNT(metodo_saque) as com_metodo_saque
FROM carteiras;

