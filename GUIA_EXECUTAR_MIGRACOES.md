# 📚 Guia Completo - Como Executar Migrações

Este guia explica todas as formas de executar migrações no projeto RatixPay.

## 📋 Índice

1. [Método 1: Script Automático (Recomendado)](#método-1-script-automático-recomendado)
2. [Método 2: Migrações SQL Individuais](#método-2-migrações-sql-individuais)
3. [Método 3: Scripts Node.js Específicos](#método-3-scripts-nodejs-específicos)
4. [Método 4: Via psql (PostgreSQL)](#método-4-via-psql-postgresql)
5. [Verificar Migrações Executadas](#verificar-migrações-executadas)
6. [Troubleshooting](#troubleshooting)

---

## 🚀 Método 1: Script Automático (Recomendado)

O script `migrate-database-columns.js` executa automaticamente todas as migrações definidas no código. É o método mais seguro e recomendado.

### Na VPS (Produção):

```bash
# 1. Ir para o diretório do projeto
cd /var/www/ratixpay.com

# 2. Atualizar código do GitHub (se necessário)
git pull origin main

# 3. Executar migrações automáticas
node scripts/migrate-database-columns.js
```

### Localmente (Desenvolvimento):

```bash
# No diretório do projeto
npm run db:migrate
# ou
node scripts/migrate-database-columns.js
```

### O que este script faz:

- ✅ Conecta ao banco usando credenciais do `.env`
- ✅ Verifica quais migrações já foram executadas
- ✅ Executa apenas as migrações pendentes
- ✅ Registra todas as migrações na tabela `schema_migrations`
- ✅ É seguro e não duplica migrações
- ✅ Não remove dados existentes

### Migrações incluídas no script automático:

O script `migrate-database-columns.js` inclui várias migrações, como:
- Adição de campos em `vendas` (cliente_whatsapp, tracking_data, timestamps)
- Adição de campos em `carteiras` (tipo_carteira, status, timestamps)
- Adição de campos em `produtos` (status_aprovacao, motivo_rejeicao)
- Adição de campos em `pagamentos` (public_id, valor_liquido, taxa, etc.)
- E muitas outras...

---

## 📄 Método 2: Migrações SQL Individuais

Você pode executar arquivos SQL individuais da pasta `migrations/` manualmente.

### Opção A: Via psql (Recomendado)

```bash
# Na VPS, conecte-se ao PostgreSQL
sudo -u postgres psql -d ratixpay -f migrations/nome-do-arquivo.sql
```

**Exemplo:**

```bash
# Executar migração de criação de tabela de upsell
sudo -u postgres psql -d ratixpay -f migrations/create-upsell-tables.sql

# Executar migração de criação de webhooks
sudo -u postgres psql -d ratixpay -f migrations/create-webhooks-table.sql

# Executar migração de status de aprovação
sudo -u postgres psql -d ratixpay -f migrations/add_status_aprovacao_to_produtos.sql
```

### Opção B: Via Node.js (Lê do .env automaticamente)

Crie um script temporário ou use o `run-migration.js`:

```bash
# Executar uma migração SQL específica
node migrations/run-migration.js migrations/create-upsell-tables.sql
```

### Arquivos SQL disponíveis:

#### Tabelas Principais:
- `create-upsell-tables.sql` - Cria tabelas de upsell
- `create-webhooks-table.sql` - Cria tabela de webhooks
- `create-remarketing-queue.sql` - Cria tabela de fila de remarketing
- `create-remarketing-conversoes.sql` - Cria tabela de conversões de remarketing

#### Adição de Colunas:
- `add_status_aprovacao_to_produtos.sql` - Adiciona status de aprovação aos produtos
- `add-carteira-campos-e-pagamento-public-id.sql` - Campos de carteira e public_id
- `add-vendedor-id-to-afiliados.sql` - Adiciona vendedor_id aos afiliados
- `add-integracao-campos-to-afiliados.sql` - Campos de integração aos afiliados
- `add-whatsapp-notification-types.sql` - Tipos de notificação WhatsApp
- E muitos outros...

#### Índices:
- `add-indexes-produtos-afiliados.sql` - Adiciona índices para performance

---

## 🔧 Método 3: Scripts Node.js Específicos

Algumas migrações têm scripts Node.js dedicados que fazem mais do que apenas SQL.

### Scripts disponíveis:

```bash
# Migração de slug para upsell pages
node migrations/run-upsell-slug-migration.js

# Migração de templates para upsell pages
node migrations/run-upsell-template-migrations.js

# Migração de vendedor_id para afiliados
node migrations/run-afiliados-vendedor-id-migration.js

# Verificar migrações de upsell
node migrations/verify-upsell-migrations.js
```

### Como usar:

```bash
cd /var/www/ratixpay.com
node migrations/nome-do-script.js
```

---

## 💻 Método 4: Via psql (PostgreSQL)

Para executar comandos SQL diretamente no PostgreSQL:

### Passo 1: Conectar ao banco

```bash
sudo -u postgres psql -d ratixpay
```

### Passo 2: Copiar e colar o conteúdo do arquivo SQL

Dentro do psql, você pode:

```sql
-- Ler e executar um arquivo SQL
\i migrations/create-upsell-tables.sql

-- Ou copiar e colar o conteúdo do arquivo diretamente
```

### Passo 3: Verificar resultado

```sql
-- Verificar se a tabela foi criada
\d upsell_pages

-- Ver estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'upsell_pages';
```

### Sair do psql

```sql
\q
```

---

## ✅ Verificar Migrações Executadas

### Opção 1: Via Script Automático

O script automático cria uma tabela `schema_migrations` que rastreia todas as migrações:

```bash
sudo -u postgres psql -d ratixpay
```

```sql
-- Ver todas as migrações executadas
SELECT * FROM schema_migrations ORDER BY executed_at DESC;

-- Ver últimas 10 migrações
SELECT migration_name, executed_at 
FROM schema_migrations 
ORDER BY executed_at DESC 
LIMIT 10;
```

### Opção 2: Verificar Estrutura do Banco

```sql
-- Ver todas as tabelas
\dt

-- Ver estrutura de uma tabela específica
\d nome_da_tabela

-- Ver todas as colunas de uma tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'nome_da_tabela'
ORDER BY ordinal_position;
```

---

## 🔄 Script Completo de Atualização (VPS)

Para atualizar tudo de uma vez (código + migrações + reiniciar):

```bash
#!/bin/bash
cd /var/www/ratixpay.com

# Atualizar código
git fetch origin
git reset --hard origin/main
git clean -fd

# Instalar dependências
npm install --production

# Executar migrações automáticas
node scripts/migrate-database-columns.js

# Reiniciar aplicação (PM2)
pm2 restart ratixpay

# Ou se usar systemd
# sudo systemctl restart ratixpay
```

Ou use o script pronto:

```bash
chmod +x scripts/update-database-vps.sh
./scripts/update-database-vps.sh
```

---

## ⚠️ Troubleshooting

### Erro: "permission denied for schema public"

Este erro significa que o usuário do banco não tem permissões. Veja o guia:
- `CORRECAO_PERMISSOES_RAPIDO.md`

**Solução rápida:**

```bash
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

### Erro: "column already exists"

Se você receber este erro, significa que a coluna já existe. Isso **não é um problema** - o script detecta automaticamente e ignora.

### Erro: "relation does not exist"

Se a tabela não existe, você precisa criar primeiro. Execute as migrações de criação de tabelas antes:

```bash
# Criar tabelas principais primeiro
sudo -u postgres psql -d ratixpay -f migrations/create-upsell-tables.sql
sudo -u postgres psql -d ratixpay -f migrations/create-webhooks-table.sql
```

### Erro de conexão

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar credenciais no .env
cat .env | grep DB_

# Testar conexão
psql -U ratixuser -d ratixpay -h localhost
```

### Migração falhou parcialmente

Se uma migração falhou no meio do caminho:

1. **Verificar o erro** nos logs
2. **Corrigir manualmente** se necessário
3. **Registrar a migração manualmente** na tabela `schema_migrations`:

```sql
INSERT INTO schema_migrations (migration_name) 
VALUES ('nome_da_migracao') 
ON CONFLICT DO NOTHING;
```

---

## 📝 Ordem Recomendada de Execução

Se você está configurando o banco pela primeira vez:

1. **Criar tabelas principais:**
   ```bash
   sudo -u postgres psql -d ratixpay -f migrations/create-upsell-tables.sql
   sudo -u postgres psql -d ratixpay -f migrations/create-webhooks-table.sql
   sudo -u postgres psql -d ratixpay -f migrations/create-remarketing-queue.sql
   ```

2. **Executar script automático:**
   ```bash
   node scripts/migrate-database-columns.js
   ```

3. **Executar migrações específicas:**
   ```bash
   node migrations/run-upsell-slug-migration.js
   node migrations/run-upsell-template-migrations.js
   ```

4. **Verificar tudo:**
   ```bash
   node migrations/verify-upsell-migrations.js
   ```

---

## 🔐 Variáveis do .env Necessárias

Certifique-se de que o arquivo `.env` contém:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay
DB_USER=ratixuser
DB_PASS=sua_senha_aqui
```

---

## 📚 Documentação Relacionada

- `ATUALIZAR_BD_VPS.md` - Guia de atualização na VPS
- `docs/MIGRACAO_BANCO_DADOS_VPS.md` - Documentação detalhada
- `CORRECAO_PERMISSOES_RAPIDO.md` - Correção de permissões

---

## 💡 Dicas

1. **Sempre faça backup** antes de executar migrações em produção:
   ```bash
   pg_dump -U ratixuser -d ratixpay > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Teste em ambiente de desenvolvimento** primeiro

3. **Execute migrações uma por vez** se houver dúvidas

4. **Verifique os logs** após cada migração

5. **Use o script automático** sempre que possível - é mais seguro

---

## ❓ Precisa de Ajuda?

Se encontrar problemas:
1. Verifique os logs de erro
2. Consulte a seção Troubleshooting
3. Verifique se todas as dependências estão instaladas
4. Certifique-se de que as permissões estão corretas

