# Arquivos Legados do WhatsApp

## ⚠️ Arquivos que ainda referenciam whatsapp-web.js

Estes arquivos **não são mais usados** pelo sistema principal, mas foram mantidos para referência ou podem estar sendo usados em rotas específicas:

### Serviços Legados

1. **`services/whatsappSessionManager.js`**
   - ❌ Sistema antigo usando whatsapp-web.js
   - ✅ Substituído por `whatsappBaileysManager.js`
   - **Ação:** Pode ser removido após verificação

2. **`services/whatsappProductDelivery.js`**
   - ❌ Usa `whatsapp-web.js` e `MessageMedia`
   - ⚠️ Pode estar sendo usado em rotas legadas
   - **Ação:** Verificar se `routes/pagamento.js` ainda usa (já foi atualizado)

3. **`services/whatsappBotService.js`**
   - ❌ Sistema legado de bot
   - ⚠️ Pode estar sendo usado por `whatsappService.js`
   - **Ação:** Verificar dependências

4. **`services/whatsappService.js`**
   - ⚠️ Usa `whatsappBotService.js`
   - ⚠️ Pode estar sendo usado em rotas
   - **Ação:** Verificar se ainda é necessário

### Utilitários Legados

5. **`utils/whatsappBrowserDetector.js`**
   - ❌ Usado apenas por whatsapp-web.js (Puppeteer)
   - ✅ Não é mais necessário com Baileys
   - **Ação:** Pode ser removido

---

## 🔍 Verificação de Uso

Para verificar se estes arquivos ainda são usados:

```bash
# Verificar imports
grep -r "require.*whatsappSessionManager" .
grep -r "require.*whatsappProductDelivery" .
grep -r "require.*whatsappBotService" .
grep -r "require.*whatsappService" .
```

---

## 📋 Plano de Remoção

### Fase 1: Verificação (Recomendado)
1. Verificar se `routes/pagamento.js` ainda usa `whatsappProductDelivery`
2. Verificar se `routes/vendas.js` usa algum serviço legado
3. Verificar se `server.js` inicializa serviços legados
4. Verificar se `routes/notification-stats.js` usa serviços legados

### Fase 2: Remoção (Após Verificação)
1. Remover `services/whatsappSessionManager.js`
2. Remover `services/whatsappProductDelivery.js` (se não usado)
3. Remover `services/whatsappBotService.js` (se não usado)
4. Remover `services/whatsappService.js` (se não usado)
5. Remover `utils/whatsappBrowserDetector.js`

### Fase 3: Limpeza Final
1. Remover referências em documentação
2. Atualizar `.gitignore` se necessário
3. Limpar imports não utilizados

---

## ⚠️ Aviso

**NÃO remova arquivos sem verificar primeiro!**

Alguns arquivos podem estar sendo usados em:
- Rotas específicas
- Scripts de migração
- Documentação
- Testes

---

## ✅ Status Atual

- ✅ Sistema principal migrado para Baileys
- ✅ `whatsappManager.js` usa apenas Baileys
- ⏳ Arquivos legados mantidos para referência
- ⏳ Verificação de dependências pendente

---

**Última atualização:** $(date)

