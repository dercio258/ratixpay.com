/**
 * Script de migração para criar tabela de cliques válidos de afiliados
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function createCliquesValidosTable() {
    try {
        console.log('🔄 Criando tabela de cliques válidos de afiliados...');
        
        // Criar tabela
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS cliques_validos_afiliados (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                afiliado_id UUID NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
                link_tracking_id UUID REFERENCES link_trackings(id) ON DELETE SET NULL,
                produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
                ip_address VARCHAR(45) NOT NULL,
                user_agent TEXT NOT NULL,
                navegador VARCHAR(100),
                sistema_operacional VARCHAR(100),
                dispositivo VARCHAR(50),
                fingerprint VARCHAR(255),
                valido BOOLEAN NOT NULL DEFAULT true,
                motivo_rejeicao TEXT,
                referer TEXT,
                session_id VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Tabela criada');
        
        // Criar índices
        console.log('📊 Criando índices...');
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_afiliado_ip 
            ON cliques_validos_afiliados(afiliado_id, ip_address);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_link_tracking 
            ON cliques_validos_afiliados(link_tracking_id);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_valido 
            ON cliques_validos_afiliados(valido);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_created_at 
            ON cliques_validos_afiliados(created_at);
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Índices criados');
        
        console.log('✅ Migração concluída com sucesso!');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Executar migração
createCliquesValidosTable();

