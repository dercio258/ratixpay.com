/**
 * Página de Produtos do Afiliado
 * Gerencia exibição de produtos e geração de links de afiliado
 */

// Configurações
const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:4000/api' 
    : `${window.location.origin}/api`;

// Variáveis globais
let afiliado = null;
let produtos = [];
let linkAtual = '';

// Carregar dados iniciais
async function carregarDados() {
    try {
        console.log('🚀 Carregando dados do afiliado...');
        mostrarLoading(true);
        
        // Verificar autenticação usando o utilitário
        if (!window.afiliadoAuth || !window.afiliadoAuth.isAuthenticated()) {
            window.location.href = '/afiliado-login.html';
            return;
        }
        
        // Verificar e atualizar token se necessário
        const verification = await window.afiliadoAuth.verifyToken();
        if (!verification.valid) {
            window.location.href = '/afiliado-login.html';
            return;
        }
        
        // Carregar dados do afiliado
        afiliado = window.afiliadoAuth.getAfiliadoData() || verification.afiliado;
        const nomeElement = document.getElementById('afiliadoNome');
        if (nomeElement) {
            nomeElement.textContent = afiliado.nome;
        }
        
        await carregarProdutos();
        mostrarLoading(false);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados: ' + error.message, 'danger');
        mostrarLoading(false);
    }
}

// Carregar produtos
async function carregarProdutos() {
    try {
        console.log('🔄 Carregando produtos...');
        
        // Tentar rota específica para afiliados primeiro
        let response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/produtos/afiliados`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        // Se não encontrar, usar rota pública
        if (!response.ok && response.status === 404) {
            response = await fetch(`${API_BASE}/produtos/public`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        if (response.ok) {
            const data = await response.json();
            produtos = data.data || data.produtos || [];
            console.log('✅ Produtos carregados:', produtos.length);
            
            if (produtos.length > 0) {
                renderizarProdutos();
                // Aplicar fallback de imagens após renderizar
                setTimeout(() => {
                    aplicarFallbackImagens();
                }, 100);
            } else {
                mostrarEmptyState();
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('⚠️ Erro ao carregar produtos:', response.status, errorData);
            produtos = [];
            mostrarEmptyState();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        produtos = [];
        mostrarEmptyState();
    }
}

// Renderizar produtos
function renderizarProdutos() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!grid) return;
    
    if (produtos.length === 0) {
        mostrarEmptyState();
        return;
    }
    
    grid.innerHTML = produtos.map(produto => {
        const comissao = (parseFloat(produto.preco || 0) * (afiliado.comissao_percentual / 100)).toFixed(2);
        
        // Construir URL da imagem usando a rota da API
        let imagemUrl = '';
        if (produto.custom_id) {
            imagemUrl = `${API_BASE}/produtos/imagem/${produto.custom_id}`;
        } else if (produto.imagem_url) {
            imagemUrl = produto.imagem_url.startsWith('http') 
                ? produto.imagem_url 
                : `${API_BASE}/produtos/imagem/${produto.custom_id || produto.id}`;
        } else if (produto.imagem) {
            imagemUrl = produto.imagem.startsWith('http') 
                ? produto.imagem 
                : `${API_BASE}/produtos/imagem/${produto.custom_id || produto.id}`;
        }
        
        const tipo = produto.tipo || 'Digital';
        const categoria = produto.categoria || 'Geral';
        const descricao = produto.descricao || 'Produto digital de alta qualidade';
        
        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="product-card">
                    <div class="product-image" style="background-image: ${imagemUrl ? `url('${imagemUrl}')` : 'none'}; background-size: cover; background-position: center;">
                        ${imagemUrl ? '' : '<div class="product-image-placeholder"><i class="fas fa-box"></i></div>'}
                    </div>
                    <div class="product-category">${escapeHtml(categoria)}</div>
                    <div class="product-type">${escapeHtml(tipo)}</div>
                    <h3 class="product-title">${escapeHtml(produto.nome)}</h3>
                    <button class="btn btn-ver-descricao" onclick="mostrarDescricao('${escapeHtml(produto.nome)}', '${escapeHtml(descricao).replace(/'/g, "\\'")}')">
                        <i class="fas fa-info-circle"></i> Ver Descrição
                    </button>
                    <div class="product-price">MZN ${parseFloat(produto.preco || 0).toFixed(2)}</div>
                    <div class="product-commission">
                        <i class="fas fa-percentage"></i> Sua comissão: MZN ${comissao}
                    </div>
                    <button class="btn btn-generate-link" onclick="gerarLinkAfiliado('${produto.id}', '${escapeHtml(produto.nome).replace(/'/g, "\\'")}', '${produto.preco || 0}')">
                        <i class="fas fa-link"></i> Gerar Link de Afiliado
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    if (emptyState) emptyState.style.display = 'none';
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mostrar estado vazio
function mostrarEmptyState() {
    const grid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (grid) grid.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
}

// Gerar link de afiliado
async function gerarLinkAfiliado(produtoId, produtoNome, preco) {
    try {
        mostrarNotificacao('Gerando link de afiliado...', 'info');
        
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/gerar-link`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    produto_id: produtoId,
                    produto_nome: produtoNome,
                    preco: preco
                })
            }
        );

        if (response.ok) {
            const data = await response.json();
            linkAtual = data.link_afiliado;
            
            // Mostrar modal
            const modalProdutoNome = document.getElementById('modalProdutoNome');
            const modalLinkAfiliado = document.getElementById('modalLinkAfiliado');
            const modalComissao = document.getElementById('modalComissao');
            
            if (modalProdutoNome) modalProdutoNome.textContent = produtoNome;
            if (modalLinkAfiliado) modalLinkAfiliado.textContent = linkAtual;
            if (modalComissao) modalComissao.textContent = `MZN ${(parseFloat(preco) * (afiliado.comissao_percentual / 100)).toFixed(2)}`;
            
            const modalElement = document.getElementById('linkModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
            
            mostrarNotificacao('Link gerado com sucesso!', 'success');
        } else {
            const errorData = await response.json().catch(() => ({}));
            mostrarNotificacao('Erro ao gerar link: ' + (errorData.message || 'Erro desconhecido'), 'danger');
        }
        
    } catch (error) {
        console.error('❌ Erro ao gerar link:', error);
        mostrarNotificacao('Erro ao gerar link: ' + error.message, 'danger');
    }
}

