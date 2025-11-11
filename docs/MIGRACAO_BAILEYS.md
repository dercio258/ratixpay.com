# Guia de Migração: whatsapp-web.js → Baileys

## Visão Geral

Este guia explica como migrar do `whatsapp-web.js` para `Baileys` no RatixPay.

## Por que Migrar?

- ✅ **Múltiplas sessões eficientes**: Baileys gerencia múltiplas sessões com muito menos recursos
- ✅ **Sem Puppeteer**: Não precisa de navegador Chromium (~300MB por sessão)
- ✅ **Mais rápido**: Comunicação direta via WebSocket
- ✅ **Mais estável**: Protocolo nativo do WhatsApp
- ✅ **Menor consumo**: 10 sessões ≈ 300MB vs 3GB com whatsapp-web.js

## Status da Migração

### ✅ Concluído
- [x] Instalação do Baileys
- [x] Criação do `whatsappBaileysManager.js`
- [x] Sistema de feature flag (`whatsappManager.js`)
- [x] Compatibilidade com API existente

### ⏳ Em Progresso
- [ ] Testes em ambiente de desenvolvimento
- [ ] Migração gradual de serviços
- [ ] Documentação de uso

### 📋 Planejado
- [ ] Remoção do whatsapp-web.js
- [ ] Remoção do Puppeteer (opcional)

---

## Como Ativar Baileys

### 1. Variável de Ambiente

Adicione no seu `.env`:

```env
# Ativar Baileys (true) ou manter whatsapp-web.js (false)
USE_BAILEYS=true
```

### 2. Reiniciar o Servidor

```bash
npm restart
```

### 3. Verificar Logs

Você deve ver:
```
📱 Usando WhatsApp Baileys Manager
📱 Inicializando WhatsApp Baileys Manager (Múltiplas Sessões)...
```

---

## Estrutura de Sessões

### Sessões Disponíveis

Com Baileys, você pode criar múltiplas sessões:

- `default` - Sessão padrão
- `vendas-cliente` - Notificações para clientes
- `vendas-vendedor` - Notificações para vendedores
- `ofertas` - Envio de ofertas promocionais
- `sistema` - Notificações do sistema
- `suporte` - Comunicação de suporte
- `afiliados` - Notificações para afiliados

### Exemplo de Uso

```javascript
const whatsappManager = require('./services/whatsappManager');

// Inicializar sessão específica
await whatsappManager.initialize('vendas-cliente');

// Enviar mensagem usando sessão específica
await whatsappManager.sendMessage(
    '258867792543',
    'Sua compra foi confirmada!',
    null,
    'vendas-cliente'
);

// Ver status de todas as sessões
const allStatus = whatsappManager.getAllSessionsStatus();
```

---

## Migração Gradual

### Fase 1: Teste (Recomendado)

1. **Ativar Baileys em desenvolvimento**
   ```env
   USE_BAILEYS=true
   ```

2. **Testar uma sessão**
   - Conectar sessão `default`
   - Enviar mensagens de teste
   - Verificar logs e estabilidade

3. **Monitorar por 24-48 horas**
   - Verificar reconexões automáticas
   - Verificar envio de mensagens
   - Verificar consumo de recursos

### Fase 2: Migração Parcial

1. **Manter whatsapp-web.js para sessão principal**
   ```env
   USE_BAILEYS=false
   ```

2. **Usar Baileys para novas funcionalidades**
   - Criar novas sessões com Baileys
   - Migrar funcionalidades não críticas primeiro

### Fase 3: Migração Completa

1. **Ativar Baileys em produção**
   ```env
   USE_BAILEYS=true
   ```

2. **Migrar todas as sessões**
   - Conectar todas as sessões necessárias
   - Verificar funcionamento de todas as funcionalidades

3. **Remover whatsapp-web.js** (opcional)
   ```bash
   npm uninstall whatsapp-web.js puppeteer
   ```

---

## Diferenças de API

### whatsapp-web.js (Legado)

```javascript
// Uma única sessão
await whatsappSessionManager.sendMessage(phone, message, media);
const status = whatsappSessionManager.getStatus();
```

### Baileys (Novo)

```javascript
// Múltiplas sessões
await whatsappManager.sendMessage(phone, message, media, 'vendas-cliente');
const status = whatsappManager.getStatus('vendas-cliente');
const allStatus = whatsappManager.getAllSessionsStatus();
```

### Wrapper (Compatibilidade)

O `whatsappManager.js` mantém compatibilidade:

```javascript
// Funciona com ambos
await whatsappManager.sendMessage(phone, message, media);
// Baileys: usa sessão 'default'
// whatsapp-web.js: usa sessão única
```

---

## Troubleshooting

### Problema: QR Code não aparece

**Solução:**
1. Verificar se `USE_BAILEYS=true` está no `.env`
2. Verificar logs: `📱 QR Code gerado para sessão...`
3. Limpar autenticação: `rm -rf .baileys_auth/default`

### Problema: Sessão não conecta

**Solução:**
1. Verificar logs de erro
2. Resetar sessão: `await whatsappManager.reset('default')`
3. Verificar se número não foi banido pelo WhatsApp

### Problema: Mensagens não são enviadas

**Solução:**
1. Verificar status: `whatsappManager.getStatus('default')`
2. Verificar se sessão está `connected`
3. Verificar logs de erro

### Problema: Múltiplas sessões não funcionam

**Solução:**
1. Verificar se `USE_BAILEYS=true`
2. Verificar se cada sessão tem seu próprio diretório em `.baileys_auth/`
3. Verificar logs para cada sessão

---

## Comparação de Recursos

| Recurso | whatsapp-web.js | Baileys |
|---------|----------------|---------|
| Múltiplas sessões | ⚠️ Limitado (alto consumo) | ✅ Nativo |
| Consumo de RAM (10 sessões) | ~3GB | ~300MB |
| Dependência de navegador | ✅ Puppeteer | ❌ Não precisa |
| Velocidade | Média | Alta |
| Estabilidade | Média | Alta |
| Manutenção | Baixa | Alta |

---

## Próximos Passos

1. ✅ Testar Baileys em desenvolvimento
2. ⏳ Migrar sessão `vendas-cliente` para Baileys
3. ⏳ Migrar sessão `sistema` para Baileys
4. ⏳ Migrar todas as sessões
5. ⏳ Remover whatsapp-web.js (opcional)

---

## Suporte

Para dúvidas ou problemas:
- Verificar logs: `whatsappManager.getLogs()`
- Verificar status: `whatsappManager.getAllSessionsStatus()`
- Consultar documentação do Baileys: https://github.com/WhiskeySockets/Baileys

---

## Notas Importantes

⚠️ **Atenção**: 
- Baileys usa protocolo não oficial do WhatsApp
- Pode haver risco de banimento se usado incorretamente
- Recomendado usar com moderação e respeitando limites de rate

✅ **Recomendações**:
- Use rate limiting (já implementado)
- Não envie spam
- Respeite os termos de serviço do WhatsApp
- Monitore logs regularmente

