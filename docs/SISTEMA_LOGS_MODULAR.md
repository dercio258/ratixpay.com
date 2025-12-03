# 📋 Sistema de Logs Modular - RatixPay

## Visão Geral

O sistema de logs modular foi criado para organizar e separar os logs por categoria, facilitando a análise e manutenção do sistema. Cada categoria possui seu próprio arquivo de log.

## Categorias de Logs

### 1. 🔐 Logs de Login (`logs/login.log`)
- Tentativas de login (sucesso/falha)
- Logouts
- Erros de autenticação

### 2. 💳 Logs de Pagamentos (`logs/pagamentos.log`)
- Início de pagamentos
- Pagamentos aprovados
- Pagamentos falhados
- Webhooks de pagamento
- Erros no processamento

### 3. 💰 Logs de Vendas (`logs/vendas.log`)
- Criação de vendas
- Vendas concluídas
- Vendas canceladas
- Erros em vendas

### 4. 📦 Logs de Gestão de Produtos (`logs/produtos.log`)
- Criação de produtos
- Atualização de produtos
- Deleção de produtos
- Erros na gestão

### 5. 💸 Logs de Saques (`logs/saques.log`)
- Solicitações de saque
- Saques aprovados
- Saques rejeitados
- Saques concluídos
- Erros em saques

### 6. ❌ Logs de Erros (`logs/error.log`)
- Erros críticos de todas as categorias

## Como Usar

### Importar o Logger

```javascript
const logger = require('../utils/modularLogger');
```

### Exemplos de Uso

#### Logs de Login

```javascript
// Login bem-sucedido
logger.loginSuccess(userId, email, req.ip, {
    userAgent: req.get('User-Agent')
});

// Login falhou
logger.loginFailure(email, 'Senha incorreta', req.ip);

// Logout
logger.logout(userId, email);

// Erro no login
try {
    // código de login
} catch (error) {
    logger.loginError(error, { email, ip: req.ip });
}
```

#### Logs de Pagamentos

```javascript
// Pagamento iniciado
logger.paymentInitiated(transactionId, amount, 'PayMoz', customerEmail);

// Pagamento aprovado
logger.paymentSuccess(transactionId, amount, 'PayMoz', customerEmail, {
    productId: product.id
});

// Pagamento falhou
logger.paymentFailure(transactionId, amount, 'PayMoz', 'Saldo insuficiente');

// Webhook recebido
logger.paymentWebhook(transactionId, 'approved', 'PayMoz');

// Erro no pagamento
try {
    // processar pagamento
} catch (error) {
    logger.paymentError(error, transactionId);
}
```

#### Logs de Vendas

```javascript
// Venda criada
logger.saleCreated(saleId, productId, customerId, amount);

// Venda concluída
logger.saleCompleted(saleId, productId, customerId, amount, {
    paymentMethod: 'PayMoz'
});

// Venda cancelada
logger.saleCancelled(saleId, 'Cliente solicitou cancelamento');

// Erro na venda
try {
    // processar venda
} catch (error) {
    logger.saleError(error, saleId);
}
```

#### Logs de Gestão de Produtos

```javascript
// Produto criado
logger.productCreated(productId, productName, userId);

// Produto atualizado
logger.productUpdated(productId, productName, userId, {
    price: { old: 100, new: 150 },
    name: { old: 'Produto A', new: 'Produto B' }
});

// Produto deletado
logger.productDeleted(productId, productName, userId);

// Erro na gestão
try {
    // operação com produto
} catch (error) {
    logger.productError(error, productId);
}
```

#### Logs de Saques

```javascript
// Saque solicitado
logger.withdrawalRequested(withdrawalId, userId, amount, 'M-Pesa');

// Saque aprovado
logger.withdrawalApproved(withdrawalId, userId, amount);

// Saque rejeitado
logger.withdrawalRejected(withdrawalId, userId, amount, 'Saldo insuficiente');

// Saque concluído
logger.withdrawalCompleted(withdrawalId, userId, amount, transactionId);

// Erro no saque
try {
    // processar saque
} catch (error) {
    logger.withdrawalError(error, withdrawalId);
}
```

## Estrutura dos Logs

Todos os logs são salvos em formato JSON com a seguinte estrutura:

```json
{
  "timestamp": "2024-01-15 10:30:45",
  "level": "info",
  "message": "✅ Login realizado com sucesso",
  "type": "LOGIN",
  "action": "SUCCESS",
  "userId": "123",
  "email": "user@example.com",
  "ip": "192.168.1.1",
  "category": "LOGIN"
}
```

## Configuração

### Variáveis de Ambiente

- `LOG_LEVEL`: Nível de log (error, warn, info, verbose, debug) - padrão: `info`
- `NODE_ENV`: Ambiente (development, production) - em produção, logs não aparecem no console

### Rotação de Logs

- Tamanho máximo por arquivo: 10MB
- Número máximo de arquivos: 10
- Os logs antigos são automaticamente rotacionados

## Localização dos Arquivos

Todos os logs são salvos no diretório `logs/` na raiz do projeto:

```
logs/
├── login.log
├── pagamentos.log
├── vendas.log
├── produtos.log
├── saques.log
└── error.log
```

## Boas Práticas

1. **Use os métodos específicos**: Sempre use os métodos específicos para cada ação (ex: `loginSuccess` em vez de `loginInfo`)

2. **Adicione contexto**: Sempre que possível, adicione metadados relevantes no parâmetro `meta`

3. **Trate erros**: Sempre use `try/catch` e registre erros com os métodos `*Error`

4. **Não logue informações sensíveis**: Evite logar senhas, tokens completos, dados de cartão de crédito

5. **Use níveis apropriados**: 
   - `info`: Operações normais bem-sucedidas
   - `warn`: Situações que requerem atenção (falhas, rejeições)
   - `error`: Erros que precisam ser investigados

## Migração do Sistema Antigo

Para migrar do sistema antigo de logs:

1. Substitua `require('../config/logging')` por `require('../utils/modularLogger')`
2. Use os métodos específicos do novo sistema
3. Remova logs genéricos e use os métodos categorizados

## Exemplo de Migração

**Antes:**
```javascript
const { log } = require('../config/logging');
log.info('Login realizado', { userId, email });
```

**Depois:**
```javascript
const logger = require('../utils/modularLogger');
logger.loginSuccess(userId, email, req.ip);
```

