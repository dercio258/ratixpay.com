const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Serviço de Cacheamento e Otimização de Imagens
 * Cacheia imagens internas e externas, otimiza tamanho e formato
 */
class ImageCacheService {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', 'temp', 'image-cache');
        this.maxCacheSize = 500 * 1024 * 1024; // 500MB
        this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
        this.supportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        this.cache = new Map(); // Cache em memória para URLs frequentes
        this.maxMemoryCacheSize = 100; // Máximo de 100 imagens em memória
        
        // Inicializar diretório de cache
        this.initCacheDir();
    }

    async initCacheDir() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
            // Limpar cache antigo na inicialização
            await this.cleanOldCache();
        } catch (error) {
            console.error('Erro ao inicializar diretório de cache:', error);
        }
    }

    /**
     * Gerar hash da URL para usar como nome do arquivo
     */
    generateCacheKey(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * Verificar se imagem está em cache
     */
    async isCached(url) {
        const cacheKey = this.generateCacheKey(url);
        const cachePath = path.join(this.cacheDir, `${cacheKey}.webp`);
        
        try {
            const stats = await fs.stat(cachePath);
            const age = Date.now() - stats.mtimeMs;
            
            if (age < this.maxAge) {
                return { cached: true, path: cachePath, age };
            } else {
                // Cache expirado, remover
                await fs.unlink(cachePath).catch(() => {});
                return { cached: false };
            }
        } catch {
            return { cached: false };
        }
    }

    /**
     * Baixar e otimizar imagem externa
     */
    async downloadAndOptimize(url, options = {}) {
        try {
            const axios = require('axios');
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'RatixPay-ImageCache/1.0'
                }
            });

            const buffer = Buffer.from(response.data);
            
            // Otimizar imagem
            const optimized = await sharp(buffer)
                .webp({ quality: options.quality || 85, effort: 4 })
                .resize(options.width || null, options.height || null, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();

            return optimized;
        } catch (error) {
            console.error('Erro ao baixar/otimizar imagem:', error.message);
            throw error;
        }
    }

    /**
     * Obter imagem (cache ou download)
     */
    async getImage(url, options = {}) {
        // Verificar cache em memória primeiro
        if (this.cache.has(url)) {
            const cached = this.cache.get(url);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hora em memória
                return cached.buffer;
            }
            this.cache.delete(url);
        }

        // Verificar cache em disco
        const cacheCheck = await this.isCached(url);
        if (cacheCheck.cached) {
            const buffer = await fs.readFile(cacheCheck.path);
            
            // Adicionar ao cache em memória
            if (this.cache.size < this.maxMemoryCacheSize) {
                this.cache.set(url, { buffer, timestamp: Date.now() });
            }
            
            return buffer;
        }

        // Baixar e otimizar
        const optimized = await this.downloadAndOptimize(url, options);
        
        // Salvar em cache
        const cacheKey = this.generateCacheKey(url);
        const cachePath = path.join(this.cacheDir, `${cacheKey}.webp`);
        await fs.writeFile(cachePath, optimized);

        // Adicionar ao cache em memória
        if (this.cache.size < this.maxMemoryCacheSize) {
            this.cache.set(url, { buffer: optimized, timestamp: Date.now() });
        } else {
            // Remover entrada mais antiga
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cache.set(url, { buffer: optimized, timestamp: Date.now() });
        }

        return optimized;
    }

    /**
     * Limpar cache antigo
     */
    async cleanOldCache() {
        try {
            const files = await fs.readdir(this.cacheDir);
            const now = Date.now();
            let cleaned = 0;

            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = await fs.stat(filePath);
                const age = now - stats.mtimeMs;

                if (age > this.maxAge) {
                    await fs.unlink(filePath).catch(() => {});
                    cleaned++;
                }
            }

            if (cleaned > 0) {
                console.log(`🧹 Limpeza de cache: ${cleaned} arquivos removidos`);
            }
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
        }
    }

    /**
     * Otimizar imagem local
     */
    async optimizeLocalImage(imagePath, options = {}) {
        try {
            const buffer = await fs.readFile(imagePath);
            const optimized = await sharp(buffer)
                .webp({ quality: options.quality || 85 })
                .resize(options.width || null, options.height || null, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .toBuffer();

            return optimized;
        } catch (error) {
            console.error('Erro ao otimizar imagem local:', error);
            throw error;
        }
    }
}

// Singleton
const imageCacheService = new ImageCacheService();

// Limpar cache periodicamente (a cada 24 horas)
setInterval(() => {
    imageCacheService.cleanOldCache();
}, 24 * 60 * 60 * 1000);

module.exports = imageCacheService;

