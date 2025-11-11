/**
 * Configuração de logging simplificada
 */

const pino = require('pino');

// Configuração de logger para a aplicação
const appLogger = pino({
    level: 'info' // Apenas logs importantes
});

module.exports = {
    appLogger
};

