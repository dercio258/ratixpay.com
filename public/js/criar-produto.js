console.log('🚀 ARQUIVO criar-produto.js CARREGADO');

// Variáveis globais
let productData = {
    type: '',
    name: '',
    category: '',
    description: '',
    price: 0,
    finalPrice: 0,
    marketPlace: false,
    image: null,
    content: null,
    contentFile: null,
    // Configurações simples integradas
    discount: {
        enabled: false,
        type: 'percentage',
        value: 0,
        message: ''
    },
    timer: {
        enabled: false,
        duration: 0,
        message: ''
    },
    blackFriday: {
        enabled: false,
        discount: 0,
        message: ''
    },
    orderBump: {
        enabled: false,
        products: []
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadProductData();
    setupDiscountIntegration();
    
    // Carregar configurações salvas localmente
    loadLocalConfigs();
});

function setupEventListeners() {
    // Cálculo automático do preço final
    const priceInput = document.getElementById('productPrice');
    if (priceInput) {
        priceInput.addEventListener('input', calculateFinalPrice);
    }

    // Upload de imagem
    const imageUpload = document.getElementById('imageUpload');
    if (imageUpload) {
        imageUpload.addEventListener('change', handleImageUpload);
    }

    // URL da imagem
    const imageUrl = document.getElementById('imageUrl');
    if (imageUrl) {
        imageUrl.addEventListener('input', handleImageUrl);
    }

    // Upload de arquivo
    const contentFile = document.getElementById('contentFile');
    if (contentFile) {
        contentFile.addEventListener('change', handleContentFile);
    }

    // Área de upload de arquivo
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea) {
        fileUploadArea.addEventListener('click', () => contentFile.click());
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('drop', handleFileDrop);
    }

    // Order Bump
    const orderBumpCheckbox = document.getElementById('orderBumpAtivo');
    if (orderBumpCheckbox) {
        orderBumpCheckbox.addEventListener('change', toggleOrderBump);
    }

    // Formulário
    console.log('🔧 CONFIGURANDO EVENT LISTENERS');
    const form = document.getElementById('createProductForm');
    if (form) {
        console.log('✅ FORMULÁRIO ENCONTRADO, ADICIONANDO EVENT LISTENER');
        form.addEventListener('submit', createProduct);
    } else {
        console.log('❌ FORMULÁRIO NÃO ENCONTRADO');
    }
}

function setupDiscountIntegration() {
    // Configurar listeners para as configurações integradas
    const discountType = document.getElementById('discountType');
    const discountValue = document.getElementById('discountValue');
    const discountMessage = document.getElementById('discountMessage');

    if (discountType) {
        discountType.addEventListener('change', updateDiscountConfig);
    }
    if (discountValue) {
        discountValue.addEventListener('input', updateDiscountConfig);
    }
    if (discountMessage) {
        discountMessage.addEventListener('input', updateDiscountConfig);
    }

    // Timer
    const timerDuration = document.getElementById('timerDuration');
    const timerMessage = document.getElementById('timerMessage');

    if (timerDuration) {
        timerDuration.addEventListener('change', updateTimerConfig);
    }
    if (timerMessage) {
        timerMessage.addEventListener('input', updateTimerConfig);
    }

    // Black Friday
    const blackFridayDiscount = document.getElementById('blackFridayDiscount');
    const blackFridayMessage = document.getElementById('blackFridayMessage');

    if (blackFridayDiscount) {
        blackFridayDiscount.addEventListener('input', updateBlackFridayConfig);
    }
    if (blackFridayMessage) {
        blackFridayMessage.addEventListener('input', updateBlackFridayConfig);
    }
}

function updateDiscountConfig() {
    const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
    const discountConfig = {
        enabled: discountValue > 0,
        type: document.getElementById('discountType').value,
        value: discountValue,
        message: document.getElementById('discountMessage').value
    };
    
    productData.discount = discountConfig;
    
    // Salvar configuração localmente
    saveDiscountConfigLocally(discountConfig);
    
    // Recalcular preço final quando desconto muda
    calculateFinalPrice();
}

function updateTimerConfig() {
    const duration = parseInt(document.getElementById('timerDuration').value);
    const timerConfig = {
        enabled: duration > 0,
        duration: duration,
        message: document.getElementById('timerMessage').value
    };
    
    productData.timer = timerConfig;
    
    // Salvar configuração localmente
    saveTimerConfigLocally(timerConfig);
}

