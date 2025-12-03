// ============================================================================
// DASHBOARD - Sistema de Gerenciamento de Vendas
// ============================================================================

// ===== CONSTANTES =====
const CONFIG = {
    API_TIMEOUT: 30000,
    MAX_RETRIES: 2,
    RETRY_DELAY: 2000,
    NOTIFICATION_DURATION: 5000,
    AUTO_UPDATE_INTERVAL: 60000,
    CACHE_DURATION: 5000,
    CHART_ANIMATION_DURATION: 1500
};

const PERIODS = {
    HOJE: 'hoje',
    ONTEM: 'ontem',
    SETE_DIAS: '7dias',
    TRINTA_DIAS: '30dias'
};

const PERIOD_LABELS = {
    [PERIODS.HOJE]: 'Hoje',
    [PERIODS.ONTEM]: 'Ontem',
    [PERIODS.SETE_DIAS]: 'Últimos 7 dias',
    [PERIODS.TRINTA_DIAS]: 'Últimos 30 dias'
};

const SALES_LEVELS = {
    0: { name: 'Sem placa', icon: '⚪', threshold: 0, color: 'default' },
    1: { name: 'Bronze', icon: '🥉', threshold: 100000, color: 'bronze' },      // 100K
    2: { name: 'Prata', icon: '🥈', threshold: 500000, color: 'silver' },        // 500K
    3: { name: 'Ouro', icon: '🥇', threshold: 1000000, color: 'gold' },          // 1000K (1M)
    4: { name: 'Diamante', icon: '💎', threshold: 5000000, color: 'diamond' },  // 5000K (5M)
    5: { name: 'Platina', icon: '💠', threshold: 10000000, color: 'platinum' }   // 10000K (10M)
};

const APPROVED_STATUSES = ['aprovado', 'pago', 'approved', 'paid', 'completed', 'success'];
const CANCELLED_STATUSES = ['cancelado', 'cancelada', 'rejeitado'];
const PENDING_STATUSES = ['pendente'];

// ===== VARIÁVEIS GLOBAIS =====
let salesChart = null;
let currentPeriod = PERIODS.HOJE;
let currentPage = 'dashboard';
let todasVendasOriginais = [];
let previousLevel = 0;
let lastReceitaValue = null;
let lastReceitaTimestamp = 0;
let updateTimeout = null;

// ===== UTILITÁRIOS DE FORMATAÇÃO =====
const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
        value = 0;
    }
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN'
    }).format(value);
    return formatted.replace('MTn', 'MZN');
};

const formatCurrencyWithSeparators = (value) => {
    if (value >= 1000) {
        const thousands = value / 1000;
        if (thousands >= 1000) {
            return `${(thousands / 1000).toFixed(1)}M MZN`;
        }
            return `${thousands.toFixed(0)}K MZN`;
        }
        return `${value.toFixed(0)} MZN`;
};

const formatInteger = (value) => {
    return Math.round(value).toLocaleString('pt-MZ');
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
    });
};

// ===== UTILITÁRIOS DE PERÍODO =====
function getPeriodDates(periodo) {
    const agora = new Date();
    let inicioPeriodo, fimPeriodo;

    switch (periodo) {
        case PERIODS.HOJE:
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
        case PERIODS.ONTEM:
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 23, 59, 59);
            break;
        case PERIODS.SETE_DIAS:
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
        case PERIODS.TRINTA_DIAS:
            inicioPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 29, 0, 0, 0);
            fimPeriodo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
            break;
        default:
            return null;
    }

    return { inicioPeriodo, fimPeriodo };
}

function getPeriodLabel(periodo) {
    return PERIOD_LABELS[periodo] || 'Período';
}

// ===== UTILITÁRIOS DE STATUS =====
function getVendaStatus(venda) {
    return venda.pagamento?.status || venda.pagamento_status || venda.status || '';
}

function isStatusAprovado(status) {
    if (!status) return false;
    return APPROVED_STATUSES.includes(status.toLowerCase());
}

function isStatusCancelado(status) {
    if (!status) return false;
    return CANCELLED_STATUSES.includes(status.toLowerCase());
}

function isStatusPendente(status) {
    if (!status) return false;
    return PENDING_STATUSES.includes(status.toLowerCase());
}

function getVendaDate(venda) {
    return venda.created_at || 
           venda.createdAt || 
           venda.data_venda || 
           venda.pagamento?.data_processamento ||
           venda.data || 
           venda.date ||
           venda.timestamp ||
           venda.updated_at ||
           venda.updatedAt;
}

