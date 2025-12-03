#!/bin/bash

# Script para criar tabelas de upsell
# Execute como root ou com sudo

echo "🔄 Criando tabelas de upsell..."

# Verificar se o arquivo SQL existe
if [ ! -f "migrations/create-upsell-tables.sql" ]; then
    echo "❌ Arquivo migrations/create-upsell-tables.sql não encontrado!"
    echo "📋 Executando SQL diretamente..."
    
    # Executar SQL diretamente
    sudo -u postgres psql -d ratixpay -c "
        DO \$\$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'upsell_pages'
            ) THEN
                CREATE TABLE upsell_pages (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    vendedor_id UUID NOT NULL,
                    titulo VARCHAR(255) NOT NULL,
                    nome_produto VARCHAR(255) NOT NULL,
                    video_url TEXT,
                    video_public_id VARCHAR(255),
                    link_checkout TEXT,
                    produto_id UUID,
                    ativo BOOLEAN DEFAULT true,
                    ordem INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_upsell_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    CONSTRAINT fk_upsell_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
                );
                
                CREATE INDEX idx_upsell_pages_vendedor ON upsell_pages(vendedor_id);
                CREATE INDEX idx_upsell_pages_produto ON upsell_pages(produto_id);
                CREATE INDEX idx_upsell_pages_ativo ON upsell_pages(ativo);
                
                RAISE NOTICE 'Tabela upsell_pages criada com sucesso';
            ELSE
                RAISE NOTICE 'Tabela upsell_pages já existe';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name = 'produto_upsell'
            ) THEN
                CREATE TABLE produto_upsell (
                    id SERIAL PRIMARY KEY,
                    produto_id UUID NOT NULL,
                    upsell_page_id UUID NOT NULL,
                    ordem INTEGER DEFAULT 0,
                    ativo BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_produto_upsell_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
                    CONSTRAINT fk_produto_upsell_page FOREIGN KEY (upsell_page_id) REFERENCES upsell_pages(id) ON DELETE CASCADE,
                    CONSTRAINT uk_produto_upsell UNIQUE (produto_id, upsell_page_id)
                );
                
                CREATE INDEX idx_produto_upsell_produto ON produto_upsell(produto_id);
                CREATE INDEX idx_produto_upsell_page ON produto_upsell(upsell_page_id);
                CREATE INDEX idx_produto_upsell_ativo ON produto_upsell(ativo);
                
                RAISE NOTICE 'Tabela produto_upsell criada com sucesso';
            ELSE
                RAISE NOTICE 'Tabela produto_upsell já existe';
            END IF;
        END \$\$;
    "
else
    # Executar arquivo SQL
    sudo -u postgres psql -d ratixpay -f migrations/create-upsell-tables.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Tabelas de upsell criadas com sucesso!"
    echo "📋 O sistema de upsell está pronto para funcionar."
else
    echo "❌ Erro ao criar tabelas. Verifique as permissões."
    exit 1
fi


