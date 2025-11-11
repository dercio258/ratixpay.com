/**
 * 🔧 SCRIPT DE ATUALIZAÇÃO DE PRODUTO - RATIXPAY
 * 
 * Funcionalidades:
 * - Busca produto no banco de dados
 * - Preenche formulário com dados existentes
 * - Permite edição de todas as informações (exceto ID)
 * - Atualiza produto no banco
 */

// Configuração da API
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = 'http://localhost:3000/api';
    console.log('🔧 API_BASE definida como:', window.API_BASE);
}

// Estado do produto
let productData = {};
let productId = null;
let contentFile = null;

// Função para normalizar URLs - garantir que sempre tenham o prefixo correto
function normalizeUrl(url) {
    if (!url) return url;
    
    // Se a URL já começa com http:// ou https://, retornar como está
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // Normalizar barras invertidas para barras normais (Windows -> Web)
    const normalizedUrl = url.replace(/\\/g, '/');
    
    // Se a URL começa com /, adicionar o prefixo do servidor
    if (normalizedUrl.startsWith('/')) {
        return `http://localhost:3000${normalizedUrl}`;
    }
    
    // Se não tem prefixo, assumir que é um caminho relativo
    return `http://localhost:3000/${normalizedUrl}`;
}
let contentUrl = null;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de atualização de produto');
    console.log('🌐 API_BASE configurada:', window.API_BASE);
    loadProductData();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
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
    
    // Cálculo de preço
    const productPrice = document.getElementById('productPrice');
    if (productPrice) {
        productPrice.addEventListener('input', calculateFinalPrice);
        productPrice.addEventListener('input', updatePreview);
    }
    
    // Atualizar preview em tempo real
    const productName = document.getElementById('productName');
    if (productName) {
        productName.addEventListener('input', updatePreview);
    }
    
    const productDescription = document.getElementById('productDescription');
    if (productDescription) {
        productDescription.addEventListener('input', updatePreview);
    }
    
    // imageUrl já foi declarado acima, apenas adicionar o event listener
    if (imageUrl) {
        imageUrl.addEventListener('input', updatePreview);
    }
    
    // Upload de arquivo de conteúdo
    const contentFile = document.getElementById('contentFile');
    if (contentFile) {
        contentFile.addEventListener('change', handleContentFileUpload);
    }
    
    // Campo de URL do conteúdo
    const contentUrl = document.getElementById('contentUrl');
    if (contentUrl) {
        contentUrl.addEventListener('input', function() {
            updateContentPreview(this.value);
        });
    }
    
    // Área de upload de arquivo
    const fileUploadArea = document.getElementById('fileUploadArea');
    if (fileUploadArea && contentFile) {
        fileUploadArea.addEventListener('click', () => contentFile.click());
        fileUploadArea.addEventListener('dragover', handleDragOver);
        fileUploadArea.addEventListener('dragleave', handleDragLeave);
        fileUploadArea.addEventListener('drop', handleDrop);
    }
    
    // Submissão do formulário
    const updateForm = document.getElementById('updateProductForm');
    if (updateForm) {
        updateForm.addEventListener('submit', handleUpdateProduct);
    }
}

