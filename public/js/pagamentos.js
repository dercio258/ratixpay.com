// Configuração da API
// Usar a variável API_BASE já definida em config.js

// Elementos do DOM
const receitaTotalEl = document.getElementById('receitaTotal');
const btnSaqueEl = document.getElementById('btnSaque');
const saqueAtualEl = document.getElementById('saqueAtual');
const saqueDetailsEl = document.getElementById('saqueDetails');
const historicoSaquesEl = document.getElementById('historicoSaques');
const modalSaqueEl = document.getElementById('modalSaque');
const formSaqueEl = document.getElementById('formSaque');
const valorSaqueEl = document.getElementById('valorSaque');
const nomeTitularEl = document.getElementById('nomeTitular');
const telefoneTitularEl = document.getElementById('telefoneTitular');
const metodoSaqueEl = document.getElementById('metodoSaque');
const btnConfirmarSaqueEl = document.getElementById('btnConfirmarSaque');

// Variáveis globais
let receitaTotal = 0;
let saqueAtual = null;

// Função para formatar valores monetários
function formatCurrency(value) {
    // Verificar se o valor é válido
    if (value === null || value === undefined || isNaN(value)) {
        value = 0;
    }
    
    // Garantir que sempre use MZN em vez de MTn
    const formatted = new Intl.NumberFormat('pt-MZ', {
        style: 'currency',
        currency: 'MZN'
    }).format(value);
    
    // Substituir MTn por MZN se necessário
    return formatted.replace('MTn', 'MZN');
}

// Função para formatar datas
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-MZ', {
        day: '2-digit',
    });
}

// Função para gerar ID único no formato WDW + vendedorId + dataCriacao + 2 dígitos aleatórios
function generateUniqueId(vendedorId) {
    const now = new Date();
    
    // Formatar data: ddMMyyyyHHmmss
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = String(now.getFullYear());
    const hora = String(now.getHours()).padStart(2, '0');
    const minuto = String(now.getMinutes()).padStart(2, '0');
    const segundo = String(now.getSeconds()).padStart(2, '0');
    
    const dataCriacao = `${dia}${mes}${ano}${hora}${minuto}${segundo}`;
    
    // Gerar 2 dígitos aleatórios
    const digitosAleatorios = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    
    // Montar o ID: WDW + vendedorId + dataCriacao + 2 dígitos aleatórios
    const idSaque = `WDW${vendedorId}${dataCriacao}${digitosAleatorios}`;
    
    
    return idSaque;
}

