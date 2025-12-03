-- Migração: Adicionar coluna whatsapp_notification_types
-- Execute este script como superusuário do PostgreSQL ou com permissões adequadas

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' 
        AND column_name = 'whatsapp_notification_types'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN whatsapp_notification_types JSON DEFAULT '[]';
        COMMENT ON COLUMN usuarios.whatsapp_notification_types IS 'Array de tipos de notificações WhatsApp que o usuário deseja receber: codigo_verificacao, codigo_saque, nova_venda, saque_pago, remarketing, upsell, venda_afiliado';
        RAISE NOTICE 'Coluna whatsapp_notification_types criada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna whatsapp_notification_types já existe';
    END IF;
END $$;

