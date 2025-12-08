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
            
            // NORMALIZAÇÃO CRÍTICA: Produtos ATIVOS devem estar APROVADOS
            // Filtrar produtos rejeitados há mais de 24h
            produtos = produtosDoUsuario
                .filter(produto => {
                    // Se produto foi rejeitado, verificar se foi há mais de 24h
                    if (produto.status_aprovacao === 'rejeitado') {
                        const dataRejeicao = produto.data_rejeicao || produto.updated_at;
                        if (dataRejeicao) {
                            const horasDesdeRejeicao = (Date.now() - new Date(dataRejeicao).getTime()) / (1000 * 60 * 60);
                            // Se foi rejeitado há mais de 24h, não mostrar
                            if (horasDesdeRejeicao > 24) {
                                return false;
                            }
                        }
                    }
                    return true;
                })
                .map(produto => {
                    // Se o produto está ativo mas não está aprovado, normalizar para aprovado
                    if (produto.ativo === true && produto.status_aprovacao !== 'aprovado') {
                        console.warn('⚠️ Produto ativo não aprovado detectado, normalizando:', produto.custom_id || produto.id);
                        produto.status_aprovacao = 'aprovado';
                        produto.motivo_rejeicao = null;
                    }
                    return produto;
                });
            
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
                        <div id="ob-panel-${produto.id}" class="ob-panel" style="display:none; position:fixed; z-index:1000; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:16px; box-shadow:0 20px 60px rgba(0,0,0,0.3); width:500px; max-height:600px; overflow:hidden; transform:translateX(-50%); left:50%; top:50%; margin-top:-300px; max-width:90vw;">
                            <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; padding:20px; border-radius:16px 16px 0 0;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <h3 style="margin:0; font-size:18px; font-weight:600; display:flex; align-items:center; gap:10px;">
                                            <i class="fas fa-gift"></i> Adicionar Produto Order Bump
                                        </h3>
                                        <p style="margin:5px 0 0 0; font-size:13px; opacity:0.9;">Selecione até 3 produtos complementares</p>
                                    </div>
                                    <button onclick="closeOBSelector('${produto.id}')" style="background:rgba(255,255,255,0.2); border:none; color:white; width:32px; height:32px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <div id="ob-list-${produto.id}" style="padding:20px; max-height:400px; overflow-y:auto;"></div>
                            <div style="display:flex; gap:10px; padding:20px; border-top:1px solid var(--border-color); background:var(--bg-input); border-radius:0 0 16px 16px; justify-content:flex-end;">
                                <button class="action-btn secondary" style="padding:10px 20px; border-radius:8px; border:none; cursor:pointer; font-weight:600; transition:all 0.3s;" onclick="closeOBSelector('${produto.id}')">Cancelar</button>
                                <button class="action-btn success" style="padding:10px 20px; border-radius:8px; border:none; cursor:pointer; font-weight:600; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:white; transition:all 0.3s; box-shadow:0 4px 12px rgba(16,185,129,0.3);" onclick="saveOBSelection('${produto.id}')" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(16,185,129,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)'">
                                    <i class="fas fa-check"></i> Salvar Seleção
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="product-actions">
                    ${(() => {
                        const dataRejeicao = produto.data_rejeicao || produto.updated_at;
                        const horasDesdeRejeicao = dataRejeicao ? (Date.now() - new Date(dataRejeicao).getTime()) / (1000 * 60 * 60) : null;
                        const rejeitadoMaisDe24h = produto.status_aprovacao === 'rejeitado' && horasDesdeRejeicao && horasDesdeRejeicao > 24;
                        const isRejeitado = produto.status_aprovacao === 'rejeitado' && !rejeitadoMaisDe24h;
                        const isPendente = produto.status_aprovacao === 'pendente_aprovacao' || (produto.status_aprovacao === null && !produto.ativo);
                        const isAprovado = produto.status_aprovacao === 'aprovado' || (produto.ativo && produto.status_aprovacao !== 'rejeitado');
                        
                        // Se rejeitado há mais de 24h, não mostrar o produto
                        if (rejeitadoMaisDe24h) {
                            return '';
                        }
                        
                        // Se rejeitado (menos de 24h), mostrar botões de solicitar aprovação e eliminar
                        if (isRejeitado) {
                            return `
                                <div class="payment-actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                                    <button onclick="solicitarAprovacaoProduto('${produto.id}')" class="action-btn" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; flex: 1;">
                                        <i class="fas fa-check-circle"></i> Solicitar Aprovação
                                    </button>
                                    <button onclick="confirmarExclusao('${produto.id}', '${escapeHtml(produto.nome)}')" class="action-btn danger" style="flex: 1;">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </div>
                            `;
                        }
                        
                        // Se pendente, mostrar apenas botão de aguardando
                        if (isPendente) {
                            return `
                                <div class="payment-actions">
                                    <button disabled class="action-btn" style="background: #ffc107; color: #000; cursor: not-allowed; width: 100%;" title="Produto aguardando aprovação - Link de checkout não disponível">
                                        <i class="fas fa-clock"></i> Aguardando Aprovação
                                    </button>
                                </div>
                                <div style="display: flex; gap: 10px; margin-top: 10px;">
                                    <a href="atualizar-produto.html?id=${produto.id}" class="action-btn warning" style="flex: 1;">
                                        <i class="fas fa-edit"></i> Atualizar Produto
                                    </a>
                                    <button onclick="confirmarExclusao('${produto.id}', '${produto.nome}')" class="action-btn danger" style="flex: 1;">
                                        <i class="fas fa-trash"></i> Excluir
                                    </button>
                                </div>
                            `;
                        }
                        
                        // Se aprovado, mostrar ações normais
                        if (isAprovado) {
                            return `
                                <div class="payment-actions">
                                    <button onclick="copiarLinkPagamento('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn success">
                                        <i class="fas fa-copy"></i> Copiar Link
                                    </button>
                                    <button onclick="compartilharProduto('${produto.custom_id || produto.id}', '${produto.nome}')" class="action-btn info">
                                        <i class="fas fa-share"></i> Compartilhar
                                    </button>
                                    <button onclick="adicionarUpsell('${produto.id}', '${produto.nome}')" class="action-btn" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                                        <i class="fas fa-arrow-up"></i> Adicionar Upsell
                                    </button>
                                </div>
                                <div style="display: flex; gap: 10px; margin-top: 10px;">
                                    <a href="atualizar-produto.html?id=${produto.id}" class="action-btn warning" style="flex: 1;">
                                        <i class="fas fa-edit"></i> Atualizar Produto
                                    </a>
                                    <button onclick="confirmarExclusao('${produto.id}', '${produto.nome}')" class="action-btn danger" style="flex: 1;">
                                        <i class="fas fa-trash"></i> Excluir
                                    </button>
                                </div>
                            `;
                        }
                        
                        return '';
                    })()}
                </div>
            </div>
        </div>
    `;
}

// Gerar badges de status com design moderno
function gerarStatusBadges(produto) {
    const badges = [];
    
    // Verificar se produto foi rejeitado há mais de 24h
    const dataRejeicao = produto.data_rejeicao || produto.updated_at;
    const horasDesdeRejeicao = dataRejeicao ? (Date.now() - new Date(dataRejeicao).getTime()) / (1000 * 60 * 60) : null;
    const rejeitadoMaisDe24h = produto.status_aprovacao === 'rejeitado' && horasDesdeRejeicao && horasDesdeRejeicao > 24;
    
    // Badge de status de aprovação
    if (produto.status_aprovacao === 'rejeitado' && !rejeitadoMaisDe24h) {
        badges.push('<span class="status-badge" style="background: #dc3545; color: white;">❌ Rejeitado</span>');
    } else if (produto.status_aprovacao === 'pendente_aprovacao' || (produto.status_aprovacao === null && !produto.ativo)) {
        // Mostrar como pendente se não estiver aprovado e não estiver ativo
        badges.push('<span class="status-badge" style="background: #ffc107; color: #000;">⏳ Aguardando Aprovação</span>');
    }
    
    // Só mostrar status ativo/inativo se não estiver rejeitado há mais de 24h
    if (!rejeitadoMaisDe24h) {
        if (produto.ativo && produto.status_aprovacao === 'aprovado') {
            badges.push('<span class="status-badge active">Ativo</span>');
        } else if (!produto.ativo && produto.status_aprovacao !== 'rejeitado') {
            badges.push('<span class="status-badge inactive">Inativo</span>');
        }
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
                row.style = 'display:flex; align-items:center; gap:12px; padding:12px; margin-bottom:8px; background:var(--bg-input); border:2px solid var(--border-color); border-radius:12px; cursor:pointer; transition:all 0.3s;';
                row.onmouseover = function() { this.style.borderColor = '#667eea'; this.style.background = 'rgba(102, 126, 234, 0.1)'; };
                row.onmouseout = function() { this.style.borderColor = 'var(--border-color)'; this.style.background = 'var(--bg-input)'; };
                row.onclick = function() { cb.click(); };
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = p.id;
                cb.checked = selecionados.has(p.id);
                cb.style = 'width:20px; height:20px; cursor:pointer; accent-color:#667eea;';
                cb.addEventListener('change', () => {
                    limitarOBMax(produtoId);
                    if (cb.checked) {
                        row.style.borderColor = '#667eea';
                        row.style.background = 'rgba(102, 126, 234, 0.15)';
                    } else {
                        row.style.borderColor = 'var(--border-color)';
                        row.style.background = 'var(--bg-input)';
                    }
                });
                
                const label = document.createElement('label');
                label.style = 'flex:1; cursor:pointer; display:flex; flex-direction:column; gap:4px;';
                label.innerHTML = `
                    <span style="font-weight:600; color:var(--text-primary);">${escapeHtml(p.nome)}</span>
                    <span style="font-size:14px; color:var(--text-secondary);">${formatarPreco(p.preco || 0)}</span>
                `;
                
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
            <div class="modal-content" style="max-width: 700px; border-radius: 16px; overflow: hidden;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 16px 16px 0 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h2 style="margin: 0; font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                                <i class="fas fa-arrow-up"></i> Adicionar Página de Upsell
                            </h2>
                            <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
                                Escolha qual página será exibida após o pagamento de <strong>${escapeHtml(produtoNome)}</strong>
                            </p>
                        </div>
                        <button class="close-modal" onclick="fecharModalSelecionarUpsell()" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div style="padding: 24px;">
                    <div id="upsell-pages-list" style="max-height: 450px; overflow-y: auto; margin-bottom: 20px;">
                        <!-- Lista de páginas será inserida aqui -->
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end; padding-top: 20px; border-top: 1px solid var(--border-color);">
                        <button onclick="fecharModalSelecionarUpsell()" class="btn btn-secondary" style="padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: var(--bg-input); color: var(--text-primary); transition: all 0.3s;">Cancelar</button>
                        <button onclick="criarNovaPaginaUpsell()" class="btn btn-info" style="padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.3)'">
                            <i class="fas fa-plus"></i> Criar Nova Página
                        </button>
                    </div>
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
            <div class="upsell-page-item" style="border: 2px solid ${isSelected ? '#667eea' : 'var(--border-color)'}; border-radius: 12px; padding: 20px; margin-bottom: 12px; cursor: pointer; transition: all 0.3s; background: ${isSelected ? 'rgba(102, 126, 234, 0.1)' : 'var(--bg-input)'}; box-shadow: ${isSelected ? '0 4px 12px rgba(102, 126, 234, 0.15)' : 'none'};" 
                 onclick="selecionarPaginaUpsell('${produtoId}', '${pagina.id}', '${escapeHtml(pagina.titulo)}')"
                 onmouseover="this.style.borderColor='#667eea'; this.style.background='rgba(102, 126, 234, 0.15)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.2)';"
                 onmouseout="this.style.borderColor='${isSelected ? '#667eea' : 'var(--border-color)'}'; this.style.background='${isSelected ? 'rgba(102, 126, 234, 0.1)' : 'var(--bg-input)'}'; this.style.transform='translateY(0)'; this.style.boxShadow='${isSelected ? '0 4px 12px rgba(102, 126, 234, 0.15)' : 'none'}'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
                                <i class="fas fa-arrow-up"></i>
                            </div>
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 4px 0; color: var(--text-primary); font-weight: 600; font-size: 16px;">${escapeHtml(pagina.titulo)}</h4>
                                <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">${escapeHtml(pagina.nome_produto || 'Sem produto associado')}</p>
                            </div>
                        </div>
                        ${isSelected ? '<div style="display: flex; align-items: center; gap: 6px; color: #667eea; font-size: 13px; font-weight: 600; margin-top: 8px;"><i class="fas fa-check-circle"></i> Página atual selecionada</div>' : ''}
                    </div>
                    <i class="fas fa-chevron-right" style="color: var(--text-secondary); font-size: 18px; margin-left: 16px;"></i>
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

// Confirmar exclusão com melhor UX
function confirmarExclusao(produtoId, produtoNome) {
    produtoParaExcluir = produtoId;
    
    // Encontrar o produto para obter o ID customizado
    const produto = produtos.find(p => p.id === produtoId);
    const customId = produto?.custom_id || produto?.customId || produtoId;
    
    // Definir texto de confirmação
    confirmationText = `DELETE#${customId}`;
    
    // Atualizar elementos do modal
    modalMensagem.innerHTML = `
        Você está prestes a excluir permanentemente o produto <strong>"${escapeHtml(produtoNome)}"</strong>.<br><br>
        <strong>⚠️ Esta ação não pode ser desfeita!</strong><br><br>
        Todos os dados relacionados a este produto serão removidos, incluindo:
        <ul style="margin: 12px 0; padding-left: 20px; color: var(--text-secondary);">
            <li>Informações do produto</li>
            <li>Histórico de vendas associado</li>
            <li>Configurações de upsell</li>
            <li>Order bumps relacionados</li>
        </ul>
    `;
    
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
        btnConfirmar.innerHTML = '<i class="fas fa-trash-alt"></i> Confirmar Exclusão';
    }
    
    // Resetar animação do modal
    const modalContent = document.querySelector('#modal-confirmacao .modal-content');
    if (modalContent) {
        modalContent.style.animation = '';
    }
    
    modalConfirmacao.style.display = 'flex';
    
    // Focar no campo de entrada após animação
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
        
        // Adicionar feedback visual de sucesso
        btnConfirmar.style.transform = 'scale(1.02)';
        setTimeout(() => {
            if (btnConfirmar) btnConfirmar.style.transform = '';
        }, 200);
    } else if (inputValue.length > 0) {
        input.classList.remove('valid');
        input.classList.add('invalid');
        btnConfirmar.disabled = true;
        
        // Feedback visual de erro
        input.style.animation = 'shake 0.3s';
        setTimeout(() => {
            if (input) input.style.animation = '';
        }, 300);
    } else {
        input.classList.remove('valid', 'invalid');
        btnConfirmar.disabled = true;
    }
}