// Função para salvar configuração de desconto localmente
function saveDiscountConfigLocally(config) {
    try {
        const localConfigs = getLocalConfigs();
        localConfigs.discount = config;
        localStorage.setItem('ratixpay_product_configs', JSON.stringify(localConfigs));
        console.log('💾 Configuração de desconto salva localmente:', config);
        
        // Mostrar indicador visual
        showLocalSaveIndicator();
    } catch (error) {
        console.error('❌ Erro ao salvar configuração de desconto localmente:', error);
    }
}

// Função para salvar configuração de timer localmente
function saveTimerConfigLocally(config) {
    try {
        const localConfigs = getLocalConfigs();
        localConfigs.timer = config;
        localStorage.setItem('ratixpay_product_configs', JSON.stringify(localConfigs));
        console.log('💾 Configuração de timer salva localmente:', config);
        
        // Mostrar indicador visual
        showLocalSaveIndicator();
    } catch (error) {
        console.error('❌ Erro ao salvar configuração de timer localmente:', error);
    }
}

// Função para salvar configuração de Black Friday localmente
function saveBlackFridayConfigLocally(config) {
    try {
        const localConfigs = getLocalConfigs();
        localConfigs.blackFriday = config;
        localStorage.setItem('ratixpay_product_configs', JSON.stringify(localConfigs));
        console.log('💾 Configuração de Black Friday salva localmente:', config);
        
        // Mostrar indicador visual
        showLocalSaveIndicator();
    } catch (error) {
        console.error('❌ Erro ao salvar configuração de Black Friday localmente:', error);
    }
}

// Função para obter configurações locais
function getLocalConfigs() {
    try {
        const configs = localStorage.getItem('ratixpay_product_configs');
        return configs ? JSON.parse(configs) : {
            discount: { enabled: false, type: 'percentage', value: 0, message: '' },
            timer: { enabled: false, duration: 0, message: '' },
            blackFriday: { enabled: false, discount: 0, message: '' }
        };
    } catch (error) {
        console.error('❌ Erro ao carregar configurações locais:', error);
        return {
            discount: { enabled: false, type: 'percentage', value: 0, message: '' },
            timer: { enabled: false, duration: 0, message: '' },
            blackFriday: { enabled: false, discount: 0, message: '' }
        };
    }
}

// Função para carregar configurações locais
function loadLocalConfigs() {
    try {
        const configs = getLocalConfigs();
        
        // Carregar configuração de desconto
        if (configs.discount) {
            document.getElementById('discountType').value = configs.discount.type || 'percentage';
            document.getElementById('discountValue').value = configs.discount.value || 0;
            document.getElementById('discountMessage').value = configs.discount.message || '';
            productData.discount = configs.discount;
        }
        
        // Carregar configuração de timer
        if (configs.timer) {
            document.getElementById('timerDuration').value = (configs.timer.duration && configs.timer.duration > 0) ? configs.timer.duration : '';
            document.getElementById('timerMessage').value = configs.timer.message || '';
            productData.timer = configs.timer;
        }
        
        // Carregar configuração de Black Friday
        if (configs.blackFriday) {
            document.getElementById('blackFridayDiscount').value = (configs.blackFriday.discount && configs.blackFriday.discount > 0) ? configs.blackFriday.discount : '';
            document.getElementById('blackFridayMessage').value = configs.blackFriday.message || '';
            productData.blackFriday = configs.blackFriday;
        }
        
        console.log('📥 Configurações locais carregadas:', configs);
        
        // Atualizar previews
        updateDiscountPreview();
        calculateFinalPrice();
        
    } catch (error) {
        console.error('❌ Erro ao carregar configurações locais:', error);
    }
}

// Função para limpar configurações locais
function clearLocalConfigs() {
    try {
        localStorage.removeItem('ratixpay_product_configs');
        console.log('🗑️ Configurações locais limpas');
    } catch (error) {
        console.error('❌ Erro ao limpar configurações locais:', error);
    }
}

