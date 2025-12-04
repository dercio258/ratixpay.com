# 🚀 Executar Replicação na VPS - GUIA RÁPIDO

## ⚠️ Problema: postgres não está no sudoers

Se você está como **root** e recebeu erro de `sudo`, use uma destas opções:

## ✅ Opção 1: Script Simplificado (Recomendado)

```bash
cd /var/www/ratixpay.com
git pull origin main
chmod +x scripts/replicar-estrutura-vps-simples.sh
bash scripts/replicar-estrutura-vps-simples.sh
```

## ✅ Opção 2: Executar Manualmente

Como você está como root, use `su - postgres`:

```bash
cd /var/www/ratixpay.com

# 1. Corrigir permissões
su - postgres -c "psql -d ratixpay -f scripts/fix-schema-permissions.sql"

# 2. Sincronizar estrutura
su - postgres -c "psql -d ratixpay -f scripts/sincronizar-estrutura-banco-completo.sql"

# 3. Migrações principais
su - postgres -c "psql -d ratixpay -f migrations/add_status_aprovacao_to_produtos.sql"
su - postgres -c "psql -d ratixpay -f migrations/add-carteira-campos-e-pagamento-public-id.sql"
su - postgres -c "psql -d ratixpay -f migrations/create-upsell-tables.sql"
su - postgres -c "psql -d ratixpay -f migrations/create-remarketing-queue.sql"
su - postgres -c "psql -d ratixpay -f migrations/create-webhooks-table.sql"

# 4. Forçar aprovação de produtos
su - postgres -c "psql -d ratixpay -f scripts/forcar-aprovacao-produtos-ativos.sql"
```

## ✅ Opção 3: Entrar como postgres

```bash
su - postgres
cd /var/www/ratixpay.com
bash scripts/replicar-estrutura-completa-vps.sh
```

## 🔍 Verificar se funcionou

```bash
su - postgres -c "psql -d ratixpay -c \"
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao;
\""
```

