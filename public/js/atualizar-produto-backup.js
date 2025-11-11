// Configuração da API
if (typeof window.API_BASE === 'undefined') {
    window.API_BASE = 'http://localhost:3000/api';
    console.log('🔧 API_BASE definida como:', window.API_BASE);
}

// Estado do produto
let productData = {};
let productId = null;

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
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
    
    // URL da imagem
    document.getElementById('imageUrl').addEventListener('input', handleImageUrl);
    
    // Cálculo de preço
    document.getElementById('productPrice').addEventListener('input', calculateFinalPrice);
    
    // Submissão do formulário
    document.getElementById('updateProductForm').addEventListener('submit', handleUpdateProduct);
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
        console.log('🌐 API Base URL:', window.API_BASE);
        console.log('🔗 URL completa:', `${window.API_BASE}/produtos/${productId}`);
        
        // Verificar se o produto existe
        const produtoExiste = await verificarProdutoExiste(productId);
        if (!produtoExiste) {
            console.log('⚠️ Produto não encontrado com ID direto, tentando estratégias alternativas...');
            
            // Tentar buscar por custom_id ou outros identificadores
            const produtoAlternativo = await buscarProdutoAlternativo(productId);
            if (produtoAlternativo) {
                console.log('✅ Produto encontrado com estratégia alternativa:', produtoAlternativo);
                fillForm(produtoAlternativo);
                showLoading(false);
                document.getElementById('updateProductForm').style.display = 'block';
                return;
            }
            
            showError(`Produto não encontrado (ID: ${productId}). O produto pode ter sido excluído.`);
            setTimeout(() => {
                window.location.href = 'gestao-produtos.html';
            }, 3000);
            return;
        }
        
        // Carregar dados do produto
        console.log('📥 Carregando dados completos do produto...');
        const produto = await apiRequest(`/produtos/${productId}`);
        
        console.log('📥 Dados recebidos:', produto);
        
        // Preencher formulário
        fillForm(produto);
        
        showLoading(false);
        document.getElementById('updateProductForm').style.display = 'block';
        
    } catch (error) {
        console.error('❌ Erro ao carregar produto:', error);
        showError('Erro ao carregar dados do produto: ' + error.message);
        showLoading(false);
    }
}

// Buscar produto usando estratégias alternativas
async function buscarProdutoAlternativo(productId) {
    try {
        console.log('🔍 Tentando estratégias alternativas para ID:', productId);
        
        // Estratégia 1: Buscar todos os produtos e filtrar por custom_id
        console.log('📋 Estratégia 1: Buscando todos os produtos...');
        const response = await apiRequest('/produtos');
        const todosProdutos = response.data || response || [];
        
        console.log('📊 Total de produtos encontrados:', todosProdutos.length);
        console.log('📋 Lista de produtos disponíveis:');
        
        if (Array.isArray(todosProdutos)) {
            todosProdutos.forEach((produto, index) => {
                console.log(`${index + 1}. ID: ${produto.id}, Custom ID: ${produto.custom_id || produto.customId || 'N/A'}, Nome: ${produto.nome || 'N/A'}`);
            });
        } else {
            console.log('⚠️ Resposta não é um array:', todosProdutos);
        }
        
        if (Array.isArray(todosProdutos)) {
            // Procurar por custom_id
            const produtoPorCustomId = todosProdutos.find(p => 
                p.custom_id === productId || 
                p.customId === productId ||
                p.id === productId
            );
            
            if (produtoPorCustomId) {
                console.log('✅ Produto encontrado por custom_id:', produtoPorCustomId);
                return produtoPorCustomId;
            }
            
            // Procurar por nome (caso o ID seja na verdade um nome)
            const produtoPorNome = todosProdutos.find(p => 
                p.nome && p.nome.toLowerCase().includes(productId.toLowerCase())
            );
            
            if (produtoPorNome) {
                console.log('✅ Produto encontrado por nome:', produtoPorNome);
                return produtoPorNome;
            }
        }
        
        // Estratégia 2: Tentar diferentes formatos de ID
        console.log('🔍 Estratégia 2: Tentando diferentes formatos de ID...');
        const formatosId = [
            productId,
            productId.replace(/-/g, ''),
            productId.toUpperCase(),
            productId.toLowerCase()
        ];
        
        for (const formatoId of formatosId) {
            try {
                const produto = await apiRequest(`/produtos/${formatoId}`);
                if (produto) {
                    console.log('✅ Produto encontrado com formato de ID:', formatoId);
                    return produto;
                }
            } catch (error) {
                console.log('❌ Formato de ID falhou:', formatoId, error.message);
            }
        }
        
        console.log('❌ Nenhuma estratégia alternativa funcionou');
        return null;
        
    } catch (error) {
        console.error('❌ Erro ao buscar produto alternativo:', error);
        return null;
    }
}