// Carregar dados do produto
async function loadProductData() {
    try {
        showLoading(true);
        
        // Obter ID do produto da URL
        const urlParams = new URLSearchParams(window.location.search);
        productId = urlParams.get('id');
        
        console.log('🔍 Parâmetros da URL:', {
            search: window.location.search,
            productId: productId,
            allParams: Object.fromEntries(urlParams.entries())
        });
        
        if (!productId) {
            showError('ID do produto não encontrado na URL');
            return;
        }
        
        console.log('🔄 Carregando produto ID:', productId);
        
        // Buscar produto no banco de dados
        const produto = await buscarProdutoNoBanco(productId);
        
        if (produto) {
            productData = produto;
            productId = produto.id; // Usar o ID real do banco
            console.log('✅ Produto carregado:', productData);
            
            // Preencher formulário com os dados do produto
            preencherFormulario(productData);
            
            showLoading(false);
        } else {
            showError('Produto não encontrado. Verifique o ID na URL.');
            showLoading(false);
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar produto:', error);
        showError('Erro ao carregar dados do produto: ' + error.message);
        showLoading(false);
    }
}

// Buscar produto no banco de dados
async function buscarProdutoNoBanco(id) {
    try {
        console.log('🔍 Buscando produto no banco de dados...');
        
        // Primeiro, tentar buscar diretamente pelo ID
        try {
            const response = await apiRequest(`/produtos/${id}`);
            const produto = response.data || response;
            if (produto && produto.id) {
                console.log('✅ Produto encontrado diretamente:', produto);
                return produto;
            }
        } catch (error) {
            console.log('⚠️ Produto não encontrado diretamente, buscando em todos os produtos...');
            console.log('🔍 Erro na busca direta:', error.message);
        }
        
        // Se não encontrar diretamente, buscar em todos os produtos
        const response = await apiRequest('/produtos');
        const todosProdutos = response.data || response || [];
        
        console.log('📊 Total de produtos no banco:', todosProdutos.length);
        
        if (Array.isArray(todosProdutos)) {
            // Procurar por ID exato
            let produtoEncontrado = todosProdutos.find(p => p.id === id);
            
            // Se não encontrar, procurar por custom_id
            if (!produtoEncontrado) {
                produtoEncontrado = todosProdutos.find(p => 
                    p.custom_id === id || 
                    p.customId === id
                );
            }
            
            // Se ainda não encontrar, procurar por nome (caso o ID seja na verdade um nome)
            if (!produtoEncontrado) {
                produtoEncontrado = todosProdutos.find(p => 
                    p.nome && p.nome.toLowerCase().includes(id.toLowerCase())
                );
            }
            
            if (produtoEncontrado) {
                console.log('✅ Produto encontrado via busca:', produtoEncontrado);
                return produtoEncontrado;
            } else {
                console.log('❌ Produto não encontrado em nenhuma busca');
                return null;
            }
        } else {
            console.log('⚠️ Resposta não é um array:', todosProdutos);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar produto no banco:', error);
        throw error;
    }
}

// Preencher formulário com dados do produto
function preencherFormulario(produto) {
    try {
        console.log('📝 Preenchendo formulário com dados do produto:', produto);
        
        // Campos básicos
        setFieldValue('productName', produto.nome || '');
        setFieldValue('productDescription', produto.descricao || '');
        setFieldValue('productPrice', produto.preco || '');
        
        // Campos de imagem
        if (produto.imagem_url) {
            setFieldValue('imageUrl', produto.imagem_url);
            updateImagePreview(produto.imagem_url);
        }
        
        // Link do Conteúdo - verificar múltiplas possibilidades
        const linkConteudo = produto.link_conteudo || 
                            produto.conteudo_url || 
                            produto.contentUrl || 
                            produto.conteudo_link ||
                            produto.conteudo_arquivo;
        
        if (linkConteudo) {
            setFieldValue('contentUrl', linkConteudo);
            console.log('🔗 Link do Conteúdo carregado:', linkConteudo);
            
            // Atualizar preview do conteúdo se existir
            updateContentPreview(linkConteudo);
        } else {
            console.log('⚠️ Nenhum link de conteúdo encontrado para o produto');
        }
        
        // Campo de marketplace
        if (produto.disponivelMarketplace !== undefined) {
            const marketPlaceCheckbox = document.getElementById('marketPlace');
            if (marketPlaceCheckbox) {
                marketPlaceCheckbox.checked = produto.disponivelMarketplace;
                console.log('🏪 Marketplace definido como:', produto.disponivelMarketplace);
            }
        }
        
        // Calcular preço final
        calculateFinalPrice();
        
        // Atualizar preview inicial
        updatePreview();
        
        console.log('✅ Formulário preenchido com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao preencher formulário:', error);
        showError('Erro ao preencher formulário: ' + error.message);
    }
}

// Definir valor de um campo
function setFieldValue(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.value = value || '';
        console.log(`📝 Campo ${fieldId} definido como:`, value);
    } else {
        console.log(`⚠️ Campo ${fieldId} não encontrado`);
    }
}

// Atualizar preview da imagem
function updateImagePreview(imageUrl) {
    const preview = document.getElementById('imagePreview');
    if (preview && imageUrl) {
        preview.src = imageUrl;
        preview.style.display = 'block';
    }
}

// Atualizar preview do conteúdo
function updateContentPreview(contentUrl) {
    const contentPreview = document.getElementById('contentPreview');
    if (contentPreview && contentUrl) {
        // Verificar se é um link ou arquivo
        if (contentUrl.startsWith('http')) {
            contentPreview.innerHTML = `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
                    <strong>🔗 Link de Conteúdo:</strong><br>
                    <a href="${contentUrl}" target="_blank" style="color: #007bff; word-break: break-all;">${contentUrl}</a>
                </div>
            `;
        } else {
            contentPreview.innerHTML = `
                <div style="padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
                    <strong>📁 Arquivo de Conteúdo:</strong><br>
                    <span style="color: #28a745; word-break: break-all;">${contentUrl}</span>
                </div>
            `;
        }
    }
}

// Calcular preço final
function calculateFinalPrice() {
    const preco = parseFloat(document.getElementById('productPrice')?.value || 0);
    
    const precoFinalElement = document.getElementById('finalPrice');
    if (precoFinalElement) {
        precoFinalElement.value = preco.toFixed(2);
    }
}

// Manipular upload de imagem
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Mostrar loading
        const uploadBtn = event.target.parentElement.querySelector('.upload-btn');
        if (!uploadBtn) {
            console.error('❌ Botão de upload não encontrado');
            showError('Erro: Botão de upload não encontrado');
            return;
        }
        
        const originalText = uploadBtn.innerHTML;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        uploadBtn.disabled = true;
        
        try {
            
            console.log('🖼️ Iniciando upload de imagem com sistema aprimorado...');
            
            // Usar o novo sistema de upload aprimorado
            const formData = new FormData();
            formData.append('image', file);
            formData.append('folder', 'produtos');
            
            const response = await fetch(`${window.API_BASE}/upload/enhanced/single`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erro no upload');
            }
            
            const imageUrl = result.data.original.url;
            
            // Normalizar a URL para garantir que tenha o prefixo correto
            const normalizedImageUrl = normalizeUrl(imageUrl);
            
            // Atualizar campo de URL da imagem
            const imageUrlField = document.getElementById('imageUrl');
            if (imageUrlField) {
                imageUrlField.value = normalizedImageUrl;
            }
            
            // Atualizar preview
            updateImagePreview(normalizedImageUrl);
            
            console.log('✅ Imagem enviada com sucesso:', imageUrl);
            showSuccess('Imagem enviada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao fazer upload da imagem:', error);
            showError('Erro ao fazer upload da imagem: ' + error.message);
        } finally {
            // Restaurar botão
            uploadBtn.innerHTML = originalText;
            uploadBtn.disabled = false;
        }
    }
}

