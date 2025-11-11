/**
 * Serviço Avançado de Push Notifications
 * Suporta múltiplos dispositivos, cache offline, e gerenciamento completo
 */

const webpush = require('web-push');
const { Usuario } = require('../config/database');
const { Sequelize } = require('sequelize');

// Configurar VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

let vapidConfigured = false;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:suporte@ratixpay.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
    console.log('✅ VAPID keys configuradas para push notifications');
  } catch (error) {
    console.warn('⚠️ Erro ao configurar VAPID keys:', error.message);
  }
}

class PushNotificationService {
  constructor() {
    this.vapidConfigured = vapidConfigured;
  }

  /**
   * Detectar plataforma do dispositivo
   */
  detectPlatform(userAgent, subscription) {
    const ua = userAgent || '';
    const endpoint = subscription?.endpoint || '';

    if (/iPhone|iPad|iPod/.test(ua)) {
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
    
    // Detectar pelo endpoint
    if (endpoint.includes('fcm.googleapis.com')) {
      return 'android';
    }
    if (endpoint.includes('wns2-')) {
      return 'windows';
    }
    
    return 'unknown';
  }

  /**
   * Detectar navegador
   */
  detectBrowser(userAgent) {
    const ua = userAgent || '';
    
    if (/Chrome/.test(ua) && !/Edge|OPR/.test(ua)) {
      return 'chrome';
    }
    if (/Firefox/.test(ua)) {
      return 'firefox';
    }
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      return 'safari';
    }
    if (/Edge/.test(ua)) {
      return 'edge';
    }
    if (/OPR/.test(ua)) {
      return 'opera';
    }
    
    return 'unknown';
  }

  /**
   * Registrar dispositivo para um usuário
   * Suporta múltiplos dispositivos por usuário
   */
  async registerDevice(userId, subscription, deviceInfo = {}) {
    if (!this.vapidConfigured) {
      throw new Error('Push notifications não configuradas');
    }

    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }

      // Obter informações do dispositivo
      const platform = this.detectPlatform(deviceInfo.userAgent, subscription);
      const browser = this.detectBrowser(deviceInfo.userAgent);
      const deviceId = deviceInfo.deviceId || this.generateDeviceId(subscription);

      // Preparar dados do dispositivo
      const deviceData = {
        deviceId: deviceId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        platform: platform,
        browser: browser,
        userAgent: deviceInfo.userAgent || 'unknown',
        name: deviceInfo.name || `${platform} - ${browser}`,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        active: true
      };

      // Obter dispositivos existentes
      let devices = [];
      if (usuario.push_subscription) {
        try {
          const existingData = JSON.parse(usuario.push_subscription);
          if (Array.isArray(existingData)) {
            devices = existingData;
          } else if (existingData.endpoint) {
            // Migrar formato antigo (único dispositivo) para novo formato (array)
            devices = [existingData];
          }
        } catch (e) {
          console.warn('⚠️ Erro ao parsear push_subscription existente:', e);
        }
      }

      // Verificar se o dispositivo já existe (por endpoint)
      const existingIndex = devices.findIndex(d => d.endpoint === subscription.endpoint);
      
      if (existingIndex >= 0) {
        // Atualizar dispositivo existente
        devices[existingIndex] = {
          ...devices[existingIndex],
          ...deviceData,
          lastActive: new Date().toISOString()
        };
        console.log(`🔄 Dispositivo atualizado: ${deviceId}`);
      } else {
        // Adicionar novo dispositivo
        devices.push(deviceData);
        console.log(`➕ Novo dispositivo registrado: ${deviceId}`);
      }

