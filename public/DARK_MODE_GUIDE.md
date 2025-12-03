# Guia de Implementação de Dark Mode - RatixPay

## ⚠️ IMPORTANTE: Padrão de Implementação

Este documento descreve o padrão correto para implementar dark mode em todas as páginas do sistema RatixPay.

## ✅ Implementação Correta

### 1. No `<head>` da página:

```html
<head>
    <!-- ... outros links ... -->
    
    <!-- Sistema Unificado de Dark Mode - DEVE ser carregado ANTES de outros scripts -->
    <link rel="stylesheet" href="/css/dark-mode-unified.css">
    
    <!-- ... outros estilos ... -->
    
    <!-- Scripts - dark-mode-manager.js DEVE ser o PRIMEIRO -->
    <script src="/js/dark-mode-manager.js"></script>
    <script src="/js/server-check.js"></script>
    <script src="/js/global-auth.js"></script>
    <!-- ... outros scripts ... -->
</head>
```

### 2. NÃO faça:

❌ **NÃO** use `localStorage.getItem('theme')` - use apenas `localStorage.getItem('darkMode')`
❌ **NÃO** use `prefers-color-scheme` - o sistema não detecta preferência do sistema
❌ **NÃO** adicione código inline para inicializar dark mode
❌ **NÃO** adicione classes `dark-mode` manualmente no HTML
❌ **NÃO** carregue `dark-mode-manager.js` depois de outros scripts

### 3. Como funciona:

1. O `dark-mode-manager.js` é carregado **IMEDIATAMENTE** e aplica o dark mode **ANTES** do DOM estar pronto
2. Isso evita o "flicker" (flash de conteúdo claro antes do dark mode)
3. O sistema usa `localStorage.getItem('darkMode')` com valores `'true'` ou `'false'`
4. Light mode é o padrão se não houver preferência salva
5. O dark mode é aplicado tanto em `document.documentElement` quanto em `document.body`

### 4. Para criar botão de toggle (apenas no dashboard):

```javascript
// Apenas no dashboard.html
DarkModeManager.init(true); // true = cria o botão
```

### 5. Para alternar dark mode programaticamente:

```javascript
// Alternar
DarkModeManager.toggle();

// Ativar
DarkModeManager.enable();

// Desativar
DarkModeManager.disable();

// Verificar status
const isDark = DarkModeManager.isDarkMode();
```

## 🔧 Correção de Problemas

### Problema: Flicker ao carregar página
**Solução**: Garanta que `dark-mode-manager.js` seja carregado ANTES de qualquer outro script no `<head>`

### Problema: Dark mode não persiste entre páginas
**Solução**: Verifique se está usando `localStorage.getItem('darkMode')` e não `localStorage.getItem('theme')`

### Problema: Alternância entre dark/light mode
**Solução**: Remova qualquer código duplicado de inicialização de dark mode. Use apenas o `dark-mode-manager.js`

## 📝 Checklist para Novas Páginas

- [ ] CSS `dark-mode-unified.css` carregado no `<head>`
- [ ] Script `dark-mode-manager.js` é o PRIMEIRO script no `<head>`
- [ ] Nenhum código inline de inicialização de dark mode
- [ ] Nenhum uso de `localStorage.getItem('theme')`
- [ ] Nenhum uso de `prefers-color-scheme`
- [ ] Testado sem flicker ao carregar
- [ ] Testado persistência entre páginas

## 🎨 Variáveis CSS Disponíveis

Use as variáveis CSS do dark mode para manter consistência:

```css
var(--dm-bg-primary)      /* Background principal */
var(--dm-bg-secondary)    /* Background secundário */
var(--dm-bg-card)         /* Background de cards */
var(--dm-bg-hover)        /* Background no hover */
var(--dm-text-primary)    /* Texto principal */
var(--dm-text-secondary)  /* Texto secundário */
var(--dm-text-muted)      /* Texto desbotado */
var(--dm-border)          /* Cor de bordas */
var(--dm-shadow)          /* Cor de sombras */
```

## 🔄 Sincronização entre Abas

O sistema sincroniza automaticamente o dark mode entre abas usando:
- `localStorage` events
- Custom events `darkModeChanged`

Não é necessário código adicional para sincronização.