// Fazer upload de imagem para Cloudinary
async function uploadImageToCloudinary(base64Data) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        const response = await fetch(`${window.API_BASE}/produtos/upload-imagem`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imagemBase64: base64Data
            })
        });
        
        if (response.status === 401) {
            showError('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            throw new Error('Token inválido ou expirado');
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.erro || `HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Erro no upload para Cloudinary:', error);
        throw error;
    }
}

// Manipular URL da imagem
function handleImageUrl(event) {
    const url = event.target.value;
    if (url) {
        // Normalizar a URL para garantir que tenha o prefixo correto
        const normalizedUrl = normalizeUrl(url);
        // Atualizar o campo com a URL normalizada
        event.target.value = normalizedUrl;
        updateImagePreview(normalizedUrl);
    }
}

// Manipular atualização do produto
async function handleUpdateProduct(event) {
    event.preventDefault();
    
    try {
        showLoading(true);
        
        // Coletar dados do formulário
        const formData = coletarDadosFormulario();
        
        console.log('📝 Dados coletados do formulário:', formData);
        
        // Validar dados
        if (!formData.nome || !formData.preco) {
            showError('Nome e preço são obrigatórios');
            return;
        }
        
        // Atualizar produto no banco
        const produtoAtualizado = await atualizarProdutoNoBanco(productId, formData);
        
        if (produtoAtualizado) {
            showSuccess('Produto atualizado com sucesso!');
            console.log('✅ Produto atualizado:', produtoAtualizado);
            
            // Atualizar dados locais
            productData = produtoAtualizado;
        } else {
            showError('Erro ao atualizar produto');
        }
        
    } catch (error) {
        console.error('❌ Erro ao atualizar produto:', error);
        showError('Erro ao atualizar produto: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Coletar dados do formulário
function coletarDadosFormulario() {
    const formData = {
        nome: document.getElementById('productName')?.value || '',
        descricao: document.getElementById('productDescription')?.value || '',
        preco: parseFloat(document.getElementById('productPrice')?.value || 0),
        imagem_url: document.getElementById('imageUrl')?.value || '',
        link_conteudo: document.getElementById('contentUrl')?.value || '',
        disponivelMarketplace: document.getElementById('marketPlace')?.checked || false
    };
    
    return formData;
}

// Atualizar produto no banco de dados
async function atualizarProdutoNoBanco(id, dados) {
    try {
        console.log('🔄 Atualizando produto no banco:', { id, dados });
        
        const response = await apiRequest(`/produtos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(dados)
        });
        
        const produtoAtualizado = response.data || response;
        console.log('✅ Produto atualizado no banco:', produtoAtualizado);
        
        return produtoAtualizado;
        
    } catch (error) {
        console.error('❌ Erro ao atualizar produto no banco:', error);
        throw error;
    }
}

