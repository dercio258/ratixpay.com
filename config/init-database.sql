-- ===========================================
-- RATIXPAY - INICIALIZAÇÃO DO BANCO DE DADOS
-- ===========================================

-- Criar usuário se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ratix') THEN
        CREATE ROLE ratix WITH LOGIN PASSWORD 'ratixpass';
    END IF;
END
$$;

-- Criar banco de dados se não existir
SELECT 'CREATE DATABASE ratixdb'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ratixdb')\gexec

-- Conectar ao banco ratixdb
\c ratixdb

-- Conceder privilégios
GRANT ALL PRIVILEGES ON DATABASE ratixdb TO ratix;
GRANT ALL PRIVILEGES ON SCHEMA public TO ratix;

-- Criar tabelas
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    tipo_usuario VARCHAR(50) DEFAULT 'vendedor',
    status VARCHAR(20) DEFAULT 'ativo',
    email_verificado BOOLEAN DEFAULT FALSE,
    telefone_verificado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10,2) NOT NULL,
    imagem_url VARCHAR(500),
    link_conteudo TEXT,
    status VARCHAR(20) DEFAULT 'ativo',
    -- Campos de afiliados
    permitir_afiliados BOOLEAN DEFAULT FALSE,
    comissao_afiliados DECIMAL(5,2) DEFAULT 0,
    comissao_minima DECIMAL(10,2) DEFAULT 0,
    tipo_comissao VARCHAR(20) DEFAULT 'percentual',
    tier_config JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_email VARCHAR(255) NOT NULL,
    cliente_telefone VARCHAR(20),
    pagamento_valor DECIMAL(10,2) NOT NULL,
    valor_final DECIMAL(10,2),
    pagamento_status VARCHAR(20) DEFAULT 'pendente',
    pagamento_metodo VARCHAR(50),
    numero_pedido VARCHAR(100),
    afiliado_ref VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS estatisticas_vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    data_venda DATE NOT NULL,
    total_vendas INTEGER DEFAULT 0,
    total_receita DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
    numero_telefone VARCHAR(20) NOT NULL,
    mensagem TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    enviado_em TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Afiliados
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
    status VARCHAR(20) DEFAULT 'ativo',
    total_vendas INTEGER DEFAULT 0,
    total_comissoes DECIMAL(10,2) DEFAULT 0.00,
    saldo_disponivel DECIMAL(10,2) DEFAULT 0.00,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_atividade TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Vendas de Afiliados
CREATE TABLE IF NOT EXISTS venda_afiliados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID REFERENCES afiliados(id) ON DELETE CASCADE,
    venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
    valor_venda DECIMAL(10,2) NOT NULL,
    comissao_percentual DECIMAL(5,2) NOT NULL,
    valor_comissao DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente',
    data_pagamento TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Link Tracking
CREATE TABLE IF NOT EXISTS link_trackings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    afiliado_id UUID REFERENCES afiliados(id) ON DELETE CASCADE,
    link_original TEXT NOT NULL,
    link_afiliado TEXT NOT NULL,
    produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
    cliques INTEGER DEFAULT 0,
    conversoes INTEGER DEFAULT 0,
    ultimo_clique TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX IF NOT EXISTS idx_produtos_vendedor ON produtos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_produtos_status ON produtos(status);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_produto ON vendas(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_status ON vendas(pagamento_status);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(created_at);
CREATE INDEX IF NOT EXISTS idx_stats_vendedor ON estatisticas_vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_stats_data ON estatisticas_vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_whatsapp_vendedor ON whatsapp_messages(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_venda ON whatsapp_messages(venda_id);

-- Índices para tabelas de afiliados
CREATE INDEX IF NOT EXISTS idx_afiliados_email ON afiliados(email);
CREATE INDEX IF NOT EXISTS idx_afiliados_codigo ON afiliados(codigo_afiliado);
CREATE INDEX IF NOT EXISTS idx_afiliados_status ON afiliados(status);
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_afiliado ON venda_afiliados(afiliado_id);
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_venda ON venda_afiliados(venda_id);
CREATE INDEX IF NOT EXISTS idx_venda_afiliados_status ON venda_afiliados(status);
CREATE INDEX IF NOT EXISTS idx_link_trackings_afiliado ON link_trackings(afiliado_id);
CREATE INDEX IF NOT EXISTS idx_link_trackings_produto ON link_trackings(produto_id);

-- Inserir usuário admin padrão
INSERT INTO usuarios (nome_completo, email, senha, tipo_usuario, status, email_verificado)
VALUES ('Administrador RatixPay', 'admin@ratixpay.com', '$2b$10$rQZ8K9mN2pL3sT4uV5wX6yA7bC8dE9fG0hI1jK2lM3nO4pQ5rS6tU7vW8xY9zA', 'admin', 'ativo', true)
ON CONFLICT (email) DO NOTHING;

-- Conceder privilégios nas tabelas
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ratix;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ratix;
