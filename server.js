const express = require('express');
const http = require('http');
require('dotenv').config();

// Loaders
const { loadDatabase } = require('./loaders/database');
const { loadExpress } = require('./loaders/express');
const { loadRemarketing } = require('./loaders/remarketing');

// Inicializar app
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Configurar Socket.IO (ainda necessário aqui pois depende do server http)
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Tornar io acessível globalmente (se necessário, ou passar via loader)
// Idealmente, mover socket logic para um loader/service também, mas mantendo simples por agora.
global.io = io;

async function startServer() {
    try {
        // 1. Carregar Banco de Dados
        await loadDatabase();

        // 2. Carregar Configurações do Express e Rotas
        loadExpress(app);

        // 3. Inicializar Serviço de Remarketing Automático
        loadRemarketing();

        // 4. Iniciar Servidor
        server.listen(PORT, () => {
            console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('❌ Erro fatal ao iniciar o servidor:', error);

        // Fallback: Iniciar servidor em modo limitado se banco falhar (comportamento original)
        if (error.message.includes('banco de dados')) {
            console.log('⚠️ Iniciando servidor em MODO LIMITADO (Sem Banco de Dados)...');
            loadExpress(app); // Carrega rotas mesmo sem banco
            server.listen(PORT, () => {
                console.log(`⚠️ Servidor rodando em http://localhost:${PORT} (MODO LIMITADO)`);
            });
        } else {
            process.exit(1);
        }
    }
}

startServer();
