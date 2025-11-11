# Sistema de Rastreamento de Cliques e Pagamento por Cliques

## Visão Geral

O sistema de afiliados agora inclui rastreamento de cliques e pagamento automático baseado em cliques. Cada afiliado recebe créditos automaticamente a cada 10 cliques em seus links de produtos.

## Regras do Sistema

### Pagamento por Cliques
- **10 cliques = 1 MZN**
- Os créditos são creditados automaticamente na conta do afiliado
- O sistema rastreia cliques pendentes e já pagos separadamente

### Links Únicos por Produto
- **Cada afiliado pode ter apenas 1 link por produto**
- Isso evita fraudes e garante rastreamento preciso
- Se um afiliado tentar criar um segundo link para o mesmo produto, o sistema retorna o link existente

## Estrutura do Banco de Dados

### Tabela `link_trackings`
Novas colunas adicionadas:
- `cliques_pagos` (INTEGER): Cliques já pagos (múltiplos de 10)
- `creditos_gerados` (DECIMAL): Total de créditos gerados por este link

### Tabela `afiliados`
Novas colunas adicionadas:
- `total_cliques` (INTEGER): Total de cliques em todos os links
- `cliques_pagos` (INTEGER): Total de cliques já pagos
- `creditos_cliques` (DECIMAL): Total de créditos gerados por cliques

## Funcionalidades

### 1. Geração de Links
**Endpoint:** `POST /api/afiliados/gerar-link-produto` (requer autenticação)

```javascript
// Request
{
  "produto_id": "uuid-do-produto"
}

// Response
{
  "success": true,
  "message": "Link gerado com sucesso",
  "data": {
    "id": "link-id",
    "link_afiliado": "https://ratixpay.com/checkout.html?produto=PROD123&ref=AFILIADO123",
    "produto": {
      "id": "produto-id",
      "nome": "Nome do Produto",
      "custom_id": "PROD123",
      "preco": 100.00
    },
    "cliques": 0,
    "cliques_pagos": 0,
    "creditos_gerados": 0.00
  }
}
```

**Comportamento:**
- Se já existe link para o produto, retorna o link existente
- Se não existe, cria um novo link único

### 2. Rastreamento Automático de Cliques
O middleware `affiliateTrackingMiddleware` rastreia automaticamente todos os cliques em links com parâmetro `ref`.

**Processo:**
1. Detecta parâmetro `ref` na URL
2. Busca afiliado pelo código
3. Busca ou cria link de tracking (garantindo um link por produto)
4. Processa clique usando `afiliadoClickService`
5. Gera créditos automaticamente se atingir múltiplo de 10

### 3. Visualização de Links
**Endpoint:** `GET /api/afiliados/meus-links` (requer autenticação)

Retorna todos os links do afiliado com estatísticas detalhadas:
- Total de cliques
- Cliques pagos
- Cliques pendentes
- Créditos gerados
- Créditos pendentes
- Cliques para próximo crédito

### 4. Estatísticas de Cliques
**Endpoint:** `GET /api/afiliados/estatisticas-cliques` (requer autenticação)

Retorna estatísticas completas de cliques:
```javascript
{
  "success": true,
  "data": {
    "totalCliques": 150,
    "totalCliquesPagos": 140,
    "cliquesPendentes": 10,
    "creditosGerados": 14.00,
    "creditosPendentes": 1.00,
    "cliquesParaProximoCredito": 0,
    "links": [...]
  }
}
```

### 5. Saldo Atualizado
**Endpoint:** `GET /api/afiliados/meu-saldo` (requer autenticação)

Agora inclui informações de cliques:
```javascript
{
  "success": true,
  "data": {
    "saldo_disponivel": 150.00,
    "total_comissoes": 100.00,
    "total_vendas": 5,
    "comissao_percentual": 15.00,
    "cliques": {
      "total_cliques": 150,
      "cliques_pagos": 140,
      "cliques_pendentes": 10,
      "creditos_gerados": 14.00,
      "creditos_pendentes": 1.00,
      "cliques_para_proximo_credito": 0,
      "regra": "10 cliques = 1 MZN"
    }
  }
}
```

## Serviço de Processamento de Cliques

O serviço `afiliadoClickService` é responsável por:
1. Processar cada clique individualmente
2. Calcular créditos quando atingir múltiplo de 10
3. Atualizar saldo do afiliado automaticamente
4. Manter estatísticas atualizadas

**Métodos principais:**
- `processarClique(linkTrackingId, afiliadoId)`: Processa um clique e gera créditos se necessário
- `processarMultiplosCliques(linkTrackingId, quantidade)`: Processa múltiplos cliques (útil para migrações)
- `obterEstatisticasCliques(afiliadoId)`: Retorna estatísticas completas

## Migração do Banco de Dados

Execute o script de migração para adicionar as novas colunas:

```bash
node scripts/add-click-tracking-columns.js
```

O script:
1. Adiciona colunas nas tabelas `link_trackings` e `afiliados`
2. Atualiza valores históricos baseado em cliques existentes
3. Cria constraint única para garantir um link por produto por afiliado
4. Atualiza saldos com créditos históricos

## Prevenção de Fraudes

### 1. Link Único por Produto
- Cada afiliado pode ter apenas 1 link por produto
- Evita criação de múltiplos links para o mesmo produto
- Constraint única no banco de dados

### 2. Rastreamento Preciso
- Cada clique é registrado individualmente
- Sistema rastreia cliques pagos e pendentes separadamente
- Impossível "duplicar" cliques já pagos

### 3. Validação de Afiliado
- Apenas afiliados ativos podem receber créditos
- Links de afiliados inativos não geram créditos

## Exemplo de Fluxo

1. **Afiliado cria link para produto:**
   ```
   POST /api/afiliados/gerar-link-produto
   { "produto_id": "produto-123" }
   ```
   Retorna: `https://ratixpay.com/checkout.html?produto=PROD123&ref=AFILIADO123`

2. **Usuário clica no link:**
   - Middleware detecta `ref=AFILIADO123`
   - Busca afiliado e link de tracking
   - Processa clique (incrementa contador)
   - Se atingir 10 cliques, gera 1 MZN automaticamente

3. **Afiliado visualiza estatísticas:**
   ```
   GET /api/afiliados/meus-links
   ```
   Vê todos os links com cliques, créditos gerados, etc.

4. **Afiliado verifica saldo:**
   ```
   GET /api/afiliados/meu-saldo
   ```
   Vê saldo total incluindo créditos de cliques

## Notas Importantes

- Os créditos são creditados **automaticamente** quando atingir múltiplo de 10
- O sistema não permite criar múltiplos links para o mesmo produto
- Cliques são rastreados em tempo real
- Histórico de cliques é mantido para auditoria
- O saldo do afiliado inclui tanto comissões de vendas quanto créditos de cliques

