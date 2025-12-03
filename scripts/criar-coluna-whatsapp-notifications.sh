#!/bin/bash

# Script para adicionar coluna whatsapp_notification_types
# Execute como root ou com sudo

echo "🔄 Adicionando coluna whatsapp_notification_types..."

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/add-whatsapp-notification-types.sql" ]; then
    echo "❌ Arquivo migrations/add-whatsapp-notification-types.sql não encontrado!"
    echo "📋 Executando SQL diretamente..."
    
    # Executar SQL diretamente
    sudo -u postgres psql -d ratixpay -c "
        DO \$\$ 
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
        END \$\$;
    "
else
    # Executar arquivo SQL
    sudo -u postgres psql -d ratixpay -f migrations/add-whatsapp-notification-types.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Coluna whatsapp_notification_types criada com sucesso!"
    echo "📋 O sistema de configuração de WhatsApp está pronto para funcionar."
else
    echo "❌ Erro ao criar coluna. Verifique as permissões."
    exit 1
fi

