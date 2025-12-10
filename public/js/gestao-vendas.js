// Configuração da API
// Usar a variável API_BASE já definida em server-check.js e config.js
// Não precisamos redeclarar aqui, apenas usamos window.API_BASE

// Variáveis globais para paginação
let currentPageVendas = 1;
let totalPagesVendas = 1;
let totalVendas = 0;
const itemsPerPage = 5; // Limite de 5 transações por página
let todasVendas = []; // Array com todas as vendas para paginação

// Função para carregar dados das vendas
async function carregarDadosVendas() {
    try {
        // Verificar se a API_BASE está definida
        if (!window.API_BASE) {
            console.error('API_BASE não está definida');
            return;
        }
        
        
        // Mostrar indicador de carregamento
        const estatisticasElements = ['totalVendas', 'vendasAprovadas', 'vendasPendentes', 'vendasCanceladas', 'receitaTotal', 'receitaDisponivel'];
        estatisticasElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                element.classList.add('loading');
            }
        });
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Fazer a requisição para a API usando endpoint do dashboard
        const response = await fetch(`${window.API_BASE}/dashboard/vendedor/resumo`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }
        
        // Converter a resposta para JSON
        const data = await response.json();
        
        console.log('📥 Resposta completa da API:', data);
        
        // Verificar se os dados foram retornados
        if (data.success && data.data) {
            
            // Mapear dados do endpoint resumo para o formato esperado
            // A API retorna: totalVendas, vendasAprovadas, vendasPendentes, vendasCanceladas, receitaTotal, receitaDisponivel
            const dadosMapeados = {
                totalVendas: data.data.totalVendas || 0,
                vendasAprovadas: data.data.vendasAprovadas || 0,
                vendasPendentes: data.data.vendasPendentes || 0,
                vendasCanceladas: data.data.vendasCanceladas || 0,
                receitaTotal: data.data.receitaTotal || 0,
                receitaDisponivel: data.data.receitaDisponivel || 0,
                reembolsos: data.data.valorReembolsos || data.data.reembolsos || 0
            };
            
            console.log('📊 Dados mapeados das estatísticas:', dadosMapeados);
            
            atualizarEstatisticas(dadosMapeados);
            
            // Carregar também as vendas detalhadas
            carregarVendasDetalhadas();
        } else {
            console.error('❌ Erro nos dados retornados:', data.message || 'Erro desconhecido');
            throw new Error(data.message || 'Erro desconhecido');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados das vendas:', error);
        // Remover indicador de carregamento e mostrar erro
        const estatisticasElements = ['totalVendas', 'vendasAprovadas', 'vendasPendentes', 'vendasCanceladas', 'receitaTotal', 'receitaDisponivel'];
        estatisticasElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Erro';
                element.classList.remove('loading');
                element.classList.add('error');
            }
        });
    }
}

// Função para atualizar as estatísticas na tela
function atualizarEstatisticas(data) {
    try {
        // Verificar se os dados são válidos
        if (!data) {
            console.error('Dados de estatísticas inválidos');
            return;
        }
        
        // Formatar valores monetários
        const formatarMoeda = (valor) => {
            if (valor === null || valor === undefined || isNaN(valor)) {
                valor = 0;
            }
            // Garantir que sempre use MZN em vez de MTn
            const formatted = new Intl.NumberFormat('pt-MZ', {
                style: 'currency',
                currency: 'MZN'
            }).format(valor);
            
            // Substituir MTn por MZN se necessário
            return formatted.replace('MTn', 'MZN');
        };
        
        // Atualizar os elementos com os dados, usando valores padrão se os dados não existirem
        const elementos = {
            'totalVendas': data.totalVendas || 0,
            'vendasAprovadas': data.vendasAprovadas || 0,
            'vendasPendentes': data.vendasPendentes || 0,
            'vendasCanceladas': data.vendasCanceladas || 0,
            'receitaTotal': formatarMoeda(data.receitaTotal || 0),
            'receitaDisponivel': formatarMoeda(data.receitaDisponivel || 0)
        };
        
        // Elementos opcionais (não geram aviso se não existirem)
        const elementosOpcionais = {
            'reembolsos': formatarMoeda(data.reembolsos || 0)
        };
        
        // Atualizar cada elemento se ele existir no DOM
        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
                elemento.classList.remove('loading', 'error', 'verde', 'amarelo', 'vermelho');
                // Adicionar classe de animação para destacar a atualização
                elemento.classList.add('atualizado');
                setTimeout(() => {
                    elemento.classList.remove('atualizado');
                }, 1000);
            } else {
                console.warn(`⚠️ Elemento com ID '${id}' não encontrado no DOM`);
            }
        });
        
        // Atualizar elementos opcionais (sem aviso se não existirem)
        Object.entries(elementosOpcionais).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
                elemento.classList.remove('loading', 'error');
                elemento.classList.add('atualizado');
                setTimeout(() => {
                    elemento.classList.remove('atualizado');
                }, 1000);
            }
        });
        
        // Aplicar cores aos valores
        const vendasAprovadasEl = document.getElementById('vendasAprovadas');
        const receitaTotalEl = document.getElementById('receitaTotal');
        const vendasPendentesEl = document.getElementById('vendasPendentes');
        const vendasCanceladasEl = document.getElementById('vendasCanceladas');
        
        if (vendasAprovadasEl) vendasAprovadasEl.classList.add('verde');
        if (receitaTotalEl) receitaTotalEl.classList.add('verde');
        if (vendasPendentesEl) vendasPendentesEl.classList.add('amarelo');
        if (vendasCanceladasEl) vendasCanceladasEl.classList.add('vermelho');
        
        // Atualizar o timestamp da última atualização
        atualizarTimestampUltimaAtualizacao();
        
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
    }
}

