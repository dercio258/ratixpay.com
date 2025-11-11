/**
 * Configurações centralizadas para o administrador do sistema
 * Agora carrega as configurações do arquivo .env via config.js
 */

const config = require('./config');

module.exports = {
    // Dados de contato do admin
    admin: config.admin,
    
    // Configurações de email
    email: config.email,
    
    // Configurações de WhatsApp
    whatsapp: config.whatsapp,
    
    // Configurações de notificações
    notifications: config.notifications
};
