const express = require('express');
const multer = require('multer');
const router = express.Router();
const EnhancedContentService = require('../services/enhancedContentService');
const { authenticateToken } = require('../middleware/auth');

// Configuração do Multer para arquivos de conteúdo
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 5 // Máximo 5 arquivos por vez
    },
    fileFilter: (req, file, cb) => {
        // Verificar se o tipo de arquivo é permitido
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'application/rtf',
            'application/vnd.oasis.opendocument.text',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/vnd.oasis.opendocument.spreadsheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.oasis.opendocument.presentation',
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/x-tar',
            'application/gzip',
            'audio/mpeg',
            'video/mp4',
            'video/x-msvideo',
            'video/quicktime',
            'video/x-ms-wmv',
            'video/x-flv',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/bmp',
            'image/tiff',
            'text/html',
            'text/css',
            'application/javascript',
            'application/json',
            'application/xml'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
        }
    }
});

/**
 * POST /api/upload/enhanced-content/single
 * Upload de um único arquivo de conteúdo
 */
router.post('/single', authenticateToken, upload.single('contentFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo de conteúdo fornecido'
            });
        }

        const folder = req.body.folder || 'conteudo';
        const customName = req.body.customName || null;

        console.log('📁 Upload de arquivo de conteúdo:', {
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            folder: folder
        });

        const result = await EnhancedContentService.uploadContentFile(req.file, folder, customName);

        res.json({
            success: true,
            message: 'Arquivo de conteúdo enviado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro no upload de arquivo de conteúdo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/upload/enhanced-content/multiple
 * Upload de múltiplos arquivos de conteúdo
 */
router.post('/multiple', authenticateToken, upload.array('contentFiles', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo de conteúdo fornecido'
            });
        }

        const folder = req.body.folder || 'conteudo';
        const results = [];

        console.log(`📁 Upload de ${req.files.length} arquivos de conteúdo`);

        for (const file of req.files) {
            try {
                const result = await EnhancedContentService.uploadContentFile(file, folder);
                results.push(result);
            } catch (error) {
                console.error(`❌ Erro no upload do arquivo ${file.originalname}:`, error);
                results.push({
                    success: false,
                    originalName: file.originalname,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const errorCount = results.length - successCount;

        res.json({
            success: true,
            message: `${successCount} arquivo(s) enviado(s) com sucesso${errorCount > 0 ? `, ${errorCount} erro(s)` : ''}`,
            data: {
                results: results,
                summary: {
                    total: results.length,
                    success: successCount,
                    errors: errorCount
                }
            }
        });

    } catch (error) {
        console.error('❌ Erro no upload múltiplo de arquivos de conteúdo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * POST /api/upload/enhanced-content/buffer
 * Upload de arquivo de conteúdo a partir de buffer
 */
router.post('/buffer', authenticateToken, async (req, res) => {
    try {
        const { buffer, originalName, folder = 'conteudo', customName } = req.body;

        if (!buffer || !originalName) {
            return res.status(400).json({
                success: false,
                message: 'Buffer e nome original são obrigatórios'
            });
        }

        // Converter base64 para buffer se necessário
        let fileBuffer;
        if (typeof buffer === 'string') {
            fileBuffer = Buffer.from(buffer, 'base64');
        } else {
            fileBuffer = Buffer.from(buffer);
        }

        console.log('📁 Upload de arquivo de conteúdo a partir de buffer:', {
            originalName: originalName,
            size: fileBuffer.length,
            folder: folder
        });

        const result = await EnhancedContentService.uploadContentFromBuffer(
            fileBuffer, 
            originalName, 
            folder, 
            customName
        );

        res.json({
            success: true,
            message: 'Arquivo de conteúdo enviado com sucesso',
            data: result
        });

    } catch (error) {
        console.error('❌ Erro no upload de arquivo de conteúdo a partir de buffer:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/upload/enhanced-content/list/:folder
 * Listar arquivos de conteúdo em uma pasta
 */
router.get('/list/:folder', authenticateToken, async (req, res) => {
    try {
        const folder = req.params.folder || 'conteudo';
        const files = await EnhancedContentService.listContentFiles(folder);

        res.json({
            success: true,
            message: `${files.length} arquivo(s) encontrado(s)`,
            data: {
                folder: folder,
                files: files
            }
        });

    } catch (error) {
        console.error('❌ Erro ao listar arquivos de conteúdo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * DELETE /api/upload/enhanced-content/delete
 * Deletar arquivo de conteúdo
 */
router.delete('/delete', authenticateToken, async (req, res) => {
    try {
        const { filename, folder = 'conteudo' } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Nome do arquivo é obrigatório'
            });
        }

        await EnhancedContentService.deleteContentFile(filename, folder);

        res.json({
            success: true,
            message: 'Arquivo de conteúdo deletado com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao deletar arquivo de conteúdo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/upload/enhanced-content/info/:folder/:filename
 * Obter informações de um arquivo de conteúdo
 */
router.get('/info/:folder/:filename', authenticateToken, async (req, res) => {
    try {
        const { folder, filename } = req.params;
        const info = await EnhancedContentService.getContentFileInfo(filename, folder);

        res.json({
            success: true,
            message: 'Informações do arquivo obtidas com sucesso',
            data: info
        });

    } catch (error) {
        console.error('❌ Erro ao obter informações do arquivo de conteúdo:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

module.exports = router;
