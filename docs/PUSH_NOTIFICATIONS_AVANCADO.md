# Sistema Avançado de Push Notifications

## 📋 Visão Geral

Sistema completo de notificações push que suporta:
- ✅ **Múltiplos dispositivos** por usuário (até 10 dispositivos)
- ✅ **Multiplataforma** (Navegadores, Android, iOS via Chrome/Firefox)
- ✅ **Cache offline** com IndexedDB
- ✅ **Service Worker otimizado**
- ✅ **Controle de permissões** e status ativo/inativo
- ✅ **Gerenciamento de dispositivos** (listar, remover)
- ✅ **Som e vibração** nas notificações

## 🏗️ Arquitetura

### Backend

#### `services/pushNotificationService.js`
Serviço principal que gerencia:
- Registro de múltiplos dispositivos
- Detecção de plataforma e navegador
- Envio para todos os dispositivos de um usuário
- Remoção automática de dispositivos inválidos
- Limite de 10 dispositivos por usuário

#### `routes/push.js`
Endpoints da API:
- `GET /api/push/vapid-public-key` - Obter chave pública VAPID
- `POST /api/push/subscribe` - Registrar dispositivo
- `POST /api/push/unsubscribe` - Remover dispositivo(s)
- `GET /api/push/devices` - Listar dispositivos do usuário
- `GET /api/push/status` - Status das notificações

### Frontend

#### `public/js/push-notifications-advanced.js`
Gerenciador avançado que:
- Detecta plataforma e navegador
- Gerencia múltiplos dispositivos
- Sincroniza com IndexedDB
- Verifica registro no servidor
- Atualiza UI automaticamente

#### `public/js/push-notification-db.js`
Gerenciador de IndexedDB para:
- Salvar notificações offline
- Marcar como lidas/não lidas
- Buscar notificações com filtros
- Contar não lidas
- Limpar notificações antigas

#### `public/sw.js`
Service Worker que:
- Recebe notificações push
- Salva no IndexedDB automaticamente
- Toca som e vibra
- Gerencia cache offline

## 🗄️ Estrutura do Banco de Dados

### Coluna `push_subscription` (TEXT/JSONB)

Armazena array de dispositivos:

```json
[
  {
    "deviceId": "device_1234567890_abc",
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    },
    "platform": "android",
    "browser": "chrome",
    "userAgent": "Mozilla/5.0...",
    "name": "android - chrome",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastActive": "2024-01-01T00:00:00.000Z",
    "active": true
  }
]
```

**Migração automática**: O sistema migra automaticamente o formato antigo (único dispositivo) para o novo formato (array).

## 🚀 Como Usar

### 1. Configurar VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Adicionar ao `.env`:
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### 2. Usar no Frontend

```html
<!-- Carregar scripts -->
<script src="/js/push-notification-db.js"></script>
<script src="/js/push-notifications-advanced.js"></script>
```

```javascript
// O gerenciador é inicializado automaticamente
// Para ativar/desativar:
await togglePushNotifications();

// Obter dispositivos registrados
const devices = await advancedPushManager.getDevices();

// Obter notificações do IndexedDB
const notifications = await pushNotificationDB.getNotifications({ limit: 20 });
const unreadCount = await pushNotificationDB.getUnreadCount();
```

### 3. Enviar Notificação (Backend)

```javascript
const pushNotificationService = require('./services/pushNotificationService');

await pushNotificationService.sendToUser(userId, {
  title: 'Venda realizada!',
  body: 'Recebeste uma comissão de 100 MZN na tua conta.',
  icon: '/assets/images/icons/icon-192x192.png',
  badge: '/assets/images/icons/icon-48x48.png',
  sound: '/assets/sounds/alert.mp3',
  vibrate: [200, 100, 200, 100, 200],
  url: '/gestao-vendas.html',
  data: {
    venda_id: '123',
    valor: 100
  }
});
```

