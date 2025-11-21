// Configuração da API
// Usar a variável API_BASE já definida em config.js

// Elementos do DOM
const receitaTotalEl = document.getElementById('receitaTotal');
const btnSaqueEl = document.getElementById('btnSaque');
const saqueAtualEl = document.getElementById('saqueAtual');
const saqueDetailsEl = document.getElementById('saqueDetails');
const historicoSaquesEl = document.getElementById('historicoSaques');
// Elementos antigos de modal removidos - agora usando campos inline
// const modalSaqueEl = document.getElementById('modalSaque'); // Removido
// const formSaqueEl = document.getElementById('formSaque'); // Removido
// const valorSaqueEl = document.getElementById('valorSaque'); // Removido
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
                const btnSaque = document.getElementById('btnSaque');
                if (btnSaque) {
                    btnSaque.disabled = receitaTotal < 1;
                    btnSaque.textContent = receitaTotal < 1 ? 'Saldo Insuficiente' : 'Solicitar Saque';
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
        
        // Habilitar/desabilitar botão de saque (se existir)
        const btnSaque = document.getElementById('btnSaque');
        if (btnSaque) {
            btnSaque.disabled = receitaTotal < 1;
        }
        
        
    } catch (error) {
        console.error('❌ Erro ao carregar receita total:', error);
        if (receitaTotalEl) {
            receitaTotalEl.textContent = 'MZN 0,00';
        }
        const btnSaque = document.getElementById('btnSaque');
        if (btnSaque) {
            btnSaque.disabled = true;
        }
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

// Função para abrir modal de saque (redireciona para tab)
function abrirModalSaque() {
    // Redirecionar para tab de saque
    mostrarTab('saque');
    
    // Validar se há receita suficiente
    if (receitaTotal < 1) {
        mostrarErro('Receita insuficiente para solicitar saque. Valor mínimo: MZN 1,00');
        return;
    }
    
    // Limpar e configurar formulário inline
    const formInline = document.getElementById('formSaqueInline');
    const valorSaqueInline = document.getElementById('valorSaqueInline');
    
    if (formInline) {
        formInline.reset();
    }
    
    if (valorSaqueInline) {
        valorSaqueInline.max = receitaTotal;
        valorSaqueInline.placeholder = `Máximo: ${formatCurrency(receitaTotal)}`;
        setTimeout(() => valorSaqueInline.focus(), 100);
    }
}

// Função para fechar modal de saque (mantida para compatibilidade)
function fecharModalSaque() {
    // Limpar formulário inline se existir
    const formInline = document.getElementById('formSaqueInline');
    if (formInline) {
        formInline.reset();
        const infoDiv = document.getElementById('carteiraInfoInline');
        if (infoDiv) {
            infoDiv.style.display = 'none';
        }
    }
}

// Função para solicitar saque (usa campos inline)
async function solicitarSaque(event) {
    event.preventDefault();
    
    // Usar função inline se disponível
    const formInline = document.getElementById('formSaqueInline');
    if (formInline && event.target === formInline || event.target.closest('#formSaqueInline')) {
        return solicitarSaqueInline(event);
    }
    
    // Fallback para função antiga (compatibilidade)
    try {
        // Obter elementos (tentar inline primeiro, depois antigo)
        const carteiraSelect = document.getElementById('carteiraSaqueInline') || document.getElementById('carteiraSaque');
        const valorInput = document.getElementById('valorSaqueInline') || document.getElementById('valorSaque');
        const codigoInput = document.getElementById('codigoAutenticacaoInline') || document.getElementById('codigoAutenticacao');
        const btnConfirmar = document.getElementById('btnConfirmarSaqueInline') || document.getElementById('btnConfirmarSaque');
        
        if (!carteiraSelect || !valorInput || !codigoInput) {
            // Se não encontrar elementos, usar função inline
            return solicitarSaqueInline(event);
        }
        
        // Desabilitar botão durante processamento
        if (btnConfirmar) {
            btnConfirmar.disabled = true;
            btnConfirmar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        }
        
        // Obter dados do formulário
        const carteiraId = carteiraSelect.value;
        const valorSaque = parseFloat(valorInput.value || 0);
        const codigoAutenticacao = codigoInput.value || '';
        
        // Validações
        if (!carteiraId) {
            mostrarErro('Selecione uma carteira para o saque');
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            }
            return;
        }
        
        if (isNaN(valorSaque) || valorSaque < 1) {
            mostrarErro('Valor mínimo para saque é MZN 1,00');
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            }
            return;
        }
        
        if (valorSaque > receitaTotal) {
            mostrarErro('Valor do saque não pode ser maior que a receita disponível');
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            }
            return;
        }
        
        if (!codigoAutenticacao || codigoAutenticacao.length !== 6) {
            mostrarErro('Digite o código de autenticação de 6 dígitos');
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            }
            return;
        }
        
        // Dados do saque simplificado
        const saqueData = {
            carteiraId: carteiraId,
            valor: valorSaque,
            codigoAutenticacao: codigoAutenticacao
        };
        
        console.log('📤 Dados do saque a serem enviados:', saqueData);
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        console.log('🔄 Enviando solicitação de saque...');
        
        // Determinar URL da API (usar window.API_BASE se disponível, senão usar URL relativa)
        let apiUrl;
        if (window.API_BASE) {
            // Garantir que o endpoint comece com / se necessário
            const endpoint = '/carteiras/saque/processar';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras/saque/processar';
        }
        
        console.log('📋 URL da API:', apiUrl);
        console.log('📋 API_BASE:', window.API_BASE || 'não definido');
        
        // Enviar solicitação para o servidor (endpoint para saques com carteiras)
        let response;
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(saqueData)
            });
        } catch (fetchError) {
            console.error('❌ Erro na requisição fetch:', fetchError);
            throw new Error('Erro de conexão com o servidor. Verifique sua internet.');
        }
        
        console.log('📥 Resposta recebida - Status:', response.status, response.statusText);
        
        // Tentar ler a resposta JSON mesmo em caso de erro
        let result;
        try {
            const responseText = await response.text();
            console.log('📄 Resposta do servidor (texto):', responseText);
            
            if (responseText) {
                result = JSON.parse(responseText);
                console.log('📊 Resposta do servidor (JSON):', result);
            } else {
                result = {};
            }
        } catch (parseError) {
            console.error('❌ Erro ao parsear resposta JSON:', parseError);
            console.error('❌ Resposta recebida:', response);
            throw new Error(`Erro ao processar resposta do servidor (status: ${response.status})`);
        }
        
        if (!response.ok) {
            // Extrair mensagem de erro detalhada da resposta
            const errorMessage = result.message || result.error || `Erro no servidor (status: ${response.status})`;
            console.error('❌ Erro na resposta da API:');
            console.error('   - Status:', response.status);
            console.error('   - Mensagem:', errorMessage);
            console.error('   - Resposta completa:', result);
            throw new Error(errorMessage);
        }
        
        if (result.success) {
            // Fechar modal
            // Limpar formulário inline
            const formInline = document.getElementById('formSaqueInline');
            if (formInline) {
                formInline.reset();
                document.getElementById('carteiraInfoInline').style.display = 'none';
            }
            
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
        const btnConfirmar = document.getElementById('btnConfirmarSaqueInline') || document.getElementById('btnConfirmarSaque');
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
        }
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
            carregarCarteirasInline(), // Carregar carteiras na seção inline
            carregarCarteirasSelectInline() // Carregar carteiras no select de saque
            // verificarStatusSaque removido - não há mais saques pendentes
        ]);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
    }
    
    // Adicionar event listeners
    document.addEventListener('click', function(event) {
        // Botão de atualizar dados
        if (event.target.closest('#btnAtualizarDados')) {
            event.preventDefault();
            atualizarDadosManualmente();
        }
    });
    
    // Validar valor do saque em tempo real (inline)
    const valorSaqueInlineEl = document.getElementById('valorSaqueInline');
    if (valorSaqueInlineEl) {
        // Garantir que o min está correto
        valorSaqueInlineEl.setAttribute('min', '1');
        
        valorSaqueInlineEl.addEventListener('input', function() {
            const valor = parseFloat(this.value);
            if (isNaN(valor) || valor < 1) {
                this.setCustomValidity('O valor mínimo para saque é MZN 1,00');
            } else if (valor > receitaTotal) {
                this.setCustomValidity(`Valor máximo permitido: ${formatCurrency(receitaTotal)}`);
            } else {
                this.setCustomValidity('');
            }
        });
        
        // Validar também no evento invalid
        valorSaqueInlineEl.addEventListener('invalid', function() {
            const valor = parseFloat(this.value);
            if (isNaN(valor) || valor < 1) {
                this.setCustomValidity('O valor mínimo para saque é MZN 1,00');
            }
        });
    }
    
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
    const btnSaque = document.getElementById('btnSaque');
    if (btnSaque) {
        // Desabilitar botão se receita for menor que 1
        btnSaque.disabled = receitaTotal < 1;
        
        // Atualizar texto do botão
        if (receitaTotal < 1) {
            btnSaque.textContent = 'Receita Insuficiente';
            btnSaque.className = 'btn btn-secondary';
        } else {
            btnSaque.textContent = 'Solicitar Saque';
            btnSaque.className = 'btn btn-primary';
        }
        
        // Atualizar tooltip
        btnSaque.title = receitaTotal < 1 
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
    // Redirecionar para tab de carteiras
    mostrarTab('carteiras');
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

// Função para carregar carteiras na configuração (mantida para compatibilidade)
async function carregarCarteirasConfig() {
    // Redirecionar para funções inline
    await carregarCarteirasInline();
    await carregarCarteirasSelectInline();
}

// Função para renderizar carteiras na configuração (mantida para compatibilidade)
function renderizarCarteirasConfig() {
    // Usar função inline
    carregarCarteirasInline();

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

// Função para carregar carteiras no select (mantida para compatibilidade)
function carregarCarteirasSelect() {
    // Usar função inline
    carregarCarteirasSelectInline();
}

// Função para mostrar detalhes da carteira selecionada (compatibilidade)
function mostrarDetalhesCarteira(carteiraId) {
    // Tentar usar função inline primeiro
    const carteirasList = carteiras.length > 0 ? carteiras : [];
    mostrarDetalhesCarteiraInline(carteiraId, carteirasList);
    
    // Fallback para elementos antigos se existirem
    const infoDiv = document.getElementById('carteiraInfo');
    const detalhesDiv = document.getElementById('carteiraDetalhes');
    
    if (infoDiv && detalhesDiv) {
        if (!carteiraId) {
            infoDiv.style.display = 'none';
            return;
        }

        const carteira = carteiras.find(c => c.id == carteiraId);
        if (!carteira) {
            infoDiv.style.display = 'none';
            return;
        }

        detalhesDiv.innerHTML = `
            <p><strong>Titular:</strong> ${carteira.nome_titular || carteira.nomeTitular}</p>
            <p><strong>Contacto:</strong> ${carteira.contacto}</p>
            <p><strong>Método:</strong> ${carteira.metodo_saque || carteira.metodoSaque}</p>
            <p><strong>Email:</strong> ${carteira.email_titular || carteira.emailTitular}</p>
        `;
        
        infoDiv.style.display = 'block';
    }
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

        // Coletar todos os campos obrigatórios
        const nomeCarteira = document.getElementById('nomeCarteira')?.value?.trim();
        const metodoSaque = document.getElementById('metodoSaque')?.value?.trim();
        const contacto = document.getElementById('contacto')?.value?.trim();
        const nomeTitular = document.getElementById('nomeTitular')?.value?.trim();
        const emailTitular = document.getElementById('emailTitular')?.value?.trim();
        
        // Validações básicas
        if (!nomeCarteira) {
            mostrarErro('O nome da carteira é obrigatório');
            return;
        }
        
        if (!metodoSaque) {
            mostrarErro('O método de saque é obrigatório');
            return;
        }
        
        if (!contacto) {
            mostrarErro('O número de contacto é obrigatório');
            return;
        }
        
        if (!nomeTitular) {
            mostrarErro('O nome do titular é obrigatório');
            return;
        }
        
        if (!emailTitular) {
            mostrarErro('O email do titular é obrigatório');
            return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTitular)) {
            mostrarErro('Por favor, insira um email válido');
            return;
        }

        const dados = {
            nome: nomeCarteira,
            metodoSaque: metodoSaque,
            contacto: contacto,
            nomeTitular: nomeTitular,
            emailTitular: emailTitular
        };

        console.log('📤 Dados da carteira a serem enviados:', { ...dados, emailTitular: emailTitular.substring(0, 10) + '...' });

        // Determinar URL da API
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras';
        }

        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }

        console.log('🔄 Enviando solicitação para criar carteira...');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });

        console.log('📥 Resposta recebida - Status:', response.status, response.statusText);

        // Tentar ler a resposta JSON mesmo em caso de erro
        let result;
        try {
            const responseText = await response.text();
            console.log('📄 Resposta do servidor (texto):', responseText);
            
            if (responseText) {
                result = JSON.parse(responseText);
                console.log('📊 Resposta do servidor (JSON):', result);
            } else {
                result = {};
            }
        } catch (parseError) {
            console.error('❌ Erro ao parsear resposta JSON:', parseError);
            throw new Error(`Erro ao processar resposta do servidor (status: ${response.status})`);
        }

        if (!response.ok) {
            // Extrair mensagem de erro detalhada da resposta
            const errorMessage = result.message || result.error || `Erro no servidor (status: ${response.status})`;
            console.error('❌ Erro na resposta da API:');
            console.error('   - Status:', response.status);
            console.error('   - Mensagem:', errorMessage);
            console.error('   - Resposta completa:', result);
            throw new Error(errorMessage);
        }

        if (result.success) {
            fecharModalNovaCarteira();
            mostrarSucesso('Carteira criada com sucesso!');
            carregarCarteirasInline();
            carregarCarteirasSelectInline();
        } else {
            throw new Error(result.message || 'Erro ao criar carteira');
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

// ==================== FUNÇÕES PARA CAMPOS INTERATIVOS ====================

// Função para alternar entre tabs
function mostrarTab(tabName) {
    // Esconder todos os conteúdos
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remover active de todos os botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Mostrar conteúdo selecionado
    const content = document.getElementById(`content${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    const btn = document.getElementById(`tab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`);
    
    if (content) {
        content.classList.add('active');
    }
    if (btn) {
        btn.classList.add('active');
    }
    
    // Se for a tab de carteiras, carregar carteiras
    if (tabName === 'carteiras') {
        carregarCarteirasInline();
    }
    
    // Se for a tab de saque, carregar carteiras no select
    if (tabName === 'saque') {
        carregarCarteirasSelectInline();
    }
}

// Função para toggle do formulário de nova carteira
function toggleNovaCarteira() {
    const form = document.getElementById('novaCarteiraForm');
    const btn = document.getElementById('btnToggleNovaCarteira');
    
    if (form.style.display === 'none' || !form.style.display) {
        form.style.display = 'block';
        btn.innerHTML = '<i class="fas fa-times"></i><span>Cancelar</span>';
        btn.style.background = '#dc3545';
    } else {
        form.style.display = 'none';
        btn.innerHTML = '<i class="fas fa-plus"></i><span>Nova Carteira</span>';
        btn.style.background = '#28a745';
        // Limpar formulário
        document.getElementById('formNovaCarteiraInline').reset();
    }
}

// Função para carregar carteiras na lista inline
async function carregarCarteirasInline() {
    const listaEl = document.getElementById('listaCarteirasInline');
    
    if (!listaEl) return;
    
    try {
        listaEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i><p>Carregando carteiras...</p></div>';
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado');
        }
        
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras';
        }
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar carteiras');
        }
        
        const result = await response.json();
        carteiras = result.carteiras || result.data || [];
        
        if (carteiras.length === 0) {
            listaEl.innerHTML = '<div class="info-box"><i class="fas fa-info-circle"></i><div><p>Nenhuma carteira configurada. Clique em "Nova Carteira" para adicionar uma.</p></div></div>';
            return;
        }
        
        listaEl.innerHTML = carteiras.map(carteira => `
            <div class="carteira-item">
                <div class="carteira-info-item">
                    <h5>${carteira.nome}</h5>
                    <p><i class="fas fa-mobile-alt"></i> ${carteira.metodo_saque || carteira.metodoSaque}</p>
                    <p><i class="fas fa-phone"></i> ${carteira.contacto}</p>
                    <p><i class="fas fa-user"></i> ${carteira.nome_titular || carteira.nomeTitular}</p>
                    <p><i class="fas fa-envelope"></i> ${carteira.email_titular || carteira.emailTitular}</p>
                </div>
                <div class="carteira-actions">
                    <button class="btn-delete" onclick="desativarCarteira(${carteira.id})" title="Desativar carteira">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('❌ Erro ao carregar carteiras:', error);
        listaEl.innerHTML = `<div class="info-box"><i class="fas fa-exclamation-triangle"></i><div><p>Erro ao carregar carteiras: ${error.message}</p></div></div>`;
    }
}

// Função para carregar carteiras no select inline
async function carregarCarteirasSelectInline() {
    const select = document.getElementById('carteiraSaqueInline');
    
    if (!select) return;
    
    try {
        select.innerHTML = '<option value="">Carregando carteiras...</option>';
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado');
        }
        
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras';
        }
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao carregar carteiras');
        }
        
        const result = await response.json();
        const carteirasList = result.carteiras || result.data || [];
        
        if (carteirasList.length === 0) {
            select.innerHTML = '<option value="">Nenhuma carteira configurada</option>';
            select.disabled = true;
            return;
        }
        
        select.disabled = false;
        select.innerHTML = '<option value="">Selecione uma carteira...</option>' +
            carteirasList.map(carteira => 
                `<option value="${carteira.id}">${carteira.nome} (${carteira.metodo_saque || carteira.metodoSaque})</option>`
            ).join('');
        
        // Adicionar evento de mudança
        select.addEventListener('change', function() {
            mostrarDetalhesCarteiraInline(this.value, carteirasList);
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar carteiras:', error);
        select.innerHTML = '<option value="">Erro ao carregar carteiras</option>';
    }
}