function getVendaValue(venda) {
    return Number(
        venda.pagamento?.valor || 
        venda.pagamento_valor || 
        venda.valor_final || 
        venda.valor || 
        venda.total || 
        venda.amount ||
        venda.price ||
        0
    );
}

// ===== API REQUEST =====
async function apiRequest(endpoint, options = {}, retryCount = 0) {
    try {
        const token = localStorage.getItem('authToken') || 
                     localStorage.getItem('token') || 
                     localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
        
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            credentials: 'include',
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
            throw new Error(errorData.erro || `HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        if (error.name === 'AbortError' && retryCount < CONFIG.MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return apiRequest(endpoint, options, retryCount + 1);
        }
        
        if (error.name === 'AbortError') {
            showNotification('Timeout: Servidor demorou para responder (30s)', 'warning');
            throw new Error('Timeout na requisição');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showNotification('Erro de conexão com o servidor', 'error');
            throw new Error('Erro de conexão');
        } else {
            showNotification('Erro ao conectar com o servidor', 'error');
            throw error;
        }
    }
}

// ===== NOTIFICAÇÕES =====
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
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideIn 0.3s ease-out;
            }
            .notification.success { background: #27ae60; }
            .notification.error { background: #e74c3c; }
            .notification.warning { background: #f39c12; }
            .notification.info { background: #E67E22; }
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
    }, CONFIG.NOTIFICATION_DURATION);
}

// ===== DETECÇÃO DE PÁGINA =====
function detectarPaginaAtual() {
    const path = window.location.pathname;
    const filename = path.split('/').pop();
    
    if (filename.includes('gestao-vendas') || filename.includes('vendas')) {
        return 'gestao-vendas';
    } else if (filename.includes('pagamento') || filename.includes('payment')) {
        return 'pagamento';
    }
        return 'dashboard';
}

// ===== CARREGAMENTO DE DADOS =====
async function carregarDadosUsuario() {
    try {
        const userData = await apiRequest('/auth/me');
        
        if (userData.success && userData.user) {
            const user = userData.user;
            const nomeCompleto = user.nome_completo || user.nome || 'Usuário';
            
            // Atualizar elementos do DOM
            const elements = {
                userName: nomeCompleto,
                userRole: user.role === 'user' ? 'Vendedor' : 'Administrador',
                userFullName: nomeCompleto,
                welcomeMessage: `Bem-vindo, ${nomeCompleto}`,
                profileWelcomeText: `Bem-vindo, ${nomeCompleto}`,
                dashboardWelcomeInfo: `Bem-vindo, ${nomeCompleto}`
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
            
            // Atualizar avatar
            const userAvatar = document.getElementById('userAvatar');
            if (userAvatar) {
                if (user.foto) {
                    userAvatar.innerHTML = `<img src="${user.foto}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                } else {
                    const initials = nomeCompleto.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                    userAvatar.innerHTML = `<div style="width: 100%; height: 100%; border-radius: 50%; background: linear-gradient(135deg, #E67E22, #D35400); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 1.2rem;">${initials}</div>`;
                }
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

async function carregarEstatisticas() {
    try {
        const params = new URLSearchParams({ periodo: currentPeriod });
        const response = await apiRequest(`/dashboard/vendedor/resumo?${params.toString()}`);
        
        if (response.success && response.data) {
            atualizarMetricasReceita(response.data);
            atualizarEstatisticasVendas(response.data);
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        atualizarMetricasReceita({});
        atualizarEstatisticasVendas({});
    }
}

async function carregarVendas() {
    try {
        const response = await apiRequest('/dashboard/ultimas-transacoes?page=1&limit=1000');
        
        if (response.success && response.data) {
            let vendas = response.data.transacoes || 
                        response.data.vendas || 
                        (Array.isArray(response.data) ? response.data : []);
            
            todasVendasOriginais = normalizarVendas(vendas);
            
    setTimeout(() => {
        forcarRenderizacaoGrafico();
    }, 100);
        } else {
            todasVendasOriginais = [];
            mostrarGraficoVazio('Erro ao carregar dados das vendas');
        }
    } catch (error) {
        console.error('Erro ao carregar vendas:', error);
        todasVendasOriginais = [];
        mostrarGraficoVazio('Erro de conexão ao carregar vendas');
    }
}

function normalizarVendas(vendas) {
    return (vendas || []).map(venda => {
        if (!venda.created_at && venda.createdAt) {
            venda.created_at = venda.createdAt;
        }
        if (!venda.created_at) {
            venda.created_at = getVendaDate(venda);
        }
        if (!venda.createdAt && venda.created_at) {
            venda.createdAt = venda.created_at;
        }
        return venda;
    }).filter(venda => !venda.erro);
}

// ===== ATUALIZAÇÃO DE MÉTRICAS =====
function atualizarMetricasReceita(data) {
    const receitaElement = document.getElementById('receitaTotal');
    if (!receitaElement) return;
    
    const periodoData = data.periodo || {};
    const valorReceita = periodoData.receita || 0;
    const labelReceita = `Receita (${currentPeriod})`;
    
    receitaElement.classList.remove('loading');
    receitaElement.innerHTML = formatCurrency(valorReceita);
    
    const labelElement = receitaElement.previousElementSibling;
    if (labelElement && labelElement.tagName === 'H3') {
        labelElement.textContent = labelReceita;
    }
    
    atualizarMetricasAdicionais(data);
}

function atualizarMetricasAdicionais(data) {
    const metricas = {
        receitaTotalCompleta: data.receitaTotal || 0,
        receitaDisponivel: data.receitaDisponivel || 0,
        receitaSemanal: data.receitaSemanal || 0,
        receitaMensal: data.receitaMensal || 0
    };
    
    Object.entries(metricas).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatCurrency(value);
    });
}

function atualizarEstatisticasVendas(data) {
    const periodoData = data.periodo || {};
    
    const metricas = {
        vendasAprovadas: periodoData.vendasAprovadas || 0,
        vendasCanceladas: periodoData.vendasCanceladas || 0,
        vendasPendentes: periodoData.vendasPendentes || 0
    };
    
    Object.entries(metricas).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('loading');
            el.innerHTML = value;
        }
    });
    
    updateChartDataFromPeriod(periodoData);
}

