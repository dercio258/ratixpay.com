-- ===========================================
-- SCRIPT COMPLETO DE SINCRONIZAÇÃO DO BANCO DE DADOS
-- Baseado no modelo database.js - Garante estrutura correta
-- ===========================================

-- ===========================================
-- 1. CORRIGIR PERMISSÕES DO SCHEMA PUBLIC
-- ===========================================

DO $$ 
DECLARE
    db_user_name TEXT;
BEGIN
    -- Tentar detectar o usuário do banco
    SELECT current_user INTO db_user_name;
    
    -- Conceder permissões necessárias
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', db_user_name);
    EXECUTE format('GRANT CREATE ON SCHEMA public TO %I', db_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', db_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', db_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I', db_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I', db_user_name);
    
    RAISE NOTICE 'Permissões do schema public concedidas ao usuário: %', db_user_name;
END $$;

-- ===========================================
-- 2. TABELA: PRODUTOS
-- ===========================================

DO $$ 
BEGIN
    -- status_aprovacao
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' AND column_name = 'status_aprovacao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN status_aprovacao VARCHAR(50) DEFAULT 'aprovado';
        
        -- Adicionar constraint CHECK
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'produtos_status_aprovacao_check'
        ) THEN
            ALTER TABLE produtos 
            ADD CONSTRAINT produtos_status_aprovacao_check 
            CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));
        END IF;
        
        COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação do produto: aprovado (automático), rejeitado, pendente_aprovacao (aguardando admin)';
        RAISE NOTICE 'Coluna status_aprovacao adicionada à tabela produtos';
    END IF;

    -- motivo_rejeicao
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' AND column_name = 'motivo_rejeicao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN motivo_rejeicao TEXT;
        COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';
        RAISE NOTICE 'Coluna motivo_rejeicao adicionada à tabela produtos';
    END IF;
    
    -- Garantir que produtos ativos estejam aprovados
    UPDATE produtos 
    SET status_aprovacao = 'aprovado'
    WHERE ativo = true AND status_aprovacao IS NULL;
    
    UPDATE produtos 
    SET status_aprovacao = 'aprovado', motivo_rejeicao = NULL
    WHERE ativo = true AND status_aprovacao != 'aprovado';
    
    RAISE NOTICE 'Estrutura da tabela produtos verificada';
END $$;

-- ===========================================
-- 3. TABELA: PAGAMENTOS (SAQUES)
-- ===========================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pagamentos') THEN
        RAISE NOTICE 'Tabela pagamentos não existe. Criando...';
        -- Se a tabela não existir, ela será criada pelo Sequelize sync
        RETURN;
    END IF;

    -- public_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'public_id'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN public_id VARCHAR(20) NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_public_id_key 
            ON pagamentos(public_id) WHERE public_id IS NOT NULL;
        COMMENT ON COLUMN pagamentos.public_id IS 'ID público memorável para exibição e pesquisa (ex: SAQ-123456)';
        RAISE NOTICE 'Coluna public_id adicionada à tabela pagamentos';
    END IF;

    -- valor_liquido
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'valor_liquido'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN valor_liquido DECIMAL(10, 2) NULL;
        COMMENT ON COLUMN pagamentos.valor_liquido IS 'Valor líquido após dedução de taxas';
        RAISE NOTICE 'Coluna valor_liquido adicionada à tabela pagamentos';
    END IF;

    -- taxa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'taxa'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN taxa DECIMAL(10, 2) NULL DEFAULT 0;
        COMMENT ON COLUMN pagamentos.taxa IS 'Taxa aplicada ao saque';
        RAISE NOTICE 'Coluna taxa adicionada à tabela pagamentos';
    END IF;

    -- nome_titular
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'nome_titular'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN nome_titular VARCHAR(255) NULL;
        COMMENT ON COLUMN pagamentos.nome_titular IS 'Nome do titular da conta';
        RAISE NOTICE 'Coluna nome_titular adicionada à tabela pagamentos';
    END IF;

    -- ip_solicitacao
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'ip_solicitacao'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN ip_solicitacao VARCHAR(45) NULL;
        COMMENT ON COLUMN pagamentos.ip_solicitacao IS 'IP de onde foi feita a solicitação';
        RAISE NOTICE 'Coluna ip_solicitacao adicionada à tabela pagamentos';
    END IF;

    -- user_agent
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pagamentos' AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE pagamentos ADD COLUMN user_agent TEXT NULL;
        COMMENT ON COLUMN pagamentos.user_agent IS 'User agent do navegador';
        RAISE NOTICE 'Coluna user_agent adicionada à tabela pagamentos';
    END IF;
    
    -- Verificar e criar índices necessários
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'pagamentos_public_id_key'
    ) THEN
        CREATE UNIQUE INDEX pagamentos_public_id_key 
            ON pagamentos(public_id) WHERE public_id IS NOT NULL;
    END IF;
    
    RAISE NOTICE 'Estrutura da tabela pagamentos verificada';
