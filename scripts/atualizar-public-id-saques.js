/**
 * Script para atualizar public_id de todos os saques que não têm
 * Gera IDs numéricos de 6 dígitos (formato: 606734)
 */

const { sequelize, Pagamento } = require('../config/database');

async function atualizarPublicIds() {
    try {
        console.log('🔄 Iniciando atualização de public_id para saques antigos...');
        
        // Buscar todos os saques sem public_id
        const saquesSemPublicId = await Pagamento.findAll({
            where: {
                public_id: null
            },
            attributes: ['id', 'public_id']
        });
        
        console.log(`📊 Encontrados ${saquesSemPublicId.length} saques sem public_id`);
        
        if (saquesSemPublicId.length === 0) {
            console.log('✅ Todos os saques já têm public_id. Nada a fazer.');
            process.exit(0);
        }
        
        // Função para gerar ID público único
        function gerarPublicId() {
            const numero = Math.floor(100000 + Math.random() * 900000); // 6 dígitos (100000-999999)
            return numero.toString();
        }
        
        let atualizados = 0;
        let erros = 0;
        
        // Atualizar cada saque
        for (const saque of saquesSemPublicId) {
            try {
                // Gerar ID único
                let publicId = gerarPublicId();
                
                // Verificar se o ID já existe (evitar conflitos)
                let publicIdExists = await Pagamento.findOne({ 
                    where: { public_id: publicId } 
                });
                
                // Se existir, gerar novo ID (máximo 10 tentativas)
                let tentativas = 0;
                while (publicIdExists && tentativas < 10) {
                    publicId = gerarPublicId();
                    publicIdExists = await Pagamento.findOne({ 
                        where: { public_id: publicId } 
                    });
                    tentativas++;
                }
                
                if (tentativas >= 10) {
                    console.error(`⚠️ Não foi possível gerar ID único para saque ${saque.id}`);
                    erros++;
                    continue;
                }
                
                // Atualizar saque
                await saque.update({ public_id: publicId });
                atualizados++;
                
                if (atualizados % 10 === 0) {
                    console.log(`✅ ${atualizados} saques atualizados...`);
                }
                
            } catch (error) {
                console.error(`❌ Erro ao atualizar saque ${saque.id}:`, error.message);
                erros++;
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════');
        console.log(`✅ Atualização concluída!`);
        console.log(`📊 Total de saques atualizados: ${atualizados}`);
        console.log(`❌ Erros: ${erros}`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        // Verificar se todos foram atualizados
        const saquesAindaSemPublicId = await Pagamento.count({
            where: {
                public_id: null
            }
        });
        
        if (saquesAindaSemPublicId > 0) {
            console.log(`⚠️ Ainda existem ${saquesAindaSemPublicId} saques sem public_id`);
        } else {
            console.log('✅ Todos os saques agora têm public_id!');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao atualizar public_ids:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar atualização
atualizarPublicIds();

