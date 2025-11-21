/**
 * Serviço de Socket.IO para notificações em tempo real
 */

class SocketService {
    constructor() {
        this.io = null;
    }

    /**
     * Inicializar o serviço com a instância do Socket.IO
     */
    initialize(io) {
        this.io = io;
        console.log('🔌 SocketService inicializado');
    }

    /**
     * Enviar notificação para um usuário específico
     */
    sendToUser(userId, event, data) {
        if (!this.io) {
            console.warn('⚠️ SocketService não inicializado');
            return false;
        }

        try {
            this.io.to(`user_${userId}`).emit(event, data);
            console.log(`📤 Notificação enviada para usuário ${userId}:`, event);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
            return false;
        }
    }

    /**
     * Enviar notificação para administradores
     */
    sendToAdmins(event, data) {
        if (!this.io) {
            console.warn('⚠️ SocketService não inicializado');
            return false;
        }

        try {
            this.io.to('admins').emit(event, data);
            console.log('📤 Notificação enviada para administradores:', event);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação para admins:', error);
            return false;
        }
    }

    /**
     * Enviar notificação para vendedores
     */
    sendToVendedores(event, data) {
        if (!this.io) {
            console.warn('⚠️ SocketService não inicializado');
            return false;
        }

        try {
            this.io.to('vendedores').emit(event, data);
            console.log('📤 Notificação enviada para vendedores:', event);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação para vendedores:', error);
            return false;
        }
    }

    /**
     * Enviar notificação para todos os usuários conectados
     */
    sendToAll(event, data) {
        if (!this.io) {
            console.warn('⚠️ SocketService não inicializado');
            return false;
        }

        try {
            this.io.emit(event, data);
            console.log('📤 Notificação enviada para todos:', event);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar notificação para todos:', error);
            return false;
        }
    }

    /**
     * Enviar notificação de nova venda
     */
    sendNovaVenda(vendaData) {
        const notification = {
            type: 'nova_venda',
            title: 'Nova Venda Realizada!',
            message: `Venda de ${vendaData.produto_nome} por ${vendaData.valor}`,
            data: vendaData,
            timestamp: new Date().toISOString()
        };

        // Enviar para vendedor específico
        this.sendToUser(vendaData.vendedor_id, 'nova_venda', notification);
        
        // Enviar para administradores
        this.sendToAdmins('nova_venda_admin', notification);
    }

    /**
     * Enviar notificação de saque aprovado
     */
    sendSaqueAprovado(saqueData) {
        const notification = {
            type: 'saque_aprovado',
            title: 'Saque Aprovado!',
            message: `Seu saque de ${saqueData.valor} foi aprovado`,
            data: saqueData,
            timestamp: new Date().toISOString()
        };

        // Enviar para vendedor específico
        this.sendToUser(saqueData.vendedor_id, 'saque_aprovado', notification);
        
        // Também enviar para a sala de saques (para atualização em tempo real)
        if (this.io) {
            try {
                this.io.to('saques').emit('saque_aprovado', {
                    ...saqueData,
                    ...notification
                });
                console.log('📤 Notificação de saque enviada para sala de saques');
            } catch (error) {
                console.error('❌ Erro ao enviar para sala de saques:', error);
            }
        }
    }
    
    /**
     * Enviar atualização de status de saque
     */
    sendSaqueStatusAtualizado(saqueData) {
        if (!this.io) {
            console.warn('⚠️ SocketService não inicializado');
            return false;
        }

        try {
            // Enviar para vendedor específico
            this.sendToUser(saqueData.vendedor_id, 'saque_status_atualizado', saqueData);
            
            // Enviar para sala de saques
            this.io.to('saques').emit('saque_status_atualizado', saqueData);
            
            console.log('📤 Status de saque atualizado enviado:', saqueData.saque_id);
            return true;
        } catch (error) {
            console.error('❌ Erro ao enviar atualização de status:', error);
            return false;
        }
    }

    /**
     * Enviar notificação de saque pendente para admins
     */
    sendSaquePendente(saqueData) {
        const notification = {
            type: 'saque_pendente',
            title: 'Novo Saque Pendente',
            message: `Saque de ${saqueData.valor} solicitado por ${saqueData.vendedor_nome}`,
            data: saqueData,
            timestamp: new Date().toISOString()
        };

        // Enviar para administradores
        this.sendToAdmins('saque_pendente', notification);
    }

    /**
     * Enviar notificação de sistema
     */
    sendSistemaNotification(title, message, type = 'info') {
        const notification = {
            type: 'sistema',
            title: title,
            message: message,
            notificationType: type,
            timestamp: new Date().toISOString()
        };

        // Enviar para todos os usuários conectados
        this.sendToAll('sistema_notification', notification);
    }
}

module.exports = new SocketService();