// Adicionar estilos de animação se não existirem (será adicionado uma vez)
if (typeof window.deleteModalStylesAdded === 'undefined') {
    window.deleteModalStylesAdded = true;
    if (!document.getElementById('delete-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'delete-modal-styles';
        style.textContent = `
            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-8px); }
                75% { transform: translateX(8px); }
            }
            @keyframes modalFadeOut {
                from { 
                    opacity: 1; 
                    transform: translateY(0) scale(1); 
                }
                to { 
                    opacity: 0; 
                    transform: translateY(-20px) scale(0.95); 
                }
            }
        `;
        document.head.appendChild(style);
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

// Excluir produto com feedback visual aprimorado
async function excluirProduto(produtoId) {
    const btnConfirmar = document.getElementById('btn-confirmar');
    const modalContent = document.querySelector('#modal-confirmacao .modal-content');
    
    try {
        // Mostrar estado de carregamento
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        }
        
        if (modalContent) {
            modalContent.style.opacity = '0.7';
            modalContent.style.pointerEvents = 'none';
        }
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado. Faça login novamente.');
            restaurarBotaoConfirmar();
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
            restaurarBotaoConfirmar();
            return;
        }
        
        const data = await response.json();
        
        if (response.ok) {
            // Feedback visual de sucesso
            if (modalContent) {
                modalContent.style.animation = 'modalFadeOut 0.3s ease';
            }
            
            mostrarSucesso('Produto excluído com sucesso!');
            
            // Remover produto da lista
            produtos = produtos.filter(p => p.id !== produtoId);
            
            // Fechar modal após animação
            setTimeout(() => {
                fecharModal();
                renderizarProdutos();
            }, 300);
            
            // Verificar se não há mais produtos
            if (produtos.length === 0) {
                setTimeout(() => {
                    produtosContainer.style.display = 'none';
                    emptyState.style.display = 'block';
                }, 400);
            }
        } else {
            restaurarBotaoConfirmar();
            mostrarErro(data.erro || data.message || 'Erro ao excluir produto');
        }
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        restaurarBotaoConfirmar();
        mostrarErro('Erro de conexão com o servidor. Verifique sua internet e tente novamente.');
    } finally {
        if (modalContent) {
            modalContent.style.opacity = '';
            modalContent.style.pointerEvents = '';
        }
    }
}

// Restaurar botão de confirmação ao estado original
function restaurarBotaoConfirmar() {
    const btnConfirmar = document.getElementById('btn-confirmar');
    if (btnConfirmar) {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<i class="fas fa-trash-alt"></i> Confirmar Exclusão';
    }
}

// Estilos de animação já foram adicionados acima

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

// Solicitar aprovação de produto rejeitado
async function solicitarAprovacaoProduto(produtoId) {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            mostrarErro('Usuário não autenticado');
            return;
        }

        // Enviar solicitação de aprovação (o backend buscará os dados do produto)
        const response = await fetch(`${window.API_BASE}/produtos/${produtoId}/solicitar-aprovacao`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            mostrarSucesso('Solicitação de aprovação enviada com sucesso! O administrador será notificado.');
            // Recarregar produtos para atualizar status
            await carregarProdutos();
        } else {
            mostrarErro(data.message || data.erro || 'Erro ao solicitar aprovação');
        }
    } catch (error) {
        console.error('Erro ao solicitar aprovação:', error);
        mostrarErro('Erro de conexão ao solicitar aprovação');
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


