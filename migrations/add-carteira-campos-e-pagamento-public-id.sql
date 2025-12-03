-- Migração para adicionar campos à tabela carteiras e pagamentos
-- Data: 2024-12-25

-- 1. Adicionar novos campos à tabela carteiras (se não existirem)
DO $$ 
BEGIN
    -- Verificar e adicionar contacto_mpesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'contacto_mpesa'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN contacto_mpesa VARCHAR(20) NULL;
        RAISE NOTICE 'Coluna contacto_mpesa adicionada';
    END IF;

    -- Verificar e adicionar nome_titular_mpesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'nome_titular_mpesa'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN nome_titular_mpesa VARCHAR(255) NULL;
        RAISE NOTICE 'Coluna nome_titular_mpesa adicionada';
    END IF;

    -- Verificar e adicionar contacto_emola
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'contacto_emola'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN contacto_emola VARCHAR(20) NULL;
        RAISE NOTICE 'Coluna contacto_emola adicionada';
    END IF;

    -- Verificar e adicionar nome_titular_emola
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'nome_titular_emola'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN nome_titular_emola VARCHAR(255) NULL;
        RAISE NOTICE 'Coluna nome_titular_emola adicionada';
    END IF;

    -- Verificar e adicionar email (se não existir)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' 
        AND column_name = 'email'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN email VARCHAR(255) NULL;
        RAISE NOTICE 'Coluna email adicionada';
    END IF;

    -- Remover carteiras duplicadas antes de adicionar constraint unique
    -- Manter apenas a carteira mais recente para cada vendedor
    DELETE FROM carteiras c1
    WHERE EXISTS (
        SELECT 1 FROM carteiras c2
        WHERE c2.vendedor_id = c1.vendedor_id
        AND c2.id != c1.id
        AND c2.created_at > c1.created_at
    );
    
    -- Se não houver created_at, usar id como critério
    DELETE FROM carteiras c1
    WHERE EXISTS (
        SELECT 1 FROM carteiras c2
        WHERE c2.vendedor_id = c1.vendedor_id
        AND c2.id != c1.id
        AND c2.id::text > c1.id::text
    );
    
    -- Adicionar constraint unique em vendedor_id para garantir apenas uma carteira por usuário
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'carteiras_vendedor_id_key'
    ) THEN
        ALTER TABLE carteiras ADD CONSTRAINT carteiras_vendedor_id_key UNIQUE (vendedor_id);
        RAISE NOTICE 'Constraint unique em vendedor_id adicionada';
    END IF;
END $$;

-- 2. Adicionar campos à tabela pagamentos (se não existirem)
DO $$ 
BEGIN
    -- Verificar e adicionar public_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'public_id'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN public_id VARCHAR(20) NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_public_id_key ON pagamentos(public_id) WHERE public_id IS NOT NULL;
        RAISE NOTICE 'Coluna public_id adicionada';
    END IF;

    -- Verificar e adicionar valor_liquido
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'valor_liquido'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN valor_liquido DECIMAL(10, 2) NULL;
        RAISE NOTICE 'Coluna valor_liquido adicionada';
    END IF;

    -- Verificar e adicionar taxa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'taxa'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN taxa DECIMAL(10, 2) NULL DEFAULT 0;
        RAISE NOTICE 'Coluna taxa adicionada';
    END IF;

    -- Verificar e adicionar nome_titular
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'nome_titular'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN nome_titular VARCHAR(255) NULL;
        RAISE NOTICE 'Coluna nome_titular adicionada';
    END IF;

    -- Verificar e adicionar ip_solicitacao
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'ip_solicitacao'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN ip_solicitacao VARCHAR(45) NULL;
        RAISE NOTICE 'Coluna ip_solicitacao adicionada';
    END IF;

    -- Verificar e adicionar user_agent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' 
        AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN user_agent TEXT NULL;
        RAISE NOTICE 'Coluna user_agent adicionada';
    END IF;
END $$;

-- 3. Comentários nas colunas
COMMENT ON COLUMN carteiras.contacto_mpesa IS 'Número de contacto Mpesa';
COMMENT ON COLUMN carteiras.nome_titular_mpesa IS 'Nome do titular Mpesa';
COMMENT ON COLUMN carteiras.contacto_emola IS 'Número de contacto Emola';
COMMENT ON COLUMN carteiras.nome_titular_emola IS 'Nome do titular Emola';
COMMENT ON COLUMN carteiras.email IS 'Email do titular';
COMMENT ON COLUMN pagamentos.public_id IS 'ID público memorável para exibição e pesquisa (ex: SAQ-123456)';
COMMENT ON COLUMN pagamentos.valor_liquido IS 'Valor líquido após dedução de taxas';
COMMENT ON COLUMN pagamentos.taxa IS 'Taxa aplicada ao saque';
COMMENT ON COLUMN pagamentos.nome_titular IS 'Nome do titular da conta';
COMMENT ON COLUMN pagamentos.ip_solicitacao IS 'IP de onde foi feita a solicitação';
COMMENT ON COLUMN pagamentos.user_agent IS 'User agent do navegador';

