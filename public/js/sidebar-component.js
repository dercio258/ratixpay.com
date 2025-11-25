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
                    <img src="${this.logoUrl}" alt="RATIXPAY Logo" class="sidebar-logo-desktop" style="width: 100%; height: auto; max-width: 113px; display: block; margin: 0 auto;">
                    <img src="${this.logoUrlMobile}" alt="RATIXPAY Logo" class="sidebar-logo-mobile" style="width: 100%; height: auto; max-width: 100%; display: none; margin: 0 auto;">
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
            sidebarContainer.outerHTML = this.generateHTML(activeSection);
            this.initToggle();
            this.restoreSidebarState();
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
                padding: 20px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                margin-bottom: 20px;
                order: -1;
                flex-shrink: 0;
            }
            
            .sidebar-logo img {
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                object-fit: contain;
                transition: transform 0.3s ease;
            }
            
            .sidebar-logo img:hover {
                transform: scale(1.05);
            }
            
            /* Responsividade para logos */
            .sidebar-logo-desktop {
                display: block;
                max-width: 113px;
                width: 100%;
                height: auto;
            }
            
            .sidebar-logo-mobile {
                display: none;
                width: 100%;
                max-width: 100%;
                height: auto;
                object-fit: contain;
            }
            
            @media (max-width: 768px) {
                .sidebar-logo {
                    padding: 10px 5px;
                    margin: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .sidebar-logo-desktop {
                    display: none;
                }
                
                .sidebar-logo-mobile {
                    display: block;
                    max-width: calc(100% - 10px);
                    width: auto;
                    height: auto;
                    margin: 0 auto;
                }
            }
            
            @media (max-width: 480px) {
                .sidebar-logo {
                    padding: 8px 5px;
                    margin: 0;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .sidebar-logo-mobile {
                    max-width: calc(100% - 10px);
                    width: auto;
                    height: auto;
                }
            }
            
            .sidebar {
                width: 250px;
                background: #000000;
                color: var(--white);
                padding: 20px;
                display: flex;
                flex-direction: column;
                box-shadow: 2px 0 15px rgba(0,0,0,0.4);
                border-right: 1px solid rgba(255, 255, 255, 0.1);
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                height: 100vh !important;
                z-index: 1001 !important;
                overflow-y: auto;
                overflow-x: hidden;
                transition: transform 0.3s ease, width 0.3s ease;
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
                position: sticky;
                top: 0;
                background: #000000;
                z-index: 10;
                flex-shrink: 0;
            }
            
            .sidebar ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .sidebar ul li {
                margin-bottom: 15px;
            }
            
            .sidebar ul li a {
                color: var(--white);
                text-decoration: none;
                display: flex;
                align-items: center;
                padding: 12px 15px;
                border-radius: 8px;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid transparent;
                min-height: 48px;
                white-space: nowrap;
            }
            
            .sidebar ul li a:hover,
            .sidebar ul li a.active {
                background: linear-gradient(135deg, rgba(246, 76, 0, 0.2) 0%, rgba(246, 76, 0, 0.1) 100%);
                border: 1px solid rgba(246, 76, 0, 0.3);
                transform: translateX(5px);
                box-shadow: 0 2px 8px rgba(246, 76, 0, 0.2);
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
                    width: 80px;
                    align-items: center;
                    padding: 15px 10px;
                }
                
                .sidebar-logo {
                    padding: 10px 5px;
                    margin-bottom: 15px;
                }
                
                .sidebar h2 {
                    font-size: 18px;
                }
                
                .sidebar ul li a {
                    padding: 12px 8px;
                    justify-content: center;
                    min-height: 44px;
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
                    width: 70px;
                    padding: 10px 5px;
                }
                
                .sidebar-logo {
                    padding: 8px 5px;
                    margin-bottom: 10px;
                }
                
                .sidebar ul li a {
                    padding: 10px 5px;
                    min-height: 40px;
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
        this.addStyles();
        this.applyToPage(activeSection);
    }
}

// Exportar para uso global
window.SidebarComponent = SidebarComponent;

