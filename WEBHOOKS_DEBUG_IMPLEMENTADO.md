# Debug Completo de Webhooks Implementado

## Logs de Debug Adicionados

Foram adicionados logs de debug **EXTREMAMENTE DETALHADOS** em todo o fluxo de webhooks para identificar exatamente onde está o problema.

### 1. **Função `enviarWebhook` (routes/webhooks.js)**

#### Início do Processamento
- ✅ Evento sendo processado
- ✅ User ID (se fornecido)
- ✅ Dados completos recebidos
- ✅ Timestamp

#### Busca no Banco de Dados
- ✅ Filtros WHERE aplicados
- ✅ Quantidade de webhooks encontrados
- ✅ Detalhes completos de cada webhook encontrado:
  - ID
  - URL
  - User ID
  - Status ativo
  - Tipo de eventos
  - Eventos raw
  - Secret configurado

#### Filtragem por Evento
- ✅ Evento procurado
- ✅ Análise detalhada de cada webhook:
  - Tipo de eventos no banco
  - Eventos raw
  - Como foi parseado
  - Se o evento está na lista
  - Se será enviado ou não

#### Preparação do Envio
- ✅ Total de webhooks que receberão o evento
- ✅ Payload completo sendo enviado

#### Envio Individual
Para cada webhook:
- ✅ URL de destino
- ✅ Webhook ID
- ✅ Headers completos
- ✅ Payload completo
- ✅ Tempo de resposta
- ✅ Status HTTP
- ✅ Resposta do servidor (se houver)
- ✅ Erros detalhados (se houver)

#### Resumo Final
- ✅ Total de webhooks encontrados
- ✅ Total de webhooks filtrados
- ✅ Total de envios
- ✅ Sucessos e falhas
- ✅ Detalhes de cada resultado

### 2. **Chamadas em `routes/pagamento.js`**

#### Webhook `venda_aprovada`
- ✅ Venda ID
- ✅ Produto ID
- ✅ Vendedor ID
- ✅ Confirmação de processamento
- ✅ Erros detalhados (se houver)

#### Webhook `venda_cancelada`
- ✅ Venda ID
- ✅ Produto ID
- ✅ Vendedor ID
- ✅ Motivo do cancelamento
- ✅ Confirmação de processamento
- ✅ Erros detalhados (se houver)

### 3. **Chamadas em `services/cancelamentoService.js`**

#### Cancelamento Automático
- ✅ Venda ID
- ✅ Produto ID
- ✅ Vendedor ID
- ✅ Motivo do cancelamento
- ✅ Confirmação de processamento
- ✅ Erros detalhados (se houver)

#### Cancelamento por Timeout
- ✅ Venda ID
- ✅ Tipo de erro
- ✅ Motivo
- ✅ Vendedor ID
- ✅ Confirmação de processamento
- ✅ Erros detalhados (se houver)

## Formato dos Logs

Todos os logs seguem um formato padronizado com separadores visuais:

```
================================================================================
🔄 [WEBHOOK DEBUG] ===== TÍTULO DA SEÇÃO =====
[Conteúdo detalhado]
================================================================================
```

## O Que os Logs Mostram

### Quando Webhook Funciona
```
🔄 [WEBHOOK DEBUG] ===== INÍCIO DO PROCESSAMENTO =====
📋 [WEBHOOK DEBUG] ===== WEBHOOKS ENCONTRADOS =====
🔍 [WEBHOOK DEBUG] ===== FILTRANDO POR EVENTO =====
📤 [WEBHOOK DEBUG] ===== PREPARANDO ENVIO =====
📡 [WEBHOOK DEBUG] ===== ENVIANDO WEBHOOK =====
✅ [WEBHOOK DEBUG] ===== SUCESSO =====
📊 [WEBHOOK DEBUG] ===== RESUMO FINAL =====
```

### Quando Webhook Não Funciona
Os logs mostram **EXATAMENTE** onde está o problema:

1. **Nenhum webhook encontrado:**
   - Mostra os filtros aplicados
   - Sugere query SQL para verificar no banco

2. **Webhook não inclui evento:**
   - Mostra eventos configurados
   - Mostra evento procurado
   - Explica por que não foi enviado

3. **Erro ao enviar:**
   - Status HTTP (se houver)
   - Mensagem de erro completa
   - Stack trace
   - Configuração da requisição

## Como Usar os Logs

1. **Execute uma ação que deve disparar webhook** (ex: aprovar venda, cancelar venda)

2. **Verifique os logs do servidor** - você verá:
   - Se a função foi chamada
   - Se webhooks foram encontrados
   - Se eventos foram filtrados corretamente
   - Se o envio foi bem-sucedido ou falhou

