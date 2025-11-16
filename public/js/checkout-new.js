// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE


// Função debounce para otimizar chamadas
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Variáveis globais
let currentProduct = null;
let orderData = {};
let vendorEmail = null; // Email do vendedor para produtos Premium
let blackfridayData = null; // Dados do Black Friday
let descontoData = null; // Dados dos descontos inteligentes

// Função para autenticação automática
function handleAutoAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const auth = urlParams.get('auth');
    const email = urlParams.get('email');
    const nome = urlParams.get('nome');
    
    if (auth === 'auto' && email && nome) {
        
        // Preencher campos automaticamente
        const emailInput = document.getElementById('email');
        const nomeInput = document.getElementById('nome');
        
        if (emailInput) {
            emailInput.value = decodeURIComponent(email);
            emailInput.readOnly = true;
            emailInput.style.backgroundColor = '#f8f9fa';
        }
        
        if (nomeInput) {
            nomeInput.value = decodeURIComponent(nome);
            nomeInput.readOnly = true;
            nomeInput.style.backgroundColor = '#f8f9fa';
        }
        
        // Mostrar indicador de autenticação automática
        showAutoAuthIndicator();
        
        return true;
    }
    
    return false;
}

// Função para mostrar indicador de autenticação automática
function showAutoAuthIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'autoAuthIndicator';
    indicator.innerHTML = `
        <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 10px; font-size: 14px;">
            <i class="fas fa-check-circle"></i>
            <span>Autenticação automática ativada - Dados preenchidos automaticamente</span>
        </div>
    `;
    
    const form = document.querySelector('.checkout-form');
    if (form) {
        form.insertBefore(indicator, form.firstChild);
    }
}

// Função para verificar Black Friday
async function checkBlackFriday(productId) {
    try {
        
        // Não fazer chamada para API inexistente, retornar false
        // O Black Friday será verificado diretamente nas configurações do produto
        hideBlackFridayBanner();
        return false;
    } catch (error) {
        console.error('❌ Erro ao verificar Black Friday:', error);
        hideBlackFridayBanner();
        return false;
    }
}

// Função para exibir banner de Black Friday
function showBlackFridayBanner(blackFridayConfig) {
    const banner = document.getElementById('blackfridayBanner');
    
    if (banner && blackFridayConfig) {
        // Criar ou atualizar o conteúdo do banner
        banner.innerHTML = `
            <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 15px 20px; border-radius: 8px; text-align: center; font-weight: bold; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.4); animation: pulse 2s infinite; border: 2px solid #ffc107;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 5px;">
                    <span style="font-size: 1.3rem;">🔥</span>
                    <span style="font-size: 1.1rem;">BLACK FRIDAY</span>
                    <span style="font-size: 1.3rem;">🔥</span>
                </div>
                <div style="font-size: 1rem; margin-bottom: 5px;">
                    ${blackFridayConfig.message || '🔥 BLACK FRIDAY - Ofertas Imperdíveis!'}
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    ⚡ Oferta por tempo limitado - Aproveite agora!
                </div>
            </div>
        `;
        banner.style.display = 'block';
    }
}

// Função para ocultar banner de Black Friday
function hideBlackFridayBanner() {
    const banner = document.getElementById('blackfridayBanner');
    if (banner) {
        banner.style.display = 'none';
    }
}

// Função para mostrar mensagem de urgência
function showUrgencyMessage(message) {
    // Criar elemento de mensagem de urgência
    const urgencyDiv = document.createElement('div');
    urgencyDiv.className = 'urgency-message';
    urgencyDiv.innerHTML = `
        <div class="urgency-content">
            <span class="urgency-icon">⏰</span>
            <span class="urgency-text">${message}</span>
        </div>
    `;
    
    // Adicionar estilos
    urgencyDiv.style.cssText = `
        background: #fff3cd;
        color: #856404;
        padding: 10px 20px;
        text-align: center;
        font-weight: 600;
        border: 1px solid #ffeaa7;
        animation: urgencyPulse 1s infinite;
    `;
    
    // Inserir após o banner de Black Friday
    const banner = document.getElementById('blackfridayBanner');
    if (banner && banner.nextSibling) {
        banner.parentNode.insertBefore(urgencyDiv, banner.nextSibling);
    } else if (banner) {
        banner.parentNode.appendChild(urgencyDiv);
    }
    
    // Remover após 10 segundos
    setTimeout(() => {
        if (urgencyDiv.parentNode) {
            urgencyDiv.parentNode.removeChild(urgencyDiv);
        }
    }, 10000);
}

// Função para verificar Descontos Inteligentes
async function checkDescontosInteligentes(productId) {
    try {
        
        // Não fazer chamada para API inexistente, retornar false
        // Os descontos serão verificados diretamente nas configurações do produto
        hideDescontoInteligente();
        return false;
    } catch (error) {
        console.error('❌ Erro ao verificar Descontos Inteligentes:', error);
        hideDescontoInteligente();
        return false;
    }
}

// Função para exibir desconto inteligente
function showDescontoInteligente() {
    if (!descontoData) return;
    
    // Atualizar preço no checkout
    const priceElement = document.getElementById('productPrice');
    if (priceElement && descontoData.precoComDesconto) {
        const precoOriginal = descontoData.precoOriginal;
        const precoComDesconto = descontoData.precoComDesconto;
        const percentual = descontoData.percentual;
        
        // Criar estrutura de preço com desconto
        priceElement.innerHTML = `
            <div class="price-container">
                <div class="price-old">${formatPrice(precoOriginal).replace('.', ',')} MZN</div>
                <div class="price-new">${formatPrice(precoComDesconto).replace('.', ',')} MZN</div>
                <div class="discount-badge">-${percentual}%</div>
            </div>
        `;
        
        // Adicionar estilos para o desconto
        const style = document.createElement('style');
        style.textContent = `
            .price-container {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            .price-old {
                text-decoration: line-through;
                color: #999;
                font-size: 0.9rem;
            }
            .price-new {
                color: #28a745;
                font-weight: 700;
                font-size: 1.2rem;
            }
            .discount-badge {
                background: #28a745;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: 700;
            }
        `;
        document.head.appendChild(style);
        
        // Mostrar mensagem de desconto
        showDescontoMessage(descontoData.texto);
    }
}

