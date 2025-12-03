const express = require('express');
const router = express.Router();
const professionalEmailService = require('../services/professionalEmailService');

// Endpoint de teste temporário
router.get('/test-admin', (req, res) => {
    console.log('🧪 Teste de endpoint admin chamado');
    res.json({
        success: true,
        message: 'Endpoint admin funcionando',
        timestamp: new Date().toISOString()
    });
});

// Enviar confirmação de compra por e-mail (usar email profissional de vendas)
router.post('/enviar-confirmacao', async (req, res) => {
    try {
        const { nome, email, produto, valorPago, idTransacao } = req.body;

        if (!nome || !email || !produto || !valorPago || !idTransacao) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }

        const assunto = '🎉 Parabéns! Seu produto está pronto - RatixPay';
        const conteudo = `
            <p>Olá <strong>${nome}</strong>!</p>
            <p>Parabéns pela sua compra do produto <strong>${produto}</strong>, no valor de <strong>${valorPago}</strong>.</p>
            <div style="text-align:center; margin: 30px 0;">
                <a href="${req.body.linkConteudo || '#'}" style="background-color:#F64C00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;">📥 Acessar Conteúdo do Produto</a>
            </div>
            <p style="color:#6c757d;font-size:14px;">Guarde este email em local seguro. O link do conteúdo é válido por tempo indeterminado.</p>
        `;
        await professionalEmailService.enviarEmailVendas(email, assunto, conteudo, 'conteudo');

        console.log(`✅ E-mail profissional de vendas enviado para: ${email}`);
        res.status(200).json({ success: true, message: 'E-mail enviado com sucesso.' });
    } catch (error) {
        console.error('❌ Erro ao enviar e-mail:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar e-mail.'
        });
    }
});

module.exports = router;
