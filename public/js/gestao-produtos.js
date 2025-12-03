// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Estado da aplicação
let produtos = [];
let produtoParaExcluir = null;
let usuarioAtual = null;
let confirmationText = '';

// Elementos DOM
const loadingElement = document.getElementById('loading');
const produtosContainer = document.getElementById('produtos-container');
const emptyState = document.getElementById('empty-state');
const modalConfirmacao = document.getElementById('modal-confirmacao');
const modalMensagem = document.getElementById('modal-mensagem');
const btnConfirmar = document.getElementById('btn-confirmar');
const btnCancelar = document.getElementById('btn-cancelar');

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    // Primeiro verificar autenticação
    if (!await verificarAutenticacao()) {
        return;
    }
    
    // Depois obter dados do usuário
    await obterUsuarioAtual();
    
    // Só então carregar produtos do usuário autenticado
    await carregarProdutos();
    
    // Configurar eventos
    configurarEventos();
});

// Verificar autenticação antes de carregar a página
async function verificarAutenticacao() {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
    
    if (!token) {
        console.error('❌ Token não encontrado');
        mostrarErro('Usuário não autenticado. Redirecionando para login...');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return false;
    }
    
    // Verificar se o token é válido
    try {
        const response = await fetch(`${window.API_BASE}/auth/verify-token`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error('❌ Token inválido ou expirado');
            localStorage.removeItem('authToken');
            localStorage.removeItem('token');
            localStorage.removeItem('adminToken');
            mostrarErro('Sessão expirada. Redirecionando para login...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        mostrarErro('Erro de conexão. Verifique sua internet.');
        return false;
    }
}

// Configurar eventos
function configurarEventos() {
    if (btnCancelar) btnCancelar.addEventListener('click', fecharModal);
    if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarAcao);
    
    // Configurar validação do campo de confirmação
    const confirmationInput = document.getElementById('confirmation-text');
    if (confirmationInput) {
        confirmationInput.addEventListener('input', validarTextoConfirmacao);
        confirmationInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && btnConfirmar && !btnConfirmar.disabled) {
                confirmarAcao();
            }
        });
    }
    
    // Fechar modal clicando fora
    if (modalConfirmacao) {
        modalConfirmacao.addEventListener('click', function(e) {
            if (e.target === modalConfirmacao) {
                fecharModal();
            }
        });
    }
}

