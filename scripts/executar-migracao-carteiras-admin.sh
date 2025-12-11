#!/bin/bash
# Script Bash para executar migração de carteiras do administrador
# Uso: bash scripts/executar-migracao-carteiras-admin.sh

set -e

# Carregar variáveis de ambiente do .env se existir
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Obter configurações do banco de dados
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-ratixpay_local}
DB_USER=${DB_USER:-postgres}
DB_PASS=${DB_PASS:-postgres}

echo "🔄 Iniciando migração de carteiras do administrador..."
echo "📊 Banco: $DB_NAME em $DB_HOST:$DB_PORT"

SQL_FILE="migrations/create-carteiras-admin.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Arquivo de migração não encontrado: $SQL_FILE"
    exit 1
fi

# Executar migração usando psql
export PGPASSWORD=$DB_PASS
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SQL_FILE

if [ $? -eq 0 ]; then
    echo "✅ Migração executada com sucesso!"
    echo "✅ Tabela carteiras_admin criada"
    echo "✅ Carteiras M-Pesa e Emola inicializadas"
    
    # Verificar carteiras criadas
    echo ""
    echo "📊 Verificando carteiras criadas..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT tipo, nome, saldo FROM carteiras_admin ORDER BY tipo;"
else
    echo "❌ Erro ao executar migração"
    exit 1
fi

unset PGPASSWORD

echo ""
echo "✅ Migração concluída!"

