/**
 * Sistema de Otimização e Lazy Loading de Imagens
 * Cachea imagens internas e externas, implementa lazy loading
 */

(function() {
    'use strict';

    const ImageOptimizer = {
        // Cache de imagens em memória
        imageCache: new Map(),
        maxCacheSize: 50,
        
        // Intersection Observer para lazy loading
        observer: null,
        
        init: function() {
            this.setupLazyLoading();
            this.preloadCriticalImages();
            this.setupImageCache();
        },

        /**
         * Configurar lazy loading para todas as imagens
         */
        setupLazyLoading: function() {
            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadImage(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '50px'
                });

                // Observar todas as imagens com data-src
                document.querySelectorAll('img[data-src]').forEach(img => {
                    this.observer.observe(img);
                });
            } else {
                // Fallback para navegadores antigos
                document.querySelectorAll('img[data-src]').forEach(img => {
                    this.loadImage(img);
                });
            }
        },

        /**
         * Carregar imagem com cache
         */
        loadImage: function(img) {
            const src = img.getAttribute('data-src');
            if (!src) return;

            // Verificar cache
            if (this.imageCache.has(src)) {
                img.src = this.imageCache.get(src);
                img.removeAttribute('data-src');
                img.classList.add('loaded');
                return;
            }

            // Carregar imagem
            const imageLoader = new Image();
            imageLoader.onload = () => {
                img.src = src;
                img.removeAttribute('data-src');
                img.classList.add('loaded');
                
                // Adicionar ao cache
                if (this.imageCache.size < this.maxCacheSize) {
                    this.imageCache.set(src, src);
                }
            };
            imageLoader.onerror = () => {
                img.classList.add('error');
                console.warn('Erro ao carregar imagem:', src);
            };
            imageLoader.src = src;
        },

        /**
         * Pré-carregar imagens críticas
         */
        preloadCriticalImages: function() {
            const criticalImages = [
                '/assets/images/icons/loader-icon-120.png',
                '/assets/images/external/icon_principal.png'
            ];

            criticalImages.forEach(src => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = src;
                document.head.appendChild(link);
            });
        },

        /**
         * Configurar cache de imagens via Service Worker
         */
        setupImageCache: function() {
            if ('serviceWorker' in navigator) {
                // Service Worker já está registrado, apenas garantir que está ativo
                navigator.serviceWorker.ready.then(registration => {
                    console.log('✅ Service Worker pronto para cache de imagens');
                });
            }
        },

        /**
         * Otimizar URL de imagem externa usando API de cache
         */
        optimizeExternalImage: function(url, width, height) {
            if (!url || url.startsWith('/') || url.startsWith('data:')) {
                return url; // Imagem local ou data URI
            }

            // Usar API de cache de imagens
            const params = new URLSearchParams({
                url: url,
                quality: 85
            });
            if (width) params.set('width', width);
            if (height) params.set('height', height);

            return `/api/image-cache?${params.toString()}`;
        },

        /**
         * Converter todas as imagens externas para usar cache
         */
        convertExternalImages: function() {
            document.querySelectorAll('img[src^="http"]').forEach(img => {
                const originalSrc = img.src;
                const optimizedSrc = this.optimizeExternalImage(originalSrc);
                
                if (optimizedSrc !== originalSrc) {
                    img.setAttribute('data-src', optimizedSrc);
                    img.removeAttribute('src');
                    img.classList.add('lazy-image');
                }
            });
        }
    };

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => ImageOptimizer.init());
    } else {
        ImageOptimizer.init();
    }

    // Converter imagens externas após carregamento completo
    window.addEventListener('load', () => {
        setTimeout(() => ImageOptimizer.convertExternalImages(), 1000);
    });

    // Exportar para uso global
    window.ImageOptimizer = ImageOptimizer;
})();

