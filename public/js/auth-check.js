// Script para verificar autenticação em páginas protegidas
(function() {
    'use strict';

    // Verificação local do token (fallback)
    function verificarTokenLocal(token) {
        try {
            console.log('🔍 Verificando token localmente...');
            
            if (!token) {
                console.log('❌ Token não fornecido');
                return false;
            }
            
            // Verificar se o token tem formato JWT válido
            const parts = token.split('.');
            console.log('🔍 Partes do token:', parts.length);
            
            if (parts.length !== 3) {
                console.log('❌ Token não tem formato JWT válido');
                return false;
            }
            
            // Decodificar payload
            const payload = JSON.parse(atob(parts[1]));
            console.log('📋 Payload do token:', payload);
            
            // Verificar se não expirou
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < now) {
                console.log('❌ Token expirado');
                console.log('⏰ Expira em:', new Date(payload.exp * 1000));
                console.log('⏰ Agora:', new Date(now * 1000));
                return false;
            }
            
            // Verificação especial para email administrativo principal
            const isMainAdmin = payload.email === 'ratixpay.mz@gmail.com';
            const isValidUser = payload.role === 'admin' || payload.role === 'user' || isMainAdmin;
            console.log('🔍 Role:', payload.role);
            // tipo_conta removido - usar role diretamente
            console.log('✅ É usuário válido?', isValidUser);
            
            return isValidUser;
        } catch (error) {
            console.error('❌ Erro na verificação local do token:', error);
            return false;
        }
    }

    // Verificar se o usuário está autenticado
    function checkAuthentication() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        console.log('🔑 Token encontrado:', token ? 'Sim' : 'Não');
        
        if (!token) {
            console.log('❌ Nenhum token encontrado, redirecionando para login');
            window.location.href = 'login.html';
            return false;
        }

        // Verificação local do token primeiro
        console.log('🔍 Verificando token localmente...');
        const isTokenValid = verificarTokenLocal(token);
        console.log('✅ Token válido localmente:', isTokenValid);
        
        if (!isTokenValid) {
            console.log('❌ Token inválido localmente, redirecionando para login');
            window.location.href = 'login.html';
            return false;
        }

        // Se o token é válido localmente, permitir acesso
        console.log('✅ Acesso autorizado baseado na verificação local');
        return true;
    }

    // Verificar se o token é válido no servidor (opcional)
    async function validateToken() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        // NUNCA fazer chamada sem token
        if (!token || token.trim() === '') {
            console.warn('⚠️ Tentativa de validar token sem token fornecido - bloqueada');
            return false;
        }

        try {
            console.log('🔄 Verificando autenticação com servidor...');
            const response = await fetch(`${window.API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Resposta do servidor:', response.status, response.statusText);

            if (response.ok) {
                const result = await response.json();
                console.log('📋 Dados do usuário:', result);
                
                // A resposta pode ter os dados do usuário diretamente ou em result.user
                const user = result.user || result;
                
                if (result.success && user) {
                    console.log('👤 Usuário:', user.nome_completo || user.email);
                    console.log('🔑 Role:', user.role);
                    // tipo_conta removido - usar role diretamente
                    
                    // Verificação especial para email administrativo principal
                    const isMainAdmin = user.email === 'ratixpay.mz@gmail.com';
                    const isValidUser = (user.role === 'admin' || user.role === 'user' || isMainAdmin);
                    console.log('✅ É usuário válido?', isValidUser);
                    return isValidUser;
                } else {
                    console.log('❌ Resposta inválida do servidor');
                    return false;
                }
            } else {
                console.log('❌ Erro na resposta do servidor:', response.status);
                if (response.status === 401) {
                    console.log('🔒 Token inválido ou expirado');
                    // Limpar tokens inválidos
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('token');
                }
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao verificar admin autorizado:', error);
            return false;
        }
    }

    // Função principal de verificação
    async function requireAuth() {
        console.log('🔍 Iniciando verificação de acesso...');
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        // Se não há token, não fazer nenhuma chamada
        if (!token || token.trim() === '') {
            console.log('❌ Nenhum token encontrado, redirecionando para login');
            window.location.href = 'login.html';
            return;
        }
        
        if (!checkAuthentication()) {
            return;
        }

        // Tentar verificação no servidor em background (opcional) - apenas se há token válido
        try {
            const isAuthorized = await validateToken();
            if (!isAuthorized) {
                console.log('❌ Token inválido no servidor, redirecionando para login');
                localStorage.removeItem('authToken');
                localStorage.removeItem('adminToken');
                localStorage.removeItem('token');
                window.location.href = 'login.html';
                return;
            }
        } catch (error) {
            console.log('⚠️ Erro na verificação do servidor (ignorado):', error.message);
        }

        console.log('✅ Acesso autorizado');
    }

    // Executar verificação quando o DOM estiver carregado
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', requireAuth);
    } else {
        requireAuth();
    }

    // Exportar funções para uso global
    window.AuthCheck = {
        checkAuthentication,
        validateToken,
        requireAuth,
        verificarTokenLocal
    };

})();
