#!/bin/bash

# Script para criar coluna remarketing_config na tabela produtos
# Execute como root ou com sudo

echo "🔄 Criando coluna remarketing_config na tabela produtos..."

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/add-remarketing-config.sql" ]; then
    echo "❌ Arquivo migrations/add-remarketing-config.sql não encontrado!"
    echo "📋 Executando SQL diretamente..."
    
    # Executar SQL diretamente
    sudo -u postgres psql -d ratixpay -c "
        DO \$\$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'produtos' 
                AND column_name = 'remarketing_config'
            ) THEN
                ALTER TABLE produtos ADD COLUMN remarketing_config JSON;
                COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}';
                RAISE NOTICE 'Coluna remarketing_config adicionada';
            ELSE
                RAISE NOTICE 'Coluna remarketing_config já existe';
            END IF;
        END \$\$;
    "
else
    # Executar arquivo SQL
    sudo -u postgres psql -d ratixpay -f migrations/add-remarketing-config.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Coluna remarketing_config criada com sucesso!"
    echo "📋 Agora você pode executar: node scripts/ativar-remarketing-produtos.js"
else
    echo "❌ Erro ao criar coluna. Verifique as permissões."
    exit 1
fi

