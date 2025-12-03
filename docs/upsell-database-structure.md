# Estrutura do Banco de Dados - Sistema de Upsell

## Tabelas Principais

### 1. `upsell_pages`
Armazena as páginas de upsell criadas pelos vendedores.

**Campos:**
- `id` (UUID, PK) - Identificador único da página
- `vendedor_id` (UUID, FK → usuarios.id) - Vendedor proprietário
- `titulo` (VARCHAR(255), NOT NULL) - Título principal (Headline)
- `nome_produto` (VARCHAR(255), NOT NULL) - Nome do produto (preenchido automaticamente)
- `subheadline` (TEXT) - Subtítulo configurável
- `video_url` (TEXT) - URL do vídeo (upload)
- `video_public_id` (VARCHAR(255)) - ID público do vídeo
- `video_embed` (TEXT) - Código HTML de incorporação (iframe, embed)
- `imagem_url` (TEXT) - URL da imagem (alternativa ao vídeo)
- `link_checkout` (TEXT) - Link de checkout (deprecated - não usado mais)
- `produto_id` (UUID, FK → produtos.id) - Produto relacionado (deprecated)
- `reforco_final` (TEXT) - Copy persuasiva / Texto de reforço final
- `beneficios` (JSONB) - Lista de benefícios em formato JSON array
- `texto_urgencia` (TEXT) - Texto de urgência configurável
- `prova_social` (JSONB) - Depoimentos e provas sociais em formato JSON array
- `texto_botao_aceitar` (VARCHAR(255), DEFAULT 'Aceitar Oferta') - Texto do botão principal
- `texto_botao_recusar` (VARCHAR(255), DEFAULT 'Não, obrigado...') - Texto do botão secundário
- `preco_original` (DECIMAL(10,2)) - Preço original para cálculo de desconto
- `ativo` (BOOLEAN, DEFAULT true) - Status da página
- `ordem` (INTEGER, DEFAULT 0) - Ordem de exibição
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

**Índices:**
- `idx_upsell_pages_vendedor` - Vendedor
- `idx_upsell_pages_produto` - Produto
- `idx_upsell_pages_ativo` - Status ativo

### 2. `produto_upsell`
Relaciona produtos com páginas de upsell (produtos que serão oferecidos na página).

**Campos:**
- `id` (SERIAL, PK) - Identificador único
- `produto_id` (UUID, FK → produtos.id) - Produto que será oferecido
- `upsell_page_id` (UUID, FK → upsell_pages.id) - Página de upsell
- `ordem` (INTEGER, DEFAULT 0) - Ordem de exibição dos produtos
- `ativo` (BOOLEAN, DEFAULT true) - Status do relacionamento
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

**Constraints:**
- `uk_produto_upsell` - UNIQUE (produto_id, upsell_page_id) - Evita duplicatas

**Índices:**
- `idx_produto_upsell_produto` - Produto
- `idx_produto_upsell_page` - Página de upsell
- `idx_produto_upsell_ativo` - Status ativo

### 3. `produto_upsell_page`
Relaciona produto comprado → página de upsell que será exibida após o pagamento.

**Campos:**
- `id` (SERIAL, PK) - Identificador único
- `produto_principal_id` (UUID, FK → produtos.id) - Produto que foi comprado
- `upsell_page_id` (UUID, FK → upsell_pages.id) - Página de upsell a ser exibida
- `ativo` (BOOLEAN, DEFAULT true) - Status do relacionamento
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

**Constraints:**
- `uk_produto_principal_upsell_page` - UNIQUE (produto_principal_id) - Um produto só pode ter uma página de upsell

**Índices:**
- `idx_produto_upsell_page_produto` - Produto principal
- `idx_produto_upsell_page_page` - Página de upsell
- `idx_produto_upsell_page_ativo` - Status ativo

## Fluxo de Dados

1. **Criação da Página de Upsell:**
   - Vendedor cria página em `upsell_pages`
   - Define título, subheadline, copy (reforco_final), vídeo/imagem
   - Seleciona produtos que serão oferecidos

2. **Relacionamento Produtos → Página:**
   - Produtos selecionados são salvos em `produto_upsell`
   - Múltiplos produtos podem ser relacionados a uma página
   - Ordem de exibição é controlada pelo campo `ordem`

3. **Relacionamento Produto Comprado → Página:**
   - Quando um produto é comprado, busca em `produto_upsell_page`
   - Se encontrar, redireciona para a página de upsell relacionada
   - Um produto só pode ter uma página de upsell associada

## Estrutura JSON dos Campos

### `beneficios` (JSONB)
```json
[
  "Acesso imediato ao produto",
  "Garantia de 7 dias",
  "Suporte 24/7"
]
```

### `prova_social` (JSONB)
```json
[
  {
    "texto": "Produto excelente!",
    "autor": "João Silva"
  },
  {
    "texto": "Superou minhas expectativas",
    "autor": "Maria Santos"
  }
]
```

## Migrações Executadas

✅ `create_upsell_tables` - Cria tabelas base
✅ `add_video_embed_to_upsell_pages` - Adiciona suporte a vídeo embed
✅ `create_produto_upsell_page_table` - Cria tabela de relacionamento produto → página
✅ `add_upsell_configurable_fields` - Adiciona todos os campos configuráveis

## Status

✅ Todas as migrações foram executadas com sucesso!
✅ Banco de dados está estruturado e pronto para uso.

