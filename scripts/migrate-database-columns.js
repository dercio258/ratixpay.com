/**
 * Script de Migração Automática de Colunas do Banco de Dados
 * Conecta usando credenciais do .env e atualiza colunas necessárias
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuração do banco de dados a partir do .env
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ratixpay',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
};

// Criar conexão Sequelize
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging
    }
);

// Migrações necessárias
const migrations = [
    {
        name: 'add_cliente_whatsapp_to_vendas',
        sql: `
            -- Adicionar coluna cliente_whatsapp na tabela vendas se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'cliente_whatsapp'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN cliente_whatsapp VARCHAR(255);
                    RAISE NOTICE 'Coluna cliente_whatsapp adicionada à tabela vendas';
                ELSE
                    RAISE NOTICE 'Coluna cliente_whatsapp já existe na tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_carteira_fields',
        sql: `
            -- Adicionar campos de carteira se não existirem
            DO $$ 
            BEGIN
                -- Verificar se tabela carteiras existe
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras') THEN
                    -- Adicionar coluna tipo_carteira se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'tipo_carteira'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN tipo_carteira VARCHAR(50) DEFAULT 'mpesa';
                        RAISE NOTICE 'Coluna tipo_carteira adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna status se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'status'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN status VARCHAR(20) DEFAULT 'ativo';
                        RAISE NOTICE 'Coluna status adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna created_at se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'created_at'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                        RAISE NOTICE 'Coluna created_at adicionada à tabela carteiras';
                    END IF;

                    -- Adicionar coluna updated_at se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'updated_at'
                    ) THEN
                        ALTER TABLE carteiras ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                        RAISE NOTICE 'Coluna updated_at adicionada à tabela carteiras';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela carteiras não existe, pulando migração';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_nome_to_carteiras',
        sql: `
            -- Adicionar coluna "nome" à tabela carteiras se não existir
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras') THEN
                    -- Verificar e adicionar coluna "nome" se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'carteiras' 
                        AND column_name = 'nome'
                    ) THEN
                        ALTER TABLE carteiras 
                        ADD COLUMN nome VARCHAR(255) NOT NULL DEFAULT 'Carteira Principal';
                        
                        COMMENT ON COLUMN carteiras.nome IS 'Nome da carteira';
                        
                        RAISE NOTICE 'Coluna nome adicionada com sucesso à tabela carteiras';
                    ELSE
                        -- Se a coluna já existe, garantir que registros sem nome tenham um valor padrão
                        UPDATE carteiras 
                        SET nome = 'Carteira Principal' 
                        WHERE nome IS NULL OR nome = '';
                        
                        -- Garantir que a coluna não aceite NULL
                        ALTER TABLE carteiras 
                        ALTER COLUMN nome SET NOT NULL;
                        
                        -- Garantir que tenha valor padrão
                        ALTER TABLE carteiras 
                        ALTER COLUMN nome SET DEFAULT 'Carteira Principal';
                        
                        RAISE NOTICE 'Coluna nome já existe, valores padrão atualizados';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela carteiras não existe, pulando migração';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_tracking_data_to_vendas',
        sql: `
            -- Adicionar coluna tracking_data (JSONB) se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'tracking_data'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN tracking_data JSONB;
                    RAISE NOTICE 'Coluna tracking_data adicionada à tabela vendas';
                ELSE
                    RAISE NOTICE 'Coluna tracking_data já existe na tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_timestamps_to_vendas',
        sql: `
            -- Adicionar timestamps se não existirem
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'created_at'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    RAISE NOTICE 'Coluna created_at adicionada à tabela vendas';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'vendas' 
                    AND column_name = 'updated_at'
                ) THEN
                    ALTER TABLE vendas ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                    RAISE NOTICE 'Coluna updated_at adicionada à tabela vendas';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_email_verification_to_afiliados',
        sql: `
            -- Adicionar campos de verificação de email na tabela afiliados
            DO $$ 
            BEGIN
                -- Verificar se tabela afiliados existe
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'afiliados') THEN
                    -- Adicionar coluna email_verificado se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'email_verificado'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN email_verificado BOOLEAN DEFAULT false NOT NULL;
                        RAISE NOTICE 'Coluna email_verificado adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna email_verificado já existe na tabela afiliados';
                    END IF;

                    -- Adicionar coluna codigo_verificacao se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'codigo_verificacao'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN codigo_verificacao VARCHAR(10);
                        RAISE NOTICE 'Coluna codigo_verificacao adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna codigo_verificacao já existe na tabela afiliados';
                    END IF;

                    -- Adicionar coluna codigo_verificacao_expira se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'codigo_verificacao_expira'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN codigo_verificacao_expira TIMESTAMP;
                        RAISE NOTICE 'Coluna codigo_verificacao_expira adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna codigo_verificacao_expira já existe na tabela afiliados';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela afiliados não existe, pulando migração';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_vendedor_id_to_afiliados',
        sql: `
            -- Adicionar coluna vendedor_id na tabela afiliados se não existir
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'afiliados') THEN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'vendedor_id'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN vendedor_id UUID NULL;
                        COMMENT ON COLUMN afiliados.vendedor_id IS 'ID do vendedor associado (se o afiliado for um vendedor)';
                        
                        -- Adicionar foreign key se a tabela usuarios existir
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usuarios') THEN
                            ALTER TABLE afiliados
                            ADD CONSTRAINT fk_afiliados_vendedor 
                            FOREIGN KEY (vendedor_id) 
                            REFERENCES usuarios(id) 
                            ON DELETE SET NULL;
                        END IF;
                        
                        RAISE NOTICE 'Coluna vendedor_id adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna vendedor_id já existe na tabela afiliados';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela afiliados não existe, pulando migração';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_remarketing_config_to_produtos',
        sql: `
            -- Adicionar coluna remarketing_config (JSON) na tabela produtos se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'produtos' 
                    AND column_name = 'remarketing_config'
                ) THEN
                    ALTER TABLE produtos ADD COLUMN remarketing_config JSON;
                    COMMENT ON COLUMN produtos.remarketing_config IS 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}';
                    RAISE NOTICE 'Coluna remarketing_config adicionada à tabela produtos';
                ELSE
                    RAISE NOTICE 'Coluna remarketing_config já existe na tabela produtos';
                END IF;
            END $$;
        `
    },
    {
        name: 'create_remarketing_queue_table',
        sql: `
            -- Criar tabela remarketing_queue se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'remarketing_queue'
                ) THEN
                    CREATE TABLE remarketing_queue (
                        id SERIAL PRIMARY KEY,
                        cliente_id UUID NOT NULL,
                        cliente_nome VARCHAR(255) NOT NULL,
                        produto_id UUID NOT NULL,
                        produto_nome VARCHAR(255) NOT NULL,
                        email VARCHAR(255),
                        telefone VARCHAR(50),
                        status VARCHAR(20) DEFAULT 'pendente' NOT NULL,
                        data_cancelamento TIMESTAMP NOT NULL,
                        tempo_envio INTEGER DEFAULT 0,
                        data_agendada TIMESTAMP NOT NULL,
                        tentativas INTEGER DEFAULT 0,
                        motivo_ignorado TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    -- Criar índices para melhor performance
                    CREATE INDEX idx_remarketing_queue_status ON remarketing_queue(status);
                    CREATE INDEX idx_remarketing_queue_data_agendada ON remarketing_queue(data_agendada);
                    CREATE INDEX idx_remarketing_queue_cliente_produto ON remarketing_queue(cliente_id, produto_id);
                    CREATE INDEX idx_remarketing_queue_email ON remarketing_queue(email) WHERE email IS NOT NULL;
                    
                    COMMENT ON TABLE remarketing_queue IS 'Fila de remarketing para vendas canceladas';
                    COMMENT ON COLUMN remarketing_queue.status IS 'Status: pendente, enviado, ignorado';
                    COMMENT ON COLUMN remarketing_queue.tempo_envio IS 'Tempo em minutos até o envio';
                    
                    RAISE NOTICE 'Tabela remarketing_queue criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela remarketing_queue já existe';
                END IF;
            END $$;
        `
    },
    {
        name: 'create_webhooks_table',
        sql: `
            -- Criar tabela webhooks se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'webhooks'
                ) THEN
                    CREATE TABLE webhooks (
                        id VARCHAR(255) PRIMARY KEY,
                        user_id UUID NOT NULL,
                        produto_id UUID,
                        url TEXT NOT NULL,
                        eventos JSON NOT NULL DEFAULT '[]',
                        secret TEXT,
                        ativo BOOLEAN NOT NULL DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_webhook_user FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                        CONSTRAINT fk_webhook_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
                    );
                    
                    -- Criar índices para melhor performance
                    CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
                    CREATE INDEX idx_webhooks_produto_id ON webhooks(produto_id);
                    CREATE INDEX idx_webhooks_ativo ON webhooks(ativo);
                    CREATE INDEX idx_webhooks_created_at ON webhooks(created_at);
                    
                    COMMENT ON TABLE webhooks IS 'Webhooks configurados pelos usuários para receber notificações de eventos';
                    COMMENT ON COLUMN webhooks.id IS 'ID único do webhook (gerado automaticamente)';
                    COMMENT ON COLUMN webhooks.user_id IS 'ID do usuário que criou o webhook';
                    COMMENT ON COLUMN webhooks.produto_id IS 'ID do produto (opcional, NULL para webhooks globais)';
                    COMMENT ON COLUMN webhooks.url IS 'URL onde o webhook será enviado';
                    COMMENT ON COLUMN webhooks.eventos IS 'Array de eventos que o webhook deve receber';
                    COMMENT ON COLUMN webhooks.secret IS 'Secret opcional para validação de segurança';
                    COMMENT ON COLUMN webhooks.ativo IS 'Se o webhook está ativo';
                    
                    RAISE NOTICE 'Tabela webhooks criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela webhooks já existe';
                    
                    -- Adicionar coluna produto_id se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'webhooks' AND column_name = 'produto_id'
                    ) THEN
                        ALTER TABLE webhooks 
                        ADD COLUMN produto_id UUID,
                        ADD CONSTRAINT fk_webhook_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE;
                        
                        CREATE INDEX IF NOT EXISTS idx_webhooks_produto_id ON webhooks(produto_id);
                        
                        COMMENT ON COLUMN webhooks.produto_id IS 'ID do produto (opcional, NULL para webhooks globais)';
                        
                        RAISE NOTICE 'Coluna produto_id adicionada à tabela webhooks';
                    ELSE
                        RAISE NOTICE 'Coluna produto_id já existe na tabela webhooks';
                    END IF;
                END IF;
            END $$;
        `
    },
    {
        name: 'add_whatsapp_notification_types_to_usuarios',
        sql: `
            -- Adicionar coluna whatsapp_notification_types se não existir
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'usuarios' 
                    AND column_name = 'whatsapp_notification_types'
                ) THEN
                    ALTER TABLE usuarios ADD COLUMN whatsapp_notification_types JSON DEFAULT '[]';
                    COMMENT ON COLUMN usuarios.whatsapp_notification_types IS 'Array de tipos de notificações WhatsApp que o usuário deseja receber: codigo_verificacao, codigo_saque, nova_venda, saque_pago, remarketing, upsell, venda_afiliado';
                    RAISE NOTICE 'Coluna whatsapp_notification_types criada com sucesso';
                ELSE
                    RAISE NOTICE 'Coluna whatsapp_notification_types já existe';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_venda_cancelada_id_to_remarketing_queue',
        sql: `
            -- Adicionar campo venda_cancelada_id à tabela remarketing_queue
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'remarketing_queue' 
                    AND column_name = 'venda_cancelada_id'
                ) THEN
                    ALTER TABLE remarketing_queue ADD COLUMN venda_cancelada_id UUID;
                    ALTER TABLE remarketing_queue ADD CONSTRAINT fk_remarketing_venda_cancelada 
                        FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE SET NULL;
                    CREATE INDEX idx_remarketing_queue_venda_cancelada ON remarketing_queue(venda_cancelada_id);
                    COMMENT ON COLUMN remarketing_queue.venda_cancelada_id IS 'ID da venda cancelada que originou este item de remarketing';
                    RAISE NOTICE 'Coluna venda_cancelada_id adicionada à tabela remarketing_queue com sucesso';
                ELSE
                    RAISE NOTICE 'Coluna venda_cancelada_id já existe na tabela remarketing_queue';
                END IF;
            END $$;
        `
    },
    {
        name: 'create_remarketing_conversoes_table',
        sql: `
            -- Criar tabela remarketing_conversoes
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'remarketing_conversoes'
                ) THEN
                    CREATE TABLE remarketing_conversoes (
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
                        CONSTRAINT fk_remarketing_queue FOREIGN KEY (remarketing_queue_id) REFERENCES remarketing_queue(id) ON DELETE CASCADE,
                        CONSTRAINT fk_venda_cancelada FOREIGN KEY (venda_cancelada_id) REFERENCES vendas(id) ON DELETE CASCADE,
                        CONSTRAINT fk_venda_aprovada FOREIGN KEY (venda_aprovada_id) REFERENCES vendas(id) ON DELETE CASCADE,
                        CONSTRAINT fk_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
                    );
                    
                    CREATE INDEX idx_remarketing_conversoes_queue ON remarketing_conversoes(remarketing_queue_id);
                    CREATE INDEX idx_remarketing_conversoes_venda_cancelada ON remarketing_conversoes(venda_cancelada_id);
                    CREATE INDEX idx_remarketing_conversoes_venda_aprovada ON remarketing_conversoes(venda_aprovada_id);
                    CREATE INDEX idx_remarketing_conversoes_cliente ON remarketing_conversoes(cliente_id) WHERE cliente_id IS NOT NULL;
                    CREATE INDEX idx_remarketing_conversoes_produto ON remarketing_conversoes(produto_id);
                    CREATE INDEX idx_remarketing_conversoes_data_conversao ON remarketing_conversoes(data_conversao);
                    CREATE INDEX idx_remarketing_conversoes_email ON remarketing_conversoes(email) WHERE email IS NOT NULL;
                    CREATE INDEX idx_remarketing_conversoes_telefone ON remarketing_conversoes(telefone) WHERE telefone IS NOT NULL;
                    
                    COMMENT ON TABLE remarketing_conversoes IS 'Rastreia conversões de remarketing: quando uma venda cancelada que recebeu remarketing é convertida em venda aprovada';
                    
                    RAISE NOTICE 'Tabela remarketing_conversoes criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela remarketing_conversoes já existe';
                END IF;
            END $$;
        `
    },
    {
        name: 'create_upsell_tables',
        sql: `
            -- Criar tabelas para sistema de Upsell
            DO $$ 
            BEGIN
                -- Criar tabela upsell_pages
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'upsell_pages'
                ) THEN
                    CREATE TABLE upsell_pages (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        vendedor_id UUID NOT NULL,
                        titulo VARCHAR(255) NOT NULL,
                        nome_produto VARCHAR(255) NOT NULL,
                        video_url TEXT,
                        video_public_id VARCHAR(255),
                        link_checkout TEXT,
                        produto_id UUID,
                        ativo BOOLEAN DEFAULT true,
                        ordem INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_upsell_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                        CONSTRAINT fk_upsell_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
                    );
                    
                    CREATE INDEX idx_upsell_pages_vendedor ON upsell_pages(vendedor_id);
                    CREATE INDEX idx_upsell_pages_produto ON upsell_pages(produto_id);
                    CREATE INDEX idx_upsell_pages_ativo ON upsell_pages(ativo);
                    
                    COMMENT ON TABLE upsell_pages IS 'Páginas de upsell criadas pelos vendedores';
                    
                    RAISE NOTICE 'Tabela upsell_pages criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela upsell_pages já existe';
                END IF;

                -- Criar tabela produto_upsell
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'produto_upsell'
                ) THEN
                    CREATE TABLE produto_upsell (
                        id SERIAL PRIMARY KEY,
                        produto_id UUID NOT NULL,
                        upsell_page_id UUID NOT NULL,
                        ordem INTEGER DEFAULT 0,
                        ativo BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_produto_upsell_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
                        CONSTRAINT fk_produto_upsell_page FOREIGN KEY (upsell_page_id) REFERENCES upsell_pages(id) ON DELETE CASCADE,
                        CONSTRAINT uk_produto_upsell UNIQUE (produto_id, upsell_page_id)
                    );
                    
                    CREATE INDEX idx_produto_upsell_produto ON produto_upsell(produto_id);
                    CREATE INDEX idx_produto_upsell_page ON produto_upsell(upsell_page_id);
                    CREATE INDEX idx_produto_upsell_ativo ON produto_upsell(ativo);
                    
                    COMMENT ON TABLE produto_upsell IS 'Relacionamento entre produtos e páginas de upsell';
                    
                    RAISE NOTICE 'Tabela produto_upsell criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela produto_upsell já existe';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_video_embed_to_upsell_pages',
        sql: `
            -- Adicionar coluna video_embed na tabela upsell_pages
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'video_embed'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN video_embed TEXT;
                    COMMENT ON COLUMN upsell_pages.video_embed IS 'Código HTML de incorporação de vídeo (iframe, embed, etc.)';
                    RAISE NOTICE 'Coluna video_embed adicionada à tabela upsell_pages';
                ELSE
                    RAISE NOTICE 'Coluna video_embed já existe na tabela upsell_pages';
                END IF;
            END $$;
        `
    },
    {
        name: 'create_produto_upsell_page_table',
        sql: `
            -- Criar tabela para relacionar produto comprado → página de upsell
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_name = 'produto_upsell_page'
                ) THEN
                    CREATE TABLE produto_upsell_page (
                        id SERIAL PRIMARY KEY,
                        produto_id UUID NOT NULL,
                        upsell_page_id UUID NOT NULL,
                        ativo BOOLEAN DEFAULT true,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT fk_produto_upsell_page_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
                        CONSTRAINT fk_produto_upsell_page_page FOREIGN KEY (upsell_page_id) REFERENCES upsell_pages(id) ON DELETE CASCADE,
                        CONSTRAINT uk_produto_upsell_page UNIQUE (produto_id, upsell_page_id)
                    );
                    
                    CREATE INDEX idx_produto_upsell_page_produto ON produto_upsell_page(produto_id);
                    CREATE INDEX idx_produto_upsell_page_page ON produto_upsell_page(upsell_page_id);
                    CREATE INDEX idx_produto_upsell_page_ativo ON produto_upsell_page(ativo);
                    
                    COMMENT ON TABLE produto_upsell_page IS 'Relaciona produto comprado com página de upsell que será exibida após o pagamento';
                    
                    RAISE NOTICE 'Tabela produto_upsell_page criada com sucesso';
                ELSE
                    RAISE NOTICE 'Tabela produto_upsell_page já existe';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_upsell_configurable_fields',
        sql: `
            -- Adicionar campos configuráveis para estrutura fixa da página de upsell
            DO $$ 
            BEGIN
                -- Subheadline
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'subheadline'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN subheadline TEXT;
                    COMMENT ON COLUMN upsell_pages.subheadline IS 'Subtítulo configurável da página de upsell';
                    RAISE NOTICE 'Coluna subheadline adicionada à tabela upsell_pages';
                END IF;

                -- Benefícios (JSON array)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'beneficios'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN beneficios JSONB;
                    COMMENT ON COLUMN upsell_pages.beneficios IS 'Lista de benefícios em formato JSON array';
                    RAISE NOTICE 'Coluna beneficios adicionada à tabela upsell_pages';
                END IF;

                -- Urgência
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'texto_urgencia'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN texto_urgencia TEXT;
                    COMMENT ON COLUMN upsell_pages.texto_urgencia IS 'Texto de urgência configurável';
                    RAISE NOTICE 'Coluna texto_urgencia adicionada à tabela upsell_pages';
                END IF;

                -- Prova Social (JSON array de depoimentos)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'prova_social'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN prova_social JSONB;
                    COMMENT ON COLUMN upsell_pages.prova_social IS 'Depoimentos e provas sociais em formato JSON array';
                    RAISE NOTICE 'Coluna prova_social adicionada à tabela upsell_pages';
                END IF;

                -- Reforço Final
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'reforco_final'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN reforco_final TEXT;
                    COMMENT ON COLUMN upsell_pages.reforco_final IS 'Texto de reforço final configurável';
                    RAISE NOTICE 'Coluna reforco_final adicionada à tabela upsell_pages';
                END IF;

                -- Texto do Botão Aceitar
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'texto_botao_aceitar'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN texto_botao_aceitar VARCHAR(255) DEFAULT 'Aceitar Oferta';
                    COMMENT ON COLUMN upsell_pages.texto_botao_aceitar IS 'Texto configurável do botão principal';
                    RAISE NOTICE 'Coluna texto_botao_aceitar adicionada à tabela upsell_pages';
                END IF;

                -- Texto do Botão Recusar
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'texto_botao_recusar'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN texto_botao_recusar VARCHAR(255) DEFAULT 'Não, obrigado. Quero continuar sem esta oferta.';
                    COMMENT ON COLUMN upsell_pages.texto_botao_recusar IS 'Texto configurável do botão secundário';
                    RAISE NOTICE 'Coluna texto_botao_recusar adicionada à tabela upsell_pages';
                END IF;

                -- Imagem (alternativa ao vídeo)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'imagem_url'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN imagem_url TEXT;
                    COMMENT ON COLUMN upsell_pages.imagem_url IS 'URL da imagem (alternativa ao vídeo)';
                    RAISE NOTICE 'Coluna imagem_url adicionada à tabela upsell_pages';
                END IF;

                -- Preço Original (para mostrar desconto)
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'upsell_pages' AND column_name = 'preco_original'
                ) THEN
                    ALTER TABLE upsell_pages ADD COLUMN preco_original DECIMAL(10, 2);
                    COMMENT ON COLUMN upsell_pages.preco_original IS 'Preço original para cálculo de desconto';
                    RAISE NOTICE 'Coluna preco_original adicionada à tabela upsell_pages';
                END IF;
            END $$;
        `
    },
    {
        name: 'add_integracao_campos_to_afiliados',
        sql: `
            -- Adicionar campos de integração (Meta Pixel e UTMify) na tabela afiliados
            DO $$ 
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'afiliados') THEN
                    -- Adicionar coluna meta_pixel_id se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'meta_pixel_id'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN meta_pixel_id VARCHAR(50) NULL;
                        COMMENT ON COLUMN afiliados.meta_pixel_id IS 'ID do Meta Pixel (Facebook Pixel) para rastreamento de conversões';
                        RAISE NOTICE 'Coluna meta_pixel_id adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna meta_pixel_id já existe na tabela afiliados';
                    END IF;

                    -- Adicionar coluna utmify_api_token se não existir
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'utmify_api_token'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN utmify_api_token VARCHAR(255) NULL;
                        COMMENT ON COLUMN afiliados.utmify_api_token IS 'API Token do UTMify para rastreamento de conversões';
                        RAISE NOTICE 'Coluna utmify_api_token adicionada à tabela afiliados';
                    ELSE
                        RAISE NOTICE 'Coluna utmify_api_token já existe na tabela afiliados';
                    END IF;
                ELSE
                    RAISE NOTICE 'Tabela afiliados não existe, pulando migração';
                END IF;
            END $$;
        `
    }
];

// Tabela para rastrear migrações executadas
async function createMigrationsTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    await sequelize.query(createTableSQL);
    console.log('✅ Tabela de migrações verificada/criada');
}

// Verificar se migração já foi executada
async function isMigrationExecuted(migrationName) {
    try {
        const [results] = await sequelize.query(
            `SELECT COUNT(*)::int as count FROM schema_migrations WHERE migration_name = :name`,
            {
                replacements: { name: migrationName },
                type: Sequelize.QueryTypes.SELECT
            }
        );
        
        return results && results.count > 0;
    } catch (error) {
        // Se a tabela não existe ainda, retornar false
        return false;
    }
}

// Registrar migração como executada
async function markMigrationAsExecuted(migrationName) {
    await sequelize.query(
        `INSERT INTO schema_migrations (migration_name) VALUES (:name) ON CONFLICT (migration_name) DO NOTHING`,
        {
            replacements: { name: migrationName }
        }
    );
}

// Executar migração
async function runMigration(migration) {
    try {
        console.log(`\n🔄 Executando migração: ${migration.name}...`);
        
        // Verificar se já foi executada
        const executed = await isMigrationExecuted(migration.name);
        if (executed) {
            console.log(`⏭️  Migração ${migration.name} já foi executada anteriormente`);
            return true;
        }

        // Executar SQL da migração
        await sequelize.query(migration.sql);
        
        // Registrar como executada
        await markMigrationAsExecuted(migration.name);
        
        console.log(`✅ Migração ${migration.name} executada com sucesso!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao executar migração ${migration.name}:`, error.message);
        
        // Se for erro de coluna já existe, considerar como sucesso
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate') ||
            error.message.includes('já existe')) {
            console.log(`⚠️  Coluna já existe, marcando migração como executada...`);
            await markMigrationAsExecuted(migration.name);
            return true;
        }
        
        return false;
    }
}

// Função principal
async function runMigrations() {
    try {
        console.log('🚀 Iniciando migrações automáticas do banco de dados...\n');
        console.log(`📊 Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Criar tabela de migrações
        await createMigrationsTable();

        // Executar todas as migrações
        let successCount = 0;
        let failCount = 0;

        for (const migration of migrations) {
            const success = await runMigration(migration);
            if (success) {
                successCount++;
            } else {
                failCount++;
            }
        }

        console.log('\n📊 Resumo das migrações:');
        console.log(`   ✅ Sucesso: ${successCount}`);
        console.log(`   ❌ Falhas: ${failCount}`);
        console.log(`   📦 Total: ${migrations.length}`);

        if (failCount === 0) {
            console.log('\n🎉 Todas as migrações foram executadas com sucesso!');
            process.exit(0);
        } else {
            console.log('\n⚠️  Algumas migrações falharam. Verifique os erros acima.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Erro fatal ao executar migrações:', error.message);
        console.error('\n📋 Verifique:');
        console.error('   1. Credenciais do banco no arquivo .env');
        console.error('   2. Conexão com o banco de dados');
        console.error('   3. Permissões do usuário do banco');
        console.error('\n💡 Variáveis necessárias no .env:');
        console.error('   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (ou DB_PASS)');
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };

