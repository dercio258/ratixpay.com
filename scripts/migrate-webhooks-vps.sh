#!/bin/bash

# =====================================================
# Script de Migração: Tabela Webhooks - VPS
# Execute este script na VPS para criar/atualizar a tabela webhooks
# =====================================================
#
# Uso:
#   chmod +x scripts/migrate-webhooks-vps.sh
#   ./scripts/migrate-webhooks-vps.sh
#
# Ou execute diretamente:
#   bash scripts/migrate-webhooks-vps.sh
# =====================================================

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Iniciando migração da tabela webhooks...${NC}"

# Verificar se o PostgreSQL está rodando
if ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}⚠️ PostgreSQL não está rodando. Tentando iniciar...${NC}"
    sudo systemctl start postgresql
    sleep 2
fi

# Verificar se o banco de dados existe
DB_NAME="${DB_NAME:-ratixpay}"
DB_USER="${DB_USER:-postgres}"

echo -e "${GREEN}📊 Verificando banco de dados: ${DB_NAME}${NC}"

# Verificar se o arquivo SQL existe
SQL_FILE="migrations/migrate-webhooks-vps.sql"
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Arquivo SQL não encontrado: $SQL_FILE${NC}"
    echo -e "${YELLOW}📋 Executando SQL diretamente...${NC}"
    
    # Executar SQL diretamente
    sudo -u postgres psql -d "$DB_NAME" <<EOF
BEGIN;

DO \$\$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'webhooks'
    ) THEN
        CREATE TABLE webhooks (
            id VARCHAR(255) PRIMARY KEY,
            user_id UUID NOT NULL,
            produto_id UUID,
            url TEXT NOT NULL,
            eventos JSON NOT NULL DEFAULT '[]',
            secret TEXT,
            ativo BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_webhook_user 
                FOREIGN KEY (user_id) 
                REFERENCES usuarios(id) 
                ON DELETE CASCADE,
            CONSTRAINT fk_webhook_produto 
                FOREIGN KEY (produto_id) 
                REFERENCES produtos(id) 
                ON DELETE CASCADE
        );
        
        CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
        CREATE INDEX idx_webhooks_produto_id ON webhooks(produto_id);
        CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
        CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
        
        RAISE NOTICE '✅ Tabela webhooks criada com sucesso!';
    ELSE
        RAISE NOTICE 'ℹ️ Tabela webhooks já existe';
        
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'webhooks' 
            AND column_name = 'produto_id'
        ) THEN
            ALTER TABLE webhooks 
            ADD COLUMN produto_id UUID,
            ADD CONSTRAINT fk_webhook_produto 
            FOREIGN KEY (produto_id) 
            REFERENCES produtos(id) 
            ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_webhooks_produto_id ON webhooks(produto_id);
            
            RAISE NOTICE '✅ Coluna produto_id adicionada com sucesso!';
        END IF;
    END IF;
END \$\$;

COMMIT;
EOF

else
    echo -e "${GREEN}📄 Executando arquivo SQL: $SQL_FILE${NC}"
    sudo -u postgres psql -d "$DB_NAME" -f "$SQL_FILE"
fi

# Verificar se a migração foi bem-sucedida
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migração executada com sucesso!${NC}"
    
    # Verificar estrutura da tabela
    echo -e "${GREEN}📋 Verificando estrutura da tabela webhooks...${NC}"
    sudo -u postgres psql -d "$DB_NAME" -c "\d webhooks"
    
    # Verificar índices
    echo -e "${GREEN}📋 Verificando índices...${NC}"
    sudo -u postgres psql -d "$DB_NAME" -c "\d webhooks" | grep -i index || echo "Nenhum índice encontrado"
    
    echo -e "${GREEN}✅ Migração concluída com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao executar migração${NC}"
    exit 1
fi

