/**
 * Middleware de autenticação específico para afiliados
 */

const jwt = require('jsonwebtoken');
const { Afiliado } = require('../config/database');

// Middleware para verificar token JWT de afiliado (com suporte a refresh token)
const authenticateAfiliado = async (req, res, next) => {
    try {
        console.log(`🔐 [AUTH-AFILIADO] Verificando autenticação para: ${req.method} ${req.path}`);
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Token não fornecido. Faça login para continuar.',
                code: 'NO_TOKEN'
            });
        }

        const jwtSecret = process.env.JWT_SECRET || 'ratixpay-secret-key-2024';
        let decoded;
        
        try {
            decoded = jwt.verify(token, jwtSecret);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Token expirado. Use o refresh token para renovar.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Token inválido',
                    code: 'INVALID_TOKEN'
                });
            }
            
            throw error;
        }
        
        // Verificar se é token de afiliado
        if (decoded.tipo !== 'afiliado') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token inválido para afiliado',
                code: 'INVALID_TOKEN_TYPE'
            });
        }
        
        // Buscar afiliado no banco
        console.log(`🔍 [AUTH-AFILIADO] Buscando afiliado com ID: ${decoded.id}`);
        const afiliado = await Afiliado.findByPk(decoded.id);
        
        if (!afiliado) {
            console.log(`❌ [AUTH-AFILIADO] Afiliado não encontrado: ${decoded.id}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Afiliado não encontrado',
                code: 'AFFILIATE_NOT_FOUND'
            });
        }

        console.log(`📋 [AUTH-AFILIADO] Afiliado encontrado: ${afiliado.nome}, Status: ${afiliado.status}`);

        // Verificar se está ativo
        if (afiliado.status === 'suspenso') {
            console.log(`❌ [AUTH-AFILIADO] Afiliado suspenso: ${afiliado.id}, Status: ${afiliado.status}`);
            return res.status(403).json({ 
                success: false, 
                error: `Sua conta está suspensa. Entre em contato com o suporte.`,
                status: afiliado.status,
                code: 'ACCOUNT_SUSPENDED'
            });
        }

        // Se conta inativa, fazer logout e redirecionar
        if (afiliado.status === 'inativo') {
            console.log(`❌ [AUTH-AFILIADO] Conta inativa detectada, fazendo logout: ${afiliado.id}`);
            return res.status(403).json({ 
                success: false, 
                error: 'Sua conta está inativa. Faça login novamente para receber um código de ativação.',
                status: afiliado.status,
                code: 'ACCOUNT_INACTIVE',
                requiresLogout: true
            });
        }

        console.log(`✅ [AUTH-AFILIADO] Afiliado autenticado com sucesso: ${afiliado.nome} (${afiliado.id})`);

        // Adicionar afiliado ao request
        req.afiliado = afiliado;
        req.afiliadoId = afiliado.id;
        
        next();
    } catch (error) {
        console.error('❌ Erro na autenticação de afiliado:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor',
            code: 'INTERNAL_ERROR'
        });
    }
};

// Middleware opcional - não bloqueia se não tiver token
const optionalAuthAfiliado = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const jwtSecret = process.env.JWT_SECRET || 'ratixpay-secret-key-2024';
            const decoded = jwt.verify(token, jwtSecret);
            
            if (decoded.tipo === 'afiliado') {
                const afiliado = await Afiliado.findByPk(decoded.id);
                if (afiliado && afiliado.status === 'ativo') {
                    req.afiliado = afiliado;
                    req.afiliadoId = afiliado.id;
                }
            }
        }
        
        next();
    } catch (error) {
        // Em caso de erro, continua sem autenticação
        next();
    }
};

module.exports = {
    authenticateAfiliado,
    optionalAuthAfiliado
};
