// Componente de Gráfico de Receitas
class ReceitasChart {
    constructor(containerId) {
        this.containerId = containerId;
        this.chart = null;
        this.periodoAtual = '7d';
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
            <div class="chart-card">
                <div class="chart-header">
                    <div class="chart-title">
                        <i class="fas fa-chart-line"></i>
                        Receitas por Período
                    </div>
                    <div class="chart-period">
                        <button class="period-btn" data-period="hoje">Hoje</button>
                        <button class="period-btn" data-period="ontem">Ontem</button>
                        <button class="period-btn active" data-period="7d">7 dias</button>
                        <button class="period-btn" data-period="30d">30 dias</button>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="receitasChartCanvas"></canvas>
                </div>
                <div class="chart-footer">
                    <div class="chart-stats">
                        <div class="stat-item">
                            <span class="stat-label">Total do Período:</span>
                            <span class="stat-value" id="totalPeriodo">MZN 0.00</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total de Vendas:</span>
                            <span class="stat-value" id="totalVendas">0</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Adicionar estilos CSS
        this.adicionarEstilos();

        // Configurar event listeners
        this.configurarEventListeners();

        // Carregar dados iniciais
        this.carregarDados();
    }

    // Adicionar estilos CSS
    adicionarEstilos() {
        const style = document.createElement('style');
        style.textContent = `
            .chart-card {
                background: white;
                border-radius: 15px;
                padding: 25px;
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
                margin-bottom: 30px;
            }

            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 25px;
                flex-wrap: wrap;
                gap: 15px;
            }

            .chart-title {
                font-size: 1.3rem;
                font-weight: 600;
                color: #000000;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .chart-title i {
                color: #27ae60;
            }

            .chart-period {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .period-btn {
                padding: 8px 16px;
                border: 2px solid #e9ecef;
                background: white;
                color: #6c757d;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .period-btn:hover {
                border-color: #27ae60;
                color: #27ae60;
                transform: translateY(-2px);
            }

            .period-btn.active {
                background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                border-color: #27ae60;
                color: white;
            }

            .chart-container {
                position: relative;
                height: 400px;
                margin-bottom: 20px;
            }

            .chart-footer {
                border-top: 1px solid #e9ecef;
                padding-top: 20px;
            }

            .chart-stats {
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
                gap: 20px;
            }

            .stat-item {
                text-align: center;
            }

            .stat-label {
                display: block;
                font-size: 0.9rem;
                color: #6c757d;
                margin-bottom: 5px;
            }

            .stat-value {
                display: block;
                font-size: 1.2rem;
                font-weight: 600;
                color: #27ae60;
            }

            @media (max-width: 768px) {
                .chart-header {
                    flex-direction: column;
                    align-items: stretch;
                }

                .chart-period {
                    justify-content: center;
                }

                .chart-stats {
                    flex-direction: column;
                    gap: 15px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Configurar event listeners
    configurarEventListeners() {
        const container = document.getElementById(this.containerId);
        const periodButtons = container.querySelectorAll('.period-btn');
        
        periodButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const periodo = e.target.getAttribute('data-period');
                this.selecionarPeriodo(periodo);
            });
        });
    }

    // Selecionar período
    selecionarPeriodo(periodo) {
        this.periodoAtual = periodo;
        
        // Atualizar botões
        const container = document.getElementById(this.containerId);
        const periodButtons = container.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        container.querySelector(`[data-period="${periodo}"]`).classList.add('active');
        
        // Carregar novos dados
        this.carregarDados();
    }

    // Carregar dados
    async carregarDados() {
        try {
            const token = this.verificarAutenticacao();
            if (!token) return;

            console.log(`🔄 Carregando dados de receitas - Período: ${this.periodoAtual}`);

            const response = await fetch(`${this.apiBase}/dashboard/vendedor/vendas-grafico?periodo=${this.periodoAtual}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.atualizarGrafico(data.data);
                    this.atualizarEstatisticas(data.data);
                    console.log('✅ Dados de receitas carregados com sucesso');
                } else {
                    throw new Error(data.message || 'Erro ao carregar dados');
                }
            } else {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados de receitas:', error);
            this.mostrarErro('Erro ao carregar dados de receitas');
        }
    }

    // Atualizar gráfico
    atualizarGrafico(data) {
        const canvas = document.getElementById('receitasChartCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Destruir gráfico anterior se existir
        if (this.chart) {
            this.chart.destroy();
        }

        // Determinar tipo de gráfico baseado no período
        const isHourly = this.periodoAtual === 'hoje' || this.periodoAtual === 'ontem';
        const chartType = isHourly ? 'bar' : 'line';
        
        // Garantir que todos os valores sejam não-negativos
        const valoresSeguros = data.grafico.receitas.map(valor => Math.max(0, valor));

        this.chart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.grafico.labels,
                datasets: [{
                    label: 'Receitas (MZN)',
                    data: valoresSeguros,
                    borderColor: '#27ae60',
                    backgroundColor: isHourly ? 'rgba(39, 174, 96, 0.8)' : 'rgba(39, 174, 96, 0.1)',
                    borderWidth: isHourly ? 0 : 3,
                    fill: !isHourly,
                    tension: 0.4,
                    pointBackgroundColor: '#27ae60',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#27ae60',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const valor = Math.max(0, context.parsed.y); // Garantir valor não-negativo
                                const quantidade = data.grafico.quantidades[context.dataIndex];
                                return [
                                    `Receita: MZN ${valor.toLocaleString('pt-MZ', {minimumFractionDigits: 2})}`,
                                    `Vendas: ${quantidade}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6c757d',
                            font: {
                                size: 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: '#6c757d',
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return 'MZN ' + value.toLocaleString('pt-MZ');
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    // Atualizar estatísticas
    atualizarEstatisticas(data) {
        const container = document.getElementById(this.containerId);
        
        const totalPeriodoEl = container.querySelector('#totalPeriodo');
        const totalVendasEl = container.querySelector('#totalVendas');
        
        if (totalPeriodoEl) {
            const receitaTotal = Math.max(0, data.metricas.receitaTotal); // Garantir que nunca seja negativo
            totalPeriodoEl.textContent = `MZN ${receitaTotal.toLocaleString('pt-MZ', {minimumFractionDigits: 2})}`;
        }
        
        if (totalVendasEl) {
            totalVendasEl.textContent = data.metricas.totalVendas.toLocaleString('pt-MZ');
        }
    }

    // Mostrar erro
    mostrarErro(mensagem) {
        const container = document.getElementById(this.containerId);
        const chartContainer = container.querySelector('.chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #e74c3c;">
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>${mensagem}</p>
                    </div>
                </div>
            `;
        }
    }

    // Destruir componente
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Exportar para uso global
window.ReceitasChart = ReceitasChart;