// Função para atualizar receita em tempo real
async function atualizarReceitaEmTempoReal() {
    try {
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Chamar endpoint para atualizar receita
        
        const response = await fetch(`/api/saques/atualizar-receita`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // Atualizar variável global
            receitaTotal = parseFloat(data.data.receitaDisponivel || 0);
            
            // Atualizar elemento na página
            if (receitaTotalEl) {
                receitaTotalEl.textContent = formatCurrency(receitaTotal);
            }
            
            
            // Atualizar botão de saque
            if (typeof atualizarBotaoSaque === 'function') {
                atualizarBotaoSaque();
            } else {
                // Implementação inline se a função não existir
                if (btnSaqueEl) {
                    btnSaqueEl.disabled = receitaTotal < 1;
                    btnSaqueEl.textContent = receitaTotal < 1 ? 'Saldo Insuficiente' : 'Solicitar Saque';
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar receita em tempo real:', error);
    }
}

// Função para carregar receita total (nova lógica sem saques pendentes)
async function loadReceitaTotal() {
    try {
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Buscar receita total usando endpoint unificado
        
        const response = await fetch(`/api/dashboard/vendedor/receita-unificada`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            // LÓGICA CORRETA: Mostrar receita disponível (total - saques processados)
            receitaTotal = parseFloat(data.data.receitaDisponivel || 0);
            
            // Mostrar informações detalhadas
            const receitaVendas = parseFloat(data.data.receitaTotal || 0);
            const saquesProcessados = parseFloat(data.data.valorSaquesProcessados || 0);
            
            // Atualizar elemento com informações detalhadas
            receitaTotalEl.innerHTML = `
                <div class="receita-principal">${formatCurrency(receitaTotal)}</div>
                <div class="receita-detalhes">
                    <small>Receita Acumulada: ${formatCurrency(receitaVendas)}</small><br>
                    <small>Saques Processados: ${formatCurrency(saquesProcessados)}</small>
                </div>
            `;
        } else {
            throw new Error('Dados de receita não disponíveis');
        }
        
        // Habilitar/desabilitar botão de saque
        btnSaqueEl.disabled = receitaTotal < 1;
        
        
    } catch (error) {
        console.error('❌ Erro ao carregar receita total:', error);
        receitaTotalEl.textContent = 'MZN 0,00';
        btnSaqueEl.disabled = true;
    }
}

// Função para carregar saque atual (com sistema de status)
async function loadSaqueAtual() {
    try {
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Buscar saque pendente do vendedor
        const response = await fetch(`/api/saques/vendedor/pendente`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
                const saque = data.data;
                mostrarSaqueAtual(saque);
                
                // Verificar se houve mudança de status e mostrar notificação
                if (saqueAtual && saqueAtual.id === saque.id && saqueAtual.status !== saque.status) {
                    mostrarNotificacaoStatus(saque);
                }
                
                // Atualizar saque atual
                saqueAtual = saque;
            } else {
                // Não há saque pendente
                if (saqueAtualEl) {
                    saqueAtualEl.style.display = 'none';
                }
                saqueAtual = null;
            }
        } else {
            // Não há saque pendente
            if (saqueAtualEl) {
                saqueAtualEl.style.display = 'none';
            }
            saqueAtual = null;
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar saque atual:', error);
        if (saqueAtualEl) {
            saqueAtualEl.style.display = 'none';
        }
    }
}

        // Função para mostrar saque atual
        function mostrarSaqueAtual(saque) {
            saqueAtualEl.style.display = 'block';
            
            // Atualizar título com status
            const statusTitle = document.getElementById('saqueStatusTitle');
            if (statusTitle) {
                const statusText = getStatusText(saque.status);
                statusTitle.textContent = statusText;
            }
            
            // Mostrar detalhes do saque (formato simplificado)
            const idSaque = saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-');
            
            saqueDetailsEl.innerHTML = `
                <div class="saque-detail">
                    <strong>ID do Saque</strong>
                    <span>${idSaque}</span>
                </div>
                <div class="saque-detail">
                    <strong>Nome do Titular</strong>
                    <span>${saque.nomeTitular || 'N/A'}</span>
                </div>
                <div class="saque-detail">
                    <strong>Valor</strong>
                    <span>${formatCurrency(saque.valor || 0)}</span>
                </div>
                <div class="saque-detail">
                    <strong>Status</strong>
                    <span class="status-badge status-${saque.status || 'pendente'}">${(saque.status || 'pendente').toUpperCase()}</span>
                </div>
            `;
            
            // Mostrar ações baseadas no status
            mostrarAcoesSaque(saque);
        }

        // Função para obter texto do status
        function getStatusText(status) {
            switch (status) {
                case 'pendente': return 'Saque Pendente';
                case 'pago': return 'Saque Pago';
                case 'cancelado': return 'Saque Cancelado';
            }
        }

        // Função para mostrar ações do saque
        function mostrarAcoesSaque(saque) {
            const acoesEl = document.getElementById('saqueActions');
            if (!acoesEl) return;

            let acoesHTML = '';
            
            switch (saque.status) {
                case 'pendente':
                    acoesHTML = `
                        <button class="btn-status btn-ver-status" onclick="verStatusSaque('${saque.id}')">
                            <i class="fas fa-clock"></i> Aguardando Aprovação
                        </button>
                    `;
                    break;
                case 'pago':
                    acoesHTML = `
                        <span class="text-success">
                            <i class="fas fa-check-circle"></i> Saque Processado
                        </span>
                    `;
                    break;
                case 'cancelado':
                    acoesHTML = `
                        <button class="btn-status btn-ver-status" onclick="verStatusSaque('${saque.id}')">
                            <i class="fas fa-info-circle"></i> Ver Motivo do Cancelamento
                        </button>
                    `;
                    break;
                default:
                    acoesHTML = `
                        <button class="btn-status btn-ver-status" onclick="verStatusSaque('${saque.id}')">
                            <i class="fas fa-eye"></i> Ver Status
                        </button>
                    `;
            }
            
            acoesEl.innerHTML = acoesHTML;
        }

        // Função para ver status do saque
        function verStatusSaque(saqueId) {
            // Implementar modal ou página de detalhes do saque
            alert('Funcionalidade de ver status em desenvolvimento');
        }

        // Função para cancelar saque (vendedor)
        async function cancelarSaqueVendedor(saqueId) {
            if (!confirm('Tem certeza que deseja cancelar este saque?')) {
                return;
            }

            try {
                const token = localStorage.getItem('authToken') || localStorage.getItem('token');
                const response = await fetch(`/api/saques/${saqueId}/cancelar-vendedor`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: 'cancelado',
                    })
                });

                if (response.ok) {
                    alert('Saque cancelado com sucesso!');
                    // Recarregar dados
                    await loadSaqueAtual();
                    await loadReceitaTotal();
                    await loadHistoricoSaques();
                } else {
                    alert('Erro ao cancelar saque. Tente novamente.');
                }
            } catch (error) {
                console.error('Erro ao cancelar saque:', error);
                alert('Erro ao cancelar saque: ' + error.message);
            }
        }

