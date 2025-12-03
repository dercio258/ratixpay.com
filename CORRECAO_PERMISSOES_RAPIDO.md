# 🔧 Correção Rápida - Permissões do Schema Public

## ❌ Erro Encontrado

```
❌ Erro fatal ao executar migrações: permission denied for schema public
```

## ✅ Solução Rápida (Na VPS)

Execute **um** dos comandos abaixo:

### Opção 1: Script SQL (Mais Rápido)

```bash
# Conectar como postgres e executar o script
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

**Importante:** Se o nome do usuário não for `ratixpay`, edite o arquivo `scripts/fix-schema-permissions.sql` e substitua `ratixpay` pelo nome do seu usuário.

### Opção 2: Comandos SQL Manuais

```bash
# Conectar ao PostgreSQL
sudo -u postgres psql -d ratixpay
```

Depois, dentro do psql, execute (substitua `ratixpay` pelo seu usuário se diferente):

```sql
GRANT USAGE ON SCHEMA public TO ratixpay;
GRANT CREATE ON SCHEMA public TO ratixpay;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ratixpay;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ratixpay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ratixpay;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ratixpay;
\q
```

### Opção 3: Script Shell

```bash
chmod +x scripts/fix-schema-permissions.sh
sudo -u postgres bash scripts/fix-schema-permissions.sh
```

## 🚀 Após Corrigir

Execute novamente a migração:

```bash
cd /var/www/ratixpay.com
node scripts/migrate-database-columns.js
```

## 📋 Verificar Qual é o Usuário do Banco

Para descobrir qual usuário está configurado no seu `.env`:

```bash
grep DB_USER .env
```

Use esse usuário no lugar de `ratixpay` nos comandos acima.

## ⚠️ Se Ainda Não Funcionar (PostgreSQL 15+)

Se você está usando PostgreSQL 15 ou superior, pode ser necessário também executar:

```sql
ALTER SCHEMA public OWNER TO ratixpay;
```

Ou permitir criação pública (menos seguro, mas funcional):

```sql
GRANT CREATE ON SCHEMA public TO PUBLIC;
```

## 📚 Documentação Completa

Veja `docs/CORRECAO_PERMISSOES_SCHEMA.md` para mais detalhes e troubleshooting.

