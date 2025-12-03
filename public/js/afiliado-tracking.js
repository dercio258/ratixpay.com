/**
 * Script de Rastreamento de Afiliados
 * Rastreia conversões usando Meta Pixel e UTMify quando o produto é afiliado
 * Não gera erros se não houver configuração ou se o produto não for afiliado
 */

(function() {
    'use strict';

    const API_BASE = window.API_BASE || window.location.origin + '/api';
    let afiliadoConfig = null;
    let produtoInfo = null;

    /**
     * Buscar configurações do afiliado
     */
    async function buscarConfiguracoesAfiliado(codigoAfiliado) {
        try {
            if (!codigoAfiliado) {
                return null;
            }

            const response = await fetch(`${API_BASE}/afiliados/config/${codigoAfiliado}`);
            
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            
            if (data.success && data.data) {
                return data.data;
            }

            return null;
        } catch (error) {
            console.warn('⚠️ Erro ao buscar configurações do afiliado (não crítico):', error);
            return null;
        }
    }

    /**
     * Inicializar Meta Pixel do afiliado
     */
    function inicializarMetaPixelAfiliado(pixelId, eventData) {
        try {
            if (!pixelId || !/^\d{15,16}$/.test(pixelId)) {
                return;
            }

            // Carregar script do Meta Pixel se ainda não estiver carregado
            if (typeof fbq === 'undefined') {
                !function(f,b,e,v,n,t,s) {
                    if(f.fbq)return;
                    n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                    n.queue=[];t=b.createElement(e);t.async=!0;
                    t.src=v;s=b.getElementsByTagName(e)[0];
                    s.parentNode.insertBefore(t,s)
                }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
            }

            // Aguardar um pouco para garantir que fbq está disponível
            setTimeout(() => {
                if (typeof fbq !== 'undefined') {
                    fbq('init', pixelId);
                    fbq('track', 'PageView');

                    // Se houver dados de evento, disparar
                    if (eventData) {
                        if (eventData.event === 'Purchase') {
                            fbq('track', 'Purchase', {
                                value: eventData.value || 0,
                                currency: eventData.currency || 'MZN',
                                content_ids: eventData.content_ids || [],
                                content_name: eventData.content_name || ''
                            });
                        } else if (eventData.event === 'InitiateCheckout') {
                            fbq('track', 'InitiateCheckout', {
                                value: eventData.value || 0,
                                currency: eventData.currency || 'MZN',
                                content_ids: eventData.content_ids || [],
                                content_name: eventData.content_name || ''
                            });
                        } else if (eventData.event === 'ViewContent') {
                            fbq('track', 'ViewContent', {
                                content_ids: eventData.content_ids || [],
                                content_name: eventData.content_name || '',
                                content_type: 'product'
                            });
                        }
                    }

                    console.log('✅ Meta Pixel do afiliado inicializado:', pixelId);
                }
            }, 500);
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar Meta Pixel do afiliado (não crítico):', error);
        }
    }

    /**
     * Rastrear conversão no UTMify
     */
    async function rastrearUTMify(apiToken, eventData) {
        try {
            if (!apiToken || !apiToken.trim()) {
                return;
            }

            if (!eventData || !eventData.event) {
                return;
            }

            // UTMify API endpoint
            const utmifyUrl = 'https://api.utmify.com/v1/track';

            const payload = {
                event: eventData.event,
                value: eventData.value || 0,
                currency: eventData.currency || 'MZN',
                product_id: eventData.product_id || null,
                product_name: eventData.product_name || null,
                order_id: eventData.order_id || null,
                customer_email: eventData.customer_email || null
            };

            const response = await fetch(utmifyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiToken}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                console.log('✅ Evento rastreado no UTMify:', eventData.event);
            } else {
                console.warn('⚠️ Erro ao rastrear no UTMify:', response.status);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao rastrear no UTMify (não crítico):', error);
        }
    }

    /**
     * Inicializar rastreamento no checkout
     */
    async function inicializarRastreamentoCheckout() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const codigoAfiliado = urlParams.get('ref');
            const produtoId = urlParams.get('produto');

            if (!codigoAfiliado || !produtoId) {
                return; // Não é uma venda afiliada
            }

            // Buscar configurações do afiliado
            afiliadoConfig = await buscarConfiguracoesAfiliado(codigoAfiliado);
            
            if (!afiliadoConfig) {
                return; // Afiliado não encontrado ou sem configurações
            }

            // Buscar informações do produto
            try {
                const response = await fetch(`${API_BASE}/produtos/public/${produtoId}`);
                if (response.ok) {
                    produtoInfo = await response.json();
                }
            } catch (error) {
                console.warn('⚠️ Erro ao buscar produto (não crítico):', error);
            }

            // Salvar código do afiliado no sessionStorage para uso na página de sucesso
            sessionStorage.setItem('afiliado_ref', codigoAfiliado);
            if (produtoId) {
                sessionStorage.setItem('produto_id', produtoId);
            }

            // Inicializar Meta Pixel se configurado
            if (afiliadoConfig.meta_pixel_id) {
                inicializarMetaPixelAfiliado(afiliadoConfig.meta_pixel_id, {
                    event: 'ViewContent',
                    content_ids: produtoInfo ? [produtoInfo.id] : [],
                    content_name: produtoInfo ? produtoInfo.nome : ''
                });
            }

            // Rastrear InitiateCheckout quando o usuário clicar em "Pagar Agora"
            const pagarButton = document.querySelector('button[type="submit"], .btn-pagar, #btnPagar');
            if (pagarButton) {
                pagarButton.addEventListener('click', function() {
                    if (afiliadoConfig.meta_pixel_id && typeof fbq !== 'undefined') {
                        fbq('track', 'InitiateCheckout', {
                            value: produtoInfo ? parseFloat(produtoInfo.preco || 0) : 0,
                            currency: 'MZN',
                            content_ids: produtoInfo ? [produtoInfo.id] : [],
                            content_name: produtoInfo ? produtoInfo.nome : ''
                        });
                    }
                });
            }

            console.log('✅ Rastreamento de afiliado inicializado no checkout');
        } catch (error) {
            console.warn('⚠️ Erro ao inicializar rastreamento no checkout (não crítico):', error);
        }
    }

    /**
     * Rastrear conversão na página de sucesso
     */
    async function rastrearConversaoSucesso() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const codigoAfiliado = urlParams.get('ref') || sessionStorage.getItem('afiliado_ref');
            const produtoId = urlParams.get('produto') || sessionStorage.getItem('produto_id');
            const pedidoId = urlParams.get('pedido') || urlParams.get('idpedido');
            const valor = parseFloat(urlParams.get('amount') || urlParams.get('valor') || '0');
            const email = urlParams.get('email') || sessionStorage.getItem('customer_email');

            if (!codigoAfiliado || !produtoId) {
                return; // Não é uma venda afiliada
            }

            // Buscar configurações do afiliado
            afiliadoConfig = await buscarConfiguracoesAfiliado(codigoAfiliado);
            
            if (!afiliadoConfig) {
                return; // Afiliado não encontrado ou sem configurações
            }

            // Buscar informações do produto
            if (!produtoInfo) {
                try {
                    const response = await fetch(`${API_BASE}/produtos/public/${produtoId}`);
                    if (response.ok) {
                        produtoInfo = await response.json();
                    }
                } catch (error) {
                    console.warn('⚠️ Erro ao buscar produto (não crítico):', error);
                }
            }

            const eventData = {
                event: 'Purchase',
                value: valor,
                currency: 'MZN',
                product_id: produtoInfo ? produtoInfo.id : null,
                product_name: produtoInfo ? produtoInfo.nome : null,
                order_id: pedidoId,
                customer_email: email
            };

            // Rastrear no Meta Pixel
            if (afiliadoConfig.meta_pixel_id) {
                inicializarMetaPixelAfiliado(afiliadoConfig.meta_pixel_id, eventData);
            }

            // Rastrear no UTMify
            if (afiliadoConfig.utmify_api_token) {
                await rastrearUTMify(afiliadoConfig.utmify_api_token, eventData);
            }

            console.log('✅ Conversão rastreada para afiliado:', codigoAfiliado);
        } catch (error) {
            console.warn('⚠️ Erro ao rastrear conversão (não crítico):', error);
        }
    }

    // Exportar funções para uso global
    window.AfiliadoTracking = {
        inicializarCheckout: inicializarRastreamentoCheckout,
        rastrearSucesso: rastrearConversaoSucesso,
        buscarConfig: buscarConfiguracoesAfiliado
    };

    // Auto-inicializar baseado na página
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            if (window.location.pathname.includes('checkout')) {
                inicializarRastreamentoCheckout();
            } else if (window.location.pathname.includes('payment-success')) {
                rastrearConversaoSucesso();
            }
        });
    } else {
        if (window.location.pathname.includes('checkout')) {
            inicializarRastreamentoCheckout();
        } else if (window.location.pathname.includes('payment-success')) {
            rastrearConversaoSucesso();
        }
    }
})();

