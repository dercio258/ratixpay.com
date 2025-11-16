/**
 * Register Handler - Ratixpay
 * Gerencia toda a lógica de registro de usuários
 */

class RegisterHandler {
    constructor() {
        this.API_BASE = window.location.origin + '/api';
        this.isProcessingRegister = false;
        this.lastRegisterAttempt = 0;
        this.REGISTER_COOLDOWN = 5000; // 5 segundos
        
        this.currentUserId = null;
        this.resendCountdown = 0;
        this.resendInterval = null;
        
        this.elements = {
            registerForm: document.getElementById('registerForm'),
            submitBtn: document.getElementById('submitBtn'),
            loading: document.getElementById('loading'),
            alert: document.getElementById('alert'),
            password: document.getElementById('password'),
            confirmPassword: document.getElementById('confirmPassword'),
            strengthBar: document.getElementById('strengthBar'),
            strengthText: document.getElementById('strengthText'),
            verificationSection: document.getElementById('verificationSection'),
            userEmailSpan: document.getElementById('userEmail'),
            verifyBtn: document.getElementById('verifyBtn'),
            resendBtn: document.getElementById('resendBtn'),
            resendTimer: document.getElementById('resendTimer'),
            verificationInputs: document.querySelectorAll('.verification-input')
        };
        
        this.init();
    }
    
