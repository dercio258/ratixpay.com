/**
 * 🚀 DASHBOARD OTIMIZADO - RATIXPAY
 * 
 * Versão otimizada do dashboard com:
 * - Carregamento centralizado
 * - Cache inteligente
 * - Retry automático
 * - Performance melhorada
 * - Menos logs desnecessários
 */

class DashboardOptimized {
    constructor() {
        this.isInitialized = false;
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 segundos
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.updateInterval = null;
        this.chart = null;
        this.currentPeriod = 'hoje';
        
        // Configurações
        this.config = {
            apiBase: window.API_BASE,
            updateInterval: 60000, // 1 minuto
            chartAnimation: true,
            debug: false
        };
        
        // Event listeners
        this.events = new EventTarget();
        
        console.log('🚀 DashboardOptimized criado');
    }

    /**
     * Inicializar dashboard
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('⚠️ Dashboard já inicializado');
            return;
        }

        try {
            console.log('🚀 Inicializando dashboard otimizado...');
            
            // Aguardar sistema estar pronto
            await this.waitForSystemReady();
            
            // Carregar dados iniciais
            await this.loadInitialData();
            
            // Configurar interface
            this.setupUI();
            
            // Iniciar atualizações automáticas
            this.startAutoUpdates();
            
            this.isInitialized = true;
            
            this.events.dispatchEvent(new CustomEvent('dashboardInitialized'));
            console.log('✅ Dashboard inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar dashboard:', error);
            throw error;
        }
    }

    /**
     * Aguardar sistema estar pronto
     */
    async waitForSystemReady() {
        return new Promise((resolve) => {
            if (window.systemLoader && window.systemLoader.config.isConnected) {
                resolve();
            } else {
                window.systemLoader?.events.addEventListener('systemReady', resolve, { once: true });
            }
        });
    }

    /**
     * Carregar dados iniciais
     */
    async loadInitialData() {
        const promises = [
            this.loadUserData(),
            this.loadStatistics(),
            this.loadSalesData(),
            this.loadNotifications()
        ];
        
        await Promise.allSettled(promises);
    }

    /**
     * Carregar dados do usuário
     */
    async loadUserData() {
        try {
            const data = await this.apiCall('/auth/me');
            this.cache.set('userData', data, this.cacheTimeout);
            return data;
        } catch (error) {
            console.error('❌ Erro ao carregar dados do usuário:', error);
            throw error;
        }
    }

