/**
 * 📋 SISTEMA DE LOGS MODULAR - RATIXPAY
 * 
 * Sistema organizado de logs separados por categoria:
 * - Login
 * - Pagamentos
 * - Vendas
 * - Gestão de Produtos
 * - Saques
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

class ModularLogger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
        
        // Formato padrão para arquivos
        this.fileFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }),
            winston.format.json()
        );
        
        // Formato para console (mais limpo)
        this.consoleFormat = winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let log = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                    log += ` ${JSON.stringify(meta)}`;
                }
                return log;
            })
        );
        
        // Criar loggers específicos
        this.createLoggers();
    }
    
    // Garantir que o diretório de logs existe
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    // Criar logger específico para uma categoria
    createCategoryLogger(categoryName, filename) {
        const transports = [
            // Arquivo específico da categoria
            new winston.transports.File({
                filename: path.join(this.logDir, filename),
                format: this.fileFormat,
                maxsize: 10 * 1024 * 1024, // 10MB
                maxFiles: 10
            })
        ];
        
        // Adicionar console apenas em desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
            transports.push(
                new winston.transports.Console({
                    format: this.consoleFormat,
                    level: 'info'
                })
            );
        }
        
        return winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: this.fileFormat,
            transports: transports,
            defaultMeta: { category: categoryName },
            exitOnError: false
        });
    }
    
    // Criar todos os loggers
    createLoggers() {
        // Logger de Login
        this.loginLogger = this.createCategoryLogger('LOGIN', 'login.log');
        
        // Logger de Pagamentos
        this.paymentLogger = this.createCategoryLogger('PAGAMENTO', 'pagamentos.log');
        
        // Logger de Vendas
        this.saleLogger = this.createCategoryLogger('VENDA', 'vendas.log');
        
        // Logger de Gestão de Produtos
        this.productLogger = this.createCategoryLogger('PRODUTO', 'produtos.log');
        
        // Logger de Saques
        this.withdrawalLogger = this.createCategoryLogger('SAQUE', 'saques.log');
        
        // Logger geral de erros (para erros críticos)
        this.errorLogger = winston.createLogger({
            level: 'error',
            format: this.fileFormat,
            transports: [
                new winston.transports.File({
                    filename: path.join(this.logDir, 'error.log'),
                    format: this.fileFormat,
                    maxsize: 10 * 1024 * 1024,
                    maxFiles: 10
                })
            ],
            exitOnError: false
        });
    }
    
    // ============================================
    // LOGS DE LOGIN
    // ============================================
    
    loginInfo(message, meta = {}) {
        this.loginLogger.info(`🔐 ${message}`, {
            ...meta,
            type: 'LOGIN',
            action: 'INFO'
        });
    }
    
    loginSuccess(userId, email, ip, meta = {}) {
        this.loginLogger.info('✅ Login realizado com sucesso', {
            ...meta,
            type: 'LOGIN',
            action: 'SUCCESS',
            userId,
            email,
            ip,
            timestamp: new Date().toISOString()
        });
    }
    
    loginFailure(email, reason, ip, meta = {}) {
        this.loginLogger.warn('❌ Tentativa de login falhou', {
            ...meta,
            type: 'LOGIN',
            action: 'FAILURE',
            email,
            reason,
            ip,
            timestamp: new Date().toISOString()
        });
    }
    
    loginError(error, meta = {}) {
        this.loginLogger.error('❌ Erro no processo de login', {
            ...meta,
            type: 'LOGIN',
            action: 'ERROR',
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
        
        // Também registrar no log de erros
        this.errorLogger.error('Login Error', {
            ...meta,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
    
    logout(userId, email, meta = {}) {
        this.loginLogger.info('🚪 Logout realizado', {
            ...meta,
            type: 'LOGIN',
            action: 'LOGOUT',
            userId,
            email,
            timestamp: new Date().toISOString()
        });
    }
    
    // ============================================
    // LOGS DE PAGAMENTOS
    // ============================================
    
    paymentInfo(message, meta = {}) {
        this.paymentLogger.info(`💳 ${message}`, {
            ...meta,
            type: 'PAGAMENTO',
            action: 'INFO'
        });
    }
    
    paymentInitiated(transactionId, amount, method, customerEmail, meta = {}) {
        this.paymentLogger.info('🔄 Pagamento iniciado', {
            ...meta,
            type: 'PAGAMENTO',
            action: 'INITIATED',
            transactionId,
            amount,
            method,
            customerEmail,
            timestamp: new Date().toISOString()
        });
    }
    
    paymentSuccess(transactionId, amount, method, customerEmail, meta = {}) {
        this.paymentLogger.info('✅ Pagamento aprovado', {
            ...meta,
            type: 'PAGAMENTO',
            action: 'SUCCESS',
            transactionId,
            amount,
            method,
            customerEmail,
            timestamp: new Date().toISOString()
        });
    }
    
    paymentFailure(transactionId, amount, method, reason, meta = {}) {
        this.paymentLogger.warn('❌ Pagamento falhou', {
            ...meta,
            type: 'PAGAMENTO',
            action: 'FAILURE',
            transactionId,
            amount,
            method,
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    paymentError(error, transactionId = null, meta = {}) {
        this.paymentLogger.error('❌ Erro no processamento de pagamento', {
            ...meta,
            type: 'PAGAMENTO',
            action: 'ERROR',
            transactionId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
        
        // Também registrar no log de erros
        this.errorLogger.error('Payment Error', {
            ...meta,
            transactionId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
    
    paymentWebhook(transactionId, status, provider, meta = {}) {
        this.paymentLogger.info('📥 Webhook de pagamento recebido', {
            ...meta,
            type: 'PAGAMENTO',
            action: 'WEBHOOK',
            transactionId,
            status,
            provider,
            timestamp: new Date().toISOString()
        });
    }
    
    // ============================================
    // LOGS DE VENDAS
    // ============================================
    
    saleInfo(message, meta = {}) {
        this.saleLogger.info(`💰 ${message}`, {
            ...meta,
            type: 'VENDA',
            action: 'INFO'
        });
    }
    
    saleCreated(saleId, productId, customerId, amount, meta = {}) {
        this.saleLogger.info('🆕 Venda criada', {
            ...meta,
            type: 'VENDA',
            action: 'CREATED',
            saleId,
            productId,
            customerId,
            amount,
            timestamp: new Date().toISOString()
        });
    }
    
    saleCompleted(saleId, productId, customerId, amount, meta = {}) {
        this.saleLogger.info('✅ Venda concluída', {
            ...meta,
            type: 'VENDA',
            action: 'COMPLETED',
            saleId,
            productId,
            customerId,
            amount,
            timestamp: new Date().toISOString()
        });
    }
    
    saleCancelled(saleId, reason, meta = {}) {
        this.saleLogger.warn('🚫 Venda cancelada', {
            ...meta,
            type: 'VENDA',
            action: 'CANCELLED',
            saleId,
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    saleError(error, saleId = null, meta = {}) {
        this.saleLogger.error('❌ Erro na venda', {
            ...meta,
            type: 'VENDA',
            action: 'ERROR',
            saleId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
        
        // Também registrar no log de erros
        this.errorLogger.error('Sale Error', {
            ...meta,
            saleId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
    
    // ============================================
    // LOGS DE GESTÃO DE PRODUTOS
    // ============================================
    
    productInfo(message, meta = {}) {
        this.productLogger.info(`📦 ${message}`, {
            ...meta,
            type: 'PRODUTO',
            action: 'INFO'
        });
    }
    
    productCreated(productId, productName, userId, meta = {}) {
        this.productLogger.info('➕ Produto criado', {
            ...meta,
            type: 'PRODUTO',
            action: 'CREATED',
            productId,
            productName,
            userId,
            timestamp: new Date().toISOString()
        });
    }
    
    productUpdated(productId, productName, userId, changes, meta = {}) {
        this.productLogger.info('✏️ Produto atualizado', {
            ...meta,
            type: 'PRODUTO',
            action: 'UPDATED',
            productId,
            productName,
            userId,
            changes,
            timestamp: new Date().toISOString()
        });
    }
    
    productDeleted(productId, productName, userId, meta = {}) {
        this.productLogger.warn('🗑️ Produto deletado', {
            ...meta,
            type: 'PRODUTO',
            action: 'DELETED',
            productId,
            productName,
            userId,
            timestamp: new Date().toISOString()
        });
    }
    
    productError(error, productId = null, meta = {}) {
        this.productLogger.error('❌ Erro na gestão de produto', {
            ...meta,
            type: 'PRODUTO',
            action: 'ERROR',
            productId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
        
        // Também registrar no log de erros
        this.errorLogger.error('Product Error', {
            ...meta,
            productId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
    
    // ============================================
    // LOGS DE SAQUES
    // ============================================
    
    withdrawalInfo(message, meta = {}) {
        this.withdrawalLogger.info(`💸 ${message}`, {
            ...meta,
            type: 'SAQUE',
            action: 'INFO'
        });
    }
    
    withdrawalRequested(withdrawalId, userId, amount, method, meta = {}) {
        this.withdrawalLogger.info('📤 Saque solicitado', {
            ...meta,
            type: 'SAQUE',
            action: 'REQUESTED',
            withdrawalId,
            userId,
            amount,
            method,
            timestamp: new Date().toISOString()
        });
    }
    
    withdrawalApproved(withdrawalId, userId, amount, meta = {}) {
        this.withdrawalLogger.info('✅ Saque aprovado', {
            ...meta,
            type: 'SAQUE',
            action: 'APPROVED',
            withdrawalId,
            userId,
            amount,
            timestamp: new Date().toISOString()
        });
    }
    
    withdrawalRejected(withdrawalId, userId, amount, reason, meta = {}) {
        this.withdrawalLogger.warn('❌ Saque rejeitado', {
            ...meta,
            type: 'SAQUE',
            action: 'REJECTED',
            withdrawalId,
            userId,
            amount,
            reason,
            timestamp: new Date().toISOString()
        });
    }
    
    withdrawalCompleted(withdrawalId, userId, amount, transactionId, meta = {}) {
        this.withdrawalLogger.info('✅ Saque concluído', {
            ...meta,
            type: 'SAQUE',
            action: 'COMPLETED',
            withdrawalId,
            userId,
            amount,
            transactionId,
            timestamp: new Date().toISOString()
        });
    }
    
    withdrawalError(error, withdrawalId = null, meta = {}) {
        this.withdrawalLogger.error('❌ Erro no saque', {
            ...meta,
            type: 'SAQUE',
            action: 'ERROR',
            withdrawalId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            },
            timestamp: new Date().toISOString()
        });
        
        // Também registrar no log de erros
        this.errorLogger.error('Withdrawal Error', {
            ...meta,
            withdrawalId,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }
}

// Instância singleton
const modularLogger = new ModularLogger();

module.exports = modularLogger;

