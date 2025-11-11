// Variáveis globais
let currentProduct = null;
let originalPrice = 0;
let discountAmount = 0;
let finalPrice = 0;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadProductFromUrl();
    setupEventListeners();
    autoFillVendorData();
});

function loadProductFromUrl() {
    // Obter ID do produto da URL
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('produto') || urlParams.get('id');
    
    if (!productId) {
        showError('ID do produto não encontrado na URL');
        return;
    }
    
    // Carregar produto do localStorage ou usar dados simulados
    const products = JSON.parse(localStorage.getItem('ratixpay_products') || '[]');
    currentProduct = products.find(p => p.id === productId);
    
    // Se não encontrar no localStorage, usar produtos simulados
    if (!currentProduct) {
        currentProduct = getSimulatedProduct(productId);
    }
    
    if (currentProduct) {
        displayProduct();
        updatePricing();
    } else {
        showError('Produto não encontrado');
    }
}

function getSimulatedProduct(id) {
    // Produtos simulados para demonstração
    const simulatedProducts = {
        '1': {
            id: '1',
            name: 'Curso de Marketing Digital',
            type: 'curso',
            price: 297.00,
            finalPrice: 297.00,
            discount: 0,
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDA3YmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5NYXJrZXRpbmc8L3RleHQ+PC9zdmc+',
            description: 'Aprenda as melhores estratégias de marketing digital'
        },
        '2': {
            id: '2',
            name: 'eBook: Finanças Pessoais',
            type: 'ebook',
            price: 47.00,
            finalPrice: 47.00,
            discount: 0,
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjhjM2U1MCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RmluYW7Dp2FzPC90ZXh0Pjwvc3ZnPg==',
            description: 'Guia completo para organizar suas finanças'
        },
        'L47FUIO0N': {
            id: 'L47FUIO0N',
            name: 'Marketing Avançado - Plano Premium',
            type: 'plano',
            price: 297.00,
            finalPrice: 297.00,
            discount: 0,
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmY2YjAwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5QcmVtaXVtPC90ZXh0Pjwvc3ZnPg==',
            description: 'Ative o Marketing Avançado por 30 dias e aumente suas vendas com automações inteligentes'
        }
    };
    
    return simulatedProducts[id] || null;
}

// Função para preencher automaticamente os dados do vendedor
function autoFillVendorData() {
    const urlParams = new URLSearchParams(window.location.search);
    const vendedorId = urlParams.get('vendedor');
    const vendedorEmail = urlParams.get('email');
    const vendedorNome = urlParams.get('nome');
    
    console.log('🔍 Parâmetros do vendedor:', { vendedorId, vendedorEmail, vendedorNome });
    
    if (vendedorEmail && vendedorNome) {
        // Preencher campos do formulário
        const emailField = document.getElementById('emailCliente');
        const nomeField = document.getElementById('nomeCliente');
        
        if (emailField) {
            emailField.value = decodeURIComponent(vendedorEmail);
            emailField.readOnly = true; // Impedir edição
            emailField.style.backgroundColor = '#f8f9fa';
            console.log('✅ Email do vendedor preenchido:', vendedorEmail);
        }
        
        if (nomeField) {
            nomeField.value = decodeURIComponent(vendedorNome);
            nomeField.readOnly = true; // Impedir edição
            nomeField.style.backgroundColor = '#f8f9fa';
            console.log('✅ Nome do vendedor preenchido:', vendedorNome);
        }
        
        // Mostrar notificação de autenticação automática
        showNotification('✅ Dados do vendedor carregados automaticamente', 'success');
        
        // Adicionar indicador visual
        const form = document.getElementById('checkoutForm');
        if (form) {
            const indicator = document.createElement('div');
            indicator.className = 'vendor-auth-indicator';
            indicator.innerHTML = `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 12px; margin: 10px 0; color: #155724;">
                    <i class="fas fa-user-check" style="margin-right: 8px;"></i>
                    <strong>Vendedor Autenticado:</strong> ${decodeURIComponent(vendedorNome)} (${decodeURIComponent(vendedorEmail)})
                </div>
            `;
            form.insertBefore(indicator, form.firstChild);
        }
    }
}

