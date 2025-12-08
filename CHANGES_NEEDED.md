# Mudanças Necessárias em admin-gestao-saques.html

## 1. Modal modalAprovarSaque (função aprovarSaque)

### Adicionar antes do modalContent:
```javascript
// Calcular valores
const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
const taxa = valorSolicitado * 0.05; // 5% de taxa
const valorLiquido = valorSolicitado - taxa; // Valor líquido = valor solicitado - 5%

// Obter ID público (public ID de 6 dígitos)
const publicId = saque.publicId || saque.public_id || saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-');

// Dados de Mpesa
const dadosMpesa = saque.dadosMpesa || saque.dadosCarteiraCompleta?.mpesa || {};
const mpesaNome = dadosMpesa.nomeTitular || 'N/A';
const mpesaContacto = dadosMpesa.contacto || 'N/A';

// Dados de Emola
const dadosEmola = saque.dadosEmola || saque.dadosCarteiraCompleta?.emola || {};
const emolaNome = dadosEmola.nomeTitular || 'N/A';
const emolaContacto = dadosEmola.contacto || 'N/A';

// Método de pagamento
const metodo = saque.metodo || saque.metodoPagamento || saque.metodo_pagamento || 'N/A';

// Data formatada
const dataFormatada = saque.dataSolicitacao || saque.data_solicitacao 
    ? new Date(saque.dataSolicitacao || saque.data_solicitacao).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
    : 'N/A';
```

### Substituir o modal-body completo com o novo design usando cores laranja (#f64c00)

## 2. Função gerarPDF

### Adicionar após `const saque = data.data;`:
```javascript
// Gerar ID público (public ID de 6 dígitos)
const idSaque = saque.publicId || saque.public_id || saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);

// Calcular valores
const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
const taxa = valorSolicitado * 0.05; // 5% de taxa
const valorLiquido = valorSolicitado - taxa; // Valor líquido = valor solicitado - 5%

// Dados de Mpesa e Emola
const dadosMpesa = saque.dadosMpesa || saque.dadosCarteiraCompleta?.mpesa || {};
const dadosEmola = saque.dadosEmola || saque.dadosCarteiraCompleta?.emola || {};
```

### Melhorar o PDF com:
- Cabeçalho laranja (#f64c00)
- Seções organizadas (Informações da Transação, Valores, Dados do Titular, Dados M-Pesa, Dados e-Mola)
- Imagem do logo no rodapé: https://ratixpay.com/assets/images/external/icon_principal.png
- Cores laranja da identidade

