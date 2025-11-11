// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não redeclarar a variável API_BASE aqui

// Variáveis globais para o gráfico
let salesChart = null;
let currentPeriod = 'hoje'; // Padrão: receita diária
let currentPage = 'dashboard'; // Para controlar qual métrica mostrar

// Utilitário para formatação de moeda
const formatCurrency = (value) => {
    // Garantir que sempre use MZN em vez de MTn
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2
    }).format(value);
    
    // Substituir MTn por MZN se necessário
    return formatted.replace('MTn', 'MZN');
};

// Utilitário para formatação de valores de forma mais interessante
const formatCurrencyInteresting = (value) => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M MZN`;
    } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K MZN`;
    } else {
        return `${value.toFixed(0)} MZN`;
    }
};

// Utilitário para formatação de valores com separadores e K para milhares
const formatCurrencyWithSeparators = (value) => {
    if (value >= 1000) {
        const thousands = value / 1000;
        if (thousands >= 1000) {
            // Para milhões, usar M
            return `${(thousands / 1000).toFixed(1)}M MZN`;
        } else {
            // Para milhares, usar K
            return `${thousands.toFixed(0)}K MZN`;
        }
    } else {
        return `${value.toFixed(0)} MZN`;
    }
};

// Utilitário para formatação de data
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Função para fazer requisições à API com melhor tratamento de erros e retry
async function apiRequest(endpoint, options = {}, retryCount = 0) {
    const maxRetries = 2; // Máximo 2 tentativas adicionais
    
    try {
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Criar AbortController para timeout (aumentado para 30 segundos)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
        
        console.log(`🔄 Tentativa ${retryCount + 1} para ${endpoint}`);
        console.log(`🔍 URL completa: ${window.API_BASE}${endpoint}`);
        
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            },
            signal: controller.signal,
            ...options
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            throw new Error('Token inválido ou expirado');
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`❌ Erro na resposta da API: ${response.status}`, errorData);
            throw new Error(errorData.erro || `HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log(`✅ Resposta da API recebida:`, responseData);
        return responseData;
    } catch (error) {
        console.error('Erro na API:', error);
        
        // Tentar novamente se for timeout e ainda temos tentativas
        if (error.name === 'AbortError' && retryCount < maxRetries) {
            console.log(`🔄 Timeout na tentativa ${retryCount + 1}, tentando novamente...`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
            return apiRequest(endpoint, options, retryCount + 1);
        }
        
        if (error.name === 'AbortError') {
            console.error('Timeout na requisição - servidor demorou mais de 30 segundos');
            showNotification('Timeout: Servidor demorou para responder (30s)', 'warning');
            throw new Error('Timeout na requisição');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('Erro de conexão com o servidor');
            showNotification('Erro de conexão com o servidor', 'error');
            throw new Error('Erro de conexão');
        } else {
            console.error('Erro na API:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
            throw error;
        }
    }
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    // Remover notificação existente
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
    
    // Adicionar estilos se não existirem
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
            
            .notification.success {
                background: #27ae60;
            }
            
            .notification.error {
                background: #e74c3c;
            }
            
            .notification.warning {
                background: #f39c12;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification button {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: 10px;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Função para detectar página atual
function detectarPaginaAtual() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    if (filename.includes('gestao-vendas') || filename.includes('vendas')) {
        return 'gestao-vendas';
    } else if (filename.includes('pagamento') || filename.includes('payment')) {
        return 'pagamento';
    } else {
        return 'dashboard';
    }
}

// Função para inicializar o dashboard
async function initializeDashboard() {
    try {
        console.log('🚀 ===== INICIALIZANDO DASHBOARD =====');
        console.log('🚀 DOM carregado:', document.readyState);
        
        // Detectar página atual
        currentPage = detectarPaginaAtual();
        console.log('📄 Página detectada:', currentPage);
        
        // No dashboard, sempre mostrar receita diária por padrão
        if (currentPage === 'dashboard') {
            currentPeriod = 'hoje';
            console.log('📊 Dashboard: Exibindo receita diária por padrão');
            
            // Marcar botão "Hoje" como ativo por padrão
            const periodButtons = document.querySelectorAll('.period-btn');
            periodButtons.forEach(btn => {
                if (btn.dataset.period === 'hoje') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        
        // Carregar dados iniciais
        console.log('🚀 Carregando dados iniciais...');
        await Promise.all([
            carregarDadosUsuario(),
            carregarEstatisticas(),
            carregarVendas()
        ]);
        
        // Forçar renderização do gráfico após carregamento
        setTimeout(() => {
            forcarRenderizacaoGrafico();
        }, 500);
        
        // Executar testes de rótulos após um delay
        setTimeout(() => {
            testarRotulosGrafico();
            testarRenderizacaoGrafico();
        }, 1000);
        
        // Configurar filtros de período
        setupPeriodFilters();
        
        // Configurar botão de logout
        setupLogoutButton();
        
        // Configurar toggle do perfil
        setupProfileToggle();
        
        // Configurar notificações
        setupNotifications();
        
        console.log('✅ Dashboard inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
        showNotification('Erro ao carregar dashboard', 'error');
    }
}

// Função para carregar dados do usuário
async function carregarDadosUsuario() {
    try {
        const userData = await apiRequest('/auth/me');
        
        if (userData.success && userData.user) {
            const user = userData.user;
            
            // Atualizar informações do usuário
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userFullNameEl = document.getElementById('userFullName');
            
            if (userNameEl) userNameEl.textContent = user.nome || user.nome_completo || 'Usuário';
            if (userRoleEl) userRoleEl.textContent = user.role === 'user' ? 'Vendedor' : 'Administrador';
            if (userFullNameEl) userFullNameEl.textContent = user.nome_completo || user.nome || 'Nome não disponível';
            
            // Atualizar mensagem de boas-vindas
            const welcomeMessage = document.getElementById('welcomeMessage');
            if (welcomeMessage) {
                const nomeCompleto = user.nome_completo || user.nome || 'Usuário';
                welcomeMessage.textContent = `Bem-vindo, ${nomeCompleto}`;
            }
            
            // Atualizar avatar no ícone do perfil
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) {
                if (user.foto) {
                    userAvatar.innerHTML = `<img src="${user.foto}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                } else {
                    // Se não tem foto, usar iniciais do nome
                    const initials = (user.nome || user.nome_completo || 'U').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    userAvatar.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #E67E22, #D35400); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">${initials}</div>`;
                }
            }
            
            // Atualizar texto de boas-vindas do perfil
            const profileWelcomeText = document.getElementById('profileWelcomeText');
            if (profileWelcomeText) {
                const nomeCompleto = user.nome_completo || user.nome || 'Usuário';
                profileWelcomeText.textContent = `Bem-vindo, ${nomeCompleto}`;
            }
            
            // Atualizar informação de boas-vindas no canto inferior direito
            const dashboardWelcomeInfo = document.getElementById('dashboardWelcomeInfo');
            if (dashboardWelcomeInfo) {
                const nomeCompleto = user.nome_completo || user.nome || 'Usuário';
                dashboardWelcomeInfo.textContent = `Bem-vindo, ${nomeCompleto}`;
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

// Função para carregar estatísticas
async function carregarEstatisticas() {
    try {
        console.log('📊 Carregando estatísticas para período:', currentPeriod);
        
        const params = new URLSearchParams({
            periodo: currentPeriod
        });
        
        console.log(`🔍 Parâmetros da requisição:`, params.toString());
        console.log(`🔍 Período atual:`, currentPeriod);
        
        const response = await apiRequest(`/dashboard/vendedor/resumo?${params.toString()}`);
        
        console.log(`🔍 Resposta completa da API:`, response);
        
        if (response.success && response.data) {
            const data = response.data;
            
            console.log('🔍 Dados completos recebidos da API:', data);
            console.log('🔍 Dados do período:', data.periodo);
            
            // Atualizar cards de estatísticas baseado na página atual
            atualizarMetricasReceita(data);
            
            // Atualizar estatísticas de vendas baseadas no período
            atualizarEstatisticasVendas(data);
            
            console.log('✅ Estatísticas carregadas:', data);
        } else {
            console.error('❌ Resposta da API não contém dados válidos:', response);
            console.error('❌ response.success:', response.success);
            console.error('❌ response.data:', response.data);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
        console.error('❌ Stack trace:', error.stack);
        // Usar valores padrão em caso de erro
        console.log('🔧 Usando valores padrão devido ao erro');
        atualizarMetricasReceita({});
        atualizarEstatisticasVendas({});
    }
}

// Função para calcular vendas aprovadas por período baseado nas transações
function calcularVendasAprovadasPorPeriodo(vendas, periodo) {
    console.log(`🔢 Calculando vendas aprovadas para período: ${periodo}`);
    
    const agora = new Date();
    let inicioPeriodo;
    let fimPeriodo = new Date();

    switch (periodo) {
        case 'hoje':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
            break;
        case 'ontem':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case '7dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7);
            break;
        case '30dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 30);
            break;
        default:
            return 0;
    }

    // Filtrar vendas aprovadas no período
    const vendasFiltradas = vendas.filter(venda => {
        const status = venda.pagamento?.status || venda.pagamento_status || venda.status;
        const dataVenda = new Date(venda.created_at);
        
        const isAprovada = status && (
            status === "Pago" || 
            status === "Aprovada" ||
            status.toLowerCase() === "pago" || 
            status.toLowerCase() === "aprovada"
        );
        const isNoPeriodo = dataVenda >= inicioPeriodo && dataVenda < fimPeriodo;
        
        // Log detalhado para debug
        if (isAprovada && isNoPeriodo) {
            console.log(`✅ Venda aprovada encontrada:`, {
                id: venda.id,
                status: status,
                dataVenda: dataVenda.toISOString(),
                periodo: periodo,
                inicioPeriodo: inicioPeriodo.toISOString(),
                fimPeriodo: fimPeriodo.toISOString()
            });
        }
        
        // Log para debug de vendas que não passaram no filtro
        if (!isAprovada) {
            console.log(`❌ Venda não aprovada:`, {
                id: venda.id,
                status: status,
                dataVenda: dataVenda.toISOString(),
                isAprovada: isAprovada,
                isNoPeriodo: isNoPeriodo
            });
        }
        
        return isAprovada && isNoPeriodo;
    });

    console.log(`📊 Vendas aprovadas encontradas no período ${periodo}: ${vendasFiltradas.length}`);
    console.log(`📅 Período: ${inicioPeriodo.toISOString()} até ${fimPeriodo.toISOString()}`);
    return vendasFiltradas.length;
}

// Função para calcular vendas canceladas por período baseado nas transações
function calcularVendasCanceladasPorPeriodo(vendas, periodo) {
    console.log(`🔢 Calculando vendas canceladas para período: ${periodo}`);
    
    const agora = new Date();
    let inicioPeriodo;
    let fimPeriodo = new Date();

    switch (periodo) {
        case 'hoje':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
            break;
        case 'ontem':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case '7dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7);
            break;
        case '30dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 30);
            break;
        default:
            return 0;
    }

    // Filtrar vendas canceladas no período
    const vendasFiltradas = vendas.filter(venda => {
        const status = venda.pagamento?.status || venda.pagamento_status || venda.status;
        const dataVenda = new Date(venda.created_at);
        
        // Verificar se é cancelada (incluindo "Cancelada" e "Cancelado")
        const isCancelada = status && (
            status.toLowerCase() === "cancelado" || 
            status.toLowerCase() === "cancelada" ||
            status.toLowerCase() === "rejeitado"
        );
        const isNoPeriodo = dataVenda >= inicioPeriodo && dataVenda < fimPeriodo;
        
        return isCancelada && isNoPeriodo;
    });

    console.log(`📊 Vendas canceladas encontradas no período ${periodo}: ${vendasFiltradas.length}`);
    return vendasFiltradas.length;
}

// Função para calcular vendas pendentes por período baseado nas transações
function calcularVendasPendentesPorPeriodo(vendas, periodo) {
    console.log(`🔢 Calculando vendas pendentes para período: ${periodo}`);
    
    const agora = new Date();
    let inicioPeriodo;
    let fimPeriodo = new Date();

    switch (periodo) {
        case 'hoje':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
            break;
        case 'ontem':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case '7dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7);
            break;
        case '30dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 30);
            break;
        default:
            return 0;
    }

    // Filtrar vendas pendentes no período
    const vendasFiltradas = vendas.filter(venda => {
        const status = venda.pagamento?.status || venda.pagamento_status || venda.status;
        const dataVenda = new Date(venda.created_at);
        
        const isPendente = status && status.toLowerCase() === "pendente";
        const isNoPeriodo = dataVenda >= inicioPeriodo && dataVenda < fimPeriodo;
        
        return isPendente && isNoPeriodo;
    });

    console.log(`📊 Vendas pendentes encontradas no período ${periodo}: ${vendasFiltradas.length}`);
    return vendasFiltradas.length;
}

// Função para calcular receita por período baseado nas transações
function calcularReceitaPorPeriodo(vendas, periodo) {
    console.log(`💰 Calculando receita para período: ${periodo}`);
    
    const agora = new Date();
    let inicioPeriodo;
    let fimPeriodo = new Date();

    switch (periodo) {
        case 'hoje':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
            break;
        case 'ontem':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            break;
        case '7dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 7);
            break;
        case '30dias':
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 30);
            break;
        default:
            return 0;
    }

    // Filtrar vendas aprovadas no período e somar valores
    const vendasFiltradas = vendas.filter(venda => {
        const status = venda.pagamento?.status || venda.pagamento_status || venda.status;
        const dataVenda = new Date(venda.created_at);
        
        const isAprovada = status && status.toLowerCase() === "aprovado";
        const isNoPeriodo = dataVenda >= inicioPeriodo && dataVenda < fimPeriodo;
        
        return isAprovada && isNoPeriodo;
    });

    // Somar valores das vendas aprovadas
    const receitaTotal = vendasFiltradas.reduce((total, venda) => {
        const valor = Number(venda.pagamento?.valor || venda.pagamento_valor || venda.valor_final || 0);
        return total + valor;
    }, 0);

    console.log(`💰 Receita calculada para ${periodo}: ${receitaTotal} MZN (${vendasFiltradas.length} vendas aprovadas)`);
    return receitaTotal;
}

// Função para atualizar estatísticas de vendas baseadas no período
function atualizarEstatisticasVendas(data) {
    console.log(`📊 Atualizando estatísticas de vendas para período: ${currentPeriod}`);
    console.log('📊 Dados recebidos:', data);
    
    // Usar dados do período específico da API
    const periodoData = data.periodo || {};
    
    // Vendas Aprovadas - do período selecionado
    const vendasAprovadasElement = document.getElementById('vendasAprovadas');
    if (vendasAprovadasElement) {
        const vendasAprovadas = periodoData.vendasAprovadas || 0;
        vendasAprovadasElement.classList.remove('loading');
        vendasAprovadasElement.innerHTML = vendasAprovadas;
        console.log(`✅ Vendas Aprovadas (${currentPeriod}): ${vendasAprovadas}`);
    }
    
    // Vendas Canceladas - do período selecionado
    const vendasCanceladasElement = document.getElementById('vendasCanceladas');
    if (vendasCanceladasElement) {
        const vendasCanceladas = periodoData.vendasCanceladas || 0;
        vendasCanceladasElement.classList.remove('loading');
        vendasCanceladasElement.innerHTML = vendasCanceladas;
        console.log(`✅ Vendas Canceladas (${currentPeriod}): ${vendasCanceladas}`);
    }
    
    // Vendas Pendentes - do período selecionado
    const vendasPendentesElement = document.getElementById('vendasPendentes');
    if (vendasPendentesElement) {
        const vendasPendentes = periodoData.vendasPendentes || 0;
        vendasPendentesElement.classList.remove('loading');
        vendasPendentesElement.innerHTML = vendasPendentes;
        console.log(`✅ Vendas Pendentes (${currentPeriod}): ${vendasPendentes}`);
        console.log(`🔍 Elemento vendasPendentes encontrado:`, vendasPendentesElement);
        console.log(`🔍 Dados do período:`, periodoData);
    } else {
        console.error(`❌ Elemento vendasPendentes não encontrado no DOM`);
    }
    
    // Atualizar dados para o gráfico (usar dados do período)
    updateChartDataFromPeriod(periodoData);
    
    console.log(`📊 Estatísticas de vendas atualizadas para ${currentPeriod}:`, {
        aprovadas: vendasAprovadasElement?.textContent || 0,
        canceladas: vendasCanceladasElement?.textContent || 0,
        pendentes: vendasPendentesElement?.textContent || 0
    });
}

// Função para atualizar dados do gráfico baseado no período
function updateChartDataFromPeriod(periodoData) {
    console.log(`📈 Atualizando dados do gráfico para período: ${currentPeriod}`);
    console.log('📈 Dados do período:', periodoData);
    
    // Forçar renderização do gráfico
    setTimeout(() => {
        forcarRenderizacaoGrafico();
    }, 100);
}

// Função para criar gráfico com dados sintéticos
function criarGraficoComDadosSinteticos(periodoData) {
    const agora = new Date();
    let labels = [];
    let dataset = [];
    
    switch (currentPeriod) {
        case 'hoje':
            // Para hoje, mostrar por intervalos de 2 horas
            for (let i = 0; i < 24; i += 2) {
                const horaInicio = i.toString().padStart(2, '0');
                const horaFim = (i + 2).toString().padStart(2, '0');
                labels.push(`${horaInicio}:00 - ${horaFim}:00`);
                dataset.push(0);
            }
            break;
        case 'ontem':
            // Para ontem, mostrar por intervalos de 2 horas
            for (let i = 0; i < 24; i += 2) {
                const horaInicio = i.toString().padStart(2, '0');
                const horaFim = (i + 2).toString().padStart(2, '0');
                labels.push(`${horaInicio}:00 - ${horaFim}:00`);
                dataset.push(0);
            }
            break;
        case '7dias':
            // Para 7 dias, mostrar por dias
            for (let i = 6; i >= 0; i--) {
                const data = new Date(agora);
                data.setDate(data.getDate() - i);
                labels.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
                dataset.push(0);
            }
            break;
        case '30dias':
            // Para 30 dias, mostrar por dias (últimos 30 dias)
            for (let i = 29; i >= 0; i--) {
                const data = new Date(agora);
                data.setDate(data.getDate() - i);
                labels.push(data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
                dataset.push(0);
            }
            break;
    }
    
    // Distribuir a receita do período de forma mais realista
    const receitaTotal = periodoData.receita || 0;
    if (receitaTotal > 0 && dataset.length > 0) {
        // Criar distribuição mais realista com picos e vales
        const baseValue = receitaTotal / dataset.length;
        dataset = dataset.map((_, index) => {
            // Adicionar variação realista (±30%)
            const variation = (Math.random() - 0.5) * 0.6; // -30% a +30%
            const value = baseValue * (1 + variation);
            return Math.max(0, Math.round(value * 100) / 100);
        });
        
        // Garantir que a soma seja aproximadamente igual à receita total
        const currentSum = dataset.reduce((sum, val) => sum + val, 0);
        if (currentSum > 0) {
            const factor = receitaTotal / currentSum;
            dataset = dataset.map(val => Math.round(val * factor * 100) / 100);
        }
    }
    
    console.log(`📈 Labels gerados: ${labels.length}`);
    console.log(`📈 Dataset gerado: ${dataset.length} valores`);
    console.log(`💰 Total no dataset: ${dataset.reduce((sum, val) => sum + val, 0)} MZN`);
    
    // Criar ou atualizar o gráfico
    const ctx = document.getElementById("salesChart");
    if (!ctx) {
        console.error('❌ Canvas salesChart não encontrado!');
        return;
    }
    
    // Destruir gráfico existente
    if (typeof window.graficoVendas !== 'undefined' && window.graficoVendas) {
        window.graficoVendas.destroy();
        window.graficoVendas = null;
    }
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não está carregado!');
        mostrarGraficoVazio('Chart.js não carregado');
        return;
    }
    
    // Criar novo gráfico
    try {
        window.graficoVendas = new Chart(ctx, {
            type: "line",
            data: {
                labels: labels,
                datasets: [{
                    label: "Receita (MZN)",
                    data: dataset,
                    borderColor: "#4f46e5",
                    backgroundColor: "rgba(79, 70, 229, 0.1)",
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointBackgroundColor: function(context) {
                        // Cores dinâmicas baseadas no valor
                        const value = context.parsed.y;
                        if (value >= 1000) return '#10b981'; // Verde para valores altos
                        if (value >= 500) return '#3b82f6';  // Azul para valores médios
                        return '#f59e0b'; // Amarelo para valores baixos
                    },
                    pointBorderColor: "#fff",
                    pointHoverBackgroundColor: function(context) {
                        const value = context.parsed.y;
                        if (value >= 1000) return '#059669';
                        if (value >= 500) return '#2563eb';
                        return '#d97706';
                    },
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 3,
                    pointBorderWidth: 2,
                    pointStyle: 'circle'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: { 
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: {
                            color: "#000000",
                            font: {
                                size: 13,
                                weight: '600'
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    title: {
                        display: true,
                        text: `Gráfico de Vendas - ${getPeriodLabel(currentPeriod)} (Dados Sintéticos)`,
                        color: "#000000",
                        font: {
                            size: 15,
                            weight: '600'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#4f46e5',
                        borderWidth: 2,
                        cornerRadius: 12,
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: 'bold'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return `💰 Receita: ${formatCurrency(context.parsed.y)}`;
                            },
                            afterLabel: function(context) {
                                // Mostrar número de vendas se disponível
                                const vendasCount = context.dataset.vendasCount ? context.dataset.vendasCount[context.dataIndex] : 0;
                                return vendasCount > 0 ? `📊 ${vendasCount} venda${vendasCount > 1 ? 's' : ''} aprovada${vendasCount > 1 ? 's' : ''}` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            text: currentPeriod === "hoje" || currentPeriod === "ontem" ? "Horários" : currentPeriod === "7dias" ? "Dias" : "Dias do Mês",
                            color: "#000000",
                            font: {
                                size: 13,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: "rgba(230, 126, 34, 0.08)",
                            drawBorder: false
                        },
                        ticks: {
                            color: "#000000",
                            maxRotation: 45,
                            minRotation: 0
                        }
                    },
                    y: { 
                        title: { 
                            display: true, 
                            text: "Valor (MZN)",
                            color: "#000000",
                            font: {
                                size: 13,
                                weight: '600'
                            }
                        }, 
                        beginAtZero: true,
                        grid: {
                            color: "rgba(230, 126, 34, 0.08)",
                            drawBorder: false
                        },
                        ticks: {
                            color: "#000000",
                            callback: function(value) {
                                // Formatação simples para o eixo Y
                                if (value >= 1000000) {
                                    return `${(value / 1000000).toFixed(1)}M`;
                                } else if (value >= 1000) {
                                    return `${(value / 1000).toFixed(0)}K`;
    } else {
                                    return value.toFixed(0);
                                }
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8,
                        radius: 4
                    },
                    line: {
                        tension: 0.4
                    }
                },
                animation: {
                    duration: 1200,
                    easing: 'easeInOutQuart',
                    delay: function(context) {
                        return context.dataIndex * 50; // Animação sequencial
                    }
                },
                transitions: {
                    show: {
                        animations: {
                            x: {
                                from: 0
                            },
                            y: {
                                from: 0
                            }
                        }
                    },
                    hide: {
                        animations: {
                            x: {
                                to: 0
                            },
                            y: {
                                to: 0
                            }
                        }
                    }
                }
            }
        });
        
        console.log('✅ Gráfico sintético criado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar gráfico sintético:', error);
        mostrarGraficoVazio('Erro ao criar gráfico');
    }
}

// Função para atualizar métricas de receita baseado na página
function atualizarMetricasReceita(data) {
    const receitaElement = document.getElementById('receitaTotal');
    if (!receitaElement) return;
    
    console.log(`💰 Atualizando receita para período: ${currentPeriod}`);
    console.log('💰 Dados de receita recebidos:', data);
    
    let valorReceita = 0;
    let labelReceita = 'Receita total';
    
    // Usar dados do período específico da API
    const periodoData = data.periodo || {};
    
    // Mostrar receita do período selecionado
        valorReceita = periodoData.receita || 0;
        labelReceita = `Receita (${currentPeriod})`;
        console.log(`💰 Receita do período ${currentPeriod}: ${valorReceita} MZN`);
    
    // Remover spinner e mostrar resultado
    receitaElement.classList.remove('loading');
    receitaElement.innerHTML = formatCurrency(valorReceita);
    console.log(`✅ Receita (${currentPeriod}): ${formatCurrency(valorReceita)}`);
    
    // Atualizar label se existir
    const labelElement = document.querySelector('#receitaTotal').previousElementSibling;
    if (labelElement && labelElement.tagName === 'H3') {
        labelElement.textContent = labelReceita;
    }
    
    // Atualizar métricas adicionais se existirem
    atualizarMetricasAdicionais(data);
}

// Função para atualizar métricas adicionais de receita
function atualizarMetricasAdicionais(data) {
    // Receita Total
    const receitaTotalElement = document.getElementById('receitaTotalCompleta');
    if (receitaTotalElement) {
        receitaTotalElement.textContent = formatCurrency(data.receitaTotal || 0);
    }
    
    // Receita Disponível
    const receitaDisponivelElement = document.getElementById('receitaDisponivel');
    if (receitaDisponivelElement) {
        receitaDisponivelElement.textContent = formatCurrency(data.receitaDisponivel || 0);
    }
    
    // Receita Semanal
    const receitaSemanalElement = document.getElementById('receitaSemanal');
    if (receitaSemanalElement) {
        receitaSemanalElement.textContent = formatCurrency(data.receitaSemanal || 0);
    }
    
    // Receita Mensal
    const receitaMensalElement = document.getElementById('receitaMensal');
    if (receitaMensalElement) {
        receitaMensalElement.textContent = formatCurrency(data.receitaMensal || 0);
    }
}

// Função para atualizar estatísticas de períodos com/sem vendas
function atualizarEstatisticasPeriodos(dados) {
    const totalPeriodos = dados.length;
    const periodosComVendas = dados.filter(valor => valor > 0).length;
    const periodosSemVendas = totalPeriodos - periodosComVendas;
    const percentualAtividade = totalPeriodos > 0 ? Math.round((periodosComVendas / totalPeriodos) * 100) : 0;
    
    // Atualizar elementos se existirem
    const elementoAtividade = document.getElementById('periodosAtividade');
    if (elementoAtividade) {
        elementoAtividade.textContent = `${percentualAtividade}%`;
    }
    
    const elementoComVendas = document.getElementById('periodosComVendas');
    if (elementoComVendas) {
        elementoComVendas.textContent = periodosComVendas;
    }
    
    const elementoSemVendas = document.getElementById('periodosSemVendas');
    if (elementoSemVendas) {
        elementoSemVendas.textContent = periodosSemVendas;
    }
    
    console.log(`📊 Estatísticas de períodos: ${periodosComVendas}/${totalPeriodos} com vendas (${percentualAtividade}%)`);
}

// ===== GRÁFICO DE VENDAS =====

// Variável global para armazenar todas as vendas
let todasVendasOriginais = [];
let graficoVendas;

// Função para carregar vendas do endpoint
async function carregarVendas() {
    try {
        console.log('🔍 Carregando vendas do endpoint...');
        
        const response = await apiRequest('/dashboard/ultimas-transacoes?page=1&limit=1000');
        
        console.log('📊 Resposta completa da API:', response);
        
        if (response.success && response.data) {
            // Verificar diferentes estruturas possíveis
            let vendas = null;
            
            if (response.data.transacoes) {
                vendas = response.data.transacoes;
                console.log('✅ Vendas encontradas em response.data.transacoes');
            } else if (response.data.vendas) {
                vendas = response.data.vendas;
                console.log('✅ Vendas encontradas em response.data.vendas');
            } else if (Array.isArray(response.data)) {
                vendas = response.data;
                console.log('✅ Vendas encontradas diretamente em response.data');
            } else {
                console.error('❌ Estrutura de dados não reconhecida:', response.data);
                vendas = [];
            }
            
            // Normalizar e validar vendas antes de guardar
            const vendasNormalizadas = (vendas || []).map(venda => {
                // Garantir que created_at existe (campo principal usado pelo gráfico)
                if (!venda.created_at && venda.createdAt) {
                    venda.created_at = venda.createdAt;
                }
                // Se ainda não tem created_at, tentar outros campos
                if (!venda.created_at) {
                    venda.created_at = venda.data_venda || 
                        venda.pagamento?.data_processamento ||
                        venda.data || 
                        venda.date ||
                        venda.timestamp ||
                        venda.updated_at ||
                        venda.updatedAt;
                }
                
                // Garantir que também temos createdAt para compatibilidade
                if (!venda.createdAt && venda.created_at) {
                    venda.createdAt = venda.created_at;
                }
                
                return venda;
            }).filter(venda => {
                // Filtrar vendas com erro
                if (venda.erro) {
                    return false;
                }
                // Manter vendas mesmo sem data (serão filtradas depois no agrupamento)
                // A API agora sempre fornece uma data, então isso é apenas uma segurança extra
                return true;
            });
            
            // Guardar todas as vendas normalizadas
            todasVendasOriginais = vendasNormalizadas;
            console.log('✅ Vendas carregadas e normalizadas:', todasVendasOriginais.length);
            
            // Debug: verificar estrutura das vendas (apenas se houver poucas)
            if (todasVendasOriginais.length > 0 && todasVendasOriginais.length <= 5) {
                const primeiraVenda = todasVendasOriginais[0];
                console.log('🔍 Debug - Primeira venda:', {
                    id: primeiraVenda.id,
                    status: primeiraVenda.status,
                    created_at: primeiraVenda.created_at,
                    tem_pagamento: !!primeiraVenda.pagamento
                });
            }
            
            // Renderizar gráfico para o período atual
            setTimeout(() => {
                forcarRenderizacaoGrafico();
            }, 100);
        } else {
            console.error('❌ Erro ao carregar vendas - response não é sucesso:', response);
            todasVendasOriginais = [];
            
            // Mostrar mensagem de erro no gráfico
            mostrarGraficoVazio('Erro ao carregar dados das vendas');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar vendas:', error);
        todasVendasOriginais = [];
        mostrarGraficoVazio('Erro de conexão ao carregar vendas');
    }
}

// Função para agrupar vendas por período
function agruparVendasPorPeriodo(vendas, periodo = "hoje") {
    console.log(`📊 Agrupando vendas para período: ${periodo}`);
    console.log(`📊 Total de vendas recebidas: ${vendas.length}`);
    
    // Validar entrada
    if (!vendas || !Array.isArray(vendas)) {
        console.error('❌ Dados de vendas inválidos para agrupamento');
        return { labels: [], dataset: [] };
    }
    
    const agora = new Date();
    let inicioPeriodo, fimPeriodo;

    // Definir períodos com precisão
    switch (periodo) {
        case "hoje":
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
        case "ontem":
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 23, 59, 59);
            break;
        case "7dias":
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
        case "30dias":
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 29, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
    }

    // Filtrar vendas aprovadas no período
    const vendasFiltradas = vendas.filter(venda => {
        // Ignorar vendas com erro
        if (venda.erro) {
            return false;
        }
        
        const status = venda.pagamento?.status || venda.pagamento_status || venda.status;
        
        // Tentar diferentes campos de data possíveis (ordem de prioridade)
        const dataField = venda.created_at || 
            venda.createdAt || 
            venda.data_venda || 
            venda.pagamento?.data_processamento ||
            venda.data || 
            venda.date ||
            venda.timestamp ||
            venda.updated_at ||
            venda.updatedAt;
        
        // Validar se há campo de data válido (não undefined, null, ou string vazia)
        if (!dataField || dataField === 'undefined' || dataField === 'null' || (typeof dataField === 'string' && dataField.trim() === '')) {
            // Pular esta venda silenciosamente (sem log para não poluir console)
            return false;
        }
        
        // Tentar criar objeto Date
        const dataVenda = new Date(dataField);
        
        // Verificar se a data é válida (não é Invalid Date)
        if (isNaN(dataVenda.getTime()) || !(dataVenda instanceof Date)) {
            // Pular esta venda silenciosamente (sem log para não poluir console)
            return false;
        }
        
        // Aceitar diferentes status de aprovação
        const isAprovada = status && (
            status.toLowerCase() === "aprovado" || 
            status.toLowerCase() === "pago" ||
            status.toLowerCase() === "approved" ||
            status.toLowerCase() === "paid" ||
            status.toLowerCase() === "completed" ||
            status.toLowerCase() === "success"
        );
        
        // Se não está aprovada, não incluir
        if (!isAprovada) {
            return false;
        }
        
        // Verificar se está no período correto
        const isNoPeriodo = dataVenda >= inicioPeriodo && dataVenda <= fimPeriodo;
        
        return isNoPeriodo;
    });

    console.log(`✅ Vendas aprovadas no período: ${vendasFiltradas.length}`);

    // Agrupar vendas
    const agrupado = {};
    vendasFiltradas.forEach((venda, index) => {
        // Tentar diferentes campos de data possíveis (ordem de prioridade)
        const dataField = venda.created_at || 
            venda.createdAt || 
            venda.data_venda || 
            venda.pagamento?.data_processamento ||
            venda.data || 
            venda.date ||
            venda.timestamp ||
            venda.updated_at ||
            venda.updatedAt;
        
        // Se não há campo de data, pular esta venda
        if (!dataField) {
            return; // Pular esta venda silenciosamente
        }
        
        const data = new Date(dataField);
        
        // Verificar se a data é válida
        if (isNaN(data.getTime())) {
            return; // Pular esta venda silenciosamente
        }
        
        let chave;

        if (periodo === "hoje" || periodo === "ontem") {
            // Agrupar por intervalos de 2h
            const hora = data.getHours();
            const faixa = Math.floor(hora / 2) * 2;
            chave = `${faixa.toString().padStart(2, "0")}:00 - ${(faixa+2).toString().padStart(2,"0")}:00`;
        } else if (periodo === "7dias") {
            // Agrupar por dia
            chave = data.toISOString().split("T")[0];
        } else if (periodo === "30dias") {
            // Agrupar por dia
            chave = data.toISOString().split("T")[0];
        }

        if (!agrupado[chave]) agrupado[chave] = 0;

        // Extrair valor da venda com múltiplas tentativas
        const valor = Number(
            venda.pagamento?.valor || 
            venda.pagamento_valor || 
            venda.valor_final || 
            venda.valor || 
            venda.total || 
            venda.amount ||
            venda.price ||
            0
        );
        
        console.log('🔍 Valor extraído da venda:', valor);
        
        if (valor > 0) {
        agrupado[chave] += valor;
            console.log(`💰 Adicionado ${valor} à chave ${chave}. Total: ${agrupado[chave]}`);
        }
    });

    // Criar labels ordenados
    let labels = [];
    console.log(`🏷️ Criando labels para período: ${periodo}`);
    
    if (periodo === "hoje" || periodo === "ontem") {
        // Intervalos de 2h (00:00-02:00, 02:00-04:00, ..., 22:00-24:00)
        console.log('🕐 Criando labels de horários (intervalos de 2h)');
        for (let h = 0; h < 24; h += 2) {
            const faixa = `${h.toString().padStart(2, "0")}:00 - ${(h+2).toString().padStart(2,"0")}:00`;
            labels.push(faixa);
            console.log(`🕐 Label ${labels.length}: ${faixa}`);
        }
    } else if (periodo === "7dias") {
        // Últimos 7 dias
        console.log('📅 Criando labels de dias (últimos 7 dias)');
        for (let i = 6; i >= 0; i--) {
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
            const label = dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            labels.push(label);
            console.log(`📅 Label ${labels.length}: ${label} (${dataRef.toISOString().split("T")[0]})`);
        }
    } else if (periodo === "30dias") {
        // Últimos 30 dias - mostrar por dias
        console.log('📆 Criando labels de dias (últimos 30 dias)');
        for (let i = 29; i >= 0; i--) {
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
            const label = dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            labels.push(label);
            console.log(`📆 Label ${labels.length}: ${label} (${dataRef.toISOString().split("T")[0]})`);
        }
    }

    console.log(`🏷️ Total de labels criados: ${labels.length}`);
    console.log(`🏷️ Labels completos:`, labels);

    // Criar dataset correspondente aos labels
    console.log(`📊 Criando dataset correspondente aos labels...`);
    console.log(`📊 Dados agrupados disponíveis:`, Object.keys(agrupado));
    const dataset = labels.map((label, index) => {
        let valor = 0;
        
        if (periodo === "7dias") {
            // Para 7 dias, os labels são criados de 6 até 0 (mais antigo para mais recente)
            // Então index 0 = 6 dias atrás, index 6 = hoje
            const diasAtras = 6 - index; // 6, 5, 4, 3, 2, 1, 0
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras);
            const chave = dataRef.toISOString().split("T")[0];
            valor = agrupado[chave] || 0;
            console.log(`📊 Dataset[${index}] (${label}): diasAtras=${diasAtras}, chave="${chave}", valor=${valor}, agrupado tem chave? ${chave in agrupado}`);
        } else if (periodo === "30dias") {
            // Para 30 dias, os labels são criados de 29 até 0 (mais antigo para mais recente)
            // Então index 0 = 29 dias atrás, index 29 = hoje
            const diasAtras = 29 - index; // 29, 28, ..., 1, 0
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras);
            const chave = dataRef.toISOString().split("T")[0];
            valor = agrupado[chave] || 0;
            console.log(`📊 Dataset[${index}] (${label}): diasAtras=${diasAtras}, chave="${chave}", valor=${valor}, agrupado tem chave? ${chave in agrupado}`);
        } else {
            // Para hoje/ontem, usar a chave de horário diretamente
            valor = agrupado[label] || 0;
            console.log(`📊 Dataset[${index}] (${label}): valor=${valor}, agrupado tem chave? ${label in agrupado}`);
        }
        
        return valor;
    });
    
    console.log(`📊 Labels: ${labels.length}, Dataset: ${dataset.length}`);
    console.log(`📊 Dataset completo:`, dataset);
    console.log(`💰 Total receita: ${dataset.reduce((sum, val) => sum + val, 0)} MZN`);
    console.log(`📊 Dados agrupados:`, agrupado);
    
    // Verificar se há dados válidos
    const temDados = dataset.some(valor => valor > 0);
    console.log(`📊 Tem dados válidos: ${temDados}`);
    
    if (!temDados) {
        console.warn('⚠️ Nenhum dado válido encontrado para o período');
    }
    
    return { labels, dataset };
}

// Função para renderizar o gráfico
function renderizarGrafico(vendas, periodo = "hoje") {
    console.log(`🎨 Renderizando gráfico para período: ${periodo}`);
    console.log(`📊 Total de vendas recebidas: ${vendas.length}`);
    
    // Validar entrada
    if (!vendas || !Array.isArray(vendas)) {
        console.error('❌ Dados de vendas inválidos');
        return;
    }
    
    const { labels, dataset } = agruparVendasPorPeriodo(vendas, periodo);
    
    // Validar dados processados
    if (!labels || !dataset || labels.length === 0 || dataset.length === 0) {
        console.warn('⚠️ Dados insuficientes para renderizar gráfico');
        mostrarGraficoVazio('Nenhum dado disponível para o período selecionado');
        return;
    }
    
    console.log(`📈 Labels gerados: ${labels.length}`);
    console.log(`📈 Dataset gerado: ${dataset.length} valores`);
    console.log(`💰 Total no dataset: ${dataset.reduce((sum, val) => sum + val, 0)} MZN`);
    
    const ctx = document.getElementById("salesChart");
    if (!ctx) {
        console.error('❌ Canvas salesChart não encontrado!');
        return;
    }
    
    console.log('✅ Canvas encontrado, criando gráfico...');

    // Destruir gráfico existente
    if (typeof window.graficoVendas !== 'undefined' && window.graficoVendas) {
        window.graficoVendas.destroy();
        window.graficoVendas = null;
    }

    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não está carregado!');
        mostrarGraficoVazio('Chart.js não carregado');
        return;
    }
    
    // Criar novo gráfico com design melhorado
    try {
        // Calcular estatísticas para exibir no gráfico
        const totalReceita = dataset.reduce((sum, val) => sum + val, 0);
        const mediaReceita = dataset.length > 0 ? totalReceita / dataset.length : 0;
        const maxReceita = Math.max(...dataset, 0);
        const minReceita = Math.min(...dataset.filter(v => v > 0), 0) || 0;
        
        // Criar gradiente para o preenchimento
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(246, 76, 0, 0.25)');
        gradient.addColorStop(0.5, 'rgba(246, 76, 0, 0.15)');
        gradient.addColorStop(1, 'rgba(246, 76, 0, 0.05)');
        
        window.graficoVendas = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Receita (MZN)",
                data: dataset,
                borderColor: "#f64c00",
                backgroundColor: gradient,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 8,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#f64c00",
                pointHoverBackgroundColor: "#f64c00",
                pointHoverBorderColor: "#ffffff",
                pointHoverBorderWidth: 3,
                pointBorderWidth: 2,
                pointStyle: 'circle',
                // Animação suave
                animation: {
                    duration: 1500,
                    easing: 'easeInOutQuart'
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: "#333333",
                        font: {
                            size: 14,
                            weight: '600',
                            family: "'Poppins', sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        boxWidth: 12,
                        boxHeight: 12
                    }
                },
                title: {
                    display: false // Removido para dar mais espaço
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#f64c00',
                    borderWidth: 2,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    titleFont: {
                        size: 14,
                        weight: '600',
                        family: "'Poppins', sans-serif"
                    },
                    bodyFont: {
                        size: 13,
                        weight: '500',
                        family: "'Poppins', sans-serif"
                    },
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const value = context.parsed.y;
                            const percentual = totalReceita > 0 ? ((value / totalReceita) * 100).toFixed(1) : 0;
                            return [
                                `Receita: ${formatCurrency(value)}`,
                                `Percentual: ${percentual}% do total`
                            ];
                        },
                        footer: function(tooltipItems) {
                            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                            return `Total do período: ${formatCurrency(totalReceita)}`;
                        }
                    }
                }
            },
            scales: {
                x: { 
                    title: { 
                        display: true, 
                        text: periodo === "hoje" || periodo === "ontem" ? "Horários do Dia" : periodo === "7dias" ? "Últimos 7 Dias" : "Últimos 30 Dias",
                        color: "#666666",
                        font: {
                            size: 12,
                            weight: '600',
                            family: "'Poppins', sans-serif"
                        },
                        padding: {
                            top: 10,
                            bottom: 5
                        }
                    },
                    grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                        drawBorder: false,
                        drawOnChartArea: true,
                        drawTicks: true
                    },
                    ticks: {
                        color: "#666666",
                        font: {
                            size: 11,
                            family: "'Poppins', sans-serif"
                        },
                        maxRotation: 45,
                        minRotation: 0,
                        padding: 8
                    }
                },
                y: { 
                    title: { 
                        display: true, 
                        text: "Valor em MZN",
                        color: "#666666",
                        font: {
                            size: 12,
                            weight: '600',
                            family: "'Poppins', sans-serif"
                        },
                        padding: {
                            left: 10,
                            right: 5
                        }
                    }, 
                    beginAtZero: true,
                    grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                        drawBorder: false,
                        drawOnChartArea: true,
                        drawTicks: true
                    },
                    ticks: {
                        color: "#666666",
                        font: {
                            size: 11,
                            family: "'Poppins', sans-serif"
                        },
                        padding: 8,
                        callback: function(value) {
                            // Formatação melhorada para o eixo Y
                            if (value >= 1000000) {
                                return `${(value / 1000000).toFixed(1)}M`;
                            } else if (value >= 1000) {
                                return `${(value / 1000).toFixed(1)}K`;
                            } else {
                                return value.toFixed(0);
                            }
                        }
                    }
                }
            },
            elements: {
                point: {
                    hoverRadius: 8,
                    radius: 5,
                    hoverBorderWidth: 3
                },
                line: {
                    tension: 0.4,
                    borderCapStyle: 'round',
                    borderJoinStyle: 'round'
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeInOutQuart'
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10,
                    bottom: 10
                }
            }
        }
        });
        
        // Atualizar informações adicionais abaixo do gráfico
        atualizarInfoGrafico(totalReceita, mediaReceita, maxReceita, minReceita, periodo);
        
        console.log('✅ Gráfico renderizado com sucesso!');
        console.log(`📊 Estatísticas: Total=${formatCurrency(totalReceita)}, Média=${formatCurrency(mediaReceita)}, Max=${formatCurrency(maxReceita)}, Min=${formatCurrency(minReceita)}`);
        
    } catch (error) {
        console.error('❌ Erro ao criar gráfico:', error);
        mostrarGraficoVazio('Erro ao carregar gráfico');
    }
}

