# Comandos para VPS - Carregar Arquivos do GitHub

## 📋 Comandos para Sincronizar VPS com GitHub

### 1. Se o repositório já existe na VPS (atualizar)

```bash
# Navegar para o diretório do projeto
cd /caminho/do/projeto

# Verificar status atual
git status

# Buscar todas as atualizações do GitHub
git fetch origin

# Atualizar para a versão mais recente (branch main)
git pull origin main

# OU se quiser forçar atualização completa (cuidado!)
git fetch origin
git reset --hard origin/main
```

### 2. Se o repositório NÃO existe na VPS (clonar pela primeira vez)

```bash
# Navegar para o diretório onde quer clonar
cd /var/www  # ou outro diretório desejado

# Clonar o repositório
git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git

# OU se usar SSH
git clone git@github.com:SEU_USUARIO/SEU_REPOSITORIO.git

# Navegar para o diretório clonado
cd SEU_REPOSITORIO

# Instalar dependências
npm install
```

### 3. Comando Completo de Atualização (Recomendado)

```bash
# Atualizar tudo do GitHub
cd /caminho/do/projeto && \
git fetch origin && \
git reset --hard origin/main && \
git clean -fd && \
npm install
```

### 4. Script de Atualização Automática

Crie um arquivo `update-from-github.sh`:

```bash
#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Atualizando projeto do GitHub...${NC}"

# Diretório do projeto
PROJECT_DIR="/var/www/ratixpay"  # Ajuste o caminho

cd $PROJECT_DIR || exit 1

# Backup do estado atual (opcional)
echo -e "${YELLOW}📦 Fazendo backup...${NC}"
git stash

# Buscar atualizações
echo -e "${YELLOW}📥 Buscando atualizações do GitHub...${NC}"
git fetch origin

# Verificar se há atualizações
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${GREEN}✅ Já está atualizado!${NC}"
    exit 0
fi

# Atualizar código
echo -e "${YELLOW}🔄 Atualizando código...${NC}"
git reset --hard origin/main
git clean -fd

# Instalar/atualizar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install --production

# Reiniciar aplicação (se necessário)
echo -e "${YELLOW}🔄 Reiniciando aplicação...${NC}"
pm2 restart ratixpay || systemctl restart ratixpay || echo "Ajuste o comando de restart"

echo -e "${GREEN}✅ Atualização concluída!${NC}"
```

Tornar executável:
```bash
chmod +x update-from-github.sh
```

Executar:
```bash
./update-from-github.sh
```

## 🔐 Configuração de Autenticação

### Se usar HTTPS (precisa de token):

```bash
# Configurar credenciais
git config --global credential.helper store

# Na primeira vez, será pedido usuário e senha/token
git pull origin main
```

### Se usar SSH (recomendado):

```bash
# Gerar chave SSH (se ainda não tiver)
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"

# Copiar chave pública
cat ~/.ssh/id_ed25519.pub

# Adicionar a chave no GitHub: Settings > SSH and GPG keys > New SSH key

# Testar conexão
ssh -T git@github.com
```

## ⚠️ Comandos Importantes

### Verificar diferenças antes de atualizar:
```bash
git fetch origin
git diff HEAD origin/main
```

### Verificar status:
```bash
git status
git log --oneline -5
```

### Desfazer mudanças locais (se necessário):
```bash
git reset --hard origin/main
git clean -fd
```

### Verificar branch atual:
```bash
git branch
git branch -a
```

## 🚀 Comando Rápido (Copy & Paste)

```bash
cd /var/www/ratixpay && git fetch origin && git reset --hard origin/main && git clean -fd && npm install
```

## 📝 Notas Importantes

1. **Backup**: Sempre faça backup antes de atualizar em produção
2. **Variáveis de Ambiente**: Verifique se `.env` está configurado corretamente
3. **Dependências**: Execute `npm install` após atualizar
4. **Banco de Dados**: Verifique se há migrações pendentes
5. **Serviços**: Reinicie o servidor/PM2 após atualizar

