/**
 * Página de Saque do Afiliado
 * Gerencia solicitações de saque e histórico
 */

// Configurações
const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:4000/api' 
    : `${window.location.origin}/api`;

// Variáveis globais
let afiliado = null;
let saques = [];
let estatisticas = {};

// Carregar dados iniciais
async function carregarDados() {
    try {
        console.log('🚀 Carregando dados do afiliado...');
        mostrarLoading(true);
        
        // Verificar autenticação usando o utilitário
        if (!window.afiliadoAuth || !window.afiliadoAuth.isAuthenticated()) {
            window.location.href = '/afiliado-login.html';
            return;
        }
        
        // Verificar e atualizar token se necessário
        const verification = await window.afiliadoAuth.verifyToken();
        if (!verification.valid) {
            window.location.href = '/afiliado-login.html';
            return;
        }
        
        // Carregar dados do afiliado
        afiliado = window.afiliadoAuth.getAfiliadoData() || verification.afiliado;
        const nomeElement = document.getElementById('afiliadoNome');
        if (nomeElement) {
            nomeElement.textContent = afiliado.nome;
        }
        
        await Promise.all([
            carregarSaques(),
            carregarEstatisticas()
        ]);
        
        atualizarInterface();
        mostrarLoading(false);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados: ' + error.message, 'danger');
        mostrarLoading(false);
    }
}

// Carregar saques
async function carregarSaques() {
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/meus-saques`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            saques = data.data || [];
            console.log('✅ Saques carregados:', saques.length);
        } else {
            console.log('⚠️ Erro ao carregar saques ou nenhum saque encontrado');
            saques = [];
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar saques:', error);
        saques = [];
    }
}

// Carregar estatísticas
async function carregarEstatisticas() {
    try {
        // Carregar saldo e estatísticas
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/meu-saldo`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            estatisticas = data.data || {};
            console.log('✅ Estatísticas carregadas');
        } else {
            console.log('⚠️ Erro ao carregar estatísticas');
            estatisticas = {};
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
        estatisticas = {};
    }
}

// Atualizar interface
function atualizarInterface() {
    // Atualizar estatísticas
    const saldoDisponivelEl = document.getElementById('saldoDisponivel');
    const saquesAprovadosEl = document.getElementById('saquesAprovados');
    const saquesPendentesEl = document.getElementById('saquesPendentes');
    const totalSacadoEl = document.getElementById('totalSacado');
    
    if (saldoDisponivelEl) {
        saldoDisponivelEl.textContent = `MZN ${parseFloat(estatisticas.saldo_disponivel || 0).toFixed(2)}`;
    }
    
    // Calcular estatísticas dos saques
    const saquesAprovados = saques.filter(s => s.status === 'aprovado' || s.status === 'pago').length;
    const saquesPendentes = saques.filter(s => s.status === 'pendente').length;
    const totalSacado = saques
        .filter(s => s.status === 'aprovado' || s.status === 'pago')
        .reduce((sum, s) => sum + parseFloat(s.valor || 0), 0);
    
    if (saquesAprovadosEl) saquesAprovadosEl.textContent = saquesAprovados;
    if (saquesPendentesEl) saquesPendentesEl.textContent = saquesPendentes;
    if (totalSacadoEl) totalSacadoEl.textContent = `MZN ${totalSacado.toFixed(2)}`;
    
    // Renderizar tabela de saques
    renderizarTabelaSaques();
}