// Função para atualizar informações adicionais do gráfico
function atualizarInfoGrafico(total, media, max, min, periodo) {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (!lastUpdateEl) return;
    
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const dataFormatada = agora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    
    const infoHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: #999; margin-bottom: 4px;">Total do Período</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #f64c00;">${formatCurrency(total)}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: #999; margin-bottom: 4px;">Média</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #666;">${formatCurrency(media)}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 0.75rem; color: #999; margin-bottom: 4px;">Maior Valor</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #28a745;">${formatCurrency(max)}</div>
                </div>
            </div>
            <div style="font-size: 0.8rem; color: #999;">
                <i class="fas fa-clock"></i> Atualizado: ${dataFormatada} às ${horaFormatada}
            </div>
        </div>
    `;
    
    lastUpdateEl.innerHTML = infoHTML;
}

// Função para mostrar mensagem quando o gráfico está vazio
function mostrarGraficoVazio(mensagem = 'Nenhum dado disponível') {
    const ctx = document.getElementById("salesChart");
    if (!ctx) return;
    
    ctx.style.display = 'flex';
    ctx.style.alignItems = 'center';
    ctx.style.justifyContent = 'center';
    ctx.style.height = '200px';
    ctx.style.color = '#666';
    ctx.style.fontSize = '14px';
    ctx.style.textAlign = 'center';
    ctx.innerHTML = `<div><i class="fas fa-chart-line" style="font-size: 24px; margin-bottom: 8px; opacity: 0.5;"></i><br>${mensagem}</div>`;
}

// Função para forçar renderização do gráfico
function forcarRenderizacaoGrafico() {
    console.log('🔄 Forçando renderização do gráfico...');
    
    const ctx = document.getElementById("salesChart");
    if (!ctx) {
        console.error('❌ Canvas salesChart não encontrado!');
        return;
    }
    
    // Limpar canvas
    ctx.innerHTML = '';
    ctx.style.display = 'block';
    
    // Verificar se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não está carregado!');
        mostrarGraficoVazio('Chart.js não carregado');
        return;
    }
    
    // Destruir gráfico existente
    if (typeof window.graficoVendas !== 'undefined' && window.graficoVendas) {
        window.graficoVendas.destroy();
        window.graficoVendas = null;
    }
    
    // Tentar usar dados reais primeiro
    if (todasVendasOriginais && todasVendasOriginais.length > 0) {
        console.log('📊 Tentando renderizar com dados reais...');
        renderizarGrafico(todasVendasOriginais, currentPeriod);
        return;
    }
    
    // Fallback: mostrar gráfico vazio
    console.log('📊 Nenhum dado disponível, mostrando gráfico vazio...');
    mostrarGraficoVazio('Nenhum dado disponível');
}


// Função para formatar valor como inteiro
function formatInteger(value) {
    return Math.round(value).toLocaleString('pt-MZ');
}

// Função para testar rótulos e dados do gráfico
function testarRotulosGrafico() {
    console.log('🧪 ===== TESTE DE RÓTULOS DO GRÁFICO =====');
    
    // Testar com dados de exemplo
    console.log('🧪 Testando com dados de exemplo...');
    
    // Simular vendas de exemplo
    const vendasExemplo = [
        {
            id: 1,
            created_at: new Date().toISOString(),
            status: 'aprovado',
            valor: 100,
            pagamento: { valor: 100, status: 'aprovado' }
        },
        {
            id: 2,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h atrás
            status: 'aprovado',
            valor: 150,
            pagamento: { valor: 150, status: 'aprovado' }
        }
    ];
    
    console.log('🧪 Vendas de exemplo:', vendasExemplo);
    
    // Testar agrupamento para cada período
    const periodos = ['hoje', 'ontem', '7dias', '30dias'];
    
    periodos.forEach(periodo => {
        console.log(`🧪 Testando período: ${periodo}`);
        const resultado = agruparVendasPorPeriodo(vendasExemplo, periodo);
        console.log(`🧪 Resultado para ${periodo}:`, resultado);
        
        // Verificar se labels e dataset têm o mesmo tamanho
        if (resultado.labels.length !== resultado.dataset.length) {
            console.error(`❌ ERRO: Labels (${resultado.labels.length}) e Dataset (${resultado.dataset.length}) têm tamanhos diferentes!`);
        } else {
            console.log(`✅ Labels e Dataset têm o mesmo tamanho: ${resultado.labels.length}`);
        }
        
        // Verificar se há dados válidos
        const temDados = resultado.dataset.some(valor => valor > 0);
        console.log(`🧪 Tem dados válidos para ${periodo}: ${temDados}`);
        
        // Mostrar mapeamento label -> valor
        console.log(`🧪 Mapeamento para ${periodo}:`);
        resultado.labels.forEach((label, index) => {
            console.log(`  ${label} -> ${resultado.dataset[index]} MZN`);
        });
        
        console.log('---');
    });
    
    console.log('🧪 ===== FIM DO TESTE =====');
}

// Função para testar renderização do gráfico
function testarRenderizacaoGrafico() {
    console.log('🎨 ===== TESTE DE RENDERIZAÇÃO DO GRÁFICO =====');
    
    // Verificar se o canvas existe
    const ctx = document.getElementById("salesChart");
    if (!ctx) {
        console.error('❌ Canvas salesChart não encontrado!');
        return;
    }
    console.log('✅ Canvas salesChart encontrado');
    
    // Verificar se Chart.js está carregado
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não está carregado!');
        return;
    }
    console.log('✅ Chart.js está carregado');
    
    // Verificar dados atuais
    console.log('📊 Dados atuais:');
    console.log('  - todasVendasOriginais:', todasVendasOriginais?.length || 0);
    console.log('  - currentPeriod:', currentPeriod);
    console.log('  - graficoVendas existe:', typeof window.graficoVendas !== 'undefined');
    
    // Forçar renderização
    console.log('🔄 Forçando renderização...');
    forcarRenderizacaoGrafico();
    
    console.log('🎨 ===== FIM DO TESTE DE RENDERIZAÇÃO =====');
}

// Função para atualizar a receita total no card
function atualizarReceitaTotal(dataset) {
    const receitaTotal = dataset.reduce((sum, valor) => sum + valor, 0);
    const receitaElement = document.getElementById('receitaTotal');
    
    if (receitaElement) {
        receitaElement.textContent = `MZN ${formatInteger(receitaTotal)}`;
        console.log(`💰 Receita total atualizada: MZN ${formatInteger(receitaTotal)}`);
    }
}

// Função para obter label do período
function getPeriodLabel(periodo) {
    switch (periodo) {
        case "hoje": return "Hoje";
        case "ontem": return "Ontem";
        case "7dias": return "Últimos 7 Dias";
        case "30dias": return "Últimos 30 Dias";
        default: return "Período";
    }
}

// Função para controlar o perfil expandido/contraído
function setupProfileToggle() {
    const profileSection = document.getElementById('profileSection');
    
    if (profileSection) {
        // Clique na seção do perfil
        profileSection.addEventListener('click', function(e) {
            e.stopPropagation();
            
            const isShowed = profileSection.classList.contains('showed');
            
            if (isShowed) {
                // Fechar perfil
                profileSection.classList.remove('showed');
            } else {
                // Abrir perfil
                profileSection.classList.add('showed');
            }
        });
        
        // Fechar perfil com tecla ESC
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && profileSection.classList.contains('showed')) {
                profileSection.classList.remove('showed');
            }
        });
    }
}

// Função para configurar notificações
function setupNotifications() {
    try {
        // Aguardar o sistema de notificações estar pronto
        if (window.notificationManager) {
            // Configurar dados do usuário quando disponíveis
            setTimeout(async () => {
                try {
                    const userData = await apiRequest('/auth/me');
                    if (userData.success && userData.user) {
                        const user = userData.user;
                        const userId = user.id || user.vendedor_id;
                        const userType = user.role === 'user' ? 'vendedor' : 'admin';
                        
                        window.notificationManager.setUserData(userId, userType);
                        console.log('🔔 Notificações configuradas para:', { userId, userType });
                    }
                } catch (error) {
                    console.error('❌ Erro ao configurar notificações:', error);
                }
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Erro ao configurar notificações:', error);
    }
}

// Função SIMPLES para carregar dados do gráfico de vendas
























// Função para mostrar spinner nas métricas
function mostrarSpinnerMetricas() {
    const metricas = [
        { id: 'receitaTotal', spinnerClass: 'info-spinner' },
        { id: 'vendasAprovadas', spinnerClass: 'success-spinner' },
        { id: 'vendasCanceladas', spinnerClass: 'danger-spinner' },
        { id: 'vendasPendentes', spinnerClass: 'warning-spinner' }
    ];
    
    metricas.forEach(metrica => {
        const elemento = document.getElementById(metrica.id);
        if (elemento) {
            elemento.classList.add('loading');
            elemento.innerHTML = `<div class="loading-spinner ${metrica.spinnerClass}"></div>`;
        }
    });
}

// Função para configurar filtros de período
function setupPeriodFilters() {
    // Configurar filtros do gráfico
    const chartPeriodButtons = document.querySelectorAll('.period-btn');
    
    console.log(`🔧 Configurando ${chartPeriodButtons.length} botões de filtro`);
    
    chartPeriodButtons.forEach(button => {
        button.addEventListener('click', async () => {
            console.log(`🔄 Mudando período de ${currentPeriod} para ${button.dataset.period}`);
            
            // Mostrar spinner nas métricas
            mostrarSpinnerMetricas();
            
            // Remover classe active de todos os botões
            chartPeriodButtons.forEach(btn => btn.classList.remove('active'));
            
            // Adicionar classe active ao botão clicado
            button.classList.add('active');
            
            // Atualizar período atual
            currentPeriod = button.dataset.period;
            
            // Recarregar dados com o novo período
            console.log(`📊 Recarregando estatísticas para período: ${currentPeriod}`);
            await carregarEstatisticas();
            
            // Atualizar gráfico se houver vendas carregadas
            if (todasVendasOriginais.length > 0) {
                console.log(`📈 Atualizando gráfico para período: ${currentPeriod}`);
                renderizarGrafico(todasVendasOriginais, currentPeriod);
            }
            
            console.log(`✅ Período alterado com sucesso para: ${currentPeriod}`);
            
            // Mostrar notificação de atualização
            showNotification(`Filtro alterado para: ${getPeriodLabel(currentPeriod)}`, 'info');
        });
    });
}

// Função para obter label do período
function getPeriodLabel(period) {
    switch (period) {
        case 'hoje':
            return 'Hoje';
        case 'ontem':
            return 'Ontem';
        case '7dias':
            return 'Últimos 7 dias';
        case '30dias':
            return 'Últimos 30 dias';
        default:
            return 'Período';
    }
}

// Função para configurar botão de logout
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                // Limpar dados de autenticação
                localStorage.removeItem('authToken');
                localStorage.removeItem('token');
                localStorage.removeItem('adminToken');
                
                // Redirecionar para login
                window.location.href = 'login.html';
                
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
                // Forçar redirecionamento mesmo com erro
                window.location.href = 'login.html';
            }
        });
    }
}

// Função para atualizar dados em tempo real (opcional)
function startRealTimeUpdates() {
    // Atualizar dados a cada 5 minutos
    setInterval(async () => {
        try {
            await carregarEstatisticas();
        } catch (error) {
            console.error('Erro na atualização em tempo real:', error);
        }
    }, 5 * 60 * 1000);
}

// Event listener para quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, inicializando dashboard...');
    
    // Verificar se Chart.js está carregado
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js não está carregado. Aguardando...');
        // Tentar novamente após um delay
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                console.log('✅ Chart.js carregado, inicializando dashboard...');
                initializeDashboard();
                setupAutoUpdate();
            } else {
                console.error('❌ Chart.js ainda não está disponível');
            }
        }, 1000);
    } else {
        console.log('✅ Chart.js já está carregado');
        initializeDashboard();
        setupAutoUpdate();
    }
});

// Função para atualizar dados manualmente
async function atualizarDados() {
    try {
        showNotification('Atualizando dados...', 'info');
        await carregarEstatisticas();
        
        // Recarregar gráfico se houver vendas carregadas
        if (todasVendasOriginais.length > 0) {
            renderizarGrafico(todasVendasOriginais, currentPeriod);
        }
        
        showNotification('Dados atualizados com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
        showNotification('Erro ao atualizar dados', 'error');
    }
}


// Função para exportar dados de receita em CSV
async function exportarDadosReceita() {
    try {
        const params = new URLSearchParams({
            periodo: currentPeriod,
            formato: 'csv'
        });
        
        const response = await apiRequest(`/dashboard/vendedor/exportar-receita?${params.toString()}`);
        
        if (response.success && response.data) {
            const csvContent = response.data;
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `receita-${currentPeriod}-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('Dados de receita exportados com sucesso!', 'success');
        }
    } catch (error) {
        console.error('Erro ao exportar dados de receita:', error);
        showNotification('Erro ao exportar dados de receita', 'error');
    }
}

