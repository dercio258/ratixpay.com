/**
 * Middleware de autenticação específico para afiliados
 */

const jwt = require('jsonwebtoken');
const { Afiliado } = require('../config/database');

// Middleware para verificar token JWT de afiliado
const authenticateAfiliado = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                error: 'Token não fornecido. Faça login para continuar.' 
            });
        }

        const jwtSecret = process.env.JWT_SECRET || 'ratixpay-secret-key-2024';
        const decoded = jwt.verify(token, jwtSecret);
        
        // Verificar se é token de afiliado
        if (decoded.tipo !== 'afiliado') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token inválido para afiliado' 
            });
        }
        
        // Buscar afiliado no banco
        const afiliado = await Afiliado.findByPk(decoded.id);
        
        if (!afiliado) {
            return res.status(401).json({ 
                success: false, 
                error: 'Afiliado não encontrado' 
            });
        }

        // Verificar se está ativo
        if (afiliado.status !== 'ativo') {
            return res.status(403).json({ 
                success: false, 
                error: `Sua conta está ${afiliado.status}. Entre em contato com o suporte.`,
                status: afiliado.status
            });
        }

        // Adicionar afiliado ao request
        req.afiliado = afiliado;
        req.afiliadoId = afiliado.id;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token expirado. Faça login novamente.' 
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                error: 'Token inválido' 
            });
        }

        console.error('❌ Erro na autenticação de afiliado:', error);
        return res.status(500).json({ 
            success: false, 
            error: 'Erro interno do servidor' 
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
