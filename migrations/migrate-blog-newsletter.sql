-- ===========================================
-- MIGRATION: NEWSLETTER DO BLOG
-- ===========================================
-- Este script cria a tabela de newsletter do blog
-- Idempotente: pode ser executado múltiplas vezes sem erros

-- Tabela blog_newsletter
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

-- Comentário na tabela
COMMENT ON TABLE blog_newsletter IS 'Tabela de assinantes da newsletter do blog';

-- Log de sucesso
DO $$
BEGIN
    RAISE NOTICE '✅ Tabela blog_newsletter criada com sucesso!';
END $$;

