/**
 * Script de migração para criar tabela de banners de afiliados
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function createBannerAfiliadosTable() {
    try {
        console.log('🔄 Criando tabela de banners de afiliados...');
        
        // Criar tabela
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS banner_afiliados (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                afiliado_id UUID NOT NULL REFERENCES afiliados(id) ON DELETE CASCADE,
                link_tracking_id UUID REFERENCES link_trackings(id) ON DELETE SET NULL,
                produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
                titulo VARCHAR(255) NOT NULL,
                mensagem TEXT,
                imagem_url TEXT NOT NULL,
                link_afiliado TEXT NOT NULL,
                codigo_html TEXT,
                ativo BOOLEAN NOT NULL DEFAULT true,
                cliques INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Tabela criada');
        
        // Criar índices
        console.log('📊 Criando índices...');
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_banner_afiliado_id 
            ON banner_afiliados(afiliado_id);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_banner_link_tracking 
            ON banner_afiliados(link_tracking_id);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_banner_produto 
            ON banner_afiliados(produto_id);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_banner_ativo 
            ON banner_afiliados(ativo);
        `, { type: QueryTypes.RAW });
        
        await sequelize.query(`
            CREATE INDEX IF NOT EXISTS idx_banner_created_at 
            ON banner_afiliados(created_at);
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Índices criados');
        
        console.log('✅ Migração concluída com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar tabela:', error);
        throw error;
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    createBannerAfiliadosTable()
        .then(() => {
            console.log('✅ Script executado com sucesso');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro ao executar script:', error);
            process.exit(1);
        });
}

module.exports = { createBannerAfiliadosTable };

