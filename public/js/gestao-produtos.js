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
                
                <div class="utmfy-config-section" style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <input type="checkbox" 
                               id="utmfy-toggle-${produto.id}" 
                               onchange="toggleUTMfySection('${produto.id}')"
                               style="margin-right: 5px; transform: scale(1.2;">
                        <i class="fas fa-chart-line" style="color: #007bff;"></i>
                        <strong style="color: #333;">Utmify Campaign Manager</strong>
                        ${produto.utmfy_api_key ? '<span style="color: #28a745; font-size: 12px;"><i class="fas fa-check-circle"></i> Configurado</span>' : '<span style="color: #dc3545; font-size: 12px;"><i class="fas fa-exclamation-circle"></i> Não configurado</span>'}
                    </div>
                    
                    <div id="utmfy-content-${produto.id}" style="display: none;">
                    
                    <!-- API Key Input -->
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #555; margin-bottom: 5px;">API Key</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" 
                                   id="utmfy-api-key-${produto.id}" 
                                   value="${produto.utmfy_api_key || ''}" 
                                   placeholder="Cole sua API Key do Utmify"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-family: 'Courier New', monospace;"
                                   maxlength="200">
                            <button onclick="colarUTMfyApiKey('${produto.id}')" 
                                    style="background: #28a745; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 40px;"
                                    title="Colar API Key">
                                <i class="fas fa-paste"></i>
                            </button>
                            <button onclick="copiarUTMfyApiKey('${produto.id}')" 
                                    style="background: #007bff; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 40px;"
                                    title="Copiar API Key">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <small style="color: #6c757d; font-size: 11px; margin-top: 5px; display: block;">
                            Encontre sua API Key no painel do Utmify
                        </small>
                    </div>
                    
                    
                    <!-- Botão Salvar -->
                    <div style="margin-bottom: 15px;">
                        <button onclick="salvarUTMfy('${produto.id}')" 
                                id="utmfy-save-btn-${produto.id}"
                                class="action-btn success" 
                                style="padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 4px; background: #007bff; border: none; color: white; cursor: pointer; transition: all 0.3s;"
                                onmouseover="this.style.background='#0056b3'"
                                onmouseout="this.style.background='#007bff'">
                            <i class="fas fa-save"></i> Salvar Configuração
                        </button>
                    </div>
                    
                    </div>
                </div>
                
                <div class="pixel-config-section" style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <input type="checkbox" 
                               id="pixel-toggle-${produto.id}" 
                               onchange="togglePixelSection('${produto.id}')"
                               style="margin-right: 5px; transform: scale(1.2;">
                        <i class="fas fa-chart-line" style="color: #007bff;"></i>
                        <strong style="color: #333;">Meta Pixel Configuration</strong>
                        ${produto.pixel_id ? '<span style="color: #28a745; font-size: 12px;"><i class="fas fa-check-circle"></i> Configurado</span>' : '<span style="color: #dc3545; font-size: 12px;"><i class="fas fa-exclamation-circle"></i> Não configurado</span>'}
                    </div>
                    
                    <div id="pixel-content-${produto.id}" style="display: none;">
                    
                    <!-- Pixel ID Input -->
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-size: 12px; font-weight: 600; color: #555; margin-bottom: 5px;">Pixel ID</label>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" 
                                   id="pixel-${produto.id}" 
                                   value="${produto.pixel_id || ''}" 
                                   placeholder="Ex: 123456789012345"
                                   style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;"
                                   maxlength="16"
                                   pattern="[0-9]{15,16}"
                                   title="Pixel ID deve ter 15-16 dígitos">
                            <button onclick="colarPixelId('${produto.id}')" 
                                    style="background: #28a745; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 40px;"
                                    title="Colar Pixel ID">
                                <i class="fas fa-paste"></i>
                            </button>
                            <button onclick="copiarPixelId('${produto.id}')" 
                                    style="background: #007bff; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; min-width: 40px;"
                                    title="Copiar Pixel ID">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Botão Salvar -->
                    <div style="margin-bottom: 15px;">
                        <button onclick="salvarPixelConfig('${produto.id}')" 
                                id="pixel-save-btn-${produto.id}"
                                class="action-btn success" 
                                style="padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 4px; background: #007bff; border: none; color: white; cursor: pointer; transition: all 0.3s;"
                                onmouseover="this.style.background='#0056b3'"
                                onmouseout="this.style.background='#007bff'">
                            <i class="fas fa-save"></i> Salvar Configuração
                        </button>
                    </div>
                    
                    <small style="color: #6c757d; font-size: 11px; margin-top: 5px; display: block;">
                        Encontre o Pixel ID no Facebook Business Manager. Todos os eventos serão rastreados automaticamente.
                    </small>
                    </div>
                </div>
                
                <div class="product-actions">
                    <div class="payment-actions">
                        <button onclick="copiarLinkPagamento('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn success">
                            <i class="fas fa-copy"></i> Copiar Link
                        </button>
                        <button onclick="compartilharProduto('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn info">
                            <i class="fas fa-share"></i> Compartilhar
                        </button>
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
async function salvarUTMfy(produtoId) {
    const saveBtn = document.getElementById(`utmfy-save-btn-${produtoId}`);
    const originalBtnContent = saveBtn ? saveBtn.innerHTML : '';
    
    try {
        // Feedback visual: botão de loading
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            saveBtn.style.opacity = '0.7';
        }
        
        const apiKeyInput = document.getElementById(`utmfy-api-key-${produtoId}`);
        
        if (!apiKeyInput) {
            mostrarErro('Campo de API Key Utmify não encontrado');
            return;
        }
        
        const apiKey = apiKeyInput.value.trim();
        
        // Valores pré-definidos: sempre ativo, tipo utmify, todos os eventos
        const tokenType = 'utmify';
        const active = true; // Sempre ativo quando salvar
        const events = ['page_view', 'purchase_completed', 'cart_abandoned', 'checkout_started']; // Todos os eventos ativos
        
        // Validar API Key (obrigatória)
        if (!apiKey) {
            mostrarErroToast('⚠️ API Key é obrigatória', 'warning');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        // Validar formato básico da API Key (se fornecida)
        if (apiKey && apiKey.length < 10) {
            mostrarErroToast('⚠️ API Key parece estar incompleta. Verifique se copiou corretamente.', 'warning');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            mostrarErroToast('❌ Usuário não autenticado. Faça login novamente.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        
        const response = await fetch(`${window.API_BASE}/produtos/${produtoId}/utmfy`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                apiKey: apiKey, 
                tokenType: tokenType, 
                events: events, 
                active: active 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
            throw new Error(errorData.message || 'Erro ao salvar configurações Utmify');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Atualizar o produto na lista local
            const produtoIndex = produtos.findIndex(p => p.id === produtoId);
            if (produtoIndex !== -1) {
                produtos[produtoIndex].utmfy_api_key = apiKey;
                produtos[produtoIndex].utmfy_token_type = tokenType; // Sempre 'utmify'
                produtos[produtoIndex].utmfy_events = events; // Todos os eventos
                produtos[produtoIndex].utmfy_active = active; // Sempre true
            }
            
            // Feedback visual de sucesso
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
                saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                setTimeout(() => {
                    saveBtn.innerHTML = originalBtnContent;
                    saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                }, 2000);
            }
            
            // Re-renderizar os produtos para atualizar o status
            renderizarProdutos();
            
            mostrarSucessoToast('✅ Configurações Utmify salvas com sucesso!', 'success');
        } else {
            throw new Error(data.message || 'Erro ao salvar configurações Utmify');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar configurações Utmify:', error);
        mostrarErroToast('❌ Erro ao salvar: ' + error.message, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnContent;
            saveBtn.style.opacity = '1';
        }
    }
}

// Colar API Key do Utmify da área de transferência
async function colarUTMfyApiKey(produtoId) {
    try {
        const apiKeyInput = document.getElementById(`utmfy-api-key-${produtoId}`);
        if (!apiKeyInput) {
            mostrarErroToast('Campo de API Key não encontrado', 'error');
            return;
        }
        
        // Usar Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            const texto = await navigator.clipboard.readText();
            apiKeyInput.value = texto.trim();
            apiKeyInput.focus();
            mostrarSucessoToast('API Key colada com sucesso!', 'success');
        } else {
            // Fallback: usar prompt ou tentar colar via evento
            mostrarErroToast('Funcionalidade de colar não disponível neste navegador. Use Ctrl+V', 'warning');
            apiKeyInput.focus();
        }
    } catch (error) {
        console.error('Erro ao colar API Key:', error);
        if (error.name === 'NotAllowedError') {
            mostrarErroToast('Permissão negada. Use Ctrl+V para colar manualmente', 'warning');
        } else {
            mostrarErroToast('Erro ao colar API Key. Use Ctrl+V para colar manualmente', 'error');
        }
    }
}

// Copiar API Key para área de transferência
async function copiarUTMfyApiKey(produtoId) {
    try {
        const apiKeyInput = document.getElementById(`utmfy-api-key-${produtoId}`);
        if (!apiKeyInput || !apiKeyInput.value.trim()) {
            mostrarErroToast('Nenhuma API Key para copiar', 'warning');
            return;
        }
        
        const apiKey = apiKeyInput.value.trim();
        
        // Usar Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(apiKey);
            mostrarSucessoToast('API Key copiada para a área de transferência!', 'success');
        } else {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = apiKey;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            mostrarSucessoToast('API Key copiada!', 'success');
        }
    } catch (error) {
        console.error('Erro ao copiar API Key:', error);
        mostrarErroToast('Erro ao copiar API Key', 'error');
    }
}

