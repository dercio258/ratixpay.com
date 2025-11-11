/**
 * Loader Inline - Script para ser inserido no <head> antes de qualquer outro script
 * Garante que o loader apareça imediatamente, antes mesmo do DOM carregar
 */

(function() {
    'use strict';
    
    // Verificar se deve aplicar loader
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const excludedPages = ['payment-success.html'];
    const shouldExclude = excludedPages.some(page => currentPage.includes(page));
    
    if (shouldExclude) {
        return;
    }
    
    // Logo URL - Usando ícone principal para loader
    const LOGO_URL = '/assets/images/icons/loader-icon-120.png';
    
    // Criar loader imediatamente via innerHTML no documentElement
    const loaderHTML = `
        <div id="loaderContainer" class="loader-container" style="position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#ffffff 0%,#f8f9fa 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:99999;">
            <img src="${LOGO_URL}" alt="RatixPay Logo" class="loader-logo" style="width:120px;height:auto;margin-bottom:30px;opacity:0.9;" onerror="this.style.display='none';">
            <div class="loader-spinner" style="width:60px;height:60px;border:4px solid rgba(246,76,0,0.1);border-top-color:#F64C00;border-radius:50%;animation:loader-spin 1s linear infinite;margin-bottom:20px;"></div>
            <div class="loader-text" style="font-family:'Poppins','Segoe UI','Roboto',Arial,sans-serif;font-size:18px;font-weight:500;color:#333333;letter-spacing:0.5px;animation:loader-pulse 1.5s ease-in-out infinite;">Carregando...</div>
        </div>
    `;
    
    // Adicionar ao documentElement imediatamente
    document.documentElement.insertAdjacentHTML('afterbegin', loaderHTML);
    document.documentElement.classList.add('loading');
    
    // Adicionar estilos inline críticos se o CSS ainda não carregou
    if (!document.getElementById('loader-critical-styles')) {
        const style = document.createElement('style');
        style.id = 'loader-critical-styles';
        style.textContent = `
            @keyframes loader-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes loader-pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
            html.loading, body.loading { overflow:hidden; height:100%; }
            html.loading > body { opacity:0; }
        `;
        document.head.appendChild(style);
    }
})();






