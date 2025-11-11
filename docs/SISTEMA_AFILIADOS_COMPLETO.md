# 🎯 Sistema de Afiliados - Estrutura Completa

## 📋 Visão Geral

Sistema completo de afiliados com autenticação, registro, recuperação de senha e gestão de comissões.

## 🔐 Autenticação

### Middleware de Autenticação
**Arquivo**: `middleware/authAfiliado.js`

- `authenticateAfiliado`: Middleware obrigatório para rotas protegidas
- `optionalAuthAfiliado`: Middleware opcional (não bloqueia se não tiver token)

### Rotas de Autenticação
**Base URL**: `/api/afiliados/auth`

#### 1. **Registro de Afiliado**
```
POST /api/afiliados/auth/register
```

**Body:**
```json
{
  "nome": "João Silva",
  "email": "joao@example.com",
  "telefone": "841234567",
  "senha": "SenhaForte123",
  "confirmarSenha": "SenhaForte123"
}
```

**Validações:**
- ✅ Nome mínimo 3 caracteres
- ✅ Email válido
- ✅ Senha forte (mínimo 8 caracteres, maiúscula, minúscula, número)
- ✅ Confirmação de senha
- ✅ Email único
- ✅ Rate limiting: 3 registros por hora por IP

**Resposta:**
```json
{
  "success": true,
  "message": "Afiliado registrado com sucesso! Verifique seu email para mais informações.",
  "token": "jwt_token_aqui",
  "afiliado": {
    "id": "uuid",
    "nome": "João Silva",
    "email": "joao@example.com",
    "codigo": "ABC12345",
    "link_afiliado": "https://ratixpay.com/?ref=ABC12345",
    "comissao_percentual": 15.00,
    "total_vendas": 0,
    "total_comissoes": 0.00,
    "saldo_disponivel": 0.00
  }
}
```

**Email de Boas-Vindas:**
- ✅ Enviado automaticamente após registro
- ✅ Contém código de afiliado
- ✅ Instruções de uso
- ✅ Link para painel

#### 2. **Login de Afiliado**
```
POST /api/afiliados/auth/login
```

**Body:**
```json
{
  "email": "joao@example.com",
  "senha": "SenhaForte123"
}
```

**Validações:**
- ✅ Email e senha obrigatórios
- ✅ Verifica status da conta (ativo/suspenso/inativo)
- ✅ Rate limiting: 5 tentativas por 15 minutos por IP

**Resposta:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "token": "jwt_token_aqui",
  "afiliado": {
    "id": "uuid",
    "nome": "João Silva",
    "email": "joao@example.com",
    "codigo": "ABC12345",
    "link_afiliado": "https://ratixpay.com/?ref=ABC12345",
    "comissao_percentual": 15.00,
    "total_vendas": 5,
    "total_comissoes": 150.00,
    "saldo_disponivel": 120.00,
    "status": "ativo"
  }
}
```

#### 3. **Recuperação de Senha**
```
POST /api/afiliados/auth/forgot-password
```

**Body:**
```json
{
  "email": "joao@example.com"
}
```

**Validações:**
- ✅ Email obrigatório e válido
- ✅ Rate limiting: 3 solicitações por hora por IP
- ✅ Previne spam (verifica se já existe token válido)

**Email de Recuperação:**
- ✅ Link com token válido por 1 hora
- ✅ Instruções de segurança
- ✅ Template profissional

**Resposta:**
```json
{
  "success": true,
  "message": "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha"
}
```

#### 4. **Resetar Senha**
```
POST /api/afiliados/auth/reset-password
```

**Body:**
```json
{
  "token": "token_do_email",
  "novaSenha": "NovaSenhaForte123",
  "confirmarSenha": "NovaSenhaForte123"
}
```

**Validações:**
- ✅ Token válido e não expirado
- ✅ Senha forte
- ✅ Nova senha diferente da atual

**Resposta:**
```json
{
  "success": true,
  "message": "Senha redefinida com sucesso. Você já pode fazer login com a nova senha."
}
```

#### 5. **Verificar Token**
```
GET /api/afiliados/auth/verify
```

**Headers:**
```
Authorization: Bearer jwt_token_aqui
```

**Resposta:**
```json
{
  "success": true,
  "afiliado": {
    "id": "uuid",
    "nome": "João Silva",
    "email": "joao@example.com",
    "codigo": "ABC12345",
    "link_afiliado": "https://ratixpay.com/?ref=ABC12345",
    "comissao_percentual": 15.00,
    "total_vendas": 5,
    "total_comissoes": 150.00,
    "saldo_disponivel": 120.00,
    "status": "ativo"
  }
}
```

## 📊 Rotas Protegidas (Requerem Autenticação)

**Base URL**: `/api/afiliados`

Todas as rotas abaixo requerem o header:
```
Authorization: Bearer jwt_token_aqui
```

### 1. **Minhas Vendas**
```
GET /api/afiliados/minhas-vendas
```

Retorna as últimas 100 vendas do afiliado autenticado.

### 2. **Meu Saldo**
```
GET /api/afiliados/meu-saldo
```

Retorna saldo disponível, total de comissões e vendas.

### 3. **Meus Links**
```
GET /api/afiliados/meus-links
```

Retorna todos os links de tracking do afiliado com estatísticas.

### 4. **Solicitar Saque**
```
POST /api/afiliados/solicitar-saque
```

**Body:**
```json
{
  "valor": 100.00,
  "metodo": "mpesa",
  "numero_conta": "841234567",
  "nome_completo": "João Silva",
  "observacoes": "Saque urgente"
}
```

**Validações:**
- ✅ Valor mínimo: MZN 50.00
- ✅ Saldo suficiente
- ✅ Método válido (mpesa, emola, bank_transfer)

### 5. **Meus Saques**
```
GET /api/afiliados/meus-saques
```

Retorna histórico de saques do afiliado.

## 🔒 Segurança Implementada

### Rate Limiting
- **Login**: 5 tentativas por 15 minutos
- **Registro**: 3 registros por hora
- **Recuperação de senha**: 3 solicitações por hora

### Validações de Senha
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número

### Proteção de Conta
- Verificação de status (ativo/suspenso/inativo)
- Tokens JWT com expiração (30 dias)
- Tokens de reset com expiração (1 hora)
- Hash bcrypt para senhas (12 rounds)

## 📧 Sistema de Emails

### Email de Boas-Vindas
- Enviado automaticamente no registro
- Contém código de afiliado
- Instruções de uso
- Link para painel

### Email de Recuperação de Senha
- Link seguro com token
- Válido por 1 hora
- Instruções de segurança
- Template profissional

## 🎯 Código de Afiliado

### Geração
- Código único de 8 caracteres
- Alfanumérico (A-Z, 0-9)
- Verificação de unicidade
- Até 20 tentativas de geração

### Uso
- Link personalizado: `https://ratixpay.com/?ref=CODIGO`
- Rastreamento automático de cliques
- Cálculo de comissões
- Estatísticas detalhadas

