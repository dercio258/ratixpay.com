const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

/**
 * Serviço aprimorado para gerenciar uploads de imagens localmente
 */
class EnhancedImageService {
    constructor() {
        this.baseUploadDir = path.join(__dirname, '..', 'public', 'uploads');
        this.allowedFormats = [
            'jpeg', 'jpg', 'png', 'gif', 'webp', 'jfif', 'bmp', 'tiff', 'tif', 
            'svg', 'ico', 'heic', 'heif', 'avif', 'raw', 'cr2', 'nef', 'arw'
        ];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.imageSizes = {
            thumbnail: { width: 150, height: 150 },
            medium: { width: 400, height: 400 },
            large: { width: 800, height: 800 }
        };
    }

    /**
     * Garantir que o diretório de uploads existe
     */
    async ensureUploadsDir() {
        try {
            await fs.mkdir(this.baseUploadDir, { recursive: true });
            return this.baseUploadDir;
        } catch (error) {
            console.error('Erro ao criar diretório de uploads:', error);
            throw new Error('Falha ao criar diretório de uploads');
        }
    }

    /**
     * Criar estrutura de pastas organizada
     */
    async createFolderStructure(folder = 'produtos') {
        const folders = [
            path.join(this.baseUploadDir, folder),
            path.join(this.baseUploadDir, folder, 'originals'),
            path.join(this.baseUploadDir, folder, 'thumbnails'),
            path.join(this.baseUploadDir, folder, 'medium'),
            path.join(this.baseUploadDir, folder, 'large')
        ];

        for (const folderPath of folders) {
            try {
                await fs.mkdir(folderPath, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    console.error(`Erro ao criar pasta ${folderPath}:`, error);
                    throw error;
                }
            }
        }

        return folders[0];
    }

    /**
     * Validar arquivo de imagem
     */
    validateImage(file) {
        const errors = [];

        // Verificar se o arquivo existe
        if (!file) {
            errors.push('Nenhum arquivo foi enviado');
            return { valid: false, errors };
        }

        // Verificar tipo MIME
        if (!file.mimetype || !file.mimetype.startsWith('image/')) {
            errors.push('Arquivo deve ser uma imagem');
        }

        // Verificar formato
        const extension = path.extname(file.originalname).toLowerCase().slice(1);
        console.log('🔍 Validando arquivo:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            extension: extension,
            allowedFormats: this.allowedFormats
        });
        
        // Verificação mais flexível para diferentes tipos de imagem
        const isImageMime = file.mimetype && (
            file.mimetype.startsWith('image/') || 
            file.mimetype.includes('jpeg') || 
            file.mimetype.includes('jpg') || 
            file.mimetype.includes('png') || 
            file.mimetype.includes('gif') || 
            file.mimetype.includes('webp') ||
            file.mimetype.includes('jfif') ||
            file.mimetype.includes('bmp') ||
            file.mimetype.includes('tiff') ||
            file.mimetype.includes('svg') ||
            file.mimetype.includes('ico') ||
            file.mimetype.includes('heic') ||
            file.mimetype.includes('heif') ||
            file.mimetype.includes('avif') ||
            file.mimetype.includes('raw')
        );
        
        if (!isImageMime && !this.allowedFormats.includes(extension)) {
            errors.push(`Formato não suportado. Use: ${this.allowedFormats.join(', ')}`);
        }

        // Verificar tamanho
        if (file.size > this.maxFileSize) {
            errors.push(`Arquivo muito grande. Máximo: ${this.maxFileSize / 1024 / 1024}MB`);
        }

