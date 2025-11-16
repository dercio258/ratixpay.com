# Guia: Atualizar VPS do GitHub

## Método 1: Pull Direto (Recomendado)

### Se o repositório já está clonado na VPS:

```bash
# 1. Conectar na VPS via SSH
ssh usuario@ip_da_vps

# 2. Navegar até o diretório do projeto
cd /caminho/do/projeto

# 3. Verificar status atual
git status

# 4. Fazer pull das atualizações do GitHub


# 5. Instalar/atualizar dependências (se necessário)
npm install

# 6. Reiniciar o servidor (se necessário)
pm2 restart all
# ou
systemctl restart seu-servico
```

---

## Método 2: Clone Inicial (Primeira Vez)

### Se é a primeira vez configurando na VPS:

```bash
# 1. Conectar na VPS via SSH
ssh usuario@ip_da_vps

# 2. Navegar até o diretório onde quer clonar
cd /var/www  # ou outro diretório de sua preferência

# 3. Clonar o repositório
git clone https://github.com/dercio258/ratixpay.com.git

# 4. Entrar no diretório
cd ratixpay.com

# 5. Instalar dependências
npm install

# 6. Copiar arquivo .env (se necessário)
cp .env.example .env
nano .env  # Editar com suas credenciais

# 7. Iniciar o servidor
npm start
# ou com PM2
pm2 start server.js --name ratixpay
```

---

## Método 3: Script Automatizado

### Criar script de atualização na VPS:

```bash
# Criar arquivo de atualização
nano /usr/local/bin/atualizar-ratixpay.sh
```

**Conteúdo do script:**

```bash
#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔄 Atualizando RatixPay do GitHub...${NC}"

# Diretório do projeto
PROJECT_DIR="/var/www/ratixpay.com"  # Ajuste conforme seu caminho

# Verificar se o diretório existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Diretório do projeto não encontrado: $PROJECT_DIR${NC}"
    exit 1
fi

# Entrar no diretório
cd "$PROJECT_DIR" || exit 1

# Fazer backup do .env (se existir)
if [ -f .env ]; then
    cp .env .env.backup
    echo -e "${GREEN}✅ Backup do .env criado${NC}"
fi

# Fazer pull
echo -e "${YELLOW}📥 Fazendo pull do GitHub...${NC}"
git pull origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Pull realizado com sucesso${NC}"
    
    # Instalar dependências (se package.json foi alterado)
    if git diff --name-only HEAD@{1} HEAD | grep -q package.json; then
        echo -e "${YELLOW}📦 Instalando dependências...${NC}"
        npm install
    fi
    
    # Restaurar .env se foi sobrescrito
    if [ -f .env.backup ] && [ ! -f .env ]; then
        mv .env.backup .env
        echo -e "${GREEN}✅ .env restaurado${NC}"
    fi
    
    # Reiniciar PM2 (se estiver usando)
    if command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}🔄 Reiniciando aplicação PM2...${NC}"
        pm2 restart ratixpay || pm2 restart all
    fi
    
    echo -e "${GREEN}✅ Atualização concluída!${NC}"
else
    echo -e "${RED}❌ Erro ao fazer pull${NC}"
    exit 1
fi
```

**Tornar o script executável:**

```bash
chmod +x /usr/local/bin/atualizar-ratixpay.sh
```

**Usar o script:**

```bash
sudo atualizar-ratixpay.sh
```

---

## Método 4: Usando Webhook (Automático)

### Configurar webhook do GitHub para atualizar automaticamente:

**1. Criar endpoint na VPS:**

```bash
# Criar arquivo webhook
nano /var/www/webhook.php  # ou webhook.js se usar Node.js
```

**2. Configurar no GitHub:**

- Vá em: Settings → Webhooks → Add webhook
- Payload URL: `https://seu-dominio.com/webhook`
- Content type: `application/json`
- Events: `Just the push event`

**3. Script webhook simples (Node.js):**

```javascript
const http = require('http');
const { exec } = require('child_process');

http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            exec('cd /var/www/ratixpay.com && git pull origin main && pm2 restart ratixpay', 
                (error, stdout, stderr) => {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end('OK');
                });
        });
    }
}).listen(3001);
```

---

## Comandos Úteis na VPS

### Verificar status do Git:

```bash
git status
git log --oneline -5  # Últimos 5 commits
```

### Ver diferenças antes de fazer pull:

```bash
git fetch origin
git diff HEAD origin/main
```

### Fazer pull forçado (cuidado!):

```bash
git fetch origin
git reset --hard origin/main
```

### Verificar se há atualizações:

```bash
git fetch origin
git status
```

### Desfazer mudanças locais e atualizar:

```bash
git stash  # Salvar mudanças locais
git pull origin main
git stash pop  # Restaurar mudanças locais (se necessário)
```

---

## Checklist de Atualização

- [ ] Conectar na VPS via SSH
- [ ] Navegar até o diretório do projeto
- [ ] Fazer backup do `.env` (se necessário)
- [ ] Verificar status: `git status`
- [ ] Fazer pull: `git pull origin main`
- [ ] Instalar dependências: `npm install` (se package.json mudou)
- [ ] Restaurar `.env` (se foi sobrescrito)
- [ ] Reiniciar servidor/PM2
- [ ] Verificar se está funcionando

---

## Troubleshooting

### Erro: "Your local changes would be overwritten"

```bash
# Salvar mudanças locais
git stash

# Fazer pull
git pull origin main

# Restaurar mudanças (se necessário)
git stash pop
```

### Erro: "Permission denied"

```bash
# Verificar permissões
ls -la

# Ajustar permissões (se necessário)
sudo chown -R usuario:usuario /caminho/do/projeto
```

### Erro: "Not a git repository"

```bash
# Verificar se está no diretório correto
pwd

# Se necessário, clonar novamente
git clone https://github.com/dercio258/ratixpay.com.git
```

---

## Exemplo Completo de Atualização

```bash
# 1. Conectar na VPS
ssh root@seu-ip-vps

# 2. Ir para o diretório
cd /var/www/ratixpay.com

# 3. Verificar status
git status

# 4. Fazer backup do .env
cp .env .env.backup

# 5. Atualizar do GitHub
git pull origin main

# 6. Instalar dependências (se necessário)
npm install

# 7. Restaurar .env
if [ ! -f .env ]; then
    mv .env.backup .env
fi

# 8. Reiniciar aplicação
pm2 restart ratixpay

# 9. Verificar logs
pm2 logs ratixpay --lines 50
```

---

## Notas Importantes

⚠️ **SEMPRE faça backup do `.env` antes de atualizar!**

⚠️ **Verifique se o `.env` não foi sobrescrito após o pull!**

⚠️ **Teste em ambiente de desenvolvimento antes de atualizar produção!**

✅ **Use PM2 ou similar para gerenciar o processo Node.js**

✅ **Configure logs para monitorar erros após atualização**

