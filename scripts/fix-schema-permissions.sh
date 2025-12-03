#!/bin/bash

# Script para corrigir permissões do schema public
# Lê o usuário do banco de dados do arquivo .env
# Deve ser executado como superusuário PostgreSQL (postgres)

echo "🔧 Corrigindo permissões do schema public..."
echo ""

# Verificar se está rodando como usuário postgres ou com sudo
if [ "$EUID" -ne 0 ] && [ "$USER" != "postgres" ]; then
    echo "⚠️  Este script precisa ser executado como superusuário."
    echo "   Execute com: sudo -u postgres bash scripts/fix-schema-permissions.sh"
    echo "   Ou conecte manualmente: sudo -u postgres psql -d ratixpay"
    exit 1
fi

# Ler variáveis do .env se existir
if [ -f .env ]; then
    # Carregar variáveis do .env de forma segura (ignorando comentários)
    while IFS='=' read -r key value; do
        # Remover espaços e ignorar linhas vazias ou comentários
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        if [[ ! -z "$key" && ! "$key" =~ ^# ]]; then
            export "$key=$value"
        fi
    done < <(grep -v '^#' .env | grep -v '^$' | grep '=')
fi

# Definir valores padrão
DB_NAME=${DB_NAME:-ratixpay}
DB_USER=${DB_USER:-ratixuser}

# Se DB_USER ainda não estiver definido, tentar ler manualmente do .env
if [ -z "$DB_USER" ] || [ "$DB_USER" = "postgres" ]; then
    if [ -f .env ]; then
        # Ler DB_USER ignorando comentários
        DB_USER=$(grep -E "^[[:space:]]*DB_USER[[:space:]]*=" .env | grep -v '^#' | head -1 | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    fi
    # Se ainda estiver vazio ou for postgres, usar ratixuser como padrão
    if [ -z "$DB_USER" ] || [ "$DB_USER" = "postgres" ]; then
        DB_USER="ratixuser"
    fi
fi

echo "📊 Banco de dados: $DB_NAME"
echo "📊 Usuário: $DB_USER"
echo ""

# Executar SQL de correção de permissões
psql -d "$DB_NAME" <<EOF
-- Conceder uso do schema public
GRANT USAGE ON SCHEMA public TO $DB_USER;

-- Conceder criação no schema public
GRANT CREATE ON SCHEMA public TO $DB_USER;

-- Conceder todas as permissões em todas as tabelas existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;

-- Conceder todas as permissões em todas as sequências existentes
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;

-- Conceder permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON TABLES TO $DB_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON SEQUENCES TO $DB_USER;

SELECT '✅ Permissões do schema public concedidas ao usuário $DB_USER com sucesso!' AS status;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Permissões corrigidas com sucesso!"
    echo ""
    echo "🚀 Agora você pode executar novamente:"
    echo "   node scripts/migrate-database-columns.js"
else
    echo ""
    echo "❌ Erro ao corrigir permissões."
    exit 1
fi

