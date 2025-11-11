/**
 * Script para Gestão de Notificações - Admin Panel
 * Gerencia o envio de notificações para vendedores
 */

class AdminNotificationsManager {
    constructor() {
        this.selectedVendedores = new Set();
        this.vendedores = [];
        this.notifications = [];
        this.init();
    }

    async init() {
        await this.carregarVendedores();
        await this.carregarHistoricoNotificacoes();
        this.configurarEventos();
    }

    configurarEventos() {
        // Formulário de notificação
        document.getElementById('notificationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.enviarNotificacao();
        });

        // Seletor de destinatário
        document.getElementById('destinatario').addEventListener('change', (e) => {
            this.toggleVendedoresSelection(e.target.value === 'selecionados');
        });
    }

    async carregarVendedores() {
        try {
            const response = await fetch(`${API_BASE}/admin/notificacoes/vendedores`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar vendedores');
            }

            const data = await response.json();
            this.vendedores = data.vendedores || [];
            this.renderizarVendedores();
        } catch (error) {
            console.error('Erro ao carregar vendedores:', error);
            this.mostrarErro('Erro ao carregar vendedores: ' + error.message);
        }
    }

    renderizarVendedores() {
        const loading = document.getElementById('vendedoresLoading');
        const grid = document.getElementById('vendedoresGrid');
        const empty = document.getElementById('vendedoresEmpty');

        loading.style.display = 'none';

        if (this.vendedores.length === 0) {
            empty.style.display = 'block';
            return;
        }

        grid.style.display = 'grid';
        grid.innerHTML = '';

        this.vendedores.forEach(vendedor => {
            const card = document.createElement('div');
            card.className = 'vendedor-card';
            card.dataset.vendedorId = vendedor.id;
            
            // Verificar se as propriedades existem antes de usá-las
            const nome = vendedor.nome_completo || vendedor.nome || 'Nome não disponível';
            const email = vendedor.email || 'Email não disponível';
            const status = vendedor.status || 'Ativa';
            
            card.innerHTML = `
                <div class="vendedor-name">${nome}</div>
                <div class="vendedor-email">${email}</div>
                <div class="vendedor-status ${status.toLowerCase()}">${status}</div>
            `;

            card.addEventListener('click', () => {
                this.toggleVendedorSelection(vendedor.id, card);
            });

            grid.appendChild(card);
        });
    }

    toggleVendedorSelection(vendedorId, card) {
        if (this.selectedVendedores.has(vendedorId)) {
            this.selectedVendedores.delete(vendedorId);
            card.classList.remove('selected');
        } else {
            this.selectedVendedores.add(vendedorId);
            card.classList.add('selected');
        }
    }

    toggleVendedoresSelection(show) {
        const grid = document.getElementById('vendedoresGrid');
        if (show) {
            grid.style.display = 'grid';
        } else {
            grid.style.display = 'none';
            this.selectedVendedores.clear();
            document.querySelectorAll('.vendedor-card.selected').forEach(card => {
                card.classList.remove('selected');
            });
        }
    }

    async enviarNotificacao() {
        const form = document.getElementById('notificationForm');
        const formData = new FormData(form);
        
        const destinatario = formData.get('destinatario');
        const vendedoresIds = destinatario === 'selecionados' 
            ? Array.from(this.selectedVendedores) 
            : this.vendedores.map(v => v.id);

        if (destinatario === 'selecionados' && vendedoresIds.length === 0) {
            this.mostrarErro('Selecione pelo menos um vendedor');
            return;
        }

        const notificationData = {
            titulo: formData.get('titulo'),
            mensagem: formData.get('mensagem'),
            tipo: formData.get('tipo'),
            prioridade: formData.get('prioridade'),
            url_redirecionamento: formData.get('url_redirecionamento') || null,
            vendedores_ids: vendedoresIds
        };

        try {
            const response = await fetch(`${API_BASE}/admin/notificacoes/enviar`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(notificationData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao enviar notificação');
            }

            const result = await response.json();
            this.mostrarSucesso(`Notificação enviada com sucesso para ${result.enviadas} vendedor(es)`);
            
            // Limpar formulário
            this.limparFormulario();
            
            // Recarregar histórico
            await this.carregarHistoricoNotificacoes();

        } catch (error) {
            console.error('Erro ao enviar notificação:', error);
            this.mostrarErro('Erro ao enviar notificação: ' + error.message);
        }
    }

    async carregarHistoricoNotificacoes() {
        try {
            const response = await fetch(`${API_BASE}/admin/notificacoes/historico`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar histórico');
            }

            const data = await response.json();
            this.notifications = data.notificacoes || [];
            this.renderizarHistorico();
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            this.mostrarErro('Erro ao carregar histórico: ' + error.message);
        }
    }

    renderizarHistorico() {
        const loading = document.getElementById('notificationsLoading');
        const table = document.getElementById('notificationsTable');
        const empty = document.getElementById('notificationsEmpty');
        const tbody = document.getElementById('notificationsTableBody');

        loading.style.display = 'none';

        if (this.notifications.length === 0) {
            empty.style.display = 'block';
            return;
        }

        table.style.display = 'block';
        tbody.innerHTML = '';

        this.notifications.forEach(notification => {
            const row = document.createElement('tr');
            
            const dataFormatada = new Date(notification.created_at).toLocaleString('pt-BR');
            const destinatario = notification.destinatario_count > 1 
                ? `${notification.destinatario_count} vendedores`
                : notification.destinatario_nome || 'N/A';

            row.innerHTML = `
                <td>${dataFormatada}</td>
                <td>${notification.titulo}</td>
                <td>
                    <span class="notification-type">${this.formatarTipo(notification.tipo)}</span>
                </td>
                <td>
                    <span class="notification-priority ${notification.prioridade}">${this.formatarPrioridade(notification.prioridade)}</span>
                </td>
                <td>${destinatario}</td>
                <td>
                    <span class="notification-status ${notification.status}">${this.formatarStatus(notification.status)}</span>
                </td>
                <td>
                    <button class="btn btn-secondary" onclick="adminNotifications.verDetalhes('${notification.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    formatarTipo(tipo) {
        const tipos = {
            'sistema': 'Sistema',
            'promocao': 'Promoção',
            'venda': 'Venda',
            'pagamento': 'Pagamento'
        };
        return tipos[tipo] || tipo;
    }

    formatarPrioridade(prioridade) {
        const prioridades = {
            'baixa': 'Baixa',
            'media': 'Média',
            'alta': 'Alta'
        };
        return prioridades[prioridade] || prioridade;
    }

    formatarStatus(status) {
        const statuses = {
            'unread': 'Não lida',
            'read': 'Lida'
        };
        return statuses[status] || status;
    }

    verDetalhes(notificationId) {
        // Implementar modal de detalhes
        console.log('Ver detalhes da notificação:', notificationId);
    }

    limparFormulario() {
        document.getElementById('notificationForm').reset();
        this.selectedVendedores.clear();
        document.querySelectorAll('.vendedor-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('vendedoresGrid').style.display = 'none';
    }

    mostrarSucesso(mensagem) {
        this.mostrarAlerta(mensagem, 'success');
    }

    mostrarErro(mensagem) {
        this.mostrarAlerta(mensagem, 'error');
    }

    mostrarAlerta(mensagem, tipo) {
        // Remover alertas existentes
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Criar novo alerta
        const alert = document.createElement('div');
        alert.className = `alert alert-${tipo}`;
        alert.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${mensagem}
        `;

        // Inserir no topo do conteúdo principal
        const mainContent = document.querySelector('.admin-main-content') || document.querySelector('.main-content') || document.body;
        if (mainContent && mainContent.firstChild) {
            mainContent.insertBefore(alert, mainContent.firstChild);
        } else if (mainContent) {
            mainContent.appendChild(alert);
        }

        // Remover após 5 segundos
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
}

// Função global para limpar formulário
function limparFormulario() {
    if (window.adminNotifications) {
        window.adminNotifications.limparFormulario();
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔓 Inicializando admin-notifications.js sem verificação de autenticação');
    
    // TEMPORARIAMENTE DESABILITADO - Verificação de autenticação
    // const userData = localStorage.getItem('userData');
    // if (userData) {
    //     try {
    //         const user = JSON.parse(userData);
    //         if (user.role !== 'admin') {
    //             console.log('Usuário não é admin, redirecionando para login...');
    //             window.location.href = 'login.html';
    //             return;
    //         }
    //     } catch (error) {
    //         console.error('Erro ao verificar dados do usuário:', error);
    //         window.location.href = 'login.html';
    //         return;
    //     }
    // } else {
    //     console.log('Dados do usuário não encontrados, redirecionando para login...');
    //     window.location.href = 'login.html';
    //     return;
    // }

    // Inicializar gerenciador de notificações
    window.adminNotifications = new AdminNotificationsManager();
});
