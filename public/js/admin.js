// Configuração da API
// Usar a variável API_BASE já definida em config.js

// Variáveis globais
let vendedoresData = [];
let saquesData = [];
let dashboardData = {};

// Verificar autenticação ao carregar
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadDashboardStats();
    loadVendedores();
    loadSaques();
    
    // Atualizar dados a cada 30 segundos
    setInterval(() => {
        loadDashboardStats();
    }, 30000);
});

// Verificar se o usuário é admin autorizado
async function checkAuth() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        console.log('🔍 Token encontrado:', token ? 'Sim' : 'Não');
        
        if (!token) {
            console.log('❌ Nenhum token encontrado, redirecionando para login');
            window.location.href = 'login.html';
            return false;
        }

        // Verificar se o token contém informações de admin
        try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                console.log('🔍 Payload do token:', payload);
                
                // Verificar se o token não expirou
                const now = Math.floor(Date.now() / 1000);
                if (payload.exp && payload.exp < now) {
                    console.log('❌ Token expirado, redirecionando para login');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                    return false;
                }
                
                // Verificação especial para email administrativo principal
                const isMainAdmin = payload.email === 'ratixpay.mz@gmail.com';
                const isAdmin = payload.role === 'admin' || isMainAdmin;
                console.log('🔍 É admin pelo token?', isAdmin);
                
                if (isAdmin) {
                    console.log('✅ Acesso admin autorizado pelo token');
                    // Fechar qualquer modal de acesso negado que possa estar aberto
                    closeAccessDeniedModal();
                    return true;
                }
            }
        } catch (e) {
            console.log('🔍 Erro ao decodificar token, tentando API...', e);
        }

        console.log('🔍 Verificando token com API...');
        const response = await fetch(`${window.API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('🔍 Status da resposta:', response.status);

        if (response.ok) {
            const result = await response.json();
            console.log('🔍 Resultado da API:', result);
            
            if (result.success && result.user) {
                const user = result.user;
                console.log('🔍 Dados do usuário:', user);
                console.log('🔍 Role:', user.role);
                // tipo_conta removido - usar role diretamente
                
                // Verificação especial para email administrativo principal
                const isMainAdmin = user.email === 'ratixpay.mz@gmail.com';
                const isAdmin = user.role === 'admin' || isMainAdmin;
                console.log('🔍 É admin?', isAdmin);
                
                if (!isAdmin) {
                    console.log('❌ Usuário não é admin, redirecionando para login');
                    window.location.href = 'login.html';
                    return false;
                }
                
                console.log('✅ Acesso admin autorizado');
                // Fechar qualquer modal de acesso negado que possa estar aberto
                closeAccessDeniedModal();
                return true;
            } else {
                console.log('❌ Resposta da API não contém dados válidos');
            }
        } else {
            console.log('❌ Resposta da API não foi OK:', response.status);
        }
        
        console.log('❌ Redirecionando para login');
        window.location.href = 'login.html';
        return false;
    } catch (error) {
        console.error('❌ Erro na verificação de auth:', error);
        window.location.href = 'login.html';
        return false;
    }
}


// Função para fechar qualquer modal de acesso negado
function closeAccessDeniedModal() {
    const accessDeniedCard = document.querySelector('.access-denied-card');
    if (accessDeniedCard) {
        accessDeniedCard.parentElement.remove();
        console.log('✅ Modal de acesso negado removido');
    }
    
    // Restaurar conteúdo original se necessário
    const container = document.querySelector('.admin-container');
    if (container && container.innerHTML.includes('access-denied-card')) {
        // Recarregar a página para restaurar o conteúdo original
        window.location.reload();
    }
}

// Função global para fechar modal (pode ser chamada do console)
window.closeAccessDeniedModal = closeAccessDeniedModal;

// Função para formatar valores monetários
function formatCurrency(value) {
    // Garantir que sempre use MZN em vez de MTn
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN'
    }).format(value);
    
    // Substituir MTn por MZN se necessário
    return formatted.replace('MTn', 'MZN');
}

// Função para formatar datas
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-MZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Função para mostrar seção
function showSection(sectionName) {
    // Esconder todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remover classe active de todas as tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    document.getElementById(sectionName).classList.add('active');
    
    // Ativar tab correspondente
    event.target.classList.add('active');
}

// ==================== DASHBOARD ====================

// Carregar estatísticas do dashboard
async function loadDashboardStats() {
    try {
        console.log('🔄 Carregando estatísticas do dashboard...');
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/dashboard/estatisticas`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            dashboardData = data.data;
            updateDashboardStats();
        }
        
        console.log('✅ Estatísticas carregadas');
        
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
    }
}

