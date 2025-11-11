class ExpertsManagement {
    constructor() {
        this.experts = [];
        this.produtos = [];
        this.currentExpert = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        console.log('🔄 Inicializando gestão de experts...');
        this.setupEventListeners();
        
        // Carregar dados de forma sequencial para evitar conflitos
        this.carregarDadosIniciais();
        this.setupAutoRefresh();
    }

    async carregarDadosIniciais() {
        try {
            console.log('🔄 Carregando dados iniciais...');
            
            // Carregar experts primeiro
            await this.carregarExperts();
            
            // Aguardar um pouco antes de carregar produtos
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Carregar produtos
            await this.carregarProdutos();
            
            console.log('✅ Dados iniciais carregados com sucesso');
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            this.mostrarMensagem('Erro ao carregar dados iniciais', 'error');
        }
    }

    setupEventListeners() {
        // Botões principais
        document.getElementById('btn-novo-expert')?.addEventListener('click', () => this.abrirModalNovoExpert());
        document.getElementById('btn-associar-produtos')?.addEventListener('click', () => this.abrirModalAssociarProdutos());
        document.getElementById('btn-atualizar-lista')?.addEventListener('click', () => this.atualizarLista());

        // Modal expert
        document.getElementById('close-modal-expert')?.addEventListener('click', () => this.fecharModalExpert());
        document.getElementById('cancelar-expert')?.addEventListener('click', () => this.fecharModalExpert());
        document.getElementById('form-expert')?.addEventListener('submit', (e) => this.salvarExpert(e));

        // Modal associar produtos
        document.getElementById('close-modal-associar')?.addEventListener('click', () => this.fecharModalAssociar());
        document.getElementById('cancelar-associar')?.addEventListener('click', () => this.fecharModalAssociar());
        document.getElementById('salvar-associacao')?.addEventListener('click', () => this.salvarAssociacao());

        // Fechar modais clicando fora
        window.addEventListener('click', (e) => {
            const modalExpert = document.getElementById('modal-expert');
            const modalAssociar = document.getElementById('modal-associar-produtos');
            
            if (e.target === modalExpert) {
                this.fecharModalExpert();
            }
            if (e.target === modalAssociar) {
                this.fecharModalAssociar();
            }
        });
    }


    renderizarExperts() {
        const container = document.getElementById('experts-grid');
        if (!container) return;

        if (this.isLoading) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--primary-orange);"></i>
                    <h3>Carregando experts...</h3>
                    <p>Aguarde enquanto buscamos os dados.</p>
                </div>
            `;
            return;
        }

        if (this.experts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-tie"></i>
                    <h3>Nenhum expert cadastrado</h3>
                    <p>Comece criando seu primeiro expert para associar aos produtos e oferecer suporte especializado aos seus clientes.</p>
                    <button class="btn btn-primary" onclick="expertsManagement.abrirModalNovoExpert()">
                        <i class="fas fa-plus"></i> Criar Primeiro Expert
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.experts.map(expert => {
            const produtosAssociados = this.produtos.filter(p => p.expert_id === expert.id).length;
            
            return `
                <div class="expert-card" data-expert-id="${expert.id}">
                    <div class="expert-header">
                        <div class="expert-info">
                            <h3>${expert.nome}</h3>
                            <p class="expert-profession">${expert.profissao}</p>
                        </div>
                        <div class="expert-status">
                            <span class="status-badge ${expert.ativo ? 'status-active' : 'status-inactive'}">
                                ${expert.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                    </div>
                    
                    <div class="expert-details">
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fas fa-envelope"></i>
                            </div>
                            <span class="detail-text">${expert.email}</span>
                        </div>
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fab fa-whatsapp"></i>
                            </div>
                            <a href="https://wa.me/${expert.whatsapp}" target="_blank" class="detail-link">
                                ${expert.whatsapp}
                            </a>
                        </div>
                        <div class="detail-item">
                            <div class="detail-icon">
                                <i class="fas fa-box"></i>
                            </div>
                            <span class="detail-text">
                                ${produtosAssociados} produto${produtosAssociados !== 1 ? 's' : ''} associado${produtosAssociados !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    
                    <div class="expert-actions">
                        <button class="btn btn-sm btn-secondary" onclick="expertsManagement.editarExpert('${expert.id}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="expertsManagement.excluirExpert('${expert.id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    atualizarSelectExperts() {
        const select = document.getElementById('select-expert');
        if (!select) return;

        select.innerHTML = '<option value="">Selecione um expert</option>' +
            this.experts.filter(expert => expert.ativo).map(expert => 
                `<option value="${expert.id}">${expert.nome} - ${expert.profissao}</option>`
            ).join('');
    }

    abrirModalNovoExpert() {
        this.currentExpert = null;
        document.getElementById('modal-expert-title').textContent = 'Novo Expert';
        document.getElementById('form-expert').reset();
        document.getElementById('expert-id').value = '';
        document.getElementById('modal-expert').style.display = 'block';
    }

    editarExpert(expertId) {
        const expert = this.experts.find(e => e.id === expertId);
        if (!expert) return;

        this.currentExpert = expert;
        document.getElementById('modal-expert-title').textContent = 'Editar Expert';
        document.getElementById('expert-id').value = expert.id;
        document.getElementById('expert-nome').value = expert.nome;
        document.getElementById('expert-email').value = expert.email;
        document.getElementById('expert-whatsapp').value = expert.whatsapp;
        document.getElementById('expert-profissao').value = expert.profissao;
        document.getElementById('modal-expert').style.display = 'block';
    }

    fecharModalExpert() {
        document.getElementById('modal-expert').style.display = 'none';
        this.currentExpert = null;
    }

    async salvarExpert(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const dados = {
            nome: formData.get('nome'),
            email: formData.get('email'),
            whatsapp: formData.get('whatsapp'),
            profissao: formData.get('profissao')
        };

        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('Token não encontrado');
            }

            const isEdit = this.currentExpert !== null;
            const url = isEdit ? `${window.API_BASE}/experts/${this.currentExpert.id}` : `${window.API_BASE}/experts`;
            const method = isEdit ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dados)
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarMensagem(
                    isEdit ? 'Expert atualizado com sucesso!' : 'Expert criado com sucesso!',
                    'success'
                );
                this.fecharModalExpert();
                this.carregarExperts();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar expert:', error);
            this.mostrarMensagem(error.message, 'error');
        }
    }

    async excluirExpert(expertId) {
        const expert = this.experts.find(e => e.id === expertId);
        if (!expert) return;

        if (!confirm(`Tem certeza que deseja excluir o expert "${expert.nome}"?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('Token não encontrado');
            }

            const response = await fetch(`${window.API_BASE}/experts/${expertId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarMensagem('Expert excluído com sucesso!', 'success');
                this.carregarExperts();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ Erro ao excluir expert:', error);
            this.mostrarMensagem(error.message, 'error');
        }
    }

    abrirModalAssociarProdutos() {
        if (this.experts.length === 0) {
            this.mostrarMensagem('Você precisa ter pelo menos um expert cadastrado para associar produtos.', 'warning');
            return;
        }

        this.carregarProdutosParaAssociacao();
        document.getElementById('modal-associar-produtos').style.display = 'block';
    }

    fecharModalAssociar() {
        document.getElementById('modal-associar-produtos').style.display = 'none';
    }

    carregarProdutosParaAssociacao() {
        const container = document.getElementById('produtos-list');
        if (!container) return;

        if (this.produtos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box"></i>
                    <h3>Nenhum produto encontrado</h3>
                    <p>Crie produtos primeiro para poder associá-los aos experts.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.produtos.map(produto => `
            <div class="produto-item">
                <label class="checkbox-label">
                    <input type="checkbox" value="${produto.id}" class="produto-checkbox">
                    <div class="produto-info">
                        <h4>${produto.nome}</h4>
                        <p>ID: ${produto.custom_id}</p>
                        ${produto.expert_id ? `<span class="expert-associado">Expert: ${this.getExpertName(produto.expert_id)}</span>` : ''}
                    </div>
                </label>
            </div>
        `).join('');
    }

    getExpertName(expertId) {
        const expert = this.experts.find(e => e.id === expertId);
        return expert ? expert.nome : 'Desconhecido';
    }

    async salvarAssociacao() {
        const expertId = document.getElementById('select-expert').value;
        const checkboxes = document.querySelectorAll('.produto-checkbox:checked');
        
        if (!expertId) {
            this.mostrarMensagem('Selecione um expert', 'warning');
            return;
        }

        if (checkboxes.length === 0) {
            this.mostrarMensagem('Selecione pelo menos um produto', 'warning');
            return;
        }

        const produtoIds = Array.from(checkboxes).map(cb => cb.value);

        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                throw new Error('Token não encontrado');
            }

            const response = await fetch(`${window.API_BASE}/experts/${expertId}/associar-produtos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ produtoIds })
            });

            const result = await response.json();

            if (result.success) {
                this.mostrarMensagem(`${result.data.produtosAssociados} produtos associados com sucesso!`, 'success');
                this.fecharModalAssociar();
                this.carregarProdutos();
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('❌ Erro ao associar produtos:', error);
            this.mostrarMensagem(error.message, 'error');
        }
    }

    mostrarMensagem(mensagem, tipo = 'info') {
        // Criar elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${tipo}`;
        notification.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'error' ? 'exclamation-circle' : tipo === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${mensagem}</span>
        `;

        // Adicionar ao body
        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Nova funcionalidade: Atualizar lista
    async atualizarLista() {
        console.log('🔄 Atualizando lista de experts...');
        this.isLoading = true;
        this.renderizarExperts();
        
        try {
            await this.carregarDadosIniciais();
            this.mostrarMensagem('Lista atualizada com sucesso!', 'success');
        } catch (error) {
            console.error('❌ Erro ao atualizar lista:', error);
            this.mostrarMensagem('Erro ao atualizar lista', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    // Nova funcionalidade: Auto-refresh
    setupAutoRefresh() {
        // Atualizar automaticamente a cada 5 minutos
        setInterval(() => {
            if (!this.isLoading) {
                console.log('🔄 Auto-refresh: atualizando dados...');
                this.carregarDadosIniciais();
            }
        }, 5 * 60 * 1000); // 5 minutos
    }

    // Melhorar carregamento com loading
    async carregarExperts() {
        try {
            console.log('🔄 Carregando experts...');
            
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                console.error('❌ Token não encontrado');
                return;
            }

            const response = await fetch(`${window.API_BASE}/experts`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.experts = data.data;
                this.renderizarExperts();
                this.atualizarSelectExperts();
                console.log(`✅ ${this.experts.length} experts carregados`);
            } else {
                console.error('❌ Erro ao carregar experts:', data.message);
                this.mostrarMensagem('Erro ao carregar experts', 'error');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar experts:', error);
            this.mostrarMensagem('Erro ao carregar experts', 'error');
        }
    }

    // Melhorar carregamento de produtos
    async carregarProdutos() {
        try {
            console.log('🔄 Carregando produtos...');
            
            const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
            if (!token) {
                console.error('❌ Token não encontrado');
                this.mostrarMensagem('Token de autenticação não encontrado', 'error');
                return;
            }

            console.log('🔑 Token encontrado, fazendo requisição...');
            console.log('🌐 API_BASE:', window.API_BASE);

            const response = await fetch(`${window.API_BASE}/produtos`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erro HTTP:', response.status, errorText);
                throw new Error(`Erro HTTP: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📊 Dados recebidos:', data);
            
            if (data && data.success) {
                this.produtos = data.data || [];
                console.log(`✅ ${this.produtos.length} produtos carregados`);
            } else {
                console.error('❌ Resposta inválida:', data);
                this.mostrarMensagem('Erro ao carregar produtos: resposta inválida', 'error');
            }

        } catch (error) {
            console.error('❌ Erro ao carregar produtos:', error);
            console.error('❌ Stack trace:', error.stack);
            this.mostrarMensagem(`Erro ao carregar produtos: ${error.message}`, 'error');
        }
    }
}

// Inicializar quando a página carregar
let expertsManagement;
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado, verificando dependências...');
    
    // Verificar se estamos na página de experts
    const expertsGrid = document.getElementById('experts-grid');
    if (expertsGrid) {
        console.log('✅ Página de experts detectada');
        
        // Verificar se API_BASE está definido
        if (typeof window.API_BASE === 'undefined') {
            console.error('❌ API_BASE não está definido');
            document.getElementById('experts-grid').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Erro de Configuração</h3>
                    <p>API_BASE não está definido. Verifique se os scripts de configuração foram carregados.</p>
                </div>
            `;
            return;
        }
        
        console.log('✅ API_BASE definido:', window.API_BASE);
        
        // Verificar token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            console.error('❌ Token não encontrado');
            document.getElementById('experts-grid').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lock"></i>
                    <h3>Acesso Negado</h3>
                    <p>Você precisa estar logado para acessar esta página.</p>
                    <button class="btn btn-primary" onclick="window.location.href='/login.html'">
                        <i class="fas fa-sign-in-alt"></i> Fazer Login
                    </button>
                </div>
            `;
            return;
        }
        
        console.log('✅ Token encontrado');
        
        // Inicializar gestão de experts
        try {
            expertsManagement = new ExpertsManagement();
            console.log('✅ ExpertsManagement inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar ExpertsManagement:', error);
            document.getElementById('experts-grid').innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <h3>Erro de Inicialização</h3>
                    <p>Erro ao inicializar a gestão de experts: ${error.message}</p>
                </div>
            `;
        }
    } else {
        console.log('ℹ️ Não é a página de experts');
    }
});

// Adicionar CSS para os experts
const expertStyles = `
<style>
.experts-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
}

.experts-container {
    margin-top: 2rem;
}

.experts-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
}

.expert-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    border: 1px solid #e0e0e0;
    transition: transform 0.2s, box-shadow 0.2s;
}