function updateChartDataFromPeriod(periodoData) {
            setTimeout(() => {
                forcarRenderizacaoGrafico();
            }, 100);
}

// ===== GRÁFICO DE VENDAS =====
function agruparVendasPorPeriodo(vendas, periodo = PERIODS.HOJE) {
    if (!vendas || !Array.isArray(vendas)) {
        return { labels: [], dataset: [] };
    }
    
    const periodDates = getPeriodDates(periodo);
    if (!periodDates) {
        return { labels: [], dataset: [] };
    }
    
    const { inicioPeriodo, fimPeriodo } = periodDates;
    
    const vendasFiltradas = vendas.filter(venda => {
        if (venda.erro) return false;
        
        const status = getVendaStatus(venda);
        if (!isStatusAprovado(status)) return false;
        
        const dataField = getVendaDate(venda);
        if (!dataField || dataField === 'undefined' || dataField === 'null' || 
            (typeof dataField === 'string' && dataField.trim() === '')) {
            return false;
        }
        
        const dataVenda = new Date(dataField);
        if (isNaN(dataVenda.getTime())) return false;
        
        return dataVenda >= inicioPeriodo && dataVenda <= fimPeriodo;
    });
    
    const agrupado = {};
    vendasFiltradas.forEach(venda => {
        const dataField = getVendaDate(venda);
        if (!dataField) return;
        
        const data = new Date(dataField);
        if (isNaN(data.getTime())) return;
        
        let chave;
        if (periodo === PERIODS.HOJE || periodo === PERIODS.ONTEM) {
            const hora = data.getHours();
            const faixa = Math.floor(hora / 2) * 2;
            chave = `${faixa.toString().padStart(2, "0")}:00 - ${(faixa+2).toString().padStart(2,"0")}:00`;
        } else {
            chave = data.toISOString().split("T")[0];
        }

        if (!agrupado[chave]) agrupado[chave] = 0;

        const valor = getVendaValue(venda);
        if (valor > 0) {
        agrupado[chave] += valor;
        }
    });

    const labels = gerarLabelsPeriodo(periodo);
    const dataset = labels.map(label => {
        if (periodo === PERIODS.SETE_DIAS || periodo === PERIODS.TRINTA_DIAS) {
            const agora = new Date();
            const diasAtras = periodo === PERIODS.SETE_DIAS ? 
                (6 - labels.indexOf(label)) : 
                (29 - labels.indexOf(label));
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras);
            const chave = dataRef.toISOString().split("T")[0];
            return agrupado[chave] || 0;
        }
        return agrupado[label] || 0;
    });
    
    return { labels, dataset };
}

