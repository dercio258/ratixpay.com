#!/bin/bash

# Script de Atualização Completa da VPS
# Atualiza código do GitHub e executa migrações do banco de dados

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
PROJECT_DIR="/var/www/ratixpay"  # Ajuste o caminho do seu projeto
NODE_ENV="production"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Atualização VPS - RatixPay         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}\n"

# Verificar se o diretório existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Diretório do projeto não encontrado: $PROJECT_DIR${NC}"
    exit 1
fi

cd $PROJECT_DIR || exit 1

# 1. Atualizar código do GitHub
echo -e "${YELLOW}📥 Passo 1: Atualizando código do GitHub...${NC}"
git fetch origin

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✅ Código já está atualizado!${NC}"
else
    echo -e "${YELLOW}🔄 Atualizando código...${NC}"
    git reset --hard origin/main
    git clean -fd
    echo -e "${GREEN}✅ Código atualizado!${NC}"
fi

# 2. Instalar/atualizar dependências
echo -e "\n${YELLOW}📦 Passo 2: Instalando dependências...${NC}"
npm install --production
echo -e "${GREEN}✅ Dependências instaladas!${NC}"

# 3. Verificar arquivo .env
echo -e "\n${YELLOW}🔐 Passo 3: Verificando configurações...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}⚠️  Crie o arquivo .env com as credenciais do banco de dados${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Arquivo .env encontrado!${NC}"

# 4. Executar migrações do banco de dados
echo -e "\n${YELLOW}🗄️  Passo 4: Executando migrações do banco de dados...${NC}"
node scripts/migrate-database-columns.js

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migrações executadas com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao executar migrações!${NC}"
    exit 1
fi

# 5. Reiniciar aplicação
echo -e "\n${YELLOW}🔄 Passo 5: Reiniciando aplicação...${NC}"

# Tentar PM2 primeiro
if command -v pm2 &> /dev/null; then
    pm2 restart ratixpay || pm2 restart all
    echo -e "${GREEN}✅ Aplicação reiniciada via PM2!${NC}"
# Tentar systemd
elif systemctl is-active --quiet ratixpay; then
    systemctl restart ratixpay
    echo -e "${GREEN}✅ Aplicação reiniciada via systemd!${NC}"
# Tentar nodemon ou node direto
else
    echo -e "${YELLOW}⚠️  Reinicie a aplicação manualmente${NC}"
fi

echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ Atualização Concluída!           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}\n"

