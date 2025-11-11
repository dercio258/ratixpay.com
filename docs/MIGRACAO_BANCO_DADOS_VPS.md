# Migração Automática do Banco de Dados na VPS

## 📋 Visão Geral

O sistema possui um script de migração automática que:
- ✅ Conecta ao banco de dados usando credenciais do `.env`
- ✅ Verifica e cria colunas necessárias automaticamente
- ✅ Registra migrações executadas para evitar duplicação
- ✅ É seguro e não quebra o banco existente

## 🚀 Como Usar na VPS

### Opção 1: Script Completo (Recomendado)

O script `update-database-vps.sh` faz tudo automaticamente:

```bash
# Tornar executável
chmod +x scripts/update-database-vps.sh

# Executar
./scripts/update-database-vps.sh
```

Este script:
1. Atualiza código do GitHub
2. Instala dependências
3. Verifica arquivo .env
4. Executa migrações do banco
5. Reinicia aplicação

### Opção 2: Apenas Migrações do Banco

Se quiser executar apenas as migrações:

```bash
# Após fazer git pull
cd /var/www/ratixpay
node scripts/migrate-database-columns.js
```

## 📝 Configuração do .env

Certifique-se de que o arquivo `.env` contém as credenciais corretas:

```env
# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
```

## 🔍 Migrações Incluídas

O script executa automaticamente as seguintes migrações:

### 1. `add_cliente_whatsapp_to_vendas`
- Adiciona coluna `cliente_whatsapp VARCHAR(255)` na tabela `vendas`

### 2. `add_carteira_fields`
- Adiciona colunas na tabela `carteiras`:
  - `tipo_carteira VARCHAR(50) DEFAULT 'mpesa'`
  - `status VARCHAR(20) DEFAULT 'ativo'`
  - `created_at TIMESTAMP`
  - `updated_at TIMESTAMP`

### 3. `add_tracking_data_to_vendas`
- Adiciona coluna `tracking_data JSONB` na tabela `vendas`

### 4. `add_timestamps_to_vendas`
- Adiciona colunas `created_at` e `updated_at` na tabela `vendas`

## 🛡️ Segurança

O script é seguro porque:
- ✅ Verifica se colunas já existem antes de criar
- ✅ Usa transações quando possível
- ✅ Registra migrações executadas
- ✅ Não executa migrações duplicadas
- ✅ Não remove dados existentes

## 📊 Tabela de Controle

O script cria uma tabela `schema_migrations` para rastrear migrações:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Adicionar Novas Migrações

Para adicionar novas migrações, edite `scripts/migrate-database-columns.js`:

```javascript
const migrations = [
    // ... migrações existentes
    {
        name: 'nome_da_migracao',
        sql: `
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'nome_tabela' 
                    AND column_name = 'nome_coluna'
                ) THEN
                    ALTER TABLE nome_tabela ADD COLUMN nome_coluna TIPO;
                    RAISE NOTICE 'Coluna adicionada';
                END IF;
            END $$;
        `
    }
];
```

## ⚠️ Troubleshooting

### Erro de Conexão

```
❌ Erro fatal ao executar migrações: connect ECONNREFUSED
```

**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Verifique credenciais no `.env`
3. Verifique firewall/porta 5432

### Erro de Permissão

```
❌ ERROR: permission denied for table
```

**Solução:**
1. Verifique se o usuário do banco tem permissões
2. Execute como superusuário se necessário:
   ```bash
   sudo -u postgres psql -d ratixpay
   ```

### Coluna Já Existe

O script detecta automaticamente e ignora. Não é um erro.

## 📋 Comando Completo para VPS

```bash
# Atualizar tudo (código + banco + reiniciar)
cd /var/www/ratixpay && \
git fetch origin && \
git reset --hard origin/main && \
git clean -fd && \
npm install --production && \
node scripts/migrate-database-columns.js && \
pm2 restart ratixpay
```

## ✅ Verificação

Após executar, verifique:

```bash
# Conectar ao banco
psql -U postgres -d ratixpay

# Verificar colunas da tabela vendas
\d vendas

# Verificar migrações executadas
SELECT * FROM schema_migrations;
```

## 🎯 Fluxo Recomendado na VPS

1. **Fazer backup do banco** (opcional mas recomendado):
   ```bash
   pg_dump -U postgres ratixpay > backup_$(date +%Y%m%d).sql
   ```

2. **Executar script de atualização**:
   ```bash
   ./scripts/update-database-vps.sh
   ```

3. **Verificar logs**:
   ```bash
   pm2 logs ratixpay
   # ou
   tail -f /var/log/ratixpay/app.log
   ```
