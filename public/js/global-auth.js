// Sistema de autenticação global para todas as páginas
(function() {
    'use strict';

    // Configuração da API
    const API_BASE = window.API_BASE || 'http://localhost:3000/api';

    // Páginas que não precisam de autenticação
    const PUBLIC_PAGES = [
        'login.html',
        'register.html',
        'verify-email.html',
        'forgot-password.html',
        'desbloquear-conta.html',
        'server-error.html',
        'index.html',
        'checkout.html',
        'payment-success.html'
    ];

    // Verificar se a página atual precisa de autenticação
    function needsAuthentication() {
        const currentPage = window.location.pathname.split('/').pop();
        return !PUBLIC_PAGES.includes(currentPage);
    }

    // Verificar token local
    function verifyTokenLocal(token) {
        try {
            if (!token) {
                return false;
            }
            
            const parts = token.split('.');
            if (parts.length !== 3) {
                return false;
            }
            
            const payload = JSON.parse(atob(parts[1]));
            const now = Math.floor(Date.now() / 1000);
            
            if (payload.exp && payload.exp < now) {
                return false;
            }
            
            // Verificação especial para email administrativo principal
            const isMainAdmin = payload.email === 'ratixpay.mz@gmail.com';
            const isRegularUser = payload.role === 'admin' || payload.role === 'user';
            
            return isMainAdmin || isRegularUser;
        } catch (error) {
            console.error('Erro na verificação local do token:', error);
            return false;
        }
    }

    // Verificar autenticação no servidor
    async function verifyTokenServer(token) {
        // NUNCA fazer chamada sem token
        if (!token || token.trim() === '') {
            console.warn('⚠️ Tentativa de verificar token sem token fornecido - bloqueada');
            return false;
        }
        
        try {
            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.success && data.user;
            }
            return false;
        } catch (error) {
            console.error('Erro na verificação do servidor:', error);
            return false;
        }
    }

    // Verificar autenticação completa
    async function checkAuthentication() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            return false;
        }

        // Verificação local rápida
        if (!verifyTokenLocal(token)) {
            return false;
        }

        // Verificação no servidor (em background)
        try {
            const serverValid = await verifyTokenServer(token);
            if (!serverValid) {
                // Limpar tokens inválidos
                localStorage.removeItem('authToken');
                localStorage.removeItem('token');
                localStorage.removeItem('adminToken');
                return false;
            }
            return true;
        } catch (error) {
            console.error('Erro na verificação de autenticação:', error);
            return false;
        }
    }

    // Redirecionar para login
    function redirectToLogin() {
        console.log('🔒 Redirecionando para login...');
        window.location.href = 'login.html';
    }

    // Verificar se usuário está suspenso
    async function checkSuspension() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            // NUNCA fazer chamada sem token
            if (!token || token.trim() === '') {
                console.warn('⚠️ Tentativa de verificar suspensão sem token - bloqueada');
                return false;
            }

            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    return data.user.suspenso === true;
                }
            }
            return false;
        } catch (error) {
            console.error('Erro ao verificar suspensão:', error);
            return false;
        }
    }

    // Verificar se usuário está ativo
    async function checkActive() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            // NUNCA fazer chamada sem token
            if (!token || token.trim() === '') {
                console.warn('⚠️ Tentativa de verificar status ativo sem token - bloqueada');
                return false;
            }

            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    return data.user.ativo === true;
                }
            }
            return false;
        } catch (error) {
            console.error('Erro ao verificar status ativo:', error);
            return false;
        }
    }

    // Verificar se usuário tem marketing avançado ativo
    async function checkMarketingAvancado() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            // NUNCA fazer chamada sem token
            if (!token || token.trim() === '') {
                console.warn('⚠️ Tentativa de verificar marketing avançado sem token - bloqueada');
                return false;
            }

            const response = await fetch(`${API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    return data.user.marketing_avancado === true;
                }
            }
            return false;
        } catch (error) {
            console.error('Erro ao verificar marketing avançado:', error);
            return false;
        }
    }

    // Verificar se é página de configuração de marketing
    function isMarketingConfigPage() {
        const currentPage = window.location.pathname.split('/').pop();
        const marketingPages = [
            // Páginas de configuração removidas - agora integradas na criação de produtos
        ];
        return marketingPages.includes(currentPage);
    }

    // Sistema principal de autenticação
    async function initAuthentication() {
        // Se a página não precisa de autenticação, sair IMEDIATAMENTE sem fazer nenhuma chamada
        if (!needsAuthentication()) {
            return;
        }

        console.log('🔐 Página protegida, verificando autenticação...');

        // Verificar token ANTES de qualquer chamada
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token || token.trim() === '') {
            console.log('❌ Nenhum token encontrado, redirecionando para login');
            redirectToLogin();
            return;
        }

        // Verificar autenticação (já verifica token localmente primeiro)
        const isAuthenticated = await checkAuthentication();
        
        if (!isAuthenticated) {
            console.log('❌ Usuário não autenticado');
            redirectToLogin();
            return;
        }

        console.log('✅ Usuário autenticado');

        // Verificar se usuário está ativo (já verifica token antes de chamar)
        const isActive = await checkActive();
        if (!isActive) {
            console.log('❌ Conta inativa');
            window.location.href = 'login.html?error=conta-desativada';
            return;
        }

        // Verificar se usuário está suspenso (já verifica token antes de chamar)
        const isSuspended = await checkSuspension();
        if (isSuspended) {
            console.log('❌ Conta suspensa');
            window.location.href = 'login.html?error=conta-suspensa';
            return;
        }

        // Verificar marketing avançado para páginas de configuração (já verifica token antes de chamar)
        if (isMarketingConfigPage()) {
            console.log('🎯 Página de configuração de marketing detectada');
            const hasMarketingAvancado = await checkMarketingAvancado();
            if (!hasMarketingAvancado) {
                console.log('❌ Marketing avançado não ativo');
                alert('Marketing avançado não está ativo. Ative o plano premium para acessar estas funcionalidades.');
                window.location.href = 'marketing-avancado.html';
                return;
            }
            console.log('✅ Marketing avançado ativo - acesso autorizado');
        }

        console.log('✅ Acesso autorizado');
    }

    // Inicializar quando o DOM estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAuthentication);
    } else {
        initAuthentication();
    }

    // Expor funções globalmente para uso em outras páginas
    window.GlobalAuth = {
        checkAuthentication,
        verifyTokenLocal,
        verifyTokenServer,
        checkSuspension,
        checkActive,
        checkMarketingAvancado,
        redirectToLogin
    };

})();
