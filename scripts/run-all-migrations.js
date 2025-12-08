#!/usr/bin/env node

/**
 * Script Node.js para Executar Todas as Migrações
 * 
 * USO:
 *   node scripts/run-all-migrations.js
 * 
 * Ou com variáveis de ambiente:
 *   DB_NAME=ratixpay DB_USER=postgres node scripts/run-all-migrations.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cores para console
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Configurações
const config = {
    dbUser: process.env.DB_USER || 'postgres',
    dbName: process.env.DB_NAME || 'ratixpay',
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT || '5432',
    migrationsDir: path.join(__dirname, '..', 'migrations')
};

// Migrações na ordem correta
const migrations = [
    {
        file: 'migrate-all-systems-unified.sql',
        description: 'Sistema Unificado (Blog + Remarketing + Afiliados)'
    },
    {
        file: 'update-domain-ratixpay-com-to-site.sql',
        description: 'Atualizar ratixpay.com → ratixpay.site'
    },
    {
        file: 'update-products-images-files.sql',
        description: 'Atualizar produtos, imagens e arquivos'
    }
];

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function runMigration(migration) {
    const filePath = path.join(config.migrationsDir, migration.file);
    
    if (!fs.existsSync(filePath)) {
        log(`❌ Arquivo não encontrado: ${filePath}`, 'red');
        return false;
    }
    
    log(`📦 Executando: ${migration.description}`, 'yellow');
    log(`   Arquivo: ${migration.file}`, 'yellow');
    
    try {
        const command = `psql -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -d ${config.dbName} -f "${filePath}"`;
        
        execSync(command, {
            stdio: 'inherit',
            env: { ...process.env, PGPASSWORD: process.env.DB_PASS || '' }
        });
        
        log(`   ✅ Sucesso!`, 'green');
        return true;
    } catch (error) {
        log(`   ❌ Erro ao executar migração`, 'red');
        log(`   ${error.message}`, 'red');
        return false;
    }
}

function createBackup() {
    log(`📦 Fazendo backup do banco de dados...`, 'yellow');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup_${config.dbName}_${timestamp}.sql`;
    
    try {
        const command = `pg_dump -h ${config.dbHost} -p ${config.dbPort} -U ${config.dbUser} -d ${config.dbName} > "${backupFile}"`;
        
        execSync(command, {
            stdio: 'inherit',
            env: { ...process.env, PGPASSWORD: process.env.DB_PASS || '' }
        });
        
        log(`✅ Backup criado: ${backupFile}`, 'green');
        return backupFile;
    } catch (error) {
        log(`⚠️  Aviso: Não foi possível criar backup. Continuando...`, 'yellow');
        return null;
    }
}

// Função principal
async function main() {
    log('========================================', 'green');
    log('🚀 Iniciando Migrações do RatixPay', 'green');
    log('========================================', 'green');
    console.log('');
    log('📊 Configurações:', 'blue');
    log(`   Database: ${config.dbName}`, 'blue');
    log(`   User: ${config.dbUser}`, 'blue');
    log(`   Host: ${config.dbHost}:${config.dbPort}`, 'blue');
    console.log('');
    
    // Confirmar execução
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
        readline.question('⚠️  Este script irá modificar o banco de dados! Deseja continuar? (s/N): ', resolve);
    });
    readline.close();
    
    if (!/^[sSyY]/.test(answer)) {
        log('Operação cancelada.', 'yellow');
        process.exit(0);
    }
    
    // Fazer backup
    console.log('');
    const backupFile = createBackup();
    console.log('');
    
    // Executar migrações
    let successCount = 0;
    
    for (let i = 0; i < migrations.length; i++) {
        const migration = migrations[i];
        
        log(`========================================`, 'green');
        log(`PASSO ${i + 1}: ${migration.description}`, 'green');
        log(`========================================`, 'green');
        
        if (runMigration(migration)) {
            successCount++;
        } else {
            log(`❌ Falha na migração: ${migration.file}`, 'red');
            log(`   Verifique os erros acima e tente novamente.`, 'red');
            process.exit(1);
        }
        
        console.log('');
    }
    
    // Relatório final
    log('========================================', 'green');
    log('✅ Todas as Migrações Concluídas!', 'green');
    log('========================================', 'green');
    console.log('');
    
    if (backupFile) {
        log(`📊 Backup salvo em: ${backupFile}`, 'blue');
        console.log('');
    }
    
    log('🔍 Para verificar as migrações:', 'blue');
    log(`   psql -U ${config.dbUser} -d ${config.dbName} -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('blog_posts', 'remarketing_queue', 'afiliados') ORDER BY table_name;"`, 'blue');
    console.log('');
}

// Executar
main().catch(error => {
    log(`❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
});

