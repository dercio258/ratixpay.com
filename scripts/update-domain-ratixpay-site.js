/**
 * Script para atualizar domínio de ratixpay.com para ratixpay.site
 * Atualiza nomes de arquivos e URLs no banco de dados
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do banco de dados
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ratixpay',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || '',
});

async function atualizarDominio() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Iniciando atualização de domínio ratixpay.com -> ratixpay.site...\n');
        
        await client.query('BEGIN');
        
        // 1. Atualizar URLs em produtos (imagem_url)
        console.log('📦 Atualizando produtos.imagem_url...');
        const result1 = await client.query(`
            UPDATE produtos 
            SET imagem_url = REPLACE(imagem_url, 'ratixpay.com', 'ratixpay.site')
            WHERE imagem_url LIKE '%ratixpay.com%'
            RETURNING id, imagem_url;
        `);
        console.log(`   ✅ ${result1.rowCount} registros atualizados em produtos.imagem_url`);
        
        // 2. Atualizar URLs em produtos (link_conteudo)
        console.log('📦 Atualizando produtos.link_conteudo...');
        const result2 = await client.query(`
            UPDATE produtos 
            SET link_conteudo = REPLACE(link_conteudo, 'ratixpay.com', 'ratixpay.site')
            WHERE link_conteudo LIKE '%ratixpay.com%'
            RETURNING id, link_conteudo;
        `);
        console.log(`   ✅ ${result2.rowCount} registros atualizados em produtos.link_conteudo`);
        
        // 3. Atualizar URLs em afiliados (link_afiliado)
        console.log('👥 Atualizando afiliados.link_afiliado...');
        const result3 = await client.query(`
            UPDATE afiliados 
            SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
            WHERE link_afiliado LIKE '%ratixpay.com%'
            RETURNING id, link_afiliado;
        `);
        console.log(`   ✅ ${result3.rowCount} registros atualizados em afiliados.link_afiliado`);
        
        // 4. Atualizar URLs em link_trackings (link_original)
        console.log('🔗 Atualizando link_trackings.link_original...');
        const result4 = await client.query(`
            UPDATE link_trackings 
            SET link_original = REPLACE(link_original, 'ratixpay.com', 'ratixpay.site')
            WHERE link_original LIKE '%ratixpay.com%'
            RETURNING id, link_original;
        `);
        console.log(`   ✅ ${result4.rowCount} registros atualizados em link_trackings.link_original`);
        
        // 5. Atualizar URLs em link_trackings (link_afiliado)
        console.log('🔗 Atualizando link_trackings.link_afiliado...');
        const result5 = await client.query(`
            UPDATE link_trackings 
            SET link_afiliado = REPLACE(link_afiliado, 'ratixpay.com', 'ratixpay.site')
            WHERE link_afiliado LIKE '%ratixpay.com%'
            RETURNING id, link_afiliado;
        `);
        console.log(`   ✅ ${result5.rowCount} registros atualizados em link_trackings.link_afiliado`);
        
        // 6. Verificar se existe coluna tracking_data em vendas e atualizar
        console.log('📊 Verificando vendas.tracking_data...');
        const checkTracking = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' AND column_name = 'tracking_data';
        `);
        
        if (checkTracking.rows.length > 0) {
            const result6 = await client.query(`
                UPDATE vendas 
                SET tracking_data = jsonb_set(
                    tracking_data::jsonb,
                    '{url}',
                    to_jsonb(REPLACE(tracking_data->>'url', 'ratixpay.com', 'ratixpay.site'))
                )::jsonb
                WHERE tracking_data::text LIKE '%ratixpay.com%'
                RETURNING id;
            `);
            console.log(`   ✅ ${result6.rowCount} registros atualizados em vendas.tracking_data`);
        } else {
            console.log('   ⚠️  Coluna tracking_data não encontrada em vendas');
        }
        
        // 7. Verificar se existe coluna url_produto em vendas
        console.log('📊 Verificando vendas.url_produto...');
        const checkUrlProduto = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vendas' AND column_name = 'url_produto';
        `);
        
        if (checkUrlProduto.rows.length > 0) {
            const result7 = await client.query(`
                UPDATE vendas 
                SET url_produto = REPLACE(url_produto, 'ratixpay.com', 'ratixpay.site')
                WHERE url_produto LIKE '%ratixpay.com%'
                RETURNING id;
            `);
            console.log(`   ✅ ${result7.rowCount} registros atualizados em vendas.url_produto`);
        } else {
            console.log('   ⚠️  Coluna url_produto não encontrada em vendas');
        }
        
        await client.query('COMMIT');
        
        console.log('\n✅ Atualização de domínio concluída com sucesso!');
        
        // Mostrar estatísticas finais
        console.log('\n📊 Estatísticas finais:');
        const stats = await client.query(`
            SELECT 
                'produtos.imagem_url' as tabela_coluna,
                COUNT(*) as total_com_novo_dominio
            FROM produtos 
            WHERE imagem_url LIKE '%ratixpay.site%'
            UNION ALL
            SELECT 
                'produtos.link_conteudo' as tabela_coluna,
                COUNT(*) as total_com_novo_dominio
            FROM produtos 
            WHERE link_conteudo LIKE '%ratixpay.site%'
            UNION ALL
            SELECT 
                'afiliados.link_afiliado' as tabela_coluna,
                COUNT(*) as total_com_novo_dominio
            FROM afiliados 
            WHERE link_afiliado LIKE '%ratixpay.site%'
            UNION ALL
            SELECT 
                'link_trackings.link_original' as tabela_coluna,
                COUNT(*) as total_com_novo_dominio
            FROM link_trackings 
            WHERE link_original LIKE '%ratixpay.site%'
            UNION ALL
            SELECT 
                'link_trackings.link_afiliado' as tabela_coluna,
                COUNT(*) as total_com_novo_dominio
            FROM link_trackings 
            WHERE link_afiliado LIKE '%ratixpay.site%';
        `);
        
        stats.rows.forEach(row => {
            console.log(`   ${row.tabela_coluna}: ${row.total_com_novo_dominio} registros`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro ao atualizar domínio:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Executar script
if (require.main === module) {
    atualizarDominio()
        .then(() => {
            console.log('\n✨ Processo concluído!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Erro fatal:', error);
            process.exit(1);
        });
}

module.exports = { atualizarDominio };