// Função para mostrar indicador de salvamento local
function showLocalSaveIndicator() {
    const indicator = document.getElementById('localSaveIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        
        // Esconder após 3 segundos
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
}

// Função de debug para verificar configurações (disponível no console)
function debugConfigurations() {
    console.log('🔍 DEBUG: Verificando configurações...');
    
    // Verificar localStorage
    const localConfigs = getLocalConfigs();
    console.log('📋 Configurações locais:', localConfigs);
    
    // Verificar campos do formulário
    const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
    const discountType = document.getElementById('discountType').value;
    const discountMessage = document.getElementById('discountMessage').value;
    
    console.log('📋 Campos de desconto:', {
        discountValue,
        discountType,
        discountMessage
    });
    
    // Verificar productData
    console.log('📋 productData:', productData);
    
    return {
        localConfigs,
        formFields: {
            discountValue,
            discountType,
            discountMessage
        },
        productData
    };
}

// Tornar função disponível globalmente para debug
window.debugConfigurations = debugConfigurations;

// Função centralizada para calcular desconto
function calculateDiscount(originalPrice, discountType, discountValue) {
    if (!originalPrice || originalPrice <= 0 || !discountValue || discountValue <= 0) {
        return {
            originalPrice: originalPrice || 0,
            finalPrice: originalPrice || 0,
            discountPercent: 0,
            discountAmount: 0
        };
    }
    
    let discountAmount = 0;
    let finalPrice = originalPrice;
    let discountPercent = 0;
    
    if (discountType === 'percentage') {
        discountAmount = (originalPrice * discountValue) / 100;
        finalPrice = originalPrice - discountAmount;
        discountPercent = discountValue;
    } else {
        // Valor fixo
        discountAmount = discountValue;
        finalPrice = originalPrice - discountValue;
        discountPercent = (discountValue / originalPrice) * 100;
    }
    
    // Garantir que o preço final não seja negativo
    if (finalPrice < 0) {
        finalPrice = 0;
        discountAmount = originalPrice;
        discountPercent = 100;
    }
    
    return {
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        discountPercent: discountPercent,
        discountAmount: discountAmount
    };
}

function updateBlackFridayConfig() {
    const discount = parseInt(document.getElementById('blackFridayDiscount').value);
    const blackFridayConfig = {
        enabled: discount > 0,
        discount: discount,
        message: document.getElementById('blackFridayMessage').value
    };
    
    productData.blackFriday = blackFridayConfig;
    
    // Salvar configuração localmente
    saveBlackFridayConfigLocally(blackFridayConfig);
}

function calculateFinalPrice() {
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    productData.price = price;
    
    // Calcular desconto usando função centralizada
    const discountType = productData.discount.type || 'percentage';
    const discountValue = productData.discount.value || 0;
    const discountResult = calculateDiscount(price, discountType, discountValue);
    
    productData.finalPrice = discountResult.finalPrice;
    document.getElementById('finalPrice').value = discountResult.finalPrice.toFixed(2) + ' MZN';
    
    // Atualizar preview com desconto
    updatePreviewWithDiscount(discountResult.originalPrice, discountResult.finalPrice, discountResult.discountPercent);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            productData.image = e.target.result;
            updateImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

function handleImageUrl(event) {
    const url = event.target.value;
    if (url) {
        productData.image = url;
        updateImagePreview(url);
    }
}

function updateImagePreview(imageSrc) {
    const preview = document.getElementById('imagePreview');
    const noImageText = document.getElementById('noImageText');
    
        if (imageSrc) {
        preview.src = imageSrc;
        preview.style.display = 'block';
            noImageText.style.display = 'none';
        } else {
        preview.style.display = 'none';
            noImageText.style.display = 'block';
        }
    }
    
function handleContentFile(event) {
    const file = event.target.files[0];
    if (file) {
        productData.contentFile = file;
        updateContentPreview(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        productData.contentFile = file;
        updateContentPreview(file);
    }
}

function updateContentPreview(file) {
    const preview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileIcon = document.getElementById('fileIcon');
    
    if (file) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        fileIcon.className = getFileIcon(file.type);
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'fas fa-image';
    if (mimeType.startsWith('video/')) return 'fas fa-video';
    if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel')) return 'fas fa-file-excel';
    if (mimeType.includes('powerpoint')) return 'fas fa-file-powerpoint';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'fas fa-file-archive';
    return 'fas fa-file';
}

function removeFile() {
    productData.contentFile = null;
    document.getElementById('contentFile').value = '';
    document.getElementById('filePreview').style.display = 'none';
}

function toggleOrderBump() {
    const enabled = document.getElementById('orderBumpAtivo').checked;
    const container = document.getElementById('orderBumpProdutosGroup');
    
    if (enabled) {
        container.style.display = 'block';
        loadOrderBumpProducts();
        } else {
        container.style.display = 'none';
        productData.orderBump.enabled = false;
        productData.orderBump.products = [];
    }
}

async function loadOrderBumpProducts() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/produtos?ativo=true&limite=50`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const produtos = data.data || [];
            displayOrderBumpProducts(produtos);
        }
    } catch (error) {
        console.error('Erro ao carregar produtos para order bump:', error);
    }
}

function displayOrderBumpProducts(produtos) {
    const container = document.getElementById('orderBumpProdutosContainer');
    container.innerHTML = '';

    produtos.forEach(produto => {
        const checkbox = document.createElement('div');
        checkbox.className = 'checkbox-group';
        checkbox.style.marginBottom = '8px';
        
        checkbox.innerHTML = `
            <input type="checkbox" id="orderBump_${produto.id}" value="${produto.id}" onchange="updateOrderBumpProducts()">
            <label for="orderBump_${produto.id}">${produto.nome} - ${parseFloat(produto.preco).toFixed(2)} MZN</label>
        `;
        
        container.appendChild(checkbox);
    });
}

function updateOrderBumpProducts() {
    const checkboxes = document.querySelectorAll('#orderBumpProdutosContainer input[type="checkbox"]:checked');
    productData.orderBump.products = Array.from(checkboxes).map(cb => cb.value);
    productData.orderBump.enabled = productData.orderBump.products.length > 0;
}

function updatePreview() {
    // Atualizar nome
    const name = document.getElementById('productName').value;
    document.getElementById('previewName').textContent = name || 'Nome do produto';
    
    // Atualizar preço
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    document.getElementById('previewPrice').textContent = `${price.toFixed(2)} MZN`;
    
    // Atualizar imagem
    const imageSrc = productData.image;
    const previewImage = document.getElementById('previewImage');
    
    if (imageSrc) {
        previewImage.innerHTML = `<img src="${imageSrc}" alt="Preview" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">`;
    } else {
        previewImage.innerHTML = '<span class="preview-placeholder">Nenhuma imagem selecionada</span>';
    }
}

function updatePreviewWithDiscount(originalPrice, finalPrice, discountPercent) {
    // Atualizar nome
    const name = document.getElementById('productName').value;
    const previewName = document.getElementById('previewName');
    if (previewName) {
        previewName.textContent = name || 'Nome do produto';
    }
    
    // Atualizar preço com desconto
    const previewPrice = document.getElementById('previewPrice');
    if (previewPrice) {
        if (discountPercent > 0) {
            // Mostrar preço com desconto
            previewPrice.innerHTML = `
                <div style="text-align: center;">
                    <div style="text-decoration: line-through; color: #6c757d; font-size: 0.9rem; margin-bottom: 5px;">
                        ${originalPrice.toFixed(2).replace('.', ',')} MZN
                    </div>
                    <div style="color: #28a745; font-weight: bold; font-size: 1.3rem;">
                        ${finalPrice.toFixed(2).replace('.', ',')} MZN
                    </div>
                    <div style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; margin-top: 5px; display: inline-block;">
                        -${discountPercent.toFixed(0)}% OFF
                    </div>
                </div>
            `;
        } else {
            // Mostrar preço normal
            previewPrice.innerHTML = `${originalPrice.toFixed(2).replace('.', ',')} MZN`;
        }
    }
    
    // Atualizar imagem
    const imageSrc = productData.image;
    const previewImage = document.getElementById('previewImage');
    
    if (previewImage) {
        if (imageSrc) {
            previewImage.innerHTML = `<img src="${imageSrc}" alt="Preview" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">`;
        } else {
            previewImage.innerHTML = '<span class="preview-placeholder">Nenhuma imagem selecionada</span>';
        }
    }
}

function loadProductData() {
    // Carregar dados existentes se estiver editando
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    
    if (productId) {
        loadExistingProduct(productId);
    }
}

async function loadExistingProduct(productId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/produtos/${productId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const produto = data.data;
            
            // Preencher formulário
            document.getElementById('productType').value = produto.tipo || '';
            document.getElementById('productCategory').value = produto.categoria || '';
            document.getElementById('productName').value = produto.nome || '';
            document.getElementById('productDescription').value = produto.descricao || '';
            document.getElementById('productPrice').value = produto.preco || '';
            document.getElementById('contentUrl').value = produto.link_conteudo || '';
            
            if (produto.imagem) {
                productData.image = produto.imagem;
                updateImagePreview(produto.imagem);
            }
            
            // Carregar configurações integradas
            loadIntegratedConfigs(produto);
            
            updatePreview();
        }
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
    }
}

