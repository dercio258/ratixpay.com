/**
 * Script para verificar suspensão de conta
 * DESABILITADO - Não suspende usuários automaticamente
 */

// Configuração da API
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = window.location.origin + '/api';
}

// Função para verificar se o usuário está suspenso - DESABILITADA
async function verificarSuspensao() {
    // Suspensão desabilitada - não faz nada
    return;
}

// Função para obter token válido
function getValidToken() {
    let token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
        return null;
    }

    try {
        // Verificar se o token não expirou
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        
        if (payload.exp < now) {
            localStorage.removeItem('token');
            sessionStorage.removeItem('token');
            return null;
        }
        
        return token;
    } catch (error) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        return null;
    }
}

// Função para interceptar requisições AJAX e verificar suspensão - DESABILITADA
function interceptarRequisicoes() {
    // Suspensão desabilitada - não intercepta requisições
    return;
}

// Função para verificar suspensão em intervalos regulares - DESABILITADA
function iniciarVerificacaoPeriodica() {
    // Suspensão desabilitada - não inicia verificação periódica
    return;
}

// Função para verificar suspensão ao focar na janela - DESABILITADA
function verificarAoFocar() {
    // Suspensão desabilitada - não adiciona event listeners
    return;
}

// Função para verificar suspensão ao carregar a página - DESABILITADA
function verificarAoCarregar() {
    // Suspensão desabilitada - não verifica ao carregar
    return;
}

// Função para verificar suspensão ao fazer login - DESABILITADA
function verificarAposLogin() {
    // Suspensão desabilitada - não verifica após login
    return;
}

// Função para mostrar notificação de suspensão
function mostrarNotificacaoSuspensao() {
    // Criar elemento de notificação
    const notification = document.createElement('div');
    notification.id = 'suspension-notification';
    notification.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        background: linear-gradient(135deg, #f39c12, #e74c3c);
        color: white;
        padding: 15px;
        text-align: center;
        font-weight: bold;
        font-size: 16px;
        z-index: 9999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        animation: slideDown 0.5s ease-out;
    `;
    
    notification.innerHTML = `
        <i class="fas fa-ban"></i>
        SUA CONTA FOI SUSPENSA - Entre em contato com o suporte
        <button onclick="window.location.href='/login.html?error=conta-suspensa'" 
                style="background: white; color: #e74c3c; border: none; padding: 5px 15px; margin-left: 15px; border-radius: 5px; cursor: pointer;">
            Ver Detalhes
        </button>
    `;
    
    // Adicionar CSS para animação
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    // Adicionar notificação ao body
    document.body.insertBefore(notification, document.body.firstChild);
    
    // Ajustar margin-top do body para compensar a notificação
    document.body.style.marginTop = '60px';
}

// Função para verificar suspensão e mostrar notificação - DESABILITADA
async function verificarSuspensaoComNotificacao() {
    // Suspensão desabilitada - não verifica nem mostra notificações
    return;
}

// Inicializar verificação de suspensão - DESABILITADA
document.addEventListener('DOMContentLoaded', function() {
    // Suspensão desabilitada - não inicializa verificação
    return;
});

// Exportar funções para uso global
window.verificarSuspensao = verificarSuspensao;
window.verificarAposLogin = verificarAposLogin;
window.verificarSuspensaoComNotificacao = verificarSuspensaoComNotificacao;

// Log de inicialização
console.log('Sistema de verificação de suspensão DESABILITADO');
