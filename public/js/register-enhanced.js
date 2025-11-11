// Sistema de Registro Aprimorado - RatixPay
// Garante validação adequada e redirecionamento em caso de falha

class RegisterSystem {
    constructor() {
        this.API_BASE = window.location.origin + '/api';
        this.isProcessingRegister = false;
        this.lastRegisterAttempt = 0;
        this.REGISTER_COOLDOWN = 3000; // 3 segundos de cooldown
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkUrlParams();
        this.validateFormStructure();
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            const registerForm = document.getElementById('registerForm');
            const accountTypeBtns = document.querySelectorAll('.account-type-btn');
            
            if (registerForm) {
                registerForm.addEventListener('submit', (e) => this.handleRegister(e));
            }

            // Seletor de tipo de conta
            accountTypeBtns.forEach(btn => {
                btn.addEventListener('click', () => this.selectAccountType(btn));
            });

            // Validação em tempo real
            this.setupRealTimeValidation();
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            this.showError(this.getErrorMessage(error));
            // Limpar parâmetros da URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    getErrorMessage(error) {
        const errorMessages = {
            'email_exists': 'Este email já está registrado. Tente fazer login.',
            'phone_exists': 'Este telefone já está registrado. Tente fazer login.',
            'invalid_email': 'Email inválido. Verifique o formato.',
            'weak_password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
            'registration_failed': 'Erro no registro. Tente novamente.',
            'server_error': 'Erro do servidor. Tente novamente mais tarde.'
        };
        
        return errorMessages[error] || 'Erro no registro. Tente novamente.';
    }

    selectAccountType(btn) {
        const accountTypeBtns = document.querySelectorAll('.account-type-btn');
        accountTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentAccountType = btn.dataset.type;
    }

    setupRealTimeValidation() {
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('telefone');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');

        if (emailInput) {
            emailInput.addEventListener('blur', () => this.validateEmail());
            emailInput.addEventListener('input', () => this.clearFieldError('email'));
        }

        if (phoneInput) {
            phoneInput.addEventListener('blur', () => this.validatePhone());
            phoneInput.addEventListener('input', () => this.clearFieldError('telefone'));
        }

        if (passwordInput) {
            passwordInput.addEventListener('blur', () => this.validatePassword());
            passwordInput.addEventListener('input', () => this.clearFieldError('password'));
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('blur', () => this.validateConfirmPassword());
            confirmPasswordInput.addEventListener('input', () => this.clearFieldError('confirmPassword'));
        }
    }

    validateEmail() {
        const email = document.getElementById('email').value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailRegex.test(email);
        
        if (!isValid && email.length > 0) {
            this.showFieldError('email', 'Formato de email inválido');
        }
        
        return isValid;
    }

    validatePhone() {
        const phone = document.getElementById('telefone').value.trim();
        const phoneRegex = /^[0-9+\-\s()]+$/;
        const isValid = phone.length >= 8 && phoneRegex.test(phone);
        
        if (!isValid && phone.length > 0) {
            this.showFieldError('telefone', 'Telefone deve ter pelo menos 8 dígitos');
        }
        
        return isValid;
    }

    validatePassword() {
        const password = document.getElementById('password').value;
        const isValid = password.length >= 6;
        
        if (!isValid && password.length > 0) {
            this.showFieldError('password', 'Senha deve ter pelo menos 6 caracteres');
        }
        
        return isValid;
    }

    validateConfirmPassword() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const isValid = password === confirmPassword && confirmPassword.length > 0;
        
        if (!isValid && confirmPassword.length > 0) {
            this.showFieldError('confirmPassword', 'Senhas não coincidem');
        }
        
        return isValid;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#e74c3c';
            
            // Remover erro anterior
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
            
            // Adicionar novo erro
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.style.color = '#e74c3c';
            errorDiv.style.fontSize = '12px';
            errorDiv.style.marginTop = '5px';
            errorDiv.textContent = message;
            
