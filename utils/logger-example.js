/**
 * 📋 EXEMPLOS DE USO DO SISTEMA DE LOGS MODULAR
 * 
 * Este arquivo contém exemplos práticos de como usar o sistema de logs
 * em diferentes partes do sistema RatixPay
 */

const logger = require('./modularLogger');

// ============================================
// EXEMPLO 1: Sistema de Autenticação
// ============================================

async function exemploLogin(req, res) {
    const { email, password } = req.body;
    const ip = req.ip;
    
    try {
        // Verificar credenciais
        const user = await verificarCredenciais(email, password);
        
        if (user) {
            // Login bem-sucedido
            logger.loginSuccess(user.id, email, ip, {
                userAgent: req.get('User-Agent'),
                method: 'email'
            });
            
            // Criar sessão
            req.login(user, (err) => {
                if (err) {
                    logger.loginError(err, { email, ip });
                    return res.status(500).json({ error: 'Erro ao criar sessão' });
                }
                res.json({ success: true, user });
            });
        } else {
            // Login falhou
            logger.loginFailure(email, 'Credenciais inválidas', ip, {
                userAgent: req.get('User-Agent')
            });
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (error) {
        logger.loginError(error, { email, ip });
        res.status(500).json({ error: 'Erro no servidor' });
    }
}

function exemploLogout(req, res) {
    const userId = req.user?.id;
    const email = req.user?.email;
    
    req.logout((err) => {
        if (err) {
            logger.loginError(err, { userId, email });
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        
        logger.logout(userId, email, {
            ip: req.ip
        });
        
        res.json({ success: true });
    });
}

// ============================================
// EXEMPLO 2: Sistema de Pagamentos
// ============================================

async function exemploProcessarPagamento(req, res) {
    const { transactionId, amount, method, customerEmail, productId } = req.body;
    
    try {
        // Registrar início do pagamento
        logger.paymentInitiated(transactionId, amount, method, customerEmail, {
            productId,
            ip: req.ip
        });
        
        // Processar pagamento
        const resultado = await processarPagamento(transactionId, amount, method);
        
        if (resultado.success) {
            // Pagamento aprovado
            logger.paymentSuccess(transactionId, amount, method, customerEmail, {
                productId,
                paymentId: resultado.paymentId
            });
            
            res.json({ success: true, paymentId: resultado.paymentId });
        } else {
            // Pagamento falhou
            logger.paymentFailure(transactionId, amount, method, resultado.reason, {
                productId,
                customerEmail
            });
            
            res.status(400).json({ error: resultado.reason });
        }
    } catch (error) {
        logger.paymentError(error, transactionId, {
            amount,
            method,
            customerEmail,
            productId
        });
        
        res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
}

function exemploWebhookPagamento(req, res) {
    const { transactionId, status, provider } = req.body;
    
    // Registrar webhook recebido
    logger.paymentWebhook(transactionId, status, provider, {
        headers: req.headers,
        body: req.body
    });
    
    // Processar webhook
    processarWebhook(transactionId, status, provider)
        .then(() => {
            res.json({ success: true });
        })
        .catch((error) => {
            logger.paymentError(error, transactionId, {
                status,
                provider
            });
            res.status(500).json({ error: 'Erro ao processar webhook' });
        });
}

// ============================================
// EXEMPLO 3: Sistema de Vendas
// ============================================

async function exemploCriarVenda(req, res) {
    const { productId, customerId, amount } = req.body;
    
    try {
        // Criar venda
        const venda = await criarVenda(productId, customerId, amount);
        
        // Registrar venda criada
        logger.saleCreated(venda.id, productId, customerId, amount, {
            paymentMethod: venda.paymentMethod,
            ip: req.ip
        });
        
        // Processar venda
        const resultado = await processarVenda(venda.id);
        
        if (resultado.success) {
            // Venda concluída
            logger.saleCompleted(venda.id, productId, customerId, amount, {
                paymentMethod: venda.paymentMethod,
                transactionId: resultado.transactionId
            });
            
            res.json({ success: true, venda });
        } else {
            // Venda cancelada
            logger.saleCancelled(venda.id, resultado.reason, {
                productId,
                customerId
            });
            
            res.status(400).json({ error: resultado.reason });
        }
    } catch (error) {
        logger.saleError(error, null, {
            productId,
            customerId,
            amount
        });
        
        res.status(500).json({ error: 'Erro ao criar venda' });
    }
}

// ============================================
// EXEMPLO 4: Gestão de Produtos
// ============================================

async function exemploCriarProduto(req, res) {
    const { nome, preco, descricao } = req.body;
    const userId = req.user.id;
    
    try {
        // Criar produto
        const produto = await criarProduto({ nome, preco, descricao, userId });
        
        // Registrar produto criado
        logger.productCreated(produto.id, nome, userId, {
            preco,
            categoria: produto.categoria
        });
        
        res.json({ success: true, produto });
    } catch (error) {
        logger.productError(error, null, {
            nome,
            userId
        });
        
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
}

async function exemploAtualizarProduto(req, res) {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;
    
    try {
        // Buscar produto atual
        const produtoAtual = await buscarProduto(id);
        
        // Atualizar produto
        const produtoAtualizado = await atualizarProduto(id, updates);
        
        // Registrar atualização
        const changes = {
            nome: produtoAtual.nome !== produtoAtualizado.nome ? {
                old: produtoAtual.nome,
                new: produtoAtualizado.nome
            } : undefined,
            preco: produtoAtual.preco !== produtoAtualizado.preco ? {
                old: produtoAtual.preco,
                new: produtoAtualizado.preco
            } : undefined
        };
        
        logger.productUpdated(id, produtoAtualizado.nome, userId, changes, {
            updates
        });
        
        res.json({ success: true, produto: produtoAtualizado });
    } catch (error) {
        logger.productError(error, id, {
            userId,
            updates
        });
        
        res.status(500).json({ error: 'Erro ao atualizar produto' });
    }
}

async function exemploDeletarProduto(req, res) {
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
        // Buscar produto
        const produto = await buscarProduto(id);
        
        // Deletar produto
        await deletarProduto(id);
        
        // Registrar deleção
        logger.productDeleted(id, produto.nome, userId, {
            preco: produto.preco
        });
        
        res.json({ success: true });
    } catch (error) {
        logger.productError(error, id, {
            userId
        });
        
        res.status(500).json({ error: 'Erro ao deletar produto' });
    }
}

// ============================================
// EXEMPLO 5: Sistema de Saques
// ============================================

async function exemploSolicitarSaque(req, res) {
    const { amount, method } = req.body;
    const userId = req.user.id;
    
    try {
        // Criar solicitação de saque
        const saque = await criarSolicitacaoSaque(userId, amount, method);
        
        // Registrar solicitação
        logger.withdrawalRequested(saque.id, userId, amount, method, {
            saldoAnterior: saque.saldoAnterior,
            ip: req.ip
        });
        
        res.json({ success: true, saque });
    } catch (error) {
        logger.withdrawalError(error, null, {
            userId,
            amount,
            method
        });
        
        res.status(500).json({ error: 'Erro ao solicitar saque' });
    }
}

async function exemploAprovarSaque(req, res) {
    const { id } = req.params;
    const adminId = req.user.id;
    
    try {
        // Buscar saque
        const saque = await buscarSaque(id);
        
        // Aprovar saque
        await aprovarSaque(id, adminId);
        
        // Registrar aprovação
        logger.withdrawalApproved(id, saque.userId, saque.amount, {
            adminId
        });
        
        res.json({ success: true });
    } catch (error) {
        logger.withdrawalError(error, id, {
            adminId
        });
        
        res.status(500).json({ error: 'Erro ao aprovar saque' });
    }
}

async function exemploRejeitarSaque(req, res) {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;
    
    try {
        // Buscar saque
        const saque = await buscarSaque(id);
        
        // Rejeitar saque
        await rejeitarSaque(id, reason, adminId);
        
        // Registrar rejeição
        logger.withdrawalRejected(id, saque.userId, saque.amount, reason, {
            adminId
        });
        
        res.json({ success: true });
    } catch (error) {
        logger.withdrawalError(error, id, {
            adminId,
            reason
        });
        
        res.status(500).json({ error: 'Erro ao rejeitar saque' });
    }
}

async function exemploConcluirSaque(req, res) {
    const { id } = req.params;
    const { transactionId } = req.body;
    
    try {
        // Buscar saque
        const saque = await buscarSaque(id);
        
        // Concluir saque
        await concluirSaque(id, transactionId);
        
        // Registrar conclusão
        logger.withdrawalCompleted(id, saque.userId, saque.amount, transactionId, {
            method: saque.method
        });
        
        res.json({ success: true });
    } catch (error) {
        logger.withdrawalError(error, id, {
            transactionId
        });
        
        res.status(500).json({ error: 'Erro ao concluir saque' });
    }
}

// ============================================
// FUNÇÕES AUXILIARES (exemplos - não implementadas)
// ============================================

async function verificarCredenciais(email, password) {
    // Implementação
    return null;
}

async function processarPagamento(transactionId, amount, method) {
    // Implementação
    return { success: true, paymentId: '123' };
}

async function processarWebhook(transactionId, status, provider) {
    // Implementação
}

async function criarVenda(productId, customerId, amount) {
    // Implementação
    return { id: '123', paymentMethod: 'PayMoz' };
}

async function processarVenda(vendaId) {
    // Implementação
    return { success: true, transactionId: '123' };
}

async function criarProduto(dados) {
    // Implementação
    return { id: '123', categoria: 'Digital' };
}

async function buscarProduto(id) {
    // Implementação
    return { id, nome: 'Produto', preco: 100 };
}

async function atualizarProduto(id, updates) {
    // Implementação
    return { id, nome: 'Produto Atualizado', preco: 150 };
}

async function deletarProduto(id) {
    // Implementação
}

async function criarSolicitacaoSaque(userId, amount, method) {
    // Implementação
    return { id: '123', saldoAnterior: 1000 };
}

async function buscarSaque(id) {
    // Implementação
    return { id, userId: '123', amount: 500, method: 'M-Pesa' };
}

async function aprovarSaque(id, adminId) {
    // Implementação
}

async function rejeitarSaque(id, reason, adminId) {
    // Implementação
}

async function concluirSaque(id, transactionId) {
    // Implementação
}

module.exports = {
    exemploLogin,
    exemploLogout,
    exemploProcessarPagamento,
    exemploWebhookPagamento,
    exemploCriarVenda,
    exemploCriarProduto,
    exemploAtualizarProduto,
    exemploDeletarProduto,
    exemploSolicitarSaque,
    exemploAprovarSaque,
    exemploRejeitarSaque,
    exemploConcluirSaque
};

