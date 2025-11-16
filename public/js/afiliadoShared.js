/**
 * Componentes e Utilitários Compartilhados para Páginas de Afiliado
 * Inclui: Navbar, Header, Loading, Notificações, etc.
 */

// ========== CONFIGURAÇÕES ==========
const AFILIADO_CONFIG = {
    API_BASE: window.location.origin.includes('localhost') 
        ? 'http://localhost:4000/api' 
        : `${window.location.origin}/api`
};

// ========== NAVBAR COMPARTILHADA ==========
class AfiliadoNavbar {
    constructor() {
        this.currentPage = this.detectCurrentPage();
    }

    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('dashboard')) return 'dashboard';
        if (path.includes('vendas')) return 'vendas';
        if (path.includes('saque')) return 'saque';
        if (path.includes('produtos')) return 'produtos';
        return 'dashboard';
    }

    render() {
        const navbar = document.getElementById('afiliadoNavbar');
        if (!navbar) return;

        navbar.innerHTML = `
            <nav class="navbar navbar-expand-lg navbar-dark">
                <div class="container">
                    <a class="navbar-brand" href="afiliado-dashboard.html">
                        <i class="fas fa-handshake"></i> RatixPay Afiliados
                    </a>
                    
                    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                    
                    <div class="collapse navbar-collapse" id="navbarNav">
                        <ul class="navbar-nav me-auto">
                            <li class="nav-item">
                                <a class="nav-link ${this.currentPage === 'dashboard' ? 'active' : ''}" href="afiliado-dashboard.html">
                                    <i class="fas fa-tachometer-alt"></i> Dashboard
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link ${this.currentPage === 'vendas' ? 'active' : ''}" href="afiliado-vendas.html">
                                    <i class="fas fa-shopping-cart"></i> Vendas
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link ${this.currentPage === 'produtos' ? 'active' : ''}" href="afiliado-produtos.html">
                                    <i class="fas fa-box"></i> Produtos
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link ${this.currentPage === 'saque' ? 'active' : ''}" href="afiliado-saque.html">
                                    <i class="fas fa-money-bill-wave"></i> Saques
                                </a>
                            </li>
                        </ul>
                        
                        <div class="d-flex align-items-center gap-3">
                            <span class="text-white" id="afiliadoNomeNav">Carregando...</span>
                            <button class="btn btn-logout" onclick="logout()">
                                <i class="fas fa-sign-out-alt"></i> Sair
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
        `;
    }

    updateNome(nome) {
        const nomeElement = document.getElementById('afiliadoNomeNav');
        if (nomeElement) {
            nomeElement.textContent = nome;
        }
    }
}

// ========== HEADER COMPARTILHADO ==========
class AfiliadoHeader {
    constructor(title, subtitle, icon = 'fas fa-chart-line') {
        this.title = title;
        this.subtitle = subtitle;
        this.icon = icon;
    }

    render() {
        const header = document.getElementById('afiliadoHeader');
        if (!header) return;

        header.innerHTML = `
            <div class="page-header">
                <div class="container">
                    <div class="header-content">
                        <h1 class="header-title">
                            <i class="${this.icon}"></i> ${this.title}
                        </h1>
                        <p class="header-subtitle">${this.subtitle}</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// ========== LOADING ==========
class LoadingManager {
    constructor(elementId = 'loading') {
        this.elementId = elementId;
    }

    show(message = 'Carregando...') {
        const loading = document.getElementById(this.elementId);
        if (loading) {
            loading.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
            loading.style.display = 'block';
        }
    }

    hide() {
        const loading = document.getElementById(this.elementId);
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// ========== NOTIFICAÇÕES ==========
class NotificationManager {
    static show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show notification-toast`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        const icons = {
            success: 'fa-check-circle',
            danger: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        notification.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${message}</span>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }

    static success(message) {
        this.show(message, 'success');
    }

    static error(message) {
        this.show(message, 'danger');
    }

    static warning(message) {
        this.show(message, 'warning');
    }

    static info(message) {
        this.show(message, 'info');
    }
}

// ========== FORMATAÇÃO ==========
class Formatters {
    static moeda(valor) {
        return `MZN ${parseFloat(valor || 0).toFixed(2)}`;
    }