// Obter informações do usuário atual
async function obterUsuarioAtual() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            console.error('Token não encontrado');
            return;
        }
        
        const response = await fetch(`${window.API_BASE}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.user) {
                usuarioAtual = data.user;
            } else {
                console.error('❌ Erro ao obter informações do usuário: dados inválidos');
                console.error('❌ data.success:', data.success);
                console.error('❌ data.user:', data.user);
            }
        } else {
            console.error('❌ Erro ao obter informações do usuário:', response.status);
            const errorData = await response.json();
            console.error('❌ Detalhes do erro:', errorData);
        }
    } catch (error) {
        console.error('Erro ao obter usuário atual:', error);
    }
}

// Carregar produtos da API - APENAS do usuário autenticado
async function carregarProdutos() {
    try {
        mostrarLoading(true);
        
        // Verificar se o usuário foi carregado
        
        if (!usuarioAtual || !usuarioAtual.id) {
            console.error('❌ Usuário não carregado');
            console.error('❌ usuarioAtual:', usuarioAtual);
            console.error('❌ usuarioAtual.id:', usuarioAtual?.id);
            mostrarErro('Erro ao carregar dados do usuário. Recarregue a página.');
            return;
        }
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            console.error('❌ Token não encontrado');
            mostrarErro('Usuário não autenticado. Faça login novamente.');
            return;
        }
        
        // SEMPRE usar a rota que filtra por usuário - NUNCA mostrar produtos de outros usuários
        const endpoint = `${window.API_BASE}/produtos?limite=100`;
        
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            console.error('❌ Token inválido ou expirado');
            mostrarErro('Sessão expirada. Redirecionando para login...');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        if (response.status === 403) {
            console.error('❌ Acesso negado');
            mostrarErro('Acesso negado. Verifique suas permissões.');
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            // A API retorna { data: produtos } ou { produtos: produtos }
            produtos = data.data || data.produtos || [];
            
            // VERIFICAÇÃO ADICIONAL: Garantir que todos os produtos pertencem ao usuário atual
            const produtosDoUsuario = produtos.filter(produto => {
                const pertenceAoUsuario = produto.vendedor_id === usuarioAtual.id;
                if (!pertenceAoUsuario) {
                    console.warn('⚠️ Produto de outro usuário detectado:', produto.id, 'Vendedor:', produto.vendedor_id, 'Usuário atual:', usuarioAtual.id);
                }
                return pertenceAoUsuario;
            });
            
            produtos = produtosDoUsuario;
            
            
            renderizarProdutos();
        } else {
            console.error('❌ Erro ao carregar produtos:', data.erro);
            mostrarErro('Erro ao carregar produtos: ' + (data.erro || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('❌ Erro na requisição:', error);
        mostrarErro('Erro de conexão com o servidor');
    } finally {
        mostrarLoading(false);
    }
}

// Renderizar produtos na tela
function renderizarProdutos() {
    if (produtos.length === 0) {
        produtosContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    produtosContainer.style.display = 'block';
    emptyState.style.display = 'none';
    
    // Adicionar barra de busca apenas uma vez
    if (!document.getElementById('searchProdutos')) {
        adicionarBarraBusca();
    }
    
    produtosContainer.innerHTML = produtos.map(produto => criarCardProduto(produto)).join('');

    // Seções Utmify agora ficam colapsadas por padrão - usuário precisa clicar para expandir
    // Removido código que expandia automaticamente seções com configuração

    // Após renderizar, preparar os seletores de OB sob demanda (lazy)
}

// Adicionar barra de busca simples e eficiente
function adicionarBarraBusca() {
const searchBarHTML = `
<div class="search-container" style="margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
        <input type="text" id="searchProdutos" placeholder="Buscar produtos..." style="flex:1; padding: 10px; border-radius: 5px; border: 1px solid #ccc;">
        <button id="btnSearch" style="background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
            <i class="fas fa-search"></i>
        </button>
</div>`;
    
produtosContainer.insertAdjacentHTML('beforebegin', searchBarHTML);
    
    // Debounce para evitar muitas buscas
    let searchTimeout;
    document.getElementById('searchProdutos').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            filtrarProdutos();
        }, 300); // Aguarda 300ms após parar de digitar
    });
    
document.getElementById('btnSearch').addEventListener('click', filtrarProdutos);
}

// Função de filtro otimizada
function filtrarProdutos() {
    const termo = document.getElementById('searchProdutos').value.toLowerCase().trim();
    
    if (!termo) {
        // Se não há termo de busca, mostrar todos os produtos
        renderizarProdutos();
        return;
    }
    
    // Filtro otimizado - apenas uma passada pelos produtos
    const filtrados = produtos.filter(produto => {
        return (
            (produto.nome && produto.nome.toLowerCase().includes(termo)) ||
            (produto.custom_id && produto.custom_id.toLowerCase().includes(termo)) ||
            (produto.id && produto.id.toString().includes(termo))
        );
    });
    
    // Renderizar apenas os produtos filtrados
    renderizarProdutosFiltrados(filtrados);
}

// Renderizar produtos filtrados
function renderizarProdutosFiltrados(produtosParaRenderizar) {
    if (produtosParaRenderizar.length === 0) {
        produtosContainer.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-search" style="font-size: 48px; margin-bottom: 20px; opacity: 0.5;"></i>
                <h3>Nenhum produto encontrado</h3>
                <p>Não encontramos produtos que correspondam à sua busca.</p>
            </div>
        `;
        return;
    }
    
    produtosContainer.innerHTML = produtosParaRenderizar.map(produto => criarCardProduto(produto)).join('');
}

