/**
 * Utilitários para gerenciar números de pedido
 */

/**
 * Obter número do pedido com fallbacks inteligentes
 * @param {Object} venda - Objeto da venda
 * @returns {string} Número do pedido
 */
function obterNumeroPedido(venda) {
    // 1. Tentar usar numero_pedido se existir
    if (venda.numero_pedido) {
        return venda.numero_pedido;
    }
    
    // 2. Tentar usar pagamento_transacao_id se tiver 6 dígitos
    if (venda.pagamento_transacao_id && venda.pagamento_transacao_id.length === 6) {
        return venda.pagamento_transacao_id;
    }
    
    // 3. Tentar usar pagamento_referencia se tiver 6 dígitos
    if (venda.pagamento_referencia && venda.pagamento_referencia.length === 6) {
        return venda.pagamento_referencia;
    }
    
    // 4. Tentar usar public_id se existir
    if (venda.public_id) {
        return venda.public_id;
    }
    
    // 5. Usar ID da venda como último recurso
    if (venda.id) {
        return venda.id;
    }
    
    // 6. Fallback para 'N/A' se nada funcionar
    return 'N/A';
}

/**
 * Obter número do pedido para dados extras
 * @param {Object} dadosExtras - Objeto com dados extras
 * @returns {string} Número do pedido
 */
function obterNumeroPedidoDadosExtras(dadosExtras) {
    // 1. Tentar usar numero_pedido se existir
    if (dadosExtras.numero_pedido) {
        return dadosExtras.numero_pedido;
    }
    
    // 2. Tentar usar transacao_id se tiver 6 dígitos
    if (dadosExtras.transacao_id && dadosExtras.transacao_id.length === 6) {
        return dadosExtras.transacao_id;
    }
    
    // 3. Tentar usar pagamento_referencia se tiver 6 dígitos
    if (dadosExtras.pagamento_referencia && dadosExtras.pagamento_referencia.length === 6) {
        return dadosExtras.pagamento_referencia;
    }
    
    // 4. Tentar usar venda_id se existir
    if (dadosExtras.venda_id) {
        return dadosExtras.venda_id;
    }
    
    // 5. Fallback para 'N/A' se nada funcionar
    return 'N/A';
}

module.exports = {
    obterNumeroPedido,
    obterNumeroPedidoDadosExtras
};
