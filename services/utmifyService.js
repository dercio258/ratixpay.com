const fetch = require('node-fetch');

/**
 * Serviço de Integração com UTMify
 * Envia vendas automaticamente para a API oficial da UTMify
 * 
 * @class UTMifyService
 */
class UTMifyService {
    constructor() {
        this.apiUrl = 'https://api.utmify.com.br/api-credentials/orders';
        this.timeout = 10000; // 10 segundos
    }

    /**
     * Envia uma venda para a UTMify
     * 
     * @param {Object} venda - Objeto da venda do banco de dados
     * @param {Object} produto - Objeto do produto (deve conter utmfy_api_key)
     * @param {Object} cliente - Dados do cliente
     * @param {Object} trackingParams - Parâmetros UTM e de rastreamento
     * @param {Object} options - Opções adicionais (isTest, etc)
     * @returns {Promise<Object>} Resposta da API UTMify
     */
    async enviarVenda(venda, produto, cliente, trackingParams = {}, options = {}) {
        try {
            // Verificar se o produto tem token UTMify configurado
            const utmifyToken = produto.utmfy_api_key;
            
            if (!utmifyToken) {
                console.log('⚠️ UTMIFY: Produto não possui token UTMify configurado. Pulando envio.');
                console.log('⚠️ UTMIFY: Produto ID:', produto.id, '| Nome:', produto.nome);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Token UTMify não configurado'
                };
            }

            // Verificar se o rastreamento está ativo
            if (!produto.utmfy_active) {
                console.log('⚠️ UTMIFY: Rastreamento UTMify não está ativo para este produto. Pulando envio.');
                console.log('⚠️ UTMIFY: Produto ID:', produto.id, '| utmfy_active:', produto.utmfy_active);
                return {
                    success: false,
                    skipped: true,
                    reason: 'Rastreamento UTMify não ativo'
                };
            }

            console.log('═══════════════════════════════════════════════════════════');
            console.log('🚀 UTMIFY: Enviando venda para UTMify');
            console.log('📦 Venda ID:', venda.id);
            console.log('📦 Produto ID:', produto.id, '| Nome:', produto.nome);
            console.log(`🔑 Token UTMify: ${utmifyToken.substring(0, 10)}...`);
            console.log('═══════════════════════════════════════════════════════════');

            // Preparar dados no formato exigido pela API UTMify
            const body = this.prepararDadosVenda(venda, produto, cliente, trackingParams, options);

            // Enviar para a API
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'x-api-token': utmifyToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                timeout: this.timeout
            });

            const result = await response.json();

            if (!response.ok) {
                console.error('═══════════════════════════════════════════════════════════');
                console.error('❌ UTMIFY: ERRO ao enviar venda!');
                console.error('📦 Status:', response.status);
                console.error('📦 Resposta:', JSON.stringify(result, null, 2));
                console.error('═══════════════════════════════════════════════════════════');
                return {
                    success: false,
                    error: result.message || result.error || 'Erro desconhecido',
                    status: response.status,
                    response: result
                };
            }

            console.log('═══════════════════════════════════════════════════════════');
            console.log('✅ UTMIFY: Venda enviada com SUCESSO!');
            console.log('📦 Resposta:', JSON.stringify(result, null, 2));
            console.log('═══════════════════════════════════════════════════════════');
            
            return {
                success: true,
                response: result
            };

        } catch (error) {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('❌ UTMIFY: EXCEÇÃO ao enviar venda!');
            console.error('📦 Erro:', error.message);
            console.error('📦 Stack:', error.stack);
            console.error('═══════════════════════════════════════════════════════════');
            return {
                success: false,
                error: error.message,
                exception: error
            };
        }
    }

    /**
     * Prepara os dados da venda no formato exigido pela API UTMify
     * 
     * @param {Object} venda - Objeto da venda
     * @param {Object} produto - Objeto do produto
     * @param {Object} cliente - Dados do cliente
     * @param {Object} trackingParams - Parâmetros UTM
     * @param {Object} options - Opções adicionais
     * @returns {Object} Dados formatados para a API
     */
    prepararDadosVenda(venda, produto, cliente, trackingParams = {}, options = {}) {
        // Formatar datas no formato exigido (YYYY-MM-DD HH:mm:ss)
        const createdAt = venda.created_at 
            ? new Date(venda.created_at).toISOString().replace('T', ' ').substring(0, 19)
            : new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        // Se a venda foi aprovada, usar data de aprovação, senão usar data atual + 5 minutos
        const approvedDate = venda.data_pagamento || venda.updated_at
            ? new Date(venda.data_pagamento || venda.updated_at).toISOString().replace('T', ' ').substring(0, 19)
            : new Date(Date.now() + 5 * 60000).toISOString().replace('T', ' ').substring(0, 19);

        // Determinar método de pagamento no formato UTMify
        const paymentMethod = this.mapearMetodoPagamento(venda.metodo_pagamento);

        // Determinar status no formato UTMify
        // Se estamos enviando durante processamento de pagamento aprovado, sempre usar 'paid'
        // Verificar se o pagamento foi aprovado (tem data_pagamento, status indica aprovação, ou foi chamado durante processamento)
        let statusVenda = venda.status;
        const statusAprovado = ['Pago', 'Aprovada', 'Aprovado', 'Paga', 'paid'];
        const temDataPagamento = !!venda.data_pagamento;
        const statusIndicaAprovado = statusVenda && statusAprovado.some(s => statusVenda && statusVenda.toString().toLowerCase().includes(s.toLowerCase()));
        
        // Se foi chamado durante processarPagamentoAprovado, sempre considerar como aprovado
        // Ou se tem data_pagamento ou status indica aprovação
        if (temDataPagamento || statusIndicaAprovado || options.isApproved === true) {
            statusVenda = 'paid';
            console.log('✅ UTMIFY: Pagamento aprovado detectado, status será "paid"');
            console.log('📊 UTMIFY: Razão:', {
                temDataPagamento,
                statusIndicaAprovado,
                isApproved: options.isApproved,
                statusOriginal: venda.status
            });
        }
        const status = this.mapearStatusPagamento(statusVenda);
        console.log('📊 UTMIFY: Status mapeado:', { statusOriginal: venda.status, statusFinal: status, temDataPagamento, isApproved: options.isApproved });

        // Calcular valores em centavos
        // O valor da venda já deve ser o valor total (não o valor do vendedor)
        const valorTotal = parseFloat(venda.valor || 0);
        const valorTotalEmCentavos = Math.round(valorTotal * 100);
        const taxaGateway = Math.round(valorTotalEmCentavos * 0.04); // 4% de taxa do gateway (estimativa)
        const comissaoUsuario = valorTotalEmCentavos - taxaGateway;

        // Preparar dados do cliente
        // O IP é obrigatório na API UTMify, então usar valor padrão se não disponível
        const customerIp = cliente.ip || trackingParams.ip || venda.cliente_ip || '0.0.0.0';
        
        const customerData = {
            name: cliente.nome || venda.cliente_nome || 'Cliente',
            email: cliente.email || venda.cliente_email || '',
            phone: this.formatarTelefone(cliente.telefone || venda.cliente_telefone || ''),
            document: cliente.document || cliente.cpf || cliente.cpfCliente || null,
            country: cliente.pais || cliente.country || 'MZ',
            ip: customerIp
        };

        // Preparar produtos
        const products = [{
            id: produto.id,
            name: produto.nome,
            planId: null,
            planName: null,
            quantity: 1,
            priceInCents: valorTotalEmCentavos
        }];

        // Preparar parâmetros de rastreamento
        const trackingParameters = {
            src: trackingParams.src || null,
            sck: trackingParams.sck || null,
            utm_source: trackingParams.utm_source || trackingParams.utmSource || null,
            utm_campaign: trackingParams.utm_campaign || trackingParams.utmCampaign || null,
            utm_medium: trackingParams.utm_medium || trackingParams.utmMedium || null,
            utm_content: trackingParams.utm_content || trackingParams.utmContent || null,
            utm_term: trackingParams.utm_term || trackingParams.utmTerm || null
        };
        
        // Log dos parâmetros de rastreamento para debug
        console.log('📊 UTMIFY: Parâmetros de rastreamento recebidos:', {
            trackingParams: trackingParams,
            trackingParameters: trackingParameters,
            temUtmSource: !!trackingParameters.utm_source,
            temUtmCampaign: !!trackingParameters.utm_campaign
        });

        // Preparar informações de comissão
        const commission = {
            totalPriceInCents: valorTotalEmCentavos,
            gatewayFeeInCents: taxaGateway,
            userCommissionInCents: comissaoUsuario
        };

        // Montar corpo da requisição
        const body = {
            orderId: venda.referencia_pagamento || venda.numero_pedido || `pedido-${venda.id}`,
            platform: 'Ratixpay',
            paymentMethod: paymentMethod,
            status: status,
            createdAt: createdAt,
            approvedDate: approvedDate,
            refundedAt: null,
            customer: customerData,
            products: products,
            trackingParameters: trackingParameters,
            commission: commission,
            isTest: options.isTest || false
        };

        console.log('📦 Dados preparados para UTMify:', JSON.stringify(body, null, 2));

        return body;
    }

    /**
     * Mapeia o método de pagamento para o formato UTMify
     * Valores aceitos pela API: credit_card, boleto, pix, paypal, free_price, unknown
     * 
     * @param {string} metodo - Método de pagamento do sistema
     * @returns {string} Método no formato UTMify
     */
    mapearMetodoPagamento(metodo) {
        if (!metodo) return 'unknown';
        
        const metodoLower = metodo.toLowerCase();
        
        const mapeamento = {
            // Métodos de cartão
            'cartão': 'credit_card',
            'card': 'credit_card',
            'cartao': 'credit_card',
            'credit_card': 'credit_card',
            'creditcard': 'credit_card',
            'cartão de crédito': 'credit_card',
            'cartao de credito': 'credit_card',
            // Boleto
            'boleto': 'boleto',
            // PIX
            'pix': 'pix',
            // PayPal
            'paypal': 'paypal',
            // Métodos móveis de Moçambique (mapear para unknown, pois não estão na lista)
            'm-pesa': 'unknown',
            'mpesa': 'unknown',
            'e-mola': 'unknown',
            'emola': 'unknown',
            // Transferências (mapear para unknown)
            'transferência': 'unknown',
            'transferencia': 'unknown',
            'transfer': 'unknown',
            // Free price
            'free_price': 'free_price',
            'free': 'free_price',
            'gratuito': 'free_price'
        };

        return mapeamento[metodoLower] || 'unknown';
    }

    /**
     * Mapeia o status do pagamento para o formato UTMify
     * Valores aceitos pela API: waiting_payment, paid, refused, refunded, chargedback
     * 
     * @param {string} status - Status da venda
     * @returns {string} Status no formato UTMify
     */
    mapearStatusPagamento(status) {
        if (!status) return 'waiting_payment';
        
        const statusLower = status.toLowerCase();
        
        const mapeamento = {
            // Pagamento aprovado/pago
            'pago': 'paid',
            'aprovado': 'paid',
            'aprovada': 'paid',
            'paid': 'paid',
            'paga': 'paid',
            // Aguardando pagamento
            'pendente': 'waiting_payment',
            'pending': 'waiting_payment',
            'waiting_payment': 'waiting_payment',
            'aguardando': 'waiting_payment',
            'aguardando pagamento': 'waiting_payment',
            // Recusado
            'recusado': 'refused',
            'refused': 'refused',
            'negado': 'refused',
            'rejeitado': 'refused',
            // Reembolsado
            'cancelada': 'refunded',
            'cancelado': 'refunded',
            'refunded': 'refunded',
            'reembolsado': 'refunded',
            'estornado': 'refunded',
            // Chargeback
            'chargeback': 'chargedback',
            'chargedback': 'chargedback',
            'contestado': 'chargedback'
        };

        return mapeamento[statusLower] || 'waiting_payment';
    }

    /**
     * Formata telefone para o formato internacional
     * 
     * @param {string} telefone - Número de telefone
     * @returns {string} Telefone formatado
     */
    formatarTelefone(telefone) {
        if (!telefone) return '';
        
        // Remover caracteres não numéricos
        const numeros = telefone.replace(/\D/g, '');
        
        // Se começar com 258 (código de Moçambique), manter
        if (numeros.startsWith('258')) {
            return numeros;
        }
        
        // Se começar com 0, remover e adicionar 258
        if (numeros.startsWith('0')) {
            return '258' + numeros.substring(1);
        }
        
        // Se não começar com 258, adicionar
        if (numeros.length >= 9) {
            return '258' + numeros;
        }
        
        return numeros;
    }
}

module.exports = new UTMifyService();

