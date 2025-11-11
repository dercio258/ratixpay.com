/**
 * Script de migração para adicionar colunas de rastreamento de cliques
 * ao sistema de afiliados
 */

const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');

async function addClickTrackingColumns() {
    try {
        console.log('🔄 Iniciando migração de colunas de rastreamento de cliques...');
        
        // Adicionar colunas na tabela link_trackings
        console.log('📊 Adicionando colunas em link_trackings...');
        
        await sequelize.query(`
            ALTER TABLE link_trackings 
            ADD COLUMN IF NOT EXISTS cliques_pagos INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS creditos_gerados DECIMAL(10, 2) DEFAULT 0.00;
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Colunas adicionadas em link_trackings');
        
        // Adicionar colunas na tabela afiliados
        console.log('👤 Adicionando colunas em afiliados...');
        
        await sequelize.query(`
            ALTER TABLE afiliados 
            ADD COLUMN IF NOT EXISTS total_cliques INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cliques_pagos INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS creditos_cliques DECIMAL(10, 2) DEFAULT 0.00;
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Colunas adicionadas em afiliados');
        
        // Atualizar valores existentes
        console.log('🔄 Atualizando valores existentes...');
        
        // Atualizar cliques_pagos e creditos_gerados em link_trackings baseado nos cliques existentes
        await sequelize.query(`
            UPDATE link_trackings 
            SET cliques_pagos = FLOOR(cliques / 10) * 10,
                creditos_gerados = FLOOR(cliques / 10) * 1.00
            WHERE cliques > 0;
        `, { type: QueryTypes.RAW });
        
        // Atualizar totais em afiliados
        await sequelize.query(`
            UPDATE afiliados a
            SET 
                total_cliques = COALESCE((
                    SELECT SUM(cliques) 
                    FROM link_trackings lt 
                    WHERE lt.afiliado_id = a.id
                ), 0),
                cliques_pagos = COALESCE((
                    SELECT SUM(cliques_pagos) 
                    FROM link_trackings lt 
                    WHERE lt.afiliado_id = a.id
                ), 0),
                creditos_cliques = COALESCE((
                    SELECT SUM(creditos_gerados) 
                    FROM link_trackings lt 
                    WHERE lt.afiliado_id = a.id
                ), 0.00);
        `, { type: QueryTypes.RAW });
        
        // Atualizar saldo_disponivel dos afiliados com os créditos de cliques
        await sequelize.query(`
            UPDATE afiliados 
            SET saldo_disponivel = COALESCE(saldo_disponivel, 0.00) + COALESCE(creditos_cliques, 0.00)
            WHERE creditos_cliques > 0;
        `, { type: QueryTypes.RAW });
        
        console.log('✅ Valores atualizados');
        
        // Remover duplicatas antes de criar o índice único
        console.log('🔍 Verificando e removendo duplicatas...');
        
        // Identificar e consolidar duplicatas (mesma combinação afiliado_id + produto_id)
        const duplicatas = await sequelize.query(`
            SELECT afiliado_id, produto_id, COUNT(*) as count
            FROM link_trackings
            WHERE produto_id IS NOT NULL
            GROUP BY afiliado_id, produto_id
            HAVING COUNT(*) > 1;
        `, { type: QueryTypes.SELECT });
        
        if (duplicatas.length > 0) {
            console.log(`⚠️ Encontradas ${duplicatas.length} combinações duplicadas. Consolidando...`);
            
            for (const dup of duplicatas) {
                // Buscar todos os registros duplicados
                const registros = await sequelize.query(`
                    SELECT id, cliques, cliques_pagos, creditos_gerados, conversoes, created_at, updated_at
                    FROM link_trackings
                    WHERE afiliado_id = :afiliado_id AND produto_id = :produto_id
                    ORDER BY created_at DESC, cliques DESC;
                `, {
                    type: QueryTypes.SELECT,
                    replacements: {
                        afiliado_id: dup.afiliado_id,
                        produto_id: dup.produto_id
                    }
                });
                
                if (registros.length > 1) {
                    // Manter o primeiro registro (mais recente ou com mais cliques)
                    const manterId = registros[0].id;
                    
                    // Consolidar dados: somar cliques, cliques_pagos, creditos_gerados, conversoes
                    const totalCliques = registros.reduce((sum, r) => sum + parseInt(r.cliques || 0), 0);
                    const totalCliquesPagos = registros.reduce((sum, r) => sum + parseInt(r.cliques_pagos || 0), 0);
                    const totalCreditos = registros.reduce((sum, r) => sum + parseFloat(r.creditos_gerados || 0), 0);
                    const totalConversoes = registros.reduce((sum, r) => sum + parseInt(r.conversoes || 0), 0);
                    
                    // Atualizar o registro que será mantido
                    await sequelize.query(`
                        UPDATE link_trackings
                        SET cliques = :cliques,
                            cliques_pagos = :cliques_pagos,
                            creditos_gerados = :creditos_gerados,
                            conversoes = :conversoes
                        WHERE id = :id;
                    `, {
                        type: QueryTypes.RAW,
                        replacements: {
                            id: manterId,
                            cliques: totalCliques,
                            cliques_pagos: totalCliquesPagos,
                            creditos_gerados: totalCreditos,
                            conversoes: totalConversoes
                        }
                    });
                    
                    // Remover os outros registros duplicados
                    const idsParaRemover = registros.slice(1).map(r => r.id);
                    if (idsParaRemover.length > 0) {
                        // Converter array de UUIDs para string formatada para PostgreSQL
                        const idsString = idsParaRemover.map(id => `'${id}'`).join(',');
                        await sequelize.query(`
                            DELETE FROM link_trackings
                            WHERE id IN (${idsString});
                        `, { type: QueryTypes.RAW });
                    }
                    
                    console.log(`   ✅ Consolidado: afiliado ${dup.afiliado_id} + produto ${dup.produto_id} (${registros.length} registros -> 1)`);
                }
            }
            
            console.log('✅ Duplicatas removidas');
        } else {
            console.log('✅ Nenhuma duplicata encontrada');
        }
        
        // Criar índice único para garantir um link por produto por afiliado
        console.log('🔒 Criando constraint única (afiliado_id, produto_id)...');
        
        try {
            // Remover índice se já existir (para recriar)
            await sequelize.query(`
                DROP INDEX IF EXISTS idx_afiliado_produto_unique;
            `, { type: QueryTypes.RAW });
            
            // Criar índice único
            await sequelize.query(`
                CREATE UNIQUE INDEX idx_afiliado_produto_unique 
                ON link_trackings(afiliado_id, produto_id) 
                WHERE produto_id IS NOT NULL;
            `, { type: QueryTypes.RAW });
            
            console.log('✅ Constraint única criada');
        } catch (error) {
            if (error.message.includes('already exists') || error.code === '23505') {
                console.log('⚠️ Constraint já existe, pulando...');
            } else {
                throw error;
            }
        }
        
        console.log('✅ Migração concluída com sucesso!');
        console.log('');
        console.log('📋 Resumo das alterações:');
        console.log('   - link_trackings: cliques_pagos, creditos_gerados');
        console.log('   - afiliados: total_cliques, cliques_pagos, creditos_cliques');
        console.log('   - Constraint única: um link por produto por afiliado');
        console.log('   - Valores históricos atualizados');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Executar migração
addClickTrackingColumns();