// Criar card de produto com design moderno
function criarCardProduto(produto) {
    const statusBadges = gerarStatusBadges(produto);
    const precoFormatado = formatarPreco(produto.preco);
    const precoComDesconto = produto.desconto > 0 ? formatarPreco(produto.precoComDesconto) : null;
    
    // Usar a nova rota de imagens
    let imagemUrl;
    if (produto.custom_id) {
        // Priorizar custom_id para buscar imagem
        imagemUrl = `${window.API_BASE}/produtos/imagem/${produto.custom_id}`;
    } else if (produto.id) {
        // Fallback para id numérico
        imagemUrl = `${window.API_BASE}/produtos/imagem/${produto.id}`;
    } else if (produto.imagemUrl) {
        imagemUrl = produto.imagemUrl;
    } else if (produto.imagem) {
        imagemUrl = produto.imagem;
    } else {
        imagemUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik00MCAyOEMzNy43OTA5IDI4IDM2IDI5Ljc5MDkgMzYgMzJWNDhDMzYgNTAuMjA5MSAzNy43OTA5IDUyIDQwIDUySDQ4QzUwLjIwOTEgNTIgNTIgNTAuMjA5MSA1MiA0OFY0OEM1MiA0NS43OTA5IDUwLjIwOTEgNDQgNDggNDRINDBDMzcuNzkwOSA0NCAzNiA0NS43OTA5IDM2IDQ4VjMyWiIgZmlsbD0iI0U5RUNFRiIvPgo8L3N2Zz4K';
    }
    
    const hasOB = Array.isArray(produto.order_bump_produtos) && produto.order_bump_produtos.length > 0;
    return `
        <div class="product-card">
            <div class="product-card-header">
                <h3 class="product-title">${produto.nome}</h3>
                <span class="product-type-badge">${produto.tipo}</span>
            </div>
            
            <div class="product-card-body">
                <div class="product-info-row">
                    <img src="${imagemUrl}" alt="${produto.nome}" class="product-image"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjhGOUZBIi8+CjxwYXRoIGQ9Ik00MCAyOEMzNy43OTA5IDI4IDM2IDI5Ljc5MDkgMzYgMzJWNDhDMzYgNTAuMjA5MSAzNy43OTA5IDUyIDQwIDUySDQ4QzUwLjIwOTEgNTIgNTIgNTAuMjA5MSA1MiA0OFY0OEM1MiA0NS43OTA5IDUwLjIwOTEgNDQgNDggNDRINDBDMzcuNzkwOSA0NCAzNiA0NS43OTA5IDM2IDQ4VjMyWiIgZmlsbD0iI0U5RUNFRiIvPgo8L3N2Zz4K'">
                    
                    <div class="product-details">
                        <div class="product-id">ID: ${produto.custom_id || produto.id}</div>
                        <div class="product-price ${produto.desconto > 0 ? 'discounted' : ''}">
                            ${precoComDesconto ? precoComDesconto : precoFormatado}
                            ${produto.desconto > 0 ? `
                                <span class="original-price">${precoFormatado}</span>
                                <span class="discount-badge">-${produto.desconto}%</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="status-badges">
                    ${statusBadges}
                    ${hasOB ? '<span class="status-badge info">Order Bump</span>' : ''}
                    <div class="ob-select-wrapper" style="margin-left:auto; position:relative;">
                        <button class="action-btn info" style="padding:6px 10px;" onclick="toggleOBSelector('${produto.id}')">
                            <i class="fas fa-plus-circle"></i> Produto complementar
                        </button>
                        <div id="ob-overlay-${produto.id}" class="ob-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999;" onclick="closeOBSelector('${produto.id}')"></div>
                        <div id="ob-panel-${produto.id}" class="ob-panel" style="display:none; position:fixed; z-index:1000; background:#fff; border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,0.12); width:320px; max-height:400px; overflow:auto; transform:translateX(-50%); left:50%; top:50%; margin-top:-200px; max-width:90vw; max-height:80vh;">
                            <div style="padding:10px; border-bottom:1px solid #eee; font-weight:600; font-size:13px;">Selecione até 3</div>
                            <div id="ob-list-${produto.id}" style="padding:8px;"></div>
                            <div style="display:flex; gap:8px; padding:8px; border-top:1px solid #eee; justify-content:flex-end;">
                                <button class="action-btn secondary" style="padding:6px 10px;" onclick="closeOBSelector('${produto.id}')">Fechar</button>
                                <button class="action-btn success" style="padding:6px 10px;" onclick="saveOBSelection('${produto.id}')">Salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="product-actions">
                    <div class="payment-actions">
                        ${(produto.status_aprovacao === 'aprovado' || (produto.ativo && produto.status_aprovacao !== 'rejeitado')) ? `
                            <button onclick="copiarLinkPagamento('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn success">
                                <i class="fas fa-copy"></i> Copiar Link
                            </button>
                            <button onclick="compartilharProduto('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn info">
                                <i class="fas fa-share"></i> Compartilhar
                            </button>
                            <button onclick="adicionarUpsell('${produto.id}', '${produto.nome}')" class="action-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                <i class="fas fa-arrow-up"></i> Adicionar Upsell
                            </button>
                        ` : `
                            <button disabled class="action-btn" style="background: #6c757d; color: white; cursor: not-allowed;" title="Produto aguardando aprovação - Link de checkout não disponível">
                                <i class="fas fa-clock"></i> Aguardando Aprovação
                            </button>
                        `}
                    </div>
                    <a href="atualizar-produto.html?id=${produto.id}" class="action-btn warning">
                        <i class="fas fa-edit"></i> Atualizar Produto
                    </a>
                    <button onclick="confirmarExclusao('${produto.id}', '${produto.nome}')" class="action-btn danger">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Gerar badges de status com design moderno
function gerarStatusBadges(produto) {
    const badges = [];
    
    // Badge de status de aprovação
    // IMPORTANTE: Produtos ATIVOS devem estar APROVADOS
    // Se estiver ativo mas não aprovado, considerar como erro e não mostrar badge de pendente
    if (produto.status_aprovacao === 'rejeitado') {
        badges.push('<span class="status-badge" style="background: #dc3545; color: white;">❌ Rejeitado</span>');
    } else if (produto.status_aprovacao === 'pendente_aprovacao' && !produto.ativo) {
        // Só mostrar "Aguardando Aprovação" se o produto estiver INATIVO
        badges.push('<span class="status-badge" style="background: #ffc107; color: #000;">⏳ Aguardando Aprovação</span>');
    }
    // Produtos ativos devem estar aprovados - não mostrar badge de pendente
    
    if (produto.ativo) {
        badges.push('<span class="status-badge active">Ativo</span>');
    } else {
        badges.push('<span class="status-badge inactive">Inativo</span>');
    }
    
    if (produto.afiliado) {
        badges.push('<span class="status-badge affiliate">Afiliado</span>');
    }
    
    if (produto.disponivelMarketplace) {
        badges.push('<span class="status-badge marketplace">Marketplace</span>');
    }
    
    return badges.join(' ');
}

// ==== Order Bump - UI helpers ====
function toggleOBSelector(produtoId) {
    const panel = document.getElementById(`ob-panel-${produtoId}`);
    const overlay = document.getElementById(`ob-overlay-${produtoId}`);
    if (!panel || !overlay) return;
    const isOpen = panel.style.display === 'block';
    if (isOpen) {
        panel.style.display = 'none';
        overlay.style.display = 'none';
        return;
    }
    // Abrir e carregar lista
    overlay.style.display = 'block';
    panel.style.display = 'block';
    carregarListaOB(produtoId);
}

function closeOBSelector(produtoId) {
    const panel = document.getElementById(`ob-panel-${produtoId}`);
    const overlay = document.getElementById(`ob-overlay-${produtoId}`);
    if (panel) panel.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

async function carregarListaOB(produtoId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) return;
        const resp = await fetch(`${window.API_BASE}/produtos?ativo=true&limite=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resp.json();
        const lista = Array.isArray(data.data) ? data.data : [];

        // Produto atual (para mostrar selecionados)
        const produtoAtual = produtos.find(p => p.id === produtoId);
        const selecionados = new Set((produtoAtual?.order_bump_produtos || []).map(x => x.id));

        const container = document.getElementById(`ob-list-${produtoId}`);
        if (!container) return;
        container.innerHTML = '';

        lista
            .filter(p => p.id !== produtoId) // não listar ele mesmo
            .forEach(p => {
                const row = document.createElement('div');
                row.style = 'display:flex; align-items:center; gap:8px; padding:6px 4px;';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = p.id;
                cb.checked = selecionados.has(p.id);
                cb.addEventListener('change', () => limitarOBMax(produtoId));
                const label = document.createElement('label');
                label.textContent = `${p.nome} — ${formatarPreco(p.preco || 0)}`;
                row.appendChild(cb);
                row.appendChild(label);
                container.appendChild(row);
            });
    } catch (e) {
        console.warn('Falha ao carregar lista OB');
    }
}

function limitarOBMax(produtoId) {
    const container = document.getElementById(`ob-list-${produtoId}`);
    if (!container) return;
    const marcados = container.querySelectorAll('input[type="checkbox"]:checked');
    if (marcados.length > 3) {
        // Desmarcar o último marcado
        const last = marcados[marcados.length - 1];
        last.checked = false;
        alert('Você pode selecionar no máximo 3 produtos complementares.');
    }
}

async function saveOBSelection(produtoId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) return;
        const container = document.getElementById(`ob-list-${produtoId}`);
        if (!container) return;
        const marcados = container.querySelectorAll('input[type="checkbox"]:checked');
        const selecionados = Array.from(marcados).map(cb => ({ id: cb.value }));

        const body = {
            order_bump_ativo: selecionados.length > 0,
            order_bump_produtos: selecionados
        };

        const resp = await fetch(`${window.API_BASE}/produtos/${produtoId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (resp.ok) {
            mostrarSucesso('Order Bump atualizado');
            // Atualizar cache local e re-render
            const idx = produtos.findIndex(p => p.id === produtoId);
            if (idx >= 0) {
                produtos[idx].order_bump_ativo = data.produto.order_bump_ativo;
                produtos[idx].order_bump_produtos = data.produto.order_bump_produtos;
            }
            renderizarProdutos();
        } else {
            mostrarErro(data.erro || 'Erro ao salvar Order Bump');
        }
    } catch (e) {
        mostrarErro('Erro de conexão ao salvar Order Bump');
    } finally {
        closeOBSelector(produtoId);
    }
}

// Formatar preço
function formatarPreco(preco) {
    // Garantir que sempre use MZN em vez de MTn
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN',
        minimumFractionDigits: 2
    }).format(preco);
    
    // Substituir MTn por MZN se necessário
    return formatted.replace('MTn', 'MZN');
}

