const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const LocalImageService = require('../services/localImageService');

const router = express.Router();

// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const baseDir = LocalImageService.ensureUploadsDir();
        const subdir = req.query.folder || 'produtos';
        const dest = path.join(baseDir, subdir);
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${timestamp}-${safeName}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Tipo de arquivo não suportado'));
    }
});

// Upload simples (retorna caminho público)
router.post('/', upload.single('image'), (req, res) => {
    try {
        const uploadsDir = LocalImageService.getUploadsDir();
        const relativePath = path.relative(uploadsDir, req.file.path).replace(/\\/g, '/');
        const publicUrl = LocalImageService.buildPublicUrl(relativePath);
        return res.json({ success: true, path: relativePath, url: publicUrl });
    } catch (error) {
        console.error('Erro no upload local:', error);
        return res.status(500).json({ success: false, message: 'Erro ao fazer upload' });
    }
});

module.exports = router;


