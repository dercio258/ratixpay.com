class CheckoutModal {
    constructor() {
        this.modal = null;
        this.isProcessing = false;
        this.paymentStatus = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        const modalHTML = `
            <div id="checkoutModal" class="modal fade" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false">
                <div class="modal-dialog modal-lg" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-credit-card"></i> 
                                Processando Pagamento
                            </h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close" id="closeModalBtn">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div id="paymentForm">
                                <div class="payment-info">
                                    <h6>Informações do Produto</h6>
                                    <div id="productInfo"></div>
                                    
                                    <h6 class="mt-3">Informações Pessoais</h6>
                                    <form id="checkoutForm">
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="nome">Nome Completo *</label>
                                                    <input type="text" class="form-control" id="nome" name="nome" required>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="email">Email *</label>
                                                    <input type="email" class="form-control" id="email" name="email" required>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="telefone">Telefone *</label>
                                                    <input type="tel" class="form-control" id="telefone" name="telefone" required>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="form-group">
                                                    <label for="cpf">CPF</label>
                                                    <input type="text" class="form-control" id="cpf" name="cpf">
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <h6 class="mt-3">Método de Pagamento</h6>
                                        <div class="payment-methods">
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="metodoPagamento" id="mpesa" value="Mpesa" checked>
                                                <label class="form-check-label" for="mpesa">
                                                    <i class="fas fa-mobile-alt"></i> M-Pesa
                                                </label>
                                            </div>
                                            <div class="form-check">
                                                <input class="form-check-input" type="radio" name="metodoPagamento" id="emola" value="Emola">
                                                <label class="form-check-label" for="emola">
                                                    <i class="fas fa-wallet"></i> Emola
                                                </label>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            
                            <div id="processingPayment" style="display: none;">
                                <div class="text-center">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="sr-only">Processando...</span>
                                    </div>
                                    <h5 class="mt-3">Processando Pagamento</h5>
                                    <p class="text-muted">Por favor, aguarde enquanto processamos seu pagamento...</p>
                                    <div class="progress mt-3">
                                        <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%"></div>
                                    </div>
                                </div>
                            </div>
                            
                            <div id="paymentSuccess" style="display: none;">
                                <div class="text-center">
                                    <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
                                    <h4 class="mt-3 text-success">Pagamento Aprovado!</h4>
                                    <p>Seu pagamento foi processado com sucesso.</p>
                                    <div class="alert alert-success">
                                        <strong>ID da Transação:</strong> <span id="transactionId"></span>
                                    </div>
                                    <button type="button" class="btn btn-success" id="successBtn">
                                        <i class="fas fa-download"></i> Baixar Produto
                                    </button>
                                </div>
                            </div>
                            
                            <div id="paymentError" style="display: none;">
                                <div class="text-center">
                                    <i class="fas fa-times-circle text-danger" style="font-size: 4rem;"></i>
                                    <h4 class="mt-3 text-danger">Erro no Pagamento</h4>
                                    <p id="errorMessage">Ocorreu um erro ao processar seu pagamento.</p>
                                    <button type="button" class="btn btn-primary" id="retryBtn">
                                        <i class="fas fa-redo"></i> Tentar Novamente
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer" id="modalFooter">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal" id="cancelBtn">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="payBtn">
                                <i class="fas fa-credit-card"></i> Pagar Agora
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('checkoutModal');
    }

    bindEvents() {
        // Botão de pagar
        document.getElementById('payBtn').addEventListener('click', () => {
            this.processPayment();
        });

        // Botão de cancelar
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.cancelPayment();
        });

        // Botão de fechar (desabilitado durante processamento)
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            if (!this.isProcessing) {
                this.closeModal();
            }
        });

        // Botão de tentar novamente
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.showPaymentForm();
        });

        // Botão de sucesso
        document.getElementById('successBtn').addEventListener('click', () => {
            this.handleSuccess();
        });

        // Prevenir fechamento do modal durante processamento
        this.modal.addEventListener('hide.bs.modal', (e) => {
            if (this.isProcessing) {
                e.preventDefault();
                return false;
            }
        });
    }

    show(productData) {
        this.productData = productData;
        this.isProcessing = false;
        this.paymentStatus = null;
        
        // Preencher informações do produto
        document.getElementById('productInfo').innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6>${productData.nome}</h6>
                    <p class="text-muted">${productData.descricao}</p>
                    <div class="d-flex justify-content-between">
                        <span class="text-muted">Preço:</span>
                        <strong class="text-primary">MZN ${productData.preco_com_desconto}</strong>
                    </div>
                </div>
            </div>
        `;
        
        // Mostrar formulário de pagamento
        this.showPaymentForm();
        
        // Abrir modal
        $(this.modal).modal('show');
    }

    showPaymentForm() {
        document.getElementById('paymentForm').style.display = 'block';
        document.getElementById('processingPayment').style.display = 'none';
        document.getElementById('paymentSuccess').style.display = 'none';
        document.getElementById('paymentError').style.display = 'none';
        document.getElementById('modalFooter').style.display = 'block';
        document.getElementById('closeModalBtn').style.display = 'block';
    }

    showProcessing() {
        this.isProcessing = true;
        document.getElementById('paymentForm').style.display = 'none';
        document.getElementById('processingPayment').style.display = 'block';
        document.getElementById('paymentSuccess').style.display = 'none';
        document.getElementById('paymentError').style.display = 'none';
        document.getElementById('modalFooter').style.display = 'none';
        document.getElementById('closeModalBtn').style.display = 'none';
    }

    showSuccess(transactionData) {
        this.isProcessing = false;
        this.paymentStatus = 'success';
        document.getElementById('transactionId').textContent = transactionData.id_transacao || 'N/A';
        
        document.getElementById('paymentForm').style.display = 'none';
        document.getElementById('processingPayment').style.display = 'none';
        document.getElementById('paymentSuccess').style.display = 'block';
        document.getElementById('paymentError').style.display = 'none';
        document.getElementById('modalFooter').style.display = 'none';
        document.getElementById('closeModalBtn').style.display = 'block';
    }

    showError(errorMessage) {
        this.isProcessing = false;
        this.paymentStatus = 'error';
        document.getElementById('errorMessage').textContent = errorMessage;
        
        document.getElementById('paymentForm').style.display = 'none';
        document.getElementById('processingPayment').style.display = 'none';
        document.getElementById('paymentSuccess').style.display = 'none';
        document.getElementById('paymentError').style.display = 'block';
        document.getElementById('modalFooter').style.display = 'block';
        document.getElementById('closeModalBtn').style.display = 'block';
    }

    async processPayment() {
        // Validar formulário
        const form = document.getElementById('checkoutForm');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Coletar dados do formulário
        const formData = new FormData(form);
        const paymentData = {
            produto_id: this.productData.id,
            cliente_nome: formData.get('nome'),
            cliente_email: formData.get('email'),
            cliente_telefone: formData.get('telefone'),
            cliente_cpf: formData.get('cpf'),
            pagamento_metodo: formData.get('metodoPagamento'),
            pagamento_valor: this.productData.preco_com_desconto
        };

        // Mostrar tela de processamento
        this.showProcessing();

        try {
            // Simular processamento de pagamento
            const response = await this.simulatePayment(paymentData);
            
            if (response.success) {
                this.showSuccess(response.data);
            } else {
                this.showError(response.message || 'Erro ao processar pagamento');
            }
        } catch (error) {
            console.error('Erro no pagamento:', error);
            this.showError('Erro de conexão. Tente novamente.');
        }
    }

    async simulatePayment(paymentData) {
        // Simular delay de processamento
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Simular sucesso (90% das vezes)
        const isSuccess = Math.random() > 0.1;
        
        if (isSuccess) {
            return {
                success: true,
                data: {
                    id_transacao: 'TXN' + Date.now(),
                    status: 'Aprovado',
                    valor: paymentData.pagamento_valor
                }
            };
        } else {
            return {
                success: false,
                message: 'Pagamento rejeitado. Verifique seus dados e tente novamente.'
            };
        }
    }

    cancelPayment() {
        if (this.isProcessing) {
            return; // Não permitir cancelamento durante processamento
        }
        this.closeModal();
    }

    closeModal() {
        $(this.modal).modal('hide');
    }

    handleSuccess() {
        // Redirecionar para página de sucesso com todos os parâmetros
        const transactionId = document.getElementById('transactionId').textContent;
        const clientName = document.getElementById('nome').value;
        const amount = this.productData.preco_com_desconto;
        const productId = this.productData.id;
        
        // Usar idpedido se o transactionId for um número de 6 dígitos, senão usar pedido
        const isIdPedido = /^\d{6}$/.test(transactionId);
        const pedidoParam = isIdPedido ? `idpedido=${transactionId}` : `pedido=${transactionId}`;
        const successUrl = `/payment-success.html?${pedidoParam}&productId=${productId}&clientName=${encodeURIComponent(clientName)}&amount=${amount}`;
        window.location.href = successUrl;
    }
}

// Inicializar modal de checkout
const checkoutModal = new CheckoutModal();

// Função global para abrir modal de checkout
function openCheckoutModal(productData) {
    checkoutModal.show(productData);
}
