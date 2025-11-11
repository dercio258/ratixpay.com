/**
 * 🚀 SISTEMA DE CARREGAMENTO CENTRALIZADO - RATIXPAY
 * 
 * Solução centralizada para carregamento de scripts, dependências e inicialização
 * Resolve problemas de ordem de carregamento, dependências e falhas de inicialização
 */

class SystemLoader {
    constructor() {
        this.loadedModules = new Set();
        this.loadingPromises = new Map();
        this.initializationQueue = [];
        this.retryAttempts = new Map();
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        // Configurações do sistema
        this.config = {
            apiBase: null,
            isConnected: false,
            environment: this.detectEnvironment(),
            debug: this.detectEnvironment() === 'development'
        };
        
        // Eventos customizados
        this.events = new EventTarget();
        
        console.log('🚀 SystemLoader inicializado');
    }

    /**
     * Detectar ambiente
     */
    detectEnvironment() {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    /**
     * Verificar conexão com servidor
     */
    async checkServerConnection() {
        try {
            const apiBase = window.location.origin + '/api';
            
            const response = await fetch(`${apiBase}/health`, {
                method: 'GET',
                cache: 'no-cache',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 5000
            });

            if (!response.ok) {
                throw new Error(`Servidor indisponível: ${response.status}`);
            }

            this.config.apiBase = apiBase;
            this.config.isConnected = true;
            window.API_BASE = apiBase;
            
            this.events.dispatchEvent(new CustomEvent('serverConnected', { 
                detail: { apiBase, response } 
            }));
            
            console.log('✅ Servidor conectado:', apiBase);
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao conectar com servidor:', error);
            this.config.isConnected = false;
            
            this.events.dispatchEvent(new CustomEvent('serverDisconnected', { 
                detail: { error: error.message } 
            }));
            
            if (this.config.environment === 'production') {
                this.showServerError();
            } else {
                this.showDevelopmentError(error);
            }
            
            return false;
        }
    }

    /**
     * Carregar módulo com retry automático
     */
    async loadModule(moduleName, loader, retryCount = 0) {
        const cacheKey = `${moduleName}_${retryCount}`;
        
        if (this.loadedModules.has(moduleName)) {
            return Promise.resolve();
        }

        if (this.loadingPromises.has(cacheKey)) {
            return this.loadingPromises.get(cacheKey);
        }

        const loadPromise = this._loadModuleWithRetry(moduleName, loader, retryCount);
        this.loadingPromises.set(cacheKey, loadPromise);
        
        try {
            await loadPromise;
            this.loadedModules.add(moduleName);
            this.loadingPromises.delete(cacheKey);
            
            this.events.dispatchEvent(new CustomEvent('moduleLoaded', { 
                detail: { moduleName } 
            }));
            
            console.log(`✅ Módulo carregado: ${moduleName}`);
        } catch (error) {
            this.loadingPromises.delete(cacheKey);
            throw error;
        }
    }

    /**
     * Carregar módulo com retry
     */
    async _loadModuleWithRetry(moduleName, loader, retryCount) {
        try {
            return await loader();
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`⚠️ Falha ao carregar ${moduleName}, tentativa ${retryCount + 1}/${this.maxRetries}`);
                await this.delay(this.retryDelay * (retryCount + 1));
                return this.loadModule(moduleName, loader, retryCount + 1);
            } else {
                console.error(`❌ Falha definitiva ao carregar ${moduleName}:`, error);
                throw error;
            }
        }
    }

    /**
     * Carregar script dinamicamente
     */
    async loadScript(src, options = {}) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = options.async !== false;
            script.defer = options.defer || false;
            
            script.onload = () => {
                console.log(`✅ Script carregado: ${src}`);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ Erro ao carregar script: ${src}`);
                reject(new Error(`Falha ao carregar script: ${src}`));
            };
            
            if (options.timeout) {
                setTimeout(() => {
                    reject(new Error(`Timeout ao carregar script: ${src}`));
                }, options.timeout);
            }
            
            document.head.appendChild(script);
        });
    }

    /**
     * Carregar CSS dinamicamente
     */
    async loadCSS(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            
            link.onload = () => {
                console.log(`✅ CSS carregado: ${href}`);
                resolve();
            };
            
            link.onerror = () => {
                console.error(`❌ Erro ao carregar CSS: ${href}`);
                reject(new Error(`Falha ao carregar CSS: ${href}`));
            };
            
            document.head.appendChild(link);
        });
    }

    /**
     * Verificar se dependência está disponível
     */
    async waitForDependency(dependencyName, checkFunction, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const check = () => {
                if (checkFunction()) {
                    console.log(`✅ Dependência disponível: ${dependencyName}`);
                    resolve();
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout aguardando dependência: ${dependencyName}`));
                } else {
                    setTimeout(check, 100);
                }
            };
            
            check();
        });
    }

    /**
     * Inicializar módulo na ordem correta
     */
    async initializeModule(moduleName, initializer, dependencies = []) {
        // Aguardar dependências
        for (const dep of dependencies) {
            await this.waitForDependency(dep.name, dep.check);
        }
        
        // Adicionar à fila de inicialização
        this.initializationQueue.push({ moduleName, initializer });
        
        // Executar inicialização
        try {
            await initializer();
            console.log(`✅ Módulo inicializado: ${moduleName}`);
            
            this.events.dispatchEvent(new CustomEvent('moduleInitialized', { 
                detail: { moduleName } 
            }));
        } catch (error) {
            console.error(`❌ Erro ao inicializar ${moduleName}:`, error);
            throw error;
        }
    }

    /**
     * Executar inicialização em lote
     */
    async initializeAll() {
        console.log('🚀 Iniciando todos os módulos...');
        
        for (const { moduleName, initializer } of this.initializationQueue) {
            try {
                await initializer();
                console.log(`✅ Módulo inicializado: ${moduleName}`);
            } catch (error) {
                console.error(`❌ Erro ao inicializar ${moduleName}:`, error);
            }
        }
        
        this.events.dispatchEvent(new CustomEvent('allModulesInitialized'));
        console.log('🎉 Todos os módulos inicializados!');
    }

    /**
     * Mostrar erro de servidor em produção
     */
    showServerError() {
        const errorOverlay = document.createElement('div');
        errorOverlay.id = 'server-error-overlay';
        errorOverlay.innerHTML = `
            <div class="error-content">
                <h2>🚨 Servidor Indisponível</h2>
                <p>O servidor RatixPay está temporariamente indisponível.</p>
                <p>Tente novamente em alguns minutos.</p>
                <button id="retry-connection">Tentar Novamente</button>
            </div>
        `;
        
        errorOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            color: white;
            font-family: Arial, sans-serif;
        `;
        
        document.body.appendChild(errorOverlay);
        
        document.getElementById('retry-connection').addEventListener('click', async () => {
            errorOverlay.remove();
            await this.checkServerConnection();
            if (this.config.isConnected) {
                window.location.reload();
            }
        });
    }

    /**
     * Mostrar erro em desenvolvimento
     */
    showDevelopmentError(error) {
        console.warn('⚠️ Modo desenvolvimento - servidor offline');
        // Em desenvolvimento, definir API_BASE como fallback
        this.config.apiBase = window.location.origin + '/api';
        window.API_BASE = this.config.apiBase;
    }

    /**
     * Utilitário de delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obter status do sistema
     */
    getStatus() {
        return {
            loadedModules: Array.from(this.loadedModules),
            isConnected: this.config.isConnected,
            apiBase: this.config.apiBase,
            environment: this.config.environment,
            initializationQueue: this.initializationQueue.length
        };
    }

    /**
     * Limpar cache e recarregar
     */
    async reload() {
        this.loadedModules.clear();
        this.loadingPromises.clear();
        this.initializationQueue = [];
        
        await this.checkServerConnection();
        await this.initializeAll();
    }
}

// Instância global
window.systemLoader = new SystemLoader();

// Inicialização automática
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando carregamento do sistema...');
    
    try {
        // 1. Verificar conexão com servidor
        await window.systemLoader.checkServerConnection();
        
        // 2. Carregar dependências críticas
        await window.systemLoader.loadModule('chartjs', () => 
            window.systemLoader.waitForDependency('Chart.js', () => typeof Chart !== 'undefined')
        );
        
        // 3. Disparar evento de sistema pronto
        window.systemLoader.events.dispatchEvent(new CustomEvent('systemReady'));
        
        console.log('🎉 Sistema carregado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar sistema:', error);
    }
});

// Exportar para uso global
window.SystemLoader = SystemLoader;
