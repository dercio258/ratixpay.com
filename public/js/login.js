// Configuração da API
// A variável API_BASE já está definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Função para verificar se o usuário está autenticado (simplificada - sem autenticação)
function checkAuthStatus() {
    // Sempre retorna como autenticado
    return Promise.resolve(true);
}

// Função para fazer logout (simplificada - sem autenticação)
function logout() {
    // Limpar dados do cliente
    sessionStorage.clear();
    localStorage.clear();
    
    // Redirecionar para a página inicial
    window.location.href = '/index.html';
}

// Função para redirecionar para login se não autenticado (simplificada - sem autenticação)
function requireAuth() {
    // Sempre retorna como autenticado
    return Promise.resolve(true);
}

// Exportar funções para uso global
window.RatixPayAuth = {
    checkAuthStatus,
    logout,
    requireAuth
};

// Verificar autenticação ao carregar a página (simplificada - sem autenticação)
document.addEventListener('DOMContentLoaded', function() {
    // Não faz nada - sempre considera o usuário como autenticado
});

