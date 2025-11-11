# 🔔 Ícones de Notificação

Este arquivo documenta os ícones necessários para o sistema de notificações.

## Ícones Necessários:

### 1. **sale-icon.png** (32x32px)
- **Uso**: Notificações de venda realizada
- **Estilo**: Ícone de dinheiro ou gráfico de vendas
- **Cores**: Verde (#27ae60) ou azul (#3498db)

### 2. **withdraw-icon.png** (32x32px)
- **Uso**: Notificações de saque
- **Estilo**: Ícone de saque ou seta para baixo
- **Cores**: Laranja (#f39c12) ou vermelho (#e74c3c)

### 3. **user-icon.png** (32x32px)
- **Uso**: Notificações de novo vendedor
- **Estilo**: Ícone de usuário ou pessoa
- **Cores**: Azul (#3498db) ou roxo (#9b59b6)

### 4. **test-icon.png** (32x32px)
- **Uso**: Notificações de teste
- **Estilo**: Ícone de teste ou engrenagem
- **Cores**: Cinza (#95a5a6) ou azul (#3498db)

### 5. **view-icon.png** (16x16px)
- **Uso**: Botões de ação nas notificações
- **Estilo**: Ícone de olho ou seta
- **Cores**: Branco ou azul claro

### 6. **close-icon.png** (16x16px)
- **Uso**: Botão de fechar nas notificações
- **Estilo**: Ícone de X ou fechar
- **Cores**: Branco ou cinza

### 7. **logo-192.png** (192x192px)
- **Uso**: Ícone principal do app
- **Estilo**: Logo do RatixPay
- **Cores**: Conforme identidade visual

## Como Criar os Ícones:

### Opção 1: Usar Font Awesome (Recomendado)
```html
<!-- Converter para PNG usando CSS -->
<i class="fas fa-dollar-sign" style="color: #27ae60; font-size: 32px;"></i>
```

### Opção 2: Usar SVG
```svg
<svg width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="16" fill="#27ae60"/>
  <text x="16" y="20" text-anchor="middle" fill="white" font-size="16">$</text>
</svg>
```

### Opção 3: Usar Imagens Existentes
- Baixar ícones gratuitos de sites como:
  - [Feather Icons](https://feathericons.com/)
  - [Heroicons](https://heroicons.com/)
  - [Tabler Icons](https://tabler-icons.io/)

## Estrutura de Arquivos:
```
public/assets/images/
├── sale-icon.png
├── withdraw-icon.png
├── user-icon.png
├── test-icon.png
├── view-icon.png
├── close-icon.png
└── logo-192.png
```

## Notas:
- Todos os ícones devem ter fundo transparente
- Tamanhos recomendados: 32x32px para ícones principais, 16x16px para botões
- Formato: PNG com transparência
- Otimizar para web (compressão)