// Adicionar upsell para um produto
async function adicionarUpsell(produtoId, produtoNome) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado');
            return;
        }

        // Verificar se já existe uma página de upsell relacionada
        const checkResponse = await fetch(`${window.API_BASE || '/api'}/upsell/produtos/${produtoId}/pagina`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const checkData = await checkResponse.json();
        let paginaAtualId = null;
        
        if (checkData.success && checkData.hasUpsell && checkData.page) {
            paginaAtualId = checkData.page.id;
        }

        // Buscar todas as páginas de upsell disponíveis
        const pagesResponse = await fetch(`${window.API_BASE || '/api'}/upsell/pages`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const pagesData = await pagesResponse.json();
        
        if (!pagesData.success || !pagesData.pages || pagesData.pages.length === 0) {
            // Não há páginas, oferecer criar uma nova
            if (confirm(`Não há páginas de upsell criadas. Deseja criar uma nova página para "${produtoNome}"?`)) {
                window.location.href = `upsell-config-add-page.html?produto_id=${produtoId}&produto_nome=${encodeURIComponent(produtoNome)}`;
            }
            return;
        }

        // Mostrar modal para selecionar página
        mostrarModalSelecionarUpsell(produtoId, produtoNome, pagesData.pages, paginaAtualId);
    } catch (error) {
        console.error('Erro ao carregar páginas de upsell:', error);
        mostrarErro('Erro ao carregar páginas de upsell');
    }
}