// Função para ocultar desconto inteligente
function hideDescontoInteligente() {
    // Restaurar preço original se necessário
    const priceElement = document.getElementById('productPrice');
    if (priceElement && currentProduct) {
        const preco = currentProduct.preco || currentProduct.precoComDesconto || 0;
        priceElement.textContent = `MZN ${preco.toFixed(2).replace('.', ',')}`;
    }
    
    // Remover mensagem de desconto
    const existingMessage = document.querySelector('.desconto-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Função para mostrar mensagem de desconto
function showDescontoMessage(message) {
    // Remover mensagem existente se houver
    const existingMessage = document.querySelector('.desconto-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar nova mensagem
    const messageDiv = document.createElement('div');
    messageDiv.className = 'desconto-message';
    messageDiv.innerHTML = `
        <div class="desconto-content">
            <span class="desconto-icon">💰</span>
            <span class="desconto-text">${message}</span>
        </div>
    `;
    
    // Adicionar estilos
    messageDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 10px 15px;
        border-radius: 8px;
        margin: 10px 0;
        text-align: center;
        font-weight: 600;
        border: 1px solid #c3e6cb;
        animation: descontoSlideIn 0.5s ease;
    `;
    
    // Inserir após o card do produto
    const productCard = document.getElementById('productCard');
    if (productCard) {
        productCard.parentNode.insertBefore(messageDiv, productCard.nextSibling);
    }
}

// Função para gerar link seguro da página de sucesso
function gerarLinkSeguroSucesso(pedidoNumero, productId, clientName, amount) {
    // Usar idpedido se o pedidoNumero for um número de 6 dígitos, senão usar pedido
    const isIdPedido = /^\d{6}$/.test(pedidoNumero);
    const pedidoParam = isIdPedido ? `idpedido=${pedidoNumero}` : `pedido=${pedidoNumero}`;
    
    // Construir URL base
    let url = `/payment-success.html?${pedidoParam}&productId=${productId || ''}&clientName=${encodeURIComponent(clientName || '')}&amount=${amount || ''}`;
    
    // Sempre incluir parâmetros UTM do localStorage se disponíveis
    try {
        const savedUtmParams = localStorage.getItem('utm_tracking_params');
        if (savedUtmParams) {
            const utmParams = JSON.parse(savedUtmParams);
            const utmQueryParams = [];
            
            // Adicionar cada parâmetro UTM se não for null
            if (utmParams.utm_source) utmQueryParams.push(`utm_source=${encodeURIComponent(utmParams.utm_source)}`);
            if (utmParams.utm_medium) utmQueryParams.push(`utm_medium=${encodeURIComponent(utmParams.utm_medium)}`);
            if (utmParams.utm_campaign) utmQueryParams.push(`utm_campaign=${encodeURIComponent(utmParams.utm_campaign)}`);
            if (utmParams.utm_content) utmQueryParams.push(`utm_content=${encodeURIComponent(utmParams.utm_content)}`);
            if (utmParams.utm_term) utmQueryParams.push(`utm_term=${encodeURIComponent(utmParams.utm_term)}`);
            if (utmParams.src) utmQueryParams.push(`src=${encodeURIComponent(utmParams.src)}`);
            if (utmParams.sck) utmQueryParams.push(`sck=${encodeURIComponent(utmParams.sck)}`);
            
            if (utmQueryParams.length > 0) {
                url += '&' + utmQueryParams.join('&');
            }
        } else {
        }
    } catch (error) {
        console.warn('⚠️ Erro ao incluir parâmetros UTM na URL:', error);
    }
    
    return url;
}

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
    try {
        // Verificar se API_BASE está definido
        if (!window.API_BASE) {
            console.error('API_BASE não está definido. Definindo valor padrão.');
            window.API_BASE = window.location.origin + '/api';
        }
        
        
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            },
            ...options
        });
        
        
        let responseData;
        try {
            responseData = await response.json();
        } catch (parseError) {
            console.error('Erro ao analisar resposta JSON:', parseError);
            throw new Error(`Erro ao processar resposta do servidor: ${response.status}`);
        }
        
        if (!response.ok) {
            // Extrair mensagem de erro detalhada da resposta
            const errorMessage = responseData.message || responseData.error || `Erro no servidor: ${response.status}`;
            console.error('Erro na resposta da API:', errorMessage, responseData);
            throw new Error(errorMessage);
        }
        
        return responseData;
    } catch (error) {
        console.error('Erro na requisição API:', error);
        
        // Melhorar mensagem de erro para o usuário
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
        }
        
        throw error;
    }
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: bold;
                z-index: 1000;
                animation: slideIn 0.3s ease;
            }
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.warning { background: #ffc107; color: #333; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .notification-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
            }
            .notification-content button {
                background: transparent;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .notification.error .notification-content button { color: white; }
            .notification.warning .notification-content button { color: #333; }
            .product-not-found-message {
                background: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 12px;
                padding: 30px;
                margin: 20px auto;
                max-width: 600px;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .product-not-found-message h2 {
                color: #856404;
                margin-bottom: 15px;
                font-size: 24px;
            }
            .product-not-found-message p {
                color: #856404;
                margin-bottom: 10px;
                font-size: 16px;
            }
            .product-not-found-message .icon {
                font-size: 48px;
                margin-bottom: 15px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Função para exibir mensagem quando produto não for encontrado
function showProductNotFoundMessage(productId) {
    // Remover mensagem existente se houver
    const existingMessage = document.querySelector('.product-not-found-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Garantir que os estilos estão aplicados
    if (!document.querySelector('#product-not-found-styles')) {
        const style = document.createElement('style');
        style.id = 'product-not-found-styles';
        style.textContent = `
            .product-not-found-message {
                background: #fff3cd;
                border: 2px solid #ffc107;
                border-radius: 12px;
                padding: 30px;
                margin: 20px;
                max-width: 100%;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .product-not-found-message h2 {
                color: #856404;
                margin-bottom: 15px;
                font-size: 24px;
                font-weight: 700;
            }
            .product-not-found-message p {
                color: #856404;
                margin-bottom: 10px;
                font-size: 16px;
                line-height: 1.5;
            }
            .product-not-found-message .icon {
                font-size: 48px;
                margin-bottom: 15px;
                display: block;
            }
            .product-not-found-message strong {
                color: #856404;
                font-weight: 700;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Criar mensagem visual
    const messageDiv = document.createElement('div');
    messageDiv.className = 'product-not-found-message';
    messageDiv.innerHTML = `
        <div class="icon">⚠️</div>
        <h2>Produto Não Encontrado</h2>
        <p>O produto com o ID <strong>${productId || 'desconhecido'}</strong> não foi encontrado em nosso sistema.</p>
        <p>Por favor, verifique se o link está correto ou entre em contato com o suporte.</p>
        <p style="margin-top: 20px; font-size: 14px; color: #6c757d;">
            Se você acredita que isso é um erro, entre em contato com nosso suporte.
        </p>
    `;
    
    // Esconder elementos do produto primeiro
    const productCard = document.getElementById('productCard');
    if (productCard) {
        productCard.style.display = 'none';
    }
    
    const checkoutForm = document.querySelector('.checkout-form');
    if (checkoutForm) {
        checkoutForm.style.display = 'none';
    }
    
    const paymentSection = document.querySelector('.payment-section');
    if (paymentSection) {
        paymentSection.style.display = 'none';
    }
    
    // Inserir no container do checkout (substituir o conteúdo)
    const checkoutContainer = document.querySelector('.checkout-container');
    if (checkoutContainer) {
        // Limpar conteúdo existente e adicionar mensagem
        checkoutContainer.innerHTML = '';
        checkoutContainer.appendChild(messageDiv);
        checkoutContainer.style.padding = '20px';
    } else {
        // Se não encontrar o container, criar um wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'checkout-container';
        wrapper.style.cssText = 'background: #fff; border-radius: 12px; width: 95%; max-width: 420px; margin: 20px auto; padding: 20px;';
        wrapper.appendChild(messageDiv);
        document.body.insertBefore(wrapper, document.body.firstChild);
    }
}

// Função para verificar autenticação e tipo de conta
async function verifyUserAuthentication() {
    try {
        
        // Verificar se há token
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        if (!token) {
            showAuthenticationError('Você precisa estar logado para comprar produtos Premium.');
            return null;
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
            showAuthenticationError('Sua sessão expirou. Faça login novamente.');
            return null;
        }
        
        const responseData = await response.json();
        
        // Extrair dados do usuário da resposta
        const userData = responseData.user || responseData;
        
        // Verificar se é vendedor
        if (userData.role !== 'user') {
            showAuthenticationError('Apenas vendedores podem comprar produtos Premium.');
            return null;
        }
        
        return userData;
        
    } catch (error) {
        console.error('❌ Erro na verificação de autenticação:', error);
        showAuthenticationError('Erro de conexão. Verifique sua internet e tente novamente.');
        return null;
    }
}

// Função para mostrar erro de autenticação
function showAuthenticationError(message) {
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
                    <button type="button" onclick="redirectToLogin()" style="padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-sign-in-alt" style="margin-right: 8px;"></i>
                        Fazer Login
                    </button>
                    <button type="button" onclick="closeAuthErrorModal()" style="padding: 12px 24px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Cancelar
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
    
    // Auto-redirecionar após 10 segundos
    setTimeout(() => {
        redirectToLogin();
    }, 10000);
}

// Função para redirecionar para login
function redirectToLogin() {
    window.location.href = '/login.html';
}

// Função para fechar modal de erro
function closeAuthErrorModal() {
    const modal = document.getElementById('authErrorModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
    }
}

// Função para identificar vendedor para produtos Premium
async function identifyVendorForPremium(productId) {
    try {
        
        // Verificar autenticação
        const userData = await verifyUserAuthentication();
        if (!userData) {
            return; // Erro já foi tratado na verificação
        }
        
        // Se chegou até aqui, usuário está autenticado e é vendedor
        vendorEmail = userData.email;
        
        // Preencher automaticamente os campos do formulário
        fillUserDataInForm(userData);
        
        // Atualizar a interface para mostrar que o vendedor foi identificado
        updateVendorIdentificationUI();
        
        // Mostrar notificação informativa
        showNotification(`🎯 Pagamento Premium será ativado para: ${vendorEmail}`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao identificar vendedor:', error);
        showAuthenticationError('Erro inesperado. Tente recarregar a página.');
    }
}

// Função para lidar com produto especial N0SAITYAX
async function handleSpecialProduct(productId) {
    try {
        
        // Mostrar banner especial
        showSpecialProductBanner();
        
        // Configurar funcionalidades exclusivas
        setupSpecialProductFeatures();
        
        // Verificar se há vendedor associado
        await identifyVendorForSpecialProduct(productId);
        
    } catch (error) {
        console.error('❌ Erro ao processar produto especial:', error);
    }
}

// Função para mostrar banner do produto especial
function showSpecialProductBanner() {
    const banner = document.createElement('div');
    banner.id = 'specialProductBanner';
    banner.innerHTML = `
        <div style="background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-star" style="font-size: 24px; animation: pulse 2s infinite;"></i>
                <h3 style="margin: 0; font-size: 20px; font-weight: 700;">PRODUTO ESPECIAL</h3>
                <i class="fas fa-star" style="font-size: 24px; animation: pulse 2s infinite;"></i>
            </div>
            <p style="margin: 0; font-size: 16px; font-weight: 500;">
                🎯 Pacote Premium de Marketing Digital será ativado automaticamente após o pagamento!
            </p>
            <div style="margin-top: 10px; padding: 8px 16px; background: rgba(255, 255, 255, 0.2); border-radius: 8px; font-size: 14px;">
                <i class="fas fa-check-circle"></i> Ativação automática via email de confirmação
            </div>
        </div>
        <style>
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
            }
        </style>
    `;
    
    const form = document.querySelector('.checkout-form');
    if (form) {
        form.insertBefore(banner, form.firstChild);
    }
}

// Função para configurar funcionalidades exclusivas do produto especial
function setupSpecialProductFeatures() {
    
    // Adicionar indicador visual especial
    const productContainer = document.querySelector('.product-info');
    if (productContainer) {
        const specialIndicator = document.createElement('div');
        specialIndicator.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 10px; border-radius: 8px; margin-top: 10px; text-align: center; font-weight: 600;">
                <i class="fas fa-crown"></i> Produto com Ativação Automática de Premium
            </div>
        `;
        productContainer.appendChild(specialIndicator);
    }
    
    // Modificar comportamento do checkout para produto especial
    window.specialProductActive = true;
}

// Função para identificar vendedor para produto especial
async function identifyVendorForSpecialProduct(productId) {
    try {
        
        // Verificar autenticação
        const userData = await verifyUserAuthentication();
        if (!userData) {
            return; // Erro já foi tratado na verificação
        }
        
        // Se chegou até aqui, usuário está autenticado e é vendedor
        vendorEmail = userData.email;
        
        // Preencher automaticamente os campos do formulário
        fillUserDataInForm(userData);
        
        // Atualizar a interface para mostrar que o vendedor foi identificado
        updateSpecialVendorIdentificationUI();
        
        // Mostrar notificação informativa
        showNotification(`🎯 Pacote Premium será ativado automaticamente para: ${vendorEmail}`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao identificar vendedor para produto especial:', error);
        showAuthenticationError('Erro inesperado. Tente recarregar a página.');
    }
}

// Função para atualizar UI de identificação do vendedor para produto especial
function updateSpecialVendorIdentificationUI() {
    const vendorIndicator = document.getElementById('vendorIndicator');
    if (vendorIndicator) {
        vendorIndicator.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 12px; border-radius: 8px; margin-bottom: 15px; text-align: center; font-weight: 600;">
                <i class="fas fa-crown"></i> Premium será ativado automaticamente para: ${vendorEmail}
            </div>
        `;
    }
}

// Função para preencher dados do usuário no formulário
function fillUserDataInForm(userData) {
    try {
        
        // Preencher nome completo
        const fullNameInput = document.getElementById('fullName');
        if (fullNameInput && userData.nome_completo) {
            fullNameInput.value = userData.nome_completo;
        }
        
        // Preencher email
        const emailInput = document.getElementById('email');
        if (emailInput && userData.email) {
            emailInput.value = userData.email;
        }
        
        // Preencher telefone se disponível
        const phoneInput = document.getElementById('phone');
        if (phoneInput && userData.telefone) {
            phoneInput.value = userData.telefone;
        }
        
        // Preencher WhatsApp se disponível
        const whatsappInput = document.getElementById('whatsapp');
        if (whatsappInput && userData.whatsapp_contact) {
            whatsappInput.value = userData.whatsapp_contact;
        }
        
        
    } catch (error) {
        console.error('❌ Erro ao preencher dados do usuário:', error);
    }
}

// Função para atualizar a UI após identificação do vendedor
function updateVendorIdentificationUI() {
    // Adicionar indicador visual de que o vendedor foi identificado
    const productInfo = document.querySelector('.product-info');
    if (productInfo && vendorEmail) {
        let vendorIndicator = document.getElementById('vendorIndicator');
        if (!vendorIndicator) {
            vendorIndicator = document.createElement('div');
            vendorIndicator.id = 'vendorIndicator';
            vendorIndicator.style.cssText = `
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 10px 15px;
                border-radius: 8px;
                margin: 10px 0;
                font-weight: bold;
                text-align: center;
                box-shadow: 0 2px 8px rgba(40, 167, 69, 0.3);
            `;
            productInfo.appendChild(vendorIndicator);
        }
        vendorIndicator.innerHTML = `🎯 Premium será ativado para: ${vendorEmail}`;
    }
}

// Função para carregar produto
async function loadProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('produto') || urlParams.get('id');
    
    if (!productId) {
        showNotification('ID do produto não encontrado', 'error');
        return;
    }
    
    
    // Verificar autenticação automática
    const isAutoAuth = handleAutoAuth();
    if (isAutoAuth) {
    }
    
    // Verificar se é o produto Premium e identificar vendedor
    if (productId === '1PZO2Y0M6') {
        await identifyVendorForPremium(productId);
    }
    
    // Verificar se é o produto especial N0SAITYAX
    if (productId === 'N0SAITYAX') {
        await handleSpecialProduct(productId);
    }

    // As configurações de Black Friday e descontos serão verificadas diretamente
    // nas configurações do produto após o carregamento
    
    try {
        // Verificar se API_BASE está definido
        if (!window.API_BASE) {
            throw new Error('API_BASE não está definido');
        }
        
        // Tentar buscar por customId primeiro, depois por ID
        const endpoint = `/produtos/public/${productId}`;
        
        // Para checkout, não precisamos de autenticação
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            // Verificar se é erro 404 (produto não encontrado)
            if (response.status === 404) {
                throw new Error('PRODUTO_NAO_ENCONTRADO');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseData = await response.json();
        
        // Verificar se a resposta indica que o produto não existe
        if (responseData.success === false || (responseData.message && responseData.message.includes('não encontrado'))) {
            throw new Error('PRODUTO_NAO_ENCONTRADO');
        }
        
        // A API pode retornar com ou sem wrapper { produto: {...} }
        // Normalizar estrutura
        if (responseData.produto) {
            currentProduct = responseData.produto;
        } else if (responseData.success && responseData.produto) {
            currentProduct = responseData.produto;
        } else {
            // Verificar se a resposta está vazia ou não tem dados do produto
            if (!responseData || !responseData.nome) {
                throw new Error('PRODUTO_NAO_ENCONTRADO');
            }
            currentProduct = responseData;
        }
        
        // Verificar se o produto tem nome (validação final)
        if (!currentProduct || !currentProduct.nome) {
            throw new Error('PRODUTO_NAO_ENCONTRADO');
        }
        
        // Sempre salvar dados do produto no localStorage
        if (currentProduct && currentProduct.nome) {
            localStorage.setItem("currentProductName", currentProduct.nome);
            localStorage.setItem("currentProductId", currentProduct.id || currentProduct.custom_id);
            
            // Salvar Pixel ID e eventos se existirem
            if (currentProduct.pixel_id) {
                localStorage.setItem("currentPixelId", currentProduct.pixel_id);
                
                // Salvar eventos do pixel se existirem
                if (currentProduct.pixel_events && Array.isArray(currentProduct.pixel_events)) {
                    localStorage.setItem("currentPixelEvents", JSON.stringify(currentProduct.pixel_events));
                } else {
                    localStorage.removeItem("currentPixelEvents");
                }
            } else {
                localStorage.removeItem("currentPixelId");
                localStorage.removeItem("currentPixelEvents");
            }
        } else {
            localStorage.removeItem("currentProductId");
            localStorage.removeItem("currentProductName");
            localStorage.removeItem("currentPixelId");
            localStorage.removeItem("currentPixelEvents");
        }
        
        
        // Expor globalmente para integração com checkout.html (Order Bump / Total)
        window.currentProduct = currentProduct;
        if (typeof window.updateTotalPrice === 'function') {
            try { window.updateTotalPrice(); } catch (_) {}
        }
        displayProduct(currentProduct);
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        
        // Verificar se o produto não foi encontrado
        if (error.message === 'PRODUTO_NAO_ENCONTRADO' || error.message.includes('404') || error.message.includes('não encontrado')) {
            showNotification('Produto não encontrado. Verifique se o link está correto.', 'error');
            
            // Exibir mensagem visual na página
            showProductNotFoundMessage(productId);
            
            // Não definir currentProduct, deixar como null
            window.currentProduct = null;
            
            // Esconder loader mesmo sem produto (para não ficar preso)
            if (typeof window.CustomEvent !== 'undefined') {
                const event = new CustomEvent('productLoadFailed', { detail: { productId, error: 'Produto não encontrado' } });
                window.dispatchEvent(event);
            }
            
            return;
        }
        
        // Para outros erros, mostrar mensagem genérica
        showNotification('Erro ao carregar produto: ' + error.message, 'error');
        
        // Não usar produto de fallback - informar erro ao usuário
        window.currentProduct = null;
        
        // Esconder loader mesmo com erro
        if (typeof window.CustomEvent !== 'undefined') {
            const event = new CustomEvent('productLoadFailed', { detail: { productId, error: error.message } });
            window.dispatchEvent(event);
        }
    }
}

// Função auxiliar para formatar preço sem decimais desnecessários
function formatPrice(price) {
    const numPrice = parseFloat(price) || 0;
    // Se o preço é um número inteiro, não mostrar decimais
    if (numPrice % 1 === 0) {
        return numPrice.toString();
    }
    // Caso contrário, mostrar com 2 decimais
    return numPrice.toFixed(2);
}

// Função para exibir o produto na página
function displayProduct(currentProduct) {
    
    // Disparar evento customizado quando produto for exibido
    if (typeof window.CustomEvent !== 'undefined') {
        const event = new CustomEvent('productLoaded', { detail: currentProduct });
        window.dispatchEvent(event);
    }
    
    if (!currentProduct) {
        console.error('Produto não encontrado');
        showNotification('Produto não encontrado', 'error');
        return;
    }

    // Atualizar nome do produto
    const nameEl = document.getElementById('productName');
    if (nameEl) nameEl.textContent = currentProduct.nome || 'Produto';
    
    // Atualizar ID personalizado
    const customIdEl = document.getElementById('productCustomId');
    if (customIdEl) customIdEl.textContent = currentProduct.customId || '';
    
    // Processar configurações de desconto salvas
    // Processar configurações (tratar arrays duplicados)
    let blackFridayConfig = null;
    let discountConfig = null;
    let timerConfig = null;
    
    // Processar Black Friday
    if (currentProduct.blackfriday_config) {
        if (Array.isArray(currentProduct.blackfriday_config)) {
            // Se for array, pegar o primeiro elemento válido
            const configString = currentProduct.blackfriday_config.find(item => item && typeof item === 'string');
            if (configString) {
                try {
                    blackFridayConfig = JSON.parse(configString);
                } catch (e) {
                    console.error('Erro ao parsear blackfriday_config:', e);
                }
            }
        } else if (typeof currentProduct.blackfriday_config === 'object') {
            blackFridayConfig = currentProduct.blackfriday_config;
        }
    }
    
    // Processar desconto normal
    if (currentProduct.discount_config) {
        if (Array.isArray(currentProduct.discount_config)) {
            const configString = currentProduct.discount_config.find(item => item && typeof item === 'string');
            if (configString) {
                try {
                    discountConfig = JSON.parse(configString);
                } catch (e) {
                    console.error('Erro ao parsear discount_config:', e);
                }
            }
        } else if (typeof currentProduct.discount_config === 'object') {
            discountConfig = currentProduct.discount_config;
        }
    }
    
    // Processar timer
    if (currentProduct.timer_config) {
        if (Array.isArray(currentProduct.timer_config)) {
            const configString = currentProduct.timer_config.find(item => item && typeof item === 'string');
            if (configString) {
                try {
                    timerConfig = JSON.parse(configString);
                } catch (e) {
                    console.error('Erro ao parsear timer_config:', e);
                }
            }
        } else if (typeof currentProduct.timer_config === 'object') {
            timerConfig = currentProduct.timer_config;
        }
    }
    
    // Aplicar configurações processadas
    if (blackFridayConfig && blackFridayConfig.enabled) {
        currentProduct.blackfriday_config = blackFridayConfig;
        applyBlackFridayDiscount(currentProduct);
        
        // Mostrar banner do Black Friday
        showBlackFridayBanner(blackFridayConfig);
        
        // Atualizar exibição de preço com desconto
        updatePriceDisplay(currentProduct);
    } else if (discountConfig && discountConfig.enabled) {
        currentProduct.discount_config = discountConfig;
        applyDiscountConfig(currentProduct);
        
        // Atualizar exibição de preço com desconto
        updatePriceDisplay(currentProduct);
    } else {
        // Atualizar preço normal se não há desconto configurado
        updatePriceDisplay(currentProduct);
    }

    const descEl = document.getElementById('productDescription');
    if (descEl) descEl.textContent = currentProduct.descricao || '';

    const totalEl = document.getElementById('total');
    if (totalEl) {
        // Garantir que o preço final seja tratado como número
        const precoFinal = parseFloat(currentProduct.precoComDesconto || currentProduct.preco) || 0;
        const precoRounded = Math.round(precoFinal);
        totalEl.textContent = `MZN ${precoRounded}`;  
    }

    // Montar a url da imagem com fallback SVG em base64
    let imagemUrl = '';
    
    // Priorizar imagem_url direta se disponível
    if (currentProduct.imagem_url) {
        // Usar URL direta da imagem (mais confiável)
        imagemUrl = currentProduct.imagem_url;
    } else if (currentProduct.imagemUrl) {
        // Usar URL direta se disponível
        imagemUrl = currentProduct.imagemUrl;
    } else if (currentProduct.imageUrl) {
        // Compatibilidade com campo alternativo
        imagemUrl = currentProduct.imageUrl;
    } else if (currentProduct.custom_id) {
        // Fallback para rota da API com custom_id
        imagemUrl = `${window.API_BASE}/produtos/imagem/${currentProduct.custom_id}`;
    } else if (currentProduct.id) {
        // Fallback para id numérico
        imagemUrl = `${window.API_BASE}/produtos/imagem/${currentProduct.id}`;
    } else {
        // Fallback para imagem padrão
        imagemUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik00MCAyOEMzNy43OTA5IDI4IDM2IDI5Ljc5MDkgMzYgMzJWNDhDMzYgNTAuMjA5MSAzNy43OTA5IDUyIDQwIDUySDQ4QzUwLjIwOTEgNTIgNTIgNTAuMjA5MSA1MiA0OFY0OEM1MiA0NS43OTA5IDUwLjIwOTEgNDQgNDggNDRINDBDMzcuNzkwOSA0NCAzNiA0NS43OTA5IDM2IDQ4VjMyWiIgZmlsbD0iI0U5RUNFRiIvPgo8L3N2Zz4K';
    }
    
    // Atualizar a imagem existente ou criar uma nova
    const productCard = document.getElementById('productCard');
    
    let productCardElement = productCard;
    
    if (!productCard) {
        console.error('Elemento productCard não encontrado no DOM');
        
        // Criar o elemento se não existir
        const newProductCard = document.createElement('section');
        newProductCard.id = 'productCard';
        newProductCard.className = 'product-card';
        
        // Encontrar onde inserir o elemento
        const checkoutContainer = document.querySelector('.checkout-container');
        if (checkoutContainer) {
            checkoutContainer.insertBefore(newProductCard, checkoutContainer.firstChild);
            productCardElement = newProductCard;
        } else {
            console.error('Não foi possível encontrar o checkout-container');
            return;
        }
    }
    
    // Imagem de fallback para caso de erro
    const fallbackImageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik00MCAyOEMzNy43OTA5IDI4IDM2IDI5Ljc5MDkgMzYgMzJWNDhDMzYgNTAuMjA5MSAzNy43OTA5IDUyIDQwIDUySDQ4QzUwLjIwOTEgNTIgNTIgNTAuMjA5MSA1MiA0OFY0OEM1MiA0NS43OTA5IDUwLjIwOTEgNDQgNDggNDRINDBDMzcuNzkwOSA0NCAzNiA0NS43OTA5IDM2IDQ4VjMyWiIgZmlsbD0iI0U5RUNFRiIvPgo8L3N2Zz4K';
    
    // Limpar o conteúdo anterior
    productCard.innerHTML = '';
    
    // Criar o container flexível para imagem e detalhes
    const flexContainer = document.createElement('div');
    flexContainer.style = 'display: flex; align-items: center; width: 100%; margin-bottom: 15px;';
    
    // Criar container protegido para a imagem
    const imageContainer = document.createElement('div');
    imageContainer.className = 'product-image-container';
    imageContainer.style = 'position: relative; display: inline-block; margin-right: 10px;';
    
    // Criar canvas para renderizar a imagem (proteção adicional)
    // Usar dimensões maiores para melhor qualidade e depois escalar com CSS
    const displayWidth = 120;
    const displayHeight = 120;
    const scaleFactor = 2; // Fator de escala para melhor qualidade (retina displays)
    const canvasWidth = displayWidth * scaleFactor;
    const canvasHeight = displayHeight * scaleFactor;
    
    const canvas = document.createElement('canvas');
    canvas.className = 'product-image-canvas';
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style = `width: ${displayWidth}px; height: ${displayHeight}px; border-radius: 8px; display: block; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; -webkit-user-drag: none; -khtml-user-drag: none; -moz-user-drag: none; -o-user-drag: none; user-drag: none; pointer-events: none; -webkit-touch-callout: none; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges;`;
    canvas.setAttribute('draggable', 'false');
    
    // Criar imagem oculta para carregar e renderizar no canvas
    const hiddenImg = document.createElement('img');
    hiddenImg.style.display = 'none';
    // Tentar definir crossOrigin apenas se a imagem vier de outro domínio
    try {
        const imgUrl = new URL(imagemUrl, window.location.origin);
        if (imgUrl.origin !== window.location.origin) {
            hiddenImg.crossOrigin = 'anonymous';
        }
    } catch (e) {
        // Se a URL for relativa, não precisa de crossOrigin
    }
    
    // Função para renderizar imagem no canvas com proporções corretas e alta qualidade
    const renderImageToCanvas = function(img) {
        try {
            const ctx = canvas.getContext('2d');
            
            // Habilitar suavização de imagem para melhor qualidade
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Limpar canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calcular proporções para manter aspect ratio
            const imgAspectRatio = img.naturalWidth / img.naturalHeight;
            const canvasAspectRatio = canvasWidth / canvasHeight;
            
            let drawWidth, drawHeight, offsetX, offsetY;
            
            if (imgAspectRatio > canvasAspectRatio) {
                // Imagem é mais larga - ajustar altura
                drawHeight = canvasHeight;
                drawWidth = drawHeight * imgAspectRatio;
                offsetX = (canvasWidth - drawWidth) / 2;
                offsetY = 0;
            } else {
                // Imagem é mais alta - ajustar largura
                drawWidth = canvasWidth;
                drawHeight = drawWidth / imgAspectRatio;
                offsetX = 0;
                offsetY = (canvasHeight - drawHeight) / 2;
            }
            
            // Criar clipping path para bordas arredondadas (aplicar escala)
            const radius = 8 * scaleFactor;
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(canvasWidth - radius, 0);
            ctx.quadraticCurveTo(canvasWidth, 0, canvasWidth, radius);
            ctx.lineTo(canvasWidth, canvasHeight - radius);
            ctx.quadraticCurveTo(canvasWidth, canvasHeight, canvasWidth - radius, canvasHeight);
            ctx.lineTo(radius, canvasHeight);
            ctx.quadraticCurveTo(0, canvasHeight, 0, canvasHeight - radius);
            ctx.lineTo(0, radius);
            ctx.quadraticCurveTo(0, 0, radius, 0);
            ctx.closePath();
            ctx.clip();
            
            // Desenhar imagem no canvas com proporções corretas e alta qualidade
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Adicionar marca d'água sutil (opcional - pode ser removido)
            ctx.globalAlpha = 0.05;
            ctx.fillStyle = '#000000';
            ctx.font = `${10 * scaleFactor}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('RatixPay', canvasWidth / 2, canvasHeight / 2);
            ctx.globalAlpha = 1.0;
            
        } catch (error) {
            console.error('❌ Erro ao renderizar imagem no canvas:', error);
            // Em caso de erro, usar fallback
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };
    
    // Carregar imagem e renderizar no canvas
    hiddenImg.onload = function() {
        renderImageToCanvas(this);
    };
    
    hiddenImg.onerror = function() {
        // Renderizar imagem de fallback
        const fallbackImg = new Image();
        fallbackImg.onload = function() {
            renderImageToCanvas(this);
        };
        fallbackImg.src = fallbackImageUrl;
    };
    
    hiddenImg.src = imagemUrl;
    
    // Prevenir todas as ações de download/cópia no canvas
    canvas.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    canvas.addEventListener('dragstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    canvas.addEventListener('selectstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    // Prevenir extração de dados do canvas
    const originalToDataURL = canvas.toDataURL;
    canvas.toDataURL = function() {
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    };
    
    const originalToBlob = canvas.toBlob;
    if (canvas.toBlob) {
        canvas.toBlob = function() {
            return null;
        };
    }
    
    // Criar overlay transparente para bloquear interações (sem indicadores visuais)
    const overlay = document.createElement('div');
    overlay.className = 'product-image-overlay';
    overlay.style = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; z-index: 1; cursor: default; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; border-radius: 8px; pointer-events: auto;';
    
    // Prevenir ações no overlay (bloquear todas as interações)
    overlay.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    overlay.addEventListener('dragstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    overlay.addEventListener('mousedown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    overlay.addEventListener('selectstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    overlay.addEventListener('mouseup', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    overlay.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }, false);
    
    // Adicionar canvas, imagem oculta e overlay ao container
    imageContainer.appendChild(canvas);
    imageContainer.appendChild(hiddenImg);
    imageContainer.appendChild(overlay);
    
    // Adicionar o container ao flexContainer
    flexContainer.appendChild(imageContainer);
    
    // Criar e adicionar os detalhes do produto
    const detailsDiv = document.createElement('div');
    detailsDiv.style = 'flex: 1; display: flex; flex-direction: column; justify-content: center;';
    
    // Nome do produto
    const nameDiv = document.createElement('div');
    nameDiv.id = 'productName';
    nameDiv.textContent = currentProduct.nome || 'Produto';
    nameDiv.style = 'font-weight: bold; font-size: 1rem; margin-bottom: 5px; color: var(--text-dark);';
    detailsDiv.appendChild(nameDiv);
    
    // Preço do produto
    const priceDiv = document.createElement('div');
    priceDiv.id = 'productPrice';
    const precoOriginal = parseFloat(currentProduct.preco) || 0;
    const precoFinal = parseFloat(currentProduct.precoComDesconto || currentProduct.preco) || 0;
    const temDesconto = currentProduct.precoComDesconto && currentProduct.precoComDesconto < precoOriginal;
    
    if (temDesconto) {
        // Calcular percentagem de desconto
        const percentualDesconto = Math.round(((precoOriginal - precoFinal) / precoOriginal) * 100);
        
        // Criar container para preços com desconto
        const priceContainer = document.createElement('div');
        priceContainer.style = 'display: flex; flex-direction: column; gap: 2px;';
        
        // Container para preço original e badge de desconto
        const oldPriceContainer = document.createElement('div');
        oldPriceContainer.style = 'display: flex; align-items: center; gap: 8px;';
        
        // Preço original riscado
        const oldPriceDiv = document.createElement('div');
        oldPriceDiv.textContent = formatPrice(precoOriginal) + ' MZN';
        oldPriceDiv.style = 'text-decoration: line-through; color: #999; font-size: 0.9rem; font-weight: 500;';
        oldPriceContainer.appendChild(oldPriceDiv);
        
        // Badge de desconto
        const discountBadge = document.createElement('span');
        discountBadge.textContent = `-${percentualDesconto}%`;
        discountBadge.style = 'background: #dc3545; color: white; padding: 2px 6px; border-radius: 8px; font-size: 0.7rem; font-weight: bold;';
        oldPriceContainer.appendChild(discountBadge);
        
        priceContainer.appendChild(oldPriceContainer);
        
        // Preço com desconto
        const newPriceDiv = document.createElement('div');
        newPriceDiv.textContent = formatPrice(precoFinal) + ' MZN';
        newPriceDiv.style = 'color: #3b82f6; font-weight: bold; font-size: 1.1rem;';
        priceContainer.appendChild(newPriceDiv);
        
        priceDiv.appendChild(priceContainer);
    } else {
        // Preço normal sem desconto
        priceDiv.textContent = formatPrice(precoFinal) + ' MZN';
        priceDiv.style = 'color: #3b82f6; font-weight: bold; font-size: 1.1rem;';
    }
    
    detailsDiv.appendChild(priceDiv);
    
    // Adicionar detailsDiv ao flexContainer
    flexContainer.appendChild(detailsDiv);
    
    // Adicionar flexContainer ao productCard
    productCard.appendChild(flexContainer);
    
    // ID personalizado (se existir) - oculto conforme solicitado
    if (currentProduct.customId) {
        const customIdDiv = document.createElement('div');
        customIdDiv.id = 'productCustomId';
        customIdDiv.textContent = currentProduct.customId;
        customIdDiv.style = 'display: none;';
        detailsDiv.appendChild(customIdDiv);
    }
    
    // Mover tag de desconto para dentro dos detalhes do produto
    const discountTag = document.getElementById('discountTag');
    if (discountTag && detailsDiv) {
        detailsDiv.appendChild(discountTag);
    }
    
    // Atualizar tag de desconto após criar a product-card
    updateDiscountTag(currentProduct);
}

// Função para aplicar desconto do Black Friday
function applyBlackFridayDiscount(product) {
    const blackFridayConfig = product.blackfriday_config;
    const originalPrice = parseFloat(product.preco) || 0;
    
    if (!blackFridayConfig || !blackFridayConfig.enabled || blackFridayConfig.discount <= 0) {
        updatePriceDisplay(product);
        return;
    }
    
    // Calcular desconto do Black Friday (sempre percentual)
    const discountPercent = blackFridayConfig.discount;
    const finalPrice = originalPrice * (1 - discountPercent / 100);
    
    // Garantir que o preço final não seja negativo
    const safeFinalPrice = Math.max(0, finalPrice);
    
    // Atualizar o produto com o preço calculado
    product.precoComDesconto = safeFinalPrice;
    
    // Adicionar tag automática do Black Friday
    addBlackFridayTag(discountPercent);
    
    // Exibir preço com desconto do Black Friday no productCard
    const productCard = document.getElementById('productCard');
    if (productCard) {
        const savings = originalPrice - safeFinalPrice;
        const savingsPercent = ((savings / originalPrice) * 100).toFixed(0);
        
        // Encontrar ou criar elemento de preço no productCard
        let priceElement = productCard.querySelector('.product-price') || productCard.querySelector('#productPrice');
        if (!priceElement) {
            priceElement = document.createElement('div');
            priceElement.className = 'product-price';
            priceElement.id = 'productPrice';
            productCard.appendChild(priceElement);
        }
        
        priceElement.innerHTML = `
            <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fff5f5, #ffe6e6); border-radius: 15px; border: 3px solid #dc3545; margin: 15px 0;">
                <!-- Cabeçalho Black Friday -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 1.5rem;">🔥</span>
                        <span style="font-size: 1.2rem; font-weight: bold; color: #dc3545;">BLACK FRIDAY</span>
                        <span style="font-size: 1.5rem;">🔥</span>
                    </div>
                    <div style="background: linear-gradient(45deg, #dc3545, #ff6b6b); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.9rem; font-weight: bold; display: inline-block; animation: blackFridayPulse 2s infinite;">
                        -${discountPercent.toFixed(0)}% OFF
                    </div>
                </div>
                
                <!-- Preço Original -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #6c757d; font-size: 0.9rem; font-weight: 500; margin-bottom: 4px;">Preço Original:</div>
                    <div style="text-decoration: line-through; color: #6c757d; font-size: 1.2rem; font-weight: 600;">
                        MZN ${originalPrice.toFixed(2).replace('.', ',')}
                    </div>
                </div>
                
                <!-- Preço com Desconto -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #dc3545; font-size: 0.9rem; font-weight: 600; margin-bottom: 4px;">Preço Black Friday:</div>
                    <div style="color: #dc3545; font-weight: bold; font-size: 1.6rem;">
                        MZN ${safeFinalPrice.toFixed(2).replace('.', ',')}
                    </div>
                </div>
                
                <!-- Economia -->
                <div style="margin-bottom: 15px;">
                    <div style="background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; font-size: 1rem; font-weight: 600; display: inline-block;">
                        💰 Economia: MZN ${savings.toFixed(2).replace('.', ',')} (${savingsPercent}%)
                    </div>
                </div>
                
                <!-- Mensagem de urgência -->
                <div style="color: #dc3545; font-size: 0.9rem; font-weight: 600;">
                    ⚡ Oferta por tempo limitado - Aproveite agora!
                </div>
            </div>
        `;
    }
    
    // Atualizar total com impacto do desconto
    updateTotalWithBlackFridayDiscount(safeFinalPrice, originalPrice, discountPercent);
    
    // Mostrar mensagem do Black Friday
    if (blackFridayConfig.message) {
        showBlackFridayMessage(blackFridayConfig.message);
    }
    
    // Adicionar efeitos visuais especiais
    addBlackFridayVisualEffects();
    
    console.log('Black Friday aplicado:', {
        originalPrice,
        discountPercent,
        finalPrice: safeFinalPrice,
        savings: originalPrice - safeFinalPrice
    });
}

// Função para aplicar configuração de desconto salva
function applyDiscountConfig(product) {
    const discountConfig = product.discount_config;
    const originalPrice = parseFloat(product.preco) || 0;
    
    if (!discountConfig || !discountConfig.enabled || discountConfig.value <= 0) {
        updatePriceDisplay(product);
        return;
    }
    
    let finalPrice = originalPrice;
    let discountPercent = 0;
    
    // Calcular desconto baseado no tipo
    if (discountConfig.type === 'percentage') {
        discountPercent = discountConfig.value;
        finalPrice = originalPrice * (1 - discountConfig.value / 100);
    } else {
        // Valor fixo
        finalPrice = originalPrice - discountConfig.value;
        discountPercent = (discountConfig.value / originalPrice) * 100;
    }
    
    // Garantir que o preço final não seja negativo
    if (finalPrice < 0) {
        finalPrice = 0;
        discountPercent = 100;
    }
    
    // Atualizar o produto com o preço calculado
    product.precoComDesconto = finalPrice;
    
    // Exibir preço com desconto
    const priceElement = document.getElementById('productPrice');
    if (priceElement) {
        priceElement.innerHTML = `
            <div style="text-align: center;">
                <div style="text-decoration: line-through; color: #6c757d; font-size: 0.9rem; margin-bottom: 5px;">
                    ${formatPrice(originalPrice).replace('.', ',')} MZN
                </div>
                <div style="color: #28a745; font-weight: bold; font-size: 1.2rem;">
                    ${formatPrice(finalPrice).replace('.', ',')} MZN
                </div>
                <div style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; margin-top: 5px; display: inline-block;">
                    -${discountPercent.toFixed(0)}% OFF
                </div>
            </div>
        `;
    }
    
    // Atualizar total
    const totalEl = document.getElementById('total');
    if (totalEl) {
        totalEl.textContent = `MZN ${finalPrice.toFixed(2).replace('.', ',')}`;
    }
    
    // Mostrar mensagem de desconto se configurada
    if (discountConfig.message) {
        showDiscountMessage(discountConfig.message);
    }
    
    console.log('Desconto aplicado:', {
        original: originalPrice,
        final: finalPrice,
        percent: discountPercent,
        message: discountConfig.message
    });
}

// Função para atualizar tag de desconto na product-card
function updateDiscountTag(product) {
    const discountTag = document.getElementById('discountTag');
    if (!discountTag) {
        return;
    }
    
    const preco = parseFloat(product.preco) || 0;
    let precoComDesconto = parseFloat(product.precoComDesconto) || 0;
    let temDesconto = false;
    let percentualDesconto = 0;
    
    // Verificar se há desconto configurado
    if (product.discount_config && product.discount_config.enabled) {
        const discount = parseFloat(product.discount_config.discount) || 0;
        if (discount > 0) {
            if (precoComDesconto <= 0) {
                precoComDesconto = preco * (1 - discount / 100);
            }
            temDesconto = true;
            percentualDesconto = discount;
        }
    }
    
    // Verificar se há Black Friday configurado
    if (product.blackfriday_config && product.blackfriday_config.enabled) {
        const blackFridayDiscount = parseFloat(product.blackfriday_config.discount) || 0;
        if (blackFridayDiscount > 0) {
            if (precoComDesconto <= 0) {
                precoComDesconto = preco * (1 - blackFridayDiscount / 100);
            }
            temDesconto = true;
            percentualDesconto = blackFridayDiscount;
        }
    }
    
    // Verificar se há preço com desconto já calculado
    if (!temDesconto && precoComDesconto > 0 && precoComDesconto < preco) {
        temDesconto = true;
        percentualDesconto = Math.round(((preco - precoComDesconto) / preco) * 100);
    }
    
    if (temDesconto) {
        const precoOriginal = preco.toFixed(2).replace('.', ',');
        const precoFinal = precoComDesconto.toFixed(2).replace('.', ',');
        const economia = (preco - precoComDesconto).toFixed(2).replace('.', ',');
        
        // Determinar tipo de desconto
        const isBlackFriday = product.blackfriday_config && product.blackfriday_config.enabled;
        const badgeClass = isBlackFriday ? 'blackfriday' : '';
        
        discountTag.innerHTML = `
            <div class="price-original">De: ${precoOriginal} MZN</div>
            <div class="price-discounted">
                Por: ${precoFinal} MZN
                <span class="discount-badge ${badgeClass}">-${percentualDesconto}%</span>
            </div>
            <div class="savings-info">💰 Economize ${economia} MZN</div>
        `;
        discountTag.style.display = 'flex';
    } else {
        discountTag.style.display = 'none';
    }
}

// Função para atualizar exibição de preço normal
function updatePriceDisplay(product) {
    const priceElement = document.getElementById('productPrice');
    if (priceElement) {
        const preco = parseFloat(product.preco) || 0;
        let precoComDesconto = parseFloat(product.precoComDesconto) || 0;
        let temDesconto = false;
        let percentualDesconto = 0;
        
        // Verificar se há desconto configurado
        if (product.discount_config && product.discount_config.enabled) {
            const discount = parseFloat(product.discount_config.discount) || 0;
            if (discount > 0) {
                // Usar o preço já calculado se existir, senão calcular
                if (precoComDesconto <= 0) {
                    precoComDesconto = preco * (1 - discount / 100);
                }
                temDesconto = true;
                percentualDesconto = discount;
            }
        }
        
        // Verificar se há Black Friday configurado
        if (product.blackfriday_config && product.blackfriday_config.enabled) {
            const blackFridayDiscount = parseFloat(product.blackfriday_config.discount) || 0;
            if (blackFridayDiscount > 0) {
                // Usar o preço já calculado se existir, senão calcular
                if (precoComDesconto <= 0) {
                    precoComDesconto = preco * (1 - blackFridayDiscount / 100);
                }
                temDesconto = true;
                percentualDesconto = blackFridayDiscount;
            }
        }
        
        // Verificar se há preço com desconto já calculado
        if (!temDesconto && precoComDesconto > 0 && precoComDesconto < preco) {
            temDesconto = true;
            percentualDesconto = Math.round(((preco - precoComDesconto) / preco) * 100);
        }
        
        if (temDesconto) {
            // Mostrar preço original riscado e preço com desconto
            const precoOriginal = formatPrice(preco).replace('.', ',');
            const precoFinal = formatPrice(precoComDesconto).replace('.', ',');
            const economia = formatPrice(preco - precoComDesconto).replace('.', ',');
            
            // Determinar tipo de desconto
            const isBlackFriday = product.blackfriday_config && product.blackfriday_config.enabled;
            const badgeClass = isBlackFriday ? 'blackfriday' : '';
            const badgeText = isBlackFriday ? 'BLACK FRIDAY' : 'DESCONTO';
            
            priceElement.innerHTML = `
                <div class="price-container">
                    <div class="price-original">De: ${precoOriginal} MZN</div>
                    <div class="price-discounted">
                        Por: ${precoFinal} MZN
                        <span class="discount-badge ${badgeClass}">-${percentualDesconto}%</span>
                    </div>
                    <div class="savings-info">💰 Economize ${economia} MZN</div>
                </div>
            `;
            
            // Atualizar o preço total para usar o preço com desconto
            product.precoComDesconto = precoComDesconto;
        } else {
            // Mostrar apenas o preço normal
            priceElement.textContent = `${formatPrice(preco).replace('.', ',')} MZN`;
        }
    }
    
    const totalEl = document.getElementById('total');
    if (totalEl) {
        const preco = parseFloat(product.precoComDesconto || product.preco) || 0;
        const precoRounded = Math.round(preco);
        totalEl.textContent = `MZN ${precoRounded}`;
    }
}

// Função para mostrar mensagem de desconto
function showDiscountMessage(message) {
    // Remover mensagem existente se houver
    const existingMessage = document.querySelector('.discount-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar nova mensagem
    const messageDiv = document.createElement('div');
    messageDiv.className = 'discount-message';
    messageDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 12px 15px; border-radius: 8px; margin: 10px 0; text-align: center; font-weight: 600; border: 1px solid #c3e6cb; animation: descontoSlideIn 0.5s ease;">
            <i class="fas fa-percentage" style="margin-right: 8px;"></i>
            ${message}
        </div>
    `;
    
    // Inserir após o card do produto
    const productCard = document.getElementById('productCard');
    if (productCard) {
        productCard.appendChild(messageDiv);
    }
}

// Função para adicionar tag automática do Black Friday
function addBlackFridayTag(discountPercent) {
    // Remover tag anterior se existir
    const existingTag = document.getElementById('blackFridayTag');
    if (existingTag) {
        existingTag.remove();
    }
    
    // Criar tag automática com informações detalhadas
    const tagDiv = document.createElement('div');
    tagDiv.id = 'blackFridayTag';
    tagDiv.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: linear-gradient(135deg, #dc3545, #ff6b6b); color: white; padding: 15px 20px; border-radius: 15px; font-weight: bold; box-shadow: 0 8px 20px rgba(220, 53, 69, 0.5); animation: blackFridayFloat 3s ease-in-out infinite; border: 2px solid #ffc107; min-width: 200px;">
            <!-- Cabeçalho -->
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; justify-content: center;">
                <span style="font-size: 1.3rem;">🔥</span>
                <span style="font-size: 1.1rem;">BLACK FRIDAY</span>
            </div>
            
            <!-- Desconto -->
            <div style="text-align: center; margin-bottom: 8px;">
                <div style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 15px; font-size: 1rem; font-weight: bold;">
                    -${discountPercent}% OFF
                </div>
            </div>
            
            <!-- Informação adicional -->
            <div style="text-align: center; font-size: 0.8rem; opacity: 0.9;">
                ⚡ Oferta Limitada
            </div>
        </div>
    `;
    
    document.body.appendChild(tagDiv);
    
    // Adicionar CSS para animações se não existir
    if (!document.getElementById('blackFridayTagStyles')) {
        const style = document.createElement('style');
        style.id = 'blackFridayTagStyles';
        style.textContent = `
            @keyframes blackFridayFloat {
                0%, 100% { transform: translateY(0px) rotate(0deg); }
                25% { transform: translateY(-5px) rotate(1deg); }
                50% { transform: translateY(-10px) rotate(0deg); }
                75% { transform: translateY(-5px) rotate(-1deg); }
            }
            @keyframes blackFridayPulse {
                0% { transform: scale(1); box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3); }
                50% { transform: scale(1.05); box-shadow: 0 6px 12px rgba(220, 53, 69, 0.5); }
                100% { transform: scale(1); box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Função para atualizar total com desconto do Black Friday
function updateTotalWithBlackFridayDiscount(finalPrice, originalPrice, discountPercent) {
    const totalEl = document.getElementById('total');
    if (totalEl) {
        const savings = originalPrice - finalPrice;
        const savingsPercent = ((savings / originalPrice) * 100).toFixed(0);
        
        totalEl.innerHTML = `
            <div style="text-align: center; padding: 15px; background: linear-gradient(135deg, #fff5f5, #ffe6e6); border-radius: 12px; border: 2px solid #dc3545;">
                <!-- Preço Original -->
                <div style="margin-bottom: 8px;">
                    <div style="color: #6c757d; font-size: 0.9rem; font-weight: 500;">Preço Original:</div>
                    <div style="text-decoration: line-through; color: #6c757d; font-size: 1.1rem; font-weight: 600;">
                        MZN ${Math.round(originalPrice)}
                    </div>
                </div>
                
                <!-- Preço Final -->
                <div style="margin-bottom: 8px;">
                    <div style="color: #dc3545; font-size: 0.9rem; font-weight: 600;">Preço Black Friday:</div>
                    <div style="color: #dc3545; font-weight: bold; font-size: 1.4rem;">
                        MZN ${Math.round(finalPrice)}
                    </div>
                </div>
                
                <!-- Economia -->
                <div style="margin-bottom: 10px;">
                    <div style="background: #28a745; color: white; padding: 6px 12px; border-radius: 15px; font-size: 0.9rem; font-weight: 600; display: inline-block;">
                        💰 Economia: MZN ${Math.round(savings)} (${savingsPercent}%)
                    </div>
                </div>
                
                <!-- Badge de Desconto -->
                <div style="background: linear-gradient(45deg, #dc3545, #ff6b6b); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: inline-block; animation: blackFridayPulse 2s infinite; box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);">
                    🔥 BLACK FRIDAY -${discountPercent}% OFF
                </div>
            </div>
        `;
    }
}

// Função para adicionar efeitos visuais especiais do Black Friday
function addBlackFridayVisualEffects() {
    // Adicionar efeito de partículas (opcional)
    if (!document.getElementById('blackFridayParticles')) {
        const particlesDiv = document.createElement('div');
        particlesDiv.id = 'blackFridayParticles';
        particlesDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            overflow: hidden;
        `;
        
        // Criar partículas de fogo
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: absolute;
                width: 4px;
                height: 4px;
                background: #ff6b6b;
                border-radius: 50%;
                animation: blackFridayParticle ${2 + Math.random() * 3}s linear infinite;
                left: ${Math.random() * 100}%;
                animation-delay: ${Math.random() * 2}s;
            `;
            particlesDiv.appendChild(particle);
        }
        
        document.body.appendChild(particlesDiv);
        
        // Adicionar CSS para partículas
        if (!document.getElementById('blackFridayParticleStyles')) {
            const style = document.createElement('style');
            style.id = 'blackFridayParticleStyles';
            style.textContent = `
                @keyframes blackFridayParticle {
                    0% { transform: translateY(100vh) scale(0); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-10vh) scale(1); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Função para mostrar mensagem do Black Friday
function showBlackFridayMessage(message) {
    // Remover mensagem anterior se existir
    const existingMessage = document.querySelector('.blackfriday-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Criar nova mensagem do Black Friday
    const messageDiv = document.createElement('div');
    messageDiv.className = 'blackfriday-message';
    messageDiv.innerHTML = `
        <div style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 20px; border-radius: 12px; margin: 15px 0; text-align: center; font-weight: bold; box-shadow: 0 6px 16px rgba(220, 53, 69, 0.5); animation: pulse 2s infinite, slideInDown 0.5s ease-out; border: 3px solid #ffc107; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shine 3s infinite;"></div>
            <div style="position: relative; z-index: 1;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 1.5rem;">🔥</span>
                    <span style="font-size: 1.2rem;">BLACK FRIDAY</span>
                    <span style="font-size: 1.5rem;">🔥</span>
                </div>
                <div style="font-size: 1.1rem; margin-bottom: 5px;">
                    ${message}
                </div>
                <div style="font-size: 0.9rem; opacity: 0.9;">
                    ⚡ Oferta por tempo limitado - Aproveite agora!
                </div>
            </div>
        </div>
    `;
    
    // Inserir no topo da página
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(messageDiv, container.firstChild);
    
    // Adicionar CSS para animações se não existir
    if (!document.getElementById('blackFridayStyles')) {
        const style = document.createElement('style');
        style.id = 'blackFridayStyles';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.02); }
                100% { transform: scale(1); }
            }
            @keyframes shine {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            @keyframes slideInDown {
                from { transform: translateY(-100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Função para validar formulário
function validateForm() {
    const requiredFields = [
        'fullName',
        'email',
        'phone'
    ];
    
    for (let fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            field?.focus();
            showNotification(`Por favor, preencha o campo: ${field?.placeholder || fieldId}`, 'error');
            return false;
        }
    }
    
    // Validar método de pagamento
    const metodoPagamento = document.querySelector('input[name="paymentMethod"]:checked');
    if (!metodoPagamento) {
        showNotification('Selecione um método de pagamento', 'error');
        return false;
    }
    
    // Validar formato do telefone
    const telefone = document.getElementById('phone').value.trim();
    const telefoneRegex = /^(\+258)?8[4-7]\d{7}$/;
    if (!telefoneRegex.test(telefone)) {
        showNotification('Número de telefone inválido. Use formato: 84xxxxxxx ou 86xxxxxxx', 'error');
        document.getElementById('phone').focus();
        return false;
    }
    
    return true;
}

// Função para coletar dados do formulário
function collectFormData() {
    orderData.customer = {
        nome: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        telefone: document.getElementById('phone').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim() || null
    };
    
    orderData.product = currentProduct;
    orderData.coupon = currentProduct.cupomAplicado || '';
    
    // Obter método de pagamento
    const metodoPagamento = document.querySelector('input[name="paymentMethod"]:checked');
    orderData.paymentMethod = metodoPagamento ? metodoPagamento.value : null;
}

// Função para mostrar spinner de loading
function showLoadingSpinner(message = 'Processando pagamento...') {
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.innerHTML = `
            <div class="spinner-overlay">
                <div class="spinner-container">
                    <div class="spinner"></div>
                    <div class="spinner-message">${message}</div>
                    <div class="spinner-subtitle">Não feche esta página</div>
                </div>
            </div>
        `;
        const style = document.createElement('style');
        style.textContent = `
            .spinner-overlay {
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100vw; 
                height: 100vh;
                background: rgba(0,0,0,0.8); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                z-index: 3000;
                backdrop-filter: blur(5px);
            }
            .spinner-container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 400px;
                width: 90%;
            }
            .spinner {
                border: 4px solid #f3f3f3; 
                border-top: 4px solid #3b82f6; 
                border-radius: 50%; 
                width: 60px; 
                height: 60px; 
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            @keyframes spin { 
                0% { transform: rotate(0deg); } 
                100% { transform: rotate(360deg); } 
            }
            .spinner-message { 
                color: #333; 
                font-size: 1.2rem; 
                margin-bottom: 10px; 
                font-weight: bold; 
            }
            .spinner-subtitle {
                color: #666;
                font-size: 0.9rem;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(spinner);
    } else {
        spinner.querySelector('.spinner-message').textContent = message;
        spinner.style.display = 'flex';
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'none';
}



// Função para mostrar status da transação
function showTransactionStatus(status, valor, transacaoId, falhaId = '', falhaMotivo = '') {
    let statusMsg = '';
    let color = '#888';
    let icon = 'info-circle';
    let btnText = 'Fechar';
    let allowClose = true;
    
    if (status === 'pending' || status === 'pendente') {
        statusMsg = 'Transação pendente. Aguarde e digite o PIN no seu celular.';
        color = '#f59e42';
        icon = 'clock';
        allowClose = false; // Não permitir fechar modal de processamento
    } else if (status === 'completed' || status === 'concluida' || status === 'aprovado' || status === 'success') {
        statusMsg = 'Pagamento concluído com sucesso!';
        color = '#28a745';
        icon = 'check-circle';
        btnText = 'Continuar';
        allowClose = true;
    } else if (status === 'failed' || status === 'falha' || status === 'rejeitado' || status === 'cancelado') {
        statusMsg = 'O pagamento falhou.';
        color = '#dc3545';
        icon = 'times-circle';
        btnText = 'Tentar Novamente';
        allowClose = true;
    }
    
    // Atualizar a UI com o status atual da transação
    updateTransactionStatusUI(status, transacaoId, falhaId, falhaMotivo);
    
    const modal = document.createElement('div');
    modal.className = 'transaction-modal';
    
    // Construir informações adicionais
    let additionalInfo = '';
    
    // Para pagamentos aprovados, não mostrar ID da transação e valor
    // Apenas mostrar mensagem de que receberá o conteúdo no email/WhatsApp
    if (status === 'completed' || status === 'concluida' || status === 'aprovado' || status === 'success') {
        // Não mostrar ID da transação nem valor - apenas mensagem informativa
        additionalInfo = `
            <div style="margin: 20px 0;">
                <div style="display: inline-block; width: 40px; height: 40px; border: 3px solid #28a745; border-top: 3px solid transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
                <p style="color: #28a745; font-weight: 600; margin-top: 10px;">Aguarde...</p>
                <p style="color: #666; margin-top: 15px; line-height: 1.6;">
                    Você receberá o conteúdo do produto no seu <strong>email</strong> ou <strong>WhatsApp</strong> em instantes.
                </p>
            </div>
        `;
    } else if (status !== 'failed' && status !== 'falha' && status !== 'rejeitado' && status !== 'cancelado') {
        // Para outros status (pendente), mostrar informações se necessário
        additionalInfo = `
            <p><strong>ID da Transação:</strong> ${transacaoId || '-'}</p>
            <p><strong>Valor:</strong> MZN ${valor && typeof valor === 'number' ? valor.toFixed(2).replace('.', ',') : (valor || '-')}</p>
        `;
        
        // Adicionar ID da falha e motivo se disponíveis
        if (falhaId) {
            additionalInfo += `<p><strong>ID da Falha:</strong> ${falhaId}</p>`;
        }
        
        if (falhaMotivo) {
            additionalInfo += `<p><strong>Motivo da Falha:</strong> ${falhaMotivo}</p>`;
        }
    }
    
    // Criar botões baseados no status
    let buttonHtml = '';
    if (status === 'completed' || status === 'concluida' || status === 'aprovado' || status === 'success') {
        // Pagamento aprovado - não mostrar botões, apenas spinner e mensagem
        buttonHtml = ''; // Remover botões para pagamento aprovado
    } else if (status === 'failed' || status === 'falha' || status === 'rejeitado' || status === 'cancelado') {
        // Pagamento falhou - remover button-group, apenas botão "Tentar Novamente" que mantém dados do checkout
        buttonHtml = `
            <button onclick="this.parentElement.parentElement.remove();" class="btn-retry" style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3); display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;">
                <i class="fas fa-redo"></i> Tentar Novamente
            </button>
        `;
    } else if (allowClose) {
        // Status pendente ou outro - mostrar botão de fechar
        buttonHtml = `
            <div class="button-group">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>
        `;
    } else {
        // Processando - mostrar botão desabilitado
        buttonHtml = `
            <div class="button-group">
                <button disabled class="btn-processing" style="opacity: 0.5; cursor: not-allowed;">
                    <i class="fas fa-spinner fa-spin"></i> Processando...
                </button>
            </div>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content" style="text-align: center;">
            <div class="status-icon" style="color: ${color}; font-size: 3rem; margin-bottom: 20px;">
                <i class="fas fa-${icon} ${status === 'pending' ? 'fa-spin' : ''}"></i>
            </div>
            <h3>${status === 'failed' || status === 'falha' || status === 'rejeitado' || status === 'cancelado' ? 'O pagamento falhou.' : 'Status do Pagamento'}</h3>
            <div class="transaction-info" style="text-align: center;">
                ${additionalInfo}
                <p style="color:${color}; font-weight:bold; text-align: center;">${status === 'failed' || status === 'falha' || status === 'rejeitado' || status === 'cancelado' ? 'Desculpa, seu pagamento falhou. Por favor tente novamente' : statusMsg}</p>
            </div>
            ${buttonHtml}
        </div>
    `;
    
    // Adicionar estilos do modal se não existirem
    if (!document.querySelector('#transaction-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'transaction-modal-styles';
        styles.textContent = `
            .transaction-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            .modal-content {
                background: white;
                padding: 30px;
                border-radius: 15px;
                text-align: center;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .transaction-info {
                margin: 20px 0;
                text-align: left;
            }
            .button-group {
                display: flex;
                gap: 10px;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 20px;
            }
            .btn-retry, .btn-close {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .btn-retry {
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                color: white;
                box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            }
            .btn-retry:hover {
                background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4);
            }
            .btn-close {
                background: #6c757d;
                color: white;
            }
            .btn-close:hover {
                background: #5a6268;
                transform: translateY(-2px);
            }
            .close-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                margin-top: 15px;
                transition: background 0.3s;
            }
            .close-btn:hover {
                background: #2563eb;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
}

// Função para mostrar informações da compra
function showPurchaseInfo(transactionId) {
    const modal = document.createElement('div');
    modal.className = 'purchase-info-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3><i class="fas fa-info-circle"></i> Informações da Compra</h3>
            <div class="purchase-details">
                <p><strong>ID da Transação:</strong> ${transactionId}</p>
                <p><strong>Produto:</strong> ${currentProduct?.nome || 'Produto'}</p>
                <p><strong>Valor:</strong> MZN ${(currentProduct?.precoComDesconto || currentProduct?.preco || 0).toFixed(2)}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Aprovado</span></p>
            </div>
            <div class="button-group">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn-close">
                    <i class="fas fa-times"></i> Fechar
                </button>
            </div>
        </div>
    `;
    
    // Adicionar estilos se não existirem
    if (!document.querySelector('#purchase-info-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'purchase-info-modal-styles';
        styles.textContent = `
            .purchase-info-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2001;
            }
            .purchase-details {
                text-align: left;
                margin: 20px 0;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 5px;
            }
            .purchase-details p {
                margin: 8px 0;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
}

// Função para download de conteúdo
function downloadContent(transactionId) {
    // Verificar se o produto tem link de conteúdo
    if (currentProduct?.linkConteudo) {
        // Abrir link em nova aba
        window.open(currentProduct.linkConteudo, '_blank');
    } else {
        // Mostrar mensagem se não houver link
        alert('Link de conteúdo não disponível. Entre em contato com o suporte.');
    }
}

// Função para processar pagamento
async function processPayment(customerData) {
    try {
        // Mostrar spinner de carregamento
        showLoadingSpinner('Processando pagamento...');
        
        // Validar dados do cliente
        if (!customerData.nome || !customerData.email) {
            throw new Error('Dados do cliente incompletos');
        }

        // Obter número de telefone
        const telefoneInput = document.getElementById('phone');
        if (!telefoneInput || !telefoneInput.value.trim()) {
            throw new Error('Número de telefone é obrigatório');
        }

        const numeroCelular = telefoneInput.value.trim();
        
        // Validar formato do número de telefone (básico)
        if (!/^\+?[0-9]{9,13}$/.test(numeroCelular.replace(/\s+/g, ''))) {
            throw new Error('Formato de número de telefone inválido');
        }
        
        // Obter método de pagamento selecionado
        const metodoPagamento = document.querySelector('input[name="paymentMethod"]:checked');
        if (!metodoPagamento) {
            throw new Error('Por favor, selecione um método de pagamento.');
        }
        
        const metodoPagamentoValue = metodoPagamento.value;

        // Obter o valor do produto
        let valorPagamento = 0;
        try {
            // Tentar obter o valor do elemento HTML
            const totalElement = document.getElementById('total');
            if (totalElement && totalElement.textContent) {
                // Extrair apenas os números do formato "MZN 123,45"
                const valorTexto = totalElement.textContent.replace(/[^0-9,]/g, '').replace(',', '.');
                valorPagamento = parseFloat(valorTexto);
            } else {
                // Usar o preço do produto como fallback
                valorPagamento = parseFloat(currentProduct.precoComDesconto || currentProduct.preco) || 0;
            }
            
            // Verificar se o valor é válido
            if (isNaN(valorPagamento) || valorPagamento <= 0) {
                throw new Error('Valor de pagamento inválido');
            }
        } catch (error) {
            console.error('Erro ao obter valor do pagamento:', error);
            hideLoadingSpinner();
            showNotification('Valor de pagamento inválido. Por favor, recarregue a página.', 'error');
            return;
        }
        
        // Incluir produtos do Order Bump se selecionados
        let orderBumpProducts = [];
        if (window.selectedOrderBumpProducts && window.selectedOrderBumpProducts.length > 0) {
            orderBumpProducts = window.selectedOrderBumpProducts.map(produto => ({
                id: produto.id,
                public_id: produto.public_id,
                custom_id: produto.custom_id,
                nome: produto.nome,
                preco: produto.preco,
                preco_com_desconto: produto.preco_com_desconto,
                desconto: produto.desconto,
                imagem_url: produto.imagem_url || produto.imagem,
                link_conteudo: produto.link_conteudo || produto.linkConteudo,
                descricao: produto.descricao || produto.description,
                tipo: produto.tipo || produto.type || 'digital',
                vendedor_id: produto.vendedor_id || currentProduct.vendedor_id
            }));
            
            
            // Recalcular valor total incluindo Order Bump
            let valorTotal = valorPagamento;
            orderBumpProducts.forEach(produto => {
                const precoProduto = produto.preco_com_desconto || produto.preco;
                valorTotal += parseFloat(precoProduto);
            });
            
            valorPagamento = valorTotal;
        }

        // Verificar se é produto especial N0SAITYAX
        const isSpecialProduct = currentProduct.custom_id === 'N0SAITYAX' || currentProduct.id === 'N0SAITYAX';
        if (isSpecialProduct) {
        }

        // Preparar dados do pagamento para E2Payment
        // Capturar parâmetros UTM do localStorage (capturados no checkout.html)
        let utmTrackingParams = {};
        try {
            const savedUtmParams = localStorage.getItem('utm_tracking_params');
            if (savedUtmParams) {
                utmTrackingParams = JSON.parse(savedUtmParams);
            }
        } catch (error) {
            console.warn('⚠️ Erro ao carregar parâmetros UTM do localStorage:', error);
        }
        
        const paymentData = {
            produtoPublicId: currentProduct.public_id || currentProduct.id || currentProduct.customId,
            numeroCelular: numeroCelular,
            metodo: metodoPagamentoValue, // Usar método escolhido pelo cliente
            nomeCliente: customerData.nome,
            emailCliente: customerData.email,
            whatsappCliente: customerData.whatsapp, // Adicionar WhatsApp do cliente
            // Adicionar valor do pagamento
            valor: valorPagamento,
            // Incluir o link de conteúdo se disponível
            linkConteudo: currentProduct.linkConteudo || '',
            // Dados adicionais para E2Payment
            // Flag especial para produto N0SAITYAX
            isSpecialProduct: isSpecialProduct,
            // Email do vendedor para ativação automática
            vendorEmail: vendorEmail,
            productName: currentProduct.nome || 'Produto',
            customerPhone: numeroCelular,
            // Incluir produtos do Order Bump
            orderBumpProducts: orderBumpProducts,
            // Parâmetros UTM para rastreamento
            utm_source: utmTrackingParams.utm_source || null,
            utm_medium: utmTrackingParams.utm_medium || null,
            utm_campaign: utmTrackingParams.utm_campaign || null,
            utm_content: utmTrackingParams.utm_content || null,
            utm_term: utmTrackingParams.utm_term || null,
            src: utmTrackingParams.src || null,
            sck: utmTrackingParams.sck || null
        };

        // Se for produto Premium, validar e incluir email do vendedor
        if (currentProduct.customId === '1PZO2Y0M6') {
            if (!vendorEmail) {
                hideLoadingSpinner();
                showNotification('❌ É obrigatório identificar o vendedor para produtos Premium. Recarregue a página e identifique o vendedor.', 'error');
                return;
            }
            
            paymentData.vendorEmail = vendorEmail;
        }


        // Persistir contexto para a página de sucesso
        try {
            const successContext = {
                principal: {
                    nome: currentProduct.nome,
                    id: currentProduct.public_id || currentProduct.custom_id || currentProduct.id,
                    preco: parseFloat(currentProduct.precoComDesconto || currentProduct.preco) || 0,
                    imagem: currentProduct.imagem || currentProduct.imagem_url || ''
                },
                complementares: orderBumpProducts.map(p => ({
                    nome: p.nome,
                    id: p.public_id || p.custom_id || p.id,
                    preco: parseFloat(p.preco_com_desconto || p.preco) || 0,
                    imagem: p.imagem || p.imagem_url || '',
                    miniatura: p.miniatura || p.thumbnail || '',
                    link_conteudo: p.link_conteudo || p.content_url || p.conteudo_url || '',
                    descricao: p.descricao || p.description || '',
                    tipo: p.tipo || p.type || 'digital',
                    desconto: p.desconto || 0,
                    vendedor_id: p.vendedor_id || currentProduct.vendedor_id
                })),
                total: valorPagamento,
                timestamp: new Date().toISOString()
            };
            
            sessionStorage.setItem('lastPaymentSummary', JSON.stringify(successContext));
            
            // Também salvar em localStorage como backup
            localStorage.setItem('lastPaymentSummary', JSON.stringify(successContext));
        } catch (error) {
            console.error('❌ Erro ao salvar contexto de sucesso:', error);
        }

        // Verificar se está online antes de fazer a requisição
        if (!window.offlineManager) {
            console.error('❌ Offline Manager não está disponível!');
            // Fallback: assumir que está online se offline-manager não estiver disponível
        } else if (!window.offlineManager.isConnected()) {
            
            // Adicionar à fila offline
            window.addOfflineAction({
                type: 'payment',
                data: {
                    produto: currentProduct,
                    metodo: selectedMethod,
                    dados: paymentData,
                    timestamp: new Date().toISOString()
                }
            });
            
            // Mostrar mensagem de modo offline
            showNotification('Pagamento será processado quando a conexão for restaurada', 'info');
            return;
        }
        
        // Fazer requisição para o backend
        
        // Preparar headers com autenticação se disponível
        const headers = {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        };
        
        // Adicionar token de autenticação se disponível
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${window.API_BASE}/pagar`, {
            method: 'POST',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify(paymentData)
        });

        let result;
        try {
            result = await response.json();
        } catch (parseError) {
            console.error('Erro ao analisar resposta JSON:', parseError);
            throw new Error(`Erro no servidor: ${response.status} - Resposta inválida`);
        }

        if (!response.ok) {
            // Extrair mensagem de erro detalhada da resposta
            const errorMessage = result.message || result.error || `Erro no servidor: ${response.status}`;
            console.error('Detalhes do erro:', result);
            throw new Error(errorMessage);
        }

        // Verificar se a API retornou erro diretamente
        // Não considerar success: false como erro se a mensagem indica sucesso ou status pendente
        const isPendingPayment = result.status === 'pendente' || 
                                result.message?.toLowerCase().includes('iniciado com sucesso') ||
                                result.message?.toLowerCase().includes('aguardando pagamento');
        
        if (result.error || (result.success === false && !isPendingPayment) || result.status === 'error' || result.status === 'failed') {
            hideLoadingSpinner();
            const errorMessage = result.error || result.message || result.status || 'Erro na API de pagamento';
            showTransactionStatus('failed', 'Erro da API', null, '', errorMessage);
            throw new Error(errorMessage);
        }
        
        // Verificar se a resposta indica erro em qualquer campo
        const hasErrorInResponse = result.message?.toLowerCase().includes('erro') ||
                                 result.message?.toLowerCase().includes('falha') ||
                                 result.message?.toLowerCase().includes('failed') ||
                                 result.message?.toLowerCase().includes('error') ||
                                 result.message?.toLowerCase().includes('cancelado') ||
                                 result.message?.toLowerCase().includes('rejeitado') ||
                                 result.message?.toLowerCase().includes('declined') ||
                                 result.message?.toLowerCase().includes('rejected') ||
                                 result.status === 'error' ||
                                 result.status === 'failed' ||
                                 result.status === 'cancelado' ||
                                 result.status === 'rejeitado' ||
                                 result.data?.status === 'error' ||
                                 result.data?.status === 'failed' ||
                                 result.data?.status === 'cancelado' ||
                                 result.data?.status === 'rejeitado';
        
        if (hasErrorInResponse) {
            hideLoadingSpinner();
            const errorMessage = result.message || result.status || 'Erro no processamento do pagamento';
            showTransactionStatus('failed', 'Erro no Pagamento', null, '', errorMessage);
            throw new Error(errorMessage);
        }

        // Processar resposta se for sucesso ou pagamento pendente
        if (result.success || isPendingPayment) {
            console.log('Resposta de pagamento:', {
                success: result.success,
                message: result.message,
                status: result.status,
                hasData: !!result.data,
                dataKeys: result.data ? Object.keys(result.data) : [],
                vendaKeys: result.data?.venda ? Object.keys(result.data.venda) : [],
                pagamentoKeys: result.data?.pagamento ? Object.keys(result.data.pagamento) : []
            });
            
            // Verificar se temos dados de transação válidos
            if (result.data) {
                // Extrair dados da venda e pagamento
                const vendaData = result.data.venda || {};
                const pagamentoData = result.data.pagamento || {};
                
                // Determinar o status do pagamento
                const pagamentoStatus = pagamentoData.status || vendaData.pagamentoStatus || 'Pendente';
                const transactionId = pagamentoData.transactionId || vendaData.transacaoId || vendaData.id || `TXN-${Date.now()}`;
                
                console.log('Dados da transação:', {
                    pagamentoStatus: pagamentoStatus,
                    transactionId: transactionId,
                    vendaData: vendaData,
                    pagamentoData: pagamentoData
                });
                
                console.log('Status detalhado:', {
                    resultMessage: result.message,
                    resultStatus: result.status,
                    pagamentoStatus: pagamentoStatus,
                    vendaStatus: vendaData.status,
                    pagamentoTransactionId: pagamentoData.transactionId,
                    vendaTransacaoId: vendaData.transacaoId
                });
                
                // Salvar dados da transação
                orderData.transaction = {
                    id: transactionId,
                    status: pagamentoStatus,
                    valor: pagamentoData.valor || result.data.produto?.valor || valorPagamento,
                    metodo: pagamentoData.metodo || 'M-Pesa',
                    data: new Date().toISOString()
                };
                
                // Verificar se a resposta indica sucesso imediato (múltiplos formatos)
                const isSuccessResponse = result.message === 'Pagamento realizado com sucesso' || 
                                        result.message === 'success' ||
                                        result.message === 'Success' ||
                                        result.message?.toLowerCase().includes('aprovado') ||
                                        result.message?.toLowerCase().includes('success') ||
                                        result.message?.toLowerCase().includes('completed') ||
                                        result.message?.toLowerCase().includes('approved') ||
                                        result.status === 'success' ||
                                        result.status === 'Success' ||
                                        result.status === 'Aprovado' ||
                                        result.status === 'aprovado' ||
                                        result.status === 'approved' ||
                                        pagamentoStatus === 'Aprovado' || 
                                        pagamentoStatus === 'aprovado' ||
                                        pagamentoStatus === 'approved' ||
                                        pagamentoStatus.toLowerCase() === 'success' ||
                                        pagamentoStatus.toLowerCase() === 'approved' ||
                                        pagamentoStatus.toLowerCase() === 'completed' ||
                                        // Verificar também campos específicos da API E2Payment
                                        result.data?.status === 'success' ||
                                        result.data?.status === 'Aprovado' ||
                                        result.data?.status === 'approved' ||
                                        result.data?.pagamento?.status === 'success' ||
                                        result.data?.pagamento?.status === 'Aprovado' ||
                                        result.data?.pagamento?.status === 'approved' ||
                                        result.data?.venda?.pagamentoStatus === 'Aprovado' ||
                                        result.data?.venda?.pagamentoStatus === 'approved' ||
                                        // Verificar mensagem específica da API E2Payment
                                        result.data?.success === 'Pagamento realizado com sucesso' ||
                                        result.data?.message === 'Pagamento realizado com sucesso' ||
                                        (result.data?.success && typeof result.data.success === 'string' && result.data.success.toLowerCase().includes('sucesso')) ||
                                        (result.data?.message && typeof result.data.message === 'string' && result.data.message.toLowerCase().includes('sucesso'));
                
                // Verificar se a resposta indica erro imediato
                const isErrorResponse = result.message?.toLowerCase().includes('erro') ||
                                      result.message?.toLowerCase().includes('falha') ||
                                      result.message?.toLowerCase().includes('cancelado') ||
                                      result.message?.toLowerCase().includes('rejeitado') ||
                                      result.message?.toLowerCase().includes('failed') ||
                                      result.message?.toLowerCase().includes('error') ||
                                      result.message?.toLowerCase().includes('declined') ||
                                      result.message?.toLowerCase().includes('rejected') ||
                                      result.status === 'Erro' ||
                                      result.status === 'erro' ||
                                      result.status === 'Cancelado' ||
                                      result.status === 'cancelado' ||
                                      result.status === 'Rejeitado' ||
                                      result.status === 'rejeitado' ||
                                      result.status === 'failed' ||
                                      result.status === 'error' ||
                                      result.status === 'declined' ||
                                      result.status === 'rejected' ||
                                      pagamentoStatus === 'Erro no Pagamento' ||
                                      pagamentoStatus === 'erro no pagamento' ||
                                      pagamentoStatus === 'Cancelado' ||
                                      pagamentoStatus === 'cancelado' ||
                                      pagamentoStatus === 'Rejeitado' ||
                                      pagamentoStatus === 'rejeitado' ||
                                      pagamentoStatus === 'failed' ||
                                      pagamentoStatus === 'error' ||
                                      pagamentoStatus === 'declined' ||
                                      pagamentoStatus === 'rejected' ||
                                      pagamentoStatus.toLowerCase() === 'failed' ||
                                      pagamentoStatus.toLowerCase() === 'error' ||
                                      pagamentoStatus.toLowerCase() === 'rejected' ||
                                      pagamentoStatus.toLowerCase() === 'cancelled' ||
                                      pagamentoStatus.toLowerCase() === 'declined' ||
                                      // Verificar também campos específicos da API E2Payment
                                      result.data?.status === 'failed' ||
                                      result.data?.status === 'error' ||
                                      result.data?.status === 'cancelado' ||
                                      result.data?.status === 'rejeitado' ||
                                      result.data?.pagamento?.status === 'failed' ||
                                      result.data?.pagamento?.status === 'error' ||
                                      result.data?.pagamento?.status === 'cancelado' ||
                                      result.data?.pagamento?.status === 'rejeitado' ||
                                      result.data?.venda?.pagamentoStatus === 'Cancelado' ||
                                      result.data?.venda?.pagamentoStatus === 'Rejeitado' ||
                                      result.data?.venda?.pagamentoStatus === 'failed' ||
                                      result.data?.venda?.pagamentoStatus === 'error';
                
                console.log('Análise de resposta:', {
                    message: result.message,
                    status: result.status,
                    pagamentoStatus: pagamentoStatus,
                    isSuccessResponse: isSuccessResponse,
                    isErrorResponse: isErrorResponse
                });
                
                console.log('Verificações de sucesso:', {
                    messageMatch: result.message === 'Pagamento realizado com sucesso',
                    statusMatch: result.status === 'success' || result.status === 'Success' || result.status === 'Aprovado',
                    pagamentoStatusMatch: pagamentoStatus === 'Aprovado' || pagamentoStatus === 'aprovado' || pagamentoStatus === 'approved',
                    dataStatusMatch: result.data?.status === 'success' || result.data?.status === 'Aprovado',
                    dataPagamentoStatusMatch: result.data?.pagamento?.status === 'success' || result.data?.pagamento?.status === 'Aprovado',
                    dataVendaStatusMatch: result.data?.venda?.pagamentoStatus === 'Aprovado',
                    dataSuccessMatch: result.data?.success === 'Pagamento realizado com sucesso',
                    dataMessageMatch: result.data?.message === 'Pagamento realizado com sucesso',
                    nestedResultMatch: result.data?.result?.status === 'success',
                    nestedPaymentMatch: result.data?.payment?.status === 'success',
                    nestedTransactionMatch: result.data?.transaction?.status === 'success'
                });
                
                // Mostrar status da transação baseado no resultado
                if (isSuccessResponse) {
                    // Pagamento aprovado - mostrar modal de sucesso e redirecionar
                    hideLoadingSpinner();
                    showTransactionStatus('success', 'Aprovado', transactionId);
                    
                    // Redirecionar para página de sucesso após 3 segundos
                    setTimeout(() => {
                        // Usar o número do pedido se disponível, senão usar transactionId como fallback
                        const pedidoNumero = result.data?.pedido?.numero_pedido || transactionId;
                        const productId = currentProduct?.id || currentProduct?.customId || '';
                        const clientName = orderData.customer?.nome || 'Cliente';
                        const amount = valorPagamento || currentProduct?.preco || 0;
                        window.location.href = gerarLinkSeguroSucesso(pedidoNumero, productId, clientName, amount);
                    }, 3000);
                } else if (isErrorResponse) {
                    // Pagamento rejeitado/erro - mostrar modal de erro
                    hideLoadingSpinner();
                    const falhaId = vendaData.falhaId || '';
                    const falhaMotivo = vendaData.falhaMotivo || result.message || 'Erro no processamento';
                    
                    showTransactionStatus('failed', pagamentoStatus, transactionId, falhaId, falhaMotivo);
                } else if (pagamentoStatus === 'Pendente' || pagamentoStatus.toLowerCase() === 'pending') {
                    // Pagamento pendente - manter modal de processamento e verificar status
                    
                    // Manter o modal de processamento visível
                    showProcessingModal(transactionId);
                    
                    // Iniciar verificação periódica do status
                    startStatusCheck(transactionId);
                } else {
                    // Status desconhecido - tratar como pendente por segurança
                    hideLoadingSpinner();
                    showTransactionStatus('pending', 'Processado', transactionId);
                    
                    // Redirecionar para página de sucesso genérica após 3 segundos
                    setTimeout(() => {
                        const productId = currentProduct?.id || currentProduct?.customId || '';
                        const clientName = orderData.customer?.nome || 'Cliente';
                        const amount = currentProduct?.preco || 0;
                        window.location.href = gerarLinkSeguroSucesso(transactionId, productId, clientName, amount);
                    }, 3000);
                }
            } else {
                
                // Verificar se a resposta indica sucesso mesmo sem dados detalhados
                const isSuccessResponse = result.message === 'Pagamento realizado com sucesso' || 
                                        result.message === 'success' ||
                                        result.message === 'Success' ||
                                        result.message?.toLowerCase().includes('aprovado') ||
                                        result.message?.toLowerCase().includes('success') ||
                                        result.message?.toLowerCase().includes('completed') ||
                                        result.message?.toLowerCase().includes('approved') ||
                                        result.status === 'success' ||
                                        result.status === 'Success' ||
                                        result.status === 'Aprovado' ||
                                        result.status === 'aprovado' ||
                                        result.status === 'approved' ||
                                        // Verificar outros campos possíveis
                                        result.paymentStatus === 'success' ||
                                        result.paymentStatus === 'Aprovado' ||
                                        result.paymentStatus === 'approved' ||
                                        result.transactionStatus === 'success' ||
                                        result.transactionStatus === 'Aprovado' ||
                                        result.transactionStatus === 'approved' ||
                                        // Verificar mensagem específica da API E2Payment
                                        result.success === 'Pagamento realizado com sucesso' ||
                                        (result.success && typeof result.success === 'string' && result.success.toLowerCase().includes('sucesso'));
                
                // Verificar se a resposta indica erro
                const isErrorResponse = result.message?.toLowerCase().includes('erro') ||
                                      result.message?.toLowerCase().includes('falha') ||
                                      result.message?.toLowerCase().includes('cancelado') ||
                                      result.message?.toLowerCase().includes('rejeitado') ||
                                      result.message?.toLowerCase().includes('failed') ||
                                      result.message?.toLowerCase().includes('error') ||
                                      result.status === 'Erro' ||
                                      result.status === 'Cancelado' ||
                                      result.status === 'Rejeitado';
                
                console.log('Análise de resposta (fallback 3):', {
                    isSuccessResponse: isSuccessResponse,
                    isErrorResponse: isErrorResponse,
                    message: result.message,
                    status: result.status
                });
                
                if (isSuccessResponse) {
                    hideLoadingSpinner();
                    showTransactionStatus('success', 'Aprovado', null);
                    
                    // Redirecionar para página de sucesso após 3 segundos
                    setTimeout(() => {
                        const productId = currentProduct?.id || currentProduct?.customId || '';
                        const clientName = orderData.customer?.nome || 'Cliente';
                        const amount = currentProduct?.preco || 0;
                        window.location.href = gerarLinkSeguroSucesso(transactionId, productId, clientName, amount);
                    }, 3000);
                } else if (isErrorResponse) {
                    hideLoadingSpinner();
                    const errorMessage = result.message || result.error || 'Erro no processamento';
                    showTransactionStatus('failed', 'Erro', null, '', errorMessage);
                } else if (isPendingPayment) {
                    hideLoadingSpinner();
                    showTransactionStatus('pending', 'Pendente', null);
                    
                    // Redirecionar para página de sucesso genérica após 3 segundos
                    setTimeout(() => {
                        const productId = currentProduct?.id || currentProduct?.customId || '';
                        const clientName = orderData.customer?.nome || 'Cliente';
                        const amount = currentProduct?.preco || 0;
                        window.location.href = gerarLinkSeguroSucesso(transactionId, productId, clientName, amount);
                    }, 3000);
                } else {
                    // Tratar caso onde result.data não existe e status é desconhecido
                    hideLoadingSpinner();
                    showTransactionStatus('pending', 'Processado', null);
                
                // Redirecionar para página de sucesso genérica após 3 segundos
                setTimeout(() => {
                    window.location.href = '/payment-success.html';
                }, 3000);
                }
            }
        } else {
            // Falha no pagamento (apenas casos que não são sucesso nem pendente)
            hideLoadingSpinner();
            const errorMessage = result.error || result.message || 'Erro no processamento do pagamento';
            const falhaId = result.data?.venda?.falhaId || '';
            
            showTransactionStatus('failed', 'Falha', null, falhaId, errorMessage);
        }
    } catch (error) {
        hideLoadingSpinner();
        console.error('❌ Erro no pagamento:', error);
        
        // Mensagem de erro mais amigável para o usuário
        let mensagemUsuario = 'Ocorreu um erro ao processar o pagamento';
        
        if (error.message.includes('telefone')) {
            mensagemUsuario = 'Verifique o número de telefone e tente novamente';
        } else if (error.message.includes('método')) {
            mensagemUsuario = 'Selecione um método de pagamento válido';
        } else if (error.message.includes('servidor')) {
            mensagemUsuario = 'Erro de conexão com o servidor. Tente novamente mais tarde';
        } else if (error.message) {
            mensagemUsuario = error.message;
        }
        
        showNotification(mensagemUsuario, 'error');
        
        // Mostrar status de falha se ainda não foi mostrado
        if (!document.querySelector('.transaction-modal')) {
            showTransactionStatus('failed', null, null, '', mensagemUsuario);
        }
    }
}

// Função para mostrar modal de processamento
function showProcessingModal(transactionId) {
    // Remover modal existente se houver
    const existingModal = document.querySelector('.processing-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'processing-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="status-icon" style="color: #f59e42; font-size: 3rem; margin-bottom: 20px;">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <h3>Processando pagamento...</h3>
            <div class="transaction-info">
                <p><strong>ID da Transação:</strong> ${transactionId || '-'}</p>
                <p><strong>Status:</strong> <span style="color:#f59e42;font-weight:bold;">Aguardando confirmação</span></p>
                <p style="color:#666;font-size:14px;margin-top:15px;">
                    <strong>⚠️ Não feche esta página!</strong><br>
                    Aguarde a confirmação do pagamento. Você será notificado automaticamente.
                </p>
            </div>
        </div>
    `;
    
    // Adicionar estilos do modal se não existirem
    if (!document.querySelector('#processing-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'processing-modal-styles';
        styles.textContent = `
            .processing-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            .processing-modal             .modal-content {
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 500px;
                width: 90%;
                text-align: center;
            }
            .button-group {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 20px;
            }
            .button-group button {
                padding: 12px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .btn-info {
                background: #007bff;
                color: white;
            }
            .btn-info:hover {
                background: #0056b3;
            }
            .btn-download {
                background: #28a745;
                color: white;
            }
            .btn-download:hover {
                background: #1e7e34;
            }
            .btn-retry {
                background: #ffc107;
                color: #212529;
            }
            .btn-retry:hover {
                background: #e0a800;
            }
            .btn-close {
                background: #6c757d;
                color: white;
            }
            .btn-close:hover {
                background: #545b62;
            }
            .btn-processing {
                background: #6c757d;
                color: white;
            }
                border-radius: 15px;
                text-align: center;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            }
            .processing-modal .transaction-info {
                margin: 20px 0;
                text-align: left;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
}

// Função para verificar periodicamente o status do pagamento
async function startStatusCheck(transactionId) {
    if (!transactionId) return;
    
    let checkCount = 0;
    const maxChecks = 12; // 12 verificações x 5 segundos = 60 segundos total
    const checkInterval = 5000; // Intervalo em ms (5 segundos)
    const timeoutMs = 60000; // 60 segundos de timeout total
    
    
    const statusCheckInterval = setInterval(async () => {
        try {
            checkCount++;
            
            const response = await fetch(`${window.API_BASE}/status/${transactionId}`, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                
                // Se for erro 404, 500, etc., considerar como erro de pagamento
                if (response.status >= 400) {
                    clearInterval(statusCheckInterval);
                    
                    // Remover modal de processamento
                    const processingModal = document.querySelector('.processing-modal');
                    if (processingModal) {
                        processingModal.remove();
                    }
                    
                    const errorMessage = `Erro do servidor (${response.status}). Pagamento não pode ser processado.`;
                    showTransactionStatus('failed', 'Erro do Servidor', transactionId, '', errorMessage);
                    
                    // Atualizar status da venda como cancelada no backend
                    try {
                        await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                status: 'Cancelado',
                                motivo: `Erro do servidor (${response.status})`
                            })
                        });
                    } catch (error) {
                        console.error('Erro ao atualizar status da venda:', error);
                    }
                    
                    return;
                }
                
                throw new Error(`Erro ao verificar status: ${response.status}`);
            }
            
            const result = await response.json();
            
            
            // Verificar se a API retornou erro diretamente
            if (result.error || result.success === false) {
                clearInterval(statusCheckInterval);
                
                // Remover modal de processamento
                const processingModal = document.querySelector('.processing-modal');
                if (processingModal) {
                    processingModal.remove();
                }
                
                const errorMessage = result.error || result.message || 'Erro na API de pagamento';
                showTransactionStatus('failed', 'Erro da API', transactionId, '', errorMessage);
                
                // Atualizar status da venda como cancelada no backend
                try {
                    await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            status: 'Cancelado',
                            motivo: errorMessage
                        })
                    });
                } catch (updateError) {
                    console.error('Erro ao atualizar status da venda:', updateError);
                }
                
                return;
            }
            
            // Verificar diferentes formatos de resposta da API
            if (result.success && result.data) {
                // Extrair dados da venda e pagamento
                const venda = result.data || {};
                const pagamento = venda.pagamento || {};
                
                // Tentar diferentes campos para obter o status (incluindo campos do banco de dados)
                const status = pagamento.status || 
                              venda.status || 
                              venda.pagamentoStatus || 
                              venda.pagamento_status || // Campo do banco
                              'Pendente';
                              
                const falhaMotivo = venda.falhaMotivo || 
                                   pagamento.falhaMotivo || 
                                   venda.falha_motivo || // Campo do banco
                                   '';
                                   
                const falhaId = venda.falhaId || 
                               pagamento.falhaId || 
                               venda.falha_id || // Campo do banco
                               '';
                
                console.log('Status detalhado da venda:', {
                    pagamentoStatus: pagamento.status,
                    vendaStatus: venda.status,
                    vendaPagamentoStatus: venda.pagamentoStatus,
                    vendaPagamentoStatusDB: venda.pagamento_status
                });
                
                // Verificar se a resposta indica sucesso (múltiplos formatos)
                const isSuccessResponse = status === 'Aprovado' || 
                                        status === 'aprovado' ||
                                        status.toLowerCase() === 'success' ||
                                        status.toLowerCase() === 'approved' ||
                                        status.toLowerCase() === 'completed' ||
                                        result.message === 'success' ||
                                        result.message === 'Pagamento realizado com sucesso' ||
                                        result.status === 'success' ||
                                        result.status === 'Aprovado';
                
                // Verificar se a resposta indica erro/falha (múltiplos formatos)
                const isErrorResponse = status === 'Erro no Pagamento' || 
                                      status === 'erro no pagamento' ||
                                      status === 'Cancelado' || 
                                      status === 'cancelado' ||
                                      status === 'Rejeitado' || 
                                      status === 'rejeitado' ||
                                      status.toLowerCase() === 'failed' ||
                                      status.toLowerCase() === 'error' ||
                                      status.toLowerCase() === 'rejected' ||
                                      status.toLowerCase() === 'cancelled' ||
                                      status.toLowerCase() === 'declined' ||
                                      status.toLowerCase() === 'timeout';
                
                console.log('Análise de status:', {
                    status: status,
                    isSuccessResponse: isSuccessResponse,
                    isErrorResponse: isErrorResponse,
                    resultMessage: result.message,
                    resultStatus: result.status
                });
                
                // Se o status for final (aprovado, erro, cancelado), parar a verificação
                if (isSuccessResponse || isErrorResponse) {
                    clearInterval(statusCheckInterval);
                    
                    // Remover modal de processamento
                    const processingModal = document.querySelector('.processing-modal');
                    if (processingModal) {
                        processingModal.remove();
                    }
                    
                    // Mostrar resultado final
                    if (isSuccessResponse) {
                        showTransactionStatus('success', 'Aprovado', transactionId);
                        
                        // Atualizar status da venda como aprovada no backend
                        try {
                            await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Requested-With': 'XMLHttpRequest'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    status: 'Aprovado',
                                    motivo: 'Pagamento confirmado com sucesso'
                                })
                            });
                        } catch (error) {
                            console.error('Erro ao atualizar status da venda:', error);
                        }
                        
                        setTimeout(() => {
                            const productId = currentProduct?.produto?.id || currentProduct?.produto?.custom_id || currentProduct?.id || currentProduct?.customId || '';
                            const clientName = orderData.customer?.nome || 'Cliente';
                            const amount = currentProduct?.produto?.preco || currentProduct?.preco || 0;
                            
                            const successUrl = `/payment-success.html?pedido=${transactionId}&productId=${productId}&clientName=${encodeURIComponent(clientName)}&amount=${amount}`;
                            window.location.href = successUrl;
                        }, 2000);
                    } else if (isErrorResponse) {
                        showTransactionStatus('failed', status, transactionId, falhaId, falhaMotivo);
                        
                        // Atualizar status da venda como cancelada no backend
                        try {
                            await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Requested-With': 'XMLHttpRequest'
                                },
                                credentials: 'include',
                                body: JSON.stringify({
                                    status: 'Cancelado',
                                    motivo: falhaMotivo || 'Pagamento rejeitado pelo servidor'
                                })
                            });
                        } catch (error) {
                            console.error('Erro ao atualizar status da venda:', error);
                        }
                    }
                } else {
                    // Atualizar modal de processamento com contador
                    const processingModal = document.querySelector('.processing-modal');
                    if (processingModal) {
                        const statusText = processingModal.querySelector('.transaction-info p:last-child');
                        if (statusText) {
                            const tempoRestante = Math.max(0, 60 - (checkCount * 5));
                            statusText.innerHTML = `
                                <strong>⚠️ Não feche esta página!</strong><br>
                                Aguarde a confirmação do pagamento. Tempo restante: ${tempoRestante}s.
                            `;
                        }
                    }
                }
            } else if (result.success && !result.data) {
                // Caso onde a API responde com sucesso mas sem dados detalhados
                
                // Verificar se a resposta indica sucesso
                const isSuccessResponse = result.message === 'success' ||
                                        result.status === 'success' ||
                                        result.status === 'Aprovado' ||
                                        result.message === 'Pagamento realizado com sucesso' ||
                                        result.message?.toLowerCase().includes('aprovado') ||
                                        result.message?.toLowerCase().includes('success') ||
                                        result.message?.toLowerCase().includes('completed');
                
                // Verificar se a resposta indica erro
                const isErrorResponse = result.message?.toLowerCase().includes('erro') ||
                                      result.message?.toLowerCase().includes('falha') ||
                                      result.message?.toLowerCase().includes('cancelado') ||
                                      result.message?.toLowerCase().includes('rejeitado') ||
                                      result.message?.toLowerCase().includes('failed') ||
                                      result.message?.toLowerCase().includes('error') ||
                                      result.status === 'Erro' ||
                                      result.status === 'Cancelado' ||
                                      result.status === 'Rejeitado';
                
                console.log('Análise de resposta (fallback 4):', {
                    isSuccessResponse: isSuccessResponse,
                    isErrorResponse: isErrorResponse,
                    message: result.message,
                    status: result.status
                });
                
                if (isSuccessResponse) {
                    clearInterval(statusCheckInterval);
                    
                    // Remover modal de processamento
                    const processingModal = document.querySelector('.processing-modal');
                    if (processingModal) {
                        processingModal.remove();
                    }
                    
                    showTransactionStatus('success', 'Aprovado', transactionId);
                    
                    // Atualizar status da venda como aprovada no backend
                    try {
                        await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            credentials: 'include',
                            body: JSON.stringify({
                                status: 'Aprovado',
                                motivo: 'Pagamento confirmado com sucesso'
                            })
                        });
                    } catch (error) {
                        console.error('Erro ao atualizar status da venda:', error);
                    }
                    
                    setTimeout(() => {
                        const productId = currentProduct?.id || currentProduct?.customId || '';
                        const clientName = orderData.customer?.nome || 'Cliente';
                        const amount = currentProduct?.preco || 0;
                        window.location.href = gerarLinkSeguroSucesso(transactionId, productId, clientName, amount);
                    }, 2000);
                }
            } else if (result.status) {
                // Caso onde a API responde diretamente com status (formato simplificado)
                const status = result.status;
                const isSuccessResponse = status === 'Aprovado' || 
                                        status === 'aprovado' ||
                                        status.toLowerCase() === 'success' ||
                                        status.toLowerCase() === 'approved' ||
                                        status.toLowerCase() === 'completed';
                
                const isErrorResponse = status === 'Rejeitado' || 
                                      status === 'rejeitado' ||
                                      status === 'Cancelado' || 
                                      status === 'cancelado' ||
                                      status === 'Erro no Pagamento' ||
                                      status === 'erro no pagamento' ||
                                      status.toLowerCase() === 'failed' ||
                                      status.toLowerCase() === 'error' ||
                                      status.toLowerCase() === 'rejected' ||
                                      status.toLowerCase() === 'cancelled' ||
                                      status.toLowerCase() === 'declined' ||
                                      status.toLowerCase() === 'timeout';
                
                console.log('Análise de status (fallback):', {
                    status: status,
                    isSuccessResponse: isSuccessResponse,
                    isErrorResponse: isErrorResponse
                });
                
                if (isSuccessResponse || isErrorResponse) {
                    clearInterval(statusCheckInterval);
                    
                    // Remover modal de processamento
                    const processingModal = document.querySelector('.processing-modal');
                    if (processingModal) {
                        processingModal.remove();
                    }
                    
                    if (isSuccessResponse) {
                        showTransactionStatus('success', 'Aprovado', transactionId);
                        setTimeout(() => {
                            const productId = currentProduct?.produto?.id || currentProduct?.produto?.custom_id || currentProduct?.id || currentProduct?.customId || '';
                            const clientName = orderData.customer?.nome || 'Cliente';
                            const amount = currentProduct?.produto?.preco || currentProduct?.preco || 0;
                            
                            const successUrl = `/payment-success.html?pedido=${transactionId}&productId=${productId}&clientName=${encodeURIComponent(clientName)}&amount=${amount}`;
                            window.location.href = successUrl;
                        }, 2000);
                    } else {
                        showTransactionStatus('failed', status, transactionId, '', result.message || 'Pagamento rejeitado');
                    }
                }
            }
            
            // Parar após o número máximo de verificações, mas NÃO cancelar
            // Apenas parar a verificação e aguardar o status real da PayMoz via webhook
            if (checkCount >= maxChecks) {
                clearInterval(statusCheckInterval);
                
                // Remover modal de processamento, mas manter status pendente
                const processingModal = document.querySelector('.processing-modal');
                if (processingModal) {
                    processingModal.remove();
                }
                
                // Mostrar mensagem informando que está aguardando status real
                showTransactionStatus('pending', 'Pendente', transactionId, '', 'Aguardando confirmação do status real da transação da PayMoz. Você será notificado quando o status for atualizado.');
                
            }
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            
            // Se for erro de rede ou timeout, continuar tentando
            if (error.name === 'TypeError' || error.message.includes('fetch')) {
                const processingModal = document.querySelector('.processing-modal');
                if (processingModal) {
                    const statusText = processingModal.querySelector('.transaction-info p:last-child');
                    if (statusText) {
                        const tempoRestante = Math.max(0, 60 - (checkCount * 5));
                        statusText.innerHTML = `
                        <strong>⚠️ Não feche esta página!</strong><br>
                            Erro de conexão (${checkCount}/${maxChecks}). Tentando novamente... Tempo restante: ${tempoRestante}s.
                        `;
                    }
                }
            } else {
                // Para outros tipos de erro, considerar como erro de pagamento
                clearInterval(statusCheckInterval);
                
                // Remover modal de processamento
                const processingModal = document.querySelector('.processing-modal');
                if (processingModal) {
                    processingModal.remove();
                }
                
                const errorMessage = `Erro na verificação: ${error.message}`;
                showTransactionStatus('failed', 'Erro de Verificação', transactionId, '', errorMessage);
                
                // Atualizar status da venda como cancelada no backend
                try {
                    await fetch(`${window.API_BASE}/atualizar-status-venda/${transactionId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            status: 'Cancelado',
                            motivo: `Erro na verificação: ${error.message}`
                        })
                    });
                } catch (updateError) {
                    console.error('Erro ao atualizar status da venda:', updateError);
                }
            }
        }
    }, checkInterval);
}

// Função para atualizar a UI com o status atual da transação
function updateTransactionStatusUI(status, transactionId, falhaId = '', falhaMotivo = '') {
    const modalContent = document.querySelector('.transaction-modal .modal-content');
    if (!modalContent) return;
    
    const statusTitle = modalContent.querySelector('h3');
    const statusIcon = modalContent.querySelector('.status-icon');
    const transactionInfo = modalContent.querySelector('.transaction-info');
    
    if (status === 'Aprovado' || status.toLowerCase() === 'success') {
        if (statusTitle) statusTitle.textContent = 'Pagamento Aprovado!';
        if (statusIcon) {
            statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            statusIcon.style.color = 'var(--success-color, #28a745)';
        }
        
        // Atualizar mensagem
        const statusMessage = modalContent.querySelector('.transaction-info p:last-child');
        if (statusMessage) {
            statusMessage.innerHTML = '<span style="color:#28a745;font-weight:bold;">Seu pagamento foi aprovado com sucesso!</span>';
        }
        
        // Atualizar botão
        const closeBtn = modalContent.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.textContent = 'Continuar';
        }
    } else if (status === 'Erro no Pagamento' || status === 'Cancelado' || status === 'Rejeitado' || status.toLowerCase() === 'failed') {
        if (statusTitle) statusTitle.textContent = 'Pagamento não Aprovado';
        if (statusIcon) {
            statusIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            statusIcon.style.color = 'var(--error-color, #dc3545)';
        }
        
        // Atualizar mensagem de status
        const statusMessage = modalContent.querySelector('.transaction-info p:last-child');
        if (statusMessage) {
            let mensagem = status === 'Cancelado' ? 
                'Seu pagamento foi cancelado.' : 
                'Ocorreu um erro no processamento do seu pagamento.';
                
            if (falhaMotivo) {
                mensagem = falhaMotivo;
            }
            
            statusMessage.innerHTML = `<span style="color:#dc3545;font-weight:bold;">${mensagem}</span>`;
        }
        
        // Adicionar informações de falha se não existirem
        if (falhaId && !modalContent.querySelector('.transaction-info p strong:contains("ID da Falha")')) {
            const falhaIdElement = document.createElement('p');
            falhaIdElement.innerHTML = `<strong>ID da Falha:</strong> ${falhaId}`;
            
            if (transactionInfo) {
                transactionInfo.insertBefore(falhaIdElement, statusMessage);
            }
        }
    }
}

/**
 * Função melhorada para registrar clique válido de afiliado
 * Executada apenas quando o cliente clica em "Pagar Agora"
 * Inclui: verificação de localStorage, IP, detecção de fraudes
 */
async function registrarCliqueValidoAfiliado() {
    try {
        // Verificar se há código de afiliado na URL
        const urlParams = new URLSearchParams(window.location.search);
        const codigoAfiliado = urlParams.get('ref');
        
        if (!codigoAfiliado) {
            return { registrado: false, motivo: 'Sem código de afiliado' };
        }

        // Obter informações do produto
        const produtoId = window.currentProduct?.id || null;
        const produtoCustomId = window.currentProduct?.custom_id || null;

        if (!produtoId && !produtoCustomId) {
            console.warn('⚠️ Produto não encontrado para rastreio de clique');
            return { registrado: false, motivo: 'Produto não encontrado' };
        }

        // Criar chave única para este clique (afiliado + produto)
        const cliqueKey = `afiliado_clique_${codigoAfiliado}_${produtoId || produtoCustomId}`;
        
        // Verificar se já foi processado um clique para este afiliado/produto
        const cliqueProcessado = localStorage.getItem(cliqueKey);
        if (cliqueProcessado) {
            const dadosProcessado = JSON.parse(cliqueProcessado);
            const tempoDecorrido = Date.now() - dadosProcessado.timestamp;
            
            // Se foi processado há menos de 24 horas, não processar novamente
            if (tempoDecorrido < 24 * 60 * 60 * 1000) {
                return { 
                    registrado: false, 
                    motivo: 'Clique já processado',
                    jaProcessado: true,
                    dados: dadosProcessado
                };
            }
        }

        // Obter IP do cliente
        let ipAddress = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json', {
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'include'
            });
            const ipData = await ipResponse.json();
            ipAddress = ipData.ip || 'unknown';
        } catch (error) {
            console.warn('⚠️ Não foi possível obter IP:', error);
        }

        // Coletar informações do navegador para detecção de fraude
        const userAgent = navigator.userAgent || 'unknown';
        const referer = document.referrer || window.location.href;
        const screenInfo = {
            width: window.screen.width,
            height: window.screen.height,
            colorDepth: window.screen.colorDepth
        };
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const language = navigator.language || navigator.userLanguage;
        
        // Gerar fingerprint do navegador
        const fingerprintData = `${userAgent}|${ipAddress}|${screenInfo.width}x${screenInfo.height}|${timezone}|${language}`;
        const fingerprint = await generateFingerprint(fingerprintData);

        // Preparar dados para envio
        const dadosClique = {
            codigo_afiliado: codigoAfiliado,
            produto_id: produtoId,
            produto_custom_id: produtoCustomId,
            ip_address: ipAddress,
            user_agent: userAgent,
            referer: referer,
            fingerprint: fingerprint,
            screen_info: screenInfo,
            timezone: timezone,
            language: language,
            timestamp: Date.now()
        };

        // Registrar clique válido
        const apiBase = window.API_BASE || window.location.origin + '/api';
        const response = await fetch(`${apiBase}/afiliados/registrar-clique-valido`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(dadosClique)
        });

        const data = await response.json();
        
        if (data.success) {
            // Salvar no localStorage para evitar reprocessamento
            localStorage.setItem(cliqueKey, JSON.stringify({
                timestamp: Date.now(),
                valido: data.valido,
                motivo: data.motivo || null
            }));

            if (data.valido) {
                if (data.creditosGerados) {
                }
                return { 
                    registrado: true, 
                    valido: true, 
                    creditosGerados: data.creditosGerados || false,
                    valorCredito: data.valorCredito || 0
                };
            } else {
                console.warn('⚠️ Clique inválido (fraude detectada):', data.motivo);
                return { 
                    registrado: true, 
                    valido: false, 
                    motivo: data.motivo,
                    fraude: true
                };
            }
        } else {
            console.error('❌ Erro ao registrar clique:', data.message);
            return { registrado: false, motivo: data.message || 'Erro desconhecido' };
        }
    } catch (error) {
        console.error('❌ Erro ao registrar clique válido:', error);
        // Não bloquear o processo de pagamento por erro no tracking
        return { registrado: false, motivo: error.message };
    }
}

/**
 * Gerar fingerprint hash do navegador
 */
async function generateFingerprint(data) {
    try {
        // Usar Web Crypto API se disponível
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
        } else {
            // Fallback: hash simples
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(16).substring(0, 32);
        }
    } catch (error) {
        console.warn('Erro ao gerar fingerprint, usando fallback:', error);
        // Fallback simples
        return btoa(data).substring(0, 32).replace(/[^a-zA-Z0-9]/g, '');
    }
}

// Função para finalizar pedido
async function finishOrder() {
    if (!validateForm()) return;
    
    collectFormData();
    
    const finishBtn = document.getElementById('finishOrderBtn');
    const originalText = finishBtn.textContent;
    finishBtn.textContent = 'Processando...';
    finishBtn.disabled = true;
    
    try {
        // Registrar clique válido de afiliado antes de processar pagamento
        await registrarCliqueValidoAfiliado();
        
        await processPayment(orderData.customer);
        finishBtn.textContent = originalText;
        finishBtn.disabled = false;
    } catch (error) {
        finishBtn.textContent = originalText;
        finishBtn.disabled = false;
    }
}

// Função para obter IP do usuário (simulação)
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include'
        });
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return '127.0.0.1';
    }
}

// Função para mostrar informações da transação
function showTransactionInfo(venda) {
    const modal = document.createElement('div');
    modal.className = 'transaction-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Pedido Realizado com Sucesso!</h3>
            <div class="transaction-info">
                <p><strong>ID da Transação:</strong> ${venda.transacaoId}</p>
                <p><strong>Valor:</strong> MZN ${(parseFloat(venda.valor) || 0).toFixed(2).replace('.', ',')}</p>
                <p><strong>Status:</strong> ${venda.status}</p>
                <p><strong>ID do Produto:</strong> ${venda.produtoCustomId || venda.produtoId}</p>
                <p><em>Você será redirecionado em alguns segundos...</em></p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()">Fechar</button>
        </div>
    `;
    
    // Adicionar estilos do modal
    if (!document.querySelector('#modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .transaction-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
            }
            .modal-content {
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                max-width: 400px;
                width: 90%;
            }
            .transaction-info {
                margin: 20px 0;
                text-align: left;
            }
            .modal-content button {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-top: 15px;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
}



// Inicialização quando a página carregar - VERSÃO ATUALIZADA 2024
document.addEventListener('DOMContentLoaded', function() {
    
    // Carregar produto será chamado após verificar API_BASE
    
    // Configurar métodos de pagamento
    const paymentMethods = document.querySelectorAll('.payment-method');
    paymentMethods.forEach(method => {
        method.addEventListener('click', function() {
            // Selecionar o radio button
            const radio = this.querySelector('input[type="radio"]');
            radio.checked = true;
            
            // Remover seleção de todos os métodos
            paymentMethods.forEach(m => m.classList.remove('selected'));
            
            // Adicionar seleção ao método clicado
            this.classList.add('selected');
            
        });
    });
    
    // Configurar botão de finalizar
    const finishOrderBtn = document.getElementById('finishOrderBtn');
if (finishOrderBtn) {
  finishOrderBtn.addEventListener('click', function() {
    finishOrder();
  });
}

    
    // DESABILITADO: Auto seleção de método de pagamento
    // O cliente deve escolher manualmente o método de pagamento
    // const phoneInput = document.getElementById('phone');
    // if (phoneInput) {
    //     phoneInput.addEventListener('input', autoSelectPaymentMethodByPhone);
    // }
    
});

// DESABILITADO: Função para auto selecionar método de pagamento baseado no número de telefone
// O cliente deve escolher manualmente o método de pagamento para garantir autenticidade
/*
function autoSelectPaymentMethodByPhone() {
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value.replace(/\D/g, ''); // Remove caracteres não numéricos
    
    if (phone.length >= 2) {
        const firstTwoDigits = phone.substring(0, 2);
        let methodToSelect = null;
        
        // Selecionar método baseado nos primeiros dígitos
        if (firstTwoDigits === '84' || firstTwoDigits === '85') {
            methodToSelect = 'mpesa';
        } else if (firstTwoDigits === '86' || firstTwoDigits === '87') {
            methodToSelect = 'emola'; // e-Mola disponível para números 86 e 87
        }
        
        if (methodToSelect) {
            // Desmarcar todos os radio buttons
            document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
                radio.checked = false;
            });
            
            // Remover seleção visual de todos os métodos
            document.querySelectorAll('.payment-method').forEach(method => {
                method.classList.remove('selected');
            });
            
            // Selecionar o método apropriado
            const targetRadio = document.getElementById(methodToSelect);
            const targetMethod = document.querySelector(`[data-method="${methodToSelect}"]`);
            
            if (targetRadio && targetMethod) {
                targetRadio.checked = true;
                targetMethod.classList.add('selected');
            }
        }
    }
}
*/

// Inicializar a página
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se API_BASE está definido
    if (typeof window.API_BASE === 'undefined') {
        console.error('API_BASE não está definido. Verifique se server-check.js foi carregado corretamente.');
        // Definir um valor padrão para API_BASE
        window.API_BASE = window.location.origin + '/api';
    }
    
    // Carregar produto
    loadProduct();
});
