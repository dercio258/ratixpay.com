/**
 * Sistema Unificado de Gerenciamento de Dark Mode - RatixPay
 * Dark Mode PRETO (não azul) - Controle centralizado
 */

(function() {
    'use strict';

    const DarkModeManager = {
        // Verificar se dark mode está ativo
        isDarkMode: function() {
            if (!document.body) return false;
            return document.body.classList.contains('dark-mode');
        },

        // Toggle dark mode
        toggle: function() {
            const isCurrentlyDark = this.isDarkMode();
            const isDark = !isCurrentlyDark;
            
            // Aplicar em documentElement e body para garantir consistência
            if (isDark) {
                if (document.documentElement) {
                    document.documentElement.classList.add('dark-mode');
                }
                if (document.body) {
                    document.body.classList.add('dark-mode');
                }
            } else {
                if (document.documentElement) {
                    document.documentElement.classList.remove('dark-mode');
                }
                if (document.body) {
                    document.body.classList.remove('dark-mode');
                }
            }
            
            // Salvar no localStorage
            localStorage.setItem('darkMode', isDark ? 'true' : 'false');
            
            // Atualizar ícone do botão (se existir)
            this.updateIcon(isDark);
            
            // Disparar evento customizado para sincronizar outras páginas
            const event = new CustomEvent('darkModeChanged', { 
                detail: { isDark: isDark } 
            });
            document.dispatchEvent(event);
            
            // Forçar repaint para garantir que as mudanças sejam visíveis
            if (document.body) {
                void document.body.offsetHeight;
            }
            
            return isDark;
        },

        // Ativar dark mode
        enable: function() {
            if (!this.isDarkMode()) {
                this.toggle();
            }
        },

        // Desativar dark mode
        disable: function() {
            if (this.isDarkMode()) {
                this.toggle();
            }
        },

        // Atualizar ícone do botão
        updateIcon: function(isDark) {
            const toggleBtn = document.getElementById('darkModeToggle');
            if (!toggleBtn) return;

            const icon = toggleBtn.querySelector('i');
            if (icon) {
                if (isDark) {
                    icon.className = 'fas fa-sun';
                    toggleBtn.title = 'Mudar para Modo Claro';
                } else {
                    icon.className = 'fas fa-moon';
                    toggleBtn.title = 'Mudar para Modo Escuro';
                }
            }
        },

        // Inicializar dark mode baseado em preferências (sem criar botão)
        // Light mode é o padrão - dark mode só pode ser ativado pelo botão do dashboard
        init: function(createButton = false) {
            // Verificar localStorage primeiro
            const savedTheme = localStorage.getItem('darkMode');
            
            // Função para aplicar dark mode de forma consistente
            const applyDarkMode = function(isDark) {
                // Aplicar em documentElement e body para garantir consistência
                if (isDark) {
                    if (document.documentElement) {
                        document.documentElement.classList.add('dark-mode');
                    }
                    if (document.body) {
                        document.body.classList.add('dark-mode');
                    }
                } else {
                    if (document.documentElement) {
                        document.documentElement.classList.remove('dark-mode');
                    }
                    if (document.body) {
                        document.body.classList.remove('dark-mode');
                    }
                }
            };
            
            // Aplicar dark mode APENAS se estiver explicitamente salvo como 'true'
            // Por padrão, sempre inicia em light mode
            if (savedTheme === 'true') {
                applyDarkMode(true);
            } else {
                // Light mode é o padrão
                applyDarkMode(false);
                // Se não houver preferência salva, salvar como light mode
                if (savedTheme === null) {
                    localStorage.setItem('darkMode', 'false');
                }
            }

            // Atualizar ícone se o botão existir
            this.updateIcon(this.isDarkMode());

            // Criar botão apenas se solicitado (apenas no dashboard)
            if (createButton) {
                this.addStyles();
                this.createToggleButton();
            }

            // Ouvir mudanças no localStorage (sincronização entre abas)
            // Isso permite que mudanças no dashboard sejam refletidas em outras abas
            window.addEventListener('storage', (e) => {
                if (e.key === 'darkMode') {
                    const isDark = e.newValue === 'true';
                    if (isDark) {
                        if (document.documentElement) {
                            document.documentElement.classList.add('dark-mode');
                        }
                        if (document.body) {
                            document.body.classList.add('dark-mode');
                        }
                    } else {
                        if (document.documentElement) {
                            document.documentElement.classList.remove('dark-mode');
                        }
                        if (document.body) {
                            document.body.classList.remove('dark-mode');
                        }
                    }
                    this.updateIcon(isDark);
                }
            });
            
            // Ouvir eventos customizados de dark mode (sincronização na mesma aba)
            document.addEventListener('darkModeChanged', (e) => {
                const isDark = e.detail.isDark;
                if (isDark) {
                    if (document.documentElement) {
                        document.documentElement.classList.add('dark-mode');
                    }
                    if (document.body) {
                        document.body.classList.add('dark-mode');
                    }
                } else {
                    if (document.documentElement) {
                        document.documentElement.classList.remove('dark-mode');
                    }
                    if (document.body) {
                        document.body.classList.remove('dark-mode');
                    }
                }
                this.updateIcon(isDark);
            });
        },

        // Criar botão toggle (se não existir)
        createToggleButton: function() {
            // Verificar se já existe
            if (document.getElementById('darkModeToggle')) {
                return;
            }

            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'darkModeToggle';
            toggleBtn.className = 'dark-mode-toggle';
            toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            toggleBtn.title = 'Mudar para Modo Escuro';
            toggleBtn.setAttribute('aria-label', 'Alternar tema escuro/claro');
            
            // Adicionar estilos inline básicos se não houver CSS
            toggleBtn.style.cssText = `
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: var(--dm-bg-card, #ffffff);
                border: 1px solid var(--dm-border, #e2e8f0);
                color: var(--dm-text-muted, #64748b);
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                z-index: 100;
            `;

            toggleBtn.addEventListener('click', () => {
                this.toggle();
            });

            // Tentar adicionar ao header-right primeiro
            const headerRight = document.querySelector('.header-right');
            if (headerRight) {
                headerRight.insertBefore(toggleBtn, headerRight.firstChild);
            } else {
                // Se não houver header-right, adicionar ao body
                document.body.appendChild(toggleBtn);
                toggleBtn.style.position = 'fixed';
                toggleBtn.style.top = '20px';
                toggleBtn.style.right = '20px';
                toggleBtn.style.zIndex = '9999';
            }
        },

        // Adicionar estilos CSS se não existir
        addStyles: function() {
            if (document.getElementById('dark-mode-toggle-styles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'dark-mode-toggle-styles';
            style.textContent = `
                .dark-mode-toggle {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background: var(--dm-bg-card, #ffffff);
                    border: 1px solid var(--dm-border, #e2e8f0);
                    color: var(--dm-text-muted, #64748b);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .dark-mode-toggle:hover {
                    background: var(--dm-bg-hover, #f1f5f9);
                    color: var(--primary, #f64c00);
                    transform: scale(1.1);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }

                body.dark-mode .dark-mode-toggle {
                    background: var(--dm-bg-card, #111111);
                    border-color: var(--dm-border, #2a2a2a);
                    color: var(--dm-text-muted, #a0a0a0);
                }

                body.dark-mode .dark-mode-toggle:hover {
                    background: var(--dm-bg-hover, #1a1a1a);
                    color: var(--primary, #f64c00);
                }

                .dark-mode-toggle i {
                    font-size: 18px;
                    transition: transform 0.3s ease;
                }

                .dark-mode-toggle:hover i {
                    transform: rotate(15deg);
                }
            `;

            document.head.appendChild(style);
        }
    };

    // Inicialização IMEDIATA e SINCRONA para evitar flicker
    // Aplicar dark mode ANTES do DOM estar pronto para evitar flash de conteúdo
    (function applyDarkModeImmediately() {
        const savedTheme = localStorage.getItem('darkMode');
        
        // Aplicar imediatamente no html e body se existirem
        if (savedTheme === 'true') {
            if (document.documentElement) {
                document.documentElement.classList.add('dark-mode');
            }
            if (document.body) {
                document.body.classList.add('dark-mode');
            }
        } else {
            // Garantir que está em light mode
            if (document.documentElement) {
                document.documentElement.classList.remove('dark-mode');
            }
            if (document.body) {
                document.body.classList.remove('dark-mode');
            }
            // Salvar como false se não existir
            if (savedTheme === null) {
                localStorage.setItem('darkMode', 'false');
            }
        }
    })();

    // Auto-inicializar quando o DOM estiver pronto
    // Apenas inicializa o dark mode, NÃO cria o botão automaticamente
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            DarkModeManager.init();
        });
    } else {
        DarkModeManager.init();
    }

    // Exportar para uso global
    window.DarkModeManager = DarkModeManager;
    window.toggleDarkMode = function() {
        return DarkModeManager.toggle();
    };

})();

