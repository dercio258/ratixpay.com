/**
 * Script para adicionar índices de otimização para consultas de produtos para afiliados
 * Execute: node scripts/add-indexes-produtos-afiliados.js
 */

const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function addIndexes() {
    try {
        // Forçar output imediato
        process.stdout.write('═══════════════════════════════════════════════════════════\n');
        process.stdout.write('🔧 Adicionando índices para otimizar consultas...\n');
        process.stdout.write('═══════════════════════════════════════════════════════════\n');
        
        // Testar conexão
        await sequelize.authenticate();
        process.stdout.write('✅ Conexão com banco de dados estabelecida\n');
        
        // Ler e executar SQL de migração
        const sqlPath = path.join(__dirname, '../migrations/add-indexes-produtos-afiliados.sql');
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`Arquivo SQL não encontrado: ${sqlPath}`);
        }
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        process.stdout.write('📝 Executando migração SQL...\n');
        await sequelize.query(sql);
        
        process.stdout.write('✅ Índices criados com sucesso!\n');
        process.stdout.write('\n📊 Índices criados:\n');
        process.stdout.write('   - idx_produtos_ativo_permitir_afiliados\n');
        process.stdout.write('   - idx_produtos_vendedor_id\n');
        process.stdout.write('   - idx_produtos_afiliados_completo\n');
        process.stdout.write('   - idx_link_tracking_afiliado_produto\n');
        process.stdout.write('   - idx_vendas_afiliados_afiliado_id\n');
        
        await sequelize.close();
        process.exit(0);
        
    } catch (error) {
        process.stderr.write(`❌ Erro ao criar índices: ${error.message}\n`);
        process.stderr.write(`Stack: ${error.stack}\n`);
        try {
            await sequelize.close();
        } catch (e) {
            // Ignorar erro ao fechar
        }
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    addIndexes();
}

module.exports = { addIndexes };

