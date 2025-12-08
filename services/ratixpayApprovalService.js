const axios = require('axios');

/**
 * Serviço para integração com a API de aprovação de produtos da RatixPay
 * API: https://api.ratixpay.site/analisar
 */
class RatixpayApprovalService {
    constructor() {
        this.apiBaseUrl = process.env.RATIXPAY_API_URL || 'https://api.ratixpay.site';
        this.timeout = 60000; // 60 segundos (aumentado de 30s)
        this.maxRetries = 3; // Número máximo de tentativas
        this.retryDelay = 2000; // Delay entre tentativas (2 segundos)
    }

    /**
     * Aguarda um tempo antes de tentar novamente
     * @param {number} ms - Milissegundos para aguardar
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Verifica se o erro é de comunicação (timeout, conexão, etc)
     * @param {Error} error - Erro a verificar
     * @returns {boolean}
     */
    isCommunicationError(error) {
        const communicationErrors = [
            'ECONNABORTED',
            'ETIMEDOUT',
            'ECONNREFUSED',
            'ENOTFOUND',
            'ENETUNREACH',
            'ECONNRESET',
            'ETIMEDOUT'
        ];
        return communicationErrors.includes(error.code) || 
               (error.message && error.message.includes('timeout'));
    }

    /**
     * Analisa um produto e retorna se está aprovado ou rejeitado
     * Implementa retry automático para erros de comunicação
     * @param {Object} produtoData - Dados do produto para análise
     * @param {string} produtoData.nome - Nome do produto
     * @param {string} produtoData.descricao - Descrição detalhada
     * @param {string} produtoData.tipo - Tipo do produto
     * @param {string} produtoData.categoria - Categoria
     * @param {string} [produtoData.link_conteudo] - URL opcional do conteúdo
     * @param {string} [produtoData.link_imagem] - URL opcional da imagem
     * @param {number} [retryCount=0] - Contador de tentativas (usado internamente)
     * @returns {Promise<Object>} - { status: 'aprovado'|'rejeitado'|'erro_comunicacao', motivo: string }
     */
    async analisarProduto(produtoData, retryCount = 0) {
        try {
            // Validar dados obrigatórios
            if (!produtoData.nome || !produtoData.descricao || !produtoData.tipo || !produtoData.categoria) {
                throw new Error('Dados obrigatórios não fornecidos: nome, descricao, tipo e categoria são obrigatórios');
            }

            // Preparar body da requisição
            const requestBody = {
                nome: produtoData.nome,
                descricao: produtoData.descricao,
                tipo: produtoData.tipo,
                categoria: produtoData.categoria
            };

            // Adicionar campos opcionais se fornecidos
            if (produtoData.link_conteudo) {
                requestBody.link_conteudo = produtoData.link_conteudo;
            }

            if (produtoData.link_imagem || produtoData.imagem_url) {
                requestBody.link_imagem = produtoData.link_imagem || produtoData.imagem_url;
            }

            if (retryCount === 0) {
                console.log('🔍 Enviando produto para análise na API RatixPay...');
            } else {
                console.log(`🔄 Tentativa ${retryCount + 1}/${this.maxRetries + 1} de análise na API RatixPay...`);
            }

            // Fazer requisição para a API
            const response = await axios.post(
                `${this.apiBaseUrl}/analisar`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'RatixPay-ProductApproval/1.0'
                    },
                    timeout: this.timeout,
                    validateStatus: (status) => status < 500 // Aceitar erros 4xx mas não 5xx
                }
            );

            console.log('✅ Resposta da API RatixPay:', response.data);

            // Validar resposta
            if (!response.data || typeof response.data.status === 'undefined') {
                throw new Error('Resposta inválida da API de aprovação');
            }

            return {
                status: response.data.status, // 'aprovado' ou 'rejeitado'
                motivo: response.data.motivo || ''
            };

        } catch (error) {
            // Se for erro de comunicação e ainda temos tentativas, fazer retry
            if (this.isCommunicationError(error) && retryCount < this.maxRetries) {
                console.warn(`⚠️ Erro de comunicação na tentativa ${retryCount + 1}: ${error.code || error.message}`);
                console.log(`🔄 Aguardando ${this.retryDelay}ms antes de tentar novamente...`);
                
                await this.sleep(this.retryDelay);
                
                // Tentar novamente com backoff exponencial
                const nextRetryDelay = this.retryDelay * (retryCount + 1);
                this.retryDelay = Math.min(nextRetryDelay, 10000); // Máximo 10 segundos
                
                return this.analisarProduto(produtoData, retryCount + 1);
            }

            // Se esgotou as tentativas ou é outro tipo de erro
            if (this.isCommunicationError(error)) {
                console.error(`❌ Erro de comunicação após ${retryCount + 1} tentativas:`, error.code || error.message);
                return {
                    status: 'erro_comunicacao',
                    motivo: `Erro de comunicação com o serviço de aprovação após ${retryCount + 1} tentativas. O produto será revisado manualmente pelo administrador.`
                };
            }

            // Se a API retornou erro HTTP (4xx - erro do cliente)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                console.error('📡 Erro HTTP da API RatixPay:', error.response.status, error.response.data);
                return {
                    status: 'rejeitado',
                    motivo: error.response.data?.motivo || error.response.data?.message || `Erro no serviço de aprovação: ${error.response.status}`
                };
            }

            // Se a API retornou erro HTTP 5xx (erro do servidor)
            if (error.response && error.response.status >= 500) {
                console.error('📡 Erro do servidor da API RatixPay:', error.response.status);
                return {
                    status: 'erro_comunicacao',
                    motivo: 'Erro temporário no serviço de aprovação. O produto será revisado manualmente pelo administrador.'
                };
            }

            // Erro genérico
            console.error('❌ Erro ao analisar produto na API RatixPay:', error.message);
            return {
                status: 'erro_comunicacao',
                motivo: `Erro ao processar aprovação: ${error.message}. O produto será revisado manualmente pelo administrador.`
            };
        }
    }

    /**
     * Verifica se a API está disponível
     * @returns {Promise<boolean>}
     */
    async verificarDisponibilidade() {
        try {
            // Tentar fazer uma requisição simples (pode ser um endpoint de health check se existir)
            // Por enquanto, vamos apenas verificar se conseguimos fazer uma requisição
            const response = await axios.get(`${this.apiBaseUrl}`, {
                timeout: 5000,
                validateStatus: () => true // Aceitar qualquer status
            });
            return true;
        } catch (error) {
            console.warn('⚠️ API RatixPay pode estar indisponível:', error.message);
            return false;
        }
    }
}

module.exports = new RatixpayApprovalService();