// Funções de compatibilidade (mantidas para não quebrar código existente)
async function carregarGraficoVendasSemanais() {
    console.log('⚠️ Função carregarGraficoVendasSemanais obsoleta, usando carregarGraficoVendas');
    await carregarGraficoVendas();
}

// Função de compatibilidade para código existente
async function carregarGraficoVendasLegacy() {
    console.log('⚠️ Função carregarGraficoVendasLegacy obsoleta, usando nova implementação');
    await carregarGraficoVendas();
}

function drawWeeklySalesChart(salesData) {
    console.log('⚠️ Função drawWeeklySalesChart obsoleta, usando Chart.js');
    // Esta função não é mais necessária com Chart.js
}

function drawSalesChart(salesData) {
    console.log('⚠️ Função drawSalesChart obsoleta, usando Chart.js');
    // Esta função não é mais necessária com Chart.js
}

// Função para navegação no menu lateral aprimorada
function setupNavigation() {
    const menuItems = document.querySelectorAll('.sidebar ul li a');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Permitir navegação normal para links com href válidos
            if (this.getAttribute('href') && 
                this.getAttribute('href') !== '#' && 
                !this.getAttribute('href').startsWith('javascript:')) {
                return;
            }
            
            e.preventDefault();
            
            // Atualizar estado ativo
            menuItems.forEach(menuItem => {
                menuItem.classList.remove('active');
            });
            this.classList.add('active');
            
            const section = this.getAttribute('data-section');
            handleNavigation(section);
        });
    });
}

