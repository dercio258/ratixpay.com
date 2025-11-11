// Configuração global da API
// A definição da API_BASE agora é feita pelo server-check.js
// Este arquivo apenas verifica se a variável já foi definida

// Se server-check.js não foi carregado, definir API_BASE como fallback
if (typeof window.API_BASE === 'undefined') {
    console.warn('Aviso: server-check.js não foi carregado antes de config.js');
    // Em desenvolvimento local com frontend em :3000, apontar API para :3001
    // API será sempre baseada no mesmo origin + /api (porta 3000 no seu caso)
    window.API_BASE = window.location.origin + '/api';
}
    
// Verificar conexão com o servidor
fetch(`${window.API_BASE}/health`, {
    method: 'GET',
    cache: 'no-cache',
    credentials: 'include', // Importante para permitir cookies de sessão
    headers: {
        'X-Requested-With': 'XMLHttpRequest'
    }
}).catch(error => {
    console.error('Erro ao conectar com o servidor:', error);
    // Redirecionar para página de erro se não estiver em localhost
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        sessionStorage.setItem('redirectAfterReconnect', window.location.href);
        window.location.href = '/server-error.html';
    }
});