// Mostrar modal para selecionar página de upsell
function mostrarModalSelecionarUpsell(produtoId, produtoNome, paginas, paginaAtualId) {
    // Criar modal se não existir
    let modal = document.getElementById('modal-selecionar-upsell');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-selecionar-upsell';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2>Selecionar Página de Upsell</h2>
                    <button class="close-modal" onclick="fecharModalSelecionarUpsell()" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <p style="margin-bottom: 20px; color: #666;">
                    Escolha qual página de upsell será exibida após o pagamento de <strong>${escapeHtml(produtoNome)}</strong>
                </p>
                <div id="upsell-pages-list" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px;">
                    <!-- Lista de páginas será inserida aqui -->
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="fecharModalSelecionarUpsell()" class="btn btn-secondary">Cancelar</button>
                    <button onclick="criarNovaPaginaUpsell()" class="btn btn-info" style="background: #17a2b8;">
                        <i class="fas fa-plus"></i> Criar Nova Página
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Preencher lista de páginas
    const listContainer = document.getElementById('upsell-pages-list');
    listContainer.innerHTML = paginas.map(pagina => {
        const isSelected = paginaAtualId === pagina.id;
        return `
            <div class="upsell-page-item" style="border: 2px solid ${isSelected ? '#667eea' : '#e9ecef'}; border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s; ${isSelected ? 'background: #f0f4ff;' : ''}" 
                 onclick="selecionarPaginaUpsell('${produtoId}', '${pagina.id}', '${escapeHtml(pagina.titulo)}')"
                 onmouseover="this.style.borderColor='#667eea'; this.style.background='#f0f4ff';"
                 onmouseout="this.style.borderColor='${isSelected ? '#667eea' : '#e9ecef'}'; this.style.background='${isSelected ? '#f0f4ff' : 'white'}';">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0 0 5px 0; color: #333;">${escapeHtml(pagina.titulo)}</h4>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">${escapeHtml(pagina.nome_produto)}</p>
                        ${isSelected ? '<span style="color: #667eea; font-size: 0.85rem;"><i class="fas fa-check-circle"></i> Página atual</span>' : ''}
                    </div>
                    <i class="fas fa-chevron-right" style="color: #999;"></i>
                </div>
            </div>
        `;
    }).join('');

    // Armazenar dados para uso posterior
    window.currentProdutoUpsell = { produtoId, produtoNome };
    
    // Mostrar modal
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
}

