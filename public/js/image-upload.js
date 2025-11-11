/**
 * Componente para upload de imagens aprimorado
 */
class ImageUploader {
    constructor(options = {}) {
        this.apiBase = options.apiBase || '/api/upload/enhanced';
        this.defaultFolder = options.defaultFolder || 'produtos';
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.allowedTypes = options.allowedTypes || ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        this.previewContainer = options.previewContainer;
        this.onSuccess = options.onSuccess || (() => {});
        this.onError = options.onError || (() => {});
        this.onProgress = options.onProgress || (() => {});
        
        this.initializeElements();
    }

    initializeElements() {
        // Criar elementos se não existirem
        if (!this.previewContainer) {
            this.previewContainer = document.createElement('div');
            this.previewContainer.className = 'image-preview-container';
        }
    }

    /**
     * Validar arquivo antes do upload
     */
    validateFile(file) {
        const errors = [];

        // Verificar tipo
        if (!this.allowedTypes.includes(file.type)) {
            errors.push(`Tipo de arquivo não suportado: ${file.type}`);
        }

        // Verificar tamanho
        if (file.size > this.maxFileSize) {
            errors.push(`Arquivo muito grande: ${(file.size / 1024 / 1024).toFixed(2)}MB (máximo: ${this.maxFileSize / 1024 / 1024}MB)`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Criar preview da imagem
     */
    createPreview(file, container) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const preview = document.createElement('div');
            preview.className = 'image-preview-item';
            
            preview.innerHTML = `
                <div class="preview-image">
                    <img src="${e.target.result}" alt="Preview">
                    <div class="preview-overlay">
                        <div class="preview-info">
                            <span class="filename">${file.name}</span>
                            <span class="filesize">${(file.size / 1024 / 1024).toFixed(2)}MB</span>
                        </div>
                        <div class="preview-actions">
                            <button type="button" class="btn-remove" onclick="this.closest('.image-preview-item').remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="upload-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <span class="progress-text">0%</span>
                </div>
            `;
            
            container.appendChild(preview);
        };
        
        reader.readAsDataURL(file);
    }

    /**
     * Upload de arquivo único
     */
    async uploadSingle(file, folder = null, customName = null) {
        const validation = this.validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        const formData = new FormData();
        formData.append('image', file);
        if (folder) formData.append('folder', folder);
        if (customName) formData.append('customName', customName);

        try {
            const response = await fetch(`${this.apiBase}/single`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Erro no upload');
            }

            this.onSuccess(result.data);
            return result.data;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Upload de múltiplos arquivos
     */
    async uploadMultiple(files, folder = null) {
        const validFiles = [];
        const errors = [];

        // Validar todos os arquivos
        for (const file of files) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push({
                    file: file.name,
                    errors: validation.errors
                });
            }
        }

        if (validFiles.length === 0) {
            throw new Error('Nenhum arquivo válido para upload');
        }

        const formData = new FormData();
        validFiles.forEach(file => formData.append('images', file));
        if (folder) formData.append('folder', folder);

        try {
            const response = await fetch(`${this.apiBase}/multiple`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Erro no upload');
            }

            this.onSuccess(result.data);
            return result.data;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Upload de imagem base64
     */
    async uploadBase64(base64Data, folder = null, customName = null) {
        try {
            const response = await fetch(`${this.apiBase}/base64`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: base64Data,
                    folder: folder,
                    customName: customName
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Erro no upload');
            }

            this.onSuccess(result.data);
            return result.data;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Listar imagens
     */
    async listImages(folder = null) {
        try {
            const url = folder ? `${this.apiBase}/list/${folder}` : `${this.apiBase}/list`;
            const response = await fetch(url);
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Erro ao listar imagens');
            }

            return result.data;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Deletar imagem
     */
    async deleteImage(imagePath, folder = null) {
        try {
            const response = await fetch(`${this.apiBase}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imagePath: imagePath,
                    folder: folder
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Erro ao deletar imagem');
            }

            return result.data;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    /**
     * Criar interface de upload
     */
    createUploadInterface(container, options = {}) {
        const uploadContainer = document.createElement('div');
        uploadContainer.className = 'image-upload-interface';
        
        uploadContainer.innerHTML = `
            <div class="upload-area" id="upload-area">
                <div class="upload-content">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <h3>Arraste e solte suas imagens aqui</h3>
                    <p>ou clique para selecionar</p>
                    <input type="file" id="file-input" multiple accept="image/*" style="display: none;">
                    <button type="button" class="btn-select-files">Selecionar Arquivos</button>
                </div>
            </div>
            <div class="upload-preview" id="upload-preview"></div>
            <div class="upload-actions" style="display: none;">
                <button type="button" class="btn-upload-all">Enviar Todas</button>
                <button type="button" class="btn-clear-all">Limpar</button>
            </div>
        `;

        container.appendChild(uploadContainer);
        this.setupUploadEvents(uploadContainer, options);
        
        return uploadContainer;
    }

    /**
     * Configurar eventos de upload
     */
    setupUploadEvents(container, options) {
        const uploadArea = container.querySelector('#upload-area');
        const fileInput = container.querySelector('#file-input');
        const previewContainer = container.querySelector('#upload-preview');
        const btnSelectFiles = container.querySelector('.btn-select-files');
        const btnUploadAll = container.querySelector('.btn-upload-all');
        const btnClearAll = container.querySelector('.btn-clear-all');
        const uploadActions = container.querySelector('.upload-actions');

        let selectedFiles = [];

        // Eventos de drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        // Eventos de clique
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        btnSelectFiles.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });

        btnUploadAll.addEventListener('click', async () => {
            if (selectedFiles.length === 0) return;

            try {
                btnUploadAll.disabled = true;
                btnUploadAll.textContent = 'Enviando...';

                const result = await this.uploadMultiple(selectedFiles, options.folder);
                
                // Limpar preview
                previewContainer.innerHTML = '';
                selectedFiles = [];
                uploadActions.style.display = 'none';
                
                if (options.onUploadComplete) {
                    options.onUploadComplete(result);
                }

            } catch (error) {
                console.error('Erro no upload:', error);
                alert('Erro no upload: ' + error.message);
            } finally {
                btnUploadAll.disabled = false;
                btnUploadAll.textContent = 'Enviar Todas';
            }
        });

        btnClearAll.addEventListener('click', () => {
            previewContainer.innerHTML = '';
            selectedFiles = [];
            uploadActions.style.display = 'none';
        });

        function handleFiles(files) {
            const validFiles = [];
            const errors = [];

            for (const file of files) {
                const validation = this.validateFile(file);
                if (validation.valid) {
                    validFiles.push(file);
                    this.createPreview(file, previewContainer);
                } else {
                    errors.push({
                        file: file.name,
                        errors: validation.errors
                    });
                }
            }

            if (errors.length > 0) {
                const errorMessage = errors.map(e => `${e.file}: ${e.errors.join(', ')}`).join('\n');
                alert('Arquivos inválidos:\n' + errorMessage);
            }

            selectedFiles = validFiles;
            if (selectedFiles.length > 0) {
                uploadActions.style.display = 'block';
            }
        }
    }
}

// CSS para o componente
const imageUploadCSS = `
<style>
.image-upload-interface {
    border: 2px dashed #ddd;
    border-radius: 10px;
    padding: 20px;
    margin: 20px 0;
    background: #f9f9f9;
}

.upload-area {
    text-align: center;
    padding: 40px 20px;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 8px;
}

.upload-area:hover,
.upload-area.drag-over {
    background: #e3f2fd;
    border-color: #2196f3;
}

.upload-content i {
    font-size: 3rem;
    color: #2196f3;
    margin-bottom: 15px;
}

.upload-content h3 {
    margin: 10px 0;
    color: #333;
}

.upload-content p {
    color: #666;
    margin-bottom: 20px;
}

.btn-select-files {
    background: #2196f3;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
}

.btn-select-files:hover {
    background: #1976d2;
}

.upload-preview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
    margin: 20px 0;
}

.image-preview-item {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.preview-image {
    position: relative;
    width: 100%;
    height: 150px;
}

.preview-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preview-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.7);
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.image-preview-item:hover .preview-overlay {
    opacity: 1;
}

.preview-info {
    font-size: 12px;
}

.preview-actions {
    display: flex;
    justify-content: flex-end;
}

.btn-remove {
    background: #f44336;
    color: white;
    border: none;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-remove:hover {
    background: #d32f2f;
}

.upload-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 5px;
    font-size: 12px;
}

.progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255,255,255,0.3);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 5px;
}

.progress-fill {
    height: 100%;
    background: #4caf50;
    width: 0%;
    transition: width 0.3s ease;
}

.upload-actions {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-top: 20px;
}

.btn-upload-all,
.btn-clear-all {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 14px;
}

.btn-upload-all {
    background: #4caf50;
    color: white;
}

.btn-upload-all:hover {
    background: #45a049;
}

.btn-clear-all {
    background: #f44336;
    color: white;
}

.btn-clear-all:hover {
    background: #d32f2f;
}
</style>
`;

// Adicionar CSS ao documento
if (typeof document !== 'undefined') {
    document.head.insertAdjacentHTML('beforeend', imageUploadCSS);
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ImageUploader = ImageUploader;
}

// Exportar para módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageUploader;
}
