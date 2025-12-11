/**
 * Script para executar migração de carteiras do administrador
 */

require('dotenv').config();
const { sequelize } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function executarMigracao() {
    try {
        console.log('🔄 Iniciando migração de carteiras do administrador...');
        
        // Verificar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida');
        
        // Ler arquivo SQL
        const sqlPath = path.join(__dirname, '..', 'migrations', 'create-carteiras-admin.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📄 Executando migração SQL...');
        
        // Executar SQL
        await sequelize.query(sql);
        
        console.log('✅ Migração executada com sucesso!');
        console.log('✅ Tabela carteiras_admin criada');
        console.log('✅ Carteiras M-Pesa e Emola inicializadas');
        
        // Verificar se as carteiras foram criadas
        const [carteiras] = await sequelize.query(
            "SELECT tipo, nome, saldo FROM carteiras_admin ORDER BY tipo",
            { type: sequelize.QueryTypes.SELECT }
        );
        
        if (Array.isArray(carteiras) && carteiras.length > 0) {
            console.log('\n📊 Carteiras encontradas:');
            carteiras.forEach(c => {
                console.log(`   - ${c.nome} (${c.tipo}): ${parseFloat(c.saldo || 0).toFixed(2)} MZN`);
            });
        } else {
            // Tentar buscar novamente com query diferente
            const [carteiras2] = await sequelize.query(
                "SELECT tipo, nome, saldo FROM carteiras_admin ORDER BY tipo",
                { type: sequelize.QueryTypes.SELECT, raw: true }
            );
            
            if (carteiras2 && carteiras2.length > 0) {
                console.log('\n📊 Carteiras encontradas:');
                carteiras2.forEach(c => {
                    console.log(`   - ${c.nome} (${c.tipo}): ${parseFloat(c.saldo || 0).toFixed(2)} MZN`);
                });
            } else {
                console.log('⚠️  Nenhuma carteira encontrada após migração');
                console.log('   (Isso pode ser normal se a tabela já existia)');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        if (error.message) {
            console.error('   Mensagem:', error.message);
        }
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n✅ Conexão fechada');
    }
}

// Executar migração
executarMigracao();