    init() {
        this.checkUrlMessage();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.elements.registerForm) {
            this.elements.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        
        if (this.elements.password) {
            this.elements.password.addEventListener('input', () => this.checkPasswordStrength());
        }
        
        if (this.elements.confirmPassword) {
            this.elements.confirmPassword.addEventListener('input', () => this.checkPasswordMatch());
        }
        
        if (this.elements.verifyBtn) {
            this.elements.verifyBtn.addEventListener('click', () => this.handleVerification());
        }
        
        if (this.elements.resendBtn) {
            this.elements.resendBtn.addEventListener('click', () => this.handleResendCode());
        }
        
        // Event listeners para inputs de verificação
        this.elements.verificationInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => this.handleVerificationInput(e, index));
            input.addEventListener('keydown', (e) => this.handleVerificationKeydown(e, index));
            input.addEventListener('paste', (e) => this.handleVerificationPaste(e, index));
        });
    }
    
    checkUrlMessage() {
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        
        if (message === 'verify-email') {
            this.showAlert('Verifique seu email para ativar a conta', 'info');
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        if (this.isProcessingRegister) {
            console.log('Registro já está sendo processado, ignorando nova tentativa');
            return;
        }
        
        const now = Date.now();
        if (now - this.lastRegisterAttempt < this.REGISTER_COOLDOWN) {
            this.showAlert('Aguarde alguns segundos antes de tentar novamente', 'error');
            return;
        }
        
        this.lastRegisterAttempt = now;
        this.isProcessingRegister = true;
        
        const formData = new FormData(this.elements.registerForm);
        const data = Object.fromEntries(formData.entries());
        data.tipo_conta = 'vendedor';
        
        if (!this.validateForm(data)) {
            this.isProcessingRegister = false;
            return;
        }
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('Conta criada com sucesso! Verifique seu email para ativar a conta.', 'success');
                
                if (result.requiresVerification) {
                    this.currentUserId = result.userId;
                    this.elements.userEmailSpan.textContent = data.email;
                    this.showVerificationSection();
                    this.startResendTimer();
                }
            } else {
                this.showAlert(result.error || 'Erro ao criar conta', 'error');
            }
        } catch (error) {
            console.error('Erro no registro:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
            this.isProcessingRegister = false;
        }
    }
    
    validateForm(data) {
        if (!data.nome_completo || !data.email || !data.password) {
            this.showAlert('Todos os campos obrigatórios devem ser preenchidos', 'error');
            return false;
        }
        
        if (data.password !== data.confirmPassword) {
            this.showAlert('As senhas não coincidem', 'error');
            return false;
        }
        
        if (data.password.length < 6) {
            this.showAlert('A senha deve ter pelo menos 6 caracteres', 'error');
            return false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data.email)) {
            this.showAlert('Digite um email válido', 'error');
            return false;
        }
        
        return true;
    }
    
    checkPasswordStrength() {
        const password = this.elements.password.value;
        const strength = this.calculatePasswordStrength(password);
        
        this.elements.strengthBar.className = 'strength-fill ' + strength.class;
        this.elements.strengthText.textContent = strength.text;
    }
    
    calculatePasswordStrength(password) {
        let score = 0;
        
        if (password.length >= 6) score++;
        if (password.length >= 8) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        
        if (score < 2) return { class: 'strength-weak', text: 'Senha fraca' };
        if (score < 4) return { class: 'strength-fair', text: 'Senha razoável' };
        if (score < 6) return { class: 'strength-good', text: 'Senha boa' };
        return { class: 'strength-strong', text: 'Senha forte' };
    }
    
    checkPasswordMatch() {
        const password = this.elements.password.value;
        const confirmPassword = this.elements.confirmPassword.value;
        
        if (confirmPassword && password !== confirmPassword) {
            this.elements.confirmPassword.style.borderColor = '#e74c3c';
        } else {
            this.elements.confirmPassword.style.borderColor = '#e9ecef';
        }
    }
    
    showVerificationSection() {
        this.elements.verificationSection.classList.add('active');
        this.elements.verificationSection.scrollIntoView({ behavior: 'smooth' });
        this.elements.verificationInputs[0].focus();
    }
    
    handleVerificationInput(e, index) {
        const input = e.target;
        let value = input.value.replace(/[^0-9]/g, '');
        input.value = value;
        
        if (value) {
            input.classList.add('filled');
            input.classList.remove('error');
            
            if (index < this.elements.verificationInputs.length - 1) {
                this.elements.verificationInputs[index + 1].focus();
            }
        } else {
            input.classList.remove('filled');
        }
        
        this.checkVerificationComplete();
    }
    
    handleVerificationKeydown(e, index) {
        const input = e.target;
        
        if (e.key === 'Backspace' && !input.value && index > 0) {
            this.elements.verificationInputs[index - 1].focus();
        }
        
        if (e.key === 'Enter') {
            this.handleVerification();
        }
    }
    
    handleVerificationPaste(e, index) {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');
        const numbers = pastedData.replace(/\D/g, '');
        
        for (let i = 0; i < Math.min(numbers.length, this.elements.verificationInputs.length); i++) {
            this.elements.verificationInputs[i].value = numbers[i];
            this.elements.verificationInputs[i].classList.add('filled');
            this.elements.verificationInputs[i].classList.remove('error');
        }
        
        const nextEmptyIndex = Array.from(this.elements.verificationInputs).findIndex(input => !input.value);
        if (nextEmptyIndex !== -1) {
            this.elements.verificationInputs[nextEmptyIndex].focus();
        } else {
            this.elements.verificationInputs[this.elements.verificationInputs.length - 1].focus();
        }
        
        this.checkVerificationComplete();
    }
    
    checkVerificationComplete() {
        const allFilled = Array.from(this.elements.verificationInputs).every(input => input.value);
        this.elements.verifyBtn.disabled = !allFilled;
    }
    
    async handleVerification() {
        const code = Array.from(this.elements.verificationInputs).map(input => input.value).join('');
        
        if (code.length !== 6) {
            this.showAlert('Digite o código completo de 6 dígitos', 'error');
            return;
        }
        
        try {
            this.setLoading(true);
            this.elements.verifyBtn.disabled = true;
            
            const response = await fetch(`${this.API_BASE}/auth/verify-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.currentUserId,
                    code: code
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('Email verificado com sucesso! Redirecionando...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html?message=verified';
                }, 2000);
            } else {
                this.showAlert(result.error || 'Código inválido', 'error');
                this.clearVerificationInputs();
                this.elements.verificationInputs[0].focus();
            }
        } catch (error) {
            console.error('Erro na verificação:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
            this.elements.verifyBtn.disabled = false;
        }
    }
    
    async handleResendCode() {
        if (this.resendCountdown > 0) return;
        
        try {
            this.setLoading(true);
            this.elements.resendBtn.disabled = true;
            
            const response = await fetch(`${this.API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.currentUserId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('Código reenviado com sucesso!', 'success');
                this.startResendTimer();
            } else {
                this.showAlert(result.error || 'Erro ao reenviar código', 'error');
            }
        } catch (error) {
            console.error('Erro ao reenviar:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
            this.elements.resendBtn.disabled = false;
        }
    }
    
    startResendTimer() {
        this.resendCountdown = 60;
        this.elements.resendBtn.disabled = true;
        
        if (this.resendInterval) {
            clearInterval(this.resendInterval);
        }
        
        this.resendInterval = setInterval(() => {
            this.resendCountdown--;
            this.elements.resendTimer.textContent = `Reenviar em ${this.resendCountdown}s`;
            
            if (this.resendCountdown <= 0) {
                clearInterval(this.resendInterval);
                this.elements.resendBtn.disabled = false;
                this.elements.resendTimer.textContent = '';
            }
        }, 1000);
    }
    
    clearVerificationInputs() {
        this.elements.verificationInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled', 'error');
        });
    }
    
    showAlert(message, type) {
        this.elements.alert.textContent = message;
        this.elements.alert.className = `alert alert-${type}`;
        this.elements.alert.style.display = 'block';
        
        setTimeout(() => {
            this.elements.alert.style.display = 'none';
        }, 5000);
    }
    
    setLoading(isLoading) {
        if (isLoading) {
            this.elements.submitBtn.disabled = true;
            this.elements.loading.style.display = 'block';
        } else {
            this.elements.submitBtn.disabled = false;
            this.elements.loading.style.display = 'none';
        }
    }
}

// Inicializar quando o DOM estiver pronto
let registerHandler;
document.addEventListener('DOMContentLoaded', function() {
    registerHandler = new RegisterHandler();
    window.registerHandler = registerHandler; // Disponibilizar globalmente
});

