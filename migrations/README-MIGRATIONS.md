# 📦 Migrações de Banco de Dados - RatixPay

Este diretório contém todos os scripts de migração necessários para configurar e atualizar o banco de dados.

## 🚀 Migrações Principais

### 1. Migração Unificada (Recomendada)
**Arquivo:** `migrate-all-systems-unified.sql`

Cria todas as tabelas necessárias para:
- ✅ Sistema de Blog (posts, comentários, páginas, newsletter)
- ✅ Sistema de Remarketing (fila e conversões)
- ✅ Sistema de Afiliados (completo com cliques e comissões)

**Uso:**
```bash
psql -U postgres -d ratixpay -f migrations/migrate-all-systems-unified.sql
```

### 2. Atualização de Domínio
**Arquivo:** `update-domain-ratixpay-com-to-site.sql`

Atualiza todas as URLs de `ratixpay.com` para `ratixpay.site` em:
- ✅ Produtos (link_conteudo, imagem_url, configurações JSON)
- ✅ Afiliados (link_afiliado)
- ✅ Link Trackings
- ✅ Blog (posts e páginas)
- ✅ Upsell Pages
- ✅ Webhooks

**Uso:**
```bash
psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql
```

### 3. Atualização de Produtos, Imagens e Arquivos
**Arquivo:** `update-products-images-files.sql`

Atualiza especificamente:
- ✅ URLs de imagens de produtos
- ✅ Links de conteúdo
- ✅ URLs de arquivos e downloads
- ✅ URLs em descrições
- ✅ URLs em Order Bumps

**Uso:**
```bash
psql -U postgres -d ratixpay -f migrations/update-products-images-files.sql
```

## 📋 Ordem Recomendada de Execução

1. **Primeiro:** Execute a migração unificada
   ```bash
   psql -U postgres -d ratixpay -f migrations/migrate-all-systems-unified.sql
   ```

2. **Depois:** Atualize o domínio (ratixpay.com → ratixpay.site)
   ```bash
   psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql
   ```

3. **Finalmente:** Atualize produtos, imagens e arquivos
   ```bash
   psql -U postgres -d ratixpay -f migrations/update-products-images-files.sql
   ```

## 🔒 Segurança

⚠️ **IMPORTANTE:** Sempre faça backup antes de executar migrações!

```bash
# Fazer backup
pg_dump -U postgres ratixpay > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup se necessário
psql -U postgres -d ratixpay < backup_YYYYMMDD_HHMMSS.sql
```

## 📊 Estrutura das Tabelas Criadas

### Sistema de Blog
- `blog_posts` - Posts do blog
- `blog_comments` - Comentários e respostas
- `blog_pages` - Páginas estáticas
- `blog_newsletter` - Inscritos na newsletter

### Sistema de Remarketing
- `remarketing_queue` - Fila de remarketing
- `remarketing_conversoes` - Rastreamento de conversões
- `produtos.remarketing_config` - Configuração por produto

### Sistema de Afiliados
- `afiliados` - Afiliados com todos os campos
- `venda_afiliados` - Vendas associadas
- `link_trackings` - Rastreamento de cliques

## 🔍 Verificação

Após executar as migrações, verifique se tudo está correto:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'blog_posts', 'blog_comments', 'blog_pages', 'blog_newsletter',
    'remarketing_queue', 'remarketing_conversoes',
    'afiliados', 'venda_afiliados', 'link_trackings'
)
ORDER BY table_name;

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
WHERE link_afiliado LIKE '%ratixpay.com%';
```

## 🐛 Troubleshooting

### Erro: "relation already exists"
Os scripts são idempotentes e verificam se as tabelas já existem. Se isso ocorrer, significa que a migração já foi executada.

### Erro: "foreign key constraint"
Verifique se as tabelas dependentes existem:
- `usuarios` (para blog_posts.author_id)
- `produtos` (para remarketing_queue.produto_id)
- `vendas` (para remarketing_conversoes)

### URLs não foram atualizadas
Execute novamente o script de atualização de domínio. Os scripts são seguros para executar múltiplas vezes.

## 📝 Notas

- Todos os scripts são **idempotentes** (podem ser executados múltiplas vezes)
- As migrações usam `BEGIN` e `COMMIT` para transações
- Mensagens de log são exibidas durante a execução
- Relatórios finais mostram quantos registros foram atualizados

## 🤝 Suporte

Em caso de problemas, verifique:
1. Se o banco de dados está acessível
2. Se o usuário tem permissões necessárias
3. Se todas as tabelas dependentes existem
4. Os logs de erro do PostgreSQL

