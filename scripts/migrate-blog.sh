#!/bin/bash

# ===========================================
# Script de Migração do Blog - Shell Script
# ===========================================
# Este script executa a migração do banco de dados do blog
# de forma segura na VPS
#
# Uso:
#   chmod +x scripts/migrate-blog.sh
#   ./scripts/migrate-blog.sh
# ===========================================

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configurações
DB_NAME="${DB_NAME:-ratixpay}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
MIGRATION_FILE="migrations/migrate-blog-completo-seguro.sql"

echo -e "${GREEN}🚀 Iniciando migração do banco de dados do blog...${NC}\n"

# Verificar se o arquivo de migração existe
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo de migração não encontrado: $MIGRATION_FILE${NC}"
    exit 1
fi

# Verificar se psql está instalado
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ Erro: psql não está instalado${NC}"
    exit 1
fi

# Executar migração
echo -e "${YELLOW}📝 Executando migração SQL...${NC}\n"

if psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -f "$MIGRATION_FILE"; then
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ Migração concluída com sucesso!${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    
    # Verificar tabelas criadas
    echo -e "${YELLOW}🔍 Verificando tabelas criadas...${NC}\n"
    
    psql -U "$DB_USER" -d "$DB_NAME" -h "$DB_HOST" -c "
        SELECT 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_posts') 
                THEN '✅ blog_posts: OK' 
                ELSE '⚠️  blog_posts: NÃO ENCONTRADA' 
            END as status
        UNION ALL
        SELECT 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_comments') 
                THEN '✅ blog_comments: OK' 
                ELSE '⚠️  blog_comments: NÃO ENCONTRADA' 
            END
        UNION ALL
        SELECT 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_pages') 
                THEN '✅ blog_pages: OK' 
                ELSE '⚠️  blog_pages: NÃO ENCONTRADA' 
            END
        UNION ALL
        SELECT 
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_newsletter') 
                THEN '✅ blog_newsletter: OK' 
                ELSE '⚠️  blog_newsletter: NÃO ENCONTRADA' 
            END;
    "
    
    exit 0
else
    echo -e "\n${RED}❌ Erro durante a migração${NC}"
    exit 1
fi




