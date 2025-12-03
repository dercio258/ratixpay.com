-- Migração: Adicionar índices para otimizar consultas de produtos para afiliados
-- Data: 2025-11-28
-- Descrição: Cria índices nas colunas mais consultadas para melhorar performance

DO $$ 
BEGIN
    -- Índice para consultas de produtos ativos que permitem afiliados
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'produtos' 
        AND indexname = 'idx_produtos_ativo_permitir_afiliados'
    ) THEN
        CREATE INDEX idx_produtos_ativo_permitir_afiliados 
        ON produtos(ativo, permitir_afiliados) 
        WHERE ativo = true AND permitir_afiliados = true;
        RAISE NOTICE 'Índice idx_produtos_ativo_permitir_afiliados criado';
    ELSE
        RAISE NOTICE 'Índice idx_produtos_ativo_permitir_afiliados já existe';
    END IF;

    -- Índice para consultas por vendedor_id (excluir produtos do próprio vendedor)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'produtos' 
        AND indexname = 'idx_produtos_vendedor_id'
    ) THEN
        CREATE INDEX idx_produtos_vendedor_id 
        ON produtos(vendedor_id);
        RAISE NOTICE 'Índice idx_produtos_vendedor_id criado';
    ELSE
        RAISE NOTICE 'Índice idx_produtos_vendedor_id já existe';
    END IF;

    -- Índice composto para a consulta completa (ativo + permitir_afiliados + vendedor_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'produtos' 
        AND indexname = 'idx_produtos_afiliados_completo'
    ) THEN
        CREATE INDEX idx_produtos_afiliados_completo 
        ON produtos(ativo, permitir_afiliados, vendedor_id) 
        WHERE ativo = true AND permitir_afiliados = true;
        RAISE NOTICE 'Índice idx_produtos_afiliados_completo criado';
    ELSE
        RAISE NOTICE 'Índice idx_produtos_afiliados_completo já existe';
    END IF;

    -- Índice para LinkTracking (afiliado_id + produto_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'link_tracking' 
        AND indexname = 'idx_link_tracking_afiliado_produto'
    ) THEN
        CREATE INDEX idx_link_tracking_afiliado_produto 
        ON link_tracking(afiliado_id, produto_id);
        RAISE NOTICE 'Índice idx_link_tracking_afiliado_produto criado';
    ELSE
        RAISE NOTICE 'Índice idx_link_tracking_afiliado_produto já existe';
    END IF;

    -- Índice para VendaAfiliado (afiliado_id)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'vendas_afiliados' 
        AND indexname = 'idx_vendas_afiliados_afiliado_id'
    ) THEN
        CREATE INDEX idx_vendas_afiliados_afiliado_id 
        ON vendas_afiliados(afiliado_id);
        RAISE NOTICE 'Índice idx_vendas_afiliados_afiliado_id criado';
    ELSE
        RAISE NOTICE 'Índice idx_vendas_afiliados_afiliado_id já existe';
    END IF;
END $$;

