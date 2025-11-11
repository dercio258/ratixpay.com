// Componente de Gráfico de Vendas Avançado
class VendasChartAdvanced {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = null;
        this.chartCategoria = null;
        this.chartTipo = null;
        this.periodoAtual = '7d';
        this.tipoVisualizacao = 'receita';
        this.apiBase = '/api';
    }

    // Verificar autenticação
    verificarAutenticacao() {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
            console.error('❌ Token inválido');
            return false;
        }
        return token;
    }

    // Renderizar o componente
    render() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('❌ Container não encontrado:', this.containerId);
            return;
        }

        container.innerHTML = `
            <div class="vendas-chart-container">
                <!-- Header com controles -->
                <div class="chart-header">
                    <div class="chart-title">
                        <i class="fas fa-chart-line"></i>
                        Análise Avançada de Vendas
                    </div>
                    <div class="chart-controls">
                        <div class="period-selector">
                            <button class="period-btn" data-period="hoje">Hoje</button>
                            <button class="period-btn" data-period="ontem">Ontem</button>
                            <button class="period-btn active" data-period="7d">7 dias</button>
                            <button class="period-btn" data-period="30d">30 dias</button>
                            <button class="period-btn" data-period="90d">90 dias</button>
                        </div>
                        <div class="view-selector">
                            <button class="view-btn active" data-view="receita">
                                <i class="fas fa-dollar-sign"></i> Receita
                            </button>
                            <button class="view-btn" data-view="vendas">
                                <i class="fas fa-shopping-cart"></i> Vendas
                            </button>
                            <button class="view-btn" data-view="ticket">
                                <i class="fas fa-receipt"></i> Ticket Médio
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Métricas principais -->
                <div class="metrics-grid">
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-coins"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Receita Total</div>
                            <div class="metric-value" id="receitaTotal">MZN 0.00</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-shopping-bag"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Total de Vendas</div>
                            <div class="metric-value" id="totalVendas">0</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-receipt"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Ticket Médio</div>
                            <div class="metric-value" id="ticketMedio">MZN 0.00</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-percentage"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Taxa de Conversão</div>
                            <div class="metric-value" id="taxaConversao">0%</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Vendas/Hora</div>
                            <div class="metric-value" id="vendasPorHora">0</div>
                        </div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-icon">
                            <i class="fas fa-star"></i>
                        </div>
                        <div class="metric-content">
                            <div class="metric-label">Produto Top</div>
                            <div class="metric-value" id="produtoTop">-</div>
                        </div>
                    </div>
                </div>

                <!-- Gráfico principal -->
                <div class="chart-section">
                    <div class="chart-container">
                        <canvas id="vendasChartCanvas"></canvas>
                    </div>
                </div>

                <!-- Gráficos secundários -->
                <div class="secondary-charts">
                    <div class="chart-card">
                        <div class="chart-title">
                            <i class="fas fa-tags"></i>
                            Vendas por Categoria
                        </div>
                        <div class="chart-container-small">
                            <canvas id="categoriaChartCanvas"></canvas>
                        </div>
                    </div>
                    <div class="chart-card">
                        <div class="chart-title">
                            <i class="fas fa-cube"></i>
                            Vendas por Tipo
                        </div>
                        <div class="chart-container-small">
                            <canvas id="tipoChartCanvas"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Status das vendas -->
                <div class="status-section">
                    <div class="status-card">
                        <div class="status-title">
                            <i class="fas fa-info-circle"></i>
                            Status das Vendas
                        </div>
                        <div class="status-grid">
                            <div class="status-item success">
                                <div class="status-label">Aprovadas</div>
                                <div class="status-value" id="vendasAprovadas">0</div>
                            </div>
                            <div class="status-item warning">
                                <div class="status-label">Pendentes</div>
                                <div class="status-value" id="vendasPendentes">0</div>
                            </div>
                            <div class="status-item danger">
                                <div class="status-label">Canceladas</div>
                                <div class="status-value" id="vendasCanceladas">0</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
        this.carregarDados();
    }

    // Anexar event listeners
    attachEventListeners() {
        // Botões de período
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.periodoAtual = e.target.dataset.period;
                this.carregarDados();
            });
        });

        // Botões de visualização
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.tipoVisualizacao = e.target.dataset.view;
                this.atualizarGrafico();
            });
        });
    }

    // Carregar dados da API
    async carregarDados() {
        const token = this.verificarAutenticacao();
        if (!token) return;

        try {
            console.log(`🔄 Carregando dados de vendas - Período: ${this.periodoAtual}`);
            
            const response = await fetch(`${this.apiBase}/dashboard/vendedor/vendas-grafico?periodo=${this.periodoAtual}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.processarDados(result.data);
            } else {
                throw new Error(result.message || 'Erro ao carregar dados');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar dados de vendas:', error);
            this.mostrarErro('Erro ao carregar dados: ' + error.message);
        }
    }

    // Processar dados recebidos
    processarDados(dados) {
        console.log('📊 Processando dados de vendas:', dados);
        
        // Atualizar métricas principais
        this.atualizarMetricas(dados.metricas);
        
        // Atualizar gráfico principal
        this.atualizarGraficoPrincipal(dados.grafico);
        
        // Atualizar gráficos secundários
        this.atualizarGraficoCategoria(dados.categorias);
        this.atualizarGraficoTipo(dados.tipos);
        
        // Atualizar status
        this.atualizarStatus(dados.metricas);
    }

    // Atualizar métricas principais
    atualizarMetricas(metricas) {
        document.getElementById('receitaTotal').textContent = 
            `MZN ${metricas.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        
        document.getElementById('totalVendas').textContent = 
            metricas.totalVendas.toLocaleString('pt-BR');
        
        document.getElementById('ticketMedio').textContent = 
            `MZN ${metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
        
        document.getElementById('taxaConversao').textContent = 
            `${metricas.taxaConversao.toFixed(1)}%`;
        
        document.getElementById('vendasPorHora').textContent = 
            metricas.vendasPorHora.toFixed(2);
        
        document.getElementById('produtoTop').textContent = 
            metricas.produtoMaisVendido || '-';
    }

    // Atualizar gráfico principal
    atualizarGraficoPrincipal(dadosGrafico) {
        const ctx = document.getElementById('vendasChartCanvas');
        if (!ctx) return;

        // Destruir gráfico existente
        if (this.chart) {
            this.chart.destroy();
        }

        // Determinar dados baseado no tipo de visualização
        let dados, label, cor;
        switch (this.tipoVisualizacao) {
            case 'vendas':
                dados = dadosGrafico.vendas;
                label = 'Número de Vendas';
                cor = '#28a745';
                break;
            case 'ticket':
                dados = dadosGrafico.ticketMedio;
                label = 'Ticket Médio (MZN)';
                cor = '#ffc107';
                break;
            default:
                dados = dadosGrafico.receitas;
                label = 'Receita (MZN)';
                cor = '#007bff';
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dadosGrafico.labels,
                datasets: [{
                    label: label,
                    data: dados,
                    borderColor: cor,
                    backgroundColor: cor + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: cor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                if (this.tipoVisualizacao === 'vendas') {
                                    return `${label}: ${value.toLocaleString('pt-BR')}`;
                                } else {
                                    return `${label}: MZN ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                                }
                            }.bind(this)
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Período'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: this.tipoVisualizacao === 'vendas' ? 'Quantidade' : 'Valor (MZN)'
                        },
                        beginAtZero: true
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    // Atualizar gráfico de categoria
    atualizarGraficoCategoria(categorias) {
        const ctx = document.getElementById('categoriaChartCanvas');
        if (!ctx) return;

        if (this.chartCategoria) {
            this.chartCategoria.destroy();
        }

        const cores = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];

        this.chartCategoria = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categorias.map(c => c.nome),
                datasets: [{
                    data: categorias.map(c => c.receita),
                    backgroundColor: cores.slice(0, categorias.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const categoria = categorias[context.dataIndex];
                                const total = categorias.reduce((sum, c) => sum + c.receita, 0);
                                const percentual = ((categoria.receita / total) * 100).toFixed(1);
                                return `${categoria.nome}: MZN ${categoria.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${percentual}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Atualizar gráfico de tipo
    atualizarGraficoTipo(tipos) {
        const ctx = document.getElementById('tipoChartCanvas');
        if (!ctx) return;

        if (this.chartTipo) {
            this.chartTipo.destroy();
        }

        const cores = ['#17a2b8', '#6c757d', '#343a40'];

        this.chartTipo = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: tipos.map(t => t.nome.charAt(0).toUpperCase() + t.nome.slice(1)),
                datasets: [{
                    label: 'Receita (MZN)',
                    data: tipos.map(t => t.receita),
                    backgroundColor: cores.slice(0, tipos.length),
                    borderColor: cores.slice(0, tipos.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Receita: MZN ${context.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'MZN ' + value.toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        });
    }

    // Atualizar status das vendas
    atualizarStatus(metricas) {
        document.getElementById('vendasAprovadas').textContent = 
            metricas.totalVendas.toLocaleString('pt-BR');
        
        document.getElementById('vendasPendentes').textContent = 
            metricas.vendasPendentes.toLocaleString('pt-BR');
        
        document.getElementById('vendasCanceladas').textContent = 
            metricas.vendasCanceladas.toLocaleString('pt-BR');
    }

    // Atualizar gráfico (mudança de visualização)
    atualizarGrafico() {
        if (this.dadosAtuais) {
            this.atualizarGraficoPrincipal(this.dadosAtuais.grafico);
        }
    }

    // Mostrar erro
    mostrarErro(mensagem) {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${mensagem}</p>
                    <button onclick="location.reload()" class="btn-retry">
                        <i class="fas fa-redo"></i> Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

// CSS para o componente
const vendasChartCSS = `
<style>
.vendas-chart-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.chart-header {
    background: linear-gradient(135deg, #ff6b35, #f7931e);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
}

.chart-title {
    font-size: 20px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 10px;
}

.chart-controls {
    display: flex;
    gap: 15px;
    flex-wrap: wrap;
}

.period-selector, .view-selector {
    display: flex;
    gap: 5px;
}

.period-btn, .view-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 5px;
}

.period-btn:hover, .view-btn:hover {
    background: rgba(255, 255, 255, 0.3);
}

.period-btn.active, .view-btn.active {
    background: white;
    color: #ff6b35;
    font-weight: 600;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    padding: 20px;
    background: #f8f9fa;
}

.metric-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.3s ease;
}

.metric-card:hover {
    transform: translateY(-2px);
}

.metric-icon {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, #ff6b35, #f7931e);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
}

.metric-content {
    flex: 1;
}

.metric-label {
    font-size: 12px;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
}

.metric-value {
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
}

.chart-section {
    padding: 20px;
}

.chart-container {
    height: 400px;
    position: relative;
}

.secondary-charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    padding: 20px;
    background: #f8f9fa;
}

.chart-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chart-title {
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.chart-container-small {
    height: 250px;
    position: relative;
}

.status-section {
    padding: 20px;
    background: #f8f9fa;
}

.status-card {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.status-title {
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 15px;
}

.status-item {
    text-align: center;
    padding: 15px;
    border-radius: 8px;
    border-left: 4px solid;
}

.status-item.success {
    background: #d4edda;
    border-left-color: #28a745;
}

.status-item.warning {
    background: #fff3cd;
    border-left-color: #ffc107;
}

.status-item.danger {
    background: #f8d7da;
    border-left-color: #dc3545;
}

.status-label {
    font-size: 12px;
    color: #6c757d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 5px;
}

.status-value {
    font-size: 24px;
    font-weight: 600;
    color: #2c3e50;
}

.error-message {
    text-align: center;
    padding: 40px;
    color: #dc3545;
}

.error-message i {
    font-size: 48px;
    margin-bottom: 15px;
}

.btn-retry {
    background: #ff6b35;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    margin-top: 15px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn-retry:hover {
    background: #e55a2b;
}

@media (max-width: 768px) {
    .chart-header {
        flex-direction: column;
        align-items: stretch;
    }
    
    .chart-controls {
        justify-content: center;
    }
    
    .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
    }
    
    .secondary-charts {
        grid-template-columns: 1fr;
    }
    
    .status-grid {
        grid-template-columns: 1fr;
    }
}
</style>
`;

// Adicionar CSS ao head se não existir
if (!document.getElementById('vendas-chart-css')) {
    const style = document.createElement('div');
    style.id = 'vendas-chart-css';
    style.innerHTML = vendasChartCSS;
    document.head.appendChild(style);
}

// Exportar para uso global
window.VendasChartAdvanced = VendasChartAdvanced;
