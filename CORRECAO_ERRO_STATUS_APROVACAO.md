# 🔧 Correção Urgente: Erro "column status_aprovacao does not exist"

## ❌ Erro Encontrado

```
error: column Produto.status_aprovacao does not exist
code: '42703'
```

## 🔍 Causa

A coluna `status_aprovacao` não existe na tabela `produtos` no banco de dados da VPS, mas o código está tentando usá-la em várias queries.

## ✅ Solução Rápida

Execute este comando na VPS:

```bash
cd /var/www/ratixpay.com
sudo -u postgres psql -d ratixpay -f scripts/fix-status-aprovacao-produtos.sql
```

Ou execute diretamente:

```bash
sudo -u postgres psql -d ratixpay << 'EOF'
-- Adicionar coluna status_aprovacao
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'status_aprovacao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN status_aprovacao VARCHAR(50) DEFAULT 'aprovado';
        ALTER TABLE produtos 
        ADD CONSTRAINT produtos_status_aprovacao_check 
        CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));
        RAISE NOTICE 'Coluna status_aprovacao adicionada';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'produtos' 
        AND column_name = 'motivo_rejeicao'
    ) THEN
        ALTER TABLE produtos ADD COLUMN motivo_rejeicao TEXT;
        RAISE NOTICE 'Coluna motivo_rejeicao adicionada';
    END IF;

    UPDATE produtos 
    SET status_aprovacao = 'aprovado' 
    WHERE status_aprovacao IS NULL AND ativo = true;

    UPDATE produtos 
    SET status_aprovacao = 'rejeitado' 
    WHERE status_aprovacao IS NULL AND ativo = false;
END $$;
EOF
```

## 🔧 Solução Alternativa (Via Node.js)

Se preferir usar o script de migração:

```bash
cd /var/www/ratixpay.com
node scripts/migrate-database-columns.js
```

Mas primeiro, certifique-se de que as permissões estão corretas:

```bash
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

## 📋 Passo a Passo Completo

1. **Conectar à VPS**:
   ```bash
   ssh usuario@seu-servidor
   cd /var/www/ratixpay.com
   ```

2. **Verificar se a coluna existe**:
   ```bash
   sudo -u postgres psql -d ratixpay -c "\d produtos" | grep status_aprovacao
   ```

3. **Executar correção**:
   ```bash
   sudo -u postgres psql -d ratixpay -f scripts/fix-status-aprovacao-produtos.sql
   ```

4. **Verificar se foi adicionada**:
   ```bash
   sudo -u postgres psql -d ratixpay -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'produtos' AND column_name IN ('status_aprovacao', 'motivo_rejeicao');"
   ```

5. **Reiniciar aplicação**:
   ```bash
   pm2 restart ratixpay
   ```

## ⚠️ Erro Adicional: Permissões

Se você também viu este erro:
```
⚠️ Erro ao verificar/criar colunas: must be owner of table afiliados
```

Execute também:

```bash
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql
```

## 🧪 Verificar se Funcionou

Após executar a correção, teste:

```bash
# Verificar se a coluna existe
sudo -u postgres psql -d ratixpay -c "SELECT status_aprovacao, COUNT(*) FROM produtos GROUP BY status_aprovacao;"

# Testar consulta que estava falhando
sudo -u postgres psql -d ratixpay -c "SELECT COUNT(*) FROM produtos WHERE status_aprovacao = 'aprovado';"
```

## 📚 Colunas Adicionadas

- `status_aprovacao` (VARCHAR(50)): Status do produto ('aprovado', 'rejeitado', 'pendente_aprovacao')
- `motivo_rejeicao` (TEXT): Motivo da rejeição (se aplicável)

## 🔄 Após Corrigir

1. ✅ Verificar logs para confirmar que não há mais erros
2. ✅ Testar carregar produtos na interface
3. ✅ Verificar se produtos existentes receberam status 'aprovado' automaticamente

## 💡 Nota Importante

Todos os produtos existentes serão atualizados automaticamente:
- Produtos `ativo = true` → `status_aprovacao = 'aprovado'`
- Produtos `ativo = false` → `status_aprovacao = 'rejeitado'`

Isso é seguro e não afetará o funcionamento dos produtos já existentes.