// Função para lidar com navegação
function handleNavigation(section) {
    switch(section) {
        case 'painel':
            // Já estamos no painel
            break;
        case 'produtos':
            window.location.href = '/gestao-produtos.html';
            break;
        case 'vendas':
            window.location.href = '/gestao-vendas.html';
            break;
        case 'ferramentas':
            window.location.href = '/ferramentas.html';
            break;
        default:
            console.log('Seção não implementada:', section);
    }
}

// Função para atualização automática em tempo real
function setupAutoUpdate() {
    let updateInterval;
    
    const startAutoUpdate = () => {
        updateInterval = setInterval(async () => {
            try {
                console.log('🔄 Atualização automática em tempo real...');
                await carregarEstatisticas();
                
                // Recarregar gráfico se houver vendas carregadas
                if (todasVendasOriginais.length > 0) {
                    renderizarGrafico(todasVendasOriginais, currentPeriod);
                }
                console.log('📊 Dados atualizados automaticamente em tempo real');
            } catch (error) {
                console.error('❌ Erro na atualização automática:', error);
            }
        }, 60 * 1000); // A cada 60 segundos para dados em tempo real
    };
    
    const stopAutoUpdate = () => {
        if (updateInterval) {
            clearInterval(updateInterval);
            console.log('⏹️ Atualização automática pausada');
        }
    };
    
    // Parar atualização quando a aba não estiver visível
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoUpdate();
        } else {
            startAutoUpdate();
        }
    });
    
    startAutoUpdate();
    console.log('🔄 Atualização automática em tempo real iniciada (60s)');
}

