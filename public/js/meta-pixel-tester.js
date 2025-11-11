/**
 * Meta Pixel Tester - Verifica se o Pixel está funcionando corretamente
 * Use este script para testar se os eventos estão sendo enviados para a Meta
 */

class MetaPixelTester {
    constructor() {
        this.pixelId = null;
        this.isLoaded = false;
        this.eventsSent = [];
        this.init();
    }

    init() {
        console.log('🧪 Meta Pixel Tester iniciado');
        this.checkPixelStatus();
        this.setupEventListeners();
    }

    checkPixelStatus() {
        // Verificar se o Pixel está carregado
        if (typeof fbq !== 'undefined') {
            this.isLoaded = true;
            console.log('✅ Meta Pixel (fbq) está carregado');
        } else {
            console.log('❌ Meta Pixel (fbq) não está carregado');
        }

        // Verificar Pixel ID no localStorage
        this.pixelId = localStorage.getItem("currentPixelId");
        if (this.pixelId) {
            console.log('✅ Pixel ID encontrado:', this.pixelId);
        } else {
            console.log('❌ Nenhum Pixel ID encontrado no localStorage');
        }
    }

    setupEventListeners() {
        // Interceptar chamadas do fbq para monitorar eventos
        if (typeof fbq !== 'undefined') {
            const originalFbq = window.fbq;
            const self = this;
            
            window.fbq = function() {
                const args = Array.from(arguments);
                console.log('🎯 Evento fbq detectado:', args);
                self.eventsSent.push({
                    timestamp: new Date().toISOString(),
                    event: args[0],
                    data: args[1] || null
                });
                
                // Chamar função original
                return originalFbq.apply(this, arguments);
            };
        }
    }

    testPixelEvents() {
        console.log('🧪 Testando eventos do Meta Pixel...');
        
        if (!this.isLoaded) {
            console.log('❌ Meta Pixel não está carregado. Não é possível testar.');
            return false;
        }

        if (!this.pixelId) {
            console.log('❌ Nenhum Pixel ID configurado. Não é possível testar.');
            return false;
        }

        try {
            // Testar PageView
            fbq('track', 'PageView');
            console.log('✅ Evento PageView enviado');
            
            // Testar Purchase
            fbq('track', 'Purchase', {
                value: 1.00,
                currency: 'MZN',
                content_name: 'Teste de Produto',
                content_category: 'Venda',
                content_ids: ['test-123'],
                order_id: 'test-order-' + Date.now()
            });
            console.log('✅ Evento Purchase enviado');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar eventos de teste:', error);
            return false;
        }
    }

    getTestReport() {
        const report = {
            pixelId: this.pixelId,
            isLoaded: this.isLoaded,
            eventsSent: this.eventsSent,
            timestamp: new Date().toISOString()
        };
        
        console.log('📊 Relatório de Teste do Meta Pixel:', report);
        return report;
    }

    checkNetworkRequests() {
        console.log('🌐 Verificando requisições de rede...');
        
        // Verificar se há requisições para Facebook
        const performanceEntries = performance.getEntriesByType('resource');
        const facebookRequests = performanceEntries.filter(entry => 
            entry.name.includes('facebook.com') || 
            entry.name.includes('connect.facebook.net')
        );
        
        console.log('📡 Requisições para Facebook encontradas:', facebookRequests.length);
        facebookRequests.forEach((request, index) => {
            console.log(`  ${index + 1}. ${request.name} - Status: ${request.responseStatus || 'N/A'}`);
        });
        
        return facebookRequests;
    }
}

// Auto-inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    window.metaPixelTester = new MetaPixelTester();
    
    // Adicionar botão de teste na interface
    const testButton = document.createElement('button');
    testButton.textContent = '🧪 Testar Meta Pixel';
    testButton.style.cssText = `
            position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        background: #007bff;
                color: white;
                border: none;
        padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
        font-size: 12px;
    `;
    
    testButton.onclick = function() {
        window.metaPixelTester.testPixelEvents();
        window.metaPixelTester.checkNetworkRequests();
        window.metaPixelTester.getTestReport();
    };
    
    document.body.appendChild(testButton);
    
    console.log('🧪 Meta Pixel Tester carregado. Use o botão "Testar Meta Pixel" para verificar o funcionamento.');
});

// Exportar para uso global
window.MetaPixelTester = MetaPixelTester;