const remarketingService = require('../services/remarketingService');

/**
 * Inicializa o serviço de remarketing automático
 * Processa a fila de remarketing a cada 5 minutos
 */
function loadRemarketing() {
    try {
        console.log('🔄 Inicializando serviço de remarketing automático...');
        
        // Processar fila imediatamente ao iniciar (após 30 segundos para dar tempo do banco inicializar)
        setTimeout(async () => {
            try {
                console.log('🔄 Processando fila de remarketing inicial...');
                await remarketingService.processarFila();
            } catch (error) {
                console.error('❌ Erro ao processar fila inicial de remarketing:', error.message);
            }
        }, 30000); // 30 segundos
        
        // Processar fila a cada 5 minutos
        const intervalo = setInterval(async () => {
            try {
                const stats = await remarketingService.processarFila();
                if (stats.processados > 0) {
                    console.log(`✅ Remarketing processado: ${stats.processados} itens, ${stats.enviados} enviados, ${stats.ignorados} ignorados, ${stats.erros} erros`);
                }
            } catch (error) {
                console.error('❌ Erro ao processar fila de remarketing:', error.message);
            }
        }, 5 * 60 * 1000); // 5 minutos
        
        // Limpar intervalo ao encerrar processo
        process.on('SIGTERM', () => {
            clearInterval(intervalo);
            console.log('🛑 Serviço de remarketing encerrado');
        });
        
        process.on('SIGINT', () => {
            clearInterval(intervalo);
            console.log('🛑 Serviço de remarketing encerrado');
        });
        
        console.log('✅ Serviço de remarketing automático inicializado (processamento a cada 5 minutos)');
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao inicializar serviço de remarketing:', error);
        return false;
    }
}

module.exports = { loadRemarketing };

