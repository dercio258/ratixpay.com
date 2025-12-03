# Sistema Unificado de Dark Mode - RatixPay

## Visão Geral

Foi implementado um sistema unificado de Dark Mode com cores PRETAS (não azuis) para todas as páginas da aplicação RatixPay.

## Arquivos Criados

### 1. CSS Unificado
**Arquivo:** `public/css/dark-mode-unified.css`
- Contém todos os estilos para dark mode preto
- Define variáveis CSS para cores consistentes
- Aplica dark mode em todos os elementos (sidebar, cards, tabelas, inputs, etc.)

### 2. JavaScript Manager
**Arquivo:** `public/js/dark-mode-manager.js`
- Gerencia o estado do dark mode
- Salva preferência no localStorage
- Cria automaticamente o botão toggle
- Detecta preferência do sistema operacional

## Cores do Dark Mode (PRETO)

O dark mode usa cores PRETAS ao invés de azuis:

- **Background Principal:** `#000000` (preto puro)
- **Background Card:** `#111111` (preto quase puro)
- **Background Hover:** `#1a1a1a` (cinza muito escuro)
- **Border:** `#2a2a2a` (cinza escuro)
- **Texto Primário:** `#ffffff` (branco)
- **Texto Secundário:** `#a0a0a0` (cinza claro)

## Como Aplicar em Novas Páginas

### Passo 1: Adicionar CSS
Adicione no `<head>` da página HTML, após os outros links CSS:

```html
<!-- Sistema Unificado de Dark Mode -->
<link rel="stylesheet" href="/css/dark-mode-unified.css">
```

### Passo 2: Adicionar JavaScript
Adicione no `<head>` da página HTML, após os scripts de autenticação:

```html
<!-- Sistema Unificado de Dark Mode -->
<script src="/js/dark-mode-manager.js"></script>
```

### Passo 3: Atualizar Cores Locais (Opcional)
Se a página tiver variáveis CSS próprias para dark mode, atualize para cores pretas:

```css
/* Dark Mode Overrides - PRETO (não azul) */
body.dark-mode {
    --bg-page: #000000;
    --bg-surface: #111111;
    --bg-input: #1a1a1a;
    --text-primary: #ffffff;
    --text-secondary: #a0a0a0;
    --border-color: #2a2a2a;
}
```

### Passo 4: Botão Toggle
O botão toggle é criado automaticamente pelo `dark-mode-manager.js`. Ele será:
- Adicionado ao `.header-right` se existir
- Ou criado como botão flutuante no canto da tela

## Páginas Já Atualizadas

- ✅ `dashboard.html`
- ✅ `gestao-produtos.html`
- ✅ `pagamentos.html`
- ✅ `ferramentas.html`
- ✅ `integracoes.html`
- ✅ `gestao-vendas.html` (parcial)

## Sidebar

O sidebar já está configurado para dark mode preto no componente `sidebar-component.js`. Ele usa:
- Background: `#000000` (preto puro)
- Mantém o estilo original com bordas e hovers apropriados

## Funcionalidades

1. **Toggle Automático:** O botão é criado automaticamente
2. **Persistência:** Preferência salva no localStorage
3. **Detecção do Sistema:** Detecta preferência do OS se não houver preferência salva
4. **Transições Suaves:** Todas as mudanças têm transições CSS
5. **Consistência:** Mesmas cores em todas as páginas

## Compatibilidade

- Funciona com todas as páginas existentes
- Compatível com o sidebar component
- Não interfere com estilos existentes (usa `!important` onde necessário)
- Responsivo para mobile

## Próximos Passos

Para completar a implementação, atualize as seguintes páginas seguindo os passos acima:

- [ ] `afiliados-painel.html`
- [ ] `afiliados-catalogo.html`
- [ ] `premiacoes.html`
- [ ] `meta-pixel-config.html`
- [ ] `whatsapp-config.html`
- [ ] `remarketing-config.html`
- [ ] `utmfy-config.html`
- [ ] Outras páginas conforme necessário

## Notas Importantes

1. O dark mode deve ser PRETO, nunca azul
2. O sistema unificado garante consistência visual
3. Todas as páginas devem usar o mesmo CSS e JS
4. O sidebar sempre será preto no dark mode

