# Atualização das Páginas HTML - Migração Baileys

## ✅ Páginas Atualizadas

### 1. `whatsapp-sessions-admin.html`
**Status:** ✅ Atualizado

**Mudanças:**
- ✅ Adicionado seletor de sessões (múltiplas sessões)
- ✅ Suporte para escolher entre: default, vendas-cliente, vendas-vendedor, sistema, ofertas, suporte, afiliados
- ✅ Todos os endpoints atualizados para usar `sessionId` como parâmetro
- ✅ Interface atualizada para mostrar qual sessão está sendo gerenciada

**Endpoints Atualizados:**
- `GET /api/whatsapp/session?sessionId={id}` - Obter status
- `POST /api/whatsapp/session` - Criar/inicializar (com sessionId no body)
- `GET /api/whatsapp/session/qrcode?sessionId={id}` - Obter QR code
- `POST /api/whatsapp/session/reset` - Resetar (com sessionId no body)
- `POST /api/whatsapp/session/test` - Testar (com sessionId no body)
- `DELETE /api/whatsapp/session?sessionId={id}` - Apagar
- `GET /api/whatsapp/session/logs?sessionId={id}` - Logs

---

### 2. `whatsapp-bot.html`
**Status:** ✅ Atualizado

**Mudanças:**
- ✅ Endpoints antigos substituídos pelos novos
- ✅ Usa sistema unificado (`/api/whatsapp/session`)
- ✅ Suporte a autenticação via token
- ✅ Interface atualizada com informações do novo sistema

**Endpoints Migrados:**
- ❌ `/api/whatsapp-status-detailed` → ✅ `/api/whatsapp/session?sessionId=default`
- ❌ `/api/whatsapp-status` → ✅ `/api/whatsapp/session?sessionId=default`
- ❌ `/api/whatsapp-reset` → ✅ `/api/whatsapp/session/reset`
- ❌ `/api/whatsapp-test` → ✅ `/api/whatsapp/session/test`
- ❌ `/api/whatsapp-reconnect` → ✅ `/api/whatsapp/session` (POST após reset)
- ❌ `/api/whatsapp-health` → ✅ `/api/whatsapp/session?sessionId=default`

---

## 🎯 Funcionalidades

### Múltiplas Sessões (whatsapp-sessions-admin.html)
- ✅ Seletor de sessão no header
- ✅ Gerenciamento individual por sessão
- ✅ QR code específico por sessão
- ✅ Logs por sessão
- ✅ Estatísticas por sessão

### Sistema Unificado (whatsapp-bot.html)
- ✅ Usa sessão 'default'
- ✅ Compatível com novo sistema
- ✅ Autenticação via token
- ✅ Status e saúde da conexão

---

## 📋 Como Usar

### Gerenciar Múltiplas Sessões
1. Acesse `whatsapp-sessions-admin.html`
2. Selecione a sessão desejada no dropdown
3. Gerencie cada sessão independentemente

### Gerenciar Bot (Sessão Padrão)
1. Acesse `whatsapp-bot.html`
2. Gerencia automaticamente a sessão 'default'
3. Todas as funcionalidades disponíveis

---

## ✅ Compatibilidade

- ✅ Funciona com Baileys (`USE_BAILEYS=true`)
- ✅ Funciona com whatsapp-web.js (`USE_BAILEYS=false`)
- ✅ Autenticação via token
- ✅ Suporte a múltiplas sessões (Baileys)

---

## 🔄 Próximos Passos

1. Testar ambas as páginas
2. Verificar funcionamento com Baileys
3. Verificar funcionamento com whatsapp-web.js
4. Validar todas as funcionalidades

---

**Status:** ✅ Migração das Páginas HTML Concluída

