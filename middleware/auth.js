const jwt = require('jsonwebtoken');
const { Usuario } = require('../config/database');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // Verificando token de autenticação
        if (!token || token.trim() === '') {
            // Não logar quando não há token - é esperado em algumas situações
            // Apenas retornar erro silenciosamente
            return res.status(401).json({ 
                success: false, 
                error: 'Usuário não autenticado' 
            });
        }
        
        console.log(`🔐 [AUTH] Verificando autenticação para: ${req.method} ${req.url}`);

        const jwtSecret = process.env.JWT_SECRET || 'ratixpay-secret-key-2024';
        const decoded = jwt.verify(token, jwtSecret);
        
        // Buscar usuário no banco
        const user = await Usuario.findByPk(decoded.id);
        if (!user || !user.ativo) {
            console.log(`❌ [AUTH] Usuário inválido ou inativo: ${decoded.id}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Usuário inválido ou inativo' 
            });
        }

        console.log(`✅ [AUTH] Usuário autenticado: ${user.id} (${user.tipo_usuario})`);
        req.user = user;
        next();
    } catch (error) {
        console.error('❌ [AUTH] Erro na autenticação:', error);
        return res.status(401).json({ 
            success: false, 
            error: 'Token inválido' 
        });
    }
};

// Middleware para verificar se é admin
const isAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            console.log('❌ isAdmin: Usuário não autenticado');
            return res.status(401).json({ 
                success: false, 
                error: 'Usuário não autenticado' 
            });
        }

        // Verificação especial para email administrativo principal
        const isMainAdmin = req.user.email === 'ratixpay.mz@gmail.com';
        const isRegularAdmin = req.user.role === 'admin';
        
        if (!isMainAdmin && !isRegularAdmin) {
            return res.status(403).json({ 
                success: false, 
                error: 'Acesso negado. Apenas administradores podem acessar este recurso.' 
            });
        }

        // Se for o email principal, garantir que seja reconhecido como admin
        if (isMainAdmin) {
            console.log('🔑 Acesso administrativo concedido para ratixpay.mz@gmail.com');
        }
        next();
    } catch (error) {
        console.error('❌ Erro na verificação de admin:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
};

// Middleware para verificar se é vendedor ou admin
const isVendedorOrAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Usuário não autenticado' 
            });
        }

        // Verificar se é admin ou vendedor (role: 'user' são vendedores)
        const isAdmin = req.user.role === 'admin';
        const isVendedor = req.user.role === 'user';
        
        if (!isAdmin && !isVendedor) {
            return res.status(403).json({ 
                success: false, 
                error: 'Acesso negado. Apenas vendedores e administradores podem acessar este recurso.' 
            });
        }

        next();
    } catch (error) {
        console.error('Erro na verificação de vendedor/admin:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
        });
    }
};

// Middleware para verificar acesso de administrador
const checkAdminAccess = (req, res, next) => {
    try {
        // Verificando acesso de admin
        
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

        // Acesso autorizado
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

// Middleware para verificar marketing avançado ativo
const requireMarketingAvancado = async (req, res, next) => {
    try {
        if (!req.user) {
            console.log('❌ requireMarketingAvancado: Usuário não autenticado');
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado'
            });
        }

        // Verificando marketing avançado

        // Verificar se o usuário tem marketing avançado ativo
        if (!req.user.marketing_avancado) {
            return res.status(403).json({
                success: false,
                error: 'Marketing avançado não está ativo. Ative o plano premium para acessar estas funcionalidades.',
                code: 'MARKETING_AVANCADO_REQUIRED'
            });
        }

        console.log('✅ requireMarketingAvancado: Marketing avançado ativo - acesso autorizado');
        next();
    } catch (error) {
        console.error('❌ Erro na verificação de marketing avançado:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
};

// Alias para compatibilidade
const requireAdmin = isAdmin;

module.exports = {
    authenticateToken,
    requireAdmin,
    isAdmin,
    isVendedorOrAdmin,
    checkAdminAccess,
    requireMarketingAvancado
};