// Colar Pixel ID da área de transferência
async function colarPixelId(produtoId) {
    try {
        const pixelIdInput = document.getElementById(`pixel-${produtoId}`);
        if (!pixelIdInput) {
            mostrarErroToast('Campo de Pixel ID não encontrado', 'error');
            return;
        }
        
        // Usar Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            const texto = await navigator.clipboard.readText();
            // Limpar apenas números do texto colado
            const pixelIdLimpo = texto.trim().replace(/\D/g, '');
            pixelIdInput.value = pixelIdLimpo;
            pixelIdInput.focus();
            mostrarSucessoToast('Pixel ID colado com sucesso!', 'success');
        } else {
            // Fallback: usar prompt ou tentar colar via evento
            mostrarErroToast('Funcionalidade de colar não disponível neste navegador. Use Ctrl+V', 'warning');
            pixelIdInput.focus();
        }
    } catch (error) {
        console.error('Erro ao colar Pixel ID:', error);
        if (error.name === 'NotAllowedError') {
            mostrarErroToast('Permissão negada. Use Ctrl+V para colar manualmente', 'warning');
        } else {
            mostrarErroToast('Erro ao colar Pixel ID. Use Ctrl+V para colar manualmente', 'error');
        }
    }
}

// Copiar Pixel ID para área de transferência
async function copiarPixelId(produtoId) {
    try {
        const pixelIdInput = document.getElementById(`pixel-${produtoId}`);
        if (!pixelIdInput || !pixelIdInput.value.trim()) {
            mostrarErroToast('Nenhum Pixel ID para copiar', 'warning');
            return;
        }
        
        const pixelId = pixelIdInput.value.trim();
        
        // Usar Clipboard API
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(pixelId);
            mostrarSucessoToast('Pixel ID copiado para a área de transferência!', 'success');
        } else {
            // Fallback
            const textArea = document.createElement('textarea');
            textArea.value = pixelId;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            mostrarSucessoToast('Pixel ID copiado!', 'success');
        }
    } catch (error) {
        console.error('Erro ao copiar Pixel ID:', error);
        mostrarErroToast('Erro ao copiar Pixel ID', 'error');
    }
}