// Fazer requisição para a API
async function apiRequest(endpoint, options = {}) {
    try {
        if (!window.API_BASE) {
            window.API_BASE = 'http://localhost:3000/api';
            console.log('🔧 API_BASE definida na função apiRequest:', window.API_BASE);
        }
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        const url = `${window.API_BASE}${endpoint}`;
        console.log('🌐 Fazendo requisição para:', url);
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            },
            ...options
        });

        if (response.status === 401) {
            showError('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            throw new Error('Token inválido ou expirado');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.erro || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// Mostrar/ocultar loading
function showLoading(show) {
    const loading = document.getElementById('loading');
    const form = document.getElementById('updateProductForm');
    
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
    
    if (form) {
        form.style.display = show ? 'none' : 'block';
    }
}

// Mostrar erro
function showError(message) {
    console.error('❌ Erro:', message);
    
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        alert('Erro: ' + message);
    }
}

// Mostrar sucesso
function showSuccess(message) {
    console.log('✅ Sucesso:', message);
    
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    } else {
        alert('Sucesso: ' + message);
    }
}

// ======================== FUNÇÕES DE UPLOAD DE CONTEÚDO ========================

// Upload de arquivo de conteúdo
async function handleContentFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        // Validar tamanho (máx 50MB)
        if (file.size > 50 * 1024 * 1024) {
            alert('Arquivo muito grande. Tamanho máximo: 50MB');
            return;
        }

        try {
            console.log('📁 Iniciando upload de arquivo de conteúdo com sistema aprimorado...');
            
            // Usar o novo sistema de upload aprimorado para conteúdo
            const formData = new FormData();
            formData.append('contentFile', file);
            formData.append('folder', 'conteudo');
            
            const response = await fetch(`${window.API_BASE}/upload/enhanced-content/single`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Erro no upload');
            }
            
            const originalContentUrl = result.data.original.url;
            
            // Normalizar a URL para garantir que tenha o prefixo correto
            contentUrl = normalizeUrl(originalContentUrl);
            contentFile = file;
            
            // Atualizar preview do arquivo
            updateFilePreview(file);
            
            // Atualizar campo de URL do conteúdo
            const contentUrlField = document.getElementById('contentUrl');
            if (contentUrlField) {
                contentUrlField.value = contentUrl;
            }
            
            // Atualizar preview do conteúdo
            updateContentPreview(contentUrl);
            
            console.log('✅ Arquivo de conteúdo enviado com sucesso:', contentUrl);
            showSuccess('Arquivo de conteúdo enviado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao fazer upload do arquivo de conteúdo:', error);
            showError('Erro ao fazer upload do arquivo de conteúdo: ' + error.message);
        }
    }
}

