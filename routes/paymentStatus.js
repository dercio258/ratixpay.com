const express = require('express');
const router = express.Router();
const paymentStatusManager = require('../utils/paymentStatusManager');
const paymentMiddleware = require('../middleware/paymentMiddleware');

// Iniciar pagamento
router.post('/initiate', paymentMiddleware.initiatePayment(), async (req, res) => {
    try {
        const { vendaId, valor, metodo, clienteId } = req.body;
        const paymentId = req.paymentId;
        const paymentInfo = req.paymentInfo;

        // Processar pagamento com PayMoz
        const paymozService = require('../services/paymozService');
        
        // Iniciar pagamento com PayMoz
        const paymentResult = await paymozService.processPayment(
            metodo.toLowerCase(), // Garantir que o método está em lowercase
            valor,
            clienteId, // phone number
            `Pagamento do Pedido #${paymentId}` // referencia_externa
        );

        if (paymentResult.success) {
            res.status(200).json({
                success: true,
                paymentId: paymentId,
                status: 'pending',
                message: 'Pagamento iniciado com sucesso',
                data: {
                    paymentId,
                    vendaId,
                    valor,
                    metodo,
                    status: 'pending',
                    createdAt: paymentInfo.createdAt,
                    timeout: paymentInfo.timeout
                }
            });
        } else {
            // Remover do monitoramento se falhou
            paymentStatusManager.removePayment(paymentId);
            
            res.status(400).json({
                success: false,
                error: 'Falha ao iniciar pagamento',
                message: paymentResult.message || 'Erro desconhecido',
                code: 'PAYMENT_INITIATION_FAILED'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao iniciar pagamento:', error);
        
        // Remover do monitoramento em caso de erro
        if (req.paymentId) {
            paymentStatusManager.removePayment(req.paymentId);
        }
        
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível iniciar o pagamento',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Verificar status do pagamento
router.get('/status/:paymentId', paymentMiddleware.checkPaymentStatus(), async (req, res) => {
    try {
        const paymentStatus = req.paymentStatus;

        // Determinar se o pagamento ainda está sendo processado
        const isProcessing = paymentStatus.status === 'pending' && 
                           Date.now() < paymentStatus.timeout;

        res.status(200).json({
            success: true,
            paymentId: paymentStatus.id,
            status: paymentStatus.status,
            isProcessing: isProcessing,
            attempts: paymentStatus.attempts,
            createdAt: paymentStatus.createdAt,
            lastChecked: paymentStatus.lastChecked,
            timeout: paymentStatus.timeout,
            message: this.getStatusMessage(paymentStatus.status)
        });

    } catch (error) {
        console.error('❌ Erro ao verificar status do pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível verificar o status do pagamento',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Cancelar pagamento
router.post('/cancel/:paymentId', paymentMiddleware.cancelPayment(), async (req, res) => {
    try {
        const { paymentId } = req.params;

        res.status(200).json({
            success: true,
            paymentId: paymentId,
            status: 'cancelled',
            message: 'Pagamento cancelado com sucesso',
            cancelledAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro ao cancelar pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível cancelar o pagamento',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Webhook do PayMoz
router.post('/webhook/paymoz', paymentMiddleware.handleE2PaymentsWebhook(), (req, res) => {
    // O middleware já processou o webhook
    // Esta rota só confirma o recebimento
    res.status(200).json({ success: true });
});

// Verificar pagamentos pendentes
router.get('/pending', async (req, res) => {
    try {
        const stats = paymentStatusManager.getStats();
        
        res.status(200).json({
            success: true,
            stats: stats,
            message: 'Estatísticas de pagamentos pendentes'
        });

    } catch (error) {
        console.error('❌ Erro ao obter pagamentos pendentes:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível obter pagamentos pendentes',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Limpar pagamentos antigos
router.post('/cleanup', async (req, res) => {
    try {
        const cleaned = paymentStatusManager.cleanupOldPayments();
        
        res.status(200).json({
            success: true,
            cleaned: cleaned,
            message: `${cleaned} pagamentos antigos removidos`
        });

    } catch (error) {
        console.error('❌ Erro ao limpar pagamentos antigos:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível limpar pagamentos antigos',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Configurar parâmetros
router.post('/configure', async (req, res) => {
    try {
        const { checkInterval, maxRetries, timeoutDuration } = req.body;
        
        paymentStatusManager.configure({
            checkInterval,
            maxRetries,
            timeoutDuration
        });
        
        res.status(200).json({
            success: true,
            message: 'Configurações atualizadas com sucesso',
            config: {
                checkInterval,
                maxRetries,
                timeoutDuration
            }
        });

    } catch (error) {
        console.error('❌ Erro ao configurar parâmetros:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor',
            message: 'Não foi possível configurar parâmetros',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Obter mensagem de status
function getStatusMessage(status) {
    const messages = {
        'pending': 'Pagamento sendo processado...',
        'success': 'Pagamento processado com sucesso!',
        'failed': 'Pagamento não foi processado.',
        'cancelled': 'Pagamento cancelado.',
        'timeout': 'Pagamento expirado por timeout.',
        'error': 'Erro no processamento do pagamento.',
        'max_retries': 'Máximo de tentativas atingido.'
    };
    
    return messages[status] || 'Status desconhecido';
}

// Middleware de tratamento de erros
router.use((error, req, res, next) => {
    console.error('❌ Erro na rota de status de pagamento:', error);
    
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro inesperado',
        code: 'INTERNAL_ERROR'
    });
});

module.exports = router;
