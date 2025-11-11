// Configuração do Socket.IO para atualizações em tempo real
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se o usuário está autenticado antes de conectar ao socket
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('Usuário não autenticado. Conexão Socket.IO não iniciada.');
        return;
    }

    // Conectar ao servidor Socket.IO
    const socket = io(window.API_BASE, {
        withCredentials: true,
        auth: {
            token: token
        }
    });

    // Eventos de conexão
    socket.on('connect', () => {
        console.log('Conectado ao servidor de atualizações em tempo real');
        
        // Entrar na sala de vendas para receber atualizações
        socket.emit('join', 'vendas');
    });

    socket.on('connect_error', (error) => {
        console.error('Erro de conexão Socket.IO:', error);
    });

    socket.on('disconnect', (reason) => {
        console.log('Desconectado do servidor de atualizações em tempo real:', reason);
    });

    // Evento para atualização de status de pagamento
    socket.on('payment_status_updated', (data) => {
        console.log('Atualização de status de pagamento recebida:', data);
        
        // Atualizar a tabela de vendas detalhadas se estiver visível
        atualizarVendaNaTabela(data.venda);
        
        // Recarregar estatísticas
        carregarDadosVendas();
        
        // Notificar o usuário
        notificarAtualizacao(`Pagamento atualizado: ${data.venda.cliente_nome} - ${data.status}`);
    });

    // Evento para atualização de status geral
    socket.on('status_updated', (data) => {
        console.log('Atualização de status geral recebida:', data);
        
        // Atualizar a tabela de vendas detalhadas se estiver visível
        atualizarVendaNaTabela(data.venda);
        
        // Recarregar estatísticas
        carregarDadosVendas();
        
        // Notificar o usuário
        notificarAtualizacao(`Status atualizado: ${data.venda.cliente_nome} - ${data.status}`);
    });
});

// Função para atualizar uma venda específica na tabela
function atualizarVendaNaTabela(venda) {
    // Procurar a linha da venda na tabela pelo ID da transação
    const transacaoId = venda.pagamento_transacao_id;
    const vendasTable = document.getElementById('vendasDetalhadasBody');
    
    if (!vendasTable) return;
    
    // Procurar a linha com o ID da transação
    const rows = vendasTable.querySelectorAll('tr');
    let found = false;
    
    rows.forEach(row => {
        // Verificar se esta linha contém o ID da transação
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) { // Garantir que há células suficientes
            const idCell = cells[6]; // Célula que contém o ID da transação
            if (idCell.textContent.includes(transacaoId)) {
                // Atualizar o status de pagamento
                const statusCell = cells[4]; // Célula que contém o status
                statusCell.textContent = venda.pagamento_status;
                
                // Destacar a linha atualizada
                row.classList.add('updated-row');
                setTimeout(() => {
                    row.classList.remove('updated-row');
                }, 3000);
                
                found = true;
            }
        }
    });
    
    // Se a venda não foi encontrada na tabela atual, pode ser necessário recarregar os dados
    if (!found && window.shouldReloadOnNewData) {
        carregarVendasDetalhadas();
    }
}

// Função para mostrar notificação de atualização
function notificarAtualizacao(mensagem) {
    // Verificar se o container de notificação já existe
    let notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
        // Criar o container de notificação
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        notificationContainer.style.position = 'fixed';
        notificationContainer.style.bottom = '20px';
        notificationContainer.style.right = '20px';
        notificationContainer.style.zIndex = '1000';
        document.body.appendChild(notificationContainer);
    }
    
    // Criar a notificação
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.backgroundColor = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '15px';
    notification.style.marginBottom = '10px';
    notification.style.borderRadius = '5px';
    notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    notification.style.minWidth = '300px';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s ease-in-out';
    
    // Adicionar o conteúdo da notificação
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${mensagem}</span>
            <button style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">&times;</button>
        </div>
    `;
    
    // Adicionar a notificação ao container
    notificationContainer.appendChild(notification);
    
    // Mostrar a notificação com animação
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Configurar o botão de fechar
    const closeButton = notification.querySelector('button');
    closeButton.addEventListener('click', () => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notificationContainer.removeChild(notification);
        }, 300);
    });
    
    // Remover a notificação após 5 segundos
    setTimeout(() => {
        if (notification.parentNode === notificationContainer) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode === notificationContainer) {
                    notificationContainer.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

// Adicionar estilo para linhas atualizadas
const style = document.createElement('style');
style.textContent = `
    .updated-row {
        animation: highlight 3s;
    }
    
    @keyframes highlight {
        0% { background-color: rgba(255, 255, 0, 0.5); }
        100% { background-color: transparent; }
    }
`;
document.head.appendChild(style);

// Configuração global para recarregar dados quando novas vendas chegarem
window.shouldReloadOnNewData = true;