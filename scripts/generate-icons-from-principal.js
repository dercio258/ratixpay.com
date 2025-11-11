/**
 * Script para gerar ícones em múltiplos tamanhos a partir do icon_principal.png
 * Gera ícones para: favicon, apple-touch-icon, loader, e outros tamanhos padrão
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const sourceIcon = path.join(__dirname, '..', 'public', 'assets', 'images', 'external', 'icon_principal.png');
const iconsDir = path.join(__dirname, '..', 'public', 'assets', 'images', 'icons');

// Tamanhos necessários
const sizes = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 48, name: 'icon-48x48.png' },
    { size: 72, name: 'icon-72x72.png' },
    { size: 96, name: 'icon-96x96.png' },
    { size: 144, name: 'icon-144x144.png' },
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' }
];

// Tamanhos para loader (otimizado)
const loaderSizes = [
    { size: 120, name: 'loader-icon-120.png' },
    { size: 80, name: 'loader-icon-80.png' }
];

async function generateIcons() {
    try {
        console.log('🎨 Gerando ícones a partir do icon_principal.png...\n');
        
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

        // Gerar ícones padrão
        console.log('🔄 Gerando ícones padrão...');
        for (const { size, name } of sizes) {
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

        // Gerar ícones para loader
        console.log('\n🔄 Gerando ícones para loader...');
        for (const { size, name } of loaderSizes) {
            const outputPath = path.join(iconsDir, name);
            console.log(`   📐 Gerando ${name} (${size}x${size})...`);
            
            await sharp(sourceIcon)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 } // Fundo transparente para loader
                })
                .png({
                    quality: 100,
                    compressionLevel: 9,
                    adaptiveFiltering: true
                })
                .toFile(outputPath);
            
            console.log(`   ✅ ${name} criado!`);
        }

        // Gerar favicon.ico (formato ICO)
        console.log('\n🔄 Gerando favicon.ico...');
        const faviconPath = path.join(__dirname, '..', 'public', 'favicon.ico');
        try {
            // Gerar múltiplos tamanhos para ICO (16, 32, 48)
            const ico16 = await sharp(sourceIcon).resize(16, 16).png().toBuffer();
            const ico32 = await sharp(sourceIcon).resize(32, 32).png().toBuffer();
            const ico48 = await sharp(sourceIcon).resize(48, 48).png().toBuffer();
            
            // Para simplificar, vamos salvar como PNG e renomear
            // (geração de ICO real requer biblioteca adicional)
            await fs.writeFile(faviconPath, ico32);
            console.log('   ✅ favicon.ico criado!');
        } catch (error) {
            console.warn('   ⚠️ Aviso: Não foi possível gerar favicon.ico completo:', error.message);
            console.log('   💡 Dica: Use um conversor online ou biblioteca específica para ICO');
        }

        // Gerar apple-touch-icon.png (180x180)
        console.log('\n🔄 Gerando apple-touch-icon.png...');
        const appleTouchPath = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
        await sharp(sourceIcon)
            .resize(180, 180, {
                fit: 'contain',
                background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png({
                quality: 100,
                compressionLevel: 9
            })
            .toFile(appleTouchPath);
        console.log('   ✅ apple-touch-icon.png criado!');

        console.log('\n✅ Todos os ícones gerados com sucesso!');
        console.log(`📁 Localização: ${iconsDir}`);
        console.log('\n📋 Ícones gerados:');
        sizes.forEach(({ name }) => console.log(`   - ${name}`));
        loaderSizes.forEach(({ name }) => console.log(`   - ${name}`));
        console.log('   - favicon.ico');
        console.log('   - apple-touch-icon.png');
        
    } catch (error) {
        console.error('❌ Erro ao gerar ícones:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Executar
generateIcons();

