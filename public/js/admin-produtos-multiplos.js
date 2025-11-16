// Funções de seleção múltipla de produtos
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllProdutos');
    if (!selectAll) return;
    
    const checkboxes = document.querySelectorAll('.produto-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    atualizarContadorSelecionados();
}

function atualizarContadorSelecionados() {
    const checkboxes = document.querySelectorAll('.produto-checkbox:checked');
    const contador = checkboxes.length;
    const contadorEl = document.getElementById('contadorSelecionados');
    const btnEl = document.getElementById('btnExcluirSelecionados');
    
    if (contadorEl) contadorEl.textContent = contador;
    if (btnEl) btnEl.disabled = contador === 0;
}

// Inicializar event listeners
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckboxes);
} else {
    initCheckboxes();
}

function initCheckboxes() {
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('produto-checkbox')) {
            atualizarContadorSelecionados();
            const selectAll = document.getElementById('selectAllProdutos');
            if (selectAll) {
                const totalCheckboxes = document.querySelectorAll('.produto-checkbox').length;
                const checkedCheckboxes = document.querySelectorAll('.produto-checkbox:checked').length;
                selectAll.checked = totalCheckboxes > 0 && checkedCheckboxes === totalCheckboxes;
            }
        }
    });
}

async function excluirProdutosSelecionados() {
    const checkboxes = document.querySelectorAll('.produto-checkbox:checked');
    const produtosIds = Array.from(checkboxes).map(cb => cb.value);
    
    if (produtosIds.length === 0) {
        if (typeof mostrarNotificacao === 'function') {
            mostrarNotificacao('Nenhum produto selecionado', 'warning');
        } else {
            alert('Nenhum produto selecionado');
        }
        return;
    }

    // Buscar produtos selecionados
    let produtosSelecionados = [];
    if (typeof produtos !== 'undefined' && Array.isArray(produtos)) {
        produtosSelecionados = produtos.filter(p => produtosIds.includes(p.id));
    }
    
    const nomesProdutos = produtosSelecionados.length > 0 
        ? produtosSelecionados.map(p => p.nome).join(', ')
        : `${produtosIds.length} produto(s)`;
    
    const confirmacao = confirm(`Tem certeza que deseja excluir ${produtosIds.length} produto(s)?\n\nProdutos: ${nomesProdutos}\n\nEsta ação não pode ser desfeita.`);
    if (!confirmacao) return;

    try {
        const token = localStorage.getItem('ratixpay_token') || localStorage.getItem('authToken') || localStorage.getItem('token');
        const response = await fetch(`/api/admin/produtos/multiplos`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ produtosIds })
        });

        if (response.ok) {
            const data = await response.json();
            const mensagem = data.message || `${data.excluidos || produtosIds.length} produto(s) excluído(s) com sucesso!`;
            
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao(mensagem, 'success');
            } else {
                alert(mensagem);
            }
            
            // Recarregar produtos
            if (typeof carregarProdutos === 'function') {
                await carregarProdutos();
            } else {
                location.reload();
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erro ao excluir produtos');
        }
    } catch (error) {
        console.error('Erro ao excluir produtos:', error);
        if (typeof mostrarNotificacao === 'function') {
            mostrarNotificacao(`Erro ao excluir produtos: ${error.message}`, 'error');
        } else {
            alert(`Erro ao excluir produtos: ${error.message}`);
        }
    }
}

