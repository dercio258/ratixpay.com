# Meta Pixel Unificado - RatixPay

## 📋 Visão Geral

O Meta Pixel Unificado é um sistema centralizado e otimizado para rastreamento de eventos do Facebook/Meta Pixel no RatixPay. Ele substitui todos os scripts antigos e conflitantes por uma solução única, robusta e fácil de configurar.

## 🚀 Características Principais

- ✅ **Sistema Unificado**: Um único script para todas as páginas
- ✅ **Configuração Dinâmica**: Interface visual para gerenciar integrações
- ✅ **Deduplicação Automática**: Evita eventos duplicados
- ✅ **Enhanced Ecommerce**: Dados completos de transação
- ✅ **Debug Avançado**: Logs detalhados para troubleshooting
- ✅ **Múltiplos Pixels**: Suporte a vários pixels simultaneamente
- ✅ **Testes Automatizados**: Validação de configurações

## 📁 Arquivos do Sistema

### Arquivos Principais
- `public/js/meta-pixel-unified.js` - Sistema principal de rastreamento
- `public/js/meta-pixel-config.js` - Sistema de configuração
- `public/meta-pixel-advanced.html` - Interface de configuração avançada

### Arquivos Removidos (Obsoletos)
- ❌ `public/js/meta-pixel.js` - Script básico antigo
- ❌ `public/js/meta-pixel-optimized.js` - Versão otimizada antiga
- ❌ `public/js/pixel-dynamic.js` - Script dinâmico antigo
- ❌ `public/js/integracoes-dinamicas.js` - Integrações antigas
- ❌ `public/js/integracoes-otimizado.js` - Sistema antigo
- ❌ `public/js/integracoes-corrigido.js` - Versão corrigida antiga
- ❌ `public/js/integracoes.js` - Sistema original
- ❌ `public/meta-pixel.html` - Interface antiga

## 🔧 Configuração Inicial

### 1. Acessar Interface de Configuração
```
http://localhost:3000/meta-pixel-advanced.html
```

### 2. Configurar Pixel Principal
- Insira seu Pixel ID real (substitua `123456789012345`)
- Ative/desative modo debug conforme necessário
- Configure rastreamento automático

### 3. Adicionar Integrações
- Selecione o produto para rastrear
- Escolha os eventos desejados:
  - `PageView` - Visualização de página
  - `ViewContent` - Visualização de produto
  - `AddToCart` - Adição ao carrinho
  - `InitiateCheckout` - Início do checkout
  - `Purchase` - Compra concluída
  - `Lead` - Geração de lead

## 📊 Eventos Rastreados

### Página de Checkout (`/checkout.html`)
```javascript
// Eventos automáticos:
- PageView
- ViewContent (produto atual)
- InitiateCheckout (ao carregar página)
- AddToCart (Order Bump selecionado)
```

### Página de Sucesso (`/payment-success.html`)
```javascript
// Eventos automáticos:
- PageView
- Purchase (com transaction_id e valor)
```

### Outras Páginas
```javascript
// Eventos automáticos:
- PageView (todas as páginas)
```

## 🎯 Dados Enviados

### Evento Purchase
```javascript
{
    content_name: "Nome do Produto",
    content_ids: ["produto-123"],
    content_type: "product",
    value: 150.00,
    currency: "MZN",
    transaction_id: "e2_1761605223288"
}
```

### Evento InitiateCheckout
```javascript
{
    content_name: "Nome do Produto",
    content_ids: ["produto-123"],
    content_type: "product",
    value: 150.00,
    currency: "MZN",
    num_items: 2
}
```

## 🔍 Debugging e Monitoramento

### Console do Navegador
```javascript
// Verificar status do sistema
console.log(window.MetaPixelUnified.getStatus());

// Verificar configuração
console.log(window.MetaPixelConfig.getStats());

// Disparar evento customizado
window.MetaPixelUnified.trackCustomEvent('CustomEvent', {
    custom_parameter: 'value'
});
```

### Logs de Debug
Quando o modo debug está ativo, todos os eventos são logados no console:
```
📊 Meta Pixel [123456789012345]: Purchase {content_name: "Produto", value: 150}
```

## 🧪 Testes e Validação

### 1. Teste de Configuração
- Acesse a aba "Testes" na interface
- Execute validação automática
- Verifique se todos os pixels estão funcionando

### 2. Teste de Eventos
- Navegue pelas páginas do sistema
- Verifique logs no console
- Confirme eventos no Facebook Pixel Helper

### 3. Teste de Conversão
- Complete uma compra de teste
- Verifique evento Purchase no Facebook Ads Manager
- Confirme dados de conversão

## 📈 Otimizações Implementadas

### Performance
- ✅ Carregamento único do script Facebook
- ✅ Deduplicação de eventos
- ✅ Cache de configurações
- ✅ Lazy loading de integrações

### Precisão
- ✅ Dados completos de transação
- ✅ Validação de valores monetários
- ✅ Rastreamento de Order Bump
- ✅ Transaction IDs únicos

### Manutenibilidade
- ✅ Código modular e documentado
- ✅ Interface visual de configuração
- ✅ Sistema de testes automatizados
- ✅ Logs estruturados

## 🚨 Troubleshooting

### Problemas Comuns

#### 1. Pixel não carrega
```javascript
// Verificar se o script está carregado
console.log(typeof window.fbq); // Deve retornar "function"
```

#### 2. Eventos não aparecem
```javascript
// Verificar configuração
console.log(window.MetaPixelConfig.config.integrations);
```

#### 3. Dados incorretos
```javascript
// Verificar dados do produto
console.log(window.currentProduct);
```

### Soluções

1. **Limpar Cache**: Ctrl+F5 para recarregar scripts
2. **Verificar Console**: Procurar por erros JavaScript
3. **Validar Configuração**: Usar interface de testes
4. **Reiniciar Servidor**: Se necessário

## 🔄 Migração do Sistema Antigo

### Passos Realizados
1. ✅ Identificação de arquivos obsoletos
2. ✅ Criação do sistema unificado
3. ✅ Atualização de todas as referências
4. ✅ Remoção de arquivos antigos
5. ✅ Testes de funcionamento

### Compatibilidade
- ✅ Mantém compatibilidade com localStorage existente
- ✅ Suporta configurações antigas
- ✅ Migração automática de dados

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar logs do console
2. Usar interface de testes
3. Consultar esta documentação
4. Verificar configuração do Facebook Ads Manager

---

**Versão**: 2.0  
**Última Atualização**: Dezembro 2024  
**Status**: ✅ Funcional e Testado
