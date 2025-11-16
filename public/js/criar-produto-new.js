// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Estado do formulário
let currentStep = 1;
let productData = {};
let editMode = false;
let editId = null;

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
    try {
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        const response = await fetch(`${window.API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...options.headers
            },
            ...options
        });

        if (response.status === 401) {
            showNotification('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            throw new Error('Token inválido ou expirado');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            if (response.status === 404) {
                throw new Error('Produto não encontrado');
            }
            
            throw new Error(errorData.erro || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// Função para mostrar notificação
function showNotification(message, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed; top: 20px; right: 20px;
                padding: 15px 20px; border-radius: 8px;
                color: white; font-weight: bold;
                z-index: 1000; animation: slideIn 0.3s ease;
            }
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.warning { background: #ffc107; color: #333; }
            .notification-content {
                display: flex; align-items: center; gap: 10px;
            }
            .notification button {
                background: none; border: none; color: inherit;
                font-size: 18px; cursor: pointer;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentElement) notification.remove(); }, 5000);
}

// Função para selecionar tipo de produto
function selectProductType(type) {
    document.querySelectorAll('.product-type-card').forEach(card => {
        card.classList.remove('selected');
    });

    document.querySelector(`[data-type="${type}"]`)?.classList.add('selected');
    productData.tipo = type === 'curso' ? 'Curso Online' : 'eBook';

    const nextBtn = document.querySelector('.step-content.active .btn-next');
    if (nextBtn) nextBtn.disabled = false;
}

// Função para validar etapa atual
function validateCurrentStep() {
    switch (currentStep) {
        case 1:
            if (!productData.tipo) {
                showNotification('Por favor, selecione o tipo de produto', 'error');
                return false;
            }
            break;
        case 2:
            const nome = document.getElementById('productName')?.value;
            const categoria = document.getElementById('productCategory')?.value;
            const descricao = document.getElementById('productDescription')?.value;
            const preco = document.getElementById('productPrice')?.value;

            if (!nome || !categoria || !descricao || !preco) {
                showNotification('Por favor, preencha todos os campos obrigatórios', 'error');
                return false;
            }
            break;
        case 3:
            const imagemUrl = document.getElementById('productImageUrl')?.value;
            const imagemFile = document.getElementById('productImageFile')?.files[0];

            if (!imagemUrl && !imagemFile) {
                showNotification('Por favor, forneça uma imagem para o produto', 'error');
                return false;
            }
            break;
        case 4:
            let conteudoUrl = '';
            if (productData.tipo === 'Curso Online') {
                conteudoUrl = document.getElementById('courseContentUrl')?.value;
            } else {
                conteudoUrl = document.getElementById('ebookContentUrl')?.value;
            }

            if (!conteudoUrl) {
                showNotification('Por favor, forneça a URL do conteúdo', 'error');
                return false;
            }
            break;
    }

    return true;
}

// Função para upload de imagem usando o sistema aprimorado
async function uploadImagem(file) {
    try {
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('folder', 'produtos');
        
        // Usar o novo sistema de upload aprimorado
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
        
        
        // Retornar a URL da imagem original
        return result.data.original.url;
        
    } catch (error) {
        console.error('❌ Erro ao fazer upload da imagem:', error);
        throw new Error('Erro ao fazer upload da imagem: ' + error.message);
    }
}

// Coletar dados da etapa atual
function collectStepData() {
    switch (currentStep) {
        case 2:
            productData.nome = document.getElementById('productName')?.value || '';
            productData.categoria = document.getElementById('productCategory')?.value || '';
            productData.descricao = document.getElementById('productDescription')?.value || '';
            productData.preco = parseFloat(document.getElementById('productPrice')?.value) || 0;
            productData.desconto = parseFloat(document.getElementById('productDiscount')?.value) || 0;
            productData.cupom = document.getElementById('couponCode')?.value || '';
            productData.afiliado = document.getElementById('allowAffiliates')?.checked || false;
            break;
        case 3:
            // Imagem: priorizar arquivo
            const fileInput = document.getElementById('productImageFile');
            const file = fileInput && fileInput.files && fileInput.files[0];
            if (file) {
                productData.imagemFile = file;
                productData.imagemUrl = '';
            } else {
                productData.imagemFile = null;
                productData.imagemUrl = document.getElementById('productImageUrl')?.value || '';
            }
            break;
        case 4:
            productData.conteudoUrl =
                productData.tipo === 'Curso Online'
                    ? document.getElementById('courseContentUrl')?.value || ''
                    : document.getElementById('ebookContentUrl')?.value || '';
            break;
    }
}

// Avançar etapa
function nextStep() {
    if (!validateCurrentStep()) return;

    collectStepData();

    if (currentStep < 5) {
        document.getElementById(`step${currentStep}`)?.classList.remove('active');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.remove('active');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.add('completed');

        currentStep++;

        document.getElementById(`step${currentStep}`)?.classList.add('active');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.add('active');

        if (currentStep === 4) setupStep4();
        if (currentStep === 5) setupStep5();
    }
}

// Voltar etapa
function prevStep() {
    if (currentStep > 1) {
        document.getElementById(`step${currentStep}`)?.classList.remove('active');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.remove('active');

        currentStep--;

        document.getElementById(`step${currentStep}`)?.classList.add('active');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.remove('completed');
        document.querySelector(`[data-step="${currentStep}"]`)?.classList.add('active');
        
        // Configurar etapa correta ao voltar
        if (currentStep === 4) setupStep4();
    }
}

// Mostrar conteúdo correto na etapa 4
function setupStep4() {
    const courseContent = document.getElementById('courseContent');
    const ebookContent = document.getElementById('ebookContent');

    if (productData.tipo === 'Curso Online') {
        courseContent.style.display = 'block';
        ebookContent.style.display = 'none';
    } else {
        courseContent.style.display = 'none';
        ebookContent.style.display = 'block';
    }
}

// Configurar resumo na etapa 5
function setupStep5() {
    updateProductSummary();
}

// Lógica para garantir que apenas um campo de imagem seja usado
window.toggleImageInputs = function() {
    const urlInput = document.getElementById('productImageUrl');
    const fileInput = document.getElementById('productImageFile');
    if (urlInput.value) {
        fileInput.disabled = true;
        // Mostrar preview da imagem da URL
        showImagePreview(urlInput.value);
    } else {
        fileInput.disabled = false;
    }
    if (fileInput.files && fileInput.files.length > 0) {
        urlInput.disabled = true;
        // Mostrar preview do arquivo de imagem
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            showImagePreview(e.target.result);
        };
        reader.readAsDataURL(file);
    } else {
        urlInput.disabled = false;
    }
};

// Função para mostrar preview da imagem
function showImagePreview(imageUrl) {
    const imagePreviewContainer = document.querySelector('.input-group:has(#productImageUrl)');
    if (!imagePreviewContainer) return;
    
    // Remover preview anterior se existir
    const existingPreview = document.getElementById('imagePreview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Criar novo preview
    const previewDiv = document.createElement('div');
    previewDiv.id = 'imagePreview';
    previewDiv.style.marginTop = '10px';
    previewDiv.style.textAlign = 'center';
    previewDiv.innerHTML = `<img src="${imageUrl}" alt="Preview da imagem" style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`;
    
    imagePreviewContainer.appendChild(previewDiv);
}

// Atualizar revisão do produto com checks verdes na checklist
function updateProductSummary() {
    // Checklist
    const check = '<i class="fas fa-check-circle" style="color:#28a745;"></i>';
    const cross = '<i class="fas fa-times" style="color:#dc3545;"></i>';
    const checklist = [
        { id: 'checkType', label: 'Tipo selecionado', valid: !!productData.tipo },
        { id: 'checkName', label: 'Nome do produto', valid: !!productData.nome },
        { id: 'checkImage', label: 'Imagem anexada', valid: !!(productData.imagemUrl || productData.imagemFile) },
        { id: 'checkContent', label: 'Conteúdo verificado', valid: !!productData.conteudoUrl },
    ];
    checklist.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) {
            el.innerHTML = `${item.valid ? check : cross} <span>${item.label}</span>`;
        }
    });
    // Resumo limpo
    const summary = document.getElementById('productSummary');
    if (!summary) return;
    const preco = productData.preco || 0;
    const desconto = productData.desconto || 0;
    const precoFinal = preco - (preco * desconto / 100);
    
    // Preparar imagem para exibição no resumo
    let imagemHtml = '';
    if (productData.custom_id) {
        // Se estiver editando um produto existente, usar a nova rota de imagem
        imagemHtml = `<div class="summary-item"><strong>Imagem:</strong> <img src="${window.API_BASE}/produtos/imagem/${productData.custom_id}" alt="Imagem do produto" style="max-width: 100px; max-height: 100px;"></div>`;
    } else if (productData.id) {
        // Fallback para id numérico
        imagemHtml = `<div class="summary-item"><strong>Imagem:</strong> <img src="${window.API_BASE}/produtos/imagem/${productData.id}" alt="Imagem do produto" style="max-width: 100px; max-height: 100px;"></div>`;
    } else if (productData.imagemUrl) {
        // Se tiver URL de imagem
        imagemHtml = `<div class="summary-item"><strong>Imagem:</strong> <img src="${productData.imagemUrl}" alt="Imagem do produto" style="max-width: 100px; max-height: 100px;"></div>`;
    } else if (productData.imagemFile) {
        // Se tiver arquivo de imagem, mostrar texto indicando que será feito upload
        imagemHtml = `<div class="summary-item"><strong>Imagem:</strong> Será feito upload do arquivo selecionado</div>`;
    }
    
    summary.innerHTML = `
        <div class="summary-card">
            <h3>Resumo do Produto</h3>
            <div class="summary-item"><strong>Tipo:</strong> ${productData.tipo || '-'}</div>
            <div class="summary-item"><strong>Nome:</strong> ${productData.nome || '-'}</div>
            <div class="summary-item"><strong>Categoria:</strong> ${productData.categoria || '-'}</div>
            <div class="summary-item"><strong>Descrição:</strong> ${productData.descricao || '-'}</div>
            <div class="summary-item"><strong>Preço:</strong> MZN ${preco.toFixed(2).replace('.', ',')}</div>
            ${desconto > 0 ? `<div class="summary-item"><strong>Desconto:</strong> ${desconto}%</div><div class="summary-item"><strong>Preço Final:</strong> MZN ${precoFinal.toFixed(2).replace('.', ',')}</div>` : ''}
            <div class="summary-item"><strong>Permite Afiliados:</strong> ${productData.afiliado ? 'Sim' : 'Não'}</div>
            <div class="summary-item"><strong>ID:</strong> ${productData.customId || '-'}</div>
            ${imagemHtml}
        </div>
    `;
}

// Atualiza campo "Preço Final"
function calculateFinalPrice() {
    const price = parseFloat(document.getElementById('productPrice')?.value) || 0;
    const discount = parseFloat(document.getElementById('productDiscount')?.value) || 0;
    const final = price - (price * discount / 100);

    document.getElementById('finalPrice').value = `MZN ${final.toFixed(2)}`;
}

// ======================== FLUXO DE CRIAÇÃO EM ETAPAS ========================

// Iniciar criação do produto (etapa 1)
async function iniciarProduto() {
    try {
        const { nome, tipo, categoria } = productData;
        if (!nome || !tipo) {
            showNotification('Nome e tipo são obrigatórios', 'error');
            return null;
        }
        
        
        const response = await apiRequest('/produtos/iniciar', {
            method: 'POST',
            body: JSON.stringify({ 
                nome, 
                tipo, 
                categoria,
                preco: 0 // Valor padrão para evitar erro de not-null constraint
            })
        });
        
        return response.produto;
    } catch (error) {
        console.error('❌ Erro ao iniciar produto:', error);
        showNotification('Erro ao iniciar produto', 'error');
        return null;
    }
}

// Adicionar imagem ao produto (etapa 2) usando sistema aprimorado
async function adicionarImagemProduto(produtoId) {
    try {
        if (!produtoId) {
            showNotification('ID do produto é obrigatório', 'error');
            return false;
        }
        
        if (!productData.imagemFile && !productData.imagemUrl) {
            showNotification('Imagem é obrigatória', 'error');
            return false;
        }
        
        
        let imagemUrl = null;
        
        // Se for um arquivo, usar o novo sistema de upload
        if (productData.imagemFile) {
            imagemUrl = await uploadImagem(productData.imagemFile);
        } else if (productData.imagemUrl) {
            imagemUrl = productData.imagemUrl;
        }
        
        if (!imagemUrl) {
            throw new Error('Não foi possível processar a imagem');
        }
        
        
        // Atualizar o produto com a URL da imagem
        const response = await apiRequest(`/produtos/${produtoId}`, {
            method: 'PUT',
            body: JSON.stringify({ 
                imagem_url: imagemUrl,
                imagem_public_id: imagemUrl.split('/').pop().split('.')[0] // Extrair nome do arquivo
            })
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar imagem:', error);
        showNotification(`Erro ao adicionar imagem: ${error.message}`, 'error');
        return false;
    }
}

// Adicionar conteúdo ao produto (etapa 3)
async function adicionarConteudoProduto(produtoId) {
    try {
        if (!produtoId) {
            showNotification('ID do produto é obrigatório', 'error');
            return false;
        }
        
        if (!productData.conteudoUrl) {
            showNotification('Link de conteúdo é obrigatório', 'error');
            return false;
        }
        
        
        await apiRequest(`/produtos/${produtoId}/conteudo`, {
            method: 'POST',
            body: JSON.stringify({ linkConteudo: productData.conteudoUrl })
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao adicionar conteúdo:', error);
        showNotification(`Erro ao adicionar conteúdo: ${error.message}`, 'error');
        return false;
    }
}

// Finalizar produto (etapa 4)
async function finalizarProduto(produtoId) {
    try {
        if (!produtoId) {
            showNotification('ID do produto é obrigatório', 'error');
            return false;
        }
        
        
        await apiRequest(`/produtos/${produtoId}/finalizar`, {
            method: 'POST',
            body: JSON.stringify({
                preco: productData.preco,
                desconto: productData.desconto,
                descricao: productData.descricao
            })
        });
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao finalizar produto:', error);
        showNotification(`Erro ao finalizar produto: ${error.message}`, 'error');
        return false;
    }
}

// ======================== FUNÇÃO PRINCIPAL DE CRIAÇÃO ========================

// Spinner de carregamento na finalização
async function finishProduct() {
    if (!validateCurrentStep()) return;
    collectStepData();
    
    const finishBtn = document.querySelector('.btn-finish');
    const reviewLoading = document.getElementById('reviewLoading');
    
    if (finishBtn) {
        const originalText = finishBtn.textContent;
        finishBtn.textContent = editMode ? 'Salvando...' : 'Criando...';
        finishBtn.disabled = true;
        
        if (reviewLoading) reviewLoading.style.display = 'flex';
        
        try {
            if (editMode && editId) {
                // Atualizar produto existente (PUT)
                
                // Se houver arquivo de imagem, fazer upload primeiro
                if (productData.imagemFile) {
                    const url = await uploadImagem(productData.imagemFile);
                    productData.imagemUrl = url;
                    delete productData.imagemFile;
                }
                
                await apiRequest(`/produtos/${editId}`, {
                    method: 'PUT',
                    body: JSON.stringify(productData)
                });
                
                showNotification('Produto atualizado com sucesso!', 'success');
            } else {
                // Novo fluxo de criação em etapas
                
                // ETAPA 1: Iniciar produto - gerar custom_id
                const produtoIniciado = await iniciarProduto();
                if (!produtoIniciado) {
                    throw new Error('Falha ao iniciar produto');
                }
                
                const produtoId = produtoIniciado.custom_id;
                
                // ETAPA 2: Adicionar imagem
                const imagemAdicionada = await adicionarImagemProduto(produtoId);
                if (!imagemAdicionada) {
                    throw new Error('Falha ao adicionar imagem');
                }
                
                
                // ETAPA 3: Adicionar conteúdo
                const conteudoAdicionado = await adicionarConteudoProduto(produtoId);
                if (!conteudoAdicionado) {
                    throw new Error('Falha ao adicionar conteúdo');
                }
                
                
                // ETAPA 4: Finalizar produto
                const produtoFinalizado = await finalizarProduto(produtoId);
                if (!produtoFinalizado) {
                    throw new Error('Falha ao finalizar produto');
                }
                
                showNotification('Produto criado com sucesso!', 'success');
            }
            
            setTimeout(() => window.location.href = '/gestao-produtos.html', 2000);
        } catch (err) {
            console.error('❌ Erro durante criação/atualização:', err);
            showNotification(`Erro ao salvar produto: ${err.message}`, 'error');
        } finally {
            if (finishBtn) {
                finishBtn.textContent = originalText;
                finishBtn.disabled = false;
            }
            if (reviewLoading) reviewLoading.style.display = 'none';
        }
    }
}

// ======================== FUNÇÕES AUXILIARES ========================

// Função para fazer upload de imagem (usada na edição)
async function uploadImagem(file) {
    try {
        // Converter arquivo para base64
        const base64 = await fileToBase64(file);
        
        // Usar apiRequest para incluir autenticação
        const response = await apiRequest('/produtos/upload-imagem', {
            method: 'POST',
            body: JSON.stringify({ imagemBase64: base64 })
        });
        
        return response.url || response.imagemUrl;
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        throw error;
    }
}

// Função auxiliar para converter arquivo para base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ======================== SUPORTE PARA EDIÇÃO ========================

// Verificar se o produto existe antes de carregar
async function verificarProdutoExiste(productId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            return false;
        }
        
        const response = await fetch(`${window.API_BASE}/produtos/${productId}`, {
            method: 'HEAD', // Usar HEAD para verificar se existe sem carregar dados
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('❌ Erro ao verificar se produto existe:', error);
        return false;
    }
}

// Suporte para edição de produto
async function carregarProdutoParaEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    editId = urlParams.get('edit');
    if (!editId) {
        return;
    }
    
    
    // Validar ID do produto
    if (!editId || editId.trim() === '') {
        console.error('❌ ID do produto inválido ou vazio');
        showNotification('ID do produto inválido. Retornando à página de gestão.', 'error');
        setTimeout(() => {
            window.location.href = 'gestao-produtos.html';
        }, 2000);
        return;
    }
    
    // Verificar se o produto existe antes de tentar carregar
    const produtoExiste = await verificarProdutoExiste(editId);
    
    if (!produtoExiste) {
        console.error('❌ Produto não encontrado com ID:', editId);
        showNotification(`Produto não encontrado (ID: ${editId}). O produto pode ter sido excluído ou o ID está incorreto. Retornando à página de gestão.`, 'error');
        setTimeout(() => {
            window.location.href = 'gestao-produtos.html';
        }, 3000);
        return;
    }
    
    
    editMode = true;
    try {
        const produto = await apiRequest(`/produtos/${editId}`);
        productData = { ...produto };
        
        // Etapa 1
        if (produto.tipo === 'Curso Online') {
            selectProductType('curso');
        } else {
            selectProductType('ebook');
        }
        
        // Bloquear seleção de tipo
        document.querySelectorAll('.product-type-card').forEach(card => {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.6';
        });
        
        // Etapa 2
        document.getElementById('productName').value = produto.nome || '';
        document.getElementById('productCategory').value = produto.categoria || '';
        document.getElementById('productDescription').value = produto.descricao || '';
        document.getElementById('productPrice').value = produto.preco || '';
        document.getElementById('productDiscount').value = produto.desconto || 0;
        calculateFinalPrice();
        document.getElementById('finalPrice').value = `MZN ${(produto.preco_com_desconto || produto.preco).toFixed(2)}`;
        document.getElementById('couponCode').value = produto.cupom || '';
        document.getElementById('allowAffiliates').checked = !!produto.afiliado;
        
        // Configurar campo de imagem
        if (produto.imagem_url) {
            document.getElementById('productImageUrl').value = produto.imagem_url;
            
            // Adicionar visualização da imagem se não existir
            const imagePreviewContainer = document.querySelector('.input-group:has(#productImageUrl)');
            if (imagePreviewContainer && !document.getElementById('imagePreview')) {
                const previewDiv = document.createElement('div');
                previewDiv.id = 'imagePreview';
                previewDiv.style.marginTop = '10px';
                previewDiv.style.textAlign = 'center';
                
                // Usar a nova rota de imagem para exibição
                const produtoId = produto.custom_id || produto.id;
                previewDiv.innerHTML = `<img src="${window.API_BASE}/produtos/imagem/${produtoId}" alt="Imagem do produto" style="max-width: 200px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">`;
                
                imagePreviewContainer.appendChild(previewDiv);
            }
        }
        
        // Etapa 3
        if (produto.tipo === 'Curso Online') {
            document.getElementById('courseContentUrl').value = produto.link_conteudo || '';
        } else {
            document.getElementById('ebookContentUrl').value = produto.link_conteudo || '';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar produto para edição:', error);
        
        if (error.message.includes('404') || error.message.includes('não encontrado')) {
            showNotification(`Produto não encontrado (ID: ${editId}). O produto pode ter sido excluído ou o ID está incorreto. Retornando à página de gestão.`, 'error');
            setTimeout(() => {
                window.location.href = 'gestao-produtos.html';
            }, 3000);
        } else {
            showNotification('Erro ao carregar produto para edição. Verifique sua conexão e tente novamente.', 'error');
        }
    }
}

// Inicializar eventos ao carregar
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.product-type-card').forEach(card => {
        card.addEventListener('click', () => {
            selectProductType(card.getAttribute('data-type'));
        });
    });

    document.getElementById('productPrice')?.addEventListener('input', calculateFinalPrice);
    document.getElementById('productDiscount')?.addEventListener('input', calculateFinalPrice);

    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.addEventListener('click', nextStep);
    });

    document.querySelectorAll('.btn-prev').forEach(btn => {
        btn.addEventListener('click', prevStep);
    });

    document.querySelector('.btn-finish')?.addEventListener('click', finishProduct);

    carregarProdutoParaEdicao();

});

 