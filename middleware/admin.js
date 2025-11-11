/**
 * Middleware para verificar acesso de administrador
 */

const checkAdminAccess = (req, res, next) => {
    try {
        // Verificar se o usuário está autenticado
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Acesso negado. Usuário não autenticado.'
            });
        }

        // Verificação especial para email administrativo principal
        const isMainAdmin = req.user.email === 'ratixpay.mz@gmail.com';
        const isRegularAdmin = req.user.role === 'admin';
        
        if (!isMainAdmin && !isRegularAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Permissões de administrador necessárias.'
            });
        }

        // Se for o email principal, garantir que seja reconhecido como admin
        if (isMainAdmin) {
            console.log('🔑 Acesso administrativo concedido para ratixpay.mz@gmail.com');
        }

        // Se chegou até aqui, o usuário é admin
        next();
    } catch (error) {
        console.error('❌ Erro no middleware de admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
};

module.exports = {
    checkAdminAccess
};
