// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE
// Estado global
let currentFilters = {
    status: 'Todos',
    dataInicio: null,
    dataFim: null
};

// Traduções
const translations = {
    pt: {
        'menu.dashboard': 'Painel',
        'menu.products': 'Gestão de Produto',
        'menu.sales': 'Gestão de Vendas',
        'menu.tools': 'Ferramentas',
        'dashboard.title': 'Dashboard',
        'filters.period': 'Período:',
        'filters.today': 'Hoje',
        'filters.week': 'Esta Semana',
        'filters.month': 'Este Mês',
        'filters.custom': 'Personalizado',
        'filters.start_date': 'Data Início:',
        'filters.end_date': 'Data Fim:',
        'filters.status': 'Status:',
        'filters.all': 'Todos',
        'filters.apply': 'Aplicar Filtros',
        'status.approved': 'Aprovadas',
        'status.pending': 'Pendentes',
        'status.cancelled': 'Canceladas',
        'stats.total_sales': 'Total de Vendas',
        'stats.approved_sales': 'Vendas Aprovadas',
        'stats.pending_sales': 'Vendas Pendentes',
        'stats.cancelled_sales': 'Vendas Canceladas',
        'stats.total_revenue': 'Receita Total (MZN)',
        'stats.refunds': 'Valor Total de Reembolsos',
        'tables.products_sold': 'Produtos Vendidos',
        'tables.clients': 'Lista de Clientes',
        'table.product_name': 'Nome do Produto',
        'table.quantity_sold': 'Quantidade Vendida',
        'table.revenue_per_product': 'Receita por Produto',
        'table.name': 'Nome',
        'table.email': 'E-mail',
        'table.phone': 'Telefone',
        'table.paid_product': 'Produto Pago',
        'table.purchases_made': 'Compras Feitas',
        'table.purchase_status': 'Status da Compra',
        'loading': 'Carregando...',
        'search.placeholder': 'Buscar por nome, e-mail ou telefone...',
        'sales.title': 'Gestão de Vendas',
        'sales.description': 'Esta página exibe estatísticas e dados detalhados sobre as vendas registradas no sistema.',
        'sales.coming_soon': 'Em breve',
        'sales.coming_soon_desc': 'Funcionalidades avançadas de gestão de vendas em desenvolvimento.',
        'tools.title': 'Ferramentas',
        'tools.language': 'Troca de Idioma',
        'tools.select_language': 'Selecionar Idioma:',
        'tools.data_management': 'Gestão de Dados',
        'tools.delete_all_data': 'Apagar Todos os Dados',
        'tools.delete_warning': 'Esta ação irá remover permanentemente todas as vendas do sistema.',
        'confirm.delete_title': 'Confirmar Exclusão',
        'confirm.delete_message': 'Tem certeza que deseja apagar todos os dados? Esta ação é irreversível.',
        'confirm.yes': 'Sim, apagar',
        'confirm.no': 'Cancelar',
        'success.data_deleted': 'Todos os dados foram removidos com sucesso.',
        'error.delete_failed': 'Erro ao apagar dados. Tente novamente.',
        'empty.no_products': 'Nenhum produto vendido encontrado.',
        'empty.no_clients': 'Nenhum cliente encontrado.'
    },
    en: {
        'menu.dashboard': 'Dashboard',
        'menu.products': 'Product Management',
        'menu.sales': 'Sales Management',
        'menu.tools': 'Tools',
        'dashboard.title': 'Dashboard',
        'filters.period': 'Period:',
        'filters.today': 'Today',
        'filters.week': 'This Week',
        'filters.month': 'This Month',
        'filters.custom': 'Custom',
        'filters.start_date': 'Start Date:',
        'filters.end_date': 'End Date:',
        'filters.status': 'Status:',
        'filters.all': 'All',
        'filters.apply': 'Apply Filters',
        'status.approved': 'Approved',
        'status.pending': 'Pending',
        'status.cancelled': 'Cancelled',
        'stats.total_sales': 'Total Sales',
        'stats.approved_sales': 'Approved Sales',
        'stats.pending_sales': 'Pending Sales',
        'stats.cancelled_sales': 'Cancelled Sales',
        'stats.total_revenue': 'Total Revenue (MZN)',
        'stats.refunds': 'Total Refunds Value',
        'tables.products_sold': 'Products Sold',
        'tables.clients': 'Client List',
        'table.product_name': 'Product Name',
        'table.quantity_sold': 'Quantity Sold',
        'table.revenue_per_product': 'Revenue per Product',
        'table.name': 'Name',
        'table.email': 'Email',
        'table.phone': 'Phone',
        'table.paid_product': 'Paid Product',
        'table.purchases_made': 'Purchases Made',
        'table.purchase_status': 'Purchase Status',
        'loading': 'Loading...',
        'search.placeholder': 'Search by name, email or phone...',
        'sales.title': 'Sales Management',
        'sales.description': 'This page displays statistics and detailed data about sales recorded in the system.',
        'sales.coming_soon': 'Coming Soon',
        'sales.coming_soon_desc': 'Advanced sales management features in development.',
        'tools.title': 'Tools',
        'tools.language': 'Language Switch',
        'tools.select_language': 'Select Language:',
        'tools.data_management': 'Data Management',
        'tools.delete_all_data': 'Delete All Data',
        'tools.delete_warning': 'This action will permanently remove all sales from the system.',
        'confirm.delete_title': 'Confirm Deletion',
        'confirm.delete_message': 'Are you sure you want to delete all data? This action is irreversible.',
        'confirm.yes': 'Yes, delete',
        'confirm.no': 'Cancel',
        'success.data_deleted': 'All data has been successfully removed.',
        'error.delete_failed': 'Error deleting data. Please try again.',
        'empty.no_products': 'No products sold found.',
        'empty.no_clients': 'No clients found.'
    }
};

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: bold;
                z-index: 1000;
                animation: slideIn 0.3s ease;
            }
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.warning { background: #ffc107; color: #333; }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .notification button {
                background: none;
                border: none;
                color: inherit;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Função para formatar moeda
function formatCurrency(value) {
    // Garantir que sempre use MZN em vez de MTn
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2
    }).format(value);
    
    // Substituir MTn por MZN se necessário
    return formatted.replace('MTn', 'MZN');
}

