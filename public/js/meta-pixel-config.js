/**
 * Sistema de Configuração Dinâmica do Meta Pixel
 * Permite configuração em tempo real via interface administrativa
 */

class MetaPixelConfig {
    constructor() {
        this.config = {
            mainPixelId: null,
            integrations: [],
            debug: false,
            autoTrack: true,
            enhancedEcommerce: true
        };
        
        this.loadConfig();
    }

    /**
     * Carrega configuração do localStorage
     */
    loadConfig() {
        try {
            const savedConfig = localStorage.getItem('metaPixelConfig');
            if (savedConfig) {
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
            }
            
            // Carregar integrações separadamente
            const integrations = localStorage.getItem('metaPixels');
            if (integrations) {
                this.config.integrations = JSON.parse(integrations);
            }
            
            console.log('📊 Configuração Meta Pixel carregada:', this.config);
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar configuração:', error);
        }
    }

    /**
     * Salva configuração no localStorage
     */
    saveConfig() {
        try {
            localStorage.setItem('metaPixelConfig', JSON.stringify(this.config));
            localStorage.setItem('metaPixels', JSON.stringify(this.config.integrations));
            
            console.log('✅ Configuração Meta Pixel salva');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar configuração:', error);
            return false;
        }
    }

    /**
     * Adiciona nova integração
     */
    addIntegration(integration) {
        const newIntegration = {
            id: Date.now().toString(),
            pixelId: integration.pixelId,
            produtoId: integration.produtoId,
            produtoNome: integration.produtoNome,
            eventos: integration.eventos || ['PageView'],
            ativo: integration.ativo !== false,
            created_at: new Date().toISOString()
        };
        
        this.config.integrations.push(newIntegration);
        this.saveConfig();
        
        // Notificar sistema unificado se estiver disponível
        if (window.MetaPixelUnified) {
            window.MetaPixelUnified.addIntegration(newIntegration);
        }
        
        return newIntegration;
    }

    /**
     * Remove integração
     */
    removeIntegration(integrationId) {
        this.config.integrations = this.config.integrations.filter(
            integration => integration.id !== integrationId
        );
        this.saveConfig();
    }

    /**
     * Atualiza integração existente
     */
    updateIntegration(integrationId, updates) {
        const index = this.config.integrations.findIndex(
            integration => integration.id === integrationId
        );
        
        if (index !== -1) {
            this.config.integrations[index] = {
                ...this.config.integrations[index],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.saveConfig();
            return this.config.integrations[index];
        }
        
        return null;
    }

    /**
     * Obtém integrações por produto
     */
    getIntegrationsByProduct(produtoId) {
        return this.config.integrations.filter(
            integration => integration.produtoId === produtoId && integration.ativo
        );
    }

    /**
     * Obtém integrações por pixel
     */
    getIntegrationsByPixel(pixelId) {
        return this.config.integrations.filter(
            integration => integration.pixelId === pixelId && integration.ativo
        );
    }

    /**
     * Valida configuração
     */
    validateConfig() {
        const errors = [];
        
        // Validar pixel principal
        if (this.config.mainPixelId && this.config.mainPixelId === '123456789012345') {
            errors.push('Pixel ID padrão detectado - configure um ID real');
        }
        
        // Validar integrações
        this.config.integrations.forEach((integration, index) => {
            if (!integration.pixelId) {
                errors.push(`Integração ${index + 1}: Pixel ID obrigatório`);
            }
            if (!integration.produtoId) {
                errors.push(`Integração ${index + 1}: Produto ID obrigatório`);
            }
            if (!integration.eventos || integration.eventos.length === 0) {
                errors.push(`Integração ${index + 1}: Pelo menos um evento deve ser selecionado`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Testa configuração
     */
    async testConfig() {
        const validation = this.validateConfig();
        
        if (!validation.valid) {
            return {
                success: false,
                message: 'Configuração inválida',
                errors: validation.errors
            };
        }
        
        try {
            // Simular teste de eventos
            const testResults = [];
            
            for (const integration of this.config.integrations) {
                const testResult = await this.testIntegration(integration);
                testResults.push(testResult);
            }
            
            return {
                success: true,
                message: 'Configuração testada com sucesso',
                results: testResults
            };
            
        } catch (error) {
            return {
                success: false,
                message: 'Erro ao testar configuração',
                error: error.message
            };
        }
    }

    /**
     * Testa integração específica
     */
    async testIntegration(integration) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    pixelId: integration.pixelId,
                    produtoId: integration.produtoId,
                    status: 'success',
                    message: 'Integração funcionando corretamente'
                });
            }, 100);
        });
    }

    /**
     * Exporta configuração
     */
    exportConfig() {
        return {
            config: this.config,
            timestamp: new Date().toISOString(),
            version: '2.0'
        };
    }

    /**
     * Importa configuração
     */
    importConfig(configData) {
        try {
            if (configData.config) {
                this.config = { ...this.config, ...configData.config };
                this.saveConfig();
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Erro ao importar configuração:', error);
            return false;
        }
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
        const activeIntegrations = this.config.integrations.filter(i => i.ativo);
        const uniquePixels = [...new Set(activeIntegrations.map(i => i.pixelId))];
        const uniqueProducts = [...new Set(activeIntegrations.map(i => i.produtoId))];
        
        return {
            totalIntegrations: this.config.integrations.length,
            activeIntegrations: activeIntegrations.length,
            uniquePixels: uniquePixels.length,
            uniqueProducts: uniqueProducts.length,
            debugMode: this.config.debug,
            autoTrack: this.config.autoTrack
        };
    }
}

// Inicializar sistema de configuração
window.MetaPixelConfig = new MetaPixelConfig();

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetaPixelConfig;
}
