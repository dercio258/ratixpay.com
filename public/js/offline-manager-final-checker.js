/**
 * Offline Manager Final Checker
 * Verifica se o offline-manager está funcionando corretamente após todas as correções
 */

class OfflineManagerFinalChecker {
    constructor() {
        this.init();
    }

    init() {
        console.log('🔍 Offline Manager Final Checker iniciado');
        this.runFinalCheck();
    }

    runFinalCheck() {
        console.log('🔍 Executando verificação final do Offline Manager...');
        
        // Aguardar um pouco para garantir que tudo carregou
        setTimeout(() => {
            this.checkObjectAvailability();
            this.checkMethodAvailability();
            this.checkFunctionality();
            this.showFinalResults();
        }, 1000);
    }

    checkObjectAvailability() {
        console.log('\n📋 VERIFICAÇÃO DE DISPONIBILIDADE:');
        console.log('=====================================');
        
        if (window.offlineManager) {
            console.log('✅ window.offlineManager está disponível');
            console.log('✅ Tipo:', typeof window.offlineManager);
            console.log('✅ Construtor:', window.offlineManager.constructor.name);
        } else {
            console.log('❌ window.offlineManager NÃO está disponível');
            console.log('❌ Verifique se o script foi carregado corretamente');
        }
    }

    checkMethodAvailability() {
        console.log('\n📋 VERIFICAÇÃO DE MÉTODOS:');
        console.log('============================');
        
        const methods = ['isConnected', 'getStatus', 'addToSyncQueue', 'showOfflineMode'];
        
        methods.forEach(method => {
            if (window.offlineManager && typeof window.offlineManager[method] === 'function') {
                console.log(`✅ ${method}() está disponível`);
            } else {
                console.log(`❌ ${method}() NÃO está disponível`);
            }
        });
    }

    checkFunctionality() {
        console.log('\n📋 VERIFICAÇÃO DE FUNCIONALIDADE:');
        console.log('===================================');
        
        try {
            if (window.offlineManager) {
                // Testar isConnected
                const isConnected = window.offlineManager.isConnected();
                console.log(`✅ isConnected() retornou: ${isConnected}`);
                
                // Testar getStatus
                const status = window.offlineManager.getStatus();
                console.log('✅ getStatus() retornou:', status);
                
                // Testar se é uma função
                console.log('✅ isConnected é função:', typeof window.offlineManager.isConnected === 'function');
                
            } else {
                console.log('❌ Não foi possível testar - objeto não disponível');
            }
        } catch (error) {
            console.log('❌ Erro ao testar funcionalidade:', error.message);
        }
    }

    showFinalResults() {
        console.log('\n📊 RESULTADO FINAL:');
        console.log('===================');
        
        const isAvailable = !!window.offlineManager;
        const hasIsConnected = window.offlineManager && typeof window.offlineManager.isConnected === 'function';
        
        if (isAvailable && hasIsConnected) {
            console.log('🎉 SUCESSO! Offline Manager está funcionando corretamente!');
            console.log('✅ Objeto disponível');
            console.log('✅ Método isConnected disponível');
            console.log('✅ Sistema pronto para uso');
        } else {
            console.log('❌ FALHA! Offline Manager não está funcionando corretamente!');
            console.log('❌ Objeto disponível:', isAvailable);
            console.log('❌ Método isConnected disponível:', hasIsConnected);
            console.log('❌ Verifique os logs acima para detalhes');
        }
        
        // Adicionar botão de verificação
        this.addCheckButton();
    }

    addCheckButton() {
        const checkButton = document.createElement('button');
        checkButton.textContent = '🔍 Verificar Offline Manager';
        checkButton.style.cssText = `
            position: fixed;
            top: 130px;
            right: 10px;
            z-index: 9999;
            background: #6f42c1;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        checkButton.onclick = () => {
            console.clear();
            this.runFinalCheck();
        };
        
        document.body.appendChild(checkButton);
    }
}

// Auto-inicializar
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.offlineManagerFinalChecker = new OfflineManagerFinalChecker();
    }, 2000);
});

// Exportar para uso global
window.OfflineManagerFinalChecker = OfflineManagerFinalChecker;

