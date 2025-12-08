-- =====================================================
-- Script de Migração: Sistema Completo de Afiliados
-- Execute este script no PostgreSQL da VPS
-- =====================================================
-- 
-- Uso:
--   psql -U postgres -d ratixpay -f migrations/migrate-afiliados-completo-vps.sql
-- 
-- Ou execute diretamente:
--   sudo -u postgres psql -d ratixpay -f migrations/migrate-afiliados-completo-vps.sql
-- =====================================================

BEGIN;

-- =====================================================
-- 1. GARANTIR TABELA DE AFILIADOS COM TODOS OS CAMPOS
-- =====================================================
DO $$ 
BEGIN
    -- Verificar se a tabela afiliados existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados'
    ) THEN
        -- Criar tabela afiliados completa
        CREATE TABLE afiliados (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            senha VARCHAR(255) NOT NULL,
            token_reset_senha VARCHAR(255),
            token_reset_expires TIMESTAMP,
            telefone VARCHAR(20),
            codigo_afiliado VARCHAR(20) UNIQUE NOT NULL,
            link_afiliado TEXT NOT NULL,
            comissao_percentual DECIMAL(5,2) DEFAULT 10.00,
            status VARCHAR(20) DEFAULT 'ativo',
            total_vendas INTEGER DEFAULT 0,
            total_comissoes DECIMAL(10,2) DEFAULT 0.00,
            saldo_disponivel DECIMAL(10,2) DEFAULT 0.00,
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ultima_atividade TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE '✅ Tabela afiliados criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela afiliados já existe';
    END IF;
    
    -- Adicionar campos de cliques se não existirem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'total_cliques'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN total_cliques INTEGER DEFAULT 0;
        COMMENT ON COLUMN afiliados.total_cliques IS 'Total de cliques em todos os links do afiliado';
        RAISE NOTICE '✅ Coluna total_cliques adicionada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'cliques_pagos'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN cliques_pagos INTEGER DEFAULT 0;
        COMMENT ON COLUMN afiliados.cliques_pagos IS 'Total de cliques já pagos';
        RAISE NOTICE '✅ Coluna cliques_pagos adicionada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'creditos_cliques'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN creditos_cliques DECIMAL(10,2) DEFAULT 0.00;
        COMMENT ON COLUMN afiliados.creditos_cliques IS 'Créditos gerados por cliques (1 MZN a cada 10 cliques)';
        RAISE NOTICE '✅ Coluna creditos_cliques adicionada';
    END IF;
    
    -- Adicionar campos de integração se não existirem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'meta_pixel_id'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN meta_pixel_id VARCHAR(50) NULL;
        COMMENT ON COLUMN afiliados.meta_pixel_id IS 'ID do Meta Pixel (Facebook Pixel) para rastreamento de conversões';
        RAISE NOTICE '✅ Coluna meta_pixel_id adicionada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'utmify_api_token'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN utmify_api_token VARCHAR(255) NULL;
        COMMENT ON COLUMN afiliados.utmify_api_token IS 'API Token do UTMify para rastreamento de conversões';
        RAISE NOTICE '✅ Coluna utmify_api_token adicionada';
    END IF;
    
    -- Adicionar campos de verificação se não existirem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'email_verificado'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN email_verificado BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Coluna email_verificado adicionada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'codigo_verificacao'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN codigo_verificacao VARCHAR(10) NULL;
        RAISE NOTICE '✅ Coluna codigo_verificacao adicionada';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'codigo_verificacao_expira'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN codigo_verificacao_expira TIMESTAMP NULL;
        RAISE NOTICE '✅ Coluna codigo_verificacao_expira adicionada';
    END IF;
    
    -- Adicionar campo vendedor_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'afiliados' 
        AND column_name = 'vendedor_id'
    ) THEN
        ALTER TABLE afiliados ADD COLUMN vendedor_id UUID NULL;
        COMMENT ON COLUMN afiliados.vendedor_id IS 'ID do vendedor associado (se o afiliado for um vendedor)';
        
        -- Adicionar foreign key se a tabela usuarios existir
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'usuarios'
        ) THEN
            ALTER TABLE afiliados 
            ADD CONSTRAINT fk_afiliado_vendedor 
            FOREIGN KEY (vendedor_id) 
            REFERENCES usuarios(id) 
            ON DELETE SET NULL;
        END IF;
        
        RAISE NOTICE '✅ Coluna vendedor_id adicionada';
    END IF;
    
END $$;

