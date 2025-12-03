-- Migração: Adicionar campos de integração (Meta Pixel e UTMify) à tabela afiliados
-- Data: 2024-12-25

DO $$ 
BEGIN
    -- Adicionar campo meta_pixel_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'afiliados' 
        AND column_name = 'meta_pixel_id'
    ) THEN
        ALTER TABLE afiliados 
        ADD COLUMN meta_pixel_id VARCHAR(50) NULL;
        
        COMMENT ON COLUMN afiliados.meta_pixel_id IS 'ID do Meta Pixel (Facebook Pixel) para rastreamento de conversões';
        
        RAISE NOTICE 'Coluna meta_pixel_id adicionada com sucesso à tabela afiliados';
    ELSE
        RAISE NOTICE 'Coluna meta_pixel_id já existe na tabela afiliados';
    END IF;

    -- Adicionar campo utmify_api_token
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'afiliados' 
        AND column_name = 'utmify_api_token'
    ) THEN
        ALTER TABLE afiliados 
        ADD COLUMN utmify_api_token VARCHAR(255) NULL;
        
        COMMENT ON COLUMN afiliados.utmify_api_token IS 'API Token do UTMify para rastreamento de conversões';
        
        RAISE NOTICE 'Coluna utmify_api_token adicionada com sucesso à tabela afiliados';
    ELSE
        RAISE NOTICE 'Coluna utmify_api_token já existe na tabela afiliados';
    END IF;
END $$;

