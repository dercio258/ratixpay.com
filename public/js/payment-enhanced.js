/**
 * Sistema de Pagamento Aprimorado - RatixPay
 * Coleta dados detalhados durante o processo de pagamento
 */

class PaymentEnhanced {
    constructor() {
        this.analytics = this.captureAnalytics();
        this.initializeEventListeners();
    }

    // Capturar dados de analytics
    captureAnalytics() {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        
        return {
            utmSource: urlParams.get('utm_source') || urlParams.get('utmSource'),
            utmMedium: urlParams.get('utm_medium') || urlParams.get('utmMedium'),
            utmCampaign: urlParams.get('utm_campaign') || urlParams.get('utmCampaign'),
            utmTerm: urlParams.get('utm_term') || urlParams.get('utmTerm'),
            utmContent: urlParams.get('utm_content') || urlParams.get('utmContent'),
            referrer: referrer,
            origemTrafico: this.determineTrafficSource(referrer),
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
    }

    // Determinar origem do tráfego
    determineTrafficSource(referrer) {
        if (!referrer) return 'Direto';
        
        const referrerLower = referrer.toLowerCase();
        if (referrerLower.includes('google')) return 'Google';
        if (referrerLower.includes('facebook')) return 'Facebook';
        if (referrerLower.includes('instagram')) return 'Instagram';
        if (referrerLower.includes('whatsapp')) return 'WhatsApp';
        if (referrerLower.includes('telegram')) return 'Telegram';
        if (referrerLower.includes('youtube')) return 'YouTube';
        if (referrerLower.includes('linkedin')) return 'LinkedIn';
        if (referrerLower.includes('twitter')) return 'Twitter';
        
        return 'Outros Sites';
    }

    // Inicializar event listeners
    initializeEventListeners() {
        // Formulário de pagamento
        const paymentForm = document.getElementById('payment-form');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => this.handlePayment(e));
        }

