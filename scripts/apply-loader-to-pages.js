/**
 * Script para aplicar o loader em todas as páginas HTML
 * Exceto checkout.html e payment-success.html
 */

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const excludedPages = ['checkout.html', 'payment-success.html'];

// CSS e JS do loader
const loaderCSS = '    <!-- Loader CSS -->\n    <link rel="stylesheet" href="/css/loader.css">';
const loaderJS = '    <!-- Loader Script -->\n    <script src="/js/loader.js"></script>';

// Script inline para aparecer imediatamente (deve ser no <head>)
const loaderInlineScript = `    <!-- Loader Inline - Aparece imediatamente -->
    <script>
        (function(){var p=window.location.pathname.split('/').pop()||'index.html';if(['checkout.html','payment-success.html'].some(e=>p.includes(e)))return;var u='https://txipay.shop/uploads/produtos/originals/1762559260631_c8636ea095ef1040_ratixpay.png';var h='<div id="loaderContainer" class="loader-container" style="position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#ffffff 0%,#f8f9fa 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:99999;"><img src="'+u+'" alt="RatixPay" class="loader-logo" style="width:120px;height:auto;margin-bottom:30px;opacity:0.9;" onerror="this.style.display=\\'none\\';"><div class="loader-spinner" style="width:60px;height:60px;border:4px solid rgba(246,76,0,0.1);border-top-color:#F64C00;border-radius:50%;animation:loader-spin 1s linear infinite;margin-bottom:20px;"></div><div class="loader-text" style="font-family:\\'Poppins\\',\\'Segoe UI\\',\\'Roboto\\',Arial,sans-serif;font-size:18px;font-weight:500;color:#333333;letter-spacing:0.5px;animation:loader-pulse 1.5s ease-in-out infinite;">Carregando...</div></div>';document.documentElement.insertAdjacentHTML('afterbegin',h);document.documentElement.classList.add('loading');if(!document.getElementById('loader-critical-styles')){var s=document.createElement('style');s.id='loader-critical-styles';s.textContent='@keyframes loader-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}@keyframes loader-pulse{0%,100%{opacity:1}50%{opacity:0.6}}html.loading,body.loading{overflow:hidden;height:100%}html.loading>body{opacity:0}';document.head.appendChild(s);}})();
    </script>`;

/**
 * Verificar se a página já tem o loader
 */
function hasLoader(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Verificar se tem o script inline OU (CSS e JS externos)
    return content.includes('loaderContainer') || (content.includes('/css/loader.css') && content.includes('/js/loader.js'));
}

/**
 * Adicionar script inline do loader no <head> (deve ser o primeiro)
 */
function addLoaderInlineScript(content) {
    // Verificar se já tem o script inline
    if (content.includes('loaderContainer') || content.includes('loader-inline')) {
        return content;
    }

    // Adicionar logo após <head> ou após charset/viewport
    const patterns = [
        /(<meta[^>]*viewport[^>]*>[\s\n]*)/i,
        /(<head[^>]*>[\s\n]*)/i,
    ];

    for (const pattern of patterns) {
        if (pattern.test(content)) {
            return content.replace(pattern, `$1${loaderInlineScript}\n`);
        }
    }

    return content;
}

/**
 * Adicionar CSS do loader no <head>
 */
function addLoaderCSS(content) {
    // Verificar se já tem o CSS
    if (content.includes('/css/loader.css')) {
        return content;
    }

    // Procurar por padrões comuns de fechamento de <head> ou antes de <style>
    // Tentar adicionar após outros links de CSS
    const patterns = [
        /(<link[^>]*stylesheet[^>]*>[\s\n]*)(<\/head>)/i,
        /(<link[^>]*stylesheet[^>]*>[\s\n]*)(<style)/i,
        /(<link[^>]*stylesheet[^>]*>[\s\n]*)(<script)/i,
    ];

    for (const pattern of patterns) {
        if (pattern.test(content)) {
            return content.replace(pattern, `$1${loaderCSS}\n$2`);
        }
    }

    // Se não encontrar, adicionar antes do </head>
    if (content.includes('</head>')) {
        return content.replace('</head>', `${loaderCSS}\n</head>`);
    }

    return content;
}

/**
 * Adicionar JS do loader antes do </body>
 */
function addLoaderJS(content) {
    // Procurar por </body> e adicionar antes
    if (content.includes('</body>')) {
        // Verificar se já não está lá
        if (!content.includes('/js/loader.js')) {
            return content.replace('</body>', `${loaderJS}\n</body>`);
        }
    }
    return content;
}

/**
 * Processar um arquivo HTML
 */
function processFile(filePath) {
    const fileName = path.basename(filePath);
    
    // Pular páginas excluídas
    if (excludedPages.includes(fileName)) {
        console.log(`⏭️  Pulando ${fileName} (página excluída)`);
        return;
    }

    // Verificar se já tem loader
    // Verificar se já tem o script inline (não verificar CSS/JS externos aqui)
    const contentCheck = fs.readFileSync(filePath, 'utf8');
    if (contentCheck.includes('loaderContainer')) {
        console.log(`✅ ${fileName} já tem loader inline`);
        return;
    }

    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;

        // Adicionar script inline primeiro (no <head>, aparece imediatamente)
        content = addLoaderInlineScript(content);
        
        // Adicionar CSS
        content = addLoaderCSS(content);
        
        // Adicionar JS
        content = addLoaderJS(content);

        // Salvar apenas se houver mudanças
        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Loader aplicado em ${fileName}`);
        } else {
            console.log(`⚠️  Não foi possível aplicar loader em ${fileName} (estrutura não reconhecida)`);
        }
    } catch (error) {
        console.error(`❌ Erro ao processar ${fileName}:`, error.message);
    }
}

/**
 * Processar todos os arquivos HTML
 */
function main() {
    console.log('🚀 Iniciando aplicação do loader em todas as páginas...\n');

    const files = fs.readdirSync(publicDir)
        .filter(file => file.endsWith('.html'))
        .map(file => path.join(publicDir, file));

    console.log(`📄 Encontrados ${files.length} arquivos HTML\n`);

    files.forEach(processFile);

    console.log('\n✨ Processo concluído!');
}

// Executar
main();

