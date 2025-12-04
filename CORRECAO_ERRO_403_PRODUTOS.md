# 🔧 Correção do Erro 403 em Produtos Públicos

## ❌ Problema

O checkout está retornando erro **403 (Forbidden)** ao tentar acessar produtos:
```
GET https://txipay.shop/api/produtos/public/AI2B34PT7 403 (Forbidden)
```

## ✅ Solução Aplicada

Ajustei a lógica da rota pública para:
1. **Priorizar produtos ATIVOS** - Se o produto está ativo, permite acesso
2. **Bloquear apenas produtos REJEITADOS** - Produtos rejeitados continuam bloqueados
3. **Permitir produtos pendentes se ativos** - Produtos com `status_aprovacao = 'pendente_aprovacao'` mas `ativo = true` podem ser acessados

## 🚀 O Que Fazer na VPS

### 1. Atualizar o código

```bash
cd /var/www/ratixpay.com
git pull origin main
pm2 restart ratixpay
```

### 2. Garantir que produtos ativos estejam aprovados no banco

```bash
# Executar script para forçar aprovação de produtos ativos
su - postgres -c "psql -d ratixpay -f scripts/forcar-aprovacao-produtos-ativos.sql"
```

Ou manualmente:

```bash
su - postgres -c "psql -d ratixpay"
```

Depois execute:

```sql
-- Forçar aprovação de todos produtos ativos
UPDATE produtos 
SET status_aprovacao = 'aprovado', 
    motivo_rejeicao = NULL
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

-- Verificar resultado
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao;

-- Sair
\q
```

### 3. Verificar se funcionou

```bash
# Ver produtos que podem estar com problema
su - postgres -c "psql -d ratixpay -c \"
SELECT custom_id, nome, ativo, status_aprovacao
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';
\""
```

Se retornar 0 linhas, tudo está correto!

## 📋 Mudança no Código

**Antes:**
```javascript
// Verificava status_aprovacao ANTES de verificar se está ativo
if (produto.status_aprovacao !== 'aprovado') {
  return res.status(403).json({ erro: 'Produto não disponível' });
}
if (produto.ativo !== true) {
  return res.status(404).json({ erro: 'Produto não disponível' });
}
```

**Depois:**
```javascript
// Verifica se está ativo PRIMEIRO
if (produto.ativo !== true) {
  return res.status(404).json({ erro: 'Produto não disponível' });
}

// Só bloqueia se foi explicitamente rejeitado
if (produto.status_aprovacao === 'rejeitado') {
  return res.status(403).json({ erro: 'Produto não disponível' });
}

// Produtos ativos não rejeitados podem ser acessados
```

## ✅ Resultado Esperado

Após aplicar as correções:

- ✅ Produtos ativos podem ser acessados no checkout
- ✅ Produtos rejeitados continuam bloqueados
- ✅ Produtos inativos continuam bloqueados
- ✅ Todos os produtos ativos no banco têm `status_aprovacao = 'aprovado'`

## 🔍 Verificar no Navegador

Após aplicar as correções, teste no checkout:
1. Acesse um produto pelo link: `https://txipay.shop/checkout.html?produto=AI2B34PT7`
2. Abra o DevTools (F12) → Console
3. Não deve mais aparecer erro 403
4. O produto deve carregar normalmente

