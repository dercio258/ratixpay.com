// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Estado da aplicação
let isEditMode = false;
let produtoId = null;

// Elementos DOM
const form = document.getElementById('produto-form');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const btnSalvar = document.getElementById('btn-salvar');
const loadingOverlay = document.getElementById('loading-overlay');

// Campos do formulário
const campos = {
    nome: document.getElementById('nome'),
    tipo: document.getElementById('tipo'),
    categoria: document.getElementById('categoria'),
    preco: document.getElementById('preco'),
    descricao: document.getElementById('descricao'),
    imagem: document.getElementById('imagem'),
    linkConteudo: document.getElementById('linkConteudo'),
    desconto: document.getElementById('desconto'),
    cupom: document.getElementById('cupom'),
    ativo: document.getElementById('ativo'),
    afiliado: document.getElementById('afiliado'),
    disponivelMarketplace: document.getElementById('disponivelMarketplace'),
    orderBumpAtivo: document.getElementById('orderBumpAtivo'),
    orderBumpProdutosGroup: document.getElementById('orderBumpProdutosGroup'),
    orderBumpProdutosContainer: document.getElementById('orderBumpProdutosContainer')
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    verificarModoEdicao();
    configurarEventos();
    configurarValidacaoURL();
    configurarOrderBumpUI();
});

// Verificar se está em modo de edição
function verificarModoEdicao() {
    const urlParams = new URLSearchParams(window.location.search);
    produtoId = urlParams.get('id');
    
    if (produtoId) {
        isEditMode = true;
        pageTitle.textContent = 'Editar Produto';
        pageSubtitle.textContent = 'Atualize as informações do produto';
        btnSalvar.innerHTML = '<span>💾</span><span>Atualizar Produto</span>';
        carregarProduto(produtoId);
    }
}

// Configurar eventos
function configurarEventos() {
    form.addEventListener('submit', handleSubmit);
    
    // Validação em tempo real
    Object.keys(campos).forEach(campo => {
        if (campos[campo] && campos[campo].type !== 'checkbox') {
            campos[campo].addEventListener('blur', () => validarCampo(campo));
            campos[campo].addEventListener('input', () => limparErro(campo));
        }
    });
}

// Configurar validação de URL
function configurarValidacaoURL() {
    campos.imagem.addEventListener('input', debounce(() => validarImagemURL(), 500));
    campos.linkConteudo.addEventListener('input', debounce(() => validarConteudoURL(), 500));
}

// Debounce function
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

// Carregar produto para edição
async function carregarProduto(id) {
    try {
        mostrarLoading(true);
        
        const response = await fetch(`${window.API_BASE}/produtos/${id}`, {
            credentials: 'include', // Importante para permitir cookies de sessão
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        const produto = await response.json();
        
        if (response.ok) {
            preencherFormulario(produto);
        } else {
            mostrarErro('Produto não encontrado');
            setTimeout(() => {
                window.location.href = 'gestao-produtos.html';
            }, 2000);
        }
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        mostrarErro('Erro ao carregar produto');
    } finally {
        mostrarLoading(false);
    }
}

// Preencher formulário com dados do produto
function preencherFormulario(produto) {
    campos.nome.value = produto.nome || '';
    campos.tipo.value = produto.tipo || '';
    campos.categoria.value = produto.categoria || '';
    campos.preco.value = produto.preco || '';
    campos.descricao.value = produto.descricao || '';
    campos.imagem.value = produto.imagem || '';
    campos.linkConteudo.value = produto.linkConteudo || '';
    campos.desconto.value = produto.desconto || 0;
    campos.cupom.value = produto.cupom || '';
    campos.ativo.checked = produto.ativo !== false;
    campos.afiliado.checked = produto.afiliado === true;
    campos.disponivelMarketplace.checked = produto.disponivelMarketplace === true;
    
    // Validar URLs após preencher
    if (produto.imagem) validarImagemURL();
    if (produto.linkConteudo) validarConteudoURL();

    // Preencher configuração de Order Bump se existir
    if (produto.order_bump_ativo) {
        campos.orderBumpAtivo.checked = true;
        campos.orderBumpProdutosGroup.style.display = 'block';
        // Carregar lista e marcar selecionados
        carregarProdutosVendedorEPreencher(produto);
    }
}

// Handle submit do formulário
async function handleSubmit(e) {
    e.preventDefault();
    
    if (!validarFormulario()) {
        return;
    }
    
    const dadosProduto = coletarDadosFormulario();
    
    try {
        mostrarLoading(true);
        
        const url = isEditMode ? `${window.API_BASE}/produtos/${produtoId}` : `${window.API_BASE}/produtos`;
        const method = isEditMode ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dadosProduto)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarSucesso(data.mensagem);
            setTimeout(() => {
                window.location.href = 'gestao-produtos.html';
            }, 1500);
        } else {
            if (data.detalhes && Array.isArray(data.detalhes)) {
                data.detalhes.forEach(erro => mostrarErro(erro));
            } else {
                mostrarErro(data.erro || 'Erro ao salvar produto');
            }
        }
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        mostrarErro('Erro de conexão com o servidor');
    } finally {
        mostrarLoading(false);
    }
}

