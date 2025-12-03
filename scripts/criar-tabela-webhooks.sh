#!/bin/bash

# Script para criar tabela webhooks
# Execute como root ou com sudo

echo "🔄 Criando tabela webhooks..."

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/create-webhooks-table.sql" ]; then
    echo "❌ Arquivo migrations/create-webhooks-table.sql não encontrado!"
    echo "📋 Executando SQL diretamente..."
    
    # Executar SQL diretamente
    sudo -u postgres psql -d ratixpay -c "
        DO \$\$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'webhooks'
            ) THEN
                CREATE TABLE webhooks (
                    id VARCHAR(255) PRIMARY KEY,
                    user_id UUID NOT NULL,
                    url TEXT NOT NULL,
                    eventos JSON NOT NULL DEFAULT '[]',
                    secret TEXT,
                    ativo BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_webhook_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
                );
                
                CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
                CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
                CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
                
                RAISE NOTICE 'Tabela webhooks criada com sucesso';
            ELSE
                RAISE NOTICE 'Tabela webhooks já existe';
            END IF;
        END \$\$;
    "
else
    # Executar arquivo SQL
    sudo -u postgres psql -d ratixpay -f migrations/create-webhooks-table.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Tabela webhooks criada com sucesso!"
    echo "📋 O sistema de webhooks agora está pronto para funcionar."
else
    echo "❌ Erro ao criar tabela. Verifique as permissões."
    exit 1
fi

