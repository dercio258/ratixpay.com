-- ===========================================
-- REPLICAÇÃO COMPLETA DA ESTRUTURA DO BANCO DE DADOS
-- ===========================================
-- Este script replica a estrutura completa do banco de dados local na VPS
-- Baseado no modelo database.js e todas as migrações
-- Execute como: sudo -u postgres psql -d ratixpay -f scripts/replicar-estrutura-banco-completo-vps.sql

-- 1. CORRIGIR PERMISSÕES DO SCHEMA PUBLIC
DO $$
BEGIN
    -- Ler variável de ambiente ou usar padrão
    PERFORM set_config('app.db_user', COALESCE(current_setting('app.db_user', true), 'ratixuser'), false);
END $$;

DO $$
DECLARE
    db_user TEXT := COALESCE(current_setting('app.db_user', true), 'ratixuser');
BEGIN
    -- Conceder uso do schema public
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', db_user);
    EXECUTE format('GRANT CREATE ON SCHEMA public TO %I', db_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO %I', db_user);
    EXECUTE format('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO %I', db_user);
    
    -- Permissões padrão para objetos futuros
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO %I', db_user);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO %I', db_user);
    
    RAISE NOTICE 'Permissões do schema public concedidas ao usuário: %', db_user;
END $$;

-- 2. CRIAR ENUMS NECESSÁRIOS
DO $$
BEGIN
    -- Enum para status_aprovacao
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_aprovacao_enum') THEN
        CREATE TYPE status_aprovacao_enum AS ENUM ('aprovado', 'rejeitado', 'pendente_aprovacao');
        RAISE NOTICE 'Enum status_aprovacao_enum criado';
    END IF;
    
    -- Enum para role de usuário
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        CREATE TYPE role_enum AS ENUM ('admin', 'user');
        RAISE NOTICE 'Enum role_enum criado';
    END IF;
    
    -- Enum para status de usuário
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_usuario_enum') THEN
        CREATE TYPE status_usuario_enum AS ENUM ('Ativa', 'Bloqueada');
        RAISE NOTICE 'Enum status_usuario_enum criado';
    END IF;
    
    -- Enum para auth_provider
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_provider_enum') THEN
        CREATE TYPE auth_provider_enum AS ENUM ('local', 'google', 'local+google');
        RAISE NOTICE 'Enum auth_provider_enum criado';
    END IF;
    
    -- Enum para tipo_comissao
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_comissao_enum') THEN
        CREATE TYPE tipo_comissao_enum AS ENUM ('percentual', 'fixo', 'tier');
        RAISE NOTICE 'Enum tipo_comissao_enum criado';
    END IF;
    
    -- Enum para status de afiliado
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_afiliado_enum') THEN
        CREATE TYPE status_afiliado_enum AS ENUM ('ativo', 'inativo', 'suspenso');
        RAISE NOTICE 'Enum status_afiliado_enum criado';
    END IF;
    
    -- Enum para status de venda afiliado
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_venda_afiliado_enum') THEN
        CREATE TYPE status_venda_afiliado_enum AS ENUM ('pendente', 'pago', 'cancelado');
        RAISE NOTICE 'Enum status_venda_afiliado_enum criado';
    END IF;
    
    -- Enum para utmfy_token_type
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'utmfy_token_type_enum') THEN
        CREATE TYPE utmfy_token_type_enum AS ENUM ('utmify');
        RAISE NOTICE 'Enum utmfy_token_type_enum criado';
    END IF;
END $$;

