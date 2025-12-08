-- =====================================================
-- MIGRAÇÃO UNIFICADA: BLOG + REMARKETING + AFILIADOS
-- =====================================================
-- Este script cria todas as tabelas necessárias para:
-- 1. Sistema de Blog (posts, comentários, páginas, newsletter)
-- 2. Sistema de Remarketing (fila de remarketing, conversões)
-- 3. Sistema de Afiliados (completo com cliques e comissões)
--
-- IDEMPOTENTE: Pode ser executado múltiplas vezes sem erros
-- =====================================================
--
-- USO:
--   psql -U postgres -d ratixpay -f migrations/migrate-all-systems-unified.sql
--
-- Ou execute diretamente:
--   sudo -u postgres psql -d ratixpay -f migrations/migrate-all-systems-unified.sql
-- =====================================================

BEGIN;

-- =====================================================
-- PARTE 1: SISTEMA DE BLOG
-- =====================================================

-- 1.1 Tabela blog_posts
CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    subtitle TEXT,
    content TEXT NOT NULL,
    image VARCHAR(500),
    category VARCHAR(100),
    tags JSONB DEFAULT '[]'::jsonb,
    author_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
    published_at TIMESTAMP,
    meta_description TEXT,
    meta_keywords TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para blog_posts
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_blog_posts_views ON blog_posts(views DESC);

-- 1.2 Tabela blog_comments
CREATE TABLE IF NOT EXISTS blog_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    comment TEXT NOT NULL,
    parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reactions JSONB DEFAULT '{"like": 0, "bad": 0, "heart": 0, "fire": 0}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para blog_comments
CREATE INDEX IF NOT EXISTS idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user_id ON blog_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_status ON blog_comments(status);

-- 1.3 Tabela blog_pages
CREATE TABLE IF NOT EXISTS blog_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
    meta_description TEXT,
    meta_keywords TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para blog_pages
CREATE INDEX IF NOT EXISTS idx_blog_pages_slug ON blog_pages(slug);
CREATE INDEX IF NOT EXISTS idx_blog_pages_status ON blog_pages(status);

-- 1.4 Tabela blog_newsletter
CREATE TABLE IF NOT EXISTS blog_newsletter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    nome VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'cancelado')),
    preferencias JSONB DEFAULT '{
        "novos_posts": true,
        "reacoes": true,
        "respostas": true
    }'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email, user_id)
);

