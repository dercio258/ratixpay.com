# Análise do Código de Envio de Produto via WhatsApp

## Visão Geral

O sistema de envio automático de produtos via WhatsApp foi atualizado para usar o **WhatsApp Session Manager** com a sessão específica **"vendas-cliente"**.

## Fluxo de Envio

### 1. Ponto de Entrada
**Arquivo**: `routes/pagamento.js`  
**Função**: `enviarProdutoViaWhatsApp(pedidoInfo, venda, produto)`

### 2. Processo de Envio

#### Passo 1: Validações
- ✅ Verifica se o cliente forneceu WhatsApp (`pedidoInfo.cliente.whatsapp` ou `venda.cliente_whatsapp`)
- ✅ Verifica se o produto tem link de conteúdo
- ✅ Verifica se a sessão "vendas-cliente" está conectada

#### Passo 2: Formatação do Número
- Remove caracteres não numéricos
- Remove zero inicial se presente
- Adiciona código do país (258 para Moçambique) se não tiver
- Retorna formato: `258XXXXXXXXX`

#### Passo 3: Detecção de Tipo de Conteúdo
- **Arquivo/Mídia**: Detecta por extensão (.pdf, .doc, .mp4, .jpg, etc.) ou caminho local
- **URL simples**: URLs sem extensão de arquivo

#### Passo 4: Preparação da Mensagem
```
Oi! {nome do cliente},
estamos a processar tua compra com Pedido número {id do pedido}.
O produto *{nome do produto}* está anexado/disponível.
Caso tenha dúvida contacte para suporte {whatsapp suporte}.
```

#### Passo 5: Envio

**Para Arquivos/Mídia:**
1. Se URL externa → `MessageMedia.fromUrl(linkConteudo)`
2. Se arquivo local → Lê do sistema de arquivos e cria `MessageMedia` com base64
3. Envia via `whatsappSessionManager.sendMessage('vendas-cliente', phone, message, media)`

**Para URLs simples:**
1. Envia mensagem com link: `mensagem + "\n\nLink do produto: {url}"`
2. Envia via `whatsappSessionManager.sendMessage('vendas-cliente', phone, fullMessage)`

## Integração com WhatsApp Session Manager

### Serviço Utilizado
**Arquivo**: `services/whatsappSessionManager.js`  
**Método**: `sendMessage(sessionType, phoneNumber, message, media)`

### Funcionalidades
- ✅ Valida se sessão existe e está conectada
- ✅ Formata número automaticamente para formato WhatsApp
- ✅ Suporta envio de mensagem simples
- ✅ Suporta envio de mídia (MessageMedia ou objeto com URL)
- ✅ Atualiza estatísticas da sessão (mensagens enviadas, última mensagem)

## Requisitos

### 1. Sessão WhatsApp Conectada
A sessão **"vendas-cliente"** deve estar:
- ✅ Criada/inicializada
- ✅ Conectada (QR code escaneado)
- ✅ Pronta para enviar mensagens

**Como configurar:**
1. Acessar `http://localhost:4000/whatsapp-sessions-admin.html`
2. Na sessão "Vendas - Cliente", clicar em "Criar/Inicializar"
3. Escanear o QR code com o WhatsApp desejado
4. Aguardar confirmação de conexão

### 2. Dados Necessários
- ✅ WhatsApp do cliente (`cliente_whatsapp` na tabela `vendas`)
- ✅ Nome do cliente
- ✅ ID do pedido
- ✅ Link de conteúdo do produto
- ✅ Nome do produto

## Fluxo Completo

```
1. Pagamento Aprovado
   ↓
2. processarPagamentoAprovado()
   ↓
3. enviarNotificacoesAutomaticas()
   ↓
4. enviarProdutoViaWhatsApp()
   ↓
5. Verificar sessão "vendas-cliente"
   ↓
6. Formatar número e preparar mensagem
   ↓
7. Detectar tipo (arquivo/URL)
   ↓
8. Enviar via whatsappSessionManager.sendMessage()
   ↓
9. Atualizar estatísticas da sessão
```

## Tratamento de Erros

### Erros Tratados
- ✅ Cliente sem WhatsApp → Retorna `skipped: true` (não é erro)
- ✅ Produto sem link → Retorna `skipped: true` (não é erro)
- ✅ Sessão não conectada → Retorna `skipped: true` com mensagem
- ✅ Número inválido → Retorna erro
- ✅ Arquivo não encontrado → Retorna erro
- ✅ Erro ao enviar → Loga erro mas não falha o pagamento

### Comportamento
- ❌ **NÃO** falha o processo de pagamento se o envio WhatsApp falhar
- ⚠️ Logs detalhados para debugging
- 📊 Estatísticas atualizadas apenas em caso de sucesso

## Mensagens Enviadas

### Formato para Arquivos
```
Oi! {nome},
estamos a processar tua compra com Pedido número {id}.
O produto *{produto}* está anexado.
Caso tenha dúvida contacte para suporte {suporte}.
```
+ Arquivo anexado como mídia

### Formato para URLs
```
Oi! {nome},
estamos a processar tua compra com Pedido número {id}.
O produto *{produto}* está disponível no link abaixo.
Caso tenha dúvida contacte para suporte {suporte}.

Link do produto: {url}
```

## Variáveis de Ambiente

- `SUPPORT_WHATSAPP`: Número de WhatsApp de suporte (padrão: 25884460571)

## Melhorias Implementadas

1. ✅ **Uso de sessão dedicada**: Agora usa sessão "vendas-cliente" em vez de sessão genérica
2. ✅ **Validação de sessão**: Verifica se está conectada antes de tentar enviar
3. ✅ **Suporte a MessageMedia**: Aceita objetos MessageMedia diretamente
4. ✅ **Detecção inteligente**: Identifica automaticamente se é arquivo ou URL
5. ✅ **Estatísticas**: Atualiza contadores de mensagens enviadas
6. ✅ **Logs detalhados**: Facilita debugging e monitoramento

## Próximos Passos (Opcional)

- [ ] Adicionar retry automático em caso de falha
- [ ] Implementar fila de mensagens pendentes
- [ ] Adicionar webhook para notificar admin sobre falhas
- [ ] Métricas de entrega (delivered, read, etc.)

