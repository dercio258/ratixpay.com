# Verificação: Webhooks Funcionam Conforme Configurações

## Validações Implementadas

A função `enviarWebhook` agora garante que os webhooks funcionem **EXATAMENTE** de acordo com as configurações feitas pelo usuário:

### 1. **Status Ativo/Inativo** ✅
- Webhooks são enviados **APENAS** se `ativo = true` no banco de dados
- Webhooks desativados (`ativo = false`) são **COMPLETAMENTE IGNORADOS**

### 2. **Eventos Configurados** ✅
- Webhooks são enviados **APENAS** se o evento estiver na lista de eventos configurados
- O sistema verifica se o evento existe no array `eventos` do webhook
- Suporta diferentes formatos de armazenamento (Array, JSON string, valor único)

### 3. **Filtro por Usuário** ✅
- Quando `userId` é fornecido, webhooks são enviados **APENAS** para o usuário especificado
- Isso garante que vendedores só recebem webhooks de suas próprias vendas
- Webhooks de outros usuários são **COMPLETAMENTE IGNORADOS**

### 4. **Logs Detalhados** ✅
- Logs mostram exatamente quais webhooks foram encontrados
- Logs mostram quais webhooks incluem o evento
- Logs mostram quais webhooks foram enviados com sucesso
- Logs mostram quais webhooks falharam e o motivo

## Fluxo de Validação

```
1. Evento é disparado (ex: venda_aprovada)
   ↓
2. Sistema busca webhooks com filtros:
   - ativo = true (conforme configuração)
   - user_id = userId (quando fornecido)
   ↓
3. Para cada webhook encontrado:
   - Verifica se evento está na lista de eventos configurados
   - Se SIM → adiciona à lista de envio
   - Se NÃO → ignora o webhook
   ↓
4. Envia para todos os webhooks filtrados
   ↓
5. Registra resultados (sucessos e falhas)
```

## Exemplos de Logs

### Caso 1: Webhook Configurado Corretamente
```
🔄 [WEBHOOK] Processando evento: venda_aprovada
👤 [WEBHOOK] Filtro por usuário: 123e4567-e89b-12d3-a456-426614174000
🔍 [WEBHOOK] Buscando webhooks com filtros: {"ativo":true,"user_id":"123e4567..."}
📋 [WEBHOOK] 2 webhook(s) ativo(s) encontrado(s)
✓ [WEBHOOK] Webhook webhook_123 (https://exemplo.com/webhook) inclui evento "venda_aprovada"
  └─ Eventos configurados: [venda_aprovada, venda_cancelada]
✗ [WEBHOOK] Webhook webhook_456 (https://outro.com/webhook) NÃO inclui evento "venda_aprovada"
  └─ Eventos configurados: [pagamento_recebido]
📤 [WEBHOOK] Enviando para 1 webhook(s) configurado(s)
📡 [WEBHOOK] Enviando para: https://exemplo.com/webhook
✅ [WEBHOOK] Enviado com sucesso para: https://exemplo.com/webhook
   └─ Status HTTP: 200
   └─ Evento: venda_aprovada
   └─ Webhook ID: webhook_123
📊 [WEBHOOK] Resumo do envio:
   └─ Evento: venda_aprovada
   └─ Total de webhooks: 1
   └─ Sucessos: 1
   └─ Falhas: 0
```

### Caso 2: Nenhum Webhook Configurado para o Evento
```
🔄 [WEBHOOK] Processando evento: venda_cancelada
👤 [WEBHOOK] Filtro por usuário: 123e4567-e89b-12d3-a456-426614174000
🔍 [WEBHOOK] Buscando webhooks com filtros: {"ativo":true,"user_id":"123e4567..."}
📋 [WEBHOOK] 1 webhook(s) ativo(s) encontrado(s)
✗ [WEBHOOK] Webhook webhook_123 (https://exemplo.com/webhook) NÃO inclui evento "venda_cancelada"
  └─ Eventos configurados: [venda_aprovada]
📭 [WEBHOOK] Nenhum webhook ativo configurado para o evento: venda_cancelada
💡 [WEBHOOK] Dica: Verifique se algum webhook tem o evento "venda_cancelada" na lista de eventos configurados
```

### Caso 3: Webhook Desativado
```
🔄 [WEBHOOK] Processando evento: venda_aprovada
👤 [WEBHOOK] Filtro por usuário: 123e4567-e89b-12d3-a456-426614174000
🔍 [WEBHOOK] Buscando webhooks com filtros: {"ativo":true,"user_id":"123e4567..."}
📭 [WEBHOOK] Nenhum webhook ativo encontrado para os filtros aplicados
💡 [WEBHOOK] Dica: Verifique se existem webhooks ativos para o usuário 123e4567...
```

## Configurações Respeitadas

✅ **Status Ativo/Inativo**: Webhooks desativados nunca recebem eventos  
✅ **Lista de Eventos**: Apenas eventos configurados são enviados  
✅ **Filtro por Usuário**: Apenas webhooks do usuário correto recebem eventos  
✅ **Secret**: Secret configurado é enviado no header `X-Webhook-Secret`  
✅ **Timeout**: Requisições têm timeout de 10 segundos  

## Troubleshooting

### Webhook não está recebendo eventos?

1. **Verifique se está ativo:**
   - Acesse a página de configuração de webhooks
   - Verifique se o status está "Ativo"

2. **Verifique se o evento está configurado:**
   - Acesse a página de configuração de webhooks
   - Verifique se o evento está marcado na lista de eventos

3. **Verifique os logs:**
   - Consulte os logs do servidor para ver mensagens detalhadas
   - Logs mostram exatamente por que um webhook foi ou não enviado

4. **Verifique o filtro de usuário:**
   - Se o evento é de uma venda, verifique se o webhook pertence ao vendedor correto
   - Logs mostram qual usuário está sendo filtrado

## Melhorias Implementadas

1. ✅ Logs mais detalhados e estruturados
2. ✅ Validação rigorosa de configurações
3. ✅ Suporte para diferentes formatos de eventos no banco
4. ✅ Mensagens de erro mais informativas
5. ✅ Dicas de troubleshooting nos logs

