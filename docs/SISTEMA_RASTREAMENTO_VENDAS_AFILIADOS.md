# Sistema de Rastreamento de Vendas de Afiliados

## Visão Geral

O sistema de rastreamento de vendas permite que afiliados recebam comissões automaticamente quando uma venda é realizada através de seus links. O sistema integra com o rastreamento de cliques válidos para fornecer uma visão completa do desempenho do afiliado.

## Funcionalidades

### 1. Rastreamento Automático de Vendas
- Quando uma venda é realizada através de um link de afiliado, o sistema automaticamente:
  - Identifica o afiliado pelo código na URL (`?ref=CODIGO`)
  - Calcula a comissão baseada na porcentagem configurada
  - Cria registro de venda do afiliado
  - Credita a comissão no saldo do afiliado
  - Atualiza estatísticas (total de vendas, total de comissões)
  - Registra conversão no link tracking específico

### 2. Cálculo de Comissão
- A comissão é calculada automaticamente: `valor_venda * comissao_percentual / 100`
- A comissão é creditada imediatamente no saldo disponível do afiliado
- O status inicial da venda de afiliado é `pendente`

### 3. Atualização de Status
- Quando o pagamento é aprovado: status muda para `pago`
- Quando o pagamento é cancelado: status muda para `cancelado` e comissão é revertida
- A reversão de comissão ocorre automaticamente quando uma venda é cancelada

### 4. Rastreamento de Conversões
- Cada venda registra uma conversão no link tracking específico do produto
- Se o link tracking específico não existir, incrementa conversões em todos os links do afiliado
- Conversões são usadas para calcular taxa de conversão (conversões / cliques)

## Estrutura do Banco de Dados

### Tabela `venda_afiliados`
```sql
- id (UUID): ID único da venda de afiliado
- afiliado_id (UUID): Referência ao afiliado
- venda_id (UUID): Referência à venda
- valor_venda (DECIMAL): Valor total da venda
- comissao_percentual (DECIMAL): Porcentagem de comissão aplicada
- valor_comissao (DECIMAL): Valor da comissão calculada
- status (ENUM): pendente, pago, cancelado
- data_pagamento (DATE): Data do pagamento (quando aprovado)
```

### Relacionamentos
- `VendaAfiliado` pertence a `Afiliado`
- `VendaAfiliado` pertence a `Venda`
- `Venda` tem campo `afiliado_ref` para armazenar código do afiliado

## Serviço de Vendas de Afiliados

### `services/afiliadoVendaService.js`

#### Métodos Principais

**1. `processarVendaAfiliado(venda, produto, valorTotal, transactionId, codigoAfiliado)`**
- Processa uma venda de afiliado
- Calcula e credita comissão
- Atualiza estatísticas
- Registra conversão no link tracking
- Retorna resultado do processamento

**2. `atualizarStatusVenda(vendaId, status)`**
- Atualiza status da venda de afiliado
- Se aprovado: garante que comissão está creditada
- Se cancelado: reverte comissão automaticamente

**3. `obterEstatisticasVendas(afiliadoId, periodo)`**
- Retorna estatísticas de vendas do afiliado
- Períodos disponíveis: 7d, 30d, 90d, 1ano
- Inclui: total de vendas, vendas aprovadas, total de comissões, taxa de conversão

## Fluxo de Processamento

### 1. Usuário Acessa Link de Afiliado
```
https://ratixpay.com/checkout.html?produto=PROD123&ref=AFILIADO123
```

### 2. Usuário Preenche Formulário e Clica em "Pagar"
- Frontend captura código de afiliado da URL
- Envia no body da requisição de pagamento como `ref` ou `afiliadoCodigo`

### 3. Backend Processa Pagamento
- Captura código de afiliado do `req.body`
- Cria venda normalmente
- Quando pagamento é aprovado, chama `processarTrackingAfiliados()`

### 4. Processamento de Tracking
```javascript
await processarTrackingAfiliados(venda, produto, valorTotal, transactionId, refAfiliado);
```

