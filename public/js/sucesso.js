// Script para verificar status do pagamento na PaySuite e exibir ao usuário

(async function() {
    const statusDiv = document.getElementById('statusPagamento');
    const transactionId = localStorage.getItem('ratixpay_transactionId');
    if (!transactionId) {
        statusDiv.innerHTML = '<span style="color:red">ID da transação não encontrado.</span>';
        return;
    }

    statusDiv.innerHTML = 'Verificando status do pagamento...';

    try {
        // Buscar status na PaySuite
        const response = await fetch(`/api/vendas/status/${transactionId}`, {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include'
        });
        const data = await response.json();
        let statusMsg = '';
        let color = 'orange';
        let hora = '';
        if (data && data.status) {
            if (data.status === 'Aprovado') {
                statusMsg = 'Pagamento aprovado!';
                color = 'green';
            } else if (data.status === 'Rejeitado') {
                statusMsg = 'Pagamento rejeitado.';
                color = 'red';
            } else if (data.status === 'Pendente') {
                statusMsg = 'Pagamento pendente.';
                color = 'orange';
            } else {
                statusMsg = 'Status: ' + data.status;
            }
            if (data.venda && data.venda.dataVenda) {
                hora = new Date(data.venda.dataVenda).toLocaleString('pt-BR');
            }
        } else {
            statusMsg = 'Não foi possível obter o status.';
            color = 'red';
        }
        statusDiv.innerHTML = `<strong>Status:</strong> <span style="color:${color}">${statusMsg}</span><br><strong>Hora:</strong> ${hora}`;
    } catch (err) {
        statusDiv.innerHTML = '<span style="color:red">Erro ao verificar status do pagamento.</span>';
    }
})();