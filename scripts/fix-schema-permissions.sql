-- ===========================================
-- CORREÇÃO DE PERMISSÕES DO SCHEMA PUBLIC
-- ===========================================
-- Este script concede todas as permissões necessárias
-- ao usuário do banco de dados no schema public
-- 
-- IMPORTANTE: Substitua 'ratixuser' pelo nome do usuário do seu .env
-- Você pode verificar o usuário com: grep DB_USER .env

-- Conceder uso do schema public
GRANT USAGE ON SCHEMA public TO ratixuser;

-- Conceder criação no schema public
GRANT CREATE ON SCHEMA public TO ratixuser;

-- Conceder todas as permissões em todas as tabelas existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ratixuser;

-- Conceder todas as permissões em todas as sequências existentes
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ratixuser;

-- Conceder permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON TABLES TO ratixuser;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL PRIVILEGES ON SEQUENCES TO ratixuser;

-- Para PostgreSQL 15+, pode ser necessário permitir criação pública no schema
-- Se ainda não funcionar, descomente a linha abaixo:
-- ALTER SCHEMA public OWNER TO ratixuser;

SELECT 'Permissões do schema public concedidas ao usuário ratixuser com sucesso!' AS status;