// Função para carregar produtos vendidos (removida - dados resumidos na tabela de vendas)

// Função para carregar vendas detalhadas
async function carregarVendasDetalhadas() {
    try {
        
        // Obter token de autenticação
        const token = localStorage.getItem('authToken') || localStorage.getItem('token') || localStorage.getItem('adminToken');
        
        if (!token) {
            throw new Error('Usuário não autenticado. Faça login novamente.');
        }
        
        // Fazer a requisição para a API de vendas do vendedor (inclui informações de afiliado)
        const response = await fetch(`${window.API_BASE}/vendas/vendedor?limite=1000&pagina=1`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
            // Tentar obter detalhes do erro da resposta
            let errorMessage = `Erro na requisição: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
                console.error('❌ Detalhes do erro da API:', errorData);
            } catch (parseError) {
                console.error('❌ Erro ao parsear resposta de erro:', parseError);
            }
            const error = new Error(errorMessage);
            error.status = response.status;
            throw error;
        }
        
        // Converter a resposta para JSON
        const data = await response.json();
        
        // Verificar se os dados foram retornados com sucesso
        // A rota /vendas/vendedor retorna { success: true, data: { vendas: [...] } }
        if (data.success && data.data && data.data.vendas) {
            // Preservar todos os campos da venda original, especialmente created_at e outros campos de data
            const transacoesValidas = data.data.vendas.map(venda => {
                // Preservar todos os campos da venda original
                const vendaMapeada = {
                    ...venda, // Preservar todos os campos originais
                    id: venda.id || venda.public_id,
                    produto: venda.produto || {
                        id: venda.produto_id,
                        nome: venda.produto_nome,
                        custom_id: venda.produto_custom_id,
                        public_id: venda.produto_public_id
                    },
                    cliente: venda.cliente || {
                        nome: venda.cliente_nome,
                        email: venda.cliente_email,
                        telefone: venda.cliente_telefone,
                        whatsapp: venda.cliente_whatsapp
                    },
                    pagamento: venda.pagamento || {
                        status: venda.pagamento_status || venda.status,
                        valor: venda.pagamento_valor || venda.valor_final || venda.valor,
                        referencia: venda.pagamento_referencia,
                        data_processamento: venda.pagamento_data || venda.data_pagamento
                    }
                };
                
                // Garantir que created_at esteja presente (prioridade: created_at > createdAt > data_venda > updated_at)
                if (!vendaMapeada.created_at) {
                    vendaMapeada.created_at = venda.createdAt || 
                                             venda.data_venda || 
                                             venda.updated_at || 
                                             venda.updatedAt ||
                                             venda.data_criacao ||
                                             venda.data_pagamento ||
                                             new Date().toISOString();
                }
                
                return vendaMapeada;
            });
            
            // Validar e limpar dados
            const transacoesValidasFiltradas = transacoesValidas.filter(transacao => {
                if (!transacao) return false;
                
                // Verificar se tem dados essenciais
                const temDadosBasicos = transacao.id || transacao.public_id;
                const temProduto = transacao.produto && (transacao.produto.nome || transacao.produto.id);
                const temCliente = transacao.cliente_nome || transacao.cliente_email;
                
                if (!temDadosBasicos) {
                    console.warn('Transação sem ID:', transacao);
                    return false;
                }
                
                return true;
            });
            
            
            // Armazenar vendas originais para filtros
            todasVendasOriginais = [...transacoesValidasFiltradas];
            
            renderizarVendasDetalhadas(transacoesValidasFiltradas);
        } else {
            console.error('Erro nos dados retornados:', data.message || 'Erro desconhecido');
            // Mostrar mensagem de erro na tabela
            const tbody = document.getElementById('vendasDetalhadasBody');
            if (tbody) {
                 tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: #dc3545; padding: 20px;">Erro ao carregar vendas detalhadas</td></tr>';
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar vendas detalhadas:', error);
        console.error('Stack trace:', error.stack);
        
        // Mostrar mensagem de erro na tabela com mais detalhes
        const tbody = document.getElementById('vendasDetalhadasBody');
        if (tbody) {
            const errorMessage = error.message || 'Erro desconhecido ao carregar vendas detalhadas';
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #dc3545; padding: 20px;">
                <i class="fas fa-exclamation-triangle"></i> ${errorMessage}
                <br><small style="color: #999;">Status: ${error.status || 'N/A'}</small>
            </td></tr>`;
        }
        
        // Mostrar notificação de erro se disponível
        if (typeof mostrarNotificacao === 'function') {
            mostrarNotificacao('Erro ao carregar vendas detalhadas: ' + error.message, 'error');
        }
    }
}

