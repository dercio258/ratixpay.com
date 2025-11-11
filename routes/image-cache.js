const express = require('express');
const router = express.Router();
const imageCacheService = require('../services/imageCacheService');
const axios = require('axios');

/**
 * Rota para servir imagens com cache
 * GET /api/image-cache?url=<image-url>&width=<width>&height=<height>&quality=<quality>
 */
router.get('/', async (req, res) => {
    try {
        const { url, width, height, quality } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL da imagem é obrigatória' });
        }

        // Validar URL
        try {
            new URL(url);
        } catch {
            return res.status(400).json({ error: 'URL inválida' });
        }

        // Opções de otimização
        const options = {
            width: width ? parseInt(width) : null,
            height: height ? parseInt(height) : null,
            quality: quality ? parseInt(quality) : 85
        };

        // Obter imagem (cache ou download)
        const imageBuffer = await imageCacheService.getImage(url, options);

        // Headers de cache otimizados
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Expires', new Date(Date.now() + 31536000000).toUTCString());
        res.setHeader('ETag', `"${imageCacheService.generateCacheKey(url)}"`);
        res.setHeader('Vary', 'Accept-Encoding');

        res.send(imageBuffer);
    } catch (error) {
        console.error('Erro ao processar imagem:', error);
        res.status(500).json({ error: 'Erro ao processar imagem' });
    }
});

/**
 * Rota para limpar cache manualmente (admin only)
 */
router.delete('/cache', async (req, res) => {
    try {
        await imageCacheService.cleanOldCache();
        res.json({ success: true, message: 'Cache limpo com sucesso' });
    } catch (error) {
        console.error('Erro ao limpar cache:', error);
        res.status(500).json({ error: 'Erro ao limpar cache' });
    }
});

module.exports = router;

