# 📋 Estrutura de Aprovação de Produtos

## ✅ Estrutura Correta do Banco de Dados

### Coluna `status_aprovacao`

```sql
status_aprovacao VARCHAR(50) DEFAULT 'aprovado'
CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'))
```

**Valores possíveis:**
- `'aprovado'` - Produto aprovado e pode ser vendido
- `'rejeitado'` - Produto rejeitado (não pode ser vendido)
- `'pendente_aprovacao'` - Aguardando aprovação (apenas produtos NOVOS)

### Coluna `motivo_rejeicao`

```sql
motivo_rejeicao TEXT NULL
```

**Uso:** Armazena o motivo da rejeição quando um produto é rejeitado.

## 🔒 Regras de Negócio IMPORTANTES

### 1. Produtos ATIVOS devem estar APROVADOS

**Regra:** Se `ativo = true`, então `status_aprovacao = 'aprovado'`

```sql
-- Produtos ativos SEMPRE devem estar aprovados
UPDATE produtos 
SET status_aprovacao = 'aprovado', motivo_rejeicao = NULL
WHERE ativo = true AND status_aprovacao != 'aprovado';
```

### 2. Produtos já APROVADOS e ATIVOS não podem voltar para PENDENTE

**Regra:** Ao atualizar um produto já aprovado e ativo, o status de aprovação NÃO deve ser alterado.

**Lógica no código:**
- ✅ Permite: Criar produto novo → `status_aprovacao = 'pendente_aprovacao'`
- ✅ Permite: Atualizar produto aprovado → manter `status_aprovacao = 'aprovado'`
- ❌ NÃO permite: Atualizar produto aprovado → mudar para `pendente_aprovacao`

### 3. Produtos INATIVOS podem ter qualquer status

Produtos inativos podem estar:
- `'aprovado'` - Foi aprovado mas está inativo (pode reativar sem pedir aprovação)
- `'rejeitado'` - Foi rejeitado
- `'pendente_aprovacao'` - Aguardando aprovação

## 📝 Fluxo de Aprovação

### Criação de Novo Produto

```
1. Produto criado → status_aprovacao = 'pendente_aprovacao', ativo = false
2. Sistema analisa produto automaticamente
3. Se aprovado → status_aprovacao = 'aprovado', ativo = true
4. Se rejeitado → status_aprovacao = 'rejeitado', ativo = false
5. Se erro → status_aprovacao = 'pendente_aprovacao', admin precisa aprovar manualmente
```

### Atualização de Produto Existente

```
1. Verificar status atual do produto
2. Se status_aprovacao = 'aprovado' E ativo = true:
   → MANTER status_aprovacao = 'aprovado' (não pode voltar para pendente)
3. Se status_aprovacao != 'aprovado':
   → Manter status atual (não auto-aprovar na edição)
```

### Ativação de Produto

```
1. Se produto está inativo e foi aprovado antes:
   → Ativar sem pedir nova aprovação (status_aprovacao = 'aprovado')
2. Se produto está inativo e nunca foi aprovado:
   → Manter status atual (pendente ou rejeitado)
```

## 🔧 Scripts de Correção

### 1. Corrigir Estrutura do Banco

```bash
cd /var/www/ratixpay.com
sudo -u postgres psql -d ratixpay -f scripts/fix-aprovacao-produtos-ativos.sql
```

### 2. Verificar Produtos com Problema

```sql
-- Produtos ativos que NÃO estão aprovados (erro crítico)
SELECT id, custom_id, nome, ativo, status_aprovacao
FROM produtos
WHERE ativo = true 
AND status_aprovacao != 'aprovado';
```

### 3. Corrigir Produtos Ativos Não Aprovados

```sql
-- Forçar aprovação de produtos ativos
UPDATE produtos 
SET status_aprovacao = 'aprovado', 
    motivo_rejeicao = NULL
WHERE ativo = true 
AND status_aprovacao != 'aprovado';
```

## ⚠️ Problemas Comuns

### Problema 1: Produto ativo mas não aprovado

**Sintoma:** Produto aparece como ativo mas não pode ser vendido.

**Causa:** Inconsistência entre `ativo` e `status_aprovacao`.

**Solução:**
```sql
UPDATE produtos 
SET status_aprovacao = 'aprovado'
WHERE ativo = true AND status_aprovacao != 'aprovado';
```

### Problema 2: Produto aprovado voltando para pendente

**Sintoma:** Ao atualizar produto aprovado, ele volta para pendente.

**Causa:** Lógica de atualização incorreta.

**Solução:** Verificar código em `routes/produtos.js` - rota `PUT /:id`

### Problema 3: Produto novo não entra em pendente

**Sintoma:** Produto novo é criado como aprovado diretamente.

**Causa:** Lógica de criação definindo status incorreto.

**Solução:** Verificar código em `routes/produtos.js` - rotas `POST /` e `POST /unificado`

## 📊 Queries Úteis

### Estatísticas de Aprovação

```sql
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos,
    SUM(CASE WHEN ativo = false THEN 1 ELSE 0 END) as inativos
FROM produtos
GROUP BY status_aprovacao
ORDER BY status_aprovacao;
```

### Produtos Inconsistentes

```sql
-- Produtos ativos não aprovados
SELECT id, custom_id, nome, ativo, status_aprovacao
FROM produtos
WHERE ativo = true 
AND status_aprovacao != 'aprovado';

-- Produtos aprovados mas inativos (pode ser normal)
SELECT id, custom_id, nome, ativo, status_aprovacao
FROM produtos
WHERE ativo = false 
AND status_aprovacao = 'aprovado';
```

## ✅ Checklist de Validação

- [ ] Coluna `status_aprovacao` existe na tabela `produtos`
- [ ] Constraint CHECK está configurada corretamente
- [ ] Todos os produtos ativos têm `status_aprovacao = 'aprovado'`
- [ ] Produtos novos são criados como `pendente_aprovacao`
- [ ] Atualização de produtos aprovados mantém status aprovado
- [ ] Comentários nas colunas estão atualizados

## 🚀 Comandos Rápidos

```bash
# 1. Verificar estrutura
sudo -u postgres psql -d ratixpay -c "\d produtos"

# 2. Corrigir produtos ativos
sudo -u postgres psql -d ratixpay -f scripts/fix-aprovacao-produtos-ativos.sql

# 3. Verificar inconsistências
sudo -u postgres psql -d ratixpay -c "SELECT COUNT(*) FROM produtos WHERE ativo = true AND status_aprovacao != 'aprovado';"

# 4. Ver estatísticas
sudo -u postgres psql -d ratixpay -c "SELECT status_aprovacao, COUNT(*) FROM produtos GROUP BY status_aprovacao;"
```