## 📝 Estrutura de Dados

### Modelo Afiliado
```javascript
{
  id: UUID,
  nome: String,
  email: String (único),
  senha: String (hash bcrypt),
  telefone: String (opcional),
  codigo_afiliado: String (único, 8 caracteres),
  link_afiliado: String,
  comissao_percentual: Decimal (padrão: 15.00),
  status: ENUM ('ativo', 'inativo', 'suspenso'),
  total_vendas: Integer,
  total_comissoes: Decimal,
  saldo_disponivel: Decimal,
  token_reset_senha: String (opcional),
  token_reset_expires: Date (opcional),
  data_cadastro: Date,
  ultima_atividade: Date
}
```

## 🚀 Como Usar

### 1. Registrar Novo Afiliado
```javascript
const response = await fetch('/api/afiliados/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome: 'João Silva',
    email: 'joao@example.com',
    telefone: '841234567',
    senha: 'SenhaForte123',
    confirmarSenha: 'SenhaForte123'
  })
});
```

### 2. Fazer Login
```javascript
const response = await fetch('/api/afiliados/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'joao@example.com',
    senha: 'SenhaForte123'
  })
});

const { token } = await response.json();
localStorage.setItem('affiliateToken', token);
```

### 3. Acessar Rotas Protegidas
```javascript
const token = localStorage.getItem('affiliateToken');
const response = await fetch('/api/afiliados/meu-saldo', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 4. Recuperar Senha
```javascript
// 1. Solicitar recuperação
await fetch('/api/afiliados/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'joao@example.com' })
});

// 2. Usar token do email para resetar
await fetch('/api/afiliados/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'token_do_email',
    novaSenha: 'NovaSenhaForte123',
    confirmarSenha: 'NovaSenhaForte123'
  })
});
```

## ✅ Checklist de Implementação

- [x] Middleware de autenticação específico para afiliados
- [x] Sistema de registro com validações robustas
- [x] Sistema de login com verificação de status
- [x] Recuperação de senha com envio de email
- [x] Reset de senha com validações
- [x] Rate limiting em todas as rotas sensíveis
- [x] Validação de senha forte
- [x] Email de boas-vindas
- [x] Email de recuperação de senha
- [x] Rotas protegidas com autenticação
- [x] Geração de código de afiliado único
- [x] Logs de auditoria
- [x] Tratamento de erros robusto

## 📚 Arquivos Criados/Modificados

1. **middleware/authAfiliado.js** - Middleware de autenticação
2. **routes/auth-afiliados.js** - Rotas de autenticação (completamente reescrito)
3. **routes/afiliados.js** - Rotas protegidas atualizadas

## 🔄 Próximos Passos (Opcional)

- [ ] Criar tabela de saques de afiliados
- [ ] Implementar sistema de notificações push para afiliados
- [ ] Dashboard completo para afiliados
- [ ] Relatórios e estatísticas avançadas
- [ ] Sistema de níveis/tiers de comissão

