# Resumo das Correções na Estrutura de Carteiras

## Problemas Identificados
A tabela `carteiras` possui colunas legadas que são obrigatórias (NOT NULL) mas não estavam sendo preenchidas ao criar carteiras:
1. ❌ `contacto` - Campo legado obrigatório
2. ❌ `nome_titular` - Campo legado obrigatório  
3. ❌ `email_titular` - Campo legado obrigatório
4. ❌ `metodo_saque` - Campo obrigatório

## Soluções Implementadas

### 1. Modelo Carteira (`config/database.js`)
✅ Adicionados todos os campos legados ao modelo:
- `contacto` - Preenchido com `contacto_mpesa`
- `nomeTitular` - Preenchido com `nome_titular_mpesa`
- `emailTitular` - Preenchido com email do usuário autenticado
- `metodoSaque` - Já existia, agora sempre preenchido

### 2. Serviço (`services/carteiraService.js`)
✅ Garantido que todos os campos sejam sempre preenchidos:
- `contacto` → usa `contacto_mpesa`
- `nomeTitular` → usa `nome_titular_mpesa`
- `emailTitular` → usa email do usuário autenticado (não precisa fornecer na carteira)
- `metodoSaque` → padrão 'Mpesa'

### 3. Scripts SQL
✅ Criados scripts para corrigir estrutura do banco:
- `scripts/fix-all-carteira-fields.sql` - **RECOMENDADO** (corrige tudo de uma vez)
- `scripts/fix-contacto-carteiras.sql` - Script específico
- `scripts/fix-contacto-carteiras.js` - Script Node.js

## Como Atualizar o Banco de Dados

### ⭐ Opção 1: Script SQL Completo (RECOMENDADO)

Execute no PostgreSQL:
```bash
psql -U seu_usuario -d seu_banco -f scripts/fix-all-carteira-fields.sql
```

Ou copie e cole o conteúdo do arquivo no seu cliente PostgreSQL.

### Opção 2: Script Node.js

```bash
node scripts/fix-contacto-carteiras.js
```

### Opção 3: Correção Manual Rápida

Execute estes comandos SQL:

```sql
-- 1. Atualizar registros existentes
UPDATE carteiras 
SET contacto = COALESCE(NULLIF(contacto, ''), contacto_mpesa, '') 
WHERE contacto IS NULL OR contacto = '';

UPDATE carteiras 
SET nome_titular = COALESCE(NULLIF(nome_titular, ''), nome_titular_mpesa, '') 
WHERE nome_titular IS NULL OR nome_titular = '';

UPDATE carteiras 
SET email_titular = COALESCE(NULLIF(email_titular, ''), email, '') 
WHERE email_titular IS NULL OR email_titular = '';

-- 2. Adicionar DEFAULTs
ALTER TABLE carteiras ALTER COLUMN contacto SET DEFAULT '';
ALTER TABLE carteiras ALTER COLUMN nome_titular SET DEFAULT '';
ALTER TABLE carteiras ALTER COLUMN email_titular SET DEFAULT '';

-- 3. Garantir NOT NULL
ALTER TABLE carteiras ALTER COLUMN contacto SET NOT NULL;
ALTER TABLE carteiras ALTER COLUMN nome_titular SET NOT NULL;
ALTER TABLE carteiras ALTER COLUMN email_titular SET NOT NULL;
```

## Campos Legados vs Novos

A carteira agora tem dois conjuntos de campos:

### Campos Novos (Específicos por Método)
- `contacto_mpesa` / `nome_titular_mpesa`
- `contacto_emola` / `nome_titular_emola`
- `email` (do usuário)

### Campos Legados (Compatibilidade)
- `contacto` → usa `contacto_mpesa`
- `nome_titular` → usa `nome_titular_mpesa`
- `email_titular` → usa email do usuário autenticado
- `metodo_saque` → padrão 'Mpesa'

## Resultado

Após executar o script, todos os campos obrigatórios serão preenchidos automaticamente ao criar/atualizar carteiras. ✅

Os erros de "valor nulo" não devem mais ocorrer!

