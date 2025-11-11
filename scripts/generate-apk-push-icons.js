/**
 * Script para gerar ícones em múltiplos tamanhos a partir do icon_apk_pushNotificatio.png
 * Gera ícones especificamente para APK e Push Notifications
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const sourceIcon = path.join(__dirname, '..', 'public', 'assets', 'images', 'icons', 'icon_apk_pushNotificatio.png');
const iconsDir = path.join(__dirname, '..', 'public', 'assets', 'images', 'icons');

// Tamanhos necessários para APK (manifest.json)
const apkSizes = [
    { size: 48, name: 'apk-icon-48x48.png' },
    { size: 72, name: 'apk-icon-72x72.png' },
    { size: 96, name: 'apk-icon-96x96.png' },
    { size: 144, name: 'apk-icon-144x144.png' },
    { size: 192, name: 'apk-icon-192x192.png' },
    { size: 512, name: 'apk-icon-512x512.png' }
];

// Tamanhos necessários para Push Notifications
const pushNotificationSizes = [
    { size: 48, name: 'push-icon-48x48.png' },
    { size: 96, name: 'push-icon-96x96.png' },
    { size: 120, name: 'push-icon-120x120.png' },
    { size: 192, name: 'push-icon-192x192.png' }
];

async function generateIcons() {
    try {
        console.log('🎨 Gerando ícones para APK e Push Notifications a partir do icon_apk_pushNotificatio.png...\n');
        
        // Verificar se o arquivo fonte existe
        try {
            await fs.access(sourceIcon);
        } catch {
            console.error('❌ Arquivo fonte não encontrado:', sourceIcon);
            process.exit(1);
        }

        console.log('📸 Arquivo fonte:', sourceIcon);
        
        // Obter informações da imagem original
        const metadata = await sharp(sourceIcon).metadata();
        console.log(`📊 Dimensões originais: ${metadata.width}x${metadata.height}`);
        console.log(`📊 Formato: ${metadata.format}\n`);

        // Garantir que o diretório de destino existe
        await fs.mkdir(iconsDir, { recursive: true });

        // Gerar ícones para APK
        console.log('🔄 Gerando ícones para APK...');
        for (const { size, name } of apkSizes) {
            const outputPath = path.join(iconsDir, name);
            console.log(`   📐 Gerando ${name} (${size}x${size})...`);
            
            await sharp(sourceIcon)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // Fundo branco
                })
                .png({
                    quality: 100,
                    compressionLevel: 9,
                    adaptiveFiltering: true
                })
                .toFile(outputPath);
            
            console.log(`   ✅ ${name} criado!`);
        }

        // Gerar ícones para Push Notifications
        console.log('\n🔄 Gerando ícones para Push Notifications...');
        for (const { size, name } of pushNotificationSizes) {
            const outputPath = path.join(iconsDir, name);
            console.log(`   📐 Gerando ${name} (${size}x${size})...`);
            
            await sharp(sourceIcon)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 1 } // Fundo branco
                })
                .png({
                    quality: 100,
                    compressionLevel: 9,
                    adaptiveFiltering: true
                })
                .toFile(outputPath);
            
            console.log(`   ✅ ${name} criado!`);
        }

        console.log('\n✅ Todos os ícones gerados com sucesso!');
        console.log(`📁 Localização: ${iconsDir}`);
        console.log('\n📋 Ícones gerados para APK:');
        apkSizes.forEach(({ name }) => console.log(`   - ${name}`));
        console.log('\n📋 Ícones gerados para Push Notifications:');
        pushNotificationSizes.forEach(({ name }) => console.log(`   - ${name}`));
        
    } catch (error) {
        console.error('❌ Erro ao gerar ícones:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Executar
generateIcons();

