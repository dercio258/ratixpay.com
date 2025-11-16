/**
 * Página de Vendas do Afiliado
 * Gerencia exibição e atualização de vendas
 */

class AfiliadoVendasPage {
    constructor() {
        this.page = new AfiliadoPage();
        this.loading = new LoadingManager();
        this.vendas = [];
        this.estatisticas = {
            totalVendas: 0,
            totalComissoes: 0,
            vendasPendentes: 0,
            taxaConversao: 0
        };
    }

    async init() {
        try {
            // Inicializar página base
            await this.page.init();
            
            // Renderizar header
            const header = new AfiliadoHeader(
                'Suas Vendas',
                'Acompanhe todas as vendas realizadas através dos seus links',
                'fas fa-shopping-cart'
            );
            header.render();

            // Carregar dados
            await this.carregarDados();
            
            // Configurar atualização automática
            this.configurarAtualizacao();
        } catch (error) {
            console.error('Erro ao inicializar página de vendas:', error);
            NotificationManager.error('Erro ao carregar página. Tente novamente.');
        }
    }

    async carregarDados() {
        try {
            this.loading.show('Carregando vendas...');

            // Carregar vendas e estatísticas em paralelo
            const [vendasData, statsData] = await Promise.all([
                ApiHelper.get('/afiliados/minhas-vendas'),
                ApiHelper.get('/afiliados/minhas-vendas-estatisticas?periodo=30d')
            ]);

            if (vendasData.success) {
                this.vendas = vendasData.data || [];
            }

            if (statsData.success) {
                this.estatisticas = {
                    totalVendas: statsData.data.totalVendas || 0,
                    totalComissoes: statsData.data.totalComissoes || 0,
                    vendasPendentes: statsData.data.vendasPendentes || 0,
                    taxaConversao: statsData.data.taxaConversao || 0
                };
            }

            this.atualizarInterface();
            this.loading.hide();
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            this.loading.hide();
            NotificationManager.error('Erro ao carregar vendas. Tente novamente.');
        }
    }

    atualizarInterface() {
        // Atualizar estatísticas
        document.getElementById('totalVendas').textContent = this.estatisticas.totalVendas;
        document.getElementById('totalComissoes').textContent = Formatters.moeda(this.estatisticas.totalComissoes);
        document.getElementById('vendasPendentes').textContent = this.estatisticas.vendasPendentes;
        document.getElementById('taxaConversao').textContent = `${this.estatisticas.taxaConversao.toFixed(2)}%`;

        // Renderizar tabela
        this.renderizarTabela();
    }

    renderizarTabela() {
        const tbody = document.getElementById('vendasTable');
        const emptyState = document.getElementById('emptyState');
        
        if (!tbody) return;

        if (this.vendas.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        tbody.innerHTML = this.vendas.map(venda => {
            const statusClass = this.getStatusClass(venda.status);
            const statusText = this.getStatusText(venda.status);
            
            return `
                <tr>
                    <td>${venda.id}</td>
                    <td>${venda.produto?.nome || 'N/A'}</td>
                    <td>${Formatters.data(venda.data_venda)}</td>
                    <td><strong>${Formatters.moeda(venda.valor_venda)}</strong></td>
                    <td><strong style="color: var(--success-color);">${Formatters.moeda(venda.valor_comissao)}</strong></td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-primary btn-sm" onclick="vendasPage.verificarStatus('${venda.transaction_id}')" title="Verificar Status">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                            <button class="btn btn-outline-info btn-sm" onclick="vendasPage.verDetalhes('${venda.id}')" title="Ver Detalhes">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStatusClass(status) {
        const classes = {
            'pago': 'badge-success',
            'pendente': 'badge-warning',
            'cancelado': 'badge-danger'
        };
        return classes[status] || 'badge-info';
    }

    getStatusText(status) {
        const texts = {
            'pago': 'Pago',
            'pendente': 'Pendente',
            'cancelado': 'Cancelado'
        };
        return texts[status] || status;
    }

    async verificarStatus(transactionId) {
        try {
            NotificationManager.info('Verificando status da venda...');
            
            const response = await fetch(`${AFILIADO_CONFIG.API_BASE}/e2payments/status/${transactionId}`);
            const data = await response.json();
            
            if (data.success && data.status === 'approved') {
                await this.atualizarStatus(transactionId, 'pago');
                NotificationManager.success('Venda aprovada! Sua comissão foi creditada.');
                await this.carregarDados();
            } else {
                NotificationManager.warning(`Status atual: ${data.status || 'Pendente'}`);
            }
        } catch (error) {
            console.error('Erro ao verificar status:', error);
            NotificationManager.error('Erro ao verificar status da venda');
        }
    }

    async atualizarStatus(transactionId, status) {
        try {
            await ApiHelper.put(`/afiliados/venda/${transactionId}/status`, { status });
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            throw error;
        }
    }

    verDetalhes(vendaId) {
        const venda = this.vendas.find(v => v.id === vendaId);
        if (!venda) return;

        const detalhes = `
Venda #${venda.id}

Produto: ${venda.produto?.nome || 'N/A'}
Data: ${Formatters.data(venda.data_venda)}
Valor: ${Formatters.moeda(venda.valor_venda)}
Comissão: ${Formatters.moeda(venda.valor_comissao)}
Status: ${this.getStatusText(venda.status)}
Transaction ID: ${venda.transaction_id || 'N/A'}
        `.trim();

        alert(detalhes);
    }

    configurarAtualizacao() {
        // Atualizar a cada 60 segundos
        setInterval(async () => {
            await this.carregarDados();
        }, 60000);
    }
}

// Inicializar página
let vendasPage;
document.addEventListener('DOMContentLoaded', async () => {
    vendasPage = new AfiliadoVendasPage();
    await vendasPage.init();
});

