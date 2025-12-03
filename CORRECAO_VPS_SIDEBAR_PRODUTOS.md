# 🔧 Correção: Sidebar e Carregamento de Produtos na VPS

## 📋 Problemas Identificados

1. **Sidebar não está atualizado na VPS** - A estrutura do menu não corresponde ao código no GitHub
2. **Erro 500 ao carregar produtos** - A API `/api/produtos` retorna erro 500 na VPS

## ✅ Soluções

### 1. Atualizar Sidebar

O sidebar foi atualizado para incluir o item "Ferramentas" na ordem correta:

```
- Painel
- Gestão de Produtos
- Gestão de Vendas
- Pagamentos
- Ferramentas (NOVO)
- Integrações
- Afiliados
- Premiações
```

### 2. Passos para Corrigir na VPS

#### Passo 1: Atualizar Código do GitHub

```bash
cd /var/www/ratixpay.com
git pull origin main
```

#### Passo 2: Limpar Cache do Navegador

O sidebar pode estar em cache. Limpe o cache do navegador:
- **Chrome/Edge**: Ctrl+Shift+Del ou F12 > Network > Disable cache
- Ou force recarregamento: Ctrl+F5

#### Passo 3: Verificar se os Arquivos Foram Atualizados

```bash
# Verificar se o arquivo sidebar foi atualizado
cat public/js/sidebar-component.js | grep -A 5 "Ferramentas"
```

#### Passo 4: Reiniciar a Aplicação

```bash
# Se usar PM2
pm2 restart ratixpay

# Se usar systemd
sudo systemctl restart ratixpay
```

### 3. Corrigir Erro 500 ao Carregar Produtos

O erro 500 geralmente é causado por:

#### A) Problema de Autenticação

Verifique os logs:

```bash
# Ver logs em tempo real
pm2 logs ratixpay --lines 50

# Ou se usar systemd
sudo journalctl -u ratixpay -f
```

#### B) Problema com Banco de Dados

O erro pode ser causado por colunas que não existem. Execute as migrações:

```bash
cd /var/www/ratixpay.com
node scripts/migrate-database-columns.js
```

#### C) Verificar Permissões do Banco

Se ainda der erro de permissão:

```bash
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

#### D) Verificar Credenciais do Banco no .env

```bash
# Verificar se as credenciais estão corretas
cat .env | grep DB_
```

Deve mostrar algo como:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay
DB_USER=ratixuser
DB_PASS=sua_senha_aqui
```

#### E) Verificar Conexão com o Banco

```bash
# Testar conexão
psql -U ratixuser -d ratixpay -h localhost -c "SELECT COUNT(*) FROM produtos;"
```

### 4. Verificar se a Rota de Produtos Está Funcionando

Teste diretamente no servidor:

```bash
# Testar endpoint localmente no servidor
curl -H "Authorization: Bearer SEU_TOKEN_AQUI" http://localhost:3000/api/produtos

# Ou verificar logs da API
tail -f logs/app.log | grep produtos
```

### 5. Verificar Erros Específicos nos Logs

Procure por erros relacionados a:

```bash
# Procurar erros de produtos
pm2 logs ratixpay | grep -i "produto\|produtos\|error\|500"

# Procurar erros de autenticação
pm2 logs ratixpay | grep -i "auth\|token\|401\|403"
```

## 🔍 Troubleshooting Detalhado

### Se o Sidebar Ainda Não Atualizar

1. **Limpar cache do navegador completamente**
2. **Verificar se o arquivo JavaScript está sendo servido corretamente**:
   ```bash
   curl http://localhost:3000/js/sidebar-component.js | grep Ferramentas
   ```
3. **Verificar se há cache no servidor** (se usar nginx):
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Se os Produtos Ainda Não Carregarem

1. **Verificar se o PostgreSQL está rodando**:
   ```bash
   sudo systemctl status postgresql
   ```

2. **Verificar se a tabela produtos existe**:
   ```bash
   psql -U ratixuser -d ratixpay -c "\d produtos"
   ```

3. **Verificar se há produtos na tabela**:
   ```bash
   psql -U ratixuser -d ratixpay -c "SELECT COUNT(*) FROM produtos;"
   ```

4. **Verificar se o usuário tem permissões**:
   ```bash
   psql -U ratixuser -d ratixpay -c "SELECT * FROM produtos LIMIT 1;"
   ```

## 📝 Checklist Completo

- [ ] Código atualizado do GitHub (`git pull origin main`)
- [ ] Cache do navegador limpo
- [ ] Migrações do banco executadas
- [ ] Permissões do banco corrigidas
- [ ] Aplicação reiniciada
- [ ] Logs verificados para erros
- [ ] Credenciais do .env verificadas
- [ ] Conexão com banco testada

## 🚀 Comando Completo de Atualização

```bash
cd /var/www/ratixpay.com && \
git pull origin main && \
npm install --production && \
node scripts/migrate-database-columns.js && \
pm2 restart ratixpay && \
echo "✅ Atualização concluída!"
```

## 📚 Documentação Relacionada

- `GUIA_EXECUTAR_MIGRACOES.md` - Como executar migrações
- `CORRECAO_PERMISSOES_RAPIDO.md` - Correção de permissões
- `docs/MIGRACAO_BANCO_DADOS_VPS.md` - Migração de banco de dados

## ⚠️ Importante

Se após seguir todos os passos o problema persistir:

1. **Copie os logs completos**:
   ```bash
   pm2 logs ratixpay --lines 100 > logs_erro.txt
   ```

2. **Verifique o erro específico** no console do navegador (F12 > Console)

3. **Verifique se o token de autenticação está válido**:
   - O token pode ter expirado
   - Faça logout e login novamente

4. **Verifique se há diferenças de ambiente**:
   - Versão do Node.js
   - Versão do PostgreSQL
   - Variáveis de ambiente diferentes

