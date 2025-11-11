# Sistema de Emails Profissionais RatixPay

## 📧 Visão Geral

O sistema de emails profissionais do RatixPay está organizado em 4 categorias principais, cada uma com seu próprio endereço de email e propósito específico.

## 🏗️ Estrutura do Sistema

### 1. **Vendas** - `vendas@ratixpay.com`
- **Propósito**: Emails relacionados a vendas, conteúdo, saques e confirmações
- **Senha**: `Ewkz qity HASG`
- **Tipos de Email**:
  - `confirmacao_compra` - Confirmação de compra com conteúdo
  - `notificacao_saque` - Notificação de saque para vendedor
  - `confirmacao_venda` - Confirmação de venda para vendedor
  - `recibo_venda` - Recibo de venda para cliente

### 2. **Sistema** - `sistema@ratixpay.com`
- **Propósito**: Emails de códigos, boas-vindas e notificações do sistema
- **Senha**: `Ntbp5b?n` (Zoho Mail - ✅ FUNCIONANDO)
- **Tipos de Email**:
  - `codigo_verificacao` - Códigos de verificação
  - `boas_vindas` - Emails de boas-vindas
  - `notificacao_sistema` - Notificações do sistema
  - `recuperacao_senha` - Recuperação de senha

### 3. **Suporte** - `suporte@ratixpay.com`
- **Propósito**: Emails de reclamações, sugestões e reembolsos
- **Senha**: `HZ64 fgj3 XQv7`
- **Tipos de Email**:
  - `confirmacao_reclamacao` - Confirmação de reclamação
  - `confirmacao_sugestao` - Confirmação de sugestão
  - `confirmacao_reembolso` - Confirmação de reembolso
  - `resposta_suporte` - Resposta do suporte
  - `notificacao_resolucao` - Notificação de resolução

### 4. **Ofertas** - `ofertas@ratixpay.com`
- **Propósito**: Emails de promoções, ofertas e marketing avançado
- **Senha**: `DWxb ZsBh TRu9`
- **Tipos de Email**:
  - `oferta_especial` - Ofertas especiais
  - `promocao_produto` - Promoções de produtos
  - `newsletter` - Newsletter de marketing
  - `campanha_remarketing` - Campanhas de remarketing
  - `oferta_upsell` - Ofertas de upsell

## 🚀 Como Usar

### Enviar Email por Categoria

```javascript
// Exemplo: Enviar confirmação de compra
const result = await emailManagerService.enviarEmail('vendas', 'confirmacao_compra', {
    clienteEmail: 'cliente@email.com',
    clienteNome: 'João Silva',
    produtoNome: 'Curso de Marketing',
    valorPago: 'R$ 199,00',
    linkConteudo: 'https://ratixpay.com/produto/123',
    vendedorNome: 'Maria Santos'
});
```

### Enviar Email de Sistema

```javascript
// Exemplo: Enviar código de verificação
const result = await emailManagerService.enviarEmail('sistema', 'codigo_verificacao', {
    email: 'usuario@email.com',
    nome: 'João Silva',
    codigo: '123456',
    motivo: 'verificação de email',
    tempoExpiracao: 15
});
```

### Enviar Email de Suporte

```javascript
// Exemplo: Enviar confirmação de reclamação
const result = await emailManagerService.enviarEmail('suporte', 'confirmacao_reclamacao', {
    email: 'cliente@email.com',
    nome: 'João Silva',
    numeroTicket: 'TKT-123456',
    assunto: 'Problema com pagamento',
    descricao: 'Não consegui finalizar o pagamento'
});
```

### Enviar Email de Ofertas

```javascript
// Exemplo: Enviar oferta especial
const result = await emailManagerService.enviarEmail('ofertas', 'oferta_especial', {
    email: 'cliente@email.com',
    nome: 'João Silva',
    tituloOferta: 'Black Friday 2024',
    descricao: 'Descontos de até 70%',
    desconto: '70% OFF',
    linkOferta: 'https://ratixpay.com/ofertas',
    dataExpiracao: '31/12/2024'
});
```

