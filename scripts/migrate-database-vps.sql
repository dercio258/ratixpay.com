-- ============================================
-- Script de Migração do Banco de Dados - VPS
-- Execute este script na VPS para atualizar as tabelas
-- ============================================

-- 1. Adicionar coluna push_subscription na tabela usuarios (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'usuarios' 
        AND column_name = 'push_subscription'
    ) THEN
        ALTER TABLE usuarios 
        ADD COLUMN push_subscription TEXT;
        
        COMMENT ON COLUMN usuarios.push_subscription IS 'Subscription JSON para push notifications (Web Push API)';
        
        RAISE NOTICE '✅ Coluna push_subscription adicionada à tabela usuarios';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna push_subscription já existe na tabela usuarios';
    END IF;
END $$;

-- 2. Adicionar coluna cliente_whatsapp na tabela vendas (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vendas' 
        AND column_name = 'cliente_whatsapp'
    ) THEN
        ALTER TABLE vendas 
        ADD COLUMN cliente_whatsapp VARCHAR(20);
        
        COMMENT ON COLUMN vendas.cliente_whatsapp IS 'Número de WhatsApp do cliente';
        
        RAISE NOTICE '✅ Coluna cliente_whatsapp adicionada à tabela vendas';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna cliente_whatsapp já existe na tabela vendas';
    END IF;
END $$;

-- 3. Adicionar coluna afiliado_ref na tabela vendas (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vendas' 
        AND column_name = 'afiliado_ref'
    ) THEN
        ALTER TABLE vendas 
        ADD COLUMN afiliado_ref VARCHAR(20);
        
        COMMENT ON COLUMN vendas.afiliado_ref IS 'Código do afiliado que gerou a venda';
        
        RAISE NOTICE '✅ Coluna afiliado_ref adicionada à tabela vendas';
    ELSE
        RAISE NOTICE 'ℹ️  Coluna afiliado_ref já existe na tabela vendas';
    END IF;
END $$;

-- 3. Verificar e criar índices para melhor performance (se não existirem)
DO $$
BEGIN
    -- Índice para afiliado_ref na tabela vendas
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'vendas' 
        AND indexname = 'idx_vendas_afiliado_ref'
    ) THEN
        CREATE INDEX idx_vendas_afiliado_ref ON vendas(afiliado_ref);
        RAISE NOTICE '✅ Índice idx_vendas_afiliado_ref criado';
    ELSE
        RAISE NOTICE 'ℹ️  Índice idx_vendas_afiliado_ref já existe';
    END IF;
END $$;

-- 4. Verificar estrutura das tabelas principais
DO $$
BEGIN
    RAISE NOTICE '📊 Verificando estrutura das tabelas...';
    
    -- Verificar tabela usuarios
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        RAISE NOTICE '✅ Tabela usuarios existe';
    ELSE
        RAISE WARNING '⚠️  Tabela usuarios não encontrada';
    END IF;
    
    -- Verificar tabela vendas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendas') THEN
        RAISE NOTICE '✅ Tabela vendas existe';
    ELSE
        RAISE WARNING '⚠️  Tabela vendas não encontrada';
    END IF;
    
    -- Verificar tabela afiliados
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'afiliados') THEN
        RAISE NOTICE '✅ Tabela afiliados existe';
    ELSE
        RAISE WARNING '⚠️  Tabela afiliados não encontrada';
    END IF;
    
    -- Verificar tabela venda_afiliados
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'venda_afiliados') THEN
        RAISE NOTICE '✅ Tabela venda_afiliados existe';
    ELSE
        RAISE WARNING '⚠️  Tabela venda_afiliados não encontrada';
    END IF;
END $$;

-- ============================================
-- Fim do Script de Migração
-- ============================================
RAISE NOTICE '✅ Migração concluída com sucesso!';