    static data(data) {
        if (!data) return 'N/A';
        return new Date(data).toLocaleString('pt-BR');
    }

    static dataCurta(data) {
        if (!data) return 'N/A';
        return new Date(data).toLocaleDateString('pt-BR');
    }

    static numero(numero) {
        return new Intl.NumberFormat('pt-BR').format(numero || 0);
    }

    static percentual(valor, total) {
        if (!total || total === 0) return '0.00%';
        return `${((valor / total) * 100).toFixed(2)}%`;
    }
}

// ========== VALIDAÇÕES ==========
class Validators {
    static email(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    static telefone(telefone) {
        const re = /^[0-9]{9}$/;
        return re.test(telefone.replace(/\D/g, ''));
    }

    static valor(valor, min = 0, max = null) {
        const num = parseFloat(valor);
        if (isNaN(num) || num < min) return false;
        if (max !== null && num > max) return false;
        return true;
    }
}

// ========== API HELPERS ==========
class ApiHelper {
    static async get(endpoint) {
        if (!window.afiliadoAuth) {
            throw new Error('Sistema de autenticação não carregado');
        }
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${AFILIADO_CONFIG.API_BASE}${endpoint}`,
            { method: 'GET' }
        );
        return response.json();
    }

    static async post(endpoint, data) {
        if (!window.afiliadoAuth) {
            throw new Error('Sistema de autenticação não carregado');
        }
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${AFILIADO_CONFIG.API_BASE}${endpoint}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }
        );
        return response.json();
    }

    static async put(endpoint, data) {
        if (!window.afiliadoAuth) {
            throw new Error('Sistema de autenticação não carregado');
        }
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${AFILIADO_CONFIG.API_BASE}${endpoint}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }
        );
        return response.json();
    }

    static async delete(endpoint) {
        if (!window.afiliadoAuth) {
            throw new Error('Sistema de autenticação não carregado');
        }
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${AFILIADO_CONFIG.API_BASE}${endpoint}`,
            { method: 'DELETE' }
        );
        return response.json();
    }
}

// ========== INICIALIZAÇÃO ==========
class AfiliadoPage {
    constructor() {
        this.navbar = new AfiliadoNavbar();
        this.loading = new LoadingManager();
        this.afiliado = null;
    }

    async init() {
        try {
            // Verificar autenticação
            if (!window.afiliadoAuth || !window.afiliadoAuth.isAuthenticated()) {
                window.location.href = '/afiliado-login.html';
                return;
            }

            // Verificar token
            const verification = await window.afiliadoAuth.verifyToken();
            if (!verification.valid) {
                window.location.href = '/afiliado-login.html';
                return;
            }

            // Carregar dados do afiliado
            this.afiliado = window.afiliadoAuth.getAfiliadoData() || verification.afiliado;
            
            // Renderizar navbar
            this.navbar.render();
            this.navbar.updateNome(this.afiliado?.nome || 'Afiliado');

            return this.afiliado;
        } catch (error) {
            console.error('Erro ao inicializar página:', error);
            NotificationManager.error('Erro ao carregar dados. Redirecionando...');
            setTimeout(() => {
                window.location.href = '/afiliado-login.html';
            }, 2000);
        }
    }
}

// ========== EXPORTS ==========
window.AfiliadoNavbar = AfiliadoNavbar;
window.AfiliadoHeader = AfiliadoHeader;
window.LoadingManager = LoadingManager;
window.NotificationManager = NotificationManager;
window.Formatters = Formatters;
window.Validators = Validators;
window.ApiHelper = ApiHelper;
window.AfiliadoPage = AfiliadoPage;

// Função de logout global
window.logout = function() {
    if (window.afiliadoAuth) {
        window.afiliadoAuth.logout();
    } else {
        localStorage.removeItem('afiliado_token');
        localStorage.removeItem('afiliado_data');
        localStorage.removeItem('afiliado_refresh_token');
        sessionStorage.removeItem('afiliado_token');
        sessionStorage.removeItem('afiliado_data');
        sessionStorage.removeItem('afiliado_refresh_token');
        window.location.href = '/afiliado-login.html';
    }
};

