const { databaseManager, sequelize, RemarketingQueue, RemarketingConversao, BlogPost, BlogComment, BlogPage } = require('../config/database');
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
            
            // Garantir que as tabelas de remarketing e blog existam (sync apenas se necessário)
            console.log('🔄 Verificando tabelas de remarketing e blog...');
            try {
                const alterSync = process.env.DB_ALTER_SYNC === 'true';
                if (alterSync) {
                    // Sincronizar apenas as tabelas se alter sync estiver ativo
                    await RemarketingQueue.sync({ alter: true });
                    await RemarketingConversao.sync({ alter: true });
                    await BlogPost.sync({ alter: true });
                    await BlogComment.sync({ alter: true });
                    await BlogPage.sync({ alter: true });
                    console.log('✅ Tabelas de remarketing e blog verificadas/sincronizadas');
                } else {
                    // Apenas verificar se existem, sem alterar estrutura
                    await RemarketingQueue.sync({ alter: false });
                    await RemarketingConversao.sync({ alter: false });
                    await BlogPost.sync({ alter: false });
                    await BlogComment.sync({ alter: false });
                    await BlogPage.sync({ alter: false });
                    console.log('✅ Tabelas de remarketing e blog verificadas');
                }
            } catch (syncError) {
                console.warn('⚠️ Erro ao sincronizar tabelas (continuando):', syncError.message);
                // Continuar mesmo se houver erro na sincronização - as migrações SQL podem criar as tabelas
            }
            
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
