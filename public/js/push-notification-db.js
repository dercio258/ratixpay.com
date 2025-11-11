/**
 * IndexedDB Manager para Push Notifications
 * Gerencia cache offline de notificações usando IndexedDB
 */

class PushNotificationDB {
  constructor() {
    this.dbName = 'RatixPayPushDB';
    this.dbVersion = 1;
    this.storeName = 'notifications';
    this.db = null;
  }

  /**
   * Inicializar banco de dados
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ Erro ao abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB aberto com sucesso');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Criar object store se não existir
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Criar índices
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('read', 'read', { unique: false });
          objectStore.createIndex('tag', 'tag', { unique: false });
          objectStore.createIndex('userId', 'userId', { unique: false });

          console.log('✅ Object store criado:', this.storeName);
        }
      };
    });
  }

  /**
   * Salvar notificação no IndexedDB
   */
  async saveNotification(notification) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const notificationData = {
        id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: notification.title,
        body: notification.body,
        icon: notification.icon,
        badge: notification.badge,
        tag: notification.tag,
        url: notification.url || notification.data?.url,
        data: notification.data || {},
        timestamp: notification.timestamp || Date.now(),
        read: false,
        userId: notification.userId || null,
        createdAt: new Date().toISOString()
      };

      const request = store.add(notificationData);

      request.onsuccess = () => {
        console.log('✅ Notificação salva no IndexedDB:', notificationData.id);
        resolve(notificationData);
      };

      request.onerror = () => {
        console.error('❌ Erro ao salvar notificação:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obter notificações (com filtros opcionais)
   */
  async getNotifications(options = {}) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const request = index.openCursor(null, 'prev'); // Ordem decrescente (mais recentes primeiro)
      const notifications = [];
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      let count = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && notifications.length < limit) {
          const notification = cursor.value;

          // Aplicar filtros
          if (options.read !== undefined && notification.read !== options.read) {
            cursor.continue();
            return;
          }

          if (options.tag && notification.tag !== options.tag) {
            cursor.continue();
            return;
          }

          if (options.userId && notification.userId !== options.userId) {
            cursor.continue();
            return;
          }

          if (count >= offset) {
            notifications.push(notification);
          }

          count++;
          cursor.continue();
        } else {
          resolve(notifications);
        }
      };

      request.onerror = () => {
        console.error('❌ Erro ao obter notificações:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(notificationId) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(notificationId);

      request.onsuccess = () => {
        const notification = request.result;
        if (notification) {
          notification.read = true;
          notification.readAt = new Date().toISOString();

          const updateRequest = store.put(notification);
          updateRequest.onsuccess = () => {
            console.log('✅ Notificação marcada como lida:', notificationId);
            resolve(notification);
          };
          updateRequest.onerror = () => {
            reject(updateRequest.error);
          };
        } else {
          reject(new Error('Notificação não encontrada'));
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Marcar todas as notificações como lidas
   */
  async markAllAsRead() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('read');
      const request = index.openCursor(IDBKeyRange.only(false));

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.value.read = true;
          cursor.value.readAt = new Date().toISOString();
          cursor.update(cursor.value);
          cursor.continue();
        } else {
          console.log('✅ Todas as notificações marcadas como lidas');
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Deletar notificação
   */
  async deleteNotification(notificationId) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(notificationId);

      request.onsuccess = () => {
        console.log('✅ Notificação deletada:', notificationId);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Deletar notificações antigas (mais de X dias)
   */
  async deleteOldNotifications(days = 30) {
    if (!this.db) {
      await this.init();
    }

    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor();

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.timestamp < cutoffDate) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          console.log(`✅ ${deletedCount} notificações antigas deletadas`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Contar notificações não lidas
   */
  async getUnreadCount() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('read');
      const request = index.count(IDBKeyRange.only(false));

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Limpar todas as notificações
   */
  async clearAll() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ Todas as notificações deletadas');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Exportar para uso no Service Worker e no frontend
if (typeof self !== 'undefined') {
  // Service Worker context
  self.pushNotificationDB = new PushNotificationDB();
} else if (typeof window !== 'undefined') {
  // Browser context
  window.pushNotificationDB = new PushNotificationDB();
}

