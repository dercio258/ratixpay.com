/**
 * Serviço de Emails de Vendas
 * Gerencia emails relacionados a vendas, conteúdo, saques e confirmações
 */

const professionalEmailService = require('./professionalEmailService');

class VendasEmailService {
    constructor() {
        this.emailService = professionalEmailService;
    }

    /**
     * Enviar confirmação de compra com conteúdo - MELHORADO
     * Inclui recibo completo e acesso ao produto em um único email
     */
    async enviarConfirmacaoCompra(dadosVenda) {
        const { 
            clienteEmail, 
            clienteNome, 
            produtoNome, 
            valorPago, 
            linkConteudo, 
            vendedorNome, 
            numeroPedido,
            dataVenda,
            metodoPagamento,
            transacaoId,
            produtosComplementares = []
        } = dadosVenda;
        
        // Função para formatar transaction_id do PayMoz como TXP_{8 últimos números}
        const formatarTransactionIdPayMoz = (transactionId) => {
            if (!transactionId || transactionId === 'N/A') return transactionId;
            const txStr = String(transactionId);
            
            // Extrair apenas números da transaction_id
            const numeros = txStr.replace(/\D/g, '');
            
            // Pegar os últimos 8 números
            const ultimos8Numeros = numeros.length > 8 ? numeros.slice(-8) : numeros;
            
            // Se não houver números suficientes, usar o que tiver (preencher com zeros à esquerda se necessário)
            const numerosFormatados = ultimos8Numeros.padStart(Math.min(8, numeros.length), '0');
            
            // Adicionar prefixo TXP_
            return `TXP_${numerosFormatados}`;
        };
        
        // Usar transaction_id diretamente como ID do pedido
        const idPedido = numeroPedido || dadosVenda.transacao_id || dadosVenda.venda_id || 'N/A';
        const idPedidoFormatado = formatarTransactionIdPayMoz(idPedido);
        const assunto = `🎉 Confirmação de Compra - ID: ${idPedidoFormatado}`;
        
        // Formatar data
        const dataFormatada = dataVenda ? new Date(dataVenda).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : new Date().toLocaleDateString('pt-BR');
        
        // Gerar HTML para produtos complementares se existirem
        const produtosComplementaresHtml = produtosComplementares && produtosComplementares.length > 0 ? `
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">🎁 Produtos Complementares Incluídos</h3>
                ${produtosComplementares.map(produto => `
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0; border: 1px solid #ffeaa7;">
                        <h4 style="color: #333; margin: 0 0 10px 0;">${produto.nome}</h4>
                        ${produto.link_conteudo ? `
                            <div style="text-align: center; margin: 15px 0;">
                                <a href="${produto.link_conteudo}" style="background: linear-gradient(135deg, #ffc107, #ff8c00); color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                                    📥 Acessar Bônus
                                </a>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        ` : '';
        
        const conteudo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirmação de Compra - RatixPay</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; }
                    .container { background: white; border-radius: 12px; padding: 0; box-shadow: 0 8px 32px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: white; padding: 40px 30px; text-align: center; }
                    .content { padding: 40px 30px; }
                    .success-message { font-size: 24px; color: #F64C00; margin-bottom: 30px; font-weight: 700; text-align: center; }
                    .purchase-details { background: #f8f9fa; border-left: 4px solid #F64C00; border-radius: 8px; padding: 25px; margin: 25px 0; }
                    .detail-row { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px 0; border-bottom: 1px solid #e9ecef; }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { font-weight: bold; color: #495057; }
                    .detail-value { color: #6c757d; }
                    .access-button { background: linear-gradient(135deg, #F64C00, #ff6b35); color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; text-align: center; transition: all 0.3s; box-shadow: 0 4px 15px rgba(246, 76, 0, 0.3); }
                    .access-button:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(246, 76, 0, 0.4); }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; color: #856404; }
                    .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #dee2e6; color: #6c757d; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="https://ratixpay.site/uploads/produtos/originals/1761230672212_c05b892ecbf3ee55_gemini_generated_image_dhjcjbdhjcjbdhjc__1_.png" 
                             alt="RatixPay Logo" 
                             style="max-width: 200px; height: auto; display: block; margin: 0 auto;">
                    </div>
                    
                    <div class="content">
                        <div class="success-message">
                            Olá, ${clienteNome}! Sua compra foi confirmada! 🎉
                        </div>
                        
                        <p>Parabéns pela sua compra do produto <strong> ${produtoNome}</strong>! Seu pagamento foi processado com sucesso.</p>
                        
                        <div class="purchase-details">
                            <h3 style="color: #F64C00; margin-top: 0;">📋 Detalhes da Compra</h3>
                            <div class="detail-row">
                                <span class="detail-label">ID Pedido:</span>
                                <span class="detail-value">${idPedidoFormatado}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Produto:</span>
                                <span class="detail-value"> ${produtoNome}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Valor Pago:</span>
                                <span class="detail-value" style="color: #F64C00; font-weight: bold;">${valorPago}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Data da Compra:</span>
                                <span class="detail-value"> ${dataFormatada}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Suporte:</span>
                                <span class="detail-value">
                                    <a href="https://wa.me/258856353053" style="color: #F64C00; text-decoration: none; font-weight: bold;">
                                        Falar com suporte
                                    </a>
                                </span>
                            </div>
                            ${transacaoId ? `
                            <div class="detail-row">
                                <span class="detail-label">ID do Pedido:</span>
                                <span class="detail-value"> ${formatarTransactionIdPayMoz(transacaoId)}</span>
                            </div>
                            ` : ''}
            </div>
                        
                        ${produtosComplementaresHtml}
            
            <div style="text-align: center; margin: 30px 0;">
                            <a href="${linkConteudo}" class="access-button">
                    📥 Acessar Conteúdo do Produto
                </a>
                            <p style="margin-top: 15px; color: #6c757d; font-size: 14px;">
                                Clique no botão acima para acessar seu produto
                            </p>
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Importante:</strong> 
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>Guarde este email como comprovante de sua compra</li>
                                <li>O link do conteúdo é válido por tempo indeterminado</li>
                                <li>Em caso de dúvidas, entre em contato com com o suporte: ${vendedorNome}</li>
                            </ul>
                        </div>
            </div>
            
                    <div class="footer">
                        <p><strong>Obrigado por escolher Txi-pay!</strong></p>
                        <p>Este é um email automático. Para suporte, entre em contato conosco.</p>
                        <p>© 2025 Txi-pay - Sistema de Pagamentos</p>
                    </div>
            </div>
            </body>
            </html>
        `;
        
        try {
            console.log(`📧 Enviando confirmação de compra melhorada para: ${clienteEmail}`);
            const resultado = await this.emailService.enviarEmail('vendas', clienteEmail, assunto, conteudo, 'confirmacao_compra');
            console.log('✅ Confirmação de compra enviada com sucesso:', resultado);
            return resultado;
        } catch (error) {
            console.error('❌ Erro ao enviar confirmação de compra:', error);
            throw error;
        }
    }

    /**
     * Enviar notificação de saque para vendedor
     */
    async enviarNotificacaoSaque(dadosSaque) {
        const { vendedorEmail, vendedorNome, valorSaque, status, motivo } = dadosSaque;
        
        const assunto = `💰 Solicitação de Saque - ${status}`;
        
        const conteudo = `
            <h2>Olá, ${vendedorNome}!</h2>
            <p>Informações sobre sua solicitação de saque:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>💳 Detalhes do Saque</h3>
                <p><strong>Valor:</strong> ${valorSaque}</p>
                <p><strong>Status:</strong> ${status}</p>
                ${motivo ? `<p><strong>Observações:</strong> ${motivo}</p>` : ''}
            </div>
            
            ${status === 'Aprovado' ? `
                <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <strong>✅ Saque Aprovado!</strong> O valor será transferido para sua conta em até 2 dias úteis.
                </div>
            ` : ''}
            
            ${status === 'Rejeitado' ? `
                <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <strong>❌ Saque Rejeitado</strong> - Entre em contato com o suporte para mais informações.
                </div>
            ` : ''}
        `;
        
        return await this.emailService.enviarEmail('vendas', vendedorEmail, assunto, conteudo, 'saque');
    }

    /**
     * Enviar confirmação de venda para vendedor
     */
    async enviarConfirmacaoVenda(dadosVenda) {
        const { vendedorEmail, vendedorNome, clienteNome, produtoNome, valorVenda, comissao, numeroPedido } = dadosVenda;
        
        // Usar transaction_id diretamente como ID do pedido
        const idPedido = numeroPedido || dadosVenda.transacao_id || dadosVenda.venda_id || 'N/A';
        const assunto = `🛒 Nova Venda Realizada - ID: ${idPedido}`;
        
        const conteudo = `
            <h2>Parabéns, ${vendedorNome}!</h2>
            <p>Você acaba de realizar uma nova venda!</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📊 Detalhes da Venda</h3>
                <p><strong>Cliente:</strong> ${clienteNome}</p>
                <p><strong>Produto:</strong> ${produtoNome}</p>
                <p><strong>Valor da Venda:</strong> ${valorVenda}</p>
                <p><strong>Sua Comissão:</strong> ${comissao}</p>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>🎉 Parabéns!</strong> Continue assim! Sua comissão será creditada em sua conta.
            </div>
        `;
        
        return await this.emailService.enviarEmail('vendas', vendedorEmail, assunto, conteudo, 'confirmacao');
    }


    /**
     * Enviar confirmação de saque aprovado para vendedor
     */
    async enviarConfirmacaoSaque(dadosEmail) {
        const { email, nome, titulo, mensagem, dadosExtras } = dadosEmail;
        
        const assunto = `✅ ${titulo} - RatixPay`;
        
        const valorFormatado = new Intl.NumberFormat('pt-MZ', {
            style: 'currency',
            currency: 'MZN'
        }).format(dadosExtras.valor || 0);
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>${mensagem}</p>
            
            <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                <h3 style="color: #28a745; margin-bottom: 15px;">💰 Saque Aprovado</h3>
                <div style="font-size: 24px; font-weight: bold; color: #28a745; margin: 15px 0;">
                    ${valorFormatado}
                </div>
                <p style="margin: 10px 0; color: #6c757d;">
                    Método: ${dadosExtras.metodo || 'N/A'}<br>
                    Contato: ${dadosExtras.contato_carteira || 'N/A'}
                </p>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>✅ Confirmação:</strong> Seu saque foi processado com sucesso e o valor será transferido para sua conta em até 2 dias úteis.
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>📊 Detalhes do Saque:</strong><br>
                • ID do Saque: ${dadosExtras.saque_id || 'N/A'}<br>
                • Data de Processamento: ${new Date(dadosExtras.data_processamento).toLocaleDateString('pt-BR')}<br>
                • Status: Aprovado e Processado
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.site/dashboard" style="background-color: #F64C00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🏠 Acessar Minha Conta
                </a>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>💡 Dica:</strong> Mantenha este email como comprovante da transferência.
            </div>
        `;
        
        return await this.emailService.enviarEmail('vendas', email, assunto, conteudo, 'saque_aprovado');
    }
}

module.exports = new VendasEmailService();