// Selecionar página de upsell
async function selecionarPaginaUpsell(produtoId, upsellPageId, paginaTitulo) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('adminToken');
        
        const response = await fetch(`${window.API_BASE || '/api'}/upsell/produtos/${produtoId}/pagina`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                upsell_page_id: upsellPageId
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarSucesso(`Página "${paginaTitulo}" relacionada com sucesso!`);
            fecharModalSelecionarUpsell();
            // Recarregar produtos para atualizar visualização
            carregarProdutos();
        } else {
            mostrarErro(data.message || 'Erro ao relacionar página de upsell');
        }
    } catch (error) {
        console.error('Erro ao relacionar página de upsell:', error);
        mostrarErro('Erro ao relacionar página de upsell');
    }
}

// Criar nova página de upsell
function criarNovaPaginaUpsell() {
    const { produtoId, produtoNome } = window.currentProdutoUpsell || {};
    if (produtoId && produtoNome) {
        window.location.href = `upsell-config-add-page.html?produto_id=${produtoId}&produto_nome=${encodeURIComponent(produtoNome)}`;
    } else {
        window.location.href = 'upsell-config-add-page.html';
    }
}

// Fechar modal
function fecharModalSelecionarUpsell() {
    const modal = document.getElementById('modal-selecionar-upsell');
    if (modal) {
        modal.style.display = 'none';
    }
    window.currentProdutoUpsell = null;
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Confirmar exclusão
function confirmarExclusao(produtoId, produtoNome) {
    produtoParaExcluir = produtoId;
    
    // Encontrar o produto para obter o ID customizado
    const produto = produtos.find(p => p.id === produtoId);
    const customId = produto?.custom_id || produto?.customId || produtoId;
    
    // Definir texto de confirmação
    confirmationText = `DELETE#${customId}`;
    
    
    // Atualizar elementos do modal
    modalMensagem.textContent = `Tem certeza que deseja excluir o produto "${produtoNome}"? Esta ação não pode ser desfeita.`;
    
    // Atualizar texto de confirmação
    const confirmationDisplay = document.getElementById('confirmation-text-display');
    if (confirmationDisplay) {
        confirmationDisplay.textContent = confirmationText;
    }
    
    // Limpar e resetar campo de entrada
    const confirmationInput = document.getElementById('confirmation-text');
    if (confirmationInput) {
        confirmationInput.value = '';
        confirmationInput.classList.remove('valid', 'invalid');
    }
    
    // Desabilitar botão de confirmação
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
    }
    
    modalConfirmacao.style.display = 'flex';
    
    // Focar no campo de entrada
    setTimeout(() => {
        if (confirmationInput) {
            confirmationInput.focus();
        }
    }, 100);
}

