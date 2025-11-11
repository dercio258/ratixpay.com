/**
 * Rotas para Monitoramento de Email
 * Endpoints para verificar e gerenciar o sistema de email
 */

const express = require('express');
const router = express.Router();
const emailMonitorService = require('../services/emailMonitorService');
const { authenticateToken, isAdmin } = require('../middleware/auth');

/**
 * GET - Obter estatísticas de email
 */
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const stats = emailMonitorService.obterEstatisticas();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas de email:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao obter estatísticas de email'
        });
    }
});

/**
 * GET - Verificar configuração de email
 */
router.get('/config', authenticateToken, isAdmin, async (req, res) => {
    try {
        const isConfigurado = emailMonitorService.verificarConfiguracao();
        res.json({
            success: true,
            data: {
                configurado: isConfigurado,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Erro ao verificar configuração de email:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar configuração de email'
        });
    }
});

/**
 * GET - Verificar emails pendentes
 */
router.get('/pending', authenticateToken, isAdmin, async (req, res) => {
    try {
        const emailsPendentes = await emailMonitorService.verificarEmailsPendentes();
        res.json({
            success: true,
            data: {
                total: emailsPendentes.length,
                vendas: emailsPendentes.map(venda => ({
                    id: venda.id,
                    cliente_nome: venda.cliente_nome,
                    cliente_email: venda.cliente_email,
                    produto_nome: venda.produto?.nome,
                    vendedor_nome: venda.vendedor?.nome_completo,
                    valor: venda.pagamento_valor,
                    data_venda: venda.created_at
                }))
            }
        });
    } catch (error) {
        console.error('❌ Erro ao verificar emails pendentes:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar emails pendentes'
        });
    }
});

/**
 * POST - Reenviar emails que falharam
 */
router.post('/resend', authenticateToken, isAdmin, async (req, res) => {
    try {
        const resultado = await emailMonitorService.reenviarEmailsFalhados();
        res.json({
            success: true,
            data: {
                sucessos: resultado.sucessos,
                falhas: resultado.falhas,
                total: resultado.sucessos + resultado.falhas
            }
        });
    } catch (error) {
        console.error('❌ Erro ao reenviar emails:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao reenviar emails'
        });
    }
});

/**
 * GET - Executar diagnóstico completo
 */
router.get('/diagnostic', authenticateToken, isAdmin, async (req, res) => {
    try {
        const diagnostico = await emailMonitorService.executarDiagnostico();
        res.json({
            success: true,
            data: diagnostico
        });
    } catch (error) {
        console.error('❌ Erro ao executar diagnóstico:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao executar diagnóstico'
        });
    }
});

/**
 * DELETE - Limpar estatísticas
 */
router.delete('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        emailMonitorService.limparEstatisticas();
        res.json({
            success: true,
            message: 'Estatísticas limpas com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao limpar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao limpar estatísticas'
        });
    }
});

/**
 * POST - Testar envio de email
 */
router.post('/test', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { email, tipo = 'teste' } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email é obrigatório'
            });
        }

        const emailService = require('../utils/emailService');
        
        const emailContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Teste de Email - RatixPay</title>
            </head>
            <body>
                <h1>🧪 Teste de Email</h1>
                <p>Este é um email de teste do sistema RatixPay.</p>
                <p>Se você recebeu este email, o sistema está funcionando corretamente.</p>
                <p>Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
            </body>
            </html>
        `;

        await professionalEmailService.enviarEmailSistema(
            email,
            '🧪 Teste de Email - RatixPay',
            emailContent,
            'teste'
        );

        emailMonitorService.registrarTentativa(tipo, true, email);

        res.json({
            success: true,
            message: 'Email de teste enviado com sucesso'
        });
    } catch (error) {
        console.error('❌ Erro ao enviar email de teste:', error);
        emailMonitorService.registrarTentativa('teste', false, req.body.email, error.message);
        
        res.status(500).json({
            success: false,
            error: 'Erro ao enviar email de teste',
            details: error.message
        });
    }
});

module.exports = router;
