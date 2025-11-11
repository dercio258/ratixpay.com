// Utils.js - Funções utilitárias para o sistema admin

// Formatar moeda
function formatCurrency(value) {
    if (!value && value !== 0) return 'MZN 0,00';
    return `MZN ${parseFloat(value).toFixed(2).replace('.', ',')}`;
}

// Formatar data
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Formatar data e hora
function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
}

// Formatar status
function formatStatus(status) {
    const statusClasses = {
        'Pendente': 'warning',
        'Aprovada': 'success',
        'Cancelada': 'danger',
        'Entregue': 'info',
        'pendente': 'warning',
        'aprovado': 'success',
        'rejeitado': 'danger',
        'pago': 'success',
        'cancelado': 'secondary',
        'Ativa': 'success',
        'Bloqueada': 'danger'
    };
    return statusClasses[status] || 'secondary';
}

// Mostrar notificação
function showNotification(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    toast.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    toast.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, duration);
}

// Fazer requisição HTTP
async function fetchAPI(endpoint, options = {}) {
    const baseUrl = window.API_BASE || window.location.origin + '/api';
    const url = baseUrl + endpoint;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include'
    };

    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    } catch (error) {
        console.error('Erro na requisição API:', error);
        throw error;
    }
}

// Verificar se usuário está autenticado
function isAuthenticated() {
    const token = localStorage.getItem('ratixpay_token');
    return !!token;
}

// Redirecionar para login se não autenticado
function requireAuth() {
    const token = localStorage.getItem('ratixpay_token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Criar objeto Utils
const Utils = {
    formatCurrency,
    formatDate,
    formatDateTime,
    formatStatus,
    showNotification,
    fetchAPI,
    isAuthenticated,
    requireAuth
};

// Exportar para uso global
window.Utils = Utils;
