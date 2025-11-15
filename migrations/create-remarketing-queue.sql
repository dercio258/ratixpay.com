-- Migration: Criar tabela remarketing_queue
-- Descrição: Tabela para gerenciar fila de notificações de remarketing

CREATE TABLE IF NOT EXISTS remarketing_queue (
    id SERIAL PRIMARY KEY,
    cliente_id UUID NOT NULL,
    cliente_nome TEXT NOT NULL,
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    produto_nome TEXT NOT NULL,
    email TEXT, -- opcional se for por email
    telefone TEXT, -- se for WhatsApp
    status VARCHAR(20) DEFAULT 'pendente', -- pendente, enviado, ignorado
    data_cancelamento TIMESTAMP NOT NULL,
    tempo_envio INT NOT NULL, -- em minutos
    data_agendada TIMESTAMP NOT NULL, -- calculada no momento da inserção: data_cancelamento + tempo_envio minutos
    data_envio TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_remarketing_status ON remarketing_queue(status);
CREATE INDEX IF NOT EXISTS idx_remarketing_data_agendada ON remarketing_queue(data_agendada);
CREATE INDEX IF NOT EXISTS idx_remarketing_cliente_produto ON remarketing_queue(cliente_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_remarketing_produto ON remarketing_queue(produto_id);

-- Índice para verificação de antispam (cliente + produto + data)
CREATE INDEX IF NOT EXISTS idx_remarketing_antispam ON remarketing_queue(cliente_id, produto_id, data_cancelamento);

-- Comentários
COMMENT ON TABLE remarketing_queue IS 'Fila de notificações de remarketing para vendas canceladas';
COMMENT ON COLUMN remarketing_queue.status IS 'Status: pendente (aguardando envio), enviado (notificação enviada), ignorado (não enviar)';
COMMENT ON COLUMN remarketing_queue.tempo_envio IS 'Tempo em minutos após cancelamento para enviar notificação';
COMMENT ON COLUMN remarketing_queue.data_agendada IS 'Data calculada no momento da inserção: data_cancelamento + tempo_envio minutos';

