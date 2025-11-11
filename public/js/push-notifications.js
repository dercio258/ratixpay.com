/**
 * Push Notifications Manager para RatixPay
 * Gerencia notificações push do navegador seguindo as políticas dos navegadores
 */

class PushNotificationManager {
    constructor() {
        this.apiBase = window.API_BASE || (window.location.origin + '/api');
        this.swRegistration = null;
        // Verificar suporte completo: Notification API, Service Worker E PushManager
        this.isSupported = this.checkSupport();
        this.isIOS = this.detectIOS();
        this.subscription = null;
        
        this.init();
    }

    detectIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    checkSupport() {
        // Verificar APIs básicas
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            return false;
        }

        // Verificar se pushManager está disponível (não disponível no iOS Safari)
        // Isso será verificado quando o service worker for registrado
        return true;
    }

    async checkPushManagerSupport() {
        try {
            if (!this.swRegistration) return false;
            // Tentar acessar pushManager - se não existir, lançará erro
            const pushManager = this.swRegistration.pushManager;
            return pushManager !== undefined && pushManager !== null;
        } catch (error) {
            return false;
        }
    }

    async init() {
        if (!this.isSupported) {
            console.warn('⚠️ Push notifications não são suportados neste navegador');
            this.updateUI(false, 'Não suportado');
            return;
        }

        try {
            // Registrar service worker
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker registrado:', this.swRegistration.scope);

            // Verificar se pushManager está disponível (não disponível no iOS Safari)
            const hasPushManager = await this.checkPushManagerSupport();
            if (!hasPushManager) {
                if (this.isIOS) {
                    console.warn('⚠️ Push notifications não são suportados no iOS Safari');
                    this.updateUI(false, 'iOS não suportado');
                    return;
                } else {
                    console.warn('⚠️ PushManager não está disponível');
                    this.updateUI(false, 'Não suportado');
                    return;
                }
            }

            // Verificar subscription existente
            await this.checkSubscription();

            // Escutar eventos de push
            navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        } catch (error) {
            console.error('❌ Erro ao inicializar push notifications:', error);
            if (this.isIOS) {
                this.updateUI(false, 'iOS não suportado');
            } else {
                this.updateUI(false, 'Erro ao inicializar');
            }
        }
    }

    async checkSubscription() {
        try {
            if (!this.swRegistration) return;

            this.subscription = await this.swRegistration.pushManager.getSubscription();
            
            if (this.subscription) {
                console.log('✅ Subscription encontrada:', this.subscription);
                await this.sendSubscriptionToServer(this.subscription);
                this.updateUI(true, 'Ativado');
            } else {
                const permission = Notification.permission;
                if (permission === 'denied') {
                    this.updateUI(false, 'Bloqueado');
                } else {
                    this.updateUI(false, 'Desativado');
                }
            }
        } catch (error) {
            console.error('❌ Erro ao verificar subscription:', error);
            this.updateUI(false, 'Erro');
        }
    }

    async requestPermission() {
        if (!this.isSupported) {
            if (this.isIOS) {
                throw new Error('Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.');
            }
            throw new Error('Push notifications não são suportados neste navegador');
        }

        // Verificar se pushManager está disponível antes de solicitar permissão
        const hasPushManager = await this.checkPushManagerSupport();
        if (!hasPushManager) {
            if (this.isIOS) {
                throw new Error('Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.');
            }
            throw new Error('Push notifications não são suportados neste navegador');
        }

        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
            console.log('✅ Permissão concedida');
            return true;
        } else if (permission === 'denied') {
            console.warn('⚠️ Permissão negada pelo usuário');
            throw new Error('Permissão negada. Por favor, ative as notificações nas configurações do navegador.');
        } else {
            console.warn('⚠️ Permissão ignorada');
            throw new Error('Permissão não concedida');
        }
    }

    async subscribe() {
        try {
            // Verificar se já tem subscription
            if (this.subscription) {
                console.log('ℹ️ Já existe uma subscription ativa');
                return this.subscription;
            }

            // Verificar se pushManager está disponível
            const hasPushManager = await this.checkPushManagerSupport();
            if (!hasPushManager) {
                if (this.isIOS) {
                    throw new Error('Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.');
                }
                throw new Error('Push notifications não são suportados neste navegador');
            }

            // Solicitar permissão
            await this.requestPermission();

            if (!this.swRegistration) {
                throw new Error('Service Worker não está registrado');
            }

            // Criar subscription
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: await this.getVapidPublicKey()
            });

            console.log('✅ Subscription criada:', subscription);
            this.subscription = subscription;

            // Enviar para o servidor
            await this.sendSubscriptionToServer(subscription);

            this.updateUI(true, 'Ativado');
            this.showNotification('Notificações Push Ativadas', 'Você receberá notificações quando houver novas vendas!');

            return subscription;
        } catch (error) {
            console.error('❌ Erro ao criar subscription:', error);
            this.updateUI(false, 'Erro');
            throw error;
        }
    }

    async unsubscribe() {
        try {
            if (!this.subscription) {
                console.log('ℹ️ Nenhuma subscription para remover');
                return;
            }

            // Remover do servidor
            await this.removeSubscriptionFromServer(this.subscription);

            // Remover subscription
            const success = await this.subscription.unsubscribe();
            if (success) {
                console.log('✅ Subscription removida');
                this.subscription = null;
                this.updateUI(false, 'Desativado');
            } else {
                throw new Error('Falha ao remover subscription');
            }
        } catch (error) {
            console.error('❌ Erro ao remover subscription:', error);
            throw error;
        }
    }

    async sendSubscriptionToServer(subscription) {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ Token não encontrado, não será possível salvar subscription');
                return;
            }

            const userId = this.getUserId();
            if (!userId) {
                console.warn('⚠️ UserId não encontrado');
                return;
            }

            const response = await fetch(`${this.apiBase}/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    userId: userId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ Subscription salva no servidor:', result);
        } catch (error) {
            console.error('❌ Erro ao salvar subscription no servidor:', error);
            // Não falhar o processo se não conseguir salvar no servidor
        }
    }

    async removeSubscriptionFromServer(subscription) {
        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token) return;

            const userId = this.getUserId();
            if (!userId) return;

            const response = await fetch(`${this.apiBase}/push/unsubscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    userId: userId
                })
            });

            if (!response.ok) {
                console.warn('⚠️ Erro ao remover subscription do servidor:', response.status);
            } else {
                console.log('✅ Subscription removida do servidor');
            }
        } catch (error) {
            console.error('❌ Erro ao remover subscription do servidor:', error);
        }
    }

    async getVapidPublicKey() {
        try {
            const response = await fetch(`${this.apiBase}/push/vapid-public-key`);
            const data = await response.json();
            
            if (data.success && data.publicKey) {
                // Converter base64 URL para Uint8Array
                return this.urlBase64ToUint8Array(data.publicKey);
            } else {
                throw new Error('Chave pública não encontrada');
            }
        } catch (error) {
            console.error('❌ Erro ao obter chave pública VAPID:', error);
            throw error;
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    getUserId() {
        try {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}');
            return userData.id || userData.userId || null;
        } catch (error) {
            console.error('Erro ao obter userId:', error);
            return null;
        }
    }

    updateUI(isActive, statusText) {
        const statusIcon = document.getElementById('pushStatusIcon');
        const statusTextEl = document.getElementById('pushStatusText');
        const btn = document.getElementById('pushNotificationBtn');
        const btnText = document.getElementById('pushBtnText');

        if (!statusIcon || !statusTextEl || !btn || !btnText) return;

        if (isActive) {
            statusIcon.className = 'fas fa-circle';
            statusIcon.style.color = '#28a745';
            statusTextEl.textContent = statusText;
            btnText.textContent = 'Desativar Notificações';
            btn.className = 'btn-tool btn-secondary';
        } else {
            statusIcon.className = 'fas fa-circle';
            statusIcon.style.color = statusText === 'Bloqueado' ? '#dc3545' : '#6c757d';
            
            // Mensagem específica para iOS
            if (statusText === 'iOS não suportado') {
                statusTextEl.textContent = 'iOS não suportado';
                statusTextEl.title = 'Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.';
            } else {
                statusTextEl.textContent = statusText;
            }
            
            btnText.textContent = 'Ativar Notificações';
            btn.className = 'btn-tool btn-primary';
            btn.disabled = statusText === 'Bloqueado' || statusText === 'Não suportado' || statusText === 'iOS não suportado';
        }
    }

    showNotification(title, body, options = {}) {
        if (Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/assets/images/icons/push-icon-192x192.png',
                badge: '/assets/images/icons/push-icon-48x48.png',
                tag: 'ratixpay-notification',
                requireInteraction: false,
                ...options
            });
        }
    }

    handleServiceWorkerMessage(event) {
        console.log('📨 Mensagem recebida do Service Worker:', event.data);
        
        if (event.data && event.data.type === 'PUSH_NOTIFICATION') {
            const { title, body, data } = event.data;
            this.showNotification(title, body, { data: data });
        }
    }
}

// Instância global
let pushManager = null;

// Função para toggle de notificações
async function togglePushNotifications() {
    if (!pushManager) {
        pushManager = new PushNotificationManager();
        await pushManager.init();
    }

    try {
        if (pushManager.subscription) {
            // Desativar
            await pushManager.unsubscribe();
            alert('Notificações push desativadas com sucesso!');
        } else {
            // Ativar
            await pushManager.subscribe();
            alert('Notificações push ativadas com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao alternar notificações:', error);
        alert('Erro: ' + error.message);
    }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
        pushManager = new PushNotificationManager();
    } else {
        console.warn('⚠️ Push notifications não são suportados neste navegador');
    }
});