      // Limitar a 10 dispositivos por usuário (remover os mais antigos)
      if (devices.length > 10) {
        devices.sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive));
        devices = devices.slice(0, 10);
        console.log(`⚠️ Limite de dispositivos atingido. Removendo dispositivos antigos.`);
      }

      // Salvar no banco de dados
      await usuario.update({
        push_subscription: JSON.stringify(devices)
      });

      return {
        success: true,
        deviceId: deviceId,
        deviceCount: devices.length,
        message: 'Dispositivo registrado com sucesso'
      };

    } catch (error) {
      console.error('❌ Erro ao registrar dispositivo:', error);
      throw error;
    }
  }

  /**
   * Remover dispositivo específico
   */
  async unregisterDevice(userId, deviceId) {
    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }

      if (!usuario.push_subscription) {
        return { success: true, message: 'Nenhum dispositivo para remover' };
      }

      let devices = [];
      try {
        const existingData = JSON.parse(usuario.push_subscription);
        if (Array.isArray(existingData)) {
          devices = existingData;
        } else if (existingData.endpoint) {
          devices = [existingData];
        }
      } catch (e) {
        console.warn('⚠️ Erro ao parsear push_subscription:', e);
        return { success: false, error: 'Erro ao processar dispositivos' };
      }

      // Remover dispositivo
      const initialLength = devices.length;
      devices = devices.filter(d => d.deviceId !== deviceId);

      if (devices.length === initialLength) {
        return { success: false, error: 'Dispositivo não encontrado' };
      }

      // Salvar no banco
      if (devices.length === 0) {
        await usuario.update({ push_subscription: null });
      } else {
        await usuario.update({
          push_subscription: JSON.stringify(devices)
        });
      }

      console.log(`🗑️ Dispositivo removido: ${deviceId}`);
      return {
        success: true,
        deviceCount: devices.length,
        message: 'Dispositivo removido com sucesso'
      };

    } catch (error) {
      console.error('❌ Erro ao remover dispositivo:', error);
      throw error;
    }
  }

  /**
   * Remover todos os dispositivos de um usuário
   */
  async unregisterAllDevices(userId) {
    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }

      await usuario.update({ push_subscription: null });
      console.log(`🗑️ Todos os dispositivos removidos para usuário ${userId}`);
      
      return {
        success: true,
        message: 'Todos os dispositivos removidos com sucesso'
      };

    } catch (error) {
      console.error('❌ Erro ao remover todos os dispositivos:', error);
      throw error;
    }
  }

  /**
   * Obter lista de dispositivos de um usuário
   */
  async getDevices(userId) {
    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        throw new Error('Usuário não encontrado');
      }

      if (!usuario.push_subscription) {
        return { success: true, devices: [] };
      }

      let devices = [];
      try {
        const existingData = JSON.parse(usuario.push_subscription);
        if (Array.isArray(existingData)) {
          devices = existingData;
        } else if (existingData.endpoint) {
          devices = [existingData];
        }
      } catch (e) {
        console.warn('⚠️ Erro ao parsear push_subscription:', e);
        return { success: false, error: 'Erro ao processar dispositivos' };
      }

      // Retornar apenas informações públicas (sem keys)
      const publicDevices = devices.map(d => ({
        deviceId: d.deviceId,
        platform: d.platform,
        browser: d.browser,
        name: d.name,
        createdAt: d.createdAt,
        lastActive: d.lastActive,
        active: d.active
      }));

      return {
        success: true,
        devices: publicDevices,
        count: publicDevices.length
      };

    } catch (error) {
      console.error('❌ Erro ao obter dispositivos:', error);
      throw error;
    }
  }

  /**
   * Enviar notificação para todos os dispositivos de um usuário
   */
  async sendToUser(userId, notification, options = {}) {
    if (!this.vapidConfigured) {
      console.warn('⚠️ Push notifications não configuradas');
      return { success: false, error: 'Push notifications não configuradas' };
    }

    try {
      const usuario = await Usuario.findByPk(userId);
      if (!usuario) {
        return { success: false, error: 'Usuário não encontrado' };
      }

      if (!usuario.push_subscription) {
        return { success: false, error: 'Usuário não tem dispositivos registrados' };
      }

      let devices = [];
      try {
        const existingData = JSON.parse(usuario.push_subscription);
        if (Array.isArray(existingData)) {
          devices = existingData.filter(d => d.active !== false);
        } else if (existingData.endpoint) {
          devices = [existingData];
        }
      } catch (e) {
        console.warn('⚠️ Erro ao parsear push_subscription:', e);
        return { success: false, error: 'Erro ao processar dispositivos' };
      }

      if (devices.length === 0) {
        return { success: false, error: 'Nenhum dispositivo ativo encontrado' };
      }

      // Preparar payload
      const payload = this.preparePayload(notification);

      // Enviar para todos os dispositivos com timeout
      const sendPromises = devices.map(device => 
        Promise.race([
          this.sendToDevice(device, payload),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout ao enviar notificação')), 10000)
          )
        ]).catch(error => {
          console.error(`❌ Timeout ou erro ao enviar para dispositivo ${device.deviceId}:`, error.message);
          return { success: false, error: error.message };
        })
      );

      const results = await Promise.allSettled(sendPromises);

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

      // Remover dispositivos inválidos
      const invalidDevices = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.invalid) {
          invalidDevices.push(devices[index].deviceId);
        }
      });

      if (invalidDevices.length > 0) {
        console.log(`🗑️ Removendo ${invalidDevices.length} dispositivo(s) inválido(s)...`);
        await this.removeInvalidDevices(userId, invalidDevices);
      }

      // Log detalhado
      if (successful > 0) {
        console.log(`✅ ${successful}/${devices.length} notificação(ões) enviada(s) com sucesso`);
      }
      if (failed > 0) {
        console.warn(`⚠️ ${failed}/${devices.length} notificação(ões) falharam`);
      }

      return {
        success: successful > 0,
        sent: successful,
        failed: failed,
        total: devices.length,
        invalidDevices: invalidDevices.length
      };

    } catch (error) {
      console.error(`❌ Erro ao enviar notificação para usuário ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar notificação para um dispositivo específico
   * Com retry logic e melhor tratamento de erros
   */
  async sendToDevice(device, payload, retryCount = 0) {
    const maxRetries = 2;
    
    try {
      const subscription = {
        endpoint: device.endpoint,
        keys: device.keys
      };

      await webpush.sendNotification(subscription, payload);
      
      // Atualizar lastActive
      await this.updateDeviceLastActive(device.deviceId, device.endpoint);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error.message || 'Erro desconhecido';
      const errorCode = error.code || error.statusCode;
      
      // Erros de rede (DNS, timeout, etc.) - tentar novamente
      if ((errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT' || errorCode === 'ECONNREFUSED') && retryCount < maxRetries) {
        console.warn(`⚠️ Erro de rede ao enviar para dispositivo ${device.deviceId}. Tentativa ${retryCount + 1}/${maxRetries + 1}...`);
        
        // Aguardar antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        
        return this.sendToDevice(device, payload, retryCount + 1);
      }
      
      // Erros de subscription inválida/expirada
      if (error.statusCode === 410 || error.statusCode === 404 || error.statusCode === 403) {
        console.error(`❌ Subscription inválida para dispositivo ${device.deviceId} (status ${error.statusCode})`);
        return { success: false, invalid: true, error: errorMessage };
      }
      
      // Outros erros
      console.error(`❌ Erro ao enviar para dispositivo ${device.deviceId}:`, errorMessage);
      if (errorCode) {
        console.error(`   Código do erro: ${errorCode}`);
      }
      
      return { success: false, error: errorMessage, errorCode: errorCode };
    }
  }

  /**
   * Preparar payload da notificação
   */
  preparePayload(notification) {
    return JSON.stringify({
      title: notification.title || 'RatixPay',
      body: notification.body || notification.message || 'Nova notificação',
      icon: notification.icon || '/assets/images/icons/icon-192x192.png',
      badge: notification.badge || '/assets/images/icons/icon-48x48.png',
      tag: notification.tag || 'ratixpay-notification',
      requireInteraction: notification.requireInteraction !== undefined ? notification.requireInteraction : false,
      silent: notification.silent !== undefined ? notification.silent : false,
      sound: notification.sound || '/assets/sounds/alert.mp3',
      vibrate: notification.vibrate || [200, 100, 200, 100, 200],
      timestamp: notification.data?.timestamp || Date.now(),
      data: {
        url: notification.url || '/gestao-vendas.html',
        ...notification.data,
        timestamp: notification.data?.timestamp || new Date().toISOString()
      },
      actions: notification.actions || [
        {
          action: 'open',
          title: 'Ver Detalhes',
          icon: '/assets/images/icons/icon-48x48.png'
        },
        {
          action: 'close',
          title: 'Fechar'
        }
      ]
    });
  }

  /**
   * Remover dispositivos inválidos
   */
  async removeInvalidDevices(userId, deviceIds) {
    try {
      for (const deviceId of deviceIds) {
        await this.unregisterDevice(userId, deviceId);
      }
    } catch (error) {
      console.error('❌ Erro ao remover dispositivos inválidos:', error);
    }
  }

  /**
   * Atualizar lastActive de um dispositivo
   */
  async updateDeviceLastActive(deviceId, endpoint) {
    try {
      // Buscar usuário que tem este dispositivo
      const usuarios = await Usuario.findAll({
        where: {
          push_subscription: {
            [Sequelize.Op.like]: `%${endpoint}%`
          }
        }
      });

      for (const usuario of usuarios) {
        if (!usuario.push_subscription) continue;

        try {
          let devices = JSON.parse(usuario.push_subscription);
          if (!Array.isArray(devices)) {
            if (devices.endpoint) {
              devices = [devices];
            } else {
              continue;
            }
          }

          const deviceIndex = devices.findIndex(d => d.deviceId === deviceId || d.endpoint === endpoint);
          if (deviceIndex >= 0) {
            devices[deviceIndex].lastActive = new Date().toISOString();
            await usuario.update({
              push_subscription: JSON.stringify(devices)
            });
          }
        } catch (e) {
          console.warn('⚠️ Erro ao atualizar lastActive:', e);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar lastActive:', error);
    }
  }

  /**
   * Gerar ID único para dispositivo
   */
  generateDeviceId(subscription) {
    // Usar hash do endpoint como base
    const endpoint = subscription.endpoint || '';
    const hash = endpoint.split('/').pop() || Math.random().toString(36).substring(2, 15);
    return `device_${hash.substring(0, 16)}_${Date.now().toString(36)}`;
  }

  /**
   * Verificar se push notifications estão configuradas
   */
  isConfigured() {
    return this.vapidConfigured;
  }

  /**
   * Obter chave pública VAPID
   */
  getPublicKey() {
    return VAPID_PUBLIC_KEY;
  }
}

module.exports = new PushNotificationService();