// Função para popular filtros detalhados
function popularFiltrosDetalhados(vendas) {
    
    const selectProduto = document.getElementById('filtroProduto');
    const selectEmail = document.getElementById('filtroEmail');
    
    if (!selectProduto || !selectEmail) {
        console.warn('Elementos de filtro não encontrados');
        return;
    }
    
    // Limpar opções existentes (manter a primeira opção vazia)
    selectProduto.innerHTML = '<option value="">Todos os Produtos</option>';
    selectEmail.innerHTML = '<option value="">Todos os Emails</option>';
    
    // Conjuntos para armazenar valores únicos
    const produtosSet = new Set();
    const emailsSet = new Set();
    
    // Coletar valores únicos das vendas
    vendas.forEach(venda => {
        // Verificar se a venda é válida
        if (!venda) return;
        
        // Extrair dados do produto com segurança
        let produtoNome = '-';
        let produtoCustomId = '';
        let produtoId = '';
        if (venda.produto && typeof venda.produto === 'object') {
            produtoNome = venda.produto.nome || venda.produto.id || venda.produto;
            produtoCustomId = venda.produto.custom_id || '';
            produtoId = venda.produto.id || '';
        } else if (venda.produto) {
            produtoNome = venda.produto;
        }
        
        // Extrair nome do cliente com segurança
        let clienteNome = venda.cliente_nome || venda.cliente?.nome || '-';
        let clienteEmail = venda.cliente_email || venda.cliente?.email || '-';
        
        // Adicionar apenas valores válidos aos conjuntos (usando apenas ID Custom)
        const produtoDisplay = produtoCustomId || produtoId || produtoNome;
        if (produtoDisplay && produtoDisplay !== '-' && produtoDisplay !== 'Produto não identificado') {
            produtosSet.add(produtoDisplay);
        }
        if (clienteEmail && clienteEmail !== '-') {
            emailsSet.add(clienteEmail);
        }
    });
    
    // Preencher os selects com as opções únicas
    Array.from(produtosSet).sort().forEach(produto => {
        const opt = document.createElement('option');
        opt.value = produto;
        opt.textContent = produto;
        selectProduto.appendChild(opt);
    });
    
    Array.from(emailsSet).sort().forEach(email => {
        const opt = document.createElement('option');
        opt.value = email;
        opt.textContent = email;
        selectEmail.appendChild(opt);
    });
}

// Função para calcular paginação
function calcularPaginação() {
    totalVendas = todasVendas.length;
    totalPagesVendas = Math.ceil(totalVendas / itemsPerPage);
    
    
    // Garantir que a página atual seja válida
    if (currentPageVendas > totalPagesVendas) {
        currentPageVendas = totalPagesVendas || 1;
    }
    
    // Obter vendas da página atual
    const inicio = (currentPageVendas - 1) * itemsPerPage;
    const fim = inicio + itemsPerPage;
    const vendasPagina = todasVendas.slice(inicio, fim);
    
    
    return vendasPagina;
}

// Função para atualizar controles de paginação
function atualizarControlesPaginacao() {
    const btnAnterior = document.getElementById('btnAnterior');
    const btnProximo = document.getElementById('btnProximo');
    const infoPagina = document.getElementById('paginationInfo');
    
    if (btnAnterior) {
        btnAnterior.disabled = currentPageVendas <= 1;
    }
    
    if (btnProximo) {
        btnProximo.disabled = currentPageVendas >= totalPagesVendas;
    }
    
    if (infoPagina) {
        infoPagina.textContent = `Página ${currentPageVendas} de ${totalPagesVendas} (${totalVendas} vendas)`;
    }
}

// Função para navegar para página anterior
function paginaAnterior() {
    if (currentPageVendas > 1) {
        currentPageVendas--;
        renderizarVendasDetalhadas();
    }
}

// Função para navegar para próxima página
function paginaProxima() {
    if (currentPageVendas < totalPagesVendas) {
        currentPageVendas++;
        renderizarVendasDetalhadas();
    }
}

