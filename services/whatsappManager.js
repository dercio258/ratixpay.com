/**
 * Gerenciador Unificado de WhatsApp
 * 
 * Sistema atualizado para usar apenas Baileys
 * whatsapp-web.js foi removido completamente
 */

console.log('📱 Usando WhatsApp Baileys Manager');
const manager = require('./whatsappBaileysManager');

// Wrapper para compatibilidade
class WhatsAppManagerWrapper {
    constructor() {
        this.manager = manager;
        this.isBaileys = true; // Sempre Baileys agora
    }

    // Métodos principais - delegar para o manager apropriado
    async initialize(sessionId) {
        return await this.manager.initialize(sessionId);
    }

    async sendMessage(phoneNumber, message, media = null, sessionId = 'default') {
        return await this.manager.sendMessage(phoneNumber, message, media, sessionId);
    }

    getStatus(sessionId = 'default') {
        return this.manager.getStatus(sessionId);
    }

    getAllSessionsStatus() {
        return this.manager.getAllSessionsStatus();
    }

    async reset(sessionId = 'default') {
        return await this.manager.reset(sessionId);
    }

    async delete(sessionId = 'default') {
        return await this.manager.delete(sessionId);
    }

    async test(testPhoneNumber, sessionId = 'default') {
        return await this.manager.test(testPhoneNumber, sessionId);
    }

    getQRCode(sessionId = 'default') {
        return this.manager.getQRCode(sessionId);
    }

    getLogs(limit = 100, sessionId = null) {
        // Se o manager suporta sessionId, passar
        if (sessionId && typeof this.manager.getLogs === 'function') {
            try {
                return this.manager.getLogs(limit, sessionId);
            } catch (e) {
                // Fallback se não suportar sessionId
                return this.manager.getLogs(limit);
            }
        }
        return this.manager.getLogs(limit);
    }

    async sendNotificationSafely(phoneNumber, message, media = null, sessionId = 'default') {
        return await this.manager.sendNotificationSafely(phoneNumber, message, media, sessionId);
    }

    // Métodos de compatibilidade
    async getSession(sessionId = 'default') {
        return await this.manager.getSession(sessionId);
    }

    getSessionStatus(sessionId = 'default') {
        return this.manager.getSessionStatus(sessionId);
    }

    getValidSessionTypes() {
        return this.manager.getValidSessionTypes();
    }

    isValidSessionType(sessionId) {
        return this.manager.isValidSessionType(sessionId);
    }

    async resetSession(sessionId = 'default') {
        return await this.manager.resetSession(sessionId);
    }

    async deleteSession(sessionId = 'default') {
        return await this.manager.deleteSession(sessionId);
    }

    async testSession(testPhoneNumber, sessionId = 'default') {
        return await this.manager.testSession(testPhoneNumber, sessionId);
    }
}

module.exports = new WhatsAppManagerWrapper();