// Salvar configuração completa do Pixel (ID + Eventos)
async function salvarPixelConfig(produtoId) {
    const saveBtn = document.getElementById(`pixel-save-btn-${produtoId}`);
    const originalBtnContent = saveBtn ? saveBtn.innerHTML : '';
    
    try {
        // Feedback visual: botão de loading
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            saveBtn.style.opacity = '0.7';
        }
        
        const pixelIdInput = document.getElementById(`pixel-${produtoId}`);
        if (!pixelIdInput) {
            mostrarErro('Campo de Pixel ID não encontrado');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        const pixelId = pixelIdInput.value.trim();
        
        // Validar Pixel ID (deve ter 15-16 dígitos)
        if (pixelId && !/^\d{15,16}$/.test(pixelId)) {
            mostrarErroToast('⚠️ Pixel ID deve ter 15-16 dígitos numéricos', 'warning');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        // Valores pré-definidos: todos os eventos ativos quando há Pixel ID
        const eventosDisponiveis = ['Purchase', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Lead'];
        const eventosSelecionados = pixelId ? eventosDisponiveis : null; // Todos os eventos quando há Pixel ID
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        if (!token) {
            mostrarErroToast('❌ Usuário não autenticado. Faça login novamente.', 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalBtnContent;
                saveBtn.style.opacity = '1';
            }
            return;
        }
        
        const response = await fetch(`${window.API_BASE}/produtos/${produtoId}/pixel`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                pixelId: pixelId || null,
                pixelEvents: eventosSelecionados
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
            throw new Error(errorData.message || 'Erro ao salvar configuração do Pixel');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Atualizar o produto na lista local
            const produtoIndex = produtos.findIndex(p => p.id === produtoId);
            if (produtoIndex !== -1) {
                produtos[produtoIndex].pixel_id = pixelId;
                produtos[produtoIndex].pixel_events = eventosSelecionados; // Todos os eventos
            }
            
            // Feedback visual de sucesso
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
                saveBtn.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
                setTimeout(() => {
                    saveBtn.innerHTML = originalBtnContent;
                    saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                }, 2000);
            }
            
            // Re-renderizar os produtos para atualizar o status
            renderizarProdutos();
            
            const mensagem = pixelId 
                ? `✅ Configuração do Pixel salva com sucesso! Todos os eventos serão rastreados.`
                : '✅ Configuração do Pixel removida com sucesso!';
            
            mostrarSucessoToast(mensagem, 'success');
        } else {
            throw new Error(data.message || 'Erro ao salvar configuração do Pixel');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar configuração do Pixel:', error);
        mostrarErroToast('❌ Erro ao salvar: ' + error.message, 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnContent;
            saveBtn.style.opacity = '1';
        }
    }
}

// Manter função antiga para compatibilidade
async function salvarPixel(produtoId) {
    return salvarPixelConfig(produtoId);
}

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

// Função para alternar visibilidade da seção Utmify
function toggleUTMfySection(produtoId) {
    const checkbox = document.getElementById(`utmfy-toggle-${produtoId}`);
    const content = document.getElementById(`utmfy-content-${produtoId}`);
    
    if (checkbox && content) {
        if (checkbox.checked) {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    }
}

// Função para alternar visibilidade da seção Meta Pixel
function togglePixelSection(produtoId) {
    const checkbox = document.getElementById(`pixel-toggle-${produtoId}`);
    const content = document.getElementById(`pixel-content-${produtoId}`);
    
    if (checkbox && content) {
        if (checkbox.checked) {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    }
}

