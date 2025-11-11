const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Serviço aprimorado para gerenciar uploads de arquivos de conteúdo localmente
 */
class EnhancedContentService {
    constructor() {
        this.baseUploadDir = path.join(__dirname, '..', 'public', 'uploads');
        this.allowedFormats = [
            'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
            'xls', 'xlsx', 'csv', 'ods',
            'ppt', 'pptx', 'odp',
            'zip', 'rar', '7z', 'tar', 'gz',
            'mp3', 'mp4', 'avi', 'mov', 'wmv', 'flv',
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff',
            'html', 'css', 'js', 'json', 'xml'
        ];
        this.maxFileSize = 50 * 1024 * 1024; // 50MB para arquivos de conteúdo
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
     * Criar estrutura de pastas organizada para arquivos de conteúdo
     */
    async createFolderStructure(folder = 'conteudo') {
        const folders = [
            path.join(this.baseUploadDir, folder),
            path.join(this.baseUploadDir, folder, 'originals')
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
     * Validar arquivo de conteúdo
     */
    validateContentFile(file) {
        if (!file) {
            throw new Error('Arquivo não fornecido');
        }

        // Verificar tamanho
        if (file.size > this.maxFileSize) {
            throw new Error(`Arquivo muito grande. Tamanho máximo: ${this.maxFileSize / (1024 * 1024)}MB`);
        }

        // Verificar formato
        const extension = path.extname(file.originalname || file.name).toLowerCase().substring(1);
        if (!this.allowedFormats.includes(extension)) {
            throw new Error(`Formato de arquivo não permitido: ${extension}. Formatos permitidos: ${this.allowedFormats.join(', ')}`);
        }

        return true;
    }

    /**
     * Gerar nome único para arquivo
     */
    generateUniqueFilename(originalName, customName = null) {
        const timestamp = Date.now();
        const randomHash = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(originalName);
        const baseName = customName || path.basename(originalName, extension);
        
        // Limpar nome do arquivo (remover caracteres especiais)
        const cleanName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
        
        return `${timestamp}_${randomHash}_${cleanName}${extension}`;
    }

    /**
     * Upload de arquivo de conteúdo
     */
    async uploadContentFile(file, folder = 'conteudo', customName = null) {
        try {
            console.log('📁 Iniciando upload de arquivo de conteúdo...');
            
            // Validar arquivo
            this.validateContentFile(file);
            
            // Garantir estrutura de pastas
            await this.createFolderStructure(folder);
            
            // Gerar nome único
            const uniqueFilename = this.generateUniqueFilename(file.originalname || file.name, customName);
            const filePath = path.join(this.baseUploadDir, folder, 'originals', uniqueFilename);
            
            // Salvar arquivo
            await fs.writeFile(filePath, file.buffer);
            
            // Gerar URL pública
            const publicUrl = `/uploads/${folder}/originals/${uniqueFilename}`;
            
            const result = {
                success: true,
                original: {
                    filename: uniqueFilename,
                    url: publicUrl,
                    path: filePath,
                    size: file.size,
                    mimetype: file.mimetype,
                    originalName: file.originalname || file.name
                }
            };
            
            console.log('✅ Arquivo de conteúdo enviado com sucesso:', result.original.url);
            return result;
            
        } catch (error) {
            console.error('❌ Erro ao fazer upload do arquivo de conteúdo:', error);
            throw error;
        }
    }

    /**
     * Upload de arquivo de conteúdo a partir de buffer
     */
    async uploadContentFromBuffer(buffer, originalName, folder = 'conteudo', customName = null) {
        try {
            console.log('📁 Iniciando upload de arquivo de conteúdo a partir de buffer...');
            
            // Criar objeto file simulado
            const file = {
                buffer: buffer,
                size: buffer.length,
                originalname: originalName,
                name: originalName,
                mimetype: this.getMimeType(originalName)
            };
            
            return await this.uploadContentFile(file, folder, customName);
            
        } catch (error) {
            console.error('❌ Erro ao fazer upload do arquivo de conteúdo a partir de buffer:', error);
            throw error;
        }
    }

    /**
     * Obter tipo MIME baseado na extensão
     */
    getMimeType(filename) {
        const extension = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.rtf': 'application/rtf',
            '.odt': 'application/vnd.oasis.opendocument.text',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.csv': 'text/csv',
            '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.odp': 'application/vnd.oasis.opendocument.presentation',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.7z': 'application/x-7z-compressed',
            '.tar': 'application/x-tar',
            '.gz': 'application/gzip',
            '.mp3': 'audio/mpeg',
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.wmv': 'video/x-ms-wmv',
            '.flv': 'video/x-flv',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.xml': 'application/xml'
        };
        
        return mimeTypes[extension] || 'application/octet-stream';
    }

    /**
     * Deletar arquivo de conteúdo
     */
    async deleteContentFile(filename, folder = 'conteudo') {
        try {
            const filePath = path.join(this.baseUploadDir, folder, 'originals', filename);
            await fs.unlink(filePath);
            console.log('✅ Arquivo de conteúdo deletado:', filename);
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar arquivo de conteúdo:', error);
            throw error;
        }
    }

    /**
     * Listar arquivos de conteúdo em uma pasta
     */
    async listContentFiles(folder = 'conteudo') {
        try {
            const folderPath = path.join(this.baseUploadDir, folder, 'originals');
            const files = await fs.readdir(folderPath);
            
            const fileList = [];
            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stats = await fs.stat(filePath);
                
                fileList.push({
                    filename: file,
                    url: `/uploads/${folder}/originals/${file}`,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }
            
            return fileList;
        } catch (error) {
            console.error('❌ Erro ao listar arquivos de conteúdo:', error);
            throw error;
        }
    }

    /**
     * Obter informações de um arquivo de conteúdo
     */
    async getContentFileInfo(filename, folder = 'conteudo') {
        try {
            const filePath = path.join(this.baseUploadDir, folder, 'originals', filename);
            const stats = await fs.stat(filePath);
            
            return {
                filename: filename,
                url: `/uploads/${folder}/originals/${filename}`,
                path: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                exists: true
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { filename: filename, exists: false };
            }
            throw error;
        }
    }
}

module.exports = new EnhancedContentService();