// Validar texto de confirmação
function validarTextoConfirmacao() {
    const input = document.getElementById('confirmation-text');
    const btnConfirmar = document.getElementById('btn-confirmar');
    
    if (!input || !btnConfirmar) return;
    
    const inputValue = input.value.trim();
    
    if (inputValue === confirmationText) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        btnConfirmar.disabled = false;
    } else if (inputValue.length > 0) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        btnConfirmar.disabled = true;
    } else {
        input.classList.remove('valid', 'invalid');
        btnConfirmar.disabled = true;
    }
}

// Confirmar ação
async function confirmarAcao() {
    if (produtoParaExcluir) {
        await excluirProduto(produtoParaExcluir);
        produtoParaExcluir = null;
    }
    fecharModal();
}

// Fechar modal
function fecharModal() {
    modalConfirmacao.style.display = 'none';
    produtoParaExcluir = null;
}

// Excluir produto
async function excluirProduto(produtoId) {
    try {
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado. Faça login novamente.');
            return;
        }
        
        const response = await fetch(`${window.API_BASE}/admin/produtos/${produtoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            mostrarErro('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarSucesso('Produto excluído com sucesso');
            produtos = produtos.filter(p => p.id !== produtoId);
            renderizarProdutos();
        } else {
            mostrarErro(data.erro || 'Erro ao excluir produto');
        }
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        mostrarErro('Erro de conexão com o servidor');
    }
}

// Alternar status ativo
async function alternarAtivo(produtoId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado. Faça login novamente.');
            return;
        }
        
        const response = await fetch(`${window.API_BASE}/admin/produtos/${produtoId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            mostrarErro('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarSucesso(data.mensagem);
            const produto = produtos.find(p => p.id === produtoId);
            if (produto) {
                produto.ativo = data.produto.ativo;
                renderizarProdutos();
            }
        } else {
            mostrarErro(data.erro || 'Erro ao alterar status do produto');
        }
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        mostrarErro('Erro de conexão com o servidor');
    }
}

// Alternar marketplace
async function alternarMarketplace(produtoId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado. Faça login novamente.');
            return;
        }
        
        const response = await fetch(`${window.API_BASE}/admin/produtos/${produtoId}/marketplace`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 401) {
            mostrarErro('Sessão expirada. Faça login novamente.');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarSucesso(data.mensagem);
            const produto = produtos.find(p => p.id === produtoId);
            if (produto) {
                produto.disponivelMarketplace = data.produto.disponivelMarketplace;
                renderizarProdutos();
            }
        } else {
            mostrarErro(data.erro || 'Erro ao alterar disponibilidade no marketplace');
        }
    } catch (error) {
        console.error('Erro ao alterar marketplace:', error);
        mostrarErro('Erro de conexão com o servidor');
    }
}

