-- ===========================================
-- CORREÇÃO DE PERMISSÕES DO SCHEMA PUBLIC
-- ===========================================
-- Este script concede todas as permissões necessárias
-- ao usuário ratixpay no schema public

-- Conceder uso do schema public
GRANT USAGE ON SCHEMA public TO ratixpay;

-- Conceder criação no schema public
GRANT CREATE ON SCHEMA public TO ratixpay;

-- Conceder todas as permissões em todas as tabelas existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ratixpay;

-- Conceder todas as permissões em todas as sequências existentes
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ratixpay;

-- Conceder permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON TABLES TO ratixpay;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON SEQUENCES TO ratixpay;

-- Para PostgreSQL 15+, pode ser necessário permitir criação pública no schema
-- Se ainda não funcionar, descomente a linha abaixo:
-- ALTER SCHEMA public OWNER TO ratixpay;

SELECT 'Permissões do schema public concedidas ao usuário ratixpay com sucesso!' AS status;

