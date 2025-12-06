// JavaScript para a página de criar produto unificado
class ProductCreator {
    constructor() {
        this.currentStep = 1;
        this.selectedProductType = null;
        this.productData = {
            type: null,
            name: '',
            category: '',
            description: '',
            price: 0,
            finalPrice: 0,
            marketplace: false,
            image: null,
            contentLink: '',
            contentFile: null,
            observations: ''
        };
        
        this.initializeEventListeners();
        this.updateStepDisplay();
    }

    initializeEventListeners() {
        // Seleção de tipo de produto
        document.querySelectorAll('.product-type-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectProductType(card);
            });
        });

        // Toggle do marketplace
        document.getElementById('marketplaceToggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            this.productData.marketplace = e.target.classList.contains('active');
        });

        // Upload de imagem
        this.setupFileUpload('imageUpload', 'imageInput', 'imagePreview', 'imageContentPreview', this.handleImageUpload.bind(this));
        
        // Upload de conteúdo
        this.setupFileUpload('contentUpload', 'contentInput', 'contentPreview', 'contentContentPreview', this.handleContentUpload.bind(this));

        // Validação em tempo real
        this.setupRealTimeValidation();

        // Navegação entre etapas
        document.querySelectorAll('.step').forEach(step => {
            step.addEventListener('click', (e) => {
                const stepNumber = parseInt(e.currentTarget.dataset.step);
                this.goToStep(stepNumber);
            });
        });
    }

    selectProductType(card) {
        // Remover seleção anterior
        document.querySelectorAll('.product-type-card').forEach(c => c.classList.remove('selected'));
        
        // Selecionar novo tipo
        card.classList.add('selected');
        this.selectedProductType = card.dataset.type;
        this.productData.type = this.selectedProductType;
        
        // Marcar etapa 1 como completa e ir para etapa 2
        this.markStepCompleted(1);
        this.goToStep(2);
    }

    setupFileUpload(uploadAreaId, inputId, previewId, contentPreviewId, handler) {
        const uploadArea = document.getElementById(uploadAreaId);
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        const contentPreview = document.getElementById(contentPreviewId);

        // Clique para selecionar arquivo
        uploadArea.addEventListener('click', () => input.click());

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handler(files[0]);
            }
        });

        // Seleção de arquivo
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handler(e.target.files[0]);
            }
        });
    }

    handleImageUpload(file) {
        if (!file.type.startsWith('image/')) {
            this.showNotification('Por favor, selecione apenas arquivos de imagem.', 'error');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showNotification('A imagem deve ter no máximo 10MB.', 'error');
            return;
        }

        this.productData.image = file;
        
        // Mostrar preview
        const preview = document.getElementById('imagePreview');
        const contentPreview = document.getElementById('imageContentPreview');
        
        document.getElementById('imageName').textContent = file.name;
        document.getElementById('imageSize').textContent = this.formatFileSize(file.size);
        
        preview.classList.add('show');
        
        // Preview da imagem
        const reader = new FileReader();
        reader.onload = (e) => {
            contentPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            contentPreview.classList.add('show');
        };
        reader.readAsDataURL(file);

        // Marcar etapa 3 como completa
        this.markStepCompleted(3);
    }

    handleContentUpload(file) {
        const maxSize = 150 * 1024 * 1024; // 150MB
        if (file.size > maxSize) {
            this.showNotification('O arquivo deve ter no máximo 150MB.', 'error');
            return;
        }

        this.productData.contentFile = file;
        
        // Mostrar preview
        const preview = document.getElementById('contentPreview');
        const contentPreview = document.getElementById('contentContentPreview');
        
        document.getElementById('contentName').textContent = file.name;
        document.getElementById('contentSize').textContent = this.formatFileSize(file.size);
        
        // Ícone baseado no tipo de arquivo
        const icon = this.getFileIcon(file.type);
        document.getElementById('contentIcon').className = icon;
        
        preview.classList.add('show');
        
        // Preview baseado no tipo
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                contentPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                contentPreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                contentPreview.innerHTML = `<video controls><source src="${e.target.result}" type="${file.type}"></video>`;
                contentPreview.classList.add('show');
            };
            reader.readAsDataURL(file);
        }
    }

    getFileIcon(fileType) {
        if (fileType.includes('pdf')) return 'fas fa-file-pdf';
        if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
        if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel';
        if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fas fa-file-powerpoint';
        if (fileType.includes('zip') || fileType.includes('rar')) return 'fas fa-file-archive';
        if (fileType.includes('video')) return 'fas fa-file-video';
        if (fileType.includes('audio')) return 'fas fa-file-audio';
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    removeImage() {
        this.productData.image = null;
        document.getElementById('imagePreview').classList.remove('show');
        document.getElementById('imageContentPreview').classList.remove('show');
        document.getElementById('imageInput').value = '';
    }

    removeContent() {
        this.productData.contentFile = null;
        document.getElementById('contentPreview').classList.remove('show');
        document.getElementById('contentContentPreview').classList.remove('show');
        document.getElementById('contentInput').value = '';
    }

    setupRealTimeValidation() {
        // Validação do nome
        document.getElementById('productName').addEventListener('input', (e) => {
            this.validateField('productName', e.target.value.trim().length > 0, 'nameError');
            if (e.target.value.trim().length > 0) {
                this.productData.name = e.target.value.trim();
                this.markStepCompleted(2);
            }
        });

        // Validação da categoria
        document.getElementById('category').addEventListener('change', (e) => {
            this.validateField('category', e.target.value !== '', 'categoryError');
            if (e.target.value !== '') {
                this.productData.category = e.target.value;
                this.markStepCompleted(2);
            }
        });

        // Validação da descrição (mínimo 50 caracteres)
        const descriptionField = document.getElementById('description');
        if (descriptionField) {
            descriptionField.addEventListener('input', (e) => {
                const descValue = e.target.value.trim();
                const isValid = descValue.length >= 50;
                const errorElement = document.getElementById('descriptionError');
                
                if (isValid) {
                    this.validateField('description', true, 'descriptionError');
                    this.productData.description = descValue;
                    this.markStepCompleted(2);
                    if (errorElement) {
                        errorElement.textContent = '';
                        errorElement.style.display = 'none';
                    }
                } else {
                    const charsNeeded = 50 - descValue.length;
                    this.validateField('description', false, 'descriptionError');
                    if (errorElement) {
                        errorElement.textContent = `A descrição deve ter pelo menos 50 caracteres. Faltam ${charsNeeded} caractere${charsNeeded > 1 ? 's' : ''}.`;
                        errorElement.style.display = 'block';
                    }
                }
            });
            
            // Adicionar contador de caracteres
            const charCounter = document.createElement('div');
            charCounter.className = 'char-counter';
            charCounter.id = 'descriptionCharCounter';
            charCounter.style.cssText = 'font-size: 12px; color: #6c757d; margin-top: 5px; text-align: right;';
            descriptionField.parentElement.appendChild(charCounter);
            
            descriptionField.addEventListener('input', (e) => {
                const charCount = e.target.value.trim().length;
                charCounter.textContent = `${charCount}/50 caracteres mínimos`;
                if (charCount < 50) {
                    charCounter.style.color = '#ef4444';
                } else {
                    charCounter.style.color = '#10b981';
                    charCounter.textContent = `${charCount} caracteres ✓`;
                }
            });
        }

        // Validação dos preços
        document.getElementById('price').addEventListener('input', (e) => {
            const price = parseFloat(e.target.value);
            this.validateField('price', price > 0, 'priceError');
            if (price > 0) {
                this.productData.price = price;
                this.markStepCompleted(2);
            }
        });

        document.getElementById('finalPrice').addEventListener('input', (e) => {
            const price = parseFloat(e.target.value);
            this.validateField('finalPrice', price > 0, 'finalPriceError');
            if (price > 0) {
                this.productData.finalPrice = price;
                this.markStepCompleted(2);
            }
        });

        // Link do conteúdo
        document.getElementById('contentLink').addEventListener('input', (e) => {
            this.productData.contentLink = e.target.value;
        });

        // Observações
        document.getElementById('observations').addEventListener('input', (e) => {
            this.productData.observations = e.target.value;
        });
    }

    validateField(fieldId, isValid, errorId) {
        const field = document.getElementById(fieldId);
        const error = document.getElementById(errorId);
        
        if (isValid) {
            field.style.borderColor = '#28a745';
            error.classList.remove('show');
        } else {
            field.style.borderColor = '#dc3545';
            error.classList.add('show');
        }
    }

    markStepCompleted(stepNumber) {
        const step = document.getElementById(`step-${stepNumber}`);
        step.classList.add('completed');
        step.classList.remove('active');
    }

    goToStep(stepNumber) {
        // Verificar se pode ir para a etapa
        if (!this.canGoToStep(stepNumber)) {
            this.showNotification('Complete as etapas anteriores primeiro.', 'warning');
            return;
        }

        // Esconder todas as seções
        document.querySelectorAll('.step-section').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar seção atual
        document.getElementById(`section-${stepNumber}`).classList.add('active');

        // Atualizar sidebar
        document.querySelectorAll('.step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(`step-${stepNumber}`).classList.add('active');

        this.currentStep = stepNumber;
    }

    canGoToStep(stepNumber) {
        switch (stepNumber) {
            case 1:
                return true;
            case 2:
                return this.selectedProductType !== null;
            case 3:
                return this.selectedProductType !== null && this.isStep2Complete();
            case 4:
                return this.selectedProductType !== null && this.isStep2Complete() && this.productData.image !== null;
            default:
                return false;
        }
    }

    isStep2Complete() {
        return this.productData.name.length > 0 &&
               this.productData.category.length > 0 &&
               this.productData.description.length > 0 &&
               this.productData.price > 0 &&
               this.productData.finalPrice > 0;
    }

    updateStepDisplay() {
        // Atualizar display baseado no estado atual
        if (this.selectedProductType) {
            this.markStepCompleted(1);
        }
    }

    async createProduct() {
        // Validar dados obrigatórios
        if (!this.validateRequiredFields()) {
            return;
        }

        // Mostrar modal de progresso
        this.showProgressModal();

        try {
            // Simular verificação do produto
            await this.simulateProductVerification();

            // Criar produto
            const result = await this.submitProduct();

            if (result.success) {
                this.showProgressStep('Produto adicionado com sucesso!', 'Redirecionando...', 100);
                setTimeout(() => {
                    window.location.href = '/gestao-produtos.html';
                }, 2000);
            } else {
                this.hideProgressModal();
                // Verificar se é rejeição do Gemini AI
                if (result.error === 'PRODUTO_REJEITADO' && result.verificacao) {
                    // Usar a função global se existir, senão criar localmente
                    if (typeof showRejectionModal === 'function') {
                        showRejectionModal(result.verificacao, result.message);
                    } else {
                        this.showRejectionModal(result.verificacao, result.message);
                    }
                } else {
                    throw new Error(result.message || result.error || 'Erro ao criar produto');
                }
            }

        } catch (error) {
            console.error('Erro ao criar produto:', error);
            this.hideProgressModal();
            this.showNotification('Erro ao criar produto: ' + error.message, 'error');
        }
    }

    validateRequiredFields() {
        let isValid = true;

        // Validar campos obrigatórios
        const requiredFields = [
            { id: 'productName', errorId: 'nameError', message: 'Nome é obrigatório' },
            { id: 'category', errorId: 'categoryError', message: 'Categoria é obrigatória' },
            { id: 'description', errorId: 'descriptionError', message: 'Descrição é obrigatória' },
            { id: 'price', errorId: 'priceError', message: 'Preço é obrigatório' },
            { id: 'finalPrice', errorId: 'finalPriceError', message: 'Preço final é obrigatório' }
        ];

        requiredFields.forEach(field => {
            const element = document.getElementById(field.id);
            const value = element.type === 'number' ? parseFloat(element.value) : element.value.trim();
            let isFieldValid = element.type === 'number' ? value > 0 : value.length > 0;
            
            // Validação específica para descrição - mínimo de 50 caracteres
            if (field.id === 'description') {
                isFieldValid = value.length >= 50;
                if (!isFieldValid) {
                    const charsNeeded = 50 - value.length;
                    const errorElement = document.getElementById(field.errorId);
                    if (errorElement) {
                        errorElement.textContent = `A descrição deve ter pelo menos 50 caracteres. Faltam ${charsNeeded} caractere${charsNeeded > 1 ? 's' : ''}.`;
                        errorElement.style.display = 'block';
                    }
                }
            }
            
            if (!isFieldValid) {
                this.validateField(field.id, false, field.errorId);
                isValid = false;
            }
        });

        // Validar imagem
        if (!this.productData.image) {
            this.showNotification('Por favor, selecione uma imagem para o produto.', 'error');
            isValid = false;
        }

        return isValid;
    }

    showProgressModal() {
        document.getElementById('progressModal').classList.add('show');
    }

    hideProgressModal() {
        document.getElementById('progressModal').classList.remove('show');
    }

    showProgressStep(text, subtext, progress) {
        document.getElementById('progressText').textContent = text;
        document.getElementById('progressSubtext').textContent = subtext;
        document.getElementById('progressFill').style.width = progress + '%';
    }

    async simulateProductVerification() {
        const steps = [
            { text: 'Verificando o produto...', subtext: 'Validando informações básicas', progress: 25 },
            { text: 'Verificando conteúdo impróprio...', subtext: 'Analisando imagens e arquivos', progress: 50 },
            { text: 'Verificação de legitimidade...', subtext: 'Confirmando autenticidade do produto', progress: 75 },
            { text: 'Produto adicionado!', subtext: 'Salvando no banco de dados', progress: 100 }
        ];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            this.showProgressStep(step.text, step.subtext, step.progress);
            
            if (i < steps.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
    }

    async submitProduct() {
        // Criar FormData para envio
        const formData = new FormData();
        
        // Adicionar dados do produto
        formData.append('type', this.productData.type);
        formData.append('name', this.productData.name);
        formData.append('category', this.productData.category);
        formData.append('description', this.productData.description);
        formData.append('price', this.productData.price);
        formData.append('finalPrice', this.productData.finalPrice);
        formData.append('marketplace', this.productData.marketplace);
        formData.append('contentLink', this.productData.contentLink);
        formData.append('observations', this.productData.observations);

        // Adicionar imagem
        if (this.productData.image) {
            formData.append('image', this.productData.image);
        }

        // Adicionar arquivo de conteúdo
        if (this.productData.contentFile) {
            formData.append('contentFile', this.productData.contentFile);
        }

        // Enviar para o servidor
        const response = await fetch('/api/produtos/unificado', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });

        const result = await response.json();
        return result;
    }

    showRejectionModal(verificacao, message) {
        // Usar a mesma função do criar-produto.js se disponível
        if (typeof showRejectionModal === 'function') {
            showRejectionModal(verificacao, message);
        } else {
            // Fallback: mostrar alerta com o motivo
            const motivo = verificacao.motivo || 'Não atende aos critérios da plataforma';
            alert(`Produto não aprovado:\n\n${motivo}\n\nPor favor, revise as informações do produto e tente novamente.`);
        }
    }

    showNotification(message, type = 'info') {
        // Criar notificação
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Adicionar estilos
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#17a2b8'};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 1001;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Remover após 5 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
}

// Inicializar quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', function() {
    window.productCreator = new ProductCreator();
});

// Funções globais para compatibilidade com HTML
function removeImage() {
    if (window.productCreator) {
        window.productCreator.removeImage();
    }
}

function removeContent() {
    if (window.productCreator) {
        window.productCreator.removeContent();
    }
}

function createProduct() {
    if (window.productCreator) {
        window.productCreator.createProduct();
    }
}

// Adicionar estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
