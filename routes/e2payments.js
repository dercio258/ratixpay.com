const express = require('express');
const router = express.Router();
const axios = require('axios');

// Construtor de headers padrão com Bearer Token
function buildHeaders() {
    const bearer = process.env.E2P_BEARER_TOKEN || '';
    return {
        Authorization: bearer,
        'X-Requested-With': 'XMLHttpRequest'
    };
}

function baseUrl() {
    return process.env.E2PAYMENTS_BASE_URL || 'https://e2payments.explicador.co.mz';
}

// Helper para repassar respostas padronizadas
function ok(res, data) {
    return res.json({ success: true, data });
}

function fail(res, error, status = 500) {
    return res.status(status).json({ success: false, error });
}

// Histórico completo (MPesa)
router.get('/payments', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/payments/mpesa/get/all`;
        const { data } = await axios.get(url, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

router.post('/payments', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/payments/mpesa/get/all`;
        const requestBody = {
            client_id: process.env.E2PAYMENTS_CLIENT_ID || ''
        };
        
        // Adicionar client_id aos headers também
        const headers = {
            ...buildHeaders(),
            'Content-Type': 'application/json'
        };
        
        console.log('🔍 Enviando requisição para e2Payments (completa):', {
            url,
            body: requestBody,
            headers: { ...headers, Authorization: '[REDACTED]' }
        });
        
        const { data } = await axios.post(url, requestBody, { headers });
        return ok(res, data);
    } catch (e) {
        console.error('❌ Erro na requisição e2Payments:', e.response?.data || e.message);
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// Histórico paginado
router.get('/payments/paginate/:limit', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/payments/mpesa/get/all/paginate/${encodeURIComponent(req.params.limit)}`;
        const { data } = await axios.get(url, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

router.post('/payments/paginate/:limit', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/payments/mpesa/get/all/paginate/${encodeURIComponent(req.params.limit)}`;
        const requestBody = {
            client_id: process.env.E2PAYMENTS_CLIENT_ID || ''
        };
        
        // Adicionar client_id aos headers também
        const headers = {
            ...buildHeaders(),
            'Content-Type': 'application/json'
        };
        
        console.log('🔍 Enviando requisição para e2Payments:', {
            url,
            body: requestBody,
            headers: { ...headers, Authorization: '[REDACTED]' }
        });
        
        const { data } = await axios.post(url, requestBody, { headers });
        return ok(res, data);
    } catch (e) {
        console.error('❌ Erro na requisição e2Payments:', e.response?.data || e.message);
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// Listar carteiras
router.get('/wallets', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/wallets/mpesa/get/all`;
        const { data } = await axios.get(url, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

router.post('/wallets', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/wallets/mpesa/get/all`;
        const { data } = await axios.post(url, {}, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// Detalhes da carteira
router.get('/wallets/:walletId', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/wallets/mpesa/get/${encodeURIComponent(req.params.walletId)}`;
        const { data } = await axios.get(url, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

router.post('/wallets/:walletId', async (req, res) => {
    try {
        const url = `${baseUrl()}/v1/wallets/mpesa/get/${encodeURIComponent(req.params.walletId)}`;
        const { data } = await axios.post(url, {}, { headers: buildHeaders() });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// C2B Mpesa
router.post('/c2b/:walletId', async (req, res) => {
    try {
        const { amount, phone, reference } = req.body || {};
        const url = `${baseUrl()}/v1/c2b/mpesa-payment/${encodeURIComponent(req.params.walletId)}`;
        const form = new URLSearchParams();
        form.append('client_id', process.env.E2PAYMENTS_CLIENT_ID || '');
        form.append('amount', String(amount));
        form.append('phone', String(phone));
        form.append('reference', reference || `Pedido_${Date.now()}`);
        const { data } = await axios.post(url, form.toString(), {
            headers: { ...buildHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// C2B eMola
router.post('/c2b/emola/:walletId', async (req, res) => {
    try {
        const { amount, phone, reference } = req.body || {};
        const url = `${baseUrl()}/v1/c2b/emola-payment/${encodeURIComponent(req.params.walletId)}`;
        const form = new URLSearchParams();
        form.append('client_id', process.env.E2PAYMENTS_CLIENT_ID || '');
        form.append('amount', String(amount));
        form.append('phone', String(phone));
        form.append('reference', reference || `Pedido_${Date.now()}`);
        const { data } = await axios.post(url, form.toString(), {
            headers: { ...buildHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        return ok(res, data);
    } catch (e) {
        return fail(res, e.response?.data || e.message, e.response?.status || 500);
    }
});

// Buscar informações do vendedor e produto por referência
router.get('/produto-info/:referencia', async (req, res) => {
    try {
        const { referencia } = req.params;
        
        // Importar modelos do banco de dados
        const { Produto, Cliente } = require('../config/database');
        
        // Buscar produto pela referência (custom_id)
        const produto = await Produto.findOne({
            where: { custom_id: referencia },
            include: [
                {
                    model: Cliente,
                    as: 'vendedor',
                    attributes: ['nome', 'email']
                }
            ]
        });
        
        if (produto) {
            return ok(res, {
                vendedor: produto.vendedor?.nome || 'Vendedor não encontrado',
                produto: produto.nome || 'Produto não encontrado',
                vendedorEmail: produto.vendedor?.email || null
            });
        } else {
            return ok(res, {
                vendedor: 'Vendedor não encontrado',
                produto: 'Produto não encontrado',
                vendedorEmail: null
            });
        }
    } catch (e) {
        console.error('❌ Erro ao buscar informações do produto:', e);
        return fail(res, e.message, 500);
    }
});

// Verificar status de uma transação específica
router.get('/status/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        console.log('🔍 Verificando status da transação:', transactionId);
        
        const url = `${baseUrl()}/v1/payments/status/${transactionId}`;
        const headers = buildHeaders();
        
        console.log('📡 Fazendo requisição para:', url);
        console.log('📋 Headers:', headers);
        
        const response = await axios.get(url, { headers });
        
        console.log('✅ Resposta da API e2Payments:', response.data);
        
        // Retornar dados formatados
        res.json({
            success: true,
            transaction_id: transactionId,
            status: response.data.status || 'unknown',
            data: response.data
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status da transação:', error);
        
        if (error.response) {
            console.error('📊 Status da resposta:', error.response.status);
            console.error('📊 Dados da resposta:', error.response.data);
            
            return res.status(error.response.status).json({
                success: false,
                error: error.response.data || 'Erro na API e2Payments',
                status: error.response.status
            });
        }
        
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

module.exports = router;


