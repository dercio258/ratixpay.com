-- ============================================
-- SCRIPT PARA CORRIGIR NOME DO TITULAR EM PRODUÇÃO
-- Corrige carteiras sem nome_titular válido que causam erro em saques
-- ============================================

-- 1. GARANTIR QUE CAMPOS EXISTEM E TÊM DEFAULTS
DO $$ 
BEGIN
    -- Garantir que nome_titular_mpesa existe e não é NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'nome_titular_mpesa') THEN
        -- Permitir NULL temporariamente para atualizar
        ALTER TABLE carteiras ALTER COLUMN nome_titular_mpesa DROP NOT NULL;
        RAISE NOTICE 'nome_titular_mpesa: removido NOT NULL temporariamente';
    ELSE
        ALTER TABLE carteiras ADD COLUMN nome_titular_mpesa VARCHAR(255);
        RAISE NOTICE 'nome_titular_mpesa criado';
    END IF;
    
    -- Garantir que nome_titular_emola existe e não é NULL
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'nome_titular_emola') THEN
        ALTER TABLE carteiras ALTER COLUMN nome_titular_emola DROP NOT NULL;
        RAISE NOTICE 'nome_titular_emola: removido NOT NULL temporariamente';
    ELSE
        ALTER TABLE carteiras ADD COLUMN nome_titular_emola VARCHAR(255);
        RAISE NOTICE 'nome_titular_emola criado';
    END IF;
    
    -- Garantir que nome_titular (legado) existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carteiras' AND column_name = 'nome_titular') THEN
        ALTER TABLE carteiras ADD COLUMN nome_titular VARCHAR(255) NOT NULL DEFAULT '';
        RAISE NOTICE 'nome_titular criado';
    END IF;
END $$;

-- 2. PREENCHER nome_titular_mpesa COM DADOS EXISTENTES
-- Se estiver vazio, usar nome_titular (legado) ou nome do usuário
UPDATE carteiras c
SET nome_titular_mpesa = COALESCE(
    NULLIF(c.nome_titular_mpesa, ''),
    NULLIF(c.nome_titular, ''),
    (SELECT u.nome_completo FROM usuarios u WHERE u.id = c.vendedor_id),
    'Titular não informado'
)
WHERE nome_titular_mpesa IS NULL OR nome_titular_mpesa = '';

-- 3. PREENCHER nome_titular_emola COM DADOS EXISTENTES
UPDATE carteiras c
SET nome_titular_emola = COALESCE(
    NULLIF(c.nome_titular_emola, ''),
    NULLIF(c.nome_titular_mpesa, ''),
    NULLIF(c.nome_titular, ''),
    (SELECT u.nome_completo FROM usuarios u WHERE u.id = c.vendedor_id),
    'Titular não informado'
)
WHERE nome_titular_emola IS NULL OR nome_titular_emola = '';

-- 4. PREENCHER nome_titular (legado) COM DADOS DOS CAMPOS NOVOS
UPDATE carteiras
SET nome_titular = COALESCE(
    NULLIF(nome_titular, ''),
    nome_titular_mpesa,
    nome_titular_emola,
    'Titular não informado'
)
WHERE nome_titular IS NULL OR nome_titular = '';

-- 5. GARANTIR NOT NULL NOS CAMPOS PRINCIPAIS
DO $$ 
BEGIN
    -- Restaurar NOT NULL em nome_titular_mpesa
    UPDATE carteiras SET nome_titular_mpesa = 'Titular não informado' WHERE nome_titular_mpesa IS NULL;
    ALTER TABLE carteiras ALTER COLUMN nome_titular_mpesa SET NOT NULL;
    RAISE NOTICE 'nome_titular_mpesa: NOT NULL restaurado';
    
    -- Restaurar NOT NULL em nome_titular_emola
    UPDATE carteiras SET nome_titular_emola = 'Titular não informado' WHERE nome_titular_emola IS NULL;
    ALTER TABLE carteiras ALTER COLUMN nome_titular_emola SET NOT NULL;
    RAISE NOTICE 'nome_titular_emola: NOT NULL restaurado';
END $$;

-- 6. VERIFICAR RESULTADOS
SELECT 
    COUNT(*) as total_carteiras,
    COUNT(CASE WHEN nome_titular_mpesa IS NOT NULL AND nome_titular_mpesa != '' THEN 1 END) as com_nome_mpesa,
    COUNT(CASE WHEN nome_titular_emola IS NOT NULL AND nome_titular_emola != '' THEN 1 END) as com_nome_emola,
    COUNT(CASE WHEN nome_titular IS NOT NULL AND nome_titular != '' THEN 1 END) as com_nome_legado,
    COUNT(CASE WHEN (nome_titular_mpesa IS NULL OR nome_titular_mpesa = '') 
                AND (nome_titular_emola IS NULL OR nome_titular_emola = '') 
                AND (nome_titular IS NULL OR nome_titular = '') THEN 1 END) as sem_nome
FROM carteiras;

-- 7. LISTAR CARTEIRAS PROBLEMÁTICAS (se houver)
SELECT 
    c.id,
    c.vendedor_id,
    c.nome,
    c.nome_titular_mpesa,
    c.nome_titular_emola,
    c.nome_titular,
    c.metodo_saque,
    u.nome_completo as nome_usuario,
    u.email as email_usuario
FROM carteiras c
LEFT JOIN usuarios u ON u.id = c.vendedor_id
WHERE (c.nome_titular_mpesa IS NULL OR c.nome_titular_mpesa = '')
  AND (c.nome_titular_emola IS NULL OR c.nome_titular_emola = '')
  AND (c.nome_titular IS NULL OR c.nome_titular = '');

