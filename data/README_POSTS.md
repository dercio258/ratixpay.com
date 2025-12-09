# Estrutura de Posts em JSON

Este arquivo explica como funciona a estrutura de posts em JSON local do blog.

## Arquivo de Dados

O arquivo `posts.json` contém todos os posts do blog em formato JSON. A estrutura é simples e robusta:

### Estrutura Principal

```json
{
  "posts": [...],
  "categories": [...],
  "meta": {...}
}
```

### Estrutura de um Post

Cada post possui os seguintes campos:

- `id`: Identificador único do post (número)
- `slug`: URL amigável do post (string, ex: "como-comecar-vender-online")
- `title`: Título do post (string)
- `subtitle`: Subtítulo/descrição curta (string, opcional)
- `content`: Conteúdo HTML do post (string)
- `image`: URL da imagem de destaque (string, opcional)
- `category`: Categoria do post (string)
- `tags`: Array de tags (array de strings)
- `author`: Objeto com informações do autor
  - `name`: Nome do autor
  - `email`: Email do autor
- `published_at`: Data de publicação (ISO 8601)
- `created_at`: Data de criação (ISO 8601)
- `status`: Status do post ("published" ou "draft")
- `views`: Número de visualizações (número)
- `likes`: Número de curtidas (número)
- `meta_description`: Descrição para SEO (string, opcional)
- `meta_keywords`: Palavras-chave para SEO (string, opcional)

### Exemplo de Post

```json
{
  "id": 1,
  "slug": "meu-primeiro-post",
  "title": "Meu Primeiro Post",
  "subtitle": "Uma introdução ao blog",
  "content": "<h2>Introdução</h2><p>Este é o conteúdo do post em HTML.</p>",
  "image": "/images/blog/post1.jpg",
  "category": "Tutoriais",
  "tags": ["iniciante", "tutorial"],
  "author": {
    "name": "Equipe RatixPay",
    "email": "contato@ratixpay.com"
  },
  "published_at": "2024-01-15T10:00:00Z",
  "created_at": "2024-01-15T10:00:00Z",
  "status": "published",
  "views": 0,
  "likes": 0,
  "meta_description": "Descrição para SEO",
  "meta_keywords": "palavras, chave, seo"
}
```

## Como Adicionar um Novo Post

1. Abra o arquivo `data/posts.json`
2. Adicione um novo objeto no array `posts`
3. Use um `id` único (incremental)
4. Crie um `slug` único baseado no título (sem espaços, com hífens)
5. Defina `status` como `"published"` para publicar ou `"draft"` para rascunho
6. Salve o arquivo

### Gerando o Slug

O slug deve ser:
- Em minúsculas
- Sem espaços (use hífens)
- Sem caracteres especiais
- Baseado no título

Exemplo: "Como Começar a Vender Online" → "como-comecar-vender-online"

## Rotas da API

As seguintes rotas estão disponíveis:

- `GET /api/blog/posts` - Lista todos os posts publicados (com paginação, filtros e busca)
- `GET /api/blog/posts/:slug` - Obtém um post específico por slug
- `GET /api/blog/categories` - Lista todas as categorias
- `GET /api/blog/popular` - Lista os posts mais populares
- `POST /api/blog/posts/:id/like` - Incrementa curtidas
- `POST /api/blog/posts/:id/view` - Incrementa visualizações

### Parâmetros de Query

Para `GET /api/blog/posts`:
- `page`: Número da página (padrão: 1)
- `limit`: Itens por página (padrão: 12)
- `category`: Filtrar por categoria
- `search`: Buscar por texto (título, subtítulo ou conteúdo)
- `sort`: Ordenar por ("published_at", "views", "likes", "title")

## Páginas Frontend

- `/blog.html` - Lista de posts
- `/blog-post.html?slug=meu-post` - Visualização de post individual

## Formato do Conteúdo

O campo `content` aceita HTML válido. Você pode usar:
- Títulos (h1, h2, h3, etc.)
- Parágrafos (p)
- Listas (ul, ol, li)
- Imagens (img)
- Links (a)
- Formatação (strong, em, etc.)
- Código (code, pre)
- E outros elementos HTML comuns

O conteúdo é processado e sanitizado automaticamente pelo `blog-content-processor.js` para garantir segurança.

## Manutenção

- Os contadores de `views` e `likes` são incrementados em memória (não são salvos permanentemente no JSON)
- Para salvar permanentemente, você precisaria implementar uma função de salvamento
- Recomenda-se fazer backup do arquivo `posts.json` regularmente

## Dicas

1. **Imagens**: Use caminhos relativos ou URLs absolutas para as imagens
2. **SEO**: Preencha `meta_description` e `meta_keywords` para melhor SEO
3. **Categorias**: Use categorias consistentes para facilitar a navegação
4. **Tags**: Use tags relevantes para melhor organização
5. **Datas**: Use formato ISO 8601 (ex: "2024-01-15T10:00:00Z")

