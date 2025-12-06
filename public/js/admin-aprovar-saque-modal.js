// Função melhorada para aprovar saque com modal completo
async function aprovarSaque(saqueId) {
    try {
        // Buscar dados do saque para mostrar no resumo
        const token = verificarAutenticacao();
        if (!token) return;

        const response = await fetch(`${API_BASE}/admin/saques/${saqueId}`, {
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao buscar dados do saque');
        }

        const data = await response.json();
        const saque = data.data;

        // Calcular valores
        const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
        const taxa = valorSolicitado * 0.05; // 5% de taxa
        const valorLiquido = valorSolicitado - taxa; // Valor líquido = valor solicitado - 5%

        // Obter ID público (public ID de 6 dígitos)
        const publicId = saque.publicId || saque.public_id || saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-');

        // Dados de Mpesa
        const dadosMpesa = saque.dadosMpesa || saque.dadosCarteiraCompleta?.mpesa || {};
        const mpesaNome = dadosMpesa.nomeTitular || 'N/A';
        const mpesaContacto = dadosMpesa.contacto || 'N/A';

        // Dados de Emola
        const dadosEmola = saque.dadosEmola || saque.dadosCarteiraCompleta?.emola || {};
        const emolaNome = dadosEmola.nomeTitular || 'N/A';
        const emolaContacto = dadosEmola.contacto || 'N/A';

        // Método de pagamento
        const metodo = saque.metodo || saque.metodoPagamento || saque.metodo_pagamento || 'N/A';

        // Data formatada
        const dataFormatada = saque.dataSolicitacao || saque.data_solicitacao 
            ? new Date(saque.dataSolicitacao || saque.data_solicitacao).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'N/A';

        // Mostrar modal de resumo da transação
        const modalContent = `
            <div class="modal fade" id="modalAprovarSaque" tabindex="-1" aria-labelledby="modalAprovarSaqueLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header" style="background: linear-gradient(135deg, #f64c00 0%, #e04500 100%); color: white;">
                            <h5 class="modal-title" id="modalAprovarSaqueLabel">
                                <i class="fas fa-check-circle"></i> Resumo da Transação
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fechar"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-12">
                                    <div class="card border-0 shadow-sm" style="background: linear-gradient(135deg, #fff5f0 0%, #ffe8e0 100%);">
                                        <div class="card-body">
                                            <h6 class="text-uppercase mb-3" style="color: #f64c00; font-weight: 700;">
                                                <i class="fas fa-id-card"></i> ID do Saque
                                            </h6>
                                            <h3 class="mb-0" style="color: #f64c00; font-weight: 800; font-family: 'Courier New', monospace;">
                                                ${publicId}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <div class="card border-0 shadow-sm mb-3">
                                        <div class="card-header" style="background: #f64c00; color: white;">
                                            <h6 class="mb-0"><i class="fas fa-money-bill-wave"></i> Valores da Transação</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-3">
                                                <strong style="color: #666;">Valor Solicitado:</strong>
                                                <div class="h5 mb-0" style="color: #f64c00; font-weight: 700;">
                                                    MZN ${valorSolicitado.toFixed(2)}
                                                </div>
                                            </div>
                                            <div class="mb-3">
                                                <strong style="color: #666;">Taxa (5%):</strong>
                                                <div class="h6 mb-0" style="color: #e67e22;">
                                                    MZN ${taxa.toFixed(2)}
                                                </div>
                                            </div>
                                            <hr>
                                            <div>
                                                <strong style="color: #666;">Valor Líquido:</strong>
                                                <div class="h4 mb-0" style="color: #27ae60; font-weight: 800;">
                                                    MZN ${valorLiquido.toFixed(2)}
                                                </div>
                                                <small class="text-muted">Valor que será pago ao vendedor</small>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card border-0 shadow-sm mb-3">
                                        <div class="card-header" style="background: #f64c00; color: white;">
                                            <h6 class="mb-0"><i class="fas fa-info-circle"></i> Informações Gerais</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-2">
                                                <strong>Método de Pagamento:</strong>
                                                <span class="badge" style="background: #f64c00; color: white;">${metodo}</span>
                                            </div>
                                            <div class="mb-2">
                                                <strong>Data da Solicitação:</strong>
                                                <div>${dataFormatada}</div>
                                            </div>
                                            <div class="mb-2">
                                                <strong>Status Atual:</strong>
                                                <span class="badge bg-warning">${(saque.status || 'PENDENTE').toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6">
                                    <div class="card border-0 shadow-sm mb-3">
                                        <div class="card-header" style="background: #e74c3c; color: white;">
                                            <h6 class="mb-0"><i class="fas fa-mobile-alt"></i> Dados M-Pesa</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-2">
                                                <strong>Nome do Titular:</strong>
                                                <div>${mpesaNome}</div>
                                            </div>
                                            <div class="mb-0">
                                                <strong>Contacto:</strong>
                                                <div style="font-family: 'Courier New', monospace; font-weight: 600; color: #e74c3c;">
                                                    ${mpesaContacto}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="card border-0 shadow-sm mb-3">
                                        <div class="card-header" style="background: #f39c12; color: white;">
                                            <h6 class="mb-0"><i class="fas fa-wallet"></i> Dados e-Mola</h6>
                                        </div>
                                        <div class="card-body">
                                            <div class="mb-2">
                                                <strong>Nome do Titular:</strong>
                                                <div>${emolaNome}</div>
                                            </div>
                                            <div class="mb-0">
                                                <strong>Contacto:</strong>
                                                <div style="font-family: 'Courier New', monospace; font-weight: 600; color: #f39c12;">
                                                    ${emolaContacto}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="alert alert-warning mt-3" style="border-left: 4px solid #f64c00;">
                                <i class="fas fa-info-circle"></i>
                                <strong>Confirmação:</strong> Ao aprovar este saque, o status será alterado para "PAGO" e o vendedor será notificado automaticamente.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button type="button" class="btn" style="background: linear-gradient(135deg, #f64c00 0%, #e04500 100%); color: white; border: none;" onclick="confirmarAprovacao('${saqueId}')">
                                <i class="fas fa-check"></i> Confirmar Aprovação
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior se existir
        const existingModal = document.getElementById('modalAprovarSaque');
        if (existingModal) {
            existingModal.remove();
        }

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalContent);
        
        // Mostrar modal
        const modalElement = document.getElementById('modalAprovarSaque');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

    } catch (error) {
        console.error('Erro ao mostrar modal de aprovação:', error);
        alert('Erro ao abrir resumo da transação: ' + error.message);
    }
}

