/**
 * Cache Buster - Força reload de scripts
 * Use este script para limpar cache e forçar atualização
 */

(function() {
    'use strict';
    
    console.log('🔄 Cache Buster ativado - Forçando reload de scripts...');
    
    // Função para limpar cache de scripts
    function clearScriptCache() {
        const scripts = document.querySelectorAll('script[src*="meta-pixel-unified"]');
        scripts.forEach(script => {
            const originalSrc = script.src;
            const newSrc = originalSrc + '&t=' + Date.now();
            script.src = newSrc;
            console.log('🔄 Script recarregado:', newSrc);
        });
    }
    
    // Função para forçar reload da página
    function forceReload() {
        console.log('🔄 Forçando reload da página...');
        window.location.reload(true);
    }
    
    // Adicionar botão de cache buster
    function addCacheBusterButton() {
        const button = document.createElement('button');
        button.textContent = '🔄 Limpar Cache';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 9999;
            background: #ff6b6b;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
        
        button.onclick = function() {
            clearScriptCache();
            setTimeout(forceReload, 1000);
        };
        
        document.body.appendChild(button);
        console.log('🔄 Botão de Cache Buster adicionado');
    }
    
    // Auto-executar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addCacheBusterButton);
    } else {
        addCacheBusterButton();
    }
    
    // Exportar funções para uso global
    window.clearScriptCache = clearScriptCache;
    window.forceReload = forceReload;
    
})();

