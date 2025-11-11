const compression = require('compression');
const zlib = require('zlib');

class ResponseOptimizer {
    constructor() {
        this.compressionThreshold = 1024; // 1KB
        this.compressionLevel = 6;
        this.cacheHeaders = {
            static: 'public, max-age=31536000', // 1 ano
            api: 'public, max-age=300', // 5 minutos
            dynamic: 'no-cache, no-store, must-revalidate'
        };
        
        this.responseStats = {
            total: 0,
            compressed: 0,
            cached: 0,
            averageSize: 0,
            averageCompressionRatio: 0
        };
    }

    // Middleware de otimização de resposta
    optimizeResponse() {
        return (req, res, next) => {
            const startTime = Date.now();
            const originalSend = res.send;
            const originalJson = res.json;
            
            // Interceptar res.send
            res.send = function(data) {
                const responseData = this.optimizeResponseData(data, req, res);
                const endTime = Date.now();
                
                // Adicionar headers de performance
                res.setHeader('X-Response-Time', `${endTime - startTime}ms`);
                res.setHeader('X-Content-Size', Buffer.byteLength(responseData, 'utf8'));
                
                // Adicionar headers de cache
                this.addCacheHeaders(req, res);
                
                // Adicionar headers de compressão
                this.addCompressionHeaders(req, res);
                
                // Atualizar estatísticas
                this.updateResponseStats(responseData, req, res);
                
                originalSend.call(this, responseData);
            }.bind(this);
            
            // Interceptar res.json
            res.json = function(data) {
                const responseData = this.optimizeJsonResponse(data, req, res);
                const endTime = Date.now();
                
                // Adicionar headers de performance
                res.setHeader('X-Response-Time', `${endTime - startTime}ms`);
                res.setHeader('X-Content-Size', Buffer.byteLength(responseData, 'utf8'));
                
                // Adicionar headers de cache
                this.addCacheHeaders(req, res);
                
                // Adicionar headers de compressão
                this.addCompressionHeaders(req, res);
                
                // Atualizar estatísticas
                this.updateResponseStats(responseData, req, res);
                
                originalJson.call(this, responseData);
            }.bind(this);
            
            next();
        };
    }

    // Otimizar dados de resposta
    optimizeResponseData(data, req, res) {
        if (typeof data === 'string') {
            // Minificar HTML/CSS/JS se necessário
            if (req.path.endsWith('.html') || req.path.endsWith('.css') || req.path.endsWith('.js')) {
                data = this.minifyContent(data, req.path);
            }
        } else if (typeof data === 'object') {
            // Otimizar objeto JSON
            data = this.optimizeJsonData(data);
        }
        
        return data;
    }

    // Otimizar resposta JSON
    optimizeJsonResponse(data, req, res) {
        // Remover propriedades desnecessárias
        data = this.removeUnnecessaryProperties(data);
        
        // Comprimir arrays grandes
        if (Array.isArray(data) && data.length > 100) {
            data = this.compressLargeArray(data);
        }
        
        // Otimizar objetos aninhados
        data = this.optimizeNestedObjects(data);
        
        return data;
    }

    // Minificar conteúdo
    minifyContent(content, path) {
        if (path.endsWith('.html')) {
            return this.minifyHTML(content);
        } else if (path.endsWith('.css')) {
            return this.minifyCSS(content);
        } else if (path.endsWith('.js')) {
            return this.minifyJS(content);
        }
        
        return content;
    }

    // Minificar HTML
    minifyHTML(html) {
        return html
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .replace(/\s+>/g, '>')
            .replace(/<\s+/g, '<')
            .trim();
    }