### 5. Serviço Processa Venda de Afiliado
```javascript
const resultado = await afiliadoVendaService.processarVendaAfiliado(
    venda,
    produto,
    valorTotal,
    transactionId,
    codigoAfiliado
);
```

### 6. Comissão Creditada
- Comissão é creditada imediatamente no saldo do afiliado
- Estatísticas são atualizadas
- Conversão é registrada no link tracking

## Rotas da API

### 1. Processamento Automático
- **Endpoint**: `POST /api/pagar`
- **Parâmetros**: `ref` ou `afiliadoCodigo` no body
- **Ação**: Processa automaticamente quando venda é aprovada

### 2. Atualizar Status (Admin)
- **Endpoint**: `PUT /api/afiliados/venda/:vendaId/status`
- **Autenticação**: Requer token de admin
- **Body**: `{ "status": "pago" | "cancelado" | "pendente" }`
- **Ação**: Atualiza status e reverte comissão se cancelado

### 3. Estatísticas de Vendas (Afiliado)
- **Endpoint**: `GET /api/afiliados/minhas-vendas-estatisticas?periodo=30d`
- **Autenticação**: Requer token de afiliado
- **Parâmetros**: `periodo` (7d, 30d, 90d, 1ano)
- **Retorno**: Estatísticas completas de vendas

### 4. Listar Vendas (Afiliado)
- **Endpoint**: `GET /api/afiliados/minhas-vendas`
- **Autenticação**: Requer token de afiliado
- **Retorno**: Lista de todas as vendas do afiliado

## Integração com Cliques Válidos

O sistema de vendas integra com o sistema de cliques válidos:

1. **Clique Válido Registrado**: Quando usuário clica em "Pagar"
2. **Venda Processada**: Quando pagamento é aprovado
3. **Conversão Marcada**: Link tracking específico recebe incremento de conversão
4. **Clique Válido Associado**: Sistema tenta associar clique válido à venda

## Prevenção de Duplicatas

- Sistema verifica se já existe registro de venda para o mesmo afiliado e venda
- Evita crédito duplicado de comissão
- Retorna registro existente se já processado

## Reversão de Comissão

Quando uma venda é cancelada:
- Comissão é deduzida do saldo disponível
- Total de comissões é decrementado
- Total de vendas é decrementado
- Status da venda de afiliado muda para `cancelado`

## Notificações

- Email enviado ao afiliado quando venda é processada
- Inclui detalhes da venda e comissão
- Mostra saldo atualizado

## Exemplo de Resposta

### Processamento de Venda
```json
{
  "processado": true,
  "vendaAfiliado": {
    "id": "uuid",
    "afiliado_id": "uuid",
    "venda_id": "uuid",
    "valor_venda": 100.00,
    "comissao_percentual": 15.00,
    "valor_comissao": 15.00,
    "status": "pendente"
  },
  "afiliado": {
    "id": "uuid",
    "nome": "João Silva",
    "codigo": "AFILIADO123"
  },
  "comissao": 15.00,
  "linkTracking": {
    "id": "uuid",
    "produto_id": "uuid"
  }
}
```

### Estatísticas de Vendas
```json
{
  "success": true,
  "data": {
    "periodo": "30d",
    "totalVendas": 25,
    "vendasAprovadas": 20,
    "vendasPendentes": 3,
    "vendasCanceladas": 2,
    "totalComissoes": 300.00,
    "totalValorVendas": 2000.00,
    "taxaConversao": "80.00",
    "vendas": [...]
  }
}
```

## Notas Importantes

1. **Comissão Imediata**: A comissão é creditada imediatamente quando a venda é processada, não apenas quando o pagamento é aprovado
2. **Status Inicial**: Todas as vendas começam com status `pendente`
3. **Reversão Automática**: Se uma venda for cancelada, a comissão é revertida automaticamente
4. **Link Tracking Específico**: Sistema prioriza link tracking específico do produto, mas usa fallback se não encontrar
5. **Integração Completa**: Sistema integra com cliques válidos, link tracking e estatísticas do afiliado

