/**
 * Dashboard do Afiliado - Lógica Principal
 * Usa o sistema de autenticação melhorado com refresh tokens
 */

// Configurações
const API_BASE = window.location.origin.includes('localhost') 
    ? 'http://localhost:4000/api' 
    : `${window.location.origin}/api`;

// Variáveis globais
let afiliado = null;
let links = [];
let estatisticas = {};

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
        
        // Carregar links primeiro, depois estatísticas
        await carregarLinks();
        await carregarEstatisticas();
        
        atualizarInterface();
        
        // Configurar atualização automática
        configurarAtualizacaoAutomatica();
        
        mostrarLoading(false);
        
        return true; // Retornar sucesso
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados: ' + error.message, 'danger');
        mostrarLoading(false);
        return false;
    }
}

// Carregar estatísticas
async function carregarEstatisticas() {
    try {
        // Calcular total de cliques baseado nos links carregados
        const totalCliques = links.reduce((total, link) => total + (link.cliques || 0), 0);
        
        estatisticas = {
            totalVendas: afiliado.total_vendas || 0,
            totalComissoes: afiliado.total_comissoes || 0,
            saldoDisponivel: afiliado.saldo_disponivel || 0,
            totalCliques: totalCliques
        };
        
        console.log('✅ Estatísticas carregadas - Total de cliques:', totalCliques);
    } catch (error) {
        console.error('❌ Erro ao carregar estatísticas:', error);
    }
}

// Carregar links
async function carregarLinks() {
    try {
        // Usar requisição autenticada com refresh automático
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/meus-links`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            links = data.data || [];
            console.log('✅ Links carregados da API:', links.length);
            
            // Renderizar tabela automaticamente após carregar
            renderizarTabelaLinks();
            
            // Atualizar estatísticas com os novos dados
            await carregarEstatisticas();
            atualizarInterface();
        } else {
            console.log('⚠️ Erro ao carregar links - Status:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.log('Erro:', errorData);
            links = [];
            
            // Renderizar tabela vazia em caso de erro
            renderizarTabelaLinks();
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar links:', error);
        links = [];
        renderizarTabelaLinks();
    }
}

// Atualizar interface
function atualizarInterface() {
    // Atualizar navbar
    const nomeElement = document.getElementById('afiliadoNome');
    if (nomeElement && afiliado) {
        nomeElement.textContent = afiliado.nome;
    }
    
    // Atualizar estatísticas
    const totalVendasEl = document.getElementById('totalVendas');
    const totalComissoesEl = document.getElementById('totalComissoes');
    const saldoDisponivelEl = document.getElementById('saldoDisponivel');
    const totalCliquesEl = document.getElementById('totalCliques');
    
    if (totalVendasEl) totalVendasEl.textContent = estatisticas.totalVendas || 0;
    if (totalComissoesEl) totalComissoesEl.textContent = `MZN ${parseFloat(estatisticas.totalComissoes || 0).toFixed(2)}`;
    if (saldoDisponivelEl) saldoDisponivelEl.textContent = `MZN ${parseFloat(estatisticas.saldoDisponivel || 0).toFixed(2)}`;
    if (totalCliquesEl) totalCliquesEl.textContent = estatisticas.totalCliques || 0;
}

// Renderizar tabela de links
function renderizarTabelaLinks() {
    const tbody = document.getElementById('linksTable');
    if (!tbody) return;
    
    if (links.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-link"></i>
                    <p>Nenhum link criado ainda</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = links.map(link => {
        // Extrair referência do link
        const refMatch = link.link_afiliado ? link.link_afiliado.match(/ref=([^&]+)/) : null;
        const referencia = refMatch ? refMatch[1] : 'N/A';
        
        return `
            <tr>
                <td><strong>${link.produto?.nome || 'Produto'}</strong></td>
                <td>
                    <code style="font-size: 0.8rem; background: #e3f2fd; padding: 4px 8px; border-radius: 4px; color: #1976d2; font-weight: bold;">${referencia}</code>
                </td>
                <td>
                    <code style="font-size: 0.8rem; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${link.link_afiliado || 'N/A'}</code>
                </td>
                <td><span class="badge badge-info">${link.cliques || 0}</span></td>
                <td><span class="badge badge-success">${link.conversoes || 0}</span></td>
                <td><span class="badge ${parseFloat(link.taxa_conversao || 0) >= 15 ? 'badge-success' : parseFloat(link.taxa_conversao || 0) >= 10 ? 'badge-warning' : 'badge-info'}">${link.taxa_conversao || '0.00%'}</span></td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-action btn-sm" onclick="copiarLink('${(link.link_afiliado || '').replace(/'/g, "\\'")}')" title="Copiar Link">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-outline-action btn-sm" onclick="verEstatisticas('${link.id}')" title="Ver Estatísticas">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Copiar link
function copiarLink(link) {
    navigator.clipboard.writeText(link).then(() => {
        mostrarNotificacao('Link copiado para a área de transferência!', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        mostrarNotificacao('Erro ao copiar link. Tente selecionar e copiar manualmente.', 'danger');
    });
}

// Ver estatísticas
function verEstatisticas(linkId) {
    const link = links.find(l => l.id === linkId);
    if (!link) return;
    
    // Extrair referência do link
    const refMatch = link.link_afiliado ? link.link_afiliado.match(/ref=([^&]+)/) : null;
    const referencia = refMatch ? refMatch[1] : 'N/A';
    
    const mensagem = `Estatísticas do Link:\n\n` +
          `Produto: ${link.produto?.nome || 'Produto'}\n` +
          `Referência: ${referencia}\n` +
          `Cliques: ${link.cliques || 0}\n` +
          `Vendas: ${link.conversoes || 0}\n` +
          `Taxa de Conversão: ${link.taxa_conversao || '0.00%'}\n` +
          `Último Clique: ${link.ultimo_clique ? new Date(link.ultimo_clique).toLocaleString() : 'Nunca'}\n` +
          `Link: ${link.link_afiliado || 'N/A'}`;
    
    alert(mensagem);
}

// Mostrar loading
function mostrarLoading(mostrar) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = mostrar ? 'block' : 'none';
    }
}