    // Minificar CSS
    minifyCSS(css) {
        return css
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\s+/g, ' ')
            .replace(/;\s*}/g, '}')
            .replace(/{\s*/g, '{')
            .replace(/;\s*/g, ';')
            .trim();
    }

    // Minificar JavaScript
    minifyJS(js) {
        return js
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/\s+/g, ' ')
            .replace(/;\s*/g, ';')
            .trim();
    }

    // Otimizar dados JSON
    optimizeJsonData(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.optimizeJsonData(item));
        } else if (typeof data === 'object' && data !== null) {
            const optimized = {};
            
            for (const [key, value] of Object.entries(data)) {
                // Remover propriedades vazias
                if (value !== null && value !== undefined && value !== '') {
                    optimized[key] = this.optimizeJsonData(value);
                }
            }
            
            return optimized;
        }
        
        return data;
    }

    // Remover propriedades desnecessárias
    removeUnnecessaryProperties(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.removeUnnecessaryProperties(item));
        } else if (typeof data === 'object' && data !== null) {
            const cleaned = {};
            
            for (const [key, value] of Object.entries(data)) {
                // Remover propriedades internas do Sequelize
                if (key.startsWith('_') || key === 'dataValues') {
                    continue;
                }
                
                // Remover propriedades vazias
                if (value !== null && value !== undefined && value !== '') {
                    cleaned[key] = this.removeUnnecessaryProperties(value);
                }
            }
            
            return cleaned;
        }
        
        return data;
    }

    // Comprimir array grande
    compressLargeArray(array) {
        if (array.length <= 100) {
            return array;
        }
        
        // Retornar apenas primeiros 100 itens com informação de paginação
        return {
            data: array.slice(0, 100),
            pagination: {
                total: array.length,
                page: 1,
                limit: 100,
                hasMore: array.length > 100
            }
        };
    }

    // Otimizar objetos aninhados
    optimizeNestedObjects(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.optimizeNestedObjects(item));
        } else if (typeof data === 'object' && data !== null) {
            const optimized = {};
            
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'object' && value !== null) {
                    // Limitar profundidade de objetos aninhados
                    if (this.getObjectDepth(value) > 5) {
                        optimized[key] = '[Object]';
                    } else {
                        optimized[key] = this.optimizeNestedObjects(value);
                    }
                } else {
                    optimized[key] = value;
                }
            }
            
            return optimized;
        }
        
        return data;
    }

    // Obter profundidade de objeto
    getObjectDepth(obj, depth = 0) {
        if (typeof obj !== 'object' || obj === null) {
            return depth;
        }
        
        let maxDepth = depth;
        for (const value of Object.values(obj)) {
            if (typeof value === 'object' && value !== null) {
                maxDepth = Math.max(maxDepth, this.getObjectDepth(value, depth + 1));
            }
        }
        
        return maxDepth;
    }

    // Adicionar headers de cache
    addCacheHeaders(req, res) {
        const path = req.path;
        
        if (path.includes('/assets/') || path.includes('/images/') || path.includes('/css/') || path.includes('/js/')) {
            // Recursos estáticos - cache longo
            res.setHeader('Cache-Control', this.cacheHeaders.static);
            res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
            res.setHeader('ETag', `"${Date.now()}"`);
        } else if (path.includes('/api/')) {
            // APIs - cache médio
            if (req.method === 'GET') {
                res.setHeader('Cache-Control', this.cacheHeaders.api);
                res.setHeader('ETag', `"${Date.now()}"`);
            } else {
                res.setHeader('Cache-Control', this.cacheHeaders.dynamic);
            }
        } else {
            // Conteúdo dinâmico - sem cache
            res.setHeader('Cache-Control', this.cacheHeaders.dynamic);
        }
    }

    // Adicionar headers de compressão
    addCompressionHeaders(req, res) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        
        if (acceptEncoding.includes('gzip')) {
            res.setHeader('Content-Encoding', 'gzip');
        } else if (acceptEncoding.includes('deflate')) {
            res.setHeader('Content-Encoding', 'deflate');
        } else if (acceptEncoding.includes('br')) {
            res.setHeader('Content-Encoding', 'br');
        }
    }

    // Atualizar estatísticas de resposta
    updateResponseStats(data, req, res) {
        this.responseStats.total++;
        
        const contentSize = Buffer.byteLength(data, 'utf8');
        this.responseStats.averageSize = (this.responseStats.averageSize + contentSize) / 2;
        
        // Verificar se foi comprimido
        if (res.getHeader('Content-Encoding')) {
            this.responseStats.compressed++;
        }
        
        // Verificar se foi cacheado
        if (res.getHeader('Cache-Control') && res.getHeader('Cache-Control').includes('max-age')) {
            this.responseStats.cached++;
        }
    }

    // Middleware de compressão otimizado
    compressionMiddleware() {
        return compression({
            level: this.compressionLevel,
            threshold: this.compressionThreshold,
            filter: (req, res) => {
                // Não comprimir se já comprimido
                if (req.headers['x-no-compression']) {
                    return false;
                }
                
                // Comprimir apenas tipos de conteúdo específicos
                const contentType = res.getHeader('Content-Type') || '';
                return contentType.includes('text/') || 
                       contentType.includes('application/json') || 
                       contentType.includes('application/javascript');
            }
        });
    }

    // Middleware de cache de resposta
    responseCacheMiddleware() {
        const cache = new Map();
        const maxCacheSize = 1000;
        const cacheTimeout = 300000; // 5 minutos
        
        return (req, res, next) => {
            // Apenas para GET requests
            if (req.method !== 'GET') {
                return next();
            }
            
            const cacheKey = `${req.method}:${req.originalUrl}`;
            const cached = cache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < cacheTimeout) {
                // Retornar resposta cacheada
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Cache-Timestamp', cached.timestamp);
                return res.json(cached.data);
            }
            
            // Interceptar resposta para cachear
            const originalJson = res.json;
            res.json = function(data) {
                // Cachear resposta
                if (cache.size >= maxCacheSize) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
                
                cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });
                
                res.setHeader('X-Cache', 'MISS');
                originalJson.call(this, data);
            };
            
            next();
        };
    }

    // Middleware de paginação
    paginationMiddleware() {
        return (req, res, next) => {
            // Adicionar parâmetros de paginação
            req.pagination = {
                page: parseInt(req.query.page) || 1,
                limit: Math.min(parseInt(req.query.limit) || 20, 100), // Máximo 100
                offset: 0
            };
            
            req.pagination.offset = (req.pagination.page - 1) * req.pagination.limit;
            
            next();
        };
    }

    // Middleware de ordenação
    sortingMiddleware() {
        return (req, res, next) => {
            // Adicionar parâmetros de ordenação
            req.sorting = {
                field: req.query.sort || 'createdAt',
                order: req.query.order || 'DESC'
            };
            
            // Validar campo de ordenação
            const allowedFields = ['id', 'nome', 'preco', 'createdAt', 'updatedAt'];
            if (!allowedFields.includes(req.sorting.field)) {
                req.sorting.field = 'createdAt';
            }
            
            // Validar ordem
            if (!['ASC', 'DESC'].includes(req.sorting.order.toUpperCase())) {
                req.sorting.order = 'DESC';
            }
            
            next();
        };
    }

    // Middleware de filtros
    filtersMiddleware() {
        return (req, res, next) => {
            // Adicionar filtros
            req.filters = {};
            
            // Filtros comuns
            if (req.query.status) {
                req.filters.status = req.query.status;
            }
            
            if (req.query.categoria) {
                req.filters.categoria = req.query.categoria;
            }
            
            if (req.query.busca) {
                req.filters.busca = req.query.busca;
            }
            
            if (req.query.dataInicio) {
                req.filters.dataInicio = new Date(req.query.dataInicio);
            }
            
            if (req.query.dataFim) {
                req.filters.dataFim = new Date(req.query.dataFim);
            }
            
            next();
        };
    }

    // Middleware de validação de entrada
    validationMiddleware() {
        return (req, res, next) => {
            // Validar parâmetros de paginação
            if (req.query.page && (isNaN(req.query.page) || req.query.page < 1)) {
                return res.status(400).json({
                    error: 'Página deve ser um número maior que 0',
                    code: 'INVALID_PAGE'
                });
            }
            
            if (req.query.limit && (isNaN(req.query.limit) || req.query.limit < 1 || req.query.limit > 100)) {
                return res.status(400).json({
                    error: 'Limite deve ser um número entre 1 e 100',
                    code: 'INVALID_LIMIT'
                });
            }
            
            // Validar datas
            if (req.query.dataInicio && isNaN(new Date(req.query.dataInicio).getTime())) {
                return res.status(400).json({
                    error: 'Data de início inválida',
                    code: 'INVALID_START_DATE'
                });
            }
            
            if (req.query.dataFim && isNaN(new Date(req.query.dataFim).getTime())) {
                return res.status(400).json({
                    error: 'Data de fim inválida',
                    code: 'INVALID_END_DATE'
                });
            }
            
            next();
        };
    }

    // Obter estatísticas de resposta
    getResponseStats() {
        return {
            ...this.responseStats,
            compressionRate: this.responseStats.total > 0 ? 
                (this.responseStats.compressed / this.responseStats.total * 100).toFixed(2) + '%' : '0%',
            cacheHitRate: this.responseStats.total > 0 ? 
                (this.responseStats.cached / this.responseStats.total * 100).toFixed(2) + '%' : '0%',
            averageSizeKB: (this.responseStats.averageSize / 1024).toFixed(2) + 'KB'
        };
    }

    // Limpar estatísticas
    clearStats() {
        this.responseStats = {
            total: 0,
            compressed: 0,
            cached: 0,
            averageSize: 0,
            averageCompressionRatio: 0
        };
    }

    // Configurar otimizações
    configure(options = {}) {
        if (options.compressionThreshold) {
            this.compressionThreshold = options.compressionThreshold;
        }
        
        if (options.compressionLevel) {
            this.compressionLevel = options.compressionLevel;
        }
        
        if (options.cacheHeaders) {
            this.cacheHeaders = { ...this.cacheHeaders, ...options.cacheHeaders };
        }
        
        console.log('⚙️ Otimizações de resposta configuradas:', options);
    }
}

// Instância singleton
const responseOptimizer = new ResponseOptimizer();

module.exports = responseOptimizer;
