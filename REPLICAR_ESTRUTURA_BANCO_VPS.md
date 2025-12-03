# 📋 Replicar Estrutura Completa do Banco de Dados na VPS

Este guia mostra como replicar toda a estrutura do banco de dados local na VPS.

## 🎯 Objetivo

Garantir que a estrutura do banco de dados na VPS seja **idêntica** à estrutura local, incluindo:
- ✅ Todas as tabelas
- ✅ Todas as colunas
- ✅ Todos os índices
- ✅ Todas as constraints
- ✅ Todas as migrações

## 🚀 Método 1: Script Automático (Recomendado)

Execute o script bash que executa todas as migrações em ordem:

```bash
cd /var/www/ratixpay.com

# Tornar o script executável
chmod +x scripts/replicar-estrutura-completa-vps.sh

# Executar como postgres
sudo -u postgres bash scripts/replicar-estrutura-completa-vps.sh
```

Este script:
1. ✅ Corrige permissões do schema public
2. ✅ Executa sincronização principal
3. ✅ Executa todas as migrações em ordem
4. ✅ Força aprovação de produtos ativos
5. ✅ Mostra estatísticas finais

## 🛠️ Método 2: Script SQL Completo

Execute o script SQL que replica toda a estrutura:

```bash
cd /var/www/ratixpay.com

# Executar script SQL completo
sudo -u postgres psql -d ratixpay -f scripts/replicar-estrutura-banco-completo-vps.sql
```

## 🔧 Método 3: Executar Migrações Manualmente

Se preferir executar passo a passo:

```bash
cd /var/www/ratixpay.com

# 1. Corrigir permissões
sudo -u postgres psql -d ratixpay -f scripts/fix-schema-permissions.sql

# 2. Sincronização principal
sudo -u postgres psql -d ratixpay -f scripts/sincronizar-estrutura-banco-completo.sql

# 3. Migrações individuais (em ordem)
sudo -u postgres psql -d ratixpay -f migrations/add_status_aprovacao_to_produtos.sql
sudo -u postgres psql -d ratixpay -f migrations/add-carteira-campos-e-pagamento-public-id.sql
sudo -u postgres psql -d ratixpay -f migrations/add-integracao-campos-to-afiliados.sql
sudo -u postgres psql -d ratixpay -f migrations/create-upsell-tables.sql
sudo -u postgres psql -d ratixpay -f migrations/create-remarketing-queue.sql
sudo -u postgres psql -d ratixpay -f migrations/create-remarketing-conversoes.sql
sudo -u postgres psql -d ratixpay -f migrations/create-webhooks-table.sql
# ... (outras migrações)

# 4. Forçar aprovação de produtos ativos
sudo -u postgres psql -d ratixpay -f scripts/forcar-aprovacao-produtos-ativos.sql
```

## ✅ Verificação

Após executar, verifique se tudo está correto:

```bash
# Ver estrutura das tabelas principais
sudo -u postgres psql -d ratixpay -c "\d produtos"
sudo -u postgres psql -d ratixpay -c "\d carteiras"
sudo -u postgres psql -d ratixpay -c "\d pagamentos"

# Ver estatísticas de produtos
sudo -u postgres psql -d ratixpay -c "
SELECT 
    status_aprovacao,
    COUNT(*) as total,
    SUM(CASE WHEN ativo = true THEN 1 ELSE 0 END) as ativos
FROM produtos
GROUP BY status_aprovacao;
"

# Verificar se todas as colunas existem
sudo -u postgres psql -d ratixpay -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produtos' 
ORDER BY ordinal_position;
"
```

## 📋 Lista Completa de Tabelas Replicadas

O script replica as seguintes tabelas:

1. ✅ **usuarios** - Usuários do sistema
2. ✅ **produtos** - Produtos cadastrados
3. ✅ **vendas** - Vendas realizadas
4. ✅ **carteiras** - Carteiras dos vendedores
5. ✅ **pagamentos** - Saques solicitados
6. ✅ **afiliados** - Afiliados do sistema
7. ✅ **venda_afiliados** - Vendas de afiliados
8. ✅ **link_trackings** - Rastreamento de links
9. ✅ **cliques_validos_afiliados** - Cliques válidos
10. ✅ **banner_afiliados** - Banners de afiliados
11. ✅ **upsell_pages** - Páginas de upsell
12. ✅ **produto_upsell** - Relacionamento produto-upsell
13. ✅ **remarketing_queue** - Fila de remarketing
14. ✅ **remarketing_conversoes** - Conversões de remarketing
15. ✅ **webhooks** - Webhooks configurados
16. ✅ **notificacoes** - Notificações do sistema
17. ✅ **clientes** - Clientes cadastrados
18. ✅ **configuracoes** - Configurações do sistema
19. ✅ **saldo_admin** - Saldo do administrador
20. ✅ **historico_saques** - Histórico de saques
21. ✅ **estatisticas_vendedor** - Estatísticas dos vendedores
22. ✅ **codigos_autenticacao** - Códigos de autenticação
23. ✅ **pedidos** - Pedidos realizados
24. ✅ **pontos_venda** - Pontos de venda
25. ✅ **experts** - Experts cadastrados
26. ✅ **produtos_complementares_venda** - Produtos complementares

## ⚠️ Importante

1. **Backup**: Sempre faça backup antes de executar:
   ```bash
   sudo -u postgres pg_dump ratixpay > backup_antes_replicacao_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Permissões**: O script precisa ser executado como usuário `postgres`

3. **Ordem**: As migrações devem ser executadas na ordem correta (o script faz isso automaticamente)

4. **Testes**: Teste em ambiente de desenvolvimento antes de executar em produção

## 🔄 Após Replicação

1. **Reiniciar aplicação**:
   ```bash
   pm2 restart ratixpay
   ```

2. **Verificar logs**:
   ```bash
   pm2 logs ratixpay --lines 50
   ```

3. **Verificar funcionamento**: Acesse o painel e verifique se tudo está funcionando corretamente

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-*.log`
2. Verifique os logs da aplicação: `pm2 logs ratixpay`
3. Execute os scripts de diagnóstico disponíveis em `scripts/`

