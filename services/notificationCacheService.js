/**
 * 🔄 SERVIÇO DE CACHE PARA NOTIFICAÇÕES - RATIXPAY
 * 
 * Gerencia cache de notificações para melhorar performance:
 * - Cache de templates de email/WhatsApp
 * - Cache de dados de usuários
 * - Cache de configurações
 * - Invalidação inteligente
 */

class NotificationCacheService {
    constructor() {
        this.cache = {
            // Cache de templates
            emailTemplates: new Map(),
            whatsappTemplates: new Map(),
            
            // Cache de dados de usuários
            userData: new Map(),
            
            // Cache de configurações
            config: new Map(),
            
            // Cache de notificações enviadas (para evitar duplicatas)
            sentNotifications: new Map()
        };
        
        // Configurações do cache
        this.config = {
            maxCacheSize: 1000,
            defaultTTL: 300000, // 5 minutos
            userDataTTL: 600000, // 10 minutos
            templateTTL: 3600000, // 1 hora
            cleanupInterval: 300000 // 5 minutos
        };
        
        // Iniciar limpeza automática
        this.startCleanup();
        
        console.log('🔄 NotificationCacheService inicializado');
    }
    
    /**
     * Inicia limpeza automática do cache
     */
    startCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }
    
    /**
     * Limpa entradas expiradas do cache
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        // Limpar cache de dados de usuários
        for (const [key, value] of this.cache.userData.entries()) {
            if (now > value.expiresAt) {
                this.cache.userData.delete(key);
                cleaned++;
            }
        }
        
        // Limpar cache de templates
        for (const [key, value] of this.cache.emailTemplates.entries()) {
            if (now > value.expiresAt) {
                this.cache.emailTemplates.delete(key);
                cleaned++;
            }
        }
        
        for (const [key, value] of this.cache.whatsappTemplates.entries()) {
            if (now > value.expiresAt) {
                this.cache.whatsappTemplates.delete(key);
                cleaned++;
            }
        }
        
        // Limpar cache de notificações enviadas (manter apenas últimas 100)
        if (this.cache.sentNotifications.size > 100) {
            const entries = Array.from(this.cache.sentNotifications.entries());
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            
            // Manter apenas as 100 mais recentes
            this.cache.sentNotifications.clear();
            entries.slice(0, 100).forEach(([key, value]) => {
                this.cache.sentNotifications.set(key, value);
            });
            cleaned += entries.length - 100;
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cache limpo: ${cleaned} entradas removidas`);
        }
    }
    
    /**
     * Armazena dados de usuário no cache
     */
    setUserData(userId, userData, ttl = this.config.userDataTTL) {
        const key = `user_${userId}`;
        this.cache.userData.set(key, {
            data: userData,
            expiresAt: Date.now() + ttl,
            timestamp: Date.now()
        });
        
        // Limitar tamanho do cache
        if (this.cache.userData.size > this.config.maxCacheSize) {
            const firstKey = this.cache.userData.keys().next().value;
            this.cache.userData.delete(firstKey);
        }
    }
    
    /**
     * Recupera dados de usuário do cache
     */
    getUserData(userId) {
        const key = `user_${userId}`;
        const cached = this.cache.userData.get(key);
        
        if (!cached) {
            return null;
        }
        
        if (Date.now() > cached.expiresAt) {
            this.cache.userData.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    /**
     * Armazena template no cache
     */
    setTemplate(type, templateKey, template, ttl = this.config.templateTTL) {
        const cacheMap = type === 'email' ? this.cache.emailTemplates : this.cache.whatsappTemplates;
        const key = `${type}_${templateKey}`;
        
        cacheMap.set(key, {
            template: template,
            expiresAt: Date.now() + ttl,
            timestamp: Date.now()
        });
    }
    
    /**
     * Recupera template do cache
     */
    getTemplate(type, templateKey) {
        const cacheMap = type === 'email' ? this.cache.emailTemplates : this.cache.whatsappTemplates;
        const key = `${type}_${templateKey}`;
        const cached = cacheMap.get(key);
        
        if (!cached) {
            return null;
        }
        
        if (Date.now() > cached.expiresAt) {
            cacheMap.delete(key);
            return null;
        }
        
        return cached.template;
    }
    
    /**
     * Verifica se uma notificação já foi enviada (evitar duplicatas)
     */
    isNotificationSent(notificationKey) {
        const cached = this.cache.sentNotifications.get(notificationKey);
        
        if (!cached) {
            return false;
        }
        
        // Considerar como não enviada se passou mais de 1 hora
        if (Date.now() - cached.timestamp > 3600000) {
            this.cache.sentNotifications.delete(notificationKey);
            return false;
        }
        
        return true;
    }
    
    /**
     * Marca uma notificação como enviada
     */
    markNotificationSent(notificationKey, details = {}) {
        this.cache.sentNotifications.set(notificationKey, {
            timestamp: Date.now(),
            details: details
        });
    }
    
    /**
     * Gera chave única para notificação
     */
    generateNotificationKey(type, userId, data) {
        const dataString = JSON.stringify(data);
        const hash = require('crypto')
            .createHash('md5')
            .update(`${type}_${userId}_${dataString}`)
            .digest('hex');
        return hash;
    }
    
    /**
     * Invalida cache de usuário específico
     */
    invalidateUserCache(userId) {
        const key = `user_${userId}`;
        this.cache.userData.delete(key);
        console.log(`🗑️ Cache de usuário ${userId} invalidado`);
    }
    
    /**
     * Invalida todo o cache
     */
    invalidateAll() {
        this.cache.userData.clear();
        this.cache.emailTemplates.clear();
        this.cache.whatsappTemplates.clear();
        this.cache.sentNotifications.clear();
        console.log('🗑️ Todo o cache invalidado');
    }
    
    /**
     * Obtém estatísticas do cache
     */
    getStats() {
        return {
            userData: this.cache.userData.size,
            emailTemplates: this.cache.emailTemplates.size,
            whatsappTemplates: this.cache.whatsappTemplates.size,
            sentNotifications: this.cache.sentNotifications.size,
            totalSize: this.cache.userData.size + 
                      this.cache.emailTemplates.size + 
                      this.cache.whatsappTemplates.size + 
                      this.cache.sentNotifications.size
        };
    }
}

// Exportar instância única
module.exports = new NotificationCacheService();
