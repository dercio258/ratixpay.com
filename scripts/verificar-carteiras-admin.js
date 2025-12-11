/**
 * Script para verificar carteiras do administrador
 */

require('dotenv').config();
const { CarteiraAdmin } = require('../config/database');

async function verificarCarteiras() {
    try {
        console.log('🔍 Verificando carteiras do administrador...\n');
        
        const carteiras = await CarteiraAdmin.findAll({
            order: [['tipo', 'ASC']]
        });
        
        if (carteiras.length === 0) {
            console.log('⚠️  Nenhuma carteira encontrada');
            console.log('💡 Tentando inicializar carteiras...');
            
            const CarteiraAdminService = require('../services/carteiraAdminService');
            await CarteiraAdminService.inicializarCarteiras();
            
            const carteirasNovas = await CarteiraAdmin.findAll({
                order: [['tipo', 'ASC']]
            });
            
            if (carteirasNovas.length > 0) {
                console.log('✅ Carteiras inicializadas com sucesso!\n');
                carteirasNovas.forEach(c => {
                    console.log(`   📦 ${c.nome} (${c.tipo})`);
                    console.log(`      Saldo: ${parseFloat(c.saldo || 0).toFixed(2)} MZN`);
                    console.log(`      Status: ${c.ativa ? 'Ativa' : 'Inativa'}`);
                    console.log('');
                });
            }
        } else {
            console.log(`✅ ${carteiras.length} carteira(s) encontrada(s):\n`);
            carteiras.forEach(c => {
                console.log(`   📦 ${c.nome} (${c.tipo})`);
                console.log(`      Saldo: ${parseFloat(c.saldo || 0).toFixed(2)} MZN`);
                console.log(`      Contacto: ${c.contacto || 'Não informado'}`);
                console.log(`      Titular: ${c.nome_titular}`);
                console.log(`      Status: ${c.ativa ? 'Ativa' : 'Inativa'}`);
                console.log('');
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao verificar carteiras:', error);
        if (error.message) {
            console.error('   Mensagem:', error.message);
        }
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

verificarCarteiras();

