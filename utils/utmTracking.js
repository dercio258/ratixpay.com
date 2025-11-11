/**
 * Utilitário para captura, normalização e gerenciamento de parâmetros UTM
 * 
 * @module utils/utmTracking
 */

/**
 * Captura e normaliza parâmetros UTM de múltiplas fontes
 * 
 * @param {Object} sources - Fontes de dados UTM
 * @param {Object} sources.reqBody - Parâmetros do body da requisição
 * @param {Object} sources.reqQuery - Parâmetros da query string
 * @param {Object} sources.analytics - Dados do middleware analytics
 * @param {Object} sources.trackingData - Dados salvos anteriormente (tracking_data)
 * @param {Object} sources.localStorage - Dados do localStorage (frontend)
 * @param {string} sources.ip - IP do cliente
 * @returns {Object} Parâmetros UTM normalizados
 */
function captureUTMParameters(sources = {}) {
    const {
        reqBody = {},
        reqQuery = {},
        analytics = {},
        trackingData = {},
        localStorage = {},
        ip = null
    } = sources;

    // Função auxiliar para normalizar valores (remove espaços, converte para string, trata null/undefined)
    const normalize = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const str = String(value).trim();
        return str.length > 0 ? str : null;
    };

    // Prioridade de captura:
    // 1. reqBody (dados enviados pelo frontend - maior prioridade)
    // 2. trackingData (dados já salvos - preserva histórico)
    // 3. reqQuery (URL query string)
    // 4. analytics (middleware analytics)
    // 5. localStorage (frontend - fallback)

    const utmParams = {
        utm_source: normalize(
            reqBody.utm_source || 
            reqBody.utmSource ||
            trackingData.utm_source ||
            reqQuery.utm_source ||
            reqQuery.utmSource ||
            analytics.utmSource ||
            localStorage.utm_source ||
            null
        ),
        utm_medium: normalize(
            reqBody.utm_medium ||
            reqBody.utmMedium ||
            trackingData.utm_medium ||
            reqQuery.utm_medium ||
            reqQuery.utmMedium ||
            analytics.utmMedium ||
            localStorage.utm_medium ||
            null
        ),
        utm_campaign: normalize(
            reqBody.utm_campaign ||
            reqBody.utmCampaign ||
            trackingData.utm_campaign ||
            reqQuery.utm_campaign ||
            reqQuery.utmCampaign ||
            analytics.utmCampaign ||
            localStorage.utm_campaign ||
            null
        ),
        utm_content: normalize(
            reqBody.utm_content ||
            reqBody.utmContent ||
            trackingData.utm_content ||
            reqQuery.utm_content ||
            reqQuery.utmContent ||
            analytics.utmContent ||
            localStorage.utm_content ||
            null
        ),
        utm_term: normalize(
            reqBody.utm_term ||
            reqBody.utmTerm ||
            trackingData.utm_term ||
            reqQuery.utm_term ||
            reqQuery.utmTerm ||
            analytics.utmTerm ||
            localStorage.utm_term ||
            null
        ),
        src: normalize(
            reqBody.src ||
            trackingData.src ||
            reqQuery.src ||
            localStorage.src ||
            null
        ),
        sck: normalize(
            reqBody.sck ||
            trackingData.sck ||
            reqQuery.sck ||
            localStorage.sck ||
            null
        ),
        ip: normalize(ip || trackingData.ip || null)
    };

    // Adicionar metadados de captura
    utmParams._metadata = {
        captured_at: new Date().toISOString(),
        has_utm_source: !!utmParams.utm_source,
        has_utm_campaign: !!utmParams.utm_campaign,
        has_utm_medium: !!utmParams.utm_medium,
        has_any_utm: !!(utmParams.utm_source || utmParams.utm_campaign || utmParams.utm_medium),
        sources_used: {
            reqBody: !!(reqBody.utm_source || reqBody.utm_campaign),
            trackingData: !!(trackingData.utm_source || trackingData.utm_campaign),
            reqQuery: !!(reqQuery.utm_source || reqQuery.utm_campaign),
            analytics: !!(analytics.utmSource || analytics.utmCampaign),
            localStorage: !!(localStorage.utm_source || localStorage.utm_campaign)
        }
    };

    return utmParams;
}

/**
 * Prepara tracking_data para salvar no banco de dados
 * Remove campos temporários e metadados internos
 * 
 * @param {Object} utmParams - Parâmetros UTM normalizados
 * @param {Object} options - Opções adicionais
 * @param {boolean} options.includeMetadata - Incluir metadados (default: false)
 * @param {boolean} options.includeIP - Incluir IP (default: false, pois IP é salvo separadamente)
 * @returns {Object} tracking_data pronto para salvar
 */
