const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const EnhancedImageService = require('../services/enhancedImageService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configuração do multer para arquivos temporários
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path.join(__dirname, '..', 'temp');
        fsSync.mkdirSync(tempDir, { recursive: true });
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        cb(null, `temp_${timestamp}_${randomString}_${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 5 // Máximo 5 arquivos por vez
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 
            'image/jpg', 
            'image/png', 
            'image/gif', 
            'image/webp',
            'image/jfif',
            'image/bmp',
            'image/tiff',
            'image/tif',
            'image/svg+xml',
            'image/x-icon',
            'image/vnd.microsoft.icon',
            'image/heic',
            'image/heif',
            'image/avif',
            'image/x-canon-cr2',
            'image/x-nikon-nef',
            'image/x-sony-arw',
            'image/x-adobe-dng',
            'image/x-canon-raw',
            'image/x-nikon-raw',
            'image/x-sony-raw',
            'image/x-panasonic-raw',
            'image/x-olympus-raw',
            'image/x-pentax-raw',
            'image/x-samsung-raw',
            'image/x-fuji-raw'
        ];
        
        console.log('🔍 Verificando tipo MIME:', file.mimetype);
        
        if (allowedMimes.includes(file.mimetype)) {
            console.log('✅ Tipo MIME aceito:', file.mimetype);
            cb(null, true);
        } else {
            console.log('❌ Tipo MIME rejeitado:', file.mimetype);
            cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype}. Formatos aceitos: JPEG, PNG, GIF, WebP, JFIF, BMP, TIFF, SVG, ICO, HEIC, HEIF, AVIF, RAW`), false);
        }
    }
});

// Middleware de tratamento de erros do multer
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'FILE_TOO_LARGE',
                message: 'Arquivo muito grande. Máximo permitido: 10MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'TOO_MANY_FILES',
                message: 'Muitos arquivos. Máximo permitido: 5 arquivos'
            });
        }
    }
    
    if (error.message.includes('Tipo de arquivo não suportado')) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_FILE_TYPE',
            message: error.message
        });
    }
    
    next(error);
};

// Upload de imagem única
router.post('/single', authenticateToken, upload.single('image'), handleMulterError, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILE',
                message: 'Nenhum arquivo foi enviado'
            });
        }

        const folder = req.body.folder || req.query.folder || 'produtos';
        const customName = req.body.customName || req.query.customName;

        const result = await EnhancedImageService.uploadImage(req.file, folder, customName);

        res.json({
            success: true,
            message: 'Imagem enviada com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro no upload de imagem única:', error);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Dados da requisição:', {
            hasFile: !!req.file,
            fileInfo: req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null,
            body: req.body,
            user: req.user ? { id: req.user.id, email: req.user.email } : null
        });
        
        // Limpar arquivo temporário em caso de erro
        if (req.file && req.file.path) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.warn('Erro ao limpar arquivo temporário:', cleanupError.message);
            }
        }

        res.status(500).json({
            success: false,
            error: 'UPLOAD_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Upload de múltiplas imagens
router.post('/multiple', authenticateToken, upload.array('images', 5), handleMulterError, async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'NO_FILES',
                message: 'Nenhum arquivo foi enviado'
            });
        }

        const folder = req.body.folder || req.query.folder || 'produtos';
        const results = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const result = await EnhancedImageService.uploadImage(file, folder);
                results.push(result);
            } catch (error) {
                console.error(`Erro no upload do arquivo ${file.originalname}:`, error);
                errors.push({
                    filename: file.originalname,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `${results.length} imagem(ns) enviada(s) com sucesso`,
            data: {
                successful: results,
                failed: errors,
                total: req.files.length,
                successCount: results.length,
                errorCount: errors.length
            }
        });

    } catch (error) {
        console.error('Erro no upload múltiplo:', error);
        
        // Limpar arquivos temporários em caso de erro
        if (req.files) {
            for (const file of req.files) {
                try {
                    await fs.unlink(file.path);
                } catch (cleanupError) {
                    console.warn('Erro ao limpar arquivo temporário:', cleanupError.message);
                }
            }
        }

        res.status(500).json({
            success: false,
            error: 'UPLOAD_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Upload de imagem base64
router.post('/base64', authenticateToken, async (req, res) => {
    try {
        const { image, folder, customName } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                error: 'NO_IMAGE_DATA',
                message: 'Dados da imagem não fornecidos'
            });
        }

        const result = await EnhancedImageService.uploadBase64Image(
            image, 
            folder || 'produtos', 
            customName
        );

        res.json({
            success: true,
            message: 'Imagem base64 enviada com sucesso',
            data: result
        });

    } catch (error) {
        console.error('Erro no upload de imagem base64:', error);
        res.status(500).json({
            success: false,
            error: 'UPLOAD_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Listar imagens
router.get('/list/:folder?', async (req, res) => {
    try {
        const folder = req.params.folder || req.query.folder || 'produtos';
        const result = await EnhancedImageService.listImages(folder);

        res.json({
            success: true,
            message: `Imagens listadas com sucesso`,
            data: result
        });

    } catch (error) {
        console.error('Erro ao listar imagens:', error);
        res.status(500).json({
            success: false,
            error: 'LIST_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Deletar imagem
router.delete('/delete', async (req, res) => {
    try {
        const { imagePath, folder } = req.body;

        if (!imagePath) {
            return res.status(400).json({
                success: false,
                error: 'NO_IMAGE_PATH',
                message: 'Caminho da imagem não fornecido'
            });
        }

        const result = await EnhancedImageService.deleteImage(
            imagePath, 
            folder || 'produtos'
        );

        res.json({
            success: true,
            message: 'Imagem deletada com sucesso',
            data: result
        });

    } catch (error) {
        console.error('Erro ao deletar imagem:', error);
        res.status(500).json({
            success: false,
            error: 'DELETE_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Obter informações de uma imagem
router.get('/info/:folder/:filename', async (req, res) => {
    try {
        const { folder, filename } = req.params;
        const imagePath = path.join(folder, 'originals', filename);
        
        const stats = await fs.stat(path.join(__dirname, '..', 'public', 'uploads', imagePath));
        
        res.json({
            success: true,
            data: {
                filename: filename,
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
                urls: {
                    original: EnhancedImageService.buildPublicUrl(imagePath),
                    thumbnail: EnhancedImageService.buildPublicUrl(imagePath.replace('originals', 'thumbnails').replace(/(\.[^.]+)$/, '_thumb$1')),
                    medium: EnhancedImageService.buildPublicUrl(imagePath.replace('originals', 'medium').replace(/(\.[^.]+)$/, '_medium$1')),
                    large: EnhancedImageService.buildPublicUrl(imagePath.replace('originals', 'large').replace(/(\.[^.]+)$/, '_large$1'))
                }
            }
        });

    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({
                success: false,
                error: 'IMAGE_NOT_FOUND',
                message: 'Imagem não encontrada'
            });
        }
        
        console.error('Erro ao obter informações da imagem:', error);
        res.status(500).json({
            success: false,
            error: 'INFO_ERROR',
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// Middleware de tratamento de erros global
router.use((error, req, res, next) => {
    console.error('Erro no upload:', error);
    res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor'
    });
});

module.exports = router;
