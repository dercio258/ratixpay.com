# 📋 Guia de Atualização do Banco de Dados na VPS

Este guia explica como atualizar o banco de dados na VPS para incluir todas as novas colunas e tabelas necessárias.

## 🚀 Método 1: Script Automático (Recomendado)

### Passo 1: Conectar na VPS
```bash
ssh usuario@seu-servidor
cd /var/www/ratixpay  # ou o caminho do seu projeto
```

### Passo 2: Atualizar código do GitHub
```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

### Passo 3: Instalar dependências
```bash
npm install --production
```

### Passo 4: Executar migrações automáticas
```bash
node scripts/migrate-database-columns.js
```

Este script irá:
- ✅ Conectar ao banco usando credenciais do `.env`
- ✅ Verificar quais migrações já foram executadas
- ✅ Executar apenas as migrações pendentes
- ✅ Registrar todas as migrações executadas
- ✅ Ser seguro e não quebrar dados existentes

## 🔧 Método 2: Script Shell Completo

Execute o script completo que faz tudo automaticamente:

```bash
chmod +x scripts/update-database-vps.sh
./scripts/update-database-vps.sh
```

Este script faz:
1. ✅ Atualiza código do GitHub
2. ✅ Instala dependências
3. ✅ Verifica arquivo .env
4. ✅ Executa migrações do banco
5. ✅ Reinicia aplicação (PM2 ou systemd)

## 📊 Migrações Incluídas

O script executa automaticamente as seguintes migrações:

### Tabela `vendas`
- ✅ `cliente_whatsapp` - Número de WhatsApp do cliente
- ✅ `tracking_data` (JSONB) - Dados de rastreamento
- ✅ `created_at` / `updated_at` - Timestamps

### Tabela `carteiras`
- ✅ `tipo_carteira` - Tipo da carteira (mpesa, emola, etc)
- ✅ `status` - Status da carteira (ativo, inativo)
- ✅ `nome` - Nome da carteira
- ✅ `contacto_mpesa` - Contato Mpesa
- ✅ `nome_titular_mpesa` - Nome do titular Mpesa
- ✅ `contacto_emola` - Contato Emola
- ✅ `nome_titular_emola` - Nome do titular Emola
- ✅ `email` - Email do titular
- ✅ `created_at` / `updated_at` - Timestamps

### Tabela `produtos`
- ✅ `status_aprovacao` - Status de aprovação (aprovado, rejeitado, pendente_aprovacao)
- ✅ `motivo_rejeicao` - Motivo da rejeição
- ✅ `remarketing_config` (JSON) - Configuração de remarketing

### Tabela `afiliados`
- ✅ `email_verificado` - Email verificado
- ✅ `codigo_verificacao` - Código de verificação
- ✅ `codigo_verificacao_expira` - Expiração do código
- ✅ `vendedor_id` (UUID) - ID do vendedor associado
- ✅ `meta_pixel_id` - ID do Meta Pixel
- ✅ `utmify_api_token` - Token da API UTMify

### Tabela `usuarios`
- ✅ `whatsapp_notification_types` (JSON) - Tipos de notificações WhatsApp

### Tabela `pagamentos`
- ✅ `public_id` - ID público memorável
- ✅ `valor_liquido` - Valor líquido após taxas
- ✅ `taxa` - Taxa aplicada
- ✅ `nome_titular` - Nome do titular
- ✅ `ip_solicitacao` - IP da solicitação
- ✅ `user_agent` - User agent do navegador

### Novas Tabelas

#### `remarketing_queue`
Fila de remarketing para vendas canceladas:
- `id`, `cliente_id`, `cliente_nome`, `produto_id`, `produto_nome`
- `email`, `telefone`, `status`, `data_cancelamento`
- `tempo_envio`, `data_agendada`, `tentativas`
- `venda_cancelada_id`, `created_at`, `updated_at`

#### `remarketing_conversoes`
Rastreia conversões de remarketing:
- `id`, `remarketing_queue_id`, `venda_cancelada_id`, `venda_aprovada_id`
- `cliente_id`, `cliente_nome`, `produto_id`, `produto_nome`
- `email`, `telefone`, `data_cancelamento`, `data_remarketing_enviado`
- `data_conversao`, `valor_venda_cancelada`, `valor_venda_aprovada`
- `tempo_ate_conversao_minutos`, `created_at`, `updated_at`

#### `webhooks`
Webhooks configurados pelos usuários:
- `id`, `user_id`, `produto_id`, `url`, `eventos` (JSON)
- `secret`, `ativo`, `created_at`, `updated_at`

#### `upsell_pages`
Páginas de upsell:
- `id`, `vendedor_id`, `titulo`, `nome_produto`, `slug`, `nome`
- `video_url`, `video_public_id`, `video_embed`, `imagem_url`
- `link_checkout`, `produto_id`, `subheadline`, `beneficios` (JSONB)
- `texto_urgencia`, `prova_social` (JSONB), `reforco_final`
- `texto_botao_aceitar`, `texto_botao_recusar`, `preco_original`
- `template_id`, `template_html`, `atributos` (JSONB)
- `ativo`, `ordem`, `created_at`, `updated_at`

#### `produto_upsell`
Relacionamento produtos → páginas de upsell:
- `id`, `produto_id`, `upsell_page_id`, `ordem`, `ativo`
- `created_at`, `updated_at`

#### `produto_upsell_page`
Relacionamento produto comprado → página de upsell:
- `id`, `produto_id`, `upsell_page_id`, `ativo`
- `created_at`, `updated_at`

## ⚙️ Configuração do .env

Certifique-se de que o arquivo `.env` na VPS contém:

```env
# Banco de Dados PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
# ou
DB_PASS=sua_senha_aqui
```

## 🔍 Verificação

Após executar as migrações, você pode verificar:

```bash
# Conectar ao PostgreSQL
psql -U postgres -d ratixpay