// Renderizar tabela de saques
function renderizarTabelaSaques() {
    const tbody = document.getElementById('saquesTable');
    const emptyState = document.getElementById('emptyState');
    
    if (!tbody) return;
    
    if (saques.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    tbody.innerHTML = saques.map(saque => {
        const statusClass = getStatusClass(saque.status);
        const statusText = getStatusText(saque.status);
        
        return `
            <tr>
                <td>${formatarData(saque.data_solicitacao || saque.created_at)}</td>
                <td><strong>MZN ${parseFloat(saque.valor || 0).toFixed(2)}</strong></td>
                <td>${getMetodoText(saque.metodo || saque.metodo_pagamento)}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${escapeHtml(saque.observacoes || 'N/A')}</td>
            </tr>
        `;
    }).join('');
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Obter classe do status
function getStatusClass(status) {
    switch (status) {
        case 'aprovado':
        case 'pago':
            return 'badge-success';
        case 'pendente':
            return 'badge-warning';
        case 'rejeitado':
        case 'cancelado':
            return 'badge-danger';
        default:
            return 'badge-info';
    }
}

// Obter texto do status
function getStatusText(status) {
    switch (status) {
        case 'aprovado':
        case 'pago':
            return 'Aprovado';
        case 'pendente':
            return 'Pendente';
        case 'rejeitado':
        case 'cancelado':
            return 'Rejeitado';
        default:
            return status;
    }
}

// Obter texto do método
function getMetodoText(metodo) {
    switch (metodo) {
        case 'm-pesa':
        case 'mpesa':
            return 'M-Pesa';
        case 'e-mola':
        case 'emola':
            return 'e-Mola';
        case 'transferencia':
        case 'bank_transfer':
            return 'Transferência Bancária';
        default:
            return metodo;
    }
}

// Formatar data
function formatarData(data) {
    if (!data) return 'N/A';
    const date = new Date(data);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Mostrar termos
function mostrarTermos() {
    alert('Termos e Condições:\n\n' +
          '1. Valor mínimo para saque: MZN 50.00\n' +
          '2. Taxa de processamento: 2%\n' +
          '3. Processamento: 1-3 dias úteis\n' +
          '4. Dados bancários devem estar corretos\n' +
          '5. Saques são processados apenas em dias úteis');
}

// Submeter formulário
async function submeterFormularioSaque(e) {
    e.preventDefault();
    
    const valor = parseFloat(document.getElementById('valorSaque').value);
    const metodo = document.getElementById('metodoPagamento').value;
    const numeroConta = document.getElementById('numeroConta').value;
    const observacoes = document.getElementById('observacoes').value;
    
    if (valor < 50) {
        mostrarNotificacao('Valor mínimo para saque é MZN 50.00', 'warning');
        return;
    }
    
    const saldoDisponivel = parseFloat(estatisticas.saldo_disponivel || 0);
    if (valor > saldoDisponivel) {
        mostrarNotificacao('Saldo insuficiente para este saque', 'danger');
        return;
    }
    
    try {
        const btnSolicitar = document.getElementById('btnSolicitar');
        
        btnSolicitar.disabled = true;
        btnSolicitar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/solicitar-saque`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valor: valor,
                    metodo: metodo,
                    numero_conta: numeroConta,
                    observacoes: observacoes || null
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            mostrarNotificacao('Solicitação de saque enviada com sucesso!', 'success');
            document.getElementById('formSaque').reset();
            await carregarDados(); // Recarregar dados
        } else {
            const errorData = await response.json().catch(() => ({}));
            mostrarNotificacao('Erro ao solicitar saque: ' + (errorData.message || 'Erro desconhecido'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Erro ao solicitar saque:', error);
        mostrarNotificacao('Erro ao solicitar saque: ' + error.message, 'danger');
    } finally {
        const btnSolicitar = document.getElementById('btnSolicitar');
        if (btnSolicitar) {
            btnSolicitar.disabled = false;
            btnSolicitar.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Saque';
        }
    }
}

// Mostrar loading
function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
}

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacao.style.position = 'fixed';
    notificacao.style.top = '20px';
    notificacao.style.right = '20px';
    notificacao.style.zIndex = '9999';
    notificacao.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        if (notificacao.parentNode) {
            notificacao.parentNode.removeChild(notificacao);
        }
    }, 5000);
}

// Logout
function logout() {
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
}

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de saque...');
    
    // Configurar formulário
    const formSaque = document.getElementById('formSaque');
    if (formSaque) {
        formSaque.addEventListener('submit', submeterFormularioSaque);
    }
    
    carregarDados();
});

