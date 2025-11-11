// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Elementos do DOM
const saldoDisponivelEl = document.getElementById('saldoDisponivel');
const entradasMesEl = document.getElementById('entradasMes');
const saidasMesEl = document.getElementById('saidasMes');
const transactionsListEl = document.getElementById('transactionsList');
const filterStatusEl = document.getElementById('filterStatus');
const filterPeriodEl = document.getElementById('filterPeriod');

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

// Função para carregar dados do saldo
async function loadBalanceData() {
    try {
        console.log('🔄 Carregando dados do saldo...');
        
        // Buscar vendas para calcular saldo
        const response = await fetch(`${window.API_BASE}/vendas`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const vendas = data.vendas || [];
        
        // Calcular saldo
        const vendasAprovadas = vendas.filter(v => v.pagamentoStatus === 'Aprovado');
        const vendasPendentes = vendas.filter(v => v.pagamentoStatus === 'Pendente');
        
        // Saldo disponível (apenas vendas aprovadas)
        const saldoDisponivel = vendasAprovadas.reduce((total, venda) => total + venda.pagamentoValor, 0);
        
        // Entradas do mês (vendas aprovadas do mês atual)
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const vendasMes = vendasAprovadas.filter(v => new Date(v.dataVenda) >= inicioMes);
        const entradasMes = vendasMes.reduce((total, venda) => total + venda.pagamentoValor, 0);
        
        // Saídas do mês (por enquanto 0, pode ser implementado depois)
        const saidasMes = 0;
        
        // Atualizar elementos
        saldoDisponivelEl.textContent = formatCurrency(saldoDisponivel);
        entradasMesEl.textContent = formatCurrency(entradasMes);
        saidasMesEl.textContent = formatCurrency(saidasMes);
        
        console.log('✅ Dados do saldo carregados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do saldo:', error);
        
        // Mostrar valores padrão em caso de erro
        saldoDisponivelEl.textContent = 'MZN 0,00';
        entradasMesEl.textContent = 'MZN 0,00';
        saidasMesEl.textContent = 'MZN 0,00';
    }
}

// Função para carregar histórico de transações
async function loadTransactions() {
    try {
        console.log('🔄 Carregando histórico de transações...');
        
        // Mostrar loading
        transactionsListEl.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando transações...</p>
            </div>
        `;
        
        // Buscar vendas
        const response = await fetch(`${window.API_BASE}/vendas`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const vendas = data.vendas || [];
        
        // Aplicar filtros
        const filteredVendas = applyFilters(vendas);
        
        // Renderizar transações
        renderTransactions(filteredVendas);
        
        console.log(`✅ ${filteredVendas.length} transações carregadas`);
        
    } catch (error) {
        console.error('❌ Erro ao carregar transações:', error);
        
        transactionsListEl.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar transações. Tente novamente.</p>
            </div>
        `;
    }
}

// Função para aplicar filtros
function applyFilters(vendas) {
    let filtered = [...vendas];
    
    // Filtro por status
    const statusFilter = filterStatusEl.value;
    if (statusFilter) {
        filtered = filtered.filter(v => v.pagamentoStatus === statusFilter);
    }
    
    // Filtro por período
    const periodFilter = filterPeriodEl.value;
    if (periodFilter !== 'all') {
        const hoje = new Date();
        const diasAtras = parseInt(periodFilter);
        const dataLimite = new Date(hoje.getTime() - (diasAtras * 24 * 60 * 60 * 1000));
        
        filtered = filtered.filter(v => new Date(v.dataVenda) >= dataLimite);
    }
    
    // Ordenar por data mais recente
    filtered.sort((a, b) => new Date(b.dataVenda) - new Date(a.dataVenda));
    
    return filtered;
}

// Função para renderizar transações
function renderTransactions(vendas) {
    if (vendas.length === 0) {
        transactionsListEl.innerHTML = `
            <div class="loading-transactions">
                <i class="fas fa-inbox"></i>
                <p>Nenhuma transação encontrada</p>
            </div>
        `;
        return;
    }
    
    const transactionsHTML = vendas.map(venda => `
        <div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-title">
                    ${venda.clienteNome || 'Cliente'} - ${venda.clienteEmail || 'N/A'}
                </div>
                <div class="transaction-details">
                    ${formatDate(venda.dataVenda)} • ${venda.pagamentoMetodo || 'N/A'} • ID: ${venda.pagamentoTransacaoId || 'N/A'}
                </div>
            </div>
            <div class="transaction-amount">
                ${formatCurrency(venda.pagamentoValor)}
            </div>
            <div class="transaction-status ${(venda.pagamentoStatus || 'pendente').toLowerCase()}">
                ${venda.pagamentoStatus || 'Pendente'}
            </div>
        </div>
    `).join('');
    
    transactionsListEl.innerHTML = transactionsHTML;
}

// Função para inicializar a página
async function initializePage() {
    console.log('🚀 Inicializando página de saldo...');
    
    // Carregar dados iniciais
    await Promise.all([
        loadBalanceData(),
        loadTransactions()
    ]);
    
    // Adicionar event listeners para filtros
    filterStatusEl.addEventListener('change', loadTransactions);
    filterPeriodEl.addEventListener('change', loadTransactions);
    
    console.log('✅ Página de saldo inicializada');
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', initializePage);

// Função para atualizar dados em tempo real (opcional)
function startAutoRefresh() {
    // Atualizar dados a cada 30 segundos
    setInterval(async () => {
        await loadBalanceData();
        await loadTransactions();
    }, 30000);
}

// Iniciar auto-refresh (opcional)
// startAutoRefresh();