-- Índices para blog_newsletter
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_email ON blog_newsletter(email);
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_user_id ON blog_newsletter(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_status ON blog_newsletter(status);

-- =====================================================
-- PARTE 2: SISTEMA DE REMARKETING
-- =====================================================

-- 2.1 Tabela remarketing_queue
CREATE TABLE IF NOT EXISTS remarketing_queue (
    id SERIAL PRIMARY KEY,
    cliente_id UUID NOT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    produto_id UUID NOT NULL,
    produto_nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pendente' NOT NULL CHECK (status IN ('pendente', 'enviado', 'ignorado', 'cancelado')),
    data_cancelamento TIMESTAMP NOT NULL,
    tempo_envio INTEGER DEFAULT 0,
    data_agendada TIMESTAMP NOT NULL,
    tentativas INTEGER DEFAULT 0,
    motivo_ignorado TEXT,
    venda_cancelada_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
    FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE SET NULL
);

-- Índices para remarketing_queue
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_status ON remarketing_queue(status);
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_data_agendada ON remarketing_queue(data_agendada);
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_cliente_produto ON remarketing_queue(cliente_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_email ON remarketing_queue(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_produto_id ON remarketing_queue(produto_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_queue_venda_cancelada ON remarketing_queue(venda_cancelada_id);

-- 2.2 Tabela remarketing_conversoes
CREATE TABLE IF NOT EXISTS remarketing_conversoes (
    id SERIAL PRIMARY KEY,
    remarketing_queue_id INTEGER NOT NULL,
    venda_cancelada_id UUID NOT NULL,
    venda_aprovada_id UUID NOT NULL,
    cliente_id UUID,
    cliente_nome VARCHAR(255) NOT NULL,
    produto_id UUID NOT NULL,
    produto_nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    data_cancelamento TIMESTAMP NOT NULL,
    data_remarketing_enviado TIMESTAMP,
    data_conversao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_venda_cancelada DECIMAL(10, 2),
    valor_venda_aprovada DECIMAL(10, 2),
    tempo_ate_conversao_minutos INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remarketing_queue_id) REFERENCES remarketing_queue(id) ON DELETE CASCADE,
    FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE CASCADE,
    FOREIGN KEY (venda_aprovada_id) REFERENCES vendas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
);

-- Índices para remarketing_conversoes
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_queue ON remarketing_conversoes(remarketing_queue_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_venda_cancelada ON remarketing_conversoes(venda_cancelada_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_venda_aprovada ON remarketing_conversoes(venda_aprovada_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_cliente ON remarketing_conversoes(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_produto ON remarketing_conversoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_conversoes_data_conversao ON remarketing_conversoes(data_conversao);

-- 2.3 Adicionar campo remarketing_config na tabela produtos
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'produtos'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'produtos' 
            AND column_name = 'remarketing_config'
        ) THEN
            ALTER TABLE produtos ADD COLUMN remarketing_config JSON;
            COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}';
        END IF;
    END IF;
END $$;

-- =====================================================
-- PARTE 3: SISTEMA DE AFILIADOS
-- =====================================================

-- 3.1 Tabela afiliados (completa)
CREATE TABLE IF NOT EXISTS afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    token_reset_senha VARCHAR(255),
    token_reset_expires TIMESTAMP,
    telefone VARCHAR(20),
    codigo_afiliado VARCHAR(20) UNIQUE NOT NULL,
    link_afiliado TEXT NOT NULL,
    comissao_percentual DECIMAL(5,2) DEFAULT 10.00,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
    total_vendas INTEGER DEFAULT 0,
    total_comissoes DECIMAL(10,2) DEFAULT 0.00,
    saldo_disponivel DECIMAL(10,2) DEFAULT 0.00,
    total_cliques INTEGER DEFAULT 0,
    cliques_pagos INTEGER DEFAULT 0,
    creditos_cliques DECIMAL(10,2) DEFAULT 0.00,
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    email_verificado BOOLEAN DEFAULT FALSE,
    codigo_verificacao VARCHAR(10),
    codigo_verificacao_expira TIMESTAMP,
    meta_pixel_id VARCHAR(50),
    utmify_api_token TEXT,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_atividade TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para afiliados
CREATE INDEX IF NOT EXISTS idx_afiliados_email ON afiliados(email);
CREATE INDEX IF NOT EXISTS idx_afiliados_codigo_afiliado ON afiliados(codigo_afiliado);
CREATE INDEX IF NOT EXISTS idx_afiliados_status ON afiliados(status);
CREATE INDEX IF NOT EXISTS idx_afiliados_vendedor_id ON afiliados(vendedor_id);

-- 3.2 Tabela venda_afiliados
CREATE TABLE IF NOT EXISTS venda_afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    venda_id UUID NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
    valor_venda DECIMAL(10,2) NOT NULL,
    comissao_percentual DECIMAL(5,2) NOT NULL,
    valor_comissao DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
    data_pagamento TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para venda_afiliados
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_afiliado_id ON venda_afiliados(afiliado_id);
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_venda_id ON venda_afiliados(venda_id);
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_status ON venda_afiliados(status);

-- 3.3 Tabela link_trackings
CREATE TABLE IF NOT EXISTS link_trackings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
    link_original TEXT NOT NULL,
    link_afiliado TEXT NOT NULL,
    produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
    cliques INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    ultimo_clique TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para link_trackings
CREATE INDEX IF NOT EXISTS idx_link_trackings_afiliado_id ON link_trackings(afiliado_id);
CREATE INDEX IF NOT EXISTS idx_link_trackings_produto_id ON link_trackings(produto_id);
CREATE INDEX IF NOT EXISTS idx_link_trackings_link_afiliado ON link_trackings(link_afiliado);

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE blog_posts IS 'Posts do blog com sistema completo de publicação';
COMMENT ON TABLE blog_comments IS 'Comentários e respostas dos posts do blog';
COMMENT ON TABLE blog_pages IS 'Páginas estáticas criadas pelo admin';
COMMENT ON TABLE blog_newsletter IS 'Inscritos na newsletter do blog';

COMMENT ON TABLE remarketing_queue IS 'Fila de remarketing para vendas canceladas';
COMMENT ON TABLE remarketing_conversoes IS 'Rastreamento de conversões de remarketing';

COMMENT ON TABLE afiliados IS 'Sistema completo de afiliados com cliques e comissões';
COMMENT ON TABLE venda_afiliados IS 'Vendas associadas a afiliados';
COMMENT ON TABLE link_trackings IS 'Rastreamento de cliques nos links de afiliados';

COMMIT;

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MIGRAÇÃO UNIFICADA CONCLUÍDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tabelas do BLOG:';
    RAISE NOTICE '  ✅ blog_posts';
    RAISE NOTICE '  ✅ blog_comments';
    RAISE NOTICE '  ✅ blog_pages';
    RAISE NOTICE '  ✅ blog_newsletter';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tabelas de REMARKETING:';
    RAISE NOTICE '  ✅ remarketing_queue';
    RAISE NOTICE '  ✅ remarketing_conversoes';
    RAISE NOTICE '  ✅ produtos.remarketing_config';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tabelas de AFILIADOS:';
    RAISE NOTICE '  ✅ afiliados';
    RAISE NOTICE '  ✅ venda_afiliados';
    RAISE NOTICE '  ✅ link_trackings';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;

