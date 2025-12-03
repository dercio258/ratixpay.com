/**
 * Componente de Sidebar Reutilizável para RATIXPAY
 * Garante consistência visual em todas as páginas
 */

class SidebarComponent {
    constructor() {
        this.logoUrl = '/assets/images/external/icon_principal.png';
        this.logoUrlMobile = '/assets/images/external/icon_principal.png';
        this.menuItems = [
            {
                href: 'dashboard.html',
                icon: 'fas fa-tachometer-alt',
                text: 'Painel',
                section: 'painel'
            },
            {
                href: 'gestao-produtos.html',
                icon: 'fas fa-box',
                text: 'Gestão de Produtos',
                section: 'produtos'
            },
            {
                href: 'gestao-vendas.html',
                icon: 'fas fa-chart-line',
                text: 'Gestão de Vendas',
                section: 'vendas'
            },
            {
                href: 'pagamentos.html',
                icon: 'fas fa-wallet',
                text: 'Pagamentos',
                section: 'pagamentos'
            },
            {
                href: 'ferramentas.html',
                icon: 'fas fa-tools',
                text: 'Ferramentas',
                section: 'ferramentas'
            },
            {
                href: 'integracoes.html',
                icon: 'fas fa-plug',
                text: 'Integrações',
                section: 'integracoes'
            },
            {
                href: 'afiliados-painel.html',
                icon: 'fas fa-handshake',
                text: 'Afiliados',
                section: 'afiliados'
            },
            {
                href: 'premiacoes.html',
                icon: 'fas fa-trophy',
                text: 'Premiações',
                section: 'premiacoes'
            }
        ];
    }

    /**
     * Gera o HTML do sidebar
     * @param {string} activeSection - Seção ativa atual
     * @returns {string} HTML do sidebar
     */
    generateHTML(activeSection = '') {
        const menuItemsHTML = this.menuItems.map(item => {
            const isActive = item.section === activeSection ? 'active' : '';
            const premiumLabel = item.premium ? '<span class="premium-label">Premium</span>' : '';
            return `
                <li>
                    <a href="${item.href}" class="${isActive}" data-section="${item.section}">
                        <i class="${item.icon}"></i>
                        <span>${item.text}</span>
                        ${premiumLabel}
                    </a>
                </li>
            `;
        }).join('');

        return `
            <div class="sidebar">
                <button class="sidebar-toggle-btn" id="sidebar-toggle-btn" aria-label="Toggle sidebar">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="sidebar-logo">
                    <img src="${this.logoUrl}" alt="RATIXPAY Logo" class="sidebar-logo-desktop">
                    <img src="${this.logoUrlMobile}" alt="RATIXPAY Logo" class="sidebar-logo-mobile">
                </div>
                <ul>
                    ${menuItemsHTML}
                </ul>
            </div>
        `;
    }

    /**
     * Aplica o sidebar a uma página
     * @param {string} activeSection - Seção ativa atual
     */
    applyToPage(activeSection = '') {
        const sidebarContainer = document.querySelector('.sidebar');
        if (sidebarContainer) {
            // Ocultar sidebar durante a substituição para evitar flash
            sidebarContainer.style.opacity = '0';
            sidebarContainer.style.visibility = 'hidden';
            
            // Substituir conteúdo
            sidebarContainer.outerHTML = this.generateHTML(activeSection);
            
            // Inicializar funcionalidades
            this.initToggle();
            this.restoreSidebarState();
            
            // Mostrar sidebar após renderização
            const newSidebar = document.querySelector('.sidebar');
            if (newSidebar) {
                // Usar requestAnimationFrame para garantir que o DOM foi atualizado
                requestAnimationFrame(() => {
                    newSidebar.classList.add('loaded');
                    newSidebar.style.opacity = '1';
                    newSidebar.style.visibility = 'visible';
                });
            }
        }
    }
    
    /**
     * Ajusta o main-content baseado no estado do sidebar
     */
    adjustMainContent(isHidden) {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;
        
        // Usar classe no body para controlar via CSS (mais eficiente e sobrescreve !important)
        if (isHidden) {
            document.body.classList.add('sidebar-hidden');
        } else {
            document.body.classList.remove('sidebar-hidden');
            // Restaurar valores padrão quando sidebar está visível
            const width = window.innerWidth;
            let sidebarWidth = '250px';
            if (width <= 480) {
                sidebarWidth = '70px';
            } else if (width <= 768) {
                sidebarWidth = '80px';
            }
            mainContent.style.marginLeft = sidebarWidth;
            mainContent.style.width = `calc(100% - ${sidebarWidth})`;
        }
    }
    