// Verificar se o produto existe
async function verificarProdutoExiste(productId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        console.log('🔐 Token encontrado:', !!token);
        console.log('🔍 Verificando existência do produto:', productId);
        
        if (!token) {
            console.error('❌ Token não encontrado');
            return false;
        }
        
        const url = `${window.API_BASE}/produtos/${productId}`;
        console.log('🌐 Fazendo requisição HEAD para:', url);
        
        const response = await fetch(url, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Resposta da verificação:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            url: response.url
        });
        
        return response.ok;
    } catch (error) {
        console.error('❌ Erro ao verificar se produto existe:', error);
        return false;
    }
}

// Preencher formulário com dados do produto
function fillForm(produto) {
    // Tipo
    document.getElementById('productType').value = produto.tipo === 'Curso Online' ? 'curso' : 'ebook';
    
    // Categoria
    document.getElementById('productCategory').value = produto.categoria || '';
    
    // Nome
    document.getElementById('productName').value = produto.nome || '';
    
    // Descrição
    document.getElementById('productDescription').value = produto.descricao || '';
    
    // Preço
    document.getElementById('productPrice').value = produto.preco || 0;
    
    // Marketplace
    document.getElementById('marketPlace').checked = produto.market_place || produto.disponivelMarketplace || false;
    
    // Imagem
    if (produto.imagem || produto.imagem_url) {
        const imageUrl = produto.imagem || produto.imagem_url;
        document.getElementById('imagePreview').src = imageUrl;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('noImageText').style.display = 'none';
        document.getElementById('imageUrl').value = imageUrl;
    }
    
    // Conteúdo
    document.getElementById('contentUrl').value = produto.linkConteudo || produto.link_conteudo || '';
    
    // Calcular preço final
    calculateFinalPrice();
    
    // Armazenar dados originais
    productData = { ...produto };
    
    console.log('✅ Formulário preenchido com dados do produto');
}

// Calcular preço final
function calculateFinalPrice() {
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    document.getElementById('finalPrice').value = `MZN ${price.toFixed(2)}`;
}

// Upload de imagem
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('noImageText').style.display = 'none';
            document.getElementById('imageUrl').value = '';
        };
        reader.readAsDataURL(file);
    }
}

// URL da imagem
function handleImageUrl(event) {
    const url = event.target.value;
    if (url) {
        document.getElementById('imagePreview').src = url;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('noImageText').style.display = 'none';
        document.getElementById('imageUpload').value = '';
    }
}

// Atualizar produto
async function handleUpdateProduct(event) {
    event.preventDefault();
    
    try {
        showLoading(true);
        hideMessages();
        
        // Coletar dados do formulário
        const formData = {
            nome: document.getElementById('productName').value,
            tipo: document.getElementById('productType').value === 'curso' ? 'Curso Online' : 'eBook',
            categoria: document.getElementById('productCategory').value,
            descricao: document.getElementById('productDescription').value,
            preco: parseFloat(document.getElementById('productPrice').value),
            market_place: document.getElementById('marketPlace').checked,
            linkConteudo: document.getElementById('contentUrl').value
        };
        
        // Processar imagem
        const imageFile = document.getElementById('imageUpload').files[0];
        const imageUrl = document.getElementById('imageUrl').value;
        
        if (imageFile) {
            // Se há arquivo selecionado, fazer upload
            formData.imagem = await uploadImage(imageFile);
        } else if (imageUrl) {
            // Se há URL, usar a URL
            formData.imagem = imageUrl;
        } else if (productData.imagem || productData.imagem_url) {
            // Manter imagem atual
            formData.imagem = productData.imagem || productData.imagem_url;
        }
        
        console.log('📤 Dados para atualização:', formData);
        
        // Atualizar produto
        const response = await apiRequest(`/produtos/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(formData)
        });
        
        console.log('✅ Produto atualizado:', response);
        
        showSuccess('Produto atualizado com sucesso!');
        
        // Redirecionar após 2 segundos
        setTimeout(() => {
            window.location.href = 'gestao-produtos.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar produto:', error);
        showError('Erro ao atualizar produto: ' + error.message);
        showLoading(false);
    }
}

// Upload de imagem
async function uploadImage(file) {
    try {
        const formData = new FormData();
        formData.append('imagem', file);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        const response = await fetch(`${window.API_BASE}/upload/imagem`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Erro ao fazer upload da imagem');
        }
        
        const result = await response.json();
        return result.url || result.imagem;
        
    } catch (error) {
        console.error('❌ Erro no upload da imagem:', error);
        throw error;
    }
}

// Função para fazer requisições à API
async function apiRequest(endpoint, options = {}) {
    try {
        // Verificar se API_BASE está definida
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
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('updateProductForm').style.display = show ? 'none' : 'block';
}

// Mostrar erro
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Mostrar sucesso
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Ocultar mensagens
function hideMessages() {
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('successMessage').style.display = 'none';
}