// Atualizar preview do arquivo
function updateFilePreview(file) {
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const fileIcon = document.querySelector('.file-icon');
    
    if (filePreview && fileName && fileSize && fileIcon) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        // Definir ícone baseado no tipo de arquivo
        const extension = file.name.split('.').pop().toLowerCase();
        const iconClass = getFileIcon(extension);
        fileIcon.className = `file-icon ${iconClass}`;
        
        filePreview.style.display = 'block';
    }
}

// Formatar tamanho do arquivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Obter ícone do arquivo
function getFileIcon(extension) {
    const iconMap = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'txt': 'fas fa-file-alt',
        'rtf': 'fas fa-file-alt',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'ppt': 'fas fa-file-powerpoint',
        'pptx': 'fas fa-file-powerpoint',
        'zip': 'fas fa-file-archive',
        'rar': 'fas fa-file-archive',
        '7z': 'fas fa-file-archive',
        'mp3': 'fas fa-file-audio',
        'mp4': 'fas fa-file-video',
        'avi': 'fas fa-file-video',
        'mov': 'fas fa-file-video',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'gif': 'fas fa-file-image',
        'html': 'fas fa-file-code',
        'css': 'fas fa-file-code',
        'js': 'fas fa-file-code',
        'json': 'fas fa-file-code',
        'xml': 'fas fa-file-code'
    };
    
    return iconMap[extension] || 'fas fa-file';
}

// Remover arquivo de conteúdo
function removeContentFile() {
    contentFile = null;
    contentUrl = null;
    
    const filePreview = document.getElementById('filePreview');
    const contentFileInput = document.getElementById('contentFile');
    const contentUrlField = document.getElementById('contentUrl');
    
    if (filePreview) {
        filePreview.style.display = 'none';
    }
    
    if (contentFileInput) {
        contentFileInput.value = '';
    }
    
    if (contentUrlField) {
        contentUrlField.value = '';
    }
    
    console.log('🗑️ Arquivo de conteúdo removido');
}

// ======================== FUNÇÕES DE DRAG & DROP ========================

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const contentFileInput = document.getElementById('contentFile');
        if (contentFileInput) {
            contentFileInput.files = files;
            handleContentFileUpload({ target: contentFileInput });
        }
    }
}

// ======================== FUNÇÕES DE PREVIEW ========================

// Atualizar preview do produto
function updatePreview() {
    updatePreviewName();
    updatePreviewPrice();
    updatePreviewDescription();
    updatePreviewImage();
}

function updatePreviewName() {
    const nameField = document.getElementById('productName');
    const previewName = document.getElementById('previewName');
    
    if (nameField && previewName) {
        const name = nameField.value.trim();
        if (name) {
            previewName.innerHTML = `<span>${name}</span>`;
        } else {
            previewName.innerHTML = '<span class="preview-placeholder">Nome do produto</span>';
        }
    }
}

function updatePreviewPrice() {
    const priceField = document.getElementById('productPrice');
    const previewPrice = document.getElementById('previewPrice');
    
    if (priceField && previewPrice) {
        const price = parseFloat(priceField.value);
        if (price && price > 0) {
            previewPrice.innerHTML = `<span>${price.toFixed(2)} MZN</span>`;
        } else {
            previewPrice.innerHTML = '<span class="preview-placeholder">Preço</span>';
        }
    }
}

function updatePreviewDescription() {
    const descriptionField = document.getElementById('productDescription');
    const previewDescription = document.getElementById('previewDescription');
    
    if (descriptionField && previewDescription) {
        const description = descriptionField.value.trim();
        if (description) {
            const shortDescription = description.length > 100 ? 
                description.substring(0, 100) + '...' : description;
            previewDescription.innerHTML = `<span>${shortDescription}</span>`;
        } else {
            previewDescription.innerHTML = '<span class="preview-placeholder">Descrição do produto</span>';
        }
    }
}

function updatePreviewImage() {
    const imageUrlField = document.getElementById('imageUrl');
    const previewImage = document.getElementById('previewImage');
    
    if (imageUrlField && previewImage) {
        const imageUrl = imageUrlField.value.trim();
        if (imageUrl) {
            previewImage.innerHTML = `<img src="${imageUrl}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
        } else {
            previewImage.innerHTML = '<i class="fas fa-image"></i><span>Imagem do produto</span>';
        }
    }
}