// Função para mostrar loading com skeleton
function showLoading() {
    const loadingElements = document.querySelectorAll('[data-loading]');
    loadingElements.forEach(element => {
        element.classList.add('skeleton-loading');
    });
}

// Função para esconder loading
function hideLoading() {
    const loadingElements = document.querySelectorAll('[data-loading]');
    loadingElements.forEach(element => {
        element.classList.remove('skeleton-loading');
    });
}


// Função para verificar saúde do sistema (já declarada acima)

// Função para carregar informações do usuário
async function carregarInformacoesUsuario() {
    try {
        console.log('🔍 Verificando sessão do usuário...');
        
        const response = await fetch(`${window.API_BASE}/auth/verificar`, {
            credentials: 'include'
        });

        console.log('📡 Resposta da verificação:', response.status);

        if (response.ok) {
            const data = await response.json();
            const usuario = data.user;
            
            // Atualizar informações do usuário
            document.getElementById('welcomeMessage').textContent = `Seja bem-vindo, ${usuario.nome}`;
            document.getElementById('userName').textContent = usuario.nome;
            document.getElementById('userRole').textContent = usuario.tipo === 'admin' ? 'ADMINISTRADOR' : 'Vendedor';
            document.getElementById('userEmail').textContent = usuario.email;
            
            // Mostrar avatar com inicial do nome
            const avatarElement = document.getElementById('userAvatar');
            const initial = usuario.nome.charAt(0).toUpperCase();
            avatarElement.innerHTML = `<div style="width: 40px; height: 40px; border-radius: 50%; background: #3b82f6; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px;">${initial}</div>`;
            
            console.log('✅ Informações do usuário carregadas:', usuario);
            
            // Adicionar evento de logout
            document.getElementById('logoutBtn').addEventListener('click', function() {
                if (confirm('Tem certeza que deseja sair?')) {
                    logout();
                }
            });
        } else {
            console.error('❌ Erro ao verificar sessão:', response.status);
            showNotification('Sessão expirada. Faça login novamente.', 'warning');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar informações do usuário:', error);
        showNotification('Erro ao carregar informações do usuário', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
    }
}

// Função para fazer logout
async function logout() {
    try {
        const response = await fetch(`${window.API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            window.location.href = '/index.html';
        } else {
            console.error('Erro ao fazer logout');
            window.location.href = '/index.html';
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/index.html';
    }
}



// Função para verificar saúde do sistema
async function checkSystemHealth() {
    try {
        const response = await fetch(`${window.API_BASE}/health`);
        return response.ok;
    } catch (error) {
        console.warn('⚠️ Sistema de saúde não disponível:', error);
        return true; // Continuar mesmo sem verificação de saúde
    }
}

// Função para mostrar/ocultar loading
function showLoading() {
    // Implementar se necessário
}

function hideLoading() {
    // Implementar se necessário
}

// Adicionar estilos para notificações, loading e tabela
const styles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease;
    }
    
    .notification-success { background: #10b981; }
    .notification-error { background: #ef4444; }
    .notification-warning { background: #f59e0b; }
    .notification-info { background: #E67E22; }
    
    .notification button {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .skeleton-loading {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
    }
    
    .chart-loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        border-radius: 8px;
    }
    
    .loading-spinner {
        text-align: center;
        color: #E67E22;
    }
    
    .loading-spinner i {
        font-size: 24px;
        margin-bottom: 8px;
    }
    
    .loading-spinner p {
        margin: 0;
        font-size: 14px;
        font-weight: 500;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
    }
`;

// Adicionar estilos ao documento
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// ===== SISTEMA DE NÍVEIS DE VENDAS =====

// Configuração dos níveis
const SALES_LEVELS = {
    0: { name: 'Sem placa', icon: '⚪', threshold: 0, color: 'default' },
    1: { name: 'Bronze', icon: '🥉', threshold: 25000, color: 'bronze' },      // 25K
    2: { name: 'Prata', icon: '🥈', threshold: 50000, color: 'silver' },      // 50K
    3: { name: 'Ouro', icon: '🥇', threshold: 100000, color: 'gold' },         // 100K
    4: { name: 'Diamante', icon: '💎', threshold: 500000, color: 'diamond' }, // 500K
    5: { name: 'Platina', icon: '💠', threshold: 1000000, color: 'platinum' }  // 1000K
};

// Variável para armazenar o nível anterior (para detectar subidas)
let previousLevel = 0;

// Cache para evitar múltiplas chamadas desnecessárias
let lastReceitaValue = null;
let lastReceitaTimestamp = 0;
const CACHE_DURATION = 5000; // 5 segundos de cache

// Função para calcular o nível baseado na receita
function calculateSalesLevel(revenue) {
    console.log(`🔢 Calculando nível para receita: ${revenue} MZN`);
    
    let currentLevel = 0;
    let nextLevel = 1;
    
    // Encontrar o nível atual - só avança se atingir o threshold exato
    for (let level = 5; level >= 1; level--) {
        if (revenue >= SALES_LEVELS[level].threshold) {
            currentLevel = level;
            break;
        }
    }
    
    // Se receita for 0, manter nível 0 (sem placa)
    if (revenue === 0) {
        currentLevel = 0;
    }
    
    // Encontrar o próximo nível
    if (currentLevel < 5) {
        nextLevel = currentLevel + 1;
    } else {
        nextLevel = currentLevel; // Já no nível máximo
    }
    
    console.log(`📊 Nível atual: ${currentLevel} (${SALES_LEVELS[currentLevel].name}), Próximo: ${nextLevel} (${SALES_LEVELS[nextLevel].name})`);
    
    return {
        current: currentLevel,
        next: nextLevel,
        currentData: SALES_LEVELS[currentLevel],
        nextData: SALES_LEVELS[nextLevel]
    };
}

// Função para calcular o progresso para o próximo nível
function calculateProgress(revenue, currentLevel, nextLevel) {
    if (currentLevel >= 5) {
        return 100; // Já no nível máximo
    }
    
    const currentThreshold = SALES_LEVELS[currentLevel].threshold;
    const nextThreshold = SALES_LEVELS[nextLevel].threshold;
    
    const progress = ((revenue - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
}

// Função para animar o percentual com contagem
function animatePercentage(element, targetPercentage) {
    const startPercentage = parseInt(element.textContent) || 0;
    const duration = 1000; // 1 segundo
    const startTime = performance.now();
    
    function updatePercentage(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Usar easing para animação suave
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentPercentage = Math.round(startPercentage + (targetPercentage - startPercentage) * easeOutCubic);
        
        element.textContent = `${currentPercentage}%`;
        
        if (progress < 1) {
            requestAnimationFrame(updatePercentage);
        }
    }
    
    requestAnimationFrame(updatePercentage);
}

// Função para atualizar a interface do sistema de níveis
function updateSalesLevelSystem(revenue) {
    console.log(`🎯 Atualizando sistema de níveis para receita: ${revenue} MZN`);
    
    const levelData = calculateSalesLevel(revenue);
    const progress = calculateProgress(revenue, levelData.current, levelData.next);
    
    // Atualizar elementos da interface
    const badgeIcon = document.getElementById('badgeIcon');
    const badgeName = document.getElementById('badgeName');
    const currentRevenue = document.getElementById('currentRevenue');
    const nextThreshold = document.getElementById('nextThreshold');
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const salesLevelSystem = document.getElementById('salesLevelSystem');
    
    if (badgeIcon && badgeName) {
        badgeIcon.textContent = levelData.currentData.icon;
        badgeName.textContent = levelData.currentData.name;
    }
    
    if (currentRevenue) {
        currentRevenue.textContent = formatCurrencyWithSeparators(revenue);
    }
    
    if (nextThreshold) {
        if (levelData.current >= 5) {
            nextThreshold.textContent = '🏆 Nível máximo!';
        } else {
            nextThreshold.textContent = formatCurrencyWithSeparators(levelData.nextData.threshold);
        }
    }
    
    if (progressFill) {
        // Adicionar animação de pulso quando a barra aumenta
        progressFill.classList.add('animating');
        
        // Atualizar largura com transição suave
        setTimeout(() => {
            progressFill.style.width = `${progress}%`;
        }, 50);
        
        // Remover classe de animação após a transição
        setTimeout(() => {
            progressFill.classList.remove('animating');
        }, 1200);
    }
    
    if (progressPercentage) {
        // Animar o percentual com contagem
        animatePercentage(progressPercentage, Math.round(progress));
    }
    
    // Aplicar classe de cor baseada no nível
    if (salesLevelSystem) {
        // Remover classes de cor anteriores
        salesLevelSystem.classList.remove('badge-default', 'badge-bronze', 'badge-silver', 'badge-gold', 'badge-diamond');
        
        // Adicionar classe de cor atual
        salesLevelSystem.classList.add(`badge-${levelData.currentData.color}`);
    }
    
    // Verificar se subiu de nível
    if (previousLevel !== levelData.current && previousLevel > 0) {
        showLevelUpNotification(levelData.currentData);
    }
    
    // Atualizar nível anterior
    previousLevel = levelData.current;
    
    console.log(`✅ Sistema de níveis atualizado: ${levelData.currentData.name} (${Math.round(progress)}%)`);
}

// Função para mostrar notificação de subida de nível
function showLevelUpNotification(levelData) {
    console.log(`🎉 Usuário subiu para o nível: ${levelData.name}`);
    
    const message = `🎉 Parabéns! Você alcançou a Placa de ${levelData.name}! ${levelData.icon}`;
    
    // Criar notificação especial
    const notification = document.createElement('div');
    notification.className = 'notification level-up-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="level-up-icon">${levelData.icon}</span>
            <div class="level-up-text">
                <div class="level-up-title">Parabéns!</div>
                <div class="level-up-message">Você alcançou a Placa de ${levelData.name}!</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Adicionar estilos específicos para notificação de nível
    if (!document.querySelector('#level-up-styles')) {
        const styles = document.createElement('style');
        styles.id = 'level-up-styles';
        styles.textContent = `
            .level-up-notification {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                border: 2px solid #FF8C00;
                box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
                animation: levelUpBounce 0.6s ease;
            }
            
            .level-up-icon {
                font-size: 2rem;
                margin-right: 15px;
                animation: levelUpPulse 1s infinite;
            }
            
            .level-up-text {
                flex: 1;
            }
            
            .level-up-title {
                font-size: 1.1rem;
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .level-up-message {
                font-size: 0.9rem;
                opacity: 0.9;
            }
            
            @keyframes levelUpBounce {
                0% { transform: scale(0.3) translateY(-50px); opacity: 0; }
                50% { transform: scale(1.05) translateY(0); opacity: 1; }
                100% { transform: scale(1) translateY(0); opacity: 1; }
            }
            
            @keyframes levelUpPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 8 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 8000);
    
    // Mostrar notificação padrão também
    showNotification(message, 'success');
}

// Função para inicializar o sistema de níveis
async function initializeSalesLevelSystem() {
    console.log('🚀 Inicializando sistema de níveis de vendas...');
    
    // Tentar apenas 2 vezes com intervalos menores
    const attempts = [
        { delay: 2000, description: 'Primeira tentativa (2s)' },
        { delay: 5000, description: 'Segunda tentativa (5s)' }
    ];
    
    attempts.forEach((attempt, index) => {
        setTimeout(async () => {
            console.log(`🔄 ${attempt.description}...`);
            
            try {
                // Forçar atualização na inicialização
                await updateSalesLevelFromRevenue(true);
            } catch (error) {
                console.error(`❌ Erro na ${attempt.description}:`, error);
                if (index === attempts.length - 1) {
                    updateSalesLevelSystem(0);
                }
            }
        }, attempt.delay);
    });
}

// Função para obter receita total do vendedor
async function getVendedorReceitaTotal() {
    try {
        console.log('💰 Buscando receita total do vendedor...');
        
        const response = await apiRequest('/dashboard/vendedor/resumo');
        console.log('📊 Resposta da API:', response);
        
        if (response.success && response.data) {
            const data = response.data;
            console.log('📊 Dados recebidos:', data);
            
            // Tentar diferentes campos de receita total
            const receitaTotal = data.receitaTotal || 
                                data.receitaTotalVendedor || 
                                data.receita || 
                                data.receitaGeral ||
                                data.totalReceita ||
                                0;
            
            console.log(`💰 Receita total encontrada: ${receitaTotal} MZN`);
            console.log(`💰 Campos testados: receitaTotal=${data.receitaTotal}, receitaTotalVendedor=${data.receitaTotalVendedor}, receita=${data.receita}`);
            
            return receitaTotal;
        } else {
            console.warn('⚠️ Resposta da API não contém dados válidos:', response);
            return 0;
        }
    } catch (error) {
        console.error('❌ Erro ao obter receita total do vendedor:', error);
        return 0;
    }
}

// Função para obter receita total absoluta (nunca filtrada)
function getReceitaTotalAbsoluta() {
    const receitaElement = document.getElementById('receitaTotal');
    if (receitaElement) {
        const receitaText = receitaElement.textContent;
        console.log('📊 Texto do elemento receitaTotal (receita total absoluta):', receitaText);
        
        // Extrair valor numérico da string formatada
        const receitaValue = parseFloat(receitaText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        console.log(`💰 Receita total absoluta extraída: ${receitaValue} MZN`);
        return receitaValue;
    }
    console.log('⚠️ Elemento receitaTotal não encontrado');
    return 0;
}

// Função para atualizar o sistema de níveis quando a receita mudar
async function updateSalesLevelFromRevenue(forceUpdate = false) {
    const now = Date.now();
    
    // Verificar cache se não for atualização forçada
    if (!forceUpdate && lastReceitaValue !== null && (now - lastReceitaTimestamp) < CACHE_DURATION) {
        console.log(`📋 Usando receita total do cache: ${lastReceitaValue} MZN`);
        updateSalesLevelSystem(lastReceitaValue);
        return;
    }
    
    console.log('🔄 Atualizando sistema de níveis...');
    
    // PRIMEIRO: Tentar obter da API (dados mais confiáveis)
    let receitaTotal = await getVendedorReceitaTotal();
    
    // SEGUNDO: Se API falhou, tentar do elemento da página
    if (receitaTotal === 0) {
        console.log('⚠️ API retornou 0, tentando obter do elemento da página...');
        receitaTotal = getReceitaTotalAbsoluta();
    }
    
    // Atualizar cache
    if (receitaTotal > 0) {
        lastReceitaValue = receitaTotal;
        lastReceitaTimestamp = now;
    }
    
    console.log(`💰 Receita total para sistema de níveis: ${receitaTotal} MZN`);
    updateSalesLevelSystem(receitaTotal);
}

// Modificar a função atualizarMetricasReceita para usar receita total da API
const originalAtualizarMetricasReceita = atualizarMetricasReceita;
atualizarMetricasReceita = function(data) {
    // Chamar função original
    originalAtualizarMetricasReceita(data);
    
    // Atualizar sistema de níveis com receita total da API (sem cálculos)
    if (data && data.receitaTotal !== undefined) {
        console.log(`📊 Dados de receita recebidos: receitaTotal=${data.receitaTotal} MZN`);
        console.log('🎯 Usando receita total da API para sistema de níveis (sem cálculos)');
        updateSalesLevelSystem(data.receitaTotal);
        
        // Atualizar cache com a receita total da API
        lastReceitaValue = data.receitaTotal;
        lastReceitaTimestamp = Date.now();
    } else {
        console.log('📊 Métricas atualizadas - aguardando dados de receita da API');
    }
};

// Inicializar sistema de níveis quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, iniciando sistema de níveis...');
    
    // Aguardar um pouco para garantir que tudo foi carregado
    setTimeout(() => {
        initializeSalesLevelSystem();
    }, 2000);
});

// Função principal de inicialização do dashboard
async function inicializarDashboard() {
    try {
        console.log('🚀 Inicializando dashboard...');
        
        // Definir período padrão como 'hoje'
        currentPeriod = 'hoje';
        currentPage = 'dashboard';
        
        // Carregar dados do usuário
        await carregarDadosUsuario();
        
        // Carregar estatísticas
        await carregarEstatisticas();
        
        // Carregar vendas para o gráfico
        await carregarVendas();
        
        // Configurar event listeners para mudança de período
        configurarEventListenersPeriodo();
        
        console.log('✅ Dashboard inicializado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
    }
}

// Configurar event listeners para mudança de período
function configurarEventListenersPeriodo() {
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const periodo = this.dataset.period;
            if (periodo && periodo !== currentPeriod) {
                console.log(`🔄 Mudando período de ${currentPeriod} para ${periodo}`);
                currentPeriod = periodo;
                
                // Atualizar botões ativos
                periodButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                // Recarregar dados
                await carregarEstatisticas();
                await carregarVendas();
            }
        });
    });
}

// Adicionar listener para quando a página estiver totalmente carregada
window.addEventListener('load', function() {
    console.log('🚀 Página totalmente carregada, forçando atualização do sistema de níveis...');
    
    // Aguardar um pouco mais e forçar atualização
    setTimeout(() => {
        updateSalesLevelFromRevenue();
    }, 1000);
});

// Adicionar listener para mudanças no elemento de receita total absoluta (com debounce)
let updateTimeout = null;
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
            if (mutation.target.id === 'receitaTotal' || 
                (mutation.target.parentElement && mutation.target.parentElement.id === 'receitaTotal')) {
                
                // Debounce para evitar muitas atualizações
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                }
                
                updateTimeout = setTimeout(() => {
                    console.log('🔄 Receita total absoluta mudou, atualizando sistema de níveis...');
                    updateSalesLevelFromRevenue();
                }, 1000); // Aguardar 1 segundo antes de atualizar
            }
        }
    });
});

// Iniciar observação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    const receitaElement = document.getElementById('receitaTotal');
    if (receitaElement) {
        observer.observe(receitaElement, {
            childList: true,
            characterData: true,
            subtree: true
        });
        console.log('👀 Observador iniciado para elemento receitaTotal');
    }
    
    // Inicializar dashboard
    inicializarDashboard();
});

