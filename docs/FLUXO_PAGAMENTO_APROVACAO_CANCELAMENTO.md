# 💳 Fluxo de Pagamento - Aprovação e Cancelamento

## 📋 Visão Geral

Este documento explica de forma clara e detalhada como funciona o processo de pagamento no sistema RatixPay, desde a criação até a aprovação ou cancelamento.

---

## 🔄 Fluxo Completo do Pagamento

### **FASE 1: Início do Pagamento**

#### 1.1. Cliente Inicia o Pagamento
```javascript
// Endpoint: POST /api/pagamento/pagar
// Localização: routes/pagamento.js (linha ~1217)
```

**Dados Necessários:**
- `productId`: ID do produto
- `amount`: Valor do pagamento
- `method`: Método de pagamento (`mpesa` ou `emola`)
- `phone`: Número de telefone do cliente
- `customerEmail`: Email do cliente
- `customerName`: Nome do cliente

**O que acontece:**
1. Sistema cria uma **Venda** no banco de dados com status `Pendente`
2. Sistema gera um `transaction_id` único
3. Sistema envia requisição para o gateway de pagamento (PayMoz)
4. Gateway retorna `output_ThirdPartyReference` (usado como transaction_id)

**Estrutura da Venda Criada:**
```json
{
  "id": "uuid-da-venda",
  "produto_id": "id-do-produto",
  "cliente_nome": "Nome do Cliente",
  "cliente_email": "email@exemplo.com",
  "cliente_telefone": "841234567",
  "valor": 150.00,
  "status": "Pendente",
  "pagamentoStatus": "Pendente",
  "referencia_pagamento": "transaction_id_gerado",
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### **FASE 2: Processamento pelo Gateway (PayMoz)**

#### 2.1. PayMoz Processa o Pagamento

O PayMoz recebe a requisição e:
- Envia notificação push para o celular do cliente
- Cliente confirma o pagamento no celular
- PayMoz processa a transação

**Possíveis Respostas do PayMoz:**

✅ **Sucesso:**
```json
{
  "sucesso": true,
  "dados": {
    "output_TransactionID": "TXN123456",
    "output_ThirdPartyReference": "REF789012",
    "output_ResponseCode": "0",
    "output_ResponseDesc": "Transação aprovada"
  }
}
```

❌ **Falha:**
```json
{
  "sucesso": false,
  "mensagem": "Saldo insuficiente",
  "erro": "INSUFFICIENT_FUNDS"
}
```

---

### **FASE 3: Webhook - Atualização de Status**

#### 3.1. PayMoz Envia Webhook

**Endpoint:** `POST /api/pagamento/webhook/paymoz`  
**Localização:** `routes/pagamento.js` (linha ~2589)

**Estrutura do Webhook Recebido:**
```json
{
  "output_ThirdPartyReference": "transaction_id",
  "output_TransactionID": "TXN123456",
  "status": "success",  // ou "failed", "cancelled", "pending"
  "amount": 150.00,
  "method": "mpesa",
  "error_message": "Mensagem de erro (se houver)",
  "error_code": "Código de erro (se houver)"
}
```

#### 3.2. Mapeamento de Status

O sistema mapeia o status do gateway para o status interno:

| Status Gateway | Status Pagamento | Status Venda | Ação |
|----------------|------------------|--------------|------|
| `success` / `approved` / `completed` | `Aprovado` | `Pago` | ✅ Processar pagamento aprovado |
| `failed` / `rejected` / `declined` | `Rejeitado` | `Cancelado` | ❌ Registrar falha |
| `cancelled` / `canceled` | `Cancelado` | `Falha` | ❌ Registrar cancelamento |
| `pending` / `processing` | `Pendente` | `Pendente` | ⏳ Aguardar |

---

## ✅ **PAGAMENTO APROVADO - O que é necessário?**

### **Condições para Aprovação:**

1. **Webhook recebido com status `success`, `approved` ou `completed`**
2. **Venda encontrada no banco** (busca por `referencia_pagamento`)
3. **Status anterior não era `Aprovado`** (evita processamento duplicado)

### **Processo de Aprovação:**

#### Passo 1: Atualizar Status da Venda
```javascript
// Atualiza no banco de dados
venda.pagamentoStatus = 'Aprovado';
venda.status = 'Pago';
venda.data_pagamento = new Date().toISOString();
venda.pagamentoDataProcessamento = new Date().toISOString();
await venda.save();
```

#### Passo 2: Processar Pagamento Aprovado
```javascript
// Função: processarPagamentoAprovado()
// Localização: routes/pagamento.js (linha ~407)
```

**O que acontece:**

1. **Estruturar informações do pedido:**
   ```javascript
   const pedidoInfo = {
     pedidoId: venda.id,           // UUID da venda
     idPedido: transactionId,      // Transaction ID como ID do pedido
     cliente: { nome, email, telefone, whatsapp },
     produto: { id, nome, valorOriginal, valorVendedor },
     vendedor: { id, nome },
     pagamento: {
       metodo: 'mpesa',
       status: 'Aprovado',
       transactionId: transactionId,
       dataAprovacao: new Date().toISOString()
     },
     linkSucesso: 'https://ratixpay.com/payment-success.html?pedido=...'
   };
   ```

2. **Incrementar vendas do produto:**
   ```javascript
   await Produto.increment('vendas', { where: { id: produto.id } });
   ```

3. **Enviar para UTMify** (se configurado):
   - Envia dados de tracking para análise
   - Marca como enviado no `tracking_data`

4. **Processar tracking de afiliados:**
   - Calcula comissão
   - Cria registro de venda do afiliado
   - Envia notificação ao afiliado

5. **Enviar notificações:**
   - Email para o cliente
   - Notificação para o vendedor
   - WhatsApp (se configurado)

6. **Registrar logs:**
   - Log de auditoria
   - Log de venda aprovada

---

## ❌ **PAGAMENTO CANCELADO/REJEITADO - O que é necessário?**

### **Condições para Cancelamento:**

1. **Webhook recebido com status:**
   - `failed`
   - `rejected`
   - `declined`
   - `cancelled` / `canceled`

2. **Venda encontrada no banco**

### **Processo de Cancelamento:**

#### Passo 1: Atualizar Status da Venda
```javascript
// Para status: failed, rejected, declined
venda.pagamentoStatus = 'Rejeitado';
venda.status = 'Cancelado';
venda.falhaMotivo = error_message || 'Pagamento rejeitado pelo gateway';
venda.falhaData = new Date().toISOString();
venda.falhaId = `FAIL-${Date.now()}-${random}`;

