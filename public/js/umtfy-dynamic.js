// Umtfy Dynamic Integration Script
// Este script gerencia a integração dinâmica com a plataforma Umtfy

(function() {
    // Recupera integrações do localStorage
    let umtfyIntegracoes = [];
    try {
        umtfyIntegracoes = JSON.parse(localStorage.getItem('umtfyIntegracoes') || '[]');
    } catch (e) {
        console.error('Erro ao carregar integrações Umtfy:', e);
    }
    
    if (!umtfyIntegracoes.length) return;

    // Inicializa o SDK do Umtfy (simulado)
    window.UmtfySDK = window.UmtfySDK || {
        init: function(apiKey) {
            console.log(`Umtfy SDK inicializado com a chave: ${apiKey}`);
            return true;
        },
        trackEvent: function(eventName, data) {
            console.log(`Umtfy evento rastreado: ${eventName}`, data);
            return true;
        },
        setupNotifications: function(types) {
            console.log(`Umtfy notificações configuradas: ${types.join(', ')}`);
            return true;
        }
    };

    // Inicializa cada integração Umtfy
    umtfyIntegracoes.forEach(integracao => {
        // Inicializa o SDK para cada API key
        UmtfySDK.init(integracao.apiKey);
        
        // Configura as notificações conforme definido na integração
        UmtfySDK.setupNotifications(integracao.notificacoes);
        
        // Rastreia eventos com base na página atual
        const path = window.location.pathname;
        
        // Evento de compra na página de sucesso
        if (integracao.notificacoes.includes('compra') && path.includes('sucesso')) {
            UmtfySDK.trackEvent('purchase_complete', {
                product_id: integracao.produtoId,
                product_name: integracao.produtoNome,
                timestamp: new Date().toISOString()
            });
        }
        
        // Evento de abandono de carrinho
        if (integracao.notificacoes.includes('abandono')) {
            // Armazena informação de carrinho para posterior verificação de abandono
            if (path.includes('checkout')) {
                localStorage.setItem('umtfy_cart', JSON.stringify({
                    product_id: integracao.produtoId,
                    product_name: integracao.produtoNome,
                    timestamp: new Date().toISOString()
                }));
            }
        }
        
        // Evento de visualização para reengajamento
        if (integracao.notificacoes.includes('reengajamento')) {
            UmtfySDK.trackEvent('page_view', {
                product_id: integracao.produtoId,
                product_name: integracao.produtoNome,
                page: path,
                timestamp: new Date().toISOString()
            });
        }
        
        // Configuração para promoções
        if (integracao.notificacoes.includes('promocao')) {
            // Simula a exibição de uma promoção após 5 segundos na página
            setTimeout(() => {
                console.log(`Umtfy: Exibindo promoção para ${integracao.produtoNome}`);
                // Aqui seria implementada a lógica real de exibição de promoções
            }, 5000);
        }
    });
    
    // Adiciona listener para eventos de saída da página (para abandono de carrinho)
    window.addEventListener('beforeunload', function() {
        const cartData = localStorage.getItem('umtfy_cart');
        if (cartData && window.location.pathname.includes('checkout')) {
            try {
                const cart = JSON.parse(cartData);
                // Em uma implementação real, enviaria estes dados para o servidor
                console.log('Umtfy: Possível abandono de carrinho detectado', cart);
            } catch (e) {}
        }
    });
})();