# Verificar migrações executadas
SELECT * FROM schema_migrations ORDER BY executed_at DESC;

# Verificar estrutura de uma tabela
\d upsell_pages
\d remarketing_queue
\d webhooks
```

## ⚠️ Troubleshooting

### Erro de Conexão
```
❌ Erro fatal ao executar migrações: connect ECONNREFUSED
```

**Solução:**
1. Verifique se o PostgreSQL está rodando: `sudo systemctl status postgresql`
2. Verifique credenciais no `.env`
3. Verifique firewall/porta 5432

### Erro de Permissão
```
❌ ERROR: permission denied for table
```

**Solução:**
1. Verifique se o usuário do banco tem permissões
2. Execute como superusuário se necessário:
   ```bash
   sudo -u postgres psql -d ratixpay
   ```

### Coluna Já Existe
O script detecta automaticamente e ignora. Não é um erro.

## 📝 Comando Completo (Copy & Paste)

```bash
cd /var/www/ratixpay && \
git fetch origin && \
git reset --hard origin/main && \
git clean -fd && \
npm install --production && \
node scripts/migrate-database-columns.js && \
pm2 restart ratixpay
```

## ✅ Checklist

- [ ] Código atualizado do GitHub
- [ ] Dependências instaladas
- [ ] Arquivo .env configurado
- [ ] Migrações executadas com sucesso
- [ ] Aplicação reiniciada
- [ ] Verificação das tabelas criadas
- [ ] Teste de funcionalidades principais

## 🎉 Pronto!

Após executar as migrações, todas as novas funcionalidades estarão disponíveis:
- ✅ Sistema de Upsell completo
- ✅ Sistema de Remarketing
- ✅ Webhooks configuráveis
- ✅ Melhorias em Afiliados
- ✅ Campos adicionais em Carteiras e Pagamentos

