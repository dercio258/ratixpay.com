# 📚 Scripts de Migração do Blog

Este diretório contém scripts para criar e migrar as tabelas do sistema de blog de forma segura.

## 📋 Tabelas Criadas

Os scripts criam as seguintes tabelas:

1. **blog_posts** - Posts do blog
2. **blog_comments** - Comentários dos posts
3. **blog_pages** - Páginas estáticas
4. **blog_newsletter** - Assinantes da newsletter

## 🚀 Como Usar

### Opção 1: Script SQL Direto (Recomendado para VPS)

```bash
# Executar diretamente com psql
psql -U postgres -d ratixpay -f migrations/migrate-blog-completo-seguro.sql

# Ou com sudo
sudo -u postgres psql -d ratixpay -f migrations/migrate-blog-completo-seguro.sql
```

### Opção 2: Script Shell (Linux/Mac)

```bash
# Dar permissão de execução
chmod +x scripts/migrate-blog.sh

# Executar
./scripts/migrate-blog.sh

# Ou com variáveis de ambiente
DB_NAME=ratixpay DB_USER=postgres DB_HOST=localhost ./scripts/migrate-blog.sh
```

### Opção 3: Script Node.js

```bash
# Executar com Node.js
node scripts/migrate-blog-safe.js
```

## ✅ Características

- **Idempotente**: Pode ser executado múltiplas vezes sem erros
- **Seguro**: Verifica existência antes de criar tabelas/colunas
- **Completo**: Cria todas as tabelas, índices e constraints necessárias
- **Verificação**: Confirma se as tabelas foram criadas corretamente

## 🔍 Verificação Manual

Após executar a migração, você pode verificar se as tabelas foram criadas:

```sql
-- Verificar tabelas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'blog_%';

-- Verificar estrutura de uma tabela
\d blog_posts
\d blog_comments
\d blog_pages
\d blog_newsletter
```

## ⚠️ Troubleshooting

### Erro: "relation already exists"
Este erro é normal se as tabelas já existem. O script usa `CREATE TABLE IF NOT EXISTS`, então é seguro executar novamente.

### Erro: "permission denied"
Certifique-se de que o usuário tem permissões para criar tabelas:
```sql
GRANT ALL PRIVILEGES ON DATABASE ratixpay TO postgres;
```

### Erro: "column already exists"
O script verifica se as colunas existem antes de adicionar, então isso não deve acontecer. Se acontecer, pode ser que a tabela já tenha a estrutura completa.

## 📝 Notas

- O script cria todas as tabelas necessárias para o sistema de blog funcionar
- Todas as foreign keys são criadas com `ON DELETE CASCADE` ou `ON DELETE SET NULL` conforme apropriado
- Os índices são criados para melhorar a performance das consultas
- O script é transacional (usa BEGIN/COMMIT) para garantir consistência

## 🔄 Atualizações Futuras

Se precisar adicionar novas colunas ou tabelas no futuro:

1. Adicione as alterações no arquivo `migrate-blog-completo-seguro.sql`
2. Use `ALTER TABLE IF EXISTS` ou verifique existência antes de adicionar
3. Teste em ambiente de desenvolvimento antes de executar em produção




