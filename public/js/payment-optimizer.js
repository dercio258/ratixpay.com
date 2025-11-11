/**
 * Otimizador de Processamento de Pagamentos
 * Melhora a velocidade e experiência do usuário durante pagamentos
 */

(function() {
    'use strict';

    const PaymentOptimizer = {
        // Cache de requisições
        requestCache: new Map(),
        cacheTimeout: 30000, // 30 segundos

        init: function() {
            this.optimizePaymentForm();
            this.setupRequestDebouncing();
            this.preloadPaymentResources();
        },

        /**
         * Otimizar formulário de pagamento
         */
        optimizePaymentForm: function() {
            const paymentForms = document.querySelectorAll('form[action*="pagar"], form[data-payment]');
            
            paymentForms.forEach(form => {
                // Adicionar loading state
                form.addEventListener('submit', (e) => {
                    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.innerHTML = '<span class="spinner"></span> Processando...';
                    }
                });

                // Validação em tempo real (não bloquear submit)
                const inputs = form.querySelectorAll('input, select');
                inputs.forEach(input => {
                    input.addEventListener('blur', () => {
                        this.validateField(input);
                    });
                });
            });
        },

        /**
         * Validar campo individual
         */
        validateField: function(field) {
            // Validação rápida sem bloquear
            if (field.hasAttribute('required') && !field.value.trim()) {
                field.classList.add('error');
                return false;
            }
            field.classList.remove('error');
            return true;
        },

        /**
         * Debounce de requisições para evitar múltiplas chamadas
         */
        setupRequestDebouncing: function() {
            const originalFetch = window.fetch;
            const pendingRequests = new Map();

            window.fetch = function(url, options) {
                // Aplicar debounce apenas para pagamentos
                if (url.includes('/api/pagar')) {
                    const cacheKey = `${url}-${JSON.stringify(options?.body || '')}`;
                    
                    if (pendingRequests.has(cacheKey)) {
                        return pendingRequests.get(cacheKey);
                    }

                    const request = originalFetch(url, options)
                        .finally(() => {
                            setTimeout(() => pendingRequests.delete(cacheKey), 1000);
                        });

                    pendingRequests.set(cacheKey, request);
                    return request;
                }

                return originalFetch(url, options);
            };
        },

        /**
         * Pré-carregar recursos necessários para pagamento
         */
        preloadPaymentResources: function() {
            // Pré-carregar scripts críticos
            const criticalScripts = [
                '/js/checkout-new.js',
                '/js/payment-status.js'
            ];

            criticalScripts.forEach(src => {
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = src;
                document.head.appendChild(link);
            });
        },

        /**
         * Otimizar requisição de pagamento
         */
        optimizePaymentRequest: function(paymentData) {
            // Remover dados desnecessários
            const optimized = {
                produtoPublicId: paymentData.produtoPublicId,
                numeroCelular: paymentData.numeroCelular,
                metodo: paymentData.metodo,
                valor: paymentData.valor,
                nomeCliente: paymentData.nomeCliente,
                emailCliente: paymentData.emailCliente
            };

            // Adicionar apenas campos opcionais se preenchidos
            if (paymentData.whatsappCliente) optimized.whatsappCliente = paymentData.whatsappCliente;
            if (paymentData.cupomDesconto) optimized.cupomDesconto = paymentData.cupomDesconto;
            if (paymentData.afiliadoCodigo) optimized.afiliadoCodigo = paymentData.afiliadoCodigo;

            return optimized;
        }
    };

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => PaymentOptimizer.init());
    } else {
        PaymentOptimizer.init();
    }

    window.PaymentOptimizer = PaymentOptimizer;
})();