        // Campos de dados do cliente
        this.setupClientDataFields();
    }

    // Configurar campos de dados do cliente
    setupClientDataFields() {
        // Auto-preenchimento de dados se disponível
        const savedData = this.getSavedClientData();
        if (savedData) {
            this.fillClientFields(savedData);
        }

        // Salvar dados do cliente quando preenchidos
        const clientFields = ['nomeCliente', 'emailCliente', 'telefoneCliente'];
        clientFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('change', () => this.saveClientData());
            }
        });
    }

    // Processar pagamento com dados completos
    async handlePayment(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        
        // Obter o produto para extrair o valor
        const produtoId = formData.get('produtoId');
        let valorPagamento = 0;
        
        try {
            // Tentar obter o valor do produto do elemento HTML
            const totalElement = document.getElementById('total');
            if (totalElement && totalElement.textContent) {
                // Extrair apenas os números do formato "MZN 123,45"
                const valorTexto = totalElement.textContent.replace(/[^0-9,]/g, '').replace(',', '.');
                valorPagamento = parseFloat(valorTexto);
            }
            
            // Verificar se o valor é válido
            if (isNaN(valorPagamento) || valorPagamento <= 0) {
                throw new Error('Valor de pagamento inválido');
            }
        } catch (error) {
            console.error('Erro ao obter valor do pagamento:', error);
            this.handlePaymentError('Valor de pagamento inválido. Por favor, recarregue a página.');
            return;
        }
        
        const paymentData = {
            produtoId: produtoId,
            numeroCelular: formData.get('numeroCelular'),
            metodo: formData.get('metodo'),
            nomeCliente: formData.get('nomeCliente'),
            emailCliente: formData.get('emailCliente'),
            cpfCliente: formData.get('cpfCliente'),
            enderecoCliente: formData.get('enderecoCliente'),
            cidadeCliente: formData.get('cidadeCliente'),
            paisCliente: formData.get('paisCliente') || 'Moçambique',
            afiliadoCodigo: formData.get('afiliadoCodigo'),
            cupomDesconto: formData.get('cupomDesconto'),
            observacoes: formData.get('observacoes'),
            // Adicionar valor do pagamento
            valor: valorPagamento,
            // Dados de analytics
            utmSource: this.analytics.utmSource,
            utmMedium: this.analytics.utmMedium,
            utmCampaign: this.analytics.utmCampaign,
            campanha: this.analytics.utmCampaign,
            origemTrafico: this.analytics.origemTrafico
        };

        try {
            this.showLoading();
            
            const response = await fetch('/api/pagar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include',
                body: JSON.stringify(paymentData)
            });

            const result = await response.json();

            if (result.success) {
                this.handlePaymentSuccess(result.data);
            } else {
                this.handlePaymentError(result.error);
            }

        } catch (error) {
            console.error('Erro no pagamento:', error);
            this.handlePaymentError('Erro de conexão. Tente novamente.');
        } finally {
            this.hideLoading();
        }
    }

    // Tratar sucesso do pagamento
    handlePaymentSuccess(data) {
        
        // Salvar dados do cliente
        this.saveClientData();
        
        // Mostrar sucesso
        this.showSuccessMessage(data);
        
        // Redirecionar para página de sucesso sem passar ID
        window.location.href = '/payment/success';
    }

    // Tratar erro do pagamento
    handlePaymentError(error) {
        console.error('❌ Erro no pagamento:', error);
        this.showErrorMessage(error);
    }

    // Mostrar mensagem de sucesso
    showSuccessMessage(data) {
        const message = `
            <div class="alert alert-success">
                <h4>✅ Pagamento Processado!</h4>
                <p><strong>Transação ID:</strong> ${data.venda.transacaoId}</p>
                <p><strong>Produto:</strong> ${data.produto.nome}</p>
                <p><strong>Valor:</strong> ${data.produto.valorFormatado}</p>
                <p><strong>Método:</strong> ${data.pagamento.metodo}</p>
                <p>Você receberá uma confirmação por email.</p>
            </div>
        `;
        
        this.showMessage(message, 'success');
    }

    // Mostrar mensagem de erro
    showErrorMessage(error) {
        const message = `
            <div class="alert alert-danger">
                <h4>❌ Erro no Pagamento</h4>
                <p>${error}</p>
                <p>Tente novamente ou entre em contato conosco.</p>
            </div>
        `;
        
        this.showMessage(message, 'error');
    }

    // Mostrar mensagem
    showMessage(message, type) {
        const messageContainer = document.getElementById('message-container') || 
                               document.createElement('div');
        
        if (!document.getElementById('message-container')) {
            messageContainer.id = 'message-container';
            messageContainer.className = 'mt-3';
            document.querySelector('form').appendChild(messageContainer);
        }
        
        messageContainer.innerHTML = message;
        messageContainer.scrollIntoView({ behavior: 'smooth' });
    }

    // Mostrar loading
    showLoading() {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processando...';
        }
    }

    // Esconder loading
    hideLoading() {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Pagar Agora';
        }
    }

    // Salvar dados do cliente
    saveClientData() {
        const clientData = {
            nome: document.getElementById('nomeCliente')?.value,
            email: document.getElementById('emailCliente')?.value,
            telefone: document.getElementById('telefoneCliente')?.value
        };

        if (clientData.nome || clientData.email || clientData.telefone) {
            localStorage.setItem('ratixpay_client_data', JSON.stringify(clientData));
        }
    }

    // Obter dados salvos do cliente
    getSavedClientData() {
        const saved = localStorage.getItem('ratixpay_client_data');
        return saved ? JSON.parse(saved) : null;
    }

    // Preencher campos do cliente
    fillClientFields(data) {
        if (data.nome) document.getElementById('nomeCliente').value = data.nome;
        if (data.email) document.getElementById('emailCliente').value = data.email;
        if (data.telefone) document.getElementById('telefoneCliente').value = data.telefone;
    }

    // Buscar detalhes de uma transação
    async getTransactionDetails(transacaoId) {
        try {
            const response = await fetch(`/api/vendas/transacao/${transacaoId}`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'include'
            });
            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao buscar transação:', error);
            throw error;
        }
    }

    // Mostrar detalhes da transação
    async showTransactionDetails(transacaoId) {
        try {
            const transacao = await this.getTransactionDetails(transacaoId);
            this.displayTransactionInfo(transacao);
        } catch (error) {
            this.showErrorMessage('Erro ao carregar detalhes da transação');
        }
    }

    // Exibir informações da transação
    displayTransactionInfo(transacao) {
        const container = document.getElementById('transaction-details');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h5>Detalhes da Transação</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Informações da Transação</h6>
                            <p><strong>ID:</strong> ${transacao.id}</p>
                            <p><strong>Transação ID:</strong> ${transacao.transacaoId}</p>
                            <p><strong>Status:</strong> <span class="badge bg-${this.getStatusColor(transacao.status)}">${transacao.status}</span></p>
                            <p><strong>Data:</strong> ${new Date(transacao.dataVenda).toLocaleString('pt-BR')}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Produto</h6>
                            <p><strong>Nome:</strong> ${transacao.produto.nome}</p>
                            <p><strong>Código:</strong> ${transacao.produto.customId}</p>
                            <p><strong>Tipo:</strong> ${transacao.produto.tipo}</p>
                            <p><strong>Valor:</strong> ${transacao.pagamento.valorFormatado}</p>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h6>Cliente</h6>
                            <p><strong>Nome:</strong> ${transacao.cliente.nome}</p>
                            <p><strong>Email:</strong> ${transacao.cliente.email}</p>
                            <p><strong>Telefone:</strong> ${transacao.cliente.telefone}</p>
                            <p><strong>Cidade:</strong> ${transacao.cliente.cidade}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>Pagamento</h6>
                            <p><strong>Método:</strong> ${transacao.pagamento.metodo}</p>
                            <p><strong>Status:</strong> ${transacao.pagamento.status}</p>
                            <p><strong>Gateway:</strong> ${transacao.pagamento.gateway}</p>
                            <p><strong>Referência:</strong> ${transacao.pagamento.referencia || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-6">
                            <h6>Analytics</h6>
                            <p><strong>Dispositivo:</strong> ${transacao.analytics.dispositivo}</p>
                            <p><strong>Navegador:</strong> ${transacao.analytics.navegador}</p>
                            <p><strong>Origem:</strong> ${transacao.analytics.origemTrafico}</p>
                            <p><strong>Campanha:</strong> ${transacao.analytics.campanha || 'N/A'}</p>
                        </div>
                        <div class="col-md-6">
                            <h6>UTM Parameters</h6>
                            <p><strong>Source:</strong> ${transacao.analytics.utmSource || 'N/A'}</p>
                            <p><strong>Medium:</strong> ${transacao.analytics.utmMedium || 'N/A'}</p>
                            <p><strong>Campaign:</strong> ${transacao.analytics.utmCampaign || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Obter cor do status
    getStatusColor(status) {
        switch (status) {
            case 'Pago': return 'success';
            case 'Pendente': return 'warning';
            case 'Cancelado': return 'danger';
            case 'Rejeitado': return 'danger';
            default: return 'secondary';
        }
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.paymentEnhanced = new PaymentEnhanced();
    
    // Se estiver na página de sucesso, mostrar detalhes da transação
    const urlParams = new URLSearchParams(window.location.search);
    const transacaoId = urlParams.get('transacaoId');
    
    if (transacaoId && window.paymentEnhanced) {
        window.paymentEnhanced.showTransactionDetails(transacaoId);
    }
});

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymentEnhanced;
}