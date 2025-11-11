const axios = require('axios');

class E2PaymentsService {
    constructor() {
        this.baseUrl = process.env.E2PAYMENTS_BASE_URL || 'https://e2payments.explicador.co.mz';
        this.clientId = process.env.E2PAYMENTS_CLIENT_ID || '';
        this.clientSecret = process.env.E2PAYMENTS_CLIENT_SECRET || '';
        this.tenantEmola = process.env.E2PAYMENTS_TENANT_EMOLA || '999744';
        this.tenantMpesa = process.env.E2PAYMENTS_TENANT_MPESA || '999743';
        this.timeoutMs = 30000;
        this.tokenCache = { accessToken: null, expiresAt: 0 };
    }

    async getAccessToken() {
        // Priorizar token fixo do Postman se fornecido
        const fixedToken = process.env.E2P_BEARER_TOKEN;
        if (fixedToken && fixedToken.startsWith('Bearer ')) {
            this.tokenCache.accessToken = fixedToken.replace(/^Bearer\s+/, '');
            this.tokenCache.expiresAt = Date.now() + 60 * 60 * 1000; // 1h fictícia
            return this.tokenCache.accessToken;
        }

        const now = Date.now();
        if (this.tokenCache.accessToken && now < this.tokenCache.expiresAt - 5000) {
            return this.tokenCache.accessToken;
        }

        const url = `${this.baseUrl}/oauth/token`;
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret
        });

        const response = await axios.post(url, body.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: this.timeoutMs
        });

        const { access_token, expires_in } = response.data || {};
        if (!access_token) {
            throw new Error('Falha ao obter token de acesso do e2Payments');
        }

        this.tokenCache.accessToken = access_token;
        this.tokenCache.expiresAt = now + (Number(expires_in || 1800) * 1000);
        return access_token;
    }

    getTenantForMethod(method) {
        const m = String(method || '').toLowerCase();
        if (m === 'emola') return this.tenantEmola;
        if (m === 'mpesa') return this.tenantMpesa;
        throw new Error('Método inválido. Use mpesa ou emola');
    }

    async processPayment(method, amount, phone, context = '') {
        try {
            const tenant = this.getTenantForMethod(method);
            const token = await this.getAccessToken();

            const path = method.toLowerCase() === 'emola'
                ? `/v1/c2b/emola-payment/${tenant}`
                : `/v1/c2b/mpesa-payment/${tenant}`;

            const url = `${this.baseUrl}${path}`;
            const form = new URLSearchParams();
            form.append('client_id', this.clientId);
            form.append('amount', String(Number(amount)));
            form.append('phone', String(phone));
            // No Postman é "reference"; usamos o context como referência
            form.append('reference', context || `Pedido_${Date.now()}`);

            const response = await axios.post(url, form.toString(), {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: this.timeoutMs
            });

            const data = response.data || {};
            return {
                success: true,
                transaction_id: data.id || data.transactionId || `e2_${Date.now()}`,
                status: (data.status || 'approved'),
                message: data.message || 'Pagamento iniciado',
                paid_amount: Number(amount),
                customer_phone: String(phone),
                data
            };
        } catch (error) {
            const errData = error.response?.data;
            console.error('❌ Erro no pagamento e2Payments:', errData || error.message);
            return {
                success: false,
                status: 'cancelled',
                message: errData?.error || errData?.message || error.message || 'Erro ao processar pagamento'
            };
        }
    }

    async checkPaymentStatus(/* transactionId */) {
        // Se a API de status não estiver disponível, retornamos null para manter o fluxo atual
        return null;
    }
}

module.exports = new E2PaymentsService();