// Função para mostrar detalhes da carteira inline
function mostrarDetalhesCarteiraInline(carteiraId, carteirasList) {
    const infoDiv = document.getElementById('carteiraInfoInline');
    const detalhesDiv = document.getElementById('carteiraDetalhesInline');
    
    if (!carteiraId || !infoDiv || !detalhesDiv) {
        if (infoDiv) infoDiv.style.display = 'none';
        return;
    }
    
    const carteira = carteirasList.find(c => c.id == carteiraId);
    if (!carteira) {
        infoDiv.style.display = 'none';
        return;
    }
    
    detalhesDiv.innerHTML = `
        <p><strong>Titular:</strong> ${carteira.nome_titular || carteira.nomeTitular}</p>
        <p><strong>Contacto:</strong> ${carteira.contacto}</p>
        <p><strong>Método:</strong> ${carteira.metodo_saque || carteira.metodoSaque}</p>
        <p><strong>Email:</strong> ${carteira.email_titular || carteira.emailTitular}</p>
    `;
    
    infoDiv.style.display = 'block';
}

// Função para criar carteira inline
async function criarCarteiraInline() {
    try {
        const form = document.getElementById('formNovaCarteiraInline');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Coletar todos os campos obrigatórios
        const nomeCarteira = document.getElementById('nomeCarteiraInline')?.value?.trim();
        const metodoSaque = document.getElementById('metodoSaqueInline')?.value?.trim();
        const contacto = document.getElementById('contactoInline')?.value?.trim();
        const nomeTitular = document.getElementById('nomeTitularInline')?.value?.trim();
        const emailTitular = document.getElementById('emailTitularInline')?.value?.trim();
        
        // Validações básicas
        if (!nomeCarteira || !metodoSaque || !contacto || !nomeTitular || !emailTitular) {
            mostrarErro('Todos os campos são obrigatórios');
            return;
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTitular)) {
            mostrarErro('Por favor, insira um email válido');
            return;
        }

        const dados = {
            nome: nomeCarteira,
            metodoSaque: metodoSaque,
            contacto: contacto,
            nomeTitular: nomeTitular,
            emailTitular: emailTitular
        };

        console.log('📤 Dados da carteira a serem enviados:', { ...dados, emailTitular: emailTitular.substring(0, 10) + '...' });

        // Determinar URL da API
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras';
        }

        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }

        console.log('🔄 Enviando solicitação para criar carteira...');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(dados)
        });

        console.log('📥 Resposta recebida - Status:', response.status, response.statusText);

        // Tentar ler a resposta JSON mesmo em caso de erro
        let result;
        try {
            const responseText = await response.text();
            console.log('📄 Resposta do servidor (texto):', responseText);
            
            if (responseText) {
                result = JSON.parse(responseText);
                console.log('📊 Resposta do servidor (JSON):', result);
            } else {
                result = {};
            }
        } catch (parseError) {
            console.error('❌ Erro ao parsear resposta JSON:', parseError);
            throw new Error(`Erro ao processar resposta do servidor (status: ${response.status})`);
        }

        if (!response.ok) {
            const errorMessage = result.message || result.error || `Erro no servidor (status: ${response.status})`;
            console.error('❌ Erro na resposta da API:', errorMessage, result);
            throw new Error(errorMessage);
        }

        if (result.success) {
            mostrarSucesso('Carteira criada com sucesso!');
            form.reset();
            toggleNovaCarteira();
            carregarCarteirasInline();
            carregarCarteirasSelectInline();
        } else {
            throw new Error(result.message || 'Erro ao criar carteira');
        }
        
    } catch (error) {
        console.error('❌ Erro:', error);
        
        let errorMessage = error.message || 'Erro ao criar carteira';
        
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

// Função para solicitar código de saque inline
async function solicitarCodigoSaqueInline() {
    const carteiraId = document.getElementById('carteiraSaqueInline')?.value;
    const btn = document.getElementById('btnSolicitarCodigoInline');
    
    if (!carteiraId) {
        mostrarErro('Selecione uma carteira primeiro');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado');
        }
        
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras/saque/codigo';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras/saque/codigo';
        }
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ carteiraId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            mostrarSucesso('Código enviado para seu email! Verifique sua caixa de entrada.');
        } else {
            throw new Error(result.message || 'Erro ao solicitar código');
        }
        
    } catch (error) {
        console.error('❌ Erro ao solicitar código:', error);
        mostrarErro(error.message || 'Erro ao solicitar código');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Solicitar';
    }
}

