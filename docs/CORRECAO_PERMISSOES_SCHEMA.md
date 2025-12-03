# Correção de Permissões do Schema Public

## 🐛 Problema

Ao executar o script de migração `migrate-database-columns.js`, você pode receber o seguinte erro:

```
❌ Erro fatal ao executar migrações: permission denied for schema public
```

## 🔍 Causa

O usuário do banco de dados (geralmente `ratixpay`) não tem permissões suficientes no schema `public` do PostgreSQL. Isso é comum em versões mais recentes do PostgreSQL (15+) que têm políticas de segurança mais restritivas.

## ✅ Solução

Há três maneiras de corrigir este problema:

### Opção 1: Script SQL (Recomendado)

Execute como superusuário PostgreSQL:

```bash
# Na VPS, como root ou com sudo
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

Ou conecte manualmente e execute:

```bash
sudo -u postgres psql -d ratixpay
```

Depois, dentro do psql, cole o conteúdo do arquivo `scripts/fix-schema-permissions.sql` ou execute:

```sql
GRANT USAGE ON SCHEMA public TO ratixpay;
GRANT CREATE ON SCHEMA public TO ratixpay;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ratixpay;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ratixpay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ratixpay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ratixpay;
```

### Opção 2: Script Shell

```bash
# Dar permissão de execução
chmod +x scripts/fix-schema-permissions.sh

# Executar como superusuário
sudo -u postgres bash scripts/fix-schema-permissions.sh
```

### Opção 3: Script Node.js

**Nota:** Este script também precisa ser executado com um usuário que tenha privilégios de superusuário (como `postgres`).

```bash
# Alterar temporariamente DB_USER no .env para postgres
# Ou executar com usuário postgres:
sudo -u postgres -i
export DB_USER=postgres
export DB_PASS=sua_senha_postgres
node scripts/fix-schema-permissions.js
```

## 🔐 Verificar Permissões Atuais

Para verificar as permissões atuais do usuário:

```sql
-- Conectar ao PostgreSQL
sudo -u postgres psql -d ratixpay

-- Verificar permissões do schema
SELECT 
    nspname AS schema_name,
    r.rolname AS role_name,
    has_schema_privilege(r.rolname, nspname, 'USAGE') AS has_usage,
    has_schema_privilege(r.rolname, nspname, 'CREATE') AS has_create
FROM pg_namespace n
CROSS JOIN pg_roles r
WHERE nspname = 'public' 
  AND r.rolname = 'ratixpay';
```

## 📋 O que o Script Faz

1. ✅ Concede `USAGE` no schema public (permite usar o schema)
2. ✅ Concede `CREATE` no schema public (permite criar objetos)
3. ✅ Concede todas as permissões nas tabelas existentes
4. ✅ Concede todas as permissões nas sequências existentes
5. ✅ Define permissões padrão para objetos futuros

## 🚀 Após Corrigir

Após executar qualquer uma das opções acima, você pode executar novamente o script de migração:

```bash
node scripts/migrate-database-columns.js
```

## ⚠️ Troubleshooting

### Erro: "role ratixpay does not exist"

O usuário não existe. Crie-o primeiro:

```sql
CREATE USER ratixpay WITH PASSWORD 'sua_senha_aqui';
GRANT CONNECT ON DATABASE ratixpay TO ratixpay;
```

### Erro: "must be owner of database"

Execute os comandos como superusuário `postgres`:

```bash
sudo -u postgres psql -d ratixpay
```

### PostgreSQL 15+

Se ainda não funcionar no PostgreSQL 15+, pode ser necessário alterar a política do schema:

```sql
-- Como superusuário
ALTER SCHEMA public OWNER TO ratixpay;
```

Ou permitir criação pública (menos seguro, mas funcional):

```sql
GRANT CREATE ON SCHEMA public TO PUBLIC;
```

## 📝 Referências

- [PostgreSQL Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [PostgreSQL Privileges Documentation](https://www.postgresql.org/docs/current/ddl-priv.html)

