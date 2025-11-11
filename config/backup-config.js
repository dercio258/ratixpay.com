/**
 * Configurações de Backup RatixPay
 * Centraliza todas as configurações relacionadas ao backup
 */

module.exports = {
    // Configurações do banco de dados
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'ratixpay_local',
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres'
    },

    // Configurações de backup
    backup: {
        // Diretório onde os backups serão salvos
        directory: process.env.BACKUP_DIR || './backups',
        
        // Número máximo de backups a manter (padrão: 7 dias)
        maxBackups: parseInt(process.env.MAX_BACKUPS) || 7,
        
        // Formato do nome do arquivo
        fileNameFormat: 'ratixpay_backup_{timestamp}.sql',
        
        // Configurações do pg_dump
        pgDump: {
            // Caminho para o executável pg_dump
            path: process.env.PG_DUMP_PATH || 'pg_dump',
            
            // Opções do pg_dump
            options: [
                '--verbose',
                '--clean',
                '--create',
                '--if-exists',
                '--no-password'
            ]
        }
    },

    // Configurações de restore
    restore: {
        // Caminho para o executável psql
        psqlPath: process.env.PSQL_PATH || 'psql',
        
        // Opções do psql
        options: [
            '--verbose'
        ]
    },

    // Configurações de log
    logging: {
        // Diretório de logs
        directory: process.env.LOG_DIR || './logs',
        
        // Arquivo de log de backup
        backupLogFile: 'backup.log',
        
        // Nível de log (DEBUG, INFO, WARN, ERROR)
        level: process.env.LOG_LEVEL || 'INFO'
    },

    // Configurações de notificação (futuro)
    notifications: {
        // Habilitar notificações por email
        email: process.env.BACKUP_EMAIL_NOTIFICATIONS === 'true',
        
        // Email para notificações
        emailTo: process.env.BACKUP_EMAIL_TO || 'admin@ratixpay.com',
        
        // Habilitar notificações por webhook
        webhook: process.env.BACKUP_WEBHOOK_NOTIFICATIONS === 'true',
        
        // URL do webhook
        webhookUrl: process.env.BACKUP_WEBHOOK_URL || ''
    },

    // Configurações de agendamento (futuro)
    scheduling: {
        // Habilitar backup automático
        enabled: process.env.AUTO_BACKUP_ENABLED === 'true',
        
        // Horário do backup (formato cron)
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 2:00 AM diariamente
        
        // Timezone
        timezone: process.env.BACKUP_TIMEZONE || 'America/Sao_Paulo'
    }
};
