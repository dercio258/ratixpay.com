#!/bin/bash

# Script para corrigir permissões do schema public para o usuário ratixpay
# Deve ser executado como superusuário PostgreSQL (postgres)

echo "🔧 Corrigindo permissões do schema public para o usuário ratixpay..."
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
    # Carregar variáveis do .env de forma segura
    set -a
    source .env 2>/dev/null || true
    set +a
fi

# Definir valores padrão
DB_NAME=${DB_NAME:-ratixpay}
DB_USER=${DB_USER:-ratixpay}

# Se DB_USER não estiver definido, tentar usar o usuário da conexão atual
if [ -z "$DB_USER" ] || [ "$DB_USER" = "postgres" ]; then
    # Tentar ler do .env manualmente
    if [ -f .env ]; then
        DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | xargs)
    fi
    # Se ainda estiver vazio ou for postgres, usar ratixpay como padrão para o usuário que precisa de permissões
    if [ -z "$DB_USER" ] || [ "$DB_USER" = "postgres" ]; then
        DB_USER="ratixpay"
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

