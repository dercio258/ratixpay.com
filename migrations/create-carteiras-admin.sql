-- Migração para criar tabela de carteiras do administrador
-- Data: 2024-12-30

-- Criar tabela carteiras_admin se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carteiras_admin') THEN
        CREATE TABLE carteiras_admin (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tipo VARCHAR(10) NOT NULL UNIQUE CHECK (tipo IN ('mpesa', 'emola')),
            nome VARCHAR(255) NOT NULL,
            contacto VARCHAR(20) NOT NULL,
            nome_titular VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            saldo DECIMAL(10, 2) NOT NULL DEFAULT 0,
            ativa BOOLEAN NOT NULL DEFAULT true,
            observacoes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        COMMENT ON TABLE carteiras_admin IS 'Carteiras do administrador (M-Pesa e Emola)';
        COMMENT ON COLUMN carteiras_admin.tipo IS 'Tipo de carteira: mpesa ou emola';
        COMMENT ON COLUMN carteiras_admin.nome IS 'Nome da carteira';
        COMMENT ON COLUMN carteiras_admin.contacto IS 'Número de contacto';
        COMMENT ON COLUMN carteiras_admin.nome_titular IS 'Nome do titular';
        COMMENT ON COLUMN carteiras_admin.email IS 'Email do titular';
        COMMENT ON COLUMN carteiras_admin.saldo IS 'Saldo atual da carteira';
        COMMENT ON COLUMN carteiras_admin.ativa IS 'Se a carteira está ativa';
        
        CREATE INDEX idx_carteiras_admin_tipo ON carteiras_admin(tipo);
        
        -- Inserir carteiras iniciais
        INSERT INTO carteiras_admin (tipo, nome, contacto, nome_titular, email, saldo, ativa)
        VALUES 
            ('mpesa', 'Carteira M-Pesa', '', 'Administrador', NULL, 0, true),
            ('emola', 'Carteira Emola', '', 'Administrador', NULL, 0, true)
        ON CONFLICT (tipo) DO NOTHING;
        
        RAISE NOTICE 'Tabela carteiras_admin criada com sucesso';
    ELSE
        RAISE NOTICE 'Tabela carteiras_admin já existe';
    END IF;
END $$;

