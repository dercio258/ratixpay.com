/**
 * Loader Screen - Sistema de Carregamento Elegante
 * Aplica um loader fullscreen em todas as páginas
 * 
 * IMPORTANTE: Este script deve ser carregado o mais cedo possível no <head>
 * para garantir que o loader apareça antes do conteúdo
 */

(function() {
    'use strict';

    // Lista de páginas que NÃO devem ter o loader
    const excludedPages = ['payment-success.html'];
    
    // Verificar se a página atual deve ter o loader
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const shouldExclude = excludedPages.some(page => currentPage.includes(page));
    
    if (shouldExclude) {
        return; // Não aplicar loader em páginas excluídas
    }

    // Logo URL - Usando ícone principal para loader
    const LOGO_URL = '/assets/images/icons/loader-icon-120.png';

    /**
     * Criar o HTML do loader
     */
    function createLoaderHTML() {
        const loaderContainer = document.createElement('div');
        loaderContainer.className = 'loader-container';
        loaderContainer.id = 'loaderContainer';
        
        // Criar elementos separadamente para melhor controle
        const logoImg = document.createElement('img');
        logoImg.src = LOGO_URL;
        logoImg.alt = 'RatixPay Logo';
        logoImg.className = 'loader-logo';
        
        // Tratamento de erro da imagem
        logoImg.onerror = function() {
            // Se a imagem falhar, esconder e mostrar apenas o spinner
            this.style.display = 'none';
        };
        
        // Pré-carregar a imagem
        logoImg.loading = 'eager';
        
        const spinner = document.createElement('div');
        spinner.className = 'loader-spinner';
        
        const text = document.createElement('div');
        text.className = 'loader-text';
        text.textContent = 'Carregando...';
        
        loaderContainer.appendChild(logoImg);
        loaderContainer.appendChild(spinner);
        loaderContainer.appendChild(text);
        
        return loaderContainer;
    }

    /**
     * Inicializar o loader imediatamente
     */
    function initLoader() {
        // Adicionar classe loading ao body imediatamente
        if (document.body) {
            document.body.classList.add('loading');
        } else {
            // Se o body ainda não existe, adicionar ao html
            document.documentElement.classList.add('loading');
        }
        
        // Criar e adicionar o loader ao DOM
        const loaderContainer = createLoaderHTML();
        
        // Tentar adicionar ao body, se existir
        if (document.body) {
            document.body.insertBefore(loaderContainer, document.body.firstChild);
        } else {
            // Se o body não existe ainda, adicionar ao documentElement
            document.documentElement.appendChild(loaderContainer);
            
            // Quando o body estiver disponível, mover para lá
            const observer = new MutationObserver(function(mutations) {
                if (document.body) {
                    document.body.insertBefore(loaderContainer, document.body.firstChild);
                    document.body.classList.add('loading');
                    observer.disconnect();
                }
            });
            
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Esconder o loader com animação
     */
    function hideLoader() {
        const loaderContainer = document.getElementById('loaderContainer');
        const body = document.body;
        const html = document.documentElement;
        
        if (loaderContainer) {
            // Adiciona classe para fade out
            loaderContainer.classList.add('hidden');
            
            // Remove classe de loading após a animação (reduzido para ser mais rápido)
            setTimeout(() => {
                if (body) {
                    body.classList.remove('loading');
                }
                html.classList.remove('loading');
                
                // Remove o loader do DOM após a animação completa
                setTimeout(() => {
                    if (loaderContainer.parentNode) {
                        loaderContainer.remove();
                    }
                }, 300);
            }, 300);
        } else {
            // Se o loader não existir, apenas remove a classe
            if (body) {
                body.classList.remove('loading');
            }
            html.classList.remove('loading');
        }
    }

    /**
     * Inicializar o mais cedo possível
     */
    function initialize() {
        // Tentar inicializar imediatamente
        if (document.readyState === 'loading') {
            // Se ainda está carregando, inicializar imediatamente
            initLoader();
            
            // Também adicionar listener para quando o DOM estiver pronto
            document.addEventListener('DOMContentLoaded', function() {
                // Garantir que o loader está visível
                const loaderContainer = document.getElementById('loaderContainer');
                if (!loaderContainer && document.body) {
                    initLoader();
                }
            });
        } else {
            // Se já carregou, inicializar imediatamente
            initLoader();
        }

        // Esconder loader quando a página estiver completamente carregada
        if (document.readyState === 'complete') {
            // Se já está completo, esconder imediatamente
            hideLoader();
        } else {
            // Usar DOMContentLoaded para esconder mais rápido (antes de imagens carregarem)
            document.addEventListener('DOMContentLoaded', function() {
                // Delay mínimo apenas para suavizar a transição
                setTimeout(hideLoader, 100);
            });
            
            // Fallback para recursos pesados
            window.addEventListener('load', function() {
                hideLoader();
            });
        }

        // Fallback: esconder loader após um tempo máximo (evitar loader infinito)
        setTimeout(function() {
            const loaderContainer = document.getElementById('loaderContainer');
            if (loaderContainer && !loaderContainer.classList.contains('hidden')) {
                hideLoader();
            }
        }, 3000); // Máximo de 3 segundos (reduzido de 5)
    }

    // Inicializar imediatamente
    initialize();
})();

