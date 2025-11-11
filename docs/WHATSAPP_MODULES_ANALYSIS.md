# Análise dos Módulos WhatsApp - RatixPay

## Visão Geral

O sistema possui **4 serviços principais** e **1 sistema de gerenciamento de múltiplas sessões** para WhatsApp:

### Estrutura de Módulos

```
whatsapp/
├── services/
│   ├── whatsappSessionManager.js      ← 🆕 Sistema de múltiplas sessões
│   ├── whatsappProductDelivery.js     ← Envio de produtos (legado)
│   ├── whatsappService.js             ← Serviço principal (legado)
│   └── whatsappBotService.js          ← Bot simplificado (legado)
├── routes/
│   └── whatsapp.js                    ← Rotas da API
├── models/
│   └── WhatsappMessage.js             ← Modelo de mensagens
└── public/
    └── whatsapp-sessions-admin.html   ← Interface admin 🆕
```

---

## 1. WhatsApp Session Manager 🆕 (Recomendado)

**Arquivo**: `services/whatsappSessionManager.js`

### Propósito
Sistema moderno de gerenciamento de **múltiplas sessões WhatsApp** separadas por tipo de uso.

### Sessões Disponíveis
- ✅ **vendas-cliente**: Notificações para clientes sobre compras
- ✅ **vendas-vendedor**: Notificações para vendedores sobre vendas  
- ✅ **ofertas**: Envio de ofertas promocionais
- ✅ **sistema**: Notificações do sistema
- ✅ **suporte**: Comunicação de suporte
- ✅ **afiliados**: Notificações para afiliados

### Funcionalidades
- ✅ Criação/inicialização de sessões
- ✅ Geração de QR codes por sessão
- ✅ Envio de mensagens por sessão específica
- ✅ Suporte a mídia (MessageMedia)
- ✅ Resetar/apagar sessões
- ✅ Estatísticas por sessão
- ✅ Tratamento de erros robusto

### Tecnologia
- `whatsapp-web.js` com `LocalAuth` separado por sessão
- Puppeteer para controle do navegador

### Status
🟢 **ATIVO** - Sistema principal para envio de produtos

---

## 2. WhatsApp Product Delivery (Legado)

**Arquivo**: `services/whatsappProductDelivery.js`

### Propósito
Serviço legado para envio automático de produtos após pagamento.

### Estado Atual
- ⚠️ Usa sessão única `'product-delivery'`
- ⚠️ Inicialização automática se `AUTO_INIT_WHATSAPP_DELIVERY !== 'false'`
- ⚠️ Sistema antigo, sendo substituído pelo Session Manager

### Funcionalidades
- Envia produtos como mídia ou URL
- Detecta tipo de conteúdo automaticamente
- Formata números para Moçambique (258)

### Migração
🔄 **Em processo**: `routes/pagamento.js` já foi atualizado para usar `whatsappSessionManager` com sessão "vendas-cliente"

---

## 3. WhatsApp Service (Legado)

**Arquivo**: `services/whatsappService.js`

### Propósito
Serviço principal que atua como wrapper sobre `whatsappBotService`.

### Funcionalidades
- ✅ Formatação de números WhatsApp
- ✅ FAQ automático
- ✅ Envio de códigos de verificação
- ✅ Envio de confirmações de compra
- ✅ Envio de conteúdo manual

### Estado
- Usa `whatsappBotService` internamente
- Controlado por variável `WHATSAPP_AUTO_INIT`
- Alguns métodos simulam envio se não conectado

---

## 4. WhatsApp Bot Service (Legado)

**Arquivo**: `services/whatsappBotService.js`

### Propósito
Bot simplificado sem Baileys - versão antiga.

### Estado
- ⚠️ Versão simplificada (sem Baileys)
- ⚠️ Muitos métodos simulam envio
- ⚠️ Sistema legado, sendo substituído

### Funcionalidades
- Geração de QR code (simulado)
- Status de conexão
- Envio de mensagens (simulado)

---

## 5. Rotas WhatsApp

**Arquivo**: `routes/whatsapp.js`

### Endpoints Disponíveis

#### Legado (whatsappBotService)
- `GET /api/whatsapp/status` - Status do bot
- `POST /api/whatsapp/restart` - Reiniciar bot
- `POST /api/whatsapp/send-message` - Enviar mensagem
- `GET /api/whatsapp/qrcode` - Obter QR code

#### 🆕 Novo (whatsappSessionManager)
- `GET /api/whatsapp/sessions` - Listar todas as sessões
- `GET /api/whatsapp/sessions/:sessionType` - Status de uma sessão
- `POST /api/whatsapp/sessions/:sessionType` - Criar/inicializar sessão
- `GET /api/whatsapp/sessions/:sessionType/qrcode` - Obter QR code
- `POST /api/whatsapp/sessions/:sessionType/reset` - Resetar sessão
- `DELETE /api/whatsapp/sessions/:sessionType` - Apagar sessão
- `POST /api/whatsapp/sessions/:sessionType/test` - Testar sessão
- `POST /api/whatsapp/sessions/:sessionType/send` - Enviar mensagem

---

## 6. Modelo WhatsappMessage

**Arquivo**: `models/WhatsappMessage.js`

### Propósito
Armazena histórico de mensagens enviadas no banco de dados.

### Funcionalidades
- Criar registro de mensagem
- Buscar mensagens por venda
- Buscar mensagens por tipo
- Estatísticas de mensagens

---

## Integrações Atuais

### 1. Envio Automático de Produtos
**Arquivo**: `routes/pagamento.js` → `enviarProdutoViaWhatsApp()`

**Sessão Usada**: `vendas-cliente`

**Fluxo**:
```
Pagamento Aprovado
  ↓
enviarNotificacoesAutomaticas()
  ↓
enviarProdutoViaWhatsApp()
  ↓
whatsappSessionManager.sendMessage('vendas-cliente', ...)
```

### 2. Serviços que Usam WhatsApp
- `services/vendaNotificationService.js` - Notificações de venda
- `services/saqueNotificationService.js` - Notificações de saque
- `utils/emailService.js` - Serviço de email (possíveis integrações)

---

## Recomendações

### ✅ Usar
- **whatsappSessionManager.js** - Sistema moderno de múltiplas sessões
- **routes/whatsapp.js** - Rotas da API (atualizadas)

### ⚠️ Manter (compatibilidade)
- **whatsappService.js** - Alguns serviços ainda usam
- **whatsappBotService.js** - Interface admin antiga pode usar

### ❌ Descontinuar (futuro)
- **whatsappProductDelivery.js** - Substituído por Session Manager
- Métodos legados que simulam envio

---

## Próximos Passos Sugeridos

1. ✅ **Migrar envio de produtos** → Usando Session Manager ✅
2. ⏳ **Migrar notificações de venda** → Usar sessão "vendas-vendedor"
3. ⏳ **Migrar notificações de saque** → Usar sessão "sistema"
4. ⏳ **Migrar ofertas** → Usar sessão "ofertas"
5. ⏳ **Migrar suporte** → Usar sessão "suporte"
6. ⏳ **Migrar afiliados** → Usar sessão "afiliados"

---

## Conclusão

O sistema está em **transição** de módulos legados para o novo **WhatsApp Session Manager**. O envio de produtos já foi migrado. Os demais serviços podem ser migrados gradualmente conforme necessário.

**Sistema Ativo**: `whatsappSessionManager` com sessão "vendas-cliente" para envio automático de produtos.


