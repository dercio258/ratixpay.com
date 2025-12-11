const axios = require('axios');

class GibraPayService {
    constructor() {
        this.baseUrl = process.env.GIBRAPAY_BASE_URL || 'http://209.126.85.29:18350';
        this.apiToken = process.env.GIBRAPAY_API_TOKEN || 'vE5rTyU7iOpL9kJmNbVcX3zAsDfG8hQ2';
        this.timeoutMs = 30000;
        this.origin = process.env.BASE_URL || 'https://ratixpay.site';
    }

    /**
     * Processa um pagamento C2B (recebimento) via GibraPay (MPESA)
     * @param {number|string} amount - Valor a ser cobrado (ex: 150.00)
     * @param {string} phone - Número de celular do cliente (ex: "841234567")
     * @param {string} reference - Referência externa do sistema
     * @returns {Promise<Object>} Resultado do pagamento
     */
    async processC2B(amount, phone, reference = '') {
        try {
            // Validar valor
            const valor = parseFloat(amount);
            if (isNaN(valor) || valor <= 0) {
                throw new Error('Valor inválido');
            }

            // Validar telefone
            if (!phone || phone.trim() === '') {
                throw new Error('Telefone inválido');
            }

            // Validar API Token
            if (!this.apiToken || this.apiToken.trim().length === 0) {
                throw new Error('GIBRAPAY_API_TOKEN não configurada no .env');
            }

            // URL do endpoint
            const url = `${this.baseUrl}/v1/mpesa/payment`;

            // Payload conforme documentação da API - C2B (Customer to Business)
            const payload = {
                type: "c2b",
                phone: String(phone).trim(),
                reference: reference || `gibrpay_c2b_${Date.now()}`,
                amount: Math.round(valor) // API espera valor inteiro
            };

            console.log(`📤 Enviando pagamento C2B GibraPay:`, {
                type: payload.type,
                amount: payload.amount,
                phone: payload.phone.substring(0, 3) + '***',
                reference: payload.reference
            });

            // Fazer requisição
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken.trim()}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': this.origin
                },
                timeout: this.timeoutMs
            });

            const data = response.data || {};

            console.log(`✅ Resposta GibraPay C2B:`, {
                status: response.status,
                data: data
            });

            // Verificar se a resposta tem sucesso
            if (response.status === 200 || response.status === 201) {
                return {
                    success: true,
                    transaction_id: data.transaction_id || data.id || payload.reference,
                    status: 'approved',
                    message: data.message || 'Pagamento C2B processado com sucesso',
                    paid_amount: valor,
                    customer_phone: String(phone),
                    reference: payload.reference,
                    data: data
                };
            } else {
                const errorMessage = data.message || data.error || 'Erro ao processar pagamento C2B';
                console.error('❌ GibraPay retornou resposta sem sucesso:', errorMessage);
                
                return {
                    success: false,
                    status: 'error',
                    message: errorMessage,
                    data: data
                };
            }

        } catch (error) {
            const errData = error.response?.data;
            const errorMessage = errData?.message || 
                               errData?.error || 
                               error.message || 
                               'Erro ao processar pagamento C2B';
            
            console.error('❌ Erro no pagamento C2B GibraPay:', {
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
     * Processa um pagamento B2C via GibraPay (MPESA)
     * @param {number|string} amount - Valor a ser transferido (ex: 150.00)
     * @param {string} phone - Número de celular do destinatário (ex: "843357697")
     * @param {string} reference - Referência da transação
     * @returns {Promise<Object>} Resultado da transferência
     */
    async processB2C(amount, phone, reference = '') {
        try {
            // Validar valor
            const valor = parseFloat(amount);
            if (isNaN(valor) || valor <= 0) {
                throw new Error('Valor inválido');
            }

            // Validar telefone
            if (!phone || phone.trim() === '') {
                throw new Error('Telefone inválido');
            }

            // Validar API Token
            if (!this.apiToken || this.apiToken.trim().length === 0) {
                throw new Error('GIBRAPAY_API_TOKEN não configurada no .env');
            }

            // URL do endpoint
            const url = `${this.baseUrl}/v1/mpesa/payment`;

            // Garantir que a referência seja única
            // Se não for fornecida ou for vazia, gerar uma única
            // Usar formato simples: apenas números e letras, sem caracteres especiais
            let finalReference = reference;
            if (!finalReference || finalReference.trim() === '' || finalReference === 'gibrpay' || finalReference.length < 10) {
                const crypto = require('crypto');
                // Gerar referência única usando apenas números e letras minúsculas
                const uniqueId = crypto.randomBytes(6).toString('hex');
                const timestamp = Date.now().toString().slice(-10); // Últimos 10 dígitos do timestamp
                // Formato: B2C + timestamp + ID único (sem underscores ou caracteres especiais)
                finalReference = `B2C${timestamp}${uniqueId}`;
            }
            
            // Payload conforme documentação da API
            const payload = {
                type: "b2c",
                phone: String(phone).trim(),
                reference: finalReference.trim(),
                amount: Math.round(valor) // API espera valor inteiro
            };

            console.log(`📤 Enviando transferência B2C GibraPay:`, {
                type: payload.type,
                amount: payload.amount,
                phone: payload.phone.substring(0, 3) + '***',
                reference: payload.reference,
                referenceLength: payload.reference.length
            });
            
            // Validar que a referência não seja "gibrpay" ou muito curta
            // Remover caracteres especiais que podem causar problemas
            payload.reference = payload.reference.replace(/[^a-zA-Z0-9]/g, '');
            
            if (payload.reference === 'gibrpay' || payload.reference.length < 10) {
                console.error('❌ Referência inválida detectada:', payload.reference);
                throw new Error('Referência inválida. Deve ser única e ter pelo menos 10 caracteres.');
            }

            // Fazer requisição
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken.trim()}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': this.origin
                },
                timeout: this.timeoutMs
            });

            const data = response.data || {};

            console.log(`✅ Resposta GibraPay:`, {
                status: response.status,
                data: data
            });

            // Verificar se a resposta tem sucesso
            // Verificar se há erro na resposta mesmo com status 200/201
            if (data.status === 'error' || data.status === 'failed' || data.message?.toLowerCase().includes('error') || data.message?.toLowerCase().includes('invalid')) {
                const errorMessage = data.message || data.error || 'Erro ao processar transferência B2C';
                console.error('❌ GibraPay retornou erro na resposta:', errorMessage);
                
                return {
                    success: false,
                    status: 'error',
                    message: errorMessage,
                    data: data
                };
            }
            
            if (response.status === 200 || response.status === 201) {
                return {
                    success: true,
                    transaction_id: data.transaction_id || data.id || payload.reference,
                    status: 'approved',
                    message: data.message || 'Transferência B2C processada com sucesso',
                    amount: valor,
                    phone: String(phone),
                    reference: payload.reference,
                    data: data
                };
            } else {
                const errorMessage = data.message || data.error || 'Erro ao processar transferência B2C';
                console.error('❌ GibraPay retornou resposta sem sucesso:', errorMessage);
                
                return {
                    success: false,
                    status: 'error',
                    message: errorMessage,
                    data: data
                };
            }

        } catch (error) {
            const errData = error.response?.data;
            const errorMessage = errData?.message || 
                               errData?.error || 
                               error.message || 
                               'Erro ao processar transferência B2C';
            
            console.error('❌ Erro na transferência B2C GibraPay:', {
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
     * Verifica o status de uma transação
     * @param {string} transactionId - ID da transação
     * @param {string} reference - Referência da transação (opcional)
     * @returns {Promise<Object|null>} Status da transação ou null se não disponível
     */
    async checkTransactionStatus(transactionId, reference = '') {
        try {
            if (!transactionId) {
                throw new Error('Transaction ID é obrigatório');
            }

            // Se tiver reference, usar endpoint com ambos
            let url;
            if (reference) {
                url = `${this.baseUrl}/v1/mpesa/transaction/${transactionId}/${reference}`;
            } else {
                url = `${this.baseUrl}/v1/mpesa/transaction/${transactionId}`;
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken.trim()}`,
                    'Accept': 'application/json',
                    'Origin': this.origin
                },
                timeout: this.timeoutMs
            });

            return {
                success: true,
                data: response.data || {}
            };

        } catch (error) {
            console.error('❌ Erro ao verificar status da transação GibraPay:', error.message);
            return {
                success: false,
                message: error.message || 'Erro ao verificar status',
                data: error.response?.data || {}
            };
        }
    }

    /**
     * Busca o saldo disponível
     * @returns {Promise<Object>} Saldo disponível
     */
    async getBalance() {
        try {
            const url = `${this.baseUrl}/v1/balance`;

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken.trim()}`,
                    'Accept': 'application/json',
                    'Origin': this.origin
                },
                timeout: this.timeoutMs
            });

            return {
                success: true,
                balance: response.data?.balance || response.data?.amount || 0,
                data: response.data || {}
            };

        } catch (error) {
            console.error('❌ Erro ao buscar saldo GibraPay:', error.message);
            return {
                success: false,
                balance: 0,
                message: error.message || 'Erro ao buscar saldo',
                data: error.response?.data || {}
            };
        }
    }
}

module.exports = new GibraPayService();