// Copiar link do modal
function copiarLinkModal() {
    if (linkAtual) {
        navigator.clipboard.writeText(linkAtual).then(() => {
            mostrarNotificacao('Link copiado para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            mostrarNotificacao('Erro ao copiar link. Tente selecionar e copiar manualmente.', 'danger');
        });
    }
}

// Mostrar descrição do produto
function mostrarDescricao(nomeProduto, descricao) {
    const modalDescricaoProdutoNome = document.getElementById('modalDescricaoProdutoNome');
    const modalDescricaoConteudo = document.getElementById('modalDescricaoConteudo');
    
    if (modalDescricaoProdutoNome) modalDescricaoProdutoNome.textContent = nomeProduto;
    if (modalDescricaoConteudo) modalDescricaoConteudo.innerHTML = descricao;
    
    const modalElement = document.getElementById('descricaoModal');
    if (modalElement) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    }
}

// Função para fallback de imagens
function aplicarFallbackImagens() {
    const productImages = document.querySelectorAll('.product-image');
    productImages.forEach(img => {
        const style = img.style.backgroundImage;
        if (style && style !== 'none') {
            const url = style.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (url && url[1]) {
                const imgElement = new Image();
                imgElement.onerror = function() {
                    console.log('Imagem falhou, usando fallback:', url[1]);
                    img.style.backgroundImage = 'url("https://via.placeholder.com/300x200/cccccc/666666?text=Produto")';
                    const placeholder = img.querySelector('.product-image-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                };
                imgElement.onload = function() {
                    const placeholder = img.querySelector('.product-image-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                };
                imgElement.src = url[1];
            }
        }
    });
}

// Mostrar loading
function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
}

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacao.style.position = 'fixed';
    notificacao.style.top = '20px';
    notificacao.style.right = '20px';
    notificacao.style.zIndex = '9999';
    notificacao.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        if (notificacao.parentNode) {
            notificacao.parentNode.removeChild(notificacao);
        }
    }, 5000);
}

// Logout
function logout() {
    if (window.afiliadoAuth) {
        window.afiliadoAuth.logout();
    } else {
        localStorage.removeItem('afiliado_token');
        localStorage.removeItem('afiliado_data');
        localStorage.removeItem('afiliado_refresh_token');
        sessionStorage.removeItem('afiliado_token');
        sessionStorage.removeItem('afiliado_data');
        sessionStorage.removeItem('afiliado_refresh_token');
        window.location.href = '/afiliado-login.html';
    }
}

// Inicializar página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de produtos...');
    carregarDados();
});

