const passport = require('passport');
const { Usuario } = require('./database');
const jwt = require('jsonwebtoken');

// Google OAuth removido - não está sendo usado

// Serialização do usuário para sessão
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialização do usuário da sessão
passport.deserializeUser(async (id, done) => {
    try {
        const user = await Usuario.findByPk(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Função para gerar JWT token
function generateJWTToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            role: user.role,
        },
        process.env.JWT_SECRET || 'sua_chave_secreta_aqui',
        { expiresIn: '24h' }
    );
}

module.exports = {
    passport,
    generateJWTToken
};
