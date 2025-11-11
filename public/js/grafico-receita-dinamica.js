/**
 * 📊 GRÁFICO DE RECEITA DINÂMICA - SISTEMA RATIXPAY
 * 
 * Este script implementa um gráfico dinâmico que:
 * - Mostra a receita diária dos últimos 30 dias
 * - Valor máximo do gráfico é sempre a receita total atual
 * - Atualiza automaticamente quando há mudanças
 * - Permite filtros por período
 * - Mostra estatísticas em tempo real
 */

class GraficoReceitaDinamica {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            dias: 30,
            tipoGrafico: 'line', // line, bar, area
            cores: {
                receita: '#10B981',
                receitaHover: '#059669',
                fundo: '#F3F4F6',
                texto: '#374151',
                grid: '#E5E7EB'
            },
            ...options
        };
        
        this.chart = null;
        this.dados = null;
        this.estatisticas = null;
        this.configuracao = null;
        
        this.init();
    }
    
    async init() {
        try {
            console.log('🔄 Inicializando gráfico de receita dinâmica...');
            
            // Verificar se o container existe
            if (!this.container) {
                throw new Error(`Container com ID '${this.containerId}' não encontrado`);
            }
            
            // Criar estrutura HTML
            this.criarEstruturaHTML();
            
            // Carregar dados iniciais
            await this.carregarDados();
            
            // Criar gráfico
            this.criarGrafico();
            
            // Configurar eventos
            this.configurarEventos();
            
            // Atualizar estatísticas
            this.atualizarEstatisticas();
            
            console.log('✅ Gráfico de receita dinâmica inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar gráfico:', error);
            this.mostrarErro('Erro ao inicializar gráfico: ' + error.message);
        }
    }
    
    criarEstruturaHTML() {
        this.container.innerHTML = `
            <div class="grafico-receita-container">
                <!-- Cabeçalho com controles -->
                <div class="grafico-header">
                    <div class="grafico-titulo">
                        <h3>📊 Receita Diária</h3>
                        <p class="subtitulo">Receita dos últimos <span id="dias-periodo">${this.options.dias}</span> dias</p>
                    </div>
                    
                    <div class="grafico-controles">
                        <div class="controle-grupo">
                            <label for="filtro-dias">Período:</label>
                            <select id="filtro-dias" class="form-select">
                                <option value="7">7 dias</option>
                                <option value="15">15 dias</option>
                                <option value="30" selected>30 dias</option>
                                <option value="60">60 dias</option>
                                <option value="90">90 dias</option>
                            </select>
                        </div>
                        
                        <div class="controle-grupo">
                            <label for="tipo-grafico">Tipo:</label>
                            <select id="tipo-grafico" class="form-select">
                                <option value="line" selected>Linha</option>
                                <option value="bar">Barras</option>
                                <option value="area">Área</option>
                            </select>
                        </div>
                        
                        <button id="btn-atualizar" class="btn btn-primary">
                            <i class="fas fa-sync-alt"></i> Atualizar
                        </button>
                    </div>
                </div>
                
                <!-- Estatísticas rápidas -->
                <div class="grafico-estatisticas" id="estatisticas-container">
                    <div class="estatistica-item">
                        <div class="estatistica-valor" id="receita-total">MZN 0.00</div>
                        <div class="estatistica-label">Receita Total</div>
                    </div>
                    <div class="estatistica-item">
                        <div class="estatistica-valor" id="receita-periodo">MZN 0.00</div>
                        <div class="estatistica-label">Receita do Período</div>
                    </div>
                    <div class="estatistica-item">
                        <div class="estatistica-valor" id="media-diaria">MZN 0.00</div>
                        <div class="estatistica-label">Média Diária</div>
                    </div>
                    <div class="estatistica-item">
                        <div class="estatistica-valor" id="dias-vendas">0</div>
                        <div class="estatistica-label">Dias com Vendas</div>
                    </div>
                </div>
                
                <!-- Container do gráfico -->
                <div class="grafico-chart-container">
                    <canvas id="chart-receita" width="400" height="200"></canvas>
                </div>
                
                <!-- Loading e erro -->
                <div id="loading" class="loading" style="display: none;">
                    <div class="spinner"></div>
                    <p>Carregando dados...</p>
                </div>
                
                <div id="erro" class="erro" style="display: none;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p id="erro-mensagem">Erro ao carregar dados</p>
                </div>
                
                <!-- Legenda e informações -->
                <div class="grafico-info">
                    <div class="info-item">
                        <span class="info-cor" style="background-color: ${this.options.cores.receita}"></span>
                        <span>Receita diária (valor máximo: <span id="valor-maximo">MZN 0.00</span>)</span>
                    </div>
                    <div class="info-item">
                        <small>Última atualização: <span id="ultima-atualizacao">-</span></small>
                    </div>
                </div>
            </div>
        `;
    }
    
    async carregarDados() {
        try {
            this.mostrarLoading(true);
            this.ocultarErro();
            
            console.log(`🔄 Carregando dados de receita para ${this.options.dias} dias...`);
            
            // Buscar dados da API
            const response = await fetch(`/api/dashboard/receita-diaria?dias=${this.options.dias}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.getAuthToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erro ao carregar dados');
            }
            
            this.dados = result.data.receita_diaria;
            this.estatisticas = result.data.estatisticas;
            this.configuracao = result.data.configuracao_grafico;
            
            console.log(`✅ Dados carregados: ${this.dados.length} dias`);
            
            // Atualizar período exibido
            document.getElementById('dias-periodo').textContent = this.options.dias;
            
            // Atualizar valor máximo
            document.getElementById('valor-maximo').textContent = this.configuracao.valor_maximo_formatado;
            
            // Atualizar última atualização
            document.getElementById('ultima-atualizacao').textContent = new Date().toLocaleString('pt-BR');
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            this.mostrarErro('Erro ao carregar dados: ' + error.message);
        } finally {
            this.mostrarLoading(false);
        }
    }
    
    criarGrafico() {
        if (!this.dados || this.dados.length === 0) {
            console.warn('⚠️ Nenhum dado disponível para criar gráfico');
            return;
        }
        
        try {
            const ctx = document.getElementById('chart-receita').getContext('2d');
            
            // Destruir gráfico existente se houver
            if (this.chart) {
                this.chart.destroy();
            }
            
            // Preparar dados para o Chart.js
            const labels = this.dados.map(dia => dia.data_formatada);
            const receitas = this.dados.map(dia => dia.receita);
            const percentuais = this.dados.map(dia => dia.percentual_receita_total);
            
            // Calcular pontos onde a receita aumenta (para destacar no gráfico)
            const pontosReceita = this.calcularPontosReceita(receitas);
            
            // Configuração do gráfico
            const config = {
                type: this.options.tipoGrafico,
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Receita Diária',
                            data: receitas,
                            backgroundColor: this.options.cores.receita + '20',
                            borderColor: this.options.cores.receita,
                            borderWidth: 2,
                            fill: this.options.tipoGrafico === 'area',
                            tension: 0.4,
                            // Configuração dinâmica dos pontos baseada na receita
                            pointBackgroundColor: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? '#FF6B6B' : this.options.cores.receita
                            ),
                            pointBorderColor: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? '#ffffff' : '#ffffff'
                            ),
                            pointBorderWidth: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? 3 : 2
                            ),
                            pointRadius: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? 6 : 4
                            ),
                            pointHoverRadius: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? 8 : 6
                            ),
                            pointHoverBackgroundColor: pontosReceita.map(ponto => 
                                ponto.receitaAumentou ? '#FF5252' : this.options.cores.receitaHover
                            ),
                            pointHoverBorderColor: '#ffffff'
                        },
                        // Dataset adicional para destacar tendências de aumento
                        {
                            label: 'Tendência de Aumento',
                            data: this.calcularTendenciaAumento(receitas),
                            type: 'line',
                            borderColor: '#FF6B6B',
                            borderWidth: 1,
                            borderDash: [5, 5],
                            fill: false,
                            pointRadius: 0,
                            tension: 0.1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                                            generateLabels: function(chart) {
                                return [
                                    {
                                        text: '📈 Receita Aumentou',
                                        fillStyle: '#FF6B6B',
                                        strokeStyle: '#FF6B6B',
                                        pointStyle: 'circle',
                                        lineWidth: 0
                                    },
                                    {
                                        text: '💰 Receita Normal',
                                        fillStyle: '#10B981',
                                        strokeStyle: '#10B981',
                                        pointStyle: 'circle',
                                        lineWidth: 0
                                    },
                                    {
                                        text: '📊 Tendência de Aumento',
                                        fillStyle: '#FF6B6B',
                                        strokeStyle: '#FF6B6B',
                                        pointStyle: 'line',
                                        lineWidth: 2
                                    }
                                ];
                            }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#ffffff',
                            bodyColor: '#ffffff',
                            borderColor: this.options.cores.receita,
                            borderWidth: 1,
                            callbacks: {
                                title: function(context) {
                                    return `📅 ${context[0].label}`;
                                },
                                label: function(context) {
                                    const valor = context.parsed.y;
                                    const percentual = percentuais[context.dataIndex];
                                    const ponto = pontosReceita[context.dataIndex];
                                    
                                    const labels = [
                                        `💰 Receita: MZN ${valor.toFixed(2)}`,
                                        `📊 ${percentual}% da receita total`
                                    ];
                                    
                                    // Adicionar informações sobre aumento da receita
                                    if (ponto.receitaAumentou && ponto.diferenca > 0) {
                                        labels.push(`📈 Aumentou: +MZN ${ponto.diferenca.toFixed(2)}`);
                                        if (ponto.percentualAumento > 0) {
                                            labels.push(`📊 Crescimento: +${ponto.percentualAumento.toFixed(1)}%`);
                                        }
                                    } else if (ponto.receitaAumentou && ponto.diferenca === 0) {
                                        labels.push(`🆕 Primeira receita do período`);
                                    }
                                    
                                    return labels;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: this.configuracao.valor_maximo,
                            grid: {
                                color: this.options.cores.grid,
                                drawBorder: false
                            },
                            ticks: {
                                color: this.options.cores.texto,
                                callback: function(value) {
                                    return 'MZN ' + value.toFixed(0);
                                }
                            }
                        },
                        x: {
                            grid: {
                                color: this.options.cores.grid,
                                drawBorder: false
                            },
                            ticks: {
                                color: this.options.cores.texto,
                                maxRotation: 45,
                                minRotation: 0
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    animation: {
                        duration: 1000,
                        easing: 'easeInOutQuart'
                    }
                }
            };
            
            // Criar gráfico
            this.chart = new Chart(ctx, config);
            
            console.log('✅ Gráfico criado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao criar gráfico:', error);
            this.mostrarErro('Erro ao criar gráfico: ' + error.message);
        }
    }
    
    /**
     * Calcula a linha de tendência para destacar aumentos na receita
     * @param {Array} receitas - Array de valores de receita
     * @returns {Array} Array com valores da linha de tendência
     */
    calcularTendenciaAumento(receitas) {
        if (!receitas || receitas.length === 0) return [];
        
        const tendencia = [];
        let receitaAnterior = 0;
        
        receitas.forEach((receita, index) => {
            const receitaAtual = parseFloat(receita || 0);
            
            if (receitaAtual > receitaAnterior) {
                // Se a receita aumentou, mostrar a linha de tendência
                tendencia.push(receitaAtual);
            } else {
                // Se não aumentou, não mostrar a linha
                tendencia.push(null);
            }
            
            receitaAnterior = receitaAtual;
        });
        
        return tendencia;
    }
    
    /**
     * Calcula os pontos onde a receita aumenta para destacar no gráfico
     * @param {Array} receitas - Array de valores de receita
     * @returns {Array} Array com informações sobre cada ponto
     */
    calcularPontosReceita(receitas) {
        if (!receitas || receitas.length === 0) return [];
        
        const pontos = [];
        let receitaAnterior = 0;
        
        receitas.forEach((receita, index) => {
            const receitaAtual = parseFloat(receita || 0);
            const receitaAumentou = receitaAtual > receitaAnterior;
            
            pontos.push({
                index: index,
                receita: receitaAtual,
                receitaAnterior: receitaAnterior,
                receitaAumentou: receitaAumentou,
                diferenca: receitaAumentou ? receitaAtual - receitaAnterior : 0,
                percentualAumento: receitaAnterior > 0 ? 
                    ((receitaAtual - receitaAnterior) / receitaAnterior * 100) : 0
            });
            
            receitaAnterior = receitaAtual;
        });
        
        console.log('📊 Pontos de receita calculados:', pontos);
        return pontos;
    }
    
    atualizarEstatisticas() {
        if (!this.estatisticas) return;
        
        try {
            // Atualizar valores das estatísticas
            document.getElementById('receita-total').textContent = this.estatisticas.receita_total_formatada;
            document.getElementById('receita-periodo').textContent = this.estatisticas.receita_periodo_formatada;
            document.getElementById('media-diaria').textContent = this.estatisticas.media_diaria_formatada;
            document.getElementById('dias-vendas').textContent = this.estatisticas.dias_com_vendas;
            
            // Adicionar animação aos valores
            this.animarValores();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar estatísticas:', error);
        }
    }
    
    animarValores() {
        // Animar contadores
        const elementos = [
            { id: 'receita-total', valor: this.estatisticas.receita_total },
            { id: 'receita-periodo', valor: this.estatisticas.receita_periodo },
            { id: 'media-diaria', valor: this.estatisticas.media_diaria }
        ];
        
        elementos.forEach(item => {
            const elemento = document.getElementById(item.id);
            if (elemento) {
                this.animarContador(elemento, item.valor, 1000);
            }
        });
    }
    
    animarContador(elemento, valorFinal, duracao) {
        const inicio = performance.now();
        const valorInicial = 0;
        
        function animar(tempoAtual) {
            const tempoDecorrido = tempoAtual - inicio;
            const progresso = Math.min(tempoDecorrido / duracao, 1);
            
            // Função de easing
            const easeOutQuart = 1 - Math.pow(1 - progresso, 4);
            const valorAtual = valorInicial + (valorFinal - valorInicial) * easeOutQuart;
            
            elemento.textContent = 'MZN ' + valorAtual.toFixed(2);
            
            if (progresso < 1) {
                requestAnimationFrame(animar);
            }
        }
        
        requestAnimationFrame(animar);
    }
    
    configurarEventos() {
        // Filtro de dias
        document.getElementById('filtro-dias').addEventListener('change', (e) => {
            this.options.dias = parseInt(e.target.value);
            this.atualizarGrafico();
        });
        
        // Tipo de gráfico
        document.getElementById('tipo-grafico').addEventListener('change', (e) => {
            this.options.tipoGrafico = e.target.value;
            this.criarGrafico();
        });
        
        // Botão atualizar
        document.getElementById('btn-atualizar').addEventListener('click', () => {
            this.atualizarGrafico();
        });
        
        // Atualização automática a cada 5 minutos
        setInterval(() => {
            this.atualizarGrafico();
        }, 5 * 60 * 1000);
    }
    
    async atualizarGrafico() {
        try {
            console.log('🔄 Atualizando gráfico...');
            
            // Atualizar dados
            await this.carregarDados();
            
            // Recriar gráfico
            this.criarGrafico();
            
            // Atualizar estatísticas
            this.atualizarEstatisticas();
            
            console.log('✅ Gráfico atualizado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao atualizar gráfico:', error);
        }
    }
    
    mostrarLoading(mostrar) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = mostrar ? 'flex' : 'none';
        }
    }
    
    mostrarErro(mensagem) {
        const erro = document.getElementById('erro');
        const erroMensagem = document.getElementById('erro-mensagem');
        
        if (erro && erroMensagem) {
            erroMensagem.textContent = mensagem;
            erro.style.display = 'flex';
        }
    }
    
    ocultarErro() {
        const erro = document.getElementById('erro');
        if (erro) {
            erro.style.display = 'none';
        }
    }
    
    getAuthToken() {
        // Buscar token do localStorage ou de onde estiver armazenado
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
    }
    
    // Métodos públicos para controle externo
    atualizar() {
        return this.atualizarGrafico();
    }
    
    alterarPeriodo(dias) {
        this.options.dias = dias;
        document.getElementById('filtro-dias').value = dias;
        return this.atualizarGrafico();
    }
    
    alterarTipo(tipo) {
        this.options.tipoGrafico = tipo;
        document.getElementById('tipo-grafico').value = tipo;
        this.criarGrafico();
    }
    
    destruir() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Estilos CSS inline para o gráfico
const estilosGrafico = `
<style>
.grafico-receita-container {
    background: #ffffff;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    margin: 20px 0;
}

.grafico-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
}

.grafico-titulo h3 {
    margin: 0 0 8px 0;
    color: #111827;
    font-size: 1.5rem;
    font-weight: 600;
}

.grafico-titulo .subtitulo {
    margin: 0;
    color: #6B7280;
    font-size: 0.875rem;
}

.grafico-controles {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
}

.controle-grupo {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.controle-grupo label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
}

.form-select {
    padding: 8px 12px;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    font-size: 0.875rem;
    background: #ffffff;
    color: #374151;
}

.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
}

.btn-primary {
    background: #3B82F6;
    color: #ffffff;
}

.btn-primary:hover {
    background: #2563EB;
}

.grafico-estatisticas {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 24px;
    padding: 20px;
    background: #F9FAFB;
    border-radius: 8px;
}

.estatistica-item {
    text-align: center;
}

.estatistica-valor {
    font-size: 1.5rem;
    font-weight: 700;
    color: #059669;
    margin-bottom: 4px;
}

.estatistica-label {
    font-size: 0.875rem;
    color: #6B7280;
    font-weight: 500;
}

.grafico-chart-container {
    position: relative;
    height: 400px;
    margin-bottom: 20px;
}

.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #6B7280;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #E5E7EB;
    border-top: 4px solid #3B82F6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.erro {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: #DC2626;
    background: #FEF2F2;
    border-radius: 8px;
    border: 1px solid #FECACA;
}

.erro i {
    font-size: 2rem;
    margin-bottom: 16px;
}

.grafico-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
    font-size: 0.875rem;
    color: #6B7280;
}

.info-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.info-cor {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}

@media (max-width: 768px) {
    .grafico-header {
        flex-direction: column;
        align-items: stretch;
    }
    
    .grafico-controles {
        justify-content: stretch;
    }
    
    .grafico-estatisticas {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .grafico-info {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
    }
}
</style>
`;

// Adicionar estilos ao head
if (!document.getElementById('estilos-grafico-receita')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'estilos-grafico-receita';
    styleElement.innerHTML = estilosGrafico;
    document.head.appendChild(styleElement);
}

// Exportar para uso global
window.GraficoReceitaDinamica = GraficoReceitaDinamica;

// Exemplo de uso:
// const grafico = new GraficoReceitaDinamica('container-grafico');
// grafico.alterarPeriodo(15); // Alterar para 15 dias
// grafico.alterarTipo('bar'); // Alterar para gráfico de barras
