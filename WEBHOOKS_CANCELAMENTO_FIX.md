# Correção: Webhooks para Vendas Canceladas

## Problema Identificado

Após uma venda cancelada, o webhook não estava sendo acionado em todos os cenários de cancelamento.

## Locais Corrigidos

Foram adicionados webhooks `venda_cancelada` nos seguintes pontos:

### 1. **services/cancelamentoService.js**
   - **Método `cancelarVenda()`**: Webhook adicionado quando venda é cancelada automaticamente após 5 minutos sem pagamento
   - **Método `cancelarVendaPorTimeout()`**: Webhook adicionado quando venda é cancelada por timeout ou erro de conexão

### 2. **routes/pagamento.js**
   - **Webhook PayMoz (linha ~2773)**: Já tinha webhook ✅
   - **Endpoint `/atualizar-status-venda/:transactionId` (linha ~3148)**: Webhook adicionado quando status é atualizado manualmente para Cancelada
   - **PayMoz retorna cancelamento (linha ~1866)**: Webhook adicionado quando API PayMoz retorna status de cancelamento
   - **Resposta inválida (linha ~2162)**: Webhook adicionado quando API não retorna dados válidos
   - **Endpoint `/cancelar-transacao/:transactionId` (linha ~3820)**: Webhook adicionado quando transação é cancelada por timeout

## Estrutura do Webhook `venda_cancelada`

Todos os webhooks de cancelamento enviam o seguinte payload:

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
    "cliente_whatsapp": "+258...",
    "status_anterior": "Pendente",
    "motivo": "Motivo do cancelamento",
    "tipo_erro": "timeout" (opcional),
    "data_cancelamento": "2024-01-01T12:00:00.000Z"
  }
}
```

## Filtro por Usuário

Todos os webhooks são filtrados por `vendedor_id`, garantindo que apenas os webhooks configurados pelo vendedor da venda recebam a notificação.

## Logs

Cada webhook envia logs detalhados:
- `✅ Webhook de venda cancelada enviado (cancelamento automático)`
- `✅ Webhook de venda cancelada enviado (timeout)`
- `✅ Webhook de venda cancelada enviado (atualização manual)`
- `✅ Webhook de venda cancelada enviado (PayMoz retornou cancelamento)`
- `✅ Webhook de venda cancelada enviado (resposta inválida)`

## Testes

Para testar os webhooks de cancelamento:

1. **Cancelamento automático (5 minutos)**:
   - Criar uma venda pendente
   - Aguardar 5 minutos
   - Verificar se webhook foi enviado

2. **Cancelamento manual**:
   - Usar endpoint `/api/pagamento/atualizar-status-venda/:transactionId`
   - Enviar status `Cancelada`
   - Verificar se webhook foi enviado

3. **Cancelamento por timeout**:
   - Usar endpoint `/api/pagamento/cancelar-transacao/:transactionId`
   - Verificar se webhook foi enviado

4. **Cancelamento via PayMoz**:
   - Simular resposta de cancelamento da API PayMoz
   - Verificar se webhook foi enviado

## Observações

- Todos os webhooks são enviados de forma assíncrona e não bloqueiam o processamento principal
- Erros no envio de webhook são logados mas não interrompem o fluxo
- Webhooks são filtrados por `vendedor_id` para garantir privacidade
- Cada tipo de cancelamento tem seu próprio log para facilitar debug