## 📡 API Endpoints

### Enviar Email por Categoria
```
POST /api/email/vendas
POST /api/email/sistema
POST /api/email/suporte
POST /api/email/ofertas
```

### Método Genérico
```
POST /api/email/enviar
```

### Verificar Status
```
GET /api/email/status
```

### Obter Estatísticas
```
GET /api/email/estatisticas
```

### Listar Tipos Disponíveis
```
GET /api/email/tipos
```

## 🔧 Configuração

### Variáveis de Ambiente
```env
# Emails de Vendas
VENDAS_EMAIL=vendas@ratixpay.com
VENDAS_PASS=EwkzqityHASG

# Emails de Sistema
SISTEMA_EMAIL=sistema@ratixpay.com
SISTEMA_PASS=LSBiVgw8KN0F

# Emails de Suporte
SUPORTE_EMAIL=suporte@ratixpay.com
SUPORTE_PASS=HZ64fgj3XQv7

# Emails de Ofertas
OFERTAS_EMAIL=ofertas@ratixpay.com
OFERTAS_PASS=DWxbZsBhTRu9
```

## 📊 Monitoramento

### Verificar Status dos Serviços
```javascript
const status = await emailManagerService.verificarStatus();
console.log(status);
```

### Obter Estatísticas
```javascript
const stats = await emailManagerService.obterEstatisticas();
console.log(stats);
```

## 🎨 Templates

Cada categoria possui templates específicos com:
- **Cores da marca** personalizadas por categoria
- **Headers** diferenciados
- **Footers** com informações de contato específicas
- **Responsividade** para dispositivos móveis
- **Acessibilidade** seguindo padrões web

## 🔒 Segurança

- **Autenticação** separada para cada categoria
- **Rate limiting** por categoria
- **Logs** detalhados de envio
- **Validação** de dados de entrada
- **Sanitização** de conteúdo HTML

## 📈 Performance

- **Pool de conexões** para cada transportador
- **Cache** de configurações
- **Retry automático** em caso de falha
- **Monitoramento** de saúde dos serviços

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de autenticação**: Verificar senhas das contas
2. **Rate limit**: Aguardar ou ajustar limites
3. **Template não encontrado**: Verificar tipo de email
4. **Falha de envio**: Verificar logs de erro

### Logs Importantes

```javascript
// Verificar logs de envio
console.log('📧 Email enviado:', result);

// Verificar status dos transportadores
const status = await emailManagerService.verificarStatus();
```

## ⚠️ Configuração Necessária

### 🔐 Credenciais Reais
**IMPORTANTE**: As senhas fornecidas são exemplos e precisam ser substituídas pelas credenciais reais dos emails profissionais.

Para usar o sistema, você deve:
1. Criar as contas de email profissionais no Gmail/Google Workspace
2. Gerar senhas de aplicação para cada conta
3. Atualizar as credenciais no arquivo `services/professionalEmailService.js`

### 📧 Variáveis de Ambiente
Adicione ao seu arquivo `.env`:
```env
# Emails Profissionais RatixPay
VENDAS_EMAIL=vendas@ratixpay.com
VENDAS_PASS=sua_senha_real_aqui
SISTEMA_EMAIL=sistema@ratixpay.com
SISTEMA_PASS=sua_senha_real_aqui
SUPORTE_EMAIL=suporte@ratixpay.com
SUPORTE_PASS=sua_senha_real_aqui
OFERTAS_EMAIL=ofertas@ratixpay.com
OFERTAS_PASS=sua_senha_real_aqui
```

### 📝 Templates HTML Necessários
Crie os seguintes templates na pasta `templates/`:
- `email-confirmacao-compra.html`
- `email-codigo-verificacao-simples.html`
- `email-boas-vindas.html`
- `email-confirmacao-reclamacao.html`
- `email-promocao.html`

## 📞 Suporte

Para dúvidas sobre o sistema de emails profissionais:
- **Email**: suporte@ratixpay.com
- **WhatsApp**: +258 867 792 543
- **Documentação**: Este arquivo