// Função para calcular datas dos filtros
function calcularDatas(periodo) {
    const hoje = new Date();
    let dataInicio, dataFim;
    
    switch (periodo) {
        case 'hoje':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
            break;
        case 'semana':
            const diaSemana = hoje.getDay();
            dataInicio = new Date(hoje);
            dataInicio.setDate(hoje.getDate() - diaSemana);
            dataInicio.setHours(0, 0, 0, 0);
            dataFim = new Date(hoje);
            dataFim.setHours(23, 59, 59, 999);
            break;
        case 'mes':
            dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
            break;
        default:
            return { dataInicio: null, dataFim: null };
    }
    
    return {
        dataInicio: dataInicio.toISOString().split('T')[0],
        dataFim: dataFim.toISOString().split('T')[0]
    };
}

// Função para aplicar filtros
async function aplicarFiltros() {
    const periodo = document.getElementById('filtro-periodo').value;
    const status = document.getElementById('filtro-status').value;
    
    if (periodo === 'personalizado') {
        currentFilters.dataInicio = document.getElementById('data-inicio').value;
        currentFilters.dataFim = document.getElementById('data-fim').value;
    } else {
        const datas = calcularDatas(periodo);
        currentFilters.dataInicio = datas.dataInicio;
        currentFilters.dataFim = datas.dataFim;
    }
    
    currentFilters.status = status;
    
    await carregarDados();
}

// Função para carregar resumo
async function carregarResumo() {
    try {
        const params = new URLSearchParams();
        if (currentFilters.status !== 'Todos') params.append('status', currentFilters.status);
        if (currentFilters.dataInicio) params.append('dataInicio', currentFilters.dataInicio);
        if (currentFilters.dataFim) params.append('dataFim', currentFilters.dataFim);
        
        const resumo = await apiRequest(`/dashboard/vendedor/resumo?${params.toString()}`);
        
        if (resumo.success && resumo.data) {
            document.getElementById('total-vendas').textContent = resumo.data.totalVendas;
            document.getElementById('vendas-aprovadas').textContent = resumo.data.vendasAprovadas;
            document.getElementById('vendas-pendentes').textContent = resumo.data.vendasPendentes;
            document.getElementById('vendas-canceladas').textContent = resumo.data.vendasCanceladas;
            document.getElementById('receita-total').textContent = formatCurrency(resumo.data.receitaTotal);
            document.getElementById('valor-reembolsos').textContent = formatCurrency(resumo.data.valorReembolsos);
        } else {
            throw new Error('Dados de resumo não disponíveis');
        }
        
    } catch (error) {
        console.error('Erro ao carregar resumo:', error);
        showNotification('Erro ao carregar estatísticas', 'error');
    }
}

