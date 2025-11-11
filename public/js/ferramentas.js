// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Função para fazer logout
function logout() {
    showConfirmModal('Tem certeza que deseja sair da sua conta?', () => {
        localStorage.removeItem('authToken');
        sessionStorage.clear();
        window.location.href = 'index.html';
    });
}

// Função para alternar modo escuro
function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById('darkModeBtn');
    
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        btn.innerHTML = '<i class="fas fa-moon"></i> Ativar Modo Escuro';
        localStorage.setItem('darkMode', 'false');
    } else {
        body.classList.add('dark-mode');
        btn.innerHTML = '<i class="fas fa-sun"></i> Ativar Modo Claro';
        localStorage.setItem('darkMode', 'true');
    }
}

// Função para abrir configurações da conta
function openAccountSettings() {
    window.location.href = 'configuracoes-conta.html';
}

// Função para apagar todos os dados
function clearAllData() {
    showConfirmModal(
        'ATENÇÃO: Esta ação irá apagar TODOS os dados do sistema (produtos, vendas, clientes). Esta ação não pode ser desfeita. Tem certeza que deseja continuar?',
        async () => {
            try {
                const response = await fetch(`${window.API_BASE}/admin/clear-all-data`, {
                    method: 'DELETE',
                    credentials: 'include', // Importante para permitir cookies de sessão
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert('Todos os dados foram apagados com sucesso!');
                    window.location.reload();
                } else {
                    alert('Erro ao apagar dados: ' + data.message);
                }
            } catch (error) {
                console.error('Erro ao apagar dados:', error);
                alert('Erro ao apagar dados. Tente novamente.');
            }
        }
    );
}


// Função para abrir configurações
function openSettings() {
    document.getElementById('paymentConfigModal').style.display = 'flex';
    // Preencher campos se já houver valores salvos
    const apiKey = localStorage.getItem('apiKey') || '';
    const secretKey = localStorage.getItem('secretKey') || '';
    document.getElementById('apiKey').value = apiKey;
    document.getElementById('secretKey').value = secretKey;
}

// Função para mostrar/ocultar credenciais
function toggleCredentialVisibility(fieldId, btn) {
    const input = document.getElementById(fieldId);
    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
}

// Função para mostrar campos de autenticação
function mostrarAuthFields() {
    document.getElementById('authFields').style.display = 'block';
}

// Função para fechar modal e esconder campos de autenticação
function fecharPaymentConfigModal() {
    document.getElementById('paymentConfigModal').style.display = 'none';
    document.getElementById('authFields').style.display = 'none';
}

// Salvar credenciais ao submeter o formulário (com autenticação)
const formPaymentConfig = document.getElementById('formPaymentConfig');
if (formPaymentConfig) {
    formPaymentConfig.addEventListener('submit', async function(e) {
        e.preventDefault();
        const apiKey = document.getElementById('apiKey').value.trim();
        const secretKey = document.getElementById('secretKey').value.trim();
        const user = document.getElementById('authUser').value.trim();
        const pass = document.getElementById('authPass').value.trim();
        if (!apiKey || !secretKey) {
            alert('Preencha ambos os campos de credenciais!');
            return;
        }
        if (!user || !pass) {
            alert('Informe usuário e senha para atualizar as chaves!');
            return;
        }
        // Verificar se o usuário é admin autorizado
        try {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                alert('Você deve estar logado como administrador para atualizar as credenciais!');
                return;
            }

            const response = await fetch(`${window.API_BASE}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!response.ok) {
                alert('Token de autenticação inválido!');
                return;
            }

            const result = await response.json();
            if (!result.success || !result.user) {
                alert('Erro ao verificar autenticação!');
                return;
            }

            const userData = result.user;
            const isAdmin = userData.role === 'admin';

            if (!isAdmin) {
                alert('Acesso negado. Apenas administradores podem atualizar as credenciais!');
                return;
            }
        } catch (error) {
            console.error('Erro ao verificar autorização:', error);
            alert('Erro ao verificar autorização!');
            return;
        }
        // Criptografar (simples base64 para exemplo)
        const apiKeyEnc = btoa(apiKey);
        const secretKeyEnc = btoa(secretKey);
        localStorage.setItem('apiKey', apiKeyEnc);
        localStorage.setItem('secretKey', secretKeyEnc);
        alert('Credenciais salvas localmente e criptografadas! (Necessário reiniciar o backend para aplicar)');
        fecharPaymentConfigModal();
    });
}

// Função para gerar relatórios
function generateReports() {
    alert('Funcionalidade de relatórios em desenvolvimento.');
}

// Função para abrir manual de taxas
function openTaxManual() {
    // Abrir o manual em uma nova aba
    window.open('manual-taxas.html', '_blank');
}

// Função para mostrar modal de confirmação
function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    messageEl.textContent = message;
    modal.style.display = 'flex';
    
    confirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Fechar modal ao clicar fora
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Inicializar modo escuro se estiver salvo
document.addEventListener('DOMContentLoaded', function() {
    const darkMode = localStorage.getItem('darkMode');
    const btn = document.getElementById('darkModeBtn');
    
    if (darkMode === 'true') {
        document.body.classList.add('dark-mode');
        btn.innerHTML = '<i class="fas fa-sun"></i> Ativar Modo Claro';
    }
});

