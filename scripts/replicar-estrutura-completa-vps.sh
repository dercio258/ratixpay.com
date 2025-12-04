#!/bin/bash

# ===========================================
# REPLICAÇÃO COMPLETA DA ESTRUTURA DO BANCO DE DADOS
# ===========================================
# Este script executa todas as migrações necessárias para replicar
# a estrutura completa do banco local na VPS
#
# Uso: sudo -u postgres bash scripts/replicar-estrutura-completa-vps.sh

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Ler variáveis do .env se existir
if [ -f .env ]; then
    set -a
    source .env 2>/dev/null || true
    set +a
fi

# Definir valores padrão
DB_NAME=${DB_NAME:-ratixpay}
DB_USER=${DB_USER:-ratixuser}

echo -e "${GREEN}🚀 Iniciando replicação completa da estrutura do banco de dados...${NC}"
echo -e "${YELLOW}📊 Banco: $DB_NAME${NC}"
echo -e "${YELLOW}📊 Usuário: $DB_USER${NC}"
echo ""

# Diretório base
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

# Detectar se estamos como root ou postgres
if [ "$EUID" -eq 0 ] || [ "$USER" = "root" ]; then
    # Estamos como root, usar runuser ou su
    PSQL_CMD="runuser -u postgres -- psql"
elif [ "$USER" = "postgres" ]; then
    # Já estamos como postgres
    PSQL_CMD="psql"
else
    # Tentar sudo, se não funcionar, tentar runuser
    PSQL_CMD="sudo -u postgres psql" || PSQL_CMD="runuser -u postgres -- psql"
fi

echo -e "${GREEN}1. Corrigindo permissões do schema public...${NC}"
$PSQL_CMD -d "$DB_NAME" -f "$SCRIPT_DIR/fix-schema-permissions.sql" || {
    echo -e "${YELLOW}⚠️  Aviso: Erro ao corrigir permissões (tentando alternativa...)${NC}"
    # Tentar diretamente como postgres se não funcionou
    if [ "$USER" != "postgres" ]; then
        su - postgres -c "psql -d $DB_NAME -f $SCRIPT_DIR/fix-schema-permissions.sql" || {
            echo -e "${YELLOW}⚠️  Permissões podem já estar corretas, continuando...${NC}"
        }
    fi
}

echo ""
echo -e "${GREEN}2. Executando script de sincronização principal...${NC}"
$PSQL_CMD -d "$DB_NAME" -f "$SCRIPT_DIR/sincronizar-estrutura-banco-completo.sql" || {
    if [ "$USER" != "postgres" ]; then
        su - postgres -c "psql -d $DB_NAME -f $SCRIPT_DIR/sincronizar-estrutura-banco-completo.sql"
    fi
}

echo ""
echo -e "${GREEN}3. Executando migrações em ordem...${NC}"

# Lista de migrações em ordem de execução
MIGRATIONS=(
    "add_status_aprovacao_to_produtos.sql"
    "add-carteira-campos-e-pagamento-public-id.sql"
    "add-integracao-campos-to-afiliados.sql"
    "add-indexes-produtos-afiliados.sql"
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
        echo -e "${YELLOW}  → Executando: $migration${NC}"
        $PSQL_CMD -d "$DB_NAME" -f "$MIGRATIONS_DIR/$migration" || {
            if [ "$USER" != "postgres" ]; then
                su - postgres -c "psql -d $DB_NAME -f $MIGRATIONS_DIR/$migration" || {
                    echo -e "${YELLOW}    ⚠️  Erro ao executar $migration (continuando...)${NC}"
                }
            else
                echo -e "${YELLOW}    ⚠️  Erro ao executar $migration (continuando...)${NC}"
            fi
        }
    else
        echo -e "${YELLOW}  ⚠️  Arquivo não encontrado: $migration${NC}"
    fi
done

echo ""
echo -e "${GREEN}4. Forçando aprovação de produtos ativos...${NC}"
if [ -f "$SCRIPT_DIR/forcar-aprovacao-produtos-ativos.sql" ]; then
    $PSQL_CMD -d "$DB_NAME" -f "$SCRIPT_DIR/forcar-aprovacao-produtos-ativos.sql" || {
        if [ "$USER" != "postgres" ]; then
            su - postgres -c "psql -d $DB_NAME -f $SCRIPT_DIR/forcar-aprovacao-produtos-ativos.sql" || {
                echo -e "${YELLOW}  ⚠️  Erro ao executar script de aprovação${NC}"
            }
        fi
    }
else
    echo -e "${YELLOW}  ⚠️  Script não encontrado, continuando...${NC}"
fi

echo ""
echo -e "${GREEN}✅ Replicação completa concluída!${NC}"
echo ""
echo -e "${GREEN}📊 Verificando estrutura final...${NC}"

# Mostrar estatísticas
$PSQL_CMD -d "$DB_NAME" -c "
SELECT 
    'produtos' as tabela,
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;
" || {
    if [ "$USER" != "postgres" ]; then
        su - postgres -c "psql -d $DB_NAME -c \"SELECT 'produtos' as tabela, status_aprovacao, COUNT(*) as total, SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos FROM produtos GROUP BY status_aprovacao ORDER BY status_aprovacao;\""
    fi
}

echo ""
echo -e "${GREEN}🚀 Estrutura replicada com sucesso!${NC}"

