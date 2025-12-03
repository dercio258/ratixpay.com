(function() {
    const API_BASE = window.API_BASE || 'http://localhost:4000/api';
    const TOKEN_KEYS = ['authToken', 'token', 'adminToken'];

    const state = {
        produtos: [], // Apenas para o filtro
        estatisticas: null,
        filtros: {
            produto_id: '',
            data_inicio: '',
            data_fim: ''
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(inicializarPagina, 150);
    });

    function getToken() {
        for (const key of TOKEN_KEYS) {
            const value = localStorage.getItem(key);
            if (value) return value;
        }
        return null;
    }

    function getAuthHeaders() {
        const token = getToken();
        if (!token) return {};
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async function inicializarPagina() {
        try {
            const token = getToken();
            if (!token) {
                console.warn('Token não encontrado - aguarde GlobalAuth.');
                return;
            }

            registrarEventos();
            toggleLoading(true);

            await Promise.all([
                carregarProdutosParaFiltro(),
                carregarEstatisticas()
            ]);

        } catch (error) {
            console.error('Erro ao inicializar página de remarketing:', error);
            mostrarToast('Erro ao carregar dados de remarketing', 'error');
        } finally {
            toggleLoading(false);
        }
    }

    function registrarEventos() {
        const filtrosForm = document.getElementById('remarketingFilters');
        const limparBtn = document.getElementById('clearFiltersBtn');

        if (filtrosForm) {
            filtrosForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                atualizarFiltros();
                await carregarEstatisticas();
            });
        }

        if (limparBtn) {
            limparBtn.addEventListener('click', async () => {
                resetarFiltros();
                await carregarEstatisticas();
            });
        }
    }

    function atualizarFiltros() {
        state.filtros = {
            produto_id: document.getElementById('produtoFiltro')?.value || '',
            data_inicio: document.getElementById('dataInicio')?.value || '',
            data_fim: document.getElementById('dataFim')?.value || ''
        };
    }

    function resetarFiltros() {
        document.getElementById('produtoFiltro').value = '';
        document.getElementById('dataInicio').value = '';
        document.getElementById('dataFim').value = '';
        state.filtros = { produto_id: '', data_inicio: '', data_fim: '' };
    }

    async function carregarProdutosParaFiltro() {
        try {
            const response = await fetch(`${API_BASE}/remarketing/produtos?todos=true`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar produtos');
            }

            const data = await response.json();
            state.produtos = data.produtos || [];
            preencherFiltroProdutos();
        } catch (error) {
            console.error('Erro ao carregar produtos para filtro:', error);
            // Não mostrar toast, pois é apenas para o filtro
        }
    }

    async function carregarEstatisticas() {
        try {
            const params = new URLSearchParams();
            if (state.filtros.produto_id) params.append('produto_id', state.filtros.produto_id);
            if (state.filtros.data_inicio) params.append('data_inicio', state.filtros.data_inicio);
            if (state.filtros.data_fim) params.append('data_fim', state.filtros.data_fim);

            const response = await fetch(`${API_BASE}/remarketing/estatisticas?${params.toString()}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Erro ao buscar estatísticas');
            }

            const data = await response.json();
            state.estatisticas = data.data || {
                total_conversoes: 0,
                total_remarketings_enviados: 0,
                total_vendas_canceladas: 0,
                valor_total_convertido: 0,
                taxa_conversao: 0,
                conversoes_por_dia: []
            };

            renderizarEstatisticas();
            renderizarConversoesDiarias();
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            mostrarToast('Não foi possível carregar as estatísticas', 'error');
        }
    }

    function renderizarEstatisticas() {
        const container = document.getElementById('remarketingStats');
        if (!container) return;

        const stats = state.estatisticas || {};
        const cards = [
            {
                titulo: 'Conversões Recup.',
                valor: stats.total_conversoes || 0,
                subtitulo: 'Vendas salvas pelo remarketing'
            },
            {
                titulo: 'Remarketings Enviados',
                valor: stats.total_remarketings_enviados || 0,
                subtitulo: 'Mensagens disparadas'
            },
            {
                titulo: 'Taxa de Conversão',
                valor: `${(stats.taxa_conversao || 0).toFixed(2)}%`,
                subtitulo: 'Conversões / envios'
            },
            {
                titulo: 'Receita Recuperada',
                valor: formatarMoeda(stats.valor_total_convertido || 0),
                subtitulo: 'Total em vendas recuperadas'
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="stat-card">
                <h3>${card.titulo}</h3>
                <div class="value">${card.valor}</div>
                <div class="subtext">${card.subtitulo}</div>
            </div>
        `).join('');
    }

    function renderizarConversoesDiarias() {
        const container = document.getElementById('remarketingDaily');
        if (!container) return;

        const linhas = state.estatisticas?.conversoes_por_dia || [];

        if (!linhas.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-chart-line"></i>
                    <p>Ainda não há conversões registradas nesse período.</p>
                </div>
            `;
            return;
        }

        const rows = linhas.map(item => `
            <tr>
                <td>${formatarData(item.data)}</td>
                <td>${item.total}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="chart-table">
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Conversões</th>
                        <th>Receita</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;
    }


    function preencherFiltroProdutos() {
        const select = document.getElementById('produtoFiltro');
        if (!select) return;

        const options = ['<option value="">Todos</option>'];
        state.produtos.forEach(produto => {
            options.push(`<option value="${produto.id}">${produto.nome}</option>`);
        });
        select.innerHTML = options.join('');
    }


    function formatarMoeda(valor) {
        return (valor || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'MZN'
        });
    }

    function formatarData(data) {
        const date = new Date(data);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    function toggleLoading(show) {
        const btn = document.getElementById('applyFiltersBtn');
        if (btn) {
            btn.disabled = show;
        }
    }

    function mostrarToast(mensagem, tipo = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>${mensagem}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(50px)';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
})();