// Para status: cancelled, canceled
venda.pagamentoStatus = 'Cancelado';
venda.status = 'Falha';
venda.falhaMotivo = error_message || 'Pagamento cancelado';
venda.falhaData = new Date().toISOString();
venda.falhaId = `CANCEL-${Date.now()}-${random}`;
```

#### Passo 2: Registrar Informações de Falha

**Estrutura de Falha:**
```json
{
  "falhaMotivo": "Saldo insuficiente",
  "falhaData": "2024-01-15T10:35:00Z",
  "falhaId": "FAIL-1705312500000-abc123",
  "error_message": "Mensagem do gateway",
  "error_code": "INSUFFICIENT_FUNDS"
}
```

#### Passo 3: Notificar Cliente (Opcional)
- Email informando sobre o cancelamento
- Explicar o motivo da falha

---

## 📊 **Estrutura de Dados Completa**

### **Venda no Banco de Dados:**

```javascript
{
  // Identificação
  id: "uuid-da-venda",
  public_id: "PUB123456",
  numero_pedido: "123456",
  
  // Cliente
  cliente_nome: "João Silva",
  cliente_email: "joao@exemplo.com",
  cliente_telefone: "841234567",
  cliente_whatsapp: "841234567",
  cliente_ip: "192.168.1.1",
  
  // Produto
  produto_id: "uuid-do-produto",
  valor: 150.00,
  
  // Pagamento
  referencia_pagamento: "transaction_id",
  pagamentoStatus: "Aprovado" | "Rejeitado" | "Cancelado" | "Pendente",
  pagamentoReferencia: "REF789012",
  metodo_pagamento: "mpesa" | "emola",
  
  // Status
  status: "Pago" | "Cancelado" | "Falha" | "Pendente",
  
  // Datas
  created_at: "2024-01-15T10:30:00Z",
  data_pagamento: "2024-01-15T10:35:00Z",
  pagamentoDataProcessamento: "2024-01-15T10:35:05Z",
  updated_at: "2024-01-15T10:35:05Z",
  
  // Falha (se aplicável)
  falhaMotivo: "Motivo da falha",
  falhaData: "2024-01-15T10:35:00Z",
  falhaId: "FAIL-1705312500000-abc123",
  
  // Tracking
  tracking_data: {
    utm_source: "google",
    utm_medium: "cpc",
    utmfy_enviado: true,
    utmfy_enviado_em: "2024-01-15T10:35:10Z"
  },
  
  // Tentativas
  tentativas: 1
}
```

---

## 🔍 **Verificação de Status**

### **Endpoint para Verificar Status:**

```javascript
// GET /api/pagamento/status/:transactionId
// Localização: routes/paymentStatus.js
```

**Resposta de Sucesso:**
```json
{
  "success": true,
  "data": {
    "transactionId": "REF789012",
    "status": "Pago",
    "pagamentoStatus": "Aprovado",
    "venda": {
      "id": "uuid-da-venda",
      "produto": { "nome": "Produto X" },
      "valor": 150.00,
      "data_pagamento": "2024-01-15T10:35:00Z"
    }
  }
}
```

**Resposta de Cancelamento:**
```json
{
  "success": true,
  "data": {
    "transactionId": "REF789012",
    "status": "Cancelado",
    "pagamentoStatus": "Rejeitado",
    "venda": {
      "id": "uuid-da-venda",
      "falhaMotivo": "Saldo insuficiente",
      "falhaData": "2024-01-15T10:35:00Z"
    }
  }
}
```

---

## 🛠️ **Atualização Manual de Status**

### **Endpoint para Atualizar Manualmente:**

```javascript
// POST /api/pagamento/atualizar-status-venda/:transactionId
// Localização: routes/pagamento.js (linha ~2959)
```

**Body da Requisição:**
```json
{
  "status": "Aprovada" | "Rejeitado" | "Cancelada" | "Pendente",
  "motivo": "Motivo do cancelamento (opcional)"
}
```

**Validações:**
- Status deve ser um dos valores válidos
- Venda deve existir no banco
- Transaction ID deve ser válido

---

## 📝 **Resumo - Checklist de Aprovação**

### ✅ **Para um pagamento ser APROVADO:**

1. ✅ Cliente inicia pagamento com dados válidos
2. ✅ Venda criada no banco com status `Pendente`
3. ✅ Requisição enviada para PayMoz com sucesso
4. ✅ Cliente confirma pagamento no celular
5. ✅ PayMoz processa e retorna `success`
6. ✅ Webhook recebido com status `success`/`approved`/`completed`
7. ✅ Venda encontrada no banco pelo `transaction_id`
8. ✅ Status atualizado para `Aprovado` e `Pago`
9. ✅ Processamento completo executado:
   - Incremento de vendas do produto
   - Envio para UTMify
   - Processamento de afiliados
   - Envio de notificações
   - Registro de logs

### ❌ **Para um pagamento ser CANCELADO:**

1. ❌ Cliente inicia pagamento
2. ❌ Venda criada no banco
3. ❌ Requisição enviada para PayMoz
4. ❌ Cliente **NÃO confirma** ou **saldo insuficiente**
5. ❌ PayMoz retorna `failed`/`rejected`/`cancelled`
6. ❌ Webhook recebido com status de falha
7. ❌ Venda encontrada no banco
8. ❌ Status atualizado para `Rejeitado`/`Cancelado` e `Cancelado`/`Falha`
9. ❌ Informações de falha registradas:
   - `falhaMotivo`
   - `falhaData`
   - `falhaId`

---

## 🔄 **Fluxograma Visual**

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE INICIA PAGAMENTO                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              SISTEMA CRIA VENDA (Status: Pendente)           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         ENVIA REQUISIÇÃO PARA PAYMOZ (Gateway)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         CLIENTE CONFIRMA PAGAMENTO NO CELULAR               │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐           ┌──────────────────┐
│   SUCESSO     │           │   FALHA/CANCEL   │
└───────┬───────┘           └────────┬─────────┘
        │                             │
        ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│              PAYMOZ ENVIA WEBHOOK                            │
│  Status: success/approved  │  Status: failed/cancelled      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│  APROVADO        │         │  CANCELADO        │
│                  │         │                   │
│ • Status: Pago   │         │ • Status: Cancelado│
│ • Processar     │         │ • Registrar Falha │
│ • Notificações  │         │ • Notificar Cliente│
│ • UTMify        │         │                   │
│ • Afiliados     │         │                   │
└──────────────────┘         └──────────────────┘
```