    /**
     * Inicializa a funcionalidade de toggle do sidebar
     */
    initToggle() {
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const sidebar = document.querySelector('.sidebar');
        
        if (!toggleBtn || !sidebar) return;
        
        // Mover o botão para fora do sidebar no DOM
        sidebar.parentNode.insertBefore(toggleBtn, sidebar.nextSibling);
        
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('hidden');
            const isHidden = sidebar.classList.contains('hidden');
            
            // Salvar estado no localStorage
            localStorage.setItem('sidebarHidden', isHidden ? 'true' : 'false');
            
            // Ajustar main-content (já gerencia a classe sidebar-hidden no body)
            this.adjustMainContent(isHidden);
        });
        
        // Ajustar quando a janela for redimensionada
        window.addEventListener('resize', () => {
            const isHidden = sidebar.classList.contains('hidden');
            this.adjustMainContent(isHidden);
        });
    }
    
    /**
     * Restaura o estado do sidebar do localStorage
     */
    restoreSidebarState() {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const isHidden = localStorage.getItem('sidebarHidden') === 'true';
        
        if (!sidebar || !toggleBtn) return;
        
        // Mover o botão para fora do sidebar no DOM
        if (toggleBtn.parentNode === sidebar) {
            sidebar.parentNode.insertBefore(toggleBtn, sidebar.nextSibling);
        }
        
        if (isHidden) {
            sidebar.classList.add('hidden');
            document.body.classList.add('sidebar-hidden');
        } else {
            document.body.classList.remove('sidebar-hidden');
        }
        
        // Ajustar main-content
        this.adjustMainContent(isHidden);
    }

    /**
     * Adiciona estilos CSS para o sidebar se não existirem
     */
    addStyles() {
        if (document.getElementById('sidebar-styles')) return;

        const style = document.createElement('style');
        style.id = 'sidebar-styles';
        style.textContent = `
            .sidebar-logo {
                text-align: center;
                padding: 25px 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                margin-bottom: 0;
                order: -1;
                flex-shrink: 0;
                background: rgba(255, 255, 255, 0.02);
                backdrop-filter: blur(10px);
            }
            
            .sidebar-logo img {
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                object-fit: contain;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
                filter: brightness(1.05);
            }
            
            .sidebar-logo img:hover {
                transform: scale(1.08);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
            }
            
            /* Responsividade para logos - Tamanho otimizado */
            .sidebar-logo-desktop {
                display: block;
                max-width: 90px;
                width: auto;
                height: auto;
                margin: 0 auto;
            }
            
            .sidebar-logo-mobile {
                display: none;
                width: auto;
                max-width: 70px;
                height: auto;
                object-fit: contain;
                margin: 0 auto;
            }
            
            @media (max-width: 768px) {
                .sidebar-logo {
                    padding: 15px 10px;
                    margin: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .sidebar-logo-desktop {
                    display: none;
                }
                
                .sidebar-logo-mobile {
                    display: block;
                    max-width: 50px;
                    width: auto;
                    height: auto;
                    margin: 0 auto;
                }
            }
            
            @media (max-width: 480px) {
                .sidebar-logo {
                    padding: 12px 8px;
                    margin: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .sidebar-logo-desktop {
                    display: none;
                }
                
                .sidebar-logo-mobile {
                    display: block;
                    max-width: 45px;
                    width: auto;
                    height: auto;
                    margin: 0 auto;
                }
            }
            
            .sidebar {
                width: 260px;
                background: linear-gradient(180deg, #000000 0%, #0a0a0a 100%) !important;
                color: #ffffff !important;
                padding: 0;
                display: flex;
                flex-direction: column;
                box-shadow: 4px 0 20px rgba(0,0,0,0.5);
                border-right: 1px solid rgba(255, 255, 255, 0.08);
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                height: 100vh !important;
                z-index: 1001 !important;
                overflow: hidden !important;
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                opacity: 0;
                visibility: hidden;
            }
            
            /* Ocultar sidebar vazio (sem conteúdo renderizado) */
            .sidebar:empty,
            .sidebar:not(:has(ul)) {
                opacity: 0 !important;
                visibility: hidden !important;
            }
            
            /* Sidebar visível apenas quando tiver conteúdo (ul) */
            .sidebar:has(ul),
            .sidebar.loaded {
                opacity: 1 !important;
                visibility: visible !important;
            }
            
            /* Ocultar comentários HTML e texto dentro do sidebar vazio */
            .sidebar:not(:has(ul)) * {
                display: none !important;
            }
            
            /* Sidebar sempre preto, mesmo no dark mode (mesmas cores) */
            body.dark-mode .sidebar {
                background: #000000 !important;
                color: #ffffff !important;
                border-right-color: rgba(255, 255, 255, 0.1) !important;
            }
            
            .sidebar.hidden {
                transform: translateX(-100%);
                width: 0;
                padding: 0;
                overflow: hidden;
            }
            
            .sidebar-toggle-btn {
                position: fixed;
                top: 15px;
                left: 15px;
                background: #ffffff;
                color: #000000;
                border: none;
                border-radius: 50%;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 1003;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            }
            
            .sidebar:not(.hidden) .sidebar-toggle-btn {
                position: absolute;
                top: 15px;
                right: 15px;
                left: auto;
            }
            
            .sidebar-toggle-btn:hover {
                background: #f0f0f0;
                transform: scale(1.1);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .sidebar-toggle-btn i {
                font-size: 14px;
                transition: transform 0.3s ease;
            }
            
            body.sidebar-hidden .sidebar-toggle-btn i {
                transform: rotate(180deg);
            }
            
            /* Ajustar main-content quando sidebar colapsa */
            .main-content {
                transition: margin-left 0.3s ease, width 0.3s ease;
            }
            
            /* Sobrescrever estilos inline quando sidebar está oculto */
            body.sidebar-hidden .main-content {
                margin-left: 0 !important;
                width: 100% !important;
            }
            
            /* Responsividade quando sidebar está oculto */
            @media (max-width: 768px) {
                body.sidebar-hidden .main-content {
                    margin-left: 0 !important;
                    width: 100% !important;
                }
            }
            
            @media (max-width: 480px) {
                body.sidebar-hidden .main-content {
                    margin-left: 0 !important;
                    width: 100% !important;
                }
            }
            
            /* Garantir que logo fique no topo e fixa */
            .sidebar-logo {
                order: -1;
                position: relative;
                background: rgba(255, 255, 255, 0.02);
                z-index: 10;
                flex-shrink: 0;
            }

            /* Sidebar sempre preto - mesmas cores no dark mode (sem ofuscamentos) */
            body.dark-mode .sidebar {
                background: linear-gradient(180deg, #000000 0%, #0a0a0a 100%) !important;
                color: #ffffff !important;
                border-right-color: rgba(255, 255, 255, 0.08) !important;
            }

            body.dark-mode .sidebar-logo {
                background: rgba(255, 255, 255, 0.02) !important;
                border-bottom-color: rgba(255, 255, 255, 0.08) !important;
            }

            body.dark-mode .sidebar ul li a {
                color: #ffffff !important;
            }

            body.dark-mode .sidebar ul li a:hover,
            body.dark-mode .sidebar ul li a.active {
                background: linear-gradient(135deg, rgba(246, 76, 0, 0.2) 0%, rgba(246, 76, 0, 0.1) 100%) !important;
                border-color: rgba(246, 76, 0, 0.3) !important;
                color: #ffffff !important;
            }

            body.dark-mode .sidebar-toggle-btn {
                background: #ffffff !important;
                color: #000000 !important;
            }

            body.dark-mode .sidebar-toggle-btn:hover {
                background: #f0f0f0 !important;
            }
            
            .sidebar ul {
                list-style: none;
                padding: 15px 12px;
                margin: 0;
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 6px;
                overflow-y: auto;
                overflow-x: hidden;
                scrollbar-width: thin;
                scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
            }
            
            .sidebar ul::-webkit-scrollbar {
                width: 4px;
            }
            
            .sidebar ul::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .sidebar ul::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
            }
            
            .sidebar ul::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .sidebar ul li {
                margin-bottom: 0;
            }
            
            .sidebar ul li a {
                color: rgba(255, 255, 255, 0.85);
                text-decoration: none;
                display: flex;
                align-items: center;
                padding: 14px 16px;
                border-radius: 10px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid transparent;
                min-height: 50px;
                white-space: nowrap;
                font-weight: 500;
                font-size: 14px;
                position: relative;
            }
            
            .sidebar ul li a::before {
                content: '';
                position: absolute;
                left: 0;
                top: 50%;
                transform: translateY(-50%);
                width: 3px;
                height: 0;
                background: linear-gradient(180deg, #f64c00 0%, #ff8c42 100%);
                border-radius: 0 3px 3px 0;
                transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .sidebar ul li a:hover {
                background: rgba(255, 255, 255, 0.05);
                color: #ffffff;
                transform: translateX(3px);
                border-color: rgba(246, 76, 0, 0.2);
            }
            
            .sidebar ul li a:hover::before {
                height: 60%;
            }
            
            .sidebar ul li a.active {
                background: linear-gradient(135deg, rgba(246, 76, 0, 0.15) 0%, rgba(246, 76, 0, 0.08) 100%);
                border: 1px solid rgba(246, 76, 0, 0.3);
                color: #ffffff;
                transform: translateX(3px);
                box-shadow: 0 2px 8px rgba(246, 76, 0, 0.15);
                font-weight: 600;
            }
            
            .sidebar ul li a.active::before {
                height: 70%;
            }
            
            .sidebar ul li a i {
                margin-right: 12px;
                font-size: 18px;
                width: 20px;
                text-align: center;
                flex-shrink: 0;
            }
            
            .sidebar ul li a span {
                font-size: 14px;
                font-weight: 500;
                line-height: 1.2;
            }
            
            .premium-label {
                background: linear-gradient(45deg, #FFD700, #FFA500);
                color: #000;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3);
                animation: premiumGlow 2s ease-in-out infinite alternate;
            }
            
            @keyframes premiumGlow {
                from { box-shadow: 0 2px 4px rgba(255, 215, 0, 0.3); }
                to { box-shadow: 0 2px 8px rgba(255, 215, 0, 0.6); }
            }
            
            /* Responsividade */
            @media (max-width: 768px) {
                .sidebar:not(.hidden) {
                    width: 70px;
                    align-items: center;
                    padding: 0;
                }
                
                .sidebar-logo {
                    padding: 15px 10px;
                    margin-bottom: 0;
                }
                
                .sidebar-logo-desktop {
                    max-width: 50px !important;
                }
                
                .sidebar-logo-mobile {
                    max-width: 50px !important;
                }
                
                .sidebar h2 {
                    font-size: 18px;
                }
                
                .sidebar ul {
                    padding: 10px 8px;
                    gap: 4px;
                }
                
                .sidebar ul li a {
                    padding: 12px 8px;
                    justify-content: center;
                    min-height: 44px;
                    border-radius: 8px;
                }
                
                .sidebar ul li a span {
                    display: none;
                }
                
                .sidebar ul li a i {
                    margin-right: 0;
                    font-size: 20px;
                }
                
                .sidebar-toggle-btn {
                    width: 28px;
                    height: 28px;
                    top: 12px;
                }
                
                .sidebar:not(.hidden) .sidebar-toggle-btn {
                    top: 12px;
                    right: 12px;
                }
            }
            
            @media (max-width: 480px) {
                .sidebar:not(.hidden) {
                    width: 60px;
                    padding: 0;
                }
                
                .sidebar-logo {
                    padding: 12px 8px;
                    margin-bottom: 0;
                }
                
                .sidebar-logo-desktop {
                    max-width: 45px !important;
                }
                
                .sidebar-logo-mobile {
                    max-width: 45px !important;
                }
                
                .sidebar ul {
                    padding: 8px 6px;
                    gap: 3px;
                }
                
                .sidebar ul li a {
                    padding: 10px 6px;
                    min-height: 40px;
                    border-radius: 8px;
                }
                
                .sidebar ul li a i {
                    font-size: 18px;
                }
                
                .sidebar-toggle-btn {
                    width: 26px;
                    height: 26px;
                    top: 10px;
                    left: 10px;
                }
                
                .sidebar-toggle-btn i {
                    font-size: 12px;
                }
                
                .sidebar:not(.hidden) .sidebar-toggle-btn {
                    top: 10px;
                    right: 10px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Inicializa o sidebar na página
     * @param {string} activeSection - Seção ativa atual
     */
    init(activeSection = '') {
        // Adicionar estilos primeiro
        this.addStyles();
        
        // Ocultar sidebar vazio imediatamente
        const sidebarContainer = document.querySelector('.sidebar');
        if (sidebarContainer && !sidebarContainer.querySelector('ul')) {
            sidebarContainer.style.opacity = '0';
            sidebarContainer.style.visibility = 'hidden';
        }
        
        // Aplicar sidebar
        this.applyToPage(activeSection);
    }
}

// Exportar para uso global
window.SidebarComponent = SidebarComponent;

// Auto-inicializar se houver sidebar vazio na página (antes do DOMContentLoaded)
(function() {
    'use strict';
    
    // Função para inicializar sidebar se necessário
    function autoInitSidebar() {
        const sidebarContainer = document.querySelector('.sidebar');
        if (sidebarContainer && (!sidebarContainer.querySelector('ul') || sidebarContainer.textContent.trim() === '' || sidebarContainer.innerHTML.includes('SidebarComponent') || sidebarContainer.innerHTML.includes('preenchido'))) {
            // Ocultar sidebar vazio imediatamente
            sidebarContainer.style.opacity = '0';
            sidebarContainer.style.visibility = 'hidden';
            sidebarContainer.style.minHeight = '100vh';
            sidebarContainer.style.background = '#000000';
        }
    }
    
    // Tentar inicializar imediatamente se o DOM já estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInitSidebar);
    } else {
        autoInitSidebar();
    }
    
    // Também tentar após um pequeno delay para garantir
    setTimeout(autoInitSidebar, 10);
})();

