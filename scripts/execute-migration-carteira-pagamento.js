/**
 * Script para executar migração de campos de carteira e pagamento
 * Executa o arquivo SQL: migrations/add-carteira-campos-e-pagamento-public-id.sql
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/database');

async function executeMigration() {
    try {
        console.log('🔄 Iniciando migração de campos de carteira e pagamento...');
        
        // Ler arquivo SQL
        const sqlFilePath = path.join(__dirname, '..', 'migrations', 'add-carteira-campos-e-pagamento-public-id.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
        
        console.log('📄 Arquivo SQL lido com sucesso');
        
        // Executar SQL
        await sequelize.query(sqlContent);
        
        console.log('✅ Migração executada com sucesso!');
        console.log('📋 Campos adicionados:');
        console.log('   - carteiras: contacto_mpesa, nome_titular_mpesa, contacto_emola, nome_titular_emola, email');
        console.log('   - pagamentos: public_id, valor_liquido, taxa, nome_titular, ip_solicitacao, user_agent');
        console.log('   - Constraint unique em carteiras.vendedor_id');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar migração
executeMigration();

