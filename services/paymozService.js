const axios = require('axios');

class PayMozService {
    constructor() {
        this.baseUrl = 'https://paymoz.tech/api/v1';
        this.apiKey = process.env.PayMozApiKey || '';
        this.timeoutMs = 30000;
    }

    /**
     * Processa um pagamento via PayMoz
     * @param {string} method - Método de pagamento: "mpesa" ou "emola"
     * @param {number|string} amount - Valor a ser cobrado (ex: 150.00)
     * @param {string} phone - Número de celular do cliente (ex: "841234567")
     * @param {string} externalReference - Referência externa do sistema (ex: ID do pedido)
     * @returns {Promise<Object>} Resultado do pagamento
     */
    async processPayment(method, amount, phone, externalReference = '') {
        try {
            // Validar método
            const metodo = String(method || '').toLowerCase();
            
            // MPESA agora é processado pela GibraPay - apenas Emola usa PayMoz
            if (metodo === 'mpesa') {
                throw new Error('MPESA deve ser processado via GibraPay. Use gibrapayService para MPESA.');
            }
            
            if (metodo !== 'emola') {
                throw new Error('Método inválido. PayMoz processa apenas "emola". Use "gibrapayService" para "mpesa"');
            }

            // Validar API Key
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('PayMozApiKey não configurada no .env');
            }

            // Formatar valor como string com 2 casas decimais
            const valorFormatado = parseFloat(amount).toFixed(2);

            // URL do endpoint
            const url = `${this.baseUrl}/pagamentos/processar/`;

            // Payload conforme documentação
            const payload = {
                metodo: metodo,
                valor: valorFormatado,
                numero_celular: String(phone),
                referencia_externa: externalReference || `Pedido_${Date.now()}`
            };

            console.log(`📤 Enviando pagamento PayMoz:`, {
                metodo: payload.metodo,
                valor: payload.valor,
                numero_celular: payload.numero_celular.substring(0, 3) + '***',
                referencia_externa: payload.referencia_externa
            });

            // Fazer requisição
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `ApiKey ${this.apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: this.timeoutMs
            });

            const data = response.data || {};

            // Verificar se a resposta tem sucesso
            if (data.sucesso === true && data.dados) {
                const dados = data.dados;
                
                // Usar output_ThirdPartyReference como transaction_id (como solicitado)
                const transactionId = dados.output_ThirdPartyReference || 
                                     dados.output_TransactionID || 
                                     `paymoz_${Date.now()}`;

                console.log(`✅ Pagamento PayMoz processado com sucesso:`, {
                    transaction_id: transactionId,
                    output_TransactionID: dados.output_TransactionID,
                    output_ThirdPartyReference: dados.output_ThirdPartyReference,
                    output_ResponseCode: dados.output_ResponseCode
                });

                return {
                    success: true,
                    transaction_id: transactionId, // output_ThirdPartyReference
                    status: 'approved', // PayMoz processou com sucesso
                    message: data.mensagem || 'Pagamento processado com sucesso',
                    paid_amount: parseFloat(valorFormatado),
                    customer_phone: String(phone),
                    data: {
                        output_TransactionID: dados.output_TransactionID,
                        output_ConversationID: dados.output_ConversationID,
                        output_ThirdPartyReference: dados.output_ThirdPartyReference,
                        output_ResponseCode: dados.output_ResponseCode,
                        output_ResponseDesc: dados.output_ResponseDesc,
                        ...data
                    }
                };
            } else {
                // Resposta sem sucesso
                const errorMessage = data.mensagem || data.erro || 'Erro ao processar pagamento';
                console.error('❌ PayMoz retornou resposta sem sucesso:', errorMessage);
                
                return {
                    success: false,
                    status: 'error',
                    message: errorMessage,
                    data: data
                };
            }

        } catch (error) {
            const errData = error.response?.data;
            const errorMessage = errData?.erro || 
                               errData?.mensagem || 
                               error.message || 
                               'Erro ao processar pagamento';
            
            console.error('❌ Erro no pagamento PayMoz:', {
                message: errorMessage,
                status: error.response?.status,
                data: errData
            });

            return {
                success: false,
                status: 'cancelled',
                message: errorMessage,
                data: errData || {}
            };
        }
    }

    /**
     * Verifica o status de um pagamento (se a API suportar)
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object|null>} Status do pagamento ou null se não disponível
     */
    async checkPaymentStatus(transactionId) {
        // Se a API de status não estiver disponível, retornamos null para manter o fluxo atual
        // Implementar quando a API PayMoz disponibilizar endpoint de status
        return null;
    }
}

module.exports = new PayMozService();

