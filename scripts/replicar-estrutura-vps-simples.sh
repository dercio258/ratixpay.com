#!/bin/bash

# ===========================================
# REPLICAÇÃO COMPLETA DA ESTRUTURA DO BANCO - VERSÃO SIMPLES
# ===========================================
# Execute como ROOT: bash scripts/replicar-estrutura-vps-simples.sh

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ler .env se existir
if [ -f .env ]; then
    source .env 2>/dev/null || true
fi

DB_NAME=${DB_NAME:-ratixpay}

echo -e "${GREEN}🚀 Iniciando replicação da estrutura do banco...${NC}"
echo -e "${YELLOW}📊 Banco: $DB_NAME${NC}"
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

# Função para executar SQL como postgres
run_sql() {
    su - postgres -c "psql -d $DB_NAME -c \"$1\""
}

run_sql_file() {
    su - postgres -c "psql -d $DB_NAME -f $1"
}

echo -e "${GREEN}1. Corrigindo permissões...${NC}"
if [ -f "$SCRIPT_DIR/fix-schema-permissions.sql" ]; then
    run_sql_file "$SCRIPT_DIR/fix-schema-permissions.sql" || echo -e "${YELLOW}  ⚠️  Permissões podem já estar corretas${NC}"
fi

echo ""
echo -e "${GREEN}2. Sincronizando estrutura principal...${NC}"
if [ -f "$SCRIPT_DIR/sincronizar-estrutura-banco-completo.sql" ]; then
    run_sql_file "$SCRIPT_DIR/sincronizar-estrutura-banco-completo.sql"
fi

echo ""
echo -e "${GREEN}3. Executando migrações...${NC}"

MIGRATIONS=(
    "add_status_aprovacao_to_produtos.sql"
    "add-carteira-campos-e-pagamento-public-id.sql"
    "add-integracao-campos-to-afiliados.sql"
    "add-vendedor-id-to-afiliados.sql"
    "create-upsell-tables.sql"
    "add-slug-nome-atributos-to-upsell-pages.sql"
    "add-template-html-to-upsell-pages.sql"
    "add-template-id-to-upsell-pages.sql"
    "add-remarketing-config.sql"
    "create-remarketing-queue.sql"
    "add-venda-cancelada-id-to-remarketing-queue.sql"
    "create-remarketing-conversoes.sql"
    "add-whatsapp-notification-types.sql"
    "create-webhooks-table.sql"
)

for migration in "${MIGRATIONS[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo -e "${YELLOW}  → $migration${NC}"
        run_sql_file "$MIGRATIONS_DIR/$migration" || echo -e "${YELLOW}    ⚠️  Continuando...${NC}"
    fi
done

echo ""
echo -e "${GREEN}4. Forçando aprovação de produtos ativos...${NC}"
if [ -f "$SCRIPT_DIR/forcar-aprovacao-produtos-ativos.sql" ]; then
    run_sql_file "$SCRIPT_DIR/forcar-aprovacao-produtos-ativos.sql"
fi

echo ""
echo -e "${GREEN}✅ Concluído!${NC}"
echo ""
echo -e "${GREEN}📊 Estatísticas:${NC}"

su - postgres -c "psql -d $DB_NAME -c \"
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;
\""

echo ""
echo -e "${GREEN}🚀 Estrutura replicada com sucesso!${NC}"