            field.parentNode.appendChild(errorDiv);
        }
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.style.borderColor = '#e9ecef';
            const existingError = field.parentNode.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
        }
    }

    validateFormStructure() {
        const requiredElements = [
            'registerForm',
            'nomeCompleto',
            'email',
            'telefone',
            'password',
            'confirmPassword',
            'registerBtn'
        ];

        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('❌ Elementos do formulário não encontrados:', missingElements);
            this.showError('Erro na estrutura do formulário. Recarregue a página.');
            return false;
        }

        return true;
    }

    async handleRegister(e) {
        e.preventDefault();
        
        // Verificar estrutura do formulário
        if (!this.validateFormStructure()) {
            this.redirectToHome();
            return;
        }

        // Evitar múltiplas chamadas simultâneas
        if (this.isProcessingRegister) {
            console.log('Registro já está sendo processado, ignorando nova tentativa');
            return;
        }
        
        // Verificar cooldown entre tentativas
        const now = Date.now();
        if (now - this.lastRegisterAttempt < this.REGISTER_COOLDOWN) {
            this.showError('Aguarde alguns segundos antes de tentar novamente');
            return;
        }
        
        this.lastRegisterAttempt = now;
        this.isProcessingRegister = true;

        try {
            // Validar campos
            if (!this.validateForm()) {
                return;
            }

            // Preparar dados de registro
            const registerData = this.prepareRegisterData();
            
            // Fazer requisição de registro
            const response = await this.makeRegisterRequest(registerData);
            const data = await response.json();

            if (data.success) {
                await this.handleSuccessfulRegister(data);
            } else {
                await this.handleFailedRegister(data);
            }

        } catch (error) {
            console.error('Erro no registro:', error);
            this.handleRegisterError(error);
        } finally {
            this.isProcessingRegister = false;
        }
    }

    validateForm() {
        const nomeCompleto = document.getElementById('nomeCompleto').value.trim();
        const email = document.getElementById('email').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!nomeCompleto || !email || !telefone || !password || !confirmPassword) {
            this.showError('Por favor, preencha todos os campos obrigatórios');
            return false;
        }

        if (!this.currentAccountType) {
            this.showError('Por favor, selecione um tipo de conta (Cliente ou Vendedor)');
            return false;
        }

        if (!this.validateEmail()) {
            this.showError('Email inválido');
            return false;
        }

        if (!this.validatePhone()) {
            this.showError('Telefone inválido');
            return false;
        }

        if (!this.validatePassword()) {
            this.showError('Senha deve ter pelo menos 6 caracteres');
            return false;
        }

        if (!this.validateConfirmPassword()) {
            this.showError('Senhas não coincidem');
            return false;
        }

        return true;
    }

    prepareRegisterData() {
        return {
            nome_completo: document.getElementById('nomeCompleto').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefone: document.getElementById('telefone').value.trim(),
            password: document.getElementById('password').value,
            // tipo_conta removido - usar role diretamente
        };
    }

    async makeRegisterRequest(registerData) {
        this.setLoading(true);

        return await fetch(`${this.API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(registerData)
        });
    }

    async handleSuccessfulRegister(data) {
        this.showSuccess('Registro realizado com sucesso! Redirecionando para login...');
        
        // Redirecionar para página de login após 2 segundos
        setTimeout(() => {
            window.location.replace('login.html?registered=true');
        }, 2000);
    }

    async handleFailedRegister(data) {
        this.showError(data.error || 'Erro no registro');
        
        // Se email ou telefone já existem, sugerir login
        if (data.error && (data.error.includes('email') || data.error.includes('telefone'))) {
            setTimeout(() => {
                if (confirm('Este email/telefone já está registrado. Deseja ir para a página de login?')) {
                    window.location.replace('login.html');
                }
            }, 2000);
        }
    }

    handleRegisterError(error) {
        this.showError('Erro de conexão. Tente novamente.');
        
        // Em caso de erro de rede, redirecionar para página principal
        if (error.name === 'TypeError' || error.message.includes('fetch')) {
            setTimeout(() => {
                this.redirectToHome();
            }, 2000);
        }
    }

    redirectToHome() {
        console.log('🔄 Redirecionando para página principal devido a falha no registro');
        window.location.replace('index.html');
    }

    showError(message, type = 'error') {
        const alert = document.getElementById('alert');
        if (alert) {
            alert.textContent = message;
            alert.className = `alert alert-${type}`;
            alert.style.display = 'block';
            
            setTimeout(() => {
                alert.style.display = 'none';
            }, 5000);
        } else {
            // Fallback: usar alert nativo
            alert(message);
        }
    }

    showSuccess(message) {
        this.showError(message, 'success');
    }

    setLoading(isLoading) {
        const registerBtn = document.getElementById('registerBtn');
        const loading = document.getElementById('loading');
        
        if (registerBtn) {
            registerBtn.disabled = isLoading;
        }
        
        if (loading) {
            loading.style.display = isLoading ? 'block' : 'none';
        }
    }
}

// Inicializar sistema de registro quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.registerSystem = new RegisterSystem();
});

// Função global para toggle de senha
function togglePassword(fieldId) {
    const passwordInput = document.getElementById(fieldId);
    const toggleBtn = document.querySelector(`#${fieldId} + .input-group .password-toggle i`);
    
    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.className = 'fas fa-eye-slash';
        } else {
            passwordInput.type = 'password';
            toggleBtn.className = 'fas fa-eye';
        }
    }
}

// Exportar para uso global
window.RegisterSystem = RegisterSystem;
