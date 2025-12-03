/**
 * Script para limpar TODAS as integrações do banco de dados
 * 
 * Este script remove:
 * - Meta Pixel IDs dos afiliados (meta_pixel_id)
 * - UTMify API Tokens dos afiliados (utmify_api_token)
 * - Todos os webhooks configurados (tabela webhooks)
 * 
 * ⚠️ ATENÇÃO: Este script apaga dados de integrações permanentemente!
 * Use com cuidado e apenas quando necessário.
 * 
 * Execute: node scripts/limpar-todas-integracoes.js
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
    logging: false
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

async function limparTodasIntegracoes() {
    try {
        console.log('🚀 Iniciando limpeza de integrações...\n');
        console.log(`📊 Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        let totalAfetado = 0;

        // 1. Limpar Meta Pixel IDs dos afiliados
        console.log('📝 Limpando Meta Pixel IDs dos afiliados...');
        try {
            const [afiliadosResult] = await sequelize.query(`
                SELECT COUNT(*)::int as total 
                FROM afiliados 
                WHERE meta_pixel_id IS NOT NULL AND meta_pixel_id != ''
            `);
            const totalMetaPixel = afiliadosResult[0].total;

            if (totalMetaPixel > 0) {
                await sequelize.query(`
                    UPDATE afiliados 
                    SET meta_pixel_id = NULL 
                    WHERE meta_pixel_id IS NOT NULL
                `);
                console.log(`   ✅ ${totalMetaPixel} Meta Pixel ID(s) removido(s)`);
                totalAfetado += totalMetaPixel;
            } else {
                console.log('   ℹ️  Nenhum Meta Pixel ID encontrado');
            }
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log('   ⚠️  Tabela afiliados não existe ou coluna meta_pixel_id não existe');
            } else {
                throw error;
            }
        }

        // 2. Limpar UTMify API Tokens dos afiliados
        console.log('\n📝 Limpando UTMify API Tokens dos afiliados...');
        try {
            const [utmifyResult] = await sequelize.query(`
                SELECT COUNT(*)::int as total 
                FROM afiliados 
                WHERE utmify_api_token IS NOT NULL AND utmify_api_token != ''
            `);
            const totalUtmify = utmifyResult[0].total;

            if (totalUtmify > 0) {
                await sequelize.query(`
                    UPDATE afiliados 
                    SET utmify_api_token = NULL 
                    WHERE utmify_api_token IS NOT NULL
                `);
                console.log(`   ✅ ${totalUtmify} UTMify Token(s) removido(s)`);
                totalAfetado += totalUtmify;
            } else {
                console.log('   ℹ️  Nenhum UTMify Token encontrado');
            }
        } catch (error) {
            if (error.message.includes('does not exist')) {
                console.log('   ⚠️  Tabela afiliados não existe ou coluna utmify_api_token não existe');
            } else {
                throw error;
            }
        }

        // 3. Apagar todos os webhooks
        console.log('\n📝 Apagando todos os webhooks...');
        try {
            // Verificar se a tabela existe
            const [tables] = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = 'webhooks'
            `);

            if (tables.length > 0) {
                const [webhooksResult] = await sequelize.query(`
                    SELECT COUNT(*)::int as total FROM webhooks
                `);
                const totalWebhooks = webhooksResult[0].total;

                if (totalWebhooks > 0) {
                    await sequelize.query(`DELETE FROM webhooks`);
                    console.log(`   ✅ ${totalWebhooks} webhook(s) apagado(s)`);
                    totalAfetado += totalWebhooks;
                } else {
                    console.log('   ℹ️  Nenhum webhook encontrado');
                }
            } else {
                console.log('   ℹ️  Tabela webhooks não existe');
            }
        } catch (error) {
            console.log(`   ⚠️  Erro ao apagar webhooks: ${error.message}`);
        }

        // Resumo
        console.log('\n📊 Resumo da limpeza:');
        console.log(`   ✅ Total de integrações removidas: ${totalAfetado}`);

        if (totalAfetado === 0) {
            console.log('\n💡 Nenhuma integração encontrada para limpar.');
        } else {
            console.log('\n✅ Limpeza de integrações concluída com sucesso!');
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao limpar integrações:', error.message);
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
    limparTodasIntegracoes();
}

module.exports = { limparTodasIntegracoes };

