// Marketing Avançado - Funcionalidades Premium
// Sistema de ativação e gerenciamento de recursos Premium

class MarketingAvancado {
    constructor() {
        this.isPremiumActive = false;
        this.premiumKey = null;
        // Não inicializar automaticamente - será chamado manualmente
    }

    async init() {
        console.log('🚀 Inicializando Marketing Avançado...');
        
        // Mostrar spinner de carregamento no status
        this.showStatusLoading();
        
        // Verificar autenticação primeiro
        if (!await this.verifyAuthentication()) {
            return; // Se não estiver autenticado, parar inicialização
        }
        
        // Verificar status Premium do usuário
        await this.checkPremiumStatus();
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Atualizar interface
        this.updateInterface();
        
        console.log('✅ Marketing Avançado inicializado');
    }

    /**
     * Verifica se o usuário está autenticado
     */
    async verifyAuthentication() {
        try {
            console.log('🔐 Verificando autenticação...');
            
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) {
                console.log('❌ Token não encontrado!');
                this.showAuthenticationError('Você precisa estar logado para acessar o Marketing Avançado.');
                return false;
            }
            
            // Verificar se o token é válido
            const response = await fetch(`${window.API_BASE}/auth/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.log('❌ Token inválido ou expirado!');
                this.showAuthenticationError('Sua sessão expirou. Faça login novamente.');
                return false;
            }
            
            const responseData = await response.json();
            console.log('✅ Resposta da API:', responseData);
            
            // Extrair dados do usuário da resposta
            const userData = responseData.user || responseData;
            console.log('✅ Dados do usuário:', userData);
            
            // Verificar se é vendedor - usar role diretamente
            const userRole = userData.role;
            console.log('🔍 Role detectado:', userRole);
            
            // Verificar se é vendedor (role: 'user' são vendedores)
            const isVendedor = userRole === 'user';
            
            // Verificação adicional: se não há role definido, mas o usuário tem ID, permitir acesso
            const hasUserId = userData.id || userData.user_id || userData.vendedor_id;
            const isUndefinedRole = !userRole || userRole === 'undefined' || userRole === null;
            
            if (!isVendedor && !(isUndefinedRole && hasUserId)) {
                console.log('❌ Usuário não é vendedor! Role:', userRole);
                this.showAuthenticationError('Apenas vendedores podem acessar o Marketing Avançado.');
                return false;
            }
            
            if (isUndefinedRole && hasUserId) {
                console.log('⚠️ Role não definido, mas usuário tem ID. Permitindo acesso...');
            }
            
            console.log('✅ Vendedor verificado com sucesso!');
            return true;
            
        } catch (error) {
            console.error('❌ Erro na verificação de autenticação:', error);
            this.showAuthenticationError('Erro de conexão. Verifique sua internet e tente novamente.');
            return false;
        }
    }

    /**
     * Mostra erro de autenticação
     */
    showAuthenticationError(message) {
        // Criar modal de erro de autenticação
        const modal = document.createElement('div');
        modal.id = 'authErrorModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; text-align: center;">
                <div class="modal-header">
                    <h3>🔐 Autenticação Necessária</h3>
                </div>
                <div class="modal-body">
                    <div style="font-size: 48px; margin: 20px 0; color: #dc3545;">
                        <i class="fas fa-lock"></i>
                    </div>
                    <p style="font-size: 16px; margin: 20px 0; color: #333;">
                        ${message}
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 30px;">
                        <button type="button" onclick="window.location.href='/login.html'" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                            <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>
                            Fazer Login
                        </button>
                        <button type="button" onclick="window.location.href='/dashboard.html'" style="padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Voltar ao Dashboard
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar estilos se não existirem
        if (!document.getElementById('authModalStyles')) {
            const style = document.createElement('style');
            style.id = 'authModalStyles';
            style.textContent = `
                .modal {
                    position: fixed;
                    z-index: 10000;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .modal-content {
                    background-color: #fefefe;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    animation: modalSlideIn 0.3s ease;
                }
                @keyframes modalSlideIn {
                    from { transform: translateY(-50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .modal-header h3 {
                    margin: 0 0 20px 0;
                    color: #333;
                    font-size: 24px;
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(modal);
        // document.body.style.overflow = 'hidden'; // REMOVIDO
        
        // Auto-redirecionar para login após 10 segundos
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 10000);
    }

    /**
     * Verifica o status Premium do usuário
     */
    async checkPremiumStatus() {
        try {
            console.log('🔍 Verificando status Premium...');
            
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ Token de autenticação não encontrado');
                return;
            }

            const response = await fetch(`${window.API_BASE}/marketing/premium-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.isPremiumActive = data.success && data.data?.plano_premium;
                this.premiumKey = data.data?.premium_key;
                
                console.log(`📊 Status Premium: ${this.isPremiumActive ? 'Ativo' : 'Inativo'}`);
                if (this.premiumKey) {
                    console.log(`🔑 Chave Premium: ${this.premiumKey}`);
                }
            } else {
                console.warn('⚠️ Erro ao verificar status Premium');
            }
        } catch (error) {
            console.error('❌ Erro ao verificar status Premium:', error);
        }
    }

    /**
     * Configura os event listeners
     */
    setupEventListeners() {
        // Event listeners para cards de funcionalidades
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            card.addEventListener('click', (e) => {
                this.handleFeatureClick(e.currentTarget);
            });
        });

        // Event listener para formulário de chave
        const keyForm = document.getElementById('keyForm');
        if (keyForm) {
            keyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleKeySubmission();
            });
        }

        // Event listener para fechar modal ao clicar fora
        const modal = document.getElementById('keyModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeKeyModal();
                }
            });
        }
    }

    /**
     * Mostra spinner de carregamento no status do plano
     */
    showStatusLoading() {
        const statusElement = document.getElementById('planStatus');
        if (statusElement) {
            statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
            statusElement.className = 'status-loading';
        }
    }

    /**
     * Atualiza a interface baseada no status Premium
     */
    updateInterface() {
        const statusElement = document.getElementById('planStatus');
        if (statusElement) {
            if (this.isPremiumActive) {
                statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Ativo';
                statusElement.className = 'status-active';
            } else {
                statusElement.innerHTML = '<i class="fas fa-times-circle"></i> Inativo';
                statusElement.className = 'status-inactive';
            }
        }

        // Atualizar cards de funcionalidades
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            if (this.isPremiumActive) {
                card.classList.remove('premium-locked');
                card.style.cursor = 'pointer';
            } else {
                card.classList.add('premium-locked');
                card.style.cursor = 'pointer';
            }
        });

        // Atualizar botões de ação baseado no status Premium
        this.updateActionButtons();
    }

    /**
     * Atualiza os botões de ação baseado no status Premium
     */
    updateActionButtons() {
        const actionButtonsContainer = document.querySelector('.action-buttons');
        if (!actionButtonsContainer) return;

        if (this.isPremiumActive) {
            // Premium ativo - mostrar botão de acesso
            actionButtonsContainer.innerHTML = `
                <button class="btn-premium-active" onclick="accessPremiumFeatures()">
                    <i class="fas fa-crown"></i> Marketing Avançado Premium
                </button>
            `;
        } else {
            // Premium inativo - mostrar botões de pagamento e chave
            actionButtonsContainer.innerHTML = `
                <button class="btn-premium" onclick="redirectToCheckout()">
                    <i class="fas fa-crown"></i> Pagar Premium por 250 MZN
                </button>
                <button class="btn-key" onclick="openKeyModal()">
                    <i class="fas fa-key"></i> Inserir Chave de Desbloqueio
                </button>
            `;
        }
    }

    /**
     * Manipula o clique em uma funcionalidade
     */
    handleFeatureClick(card) {
        const feature = card.dataset.feature;
        
        if (!this.isPremiumActive) {
            this.showPremiumNotification();
            return;
        }

        // Se Premium ativo, permitir acesso à funcionalidade
        this.activateFeature(feature);
    }

    /**
     * Mostra notificação de recurso Premium
     */
    showPremiumNotification() {
        this.showNotification(
            '⚠️ Recurso exclusivo Premium. Ative o plano para desbloquear.',
            'warning'
        );
    }

    /**
     * Ativa uma funcionalidade Premium
     */
    activateFeature(feature) {
        const featureNames = {
            'remarketing': 'Remarketing Automático',
            'pos-venda': 'Promoções Pós-Venda',
            'temporizador': 'Checkout com Temporizador',
            'descontos': 'Descontos Inteligentes',
            'campanhas': 'Automação de Campanhas',
            'cross-sell': 'Cross-sell e Upsell Automático',
            'retencao': 'Campanhas de Retenção'
        };

        const featureName = featureNames[feature] || feature;
        
        this.showNotification(
            `✅ ${featureName} ativado com sucesso!`,
            'success'
        );

        // Aqui você pode adicionar a lógica específica para cada funcionalidade
        console.log(`🎯 Ativando funcionalidade: ${featureName}`);

        // Se for o card de Order Bump (data-feature="order-bump"), abrir modal em modo leitura
        if (feature === 'order-bump') {
            openOrderBumpModal();
            // Carregar dados de monitoramento (somente leitura)
            setTimeout(() => {
                carregarResumoOrderBump();
            }, 0);
        }
    }

    /**
     * Redireciona para o checkout Premium
     */
    redirectToCheckout() {
        // Obter dados do vendedor logado
        const vendedor = this.getVendedorData();
        
        // URL do produto de marketing avançado
        const checkoutUrl = `http://localhost:3000/checkout.html?produto=L47FUIO0N&vendedor=${vendedor.id}&email=${encodeURIComponent(vendedor.email)}&nome=${encodeURIComponent(vendedor.nome)}`;
        
        console.log('🛒 Redirecionando para checkout Premium...');
        console.log('👤 Dados do vendedor:', vendedor);
        console.log('🔗 URL:', checkoutUrl);
        
        // Redirecionar na mesma aba para manter contexto
        window.location.href = checkoutUrl;
    }

    /**
     * Obter dados do vendedor logado
     */
    getVendedorData() {
        try {
            // Tentar obter dados do localStorage
            const userData = localStorage.getItem('userData');
            if (userData) {
                const user = JSON.parse(userData);
                return {
                    id: user.id,
                    nome: user.nome_completo || user.nome,
                    email: user.email,
                    telefone: user.telefone
                };
            }

            // Fallback: tentar obter do token
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (token) {
                // Decodificar token JWT (parte do payload)
                try {
                    const payload = JSON.parse(atob(token.split('.')[1]));
                    return {
                        id: payload.id || payload.user_id,
                        nome: payload.nome_completo || payload.nome,
                        email: payload.email,
                        telefone: payload.telefone
                    };
                } catch (e) {
                    console.warn('Não foi possível decodificar o token');
                }
            }

            // Dados padrão se não conseguir obter
            return {
                id: 'unknown',
                nome: 'Vendedor',
                email: 'vendedor@ratixpay.com',
                telefone: ''
            };
        } catch (error) {
            console.error('Erro ao obter dados do vendedor:', error);
            return {
                id: 'unknown',
                nome: 'Vendedor',
                email: 'vendedor@ratixpay.com',
                telefone: ''
            };
        }
    }

    /**
     * Acessa as funcionalidades Premium
     */
    accessPremiumFeatures() {
        this.showNotification('🎉 Bem-vindo ao Marketing Avançado Premium! Todas as funcionalidades estão desbloqueadas!', 'success');
        
        // Aqui você pode adicionar lógica para navegar para uma página específica
        // ou mostrar um modal com as funcionalidades disponíveis
        console.log('🎯 Acessando funcionalidades Premium...');
        
        // Exemplo: mostrar modal com funcionalidades disponíveis
        this.showPremiumFeaturesModal();
    }

    /**
     * Verificar status do Marketing Avançado via API
     */
    async verificarStatusMarketingAvancado() {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            const response = await fetch('/api/marketing/status-avancado', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📊 Status do Marketing Avançado:', data);
                
                if (data.ativo) {
                    this.isPremiumActive = true;
                    this.updateUI();
                    this.mostrarStatusAtivo(data);
                } else {
                    this.isPremiumActive = false;
                    this.updateUI();
                    this.mostrarStatusInativo(data.motivo);
                }
            } else {
                console.error('Erro ao verificar status do Marketing Avançado');
                this.mostrarStatusInativo('Erro ao verificar status');
            }
        } catch (error) {
            console.error('Erro ao verificar status do Marketing Avançado:', error);
            this.mostrarStatusInativo('Erro de conexão');
        }
    }

    /**
     * Mostrar status ativo do Marketing Avançado
     */
    mostrarStatusAtivo(dados) {
        const statusElement = document.getElementById('planStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <span class="status-active">
                    <i class="fas fa-check-circle"></i>
                    Marketing Avançado Ativo
                </span>
                <div class="status-details">
                    <small>Válido até: ${new Date(dados.data_expiracao).toLocaleDateString('pt-BR')}</small>
                    <small>Dias restantes: ${dados.dias_restantes}</small>
                </div>
            `;
        }
    }

    /**
     * Mostrar status inativo do Marketing Avançado
     */
    mostrarStatusInativo(motivo) {
        const statusElement = document.getElementById('planStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <span class="status-inactive">
                    <i class="fas fa-times-circle"></i>
                    Marketing Avançado Inativo
                </span>
                <div class="status-details">
                    <small>Motivo: ${motivo}</small>
                </div>
            `;
        }
    }

    /**
     * Mostra modal com funcionalidades Premium disponíveis
     */
    showPremiumFeaturesModal() {
        const modal = document.createElement('div');
        modal.id = 'premiumFeaturesModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2><i class="fas fa-crown"></i> Marketing Avançado Premium</h2>
                    <span class="close-button" onclick="this.closest('.modal').remove()">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 48px; color: #FFD700; margin-bottom: 10px;">
                            <i class="fas fa-crown"></i>
                        </div>
                        <h3 style="color: #333; margin-bottom: 10px;">Parabéns!</h3>
                        <p style="color: #666;">Você tem acesso completo ao Marketing Avançado Premium</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0;">
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <i class="fab fa-whatsapp" style="font-size: 24px; color: #25D366; margin-bottom: 8px;"></i>
                            <h4>Remarketing Automático</h4>
                            <p style="font-size: 12px; color: #666;">Recuperação de vendas canceladas</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <i class="fas fa-gift" style="font-size: 24px; color: #e74c3c; margin-bottom: 8px;"></i>
                            <h4>Promoções Pós-Venda</h4>
                            <p style="font-size: 12px; color: #666;">Follow-up após compra</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <i class="fas fa-clock" style="font-size: 24px; color: #f39c12; margin-bottom: 8px;"></i>
                            <h4>Checkout com Temporizador</h4>
                            <p style="font-size: 12px; color: #666;">Gatilho de urgência</p>
                        </div>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center;">
                            <i class="fas fa-percentage" style="font-size: 24px; color: #27ae60; margin-bottom: 8px;"></i>
                            <h4>Descontos Inteligentes</h4>
                            <p style="font-size: 12px; color: #666;">Carrinho abandonado</p>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin-top: 20px;">
                        <button onclick="this.closest('.modal').remove()" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                            <i class="fas fa-check"></i> Entendi
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        // document.body.style.overflow = 'hidden'; // REMOVIDO
    }

    /**
     * Abre o modal de chave Premium
     */
    openKeyModal() {
        const modal = document.getElementById('keyModal');
        if (modal) {
            modal.style.display = 'block';
            // document.body.style.overflow = 'hidden'; // REMOVIDO
        }
    }

    /**
     * Fecha o modal de chave Premium
     */
    closeKeyModal() {
        const modal = document.getElementById('keyModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            
            // Limpar formulário
            const form = document.getElementById('keyForm');
            if (form) {
                form.reset();
            }
        }
    }

    /**
     * Manipula o envio da chave Premium
     */
    async handleKeySubmission() {
        const keyInput = document.getElementById('premiumKey');
        const premiumKey = keyInput.value.trim();

        if (!premiumKey) {
            this.showNotification('❌ Por favor, digite uma chave válida.', 'error');
            keyInput.focus();
            return;
        }

        // Validar formato da chave
        if (!this.validatePremiumKeyFormat(premiumKey)) {
            this.showNotification('❌ Formato de chave inválido. A chave deve começar com "PREMIUM-"', 'error');
            keyInput.focus();
            return;
        }

        try {
            console.log('🔑 Validando chave Premium...');
            
            // Verificar autenticação
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) {
                this.showNotification('❌ Erro de autenticação. Faça login novamente.', 'error');
                this.closeKeyModal();
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }

            // Mostrar loading
            const submitButton = document.querySelector('.btn-submit-key');
            if (submitButton) {
                const originalText = submitButton.textContent;
                submitButton.textContent = 'Ativando...';
                submitButton.disabled = true;
            }

            const response = await fetch(`${window.API_BASE}/marketing/activate-premium`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ premium_key: premiumKey })
            });

            const data = await response.json();

            // Restaurar botão
            if (submitButton) {
                submitButton.textContent = 'Ativar Premium';
                submitButton.disabled = false;
            }

            if (response.ok && data.success) {
                this.isPremiumActive = true;
                this.premiumKey = premiumKey;
                
                this.showNotification('🎉 Premium ativado com sucesso! Agora você tem acesso ao Marketing Avançado!', 'success');
                this.closeKeyModal();
                
                // Limpar campo
                keyInput.value = '';
                
                // Atualizar interface
                this.updateInterface();
                
                // Mostrar indicador visual de sucesso
                this.showPremiumActivatedIndicator();
                
            } else {
                const errorMessage = data.message || '❌ Chave inválida ou expirada. Por favor, verifique seu pagamento.';
                this.showNotification(errorMessage, 'error');
                
                // Destacar campo com erro
                keyInput.style.borderColor = '#dc3545';
                keyInput.style.boxShadow = '0 0 0 0.2rem rgba(220, 53, 69, 0.25)';
                
                // Remover destaque após 3 segundos
                setTimeout(() => {
                    keyInput.style.borderColor = '';
                    keyInput.style.boxShadow = '';
                }, 3000);
            }
        } catch (error) {
            console.error('❌ Erro ao ativar Premium:', error);
            this.showNotification('❌ Erro de conexão. Verifique sua internet e tente novamente.', 'error');
            
            // Restaurar botão em caso de erro
            const submitButton = document.querySelector('.btn-submit-key');
            if (submitButton) {
                submitButton.textContent = 'Ativar Premium';
                submitButton.disabled = false;
            }
        }
    }

    /**
     * Valida o formato da chave Premium
     */
    validatePremiumKeyFormat(key) {
        // Chave deve começar com "PREMIUM-" e ter pelo menos 20 caracteres
        const premiumKeyRegex = /^PREMIUM-[A-Z0-9]{10,}$/;
        return premiumKeyRegex.test(key);
    }

    /**
     * Mostra indicador visual de Premium ativado
     */
    showPremiumActivatedIndicator() {
        const container = document.querySelector('.content-wrapper');
        if (container) {
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 20px;
                margin: 20px 0;
                border-radius: 15px;
                text-align: center;
                font-weight: bold;
                box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
                animation: slideInDown 0.5s ease;
            `;
            indicator.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 10px;">
                    <i class="fas fa-crown"></i> 🎉
                </div>
                <div style="font-size: 18px; margin-bottom: 5px;">
                    Marketing Avançado Ativado!
                </div>
                <div style="font-size: 14px; opacity: 0.9;">
                    Agora você tem acesso a todas as funcionalidades Premium
                </div>
            `;
            
            // Inserir após o banner
            const banner = document.querySelector('.premium-banner');
            if (banner) {
                banner.insertAdjacentElement('afterend', indicator);
            }
            
            // Remover após 5 segundos
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.remove();
                }
            }, 5000);
        }
    }

    /**
     * Mostra uma notificação na tela
     */
    showNotification(message, type = 'info') {
        // Remover notificação existente
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Criar nova notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Mostrar notificação
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Remover notificação após 5 segundos
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Inicializar Marketing Avançado quando a página carregar
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, inicializando Marketing Avançado...');
    const marketingAvancado = new MarketingAvancado();
    window.marketingAvancado = marketingAvancado; // Armazenar globalmente
    marketingAvancado.init();
});

// Funções globais para os botões
function redirectToCheckout() {
    if (window.marketingAvancado) {
        window.marketingAvancado.redirectToCheckout();
    }
}

function openKeyModal() {
    if (window.marketingAvancado) {
        window.marketingAvancado.openKeyModal();
    }
}

function accessPremiumFeatures() {
    if (window.marketingAvancado) {
        window.marketingAvancado.accessPremiumFeatures();
    }
}

function closeKeyModal() {
    if (window.marketingAvancado) {
        window.marketingAvancado.closeKeyModal();
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Marketing Avançado...');
    window.marketingAvancado = new MarketingAvancado();
});
