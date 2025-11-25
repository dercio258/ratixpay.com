/**
 * Script para ativar remarketing em todos os produtos existentes
 * Atualiza todos os produtos no banco de dados para ter remarketing ativo por padrão
 */

require('dotenv').config();
const { sequelize, Produto } = require('../config/database');

async function ativarRemarketingProdutos() {
    try {
        console.log('🔄 Iniciando ativação de remarketing para todos os produtos...\n');

        // Verificar se a coluna remarketing_config existe
        try {
            const [results] = await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'produtos' 
                AND column_name = 'remarketing_config'
            `);
            
            if (results.length === 0) {
                console.error('❌ Coluna remarketing_config não existe na tabela produtos!');
                console.error('\n📋 Para criar a coluna, execute um dos seguintes comandos:\n');
                console.error('Opção 1 - Como superusuário PostgreSQL:');
                console.error('   sudo -u postgres psql -d ratixpay -f migrations/add-remarketing-config.sql\n');
                console.error('Opção 2 - Executar SQL diretamente:');
                console.error('   sudo -u postgres psql -d ratixpay -c "ALTER TABLE produtos ADD COLUMN IF NOT EXISTS remarketing_config JSON;"\n');
                console.error('Opção 3 - Executar migração completa (requer permissões):');
                console.error('   node scripts/migrate-database-columns.js\n');
                throw new Error('Coluna remarketing_config não existe. Execute a migração primeiro.');
            } else {
                console.log('✅ Coluna remarketing_config encontrada\n');
            }
        } catch (colError) {
            if (colError.message.includes('Coluna remarketing_config não existe')) {
                throw colError;
            }
            console.error('⚠️ Erro ao verificar coluna remarketing_config:', colError.message);
            console.error('⚠️ Continuando... (assumindo que a coluna existe)\n');
        }

        // Buscar todos os produtos
        const produtos = await Produto.findAll({
            attributes: ['id', 'nome', 'custom_id', 'remarketing_config']
        });

        console.log(`📦 Total de produtos encontrados: ${produtos.length}\n`);

        let atualizados = 0;
        let jaAtivados = 0;
        let erros = 0;

        for (const produto of produtos) {
            try {
                // Verificar se já tem remarketing ativo
                const remarketingConfig = produto.remarketing_config || {};
                const jaAtivado = remarketingConfig.enabled === true;

                if (jaAtivado) {
                    console.log(`✅ Produto "${produto.nome}" (${produto.custom_id}) já tem remarketing ativo`);
                    jaAtivados++;
                    continue;
                }

                // Atualizar produto com remarketing ativo por padrão
                const novoRemarketingConfig = {
                    enabled: true,
                    tempo_minutos: remarketingConfig.tempo_minutos || 0 // Manter tempo configurado ou usar 0 (imediato)
                };

                await produto.update({
                    remarketing_config: novoRemarketingConfig
                });

                console.log(`✅ Remarketing ativado para produto "${produto.nome}" (${produto.custom_id})`);
                atualizados++;

            } catch (error) {
                console.error(`❌ Erro ao atualizar produto "${produto.nome}" (${produto.custom_id}):`, error.message);
                erros++;
            }
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 Resumo da Atualização:');
        console.log(`   ✅ Produtos atualizados: ${atualizados}`);
        console.log(`   ℹ️  Produtos já ativados: ${jaAtivados}`);
        console.log(`   ❌ Erros: ${erros}`);
        console.log(`   📦 Total processado: ${produtos.length}`);
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('✅ Processo concluído com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao processar produtos:', error);
        throw error;
    } finally {
        await sequelize.close();
    }
}

// Executar script
if (require.main === module) {
    ativarRemarketingProdutos()
        .then(() => {
            console.log('✅ Script executado com sucesso!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Erro ao executar script:', error);
            process.exit(1);
        });
}

module.exports = { ativarRemarketingProdutos };

