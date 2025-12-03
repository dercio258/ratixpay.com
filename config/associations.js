const { 
    Usuario, 
    Venda,
    Cliente,
    Produto,
    Configuracao,
    SaldoAdmin,
    Pagamento,
    HistoricoSaques,
    EstatisticasVendedor,
    Carteira,
    CodigoAutenticacao,
    Pedido,
    PontoVenda,
    Notificacao,
    Expert,
    ProdutoComplementarVenda
} = require('./database');

// Definir relacionamentos entre modelos
let associationsConfigured = false;

function setupAssociations() {
    if (associationsConfigured) {
        return;
    }
    
    // Configurando relacionamentos entre modelos...

    try {
        // 1. Usuario ↔ Venda (um usuário pode ter muitas vendas)
        Usuario.hasMany(Venda, {
            foreignKey: 'vendedor_id',
            as: 'vendas'
        });
        Venda.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorVenda'
        });

        // 2. Produto ↔ Venda (um produto pode ter muitas vendas)
        Produto.hasMany(Venda, {
            foreignKey: 'produto_id',
            as: 'vendasProduto'
        });
        Venda.belongsTo(Produto, {
            foreignKey: 'produto_id',
            as: 'produto'
        });

        // 3. Usuario ↔ Produto (um usuário pode ter muitos produtos)
        Usuario.hasMany(Produto, {
            foreignKey: 'vendedor_id',
            as: 'produtos'
        });
        Produto.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorProduto'
        });

        // 4. Usuario ↔ Pagamento (um usuário pode ter muitos pagamentos)
        Usuario.hasMany(Pagamento, {
            foreignKey: 'vendedor_id',
            as: 'pagamentos'
        });
        Pagamento.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedor'
        });

        // 5. Usuario ↔ HistoricoSaques (um usuário pode ter histórico de saques)
        Usuario.hasMany(HistoricoSaques, {
            foreignKey: 'vendedor_id',
            as: 'historicoSaques'
        });
        HistoricoSaques.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorHistorico'
        });

        // 6. Usuario ↔ EstatisticasVendedor (um usuário tem estatísticas)
        Usuario.hasOne(EstatisticasVendedor, {
            foreignKey: 'vendedor_id',
            as: 'estatisticas'
        });
        EstatisticasVendedor.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorEstatisticas'
        });

        // 7. Usuario ↔ Carteira (um usuário pode ter carteiras)
        Usuario.hasMany(Carteira, {
            foreignKey: 'vendedor_id',
            as: 'carteiras'
        });
        Carteira.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorCarteira'
        });

        // 8. Usuario ↔ CodigoAutenticacao (um usuário pode ter códigos de autenticação)
        Usuario.hasMany(CodigoAutenticacao, {
            foreignKey: 'vendedor_id',
            as: 'codigosAutenticacao'
        });
        CodigoAutenticacao.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorCodigo'
        });

        // 9. Usuario ↔ Pedido (um usuário pode ter pedidos)
        Usuario.hasMany(Pedido, {
            foreignKey: 'vendedor_id',
            as: 'pedidos'
        });
        Pedido.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorPedido'
        });

        // 10. Venda ↔ Pedido (uma venda pode ter pedidos)
        Venda.hasMany(Pedido, {
            foreignKey: 'venda_id',
            as: 'pedidos'
        });
        Pedido.belongsTo(Venda, {
            foreignKey: 'venda_id',
            as: 'venda'
        });

        // 11. Produto ↔ Pedido (um produto pode ter pedidos)
        Produto.hasMany(Pedido, {
            foreignKey: 'produto_id',
            as: 'pedidos'
        });
        Pedido.belongsTo(Produto, {
            foreignKey: 'produto_id',
            as: 'produto'
        });

        // 12. Usuario ↔ PontoVenda (um usuário pode ter pontos de venda)
        Usuario.hasMany(PontoVenda, {
            foreignKey: 'vendedor_id',
            as: 'pontosVenda'
        });
        PontoVenda.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorPonto'
        });

        // 13. Usuario ↔ Notificacao (um usuário pode ter notificações)
        Usuario.hasMany(Notificacao, {
            foreignKey: 'vendedor_id',
            as: 'notificacoesUsuario'
        });
        Notificacao.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedor'
        });

        // 14. Usuario ↔ Expert (um usuário pode ter experts)
        Usuario.hasMany(Expert, {
            foreignKey: 'vendedor_id',
            as: 'experts'
        });
        Expert.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedor'
        });

        // 15. Expert ↔ Produto (um expert pode ter produtos)
        Expert.hasMany(Produto, {
            foreignKey: 'expert_id',
            as: 'produtos'
        });
        Produto.belongsTo(Expert, {
            foreignKey: 'expert_id',
            as: 'expert'
        });

        // 16. Usuario ↔ Configuracao (um usuário pode ter configurações)
        Usuario.hasMany(Configuracao, {
            foreignKey: 'vendedor_id',
            as: 'configuracoes'
        });
        Configuracao.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedorConfiguracao'
        });

        // 17. Usuario ↔ SaldoAdmin (relacionamento removido - SaldoAdmin não tem vendedor_id)
        // SaldoAdmin é uma tabela única para o administrador, não por vendedor
        // Removido relacionamento para evitar erro de coluna inexistente

        // 18. ProdutoComplementarVenda ↔ Venda (produtos complementares de uma venda)
        ProdutoComplementarVenda.belongsTo(Venda, {
            foreignKey: 'venda_id',
            as: 'venda'
        });
        Venda.hasMany(ProdutoComplementarVenda, {
            foreignKey: 'venda_id',
            as: 'produtosComplementares'
        });

        // 19. ProdutoComplementarVenda ↔ Usuario (produtos complementares de um vendedor)
        ProdutoComplementarVenda.belongsTo(Usuario, {
            foreignKey: 'vendedor_id',
            as: 'vendedor'
        });
        Usuario.hasMany(ProdutoComplementarVenda, {
            foreignKey: 'vendedor_id',
            as: 'produtosComplementaresVenda'
        });

        // 20. Pagamento ↔ HistoricoSaques (um pagamento pode ter histórico de saque)
        Pagamento.hasOne(HistoricoSaques, {
            foreignKey: 'saque_id',
            as: 'historicoSaque'
        });
        HistoricoSaques.belongsTo(Pagamento, {
            foreignKey: 'saque_id',
            as: 'pagamentoSaque'
        });

        // Associações configuradas silenciosamente
        
        associationsConfigured = true;
    } catch (error) {
        console.log('⚠️ Erro ao configurar relacionamentos (continuando):', error.message);
        associationsConfigured = true;
    }
}

module.exports = { setupAssociations };