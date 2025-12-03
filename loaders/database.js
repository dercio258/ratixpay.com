const { databaseManager } = require('../config/database');
const { setupAssociations } = require('../config/associations');

/**
 * Inicializa a conexão com o banco de dados e configura as associações
 */
async function loadDatabase() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            console.log('🔄 Conectando ao banco de dados...');
            await databaseManager.initialize();
            
            console.log('🔄 Configurando associações...');
            setupAssociations();
            
            console.log('✅ Banco de dados conectado e configurado com sucesso.');
            return true;
        } catch (error) {
            retryCount++;
            console.error(`❌ Tentativa ${retryCount}/${maxRetries} - Erro ao iniciar o banco de dados:`, error.message);
            
            if (retryCount < maxRetries) {
                const delay = Math.min(2000 * retryCount, 10000);
                console.log(`Aguardando ${delay/1000} segundos antes de tentar novamente...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.error('❌ Falha crítica na conexão com o banco de dados.');
                throw error;
            }
        }
    }
}

module.exports = { loadDatabase };