function prepareTrackingDataForDB(utmParams, options = {}) {
    const {
        includeMetadata = false,
        includeIP = false
    } = options;

    const trackingData = {
        utm_source: utmParams.utm_source || null,
        utm_medium: utmParams.utm_medium || null,
        utm_campaign: utmParams.utm_campaign || null,
        utm_content: utmParams.utm_content || null,
        utm_term: utmParams.utm_term || null,
        src: utmParams.src || null,
        sck: utmParams.sck || null
    };

    // Incluir IP apenas se solicitado
    if (includeIP && utmParams.ip) {
        trackingData.ip = utmParams.ip;
    }

    // Incluir metadados apenas se solicitado (útil para debug)
    if (includeMetadata && utmParams._metadata) {
        trackingData._metadata = utmParams._metadata;
    }

    // Adicionar timestamp de criação/atualização
    trackingData.updated_at = new Date().toISOString();
    if (!trackingData.created_at) {
        trackingData.created_at = new Date().toISOString();
    }

    return trackingData;
}

/**
 * Mescla tracking_data existente com novos parâmetros
 * Preserva dados existentes e atualiza apenas campos não-nulos
 * 
 * @param {Object} existingData - tracking_data existente
 * @param {Object} newData - Novos parâmetros UTM
 * @returns {Object} tracking_data mesclado
 */
function mergeTrackingData(existingData = {}, newData = {}) {
    const merged = {
        ...existingData,
        ...newData
    };

    // Preservar campos especiais (não sobrescrever se já existirem)
    if (existingData.utmfy_enviado !== undefined) {
        merged.utmfy_enviado = existingData.utmfy_enviado;
    }
    if (existingData.utmfy_enviado_em) {
        merged.utmfy_enviado_em = existingData.utmfy_enviado_em;
    }
    if (existingData.created_at) {
        merged.created_at = existingData.created_at;
    }

    // Atualizar timestamp
    merged.updated_at = new Date().toISOString();

    // Remover campos null/undefined para manter limpo
    Object.keys(merged).forEach(key => {
        if (merged[key] === null || merged[key] === undefined) {
            delete merged[key];
        }
    });

    return merged;
}

/**
 * Valida se os parâmetros UTM são válidos
 * 
 * @param {Object} utmParams - Parâmetros UTM
 * @returns {Object} Resultado da validação
 */
function validateUTMParameters(utmParams) {
    const errors = [];
    const warnings = [];

    // Validar comprimento máximo (evitar valores muito longos)
    const maxLength = 500;
    Object.keys(utmParams).forEach(key => {
        if (key.startsWith('utm_') || key === 'src' || key === 'sck') {
            const value = utmParams[key];
            if (value && value.length > maxLength) {
                errors.push(`${key} excede o comprimento máximo de ${maxLength} caracteres`);
            }
        }
    });

    // Avisar se não há nenhum parâmetro UTM
    if (!utmParams.utm_source && !utmParams.utm_campaign && !utmParams.utm_medium) {
        warnings.push('Nenhum parâmetro UTM encontrado');
    }

    // Avisar se há utm_source mas não utm_campaign (comum mas pode ser intencional)
    if (utmParams.utm_source && !utmParams.utm_campaign) {
        warnings.push('utm_source encontrado mas utm_campaign não encontrado');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        hasUTM: !!(utmParams.utm_source || utmParams.utm_campaign || utmParams.utm_medium)
    };
}

/**
 * Log formatado dos parâmetros UTM para debug
 * 
 * @param {Object} utmParams - Parâmetros UTM
 * @param {string} context - Contexto da captura (ex: "checkout", "payment-success")
 */
function logUTMParameters(utmParams, context = '') {
    const contextPrefix = context ? `[${context}] ` : '';
    
    console.log(`📊 ${contextPrefix}UTM: Parâmetros capturados:`, {
        utm_source: utmParams.utm_source || 'não encontrado',
        utm_medium: utmParams.utm_medium || 'não encontrado',
        utm_campaign: utmParams.utm_campaign || 'não encontrado',
        utm_content: utmParams.utm_content || 'não encontrado',
        utm_term: utmParams.utm_term || 'não encontrado',
        src: utmParams.src || 'não encontrado',
        sck: utmParams.sck || 'não encontrado',
        has_any_utm: !!(utmParams.utm_source || utmParams.utm_campaign || utmParams.utm_medium)
    });

    if (utmParams._metadata) {
        console.log(`📊 ${contextPrefix}UTM: Fontes utilizadas:`, utmParams._metadata.sources_used);
    }
}

module.exports = {
    captureUTMParameters,
    prepareTrackingDataForDB,
    mergeTrackingData,
    validateUTMParameters,
    logUTMParameters
};