function loadIntegratedConfigs(produto) {
    // Carregar configurações de desconto
    if (produto.discount_config) {
        const config = produto.discount_config;
        document.getElementById('enableDiscount').checked = config.enabled || false;
        document.getElementById('discountType').value = config.type || 'percentage';
        document.getElementById('discountValue').value = config.value || 0;
        document.getElementById('discountMessage').value = config.message || '';
        toggleDiscountOptions();
    }
    
    // Carregar configurações de temporizador
    if (produto.timer_config) {
        const config = produto.timer_config;
        document.getElementById('enableTimer').checked = config.enabled || false;
        document.getElementById('timerDuration').value = config.duration || 10;
        document.getElementById('timerMessage').value = config.message || '';
        toggleTimerOptions();
    }
    
    // Carregar configurações de Black Friday
    if (produto.blackfriday_config) {
        const config = produto.blackfriday_config;
        document.getElementById('enableBlackFriday').checked = config.enabled || false;
        document.getElementById('blackFridayDiscount').value = config.discount || 20;
        document.getElementById('blackFridayMessage').value = config.message || '';
        toggleBlackFridayOptions();
    }
    
    // Carregar configurações de Order Bump
    if (produto.order_bump_ativo) {
        document.getElementById('orderBumpAtivo').checked = true;
        toggleOrderBump();
    }
    
    // Carregar configurações de Remarketing
    if (produto.remarketing_config) {
        const config = produto.remarketing_config;
        const enableRemarketing = document.getElementById('enableRemarketing');
        const tempoEnvio = document.getElementById('remarketingTempoEnvio');
        
        if (enableRemarketing) {
            enableRemarketing.checked = config.enabled || false;
            if (config.enabled) {
                // Expandir seção se estiver ativada
                const remarketingSection = document.getElementById('remarketingSection');
                if (remarketingSection) {
                    remarketingSection.style.display = 'block';
                    const configSection = remarketingSection.closest('.config-section');
                    if (configSection) {
                        configSection.classList.add('active');
                    }
                }
            }
        }
        
        if (tempoEnvio) {
            // Verificar se é tempo personalizado
            if (config.tempo_minutos !== undefined) {
                const tempoMinutos = config.tempo_minutos;
                // Verificar se corresponde a algum valor padrão
                if (tempoMinutos === 0) {
                    tempoEnvio.value = '0';
                } else if (tempoMinutos === 5) {
                    tempoEnvio.value = '5';
                } else if (tempoMinutos === 60) {
                    tempoEnvio.value = '60';
                } else if (tempoMinutos === 1440) {
                    tempoEnvio.value = '1440';
                } else {
                    // Tempo personalizado
                    tempoEnvio.value = 'custom';
                    const customTimeGroup = document.getElementById('customTimeGroup');
                    const customTime = document.getElementById('remarketingTempoCustom');
                    const customUnidade = document.getElementById('remarketingTempoUnidade');
                    
                    if (customTimeGroup) customTimeGroup.style.display = 'block';
                    if (customTime && customUnidade) {
                        if (tempoMinutos >= 60) {
                            customTime.value = tempoMinutos / 60;
                            customUnidade.value = 'horas';
                        } else {
                            customTime.value = tempoMinutos;
                            customUnidade.value = 'minutos';
                        }
                    }
                }
            }
        }
    }
}

