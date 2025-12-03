# Instruções para Atualizar o Banco de Dados

## Problema
As colunas `contacto` e `nome_titular` na tabela `carteiras` têm restrição NOT NULL, mas alguns registros podem estar com valores NULL ou vazios.

## Solução

### Opção 1: Executar Script SQL Diretamente

Execute o arquivo `scripts/fix-contacto-carteiras.sql` no seu cliente PostgreSQL (pgAdmin, DBeaver, psql, etc.):

```bash
psql -U seu_usuario -d seu_banco -f scripts/fix-contacto-carteiras.sql
```

Ou copie e cole o conteúdo do arquivo SQL no seu cliente PostgreSQL.

### Opção 2: Executar Script Node.js

Execute o script Node.js que faz a mesma correção:

```bash
node scripts/fix-contacto-carteiras.js
```

### Opção 3: Correção Manual Rápida

Execute estes comandos SQL diretamente:

```sql
-- 1. Atualizar registros NULL
UPDATE carteiras 
SET contacto = COALESCE(contacto_mpesa, contacto_emola, '')
WHERE contacto IS NULL OR contacto = '';

UPDATE carteiras 
SET nome_titular = COALESCE(nome_titular_mpesa, nome_titular_emola, '')
WHERE nome_titular IS NULL OR nome_titular = '';

-- 2. Adicionar DEFAULT se não existir
ALTER TABLE carteiras 
ALTER COLUMN contacto 
SET DEFAULT '';

ALTER TABLE carteiras 
ALTER COLUMN nome_titular 
SET DEFAULT '';

-- 3. Garantir NOT NULL
ALTER TABLE carteiras 
ALTER COLUMN contacto 
SET NOT NULL;

ALTER TABLE carteiras 
ALTER COLUMN nome_titular 
SET NOT NULL;
```

## O que o Script Faz

1. ✅ Atualiza registros existentes com `contacto` e `nome_titular` NULL ou vazios
2. ✅ Adiciona DEFAULT value (`''`) se não existir para ambas as colunas
3. ✅ Garante que as colunas sejam NOT NULL
4. ✅ Preenche `contacto` com `contacto_mpesa` quando disponível
5. ✅ Preenche `nome_titular` com `nome_titular_mpesa` quando disponível
6. ✅ Verifica estatísticas finais

## Após Executar

Após executar o script, tente criar uma nova carteira novamente. O erro não deve mais ocorrer.

## Verificação

Para verificar se está tudo correto:

```sql
SELECT 
    id,
    contacto,
    contacto_mpesa,
    contacto_emola,
    nome_titular,
    nome_titular_mpesa,
    nome_titular_emola
FROM carteiras
WHERE contacto IS NULL OR contacto = '' 
   OR nome_titular IS NULL OR nome_titular = '';
```

Se não retornar nenhum registro, está tudo correto! ✅

