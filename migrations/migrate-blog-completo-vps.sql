-- ===========================================
-- MIGRATION: SISTEMA DE BLOG COMPLETO
-- ===========================================
-- Este script cria todas as tabelas necessárias para o sistema de blog
-- Idempotente: pode ser executado múltiplas vezes sem erros

-- 1. Tabela blog_posts
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

-- 2. Tabela blog_comments
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

-- 3. Tabela blog_pages
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

-- Comentários nas tabelas
COMMENT ON TABLE blog_posts IS 'Tabela de posts do blog';
COMMENT ON TABLE blog_comments IS 'Tabela de comentários dos posts';
COMMENT ON TABLE blog_pages IS 'Tabela de páginas estáticas criadas pelo admin';

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Tabelas do blog criadas com sucesso!';
    RAISE NOTICE '📊 blog_posts: OK';
    RAISE NOTICE '📊 blog_comments: OK';
    RAISE NOTICE '📊 blog_pages: OK';
END $$;

