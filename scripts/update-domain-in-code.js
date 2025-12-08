#!/usr/bin/env node

/**
 * Script para Atualizar Domínio no Código
 * ratixpay.com → ratixpay.site
 * 
 * Preserva emails como sistema@ratixpay.com e suporte@ratixpay.com
 * 
 * USO:
 *   node scripts/update-domain-in-code.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Extensões de arquivo para processar
const fileExtensions = ['.js', '.html', '.json', '.md', '.sql'];

// Padrões a serem substituídos (preservando emails)
const patterns = [
    // URLs completas
    { from: /https?:\/\/ratixpay\.com\//g, to: 'https://ratixpay.site/' },
    { from: /https?:\/\/ratixpay\.com/g, to: 'https://ratixpay.site' },
    
    // Domínios sem protocolo (em strings)
    { from: /['"`]ratixpay\.com/g, to: (match) => match.replace('ratixpay.com', 'ratixpay.site') },
    
    // Variáveis de ambiente e configurações
    { from: /BASE_URL.*ratixpay\.com/g, to: (match) => match.replace('ratixpay.com', 'ratixpay.site') },
    { from: /FRONTEND_URL.*ratixpay\.com/g, to: (match) => match.replace('ratixpay.com', 'ratixpay.site') },
];

// Diretórios para ignorar
const ignoreDirs = ['node_modules', '.git', 'dist', 'build', 'temp', 'uploads', 'qr-codes'];

// Arquivos para ignorar
const ignoreFiles = ['package-lock.json', 'package.json'];

function shouldProcessFile(filePath) {
    const ext = path.extname(filePath);
    if (!fileExtensions.includes(ext)) {
        return false;
    }
    
    const fileName = path.basename(filePath);
    if (ignoreFiles.includes(fileName)) {
        return false;
    }
    
    const relativePath = path.relative(process.cwd(), filePath);
    for (const dir of ignoreDirs) {
        if (relativePath.includes(dir)) {
            return false;
        }
    }
    
    return true;
}

function updateFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        let originalContent = content;
        
        // Substituir padrões
        for (const pattern of patterns) {
            if (typeof pattern.to === 'function') {
                const newContent = content.replace(pattern.from, pattern.to);
                if (newContent !== content) {
                    content = newContent;
                    modified = true;
                }
            } else {
                const newContent = content.replace(pattern.from, pattern.to);
                if (newContent !== content) {
                    content = newContent;
                    modified = true;
                }
            }
        }
        
        // Preservar emails (garantir que não sejam alterados)
        content = content.replace(/ratixpay\.site\.com/g, 'ratixpay.com'); // Correção se acontecer
        
        if (modified && content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
        
        return false;
    } catch (error) {
        log(`   ❌ Erro ao processar: ${error.message}`, 'red');
        return false;
    }
}

function walkDirectory(dir, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            const relativePath = path.relative(process.cwd(), filePath);
            if (!ignoreDirs.some(dir => relativePath.includes(dir))) {
                walkDirectory(filePath, callback);
            }
        } else if (stat.isFile()) {
            if (shouldProcessFile(filePath)) {
                callback(filePath);
            }
        }
    }
}

async function main() {
    log('========================================', 'green');
    log('🔄 Atualização de Domínio no Código', 'green');
    log('========================================', 'green');
    console.log('');
    log('📋 Substituindo: ratixpay.com → ratixpay.site', 'blue');
    log('📧 Preservando: emails como sistema@ratixpay.com', 'blue');
    console.log('');
    
    const rootDir = process.cwd();
    const updatedFiles = [];
    
    log('🔍 Procurando arquivos...', 'yellow');
    
    // Processar diretórios específicos
    const targetDirs = ['routes', 'services', 'public', 'config', 'migrations'];
    
    for (const dir of targetDirs) {
        const dirPath = path.join(rootDir, dir);
        if (fs.existsSync(dirPath)) {
            log(`📁 Processando: ${dir}/`, 'yellow');
            walkDirectory(dirPath, (filePath) => {
                if (updateFile(filePath)) {
                    updatedFiles.push(path.relative(rootDir, filePath));
                    log(`   ✅ ${path.relative(rootDir, filePath)}`, 'green');
                }
            });
        }
    }
    
    console.log('');
    log('========================================', 'green');
    log('✅ Atualização Concluída!', 'green');
    log('========================================', 'green');
    console.log('');
    log(`📊 Total de arquivos atualizados: ${updatedFiles.length}`, 'blue');
    console.log('');
    
    if (updatedFiles.length > 0) {
        log('📝 Arquivos modificados:', 'blue');
        updatedFiles.slice(0, 10).forEach(file => {
            log(`   • ${file}`, 'blue');
        });
        if (updatedFiles.length > 10) {
            log(`   ... e mais ${updatedFiles.length - 10} arquivos`, 'blue');
        }
    }
    
    console.log('');
    log('💡 Próximos passos:', 'yellow');
    log('   1. Revise as alterações: git diff', 'yellow');
    log('   2. Faça commit: git add . && git commit -m "Atualizar domínio para ratixpay.site"', 'yellow');
    log('   3. Execute as migrações do banco de dados', 'yellow');
    console.log('');
}

main().catch(error => {
    log(`❌ Erro fatal: ${error.message}`, 'red');
    process.exit(1);
});

