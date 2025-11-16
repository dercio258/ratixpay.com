/**
 * Utilitário de Autenticação para Afiliados
 * Gerencia tokens, refresh automático e requisições autenticadas
 */

class AfiliadoAuth {
    constructor() {
        this.API_BASE = window.location.origin.includes('localhost') 
            ? 'http://localhost:4000/api' 
            : `${window.location.origin}/api`;
        
        this.TOKEN_KEY = 'afiliado_token';
        this.REFRESH_KEY = 'afiliado_refresh_token';
        this.DATA_KEY = 'afiliado_data';
        
        this.refreshPromise = null;
    }

    // Obter token do storage
    getToken() {
        return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
    }

    // Obter refresh token
    getRefreshToken() {
        return localStorage.getItem(this.REFRESH_KEY) || sessionStorage.getItem(this.REFRESH_KEY);
    }

    // Obter dados do afiliado
    getAfiliadoData() {
        const data = localStorage.getItem(this.DATA_KEY) || sessionStorage.getItem(this.DATA_KEY);
        return data ? JSON.parse(data) : null;
    }

    // Salvar tokens
    saveTokens(token, refreshToken, afiliadoData, remember = true) {
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(this.TOKEN_KEY, token);
        storage.setItem(this.DATA_KEY, JSON.stringify(afiliadoData));
        if (refreshToken) {
            storage.setItem(this.REFRESH_KEY, refreshToken);
        }
    }

    // Limpar tokens
    clearTokens() {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.REFRESH_KEY);
        localStorage.removeItem(this.DATA_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.REFRESH_KEY);
        sessionStorage.removeItem(this.DATA_KEY);
    }

    // Verificar se está autenticado
    isAuthenticated() {
        return !!this.getToken();
    }

    // Fazer requisição autenticada com refresh automático
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        
        if (!token) {
            throw new Error('Não autenticado');
        }

        // Adicionar token ao header
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        let response = await fetch(url, {
            ...options,
            headers
        });

        // Se token expirado ou conta inativa, tratar adequadamente
        if (response.status === 401 || response.status === 403) {
            const data = await response.json().catch(() => ({}));
            
            // Se for conta inativa ou suspensa, fazer logout e redirecionar
            if (data.code === 'ACCOUNT_INACTIVE' || data.code === 'ACCOUNT_SUSPENDED' || data.status === 'inativo' || data.status === 'suspenso' || data.requiresLogout) {
                console.warn('⚠️ Conta inativa ou suspensa detectada, fazendo logout...', data);
                this.clearTokens();
                if (window.location.pathname !== '/afiliado-login.html' && !window.location.pathname.includes('afiliado-login.html')) {
                    window.location.href = '/afiliado-login.html';
                }
                throw new Error(data.error || 'Sua conta não está ativa. Faça login novamente.');
            }
            
            // Tentar refresh em qualquer 401 (assumindo que é problema de autenticação)
            // Isso cobre casos onde o token expirou mas o backend não retornou o código específico
            try {
                console.log('🔄 Recebido 401, tentando refresh do token...', data);
                await this.refreshToken();
                // Tentar novamente com novo token
                const newHeaders = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getToken()}`,
                    ...options.headers
                };
                response = await fetch(url, {
                    ...options,
                    headers: newHeaders
                });
                console.log('✅ Retry após refresh:', response.status);
                
                // Se ainda retornar 401/403 após refresh, verificar se é problema de conta
                if (response.status === 401 || response.status === 403) {
                    const retryData = await response.json().catch(() => ({}));
                    if (retryData.code === 'ACCOUNT_INACTIVE' || retryData.code === 'ACCOUNT_SUSPENDED' || retryData.status === 'inativo' || retryData.status === 'suspenso') {
                        console.warn('⚠️ Conta inativa ou suspensa após refresh, redirecionando para login...', retryData);
                        this.clearTokens();
                        if (window.location.pathname !== '/afiliado-login.html') {
                            window.location.href = '/afiliado-login.html';
                        }
                        throw new Error(retryData.error || 'Sua conta não está ativa. Faça login novamente.');
                    }
                }
            } catch (error) {
                // Se o erro já foi tratado acima (redirecionamento), relançar
                if (error.message.includes('Sua conta não está ativa') || error.message.includes('suspensa')) {
                    throw error;
                }
                console.error('❌ Erro ao fazer refresh:', error);
                // Refresh falhou, redirecionar para login
                this.clearTokens();
                if (window.location.pathname !== '/afiliado-login.html') {
                    window.location.href = '/afiliado-login.html';
                }
                throw new Error('Sessão expirada. Faça login novamente.');
            }
        }

        return response;
    }

    // Renovar token usando refresh token
    async refreshToken() {
        // Evitar múltiplas requisições simultâneas
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        const refreshToken = this.getRefreshToken();
        
        if (!refreshToken) {
            throw new Error('Refresh token não encontrado');
        }

        this.refreshPromise = fetch(`${this.API_BASE}/afiliados/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refreshToken })
        })
        .then(async response => {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erro ao renovar token');
            }

            if (data.success) {
                // Atualizar tokens
                const afiliadoData = this.getAfiliadoData();
                const isLocalStorage = !!localStorage.getItem(this.TOKEN_KEY);
                
                this.saveTokens(
                    data.token,
                    data.refreshToken,
                    afiliadoData,
                    isLocalStorage
                );
                
                return data;
            }
            
            throw new Error('Erro ao renovar token');
        })
        .finally(() => {
            this.refreshPromise = null;
        });

        return this.refreshPromise;
    }

    // Verificar se token está válido
    async verifyToken() {
        const token = this.getToken();
        
        if (!token) {
            return { valid: false, reason: 'NO_TOKEN' };
        }

        try {
            const response = await fetch(`${this.API_BASE}/afiliados/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            
            // Se conta inativa ou suspensa, fazer logout e redirecionar
            if (response.status === 403 && (data.status === 'inativo' || data.status === 'suspenso' || data.requiresLogout)) {
                console.warn('⚠️ Conta inativa ou suspensa detectada no verifyToken, fazendo logout...', data);
                this.clearTokens();
                if (window.location.pathname !== '/afiliado-login.html' && !window.location.pathname.includes('afiliado-login.html')) {
                    window.location.href = '/afiliado-login.html';
                }
                return { valid: false, reason: 'ACCOUNT_INACTIVE', status: data.status };
            }
            
            if (data.success) {
                // Atualizar dados do afiliado
                if (data.afiliado) {
                    const isLocalStorage = !!localStorage.getItem(this.TOKEN_KEY);
                    const storage = isLocalStorage ? localStorage : sessionStorage;
                    storage.setItem(this.DATA_KEY, JSON.stringify(data.afiliado));
                }
                
                return { valid: true, afiliado: data.afiliado };
            }
            
            return { valid: false, reason: 'INVALID_TOKEN' };
        } catch (error) {
            console.error('Erro ao verificar token:', error);
            return { valid: false, reason: 'ERROR' };
        }
    }

    // Logout
    logout() {
        this.clearTokens();
        window.location.href = '/afiliado-login.html';
    }
}

// Instância global
window.afiliadoAuth = new AfiliadoAuth();

