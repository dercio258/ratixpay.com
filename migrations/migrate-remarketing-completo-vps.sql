-- =====================================================
-- Script de Migração: Sistema Completo de Remarketing
-- Execute este script no PostgreSQL da VPS
-- =====================================================
-- 
-- Uso:
--   psql -U postgres -d ratixpay -f migrations/migrate-remarketing-completo-vps.sql
-- 
-- Ou execute diretamente:
--   sudo -u postgres psql -d ratixpay -f migrations/migrate-remarketing-completo-vps.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. GARANTIR TABELA remarketing_queue
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'remarketing_queue'
    ) THEN
        CREATE TABLE remarketing_queue (
            id SERIAL PRIMARY KEY,
            cliente_id UUID NOT NULL,
            cliente_nome VARCHAR(255) NOT NULL,
            produto_id UUID NOT NULL,
            produto_nome VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            telefone VARCHAR(50),
            status VARCHAR(20) DEFAULT 'pendente' NOT NULL,
            data_cancelamento TIMESTAMP NOT NULL,
            tempo_envio INTEGER DEFAULT 0,
            data_agendada TIMESTAMP NOT NULL,
            tentativas INTEGER DEFAULT 0,
            motivo_ignorado TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_remarketing_queue_status ON remarketing_queue(status);
        CREATE INDEX idx_remarketing_queue_data_agendada ON remarketing_queue(data_agendada);
        CREATE INDEX idx_remarketing_queue_cliente_produto ON remarketing_queue(cliente_id, produto_id);
        CREATE INDEX idx_remarketing_queue_email ON remarketing_queue(email) WHERE email IS NOT NULL;
        CREATE INDEX idx_remarketing_queue_produto_id ON remarketing_queue(produto_id);
        
        COMMENT ON TABLE remarketing_queue IS 'Fila de remarketing para vendas canceladas';
        COMMENT ON COLUMN remarketing_queue.status IS 'Status: pendente, enviado, ignorado';
        COMMENT ON COLUMN remarketing_queue.tempo_envio IS 'Tempo em minutos até o envio';
        
        RAISE NOTICE '✅ Tabela remarketing_queue criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela remarketing_queue já existe';
    END IF;
    
    -- Adicionar campo venda_cancelada_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'remarketing_queue' 
        AND column_name = 'venda_cancelada_id'
    ) THEN
        ALTER TABLE remarketing_queue ADD COLUMN venda_cancelada_id UUID;
        
        -- Adicionar foreign key se a tabela vendas existir
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vendas'
        ) THEN
            ALTER TABLE remarketing_queue 
            ADD CONSTRAINT fk_remarketing_venda_cancelada 
            FOREIGN KEY (venda_cancelada_id) 
            REFERENCES vendas(id) 
            ON DELETE SET NULL;
            
            CREATE INDEX idx_remarketing_queue_venda_cancelada ON remarketing_queue(venda_cancelada_id);
        END IF;
        
        COMMENT ON COLUMN remarketing_queue.venda_cancelada_id IS 'ID da venda cancelada que originou este item de remarketing';
        
        RAISE NOTICE '✅ Coluna venda_cancelada_id adicionada';
    END IF;
    
    -- Adicionar foreign keys para produtos e clientes se as tabelas existirem
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'produtos'
    ) THEN
        -- Verificar se a constraint já existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_schema = 'public' 
            AND table_name = 'remarketing_queue' 
            AND constraint_name = 'fk_remarketing_produto'
        ) THEN
            ALTER TABLE remarketing_queue 
            ADD CONSTRAINT fk_remarketing_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- =====================================================
