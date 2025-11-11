# 📱 Serviço de Envio Automático de Produtos via WhatsApp

## Descrição

Este serviço envia automaticamente produtos comprados para clientes via WhatsApp após a confirmação do pagamento.

## Funcionalidades

✅ **Detecção automática de WhatsApp do cliente** - Verifica se o cliente forneceu WhatsApp no checkout  
✅ **Envio de arquivos como mídia** - Para arquivos locais ou URLs, baixa e envia como anexo  
✅ **Envio de URLs** - Para links externos, envia apenas a URL  
✅ **Mensagem formatada** - Inclui informações do pedido e contato de suporte  
✅ **Integração automática** - É chamado automaticamente após pagamento aprovado  

## Como Funciona

### 1. Durante o Checkout
O cliente informa seu WhatsApp no campo opcional:
```html
<input type="tel" id="whatsapp" name="whatsapp" placeholder="84xxxxxxx">
```

### 2. Após Pagamento Aprovado
O sistema automaticamente:
1. Verifica se o cliente forneceu WhatsApp
2. Verifica se o produto tem link de conteúdo
3. Detecta se é arquivo ou URL
4. Envia produto via WhatsApp

### 3. Tipos de Envio

#### **Arquivo Local/Upload**
- Baixa/prepara o arquivo
- Envia como mídia (PDF, DOC, ZIP, MP4, etc.)
- Mensagem formatada:
```
Oi! {nome do cliente}, estamos a processar tua compra com Pedido número {id do pedido}.

O produto {nome do produto} está anexado.

Caso tenha dúvida contacte para suporte {whatsapp 884460571}.
```

#### **URL Externa**
- Envia apenas a URL do produto
- Sem mensagem adicional

## Configuração

### Variáveis de Ambiente

Adicione ao `.env`:
```env
SUPPORT_WHATSAPP=25884460571  # WhatsApp de suporte (padrão: 25884460571)
AUTO_INIT_WHATSAPP_DELIVERY=true  # Inicializar automaticamente (padrão: true)
```

### Instalação

O serviço requer `whatsapp-web.js` (já adicionado ao `package.json`):
```bash
npm install whatsapp-web.js
```

### Inicialização

O serviço inicializa automaticamente quando o servidor é iniciado.  
Para autenticar, acesse o QR code via API (se necessário).

## Estrutura do Código

### Arquivos

- **`services/whatsappProductDelivery.js`** - Serviço principal de envio
- **`routes/pagamento.js`** - Integração no fluxo de pagamento

### Função Principal

```javascript
async sendProductToClient(orderData)
```

**Parâmetros:**
- `whatsappCliente` (string) - WhatsApp do cliente
- `nomeCliente` (string) - Nome do cliente
- `idPedido` (string) - ID do pedido
- `linkConteudo` (string) - Link do conteúdo (arquivo ou URL)
- `nomeProduto` (string) - Nome do produto

**Retorno:**
```javascript
{
    success: true/false,
    message: string,
    method: 'media' | 'url',
    phone: string,
    skipped: true/false  // Se foi pulado (sem WhatsApp ou sem conteúdo)
}
```

## Fluxo de Integração

```
Checkout → Pagamento → Aprovação → processarPagamentoAprovado()
                                           ↓
                              enviarNotificacoesAutomaticas()
                                           ↓
                              enviarProdutoViaWhatsApp()
                                           ↓
                              whatsappProductDelivery.sendProductToClient()
```

## Formatação de Número

O serviço automaticamente formata números para o padrão WhatsApp:
- Remove caracteres não numéricos
- Adiciona código do país (258 para Moçambique)
- Remove zeros iniciais

**Exemplos:**
- `841234567` → `258841234567`
- `0841234567` → `258841234567`
- `258841234567` → `258841234567` (já formatado)

## Tipos de Arquivo Suportados

O serviço detecta automaticamente o tipo MIME:
- **Documentos**: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX
- **Arquivos**: ZIP, RAR
- **Vídeos**: MP4, AVI
- **Áudios**: MP3
- **Imagens**: JPG, JPEG, PNG, GIF

## Tratamento de Erros

- ❌ **Sem WhatsApp**: Pula envio (não é erro)
- ❌ **Sem conteúdo**: Pula envio (não é erro)
- ❌ **Erro de conexão**: Loga erro mas não falha o pagamento
- ❌ **Erro ao baixar arquivo**: Tenta fallback ou loga erro

## Logs

O serviço gera logs detalhados:
- `📱` - Inicialização e status
- `📤` - Envio de mensagens
- `✅` - Sucesso
- `⚠️` - Avisos (pulados)
- `❌` - Erros

## Exemplo de Uso Manual

```javascript
const whatsappProductDelivery = require('./services/whatsappProductDelivery');

const orderData = {
    whatsappCliente: '258841234567',
    nomeCliente: 'João Silva',
    idPedido: 'TX123456',
    linkConteudo: '/uploads/conteudo/produto.pdf',
    nomeProduto: 'Curso Completo de JavaScript'
};

const result = await whatsappProductDelivery.sendProductToClient(orderData);
console.log(result);
```

## Notas Importantes

⚠️ **Requer autenticação WhatsApp**: O serviço precisa estar conectado ao WhatsApp Web  
⚠️ **Arquivos temporários**: Arquivos baixados são removidos após 5 segundos  
⚠️ **Não bloqueia pagamento**: Erros no envio WhatsApp não falham o pagamento  
⚠️ **Rate Limiting**: WhatsApp pode limitar envios muito frequentes

## Suporte

Em caso de dúvidas sobre o envio, o cliente pode contactar:
**WhatsApp: 25884460571**

