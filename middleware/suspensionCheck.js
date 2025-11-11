/**
 * Middleware para verificar se usuário está suspenso
 * DESABILITADO - Não suspende usuários automaticamente
 */

// Middleware para verificar suspensão - DESABILITADO
const checkSuspension = async (req, res, next) => {
    // Suspensão desabilitada - sempre permite acesso
    next();
};

// Middleware para verificar suspensão apenas em rotas específicas - DESABILITADO
const checkSuspensionForRoutes = (routes = []) => {
    return async (req, res, next) => {
        // Suspensão desabilitada - sempre permite acesso
        next();
    };
};

// Middleware para verificar suspensão em páginas específicas - DESABILITADO
const checkSuspensionForPages = (pages = []) => {
    return async (req, res, next) => {
        // Suspensão desabilitada - sempre permite acesso
        next();
    };
};

module.exports = {
    checkSuspension,
    checkSuspensionForRoutes,
    checkSuspensionForPages
};