    /**
     * Carregar estatísticas
     */
    async loadStatistics(period = 'hoje') {
        try {
            const cacheKey = `statistics_${period}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && !this.isCacheExpired(cached)) {
                return cached.data;
            }
            
            const data = await this.apiCall(`/dashboard/vendedor/resumo?periodo=${period}`);
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            
            this.updateStatisticsUI(data);
            return data;
            
        } catch (error) {
            console.error('❌ Erro ao carregar estatísticas:', error);
            throw error;
        }
    }

    /**
     * Carregar dados de vendas
     */
    async loadSalesData(period = 'hoje') {
        try {
            const cacheKey = `sales_${period}`;
            const cached = this.cache.get(cacheKey);
            
            if (cached && !this.isCacheExpired(cached)) {
                return cached.data;
            }
            
            const data = await this.apiCall('/dashboard/ultimas-transacoes?page=1&limit=1000');
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            
            this.updateChart(data, period);
            return data;
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados de vendas:', error);
            throw error;
        }
    }

    /**
     * Carregar notificações
     */
    async loadNotifications() {
        try {
            const data = await this.apiCall('/notifications');
            this.updateNotificationsUI(data);
            return data;
        } catch (error) {
            console.error('❌ Erro ao carregar notificações:', error);
            // Não falhar se notificações não carregarem
        }
    }

    /**
     * Chamada de API com retry automático
     */
    async apiCall(endpoint, options = {}) {
        const url = `${this.config.apiBase}${endpoint}`;
        const retryKey = url;
        const retryCount = this.retryAttempts.get(retryKey) || 0;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                ...options
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Reset retry count on success
            this.retryAttempts.delete(retryKey);
            
            return data;
            
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`⚠️ Tentativa ${retryCount + 1}/${this.maxRetries} falhou para ${endpoint}`);
                this.retryAttempts.set(retryKey, retryCount + 1);
                
                await this.delay(1000 * (retryCount + 1));
                return this.apiCall(endpoint, options);
            } else {
                console.error(`❌ Falha definitiva para ${endpoint}:`, error);
                this.retryAttempts.delete(retryKey);
                throw error;
            }
        }
    }

    /**
     * Verificar se cache expirou
     */
    isCacheExpired(cached) {
        return Date.now() - cached.timestamp > this.cacheTimeout;
    }

    /**
     * Atualizar interface de estatísticas
     */
    updateStatisticsUI(data) {
        if (!data || !data.data) return;
        
        const stats = data.data;
        
        // Atualizar receita total
        if (stats.receitaTotal) {
            this.updateElement('receitaTotal', `MZN ${stats.receitaTotal.toFixed(2)}`);
        }
        
        // Atualizar vendas aprovadas
        if (stats.vendasAprovadas !== undefined) {
            this.updateElement('vendasAprovadas', stats.vendasAprovadas.toString());
        }
        
        // Atualizar vendas canceladas
        if (stats.vendasCanceladas !== undefined) {
            this.updateElement('vendasCanceladas', stats.vendasCanceladas.toString());
        }
        
        // Atualizar vendas pendentes
        if (stats.vendasPendentes !== undefined) {
            this.updateElement('vendasPendentes', stats.vendasPendentes.toString());
        }
    }

    /**
     * Atualizar gráfico
     */
    updateChart(salesData, period) {
        if (!salesData || !salesData.data) return;
        
        const sales = salesData.data;
        const chartData = this.processSalesData(sales, period);
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.createChart(chartData);
    }

    /**
     * Processar dados de vendas para gráfico
     */
    processSalesData(sales, period) {
        const periodMap = {
            'hoje': 24,
            'ontem': 24,
            '7dias': 7,
            '30dias': 30
        };
        
        const hours = periodMap[period] || 24;
        const labels = [];
        const data = [];
        
        for (let i = 0; i < hours; i++) {
            const date = new Date();
            date.setHours(date.getHours() - (hours - 1 - i));
            
            if (period === 'hoje' || period === 'ontem') {
                labels.push(date.getHours().toString().padStart(2, '0') + ':00');
            } else {
                labels.push(date.toLocaleDateString());
            }
            
            // Calcular vendas para este período
            const periodSales = sales.filter(sale => {
                const saleDate = new Date(sale.created_at);
                return this.isInPeriod(saleDate, date, period);
            });
            
            const total = periodSales.reduce((sum, sale) => sum + parseFloat(sale.valor || 0), 0);
            data.push(total);
        }
        
        return { labels, data };
    }

    /**
     * Verificar se data está no período
     */
    isInPeriod(saleDate, periodDate, period) {
        const now = new Date();
        
        switch (period) {
            case 'hoje':
                return saleDate.toDateString() === now.toDateString();
            case 'ontem':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                return saleDate.toDateString() === yesterday.toDateString();
            case '7dias':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                return saleDate >= weekAgo;
            case '30dias':
                const monthAgo = new Date(now);
                monthAgo.setDate(monthAgo.getDate() - 30);
                return saleDate >= monthAgo;
            default:
                return true;
        }
    }

    /**
     * Criar gráfico
     */
    createChart(chartData) {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Receita (MZN)',
                    data: chartData.data,
                    borderColor: '#f64c00',
                    backgroundColor: 'rgba(246, 76, 0, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: this.config.chartAnimation,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'MZN ' + value.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Atualizar interface de notificações
     */
    updateNotificationsUI(data) {
        if (!data || !data.notificacoes) return;
        
        const count = data.total || data.notificacoes.length;
        this.updateElement('notificationCount', count.toString());
    }

    /**
     * Atualizar elemento do DOM
     */
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * Configurar interface
     */
    setupUI() {
        // Configurar botões de período
        const periodButtons = document.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const period = e.target.dataset.period;
                this.changePeriod(period);
            });
        });
        
        // Configurar botão de atualização
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
    }

    /**
     * Mudar período
     */
    async changePeriod(period) {
        if (period === this.currentPeriod) return;
        
        this.currentPeriod = period;
        
        // Atualizar botões ativos
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
        
        // Carregar dados do novo período
        await this.loadStatistics(period);
        await this.loadSalesData(period);
    }

    /**
     * Atualizar dados
     */
    async refreshData() {
        console.log('🔄 Atualizando dados...');
        
        // Limpar cache
        this.cache.clear();
        
        // Recarregar dados
        await this.loadInitialData();
        
        console.log('✅ Dados atualizados');
    }

    /**
     * Iniciar atualizações automáticas
     */
    startAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.refreshData();
        }, this.config.updateInterval);
    }

    /**
     * Parar atualizações automáticas
     */
    stopAutoUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Destruir dashboard
     */
    destroy() {
        this.stopAutoUpdates();
        
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        this.cache.clear();
        this.retryAttempts.clear();
        this.isInitialized = false;
        
        console.log('🗑️ Dashboard destruído');
    }
}

// Instância global
window.dashboardOptimized = new DashboardOptimized();

// Inicialização automática
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.dashboardOptimized.initialize();
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
    }
});

// Exportar para uso global
window.DashboardOptimized = DashboardOptimized;
