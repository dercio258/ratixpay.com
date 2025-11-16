# Consultas de Banners - Documentação

## Resumo das Consultas de Banners no Sistema

### 1. Consultas Sequelize (ORM)

#### GET - Listar todos os banners do afiliado
**Rota:** `GET /api/afiliados/banners`  
**Arquivo:** `routes/afiliados.js` (linha 1357-1390)

```javascript
const banners = await BannerAfiliado.findAll({
    where: {
        afiliado_id: req.afiliado.id
    },
    include: [
        {
            model: Produto,
            as: 'produto',
            attributes: ['id', 'nome', 'custom_id', 'imagem_url']
        },
        {
            model: LinkTracking,
            as: 'linkTracking',
            attributes: ['id', 'link_afiliado', 'cliques', 'conversoes']
        }
    ],
    order: [['created_at', 'DESC']]
});
```

**Campos retornados:**
- Todos os campos do banner
- Produto associado (id, nome, custom_id, imagem_url)
- LinkTracking associado (id, link_afiliado, cliques, conversoes)

---

#### GET - Buscar banner específico (para atualização)
**Rota:** `PUT /api/afiliados/banners/:id`  
**Arquivo:** `routes/afiliados.js` (linha 1518-1523)

```javascript
const banner = await BannerAfiliado.findOne({
    where: {
        id: id,
        afiliado_id: req.afiliado.id
    }
});
```

**Campos retornados:**
- Todos os campos do banner
- Verifica se o banner pertence ao afiliado autenticado

---

#### GET - Buscar banner específico (para deleção)
**Rota:** `DELETE /api/afiliados/banners/:id`  
**Arquivo:** `routes/afiliados.js` (linha 1590-1595)

```javascript
const banner = await BannerAfiliado.findOne({
    where: {
        id: id,
        afiliado_id: req.afiliado.id
    }
});
```

**Campos retornados:**
- Todos os campos do banner
- Verifica se o banner pertence ao afiliado autenticado

---

#### POST - Criar novo banner
**Rota:** `POST /api/afiliados/banners`  
**Arquivo:** `routes/afiliados.js` (linha 1468-1479)

```javascript
const banner = await BannerAfiliado.create({
    afiliado_id: req.afiliado.id,
    link_tracking_id: linkTracking?.id || null,
    produto_id: produto_id || null,
    titulo: titulo,
    mensagem: mensagem || null,
    imagem_url: imagem_url,
    link_afiliado: linkAfiliado,
    codigo_html: codigoHtml,
    ativo: true,
    cliques: 0
});
```

**Campos criados:**
- Todos os campos obrigatórios e opcionais
- Gera código HTML automaticamente

---

#### Reload com relacionamentos (após criar/atualizar)
**Arquivo:** `routes/afiliados.js` (linhas 1482-1495, 1555-1568)

```javascript
await banner.reload({
    include: [
        {
            model: Produto,
            as: 'produto',
            attributes: ['id', 'nome', 'custom_id', 'imagem_url']
        },
        {
            model: LinkTracking,
            as: 'linkTracking',
            attributes: ['id', 'link_afiliado', 'cliques', 'conversoes']
        }
    ]
});
```

---

### 2. Estrutura da Tabela no Banco de Dados

**Tabela:** `banner_afiliados`  
**Script de criação:** `scripts/create-banner-afiliados-table.js`

**Campos:**
- `id` (UUID) - Chave primária
- `afiliado_id` (UUID) - Referência ao afiliado
- `link_tracking_id` (UUID, opcional) - Link de tracking
- `produto_id` (UUID, opcional) - Produto associado
- `titulo` (VARCHAR 255) - Título do banner
- `mensagem` (TEXT, opcional) - Mensagem personalizada
- `imagem_url` (TEXT) - URL da imagem
- `link_afiliado` (TEXT) - Link de afiliado
- `codigo_html` (TEXT, opcional) - Código HTML gerado
- `ativo` (BOOLEAN) - Status do banner (default: true)
- `cliques` (INTEGER) - Contador de cliques (default: 0)
- `created_at` (TIMESTAMP) - Data de criação
- `updated_at` (TIMESTAMP) - Data de atualização

**Índices criados:**
- `idx_banner_afiliado_id` - Para busca por afiliado
- `idx_banner_link_tracking` - Para busca por link tracking
- `idx_banner_produto` - Para busca por produto
- `idx_banner_ativo` - Para filtros de status
- `idx_banner_created_at` - Para ordenação

---

### 3. Consultas Frontend (JavaScript)

#### Carregar banners no dashboard
**Arquivo:** `public/js/afiliadoDashboard.js` (linha 296-372)

```javascript
async function carregarBanners() {
    const response = await window.afiliadoAuth.authenticatedFetch(
        `${API_BASE}/afiliados/banners`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    );
    
    if (response.ok) {
        const data = await response.json();
        banners = data.data || [];
        renderizarTabelaBanners();
    }
}
```

---

### 4. Relacionamentos (Associações Sequelize)

**Arquivo:** `config/database.js` (linhas 1106-1109)

```javascript
BannerAfiliado.belongsTo(Afiliado, { foreignKey: 'afiliado_id', as: 'afiliado' });
BannerAfiliado.belongsTo(LinkTracking, { foreignKey: 'link_tracking_id', as: 'linkTracking' });
BannerAfiliado.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });
```

---

### 5. Consultas que NÃO existem (mas poderiam ser úteis)

#### Estatísticas de banners:
- ❌ Total de cliques por banner
- ❌ Taxa de conversão por banner
- ❌ Banners mais clicados
- ❌ Banners por período
- ❌ Estatísticas agregadas de performance

#### Consultas de performance:
- ❌ Banners ativos vs inativos
- ❌ Banners por produto
- ❌ Histórico de cliques por banner

---

### 6. Recomendações

1. **Adicionar consulta de estatísticas de banners:**
   - Total de cliques por banner
   - Taxa de conversão
   - Performance por período

2. **Adicionar filtros nas consultas:**
   - Filtrar por status (ativo/inativo)
   - Filtrar por produto
   - Filtrar por período

3. **Otimizar consultas:**
   - Adicionar paginação
   - Adicionar cache para banners frequentes
   - Adicionar índices adicionais se necessário

---

## Resumo

✅ **Consultas existentes:**
- Listar todos os banners do afiliado (com relacionamentos)
- Buscar banner específico (para atualização/deleção)
- Criar novo banner
- Upload de imagem para banner

❌ **Consultas que não existem:**
- Estatísticas de performance de banners
- Consultas agregadas de cliques
- Filtros avançados
- Paginação

