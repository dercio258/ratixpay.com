/**
 * Script de teste para Remarketing
 * Simula uma venda cancelada e envia notificações de remarketing
 */

require('dotenv').config();
const { sequelize, Produto } = require('../config/database');
const remarketingService = require('../services/remarketingService');

// Dados de teste
const PRODUTO_CODIGO = 'NIA7IPJXX';
const EMAIL_TESTE = 'derciomatsope9@gmail.com';
const WHATSAPP_TESTE = '+258867792543';
const NOME_CLIENTE = 'Cliente Teste';

async function testarRemarketing() {
    try {
        console.log('🧪 Iniciando teste de remarketing...\n');

        // 1. Buscar produto pelo custom_id
        console.log(`📦 Buscando produto com código: ${PRODUTO_CODIGO}`);
        const produto = await Produto.findOne({
            where: { custom_id: PRODUTO_CODIGO }
        });

        if (!produto) {
            console.error(`❌ Produto não encontrado com código: ${PRODUTO_CODIGO}`);
            process.exit(1);
        }

        console.log(`✅ Produto encontrado: ${produto.nome}`);
        console.log(`   ID: ${produto.id}`);
        console.log(`   Preço: ${produto.preco} MZN`);

        // 2. Verificar se remarketing está ativado
        let remarketingConfig = produto.remarketing_config || {};
        const remarketingAtivado = remarketingConfig.enabled === true;

        console.log(`\n🔄 Status do Remarketing:`);
        console.log(`   Ativado: ${remarketingAtivado}`);
        console.log(`   Tempo (minutos): ${remarketingConfig.tempo_minutos || 'não configurado'}`);

        // 3. Se não estiver ativado, ativar temporariamente para o teste
        if (!remarketingAtivado) {
            console.log(`\n⚠️ Remarketing não está ativado. Ativando temporariamente para o teste...`);
            remarketingConfig = {
                enabled: true,
                tempo_minutos: 0 // Enviar imediatamente para teste
            };
            
            await produto.update({
                remarketing_config: remarketingConfig
            });
            console.log(`✅ Remarketing ativado temporariamente`);
        }

        // 4. Adicionar à fila de remarketing
        console.log(`\n📝 Adicionando venda cancelada à fila de remarketing...`);
        // Usar um UUID genérico para cliente_id quando for teste (a tabela não aceita NULL)
        const { randomUUID } = require('crypto');
        const clienteIdTeste = randomUUID();
        
        const resultado = await remarketingService.adicionarVendaCancelada({
            cliente_id: clienteIdTeste, // UUID genérico para teste
            cliente_nome: NOME_CLIENTE,
            produto_id: produto.id,
            produto_nome: produto.nome,
            email: EMAIL_TESTE,
            telefone: WHATSAPP_TESTE
        });

        if (resultado.ignorado) {
            console.log(`⚠️ Remarketing ignorado: ${resultado.motivo}`);
            console.log(`\n💡 Dica: Limpe a fila de remarketing ou aguarde 24h para testar novamente.`);
            process.exit(0);
        }

        if (!resultado.sucesso || !resultado.item) {
            console.error(`❌ Erro ao adicionar à fila:`, resultado);
            process.exit(1);
        }

        const itemFila = resultado.item;
        console.log(`✅ Item adicionado à fila com sucesso!`);
        console.log(`   ID do item: ${itemFila.id}`);
        console.log(`   Status: ${itemFila.status}`);
        console.log(`   Data agendada: ${itemFila.data_agendada}`);

        // 5. Atualizar data_agendada para agora (processar imediatamente)
        console.log(`\n⏰ Atualizando data agendada para processar imediatamente...`);
        const agora = new Date();
        agora.setMinutes(agora.getMinutes() - 1); // 1 minuto atrás para garantir processamento
        
        await sequelize.query(
            `UPDATE remarketing_queue 
             SET data_agendada = :agora,
                 updated_at = NOW()
             WHERE id = :id`,
            {
                replacements: { 
                    id: itemFila.id,
                    agora: agora.toISOString()
                }
            }
        );
        console.log(`✅ Data agendada atualizada`);

        // 6. Processar a fila
        console.log(`\n🚀 Processando fila de remarketing...`);
        const stats = await remarketingService.processarFila();

        console.log(`\n📊 Estatísticas do processamento:`);
        console.log(`   Processados: ${stats.processados}`);
        console.log(`   Enviados: ${stats.enviados}`);
        console.log(`   Ignorados: ${stats.ignorados}`);
        console.log(`   Erros: ${stats.erros}`);

        if (stats.enviados > 0) {
            console.log(`\n✅ Teste concluído com sucesso!`);
            console.log(`📧 Email enviado para: ${EMAIL_TESTE}`);
            console.log(`📱 WhatsApp enviado para: ${WHATSAPP_TESTE}`);
        } else {
            console.log(`\n⚠️ Nenhuma notificação foi enviada. Verifique os logs acima.`);
        }

        // 7. Verificar status final do item
        const [itemFinal] = await sequelize.query(
            `SELECT * FROM remarketing_queue WHERE id = :id`,
            {
                replacements: { id: itemFila.id },
                type: sequelize.QueryTypes.SELECT
            }
        );

        if (itemFinal) {
            console.log(`\n📋 Status final do item:`);
            console.log(`   Status: ${itemFinal.status}`);
            console.log(`   Data envio: ${itemFinal.data_envio || 'não enviado'}`);
            console.log(`   Motivo ignorado: ${itemFinal.motivo_ignorado || 'não aplicável'}`);
        }

        // 8. Restaurar configuração original se foi alterada
        if (!remarketingAtivado) {
            console.log(`\n🔄 Restaurando configuração original do remarketing...`);
            await produto.update({
                remarketing_config: produto.remarketing_config || null
            });
            console.log(`✅ Configuração restaurada`);
        }

        console.log(`\n✨ Teste finalizado!`);
        process.exit(0);

    } catch (error) {
        console.error(`\n❌ Erro durante o teste:`, error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Executar teste
testarRemarketing();