// Atualizar estatísticas na interface
function updateDashboardStats() {
    document.getElementById('receitaTotal').textContent = formatCurrency(dashboardData.receitaTotal || 0);
    document.getElementById('saquesPagos').textContent = dashboardData.saquesPagos || 0;
    document.getElementById('saquesPendentes').textContent = dashboardData.saquesPendentes || 0;
    document.getElementById('vendedoresAtivos').textContent = dashboardData.vendedoresAtivos || 0;
}

// ==================== VENDEDORES ====================

// Carregar vendedores
async function loadVendedores() {
    try {
        console.log('🔄 Carregando vendedores...');
        
        // showLoading('loadingVendedores', true);
        // hideTable('tabelaVendedores');
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/vendedores`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            vendedoresData = data.vendedores || [];
            renderVendedoresTable();
        }
        
        console.log(`✅ ${vendedoresData.length} vendedores carregados`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar vendedores:', error);
    } finally {
        // showLoading('loadingVendedores', false);
    }
}

// Renderizar tabela de vendedores
function renderVendedoresTable(data = null) {
    const container = document.getElementById('vendedoresRecentes');
    if (!container) {
        console.log('⚠️ Container vendedoresRecentes não encontrado');
        return;
    }
    
    const dadosParaRenderizar = data || vendedoresData;
    
    if (dadosParaRenderizar.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 1rem; display: block; opacity: 0.5;"></i>
                Nenhum vendedor encontrado
            </div>
        `;
    } else {
        container.innerHTML = dadosParaRenderizar.map(vendedor => {
            // Formatar data de criação
            const dataCriacao = vendedor.created_at ? new Date(vendedor.created_at).toLocaleDateString('pt-BR') : 'N/A';
            
            // Formatar último login
            const ultimoLogin = vendedor.ultimo_login ? new Date(vendedor.ultimo_login).toLocaleDateString('pt-BR') : 'Nunca';
            
            // Status do vendedor
            const statusClass = vendedor.ativo ? 'status-ativo' : 'status-inativo';
            const statusText = vendedor.ativo ? 'Ativo' : 'Inativo';
            
            // Indicador de conta Google
            const googleIcon = vendedor.google_user ? '<i class="fab fa-google" style="color: #4285f4; margin-left: 5px;" title="Conta Google"></i>' : '';
            
            return `
                <div class="vendedor-item" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div class="vendedor-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div class="vendedor-info" style="flex: 1;">
                            <div class="vendedor-nome" style="font-weight: 600; font-size: 1.1rem; color: #1f2937; margin-bottom: 4px;">
                                ${vendedor.nome_completo || 'Nome não informado'} ${googleIcon}
                            </div>
                            <div class="vendedor-email" style="color: #6b7280; font-size: 0.9rem; margin-bottom: 2px;">
                                <i class="fas fa-envelope" style="margin-right: 5px;"></i>${vendedor.email || 'Email não informado'}
                            </div>
                            ${vendedor.telefone ? `
                                <div class="vendedor-telefone" style="color: #6b7280; font-size: 0.9rem; margin-bottom: 2px;">
                                    <i class="fas fa-phone" style="margin-right: 5px;"></i>${vendedor.telefone}
                                </div>
                            ` : ''}
                            <div class="vendedor-dates" style="color: #9ca3af; font-size: 0.8rem;">
                                <span>Cadastrado: ${dataCriacao}</span> | 
                                <span>Último login: ${ultimoLogin}</span>
                            </div>
                        </div>
                        <div class="vendedor-status" style="text-align: right;">
                            <span class="${statusClass}" style="padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">
                                ${statusText}
                            </span>
                        </div>
                    </div>
                    
                    <div class="vendedor-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
                        <div class="stat-item">
                            <div class="stat-label" style="font-size: 0.8rem; color: #6b7280; margin-bottom: 2px;">Receita Total</div>
                            <div class="stat-value" style="font-weight: 600; color: #059669;">${formatCurrency(vendedor.receitaTotal || 0)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label" style="font-size: 0.8rem; color: #6b7280; margin-bottom: 2px;">Disponível</div>
                            <div class="stat-value" style="font-weight: 600; color: #2563eb;">${formatCurrency(vendedor.receitaDisponivel || 0)}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label" style="font-size: 0.8rem; color: #6b7280; margin-bottom: 2px;">Total Vendas</div>
                            <div class="stat-value" style="font-weight: 600; color: #7c3aed;">${vendedor.totalVendas || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label" style="font-size: 0.8rem; color: #6b7280; margin-bottom: 2px;">ID Público</div>
                            <div class="stat-value" style="font-weight: 600; color: #dc2626; font-family: monospace;">${vendedor.public_id || 'N/A'}</div>
                        </div>
                    </div>
                    
                    ${vendedor.error ? `
                        <div class="error-notice" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px; margin-top: 8px; font-size: 0.8rem; color: #dc2626;">
                            <i class="fas fa-exclamation-triangle" style="margin-right: 5px;"></i>
                            Erro ao carregar receita: ${vendedor.error}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
}

// Filtrar vendedores
function filtrarVendedores() {
    const busca = document.getElementById('buscaVendedor')?.value.toLowerCase() || '';
    const status = document.getElementById('filtroStatusVendedor')?.value || '';
    
    const vendedoresFiltrados = vendedoresData.filter(vendedor => {
        const matchBusca = !busca || 
            (vendedor.nome_completo && vendedor.nome_completo.toLowerCase().includes(busca)) ||
            (vendedor.email && vendedor.email.toLowerCase().includes(busca)) ||
            (vendedor.telefone && vendedor.telefone.includes(busca)) ||
            (vendedor.username && vendedor.username.toLowerCase().includes(busca)) ||
            (vendedor.public_id && vendedor.public_id.includes(busca));
        
        const matchStatus = !status || 
            (status === 'ativo' && vendedor.ativo) ||
            (status === 'inativo' && !vendedor.ativo) ||
            (status === 'suspenso' && vendedor.suspenso) ||
            (status === 'google' && vendedor.google_user);
        
        return matchBusca && matchStatus;
    });
    
    renderVendedoresTable(vendedoresFiltrados);
}

// Editar vendedor
function editarVendedor(vendedorId) {
    const vendedor = vendedoresData.find(v => v.id === vendedorId);
    if (!vendedor) return;
    
    // Preencher formulário com campos corretos do banco
    const vendedorIdField = document.getElementById('vendedorId');
    const vendedorNomeField = document.getElementById('vendedorNome');
    const vendedorEmailField = document.getElementById('vendedorEmail');
    const vendedorTelefoneField = document.getElementById('vendedorTelefone');
    const vendedorStatusField = document.getElementById('vendedorStatus');
    
    if (vendedorIdField) vendedorIdField.value = vendedor.id;
    if (vendedorNomeField) vendedorNomeField.value = vendedor.nome_completo || '';
    if (vendedorEmailField) vendedorEmailField.value = vendedor.email || '';
    if (vendedorTelefoneField) vendedorTelefoneField.value = vendedor.telefone || '';
    if (vendedorStatusField) vendedorStatusField.value = vendedor.ativo ? 'ativo' : 'inativo';
    
    // Mostrar modal se existir
    const modal = document.getElementById('modalEditarVendedor');
    if (modal) {
        modal.style.display = 'block';
    } else {
        console.log('⚠️ Modal de edição não encontrado');
    }
}

// Salvar vendedor
async function salvarVendedor(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const vendedorData = {
            id: formData.get('vendedorId'),
            nome_completo: formData.get('vendedorNome'),
            email: formData.get('vendedorEmail'),
            telefone: formData.get('vendedorTelefone'),
            ativo: formData.get('vendedorStatus') === 'ativo'
        };
        
        console.log('🔄 Salvando vendedor:', vendedorData);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/vendedores/${vendedorData.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vendedorData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert('Vendedor atualizado com sucesso!');
            fecharModal('modalEditarVendedor');
            loadVendedores();
            loadDashboardStats();
        } else {
            throw new Error(result.message || 'Erro ao atualizar vendedor');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar vendedor:', error);
        alert('Erro ao salvar vendedor: ' + error.message);
    }
}

// Alternar status do vendedor
async function toggleStatusVendedor(vendedorId, statusAtual) {
    const novoStatus = statusAtual === 'inativo' ? 'ativo' : 'inativo';
    const acao = novoStatus === 'inativo' ? 'desativar' : 'ativar';
    
    if (!confirm(`Tem certeza que deseja ${acao} este vendedor?`)) {
        return;
    }
    
    try {
        console.log(`🔄 ${acao} vendedor ${vendedorId}...`);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/vendedores/${vendedorId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ativo: novoStatus === 'ativo' })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Vendedor ${acao} com sucesso!`);
            loadVendedores();
            loadDashboardStats();
        } else {
            throw new Error(result.message || `Erro ao ${acao} vendedor`);
        }
        
    } catch (error) {
        console.error(`❌ Erro ao ${acao} vendedor:`, error);
        alert(`Erro ao ${acao} vendedor: ` + error.message);
    }
}

// Atualizar vendedores
function refreshVendedores() {
    loadVendedores();
}

// ==================== SAQUES ====================

// Carregar saques
async function loadSaques() {
    try {
        console.log('🔄 Carregando saques...');
        
        // showLoading('loadingSaques', true);
        // hideTable('tabelaSaques');
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/saques`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            saquesData = data.saques || [];
            renderSaquesTable();
        }
        
        console.log(`✅ ${saquesData.length} saques carregados`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar saques:', error);
    } finally {
        // showLoading('loadingSaques', false);
    }
}

// Renderizar tabela de saques
function renderSaquesTable(data = null) {
    console.log('📊 Renderizando saques:', data);
    // Por enquanto, apenas log dos dados
    // A implementação da tabela de saques será feita quando necessário
}

// Filtrar saques
function filtrarSaques() {
    const busca = document.getElementById('buscaSaque').value.toLowerCase();
    const status = document.getElementById('filtroStatusSaque').value;
    const metodo = document.getElementById('filtroMetodo').value;
    
    const saquesFiltrados = saquesData.filter(saque => {
        const matchBusca = !busca || 
            (saque.id_saque && saque.id_saque.toLowerCase().includes(busca)) ||
            (saque.vendedor_nome && saque.vendedor_nome.toLowerCase().includes(busca));
        
        const matchStatus = !status || saque.status === status;
        const matchMetodo = !metodo || saque.metodo_pagamento === metodo;
        
        return matchBusca && matchStatus && matchMetodo;
    });
    
    renderSaquesTable(saquesFiltrados);
}

// Gerenciar saque
function gerenciarSaque(saqueId) {
    const saque = saquesData.find(s => s.id === saqueId);
    if (!saque) return;
    
    // Preencher formulário
    document.getElementById('saqueId').value = saque.id;
    document.getElementById('saqueStatus').value = saque.status || 'pendente';
    document.getElementById('codigoTransacao').value = saque.codigo_transacao || '';
    document.getElementById('observacoesSaque').value = saque.observacoes || '';
    
    // Mostrar modal
    document.getElementById('modalGerenciarSaque').style.display = 'block';
    toggleCodigoTransacao();
}

// Alternar campo de código de transação
function toggleCodigoTransacao() {
    const status = document.getElementById('saqueStatus').value;
    const grupo = document.getElementById('grupoCodigoTransacao');
    
    if (status === 'pago') {
        grupo.style.display = 'block';
        document.getElementById('codigoTransacao').required = true;
    } else {
        grupo.style.display = 'none';
        document.getElementById('codigoTransacao').required = false;
    }
}

// Atualizar saque
async function atualizarSaque(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const saqueData = {
            id: formData.get('saqueId'),
            status: formData.get('saqueStatus'),
            codigo_transacao: formData.get('codigoTransacao'),
            observacoes: formData.get('observacoesSaque')
        };
        
        console.log('🔄 Atualizando saque:', saqueData);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/saques/${saqueData.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(saqueData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert('Saque atualizado com sucesso!');
            fecharModal('modalGerenciarSaque');
            loadSaques();
            loadDashboardStats();
        } else {
            throw new Error(result.message || 'Erro ao atualizar saque');
        }
        
    } catch (error) {
        console.error('❌ Erro ao atualizar saque:', error);
        alert('Erro ao atualizar saque: ' + error.message);
    }
}

// Aprovar saque
async function aprovarSaque(saqueId) {
    if (!confirm('Tem certeza que deseja aprovar este saque?')) {
        return;
    }
    
    try {
        console.log('🔄 Aprovando saque:', saqueId);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/saques/${saqueId}/aprovar`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                id_transacao_pagamento: prompt('Digite o ID da transação de pagamento:') || '',
                observacoes: prompt('Observações (opcional):') || ''
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert('Saque aprovado com sucesso!');
            loadSaques();
            loadDashboardStats();
        } else {
            throw new Error(result.message || 'Erro ao aprovar saque');
        }
        
    } catch (error) {
        console.error('❌ Erro ao aprovar saque:', error);
        alert('Erro ao aprovar saque: ' + error.message);
    }
}

// Cancelar saque
async function cancelarSaque(saqueId) {
    if (!confirm('Tem certeza que deseja cancelar este saque?')) {
        return;
    }
    
    try {
        console.log('🔄 Cancelando saque:', saqueId);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/admin/saques/${saqueId}/cancelar`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert('Saque cancelado com sucesso!');
            loadSaques();
            loadDashboardStats();
        } else {
            throw new Error(result.message || 'Erro ao cancelar saque');
        }
        
    } catch (error) {
        console.error('❌ Erro ao cancelar saque:', error);
        alert('Erro ao cancelar saque: ' + error.message);
    }
}

// Atualizar saques
function refreshSaques() {
    loadSaques();
}

// ==================== FUNÇÕES AUXILIARES ====================

// Mostrar/esconder loading
function showLoading(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}

// Mostrar/esconder tabela
function showTable(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.style.display = 'table';
    }
}

function hideTable(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.style.display = 'none';
    }
}

// Mostrar erro
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

// Fechar modal
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Obter texto do status
function getStatusText(status) {
    const statusMap = {
        'pendente': 'Pendente',
        'aprovado': 'Aprovado',
        'pago': 'Pago',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

// Logout
function logout() {
    fetch(`${window.API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(() => {
        window.location.href = 'login.html';
    })
    .catch(error => {
        console.error('Erro ao fazer logout:', error);
        window.location.href = 'login.html';
    });
}

// Fechar modal ao clicar fora
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});