// Mostrar loading
function mostrarLoading(mostrar) {
    loadingElement.style.display = mostrar ? 'block' : 'none';
}

// Salvar configurações Utmify do produto com feedback visual aprimorado

// Mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
    mostrarSucessoToast(mensagem, 'success');
}

// Mostrar mensagem de erro
function mostrarErro(mensagem) {
    console.error('Erro:', mensagem);
    mostrarErroToast(mensagem, 'error');
}

// Mostrar toast de sucesso/erro/aviso com estilo moderno
function mostrarSucessoToast(mensagem, tipo = 'success') {
    // Remover toast anterior se existir
    const toastAnterior = document.getElementById('utmfy-toast');
    if (toastAnterior) {
        toastAnterior.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'utmfy-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 14px;
        font-weight: 500;
        color: white;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
    `;
    
    // Cores baseadas no tipo
    const cores = {
        success: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        error: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
        warning: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
        info: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)'
    };
    
    toast.style.background = cores[tipo] || cores.success;
    
    const icon = tipo === 'success' ? 'fa-check-circle' : 
                 tipo === 'error' ? 'fa-exclamation-circle' :
                 tipo === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size: 20px;"></i>
        <span>${mensagem}</span>
        <button onclick="this.parentElement.remove()" style="background: rgba(255,255,255,0.2); border: none; color: white; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; margin-left: auto; display: flex; align-items: center; justify-content: center; font-size: 12px;">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function mostrarErroToast(mensagem, tipo = 'error') {
    mostrarSucessoToast(mensagem, tipo);
}

// Adicionar animações CSS se não existirem
if (!document.getElementById('utmfy-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'utmfy-toast-styles';
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Copiar link de pagamento
async function copiarLinkPagamento(produtoId, nomeProduto) {
    try {
        const linkPagamento = `${window.location.origin}/checkout.html?produto=${produtoId}`;
        
        // Usar Clipboard API se disponível
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(linkPagamento);
            mostrarSucesso('Link de pagamento copiado para a área de transferência!');
        } else {
            // Fallback para navegadores mais antigos
            const textArea = document.createElement('textarea');
            textArea.value = linkPagamento;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                mostrarSucesso('Link de pagamento copiado para a área de transferência!');
            } catch (err) {
                console.error('Erro ao copiar:', err);
                mostrarErro('Erro ao copiar link. Tente copiar manualmente: ' + linkPagamento);
            }
            
            document.body.removeChild(textArea);
        }
    } catch (error) {
        console.error('Erro ao copiar link:', error);
        mostrarErro('Erro ao copiar link de pagamento');
    }
}

// Compartilhar produto
async function compartilharProduto(produtoId, nomeProduto) {
    try {
        const linkPagamento = `${window.location.origin}/checkout.html?produto=${produtoId}`;
        const textoCompartilhamento = `Confira este produto incrível: ${nomeProduto}\n\n${linkPagamento}`;
        
        // Usar Web Share API se disponível
        if (navigator.share) {
            await navigator.share({
                title: nomeProduto,
                text: `Confira este produto incrível: ${nomeProduto}`,
                url: linkPagamento
            });
        } else {
            // Fallback: abrir em nova aba
            window.open(linkPagamento, '_blank');
            mostrarSucesso('Produto aberto em nova aba para compartilhamento!');
        }
    } catch (error) {
        console.error('Erro ao compartilhar:', error);
        // Se o usuário cancelou o compartilhamento, não mostrar erro
        if (error.name !== 'AbortError') {
            mostrarErro('Erro ao compartilhar produto');
        }
    }
}


