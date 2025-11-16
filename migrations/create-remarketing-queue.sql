-- Migration: Criar tabela de fila de remarketing
-- Data: 2024-12-25
-- Descrição: Tabela para gerenciar fila de notificações de remarketing automático

CREATE TABLE IF NOT EXISTS remarketing_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL,
    cliente_nome VARCHAR(255) NOT NULL,
    produto_id UUID NOT NULL,
    produto_nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telefone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'ignorado')),
    data_cancelamento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tempo_envio INTEGER NOT NULL DEFAULT 0 COMMENT 'Minutos após cancelamento',
    data_agendada TIMESTAMP NOT NULL,
    data_envio TIMESTAMP,
    motivo_ignorado TEXT,
    tentativas INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_remarketing_status ON remarketing_queue(status);
CREATE INDEX IF NOT EXISTS idx_remarketing_data_agendada ON remarketing_queue(data_agendada) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_remarketing_cliente_produto ON remarketing_queue(cliente_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_antispam ON remarketing_queue(cliente_id, produto_id, DATE(data_cancelamento));

-- Índice composto para queries do cron job
CREATE INDEX IF NOT EXISTS idx_remarketing_processamento ON remarketing_queue(status, data_agendada) WHERE status = 'pendente';

-- Comentários nas colunas
COMMENT ON TABLE remarketing_queue IS 'Fila de notificações de remarketing automático';
COMMENT ON COLUMN remarketing_queue.status IS 'Status: pendente, enviado, ignorado';
COMMENT ON COLUMN remarketing_queue.tempo_envio IS 'Minutos após cancelamento para enviar';
COMMENT ON COLUMN remarketing_queue.data_agendada IS 'Data/hora calculada para envio (data_cancelamento + tempo_envio)';
COMMENT ON COLUMN remarketing_queue.tentativas IS 'Número de tentativas de envio';

