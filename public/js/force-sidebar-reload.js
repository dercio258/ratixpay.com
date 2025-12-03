/**
 * Script para forçar reload do sidebar com cache busting
 * Execute no console: forceSidebarReload()
 */

(function() {
    'use strict';

    /**
     * Força o reload do sidebar component com cache busting
     */
    function forceSidebarReload(activeSection = '') {
        console.log('🔄 Forçando reload do sidebar...');
        
        // 1. Remover script antigo do sidebar
        const oldScripts = document.querySelectorAll('script[src*="sidebar-component.js"]');
        oldScripts.forEach(script => {
            script.remove();
            console.log('🗑️ Script antigo removido');
        });

        // 2. Limpar cache do localStorage
        localStorage.removeItem('sidebarHidden');
        localStorage.removeItem('sidebar-open');
        
        // 3. Remover sidebar atual
        const sidebarContainer = document.querySelector('.sidebar');
        if (sidebarContainer) {
            sidebarContainer.remove();
            console.log('🗑️ Sidebar antigo removido');
        }

        // 4. Criar novo script com cache busting
        const timestamp = Date.now();
        const script = document.createElement('script');
        script.src = `/js/sidebar-component.js?v=${timestamp}&_cb=${Math.random()}`;
        script.onload = function() {
            console.log('✅ Script do sidebar recarregado');
            
            // Aguardar um pouco para garantir que o script foi carregado
            setTimeout(() => {
                if (typeof SidebarComponent !== 'undefined') {
                    const sidebar = new SidebarComponent();
                    
                    // Criar container se não existir
                    const dashboardContainer = document.querySelector('.dashboard-container');
                    if (dashboardContainer && !document.querySelector('.sidebar')) {
                        const newSidebarContainer = document.createElement('div');
                        newSidebarContainer.className = 'sidebar';
                        dashboardContainer.insertBefore(newSidebarContainer, dashboardContainer.querySelector('.main-content'));
                    }
                    
                    // Inicializar sidebar
                    sidebar.init(activeSection || getActiveSectionFromURL());
                    console.log('✅ Sidebar reinicializado com sucesso!');
                } else {
                    console.error('❌ SidebarComponent não encontrado após reload');
                }
            }, 100);
        };
        
        script.onerror = function() {
            console.error('❌ Erro ao carregar script do sidebar');
        };

        // 5. Adicionar novo script ao documento
        document.head.appendChild(script);
        console.log('📥 Carregando novo script do sidebar...');
    }

    /**
     * Detecta a seção ativa baseada na URL
     */
    function getActiveSectionFromURL() {
        const path = window.location.pathname;
        const page = path.split('/').pop() || path;
        
        const sectionMap = {
            'dashboard.html': 'painel',
            'gestao-produtos.html': 'produtos',
            'gestao-vendas.html': 'vendas',
            'pagamentos.html': 'pagamentos',
            'ferramentas.html': 'ferramentas',
            'integracoes.html': 'integracoes',
            'afiliados-painel.html': 'afiliados',
            'premiacoes.html': 'premiacoes'
        };
        
        return sectionMap[page] || '';
    }

    /**
     * Adiciona botão de força reload no console
     */
    function addReloadButton() {
        // Criar botão temporário (apenas em desenvolvimento)
        if (window.location.hostname === 'localhost' || window.location.search.includes('dev=true')) {
            const button = document.createElement('button');
            button.textContent = '🔄 Atualizar Sidebar';
            button.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                background: #f64c00;
                color: white;
                border: none;
                padding: 12px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                transition: all 0.3s ease;
            `;
            
            button.onmouseover = function() {
                this.style.transform = 'scale(1.05)';
                this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.4)';
            };
            
            button.onmouseout = function() {
                this.style.transform = 'scale(1)';
                this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
            };
            
            button.onclick = function() {
                forceSidebarReload();
            };
            
            document.body.appendChild(button);
            console.log('🔄 Botão de atualização do sidebar adicionado (modo dev)');
        }
    }

    // Exportar função globalmente
    window.forceSidebarReload = forceSidebarReload;
    
    // Adicionar botão em desenvolvimento
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addReloadButton);
    } else {
        addReloadButton();
    }

    console.log('✅ Script de força reload do sidebar carregado');
    console.log('💡 Use: forceSidebarReload() no console para forçar atualização');
})();

