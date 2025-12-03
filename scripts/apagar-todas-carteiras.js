/**
 * Script para apagar TODAS as carteiras existentes do banco de dados
 * 
 * ⚠️ ATENÇÃO: Este script apaga TODAS as carteiras permanentemente!
 * Use com cuidado e apenas quando necessário.
 * 
 * Execute: node scripts/apagar-todas-carteiras.js
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

async function apagarTodasCarteiras() {
    try {
        console.log('🚀 Iniciando processo de exclusão de carteiras...\n');
        console.log(`📊 Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Verificar se a tabela existe
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'carteiras'
        `);

        if (tables.length === 0) {
            console.log('⚠️  Tabela "carteiras" não encontrada. Nada a fazer.');
            process.exit(0);
        }

        // Contar carteiras antes de deletar
        const [countResult] = await sequelize.query(`
            SELECT COUNT(*)::int as total FROM carteiras
        `);
        const totalAntes = countResult[0].total;

        console.log(`📊 Total de carteiras encontradas: ${totalAntes}`);

        if (totalAntes === 0) {
            console.log('✅ Nenhuma carteira encontrada. Nada a fazer.');
            process.exit(0);
        }

        // Confirmar antes de deletar (em produção, pode querer remover isso)
        console.log('\n⚠️  ATENÇÃO: Você está prestes a apagar TODAS as carteiras!');
        console.log(`   Total: ${totalAntes} carteira(s)`);
        console.log('\n💡 Para executar, remova o comentário da linha de DELETE abaixo do código.');
        console.log('   Ou execute diretamente no PostgreSQL: DELETE FROM carteiras;\n');

        // Descomente a linha abaixo para realmente executar a exclusão
        // await sequelize.query(`DELETE FROM carteiras`);

        // Se quiser executar automaticamente, descomente:
        console.log('🗑️  Apagando todas as carteiras...');
        await sequelize.query(`DELETE FROM carteiras`);
        console.log(`✅ ${totalAntes} carteira(s) apagada(s) com sucesso!`);

        // Verificar se foram realmente apagadas
        const [verifyResult] = await sequelize.query(`
            SELECT COUNT(*)::int as total FROM carteiras
        `);
        const totalDepois = verifyResult[0].total;

        if (totalDepois === 0) {
            console.log('✅ Verificação: Todas as carteiras foram removidas.');
        } else {
            console.warn(`⚠️  Aviso: Ainda existem ${totalDepois} carteira(s) no banco.`);
        }

        console.log('\n🎉 Processo concluído com sucesso!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao apagar carteiras:', error.message);
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
    apagarTodasCarteiras();
}

module.exports = { apagarTodasCarteiras };

