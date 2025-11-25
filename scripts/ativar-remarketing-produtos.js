/**
 * Script para ativar remarketing em todos os produtos existentes
 * Atualiza todos os produtos no banco de dados para ter remarketing ativo por padrão
 */

require('dotenv').config();
const { sequelize, Produto } = require('../config/database');

async function ativarRemarketingProdutos() {
    try {
        console.log('🔄 Iniciando ativação de remarketing para todos os produtos...\n');

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