// Coletar dados do formulário
function coletarDadosFormulario() {
    return {
        nome: campos.nome.value.trim(),
        tipo: campos.tipo.value,
        categoria: campos.categoria.value.trim(),
        preco: parseFloat(campos.preco.value),
        descricao: campos.descricao.value.trim(),
        imagem: campos.imagem.value.trim(),
        linkConteudo: campos.linkConteudo.value.trim(),
        desconto: parseFloat(campos.desconto.value) || 0,
        cupom: campos.cupom.value.trim().toUpperCase(),
        ativo: campos.ativo.checked,
        afiliado: campos.afiliado.checked,
        disponivelMarketplace: campos.disponivelMarketplace.checked,
        // Campos de Order Bump
        order_bump_ativo: !!campos.orderBumpAtivo.checked,
        order_bump_produtos: obterProdutosOrderBumpSelecionados()
    };
}

// Configurar UI de Order Bump
function configurarOrderBumpUI() {
    if (!campos.orderBumpAtivo) return;
    campos.orderBumpAtivo.addEventListener('change', () => {
        const ativo = campos.orderBumpAtivo.checked;
        campos.orderBumpProdutosGroup.style.display = ativo ? 'block' : 'none';
        if (ativo) carregarProdutosVendedor();
    });
}

async function carregarProdutosVendedor() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) return;
        const resp = await fetch(`${window.API_BASE}/produtos?ativo=true&limite=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const lista = Array.isArray(data.data) ? data.data : [];
        renderizarListaOrderBump(lista);
    } catch (e) {
        console.warn('Falha ao carregar produtos do vendedor para Order Bump');
    }
}

async function carregarProdutosVendedorEPreencher(produto) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) return;
        const resp = await fetch(`${window.API_BASE}/produtos?ativo=true&limite=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const lista = Array.isArray(data.data) ? data.data : [];
        renderizarListaOrderBump(lista, produto.order_bump_produtos || []);
    } catch (e) {
        console.warn('Falha ao carregar produtos do vendedor para Order Bump');
    }
}

function renderizarListaOrderBump(produtos, selecionados = []) {
    if (!campos.orderBumpProdutosContainer) return;
    const selecionadosIds = new Set(
        (Array.isArray(selecionados) ? selecionados : []).map(p => p.id || p.custom_id || p.public_id)
    );
    campos.orderBumpProdutosContainer.innerHTML = '';
    let count = 0;
    produtos.forEach(p => {
        // Não permitir selecionar o próprio produto (quando em edição)
        const idComparar = p.id || p.custom_id || p.public_id;
        const wrapper = document.createElement('div');
        wrapper.className = 'checkbox-item';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = p.id;
        input.id = `ob_${p.id}`;
        if (selecionadosIds.has(idComparar)) input.checked = true;
        input.addEventListener('change', limitarSelecaoMaxima);
        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.textContent = `${p.nome} — MZN ${Number(p.preco || 0).toFixed(2)}`;
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        campos.orderBumpProdutosContainer.appendChild(wrapper);
        count++;
    });
}

function limitarSelecaoMaxima() {
    const marcados = campos.orderBumpProdutosContainer.querySelectorAll('input[type="checkbox"]:checked');
    if (marcados.length > 3) {
        this.checked = false;
        alert('Você pode selecionar no máximo 3 produtos complementares.');
    }
}

function obterProdutosOrderBumpSelecionados() {
    if (!campos.orderBumpAtivo.checked) return [];
    const marcados = campos.orderBumpProdutosContainer ? campos.orderBumpProdutosContainer.querySelectorAll('input[type="checkbox"]:checked') : [];
    const selecionados = [];
    marcados.forEach(input => {
        selecionados.push({ id: input.value });
    });
    return selecionados;
}

// Validar formulário completo
function validarFormulario() {
    let isValid = true;
    
    // Validar campos obrigatórios
    const camposObrigatorios = ['nome', 'tipo', 'categoria', 'preco', 'descricao', 'imagem', 'linkConteudo'];
    
    camposObrigatorios.forEach(campo => {
        if (!validarCampo(campo)) {
            isValid = false;
        }
    });
    
    return isValid;
}

