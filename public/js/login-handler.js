/**
 * Login Handler - Ratixpay
 * Gerencia toda a lógica de autenticação da página de login
 */

class LoginHandler {
    constructor() {
        this.API_BASE = window.location.origin + '/api';
        this.isProcessingLogin = false;
        this.lastLoginAttempt = 0;
        this.LOGIN_COOLDOWN = 5000; // 5 segundos
        
        this.elements = {
            loginForm: document.getElementById('loginForm'),
            loginBtn: document.getElementById('loginBtn'),
            loading: document.getElementById('loading'),
            alert: document.getElementById('alert'),
            username: document.getElementById('username'),
            password: document.getElementById('password')
        };
        
        this.init();
    }
    
    init() {
        this.checkUrlParams();
        this.checkUrlMessage();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.elements.loginForm) {
            this.elements.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }
    
    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            let errorMessage = '';
            switch (error) {
                case 'google_auth_failed':
                    errorMessage = 'Falha na autenticação Google. Tente novamente.';
                    break;
                case 'callback_failed':
                    errorMessage = 'Erro no processo de autenticação. Tente fazer login novamente.';
                    break;
                default:
                    errorMessage = 'Erro de autenticação. Tente novamente.';
            }
            this.showAlert(errorMessage, 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    checkUrlMessage() {
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        
        if (message === 'verified') {
            this.showAlert('Email verificado com sucesso! Você pode fazer login agora.', 'success');
        } else if (message === 'verify-email') {
            this.showAlert('Verifique seu email para ativar a conta', 'warning');
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        if (this.isProcessingLogin) {
            console.log('Login já está sendo processado, ignorando nova tentativa');
            return;
        }
        
        const now = Date.now();
        if (now - this.lastLoginAttempt < this.LOGIN_COOLDOWN) {
            this.showAlert('Aguarde alguns segundos antes de tentar novamente', 'error');
            return;
        }
        
        this.lastLoginAttempt = now;
        this.isProcessingLogin = true;
        
        const emailOrPhone = this.elements.username.value.trim();
        const password = this.elements.password.value.trim();
        
        if (!emailOrPhone) {
            this.showAlert('Por favor, preencha o email ou telefone', 'error');
            this.elements.username.focus();
            this.isProcessingLogin = false;
            return;
        }
        
        if (!password) {
            this.showAlert('Por favor, preencha a senha', 'error');
            this.elements.password.focus();
            this.isProcessingLogin = false;
            return;
        }
        
        const isEmail = emailOrPhone.includes('@');
        const loginData = {
            password: password,
            tipo_conta: 'vendedor'
        };
        
        if (isEmail) {
            loginData.email = emailOrPhone;
        } else {
            loginData.telefone = emailOrPhone;
        }
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });
            
            let data;
            try {
                const responseText = await response.text();
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('Erro ao parsear resposta JSON:', parseError);
                this.showAlert('Erro na resposta do servidor. Tente novamente.', 'error');
                this.isProcessingLogin = false;
                this.setLoading(false);
                return;
            }
            
            if (data.success) {
                if (data.requiresVerification) {
                    this.showVerificationSection(data.userId);
                    this.showAlert('Código de verificação enviado para email e WhatsApp', 'success');
                } else {
                    this.handleSuccessfulLogin(data);
                }
            } else {
                this.handleLoginError(data);
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showAlert('Erro de conexão. Verifique sua internet e tente novamente.', 'error');
        } finally {
            this.setLoading(false);
            this.isProcessingLogin = false;
        }
    }
    
    handleSuccessfulLogin(data) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        this.showAlert('Login realizado com sucesso!', 'success');
        
