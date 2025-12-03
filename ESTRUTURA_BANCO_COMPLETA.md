# 📊 Estrutura Completa do Banco de Dados

## 🎯 Objetivo

Este documento descreve a estrutura completa do banco de dados baseada no modelo `config/database.js` e garante que não haja conflitos, especialmente em saques/pagamentos.

## ✅ Script de Sincronização

Execute o script completo para sincronizar toda a estrutura:

```bash
cd /var/www/ratixpay.com
sudo -u postgres psql -d ratixpay -f scripts/sincronizar-estrutura-banco-completo.sql
```

## 📋 Tabelas Principais

### 1. `produtos`

**Colunas de Aprovação:**
- ✅ `status_aprovacao` VARCHAR(50) - valores: 'aprovado', 'rejeitado', 'pendente_aprovacao'
- ✅ `motivo_rejeicao` TEXT - motivo da rejeição

**Regra:** Produtos ativos DEVEM estar aprovados.

### 2. `pagamentos` (Saques)

**Colunas Importantes:**
- ✅ `public_id` VARCHAR(20) - ID público memorável (ex: SAQ-123456)
- ✅ `valor_liquido` DECIMAL(10, 2) - Valor após taxas
- ✅ `taxa` DECIMAL(10, 2) - Taxa aplicada ao saque
- ✅ `nome_titular` VARCHAR(255) - Nome do titular
- ✅ `ip_solicitacao` VARCHAR(45) - IP da solicitação
- ✅ `user_agent` TEXT - User agent do navegador

**Índices:**
- ✅ `pagamentos_public_id_key` (UNIQUE) - Para public_id

### 3. `carteiras`

**Colunas Mpesa:**
- ✅ `contacto_mpesa` VARCHAR(20)
- ✅ `nome_titular_mpesa` VARCHAR(255)

**Colunas Emola:**
- ✅ `contacto_emola` VARCHAR(20)
- ✅ `nome_titular_emola` VARCHAR(255)

**Outras:**
- ✅ `email` VARCHAR(255)
- ✅ `nome` VARCHAR(255) DEFAULT 'Carteira Principal'

**Constraints:**
- ✅ `carteiras_vendedor_id_key` (UNIQUE) - Uma carteira por vendedor

## 🔍 Verificações

### Produtos Ativos Não Aprovados

```sql
SELECT id, custom_id, nome, ativo, status_aprovacao
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';
```

**Solução:**
```sql
UPDATE produtos 
SET status_aprovacao = 'aprovado', motivo_rejeicao = NULL
WHERE ativo = true AND status_aprovacao != 'aprovado';
```

### Estrutura de Pagamentos

```sql
-- Verificar colunas da tabela pagamentos
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pagamentos'
ORDER BY ordinal_position;
```

### Estrutura de Carteiras

```sql
-- Verificar colunas da tabela carteiras
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'carteiras'
ORDER BY ordinal_position;
```

## 🚀 Como Aplicar

### 1. Na VPS (Produção)

```bash
cd /var/www/ratixpay.com

# 1. Fazer backup primeiro
sudo -u postgres pg_dump ratixpay > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Executar script de sincronização
sudo -u postgres psql -d ratixpay -f scripts/sincronizar-estrutura-banco-completo.sql

# 3. Verificar se funcionou
sudo -u postgres psql -d ratixpay -c "SELECT 'Estrutura sincronizada!' AS status;"
```

### 2. Localmente (Desenvolvimento)

```bash
# Executar script
psql -U postgres -d ratixpay_local -f scripts/sincronizar-estrutura-banco-completo.sql
```

## ⚠️ Problemas Comuns

### Erro: "permission denied for schema public"

**Solução:**
```bash
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

### Erro: "column does not exist"

O script de sincronização adiciona automaticamente todas as colunas faltantes.

### Erro: "constraint already exists"

O script verifica se a constraint existe antes de criar, então é seguro executar múltiplas vezes.

## 📝 Checklist de Validação

Execute após aplicar o script:

```sql
-- 1. Verificar produtos ativos
SELECT COUNT(*) as produtos_ativos_nao_aprovados
FROM produtos
WHERE ativo = true AND status_aprovacao != 'aprovado';
-- Deve retornar 0

-- 2. Verificar estrutura de pagamentos
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'pagamentos'
AND column_name IN ('public_id', 'valor_liquido', 'taxa', 'nome_titular', 'ip_solicitacao', 'user_agent');
-- Deve retornar 6 linhas

-- 3. Verificar estrutura de carteiras
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'carteiras'
AND column_name IN ('contacto_mpesa', 'nome_titular_mpesa', 'contacto_emola', 'nome_titular_emola', 'email', 'nome');
-- Deve retornar 6 linhas
```

## 🎯 Resultado Esperado

Após executar o script:

✅ Todas as colunas estão presentes
✅ Todas as constraints estão configuradas
✅ Produtos ativos estão aprovados
✅ Permissões estão corretas
✅ Não há conflitos de estrutura

## 📚 Arquivos Relacionados

- `config/database.js` - Modelo Sequelize completo
- `scripts/sincronizar-estrutura-banco-completo.sql` - Este script
- `scripts/fix-schema-permissions.sql` - Correção de permissões
- `scripts/fix-aprovacao-produtos-ativos.sql` - Correção de aprovação

