const { Produto, Usuario, Venda, Pagamento, HistoricoSaques } = require('../config/database');

/**
 * Middleware para converter public_id em UUID automaticamente
 * @param {string} paramName - Nome do parâmetro que contém o public_id
 * @param {string} modelName - Nome do modelo (produto, usuario, venda, pagamento, historico)
 * @returns {Function} Middleware function
 */
function convertPublicIdToUUID(paramName = 'id', modelName = 'produto') {
    return async (req, res, next) => {
        try {
            const publicId = req.params[paramName] || req.body[paramName] || req.query[paramName];
            
            if (!publicId) {
                return next();
            }

            // Verificar se já é um UUID
            if (isValidUUID(publicId)) {
                // Se é um UUID válido, definir req.produtoId para compatibilidade
                req.produtoId = publicId;
                return next();
            }

            // Verificar se é um public_id válido (6 dígitos)
            if (!isValidPublicId(publicId)) {
                return res.status(400).json({ 
                    erro: 'ID inválido. Deve ser um UUID ou public_id de 6 dígitos.' 
                });
            }

            let model;
            let uuid;

            // Buscar UUID baseado no public_id
            switch (modelName.toLowerCase()) {
                case 'produto':
                    const produto = await Produto.findByPublicId(publicId);
                    if (!produto) {
                        return res.status(404).json({ erro: 'Produto não encontrado' });
                    }
                    uuid = produto.id;
                    break;

                case 'usuario':
                    const usuario = await Usuario.findByPublicId(publicId);
                    if (!usuario) {
                        return res.status(404).json({ erro: 'Usuário não encontrado' });
                    }
                    uuid = usuario.id;
                    break;

                case 'venda':
                    const venda = await Venda.findByPublicId(publicId);
                    if (!venda) {
                        return res.status(404).json({ erro: 'Venda não encontrada' });
                    }
                    uuid = venda.id;
                    break;

                case 'pagamento':
                    const pagamento = await Pagamento.findByPublicId(publicId);
                    if (!pagamento) {
                        return res.status(404).json({ erro: 'Pagamento não encontrado' });
                    }
                    uuid = pagamento.id;
                    break;

                case 'historico':
                    const historico = await HistoricoSaques.findByPublicId(publicId);
                    if (!historico) {
                        return res.status(404).json({ erro: 'Histórico não encontrado' });
                    }
                    uuid = historico.id;
                    break;

                default:
                    return res.status(400).json({ erro: 'Tipo de modelo inválido' });
            }

            // Substituir o public_id pelo UUID
            if (req.params[paramName]) {
                req.params[paramName] = uuid;
            }
            if (req.body[paramName]) {
                req.body[paramName] = uuid;
            }
            if (req.query[paramName]) {
                req.query[paramName] = uuid;
            }

            next();
        } catch (error) {
            console.error('Erro ao converter public_id para UUID:', error);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    };
}

/**
 * Middleware para converter múltiplos public_ids
 * @param {Array} conversions - Array de objetos { paramName, modelName }
 * @returns {Function} Middleware function
 */
function convertMultiplePublicIds(conversions) {
    return async (req, res, next) => {
        try {
            for (const conversion of conversions) {
                const { paramName, modelName } = conversion;
                const publicId = req.params[paramName] || req.body[paramName] || req.query[paramName];
                
                if (!publicId || isValidUUID(publicId)) {
                    continue;
                }

                if (!isValidPublicId(publicId)) {
                    return res.status(400).json({ 
                        erro: `ID inválido para ${paramName}. Deve ser um UUID ou public_id de 6 dígitos.` 
                    });
                }

                let uuid;

                switch (modelName.toLowerCase()) {
                    case 'produto':
                        const produto = await Produto.findByPublicId(publicId);
                        if (!produto) {
                            return res.status(404).json({ erro: `Produto não encontrado para ${paramName}` });
                        }
                        uuid = produto.id;
                        break;

                    case 'usuario':
                        const usuario = await Usuario.findByPublicId(publicId);
                        if (!usuario) {
                            return res.status(404).json({ erro: `Usuário não encontrado para ${paramName}` });
                        }
                        uuid = usuario.id;
                        break;

                    case 'venda':
                        const venda = await Venda.findByPublicId(publicId);
                        if (!venda) {
                            return res.status(404).json({ erro: `Venda não encontrada para ${paramName}` });
                        }
                        uuid = venda.id;
                        break;

                    case 'pagamento':
                        const pagamento = await Pagamento.findByPublicId(publicId);
                        if (!pagamento) {
                            return res.status(404).json({ erro: `Pagamento não encontrado para ${paramName}` });
                        }
                        uuid = pagamento.id;
                        break;

                    case 'historico':
                        const historico = await HistoricoSaques.findByPublicId(publicId);
                        if (!historico) {
                            return res.status(404).json({ erro: `Histórico não encontrado para ${paramName}` });
                        }
                        uuid = historico.id;
                        break;

                    default:
                        return res.status(400).json({ erro: `Tipo de modelo inválido para ${paramName}` });
                }

                // Substituir o public_id pelo UUID
                if (req.params[paramName]) {
                    req.params[paramName] = uuid;
                }
                if (req.body[paramName]) {
                    req.body[paramName] = uuid;
                }
                if (req.query[paramName]) {
                    req.query[paramName] = uuid;
                }
            }

            next();
        } catch (error) {
            console.error('Erro ao converter múltiplos public_ids:', error);
            res.status(500).json({ erro: 'Erro interno do servidor' });
        }
    };
}

/**
 * Validar se string é UUID válido
 * @param {string} uuid - String para validar
 * @returns {boolean} True se é UUID válido
 */
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}

/**
 * Validar se string é public_id válido (6 dígitos)
 * @param {string} publicId - String para validar
 * @returns {boolean} True se é public_id válido
 */
function isValidPublicId(publicId) {
    const publicIdRegex = /^\d{6}$/;
    return publicIdRegex.test(publicId);
}

/**
 * Middleware para converter public_id em UUID para produtos
 */
const convertProdutoPublicId = convertPublicIdToUUID('id', 'produto');

/**
 * Middleware para converter public_id em UUID para usuários
 */
const convertUsuarioPublicId = convertPublicIdToUUID('id', 'usuario');

/**
 * Middleware para converter public_id em UUID para vendas
 */
const convertVendaPublicId = convertPublicIdToUUID('id', 'venda');

/**
 * Middleware para converter public_id em UUID para pagamentos
 */
const convertPagamentoPublicId = convertPublicIdToUUID('id', 'pagamento');

/**
 * Middleware para converter public_id em UUID para histórico
 */
const convertHistoricoPublicId = convertPublicIdToUUID('id', 'historico');

module.exports = {
    convertPublicIdToUUID,
    convertMultiplePublicIds,
    convertProdutoPublicId,
    convertUsuarioPublicId,
    convertVendaPublicId,
    convertPagamentoPublicId,
    convertHistoricoPublicId,
    isValidUUID,
    isValidPublicId
};