        setTimeout(() => {
            let targetPage = 'index.html';
            const isMainAdmin = data.user.email === 'ratixpay.mz@gmail.com';
            
            if (data.redirectPage) {
                targetPage = data.redirectPage;
            } else if (data.user.role === 'admin' || isMainAdmin) {
                targetPage = 'admin-dashboard.html';
            } else if (data.user.tipo_conta === 'vendedor') {
                targetPage = 'dashboard.html';
            }
            
            window.location.replace(targetPage);
        }, 1500);
    }
    
    handleLoginError(data) {
        if (data.bloqueada && data.codigo_enviado) {
            this.showUnlockSection(data.email);
            this.showAlert(data.error, 'warning');
        } else {
            const errorMessage = data.error || 'Erro ao fazer login. Verifique suas credenciais.';
            this.showAlert(errorMessage, 'error');
        }
    }
    
    showVerificationSection(userId) {
        if (document.getElementById('verificationSection')) {
            return;
        }
        
        const verificationHTML = `
            <div class="verification-section" id="verificationSection">
                <h3>🔐 Verificação de Segurança</h3>
                <p>Enviamos um código de verificação para seu email e WhatsApp. Digite o código abaixo:</p>
                
                <div class="verification-code">
                    <input type="text" maxlength="1" class="code-input" data-index="0">
                    <input type="text" maxlength="1" class="code-input" data-index="1">
                    <input type="text" maxlength="1" class="code-input" data-index="2">
                    <input type="text" maxlength="1" class="code-input" data-index="3">
                    <input type="text" maxlength="1" class="code-input" data-index="4">
                    <input type="text" maxlength="1" class="code-input" data-index="5">
                </div>

                <button type="button" class="btn btn-primary" id="verifyBtn">
                    <i class="fas fa-check"></i> Verificar
                </button>

                <div class="resend-link">
                    <p>Não recebeu o código? <a href="#" onclick="loginHandler.resendCode(${userId})">Reenviar</a></p>
                </div>
            </div>
        `;
        
        this.hideLoginForm();
        const formContainer = document.querySelector('.form-container');
        formContainer.insertAdjacentHTML('beforeend', verificationHTML);
        
        this.setupCodeInputs('#verificationSection');
        document.getElementById('verifyBtn').addEventListener('click', () => this.handleVerification(userId));
    }
    
    showUnlockSection(email) {
        if (document.getElementById('unlockSection')) {
            return;
        }
        
        const unlockHTML = `
            <div class="unlock-section" id="unlockSection">
                <h3>🔓 Desbloquear Conta</h3>
                <p>Um código de desbloqueio foi enviado para seu email e WhatsApp. Digite o código abaixo:</p>
                
                <div class="unlock-code">
                    <input type="text" maxlength="1" class="code-input" data-index="0">
                    <input type="text" maxlength="1" class="code-input" data-index="1">
                    <input type="text" maxlength="1" class="code-input" data-index="2">
                    <input type="text" maxlength="1" class="code-input" data-index="3">
                    <input type="text" maxlength="1" class="code-input" data-index="4">
                    <input type="text" maxlength="1" class="code-input" data-index="5">
                </div>

                <button type="button" class="btn btn-primary" id="unlockBtn">
                    <i class="fas fa-unlock"></i> Desbloquear
                </button>

                <div class="resend-link">
                    <p>Não recebeu o código? <a href="#" onclick="loginHandler.resendUnlockCode('${email}')">Reenviar</a></p>
                </div>
                
                <div class="back-to-login">
                    <a href="#" onclick="loginHandler.backToLogin()">← Voltar ao Login</a>
                </div>
            </div>
        `;
        
        this.hideLoginForm();
        const formContainer = document.querySelector('.form-container');
        formContainer.insertAdjacentHTML('beforeend', unlockHTML);
        
        this.setupCodeInputs('#unlockSection');
        document.getElementById('unlockBtn').addEventListener('click', () => this.handleUnlock(email));
    }
    
    hideLoginForm() {
        this.elements.loginForm.style.display = 'none';
        document.querySelector('.links').style.display = 'none';
        document.querySelector('.divider').style.display = 'none';
        document.querySelector('.register-link').style.display = 'none';
    }
    
    showLoginForm() {
        this.elements.loginForm.style.display = 'block';
        document.querySelector('.links').style.display = 'block';
        document.querySelector('.divider').style.display = 'block';
        document.querySelector('.register-link').style.display = 'block';
    }
    
    setupCodeInputs(containerSelector) {
        const codeInputs = document.querySelectorAll(`${containerSelector} .code-input`);
        
        codeInputs.forEach((input, index) => {
            input.addEventListener('input', function(e) {
                const value = e.target.value.replace(/[^0-9]/g, '');
                e.target.value = value;
                
                if (value.length === 1 && index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                }
            });
            
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && e.target.value.length === 0 && index > 0) {
                    codeInputs[index - 1].focus();
                }
            });
        });
    }
    
    getCode(containerSelector) {
        const codeInputs = document.querySelectorAll(`${containerSelector} .code-input`);
        let code = '';
        codeInputs.forEach(input => {
            code += input.value;
        });
        return code;
    }
    
    async handleVerification(userId) {
        const code = this.getCode('#verificationSection');
        
        if (code.length !== 6) {
            this.showAlert('Digite o código completo de 6 dígitos', 'error');
            return;
        }
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.API_BASE}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    code: code
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                localStorage.setItem('authToken', result.token);
                localStorage.setItem('userData', JSON.stringify(result.user));
                
                this.showAlert('Verificação realizada com sucesso!', 'success');
                
                setTimeout(() => {
                    let targetPage = 'index.html';
                    const isMainAdmin = result.user.email === 'ratixpay.mz@gmail.com';
                    
                    if (result.redirectPage) {
                        targetPage = result.redirectPage;
                    } else if (result.user.role === 'admin' || isMainAdmin) {
                        targetPage = 'admin-dashboard.html';
                    } else if (result.user.tipo_conta === 'vendedor') {
                        targetPage = 'dashboard.html';
                    }
                    
                    window.location.replace(targetPage);
                }, 1500);
            } else {
                this.showAlert(result.error || 'Erro na verificação', 'error');
            }
        } catch (error) {
            console.error('Erro na verificação:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    async handleUnlock(email) {
        const codigo = this.getCode('#unlockSection');
        
        if (codigo.length !== 6) {
            this.showAlert('Por favor, digite o código completo de 6 dígitos', 'error');
            return;
        }
        
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.API_BASE}/auth/desbloquear-codigo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    codigo: codigo
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('Conta desbloqueada com sucesso! Faça login novamente.', 'success');
                setTimeout(() => {
                    this.backToLogin();
                }, 2000);
            } else {
                this.showAlert(data.error || 'Erro ao desbloquear conta', 'error');
            }
        } catch (error) {
            console.error('Erro no desbloqueio:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    async resendCode(userId) {
        try {
            const response = await fetch(`${this.API_BASE}/auth/resend-verification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert('Código reenviado com sucesso!', 'success');
            } else {
                this.showAlert(result.error || 'Erro ao reenviar código', 'error');
            }
        } catch (error) {
            console.error('Erro ao reenviar código:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        }
    }
    
    async resendUnlockCode(email) {
        try {
            this.setLoading(true);
            
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: 'dummy'
                })
            });
            
            const data = await response.json();
            
            if (data.bloqueada && data.codigo_enviado) {
                this.showAlert('Novo código de desbloqueio enviado!', 'success');
            } else {
                this.showAlert('Erro ao reenviar código', 'error');
            }
        } catch (error) {
            console.error('Erro ao reenviar código:', error);
            this.showAlert('Erro de conexão. Tente novamente.', 'error');
        } finally {
            this.setLoading(false);
        }
    }
    
    backToLogin() {
        const unlockSection = document.getElementById('unlockSection');
        const verificationSection = document.getElementById('verificationSection');
        
        if (unlockSection) unlockSection.remove();
        if (verificationSection) verificationSection.remove();
        
        this.showLoginForm();
        this.elements.username.value = '';
        this.elements.password.value = '';
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
            this.elements.loginBtn.disabled = true;
            this.elements.loading.style.display = 'block';
        } else {
            this.elements.loginBtn.disabled = false;
            this.elements.loading.style.display = 'none';
        }
    }
}

// Função global para toggle de senha
function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleBtn = document.querySelector('.password-toggle i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleBtn.className = 'fas fa-eye';
    }
}

// Função global para mostrar página de esqueceu senha
function showForgotPassword() {
    window.location.href = 'forgot-password.html';
}

// Inicializar quando o DOM estiver pronto
let loginHandler;
document.addEventListener('DOMContentLoaded', function() {
    loginHandler = new LoginHandler();
    window.loginHandler = loginHandler; // Disponibilizar globalmente
});

