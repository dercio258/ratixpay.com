/**
 * Padronização de respostas da API
 */

/**
 * Envia uma resposta de sucesso padronizada
 * @param {Object} res - Objeto de resposta do Express
 * @param {any} data - Dados a serem retornados
 * @param {string} message - Mensagem opcional
 * @param {number} statusCode - Código de status HTTP (padrão 200)
 */
const sendSuccess = (res, data = null, message = 'Operação realizada com sucesso', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    });
};

/**
 * Envia uma resposta de erro padronizada
 * @param {Object} res - Objeto de resposta do Express
 * @param {string|Error} error - Mensagem de erro ou objeto Error
 * @param {number} statusCode - Código de status HTTP (padrão 500)
 * @param {string} code - Código de erro interno opcional
 */
const sendError = (res, error, statusCode = 500, code = null) => {
    const errorMessage = error instanceof Error ? error.message : error;

    const response = {
        success: false,
        message: errorMessage,
        timestamp: new Date().toISOString()
    };

    if (code) {
        response.code = code;
    }

    if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        response.stack = error.stack;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    sendSuccess,
    sendError
};