// Configurar atualização automática
function configurarAtualizacaoAutomatica() {
    // Atualizar links a cada 30 segundos
    setInterval(async () => {
        console.log('🔄 Atualizando links automaticamente...');
        await carregarLinks();
    }, 30000);
}

// Adicionar novo link à tabela
function adicionarNovoLink(linkData) {
    console.log('✅ Adicionando novo link:', linkData);
    
    // Adicionar à lista de links
    links.unshift(linkData);
    
    // Atualizar tabela
    renderizarTabelaLinks();
    
    // Mostrar notificação
    mostrarNotificacao('Link gerado com sucesso!', 'success');
}

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo = 'info') {
    // Criar elemento de notificação
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
    
    // Remover após 5 segundos
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

// ==================== FUNÇÕES DE BANNERS ====================

let banners = [];
let produtos = [];

// Carregar banners
async function carregarBanners() {
    try {
        // Verificar autenticação antes de fazer a requisição
        if (!window.afiliadoAuth || !window.afiliadoAuth.isAuthenticated()) {
            console.warn('⚠️ Não autenticado, pulando carregamento de banners');
            banners = [];
            renderizarTabelaBanners();
            return;
        }

        // Verificar e atualizar token se necessário
        const verification = await window.afiliadoAuth.verifyToken();
        if (!verification.valid) {
            console.warn('⚠️ Token inválido, pulando carregamento de banners');
            banners = [];
            renderizarTabelaBanners();
            return;
        }

        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/banners`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            banners = data.data || [];
            console.log('✅ Banners carregados:', banners.length);
            renderizarTabelaBanners();
        } else {
            // Se for 401, tentar refresh e tentar novamente
            if (response.status === 401) {
                try {
                    await window.afiliadoAuth.refreshToken();
                    // Tentar novamente após refresh
                    const retryResponse = await window.afiliadoAuth.authenticatedFetch(
                        `${API_BASE}/afiliados/banners`,
                        {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    
                    if (retryResponse.ok) {
                        const data = await retryResponse.json();
                        banners = data.data || [];
                        console.log('✅ Banners carregados após refresh:', banners.length);
                        renderizarTabelaBanners();
                    } else {
                        console.error('❌ Erro ao carregar banners após refresh:', retryResponse.status);
                        banners = [];
                        renderizarTabelaBanners();
                    }
                } catch (refreshError) {
                    console.error('❌ Erro ao fazer refresh do token:', refreshError);
                    banners = [];
                    renderizarTabelaBanners();
                }
            } else {
                console.error('❌ Erro ao carregar banners:', response.status);
                banners = [];
                renderizarTabelaBanners();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar banners:', error);
        banners = [];
        renderizarTabelaBanners();
    }
}

// Carregar produtos para seleção
async function carregarProdutos() {
    try {
        const response = await fetch(`${API_BASE}/produtos/public`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            produtos = data.produtos || [];
            
            const select = document.getElementById('bannerProduto');
            if (select) {
                select.innerHTML = '<option value="">Selecione um produto (ou deixe vazio para link genérico)</option>';
                produtos.forEach(produto => {
                    const option = document.createElement('option');
                    option.value = produto.id;
                    option.textContent = produto.nome;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
    }
}

// Renderizar tabela de banners
function renderizarTabelaBanners() {
    const tbody = document.getElementById('bannersTable');
    if (!tbody) return;
    
    if (banners.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fas fa-image"></i>
                    <p>Nenhum banner criado ainda</p>
                    <button class="btn btn-action mt-3" onclick="abrirModalCriarBanner()">
                        <i class="fas fa-plus"></i> Criar Primeiro Banner
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = banners.map(banner => `
        <tr>
            <td>
                <img src="${banner.imagem_url}" alt="${banner.titulo}" 
                     style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e9ecef;">
            </td>
            <td><strong>${banner.titulo}</strong></td>
            <td>${banner.mensagem || '<em>Sem mensagem</em>'}</td>
            <td>${banner.produto ? banner.produto.nome : '<em>Link genérico</em>'}</td>
            <td><span class="badge badge-info">${banner.cliques || 0}</span></td>
            <td>
                <span class="badge ${banner.ativo ? 'badge-success' : 'badge-warning'}">
                    ${banner.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="btn-group" role="group">
                    <button class="btn btn-action btn-sm" onclick="copiarCodigoBanner('${banner.id}')" title="Copiar Código HTML">
                        <i class="fas fa-code"></i>
                    </button>
                    <button class="btn btn-outline-action btn-sm" onclick="editarBanner('${banner.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-action btn-sm" onclick="toggleBannerStatus('${banner.id}', ${!banner.ativo})" title="${banner.ativo ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${banner.ativo ? 'eye-slash' : 'eye'}"></i>
                    </button>
                    <button class="btn btn-outline-action btn-sm" onclick="deletarBanner('${banner.id}')" title="Deletar" style="color: #dc3545;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Abrir modal para criar banner
function abrirModalCriarBanner() {
    document.getElementById('modalBannerTitle').textContent = 'Criar Banner';
    document.getElementById('formBanner').reset();
    document.getElementById('bannerId').value = '';
    document.getElementById('bannerPreview').style.display = 'none';
    document.getElementById('bannerCodigoHtmlContainer').style.display = 'none';
    document.getElementById('bannerImagemUrl').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('modalBanner'));
    modal.show();
    
    // Carregar produtos se ainda não foram carregados
    if (produtos.length === 0) {
        carregarProdutos();
    }
}

// Preview da imagem
function previewBannerImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        document.getElementById('bannerPreviewImg').src = e.target.result;
        document.getElementById('bannerPreview').style.display = 'block';
        
        // Fazer upload da imagem
        await fazerUploadImagem(file);
    };
    reader.readAsDataURL(file);
}

// Fazer upload da imagem
async function fazerUploadImagem(file) {
    try {
        // Validar tamanho do arquivo (5MB)
        if (file.size > 5 * 1024 * 1024) {
            mostrarNotificacao('Arquivo muito grande. Tamanho máximo: 5MB', 'warning');
            return;
        }
        
        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            mostrarNotificacao('Tipo de arquivo não suportado. Use: JPEG, PNG, GIF ou WebP', 'warning');
            return;
        }
        
        mostrarNotificacao('Enviando imagem...', 'info');
        
        const formData = new FormData();
        formData.append('imagem', file);
        
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/banners/upload-imagem`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            if (data.url) {
                document.getElementById('bannerImagemUrl').value = data.url;
                mostrarNotificacao('Imagem enviada com sucesso!', 'success');
            } else {
                mostrarNotificacao('Erro: URL da imagem não recebida', 'danger');
            }
        } else {
            const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
            mostrarNotificacao('Erro ao enviar imagem: ' + (error.message || 'Erro desconhecido'), 'danger');
        }
    } catch (error) {
        console.error('Erro no upload:', error);
        mostrarNotificacao('Erro ao enviar imagem: ' + (error.message || 'Erro de conexão'), 'danger');
    }
}

// Salvar banner
async function salvarBanner() {
    try {
        const titulo = document.getElementById('bannerTitulo').value.trim();
        const mensagem = document.getElementById('bannerMensagem').value.trim();
        const imagem_url = document.getElementById('bannerImagemUrl').value.trim();
        const produto_id = document.getElementById('bannerProduto').value || null;
        
        if (!titulo) {
            mostrarNotificacao('Título é obrigatório', 'warning');
            document.getElementById('bannerTitulo').focus();
            return;
        }
        
        if (!imagem_url) {
            mostrarNotificacao('Imagem é obrigatória. Por favor, faça upload de uma imagem primeiro.', 'warning');
            document.getElementById('bannerImagem').focus();
            return;
        }
        
        const bannerData = {
            titulo: titulo,
            mensagem: mensagem || null,
            imagem_url: imagem_url,
            produto_id: produto_id
        };
        
        const bannerId = document.getElementById('bannerId').value;
        const url = bannerId 
            ? `${API_BASE}/afiliados/banners/${bannerId}`
            : `${API_BASE}/afiliados/banners`;
        const method = bannerId ? 'PUT' : 'POST';
        
        mostrarNotificacao('Salvando banner...', 'info');
        
        const response = await window.afiliadoAuth.authenticatedFetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bannerData)
        });
        
        if (response.ok) {
            const data = await response.json();
            mostrarNotificacao(data.message || 'Banner salvo com sucesso!', 'success');
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalBanner'));
            if (modal) {
                modal.hide();
            }
            
            // Recarregar banners
            await carregarBanners();
            
            // Mostrar código HTML se foi criado
            if (data.data && data.data.codigo_html) {
                document.getElementById('bannerCodigoHtml').value = data.data.codigo_html;
                document.getElementById('bannerCodigoHtmlContainer').style.display = 'block';
            }
        } else {
            const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
            mostrarNotificacao('Erro ao salvar banner: ' + (error.message || 'Erro desconhecido'), 'danger');
        }
    } catch (error) {
        console.error('Erro ao salvar banner:', error);
        mostrarNotificacao('Erro ao salvar banner: ' + (error.message || 'Erro de conexão'), 'danger');
    }
}

// Editar banner
function editarBanner(bannerId) {
    const banner = banners.find(b => b.id === bannerId);
    if (!banner) return;
    
    document.getElementById('modalBannerTitle').textContent = 'Editar Banner';
    document.getElementById('bannerId').value = banner.id;
    document.getElementById('bannerTitulo').value = banner.titulo;
    document.getElementById('bannerMensagem').value = banner.mensagem || '';
    document.getElementById('bannerImagemUrl').value = banner.imagem_url;
    document.getElementById('bannerProduto').value = banner.produto_id || '';
    document.getElementById('bannerCodigoHtml').value = banner.codigo_html || '';
    
    // Mostrar preview
    document.getElementById('bannerPreviewImg').src = banner.imagem_url;
    document.getElementById('bannerPreview').style.display = 'block';
    document.getElementById('bannerCodigoHtmlContainer').style.display = 'block';
    
    const modal = new bootstrap.Modal(document.getElementById('modalBanner'));
    modal.show();
    
    // Carregar produtos se necessário
    if (produtos.length === 0) {
        carregarProdutos();
    }
}

// Toggle status do banner
async function toggleBannerStatus(bannerId, novoStatus) {
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/banners/${bannerId}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ativo: novoStatus })
            }
        );
        
        if (response.ok) {
            mostrarNotificacao(`Banner ${novoStatus ? 'ativado' : 'desativado'} com sucesso!`, 'success');
            await carregarBanners();
        } else {
            const error = await response.json();
            mostrarNotificacao('Erro ao atualizar status: ' + (error.message || 'Erro desconhecido'), 'danger');
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        mostrarNotificacao('Erro ao atualizar status do banner', 'danger');
    }
}

// Deletar banner
async function deletarBanner(bannerId) {
    if (!confirm('Tem certeza que deseja deletar este banner?')) return;
    
    try {
        const response = await window.afiliadoAuth.authenticatedFetch(
            `${API_BASE}/afiliados/banners/${bannerId}`,
            {
                method: 'DELETE'
            }
        );
        
        if (response.ok) {
            mostrarNotificacao('Banner deletado com sucesso!', 'success');
            await carregarBanners();
        } else {
            const error = await response.json();
            mostrarNotificacao('Erro ao deletar banner: ' + (error.message || 'Erro desconhecido'), 'danger');
        }
    } catch (error) {
        console.error('Erro ao deletar banner:', error);
        mostrarNotificacao('Erro ao deletar banner', 'danger');
    }
}

// Copiar código HTML do banner
function copiarCodigoBanner(bannerId) {
    const banner = banners.find(b => b.id === bannerId);
    if (!banner || !banner.codigo_html) {
        mostrarNotificacao('Código HTML não disponível', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(banner.codigo_html).then(() => {
        mostrarNotificacao('Código HTML copiado para a área de transferência!', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        mostrarNotificacao('Erro ao copiar código. Tente selecionar e copiar manualmente.', 'danger');
    });
}

// Copiar código HTML do formulário
function copiarCodigoHtml() {
    const codigo = document.getElementById('bannerCodigoHtml').value;
    if (!codigo) {
        mostrarNotificacao('Nenhum código HTML disponível', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(codigo).then(() => {
        mostrarNotificacao('Código HTML copiado!', 'success');
    }).catch(err => {
        console.error('Erro ao copiar:', err);
        mostrarNotificacao('Erro ao copiar código', 'danger');
    });
}

// Inicializar página
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Inicializando dashboard do afiliado...');
    
    // Carregar dados primeiro (inclui autenticação)
    await carregarDados();
    
    // Depois carregar banners (após autenticação estar completa)
    await carregarBanners();
});