async function createProduct(event) {
    console.log('🚀 FUNÇÃO createProduct INICIADA');
    event.preventDefault();
    
    try {
        showLoading(true);
        
        // Coletar dados do formulário
        const formData = new FormData();
        
        // Dados básicos
        formData.append('tipo', document.getElementById('productType').value);
        formData.append('categoria', document.getElementById('productCategory').value);
        formData.append('nome', document.getElementById('productName').value);
        formData.append('descricao', document.getElementById('productDescription').value);
        formData.append('preco', document.getElementById('productPrice').value);
        formData.append('link_conteudo', document.getElementById('contentUrl').value);
        formData.append('marketplace', document.getElementById('marketPlace').checked);
        
        // Imagem
        if (productData.image) {
            formData.append('imagem', productData.image);
        }
        
        // Arquivo de conteúdo
        if (productData.contentFile) {
            formData.append('arquivo_conteudo', productData.contentFile);
        }
        
        // Coletar configurações dos dados locais ou dos campos
        console.log('🔍 Coletando configurações dos dados locais...');
        console.log('🚀 EXECUTANDO COLETA DE CONFIGURAÇÕES');
        
        // Usar configurações locais se disponíveis, senão usar campos do formulário
        const localConfigs = getLocalConfigs();
        console.log('📋 Configurações locais carregadas:', localConfigs);
        
        // Verificar se há configurações nos campos do formulário também
        const discountValue = parseFloat(document.getElementById('discountValue').value) || 0;
        const discountType = document.getElementById('discountType').value;
        const discountMessage = document.getElementById('discountMessage').value;
        
        console.log('📋 Valores dos campos:', {
            discountValue,
            discountType,
            discountMessage
        });
        
        const discountConfig = localConfigs.discount || {
            enabled: discountValue > 0,
            type: discountType,
            value: discountValue,
            message: discountMessage
        };
        
        // Verificar configurações de timer
        const timerDuration = parseInt(document.getElementById('timerDuration').value) || 0;
        const timerMessage = document.getElementById('timerMessage').value;
        
        const timerConfig = localConfigs.timer || {
            enabled: timerDuration > 0,
            duration: timerDuration,
            message: timerMessage
        };
        
        // Verificar configurações de Black Friday
        const blackFridayDiscount = parseInt(document.getElementById('blackFridayDiscount').value) || 0;
        const blackFridayMessage = document.getElementById('blackFridayMessage').value;
        
        const blackFridayConfig = localConfigs.blackFriday || {
            enabled: blackFridayDiscount > 0,
            discount: blackFridayDiscount,
            message: blackFridayMessage
        };
        
        // Verificar configurações de Remarketing
        const enableRemarketing = document.getElementById('enableRemarketing');
        const remarketingEnabled = enableRemarketing ? enableRemarketing.checked : false;
        const tempoEnvioSelect = document.getElementById('remarketingTempoEnvio');
        let tempoMinutos = 0;
        
        if (remarketingEnabled && tempoEnvioSelect) {
            const tempoEnvioValue = tempoEnvioSelect.value;
            
            if (tempoEnvioValue === 'custom') {
                const customTime = document.getElementById('remarketingTempoCustom');
                const customUnidade = document.getElementById('remarketingTempoUnidade');
                
                if (customTime && customUnidade) {
                    const valor = parseFloat(customTime.value) || 0;
                    if (customUnidade.value === 'horas') {
                        tempoMinutos = valor * 60;
                    } else {
                        tempoMinutos = valor;
                    }
                }
            } else {
                tempoMinutos = parseInt(tempoEnvioValue) || 0;
            }
        }
        
        const remarketingConfig = {
            enabled: remarketingEnabled,
            tempo_minutos: tempoMinutos
        };
        
        console.log('Configurações coletadas:', {
            discount: discountConfig,
            timer: timerConfig,
            blackFriday: blackFridayConfig,
            remarketing: remarketingConfig
        });
        
        // Configurações integradas
        console.log('📤 Enviando configurações para o backend:');
        console.log('  - discount_config:', JSON.stringify(discountConfig));
        console.log('  - timer_config:', JSON.stringify(timerConfig));
        console.log('  - blackfriday_config:', JSON.stringify(blackFridayConfig));
        console.log('  - remarketing_config:', JSON.stringify(remarketingConfig));
        
        console.log('🔍 VERIFICANDO SE AS CONFIGURAÇÕES ESTÃO SENDO ADICIONADAS AO FORMDATA');
        
        formData.append('discount_config', JSON.stringify(discountConfig));
        formData.append('timer_config', JSON.stringify(timerConfig));
        formData.append('blackfriday_config', JSON.stringify(blackFridayConfig));
        formData.append('remarketing_config', JSON.stringify(remarketingConfig));
        formData.append('order_bump_ativo', productData.orderBump.enabled);
        formData.append('order_bump_produtos', JSON.stringify(productData.orderBump.products));
        
        console.log('✅ CONFIGURAÇÕES ADICIONADAS AO FORMDATA');
        console.log('🚀 ENVIANDO FORMDATA PARA O SERVIDOR');
        
        // Enviar para o servidor
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`${window.API_BASE}/produtos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Produto criado com sucesso!');
            
            // Limpar configurações locais após sucesso
            clearLocalConfigs();
            
            setTimeout(() => {
                window.location.href = 'gestao-produtos.html';
            }, 2000);
        } else {
            // Verificar se é rejeição do Gemini AI
            if (result.error === 'PRODUTO_REJEITADO' && result.verificacao) {
                showRejectionModal(result.verificacao, result.message);
            } else {
                showError(result.message || result.error || 'Erro ao criar produto');
            }
        }
        
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        showError('Erro interno do servidor');
    } finally {
        showLoading(false);
    }
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function showRejectionModal(verificacao, message) {
    // Criar ou obter modal de rejeição
    let modal = document.getElementById('rejectionModal');
    
    if (!modal) {
        // Criar modal se não existir
        modal = document.createElement('div');
        modal.id = 'rejectionModal';
        modal.className = 'rejection-modal';
        modal.innerHTML = `
            <div class="rejection-modal-overlay"></div>
            <div class="rejection-modal-content">
                <div class="rejection-modal-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Produto Não Aprovado</h2>
                    <button class="rejection-modal-close" onclick="closeRejectionModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="rejection-modal-body">
                    <div class="rejection-alert">
                        <i class="fas fa-shield-alt"></i>
                        <p>Seu produto foi analisado pela nossa verificação automática e não foi aprovado para publicação.</p>
                    </div>
                    <div class="rejection-reason">
                        <h3><i class="fas fa-info-circle"></i> Motivo da Rejeição:</h3>
                        <div class="rejection-message" id="rejectionMessage"></div>
                        <div class="rejection-details" id="rejectionDetails" style="display: none;">
                            <h4 style="margin-top: 15px; margin-bottom: 10px; font-size: 14px; color: #666;">
                                <i class="fas fa-clipboard-list"></i> Detalhes da Verificação:
                            </h4>
                            <div id="rejectionDetailsContent" style="font-size: 13px; color: #666; line-height: 1.6;"></div>
                        </div>
                    </div>
                    <div class="rejection-actions">
                        <button class="btn btn-primary" onclick="closeRejectionModal()">
                            <i class="fas fa-check"></i> Entendi, vou revisar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Adicionar CSS se não existir
        if (!document.getElementById('rejectionModalStyles')) {
            const style = document.createElement('style');
            style.id = 'rejectionModalStyles';
            style.textContent = `
                .rejection-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .rejection-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                }
                .rejection-modal-content {
                    position: relative;
                    background: white;
                    border-radius: 12px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                    animation: modalSlideIn 0.3s ease-out;
                }
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-50px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .rejection-modal-header {
                    background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                    color: white;
                    padding: 20px 25px;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    position: relative;
                }
                .rejection-modal-header i {
                    font-size: 24px;
                }
                .rejection-modal-header h2 {
                    margin: 0;
                    flex: 1;
                    font-size: 20px;
                }
                .rejection-modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                }
                .rejection-modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                .rejection-modal-body {
                    padding: 25px;
                }
                .rejection-alert {
                    background: #fff3cd;
                    border: 2px solid #ffc107;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: start;
                    gap: 12px;
                }
                .rejection-alert i {
                    color: #856404;
                    font-size: 20px;
                    margin-top: 2px;
                }
                .rejection-alert p {
                    margin: 0;
                    color: #856404;
                    line-height: 1.6;
                }
                .rejection-reason {
                    background: #f8f9fa;
                    border-left: 4px solid #dc3545;
                    border-radius: 6px;
                    padding: 20px;
                    margin-bottom: 20px;
                }
                .rejection-reason h3 {
                    margin: 0 0 15px 0;
                    color: #dc3545;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .rejection-message {
                    background: white;
                    padding: 15px;
                    border-radius: 6px;
                    color: #333;
                    line-height: 1.8;
                    font-size: 15px;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .rejection-message p {
                    margin: 0 0 10px 0;
                    line-height: 1.8;
                }
                .rejection-message p:last-child {
                    margin-bottom: 0;
                }
                .rejection-details {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid #dee2e6;
                }
                .rejection-details h4 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    color: #666;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .rejection-details-content {
                    font-size: 13px;
                    color: #666;
                    line-height: 1.6;
                }
                .rejection-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                }
                .rejection-actions .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 15px;
                    font-weight: 600;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .rejection-actions .btn-primary {
                    background: #007bff;
                    color: white;
                }
                .rejection-actions .btn-primary:hover {
                    background: #0056b3;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
                }
                @media (max-width: 600px) {
                    .rejection-modal-content {
                        width: 95%;
                        margin: 20px;
                    }
                    .rejection-modal-header {
                        padding: 15px 20px;
                    }
                    .rejection-modal-body {
                        padding: 20px;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Preencher conteúdo do modal
    const rejectionMessage = document.getElementById('rejectionMessage');
    if (rejectionMessage) {
        const motivo = verificacao.motivo || 'Não atende aos critérios da plataforma';
        
        // Formatar o motivo para melhor visualização
        // Quebrar o texto em parágrafos para melhor legibilidade
        let motivoFormatado = motivo;
        
        // Quebrar em frases para melhor leitura
        // Substituir pontos seguidos de espaço por quebra de parágrafo
        motivoFormatado = motivo
            .replace(/\. /g, '.\n')
            .replace(/\.\n\n/g, '.\n') // Evitar quebras duplas
            .trim();
        
        // Se houver vírgulas, quebrar também (mas manter na mesma linha se for curto)
        const linhas = motivoFormatado.split('\n');
        const linhasFormatadas = linhas.map(linha => {
            // Se a linha for muito longa (> 100 caracteres), quebrar em vírgulas
            if (linha.length > 100 && linha.includes(',')) {
                return linha.split(',').map((parte, index, array) => {
                    if (index === array.length - 1) {
                        return parte.trim();
                    }
                    return parte.trim() + ',';
                }).join('\n');
            }
            return linha.trim();
        });
        
        motivoFormatado = linhasFormatadas.join('\n');
        
        // Criar HTML formatado com parágrafos
        const paragrafos = motivoFormatado
            .split('\n')
            .filter(linha => linha.trim().length > 0)
            .map(linha => linha.trim());
        
        if (paragrafos.length > 1) {
            // Múltiplos parágrafos
            rejectionMessage.innerHTML = paragrafos
                .map(paragrafo => `<p style="margin: 0 0 12px 0; line-height: 1.8; text-align: left;">${paragrafo}</p>`)
                .join('');
        } else {
            // Texto único
            rejectionMessage.innerHTML = `<p style="margin: 0; line-height: 1.8; text-align: left;">${motivo}</p>`;
        }
        
        // Garantir que o texto seja legível
        rejectionMessage.style.textAlign = 'left';
        rejectionMessage.style.fontSize = '15px';
        rejectionMessage.style.color = '#333';
    }
    
    // Preencher detalhes adicionais se disponíveis
    const rejectionDetails = document.getElementById('rejectionDetails');
    const rejectionDetailsContent = document.getElementById('rejectionDetailsContent');
    if (rejectionDetails && rejectionDetailsContent) {
        const details = [];
        
        if (verificacao.score !== undefined) {
            details.push(`<strong>Score de Confiança:</strong> ${verificacao.score}%`);
        }
        
        if (verificacao.resposta_ia) {
            details.push(`<strong>Resposta da IA:</strong> ${verificacao.resposta_ia}`);
        }
        
        if (verificacao.timestamp) {
            const data = new Date(verificacao.timestamp);
            details.push(`<strong>Data da Verificação:</strong> ${data.toLocaleString('pt-BR')}`);
        }
        
        if (details.length > 0) {
            rejectionDetailsContent.innerHTML = details.join('<br>');
            rejectionDetails.style.display = 'block';
        }
    }
    
    // Mostrar modal
    modal.style.display = 'flex';
    
    // Fechar ao clicar no overlay
    const overlay = modal.querySelector('.rejection-modal-overlay');
    if (overlay) {
        overlay.onclick = closeRejectionModal;
    }
    
    // Fechar com ESC
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeRejectionModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

function closeRejectionModal() {
    const modal = document.getElementById('rejectionModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
    }
}

// Funções de toggle para as seções
function toggleDiscountOptions() {
    const enabled = document.getElementById('enableDiscount').checked;
    const options = document.getElementById('discountOptions');
    
    if (enabled) {
        options.classList.add('active');
        updateDiscountConfig();
    } else {
        options.classList.remove('active');
        productData.discount.enabled = false;
    }
}

function toggleTimerOptions() {
    const enabled = document.getElementById('enableTimer').checked;
    const options = document.getElementById('timerOptions');
    
    if (enabled) {
        options.classList.add('active');
        updateTimerConfig();
    } else {
        options.classList.remove('active');
        productData.timer.enabled = false;
    }
}

function toggleBlackFridayOptions() {
    const enabled = document.getElementById('enableBlackFriday').checked;
    const options = document.getElementById('blackFridayOptions');
    
    if (enabled) {
        options.classList.add('active');
        updateBlackFridayConfig();
    } else {
        options.classList.remove('active');
        productData.blackFriday.enabled = false;
    }
}