        return {
            valid: errors.length === 0,
            errors,
            extension
        };
    }

    /**
     * Gerar nome único para arquivo
     */
    generateUniqueFilename(originalName, extension) {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const sanitizedName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .replace(/\s+/g, '_')
            .toLowerCase();
        
        return `${timestamp}_${randomString}_${sanitizedName}`;
    }

    /**
     * Processar e redimensionar imagem
     */
    async processImage(inputPath, outputPath, options = {}) {
        try {
            console.log('🖼️ Processando imagem:', { inputPath, outputPath, options });
            
            let sharpInstance = sharp(inputPath);

            // Aplicar redimensionamento se especificado
            if (options.width || options.height) {
                sharpInstance = sharpInstance.resize(options.width, options.height, {
                    fit: 'inside',
                    withoutEnlargement: true
                });
            }

            // Sempre converter para JPEG para versões redimensionadas (thumbnail, medium, large)
            // Isso garante compatibilidade e reduz o tamanho do arquivo
            const outputExtension = path.extname(outputPath).toLowerCase();
            
            if (outputExtension === '.jpg' || outputExtension === '.jpeg') {
                // Converter para JPEG com qualidade otimizada
                sharpInstance = sharpInstance.jpeg({ 
                    quality: options.quality || 85,
                    progressive: true,
                    mozjpeg: true
                });
            } else if (outputExtension === '.png') {
                // Manter PNG se especificado
                sharpInstance = sharpInstance.png({ 
                    quality: options.quality || 90,
                    progressive: true
                });
            } else if (outputExtension === '.webp') {
                // Converter para WebP se especificado
                sharpInstance = sharpInstance.webp({ 
                    quality: options.quality || 85
                });
            } else {
                // Padrão: converter para JPEG
                sharpInstance = sharpInstance.jpeg({ 
                    quality: options.quality || 85,
                    progressive: true,
                    mozjpeg: true
                });
            }

            // Aplicar otimização final
            sharpInstance = sharpInstance
                .sharpen()
                .normalize();

            await sharpInstance.toFile(outputPath);
            return true;
        } catch (error) {
            console.error('Erro ao processar imagem:', error);
            throw new Error('Falha ao processar imagem');
        }
    }

    /**
     * Upload completo de imagem com múltiplos tamanhos
     */
    async uploadImage(file, folder = 'produtos', customName = null) {
        try {
            // Validar arquivo
            const validation = this.validateImage(file);
            if (!validation.valid) {
                throw new Error(`Erro de validação: ${validation.errors.join(', ')}`);
            }

            // Criar estrutura de pastas
            const baseFolder = await this.createFolderStructure(folder);

            // Gerar nome único
            const filename = customName || this.generateUniqueFilename(file.originalname, validation.extension);
            const baseFilename = path.parse(filename).name;
            const extension = path.parse(filename).ext || `.${validation.extension}`;

            // Caminhos dos arquivos
            const originalPath = path.join(baseFolder, 'originals', `${baseFilename}${extension}`);
            // Versões redimensionadas sempre usam .jpg para compatibilidade
            const thumbnailPath = path.join(baseFolder, 'thumbnails', `${baseFilename}_thumb.jpg`);
            const mediumPath = path.join(baseFolder, 'medium', `${baseFilename}_medium.jpg`);
            const largePath = path.join(baseFolder, 'large', `${baseFilename}_large.jpg`);

            // Salvar arquivo original
            await fs.copyFile(file.path, originalPath);

            // Processar diferentes tamanhos
            await Promise.all([
                this.processImage(originalPath, thumbnailPath, this.imageSizes.thumbnail),
                this.processImage(originalPath, mediumPath, this.imageSizes.medium),
                this.processImage(originalPath, largePath, this.imageSizes.large)
            ]);

            // Remover arquivo temporário
            try {
                await fs.unlink(file.path);
            } catch (error) {
                console.warn('Aviso: Não foi possível remover arquivo temporário:', error.message);
            }

            // Retornar informações da imagem
            return {
                success: true,
                original: {
                    filename: `${baseFilename}${extension}`,
                    path: path.relative(this.baseUploadDir, originalPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, originalPath))
                },
                thumbnail: {
                    filename: `${baseFilename}_thumb.jpg`,
                    path: path.relative(this.baseUploadDir, thumbnailPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, thumbnailPath))
                },
                medium: {
                    filename: `${baseFilename}_medium.jpg`,
                    path: path.relative(this.baseUploadDir, mediumPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, mediumPath))
                },
                large: {
                    filename: `${baseFilename}_large.jpg`,
                    path: path.relative(this.baseUploadDir, largePath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, largePath))
                },
                metadata: {
                    originalName: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype,
                    uploadedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Erro no upload de imagem:', error);
            
            // Limpar arquivos em caso de erro
            try {
                if (file && file.path) {
                    await fs.unlink(file.path);
                }
            } catch (cleanupError) {
                console.warn('Erro ao limpar arquivo temporário:', cleanupError.message);
            }

            throw error;
        }
    }

    /**
     * Upload de imagem base64
     */
    async uploadBase64Image(base64Data, folder = 'produtos', customName = null) {
        try {
            console.log('🔍 Debug - base64Data recebido:', base64Data ? base64Data.substring(0, 100) + '...' : 'undefined');
            console.log('🔍 Debug - Tipo do base64Data:', typeof base64Data);
            
            // Validar formato base64 (mais flexível)
            let matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            
            // Se não tem o prefixo data:image/, tentar adicionar
            if (!matches && base64Data.startsWith('/9j/') || base64Data.startsWith('iVBORw0KGgo')) {
                // É uma imagem JPEG ou PNG sem prefixo
                if (base64Data.startsWith('/9j/')) {
                    base64Data = 'data:image/jpeg;base64,' + base64Data;
                } else if (base64Data.startsWith('iVBORw0KGgo')) {
                    base64Data = 'data:image/png;base64,' + base64Data;
                }
                matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
            }
            
            if (!matches) {
                console.log('❌ Debug - Formato base64 inválido. Dados recebidos:', base64Data);
                throw new Error('Formato de imagem base64 inválido');
            }

            const format = matches[1];
            const data = matches[2];

            if (!this.allowedFormats.includes(format.toLowerCase())) {
                throw new Error(`Formato não suportado: ${format}`);
            }

            // Criar estrutura de pastas
            const baseFolder = await this.createFolderStructure(folder);

            // Gerar nome único
            const filename = customName || this.generateUniqueFilename(`image_${Date.now()}`, format);
            const baseFilename = path.parse(filename).name;
            const extension = path.parse(filename).ext || `.${format}`;

            // Caminhos dos arquivos
            const originalPath = path.join(baseFolder, 'originals', `${baseFilename}${extension}`);
            // Versões redimensionadas sempre usam .jpg para compatibilidade
            const thumbnailPath = path.join(baseFolder, 'thumbnails', `${baseFilename}_thumb.jpg`);
            const mediumPath = path.join(baseFolder, 'medium', `${baseFilename}_medium.jpg`);
            const largePath = path.join(baseFolder, 'large', `${baseFilename}_large.jpg`);

            // Salvar arquivo original
            await fs.writeFile(originalPath, data, 'base64');

            // Processar diferentes tamanhos
            await Promise.all([
                this.processImage(originalPath, thumbnailPath, this.imageSizes.thumbnail),
                this.processImage(originalPath, mediumPath, this.imageSizes.medium),
                this.processImage(originalPath, largePath, this.imageSizes.large)
            ]);

            // Retornar informações da imagem
            return {
                success: true,
                original: {
                    filename: `${baseFilename}${extension}`,
                    path: path.relative(this.baseUploadDir, originalPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, originalPath))
                },
                thumbnail: {
                    filename: `${baseFilename}_thumb.jpg`,
                    path: path.relative(this.baseUploadDir, thumbnailPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, thumbnailPath))
                },
                medium: {
                    filename: `${baseFilename}_medium.jpg`,
                    path: path.relative(this.baseUploadDir, mediumPath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, mediumPath))
                },
                large: {
                    filename: `${baseFilename}_large.jpg`,
                    path: path.relative(this.baseUploadDir, largePath).replace(/\\/g, '/'),
                    url: this.buildPublicUrl(path.relative(this.baseUploadDir, largePath))
                },
                metadata: {
                    format: format,
                    uploadedAt: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Erro no upload de imagem base64:', error);
            throw error;
        }
    }

    /**
     * Construir URL pública
     */
    buildPublicUrl(relativePath) {
        return `/uploads/${relativePath}`;
    }

    /**
     * Deletar imagem e todas suas variações
     */
    async deleteImage(imagePath, folder = 'produtos') {
        try {
            const basePath = path.join(this.baseUploadDir, folder);
            const baseFilename = path.parse(imagePath).name;
            const extension = path.parse(imagePath).ext;

            const filesToDelete = [
                path.join(basePath, 'originals', `${baseFilename}${extension}`),
                path.join(basePath, 'thumbnails', `${baseFilename}_thumb${extension}`),
                path.join(basePath, 'medium', `${baseFilename}_medium${extension}`),
                path.join(basePath, 'large', `${baseFilename}_large${extension}`)
            ];

            const deletedFiles = [];
            for (const filePath of filesToDelete) {
                try {
                    await fs.unlink(filePath);
                    deletedFiles.push(filePath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`Erro ao deletar arquivo ${filePath}:`, error.message);
                    }
                }
            }

            return {
                success: true,
                deletedFiles: deletedFiles.length,
                files: deletedFiles
            };

        } catch (error) {
            console.error('Erro ao deletar imagem:', error);
            throw error;
        }
    }

    /**
     * Listar imagens em uma pasta
     */
    async listImages(folder = 'produtos') {
        try {
            const folderPath = path.join(this.baseUploadDir, folder, 'originals');
            
            try {
                const files = await fs.readdir(folderPath);
                const images = [];

                for (const file of files) {
                    const filePath = path.join(folderPath, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.isFile()) {
                        const baseFilename = path.parse(file).name;
                        const extension = path.parse(file).ext;
                        
                        images.push({
                            filename: file,
                            baseFilename: baseFilename,
                            extension: extension,
                            size: stats.size,
                            createdAt: stats.birthtime,
                            modifiedAt: stats.mtime,
                            urls: {
                                original: this.buildPublicUrl(`${folder}/originals/${file}`),
                                thumbnail: this.buildPublicUrl(`${folder}/thumbnails/${baseFilename}_thumb${extension}`),
                                medium: this.buildPublicUrl(`${folder}/medium/${baseFilename}_medium${extension}`),
                                large: this.buildPublicUrl(`${folder}/large/${baseFilename}_large${extension}`)
                            }
                        });
                    }
                }

                return {
                    success: true,
                    images: images.sort((a, b) => b.createdAt - a.createdAt)
                };

            } catch (error) {
                if (error.code === 'ENOENT') {
                    return { success: true, images: [] };
                }
                throw error;
            }

        } catch (error) {
            console.error('Erro ao listar imagens:', error);
            throw error;
        }
    }
}

module.exports = new EnhancedImageService();