// Função para renderizar vendas detalhadas com paginação
function renderizarVendasDetalhadas(vendas) {
    
    const tbody = document.getElementById('vendasDetalhadasBody');
    if (!tbody) {
        console.error('❌ Elemento vendasDetalhadasBody não encontrado');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Se vendas foram passadas como parâmetro, recalcular paginação
    if (vendas) {
        todasVendas = vendas; // Atualizar array global
        currentPageVendas = 1; // Resetar para primeira página
        const vendasPagina = calcularPaginação();
        popularFiltrosDetalhados(todasVendas); // Usar todas as vendas para filtros
        renderizarVendasPagina(vendasPagina);
    } else {
        // Usar vendas já calculadas
        const vendasPagina = calcularPaginação();
        renderizarVendasPagina(vendasPagina);
    }
    
    // Atualizar controles de paginação
    atualizarControlesPaginacao();
}

// Função auxiliar para formatar data e hora de forma consistente
function formatarDataHora(dataInput) {
    if (!dataInput) {
        return '-';
    }
    
    try {
        let data;
        
        // Se for string, tentar parsear
        if (typeof dataInput === 'string') {
            // Remover espaços e caracteres estranhos
            const dataLimpa = dataInput.trim();
            
            // Se for timestamp numérico em string
            if (/^\d+$/.test(dataLimpa)) {
                const timestamp = parseInt(dataLimpa);
                // Verificar se é timestamp em segundos (10 dígitos) ou milissegundos (13 dígitos)
                if (dataLimpa.length === 10) {
                    data = new Date(timestamp * 1000);
                } else {
                    data = new Date(timestamp);
                }
            } else {
                // Tentar parsear como ISO string ou outros formatos
                data = new Date(dataLimpa);
            }
        } else if (typeof dataInput === 'number') {
            // Se for número, verificar se é timestamp em segundos ou milissegundos
            if (dataInput.toString().length === 10) {
                data = new Date(dataInput * 1000);
            } else {
                data = new Date(dataInput);
            }
        } else if (dataInput instanceof Date) {
            data = dataInput;
        } else {
            return '-';
        }
        
        // Verificar se a data é válida
        if (!data || isNaN(data.getTime()) || data.getTime() <= 0) {
            console.warn('⚠️ Data inválida:', dataInput);
            return '-';
        }
        
        // Verificar se a data não é muito antiga (antes de 1970) ou muito futura (depois de 2100)
        const ano = data.getFullYear();
        if (ano < 1970 || ano > 2100) {
            console.warn('⚠️ Data fora do range válido:', dataInput, 'Ano:', ano);
            return '-';
        }
        
        // Formatar data (DD/MM/YYYY)
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const anoFormatado = data.getFullYear();
        const dataFormatada = `${dia}/${mes}/${anoFormatado}`;
        
        // Formatar hora (HH:MM:SS)
        const hora = String(data.getHours()).padStart(2, '0');
        const minuto = String(data.getMinutes()).padStart(2, '0');
        const segundo = String(data.getSeconds()).padStart(2, '0');
        const horaFormatada = `${hora}:${minuto}:${segundo}`;
        
        // Retornar HTML formatado para a coluna Data/Hora
        const htmlFormatado = `<span class="data" style="display: block; font-weight: 500;">${dataFormatada}</span><span class="hora" style="display: block; font-size: 0.85em; color: #666;">${horaFormatada}</span>`;
        
        return htmlFormatado;
        
    } catch (error) {
        console.warn('⚠️ Erro ao formatar data/hora:', error, 'Valor:', dataInput);
        return '-';
    }
}

// Função para renderizar vendas de uma página específica
function renderizarVendasPagina(vendas) {
    const tbody = document.getElementById('vendasDetalhadasBody');
    
    if (!vendas || !vendas.length) {
        tbody.innerHTML = '<tr><td colspan="7">Nenhuma venda encontrada</td></tr>';
        return;
    }
    
    
    vendas.forEach((venda, index) => {
        // Verificar se a venda é válida
        if (!venda) return;
        
        // Extrair dados do produto com segurança
        const produtoNome = venda.produto?.nome || 'Produto não identificado';
        const produtoId = venda.produto?.id || venda.produto_id || '-';
        const produtoPublicId = venda.produto?.public_id || '';
        const produtoCustomId = venda.produto?.custom_id || venda.produto?.customId || '';
        
        // ID do produto para exibição - priorizar Custom ID
        let produtoIdDisplay = '-';
        if (produtoCustomId && produtoCustomId.trim() !== '') {
            produtoIdDisplay = produtoCustomId;
        } else if (produtoPublicId && produtoPublicId.trim() !== '') {
            produtoIdDisplay = produtoPublicId;
        } else if (produtoId && produtoId !== '-') {
            produtoIdDisplay = produtoId;
        }
        
        // Display do produto (nome apenas)
        let produtoDisplay = produtoNome;
        
        // Extrair dados do cliente com segurança
        const clienteNome = venda.cliente_nome || venda.cliente?.nome || 'Cliente não identificado';
        const clienteEmail = venda.cliente_email || venda.cliente?.email || '-';
        const clienteTelefone = venda.cliente_telefone || venda.cliente?.telefone || '-';
        // Buscar WhatsApp de múltiplas fontes possíveis
        const clienteWhatsapp = venda.cliente_whatsapp || venda.cliente?.whatsapp || null;
        
        // Formatar contato - mostrar telefone de pagamento e ícone WhatsApp se disponível
        let contatoFormatado = '-';
        
        // Verificar se tem telefone de pagamento
        const telefonePagamento = clienteTelefone && clienteTelefone !== '-' ? clienteTelefone : null;
        
        // Verificar se tem WhatsApp válido (não vazio, não null, não undefined, não '-')
        const hasWhatsapp = clienteWhatsapp && 
                           clienteWhatsapp !== '-' && 
                           clienteWhatsapp !== null && 
                           clienteWhatsapp !== undefined && 
                           clienteWhatsapp.toString().trim() !== '';
        
        let whatsappNumber = '';
        let whatsappLink = '';
        
        if (hasWhatsapp) {
            whatsappNumber = clienteWhatsapp.toString().replace(/\D/g, '');
            if (whatsappNumber && whatsappNumber.length > 0) {
                // Adicionar código do país se não tiver (assumindo Moçambique +258)
                if (!whatsappNumber.startsWith('258')) {
                    whatsappNumber = '258' + whatsappNumber;
                }
                whatsappLink = `https://wa.me/${whatsappNumber}`;
            }
        }
        
        // Montar contato formatado: telefone + ícone WhatsApp (se disponível)
        if (telefonePagamento) {
            contatoFormatado = `<span style="display: inline-flex; align-items: center; gap: 8px;">`;
            contatoFormatado += `<span>${telefonePagamento}</span>`;
            
            // Adicionar ícone WhatsApp se disponível
            if (whatsappLink) {
                contatoFormatado += `<a href="${whatsappLink}" target="_blank" title="Abrir WhatsApp: ${whatsappNumber}" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #25D366; color: white; border-radius: 50%; text-decoration: none; transition: all 0.2s; flex-shrink: 0;" onmouseover="this.style.backgroundColor='#20BA5A'; this.style.transform='scale(1.1)'" onmouseout="this.style.backgroundColor='#25D366'; this.style.transform='scale(1)'"><i class="fab fa-whatsapp" style="font-size: 16px;"></i></a>`;
            }
            
            contatoFormatado += `</span>`;
        } else if (whatsappLink) {
            // Se não tem telefone mas tem WhatsApp, mostrar apenas WhatsApp
            contatoFormatado = `<a href="${whatsappLink}" target="_blank" title="Abrir WhatsApp: ${whatsappNumber}" style="display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #25D366; color: white; border-radius: 50%; text-decoration: none; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#20BA5A'; this.style.transform='scale(1.1)'" onmouseout="this.style.backgroundColor='#25D366'; this.style.transform='scale(1)'"><i class="fab fa-whatsapp" style="font-size: 16px;"></i></a>`;
        }
        
        // Extrair dados do pagamento com segurança - CORRIGIDO
        // Priorizar pagamento_status que vem do mapeamento, depois status direto
        let status = venda.pagamento_status || venda.pagamento?.status || venda.status || 'Pendente';
        
        // Mapear status para exibição consistente
        if (status === 'Pago' || status === 'pago') {
            status = 'Aprovado';
        } else if (status === 'Cancelada' || status === 'cancelada' || status === 'Cancelado' || status === 'cancelado') {
            status = 'Cancelado';
        } else if (status === 'Rejeitado' || status === 'rejeitado') {
            status = 'Cancelado';
        } else if (status === 'Pendente' || status === 'pendente') {
            status = 'Pendente';
        }
        
        // Extrair valor final com múltiplas tentativas - CORRIGIDO
        let valorFinal = '-';
        let valorNumerico = null;
        
        // Tentar obter o valor numérico de diferentes campos
        if (venda.pagamento?.valor) {
            valorNumerico = parseFloat(venda.pagamento.valor);
        } else if (venda.pagamento_valor) {
            valorNumerico = parseFloat(venda.pagamento_valor);
        } else if (venda.valor_final) {
            valorNumerico = parseFloat(venda.valor_final);
        } else if (venda.valor) {
            valorNumerico = parseFloat(venda.valor);
        }
        
        // Formatar valor se encontrado
        if (valorNumerico !== null && !isNaN(valorNumerico) && valorNumerico > 0) {
            valorFinal = `MZN ${valorNumerico.toFixed(2).replace('.', ',')}`;
        }
        
        // Formatar data e hora usando função auxiliar - MELHORADO
        let dataHora = '-';
        let dataParaFormatar = null;
        
        // Tentar múltiplos campos de data (prioridade: created_at > createdAt > data_venda > updated_at)
        // Priorizar created_at que é o campo mais confiável
        // Tentar também camelCase caso o Sequelize retorne dessa forma
        if (venda.created_at) {
            dataParaFormatar = venda.created_at;
        } else if (venda.createdAt) {
            // Fallback para camelCase
            dataParaFormatar = venda.createdAt;
        } else if (venda.data_venda) {
            dataParaFormatar = venda.data_venda;
        } else if (venda.updated_at) {
            dataParaFormatar = venda.updated_at;
        } else if (venda.updatedAt) {
            // Fallback para camelCase
            dataParaFormatar = venda.updatedAt;
        } else if (venda.data_criacao) {
            dataParaFormatar = venda.data_criacao;
        } else if (venda.data_pagamento) {
            dataParaFormatar = venda.data_pagamento;
        }
        
        // Usar função auxiliar para formatar
        if (dataParaFormatar) {
            dataHora = formatarDataHora(dataParaFormatar);
            
            // Log de debug para verificar formatação
            if (dataHora !== '-') {
                console.log(`✅ Data formatada para venda ${index + 1}:`, {
                    formatada: dataHora,
                    original: dataParaFormatar,
                });
            } else {
                console.warn(`⚠️ Não foi possível formatar data para venda ${index + 1}:`, {
                    created_at: venda.created_at,
                });
            }
        } else {
            console.warn(`⚠️ Nenhum campo de data encontrado para venda ${index + 1}:`, {
                id: venda.id,
            });
            dataHora = '-';
        }
        
        // Garantir que dataHora sempre tenha um valor válido
        if (!dataHora || dataHora === '' || dataHora === 'undefined' || dataHora === 'null') {
            dataHora = '-';
        }
        
        // Formatar informação de afiliado
        let afiliadoDisplay = '-';
        if (venda.afiliado && venda.afiliado.nome) {
            // Se tem afiliado, mostrar nome e código
            const codigoAfiliado = venda.afiliado.codigo || venda.afiliado_ref || '';
            if (codigoAfiliado) {
                afiliadoDisplay = `${venda.afiliado.nome}<br><small style="color: #666; font-size: 0.85em;">(${codigoAfiliado})</small>`;
            } else {
                afiliadoDisplay = venda.afiliado.nome;
            }
        } else if (venda.afiliado_ref) {
            // Se só tem código de referência, mostrar apenas o código
            afiliadoDisplay = `<small style="color: #666;">${venda.afiliado_ref}</small>`;
        }
        
        // ID da transação - PRIORIZAR NÚMERO DO PEDIDO (6 dígitos)
        let idTransacao = '-';
        if (venda.numero_pedido) {
            idTransacao = venda.numero_pedido;
        } else if (venda.pagamento?.referencia) {
            idTransacao = venda.pagamento.referencia;
        } else if (venda.pagamento_referencia) {
            idTransacao = venda.pagamento_referencia;
        } else if (venda.pagamento_transacao_id) {
            idTransacao = venda.pagamento_transacao_id;
        } else if (venda.id_transacao) {
            idTransacao = venda.id_transacao;
        } else if (venda.id) {
            idTransacao = venda.id;
        } else if (venda.public_id) {
            idTransacao = venda.public_id;
        }
        
        // Garantir valores padrão consistentes para todas as colunas
        const produtoIdFinal = (produtoIdDisplay && produtoIdDisplay !== '-') ? produtoIdDisplay : '-';
        const produtoFinal = (produtoDisplay && produtoDisplay !== 'Produto não identificado') ? produtoDisplay : '-';
        const clienteFinal = (clienteNome && clienteNome !== 'Cliente não identificado') ? clienteNome : '-';
        const emailFinal = (clienteEmail && clienteEmail !== '-') ? clienteEmail : '-';
        const contatoFinal = (contatoFormatado && contatoFormatado !== '-') ? contatoFormatado : '-';
        const afiliadoFinal = (afiliadoDisplay && afiliadoDisplay !== '-') ? afiliadoDisplay : '-';
        const statusFinal = (status && status !== 'Pendente') ? status : (status || 'Pendente');
        const valorFinalFormatado = (valorFinal && valorFinal !== '-') ? valorFinal : '-';
        
        // Garantir que dataHora sempre tenha um valor válido para renderização na coluna Data/Hora
        let dataHoraFinal = '-';
        
        // Validar e processar dataHora
        if (dataHora && 
            dataHora !== '-' && 
            dataHora !== 'undefined' && 
            dataHora !== 'null' && 
            dataHora !== '' &&
            typeof dataHora === 'string' &&
            dataHora.trim() !== '') {
            
            // Verificar se contém HTML válido (deve ter <span>)
            if (dataHora.includes('<span') || dataHora.includes('class=')) {
                dataHoraFinal = dataHora;
            } else {
                // Se não tem HTML, tentar formatar novamente
                console.warn(`⚠️ Data formatada sem HTML para venda ${index + 1}, tentando reformatar...`);
                if (dataParaFormatar) {
                    dataHoraFinal = formatarDataHora(dataParaFormatar);
                } else {
                    dataHoraFinal = '-';
                }
            }
        }
        
        // Log para debug (apenas se houver problema com data)
        if (dataHoraFinal === '-') {
            console.warn(`⚠️ Venda ${index + 1} sem data/hora válida na coluna Data/Hora:`, {
                id: venda.id,
            });
        } else {
            // Log de sucesso para primeira venda
            if (index === 0) {
                console.log(`✅ Data formatada com sucesso:`, {
                    formatada: dataHoraFinal,
                    original: dataParaFormatar,
                });
            }
        }
        
        // Criar linha da tabela com todas as 7 colunas na ordem correta
        // Ordem: Produto, Cliente, Email, Contato, Status, Valor Final, Data/Hora
        const row = document.createElement('tr');
        
        // Garantir que todos os valores estejam sanitizados para HTML
        const sanitizeHTML = (str) => {
            if (!str || str === 'undefined' || str === 'null') return '-';
            return String(str).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        };
        
        row.innerHTML = `
            <td>${sanitizeHTML(produtoFinal)}</td>
            <td>${sanitizeHTML(clienteFinal)}</td>
            <td>${sanitizeHTML(emailFinal)}</td>
            <td>${contatoFinal}</td>
            <td><span class="status-badge status-${statusFinal.toLowerCase().replace(/\s+/g, '-')}">${sanitizeHTML(statusFinal)}</span></td>
            <td>${sanitizeHTML(valorFinalFormatado)}</td>
            <td class="data-hora">${dataHoraFinal}</td>
        `;
        
        // Debug: Log para primeira venda com WhatsApp (apenas para debug)
        if (index === 0) {
            console.log('🔍 Debug Contato - Primeira venda:', {
                clienteWhatsapp: clienteWhatsapp,
                hasWhatsapp: hasWhatsapp,
                whatsappNumber: whatsappNumber || 'N/A',
                clienteTelefone: clienteTelefone,
                telefonePagamento: telefonePagamento,
                contatoFormatado: contatoFormatado.includes('whatsapp') ? 'Ícone WhatsApp criado' : contatoFormatado
            });
        }
        
        tbody.appendChild(row);
        
        // Log de sucesso apenas para primeira venda
        if (index === 0) {
            console.log(`✅ Primeira venda renderizada:`, {
                produto: produtoFinal,
                cliente: clienteFinal,
                status: statusFinal,
            });
        }
    });
    
}

// Variável global para armazenar vendas originais
let todasVendasOriginais = [];

// Função para aplicar filtros
function aplicarFiltros() {
    
    const filtroProduto = document.getElementById('filtroProduto')?.value || '';
    const filtroCliente = document.getElementById('filtroCliente')?.value || '';
    const filtroEmail = document.getElementById('filtroEmail')?.value || '';
    const filtroStatus = document.getElementById('filtroStatus')?.value || '';
    const filtroDataHora = document.getElementById('filtroDataHora')?.value || '';
    const filtroDataInicio = document.getElementById('filtroDataInicio')?.value || '';
    const filtroDataFim = document.getElementById('filtroDataFim')?.value || '';
    
    // Usar vendas originais para filtrar
    const vendasParaFiltrar = todasVendasOriginais.length > 0 ? todasVendasOriginais : todasVendas;
    
    // Filtrar vendas
    const vendasFiltradas = vendasParaFiltrar.filter(venda => {
        if (!venda) return false;
        
        // Filtro por produto (ID Custom)
        if (filtroProduto) {
            const produtoCustomId = venda.produto?.custom_id || '';
            const produtoId = venda.produto?.id || '';
            const produtoNome = venda.produto?.nome || '';
            const produtoDisplay = produtoCustomId || produtoId || produtoNome;
            
            if (!produtoDisplay.toLowerCase().includes(filtroProduto.toLowerCase())) {
                return false;
            }
        }
        
        // Filtro por email
        if (filtroEmail) {
            const clienteEmail = venda.cliente_email || venda.cliente?.email || '';
            if (!clienteEmail.toLowerCase().includes(filtroEmail.toLowerCase())) {
                return false;
            }
        }
        
        // Filtro por status
        if (filtroStatus) {
            let status = venda.pagamento?.status || venda.pagamento_status || venda.status || '';
            
            // Mapear status para comparação consistente
            if (status === 'Pago') {
                status = 'Aprovado';
            } else if (status === 'Cancelada') {
                status = 'Cancelado';
            } else if (status === 'Rejeitado') {
                status = 'Cancelado';
            }
            
            if (status.toLowerCase() !== filtroStatus.toLowerCase()) {
                return false;
            }
        }
        
        // Filtro por período (data início e fim)
        if (filtroDataInicio || filtroDataFim) {
            if (!venda.data_venda) return false;
            
            try {
                const dataVenda = new Date(venda.data_venda);
                const dataVendaStr = dataVenda.toISOString().split('T')[0];
                
                // Se apenas data início fornecida
                if (filtroDataInicio && !filtroDataFim) {
                    if (dataVendaStr < filtroDataInicio) {
                        return false;
                    }
                }
                // Se apenas data fim fornecida
                else if (!filtroDataInicio && filtroDataFim) {
                    if (dataVendaStr > filtroDataFim) {
                        return false;
                    }
                }
                // Se ambas as datas fornecidas
                else if (filtroDataInicio && filtroDataFim) {
                    if (dataVendaStr < filtroDataInicio || dataVendaStr > filtroDataFim) {
                        return false;
                    }
                }
            } catch (error) {
                console.warn('Erro ao filtrar por período:', error);
                return false;
            }
        }
        
        return true;
    });
    
    
    // Atualizar vendas filtradas e renderizar
    todasVendas = vendasFiltradas;
    currentPageVendas = 1; // Resetar para primeira página
    renderizarVendasDetalhadas();
}

// Função para limpar filtros
function limparFiltros() {
    
    // Limpar campos de filtro
    const filtros = ['filtroProduto', 'filtroEmail', 'filtroStatus', 'filtroDataInicio', 'filtroDataFim'];
    filtros.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            elemento.value = '';
        }
    });
    
    // Restaurar vendas originais
    if (todasVendasOriginais.length > 0) {
        todasVendas = [...todasVendasOriginais];
        currentPageVendas = 1;
        renderizarVendasDetalhadas();
    } else {
        // Se não há vendas originais, recarregar
        carregarVendasDetalhadas();
    }
}

