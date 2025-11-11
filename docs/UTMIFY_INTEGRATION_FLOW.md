# 🔄 Fluxo de Integração UTMify - Payment Success

## 📋 Resumo do Fluxo

O `payment-success.html` captura os dados de rastreamento e envia corretamente para o UTMify seguindo este fluxo:

### 1. **Carregamento dos Dados da Venda**
```
payment-success.html → GET /api/success/venda/:vendaId
```
- Busca todos os dados da venda, incluindo `tracking_data` (parâmetros UTM)
- O endpoint retorna `tracking_data` no objeto `data.tracking_data`

### 2. **Extração dos Parâmetros UTM**
```javascript
// Em payment-success.html
if (orderData && orderData.tracking_data) {
    // Usa tracking_data da venda (prioridade)
    trackingParams = {
        utm_source: orderData.tracking_data.utm_source,
        utm_medium: orderData.tracking_data.utm_medium,
        utm_campaign: orderData.tracking_data.utm_campaign,
        utm_content: orderData.tracking_data.utm_content,
        utm_term: orderData.tracking_data.utm_term,
        src: orderData.tracking_data.src,
        sck: orderData.tracking_data.sck
    };
} else {
    // Fallback: captura da URL
    // ...
}
```

### 3. **Envio para o Backend**
```javascript
// POST /api/pagamento/venda/:vendaId/utmify
fetch(`${API_BASE}/pagamento/venda/${vendaId}/utmify`, {
    method: 'POST',
    body: JSON.stringify({
        produtoId: produtoId,
        trackingParams: trackingParams
    })
});
```

### 4. **Processamento no Backend**
```javascript
// routes/pagamento.js
// 1. Busca a venda
const venda = await Venda.findByPk(vendaId);

// 2. Usa tracking_data da venda (prioridade) ou parâmetros da requisição
const trackingDataFromVenda = venda.tracking_data || {};
const trackingParamsFinal = {
    utm_source: trackingParams.utm_source || trackingDataFromVenda.utm_source || null,
    // ... outros parâmetros
};

// 3. Envia para UTMify
await utmifyService.enviarVenda(venda, produto, cliente, trackingParamsFinal);
```

### 5. **Envio para UTMify API**
```javascript
// services/utmifyService.js
// Usa o token dinâmico do produto (utmfy_api_key)
const utmifyToken = produto.utmfy_api_key;

fetch('https://api.utmify.com.br/api-credentials/orders', {
    method: 'POST',
    headers: {
        'x-api-token': utmifyToken, // Token dinâmico do produto
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(body) // Formato oficial da UTMify
});
```

## ✅ Verificações Implementadas

### Logs no Frontend (payment-success.html)
- ✅ Log quando `tracking_data` é recebido do endpoint
- ✅ Log quando `orderData` é passado para `enviarVendaParaUTMify`
- ✅ Log detalhado dos parâmetros UTM extraídos
- ✅ Aviso se `tracking_data` não estiver disponível

### Logs no Backend (routes/pagamento.js)
- ✅ Log quando `tracking_data` é incluído na resposta do endpoint `/success/venda/:vendaId`
- ✅ Log dos parâmetros finais antes de enviar para UTMify
- ✅ Comparação entre parâmetros da requisição e da venda

### Logs no Serviço (utmifyService.js)
- ✅ Log detalhado do envio para UTMify
- ✅ Log do token usado (parcialmente mascarado)
- ✅ Log de sucesso ou erro

## 🔍 Como Verificar se Está Funcionando

### 1. Console do Navegador (payment-success.html)
Procure por:
```
✅ Dados carregados do endpoint /api/success/venda
📊 Tracking Data recebido: {...}
🚀 UTMIFY: Chamando enviarVendaParaUTMify com dados
✅ UTMIFY: Parâmetros UTM carregados da venda (tracking_data)
✅ UTMIFY: Venda enviada com SUCESSO!
```

### 2. Terminal do Servidor (Backend)
Procure por:
```
📊 Tracking Data incluído na resposta: {...}
🚀 UTMIFY: Enviando venda para UTMify
📦 Venda ID: ...
📦 Produto ID: ...
🔑 Token UTMify: ...
✅ UTMIFY: Venda enviada com SUCESSO!
```

## 🎯 Pontos Importantes

1. **Token Dinâmico**: O token UTMify é carregado dinamicamente do produto (`utmfy_api_key`)
2. **Prioridade de Dados**: 
   - 1º: `tracking_data` da venda (banco de dados)
   - 2º: Parâmetros da URL (fallback)
3. **Validação**: Verifica se produto tem token e se está ativo antes de enviar
4. **Formato Oficial**: Segue exatamente o formato da API oficial da UTMify

## 📝 Estrutura do tracking_data

```json
{
  "utm_source": "FB",
  "utm_medium": "CONJUNTO_2|498046723566488",
  "utm_campaign": "CAMPANHA_2|413591587909524",
  "utm_content": "ANUNCIO_2|504346051220592",
  "utm_term": "Instagram_Feed",
  "src": null,
  "sck": null
}
```

