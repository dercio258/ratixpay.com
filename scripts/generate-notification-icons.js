const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Script para gerar ícones de notificação push nos tamanhos adequados
 * Gera: icon-192x192.png e icon-48x48.png a partir de icon.png
 */

const iconsDir = path.join(__dirname, '..', 'public', 'assets', 'images', 'icons');
const sourceIcon = path.join(iconsDir, 'icon.png');
const output192 = path.join(iconsDir, 'icon-192x192.png');
const output48 = path.join(iconsDir, 'icon-48x48.png');

async function generateNotificationIcons() {
    try {
        console.log('🎨 Gerando ícones de notificação push...');
        console.log('📁 Diretório:', iconsDir);
        
        // Verificar se o arquivo fonte existe
        if (!fs.existsSync(sourceIcon)) {
            console.error('❌ Arquivo fonte não encontrado:', sourceIcon);
            process.exit(1);
        }

        console.log('📸 Arquivo fonte encontrado:', sourceIcon);

        // Obter informações da imagem original
        const metadata = await sharp(sourceIcon).metadata();
        console.log('📊 Dimensões originais:', `${metadata.width}x${metadata.height}`);
        console.log('📊 Formato:', metadata.format);
        console.log('📊 Canais:', metadata.channels);

        // Gerar icon-192x192.png (ícone principal da notificação)
        console.log('\n🔄 Gerando icon-192x192.png...');
        await sharp(sourceIcon)
            .resize(192, 192, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Fundo transparente
            })
            .png({
                quality: 100,
                compressionLevel: 9,
                adaptiveFiltering: true
            })
            .toFile(output192);
        
        console.log('✅ icon-192x192.png criado com sucesso!');

        // Gerar icon-48x48.png (badge da notificação)
        console.log('\n🔄 Gerando icon-48x48.png...');
        await sharp(sourceIcon)
            .resize(48, 48, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 } // Fundo transparente
            })
            .png({
                quality: 100,
                compressionLevel: 9,
                adaptiveFiltering: true
            })
            .toFile(output48);
        
        console.log('✅ icon-48x48.png criado com sucesso!');

        // Verificar os arquivos gerados
        const stats192 = fs.statSync(output192);
        const stats48 = fs.statSync(output48);
        
        console.log('\n📦 Arquivos gerados:');
        console.log(`   ✅ icon-192x192.png (${(stats192.size / 1024).toFixed(2)} KB)`);
        console.log(`   ✅ icon-48x48.png (${(stats48.size / 1024).toFixed(2)} KB)`);

        // Verificar dimensões dos arquivos gerados
        const metadata192 = await sharp(output192).metadata();
        const metadata48 = await sharp(output48).metadata();
        
        console.log('\n📏 Dimensões verificadas:');
        console.log(`   icon-192x192.png: ${metadata192.width}x${metadata192.height}`);
        console.log(`   icon-48x48.png: ${metadata48.width}x${metadata48.height}`);

        console.log('\n🎉 Todos os ícones foram gerados com sucesso!');
        console.log('💡 Os ícones mantêm as cores e qualidade do original.');
        
    } catch (error) {
        console.error('❌ Erro ao gerar ícones:', error);
        console.error('📋 Stack:', error.stack);
        process.exit(1);
    }
}

// Executar o script
if (require.main === module) {
    generateNotificationIcons();
}

module.exports = { generateNotificationIcons };