END $$;

-- ===========================================
-- 4. TABELA: CARTEIRAS
-- ===========================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras') THEN
        RAISE NOTICE 'Tabela carteiras não existe. Criando...';
        RETURN;
    END IF;

    -- contacto_mpesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'contacto_mpesa'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN contacto_mpesa VARCHAR(20) NULL;
        COMMENT ON COLUMN carteiras.contacto_mpesa IS 'Número de contacto Mpesa';
        RAISE NOTICE 'Coluna contacto_mpesa adicionada à tabela carteiras';
    END IF;

    -- nome_titular_mpesa
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'nome_titular_mpesa'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN nome_titular_mpesa VARCHAR(255) NULL;
        COMMENT ON COLUMN carteiras.nome_titular_mpesa IS 'Nome do titular Mpesa';
        RAISE NOTICE 'Coluna nome_titular_mpesa adicionada à tabela carteiras';
    END IF;

    -- contacto_emola
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'contacto_emola'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN contacto_emola VARCHAR(20) NULL;
        COMMENT ON COLUMN carteiras.contacto_emola IS 'Número de contacto Emola';
        RAISE NOTICE 'Coluna contacto_emola adicionada à tabela carteiras';
    END IF;

    -- nome_titular_emola
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'nome_titular_emola'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN nome_titular_emola VARCHAR(255) NULL;
        COMMENT ON COLUMN carteiras.nome_titular_emola IS 'Nome do titular Emola';
        RAISE NOTICE 'Coluna nome_titular_emola adicionada à tabela carteiras';
    END IF;

    -- email
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'email'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN email VARCHAR(255) NULL;
        COMMENT ON COLUMN carteiras.email IS 'Email do titular';
        RAISE NOTICE 'Coluna email adicionada à tabela carteiras';
    END IF;

    -- nome
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carteiras' AND column_name = 'nome'
    ) THEN
        ALTER TABLE carteiras ADD COLUMN nome VARCHAR(255) NULL DEFAULT 'Carteira Principal';
        COMMENT ON COLUMN carteiras.nome IS 'Nome da carteira';
        RAISE NOTICE 'Coluna nome adicionada à tabela carteiras';
    END IF;
    
    -- Garantir constraint unique em vendedor_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'carteiras_vendedor_id_key'
    ) THEN
        -- Remover carteiras duplicadas primeiro
        DELETE FROM carteiras c1
        WHERE EXISTS (
            SELECT 1 FROM carteiras c2
            WHERE c2.vendedor_id = c1.vendedor_id
            AND c2.id != c1.id
            AND (c2.created_at > c1.created_at OR 
                 (c2.created_at IS NULL AND c1.created_at IS NULL AND c2.id::text > c1.id::text))
        );
        
        ALTER TABLE carteiras ADD CONSTRAINT carteiras_vendedor_id_key UNIQUE (vendedor_id);
        RAISE NOTICE 'Constraint unique em vendedor_id adicionada à tabela carteiras';
    END IF;
    
    RAISE NOTICE 'Estrutura da tabela carteiras verificada';
END $$;

-- ===========================================
-- 5. VERIFICAR ESTRUTURAS CRÍTICAS
-- ===========================================

DO $$ 
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verificação de estrutura completa';
    RAISE NOTICE '========================================';
    
    -- Verificar produtos ativos não aprovados
    PERFORM COUNT(*) FROM produtos 
    WHERE ativo = true AND status_aprovacao != 'aprovado';
    
    IF FOUND THEN
        RAISE NOTICE 'ATENÇÃO: Produtos ativos encontrados que não estão aprovados!';
    END IF;
    
    RAISE NOTICE 'Estrutura sincronizada com sucesso!';
END $$;

-- ===========================================
-- 6. ESTATÍSTICAS FINAIS
-- ===========================================

SELECT 
    'produtos' as tabela,
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;

SELECT 'Estrutura do banco de dados sincronizada com sucesso!' AS resultado;

