/**
 * Utilitário para detectar e configurar navegador Chrome/Chromium do sistema
 * para uso com whatsapp-web.js, evitando a necessidade do Puppeteer baixar Chromium
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class WhatsAppBrowserDetector {
    constructor() {
        this.detectedPath = null;
        this.platform = process.platform;
    }

    /**
     * Detecta caminho do Chrome/Chromium no sistema
     */
    detectChromePath() {
        // Se já detectou, retornar
        if (this.detectedPath && fs.existsSync(this.detectedPath)) {
            return this.detectedPath;
        }

        // Verificar variável de ambiente primeiro
        const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
        if (envPath && fs.existsSync(envPath)) {
            this.detectedPath = envPath;
            console.log('✅ Chrome encontrado via variável de ambiente:', envPath);
            return envPath;
        }

        // Detectar baseado no sistema operacional
        const possiblePaths = this.getPossiblePaths();

        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
                this.detectedPath = chromePath;
                console.log('✅ Chrome detectado automaticamente:', chromePath);
                return chromePath;
            }
        }

        console.warn('⚠️ Chrome/Chromium não encontrado no sistema. O Puppeteer tentará baixar.');
        return null;
    }

    /**
     * Retorna caminhos possíveis do Chrome baseado no SO
     */
    getPossiblePaths() {
        const paths = [];

        if (this.platform === 'win32') {
            // Windows
            paths.push(
                process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
                process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
            );
        } else if (this.platform === 'darwin') {
            // macOS
            paths.push(
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium'
            );
        } else {
            // Linux
            paths.push(
                '/usr/bin/google-chrome-stable',
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/snap/bin/chromium'
            );
        }

        return paths;
    }

    /**
     * Tenta encontrar Chrome usando comando do sistema
     */
    detectViaCommand() {
        try {
            let command;
            if (this.platform === 'win32') {
                command = 'where chrome.exe';
            } else if (this.platform === 'darwin') {
                command = 'which "Google Chrome"';
            } else {
                command = 'which google-chrome-stable || which chromium-browser || which chromium';
            }

            const result = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
            if (result && fs.existsSync(result)) {
                this.detectedPath = result;
                console.log('✅ Chrome encontrado via comando do sistema:', result);
                return result;
            }
        } catch (error) {
            // Comando não encontrou, continuar
        }

        return null;
    }

    /**
     * Obtém configuração do Puppeteer otimizada
     * @param {boolean} simplified - Se true, usa configuração simplificada (útil para retry)
     */
    getPuppeteerConfig(simplified = false) {
        const chromePath = this.detectChromePath() || this.detectViaCommand();

        // Tentar usar headless 'new' (mais estável) ou fallback para true
        const headlessMode = process.env.WHATSAPP_HEADLESS_MODE || 'new';
        
        let args;
        
        if (simplified) {
            // Configuração simplificada - apenas flags essenciais
            args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ];
        } else {
            // Configuração completa com flags adicionais para estabilidade
            args = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-default-apps',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-software-rasterizer',
                '--disable-background-networking',
                '--disable-sync',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-zygote',
                '--single-process' // Útil para ambientes com recursos limitados
            ];
            
            // Flags específicas para Windows
            if (this.platform === 'win32') {
                args.push(
                    '--disable-windows10-custom-titlebar',
                    '--disable-features=TranslateUI',
                    '--disable-ipc-flooding-protection'
                );
            }
            
            // Flags específicas para Linux
            if (this.platform === 'linux') {
                args.push(
                    '--disable-seccomp-filter-sandbox',
                    '--disable-breakpad'
                );
            }
        }
        
        const baseConfig = {
            headless: headlessMode === 'new' ? 'new' : (headlessMode === 'false' ? false : true),
            args: args,
            // Configurações adicionais para estabilidade
            ignoreHTTPSErrors: true,
            defaultViewport: {
                width: 1366,
                height: 768
            },
            // Timeout aumentado para inicialização
            timeout: 90000, // Aumentado para 90 segundos
            // Configurações adicionais para evitar erros
            protocolTimeout: 120000 // 2 minutos para operações de protocolo
        };

        if (chromePath) {
            baseConfig.executablePath = chromePath;
            if (!simplified) {
                console.log('📱 Usando Chrome do sistema:', chromePath);
            }
        } else {
            if (!simplified) {
                console.warn('⚠️ Chrome não encontrado. Puppeteer tentará usar Chromium baixado automaticamente.');
            }
        }

        return baseConfig;
    }

    /**
     * Verifica se Chrome está disponível
     */
    isChromeAvailable() {
        const path = this.detectChromePath() || this.detectViaCommand();
        return path !== null && fs.existsSync(path);
    }
}

// Exportar instância singleton
module.exports = new WhatsAppBrowserDetector();