// Função para carregar clientes (removida - dados resumidos na tabela de vendas)

// Função para atualizar timestamp da última atualização
function atualizarTimestampUltimaAtualizacao() {
    const lastUpdateInfo = document.getElementById('lastUpdateInfo');
    if (lastUpdateInfo) {
        const now = new Date();
        lastUpdateInfo.textContent = `Última atualização: ${now.toLocaleTimeString('pt-BR')}`;
    }
}

// Função para buscar clientes (removida - não mais necessária)

// ==================== INICIALIZAÇÃO DA PÁGINA ====================

// Aguardar o DOM estar carregado
document.addEventListener('DOMContentLoaded', async () => {
    try {
        
        // Verificar se a API_BASE está definida
        if (!window.API_BASE) {
            console.error('❌ API_BASE não está definida');
            return;
        }
        
        // Configurar botão de atualizar
        const btnAtualizar = document.getElementById('btnAtualizar');
        if (btnAtualizar) {
            btnAtualizar.addEventListener('click', async () => {
                btnAtualizar.disabled = true;
                btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
                
                try {
                    await carregarDadosVendas();
                } finally {
                    btnAtualizar.disabled = false;
                    btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar Dados';
                }
            });
        }
        
        // Configurar controles de paginação
        const btnAnterior = document.getElementById('btnAnterior');
        const btnProximo = document.getElementById('btnProximo');
        
        if (btnAnterior) {
            btnAnterior.addEventListener('click', paginaAnterior);
        }
        
        if (btnProximo) {
            btnProximo.addEventListener('click', paginaProxima);
        }
        
        // Configurar filtros
        const btnLupaFiltroDetalhado = document.getElementById('btnLupaFiltroDetalhado');
        if (btnLupaFiltroDetalhado) {
            btnLupaFiltroDetalhado.addEventListener('click', aplicarFiltros);
        }
        // Botão da lupa é opcional - não gerar aviso se não existir
        
        // Configurar botão de limpar filtros
        const btnLimparFiltros = document.getElementById('btnLimparFiltros');
        if (btnLimparFiltros) {
            btnLimparFiltros.addEventListener('click', limparFiltros);
        } else {
            console.warn('⚠️ Botão de limpar filtros não encontrado');
        }
        
        // Configurar filtros para funcionar com Enter
        const filtros = ['filtroProduto', 'filtroEmail', 'filtroStatus', 'filtroDataInicio', 'filtroDataFim'];
        filtros.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        aplicarFiltros();
                    }
                });
            }
        });
        
        // Configurar filtro de status para aplicar automaticamente
        const filtroStatus = document.getElementById('filtroStatus');
        if (filtroStatus) {
            filtroStatus.addEventListener('change', aplicarFiltros);
        }
        
        // Configurar filtros de data para aplicar automaticamente
        const filtroDataInicio = document.getElementById('filtroDataInicio');
        const filtroDataFim = document.getElementById('filtroDataFim');
        if (filtroDataInicio) {
            filtroDataInicio.addEventListener('change', aplicarFiltros);
        }
        if (filtroDataFim) {
            filtroDataFim.addEventListener('change', aplicarFiltros);
        }
        
        // Carregar dados iniciais
        await carregarDadosVendas(); // Carrega estatísticas e vendas detalhadas
        
    } catch (error) {
        console.error('❌ Erro durante a inicialização da página:', error);
    }
});

