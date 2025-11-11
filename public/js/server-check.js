// Verificação do servidor e configuração da API
// Este arquivo deve ser carregado antes de config.js

// Detectar ambiente e configurar API_BASE
(function() {
    'use strict';
    
    // Detectar se estamos em desenvolvimento local
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '0.0.0.0';
    
    // Configurar API_BASE baseado no ambiente
    if (isLocalhost) {
        // Em desenvolvimento local, usar a mesma porta do frontend
        window.API_BASE = window.location.origin + '/api';
    } else {
        // Em produção, usar o mesmo domínio
        window.API_BASE = window.location.origin + '/api';
    }
    
    console.log('🔧 API_BASE configurado:', window.API_BASE);
    
    // Verificar se o servidor está respondendo
    fetch(`${window.API_BASE}/health`, {
        method: 'GET',
        cache: 'no-cache',
        credentials: 'include',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (response.ok) {
            console.log('✅ Servidor está respondendo');
        } else {
            console.warn('⚠️ Servidor respondeu com status:', response.status);
        }
    })
    .catch(error => {
        console.error('❌ Erro ao conectar com o servidor:', error);
        
        // Em produção, redirecionar para página de erro se não conseguir conectar
        if (!isLocalhost) {
            sessionStorage.setItem('redirectAfterReconnect', window.location.href);
            window.location.href = '/server-error.html';
        }
    });
})();