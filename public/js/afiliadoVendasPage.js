/**
 * Página de Vendas do Afiliado
 * Gerencia exibição e atualização de vendas
 */

// Configurações
const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:4000/api' 
    : `${window.location.origin}/api`;

// Variáveis globais
let afiliado = null;
let vendas = [];
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
            carregarVendas(),
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

// Carregar vendas
async function carregarVendas() {
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/minhas-vendas`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            vendas = data.data || [];
            console.log('✅ Vendas carregadas:', vendas.length);
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('⚠️ Erro ao carregar vendas:', response.status, errorData);
            vendas = [];
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        vendas = [];
    }
}

// Carregar estatísticas
async function carregarEstatisticas() {
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/minhas-vendas-estatisticas?periodo=30d`,
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
            const errorData = await response.json().catch(() => ({}));
            console.error('⚠️ Erro ao carregar estatísticas:', response.status, errorData);
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
    const totalVendasEl = document.getElementById('totalVendas');
    const totalComissoesEl = document.getElementById('totalComissoes');
    const vendasPendentesEl = document.getElementById('vendasPendentes');
    const taxaConversaoEl = document.getElementById('taxaConversao');
    
    if (totalVendasEl) totalVendasEl.textContent = estatisticas.totalVendas || 0;
    if (totalComissoesEl) totalComissoesEl.textContent = `MZN ${parseFloat(estatisticas.totalComissoes || 0).toFixed(2)}`;
    if (vendasPendentesEl) vendasPendentesEl.textContent = estatisticas.vendasPendentes || 0;
    if (taxaConversaoEl) taxaConversaoEl.textContent = `${parseFloat(estatisticas.taxaConversao || 0).toFixed(1)}%`;
    
    // Renderizar tabela de vendas
    renderizarTabelaVendas();
}

// Renderizar tabela de vendas
function renderizarTabelaVendas() {
    const tbody = document.getElementById('vendasTable');
    const emptyState = document.getElementById('emptyState');
    
    if (!tbody) return;
    
    if (vendas.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    tbody.innerHTML = vendas.map(venda => {
        const statusClass = getStatusClass(venda.status);
        const statusText = getStatusText(venda.status);
        
        // Extrair referência do link do afiliado
        const refMatch = venda.link_afiliado ? venda.link_afiliado.match(/ref=([^&]+)/) : null;
        const referencia = refMatch ? refMatch[1] : 'N/A';
        
        return `
            <tr>
                <td>${formatarData(venda.data_venda)}</td>
                <td><strong>${escapeHtml(venda.produto_nome || 'N/A')}</strong></td>
                <td>
                    <code style="font-size: 0.8rem; background: #e3f2fd; padding: 4px 8px; border-radius: 4px; color: #1976d2; font-weight: bold;">${escapeHtml(referencia)}</code>
                </td>
                <td><strong>MZN ${parseFloat(venda.valor_venda || 0).toFixed(2)}</strong></td>
                <td><strong style="color: var(--success-color);">MZN ${parseFloat(venda.valor_comissao || 0).toFixed(2)}</strong></td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-outline-primary btn-sm" onclick="verificarStatusVenda('${escapeHtml(venda.transaction_id || '')}')" title="Verificar Status">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                        <button class="btn btn-outline-info btn-sm" onclick="verDetalhesVenda('${venda.id}')" title="Ver Detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
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
        case 'pago':
            return 'badge-success';
        case 'pendente':
            return 'badge-warning';
        case 'cancelado':
            return 'badge-danger';
        default:
            return 'badge-info';
    }
}

// Obter texto do status
function getStatusText(status) {
    switch (status) {
        case 'pago':
            return 'Pago';
        case 'pendente':
            return 'Pendente';
        case 'cancelado':
            return 'Cancelado';
        default:
            return status;
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

// Verificar status da venda via API de pagamento
async function verificarStatusVenda(transactionId) {
    try {
        console.log('🔄 Verificando status da venda:', transactionId);
        
        const response = await fetch(`${API_BASE}/e2payments/status/${transactionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Status da venda:', data);
            
            if (data.success && data.status === 'approved') {
                // Atualizar status da venda para pago
                await atualizarStatusVenda(transactionId, 'pago');
                mostrarNotificacao('✅ Venda aprovada! Sua comissão foi creditada.', 'success');
                await carregarVendas(); // Recarregar dados
                await carregarEstatisticas();
                atualizarInterface();
            } else {
                mostrarNotificacao(`Status atual: ${data.status || 'Pendente'}`, 'info');
            }
        } else {
            mostrarNotificacao('❌ Erro ao verificar status da venda', 'danger');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        mostrarNotificacao('❌ Erro ao verificar status da venda', 'danger');
    }
}

// Atualizar status da venda
async function atualizarStatusVenda(transactionId, novoStatus) {
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/vendas/atualizar-status`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transaction_id: transactionId,
                    status: novoStatus
                })
            }
        );
        
        if (response.ok) {
            console.log('✅ Status da venda atualizado');
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
    }
}

// Ver detalhes da venda
function verDetalhesVenda(vendaId) {
    const venda = vendas.find(v => v.id === vendaId);
    if (!venda) return;
    
    const detalhes = `DETALHES DA VENDA\n\n` +
        `Produto: ${venda.produto_nome || 'N/A'}\n` +
        `Valor: MZN ${parseFloat(venda.valor_venda || 0).toFixed(2)}\n` +
        `Sua Comissão: MZN ${parseFloat(venda.valor_comissao || 0).toFixed(2)}\n` +
        `Data: ${formatarData(venda.data_venda)}\n` +
        `Link Afiliado: ${venda.link_afiliado || 'N/A'}\n` +
        `Status: ${getStatusText(venda.status)}\n` +
        `Transaction ID: ${venda.transaction_id || 'N/A'}`;
    
    alert(detalhes);
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
    console.log('🚀 Inicializando página de vendas...');
    carregarDados();
    
    // Configurar atualização automática a cada 60 segundos
    setInterval(async () => {
        console.log('🔄 Atualizando dados automaticamente...');
        await carregarVendas();
        await carregarEstatisticas();
        atualizarInterface();
    }, 60000);
});

