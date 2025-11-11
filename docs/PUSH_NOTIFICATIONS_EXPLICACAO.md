# 📱 Explicação Completa: Push Notifications e Chaves VAPID

## 🔑 O que é o Erro da Chave Pública VAPID?

O erro **"Vapid public key should be 65 bytes long when decoded"** ocorre porque:

1. **Chaves VAPID inválidas**: As chaves hardcoded no código eram apenas exemplos (strings aleatórias), não chaves VAPID válidas
2. **Formato incorreto**: Chaves VAPID precisam ter um formato específico (base64 URL-safe) e tamanho correto quando decodificadas

## 🔐 O que são Chaves VAPID?

**VAPID** (Voluntary Application Server Identification) são chaves criptográficas usadas para:
- **Identificar seu servidor** para os serviços de push (Google, Mozilla, etc.)
- **Autenticar** que as notificações vêm do seu servidor
- **Garantir segurança** nas notificações push

### ⚠️ IMPORTANTE: Chaves VAPID são GLOBAIS

- **Uma única chave pública e privada para TODO o servidor**
- **NÃO são geradas por usuário** - são geradas UMA VEZ e usadas para todos
- Cada usuário cria uma **"subscription"** única, mas usa a mesma chave pública VAPID

## 📝 Como Gerar as Chaves VAPID

### Passo 1: Gerar as chaves

Execute no terminal:

```bash
npx web-push generate-vapid-keys
```

Isso vai gerar algo como:

```
=======================================

Public Key:
BGzX8VK9Q7Y6L3N2M1P0Q9R8S7T6U5V4W3X2Y1Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6

Private Key:
y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1

=======================================
```

### Passo 2: Adicionar ao arquivo `.env`

Abra o arquivo `.env` na raiz do projeto e adicione:

```env
VAPID_PUBLIC_KEY=BGzX8VK9Q7Y6L3N2M1P0Q9R8S7T6U5V4W3X2Y1Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
VAPID_PRIVATE_KEY=y8z9a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9e0f1
```

**⚠️ IMPORTANTE**: Use as chaves geradas pelo comando, não copie essas de exemplo!

### Passo 3: Reiniciar o servidor

Após adicionar as chaves, reinicie o servidor:

```bash
npm start
```

## 🗄️ Estrutura do Banco de Dados

### ✅ A coluna `push_subscription` já foi adicionada ao modelo

A coluna `push_subscription` foi adicionada ao modelo `Usuario` em `config/database.js`. Ela armazena:

- **Tipo**: `TEXT` (JSON stringificado)
- **Conteúdo**: Objeto JSON com:
  ```json
  {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
  ```

### 🔄 Migração do Banco de Dados

Se o banco de dados já existe, você precisa adicionar a coluna manualmente ou executar uma migração:

**Opção 1: SQL direto (PostgreSQL)**
```sql
ALTER TABLE usuarios 
ADD COLUMN push_subscription TEXT;
```

**Opção 2: Usar o script de migração**
Execute o script que será criado: `scripts/add-push-subscription-column.js`

## 👤 Como Funciona por Usuário

### 1. **Chave VAPID (Global)**
- Gerada UMA VEZ para o servidor
- Armazenada no `.env`
- Usada por TODOS os usuários

### 2. **Subscription (Por Usuário)**
- Cada usuário cria sua própria subscription no navegador
- A subscription é única e específica do navegador/dispositivo
- Armazenada na coluna `push_subscription` do usuário
- Gerada automaticamente quando o usuário permite notificações

### 3. **Fluxo de Registro**

```
1. Usuário acessa o site
2. Frontend solicita permissão para notificações
3. Navegador gera uma subscription única
4. Frontend envia subscription para o servidor (POST /api/push/subscribe)
5. Servidor salva subscription no banco (coluna push_subscription)
6. Agora o servidor pode enviar notificações para esse usuário
```

## 📲 Notificações Offline

### ✅ Como Funciona

**Push Notifications funcionam mesmo quando o usuário está offline!**

1. **Servidor envia notificação** → Vai para o serviço de push (Google FCM, Mozilla, etc.)
2. **Serviço de push armazena** → A notificação fica aguardando
3. **Usuário volta online** → O navegador recebe a notificação automaticamente
4. **Notificação aparece** → Mesmo que o usuário não esteja no site

### 🔄 Não é Necessário Sistema de Fila

O próprio serviço de push (Google FCM, Mozilla) já funciona como uma fila:
- Notificações são armazenadas até o dispositivo estar online
- Não precisa criar fila própria no banco de dados
- O serviço de push gerencia tudo automaticamente

## 🚀 Como Usar

### Enviar Notificação para um Usuário

```javascript
const { sendPushNotification } = require('./routes/push');

// Enviar notificação
await sendPushNotification(userId, {
  title: 'Nova Venda!',
  body: 'Você recebeu uma nova venda de R$ 100,00',
  url: '/gestao-vendas.html',
  icon: '/assets/images/icons/icon-192x192.png'
});
```

### Verificar se Usuário tem Subscription

```javascript
const usuario = await Usuario.findByPk(userId);
if (usuario && usuario.push_subscription) {
  // Usuário pode receber notificações
} else {
  // Usuário não permitiu notificações ainda
}
```

## 📋 Resumo

1. **Chaves VAPID**: Uma única chave para todo o servidor (não por usuário)
2. **Subscription**: Uma por usuário/dispositivo (gerada automaticamente)
3. **Banco de Dados**: Coluna `push_subscription` já adicionada ao modelo
4. **Offline**: Funciona automaticamente - serviço de push gerencia
5. **Migração**: Execute SQL ou script para adicionar coluna no banco existente

## ✅ Checklist de Configuração

- [ ] Gerar chaves VAPID com `npx web-push generate-vapid-keys`
- [ ] Adicionar chaves no arquivo `.env`
- [ ] Executar migração para adicionar coluna `push_subscription` (se banco já existe)
- [ ] Reiniciar servidor
- [ ] Testar registro de subscription no frontend
- [ ] Testar envio de notificação

