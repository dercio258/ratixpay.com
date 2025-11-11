const express = require('express');
const { Usuario } = require('../config/database');
const router = express.Router();

// Página de reset do admin
router.get('/', async (req, res) => {
    try {
        const { token } = req.query;
        
        if (!token) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reset Admin - Token Inválido</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1>❌ Token Inválido</h1>
                    <p class="error">Token de reset não fornecido.</p>
                    <a href="/login.html">Voltar ao Login</a>
                </body>
                </html>
            `);
        }

        // Buscar usuário com o token
        const user = await Usuario.findOne({
            where: {
                reset_token: token,
                reset_token_expira: { [require('sequelize').Op.gt]: new Date() }
            }
        });

        if (!user) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Reset Admin - Token Expirado</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1>❌ Token Expirado</h1>
                    <p class="error">Token de reset expirado ou inválido.</p>
                    <a href="/login.html">Voltar ao Login</a>
                </body>
                </html>
            `);
        }

        // Desbloquear a conta do admin
        await user.update({
            tentativas_login: 0,
            bloqueado_ate: null,
            reset_token: null,
            reset_token_expira: null,
            ativo: true
        });

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reset Admin - Sucesso</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        background: rgba(255,255,255,0.1);
                        padding: 40px;
                        border-radius: 15px;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                    }
                    .success { color: #4CAF50; font-size: 48px; margin-bottom: 20px; }
                    .btn {
                        display: inline-block;
                        padding: 12px 24px;
                        background: #4CAF50;
                        color: white;
                        text-decoration: none;
                        border-radius: 8px;
                        margin-top: 20px;
                        transition: background 0.3s;
                    }
                    .btn:hover {
                        background: #45a049;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success">✅</div>
                    <h1>Conta Desbloqueada!</h1>
                    <p>A conta do administrador foi desbloqueada com sucesso.</p>
                    <p>Você pode agora fazer login normalmente.</p>
                    <a href="/login.html" class="btn">Ir para Login</a>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Erro no reset do admin:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reset Admin - Erro</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    .error { color: red; }
                </style>
            </head>
            <body>
                <h1>❌ Erro</h1>
                <p class="error">Ocorreu um erro ao processar o reset.</p>
                <a href="/login.html">Voltar ao Login</a>
            </body>
            </html>
        `);
    }
});

module.exports = router;