-- =====================================================
-- 2. GARANTIR TABELA DE VENDAS DE AFILIADOS (TRANSACOES)
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'venda_afiliados'
    ) THEN
        CREATE TABLE venda_afiliados (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            afiliado_id UUID NOT NULL,
            venda_id UUID NOT NULL,
            valor_venda DECIMAL(10,2) NOT NULL,
            comissao_percentual DECIMAL(5,2) NOT NULL,
            valor_comissao DECIMAL(10,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pendente',
            data_pagamento TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_venda_afiliado_afiliado 
                FOREIGN KEY (afiliado_id) 
                REFERENCES afiliados(id) 
                ON DELETE CASCADE,
            CONSTRAINT fk_venda_afiliado_venda 
                FOREIGN KEY (venda_id) 
                REFERENCES vendas(id) 
                ON DELETE CASCADE
        );
        
        -- Criar índices
        CREATE INDEX idx_venda_afiliado_afiliado_id ON venda_afiliados(afiliado_id);
        CREATE INDEX idx_venda_afiliado_venda_id ON venda_afiliados(venda_id);
        CREATE INDEX idx_venda_afiliado_status ON venda_afiliados(status);
        
        RAISE NOTICE '✅ Tabela venda_afiliados criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela venda_afiliados já existe';
    END IF;
END $$;

-- =====================================================
-- 3. GARANTIR TABELA DE LINK TRACKINGS
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'link_trackings'
    ) THEN
        CREATE TABLE link_trackings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            afiliado_id UUID NOT NULL,
            link_original TEXT NOT NULL,
            link_afiliado TEXT NOT NULL,
            produto_id UUID,
            cliques INTEGER DEFAULT 0,
            conversoes INTEGER DEFAULT 0,
            ultimo_clique TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_link_tracking_afiliado 
                FOREIGN KEY (afiliado_id) 
                REFERENCES afiliados(id) 
                ON DELETE CASCADE
        );
        
        -- Adicionar foreign key para produtos se a tabela existir
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos'
        ) THEN
            ALTER TABLE link_trackings 
            ADD CONSTRAINT fk_link_tracking_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE SET NULL;
        END IF;
        
        -- Criar índices
        CREATE INDEX idx_link_tracking_afiliado_id ON link_trackings(afiliado_id);
        CREATE INDEX idx_link_tracking_produto_id ON link_trackings(produto_id);
        CREATE INDEX idx_link_tracking_afiliado_produto ON link_trackings(afiliado_id, produto_id);
        
        RAISE NOTICE '✅ Tabela link_trackings criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela link_trackings já existe';
    END IF;
    
    -- Adicionar campos de cliques pagos se não existirem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'link_trackings' 
        AND column_name = 'cliques_pagos'
    ) THEN
        ALTER TABLE link_trackings ADD COLUMN cliques_pagos INTEGER DEFAULT 0;
        COMMENT ON COLUMN link_trackings.cliques_pagos IS 'Cliques já pagos (para cálculo de créditos)';
        RAISE NOTICE '✅ Coluna cliques_pagos adicionada em link_trackings';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'link_trackings' 
        AND column_name = 'creditos_gerados'
    ) THEN
        ALTER TABLE link_trackings ADD COLUMN creditos_gerados DECIMAL(10,2) DEFAULT 0.00;
        COMMENT ON COLUMN link_trackings.creditos_gerados IS 'Total de créditos gerados por este link (1 MZN a cada 10 cliques)';
        RAISE NOTICE '✅ Coluna creditos_gerados adicionada em link_trackings';
    END IF;
END $$;

-- =====================================================
-- 4. GARANTIR TABELA DE CLIQUES VÁLIDOS DE AFILIADOS
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cliques_validos_afiliados'
    ) THEN
        CREATE TABLE cliques_validos_afiliados (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            afiliado_id UUID NOT NULL,
            link_tracking_id UUID,
            produto_id UUID,
            ip_address VARCHAR(45) NOT NULL,
            user_agent TEXT NOT NULL,
            navegador VARCHAR(100),
            sistema_operacional VARCHAR(100),
            dispositivo VARCHAR(50),
            fingerprint VARCHAR(255),
            valido BOOLEAN NOT NULL DEFAULT true,
            motivo_rejeicao TEXT,
            referer TEXT,
            session_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_clique_valido_afiliado 
                FOREIGN KEY (afiliado_id) 
                REFERENCES afiliados(id) 
                ON DELETE CASCADE
        );
        
        -- Adicionar foreign keys se as tabelas existirem
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'link_trackings'
        ) THEN
            ALTER TABLE cliques_validos_afiliados 
            ADD CONSTRAINT fk_clique_valido_link_tracking 
            FOREIGN KEY (link_tracking_id) 
            REFERENCES link_trackings(id) 
            ON DELETE SET NULL;
        END IF;
        
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos'
        ) THEN
            ALTER TABLE cliques_validos_afiliados 
            ADD CONSTRAINT fk_clique_valido_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE SET NULL;
        END IF;
        
        -- Criar índices
        CREATE INDEX idx_clique_valido_afiliado_ip ON cliques_validos_afiliados(afiliado_id, ip_address);
        CREATE INDEX idx_clique_valido_link_tracking ON cliques_validos_afiliados(link_tracking_id);
        CREATE INDEX idx_clique_valido_valido ON cliques_validos_afiliados(valido);
        CREATE INDEX idx_clique_valido_created_at ON cliques_validos_afiliados(created_at);
        CREATE INDEX idx_clique_valido_produto_id ON cliques_validos_afiliados(produto_id);
        
        RAISE NOTICE '✅ Tabela cliques_validos_afiliados criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela cliques_validos_afiliados já existe';
    END IF;
