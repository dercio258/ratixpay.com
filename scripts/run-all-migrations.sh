#!/bin/bash

# =====================================================
# Script para Executar Todas as Migrações
# =====================================================
# Este script executa todas as migrações na ordem correta
#
# USO:
#   chmod +x scripts/run-all-migrations.sh
#   ./scripts/run-all-migrations.sh
#
# Ou especifique o banco:
#   DB_NAME=ratixpay ./scripts/run-all-migrations.sh
# =====================================================

set -e  # Parar em caso de erro

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-ratixpay}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
MIGRATIONS_DIR="migrations"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Iniciando Migrações do RatixPay${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 Configurações:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST:$DB_PORT"
echo ""

# Verificar se psql está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Erro: psql não encontrado. Instale o PostgreSQL client.${NC}"
    exit 1
fi

# Verificar se o diretório de migrações existe
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}❌ Erro: Diretório $MIGRATIONS_DIR não encontrado.${NC}"
    exit 1
fi

# Função para executar migração
run_migration() {
    local file=$1
    local description=$2
    
    echo -e "${YELLOW}📦 Executando: $description${NC}"
    echo -e "${YELLOW}   Arquivo: $file${NC}"
    
    if [ ! -f "$MIGRATIONS_DIR/$file" ]; then
        echo -e "${RED}   ❌ Arquivo não encontrado: $MIGRATIONS_DIR/$file${NC}"
        return 1
    fi
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATIONS_DIR/$file" > /tmp/migration_${file%.sql}.log 2>&1; then
        echo -e "${GREEN}   ✅ Sucesso!${NC}"
        return 0
    else
        echo -e "${RED}   ❌ Erro ao executar migração${NC}"
        echo -e "${RED}   Verifique o log: /tmp/migration_${file%.sql}.log${NC}"
        return 1
    fi
}

# Confirmar execução
echo -e "${YELLOW}⚠️  Este script irá modificar o banco de dados!${NC}"
read -p "Deseja continuar? (s/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo -e "${YELLOW}Operação cancelada.${NC}"
    exit 0
fi

# Fazer backup antes de começar
echo ""
echo -e "${YELLOW}📦 Fazendo backup do banco de dados...${NC}"
BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
    echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠️  Aviso: Não foi possível criar backup. Continuando...${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PASSO 1: Migração Unificada${NC}"
echo -e "${GREEN}========================================${NC}"
run_migration "migrate-all-systems-unified.sql" "Sistema Unificado (Blog + Remarketing + Afiliados)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PASSO 2: Atualização de Domínio${NC}"
echo -e "${GREEN}========================================${NC}"
run_migration "update-domain-ratixpay-com-to-site.sql" "Atualizar ratixpay.com → ratixpay.site"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}PASSO 3: Atualização de Produtos${NC}"
echo -e "${GREEN}========================================${NC}"
run_migration "update-products-images-files.sql" "Atualizar produtos, imagens e arquivos"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Todas as Migrações Concluídas!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 Backup salvo em: $BACKUP_FILE"
echo ""
echo "🔍 Para verificar as migrações, execute:"
echo "   psql -U $DB_USER -d $DB_NAME -c \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('blog_posts', 'remarketing_queue', 'afiliados') ORDER BY table_name;\""
echo ""

