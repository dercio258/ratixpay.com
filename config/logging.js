/**
 * 🔧 CONFIGURAÇÃO DE LOGS - SISTEMA RATIXPAY
 * 
 * Este arquivo controla o nível de verbosidade dos logs do sistema
 */

const winston = require('winston');

// Configuração de níveis de log
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Configuração de cores para console
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
};

winston.addColors(logColors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato para console (mais limpo)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Adicionar metadados apenas se existirem
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// Configuração do logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info', // Controlar nível via variável de ambiente
  format: logFormat,
  transports: [
    // Logs de erro para arquivo
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Logs gerais para arquivo
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Adicionar transporte para console apenas se não for produção
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: process.env.CONSOLE_LOG_LEVEL || 'info'
  }));
}

// Funções de log simplificadas
const log = {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  http: (message, meta = {}) => logger.http(message, meta),
  verbose: (message, meta = {}) => logger.verbose(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Logs específicos para operações comuns
  database: (message, meta = {}) => {
    if (process.env.LOG_DATABASE === 'true') {
      logger.verbose(`🗄️ ${message}`, meta);
    }
  },
  
  api: (message, meta = {}) => {
    if (process.env.LOG_API === 'true') {
      logger.http(`🌐 ${message}`, meta);
    }
  },
  
  upload: (message, meta = {}) => {
    logger.info(`📤 ${message}`, meta);
  },
  
  auth: (message, meta = {}) => {
    if (process.env.LOG_AUTH === 'true') {
      logger.verbose(`🔐 ${message}`, meta);
    }
  }
};

module.exports = { logger, log };
