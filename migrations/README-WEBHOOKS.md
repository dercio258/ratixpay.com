# Migração da Tabela Webhooks

Este diretório contém scripts para criar e atualizar a tabela `webhooks` no banco de dados PostgreSQL.

## 📋 Arquivos Disponíveis

1. **`migrate-webhooks-vps.sql`** - Script SQL puro para executar diretamente no PostgreSQL
2. **`scripts/migrate-webhooks-table.js`** - Script Node.js para executar via aplicação
3. **`scripts/migrate-webhooks-vps.sh`** - Script bash para executar na VPS

## 🚀 Como Executar na VPS

### Opção 1: Script SQL Direto (Recomendado)

```bash
# Conectar ao PostgreSQL e executar o script
sudo -u postgres psql -d ratixpay -f migrations/migrate-webhooks-vps.sql
```

### Opção 2: Script Bash

```bash
# Dar permissão de execução (na VPS Linux)
chmod +x scripts/migrate-webhooks-vps.sh

# Executar o script
./scripts/migrate-webhooks-vps.sh
```

### Opção 3: Via Node.js

```bash
# Na raiz do projeto
node scripts/migrate-webhooks-table.js
```

### Opção 4: Executar SQL Manualmente

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql -d ratixpay

# Copiar e colar o conteúdo do arquivo migrate-webhooks-vps.sql
```

## 📊 Estrutura da Tabela

A tabela `webhooks` terá a seguinte estrutura:

- `id` (VARCHAR(255), PRIMARY KEY) - ID único do webhook
- `user_id` (UUID, NOT NULL) - ID do usuário que criou o webhook
- `produto_id` (UUID, NULL) - ID do produto (opcional, NULL para webhooks globais)
- `url` (TEXT, NOT NULL) - URL onde o webhook será enviado
- `eventos` (JSON, NOT NULL, DEFAULT '[]') - Array de eventos que o webhook deve receber
- `secret` (TEXT, NULL) - Secret opcional para validação de segurança
- `ativo` (BOOLEAN, NOT NULL, DEFAULT true) - Se o webhook está ativo
- `created_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TIMESTAMP, DEFAULT CURRENT_TIMESTAMP)

## 🔗 Relacionamentos

- **Foreign Key `fk_webhook_user`**: Referencia `usuarios(id)` com `ON DELETE CASCADE`
- **Foreign Key `fk_webhook_produto`**: Referencia `produtos(id)` com `ON DELETE CASCADE`

## 📈 Índices Criados

- `idx_webhooks_user_id` - Índice em `user_id` para buscas rápidas por usuário
- `idx_webhooks_produto_id` - Índice em `produto_id` para buscas por produto
- `idx_webhooks_ativo` - Índice em `ativo` para filtrar webhooks ativos
- `idx_webhooks_created_at` - Índice em `created_at` para ordenação

## ✅ Verificação

Após executar a migração, verifique se a tabela foi criada:

```sql
-- Verificar se a tabela existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'webhooks'
);

-- Ver estrutura da tabela
\d webhooks

-- Ver índices
\di webhooks
```

## 🔧 Troubleshooting

### Erro: "relation 'usuarios' does not exist"
- Certifique-se de que a tabela `usuarios` existe antes de executar a migração

### Erro: "relation 'produtos' does not exist"
- Certifique-se de que a tabela `produtos` existe antes de executar a migração

### Erro: "permission denied"
- Execute com permissões de superusuário: `sudo -u postgres psql -d ratixpay`

### Erro: "database 'ratixpay' does not exist"
- Crie o banco de dados primeiro ou ajuste o nome do banco no script

## 📝 Notas

- O script é **idempotente**: pode ser executado múltiplas vezes sem causar erros
- Se a tabela já existir, o script apenas verifica e adiciona a coluna `produto_id` se necessário
- Todos os índices são criados com `IF NOT EXISTS` para evitar erros