function displayProduct() {
    const productCard = document.getElementById('productCard');
    
    productCard.innerHTML = `
        <div class="product-image">
            <img src="${currentProduct.image || '/api/placeholder/200/200'}" alt="${currentProduct.name}">
        </div>
        <div class="product-details">
            <h2>${currentProduct.name}</h2>
            <p class="product-type">${currentProduct.type === 'curso' ? '📘 Curso Online' : '📕 eBook'}</p>
            <p class="product-description">${currentProduct.description || 'Descrição não disponível'}</p>
            <div class="product-price">
                <span class="price">MZN ${currentProduct.finalPrice.toFixed(2)}</span>
                ${currentProduct.discount > 0 ? `<span class="original-price">MZN ${currentProduct.price.toFixed(2)}</span>` : ''}
            </div>
        </div>
    `;
}

function setupEventListeners() {
    // Formulário de checkout
    const checkoutForm = document.getElementById('checkoutForm');
    checkoutForm.addEventListener('submit', handleCheckout);
    
    // Aplicar cupom
    const applyCouponBtn = document.getElementById('applyCoupon');
    applyCouponBtn.addEventListener('click', applyCoupon);
    
    // Métodos de pagamento
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(method => {
        method.addEventListener('change', updatePaymentMethod);
    });
}

function updatePricing() {
    if (!currentProduct) return;
    
    originalPrice = currentProduct.price;
    finalPrice = currentProduct.finalPrice;
    
    document.getElementById('subtotal').textContent = `MZN ${originalPrice.toFixed(2)}`;
    document.getElementById('total').textContent = `MZN ${finalPrice.toFixed(2)}`;
    
    if (currentProduct.discount > 0) {
        discountAmount = originalPrice - finalPrice;
        document.getElementById('discount').textContent = `-MZN ${discountAmount.toFixed(2)}`;
        document.getElementById('discountLine').style.display = 'flex';
    }
}

function applyCoupon() {
    const couponCode = document.getElementById('couponCode').value.trim();
    
    if (!couponCode) {
        alert('Digite um código de cupom');
        return;
    }
    
    // Cupons simulados
    const validCoupons = {
        'DESCONTO10': 0.10,
        'DESCONTO20': 0.20,
        'PRIMEIRACOMPRA': 0.15,
        'BLACKFRIDAY': 0.30
    };
    
    if (validCoupons[couponCode.toUpperCase()]) {
        const couponDiscount = validCoupons[couponCode.toUpperCase()];
        const additionalDiscount = originalPrice * couponDiscount;
        
        finalPrice = originalPrice - discountAmount - additionalDiscount;
        
        document.getElementById('discount').textContent = `-MZN ${(discountAmount + additionalDiscount).toFixed(2)}`;
        document.getElementById('discountLine').style.display = 'flex';
        document.getElementById('total').textContent = `MZN ${finalPrice.toFixed(2)}`;
        
        alert(`Cupom aplicado! Desconto de ${(couponDiscount * 100)}%`);
        document.getElementById('applyCoupon').disabled = true;
        document.getElementById('applyCoupon').textContent = 'Aplicado';
    } else {
        alert('Cupom inválido');
    }
}

function updatePaymentMethod() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');
    
    // Remover seleção visual anterior
    document.querySelectorAll('.payment-method').forEach(method => {
        method.classList.remove('selected');
    });
    
    // Adicionar seleção visual
    if (selectedMethod) {
        selectedMethod.closest('.payment-method').classList.add('selected');
    }
}

function handleCheckout(event) {
    event.preventDefault();
    
    // Validar formulário
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    if (!validateForm(data)) {
        return;
    }
    
    // Simular processamento de pagamento
    showLoadingState();
    
    setTimeout(() => {
        hideLoadingState();
        processPayment(data);
    }, 2000);
}