END $$;

-- =====================================================
-- 5. GARANTIR QUE PRODUTOS CARREGAM CORRETAMENTE
-- =====================================================
DO $$ 
BEGIN
    -- Verificar se a tabela produtos existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'produtos'
    ) THEN
        -- Garantir campos de afiliados nos produtos
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'permitir_afiliados'
        ) THEN
            ALTER TABLE produtos ADD COLUMN permitir_afiliados BOOLEAN DEFAULT FALSE;
            RAISE NOTICE '✅ Coluna permitir_afiliados adicionada em produtos';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'comissao_afiliados'
        ) THEN
            ALTER TABLE produtos ADD COLUMN comissao_afiliados DECIMAL(5,2) DEFAULT 0;
            RAISE NOTICE '✅ Coluna comissao_afiliados adicionada em produtos';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'comissao_minima'
        ) THEN
            ALTER TABLE produtos ADD COLUMN comissao_minima DECIMAL(10,2) DEFAULT 0;
            RAISE NOTICE '✅ Coluna comissao_minima adicionada em produtos';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'tipo_comissao'
        ) THEN
            ALTER TABLE produtos ADD COLUMN tipo_comissao VARCHAR(20) DEFAULT 'percentual';
            RAISE NOTICE '✅ Coluna tipo_comissao adicionada em produtos';
        END IF;
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'tier_config'
        ) THEN
            ALTER TABLE produtos ADD COLUMN tier_config JSON;
            RAISE NOTICE '✅ Coluna tier_config adicionada em produtos';
        END IF;
        
        -- Criar índices para melhor performance ao carregar produtos
        CREATE INDEX IF NOT EXISTS idx_produtos_vendedor_id ON produtos(vendedor_id);
        CREATE INDEX IF NOT EXISTS idx_produtos_permitir_afiliados ON produtos(permitir_afiliados);
        CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);
        
        RAISE NOTICE '✅ Índices de produtos criados/verificados';
    ELSE
        RAISE NOTICE '⚠️ Tabela produtos não existe - será criada pelo script de inicialização';
    END IF;
END $$;

-- =====================================================
-- 6. CRIAR ÍNDICES ADICIONAIS PARA PERFORMANCE
-- =====================================================
DO $$ 
BEGIN
    -- Índices para afiliados
    CREATE INDEX IF NOT EXISTS idx_afiliados_email ON afiliados(email);
    CREATE INDEX IF NOT EXISTS idx_afiliados_codigo_afiliado ON afiliados(codigo_afiliado);
    CREATE INDEX IF NOT EXISTS idx_afiliados_status ON afiliados(status);
    CREATE INDEX IF NOT EXISTS idx_afiliados_vendedor_id ON afiliados(vendedor_id);
    
    -- Índices para link_trackings
    CREATE INDEX IF NOT EXISTS idx_link_trackings_ultimo_clique ON link_trackings(ultimo_clique);
    
    RAISE NOTICE '✅ Índices adicionais criados/verificados';
END $$;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migração do sistema de afiliados concluída!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tabelas verificadas/criadas:';
    RAISE NOTICE '  ✅ afiliados';
    RAISE NOTICE '  ✅ venda_afiliados (transações)';
    RAISE NOTICE '  ✅ link_trackings';
    RAISE NOTICE '  ✅ cliques_validos_afiliados (cliques)';
    RAISE NOTICE '';
    RAISE NOTICE 'Campos de integração:';
    RAISE NOTICE '  ✅ meta_pixel_id';
    RAISE NOTICE '  ✅ utmify_api_token';
    RAISE NOTICE '';
    RAISE NOTICE 'Campos de cliques:';
    RAISE NOTICE '  ✅ total_cliques, cliques_pagos, creditos_cliques';
    RAISE NOTICE '';
END $$;

-- Exibir estrutura final das tabelas principais
SELECT 
    'afiliados' as tabela,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'afiliados'
ORDER BY ordinal_position;

SELECT 
    'venda_afiliados' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'venda_afiliados'
ORDER BY ordinal_position;

SELECT 
    'link_trackings' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'link_trackings'
ORDER BY ordinal_position;

SELECT 
    'cliques_validos_afiliados' as tabela,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'cliques_validos_afiliados'
ORDER BY ordinal_position;

