# Correção do Sistema de Webhooks

## Problemas Identificados e Corrigidos

### 1. **Uso de `fetch` no Node.js**
- **Problema:** A função `enviarWebhook não estar disponível em todas as versões do Node.js
- **Solução:** Substituído por `axios` que já está instalado e é mais confiável

### 2. **Falta de Filtro por Usuário**
- **Problema:** Webhooks eram enviados para todos os usuários, não apenas para o vendedor da venda
- **Solução:** Adicionado parâmetro `userId` para filtrar webhooks apenas do vendedor da venda

### 3. **Falta de Timeout**
- **Problema:** Webhooks podiam ficar pendurados indefinidamente
- **Solução:** Adicionado timeout de 10 segundos nas requisições

### 4. **Falta de Tratamento de Eventos JSON**
- **Problema:** Eventos podem estar salvos como JSON string ou array
- **Solução:** Adicionado tratamento para ambos os formatos

### 5. **Falta de Webhook para Venda Cancelada**
- **Problema:** Apenas `venda_aprovada` estava sendo enviado
- **Solução:** Adicionado webhook para `venda_cancelada`

## Mudanças Implementadas

### Arquivo: `routes/webhooks.js`

1. **Importação do axios:**
```javascript
const axios = require('axios');
```

2. **Função `enviarWebhook` melhorada:**
   - Aceita parâmetro `userId` opcional para filtrar webhooks
   - Usa `axios` ao invés de `fetch`
   - Timeout de 10 segundos
   - Melhor tratamento de erros
   - Suporte para eventos em formato JSON string ou array
   - Logs mais detalhados

3. **Filtro por usuário:**
   - Se `userId` for fornecido, busca apenas webhooks desse usuário
   - Isso garante que cada vendedor recebe apenas seus webhooks

### Arquivo: `routes/pagamento.js`

1. **Webhook de venda aprovada:**
   - Agora passa o `vendedor_id` como terceiro parâmetro
   - Inclui mais dados no payload (telefone, whatsapp)

2. **Webhook de venda cancelada:**
   - Adicionado quando pagamento é cancelado/rejeitado
   - Inclui dados completos da venda e motivo do cancelamento
   - Filtrado por `vendedor_id`

## Eventos Disponíveis

### `venda_aprovada`
Disparado quando uma venda é aprovada.

**Payload:**
```json
{
  "evento": "venda_aprovada",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "dados": {
    "venda_id": "uuid",
    "produto_id": "uuid",
    "vendedor_id": "uuid",
    "valor": 1000.00,
    "cliente_nome": "Nome do Cliente",
    "cliente_email": "cliente@email.com",
    "cliente_telefone": "+258...",
    "cliente_whatsapp": "+258...",
    "data_aprovacao": "2024-01-01T12:00:00.000Z"
  }
}
```

### `venda_cancelada`
Disparado quando uma venda é cancelada ou rejeitada.

**Payload:**
```json
{
  "evento": "venda_cancelada",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "dados": {
    "venda_id": "uuid",
    "produto_id": "uuid",
    "vendedor_id": "uuid",
    "valor": 1000.00,
    "cliente_nome": "Nome do Cliente",
    "cliente_email": "cliente@email.com",
    "cliente_telefone": "+258...",
    "status_anterior": "Pendente",
    "motivo": "Pagamento cancelado",
    "data_cancelamento": "2024-01-01T12:00:00.000Z"
  }
}
```

## Headers Enviados

Todos os webhooks incluem os seguintes headers:

- `Content-Type: application/json`
- `User-Agent: RatixPay-Webhook/1.0`
- `X-Webhook-Event: [nome_do_evento]`
- `X-Webhook-Secret: [secret]` (se configurado)

## Melhorias

1. **Timeout:** 10 segundos por requisição
2. **Retry:** Pode ser adicionado futuramente se necessário
3. **Logs:** Mais detalhados para debug
4. **Filtro por usuário:** Webhooks são filtrados por vendedor
5. **Tratamento de erros:** Não interrompe o processamento principal

## Testes

Para testar os webhooks:

1. Configure um webhook no painel
2. Crie uma venda de teste
3. Aprove ou cancele a venda
4. Verifique os logs do servidor
5. Verifique se a URL do webhook recebeu a requisição

## Próximos Passos

- [ ] Adicionar retry automático para falhas temporárias
- [ ] Adicionar fila de webhooks para processamento assíncrono
- [ ] Adicionar histórico de envios
- [ ] Adicionar mais eventos (venda_pendente, produto_criado, etc.)

