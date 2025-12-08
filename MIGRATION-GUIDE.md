# 🚀 Guia Completo de Migração - RatixPay

Este guia contém todas as instruções para migrar o sistema para o novo domínio `ratixpay.site` e configurar os sistemas de Blog, Remarketing e Afiliados.

## 📋 Pré-requisitos

1. **PostgreSQL** instalado e rodando
2. **Backup do banco de dados** (obrigatório!)
3. **Acesso ao servidor** ou banco local
4. **Node.js** instalado (para scripts JavaScript)

## 🔧 Passo 1: Fazer Backup

**IMPORTANTE:** Sempre faça backup antes de executar migrações!

```bash
# Backup completo do banco
pg_dump -U postgres -d ratixpay > backup_ratixpay_$(date +%Y%m%d_%H%M%S).sql

# Ou com compressão
pg_dump -U postgres -d ratixpay | gzip > backup_ratixpay_$(date +%Y%m%d_%H%M%S).sql.gz
```

## 📦 Passo 2: Executar Migrações do Banco de Dados

### Opção A: Usando Script Automático (Recomendado)

#### Linux/Mac:
```bash
chmod +x scripts/run-all-migrations.sh
./scripts/run-all-migrations.sh
```

#### Windows ou Node.js:
```bash
node scripts/run-all-migrations.js
```

### Opção B: Manual

Execute na ordem:

```bash
# 1. Migração unificada
psql -U postgres -d ratixpay -f migrations/migrate-all-systems-unified.sql

# 2. Atualizar domínio
psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql

# 3. Atualizar produtos
psql -U postgres -d ratixpay -f migrations/update-products-images-files.sql
```

## 🔄 Passo 3: Atualizar Código Fonte

Atualizar domínios no código (preserva emails):

```bash
node scripts/update-domain-in-code.js
```

**Nota:** Este script preserva emails como `sistema@ratixpay.com` e `suporte@ratixpay.com`, atualizando apenas URLs.

## ✅ Passo 4: Verificar Migrações

### Verificar Tabelas Criadas

```sql
-- Verificar tabelas do Blog
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'blog_%'
ORDER BY table_name;

-- Verificar tabelas de Remarketing
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'remarketing_%'
ORDER BY table_name;

-- Verificar tabelas de Afiliados
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('afiliados', 'venda_afiliados', 'link_trackings')
ORDER BY table_name;
```

### Verificar URLs Atualizadas

```sql
-- Verificar se ainda há URLs antigas
SELECT 
    'produtos' as tabela,
    COUNT(*) as total_com_ratixpay_com
FROM produtos
WHERE 
    link_conteudo LIKE '%ratixpay.com%' 
    OR imagem_url LIKE '%ratixpay.com%'
UNION ALL
SELECT 
    'afiliados',
    COUNT(*)
FROM afiliados
WHERE link_afiliado LIKE '%ratixpay.com%'
UNION ALL
SELECT 
    'blog_posts',
    COUNT(*)
FROM blog_posts
WHERE content LIKE '%ratixpay.com%' OR image LIKE '%ratixpay.com%';
```

**Resultado esperado:** Todas as contagens devem ser `0`.

## 📊 Estrutura de Tabelas Criadas

### Blog (4 tabelas)
- `blog_posts` - Posts do blog
- `blog_comments` - Comentários e respostas
- `blog_pages` - Páginas estáticas
- `blog_newsletter` - Inscritos na newsletter

### Remarketing (2 tabelas + 1 campo)
- `remarketing_queue` - Fila de remarketing
- `remarketing_conversoes` - Conversões rastreadas
- `produtos.remarketing_config` - Configuração por produto

### Afiliados (3 tabelas)
- `afiliados` - Afiliados completos
- `venda_afiliados` - Vendas associadas
- `link_trackings` - Rastreamento de cliques

## 🐛 Troubleshooting

### Erro: "relation already exists"
✅ **Normal** - As migrações são idempotentes. Significa que as tabelas já existem.

### Erro: "foreign key constraint"
Verifique se as tabelas dependentes existem:
- `usuarios` (obrigatória)
- `produtos` (obrigatória)
- `vendas` (obrigatória para remarketing)

### URLs não foram atualizadas
Execute novamente:
```bash
psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql
```

### Erro de permissões
```bash
# Dar permissões ao usuário
sudo -u postgres psql -d ratixpay -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seu_usuario;"
```

## 📝 Checklist Pós-Migração

- [ ] Backup criado
- [ ] Migração unificada executada
- [ ] Domínio atualizado no banco
- [ ] Produtos atualizados
- [ ] Código atualizado
- [ ] Tabelas verificadas
- [ ] URLs antigas removidas
- [ ] Testes funcionando

## 🔐 Segurança

⚠️ **IMPORTANTE:**
- Sempre faça backup antes
- Teste em ambiente de desenvolvimento primeiro
- Revise as alterações antes de fazer commit
- Monitore logs após migração

## 📚 Documentação Adicional

- `migrations/README-MIGRATIONS.md` - Detalhes técnicos das migrações
- `migrations/migrate-all-systems-unified.sql` - Código SQL completo
- `scripts/run-all-migrations.sh` - Script de automação

## 🤝 Suporte

Em caso de problemas:
1. Verifique os logs: `/tmp/migration_*.log`
2. Revise as mensagens de erro do PostgreSQL
3. Restaure o backup se necessário
4. Verifique permissões do banco de dados