.expert-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.expert-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.expert-info h3 {
    margin: 0 0 0.25rem 0;
    color: #333;
    font-size: 1.2rem;
}

.expert-profissao {
    margin: 0;
    color: #666;
    font-size: 0.9rem;
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 500;
}

.status-badge.active {
    background: #d4edda;
    color: #155724;
}

.status-badge.inactive {
    background: #f8d7da;
    color: #721c24;
}

.expert-details {
    margin-bottom: 1.5rem;
}

.detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    color: #666;
}

.detail-item i {
    width: 16px;
    color: #007bff;
}

.detail-item a {
    color: #25d366;
    text-decoration: none;
}

.detail-item a:hover {
    text-decoration: underline;
}

.expert-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-sm {
    padding: 0.5rem 1rem;
    font-size: 0.85rem;
}

.empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: #666;
}

.empty-state i {
    font-size: 3rem;
    color: #ccc;
    margin-bottom: 1rem;
}

.empty-state h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
}

.empty-state p {
    margin: 0 0 1.5rem 0;
}

.modal-large {
    max-width: 800px;
}

.associar-container {
    max-height: 60vh;
    overflow-y: auto;
}

.expert-selection {
    margin-bottom: 2rem;
}

.expert-selection label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
}

.expert-selection select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
}

.produtos-selection h4 {
    margin: 0 0 1rem 0;
    color: #333;
}

.produtos-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1rem;
}

.produto-item {
    margin-bottom: 1rem;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: background-color 0.2s;
}

.checkbox-label:hover {
    background-color: #f8f9fa;
}

.produto-info h4 {
    margin: 0 0 0.25rem 0;
    color: #333;
    font-size: 1rem;
}

.produto-info p {
    margin: 0 0 0.25rem 0;
    color: #666;
    font-size: 0.85rem;
}

.expert-associado {
    color: #28a745;
    font-size: 0.8rem;
    font-weight: 500;
}

.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 300px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.notification-success {
    background: #28a745;
}

.notification-error {
    background: #dc3545;
}

.notification-warning {
    background: #ffc107;
    color: #333;
}

.notification-info {
    background: #17a2b8;
}
</style>
`;

// Adicionar estilos ao head
document.head.insertAdjacentHTML('beforeend', expertStyles);
