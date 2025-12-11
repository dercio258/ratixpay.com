const axios = require('axios');

class PayMozService {
    constructor() {
        this.baseUrl = 'https://paymoz.tech/api/v1';
        this.apiKey = process.env.PayMozApiKey || '';
        // Timeout aumentado para 60 segundos (servidor pode demorar para responder)
        this.timeoutMs = 60000;
        // Configurações de retry para rate limiting e timeout
        this.maxRetries = 4; // Número máximo de tentativas (aumentado para timeouts)
        this.initialRetryDelay = 2000; // Delay inicial em ms (2 segundos)
        this.maxRetryDelay = 60000; // Delay máximo em ms (60 segundos)
        this.timeoutRetryDelay = 5000; // Delay específico para timeouts (5 segundos)
    }

    /**
     * Aguarda um tempo antes de tentar novamente (backoff exponencial)
     * @param {number} attempt - Número da tentativa atual
     * @param {boolean} isTimeout - Se o erro foi timeout
     * @returns {Promise<void>}
     */
    async waitBeforeRetry(attempt, isTimeout = false) {
        let delay;
        
        if (isTimeout) {
            // Para timeouts, usar delay maior e mais constante
            delay = Math.min(
                this.timeoutRetryDelay * attempt, // Delay crescente: 5s, 10s, 15s, 20s
                this.maxRetryDelay
            );
            console.log(`⏳ Timeout detectado - Aguardando ${delay}ms antes da tentativa ${attempt + 1}/${this.maxRetries}...`);
        } else {
            // Backoff exponencial para outros erros: delay = initialDelay * 2^(attempt-1)
            delay = Math.min(
                this.initialRetryDelay * Math.pow(2, attempt - 1),
                this.maxRetryDelay
            );
            console.log(`⏳ Aguardando ${delay}ms antes da tentativa ${attempt + 1}/${this.maxRetries}...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Verifica se o erro é um rate limit (429) ou timeout e se deve tentar novamente
     * @param {Error} error - Erro da requisição
     * @param {number} attempt - Número da tentativa atual
     * @returns {Object} - { shouldRetry: boolean, isTimeout: boolean }
     */
    shouldRetry(error, attempt) {
        // Verificar se é timeout
        const isTimeout = error.code === 'ECONNABORTED' || 
                         error.code === 'ETIMEDOUT' ||
                         error.message?.toLowerCase().includes('timeout');
        
        // Verificar se é erro 429 (Rate Limit Exceeded) no status HTTP
        if (error.response?.status === 429) {
            return { shouldRetry: attempt < this.maxRetries, isTimeout: false };
        }
        
        // Verificar se o erro 429 está na resposta da API (mesmo com status 400 ou 200)
        const errorMessage = (error.response?.data?.erro || 
                             error.response?.data?.mensagem || 
                             error.message || '').toLowerCase();
        
        if (errorMessage.includes('429') || 
            errorMessage.includes('rate limit') || 
            errorMessage.includes('rate_limit')) {
            return { shouldRetry: attempt < this.maxRetries, isTimeout: false };
        }
        
        // Retryar em erros de timeout (com mais tentativas)
        if (isTimeout) {
            return { shouldRetry: attempt < this.maxRetries, isTimeout: true };
        }
        
        // Retryar em erros de rede (5xx)
        if (error.response?.status >= 500 && error.response?.status < 600) {
            return { shouldRetry: attempt < this.maxRetries, isTimeout: false };
        }
        
        return { shouldRetry: false, isTimeout: false };
    }

    /**
     * Processa um pagamento via PayMoz
     * @param {string} method - Método de pagamento: "mpesa" ou "emola"
     * @param {number|string} amount - Valor a ser cobrado (ex: 150.00)
     * @param {string} phone - Número de celular do cliente (ex: "841234567")
     * @param {string} externalReference - Referência externa do sistema (ex: ID do pedido)
     * @returns {Promise<Object>} Resultado do pagamento
     */
    async processPayment(method, amount, phone, externalReference = '') {
        try {
            // Validar método
            const metodo = String(method || '').toLowerCase();
            
            // MPESA agora é processado pela GibraPay - apenas Emola usa PayMoz
            if (metodo === 'mpesa') {
                throw new Error('MPESA deve ser processado via GibraPay. Use gibrapayService para MPESA.');
            }
            
            if (metodo !== 'emola') {
                throw new Error('Método inválido. PayMoz processa apenas "emola". Use "gibrapayService" para "mpesa"');
            }

            // Validar API Key
            if (!this.apiKey || this.apiKey.trim().length === 0) {
                throw new Error('PayMozApiKey não configurada no .env');
            }

            // Formatar valor como string com 2 casas decimais
            const valorFormatado = parseFloat(amount).toFixed(2);

            // URL do endpoint
            const url = `${this.baseUrl}/pagamentos/processar/`;

            // Payload conforme documentação
            const payload = {
                metodo: metodo,
                valor: valorFormatado,
                numero_celular: String(phone),
                referencia_externa: externalReference || `Pedido_${Date.now()}`
            };

            console.log(`📤 Enviando pagamento PayMoz:`, {
                metodo: payload.metodo,
                valor: payload.valor,
                numero_celular: payload.numero_celular.substring(0, 3) + '***',
                referencia_externa: payload.referencia_externa
            });

            // Fazer requisição com retry automático para rate limiting
            let response;
            let lastError;
            
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        // Verificar se o último erro foi timeout para usar delay apropriado
                        const isLastErrorTimeout = lastError && (
                            lastError.code === 'ECONNABORTED' || 
                            lastError.code === 'ETIMEDOUT' ||
                            lastError.message?.toLowerCase().includes('timeout')
                        );
                        await this.waitBeforeRetry(attempt, isLastErrorTimeout);
                    }
                    
                    response = await axios.post(url, payload, {
                        headers: {
                            'Authorization': `ApiKey ${this.apiKey.trim()}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: this.timeoutMs
                    });
                    
                    // Verificar se a resposta contém erro 429 mesmo com status HTTP 200/400
                    const responseData = response.data || {};
                    const errorMessage = (responseData.erro || responseData.mensagem || '').toLowerCase();
                    
                    if (errorMessage.includes('429') || 
                        errorMessage.includes('rate limit') || 
                        errorMessage.includes('rate_limit')) {
                        
                        // Criar um erro simulado para fazer retry
                        const rateLimitError = new Error(errorMessage);
                        rateLimitError.response = {
                            status: 429,
                            data: responseData
                        };
                        
                        const retryInfo = this.shouldRetry(rateLimitError, attempt);
                        if (retryInfo.shouldRetry) {
                            console.warn(`⚠️ Rate Limit detectado na resposta (tentativa ${attempt + 1}/${this.maxRetries + 1}):`, {
                                status: response.status,
                                message: responseData.erro || responseData.mensagem,
                                retrying: true
                            });
                            lastError = rateLimitError;
                            continue; // Tentar novamente
                        } else {
                            // Não deve tentar novamente, lançar o erro
                            throw rateLimitError;
                        }
                    }
                    
                    // Se chegou aqui, a requisição foi bem-sucedida e não tem erro 429
                    break;
                    
                } catch (error) {
                    lastError = error;
                    
                    // Verificar se deve tentar novamente
                    const retryInfo = this.shouldRetry(error, attempt);
                    if (retryInfo.shouldRetry) {
                        const errorType = retryInfo.isTimeout ? 'Timeout' : 'Erro';
                        console.warn(`⚠️ ${errorType} na tentativa ${attempt + 1}/${this.maxRetries + 1}:`, {
                            status: error.response?.status,
                            code: error.code,
                            message: error.response?.data?.erro || error.response?.data?.mensagem || error.message,
                            retrying: true,
                            nextDelay: retryInfo.isTimeout ? 
                                Math.min(this.timeoutRetryDelay * (attempt + 1), this.maxRetryDelay) : 
                                Math.min(this.initialRetryDelay * Math.pow(2, attempt), this.maxRetryDelay)
                        });
                        continue; // Tentar novamente
                    } else {
                        // Não deve tentar novamente, lançar o erro
                        throw error;
                    }
                }
            }
            
            // Se não conseguiu fazer a requisição após todas as tentativas
            if (!response && lastError) {
                throw lastError;
            }

            const data = response.data || {};

            // Verificar se a resposta tem sucesso
            if (data.sucesso === true && data.dados) {
                const dados = data.dados;
                
                // Usar output_ThirdPartyReference como transaction_id (como solicitado)
                const transactionId = dados.output_ThirdPartyReference || 
                                     dados.output_TransactionID || 
                                     `paymoz_${Date.now()}`;

                console.log(`✅ Pagamento PayMoz processado com sucesso:`, {
                    transaction_id: transactionId,
                    output_TransactionID: dados.output_TransactionID,
                    output_ThirdPartyReference: dados.output_ThirdPartyReference,
                    output_ResponseCode: dados.output_ResponseCode
                });

                return {
                    success: true,
                    transaction_id: transactionId, // output_ThirdPartyReference
                    status: 'approved', // PayMoz processou com sucesso
                    message: data.mensagem || 'Pagamento processado com sucesso',
                    paid_amount: parseFloat(valorFormatado),
                    customer_phone: String(phone),
                    data: {
                        output_TransactionID: dados.output_TransactionID,
                        output_ConversationID: dados.output_ConversationID,
                        output_ThirdPartyReference: dados.output_ThirdPartyReference,
                        output_ResponseCode: dados.output_ResponseCode,
                        output_ResponseDesc: dados.output_ResponseDesc,
                        ...data
                    }
                };
            } else {
                // Resposta sem sucesso
                const errorMessage = data.mensagem || data.erro || 'Erro ao processar pagamento';
                
                // Verificar se o erro é rate limit (mesmo que venha na resposta, não no status HTTP)
                const isRateLimit = errorMessage.toLowerCase().includes('429') || 
                                  errorMessage.toLowerCase().includes('rate limit') ||
                                  errorMessage.toLowerCase().includes('rate_limit');
                
                if (isRateLimit) {
                    console.error('❌ Rate Limit Exceeded detectado na resposta PayMoz:', errorMessage);
                    return {
                        success: false,
                        status: 'rate_limited',
                        message: 'Muitas requisições seguidas. Por favor, aguarde alguns instantes antes de tentar novamente.',
                        error: 'RATE_LIMIT_EXCEEDED',
                        data: data
                    };
                }
                
                console.error('❌ PayMoz retornou resposta sem sucesso:', errorMessage);
                
                return {
                    success: false,
                    status: 'error',
                    message: errorMessage,
                    data: data
                };
            }

        } catch (error) {
            const errData = error.response?.data;
            const statusCode = error.response?.status;
            
            // Verificar se é rate limit (no status HTTP ou na mensagem de erro)
            const errorMessageRaw = errData?.erro || 
                                  errData?.mensagem || 
                                  error.message || 
                                  '';
            
            const isRateLimit = statusCode === 429 || 
                              errorMessageRaw.toLowerCase().includes('429') ||
                              errorMessageRaw.toLowerCase().includes('rate limit') ||
                              errorMessageRaw.toLowerCase().includes('rate_limit');
            
            // Mensagem específica para rate limit
            let errorMessage;
            if (isRateLimit) {
                errorMessage = 'Muitas requisições seguidas. Por favor, aguarde alguns instantes antes de tentar novamente.';
                console.error('❌ Rate Limit Exceeded (429) - PayMoz bloqueou temporariamente:', {
                    message: errorMessage,
                    originalMessage: errorMessageRaw,
                    status: statusCode,
                    attempts: this.maxRetries + 1,
                    suggestion: 'Aguarde alguns minutos antes de fazer nova tentativa'
                });
            } else {
                errorMessage = errorMessageRaw || 'Erro ao processar pagamento';
            }
            
            console.error('❌ Erro no pagamento PayMoz:', {
                message: errorMessage,
                status: statusCode,
                data: errData,
                attempts: this.maxRetries + 1,
                isRateLimit: isRateLimit
            });

            return {
                success: false,
                status: isRateLimit ? 'rate_limited' : 'cancelled',
                message: errorMessage,
                error: isRateLimit ? 'RATE_LIMIT_EXCEEDED' : undefined,
                data: errData || {}
            };
        }
    }

    /**
     * Verifica o status de um pagamento (se a API suportar)
     * @param {string} transactionId - ID da transação
     * @returns {Promise<Object|null>} Status do pagamento ou null se não disponível
     */
    async checkPaymentStatus(transactionId) {
        // Se a API de status não estiver disponível, retornamos null para manter o fluxo atual
        // Implementar quando a API PayMoz disponibilizar endpoint de status
        return null;
    }
}

module.exports = new PayMozService();

