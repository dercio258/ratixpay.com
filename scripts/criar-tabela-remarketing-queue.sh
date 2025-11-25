#!/bin/bash

# Script para criar tabela remarketing_queue
# Execute como root ou com sudo

echo "🔄 Criando tabela remarketing_queue..."

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/create-remarketing-queue.sql" ]; then
    echo "❌ Arquivo migrations/create-remarketing-queue.sql não encontrado!"
    echo "📋 Executando SQL diretamente..."
    
    # Executar SQL diretamente
    sudo -u postgres psql -d ratixpay -c "
        DO \$\$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'remarketing_queue'
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
                
                CREATE INDEX idx_remarketing_queue_status ON remarketing_queue(status);
                CREATE INDEX idx_remarketing_queue_data_agendada ON remarketing_queue(data_agendada);
                CREATE INDEX idx_remarketing_queue_cliente_produto ON remarketing_queue(cliente_id, produto_id);
                CREATE INDEX idx_remarketing_queue_email ON remarketing_queue(email) WHERE email IS NOT NULL;
                
                RAISE NOTICE 'Tabela remarketing_queue criada com sucesso';
            ELSE
                RAISE NOTICE 'Tabela remarketing_queue já existe';
            END IF;
        END \$\$;
    "
else
    # Executar arquivo SQL
    sudo -u postgres psql -d ratixpay -f migrations/create-remarketing-queue.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Tabela remarketing_queue criada com sucesso!"
    echo "📋 O sistema de remarketing agora está pronto para funcionar."
else
    echo "❌ Erro ao criar tabela. Verifique as permissões."
    exit 1
fi

