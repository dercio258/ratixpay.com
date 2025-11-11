/**
 * Gerenciador Avançado de Push Notifications
 * Suporta múltiplos dispositivos, IndexedDB, cache offline e multiplataforma
 */

class AdvancedPushNotificationManager {
  constructor() {
    this.apiBase = window.API_BASE || (window.location.origin + '/api');
    this.swRegistration = null;
    this.subscription = null;
    this.deviceId = null;
    this.db = null;
    this.isIOS = this.detectIOS();
    this.isSupported = this.checkSupport();
    
    // Inicializar IndexedDB
    if (typeof PushNotificationDB !== 'undefined') {
      this.db = new PushNotificationDB();
    }
    
    this.init();
  }

  detectIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  checkSupport() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }
    return true;
  }

  async checkPushManagerSupport() {
    try {
      if (!this.swRegistration) return false;
      const pushManager = this.swRegistration.pushManager;
      return pushManager !== undefined && pushManager !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gerar ID único para este dispositivo
   */
  generateDeviceId() {
    const stored = localStorage.getItem('push_device_id');
    if (stored) return stored;
    
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('push_device_id', deviceId);
    return deviceId;
  }

  /**
   * Obter informações do dispositivo
   */
  getDeviceInfo() {
    return {
      deviceId: this.deviceId || this.generateDeviceId(),
      userAgent: navigator.userAgent,
      platform: this.detectPlatform(),
      browser: this.detectBrowser(),
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: window.screen.width,
        height: window.screen.height
      }
    };
  }

  detectPlatform() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      return 'ios';
    }
    if (/Android/.test(ua)) {
      return 'android';
    }
    if (/Windows/.test(ua)) {
      return 'windows';
    }
    if (/Mac/.test(ua)) {
      return 'macos';
    }
    if (/Linux/.test(ua)) {
      return 'linux';
    }
    return 'unknown';
  }

  detectBrowser() {
    const ua = navigator.userAgent;
    if (/Chrome/.test(ua) && !/Edge|OPR/.test(ua)) return 'chrome';
    if (/Firefox/.test(ua)) return 'firefox';
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
    if (/Edge/.test(ua)) return 'edge';
    if (/OPR/.test(ua)) return 'opera';
    return 'unknown';
  }

  async init() {
    if (!this.isSupported) {
      console.warn('⚠️ Push notifications não são suportados neste navegador');
      this.updateUI(false, 'Não suportado');
      return;
    }

    try {
      // Inicializar IndexedDB
      if (this.db) {
        await this.db.init();
        console.log('✅ IndexedDB inicializado');
      }

      // Registrar service worker
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado:', this.swRegistration.scope);

      // Verificar se pushManager está disponível
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

      // Gerar deviceId
      this.deviceId = this.generateDeviceId();

      // Verificar subscription existente
      await this.checkSubscription();

      // Escutar eventos de push
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));

      // Sincronizar notificações do IndexedDB
      await this.syncNotificationsFromDB();

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
        // Verificar se está registrado no servidor
        await this.verifyServerRegistration();
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

  async verifyServerRegistration() {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;

      const userId = this.getUserId();
      if (!userId) return;

      const response = await fetch(`${this.apiBase}/push/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Verificar se este dispositivo está registrado
        const deviceInfo = this.getDeviceInfo();
        const isRegistered = data.devices?.some(d => d.deviceId === deviceInfo.deviceId);
        
        if (!isRegistered && data.devices) {
          // Re-registrar se não estiver no servidor
          console.log('🔄 Dispositivo não encontrado no servidor, re-registrando...');
          await this.subscribe();
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao verificar registro no servidor:', error);
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      if (this.isIOS) {
        throw new Error('Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.');
      }
      throw new Error('Push notifications não são suportados neste navegador');
    }

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
      if (this.subscription) {
        console.log('ℹ️ Já existe uma subscription ativa');
        return this.subscription;
      }

      const hasPushManager = await this.checkPushManagerSupport();
      if (!hasPushManager) {
        if (this.isIOS) {
          throw new Error('Push notifications não são suportados no iOS Safari. Use Chrome ou Firefox no iOS, ou um dispositivo Android.');
        }
        throw new Error('Push notifications não são suportados neste navegador');
      }

      await this.requestPermission();

      if (!this.swRegistration) {
        throw new Error('Service Worker não está registrado');
      }

      // Obter chave pública VAPID
      const publicKey = await this.getVapidPublicKey();

      // Criar subscription
      this.subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      console.log('✅ Subscription criada:', this.subscription);

      // Registrar no servidor com informações do dispositivo
      await this.registerDeviceOnServer();

      this.updateUI(true, 'Ativado');
      this.showNotification('Notificações Push Ativadas', 'Você receberá notificações quando houver novas vendas!');

      return this.subscription;
    } catch (error) {
      console.error('❌ Erro ao criar subscription:', error);
      this.updateUI(false, 'Erro');
      throw error;
    }
  }

  async registerDeviceOnServer() {
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

      const deviceInfo = this.getDeviceInfo();
      const deviceName = `${deviceInfo.platform} - ${deviceInfo.browser}`;

      const response = await fetch(`${this.apiBase}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subscription: this.subscription.toJSON(),
          userId: userId,
          deviceInfo: {
            deviceId: deviceInfo.deviceId,
            name: deviceName,
            userAgent: deviceInfo.userAgent,
            platform: deviceInfo.platform,
            browser: deviceInfo.browser
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Dispositivo registrado no servidor:', result);
      
      if (result.deviceId) {
        this.deviceId = result.deviceId;
        localStorage.setItem('push_device_id', result.deviceId);
      }

    } catch (error) {
      console.error('❌ Erro ao registrar dispositivo no servidor:', error);
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
      await this.removeDeviceFromServer();

      // Remover subscription local
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

  async removeDeviceFromServer() {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return;

      const userId = this.getUserId();
      if (!userId) return;

      const deviceInfo = this.getDeviceInfo();

      await fetch(`${this.apiBase}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId: deviceInfo.deviceId,
          userId: userId
        })
      });

      console.log('✅ Dispositivo removido do servidor');
    } catch (error) {
      console.error('❌ Erro ao remover dispositivo do servidor:', error);
    }
  }

  async getDevices() {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) return [];

      const userId = this.getUserId();
      if (!userId) return [];

      const response = await fetch(`${this.apiBase}/push/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.devices || [];
      }

      return [];
    } catch (error) {
      console.error('❌ Erro ao obter dispositivos:', error);
      return [];
    }
  }

  async syncNotificationsFromDB() {
    if (!this.db) return;

    try {
      const notifications = await this.db.getNotifications({ limit: 20 });
      console.log(`📦 ${notifications.length} notificações carregadas do IndexedDB`);
      
      // Atualizar contador de não lidas
      const unreadCount = await this.db.getUnreadCount();
      this.updateUnreadBadge(unreadCount);
    } catch (error) {
      console.warn('⚠️ Erro ao sincronizar notificações do IndexedDB:', error);
    }
  }

  updateUnreadBadge(count) {
    // Atualizar badge na UI se existir
    const badge = document.getElementById('notificationBadge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  }

  async getVapidPublicKey() {
    try {
      const response = await fetch(`${this.apiBase}/push/vapid-public-key`);
      const data = await response.json();
      
      if (data.success && data.publicKey) {
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
let advancedPushManager = null;

// Função para toggle de notificações
async function togglePushNotifications() {
  if (!advancedPushManager) {
    advancedPushManager = new AdvancedPushNotificationManager();
    await advancedPushManager.init();
  }

  try {
    if (advancedPushManager.subscription) {
      await advancedPushManager.unsubscribe();
      alert('Notificações push desativadas com sucesso!');
    } else {
      await advancedPushManager.subscribe();
      alert('Notificações push ativadas com sucesso!');
    }
  } catch (error) {
    console.error('Erro ao alternar notificações:', error);
    alert('Erro: ' + error.message);
  }
}

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', async () => {
  // Carregar IndexedDB manager primeiro
  if (typeof PushNotificationDB === 'undefined') {
    const script = document.createElement('script');
    script.src = '/js/push-notification-db.js';
    document.head.appendChild(script);
    
    script.onload = () => {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        advancedPushManager = new AdvancedPushNotificationManager();
      }
    };
  } else {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      advancedPushManager = new AdvancedPushNotificationManager();
    }
  }
});

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.AdvancedPushNotificationManager = AdvancedPushNotificationManager;
  window.advancedPushManager = advancedPushManager;
  window.togglePushNotifications = togglePushNotifications;
}