// Função para solicitar saque inline
async function solicitarSaqueInline(event) {
    event.preventDefault();
    
    try {
        const btn = document.getElementById('btnConfirmarSaqueInline');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        
        const carteiraId = document.getElementById('carteiraSaqueInline').value;
        const valorSaque = parseFloat(document.getElementById('valorSaqueInline').value);
        const codigoAutenticacao = document.getElementById('codigoAutenticacaoInline').value;
        
        // Validações
        if (!carteiraId) {
            mostrarErro('Selecione uma carteira para o saque');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            return;
        }
        
        if (isNaN(valorSaque) || valorSaque < 1) {
            mostrarErro('Valor mínimo para saque é MZN 1,00');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            return;
        }
        
        if (valorSaque > receitaTotal) {
            mostrarErro('Valor do saque não pode ser maior que a receita disponível');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            return;
        }
        
        if (!codigoAutenticacao || codigoAutenticacao.length !== 6) {
            mostrarErro('Digite o código de autenticação de 6 dígitos');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
            return;
        }
        
        const saqueData = {
            carteiraId: carteiraId,
            valor: valorSaque,
            codigoAutenticacao: codigoAutenticacao
        };
        
        console.log('📤 Dados do saque a serem enviados:', saqueData);
        
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        let apiUrl;
        if (window.API_BASE) {
            const endpoint = '/carteiras/saque/processar';
            apiUrl = window.API_BASE.endsWith('/') 
                ? `${window.API_BASE.slice(0, -1)}${endpoint}`
                : `${window.API_BASE}${endpoint}`;
        } else {
            apiUrl = '/api/carteiras/saque/processar';
        }
        
        console.log('🔄 Enviando solicitação de saque...');
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(saqueData)
        });
        
        console.log('📥 Resposta recebida - Status:', response.status, response.statusText);
        
        let result;
        try {
            const responseText = await response.text();
            console.log('📄 Resposta do servidor (texto):', responseText);
            
            if (responseText) {
                result = JSON.parse(responseText);
                console.log('📊 Resposta do servidor (JSON):', result);
            } else {
                result = {};
            }
        } catch (parseError) {
            console.error('❌ Erro ao parsear resposta JSON:', parseError);
            throw new Error(`Erro ao processar resposta do servidor (status: ${response.status})`);
        }
        
        if (!response.ok) {
            const errorMessage = result.message || result.error || `Erro no servidor (status: ${response.status})`;
            console.error('❌ Erro na resposta da API:', errorMessage, result);
            throw new Error(errorMessage);
        }
        
        if (result.success) {
            mostrarSucesso('Saque solicitado com sucesso!');
            document.getElementById('formSaqueInline').reset();
            document.getElementById('carteiraInfoInline').style.display = 'none';
            
            // Atualizar dados
            await loadReceitaTotal();
            await loadSaqueAtual();
            await loadHistoricoSaques();
        } else {
            throw new Error(result.message || 'Erro ao criar pedido de saque');
        }
        
    } catch (error) {
        console.error('❌ Erro ao solicitar saque:', error);
        mostrarErro('Erro ao solicitar saque: ' + error.message);
        
    } finally {
        const btn = document.getElementById('btnConfirmarSaqueInline');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Saque';
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
            carregarCarteirasInline();
            carregarCarteirasSelectInline();
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
            carregarCarteirasInline();
            carregarCarteirasSelectInline();
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
    // Usar função inline se disponível
    const carteiraSelect = document.getElementById('carteiraSaqueInline');
    if (carteiraSelect) {
        return solicitarCodigoSaqueInline();
    }
    
    // Fallback para função antiga
    try {
        const carteiraSelectOld = document.getElementById('carteiraSaque');
        const carteiraId = carteiraSelectOld?.value;
        
        if (!carteiraId) {
            mostrarErro('Selecione uma carteira primeiro');
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

// Função window.onclick removida - não há mais modais para fechar
