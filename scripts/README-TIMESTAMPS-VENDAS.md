# Script de Migração - Adicionar Timestamps na Tabela Vendas

Este script adiciona as colunas `created_at` e `updated_at` na tabela `vendas` caso elas não existam.

## Arquivos

- `add-timestamps-vendas.js` - Script Node.js para adicionar timestamps (recomendado)
- `add-timestamps-vendas.sql` - Script SQL puro para adicionar timestamps
- `verificar-ultima-venda.js` - Script para verificar informações da última venda no banco

## Pré-requisitos

1. Node.js instalado (para o script .js)
2. PostgreSQL instalado e configurado
3. Arquivo `.env` configurado com as credenciais do banco de dados

## Variáveis de Ambiente Necessárias

Certifique-se de que o arquivo `.env` contém:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay_local
DB_USER=postgres
DB_PASS=sua_senha
DB_SSL=false  # true se usar SSL
```

## Como Usar

### Opção 1: Script Node.js (Recomendado)

```bash
node scripts/add-timestamps-vendas.js
```

Este script:
- ✅ Verifica se as colunas já existem
- ✅ Adiciona as colunas caso não existam
- ✅ Atualiza registros existentes com a data atual
- ✅ Cria índices para melhorar performance
- ✅ Mostra informações detalhadas sobre o processo

### Opção 2: Script SQL Direto

```bash
psql -U postgres -d ratixpay_local -f scripts/add-timestamps-vendas.sql
```

Ou conecte-se ao banco e execute:

```sql
\i scripts/add-timestamps-vendas.sql
```

## O que o Script Faz

1. **Verifica se `created_at` existe**
   - Se não existir, adiciona a coluna com tipo `TIMESTAMP WITH TIME ZONE`
   - Define valor padrão como `CURRENT_TIMESTAMP`
   - Atualiza registros existentes com a data atual

2. **Verifica se `updated_at` existe**
   - Se não existir, adiciona a coluna com tipo `TIMESTAMP WITH TIME ZONE`
   - Define valor padrão como `CURRENT_TIMESTAMP`
   - Atualiza registros existentes com a data atual

3. **Cria índices**
   - `idx_vendas_created_at` - Para melhorar queries ordenadas por data de criação
   - `idx_vendas_updated_at` - Para melhorar queries ordenadas por data de atualização

## Verificação

### Opção 1: Script de Verificação Automática (Recomendado)

```bash
node scripts/verificar-ultima-venda.js
```

Este script mostra:
- ✅ Estrutura completa da tabela vendas
- ✅ Informações detalhadas da última venda
- ✅ Verificação se created_at e updated_at existem
- ✅ Estatísticas de quantas vendas têm timestamps
- ✅ Comparação das últimas 5 vendas

### Opção 2: Verificação Manual via SQL

Após executar o script, você pode verificar se as colunas foram criadas:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'vendas' 
AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;
```

## Segurança

- O script usa transações para garantir atomicidade
- Se houver erro, todas as mudanças são revertidas (rollback)
- O script verifica se as colunas já existem antes de tentar criar

## Troubleshooting

### Erro: "relation 'vendas' does not exist"
- Certifique-se de que a tabela `vendas` existe no banco de dados
- Verifique se está conectado ao banco de dados correto

### Erro: "permission denied"
- Certifique-se de que o usuário do banco tem permissões para ALTER TABLE
- Execute como superusuário ou conceda as permissões necessárias

### Erro de conexão
- Verifique as credenciais no arquivo `.env`
- Verifique se o PostgreSQL está rodando
- Verifique se a porta está correta

## Notas

- O script é idempotente: pode ser executado múltiplas vezes sem problemas
- Registros existentes receberão a data atual como valor inicial
- Os índices melhoram significativamente a performance de queries ordenadas por data

