/**
 * Script para atualizar todos os loaders inline nos arquivos HTML
 * para usar o novo ícone principal (loader-icon-120.png)
 */

const fs = require('fs').promises;
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const newLoaderIcon = '/assets/images/icons/loader-icon-120.png';

async function getAllHtmlFiles(dir, fileList = []) {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
            // Ignorar node_modules e outros diretórios
            if (!['node_modules', '.git', 'templates'].includes(file)) {
                await getAllHtmlFiles(filePath, fileList);
            }
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    }
    
    return fileList;
}

async function updateLoaders() {
    try {
        console.log('🔄 Atualizando loaders para usar icon_principal.png...\n');
        
        // Buscar todos os arquivos HTML
        const htmlFiles = await getAllHtmlFiles(publicDir);
        
        let updatedCount = 0;
        
        for (const filePath of htmlFiles) {
            try {
                let content = await fs.readFile(filePath, 'utf8');
                let modified = false;
                const relativePath = path.relative(publicDir, filePath);
                
                // Atualizar loader inline (padrão 1: icon-192x192.png)
                if (content.includes('icon-192x192.png') && content.includes('loader')) {
                    content = content.replace(
                        /var u=['"]\/assets\/images\/icons\/icon-192x192\.png['"]/g,
                        `var u='${newLoaderIcon}'`
                    );
                    modified = true;
                }
                
                // Atualizar loader inline (padrão 2: URL externa)
                if (content.includes('txipay.shop/uploads/produtos/originals/1762559260631') && content.includes('loader')) {
                    content = content.replace(
                        /var u=['"]https:\/\/txipay\.shop\/uploads\/produtos\/originals\/1762559260631_c8636ea095ef1040_ratixpay\.png['"]/g,
                        `var u='${newLoaderIcon}'`
                    );
                    modified = true;
                }
                
                // Atualizar favicons e apple-touch-icons
                if (content.includes('txipay.shop/uploads/produtos/originals/1762559260631')) {
                    // Favicon
                    content = content.replace(
                        /<link rel="icon"[^>]*href="https:\/\/txipay\.shop\/uploads\/produtos\/originals\/1762559260631_c8636ea095ef1040_ratixpay\.png"[^>]*>/g,
                        '<link rel="icon" type="image/png" href="/assets/images/icons/favicon-32x32.png">'
                    );
                    
                    // Apple touch icon
                    content = content.replace(
                        /<link rel="apple-touch-icon"[^>]*href="https:\/\/txipay\.shop\/uploads\/produtos\/originals\/1762559260631_c8636ea095ef1040_ratixpay\.png"[^>]*>/g,
                        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">'
                    );
                    
                    // Shortcut icon
                    content = content.replace(
                        /<link rel="shortcut icon"[^>]*href="https:\/\/txipay\.shop\/uploads\/produtos\/originals\/1762559260631_c8636ea095ef1040_ratixpay\.png"[^>]*>/g,
                        '<link rel="shortcut icon" href="/favicon.ico">'
                    );
                    
                    modified = true;
                }
                
                if (modified) {
                    await fs.writeFile(filePath, content, 'utf8');
                    console.log(`✅ Atualizado: ${relativePath}`);
                    updatedCount++;
                }
            } catch (error) {
                console.warn(`⚠️ Erro ao processar ${filePath}:`, error.message);
            }
        }
        
        console.log(`\n✅ Processo concluído!`);
        console.log(`📊 Arquivos atualizados: ${updatedCount}`);
        console.log(`📁 Total de arquivos processados: ${htmlFiles.length}`);
        
    } catch (error) {
        console.error('❌ Erro ao atualizar loaders:', error);
        process.exit(1);
    }
}

// Executar
updateLoaders();

