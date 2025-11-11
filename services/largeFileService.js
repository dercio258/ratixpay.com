const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

class LargeFileService {
    constructor() {
        this.uploadDir = path.join(__dirname, '..', 'public', 'uploads');
        this.maxFileSize = 150 * 1024 * 1024; // 150MB
        this.allowedMimeTypes = [
            // Documentos
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
            
            // Arquivos compactados
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed',
            'application/gzip',
            
            // Vídeos
            'video/mp4',
            'video/avi',
            'video/mov',
            'video/wmv',
            'video/flv',
            'video/webm',
            'video/mkv',
            
            // Áudios
            'audio/mp3',
            'audio/wav',
            'audio/ogg',
            'audio/aac',
            'audio/m4a',
            
            // Imagens
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            'image/bmp',
            'image/tiff'
        ];
        
        this.initializeDirectories();
    }

    async initializeDirectories() {
        try {
            const dirs = [
                path.join(this.uploadDir, 'produtos'),
                path.join(this.uploadDir, 'conteudo'),
                path.join(this.uploadDir, 'temp')
            ];

            for (const dir of dirs) {
                await fs.mkdir(dir, { recursive: true });
            }

            // Diretórios de upload inicializados
        } catch (error) {
            console.error('❌ Erro ao inicializar diretórios:', error);
        }
    }

    // Configuração do multer para uploads grandes
    getMulterConfig() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = path.join(this.uploadDir, 'temp');
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                const extension = path.extname(file.originalname);
                cb(null, `temp-${uniqueSuffix}${extension}`);
            }
        });

        const fileFilter = (req, file, cb) => {
            if (this.allowedMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`), false);
            }
        };

        return multer({
            storage: storage,
            fileFilter: fileFilter,
            limits: {
                fileSize: this.maxFileSize,
                files: 2 // Máximo 2 arquivos por upload (imagem + conteúdo)
            }
        });
    }

    // Validar arquivo
    validateFile(file) {
        const errors = [];

        // Verificar tamanho
        if (file.size > this.maxFileSize) {
            errors.push(`Arquivo muito grande. Máximo permitido: ${this.formatFileSize(this.maxFileSize)}`);
        }

        // Verificar tipo MIME
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            errors.push(`Tipo de arquivo não permitido: ${file.mimetype}`);
        }

        // Verificar extensão
        const allowedExtensions = [
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
            '.zip', '.rar', '.7z', '.gz',
            '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv',
            '.mp3', '.wav', '.ogg', '.aac', '.m4a',
            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'
        ];

        const extension = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(extension)) {
            errors.push(`Extensão de arquivo não permitida: ${extension}`);
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Processar upload de arquivo
    async processFileUpload(tempFile, destination, customName = null) {
        try {
            const fileExtension = path.extname(tempFile.originalname);
            const fileName = customName || this.generateFileName(tempFile.originalname);
            const finalPath = path.join(this.uploadDir, destination, fileName);

            // Mover arquivo do diretório temp para o destino final
            await fs.rename(tempFile.path, finalPath);

            // Gerar hash do arquivo para verificação de integridade
            const fileHash = await this.generateFileHash(finalPath);

            const fileInfo = {
                originalName: tempFile.originalname,
                fileName: fileName,
                path: finalPath,
                url: `/uploads/${destination}/${fileName}`,
                size: tempFile.size,
                mimeType: tempFile.mimetype,
                extension: fileExtension,
                hash: fileHash,
                uploadedAt: new Date()
            };

            console.log(`✅ Arquivo processado: ${fileName} (${this.formatFileSize(fileInfo.size)})`);
            return fileInfo;

        } catch (error) {
            console.error('❌ Erro ao processar upload:', error);
            throw new Error(`Falha no processamento do arquivo: ${error.message}`);
        }
    }

    // Gerar nome único para arquivo
    generateFileName(originalName) {
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        
        return `${baseName}_${timestamp}_${randomString}${extension}`;
    }

    // Gerar hash do arquivo
    async generateFileHash(filePath) {
        try {
            const fileBuffer = await fs.readFile(filePath);
            return crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
            console.error('❌ Erro ao gerar hash do arquivo:', error);
            return null;
        }
    }

    // Verificar integridade do arquivo
    async verifyFileIntegrity(filePath, expectedHash) {
        try {
            const actualHash = await this.generateFileHash(filePath);
            return actualHash === expectedHash;
        } catch (error) {
            console.error('❌ Erro ao verificar integridade:', error);
            return false;
        }
    }

    // Limpar arquivos temporários
    async cleanupTempFiles() {
        try {
            const tempDir = path.join(this.uploadDir, 'temp');
            const files = await fs.readdir(tempDir);
            
            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                
                // Remover arquivos temporários com mais de 1 hora
                if (Date.now() - stats.mtime.getTime() > 60 * 60 * 1000) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Arquivo temporário removido: ${file}`);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao limpar arquivos temporários:', error);
        }
    }

    // Remover arquivo
    async removeFile(filePath) {
        try {
            await fs.unlink(filePath);
            console.log(`🗑️ Arquivo removido: ${filePath}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao remover arquivo:', error);
            return false;
        }
    }

    // Obter informações do arquivo
    async getFileInfo(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            console.error('❌ Erro ao obter informações do arquivo:', error);
            return null;
        }
    }

    // Formatar tamanho do arquivo
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Verificar espaço disponível
    async checkAvailableSpace() {
        try {
            const stats = await fs.stat(this.uploadDir);
            // Implementar verificação de espaço disponível se necessário
            return {
                available: true,
                message: 'Espaço disponível'
            };
        } catch (error) {
            return {
                available: false,
                message: 'Erro ao verificar espaço disponível'
            };
        }
    }

    // Middleware para upload de arquivos grandes
    getUploadMiddleware() {
        const upload = this.getMulterConfig();
        
        return (req, res, next) => {
            upload.fields([
                { name: 'image', maxCount: 1 },
                { name: 'contentFile', maxCount: 1 }
            ])(req, res, (err) => {
                if (err) {
                    console.error('❌ Erro no upload:', err);
                    return res.status(400).json({
                        success: false,
                        error: 'Erro no upload do arquivo',
                        message: err.message
                    });
                }
                next();
            });
        };
    }

    // Processar uploads de produto
    async processProductUploads(req) {
        const uploads = {
            image: null,
            contentFile: null
        };

        try {
            // Processar imagem
            if (req.files && req.files.image && req.files.image[0]) {
                const imageFile = req.files.image[0];
                const validation = this.validateFile(imageFile);
                
                if (!validation.isValid) {
                    throw new Error(`Imagem inválida: ${validation.errors.join(', ')}`);
                }

                uploads.image = await this.processFileUpload(imageFile, 'produtos');
            }

            // Processar arquivo de conteúdo
            if (req.files && req.files.contentFile && req.files.contentFile[0]) {
                const contentFile = req.files.contentFile[0];
                const validation = this.validateFile(contentFile);
                
                if (!validation.isValid) {
                    throw new Error(`Arquivo de conteúdo inválido: ${validation.errors.join(', ')}`);
                }

                uploads.contentFile = await this.processFileUpload(contentFile, 'conteudo');
            }

            return uploads;

        } catch (error) {
            // Limpar arquivos em caso de erro
            if (uploads.image) {
                await this.removeFile(uploads.image.path);
            }
            if (uploads.contentFile) {
                await this.removeFile(uploads.contentFile.path);
            }
            
            throw error;
        }
    }
}

module.exports = new LargeFileService();
