const express = require('express');
const router = express.Router();
const { Produto } = require('../config/database');
const path = require('path');
const fs = require('fs');

// Middleware CORS para imagens
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Rota para servir imagens de produtos
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔍 Rota de imagem chamada para ID: ${id}`);
        
        // Buscar produto pelo custom_id
        const produto = await Produto.findOne({
            where: { custom_id: id }
        });
        
        if (!produto) {
            console.log(`❌ Produto não encontrado para ID: ${id}`);
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        
        console.log(`✅ Produto encontrado: ${produto.nome}`);
        
        // Preferir caminho local em public/uploads se existir
        if (produto.imagem_local_path) {
            const localPath = path.join(__dirname, '..', 'public', 'uploads', produto.imagem_local_path);
            if (fs.existsSync(localPath)) {
                return res.sendFile(localPath);
            }
        }

        // Fallback: se houver URL (antiga), redirecionar
        if (produto.imagem_url) {
            return res.redirect(produto.imagem_url);
        }

        // Imagem padrão
        const defaultImagePath = path.join(__dirname, '..', 'public', 'images', 'default-product.svg');
        res.set('Content-Type', 'image/svg+xml');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.sendFile(defaultImagePath);
        
    } catch (error) {
        console.error('Erro na rota de imagem:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;