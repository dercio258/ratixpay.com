/**
 * Inicialização do Sidebar - RatixPay
 * Garante que o sidebar seja inicializado corretamente em todas as páginas
 */

(function() {
    'use strict';

    // Configurações do sidebar
    const SIDEBAR_CONFIG = {
        selector: '#sidebar',
        toggleSelector: '#sidebar-toggle',
        activeClass: 'active',
        openClass: 'active',
        animationDuration: 300
    };

    // Estado do sidebar
    let sidebarState = {
        isOpen: false,
        isInitialized: false,
        isMobile: window.innerWidth <= 768
    };

    // Elementos do DOM
    let sidebar, toggleBtn, body;

    /**
     * Inicializar sidebar
     */
    function initSidebar() {
        try {
            // Buscar elementos
            sidebar = document.querySelector(SIDEBAR_CONFIG.selector);
            toggleBtn = document.querySelector(SIDEBAR_CONFIG.toggleSelector);
            body = document.body;

            if (!sidebar) {
                console.warn('Sidebar não encontrado:', SIDEBAR_CONFIG.selector);
                return false;
            }

        // Overlay removido - não é mais necessário

            // Adicionar event listeners
            addEventListeners();

            // Configurar estado inicial
            setupInitialState();

            sidebarState.isInitialized = true;
            console.log('✅ Sidebar inicializado com sucesso');
            return true;

        } catch (error) {
            console.error('❌ Erro ao inicializar sidebar:', error);
            return false;
        }
    }

    /**
     * Adicionar event listeners
     */
    function addEventListeners() {
        // Toggle button
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleSidebar);
        }

        // Overlay removido - não é mais necessário

        // Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && sidebarState.isOpen) {
                closeSidebar();
            }
        });

        // Resize
        window.addEventListener('resize', handleResize);

        // Click outside
        document.addEventListener('click', handleClickOutside);
    }

    /**
     * Configurar estado inicial
     */
    function setupInitialState() {
        // Verificar se sidebar deve estar aberto por padrão
        const shouldBeOpen = localStorage.getItem('sidebar-open') === 'true';
        
        if (shouldBeOpen && !sidebarState.isMobile) {
            openSidebar();
        } else {
            closeSidebar();
        }

        // Adicionar classes CSS necessárias
        sidebar.classList.add('sidebar-initialized');
    }

    /**
     * Toggle sidebar
     */
    function toggleSidebar() {
        if (sidebarState.isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    /**
     * Abrir sidebar
     */
    function openSidebar() {
        if (!sidebarState.isInitialized) return;

        sidebarState.isOpen = true;
        sidebar.classList.add(SIDEBAR_CONFIG.activeClass);
        body.classList.add(SIDEBAR_CONFIG.openClass);

        // Salvar estado
        localStorage.setItem('sidebar-open', 'true');

        // Emitir evento customizado
        window.dispatchEvent(new CustomEvent('sidebar:open', {
            detail: { sidebar: sidebar }
        }));

        console.log('📱 Sidebar aberto');
    }

    /**
     * Fechar sidebar
     */
    function closeSidebar() {
        if (!sidebarState.isInitialized) return;

        sidebarState.isOpen = false;
        sidebar.classList.remove(SIDEBAR_CONFIG.activeClass);
        body.classList.remove(SIDEBAR_CONFIG.openClass);

        // Salvar estado
        localStorage.setItem('sidebar-open', 'false');

        // Emitir evento customizado
        window.dispatchEvent(new CustomEvent('sidebar:close', {
            detail: { sidebar: sidebar }
        }));

        console.log('📱 Sidebar fechado');
    }

    /**
     * Handle resize
     */
    function handleResize() {
        const wasMobile = sidebarState.isMobile;
        sidebarState.isMobile = window.innerWidth <= 768;

        // Se mudou de desktop para mobile ou vice-versa
        if (wasMobile !== sidebarState.isMobile) {
            if (sidebarState.isMobile) {
                // Mobile: fechar sidebar por padrão
                closeSidebar();
            } else {
                // Desktop: restaurar estado salvo
                const shouldBeOpen = localStorage.getItem('sidebar-open') === 'true';
                if (shouldBeOpen) {
                    openSidebar();
                }
            }
        }
    }

    /**
     * Handle click outside
     */
    function handleClickOutside(e) {
        if (!sidebarState.isOpen || !sidebarState.isMobile) return;

        const isClickInsideSidebar = sidebar.contains(e.target);
        const isClickOnToggle = toggleBtn && toggleBtn.contains(e.target);

        if (!isClickInsideSidebar && !isClickOnToggle) {
            closeSidebar();
        }
    }

    /**
     * Verificar se sidebar está visível
     */
    function isSidebarVisible() {
        return sidebarState.isOpen;
    }

    /**
     * Obter estado do sidebar
     */
    function getSidebarState() {
        return {
            isOpen: sidebarState.isOpen,
            isInitialized: sidebarState.isInitialized,
            isMobile: sidebarState.isMobile
        };
    }

    /**
     * API pública
     */
    window.SidebarManager = {
        init: initSidebar,
        open: openSidebar,
        close: closeSidebar,
        toggle: toggleSidebar,
        isVisible: isSidebarVisible,
        getState: getSidebarState
    };

    // Auto-inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }

    // Fallback: tentar inicializar após um delay
    setTimeout(function() {
        if (!sidebarState.isInitialized) {
            console.warn('⚠️ Tentando inicializar sidebar novamente...');
            initSidebar();
        }
    }, 1000);

})();
