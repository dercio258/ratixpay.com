/**
 * Script para apagar todas as carteiras existentes dos usuários
 */

const { sequelize } = require('../config/database');

async function limparCarteiras() {
    try {
        console.log('🔄 Iniciando limpeza de carteiras...');
        
        // Contar carteiras antes de deletar
        const [result] = await sequelize.query(`
            SELECT COUNT(*) as total FROM carteiras
        `);
        const totalAntes = parseInt(result[0].total);
        
        console.log(`📊 Total de carteiras encontradas: ${totalAntes}`);
        
        if (totalAntes === 0) {
            console.log('✅ Nenhuma carteira encontrada. Nada a fazer.');
            process.exit(0);
        }
        
        // Apagar todas as carteiras
        const [deleteResult] = await sequelize.query(`
            DELETE FROM carteiras
        `);
        
        console.log(`✅ ${totalAntes} carteira(s) apagada(s) com sucesso!`);
        
        // Verificar se foram realmente apagadas
        const [verifyResult] = await sequelize.query(`
            SELECT COUNT(*) as total FROM carteiras
        `);
        const totalDepois = parseInt(verifyResult[0].total);
        
        if (totalDepois === 0) {
            console.log('✅ Verificação: Todas as carteiras foram removidas.');
        } else {
            console.warn(`⚠️ Aviso: Ainda existem ${totalDepois} carteira(s) no banco.`);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao limpar carteiras:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar limpeza
limparCarteiras();