function gerarLabelsPeriodo(periodo) {
    const agora = new Date();
    const labels = [];
    
    if (periodo === PERIODS.HOJE || periodo === PERIODS.ONTEM) {
        for (let h = 0; h < 24; h += 2) {
            const faixa = `${h.toString().padStart(2, "0")}:00 - ${(h+2).toString().padStart(2,"0")}:00`;
            labels.push(faixa);
        }
    } else if (periodo === PERIODS.SETE_DIAS) {
        for (let i = 6; i >= 0; i--) {
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
            labels.push(dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        }
    } else if (periodo === PERIODS.TRINTA_DIAS) {
        for (let i = 29; i >= 0; i--) {
            const dataRef = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
            labels.push(dataRef.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        }
    }
    
    return labels;
}

function renderizarGrafico(vendas, periodo = PERIODS.HOJE) {
    if (!vendas || !Array.isArray(vendas)) {
        return;
    }
    
    const { labels, dataset } = agruparVendasPorPeriodo(vendas, periodo);
    
    if (!labels || !dataset || labels.length === 0 || dataset.length === 0) {
        mostrarGraficoVazio('Nenhum dado disponível para o período selecionado');
        return;
    }
    
    const ctx = document.getElementById("salesChart");
    if (!ctx) {
        return;
    }
    
    if (typeof window.graficoVendas !== 'undefined' && window.graficoVendas) {
        window.graficoVendas.destroy();
        window.graficoVendas = null;
    }

    if (typeof Chart === 'undefined') {
        mostrarGraficoVazio('Chart.js não carregado');
        return;
    }
    
    try {
        const totalReceita = dataset.reduce((sum, val) => sum + val, 0);
        const mediaReceita = dataset.length > 0 ? totalReceita / dataset.length : 0;
        const maxReceita = Math.max(...dataset, 0);
        
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
                    borderColor: '#f64c00',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                },
                plugins: {
                    legend: { 
                        display: true,
                        labels: {
                            color: "#333333",
                            font: { size: 14 }
                        }
                    },
                    tooltip: {
                        enabled: true,
                        titleFont: { size: 14 },
                        bodyFont: { size: 13 },
                        callbacks: {
                            title: (context) => context[0].label,
                            label: (context) => {
                                const value = context.parsed.y;
                                const percentual = totalReceita > 0 ? ((value / totalReceita) * 100).toFixed(1) : 0;
                                return [
                                    `Receita: ${formatCurrency(value)}`,
                                    `Percentual: ${percentual}% do total`
                                ];
                            },
                            footer: (tooltipItems) => {
                                return `Total do período: ${formatCurrency(totalReceita)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            font: { size: 12 },
                            padding: { top: 10 }
                        },
                        grid: {
                            color: "rgba(0, 0, 0, 0.05)",
                        },
                        ticks: {
                            color: "#666666",
                            font: { size: 11 }
                        }
                    },
                    y: {
                        title: { 
                            display: true, 
                            font: { size: 12 },
                            padding: { left: 10 }
                            },
                        beginAtZero: true,
                        grid: {
                            color: "rgba(0, 0, 0, 0.05)",
                        },
                        ticks: {
                            color: "#666666",
                            font: { size: 11 },
                            callback: function(value) {
                                if (value >= 1000000) {
                                    return `${(value / 1000000).toFixed(1)}M`;
                                } else if (value >= 1000) {
                                    return `${(value / 1000).toFixed(1)}K`;
                                }
                                    return value.toFixed(0);
                            }
                        }
                    }
                },
                animation: {
                    duration: CONFIG.CHART_ANIMATION_DURATION,
                }
            }
        });
        
        atualizarInfoGrafico(totalReceita, mediaReceita, maxReceita, periodo);
    } catch (error) {
        console.error('Erro ao criar gráfico:', error);
        mostrarGraficoVazio('Erro ao carregar gráfico');
    }
}

function atualizarInfoGrafico(total, media, max, periodo) {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (!lastUpdateEl) return;
    
    const agora = new Date();
    const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const dataFormatada = agora.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    
    lastUpdateEl.innerHTML = `
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
}

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

function forcarRenderizacaoGrafico() {
    const ctx = document.getElementById("salesChart");
    if (!ctx) return;
    
    ctx.innerHTML = '';
    ctx.style.display = 'block';
    
    if (typeof Chart === 'undefined') {
        mostrarGraficoVazio('Chart.js não carregado');
        return;
    }
    
    if (typeof window.graficoVendas !== 'undefined' && window.graficoVendas) {
        window.graficoVendas.destroy();
        window.graficoVendas = null;
    }
    
    if (todasVendasOriginais && todasVendasOriginais.length > 0) {
        renderizarGrafico(todasVendasOriginais, currentPeriod);
        return;
    }
    
    mostrarGraficoVazio('Nenhum dado disponível');
}

// ===== SISTEMA DE NÍVEIS =====
function calculateSalesLevel(revenue) {
    let currentLevel = 0;
    
    for (let level = 5; level >= 1; level--) {
        if (revenue >= SALES_LEVELS[level].threshold) {
            currentLevel = level;
            break;
        }
    }
    
    if (revenue === 0) {
        currentLevel = 0;
    }
    
    const nextLevel = currentLevel < 5 ? currentLevel + 1 : currentLevel;
    
    return {
        current: currentLevel,
        next: nextLevel,
        currentData: SALES_LEVELS[currentLevel],
        nextData: SALES_LEVELS[nextLevel]
    };
}

function calculateProgress(revenue, currentLevel, nextLevel) {
    if (currentLevel >= 5) return 100;
    
    const currentThreshold = SALES_LEVELS[currentLevel].threshold;
    const nextThreshold = SALES_LEVELS[nextLevel].threshold;
    
    const progress = ((revenue - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(Math.max(progress, 0), 100);
}

function animatePercentage(element, targetPercentage) {
    const startPercentage = parseInt(element.textContent) || 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function updatePercentage(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentPercentage = Math.round(startPercentage + (targetPercentage - startPercentage) * easeOutCubic);
        
        element.textContent = `${currentPercentage}%`;
        
        if (progress < 1) {
            requestAnimationFrame(updatePercentage);
        }
    }
    
    requestAnimationFrame(updatePercentage);
}

function updateSalesLevelSystem(revenue) {
    const levelData = calculateSalesLevel(revenue);
    const progress = calculateProgress(revenue, levelData.current, levelData.next);
    
    const elements = {
        badgeIcon: levelData.currentData.icon,
        badgeName: levelData.currentData.name,
        currentRevenue: formatCurrencyWithSeparators(revenue),
        nextThreshold: levelData.current >= 5 ? 
            '🏆 Nível máximo!' : 
            formatCurrencyWithSeparators(levelData.nextData.threshold)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
    
    const progressFill = document.getElementById('progressFill');
    if (progressFill) {
        progressFill.classList.add('animating');
        setTimeout(() => {
            progressFill.style.width = `${progress}%`;
        }, 50);
        setTimeout(() => {
            progressFill.classList.remove('animating');
        }, 1200);
    }
    
    const progressPercentage = document.getElementById('progressPercentage');
    if (progressPercentage) {
        animatePercentage(progressPercentage, Math.round(progress));
    }
    
    const salesLevelSystem = document.getElementById('salesLevelSystem');
    if (salesLevelSystem) {
        salesLevelSystem.classList.remove('badge-default', 'badge-bronze', 'badge-silver', 'badge-gold', 'badge-diamond');
        salesLevelSystem.classList.add(`badge-${levelData.currentData.color}`);
    }
    
    if (previousLevel !== levelData.current && previousLevel > 0) {
        showLevelUpNotification(levelData.currentData);
    }
    
    previousLevel = levelData.current;
}

function showLevelUpNotification(levelData) {
    const message = `🎉 Parabéns! Você alcançou a Placa de ${levelData.name}! ${levelData.icon}`;
    
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
    
    if (!document.querySelector('#level-up-styles')) {
        const styles = document.createElement('style');
        styles.id = 'level-up-styles';
        styles.textContent = `
            .level-up-notification {
                background: linear-gradient(135deg, #FFD700, #FFA500);
                box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
            }
            .level-up-icon { font-size: 2rem; margin-right: 15px; }
            .level-up-text { flex: 1; }
            .level-up-title { font-size: 1.1rem; font-weight: bold; margin-bottom: 5px; }
            .level-up-message { font-size: 0.9rem; opacity: 0.9; }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 8000);
    
    showNotification(message, 'success');
}

async function getVendedorReceitaTotal() {
    try {
        const response = await apiRequest('/dashboard/vendedor/resumo');
        
        if (response.success && response.data) {
            return response.data.receitaTotal || 
                   response.data.receitaTotalVendedor || 
                   response.data.receita || 
                   response.data.receitaGeral ||
                   response.data.totalReceita ||
                   0;
        }
        return 0;
                } catch (error) {
        console.error('Erro ao obter receita total do vendedor:', error);
        return 0;
    }
}

function getReceitaTotalAbsoluta() {
    const receitaElement = document.getElementById('receitaTotal');
    if (receitaElement) {
        const receitaText = receitaElement.textContent;
        const receitaValue = parseFloat(receitaText.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        return receitaValue;
    }
    return 0;
}

async function updateSalesLevelFromRevenue(forceUpdate = false) {
    const now = Date.now();
    
    if (!forceUpdate && lastReceitaValue !== null && (now - lastReceitaTimestamp) < CONFIG.CACHE_DURATION) {
        updateSalesLevelSystem(lastReceitaValue);
        return;
    }
    
    let receitaTotal = await getVendedorReceitaTotal();
    
    if (receitaTotal === 0) {
        receitaTotal = getReceitaTotalAbsoluta();
    }
    
    if (receitaTotal > 0) {
        lastReceitaValue = receitaTotal;
        lastReceitaTimestamp = now;
    }
    
    updateSalesLevelSystem(receitaTotal);
}

async function initializeSalesLevelSystem() {
    const attempts = [
        { delay: 2000 },
        { delay: 5000 }
    ];
    
    attempts.forEach((attempt, index) => {
        setTimeout(async () => {
            try {
                await updateSalesLevelFromRevenue(true);
            } catch (error) {
                if (index === attempts.length - 1) {
                    updateSalesLevelSystem(0);
                }
            }
        }, attempt.delay);
    });
}

// ===== CONFIGURAÇÃO DE EVENTOS =====
function setupPeriodFilters() {
    const chartPeriodButtons = document.querySelectorAll('.period-btn');
    
    chartPeriodButtons.forEach(button => {
        button.addEventListener('click', async () => {
            mostrarSpinnerMetricas();
            
            chartPeriodButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            currentPeriod = button.dataset.period;
            
            await carregarEstatisticas();
            
            if (todasVendasOriginais.length > 0) {
                renderizarGrafico(todasVendasOriginais, currentPeriod);
            }
            
            showNotification(`Filtro alterado para: ${getPeriodLabel(currentPeriod)}`, 'info');
        });
    });
}

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

function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                localStorage.removeItem('authToken');
                localStorage.removeItem('token');
                localStorage.removeItem('adminToken');
                window.location.href = 'login.html';
            } catch (error) {
                window.location.href = 'login.html';
            }
        });
    }
}

function setupProfileToggle() {
    const profileSection = document.getElementById('profileSection');
    
    if (profileSection) {
        profileSection.addEventListener('click', function(e) {
            e.stopPropagation();
            const isShowed = profileSection.classList.contains('showed');
            
            if (isShowed) {
                profileSection.classList.remove('showed');
            } else {
                profileSection.classList.add('showed');
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && profileSection.classList.contains('showed')) {
                profileSection.classList.remove('showed');
            }
        });
    }
}

function setupNotifications() {
    try {
        if (window.notificationManager) {
            setTimeout(async () => {
                try {
                    const userData = await apiRequest('/auth/me');
                    if (userData.success && userData.user) {
                        const user = userData.user;
                        const userId = user.id || user.vendedor_id;
                        const userType = user.role === 'user' ? 'vendedor' : 'admin';
                        window.notificationManager.setUserData(userId, userType);
        }
    } catch (error) {
                    console.error('Erro ao configurar notificações:', error);
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Erro ao configurar notificações:', error);
    }
}

function setupAutoUpdate() {
    let updateInterval;
    
    const startAutoUpdate = () => {
        updateInterval = setInterval(async () => {
            try {
                await carregarEstatisticas();
                if (todasVendasOriginais.length > 0) {
                    renderizarGrafico(todasVendasOriginais, currentPeriod);
                }
            } catch (error) {
                console.error('Erro na atualização automática:', error);
            }
        }, CONFIG.AUTO_UPDATE_INTERVAL);
    };
    
    const stopAutoUpdate = () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    };
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAutoUpdate();
        } else {
            startAutoUpdate();
        }
    });
    
    startAutoUpdate();
}

// ===== INICIALIZAÇÃO OTIMIZADA =====
async function initializeDashboard() {
    try {
        currentPage = detectarPaginaAtual();
        
        if (currentPage === 'dashboard') {
            currentPeriod = PERIODS.HOJE;
            
            const periodButtons = document.querySelectorAll('.period-btn');
            periodButtons.forEach(btn => {
                if (btn.dataset.period === PERIODS.HOJE) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        // Configurar UI primeiro (sem esperar dados)
        setupPeriodFilters();
        setupLogoutButton();
        setupProfileToggle();
        setupNotifications();
        
        // Carregar dados em paralelo de forma otimizada
        // Priorizar dados do usuário (mais rápido) e depois estatísticas/vendas
        const userDataPromise = carregarDadosUsuario();
        
        // Carregar estatísticas e vendas em paralelo após usuário
        userDataPromise.then(() => {
            // Carregar dados pesados em paralelo
            Promise.all([
                carregarEstatisticas(),
                carregarVendas()
            ]).then(() => {
                // Renderizar gráfico apenas após todos os dados estarem prontos
                requestAnimationFrame(() => {
                    forcarRenderizacaoGrafico();
                });
            }).catch(error => {
                console.error('Erro ao carregar estatísticas/vendas:', error);
            });
        }).catch(error => {
            console.error('Erro ao carregar dados do usuário:', error);
        });
        
    } catch (error) {
        console.error('Erro ao inicializar dashboard:', error);
        showNotification('Erro ao carregar dashboard', 'error');
    }
}

async function atualizarDados() {
    try {
        showNotification('Atualizando dados...', 'info');
        await carregarEstatisticas();
        
        if (todasVendasOriginais.length > 0) {
            renderizarGrafico(todasVendasOriginais, currentPeriod);
        }
        
        showNotification('Dados atualizados com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao atualizar dados:', error);
        showNotification('Erro ao atualizar dados', 'error');
    }
}

// ===== ESTILOS =====
const styles = `
    .notification {
        position: fixed;
        border-radius: 8px;
        font-weight: 500;
        z-index: 1000;
        align-items: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .notification-success { background: #10b981; }
    .notification-error { background: #ef4444; }
    .notification-warning { background: #f59e0b; }
    .notification-info { background: #E67E22; }
    .notification button {
        background: none;
        font-size: 18px;
        align-items: center;
        justify-content: center;
    }
    .skeleton-loading {
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        border-radius: 4px;
    }
    .loading-spinner {
        text-align: center;
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

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    if (typeof Chart === 'undefined') {
        setTimeout(() => {
            if (typeof Chart !== 'undefined') {
                initializeDashboard();
                setupAutoUpdate();
            }
        }, 1000);
    } else {
        initializeDashboard();
        setupAutoUpdate();
    }
    
        setTimeout(() => {
        initializeSalesLevelSystem();
    }, 2000);
    
    const receitaElement = document.getElementById('receitaTotal');
    if (receitaElement) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    if (mutation.target.id === 'receitaTotal' || 
                        (mutation.target.parentElement && mutation.target.parentElement.id === 'receitaTotal')) {
                        
                        if (updateTimeout) {
                            clearTimeout(updateTimeout);
                        }
                        
                        updateTimeout = setTimeout(() => {
                            updateSalesLevelFromRevenue();
                        }, 1000);
                    }
                }
            });
        });
        
        observer.observe(receitaElement, {
            childList: true,
            characterData: true
        });
    }
});

window.addEventListener('load', function() {
    setTimeout(() => {
        updateSalesLevelFromRevenue();
    }, 1000);
});

// Modificar atualizarMetricasReceita para atualizar sistema de níveis
const originalAtualizarMetricasReceita = atualizarMetricasReceita;
atualizarMetricasReceita = function(data) {
    originalAtualizarMetricasReceita(data);
    
    if (data && data.receitaTotal !== undefined) {
        updateSalesLevelSystem(data.receitaTotal);
        lastReceitaValue = data.receitaTotal;
        lastReceitaTimestamp = Date.now();
    }
};

// Funções de compatibilidade
async function carregarGraficoVendasSemanais() {
        await carregarVendas();
}

async function carregarGraficoVendasLegacy() {
                await carregarVendas();
}

function drawWeeklySalesChart() {}
function drawSalesChart() {}