-- 2. GARANTIR TABELA remarketing_conversoes
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'remarketing_conversoes'
    ) THEN
        CREATE TABLE remarketing_conversoes (
            id SERIAL PRIMARY KEY,
            remarketing_queue_id INTEGER NOT NULL,
            venda_cancelada_id UUID NOT NULL,
            venda_aprovada_id UUID NOT NULL,
            cliente_id UUID,
            cliente_nome VARCHAR(255) NOT NULL,
            produto_id UUID NOT NULL,
            produto_nome VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            telefone VARCHAR(50),
            data_cancelamento TIMESTAMP NOT NULL,
            data_remarketing_enviado TIMESTAMP,
            data_conversao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            valor_venda_cancelada DECIMAL(10, 2),
            valor_venda_aprovada DECIMAL(10, 2),
            tempo_ate_conversao_minutos INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Adicionar foreign keys se as tabelas existirem
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'remarketing_queue'
        ) THEN
            ALTER TABLE remarketing_conversoes 
            ADD CONSTRAINT fk_remarketing_queue 
            FOREIGN KEY (remarketing_queue_id) 
            REFERENCES remarketing_queue(id) 
            ON DELETE CASCADE;
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'vendas'
        ) THEN
            ALTER TABLE remarketing_conversoes 
            ADD CONSTRAINT fk_venda_cancelada 
            FOREIGN KEY (venda_cancelada_id) 
            REFERENCES vendas(id) 
            ON DELETE CASCADE;
            
            ALTER TABLE remarketing_conversoes 
            ADD CONSTRAINT fk_venda_aprovada 
            FOREIGN KEY (venda_aprovada_id) 
            REFERENCES vendas(id) 
            ON DELETE CASCADE;
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos'
        ) THEN
            ALTER TABLE remarketing_conversoes 
            ADD CONSTRAINT fk_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE CASCADE;
        END IF;
        
        -- Criar índices para melhor performance
        CREATE INDEX idx_remarketing_conversoes_queue ON remarketing_conversoes(remarketing_queue_id);
        CREATE INDEX idx_remarketing_conversoes_venda_cancelada ON remarketing_conversoes(venda_cancelada_id);
        CREATE INDEX idx_remarketing_conversoes_venda_aprovada ON remarketing_conversoes(venda_aprovada_id);
        CREATE INDEX idx_remarketing_conversoes_cliente ON remarketing_conversoes(cliente_id) WHERE cliente_id IS NOT NULL;
        CREATE INDEX idx_remarketing_conversoes_produto ON remarketing_conversoes(produto_id);
        CREATE INDEX idx_remarketing_conversoes_data_conversao ON remarketing_conversoes(data_conversao);
        CREATE INDEX idx_remarketing_conversoes_email ON remarketing_conversoes(email) WHERE email IS NOT NULL;
        CREATE INDEX idx_remarketing_conversoes_telefone ON remarketing_conversoes(telefone) WHERE telefone IS NOT NULL;
        
        COMMENT ON TABLE remarketing_conversoes IS 'Rastreia conversões de remarketing: quando uma venda cancelada que recebeu remarketing é convertida em venda aprovada';
        COMMENT ON COLUMN remarketing_conversoes.remarketing_queue_id IS 'ID do item na fila de remarketing';
        COMMENT ON COLUMN remarketing_conversoes.venda_cancelada_id IS 'ID da venda cancelada original';
        COMMENT ON COLUMN remarketing_conversoes.venda_aprovada_id IS 'ID da venda aprovada (conversão)';
        COMMENT ON COLUMN remarketing_conversoes.tempo_ate_conversao_minutos IS 'Tempo em minutos entre o envio do remarketing e a conversão';
        
        RAISE NOTICE '✅ Tabela remarketing_conversoes criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela remarketing_conversoes já existe';
    END IF;
END $$;

-- =====================================================
-- 3. GARANTIR CAMPO remarketing_config NA TABELA produtos
-- =====================================================
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'produtos'
    ) THEN
        -- Adicionar campo remarketing_config se não existir
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'remarketing_config'
        ) THEN
            ALTER TABLE produtos ADD COLUMN remarketing_config JSON;
            COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}';
            RAISE NOTICE '✅ Coluna remarketing_config adicionada em produtos';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Tabela produtos não existe - será criada pelo script de inicialização';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migração do sistema de remarketing concluída!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tabelas verificadas/criadas:';
    RAISE NOTICE '  ✅ remarketing_queue';
    RAISE NOTICE '  ✅ remarketing_conversoes';
    RAISE NOTICE '';
    RAISE NOTICE 'Campos verificados:';
    RAISE NOTICE '  ✅ produtos.remarketing_config';
    RAISE NOTICE '';
END $$;

-- Exibir estrutura final das tabelas
SELECT 
    'remarketing_queue' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'remarketing_queue'
ORDER BY ordinal_position;

SELECT 
    'remarketing_conversoes' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'remarketing_conversoes'
ORDER BY ordinal_position;