// Função para carregar histórico de saques
async function loadHistoricoSaques() {
    try {
        
        // Mostrar loading
        historicoSaquesEl.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando histórico de saques...</p>
            </div>
        `;
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Buscar saques do vendedor
        
        const response = await fetch(`/api/saques/vendedor?limite=100`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const saques = data.data || [];
        
        // Renderizar histórico
        renderHistoricoSaques(saques);
        
        
    } catch (error) {
        console.error('❌ Erro ao carregar histórico de saques:', error);
        
        historicoSaquesEl.innerHTML = `
            <div class="loading">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar histórico de saques. Tente novamente.</p>
            </div>
        `;
    }
}

// Função para renderizar histórico de saques
function renderHistoricoSaques(saques) {
    
    if (!saques || saques.length === 0) {
        historicoSaquesEl.innerHTML = `
            <div class="no-data">
                <i class="fas fa-inbox"></i>
                <p>Nenhum saque encontrado</p>
            </div>
        `;
        return;
    }
    
    
    const historicoHTML = `
        <div class="table-wrapper">
            <table class="saques-table">
                <thead>
                    <tr>
                        <th>ID do Saque</th>
                        <th>Nome do Titular</th>
                        <th>Telefone</th>
                        <th>Valor</th>
                        <th>Método</th>
                        <th>Status</th>
                        <th>Data</th>
                    </tr>
                </thead>
                <tbody>
                    ${saques.map((saque, index) => {
                        const status = saque.status || 'pendente';
                        const valor = saque.valor || saque.valorSolicitado || 0;
                        const saqueId = saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-');
                        
                        return `
                        <tr>
                            <td>${saqueId || '-'}</td>
                            <td>${saque.nomeTitular || 'N/A'}</td>
                            <td>${saque.telefoneTitular || 'N/A'}</td>
                            <td>${formatCurrency(valor)}</td>
                            <td>${saque.metodoPagamento || saque.metodo || 'N/A'}</td>
                            <td><span class="status-badge status-${status}">${status}</span></td>
                            <td>${formatDate(saque.dataSolicitacao || saque.createdAt)}</td>
                        </tr>
                    `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    historicoSaquesEl.innerHTML = historicoHTML;
}

// Funções de confirmação de pagamento removidas - sistema agora processa saques automaticamente

// Função para abrir modal de saque
function abrirModalSaque() {
    // Validar se há receita suficiente
    if (receitaTotal < 1) {
        alert('Receita insuficiente para solicitar saque. Valor mínimo: MZN 1,00');
        return;
    }
    
    // Limpar formulário
    formSaqueEl.reset();
    
    // Definir valor máximo
    valorSaqueEl.max = receitaTotal;
    valorSaqueEl.placeholder = `Máximo: ${formatCurrency(receitaTotal)}`;
    
    // Mostrar modal
    modalSaqueEl.style.display = 'block';
    
    // Focar no primeiro campo
    valorSaqueEl.focus();
}

// Função para fechar modal de saque
function fecharModalSaque() {
    modalSaqueEl.style.display = 'none';
    formSaqueEl.reset();
}

// Função para solicitar saque
async function solicitarSaque(event) {
    event.preventDefault();
    
    try {
        // Desabilitar botão durante processamento
        btnConfirmarSaqueEl.disabled = true;
        btnConfirmarSaqueEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        
        // Obter dados do formulário
        const carteiraId = document.getElementById('carteiraSaque').value;
        const valorSaque = parseFloat(valorSaqueEl.value);
        const codigoAutenticacao = document.getElementById('codigoAutenticacao').value;
        
        // Validações
        if (!carteiraId) {
            mostrarErro('Selecione uma carteira para o saque');
            return;
        }
        
        if (valorSaque < 1) {
            mostrarErro('Valor mínimo para saque é MZN 1,00');
            return;
        }
        
        if (valorSaque > receitaTotal) {
            mostrarErro('Valor do saque não pode ser maior que a receita disponível');
            return;
        }
        
        if (!codigoAutenticacao || codigoAutenticacao.length !== 6) {
            mostrarErro('Digite o código de autenticação de 6 dígitos');
            return;
        }
        
        // Dados do saque simplificado
        const saqueData = {
            carteiraId: carteiraId,
            valor: valorSaque,
            codigoAutenticacao: codigoAutenticacao
        };
        
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Enviar solicitação para o servidor (endpoint para saques com carteiras)
        const response = await fetch('/api/carteiras/saque/processar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(saqueData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Fechar modal
            fecharModalSaque();
            
            // Mostrar sucesso
            const saque = result.saque;
            const calculoTaxas = result.calculoTaxas || {};
            
            let mensagemTaxas = '';
            if (calculoTaxas.taxaAdmin && calculoTaxas.valorLiquidoVendedor) {
                mensagemTaxas = `\n\n💰 Detalhes do Saque:\n   📊 Valor Total: MZN ${calculoTaxas.valorTotal.toFixed(2)}\n   💼 Taxa Admin (5%): MZN ${calculoTaxas.taxaAdmin.toFixed(2)}\n   👤 Você Receberá (95%): MZN ${calculoTaxas.valorLiquidoVendedor.toFixed(2)}`;
            }
            
            alert(`✅ Pedido de saque criado com sucesso!\n\n💰 Valor Solicitado: MZN ${saque.valor.toFixed(2)}\n💳 Carteira: ${saque.carteira}\n📱 Método: ${saque.metodoPagamento}\n⏳ Status: ${saque.status.toUpperCase()}${mensagemTaxas}\n\n📋 Seu pedido está aguardando aprovação do administrador.\n⏰ Você receberá uma notificação quando for processado.`);
            
            // Atualizar dados
            await loadReceitaTotal();
            await loadSaqueAtual();
            await loadHistoricoSaques();
            
        } else {
            throw new Error(result.message || 'Erro ao criar pedido de saque');
        }
        
    } catch (error) {
        console.error('❌ Erro ao solicitar saque:', error);
        alert('Erro ao solicitar saque: ' + error.message);
        
    } finally {
        // Reabilitar botão
        btnConfirmarSaqueEl.disabled = false;
        btnConfirmarSaqueEl.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
    }
}

// Função cancelarSaque removida - não há mais saques pendentes na nova lógica

// Função para inicializar a página
async function initializePage() {
    
    try {
        // Carregar dados iniciais (nova lógica sem saques pendentes)
        
        await Promise.all([
            loadReceitaTotal(),
            loadSaqueAtual(), // Apenas oculta a seção
            loadHistoricoSaques(),
            carregarCarteirasConfig() // Carregar carteiras para o modal de saque
            // verificarStatusSaque removido - não há mais saques pendentes
        ]);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
    }
    
    // Adicionar event listeners
    document.addEventListener('click', function(event) {
        if (event.target === modalSaqueEl) {
            fecharModalSaque();
        }
        
        // Botão de atualizar dados
        if (event.target.closest('#btnAtualizarDados')) {
            event.preventDefault();
            atualizarDadosManualmente();
        }
    });
    
            // Validar valor do saque em tempo real
        valorSaqueEl.addEventListener('input', function() {
            const valor = parseFloat(this.value);
            if (valor > receitaTotal) {
                this.setCustomValidity(`Valor máximo permitido: ${formatCurrency(receitaTotal)}`);
            } else if (valor < 1) {
                this.setCustomValidity('Valor mínimo: MZN 1,00');
            } else {
                this.setCustomValidity('');
            }
        });
    
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', initializePage);

// Função verificarStatusSaque removida - não há mais saques pendentes na nova lógica
// Todos os saques são processados imediatamente

// Função para atualizar interface com status do saque
function atualizarInterfaceStatusSaque(saque) {
    // Atualizar elemento de status se existir
    const statusElement = document.getElementById('statusSaque');
    if (statusElement) {
        statusElement.textContent = saque.mensagem;
        statusElement.className = `status-badge ${getStatusClass(saque.status)}`;
    }
    
    // Atualizar botões de ação baseado no status
    const btnSolicitarSaque = document.getElementById('btnSolicitarSaque');
    const btnCancelarSaque = document.getElementById('btnCancelarSaque');
    
    if (btnSolicitarSaque && btnCancelarSaque) {
        switch (saque.status) {
            case 'pendente':
                btnSolicitarSaque.style.display = 'none';
                btnCancelarSaque.style.display = 'inline-block';
                break;
            case 'pago':
            case 'cancelado':
                btnSolicitarSaque.style.display = 'inline-block';
                btnCancelarSaque.style.display = 'none';
                break;
                btnSolicitarSaque.style.display = 'inline-block';
                btnCancelarSaque.style.display = 'none';
        }
    }
}

// Função para mostrar notificação de mudança de status
function mostrarNotificacaoStatus(saque) {
    let titulo = 'Status do Saque Atualizado';
    let mensagem = saque.mensagem;
    let tipo = 'info';
    
    switch (saque.status) {
        case 'pago':
            tipo = 'success';
            titulo = 'Saque Pago!';
            break;
        case 'cancelado':
            tipo = 'warning';
            titulo = 'Saque Cancelado';
            break;
    }
    
    // Mostrar notificação
    if (typeof showNotification === 'function') {
        showNotification(mensagem, tipo, 5000);
    } else {
        alert(`${titulo}: ${mensagem}`);
    }
}

// Função para obter classe CSS do status
function getStatusClass(status) {
    switch (status) {
        case 'pendente': return 'status-pendente';
        case 'pago': return 'status-pago';
        case 'cancelado': return 'status-cancelado';
    }
}

// Função para atualizar dados em tempo real
function startAutoRefresh() {
    
    // Atualizar dados a cada 30 segundos
    setInterval(async () => {
        try {
            await loadReceitaTotal();
            await loadSaqueAtual(); // Verificar mudanças de status
            await loadHistoricoSaques();
        } catch (error) {
            console.error('❌ Erro na atualização automática:', error);
        }
    }, 30000);
}

// Iniciar auto-refresh para manter dados dinâmicos
startAutoRefresh();

// Função para atualizar dados manualmente
async function atualizarDadosManualmente() {
    const btnAtualizar = document.getElementById('btnAtualizarDados');
    if (btnAtualizar) {
        // Adicionar classe de loading
        btnAtualizar.classList.add('loading');
        btnAtualizar.disabled = true;
        
        try {
            await Promise.all([
                loadReceitaTotal(),
                loadSaqueAtual(), // Verificar mudanças de status
                loadHistoricoSaques()
            ]);
        } catch (error) {
            console.error('❌ Erro na atualização manual:', error);
        } finally {
            // Remover classe de loading
            btnAtualizar.classList.remove('loading');
            btnAtualizar.disabled = false;
        }
    }
}

// Função para atualizar botão de saque baseado na receita disponível
function atualizarBotaoSaque() {
    if (btnSaqueEl) {
        // Desabilitar botão se receita for menor que 1
        btnSaqueEl.disabled = receitaTotal < 1;
        
        // Atualizar texto do botão
        if (receitaTotal < 1) {
            btnSaqueEl.textContent = 'Receita Insuficiente';
            btnSaqueEl.className = 'btn btn-secondary';
        } else {
            btnSaqueEl.textContent = 'Solicitar Saque';
            btnSaqueEl.className = 'btn btn-primary';
        }
        
        // Atualizar tooltip
        btnSaqueEl.title = receitaTotal < 1 
            ? 'Receita insuficiente para solicitar saque' 
            : `Solicitar saque (Receita disponível: ${formatCurrency(receitaTotal)})`;
    }
    
    // Atualizar também o campo de valor máximo
    const valorSaqueInput = document.getElementById('valorSaque');
    if (valorSaqueInput) {
        valorSaqueInput.max = receitaTotal;
        valorSaqueInput.placeholder = `Máximo: ${formatCurrency(receitaTotal)}`;
    }
}

// ========== FUNÇÕES PARA CONFIGURAÇÕES DE PAGAMENTO ==========

// Variáveis globais para carteiras
let carteiras = [];
let carteiraAtual = null;

// Função para abrir modal de configurações
function abrirModalConfiguracoes() {
    const modal = document.getElementById('modalConfiguracoes');
    if (modal) {
        modal.style.display = 'block';
        carregarCarteirasConfig();
    }
}

// Função para fechar modal de configurações
function fecharModalConfiguracoes() {
    const modal = document.getElementById('modalConfiguracoes');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para abrir modal de nova carteira
function abrirModalNovaCarteira() {
    const modal = document.getElementById('modalNovaCarteira');
    if (modal) {
        modal.style.display = 'block';
        // Limpar formulário
        const form = document.getElementById('formNovaCarteira');
        if (form) {
            form.reset();
        }
    }
}

// Função para fechar modal de nova carteira
function fecharModalNovaCarteira() {
    const modal = document.getElementById('modalNovaCarteira');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para fechar modal de código
function fecharModalCodigo() {
    const modal = document.getElementById('modalCodigo');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Função para carregar carteiras na configuração
async function carregarCarteirasConfig() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        if (!token) {
            throw new Error('Token não encontrado');
        }

        const response = await fetch('/api/carteiras', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        
        if (response.ok) {
            const data = await response.json();
            carteiras = data.carteiras || [];
            renderizarCarteirasConfig();
            carregarCarteirasSelect();
        } else {
            const errorData = await response.json();
            throw new Error('Erro ao carregar carteiras');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar carteiras:', error);
        const container = document.getElementById('lista-carteiras-config');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erro ao carregar carteiras: ${error.message}
                </div>
            `;
        }
    }
}

// Função para renderizar carteiras na configuração
function renderizarCarteirasConfig() {
    const container = document.getElementById('lista-carteiras-config');
    if (!container) return;

    if (carteiras.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-wallet"></i>
                <h6>Nenhuma carteira configurada</h6>
                <p>Configure sua primeira carteira para começar a receber pagamentos</p>
            </div>
        `;
        return;
    }

    container.innerHTML = carteiras.map(carteira => `
        <div class="carteira-item">
            <div class="carteira-header">
                <div class="carteira-info">
                    <div class="carteira-icon">
                        <i class="${getMetodoIcon(carteira.metodo_saque)}"></i>
                    </div>
                    <div class="carteira-details">
                        <h6>${carteira.nome}</h6>
                        <p><i class="fas fa-user me-1"></i>${carteira.nome_titular}</p>
                        <p><i class="fas fa-phone me-1"></i>${carteira.contacto}</p>
                    </div>
                </div>
                <div class="carteira-actions">
                    <span class="metodo-badge">${carteira.metodo_saque}</span>
                    <span class="status-badge bg-success text-white">Ativa</span>
                    <button class="btn btn-outline-danger btn-carteira btn-sm" 
                            onclick="desativarCarteira('${carteira.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Função para carregar carteiras no select do modal de saque
function carregarCarteirasSelect() {
    const select = document.getElementById('carteiraSaque');
    
    if (!select) return;

    
    if (carteiras.length === 0) {
        select.innerHTML = '<option value="">Nenhuma carteira configurada</option>';
        select.disabled = true;
        return;
    }

    
    select.disabled = false;
    select.innerHTML = '<option value="">Selecione uma carteira...</option>' +
        carteiras.map(carteira => 
            `<option value="${carteira.id}">${carteira.nome} (${carteira.metodo_saque})</option>`
        ).join('');

    // Adicionar evento de mudança para mostrar detalhes da carteira
    select.addEventListener('change', function() {
        mostrarDetalhesCarteira(this.value);
    });
}

// Função para mostrar detalhes da carteira selecionada
function mostrarDetalhesCarteira(carteiraId) {
    const infoDiv = document.getElementById('carteiraInfo');
    const detalhesDiv = document.getElementById('carteiraDetalhes');
    
    if (!carteiraId || !infoDiv || !detalhesDiv) {
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }

    const carteira = carteiras.find(c => c.id === carteiraId);
    if (!carteira) {
        infoDiv.style.display = 'none';
        return;
    }

    detalhesDiv.innerHTML = `
        <p><strong>Titular:</strong> ${carteira.nome_titular}</p>
        <p><strong>Contacto:</strong> ${carteira.contacto}</p>
        <p><strong>Método:</strong> ${carteira.metodo_saque}</p>
        <p><strong>Email:</strong> ${carteira.email_titular}</p>
    `;
    
    infoDiv.style.display = 'block';
}

// Função para obter ícone do método de pagamento
function getMetodoIcon(metodo) {
    const icons = {
        'Mpesa': 'fas fa-mobile-alt',
        'Emola': 'fas fa-university',
        'BancABC': 'fas fa-university',
        'Outro': 'fas fa-credit-card'
    };
    return icons[metodo] || 'fas fa-credit-card';
}

// Função para criar nova carteira
async function criarCarteira() {
    try {
        const form = document.getElementById('formNovaCarteira');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const nomeCarteira = document.getElementById('nomeCarteira')?.value?.trim();
        
        if (!nomeCarteira) {
            mostrarErro('O nome da carteira é obrigatório');
            return;
        }

        const dados = {
            nome: nomeCarteira
        };

        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch('/api/carteiras', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });

        if (response.ok) {
            fecharModalNovaCarteira();
            mostrarSucesso('Carteira criada com sucesso!');
            carregarCarteirasConfig();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao criar carteira');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        
        // Mensagem de erro mais amigável
        let errorMessage = error.message || 'Erro ao criar carteira';
        
        // Tratar erros específicos
        if (errorMessage.includes('transação') || errorMessage.includes('transaction') || 
            errorMessage.includes('interrompida') || errorMessage.includes('interrupted')) {
            errorMessage = 'Erro ao processar solicitação. Por favor, aguarde alguns instantes e tente novamente.';
        } else if (errorMessage.includes('Limite máximo')) {
            errorMessage = 'Você já possui o número máximo de carteiras (2). Desative uma carteira existente para criar uma nova.';
        } else if (errorMessage.includes('nome')) {
            errorMessage = 'Já existe uma carteira com este nome. Escolha outro nome.';
        }
        
        mostrarErro(errorMessage);
    }
}

// Função para desativar carteira
async function desativarCarteira(carteiraId) {
    if (!confirm('Tem certeza que deseja desativar esta carteira?')) {
        return;
    }

    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/carteiras/${carteiraId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            mostrarSucesso('Carteira desativada com sucesso!');
            carregarCarteirasConfig();
        } else {
            throw new Error('Erro ao desativar carteira');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarErro('Erro ao desativar carteira');
    }
}

// Função para verificar código de autenticação
async function verificarCodigo() {
    const codigo = document.getElementById('codigoVerificacao').value;
    
    if (codigo.length !== 6) {
        mostrarErro('Digite o código completo de 6 dígitos');
        return;
    }

    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/carteiras/${carteiraAtual}/verificar-codigo`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ codigo })
        });

        if (response.ok) {
            fecharModalCodigo();
            mostrarSucesso('Código verificado com sucesso!');
            carregarCarteirasConfig();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Código inválido');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarErro(error.message);
    }
}

// Função para reenviar código
async function reenviarCodigo() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/carteiras/${carteiraAtual}/codigo`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            mostrarSucesso('Código reenviado com sucesso!');
        } else {
            throw new Error('Erro ao reenviar código');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarErro('Erro ao reenviar código');
    }
}

// Função para mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
    if (typeof showNotification === 'function') {
        showNotification(mensagem, 'success', 3000);
    } else {
        alert(mensagem);
    }
}

// Função para mostrar mensagem de erro
function mostrarErro(mensagem) {
    if (typeof showNotification === 'function') {
        showNotification(mensagem, 'error', 5000);
    } else {
        alert('Erro: ' + mensagem);
    }
}

// Função para solicitar código de autenticação para saque
async function solicitarCodigoSaque() {
    try {
        const carteiraId = document.getElementById('carteiraSaque').value;
        
        if (!carteiraId) {
            alert('Selecione uma carteira primeiro');
            return;
        }

        const btnSolicitarCodigo = document.getElementById('btnSolicitarCodigo');
        btnSolicitarCodigo.disabled = true;
        btnSolicitarCodigo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        
        
        const response = await fetch('/api/carteiras/saque/codigo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ carteiraId })
        });

        
        if (response.ok) {
            const result = await response.json();
            mostrarSucesso('Código enviado com sucesso para seu email!');
            
            // Código enviado instantaneamente - sem temporizador
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Erro ao enviar código');
        }
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarErro(error.message);
    } finally {
        const btnSolicitarCodigo = document.getElementById('btnSolicitarCodigo');
        btnSolicitarCodigo.disabled = false;
        btnSolicitarCodigo.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar Código';
    }
}

// Função removida - sistema de countdown não é mais necessário
// O código é enviado instantaneamente sem temporizador

// Fechar modais clicando fora deles
window.onclick = function(event) {
    const modals = ['modalConfiguracoes', 'modalNovaCarteira', 'modalCodigo'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}
