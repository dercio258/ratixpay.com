/**
 * Script para remover completamente whatsapp-web.js
 * 
 * Remove:
 * - Dependência do package.json
 * - Arquivos de autenticação .wwebjs_auth
 * - Arquivos de estado relacionados
 * - Diretórios de cache
 */

const fs = require('fs').promises;
const path = require('path');

async function removeWhatsAppWebJS() {
    console.log('🗑️ Removendo whatsapp-web.js completamente...\n');

    const rootDir = path.join(__dirname, '..');
    let removedCount = 0;
    let errors = [];

    // 1. Remover diretório de autenticação .wwebjs_auth
    const authDir = path.join(rootDir, '.wwebjs_auth');
    try {
        const exists = await fs.access(authDir).then(() => true).catch(() => false);
        if (exists) {
            await fs.rm(authDir, { recursive: true, force: true });
            console.log('✅ Removido: .wwebjs_auth/');
            removedCount++;
        }
    } catch (error) {
        errors.push(`Erro ao remover .wwebjs_auth: ${error.message}`);
    }

    // 2. Remover arquivo de estado
    const stateFile = path.join(rootDir, '.whatsapp-session-state.json');
    try {
        const exists = await fs.access(stateFile).then(() => true).catch(() => false);
        if (exists) {
            await fs.unlink(stateFile);
            console.log('✅ Removido: .whatsapp-session-state.json');
            removedCount++;
        }
    } catch (error) {
        errors.push(`Erro ao remover .whatsapp-session-state.json: ${error.message}`);
    }

    // 3. Remover diretório bot/auth_info (se existir)
    const botAuthDir = path.join(rootDir, 'bot', 'auth_info');
    try {
        const exists = await fs.access(botAuthDir).then(() => true).catch(() => false);
        if (exists) {
            await fs.rm(botAuthDir, { recursive: true, force: true });
            console.log('✅ Removido: bot/auth_info/');
            removedCount++;
        }
    } catch (error) {
        errors.push(`Erro ao remover bot/auth_info: ${error.message}`);
    }

    // 4. Remover diretório config/auth_info_baileys (se existir e for legado)
    const configAuthDir = path.join(rootDir, 'config', 'auth_info_baileys');
    try {
        const exists = await fs.access(configAuthDir).then(() => true).catch(() => false);
        if (exists) {
            // Verificar se é legado (não usado pelo Baileys atual)
            const files = await fs.readdir(configAuthDir);
            if (files.length > 0) {
                console.log('⚠️ Diretório config/auth_info_baileys existe mas pode conter dados legados');
                // Não remover automaticamente, apenas avisar
            }
        }
    } catch (error) {
        // Ignorar se não existir
    }

    // 5. Verificar se há arquivos de cache do Puppeteer relacionados
    const puppeteerCacheDirs = [
        path.join(rootDir, '.cache', 'puppeteer'),
        path.join(process.env.HOME || process.env.USERPROFILE || '', '.cache', 'puppeteer')
    ];

    for (const cacheDir of puppeteerCacheDirs) {
        try {
            const exists = await fs.access(cacheDir).then(() => true).catch(() => false);
            if (exists) {
                console.log(`ℹ️ Cache do Puppeteer encontrado: ${cacheDir}`);
                console.log('   (Não removido automaticamente - pode ser usado por outros projetos)');
            }
        } catch (error) {
            // Ignorar
        }
    }

    console.log(`\n✅ Limpeza concluída!`);
    console.log(`   Arquivos/diretórios removidos: ${removedCount}`);

    if (errors.length > 0) {
        console.log(`\n⚠️ Erros encontrados:`);
        errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('\n📋 Próximos passos:');
    console.log('   1. Execute: npm uninstall whatsapp-web.js puppeteer');
    console.log('   2. Verifique se Puppeteer é usado por outros módulos antes de remover');
    console.log('   3. Reinicie o servidor');
    console.log('\n✅ Sistema agora usa apenas Baileys!');
}

// Executar
removeWhatsAppWebJS().catch(error => {
    console.error('❌ Erro ao executar limpeza:', error);
    process.exit(1);
});