// Função para carregar produtos
async function carregarProdutos() {
    try {
        document.getElementById('produtos-loading').style.display = 'block';
        document.getElementById('produtos-content').style.display = 'none';
        
        const params = new URLSearchParams();
        if (currentFilters.status !== 'Todos') params.append('status', currentFilters.status);
        if (currentFilters.dataInicio) params.append('dataInicio', currentFilters.dataInicio);
        if (currentFilters.dataFim) params.append('dataFim', currentFilters.dataFim);
        
        const response = await apiRequest(`/dashboard/vendedor/produtos?${params.toString()}`);
        const tbody = document.getElementById('produtos-tbody');
        
        tbody.innerHTML = '';
        
        if (response.success && response.data.produtos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p data-i18n="empty.no_products">Nenhum produto vendido encontrado.</p>
                    </td>
                </tr>
            `;
        } else if (response.success && response.data.produtos) {
            response.data.produtos.forEach(produto => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${produto.nome}</td>
                    <td>${produto.quantidadeVendida}</td>
                    <td class="currency">${formatCurrency(produto.receitaPorProduto)}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
        document.getElementById('produtos-loading').style.display = 'none';
        document.getElementById('produtos-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        document.getElementById('produtos-loading').style.display = 'none';
        showNotification('Erro ao carregar produtos', 'error');
    }
}

// Função para carregar clientes
async function carregarClientes() {
    try {
        document.getElementById('clientes-loading').style.display = 'block';
        document.getElementById('clientes-content').style.display = 'none';
        
        const params = new URLSearchParams();
        if (currentFilters.status !== 'Todos') params.append('status', currentFilters.status);
        if (currentFilters.dataInicio) params.append('dataInicio', currentFilters.dataInicio);
        if (currentFilters.dataFim) params.append('dataFim', currentFilters.dataFim);
        
        const busca = document.getElementById('busca-cliente').value;
        if (busca) params.append('busca', busca);
        
        const response = await apiRequest(`/dashboard/vendedor/clientes?${params.toString()}`);
        const tbody = document.getElementById('clientes-tbody');
        
        tbody.innerHTML = '';
        
        if (response.success && response.data.clientes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i class="fas fa-users"></i>
                        <p data-i18n="empty.no_clients">Nenhum cliente encontrado.</p>
                    </td>
                </tr>
            `;
        } else if (response.success && response.data.clientes) {
            response.data.clientes.forEach(cliente => {
                const ultimoProduto = cliente.produtosPagos[cliente.produtosPagos.length - 1];
                const statusClass = `status-${(ultimoProduto?.status || 'pendente').toLowerCase()}`;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${cliente.nome}</td>
                    <td>${cliente.email}</td>
                    <td>${cliente.telefone}</td>
                    <td>${ultimoProduto?.nome || 'N/A'}</td>
                    <td>${cliente.comprasFeitas}</td>
                    <td><span class="status-badge ${statusClass}">${ultimoProduto?.status || 'N/A'}</span></td>
                `;
                tbody.appendChild(row);
            });
        }
        
        document.getElementById('clientes-loading').style.display = 'none';
        document.getElementById('clientes-content').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        document.getElementById('clientes-loading').style.display = 'none';
        showNotification('Erro ao carregar clientes', 'error');
    }
}

// Função para carregar todos os dados
async function carregarDados() {
    await Promise.all([
        carregarResumo(),
        carregarProdutos(),
        carregarClientes()
    ]);
}

// Função para mostrar seção
function showSection(sectionName) {
    // Ocultar todas as seções
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remover classe active de todos os links
    document.querySelectorAll('.sidebar a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Mostrar seção selecionada
    document.getElementById(`${sectionName}-section`).style.display = 'block';
    
    // Adicionar classe active ao link correspondente
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
}

// Função para trocar idioma
function trocarIdioma() {
    const idioma = document.getElementById('idioma-select').value;
    localStorage.setItem('ratixpay_idioma', idioma);
    aplicarTraducoes(idioma);
}

// Função para aplicar traduções
function aplicarTraducoes(idioma) {
    const textos = translations[idioma] || translations.pt;
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (textos[key]) {
            element.textContent = textos[key];
        }
    });
    
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (textos[key]) {
            element.placeholder = textos[key];
        }
    });
}

// Função para confirmar apagar dados
function confirmarApagarDados() {
    const idioma = localStorage.getItem('ratixpay_idioma') || 'pt';
    const textos = translations[idioma];
    
    if (confirm(`${textos['confirm.delete_title']}\n\n${textos['confirm.delete_message']}`)) {
        apagarTodosDados();
    }
}

// Função para apagar todos os dados
async function apagarTodosDados() {
    try {
        await apiRequest('/dashboard/vendas', { method: 'DELETE' });
        
        const idioma = localStorage.getItem('ratixpay_idioma') || 'pt';
        const textos = translations[idioma];
        
        showNotification(textos['success.data_deleted'], 'success');
        
        // Recarregar dados
        await carregarDados();
        
    } catch (error) {
        console.error('Erro ao apagar dados:', error);
        
        const idioma = localStorage.getItem('ratixpay_idioma') || 'pt';
        const textos = translations[idioma];
        
        showNotification(textos['error.delete_failed'], 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    
    // Configurar filtro de período
    document.getElementById('filtro-periodo').addEventListener('change', function() {
        const isCustom = this.value === 'personalizado';
        document.getElementById('data-inicio-group').style.display = isCustom ? 'block' : 'none';
        document.getElementById('data-fim-group').style.display = isCustom ? 'block' : 'none';
    });
    
    // Configurar busca de clientes
    let timeoutBusca;
    document.getElementById('busca-cliente').addEventListener('input', function() {
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(() => {
            carregarClientes();
        }, 500);
    });
    
    // Carregar idioma salvo
    const idiomaSalvo = localStorage.getItem('ratixpay_idioma') || 'pt';
    document.getElementById('idioma-select').value = idiomaSalvo;
    aplicarTraducoes(idiomaSalvo);
    
    // Carregar dados iniciais
    carregarDados();
    
});

