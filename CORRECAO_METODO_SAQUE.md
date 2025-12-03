# Correção do Campo metodo_saque na Tabela carteiras

## Problema
A coluna `metodo_saque` na tabela `carteiras` tem restrição NOT NULL, mas o campo não estava sendo preenchido ao criar uma carteira, causando erro:
```
o valor nulo na coluna "metodo_saque" da relação "carteiras" viola a restrição de não-nulo
```

## Correções Implementadas

### 1. Modelo Sequelize (`config/database.js`)
- ✅ Adicionado campo `metodoSaque` ao modelo `Carteira`
- ✅ Configurado como NOT NULL com DEFAULT 'Mpesa'
- ✅ Mapeado para coluna `metodo_saque` no banco

### 2. Serviço (`services/carteiraService.js`)
- ✅ Garantido que `metodo_saque` seja sempre definido ao criar carteira
- ✅ Valor padrão: 'Mpesa' se não fornecido
- ✅ Preserva valor existente ao atualizar carteira

### 3. Formatação (`routes/carteiras.js`)
- ✅ Campo incluído na função `formatarCarteira()`

### 4. Script de Correção (`scripts/fix-metodo-saque-structure.sql`)
- ✅ Script SQL para corrigir estrutura do banco
- ✅ Adiciona DEFAULT value se não existir
- ✅ Atualiza registros NULL existentes

## Como Aplicar

### Opção 1: Executar Script SQL
```sql
-- Executar o arquivo scripts/fix-metodo-saque-structure.sql no PostgreSQL
```

### Opção 2: Executar Script Node.js
```bash
node scripts/fix-metodo-saque-carteiras.js
```

### Opção 3: Ajuste Manual no Banco
```sql
-- Atualizar registros NULL
UPDATE carteiras SET metodo_saque = 'Mpesa' WHERE metodo_saque IS NULL;

-- Adicionar DEFAULT se não existir
ALTER TABLE carteiras ALTER COLUMN metodo_saque SET DEFAULT 'Mpesa';

-- Garantir NOT NULL
ALTER TABLE carteiras ALTER COLUMN metodo_saque SET NOT NULL;
```

## Estrutura Correta

A coluna `metodo_saque` deve ter:
- Tipo: VARCHAR(50)
- NOT NULL: true
- DEFAULT: 'Mpesa'
- Valores aceitos: 'Mpesa', 'Emola', etc.

## Teste
Após aplicar as correções, teste criando uma nova carteira. O campo `metodo_saque` deve ser preenchido automaticamente com 'Mpesa' se não for fornecido explicitamente.

