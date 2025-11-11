// Configurações da Conta - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Página de configurações da conta carregada');
    
    // Inicializar sidebar
    const sidebar = new SidebarComponent();
    
    // Carregar dados do usuário
    loadUserData();
    
    // Configurar formulários
    setupForms();
});

// Carregar dados do usuário
async function loadUserData() {
    try {
        console.log('📊 Carregando dados do usuário...');
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            console.error('❌ Token não encontrado');
            showError('Usuário não autenticado. Faça login novamente.');
            return;
        }

        const response = await fetch(`${window.API_BASE}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const responseData = await response.json();
            console.log('✅ Dados do usuário carregados:', responseData);
            
            if (responseData.success && responseData.user) {
                const userData = responseData.user;
                
                // Preencher informações atuais
                const currentNameEl = document.getElementById('currentName');
                const currentEmailEl = document.getElementById('currentEmail');
                const currentContactEl = document.getElementById('currentContact');
                
                if (currentNameEl) currentNameEl.textContent = userData.nome_completo || 'Não informado';
                if (currentEmailEl) currentEmailEl.textContent = userData.email || 'Não informado';
                if (currentContactEl) currentContactEl.textContent = userData.telefone || 'Não informado';
                
                // Preencher formulário
                const nomeCompletoEl = document.getElementById('nomeCompleto');
                const telefoneEl = document.getElementById('telefone');
                const emailEl = document.getElementById('email');
                
                if (nomeCompletoEl) nomeCompletoEl.value = userData.nome_completo || '';
                if (telefoneEl) telefoneEl.value = userData.telefone || '';
                if (emailEl) emailEl.value = userData.email || '';
                
                console.log('✅ Dados preenchidos nos campos');
                console.log('📋 Dados do usuário:', {
                    nome_completo: userData.nome_completo,
                    email: userData.email,
                    telefone: userData.telefone
                });
            } else {
                console.error('❌ Estrutura de resposta inválida:', responseData);
                showError('Erro ao processar dados do usuário');
            }
            
        } else {
            console.error('❌ Erro ao carregar dados do usuário:', response.status);
            showError('Erro ao carregar dados do usuário');
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        showError('Erro ao carregar dados do usuário');
    }
}

// Configurar formulários
function setupForms() {
    // Formulário de dados da conta
    const accountForm = document.getElementById('accountForm');
    accountForm.addEventListener('submit', handleAccountUpdate);
    
    // Formulário de senha
    const passwordForm = document.getElementById('passwordForm');
    passwordForm.addEventListener('submit', handlePasswordChange);
    
    // Validação de confirmação de senha
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    confirmPassword.addEventListener('input', function() {
        if (newPassword.value !== confirmPassword.value) {
            confirmPassword.setCustomValidity('As senhas não coincidem');
        } else {
            confirmPassword.setCustomValidity('');
        }
    });
}

// Atualizar dados da conta
async function handleAccountUpdate(event) {
    event.preventDefault();
    
    const saveBtn = document.getElementById('saveBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Desabilitar botão e mostrar loading
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        
        // Coletar dados do formulário
        const formData = {
            nome_completo: document.getElementById('nomeCompleto').value.trim(),
            telefone: document.getElementById('telefone').value.trim()
        };
        
        console.log('💾 Atualizando dados da conta:', formData);
        
        const response = await fetch(`${window.API_BASE}/auth/update-profile`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Dados atualizados com sucesso:', result);
            
            // Atualizar informações atuais
            document.getElementById('currentName').textContent = formData.nome_completo;
            document.getElementById('currentContact').textContent = formData.telefone;
            
            showSuccess('Dados atualizados com sucesso!');
            
        } else {
            const errorData = await response.json();
            console.error('❌ Erro ao atualizar dados:', errorData);
            showError(errorData.message || 'Erro ao atualizar dados');
        }
        
    } catch (error) {
        console.error('❌ Erro ao atualizar dados:', error);
        showError('Erro ao atualizar dados. Tente novamente.');
    } finally {
        // Reabilitar botão
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Alterar senha
async function handlePasswordChange(event) {
    event.preventDefault();
    
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    const originalText = savePasswordBtn.innerHTML;
    
    try {
        // Desabilitar botão e mostrar loading
        savePasswordBtn.disabled = true;
        savePasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Alterando...';
        
        // Coletar dados do formulário
        const formData = {
            currentPassword: document.getElementById('currentPassword').value,
            newPassword: document.getElementById('newPassword').value,
            confirmPassword: document.getElementById('confirmPassword').value
        };
        
        // Validar senhas
        if (formData.newPassword !== formData.confirmPassword) {
            showPasswordError('As senhas não coincidem');
            return;
        }
        
        if (formData.newPassword.length < 6) {
            showPasswordError('A nova senha deve ter pelo menos 6 caracteres');
            return;
        }
        
        console.log('🔐 Alterando senha...');
        
        const response = await fetch(`${window.API_BASE}/auth/change-password`, {
            method: 'PUT',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: JSON.stringify({
                currentPassword: formData.currentPassword,
                newPassword: formData.newPassword
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Senha alterada com sucesso:', result);
            
            // Limpar formulário
            document.getElementById('passwordForm').reset();
            
            showPasswordSuccess('Senha alterada com sucesso!');
            
        } else {
            const errorData = await response.json();
            console.error('❌ Erro ao alterar senha:', errorData);
            showPasswordError(errorData.message || 'Erro ao alterar senha');
        }
        
    } catch (error) {
        console.error('❌ Erro ao alterar senha:', error);
        showPasswordError('Erro ao alterar senha. Tente novamente.');
    } finally {
        // Reabilitar botão
        savePasswordBtn.disabled = false;
        savePasswordBtn.innerHTML = originalText;
    }
}

// Mostrar mensagem de sucesso
function showSuccess(message) {
    const alert = document.getElementById('successAlert');
    const errorAlert = document.getElementById('errorAlert');
    
    errorAlert.style.display = 'none';
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Mostrar mensagem de erro
function showError(message) {
    const alert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');
    const errorMessage = document.getElementById('errorMessage');
    
    successAlert.style.display = 'none';
    errorMessage.textContent = message;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Mostrar mensagem de sucesso para senha
function showPasswordSuccess(message) {
    const alert = document.getElementById('passwordSuccessAlert');
    const errorAlert = document.getElementById('passwordErrorAlert');
    
    errorAlert.style.display = 'none';
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Mostrar mensagem de erro para senha
function showPasswordError(message) {
    const alert = document.getElementById('passwordErrorAlert');
    const successAlert = document.getElementById('passwordSuccessAlert');
    const errorMessage = document.getElementById('passwordErrorMessage');
    
    successAlert.style.display = 'none';
    errorMessage.textContent = message;
    alert.style.display = 'block';
    
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

// Função para abrir configurações da conta (chamada da página de ferramentas)
function openAccountSettings() {
    window.location.href = 'configuracoes-conta.html';
}
