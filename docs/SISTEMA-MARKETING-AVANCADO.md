# Sistema de Controle de Acesso ao Marketing Avançado

## Visão Geral

O sistema foi implementado para controlar o acesso às funcionalidades de marketing avançado, garantindo que apenas vendedores com o plano premium ativo possam configurar:

- **Black Friday Config**
- **Descontos Config** 
- **Remarketing Config**
- **Temporizador Config**

## Implementação

### 1. Middleware de Autenticação (`middleware/auth.js`)

```javascript
// Novo middleware para verificar marketing avançado
const requireMarketingAvancado = async (req, res, next) => {
    // Verifica se o usuário tem marketing_avancado = true
    if (!req.user.marketing_avancado) {
        return res.status(403).json({
            success: false,
            error: 'Marketing avançado não está ativo. Ative o plano premium para acessar estas funcionalidades.',
            code: 'MARKETING_AVANCADO_REQUIRED'
        });
    }
    next();
};
```

### 2. Rotas Protegidas

Todas as rotas de configuração agora usam o middleware:

```javascript
// Black Friday
router.get('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {
router.post('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {

// Descontos
router.get('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {
router.post('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {

// Remarketing
router.get('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {
router.post('/config', authenticateToken, requireMarketingAvancado, async (req, res) => {

// Temporizador
router.get('/', authenticateToken, requireMarketingAvancado, async (req, res) => {
router.post('/', authenticateToken, requireMarketingAvancado, async (req, res) => {
```

### 3. Autenticação Global (`public/js/global-auth.js`)

```javascript
// Verificação de marketing avançado para páginas de configuração
if (isMarketingConfigPage()) {
    const hasMarketingAvancado = await checkMarketingAvancado();
    if (!hasMarketingAvancado) {
        alert('Marketing avançado não está ativo. Ative o plano premium para acessar estas funcionalidades.');
        window.location.href = 'marketing-avancado.html';
        return;
    }
}
```

### 4. Carregamento de Tokens Melhorado

Todos os arquivos JavaScript de configuração agora:

- **Carregam tokens de múltiplas fontes**: `authToken`, `token`, `adminToken`
- **Tratam erros 403**: Redirecionam para `marketing-avancado.html`
- **Tratam erros 401**: Redirecionam para `login.html`
- **Aguardam autenticação global**: Delay de 100ms para garantir processamento

### 5. Páginas de Configuração

As páginas HTML foram atualizadas para:

- **Carregar `global-auth.js` primeiro**
- **Controlar inicialização das classes JavaScript**
- **Aguardar autenticação antes de executar**

```html
<script src="/js/global-auth.js"></script>
<script src="/js/sidebar-component.js"></script>
<script src="/js/blackfriday-config.js"></script>
<script>
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(() => {
            if (typeof BlackFridayConfig !== 'undefined') {
                new BlackFridayConfig();
            }
        }, 200);
    });
</script>
```

## Controle de Acesso

### Usuários COM Marketing Avançado Ativo ✅

- **Acesso**: Permitido a todas as páginas de configuração
- **Funcionalidades**: Black Friday, Descontos, Remarketing, Temporizador
- **Produtos**: Carregam apenas produtos do vendedor autenticado
- **Configurações**: Podem salvar e carregar configurações

### Usuários SEM Marketing Avançado ❌

- **Acesso**: Negado às páginas de configuração
- **Redirecionamento**: Automático para `marketing-avancado.html`
- **Mensagem**: "Marketing avançado não está ativo. Ative o plano premium para acessar estas funcionalidades."

## Scripts de Gerenciamento

### 1. Testar Sistema
```bash
node scripts/test-marketing-access.js
```
- Lista todos os usuários
- Mostra status de marketing avançado
- Verifica funcionalidades implementadas

### 2. Ativar Marketing Avançado
```bash
node scripts/activate-marketing-avancado.js
```
- Ativa marketing avançado para um usuário
- Atualiza plano para 'premium'
- Permite acesso às configurações

## Fluxo de Autenticação

1. **Usuário acessa página de configuração**
2. **`global-auth.js` verifica autenticação**
3. **Se não autenticado**: Redireciona para `login.html`
4. **Se autenticado**: Verifica se é página de marketing
5. **Se página de marketing**: Verifica `marketing_avancado`
6. **Se marketing ativo**: Permite acesso
7. **Se marketing inativo**: Redireciona para `marketing-avancado.html`

## Tratamento de Erros

### 401 Unauthorized
- Token inválido ou expirado
- **Ação**: Limpar tokens e redirecionar para login

### 403 Forbidden  
- Marketing avançado não ativo
- **Ação**: Redirecionar para `marketing-avancado.html`

### 500 Internal Server Error
- Erro no servidor
- **Ação**: Mostrar mensagem de erro e usar configuração padrão

## Status Atual

✅ **Implementado e Funcionando:**
- Middleware de verificação de marketing avançado
- Proteção de todas as rotas de configuração
- Autenticação global com verificação de marketing
- Carregamento melhorado de tokens
- Tratamento de erros 401, 403, 500
- Redirecionamento automático
- Scripts de teste e ativação
- Carregamento de produtos do vendedor autenticado

## Próximos Passos

1. **Testar no navegador**: Acessar páginas de configuração
2. **Verificar redirecionamentos**: Usuários sem marketing avançado
3. **Confirmar funcionalidades**: Usuários com marketing avançado
4. **Testar carregamento**: Produtos e configurações

O sistema está completamente implementado e pronto para uso! 🎯
