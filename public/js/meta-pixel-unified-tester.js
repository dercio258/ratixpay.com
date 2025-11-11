/**
 * Meta Pixel Unified Tester
 * Testa se o meta-pixel-unified.js está funcionando corretamente após as correções
 */

class MetaPixelUnifiedTester {
    constructor() {
        this.testResults = [];
        this.init();
    }

    init() {
        console.log('🧪 Meta Pixel Unified Tester iniciado');
        this.runTests();
    }

    runTests() {
        console.log('🔍 Executando testes do Meta Pixel Unified...');
        
        // Teste 1: Verificar se a classe existe
        this.testClassExists();
        
        // Teste 2: Verificar se os métodos existem
        this.testMethodsExist();
        
        // Teste 3: Verificar se o helper está disponível
        this.testHelperExists();
        
        // Teste 4: Testar eventos
        this.testEventTracking();
        
        // Mostrar resultados
        this.showResults();
    }

    testClassExists() {
        try {
            if (typeof MetaPixelUnified !== 'undefined') {
                this.addResult('✅ Classe MetaPixelUnified existe', true);
            } else {
                this.addResult('❌ Classe MetaPixelUnified não encontrada', false);
            }
        } catch (error) {
            this.addResult('❌ Erro ao verificar classe: ' + error.message, false);
        }
    }

    testMethodsExist() {
        const requiredMethods = [
            'trackEvent',
            'trackCustomEvent',
            'trackCheckoutEvents',
            'trackPaymentSuccessEvents',
            'trackProductView',
            'trackPaymentSuccess',
            'trackPaymentError'
        ];

        requiredMethods.forEach(method => {
            try {
                if (window.metaPixelUnified && typeof window.metaPixelUnified[method] === 'function') {
                    this.addResult(`✅ Método ${method} existe`, true);
                } else {
                    this.addResult(`❌ Método ${method} não encontrado`, false);
                }
            } catch (error) {
                this.addResult(`❌ Erro ao verificar método ${method}: ${error.message}`, false);
            }
        });
    }

    testHelperExists() {
        try {
            if (window.metaPixelHelper && typeof window.metaPixelHelper.track === 'function') {
                this.addResult('✅ Meta Pixel Helper disponível', true);
            } else {
                this.addResult('❌ Meta Pixel Helper não encontrado', false);
            }
        } catch (error) {
            this.addResult('❌ Erro ao verificar helper: ' + error.message, false);
        }
    }

    testEventTracking() {
        try {
            if (window.metaPixelHelper) {
                // Testar evento PageView
                window.metaPixelHelper.track('PageView', {
                    page_title: 'Teste',
                    page_location: window.location.href
                });
                this.addResult('✅ Evento PageView testado com sucesso', true);
                
                // Testar evento Purchase
                window.metaPixelHelper.track('Purchase', {
                    value: 1.00,
                    currency: 'MZN',
                    content_name: 'Produto Teste'
                });
                this.addResult('✅ Evento Purchase testado com sucesso', true);
                
            } else {
                this.addResult('❌ Não foi possível testar eventos - Helper não disponível', false);
            }
        } catch (error) {
            this.addResult('❌ Erro ao testar eventos: ' + error.message, false);
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
        console.log('\n📊 RESULTADOS DOS TESTES:');
        console.log('='.repeat(50));
        
        let successCount = 0;
        let totalCount = this.testResults.length;
        
        this.testResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.message}`);
            if (result.success) successCount++;
        });
        
        console.log('='.repeat(50));
        console.log(`✅ Sucessos: ${successCount}/${totalCount}`);
        console.log(`❌ Falhas: ${totalCount - successCount}/${totalCount}`);
        
        if (successCount === totalCount) {
            console.log('🎉 Todos os testes passaram! Meta Pixel Unified está funcionando corretamente.');
        } else {
            console.log('⚠️ Alguns testes falharam. Verifique os erros acima.');
        }
        
        // Adicionar botão de teste na interface
        this.addTestButton();
    }

    addTestButton() {
        const testButton = document.createElement('button');
        testButton.textContent = '🧪 Testar Meta Pixel Unified';
        testButton.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            z-index: 9999;
            background: #28a745;
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
    // Aguardar um pouco para o Meta Pixel Unified carregar
    setTimeout(() => {
        window.metaPixelUnifiedTester = new MetaPixelUnifiedTester();
    }, 2000);
});

// Exportar para uso global
window.MetaPixelUnifiedTester = MetaPixelUnifiedTester;