// Validar campo individual
function validarCampo(nomeCampo) {
    const campo = campos[nomeCampo];
    const valor = campo.value.trim();
    let isValid = true;
    let mensagem = '';
    
    // Validações específicas por campo
    switch (nomeCampo) {
        case 'nome':
            if (!valor) {
                mensagem = 'Nome do produto é obrigatório';
                isValid = false;
            } else if (valor.length < 3) {
                mensagem = 'Nome deve ter pelo menos 3 caracteres';
                isValid = false;
            }
            break;
            
        case 'tipo':
            if (!valor) {
                mensagem = 'Tipo do produto é obrigatório';
                isValid = false;
            }
            break;
            
        case 'categoria':
            if (!valor) {
                mensagem = 'Categoria é obrigatória';
                isValid = false;
            }
            break;
            
        case 'preco':
            if (!valor || parseFloat(valor) <= 0) {
                mensagem = 'Preço deve ser maior que zero';
                isValid = false;
            }
            break;
            
        case 'descricao':
            if (!valor) {
                mensagem = 'Descrição é obrigatória';
                isValid = false;
            } else if (valor.length < 50) {
                const charsNeeded = 50 - valor.length;
                mensagem = `A descrição deve ter pelo menos 50 caracteres. Faltam ${charsNeeded} caractere${charsNeeded > 1 ? 's' : ''}.`;
                isValid = false;
            }
            break;
            
        case 'imagem':
            if (!valor) {
                mensagem = 'Link da imagem é obrigatório';
                isValid = false;
            } else if (!isValidURL(valor)) {
                mensagem = 'Link da imagem deve ser uma URL válida';
                isValid = false;
            } else if (!isImageURL(valor)) {
                mensagem = 'Link deve apontar para uma imagem (jpg, jpeg, png, gif, webp)';
                isValid = false;
            }
            break;
            
        case 'linkConteudo':
            if (!valor) {
                mensagem = 'Link do conteúdo é obrigatório';
                isValid = false;
            } else if (!isValidURL(valor)) {
                mensagem = 'Link do conteúdo deve ser uma URL válida';
                isValid = false;
            }
            break;
            
        case 'desconto':
            if (valor && (parseFloat(valor) < 0 || parseFloat(valor) > 100)) {
                mensagem = 'Desconto deve estar entre 0 e 100%';
                isValid = false;
            }
            break;
    }
    
    if (isValid) {
        limparErro(nomeCampo);
    } else {
        mostrarErroCampo(nomeCampo, mensagem);
    }
    
    return isValid;
}

// Validar URL da imagem
async function validarImagemURL() {
    const url = campos.imagem.value.trim();
    const preview = document.getElementById('imagem-preview');
    
    if (!url) {
        preview.style.display = 'none';
        return;
    }
    
    if (!isValidURL(url) || !isImageURL(url)) {
        preview.className = 'url-preview error';
        preview.innerHTML = '❌ URL de imagem inválida';
        preview.style.display = 'block';
        return;
    }
    
    try {
        preview.className = 'url-preview';
        preview.innerHTML = '⏳ Verificando imagem...';
        preview.style.display = 'block';
        
        const img = new Image();
        img.onload = () => {
            preview.className = 'url-preview success';
            preview.innerHTML = `✅ Imagem válida<br><img src="${url}" alt="Preview">`;
        };
        img.onerror = () => {
            preview.className = 'url-preview error';
            preview.innerHTML = '❌ Não foi possível carregar a imagem';
        };
        img.src = url;
    } catch (error) {
        preview.className = 'url-preview error';
        preview.innerHTML = '❌ Erro ao verificar imagem';
        preview.style.display = 'block';
    }
}

// Validar URL do conteúdo
async function validarConteudoURL() {
    const url = campos.linkConteudo.value.trim();
    const preview = document.getElementById('conteudo-preview');
    
    if (!url) {
        preview.style.display = 'none';
        return;
    }
    
    if (!isValidURL(url)) {
        preview.className = 'url-preview error';
        preview.innerHTML = '❌ URL inválida';
        preview.style.display = 'block';
        return;
    }
    
    preview.className = 'url-preview success';
    preview.innerHTML = '✅ URL válida';
    preview.style.display = 'block';
}

// Verificar se é URL válida
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Verificar se é URL de imagem
function isImageURL(url) {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

// Mostrar erro em campo específico
function mostrarErroCampo(nomeCampo, mensagem) {
    const errorElement = document.getElementById(`${nomeCampo}-error`);
    if (errorElement) {
        errorElement.textContent = mensagem;
        errorElement.style.display = 'block';
    }
    
    campos[nomeCampo].style.borderColor = '#e74c3c';
}

// Limpar erro de campo
function limparErro(nomeCampo) {
    const errorElement = document.getElementById(`${nomeCampo}-error`);
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    
    campos[nomeCampo].style.borderColor = '#e0e0e0';
}

// Mostrar loading
function mostrarLoading(mostrar) {
    loadingOverlay.style.display = mostrar ? 'flex' : 'none';
    btnSalvar.disabled = mostrar;
}

// Mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
    console.log('Sucesso:', mensagem);
    alert(mensagem); // Temporário - substituir por notificação mais elegante
}

// Mostrar mensagem de erro
function mostrarErro(mensagem) {
    console.error('Erro:', mensagem);
    alert(mensagem); // Temporário - substituir por notificação mais elegante
}

// Função para mostrar ferramentas (compatibilidade com menu)
function showTools() {
    window.location.href = 'dashboard.html#tools';
}

