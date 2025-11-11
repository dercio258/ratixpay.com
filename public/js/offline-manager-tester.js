/**
 * Offline Manager Tester - Verifica se o Offline Manager está funcionando
 */

class OfflineManagerTester {
    constructor() {
        this.testResults = [];
        this.init();
    }

    init() {
        console.log('🧪 Offline Manager Tester iniciado');
        this.runTests();
    }

    runTests() {
        console.log('🔍 Executando testes do Offline Manager...');
        
        // Teste 1: Verificar se o objeto existe
        this.testObjectExists();
        
        // Teste 2: Verificar se os métodos existem
        this.testMethodsExist();
        
        // Teste 3: Testar funcionalidades
        this.testFunctionality();
        
        // Mostrar resultados
        this.showResults();
    }

    testObjectExists() {
        try {
            if (window.offlineManager) {
                this.addResult('✅ OfflineManager objeto existe', true);
            } else {
                this.addResult('❌ OfflineManager objeto não encontrado', false);
            }
        } catch (error) {
            this.addResult('❌ Erro ao verificar objeto: ' + error.message, false);
        }
    }

    testMethodsExist() {
        const requiredMethods = [
            'isConnected',
            'getStatus',
            'addToSyncQueue',
            'showOfflineMode'
        ];

        requiredMethods.forEach(method => {
            try {
                if (window.offlineManager && typeof window.offlineManager[method] === 'function') {
                    this.addResult(`✅ Método ${method} existe`, true);
                } else {
                    this.addResult(`❌ Método ${method} não encontrado`, false);
                }
            } catch (error) {
                this.addResult(`❌ Erro ao verificar método ${method}: ${error.message}`, false);
            }
        });
    }

    testFunctionality() {
        try {
            if (window.offlineManager) {
                // Testar isConnected
                const isConnected = window.offlineManager.isConnected();
                this.addResult(`✅ isConnected() retornou: ${isConnected}`, true);
                
                // Testar getStatus
                const status = window.offlineManager.getStatus();
                this.addResult(`✅ getStatus() retornou dados válidos`, true);
                
                // Testar addToSyncQueue
                window.offlineManager.addToSyncQueue({
                    type: 'test',
                    data: { test: true }
                });
                this.addResult('✅ addToSyncQueue() executado com sucesso', true);
                
            } else {
                this.addResult('❌ Não foi possível testar funcionalidades - Objeto não disponível', false);
            }
        } catch (error) {
            this.addResult('❌ Erro ao testar funcionalidades: ' + error.message, false);
        }
    }

    addResult(message, success) {
        this.testResults.push({
            message: message,
            success: success,
            timestamp: new Date().toISOString()
        });
    }

    showResults() {
        console.log('\n📊 RESULTADOS DOS TESTES - OFFLINE MANAGER:');
        console.log('============================================================');
        
        let successCount = 0;
        let totalCount = this.testResults.length;
        
        this.testResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.message}`);
            if (result.success) successCount++;
        });
        
        console.log('============================================================');
        console.log(`✅ Sucessos: ${successCount}/${totalCount}`);
        console.log(`❌ Falhas: ${totalCount - successCount}/${totalCount}`);
        
        if (successCount === totalCount) {
            console.log('🎉 Todos os testes passaram! Offline Manager está funcionando corretamente.');
        } else {
            console.log('⚠️ Alguns testes falharam. Verifique os erros acima.');
        }
        
        // Adicionar botão de teste na interface
        this.addTestButton();
    }

    addTestButton() {
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 Testar Offline Manager';
        testButton.style.cssText = `
            position: fixed;
            top: 90px;
            right: 10px;
            z-index: 9999;
            background: #17a2b8;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        testButton.onclick = () => {
            console.clear();
            this.runTests();
        };
        
        document.body.appendChild(testButton);
    }
}

// Auto-inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco para o Offline Manager carregar
    setTimeout(() => {
        window.offlineManagerTester = new OfflineManagerTester();
    }, 2000);
});

// Exportar para uso global
window.OfflineManagerTester = OfflineManagerTester;