---

## 🎯 **Pontos Importantes**

1. **Transaction ID é único:** Usado como identificador principal do pedido
2. **Webhook é obrigatório:** Status só muda quando PayMoz envia webhook
3. **Evita duplicação:** Sistema verifica se status já é `Aprovado` antes de processar
4. **Logs completos:** Todas as ações são registradas nos logs
5. **Notificações automáticas:** Cliente e vendedor são notificados automaticamente
6. **Tracking completo:** Dados de rastreamento são preservados e enviados

---

## 📚 **Arquivos Relacionados**

- **Rotas de Pagamento:** `routes/pagamento.js`
- **Serviço PayMoz:** `services/paymozService.js`
- **Status de Pagamento:** `routes/paymentStatus.js`
- **Gerenciador de Status:** `utils/paymentStatusManager.js`
- **Modelo de Venda:** `models/Venda.js`

---

## ⚠️ **Tratamento de Erros**

### **Erros Comuns:**

1. **Venda não encontrada:**
   - Verificar se `transaction_id` está correto
   - Verificar se venda foi criada corretamente

2. **Webhook duplicado:**
   - Sistema verifica status anterior
   - Evita processamento duplicado

3. **Falha no processamento:**
   - Erros são registrados nos logs
   - Sistema continua funcionando mesmo com erros parciais

---

## 🔐 **Segurança**

- Webhooks são validados
- Transaction IDs são únicos
- Dados sensíveis não são logados
- Status só pode ser alterado via webhook ou endpoint autorizado

---

**Última atualização:** 2024-01-15  
**Versão:** 1.0

