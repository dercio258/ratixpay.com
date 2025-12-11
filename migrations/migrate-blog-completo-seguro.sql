-- ===========================================
-- MIGRATION: SISTEMA DE BLOG COMPLETO (SEGURO PARA DEPLOY)
-- ===========================================
-- Este script cria todas as tabelas necessárias para o sistema de blog
-- Idempotente: pode ser executado múltiplas vezes sem erros
-- Seguro: verifica existência antes de criar
-- 
-- USO:
--   psql -U postgres -d ratixpay -f migrations/migrate-blog-completo-seguro.sql
--
-- Ou execute diretamente:
--   sudo -u postgres psql -d ratixpay -f migrations/migrate-blog-completo-seguro.sql
-- ===========================================

BEGIN;

-- ===========================================
-- 1. TABELA blog_posts
-- ===========================================
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

-- Adicionar colunas que podem estar faltando (se não existirem)
DO $$
BEGIN
    -- Verificar e adicionar coluna se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_posts' AND column_name = 'subtitle'
    ) THEN
        ALTER TABLE blog_posts ADD COLUMN subtitle TEXT;
        RAISE NOTICE '✅ Coluna subtitle adicionada à tabela blog_posts';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_posts' AND column_name = 'meta_description'
    ) THEN
        ALTER TABLE blog_posts ADD COLUMN meta_description TEXT;
        RAISE NOTICE '✅ Coluna meta_description adicionada à tabela blog_posts';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_posts' AND column_name = 'meta_keywords'
    ) THEN
        ALTER TABLE blog_posts ADD COLUMN meta_keywords TEXT;
        RAISE NOTICE '✅ Coluna meta_keywords adicionada à tabela blog_posts';
    END IF;
END $$;

-- ===========================================
-- 2. TABELA blog_comments
-- ===========================================
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

-- Adicionar colunas que podem estar faltando
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_comments' AND column_name = 'reactions'
    ) THEN
        ALTER TABLE blog_comments ADD COLUMN reactions JSONB DEFAULT '{"like": 0, "bad": 0, "heart": 0, "fire": 0}'::jsonb;
        RAISE NOTICE '✅ Coluna reactions adicionada à tabela blog_comments';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_comments' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE blog_comments ADD COLUMN ip_address VARCHAR(45);
        RAISE NOTICE '✅ Coluna ip_address adicionada à tabela blog_comments';
    END IF;
END $$;

-- ===========================================
-- 3. TABELA blog_pages
-- ===========================================
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

-- Adicionar colunas que podem estar faltando
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_pages' AND column_name = 'meta_description'
    ) THEN
        ALTER TABLE blog_pages ADD COLUMN meta_description TEXT;
        RAISE NOTICE '✅ Coluna meta_description adicionada à tabela blog_pages';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_pages' AND column_name = 'meta_keywords'
    ) THEN
        ALTER TABLE blog_pages ADD COLUMN meta_keywords TEXT;
        RAISE NOTICE '✅ Coluna meta_keywords adicionada à tabela blog_pages';
    END IF;
END $$;

-- ===========================================
-- 4. TABELA blog_newsletter
-- ===========================================
CREATE TABLE IF NOT EXISTS blog_newsletter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    nome VARCHAR(255),
    notificar_novos_posts BOOLEAN DEFAULT TRUE,
    notificar_reacoes BOOLEAN DEFAULT TRUE,
    notificar_respostas BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'cancelado')),
    token_unsubscribe VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para blog_newsletter
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_email ON blog_newsletter(email);
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_user_id ON blog_newsletter(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_status ON blog_newsletter(status);
CREATE INDEX IF NOT EXISTS idx_blog_newsletter_token_unsubscribe ON blog_newsletter(token_unsubscribe);

-- ===========================================
-- COMENTÁRIOS NAS TABELAS
-- ===========================================
COMMENT ON TABLE blog_posts IS 'Tabela de posts do blog';
COMMENT ON TABLE blog_comments IS 'Tabela de comentários dos posts';
COMMENT ON TABLE blog_pages IS 'Tabela de páginas estáticas criadas pelo admin';
COMMENT ON TABLE blog_newsletter IS 'Tabela de assinantes da newsletter do blog';

-- ===========================================
-- VERIFICAÇÃO FINAL E LOG
-- ===========================================
DO $$
DECLARE
    posts_count INTEGER;
    comments_count INTEGER;
    pages_count INTEGER;
    newsletter_count INTEGER;
BEGIN
    -- Verificar se as tabelas foram criadas
    SELECT COUNT(*) INTO posts_count FROM information_schema.tables 
    WHERE table_name = 'blog_posts';
    
    SELECT COUNT(*) INTO comments_count FROM information_schema.tables 
    WHERE table_name = 'blog_comments';
    
    SELECT COUNT(*) INTO pages_count FROM information_schema.tables 
    WHERE table_name = 'blog_pages';
    
    SELECT COUNT(*) INTO newsletter_count FROM information_schema.tables 
    WHERE table_name = 'blog_newsletter';
    
    -- Log de sucesso
    IF posts_count > 0 THEN
        RAISE NOTICE '✅ Tabela blog_posts: OK';
    ELSE
        RAISE WARNING '⚠️ Tabela blog_posts não foi criada';
    END IF;
    
    IF comments_count > 0 THEN
        RAISE NOTICE '✅ Tabela blog_comments: OK';
    ELSE
        RAISE WARNING '⚠️ Tabela blog_comments não foi criada';
    END IF;
    
    IF pages_count > 0 THEN
        RAISE NOTICE '✅ Tabela blog_pages: OK';
    ELSE
        RAISE WARNING '⚠️ Tabela blog_pages não foi criada';
    END IF;
    
    IF newsletter_count > 0 THEN
        RAISE NOTICE '✅ Tabela blog_newsletter: OK';
    ELSE
        RAISE WARNING '⚠️ Tabela blog_newsletter não foi criada';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Migração do blog concluída com sucesso!';
    RAISE NOTICE '========================================';
END $$;

COMMIT;




