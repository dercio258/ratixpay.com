// Utilitários para páginas administrativas
(function() {
    'use strict';

    // Função para obter token válido
    window.getValidToken = function() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            return null;
        }
        
        // Verificar se o token tem formato válido (JWT tem 3 partes separadas por pontos)
        const parts = token.split('.');
        if (parts.length !== 3) {
            console.error('Token malformado, limpando...');
            clearInvalidTokens();
            return null;
        }
        
        return token;
    };

    // Limpar tokens inválidos
    window.clearInvalidTokens = function() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('userData');
    };

    // Verificar se o usuário é admin autorizado via Google
    window.verificarAdminAutorizado = async function() {
        try {
            const token = getValidToken();
            if (!token) {
                return false;
            }

            const response = await fetch(`${window.API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.user) {
                    const user = result.user;
                    // Verificação especial para email administrativo principal
                    const isMainAdmin = user.email === 'ratixpay.mz@gmail.com';
                    return (user.role === 'admin' || isMainAdmin);
                }
            }
            return false;
        } catch (error) {
            console.error('Erro ao verificar admin autorizado:', error);
            return false;
        }
    };



    // Fazer requisição autenticada
    window.authenticatedFetch = async function(url, options = {}) {
        const token = getValidToken();
        
        if (!token) {
            alert('Token de autenticação inválido. Faça login novamente.');
            window.location.href = 'login.html';
            throw new Error('Token inválido');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        return fetch(url, { ...options, ...defaultOptions });
    };

    // Função para logout
    window.logout = function() {
        clearInvalidTokens();
        window.location.href = 'login.html';
    };

    // Função para mostrar notificação
    window.showNotification = function(message, type = 'info') {
        // Implementação simples com alert - pode ser melhorada com toast
        if (type === 'error') {
            alert('❌ ' + message);
        } else if (type === 'success') {
            alert('✅ ' + message);
        } else if (type === 'warning') {
            alert('⚠️ ' + message);
        } else {
            alert('ℹ️ ' + message);
        }
    };

    // Função para exportar CSV
    window.exportCSV = function(data, filename) {
        try {
            const csv = Array.isArray(data) ? data.join('\n') : data;
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Erro ao exportar CSV:', error);
            showNotification('Erro ao exportar arquivo', 'error');
        }
    };

    // Função para formatar moeda
    window.formatCurrency = function(value, currency = 'MZN') {
        return `${currency} ${parseFloat(value || 0).toFixed(2)}`;
    };

    // Função para formatar data
    window.formatDate = function(date, locale = 'pt-PT') {
        if (!date) return '-';
        return new Date(date).toLocaleDateString(locale);
    };

    // Função para formatar data e hora
    window.formatDateTime = function(date, locale = 'pt-PT') {
        if (!date) return '-';
        return new Date(date).toLocaleString(locale);
    };


})();