function validateForm(data) {
    const requiredFields = ['fullName', 'email', 'phone', 'province', 'paymentMethod'];
    
    for (let field of requiredFields) {
        if (!data[field]) {
            alert(`Por favor, preencha o campo ${getFieldLabel(field)}`);
            return false;
        }
    }
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        alert('Por favor, digite um e-mail válido');
        return false;
    }
    
    return true;
}

function getFieldLabel(field) {
    const labels = {
        'fullName': 'Nome Completo',
        'email': 'E-mail',
        'phone': 'Telefone',
        'province': 'Província',
        'paymentMethod': 'Método de Pagamento'
    };
    
    return labels[field] || field;
}

function showLoadingState() {
    const submitBtn = document.querySelector('.btn-checkout');
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    submitBtn.disabled = true;
}

function hideLoadingState() {
    const submitBtn = document.querySelector('.btn-checkout');
    submitBtn.innerHTML = '<i class="fas fa-lock"></i> Finalizar Compra';
    submitBtn.disabled = false;
}

async function processPayment(customerData) {
    // Criar dados do pedido
    const orderData = {
        id: Date.now().toString(),
        product: currentProduct,
        customer: customerData,
        amount: finalPrice,
        paymentMethod: customerData.paymentMethod,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // Dados para API de pagamento E2Payment
    const paymentData = {
        produtoPublicId: currentProduct.public_id || currentProduct.id,
        numeroCelular: customerData.phone,
        metodo: customerData.paymentMethod || 'mpesa', // Usar método escolhido pelo cliente
        nomeCliente: customerData.name,
        emailCliente: customerData.email,
        whatsappCliente: customerData.whatsapp || null,
        valor: finalPrice,
        productName: currentProduct.name,
        customerPhone: customerData.phone
    };

    try {
        console.log(`Enviando requisição para: ${window.API_BASE}/pagar`);
        const response = await fetch(`${window.API_BASE}/pagar`, {
            method: 'POST',
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(paymentData)
        });
        const result = await response.json();
        if(result && result.status === 'success') {
            orderData.status = 'approved';
            showConfirmationModal(orderData);
        } else {
            orderData.status = 'failed';
            alert(result.message || 'Falha no pagamento.');
        }
    } catch (err) {
        orderData.status = 'failed';
        alert('Erro ao processar pagamento.');
    }

    // Salvar pedido
    const orders = JSON.parse(localStorage.getItem('ratixpay_orders') || '[]');
    orders.push(orderData);
    localStorage.setItem('ratixpay_orders', JSON.stringify(orders));
}

function showConfirmationModal(orderData) {
    const modal = document.getElementById('confirmationModal');
    const orderDetails = document.getElementById('orderDetails');
    
    orderDetails.innerHTML = `
        <div class="order-info">
            <p><strong>Pedido:</strong> #${orderData.id}</p>
            <p><strong>Produto:</strong> ${orderData.product.name}</p>
            <p><strong>Valor:</strong> MZN ${orderData.amount.toFixed(2)}</p>
            <p><strong>Método:</strong> ${getPaymentMethodName(orderData.paymentMethod)}</p>
            <p><strong>E-mail:</strong> ${orderData.customer.email}</p>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function getPaymentMethodName(method) {
    const methods = {
        'emola': 'e-Mola',
        'mpesa': 'M-Pesa',
        'ratixpay': 'RatixPay'
    };
    
    return methods[method] || method;
}

function closeModal() {
    const modal = document.getElementById('confirmationModal');
    modal.style.display = 'none';
    
    // Redirecionar para uma página de sucesso ou dashboard
    setTimeout(() => {
        window.location.href = 'dashboard.html';
    }, 1000);
}

function showError(message) {
    const productCard = document.getElementById('productCard');
    productCard.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Erro</h3>
            <p>${message}</p>
            <a href="dashboard.html" class="btn-back">Voltar ao Dashboard</a>
        </div>
    `;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Adicionar estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        border-radius: 8px;
        padding: 12px 16px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