3. **Siga o fluxo:**
   - Procure por `[WEBHOOK DEBUG]` nos logs
   - Cada seção mostra uma etapa do processo
   - Erros são claramente marcados com `❌`

## Exemplo de Debug Completo

```
================================================================================
🔄 [WEBHOOK DEBUG] ===== INÍCIO DO PROCESSAMENTO =====
🔄 [WEBHOOK DEBUG] Evento: venda_aprovada
🔄 [WEBHOOK DEBUG] User ID: 123e4567-e89b-12d3-a456-426614174000
🔄 [WEBHOOK DEBUG] Dados recebidos: {
  "venda_id": "...",
  "produto_id": "...",
  ...
}
================================================================================

🔍 [WEBHOOK DEBUG] Buscando webhooks no banco de dados...
🔍 [WEBHOOK DEBUG] Filtros WHERE: {
  "ativo": true,
  "user_id": "123e4567-e89b-12d3-a456-426614174000"
}

================================================================================
📋 [WEBHOOK DEBUG] ===== WEBHOOKS ENCONTRADOS =====
📋 [WEBHOOK DEBUG] Total encontrado: 1

📋 [WEBHOOK DEBUG] Webhook #1:
   └─ ID: webhook_123
   └─ URL: https://exemplo.com/webhook
   └─ User ID: 123e4567-e89b-12d3-a456-426614174000
   └─ Ativo: true
   └─ Eventos (tipo): object
   └─ Eventos (raw): ["venda_aprovada", "venda_cancelada"]
================================================================================

================================================================================
🔍 [WEBHOOK DEBUG] ===== FILTRANDO POR EVENTO =====
🔍 [WEBHOOK DEBUG] Evento procurado: "venda_aprovada"
================================================================================

🔍 [WEBHOOK DEBUG] Analisando webhook webhook_123...
   └─ Tipo de eventos: object
   └─ Eventos raw: ["venda_aprovada", "venda_cancelada"]
   └─ Eventos é Array: [venda_aprovada, venda_cancelada]
   └─ Evento "venda_aprovada" está na lista? SIM ✓
   └─ Eventos configurados: [venda_aprovada, venda_cancelada]
   ✅ [WEBHOOK DEBUG] Webhook webhook_123 SERÁ ENVIADO

================================================================================
📤 [WEBHOOK DEBUG] ===== PREPARANDO ENVIO =====
📤 [WEBHOOK DEBUG] Total de webhooks que receberão o evento: 1
================================================================================

📦 [WEBHOOK DEBUG] Payload preparado:
{
  "evento": "venda_aprovada",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "dados": { ... }
}

================================================================================
📡 [WEBHOOK DEBUG] ===== ENVIANDO WEBHOOK #1/1 =====
📡 [WEBHOOK DEBUG] URL: https://exemplo.com/webhook
📡 [WEBHOOK DEBUG] Webhook ID: webhook_123
📡 [WEBHOOK DEBUG] Evento: venda_aprovada
📡 [WEBHOOK DEBUG] Secret configurado: SIM
📡 [WEBHOOK DEBUG] Headers: { ... }
📡 [WEBHOOK DEBUG] Payload: { ... }
📡 [WEBHOOK DEBUG] Fazendo requisição POST...

✅ [WEBHOOK DEBUG] ===== SUCESSO =====
✅ [WEBHOOK DEBUG] URL: https://exemplo.com/webhook
✅ [WEBHOOK DEBUG] Status HTTP: 200
✅ [WEBHOOK DEBUG] Tempo de resposta: 234ms
✅ [WEBHOOK DEBUG] Evento: venda_aprovada
✅ [WEBHOOK DEBUG] Webhook ID: webhook_123
✅ [WEBHOOK DEBUG] Resposta do servidor: { ... }
================================================================================

================================================================================
📊 [WEBHOOK DEBUG] ===== RESUMO FINAL =====
📊 [WEBHOOK DEBUG] Evento: venda_aprovada
📊 [WEBHOOK DEBUG] Total de webhooks encontrados: 1
📊 [WEBHOOK DEBUG] Total de webhooks filtrados: 1
📊 [WEBHOOK DEBUG] Total de envios: 1
📊 [WEBHOOK DEBUG] Sucessos: 1
📊 [WEBHOOK DEBUG] Falhas: 0
   ✅ Webhook #1: https://exemplo.com/webhook - Status 200
================================================================================
```

## Próximos Passos

1. Execute uma ação que deve disparar webhook
2. Verifique os logs do servidor
3. Procure por `[WEBHOOK DEBUG]` para ver todo o fluxo
4. Identifique onde está o problema usando os logs detalhados

Os logs agora mostram **TUDO** que acontece no sistema de webhooks!

