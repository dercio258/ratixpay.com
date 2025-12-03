# Sistema de Light Mode (Padrão) - RatixPay

## Visão Geral

O sistema agora funciona com **Light Mode como padrão**. O Dark Mode só pode ser ativado através do botão no dashboard e é aplicado uniformemente em todas as páginas.

## Comportamento

### Light Mode (Padrão)
- ✅ **Light mode é o padrão** - todas as páginas iniciam em light mode
- ✅ Cores claras definidas nas variáveis CSS `:root`
- ✅ Aplicado automaticamente quando não há preferência salva
- ✅ Uniforme em todas as páginas

### Dark Mode (Opcional)
- ✅ **Só pode ser ativado pelo botão do dashboard**
- ✅ Não detecta preferência do sistema automaticamente
- ✅ Salva preferência no localStorage
- ✅ Aplicado uniformemente em todas as páginas quando ativado
- ✅ Cores pretas consistentes

## Fluxo de Funcionamento

### Primeira Vez (Sem Preferência Salva)
1. Usuário acessa qualquer página
2. Sistema verifica localStorage - não encontra preferência
3. **Aplica Light Mode (padrão)**
4. Salva `darkMode: 'false'` no localStorage

### Ativando Dark Mode
1. Usuário acessa o dashboard
2. Clica no botão de dark mode
3. Sistema alterna para dark mode
4. Salva `darkMode: 'true'` no localStorage
5. Todas as outras páginas aplicam dark mode automaticamente

### Desativando Dark Mode
1. Usuário acessa o dashboard
2. Clica no botão de dark mode novamente
3. Sistema alterna para light mode
4. Salva `darkMode: 'false'` no localStorage
5. Todas as outras páginas aplicam light mode automaticamente

## Cores

### Light Mode (Padrão)
- **Background Principal:** `#ffffff` (branco)
- **Background Secundário:** `#f8fafc` (cinza muito claro)
- **Background Card:** `#ffffff` (branco)
- **Background Hover:** `#f1f5f9` (cinza claro)
- **Texto Primário:** `#1e293b` (cinza escuro)
- **Texto Secundário:** `#64748b` (cinza médio)
- **Border:** `#e2e8f0` (cinza claro)

### Dark Mode
- **Background Principal:** `#000000` (preto puro)
- **Background Secundário:** `#0a0a0a` (preto quase puro)
- **Background Card:** `#111111` (preto quase puro)
- **Background Hover:** `#1a1a1a` (cinza muito escuro)
- **Texto Primário:** `#ffffff` (branco)
- **Texto Secundário:** `#e5e5e5` (cinza muito claro)
- **Border:** `#2a2a2a` (cinza escuro)

## Sidebar

O sidebar **sempre usa cores pretas** em ambos os modos:
- Background: `#000000` (preto)
- Texto: `#ffffff` (branco)
- Sem ofuscamentos - mantém consistência visual

## Sincronização

- ✅ **Entre páginas:** Todas as páginas verificam localStorage ao carregar
- ✅ **Entre abas:** Evento `storage` sincroniza mudanças automaticamente
- ✅ **Persistência:** Preferência salva no localStorage

## Arquivos

### JavaScript
- `public/js/dark-mode-manager.js` - Gerencia light/dark mode
  - Light mode é padrão
  - Não detecta preferência do sistema
  - Sincroniza entre páginas e abas

### CSS
- `public/css/dark-mode-unified.css` - Estilos unificados
  - Variáveis CSS para light mode (`:root`)
  - Variáveis CSS para dark mode (`body.dark-mode`)
  - Estilos aplicados uniformemente

### HTML
- `public/dashboard.html` - Única página com botão toggle
- Outras páginas - Aplicam modo automaticamente

## Testes

Para testar:
1. Limpe o localStorage: `localStorage.clear()`
2. Acesse qualquer página - deve iniciar em **light mode**
3. Acesse o dashboard
4. Clique no botão de dark mode - deve alternar para **dark mode**
5. Navegue para outras páginas - devem estar em **dark mode**
6. Volte ao dashboard e clique novamente - deve voltar para **light mode**
7. Navegue para outras páginas - devem estar em **light mode**

## Notas Importantes

- ⚠️ **Light mode é sempre o padrão** - não há detecção automática de preferência do sistema
- ⚠️ **Dark mode só pode ser ativado pelo botão do dashboard**
- ⚠️ **Todas as páginas seguem a mesma preferência** - uniformidade garantida
- ⚠️ **Sidebar sempre preto** - mantém consistência visual