-- 3. CRIAR TABELA USUARIOS (completa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        CREATE TABLE usuarios (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            public_id VARCHAR(6) UNIQUE NOT NULL,
            legacy_id INTEGER,
            password VARCHAR(255),
            password_hash VARCHAR(255),
            nome VARCHAR(255) NOT NULL,
            nome_completo VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            telefone VARCHAR(20),
            whatsapp_contact VARCHAR(20),
            whatsapp_enabled BOOLEAN DEFAULT false,
            whatsapp_notification_types JSON DEFAULT '[]',
            google_user BOOLEAN DEFAULT false,
            auth_provider auth_provider_enum DEFAULT 'local',
            google_id VARCHAR(255) UNIQUE,
            contact_configured BOOLEAN DEFAULT false,
            role role_enum DEFAULT 'user',
            vendedor_id VARCHAR(255) UNIQUE,
            status status_usuario_enum DEFAULT 'Ativa',
            notificacoes INTEGER DEFAULT 0,
            email_verificado BOOLEAN DEFAULT false,
            telefone_verificado BOOLEAN DEFAULT false,
            codigo_verificacao VARCHAR(255),
            codigo_verificacao_expira TIMESTAMP,
            ativo BOOLEAN DEFAULT true,
            suspenso BOOLEAN DEFAULT false,
            motivo_suspensao TEXT,
            data_suspensao TIMESTAMP,
            ultimo_login TIMESTAMP,
            last_login TIMESTAMP,
            tentativas_login INTEGER DEFAULT 0,
            login_attempts INTEGER DEFAULT 0,
            bloqueado_ate TIMESTAMP,
            locked_until TIMESTAMP,
            reset_token VARCHAR(255),
            reset_token_expira TIMESTAMP,
            plano VARCHAR(255) DEFAULT 'gratuito',
            marketing_avancado BOOLEAN DEFAULT false,
            avatar_url TEXT,
            push_subscription TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        COMMENT ON TABLE usuarios IS 'Usuários do sistema (vendedores e administradores)';
        COMMENT ON COLUMN usuarios.public_id IS 'ID público de 6 dígitos';
        COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt da senha para login local';
        COMMENT ON COLUMN usuarios.whatsapp_notification_types IS 'Array de tipos de notificações WhatsApp';
        COMMENT ON COLUMN usuarios.auth_provider IS 'Provedor de autenticação';
        COMMENT ON COLUMN usuarios.role IS 'user = vendedor, admin = administrador';
        
        CREATE INDEX idx_usuarios_email ON usuarios(email);
        CREATE INDEX idx_usuarios_public_id ON usuarios(public_id);
        CREATE INDEX idx_usuarios_role ON usuarios(role);
        CREATE INDEX idx_usuarios_status ON usuarios(status);
        CREATE INDEX idx_usuarios_google_id ON usuarios(google_id) WHERE google_id IS NOT NULL;
        
        RAISE NOTICE 'Tabela usuarios criada';
    END IF;
END $$;

-- 4. ADICIONAR COLUNAS FALTANTES NA TABELA USUARIOS
DO $$
BEGIN
    -- Adicionar colunas que podem não existir
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS whatsapp_notification_types JSON DEFAULT '[]';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS push_subscription TEXT;
END $$;

-- 5. CRIAR TABELA PRODUTOS (completa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'produtos') THEN
        CREATE TABLE produtos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            public_id VARCHAR(6) UNIQUE NOT NULL,
            legacy_id INTEGER,
            custom_id VARCHAR(255) UNIQUE NOT NULL,
            vendedor_id UUID NOT NULL,
            vendedor_legacy_id INTEGER,
            nome VARCHAR(255) NOT NULL,
            tipo VARCHAR(255) NOT NULL,
            categoria VARCHAR(255),
            preco DECIMAL(10, 2) DEFAULT 0,
            desconto DECIMAL(5, 2) DEFAULT 0,
            preco_com_desconto DECIMAL(10, 2) DEFAULT 0,
            descricao TEXT,
            link_conteudo TEXT,
            imagem_url TEXT,
            imagem_public_id VARCHAR(255),
            imagem_conteudo TEXT,
            imagem_tipo VARCHAR(255),
            status_criacao VARCHAR(255) DEFAULT 'iniciado',
            status_aprovacao status_aprovacao_enum DEFAULT 'aprovado',
            motivo_rejeicao TEXT,
            ativo BOOLEAN DEFAULT false,
            vendas INTEGER DEFAULT 0,
            expert_id UUID,
            order_bump_ativo BOOLEAN DEFAULT false,
            order_bump_produtos JSON,
            discount_config JSON,
            timer_config JSON,
            blackfriday_config JSON,
            remarketing_config JSON,
            permitir_afiliados BOOLEAN DEFAULT false,
            comissao_afiliados DECIMAL(5, 2) DEFAULT 0,
            comissao_minima DECIMAL(10, 2) DEFAULT 0,
            tipo_comissao tipo_comissao_enum DEFAULT 'percentual',
            tier_config JSON,
            pixel_id VARCHAR(50),
            pixel_events JSON,
            utmfy_api_key VARCHAR(255),
            utmfy_token_type utmfy_token_type_enum,
            utmfy_events JSON,
            utmfy_active BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_produto_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        
        COMMENT ON TABLE produtos IS 'Produtos cadastrados pelos vendedores';
        COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação do produto';
        COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';
        COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático';
        
        CREATE INDEX idx_produtos_vendedor_id ON produtos(vendedor_id);
        CREATE INDEX idx_produtos_public_id ON produtos(public_id);
        CREATE INDEX idx_produtos_custom_id ON produtos(custom_id);
        CREATE INDEX idx_produtos_ativo ON produtos(ativo);
        CREATE INDEX idx_produtos_status_aprovacao ON produtos(status_aprovacao);
        CREATE INDEX idx_produtos_permitir_afiliados ON produtos(permitir_afiliados) WHERE permitir_afiliados = true;
        
        RAISE NOTICE 'Tabela produtos criada';
    END IF;
END $$;

-- 6. ADICIONAR COLUNAS FALTANTES NA TABELA PRODUTOS
DO $$
BEGIN
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(50) DEFAULT 'aprovado';
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
    ALTER TABLE produtos ADD COLUMN IF NOT EXISTS remarketing_config JSON;
    
    -- Atualizar constraint se necessário
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'produtos' AND column_name = 'status_aprovacao'
               AND data_type = 'character varying') THEN
        -- Alterar para enum se não for já enum
        BEGIN
            ALTER TABLE produtos ALTER COLUMN status_aprovacao TYPE status_aprovacao_enum USING status_aprovacao::status_aprovacao_enum;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível converter status_aprovacao para enum: %', SQLERRM;
        END;
    END IF;
END $$;

-- 7. CRIAR TABELA VENDAS (completa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendas') THEN
        CREATE TABLE vendas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            public_id VARCHAR(6) UNIQUE NOT NULL,
            legacy_id INTEGER,
            produto_id UUID NOT NULL,
            vendedor_id UUID NOT NULL,
            cliente_id UUID,
            valor DECIMAL(10, 2) NOT NULL,
            valor_vendedor DECIMAL(10, 2) NOT NULL,
            taxa_admin DECIMAL(10, 2) NOT NULL,
            cliente_nome VARCHAR(255) NOT NULL,
            cliente_email VARCHAR(255) NOT NULL,
            cliente_telefone VARCHAR(20),
            cliente_whatsapp VARCHAR(20),
            numero_celular VARCHAR(20),
            metodo_pagamento VARCHAR(255),
            data_pagamento TIMESTAMP,
            referencia_pagamento VARCHAR(255),
            link_conteudo TEXT,
            numero_pedido VARCHAR(6) UNIQUE,
            afiliado_ref VARCHAR(20),
            status VARCHAR(255) DEFAULT 'Pendente',
            observacoes TEXT,
            tracking_data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_venda_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
            CONSTRAINT fk_venda_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        
        CREATE INDEX idx_vendas_produto_id ON vendas(produto_id);
        CREATE INDEX idx_vendas_vendedor_id ON vendas(vendedor_id);
        CREATE INDEX idx_vendas_status ON vendas(status);
        CREATE INDEX idx_vendas_created_at ON vendas(created_at);
        CREATE INDEX idx_vendas_afiliado_ref ON vendas(afiliado_ref) WHERE afiliado_ref IS NOT NULL;
        
        RAISE NOTICE 'Tabela vendas criada';
    END IF;
END $$;

-- 8. CRIAR TABELA CARTEIRAS (completa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras') THEN
        CREATE TABLE carteiras (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            vendedor_id UUID UNIQUE NOT NULL,
            nome VARCHAR(255) DEFAULT 'Carteira Principal',
            contacto_mpesa VARCHAR(20) NOT NULL,
            nome_titular_mpesa VARCHAR(255) NOT NULL,
            contacto_emola VARCHAR(20) NOT NULL,
            nome_titular_emola VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            saldo_disponivel DECIMAL(10, 2) DEFAULT 0,
            saldo_bloqueado DECIMAL(10, 2) DEFAULT 0,
            saldo_total DECIMAL(10, 2) DEFAULT 0,
            ativa BOOLEAN DEFAULT true,
            metodo_saque VARCHAR(50) DEFAULT 'Mpesa',
            contacto VARCHAR(20) DEFAULT '',
            nome_titular VARCHAR(255) DEFAULT '',
            email_titular VARCHAR(255) DEFAULT '',
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_carteira_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        
        COMMENT ON COLUMN carteiras.contacto_mpesa IS 'Número de contacto Mpesa';
        COMMENT ON COLUMN carteiras.nome_titular_mpesa IS 'Nome do titular Mpesa';
        COMMENT ON COLUMN carteiras.contacto_emola IS 'Número de contacto Emola';
        COMMENT ON COLUMN carteiras.nome_titular_emola IS 'Nome do titular Emola';
        COMMENT ON COLUMN carteiras.email IS 'Email do titular';
        
        CREATE INDEX idx_carteiras_vendedor_id ON carteiras(vendedor_id);
        
        RAISE NOTICE 'Tabela carteiras criada';
    END IF;
END $$;

-- 9. ADICIONAR COLUNAS FALTANTES NA TABELA CARTEIRAS
DO $$
BEGIN
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS nome VARCHAR(255) DEFAULT 'Carteira Principal';
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS contacto_mpesa VARCHAR(20);
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS nome_titular_mpesa VARCHAR(255);
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS contacto_emola VARCHAR(20);
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS nome_titular_emola VARCHAR(255);
    ALTER TABLE carteiras ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    
    -- Adicionar constraint unique em vendedor_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'carteiras_vendedor_id_key'
    ) THEN
        -- Remover duplicatas primeiro
        DELETE FROM carteiras c1
        WHERE EXISTS (
            SELECT 1 FROM carteiras c2
            WHERE c2.vendedor_id = c1.vendedor_id
            AND c2.id != c1.id
        );
        
        ALTER TABLE carteiras ADD CONSTRAINT carteiras_vendedor_id_key UNIQUE (vendedor_id);
    END IF;
END $$;

-- 10. CRIAR TABELA PAGAMENTOS (completa)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pagamentos') THEN
        CREATE TABLE pagamentos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            public_id VARCHAR(20) UNIQUE,
            vendedor_id UUID NOT NULL,
            valor DECIMAL(10, 2) NOT NULL,
            valor_liquido DECIMAL(10, 2),
            taxa DECIMAL(10, 2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'pendente',
            metodo VARCHAR(50),
            metodo_pagamento VARCHAR(50),
            dados_pagamento JSON,
            nome_titular VARCHAR(255),
            telefone_titular VARCHAR(20),
            conta_destino VARCHAR(50),
            banco VARCHAR(100),
            data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_processamento TIMESTAMP,
            data_pagamento TIMESTAMP,
            observacoes TEXT,
            motivo_rejeicao TEXT,
            ip_solicitacao VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_pagamento_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
        );
        
        COMMENT ON COLUMN pagamentos.public_id IS 'ID público memorável para exibição e pesquisa';
        COMMENT ON COLUMN pagamentos.valor_liquido IS 'Valor líquido após dedução de taxas';
        COMMENT ON COLUMN pagamentos.taxa IS 'Taxa aplicada ao saque';
        
        CREATE INDEX idx_pagamentos_vendedor_id ON pagamentos(vendedor_id);
        CREATE INDEX idx_pagamentos_status ON pagamentos(status);
        CREATE INDEX idx_pagamentos_public_id ON pagamentos(public_id) WHERE public_id IS NOT NULL;
        
        RAISE NOTICE 'Tabela pagamentos criada';
    END IF;
END $$;

-- 11. ADICIONAR COLUNAS FALTANTES NA TABELA PAGAMENTOS
DO $$
BEGIN
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS public_id VARCHAR(20);
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS valor_liquido DECIMAL(10, 2);
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS taxa DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS nome_titular VARCHAR(255);
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS ip_solicitacao VARCHAR(45);
    ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS user_agent TEXT;
    
    -- Criar índice único para public_id se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'pagamentos_public_id_key'
    ) THEN
        CREATE UNIQUE INDEX pagamentos_public_id_key ON pagamentos(public_id) WHERE public_id IS NOT NULL;
    END IF;
END $$;

-- Continuar nas próximas partes devido ao limite de tamanho...