## 📱 Suporte Multiplataforma

### ✅ Suportado
- **Chrome** (Desktop, Android, iOS)
- **Firefox** (Desktop, Android, iOS)
- **Edge** (Desktop, Android)
- **Opera** (Desktop, Android)
- **Safari** (Desktop, macOS)

### ❌ Não Suportado
- **Safari iOS** (não tem Push API)
  - **Solução**: Usar Chrome ou Firefox no iOS

## 🔧 Funcionalidades

### Múltiplos Dispositivos
- Um usuário pode ter até 10 dispositivos registrados
- Cada dispositivo tem ID único
- Dispositivos antigos são removidos automaticamente quando o limite é atingido

### Cache Offline
- Notificações são salvas no IndexedDB
- Disponível mesmo quando offline
- Sincronização automática quando online

### Gerenciamento
- Listar todos os dispositivos
- Remover dispositivo específico
- Remover todos os dispositivos
- Ver status de cada dispositivo

### Limpeza Automática
- Dispositivos inválidos são removidos automaticamente
- Notificações antigas podem ser limpas (configurável)

## 📊 Exemplo de Resposta

### Enviar para Usuário
```javascript
{
  success: true,
  sent: 3,
  failed: 0,
  total: 3,
  invalidDevices: 0
}
```

### Listar Dispositivos
```javascript
{
  success: true,
  devices: [
    {
      deviceId: "device_123",
      platform: "android",
      browser: "chrome",
      name: "android - chrome",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastActive: "2024-01-01T00:00:00.000Z",
      active: true
    }
  ],
  count: 1
}
```

## 🔄 Migração do Sistema Antigo

O sistema é **compatível com o formato antigo**. Dispositivos antigos são automaticamente migrados para o novo formato quando:
1. Um novo dispositivo é registrado
2. Uma notificação é enviada

**Não é necessária migração manual do banco de dados!**

## ⚙️ Configuração

### Variáveis de Ambiente
```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
BASE_URL=https://ratixpay.com
```

### Limites Configuráveis
- Máximo de dispositivos por usuário: **10** (configurável no código)
- Limpeza de notificações antigas: **30 dias** (configurável)

## 🐛 Troubleshooting

### Notificações não chegam
1. Verificar se VAPID keys estão configuradas
2. Verificar se usuário tem dispositivos registrados
3. Verificar logs do servidor
4. Verificar se subscription ainda é válida

### Dispositivo não aparece na lista
1. Verificar se deviceId está sendo salvo corretamente
2. Verificar se localStorage tem 'push_device_id'
3. Verificar logs do servidor

### IndexedDB não funciona
1. Verificar se navegador suporta IndexedDB
2. Verificar console do navegador para erros
3. Verificar se Service Worker está ativo

## 📝 Notas Importantes

1. **iOS Safari**: Não suporta Push API. Usuários devem usar Chrome ou Firefox no iOS.

2. **Múltiplos Dispositivos**: O sistema suporta até 10 dispositivos por usuário. Dispositivos mais antigos são removidos automaticamente.

3. **Cache Offline**: Notificações são salvas no IndexedDB mesmo quando offline, permitindo acesso posterior.

4. **Compatibilidade**: O sistema é compatível com o formato antigo de `push_subscription` e migra automaticamente.

5. **Performance**: Envio para múltiplos dispositivos é feito em paralelo usando `Promise.allSettled`.

## ✅ Checklist de Implementação

- [x] Serviço backend com suporte a múltiplos dispositivos
- [x] Rotas API atualizadas
- [x] Service Worker com IndexedDB
- [x] Gerenciador frontend avançado
- [x] Detecção de plataforma e navegador
- [x] Som e vibração nas notificações
- [x] Cache offline de notificações
- [x] Gerenciamento de dispositivos
- [x] Limpeza automática de dispositivos inválidos
- [x] Compatibilidade com formato antigo
- [x] Documentação completa

