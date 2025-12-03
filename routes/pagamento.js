const express = require('express');
const router = express.Router();
// Migrado para PayMoz
const paymozService = require('../services/paymozService');
const { databaseManager, Produto, Venda, EstatisticaVenda, Pedido, Usuario, Afiliado, VendaAfiliado, LinkTracking } = require('../config/database');
const { convertProdutoPublicId } = require('../middleware/uuidConverter');
const emailService = require('../utils/emailService');
const notificationService = require('../services/notificationService');
const professionalEmailService = require('../services/professionalEmailService');
const afiliadoVendaService = require('../services/afiliadoVendaService');

const BASE_URL = process.env.BASE_URL || process.env.FRONTEND_URL || 'https://ratixpay.com';
// remarketingService removido - funcionalidade integrada na criação de produtos
// Push notifications removido

// Função para processar tracking de afiliados (usando serviço dedicado)
async function processarTrackingAfiliados(venda, produto, valorTotal, transactionId, codigoAfiliado = null) {
    try {
        console.log('🔗 Processando tracking de afiliados...');
        
        // Usar serviço dedicado para processar venda de afiliado
        const resultado = await afiliadoVendaService.processarVendaAfiliado(
            venda,
            produto,
            valorTotal,
            transactionId,
            codigoAfiliado
        );
        
        if (resultado.processado && !resultado.jaExistia) {
        // Enviar notificação para o afiliado
            await enviarNotificacaoAfiliado(
                resultado.afiliado,
                venda,
                resultado.comissao,
                transactionId
            );
        }
        
    } catch (error) {
        console.error('❌ Erro ao processar tracking de afiliados:', error);
        // Não falhar o pagamento por erro de tracking
    }
}

// Função para enviar notificação para afiliado
async function enviarNotificacaoAfiliado(afiliado, venda, valorComissao, transactionId) {
    try {
        console.log('📧 Enviando notificação de venda para afiliado:', afiliado.nome);
        
        const assunto = `🎉 Nova Venda Realizada - Comissão: MZN ${valorComissao.toFixed(2)}`;
        const conteudo = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f8f9fa;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                    }
                    .info-box {
                        background: white;
                        border-left: 4px solid #F64C00;
                        padding: 20px;
                        margin: 20px 0;
                        border-radius: 5px;
                    }
                    .success-box {
                        background: #d4edda;
                        border-left: 4px solid #28a745;
                        padding: 20px;
                        margin: 20px 0;
                        border-radius: 5px;
                    }
                    .button {
                        display: inline-block;
                        background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                        color: white;
                        padding: 15px 30px;
                        text-decoration: none;
                        border-radius: 25px;
                        margin: 20px 0;
                        font-weight: bold;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎉 Parabéns! Nova Venda Realizada</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Sua comissão foi creditada com sucesso</p>
                </div>
                <div class="content">
                    <p>Olá <strong>${afiliado.nome}</strong>,</p>
                    
                    <p>Ótima notícia! Uma nova venda foi realizada através do seu link de afiliado.</p>
                    
                    <div class="info-box">
                        <h3 style="color: #F64C00; margin-top: 0;">📊 Detalhes da Venda</h3>
                        <p><strong>ID da Transação:</strong> ${transactionId || 'N/A'}</p>
                        <p><strong>Valor da Venda:</strong> MZN ${venda.valor ? venda.valor.toFixed(2) : '0.00'}</p>
                        <p><strong>Sua Comissão (${afiliado.comissao_percentual}%):</strong> 
                           <span style="color: #28a745; font-weight: bold; font-size: 18px;">MZN ${valorComissao.toFixed(2)}</span></p>
                        <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                    </div>
                    
                    <div class="success-box">
                        <h3 style="color: #28a745; margin-top: 0;">💰 Seu Saldo Atualizado</h3>
                        <p><strong>Saldo Disponível:</strong> MZN ${parseFloat(afiliado.saldo_disponivel || 0).toFixed(2)}</p>
                        <p><strong>Total de Vendas:</strong> ${afiliado.total_vendas || 0}</p>
                        <p><strong>Total de Comissões:</strong> MZN ${parseFloat(afiliado.total_comissoes || 0).toFixed(2)}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${BASE_URL}/afiliados-painel.html" class="button">
                            📊 Acessar Painel do Afiliado
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
                        Continue promovendo nossos produtos e ganhe mais comissões!<br>
                        <strong>Equipe RatixPay</strong>
                    </p>
                </div>
            </body>
            </html>
        `;
        
        await professionalEmailService.enviarEmailVendas(
            afiliado.email,
            assunto,
            conteudo,
            'notificacao_venda_afiliado'
        );
        
        console.log('✅ Notificação de venda enviada para afiliado:', afiliado.email);
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação de venda para afiliado:', error);
        // Não falhar o processo por erro de email
    }
}

// Função para enviar notificação de saque para afiliado
async function enviarNotificacaoSaqueAfiliado(afiliado, valorSaque, statusSaque, numeroConta = null) {
    try {
        console.log('📧 Enviando notificação de saque para afiliado:', afiliado.nome);
        
        let assunto, conteudo;
        
        if (statusSaque === 'aprovado' || statusSaque === 'processado') {
            assunto = `✅ Saque Aprovado - MZN ${valorSaque.toFixed(2)}`;
            conteudo = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            background: #f8f9fa;
                            padding: 30px;
                            border-radius: 0 0 10px 10px;
                        }
                        .success-box {
                            background: #d4edda;
                            border-left: 4px solid #28a745;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                        .info-box {
                            background: white;
                            border-left: 4px solid #F64C00;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                        .button {
                            display: inline-block;
                            background: linear-gradient(135deg, #F64C00 0%, #FF6B35 100%);
                            color: white;
                            padding: 15px 30px;
                            text-decoration: none;
                            border-radius: 25px;
                            margin: 20px 0;
                            font-weight: bold;
                            text-align: center;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>✅ Saque Aprovado</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Seu saque foi processado com sucesso</p>
            </div>
                    <div class="content">
                        <p>Olá <strong>${afiliado.nome}</strong>,</p>
                        
                        <p>Seu saque foi aprovado e está sendo processado.</p>
                        
                        <div class="success-box">
                            <h3 style="color: #28a745; margin-top: 0;">💰 Detalhes do Saque</h3>
                            <p><strong>Valor do Saque:</strong> 
                               <span style="color: #28a745; font-weight: bold; font-size: 18px;">MZN ${valorSaque.toFixed(2)}</span></p>
                            <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">${statusSaque === 'aprovado' ? 'Aprovado' : 'Processado'}</span></p>
                            ${numeroConta ? `<p><strong>Conta:</strong> ${numeroConta}</p>` : ''}
                            <p><strong>Data:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        </div>
                        
                        <div class="info-box">
                            <h3 style="color: #F64C00; margin-top: 0;">📊 Seu Saldo Atualizado</h3>
                            <p><strong>Saldo Disponível:</strong> MZN ${parseFloat(afiliado.saldo_disponivel || 0).toFixed(2)}</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${BASE_URL}/afiliados-painel.html" class="button">
                                📊 Acessar Painel do Afiliado
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
                            O valor será creditado na sua conta em até 3 dias úteis.<br>
                            <strong>Equipe RatixPay</strong>
                        </p>
                    </div>
                </body>
                </html>
            `;
        } else if (statusSaque === 'pendente') {
            assunto = `⏳ Saque Pendente - MZN ${valorSaque.toFixed(2)}`;
            conteudo = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            background: #f8f9fa;
                            padding: 30px;
                            border-radius: 0 0 10px 10px;
                        }
                        .warning-box {
                            background: #fff3cd;
                            border-left: 4px solid #ffc107;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>⏳ Saque Pendente</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9;">Aguardando aprovação</p>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${afiliado.nome}</strong>,</p>
                        
                        <p>Recebemos sua solicitação de saque. Está sendo analisada pela nossa equipe.</p>
                        
                        <div class="warning-box">
                            <h3 style="color: #856404; margin-top: 0;">📋 Detalhes do Saque</h3>
                            <p><strong>Valor Solicitado:</strong> MZN ${valorSaque.toFixed(2)}</p>
                            <p><strong>Status:</strong> Pendente de Aprovação</p>
                            <p><strong>Data da Solicitação:</strong> ${new Date().toLocaleString('pt-BR')}</p>
                        </div>
                        
                        <p>Você receberá uma notificação assim que o saque for aprovado.</p>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
                            <strong>Equipe RatixPay</strong>
                        </p>
                    </div>
                </body>
                </html>
            `;
        } else {
            assunto = `❌ Saque ${statusSaque === 'rejeitado' ? 'Rejeitado' : 'Cancelado'}`;
            conteudo = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            line-height: 1.6;
                            color: #333;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }
                        .header {
                            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                            color: white;
                            padding: 30px;
                            text-align: center;
                            border-radius: 10px 10px 0 0;
                        }
                        .content {
                            background: #f8f9fa;
                            padding: 30px;
                            border-radius: 0 0 10px 10px;
                        }
                        .error-box {
                            background: #f8d7da;
                            border-left: 4px solid #dc3545;
                            padding: 20px;
                            margin: 20px 0;
                            border-radius: 5px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>❌ Saque ${statusSaque === 'rejeitado' ? 'Rejeitado' : 'Cancelado'}</h1>
                    </div>
                    <div class="content">
                        <p>Olá <strong>${afiliado.nome}</strong>,</p>
                        
                        <p>Infelizmente, sua solicitação de saque foi ${statusSaque === 'rejeitado' ? 'rejeitada' : 'cancelada'}.</p>
                        
                        <div class="error-box">
                            <h3 style="color: #721c24; margin-top: 0;">📋 Detalhes</h3>
                            <p><strong>Valor Solicitado:</strong> MZN ${valorSaque.toFixed(2)}</p>
                            <p><strong>Status:</strong> ${statusSaque === 'rejeitado' ? 'Rejeitado' : 'Cancelado'}</p>
                        </div>
                        
                        <p>O valor foi devolvido ao seu saldo disponível. Entre em contato com o suporte para mais informações.</p>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 30px; text-align: center;">
                            <strong>Equipe RatixPay</strong>
                        </p>
                    </div>
                </body>
                </html>
            `;
        }
        
        await professionalEmailService.enviarEmailSuporte(
            afiliado.email,
            assunto,
            conteudo,
            'notificacao_saque_afiliado'
        );
        
        console.log('✅ Notificação de saque enviada para afiliado:', afiliado.email);
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação de saque para afiliado:', error);
        // Não falhar o processo por erro de email
    }
}

// Função para processar pagamento aprovado - Fluxo completo
async function processarPagamentoAprovado(venda, produto, cliente, valorTotal, metodoPagamento, transactionId, refAfiliado = null, trackingParams = {}) {
    try {
        console.log('🎯 PROCESSANDO PAGAMENTO APROVADO - INICIANDO FLUXO COMPLETO...');
        console.log('📋 Usando transaction_id como identificador único:', transactionId);
        
        // 1. Usar transaction_id como ID único do pedido
        const idPedido = transactionId;
        console.log('📋 Transaction ID usado como ID do pedido:', idPedido);
        
        // 2. Estruturar informações do pedido em JSON
        const pedidoInfo = {
            pedidoId: venda.id, // UUID da venda
            idPedido: idPedido, // Usar transaction_id como ID do pedido
            cliente: {
                nome: cliente.nome,
                email: cliente.email,
                telefone: cliente.telefone || null,
                whatsapp: cliente.whatsapp || cliente.whatsappCliente || venda.cliente_whatsapp || null
            },
            produto: {
                id: produto.id,
                nome: produto.nome,
                valorOriginal: valorTotal,
                valorVendedor: Math.round(valorTotal * 0.9 * 100) / 100, // 90% do total
                customId: produto.custom_id
            },
            vendedor: {
                id: produto.vendedor_id,
                nome: produto.vendedor?.nome || 'Vendedor'
            },
            pagamento: {
                metodo: metodoPagamento,
                status: 'Aprovado',
                transactionId: transactionId,
                dataAprovacao: new Date().toISOString()
            },
            linkSucesso: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/upsell-page.html?pedido=${idPedido}`
        };
        
        console.log('📊 Informações do pedido estruturadas:', JSON.stringify(pedidoInfo, null, 2));
        
        // 3. Notificações serão enviadas após a criação do pedido
        console.log('📧 Notificações serão enviadas após a criação do pedido');
        
        // 4. Registrar logs de auditoria com pedidoId e idPedido sincronizados
        await registrarLogsAuditoria(pedidoInfo, venda);
        
        // 5. Enviar venda para UTMify (integração oficial)
        // IMPORTANTE: Este é o ponto principal de envio - quando a PayMoz responde com sucesso
        // Sempre tenta enviar, sem restrições - garante que o envio seja efetuado
        try {
            console.log('═══════════════════════════════════════════════════════════');
            console.log('🚀 UTMIFY: ENVIO AUTOMÁTICO - PayMoz respondeu com sucesso');
            console.log('📦 Venda ID:', venda.id);
            console.log('📦 Produto ID:', produto.id);
            console.log('⏰ Momento: Durante processamento do pagamento aprovado');
            console.log('═══════════════════════════════════════════════════════════');
            const utmifyService = require('../services/utmifyService');
            
            // Buscar produto completo com token UTMify
            const produtoCompleto = await Produto.findByPk(produto.id, {
                attributes: ['id', 'nome', 'utmfy_api_key', 'utmfy_active', 'utmfy_token_type']
            });
            
            // Preparar dados do cliente com IP
            // O IP é obrigatório na API UTMify, então usar valor padrão se não disponível
            const clienteCompleto = {
                ...cliente,
                ip: trackingParams.ip || cliente.ip || venda.cliente_ip || '0.0.0.0',
                cpf: cliente.cpf || cliente.cpfCliente || null,
                pais: cliente.pais || cliente.country || 'MZ'
            };
            
            // Atualizar venda com status e data de pagamento antes de enviar para UTMify
            // Garantir que a venda tenha os dados corretos para o envio
            try {
                await venda.update({
                    status: 'Pago',
                    data_pagamento: new Date().toISOString()
                });
                // Recarregar a venda para ter os dados atualizados
                await venda.reload();
            } catch (updateError) {
                console.warn('⚠️ UTMIFY: Erro ao atualizar venda antes do envio:', updateError.message);
                // Continuar mesmo se a atualização falhar
            }
            
            // Enviar para UTMify
            // Criar uma cópia da venda com o valor total correto e status atualizado
            const vendaComValorTotal = {
                ...venda.toJSON ? venda.toJSON() : venda,
                valor: valorTotal, // Usar o valor total passado para a função
                status: 'Pago', // Garantir status correto
                data_pagamento: venda.data_pagamento || new Date().toISOString() // Garantir data de pagamento
            };
            
            const trackingDataVenda = venda.tracking_data || {};
            const resultadoUtmify = await utmifyService.enviarVenda(
                vendaComValorTotal,
                produtoCompleto || produto,
                clienteCompleto,
                trackingParams,
                { 
                    isTest: false,
                    isApproved: true // Marcar como aprovado pois estamos em processarPagamentoAprovado
                }
            );
            
            if (resultadoUtmify.success) {
                console.log('═══════════════════════════════════════════════════════════');
                console.log('✅ UTMIFY: Venda enviada com SUCESSO automaticamente!');
                console.log('⏰ Enviado durante: Processamento do pagamento aprovado');
                console.log('📦 Venda ID:', venda.id);
                console.log('═══════════════════════════════════════════════════════════');
                
                // Marcar venda como enviada (apenas para histórico, não bloqueia novos envios)
                try {
                    const utmTracking = require('../utils/utmTracking');
                    const trackingDataAtualizado = utmTracking.mergeTrackingData(trackingDataVenda, {
                        utmfy_enviado: true,
                        utmfy_enviado_em: new Date().toISOString()
                    });
                    await venda.update({
                        tracking_data: trackingDataAtualizado
                    });
                    console.log('✅ UTMIFY: Venda marcada como enviada no banco de dados');
                } catch (updateError) {
                    console.error('⚠️ UTMIFY: Erro ao marcar venda como enviada:', updateError.message);
                    // Não falhar o processo por erro ao atualizar
                }
            } else if (resultadoUtmify.skipped) {
                console.log(`⚠️ UTMIFY: Envio pulado pelo serviço - ${resultadoUtmify.reason}`);
            } else {
                console.error('❌ UTMIFY: Erro ao enviar venda:', resultadoUtmify.error);
                // Não falhar o processo por erro no UTMify
            }
        } catch (utmifyError) {
            console.error('═══════════════════════════════════════════════════════════');
            console.error('❌ UTMIFY: EXCEÇÃO ao processar envio!');
            console.error('📦 Erro:', utmifyError.message);
            console.error('═══════════════════════════════════════════════════════════');
            // Não falhar o processo por erro no UTMify
        }
        
        // 7. Processar tracking de afiliados se aplicável
        await processarTrackingAfiliados(venda, produto, valorTotal, transactionId, refAfiliado);
        
        // 8. Detectar conversão de remarketing
        try {
            const remarketingConversaoService = require('../services/remarketingConversaoService');
            await remarketingConversaoService.detectarConversao(venda);
        } catch (conversaoError) {
            console.error('⚠️ Erro ao detectar conversão de remarketing (não crítico):', conversaoError);
        }
        
        // 9. Enviar webhook para venda aprovada
        try {
            console.log(`\n🔔 [PAGAMENTO DEBUG] ===== DISPARANDO WEBHOOK venda_aprovada =====`);
            console.log(`🔔 [PAGAMENTO DEBUG] Venda ID: ${venda.id}`);
            console.log(`🔔 [PAGAMENTO DEBUG] Produto ID: ${produto.id}`);
            console.log(`🔔 [PAGAMENTO DEBUG] Vendedor ID: ${produto.vendedor_id}`);
            console.log(`🔔 [PAGAMENTO DEBUG] Transaction ID: ${transactionId}`);
            
            const { enviarWebhook } = require('./webhooks');
            await enviarWebhook('venda_aprovada', {
                venda_id: venda.id,
                produto_id: produto.id,
                vendedor_id: produto.vendedor_id,
                valor: valorTotal,
                cliente_nome: cliente.nome || venda.cliente_nome,
                cliente_email: cliente.email || venda.cliente_email,
                cliente_telefone: cliente.telefone || venda.cliente_telefone,
                cliente_whatsapp: cliente.whatsapp || venda.cliente_whatsapp,
                transaction_id: transactionId,
                metodo_pagamento: metodoPagamento,
                data_aprovacao: new Date().toISOString()
            }, produto.vendedor_id, produto.id); // Passar user_id e produto_id para filtrar webhooks
            console.log(`🔔 [PAGAMENTO DEBUG] Webhook de venda aprovada processado`);
            console.log(`🔔 [PAGAMENTO DEBUG] ===== FIM DO DISPARO =====\n`);
        } catch (webhookError) {
            console.error(`\n❌ [PAGAMENTO DEBUG] ===== ERRO AO DISPARAR WEBHOOK =====`);
            console.error('❌ [PAGAMENTO DEBUG] Erro ao enviar webhook de venda:', webhookError);
            console.error('❌ [PAGAMENTO DEBUG] Stack:', webhookError.stack);
            console.error(`❌ [PAGAMENTO DEBUG] ===== FIM DO ERRO =====\n`);
            // Não falhar o processo por erro no webhook
        }
        
        console.log('✅ FLUXO DE PAGAMENTO APROVADO CONCLUÍDO COM SUCESSO');
        console.log('🔗 Link de sucesso:', pedidoInfo.linkSucesso);
        console.log('📋 PedidoId (UUID):', pedidoInfo.pedidoId);
        console.log('🔢 ID do Pedido:', pedidoInfo.idPedido);
        
        return pedidoInfo;
        
    } catch (error) {
        console.error('❌ Erro ao processar pagamento aprovado:', error);
        throw error;
    }
}

// Função para gerar número de pedido único
// Função removida - agora usamos transaction_id da e2payments como identificador único

// Função para enviar produto automaticamente via WhatsApp para o cliente
// Usa a sessão "default" do WhatsApp Manager
async function enviarProdutoViaWhatsApp(pedidoInfo, venda, produto) {
    try {
        // Verificar se cliente forneceu WhatsApp
        const whatsappCliente = pedidoInfo.cliente.whatsapp || venda.cliente_whatsapp;
        if (!whatsappCliente) {
            console.log('ℹ️ Cliente não forneceu WhatsApp. Produto não será enviado via WhatsApp.');
            return {
                success: false,
                skipped: true,
                message: 'WhatsApp do cliente não fornecido'
            };
        }

        // Verificar se produto tem link de conteúdo
        const linkConteudo = produto.link_conteudo || produto.linkConteudo;
        if (!linkConteudo) {
            console.log('ℹ️ Produto não possui link de conteúdo. Nada a enviar via WhatsApp.');
            return {
                success: false,
                skipped: true,
                message: 'Produto não possui link de conteúdo'
            };
        }

        console.log('📱 Preparando envio automático do produto via WhatsApp...');
        console.log('   Cliente:', pedidoInfo.cliente.nome);
        console.log('   WhatsApp:', whatsappCliente);
        console.log('   Pedido:', pedidoInfo.idPedido);
        console.log('   Produto:', produto.nome);
        console.log('   Link:', linkConteudo);

        // Carregar serviço de sessão WhatsApp
        const whatsappManager = require('../services/whatsappManager');
        // MessageMedia será tratado pelo manager (compatível com ambos)
        const fs = require('fs');
        const path = require('path');
        const axios = require('axios');

        // Verificar se a sessão WhatsApp está disponível (verificação rápida sem espera)
        // Sempre usar sessão 'default'
        const sessionId = 'default';
        const sessionStatus = whatsappManager.getStatus(sessionId);
        if (!sessionStatus.exists || !sessionStatus.isConnected) {
            console.log('ℹ️ Sessão WhatsApp não está conectada. Produto não será enviado via WhatsApp (ignorando silenciosamente).');
            return {
                success: false,
                skipped: true,
                message: 'Sessão WhatsApp não está conectada. Configure a sessão no admin.'
            };
        }

        // Formatar número do cliente para WhatsApp
        function formatPhoneNumber(phone) {
            if (!phone) return null;
            let cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.startsWith('0')) {
                cleanPhone = cleanPhone.substring(1);
            }
            if (!cleanPhone.startsWith('258')) {
                cleanPhone = '258' + cleanPhone;
            }
            return cleanPhone;
        }

        const clientPhone = formatPhoneNumber(whatsappCliente);
        if (!clientPhone) {
            throw new Error('Número de WhatsApp inválido');
        }

        // Verificar se é arquivo ou URL
        function isMediaLink(url) {
            if (!url) return false;
            // Se começa com http/https, verificar extensão
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const mediaExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.mp4', '.avi', '.mov', '.jpg', '.jpeg', '.png', '.gif'];
                return mediaExtensions.some(ext => url.toLowerCase().includes(ext));
            }
            // Se é caminho local, é mídia
            return url.startsWith('/uploads/') || path.isAbsolute(url);
        }

        const isMedia = isMediaLink(linkConteudo);
        const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP || '884460571';
        const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';

        // Obter valor da venda
        const valorTotal = venda.valor_total || pedidoInfo.produto.valorOriginal || produto.preco || 0;

        // Primeiro: Enviar recibo de compra simples
        const reciboMensagem = `📋 *RECIBO DE COMPRA - RatixPay*

Olá *${pedidoInfo.cliente.nome || 'Cliente'}*!

✅ *Compra Confirmada*
📦 *Produto:* ${produto.nome || 'Produto'}
🔢 *Pedido:* #${pedidoInfo.idPedido}
💰 *Valor Pago:* MZN ${valorTotal.toFixed(2)}
📅 *Data:* ${new Date().toLocaleString('pt-BR')}

Obrigado por sua compra! 🎉

*RatixPay - Sistema de Pagamentos*`;

        try {
            // 1. Enviar recibo de compra
            console.log('📋 Enviando recibo de compra para:', clientPhone);
            try {
                const reciboResult = await whatsappManager.sendMessage(clientPhone, reciboMensagem, null, sessionId);
                console.log('✅ Recibo de compra enviado:', reciboResult);
            } catch (reciboError) {
                console.error('❌ Erro ao enviar recibo:', reciboError);
                // Continuar mesmo se o recibo falhar
            }
            
            // Removido delay desnecessário - processamento imediato

            // 2. Enviar produto (URL ou arquivo)
            if (isMedia) {
                // É arquivo - enviar como mídia
                console.log('📁 Detectado arquivo, enviando como mídia...');
                
                // Tentar obter MessageMedia diretamente da URL ou caminho
                let media;
                try {
                    if (linkConteudo.startsWith('http://') || linkConteudo.startsWith('https://')) {
                        // URL externa - usar MessageMedia.fromUrl
                        console.log('📥 Baixando mídia de URL externa...');
                        // Para Baileys, usar URL diretamente na mensagem
                        // MessageMedia não é necessário para Baileys
                        media = { url: linkConteudo };
                        console.log('✅ Mídia baixada com sucesso');
                    } else {
                        // Arquivo local - ler do sistema de arquivos
                        const localPath = linkConteudo.startsWith('/') 
                            ? path.join(__dirname, '..', 'public', linkConteudo)
                            : linkConteudo;
                        
                        console.log('📂 Lendo arquivo local:', localPath);
                        if (!fs.existsSync(localPath)) {
                            throw new Error(`Arquivo não encontrado: ${localPath}`);
                        }
                        
                        const fileBuffer = fs.readFileSync(localPath);
                        const fileName = path.basename(localPath);
                        const ext = path.extname(fileName).toLowerCase();
                        
                        // Detectar MIME type
                        const mimeTypes = {
                            '.pdf': 'application/pdf',
                            '.doc': 'application/msword',
                            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            '.xls': 'application/vnd.ms-excel',
                            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            '.mp4': 'video/mp4',
                            '.jpg': 'image/jpeg',
                            '.jpeg': 'image/jpeg',
                            '.png': 'image/png',
                            '.zip': 'application/zip'
                        };
                        
                        // Para Baileys, usar objeto simples com dados do arquivo
                        const mimeType = mimeTypes[ext] || 'application/octet-stream';
                        const base64File = fileBuffer.toString('base64');
                        media = {
                            mimetype: mimeType,
                            data: base64File,
                            filename: fileName
                        };
                        console.log('✅ Arquivo local preparado:', fileName, mimeType);
                    }
                } catch (mediaError) {
                    console.error('❌ Erro ao preparar mídia:', mediaError);
                    throw mediaError;
                }
                
                // Enviar via sessão WhatsApp com mídia
                const mensagemProduto = `📦 *Seu Produto*

${produto.nome || 'Produto'}

RatixPay`;
                
                console.log('📤 Enviando produto (mídia) para:', clientPhone);
                const produtoResult = await whatsappManager.sendMessage(clientPhone, mensagemProduto, media, sessionId);
                console.log(`✅ Produto (mídia) enviado via sessão WhatsApp para ${clientPhone}:`, produtoResult);
                
            } else {
                // É URL simples - enviar mensagem com a URL
                console.log('🔗 Detectado URL, enviando mensagem com URL do produto...');
                
                const mensagemComUrl = `📦 *Seu Produto*

${produto.nome || 'Produto'}

🔗 ${linkConteudo}

RatixPay`;
                
                const urlResult = await whatsappManager.sendMessage(clientPhone, mensagemComUrl, null, sessionId);
                console.log(`✅ URL do produto enviada via sessão WhatsApp para ${clientPhone}:`, urlResult);
            }

            // 3. Enviar links dos produtos complementares (orderbumps) se existirem
            try {
                const ProdutoComplementarVendaService = require('../services/produtoComplementarVendaService');
                const produtosComplementares = await ProdutoComplementarVendaService.buscarProdutosComplementaresPorVenda(venda.id);
                
                if (produtosComplementares && produtosComplementares.length > 0) {
                    const produtosFormatados = await ProdutoComplementarVendaService.formatarProdutosComplementares(produtosComplementares);
                    
                    if (produtosFormatados.length > 0) {
                        let mensagemOrderBumps = `\n\n🎁 *PRODUTOS BÔNUS INCLUÍDOS:*\n\n`;
                        
                        produtosFormatados.forEach((produtoComp, index) => {
                            mensagemOrderBumps += `${index + 1}. *${produtoComp.nome}* (Bônus)\n`;
                            
                            if (produtoComp.link_conteudo && produtoComp.link_conteudo.trim() !== '') {
                                mensagemOrderBumps += `   🔗 ${produtoComp.link_conteudo}\n\n`;
                            } else {
                                mensagemOrderBumps += `   ⚠️ Link não disponível - entre em contato com o vendedor\n\n`;
                            }
                        });
                        
                        mensagemOrderBumps += `💡 *Total:* ${1 + produtosFormatados.length} produtos (1 principal + ${produtosFormatados.length} bônus)`;
                        
                        // Enviar mensagem com links dos orderbumps
                        await whatsappManager.sendMessage(clientPhone, mensagemOrderBumps, null, sessionId);
                        console.log(`✅ Links dos produtos bônus enviados via WhatsApp para ${clientPhone}`);
                    }
                }
            } catch (orderBumpError) {
                console.error('⚠️ Erro ao enviar links dos orderbumps via WhatsApp:', orderBumpError);
                // Não falhar o processo principal por erro de envio de orderbumps
            }

            return {
                success: true,
                message: 'Produto enviado com sucesso via WhatsApp',
                session: 'whatsapp-session',
                phone: clientPhone
            };

        } catch (error) {
            console.error('❌ Erro ao enviar via sessão WhatsApp:', error);
            console.error('❌ Stack trace:', error.stack);
            throw error;
        }

    } catch (error) {
        console.error('❌ Erro ao enviar produto via WhatsApp:', error);
        // Não falhar o processo principal por erro de envio WhatsApp
        return {
            success: false,
            message: error.message || 'Erro ao enviar produto via WhatsApp',
            error: error
        };
    }
}

// Função para enviar notificações automáticas
async function enviarNotificacoesAutomaticas(pedidoInfo, venda, produto) {
    try {
        console.log('📧 Enviando notificações automáticas para pedido #' + pedidoInfo.idPedido + '...');
        
        // Buscar dados do vendedor (incluindo push_subscription e role)
        const vendedor = await Usuario.findByPk(produto.vendedor_id, {
            attributes: ['id', 'nome', 'email', 'telefone', 'role', 'push_subscription']
        });
        if (!vendedor) {
            console.error('❌ Vendedor não encontrado para notificações');
            return;
        }
        
        // Não enviar notificações para códigos (apenas vendedores)
        if (vendedor.role === 'codigo') {
            console.log(`⚠️ Usuário ${vendedor.id} é um código, pulando notificações push`);
        }
        
        // 1. Notificação no Painel (Socket.IO) para VENDEDOR
        await enviarNotificacaoPainel(pedidoInfo, vendedor);
        
        // 2. Notificação Push REMOVIDA - já é enviada via vendaNotificationService.enviarNotificacaoNovaVenda
        // (evita duplicação de notificações push)
        
        // 3. ENVIO AUTOMÁTICO DO PRODUTO VIA WHATSAPP para CLIENTE
        console.log('📱 Iniciando envio automático do produto via WhatsApp para cliente...');
        await enviarProdutoViaWhatsApp(pedidoInfo, venda, produto);
        console.log('📱 Envio automático do produto via WhatsApp concluído');
        
        // Notificação WhatsApp para vendedor é enviada via vendaNotificationService.enviarNotificacaoNovaVenda
        // que já é chamada em outros lugares do código, evitando duplicação
        
        console.log('✅ Todas as notificações enviadas com sucesso para pedido #' + pedidoInfo.idPedido);
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificações:', error);
        // Não falhar o processo principal por erro de notificação
    }
}

// Função para formatar transaction_id do PayMoz como TXP_{8 últimos números}
function formatarTransactionIdPayMoz(transactionId) {
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
}


// Função removida - Notificação WhatsApp para vendedor agora é enviada via vendaNotificationService.enviarNotificacaoNovaVenda
// Isso evita duplicação de mensagens, pois a notificação já é enviada em outros pontos do código

// Função para enviar notificação push
async function enviarNotificacaoPush(pedidoInfo, vendedor, produto) {
    try {
        console.log('📱 Tentando enviar push notification para vendedor:', vendedor.id);
        
        // Verificar se vendedor tem push subscription
        if (!vendedor.push_subscription) {
            console.log(`ℹ️ Vendedor ${vendedor.id} (${vendedor.nome || vendedor.email}) não tem push notifications ativadas`);
            console.log('ℹ️ O vendedor precisa permitir notificações no navegador primeiro');
            return;
        }

        console.log('✅ Vendedor tem push subscription, preparando notificação...');

        const pushRoutes = require('./push');
        const valorAdicionado = pedidoInfo.produto.valorVendedor || (pedidoInfo.produto.valorOriginal * 0.9);
        const baseUrl = process.env.BASE_URL || 'https://ratixpay.com';
        const transactionIdFormatado = formatarTransactionIdPayMoz(pedidoInfo.idPedido);

        // Estrutura completa e melhorada da notificação push
        const notification = {
            title: 'Venda realizada!',
            body: `Recebeste uma comissão de ${valorAdicionado.toFixed(2)} MZN na tua conta.`,
            icon: '/assets/images/icons/icon-192x192.png',
            badge: '/assets/images/icons/icon-48x48.png',
            tag: `venda-${pedidoInfo.idPedido}`, // Tag única para agrupar notificações do mesmo pedido
            url: `${baseUrl}/gestao-vendas.html`,
            requireInteraction: false, // Não requer interação do usuário
            silent: false, // Fazer som/vibração
            sound: '/assets/sounds/alert.mp3', // Som da notificação
            vibrate: [200, 100, 200, 100, 200], // Padrão de vibração: vibrar 200ms, pausa 100ms, vibrar 200ms, pausa 100ms, vibrar 200ms
            data: {
                // Tipo de notificação
                tipo: 'venda',
                evento: 'nova_venda',
                
                // IDs e referências
                pedidoId: pedidoInfo.pedidoId, // UUID da venda
                idPedido: pedidoInfo.idPedido, // Transaction ID
                transactionId: transactionIdFormatado, // Transaction ID formatado
                produtoId: produto.id,
                vendedorId: vendedor.id,
                
                // Informações financeiras
                valorTotal: pedidoInfo.produto.valorOriginal,
                valorVendedor: valorAdicionado,
                valorFormatado: `MZN ${valorAdicionado.toFixed(2)}`,
                
                // Informações do produto
                produtoNome: produto.nome,
                produtoCustomId: produto.custom_id || null,
                
                // Informações do cliente
                clienteNome: pedidoInfo.cliente.nome,
                clienteEmail: pedidoInfo.cliente.email,
                clienteTelefone: pedidoInfo.cliente.telefone || null,
                
                // Informações do pagamento
                metodoPagamento: pedidoInfo.pagamento.metodo,
                statusPagamento: pedidoInfo.pagamento.status,
                dataAprovacao: pedidoInfo.pagamento.dataAprovacao,
                
                // URLs e links
                urlGestaoVendas: `${baseUrl}/gestao-vendas.html`,
                urlDetalhesPedido: `${baseUrl}/gestao-vendas.html?pedido=${pedidoInfo.idPedido}`,
                
                // Timestamp
                timestamp: new Date().toISOString(),
                dataFormatada: new Date().toLocaleString('pt-BR', { 
                    timeZone: 'Africa/Maputo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                
                // Produtos complementares (se houver)
                produtosComplementares: pedidoInfo.produtosComplementares || [],
                temProdutosComplementares: (pedidoInfo.produtosComplementares && pedidoInfo.produtosComplementares.length > 0) || false
            }
        };

        // Usar novo serviço de push notifications (suporta múltiplos dispositivos)
        const pushNotificationService = require('../services/pushNotificationService');
        console.log('📤 Enviando push notification com estrutura completa...');
        const resultado = await pushNotificationService.sendToUser(vendedor.id, notification);
        
        if (resultado.success) {
            console.log('✅ Push notification enviada com sucesso para vendedor:', vendedor.id);
            console.log(`   📋 Pedido: ${transactionIdFormatado}`);
            console.log(`   💰 Valor: MZN ${valorAdicionado.toFixed(2)}`);
            console.log(`   📱 Dispositivos: ${resultado.sent}/${resultado.total} enviados com sucesso`);
        } else {
            console.log('⚠️ Push notification não foi enviada (verifique logs acima para detalhes)');
        }

    } catch (error) {
        console.error('❌ Erro ao enviar push notification:', error);
        console.error('❌ Stack trace:', error.stack);
        // Não falhar o processo principal por erro de push notification
    }
}

// Função para enviar notificação no painel
async function enviarNotificacaoPainel(pedidoInfo, vendedor) {
    try {
        const socketService = require('../services/socketService');
        
        const notificacao = {
            title: '🎉 Novo Pedido Aprovado!',
            message: `Pedido ID: ${pedidoInfo.idPedido} - ${pedidoInfo.cliente.nome}`,
            type: 'success',
            data: {
                pedidoId: pedidoInfo.pedidoId,
                idPedido: pedidoInfo.idPedido,
                valor: pedidoInfo.produto.valorVendedor,
                cliente: pedidoInfo.cliente.nome
            }
        };
        
        socketService.sendToUser(vendedor.id, 'novo_pedido', notificacao);
        console.log('✅ Notificação no painel enviada para vendedor:', vendedor.id);
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação no painel:', error);
    }
}

// Função para registrar logs de auditoria
async function registrarLogsAuditoria(pedidoInfo, venda) {
    try {
        console.log('📝 Registrando logs de auditoria para pedido #' + pedidoInfo.idPedido + '...');
        
        // Log detalhado do processo com pedidoId e idPedido sincronizados
        const logData = {
            timestamp: new Date().toISOString(),
            action: 'pagamento_aprovado',
            pedidoId: pedidoInfo.pedidoId, // UUID para auditoria
            idPedido: pedidoInfo.idPedido, // ID único para rastreabilidade
            vendaId: venda.id,
            cliente: pedidoInfo.cliente,
            produto: pedidoInfo.produto,
            pagamento: pedidoInfo.pagamento,
            linkSucesso: pedidoInfo.linkSucesso,
            status: 'success',
            // Campos adicionais para rastreabilidade
            transactionId: pedidoInfo.pagamento.transactionId,
            dataAprovacao: pedidoInfo.pagamento.dataAprovacao,
            valorTotal: pedidoInfo.produto.valorOriginal,
            valorVendedor: pedidoInfo.produto.valorVendedor
        };
        
        console.log('📊 Log de auditoria (pedidoId: ' + pedidoInfo.pedidoId + ', idPedido: ' + pedidoInfo.idPedido + '):', JSON.stringify(logData, null, 2));
        
        // Aqui você pode salvar em um sistema de logs específico
        // Por exemplo: await LogService.registrar(logData);
        
        console.log('✅ Logs de auditoria registrados com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao registrar logs de auditoria:', error);
    }
}




// Função para formatar número de celular para API de pagamentos
function formatarNumeroCelular(numero) {
    // Remover todos os caracteres não numéricos
    let numeroLimpo = numero.replace(/\D/g, '');
    
    // Se começar com 258 (código do país), remover
    if (numeroLimpo.startsWith('258')) {
        numeroLimpo = numeroLimpo.substring(3);
    }
    
    // Se começar com 0, remover
    if (numeroLimpo.startsWith('0')) {
        numeroLimpo = numeroLimpo.substring(1);
    }
    
    // Garantir que tenha 9 dígitos
    if (numeroLimpo.length !== 9) {
        throw new Error('Número de celular deve ter 9 dígitos');
    }
    
    // Verificar se é um número válido de Moçambique (84, 85, 86, 87)
    if (!['84', '85', '86', '87'].includes(numeroLimpo.substring(0, 2))) {
        throw new Error('Número de celular inválido para Moçambique');
    }
    
    return numeroLimpo;
}

// POST - Receber reclamação de suporte (deve vir antes das rotas genéricas)
router.post('/support-request', async (req, res) => {
    try {
        const { clienteNome, numeroPedido, problema, descricao, dataHora } = req.body;
        
        if (!clienteNome || !numeroPedido || !problema || !descricao) {
            return res.status(400).json({ success: false, message: 'Dados obrigatórios não fornecidos' });
        }
        
        // Enviar para email
        const emailData = {
            to: 'sistema@ratixpay.com',
            subject: `🚨 Reclamação de Suporte - Pedido #${numeroPedido}`,
            clienteNome,
            numeroPedido,
            problema,
            descricao,
            dataHora
        };
        
        await professionalEmailService.enviarEmailSuporte(emailData.email, emailData.assunto, emailData.conteudo, 'reclamacao');
        
        // Enviar para WhatsApp usando sessão única
        const whatsappManager = require('../services/whatsappManager');
        const adminPhone = process.env.ADMIN_WHATSAPP || '258867792543';
        
        const getProblemText = (prob) => {
            const problemas = {
                'link_quebrado': '🔗 Link do produto quebrado',
                'produto_errado': '📦 Produto não corresponde à descrição',
                'fraude': '🚨 Fraude',
                'reembolso': '💰 Reembolso',
                'outro': '❓ Outro problema',
                'mais_info': '➕ Mais informações'
            };
            return problemas[prob] || prob;
        };
        
        const mensagemReclamacao = `🚨 *Nova Reclamação*

👤 ${clienteNome}
📋 Pedido #${numeroPedido}
🚨 ${getProblemText(problema)}

RatixPay`;
        
        await whatsappManager.sendNotificationSafely(adminPhone, mensagemReclamacao);
        
        res.json({ success: true, message: 'Reclamação enviada com sucesso!' });
        
    } catch (error) {
        console.error('❌ Erro ao processar reclamação de suporte:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Rota de teste para verificar se o problema é específico
router.post('/test-support', async (req, res) => {
    res.json({ success: true, message: 'Rota de teste funcionando!' });
});

// GET - Produtos complementares (Order Bump) por public_id (6 dígitos) ou custom_id
router.get('/pagamento/order-bump/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Determinar se o parâmetro é public_id numérico (6 dígitos) ou custom_id alfanumérico
        const isPublicId = /^\d{6}$/.test(id);

        // Buscar produto principal por public_id ou custom_id
        const produtoPrincipal = await Produto.findOne({
            where: isPublicId ? { public_id: id } : { custom_id: id }
        });

        if (!produtoPrincipal) {
            return res.status(404).json({
                success: false,
                error: 'Produto principal não encontrado'
            });
        }

        // Se o produto principal não tiver order bump ativo, retornar vazio
        if (produtoPrincipal.order_bump_ativo !== true) {
            return res.json({
                success: true,
                produto_principal: {
                    id: produtoPrincipal.id,
                    public_id: produtoPrincipal.public_id,
                    custom_id: produtoPrincipal.custom_id,
                    vendedor_id: produtoPrincipal.vendedor_id
                },
                produtos_complementares: []
            });
        }

        // Buscar produtos complementares do mesmo vendedor OU os explicitamente configurados
        const { Op } = require('sequelize');
        let whereClause = {
            vendedor_id: produtoPrincipal.vendedor_id,
            ativo: true,
            preco: { [Op.gt]: 0 },
            id: { [Op.ne]: produtoPrincipal.id }
        };

        // Se houver lista configurada de produtos específicos, filtrar por ela
        if (Array.isArray(produtoPrincipal.order_bump_produtos) && produtoPrincipal.order_bump_produtos.length > 0) {
            const ids = produtoPrincipal.order_bump_produtos
                .map(p => p.id)
                .filter(Boolean);
            if (ids.length > 0) {
                whereClause.id = { [Op.in]: ids };
            }
        }

        const produtosComplementares = await Produto.findAll({
            where: whereClause,
            order: [
                ['vendas', 'DESC'],
                ['created_at', 'DESC']
            ],
            limit: 3
        });

        // Mapear apenas os campos necessários para o frontend
        const mapped = produtosComplementares.map(p => ({
            id: p.id,
            public_id: p.public_id,
            custom_id: p.custom_id,
            nome: p.nome,
            descricao: p.descricao,
            preco: Number(p.preco),
            desconto: Number(p.desconto || 0),
            preco_com_desconto: p.desconto ? Number((Number(p.preco) - (Number(p.preco) * Number(p.desconto) / 100)).toFixed(2)) : Number(p.preco),
            vendedor_id: p.vendedor_id,
            imagem_url: p.imagem_url || null,
            link_conteudo: p.link_conteudo || null,
            tipo: p.tipo || 'digital'
        }));

        return res.json({
            success: true,
            produto_principal: {
                id: produtoPrincipal.id,
                public_id: produtoPrincipal.public_id,
                custom_id: produtoPrincipal.custom_id,
                vendedor_id: produtoPrincipal.vendedor_id
            },
            produtos_complementares: mapped
        });

    } catch (error) {
        console.error('❌ Erro ao carregar produtos do Order Bump:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno ao buscar produtos complementares'
        });
    }
});

// POST - Processar pagamento
router.post('/pagar', async (req, res) => {
    try {
        const {
            produtoPublicId, // Mudança: usar public_id em vez de produtoId
            numeroCelular,
            numero_celular, // Campo alternativo
            metodo,
            nomeCliente,
            emailCliente,
            whatsappCliente,
            cpfCliente,
            enderecoCliente,
            cidadeCliente,
            paisCliente,
            afiliadoCodigo,
            ref, // Parâmetro de referência do afiliado
            cupomDesconto,
            observacoes,
            linkConteudo,
            utmSource: utmSourceParam,
            utmMedium: utmMediumParam,
            utmCampaign: utmCampaignParam,
            origemTrafico: origemTraficoParam,
            vendorEmail,
            orderBumpProducts = [], // Array de produtos do Order Bump
            isSpecialProduct = false, // Flag para produto especial N0SAITYAX
            productName = 'Produto', // Nome do produto
            valor // Valor total calculado pelo frontend (incluindo descontos)
        } = req.body;

        // Usar numero_celular se numeroCelular não estiver disponível
        const numeroCelularFinal = numeroCelular || numero_celular;

        
        

        // Validações básicas
        if (!produtoPublicId || !numeroCelularFinal || !metodo) {
            return res.status(400).json({
                success: false,
                error: 'Dados obrigatórios: produtoPublicId, numeroCelular, metodo'
            });
        }
        
        // Validar método de pagamento
        if (!['mpesa', 'emola'].includes(metodo.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: 'Método de pagamento inválido. Use mpesa ou emola.'
            });
        }

        // Buscar produto usando public_id
        
        // Validar formato do public_id
        if (!/^\d{6}$/.test(produtoPublicId)) {
            return res.status(400).json({
                success: false,
                error: 'ID do produto inválido'
            });
        }
        
        const produto = await Produto.findOne({ where: { public_id: produtoPublicId } });

        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }


        // Usar valor do frontend se disponível, senão calcular
        let valorTotal;
        let valorOriginalProduto; // Valor original do produto sem desconto
        let valorProdutoPrincipal; // Valor do produto principal (com desconto aplicado)
        let produtosOrderBump = []; // Array de produtos do Order Bump
        let desconto = parseFloat(produto.desconto) || 0; // Desconto do produto
        
        if (valor && valor > 0) {
            // Usar valor calculado pelo frontend (já inclui descontos e order bump)
            valorTotal = parseFloat(valor);
            console.log(`💰 Usando valor do frontend: MZN ${valorTotal}`);
            
            // Para valorOriginal, usar o preço original do produto
            valorOriginalProduto = parseFloat(produto.preco) || 0;
            
            // Calcular valor do produto principal com desconto aplicado
            valorProdutoPrincipal = parseFloat(produto.preco) || 0;
            
            // Se há desconto, calcular o valor com desconto
            if (desconto > 0) {
                valorProdutoPrincipal = valorProdutoPrincipal - (valorProdutoPrincipal * desconto / 100);
            }
            
            console.log(`💰 Valor produto principal com desconto: MZN ${valorProdutoPrincipal}`);
            
            // Processar produtos do Order Bump se fornecidos
            if (orderBumpProducts && orderBumpProducts.length > 0) {
                console.log(`🎯 Processando produtos do Order Bump do frontend...`);
                
                for (const produtoBump of orderBumpProducts) {
                    // Validar se o produto do Order Bump pertence ao mesmo vendedor
                    if (produtoBump.vendedor_id !== produto.vendedor_id) {
                        console.log(`⚠️ Produto ${produtoBump.nome} não pertence ao mesmo vendedor. Ignorando.`);
                        continue;
                    }
                    
                    let valorProdutoBump = parseFloat(produtoBump.preco) || 0;
                    let descontoBump = parseFloat(produtoBump.desconto) || 0;
                    
                    // Aplicar desconto se houver
                    if (descontoBump > 0) {
                        valorProdutoBump = valorProdutoBump - (valorProdutoBump * descontoBump / 100);
                    }
                    
                    produtosOrderBump.push({
                        ...produtoBump,
                        valor_final: valorProdutoBump
                    });
                    
                    console.log(`   📦 ${produtoBump.nome}: MZN ${valorProdutoBump}`);
                }
            }
        } else {
            // Fallback: calcular valor no backend (lógica antiga)
            console.log(`⚠️ Valor não enviado pelo frontend, calculando no backend...`);
            
            // Calcular valor do produto principal
            valorProdutoPrincipal = parseFloat(produto.preco) || 0;
            
            // Guardar valor original
            valorOriginalProduto = valorProdutoPrincipal;
            
            // Se há desconto, calcular o valor com desconto
            if (desconto > 0) {
                valorProdutoPrincipal = valorProdutoPrincipal - (valorProdutoPrincipal * desconto / 100);
            }
            
            // Calcular valor total dos produtos do Order Bump
            let valorOrderBump = 0;
            
            if (orderBumpProducts && orderBumpProducts.length > 0) {
                console.log(`🎯 Calculando valores do Order Bump...`);
                
                for (const produtoBump of orderBumpProducts) {
                    // Validar se o produto do Order Bump pertence ao mesmo vendedor
                    if (produtoBump.vendedor_id !== produto.vendedor_id) {
                        console.log(`⚠️ Produto ${produtoBump.nome} não pertence ao mesmo vendedor. Ignorando.`);
                        continue;
                    }
                    
                    let valorProdutoBump = parseFloat(produtoBump.preco) || 0;
                    let descontoBump = parseFloat(produtoBump.desconto) || 0;
                    
                    // Aplicar desconto se houver
                    if (descontoBump > 0) {
                        valorProdutoBump = valorProdutoBump - (valorProdutoBump * descontoBump / 100);
                    }
                    
                    valorOrderBump += valorProdutoBump;
                    produtosOrderBump.push({
                        ...produtoBump,
                        valor_final: valorProdutoBump
                    });
                    
                    console.log(`   📦 ${produtoBump.nome}: MZN ${valorProdutoBump}`);
                }
            }
            
            // Valor total da transação
            valorTotal = valorProdutoPrincipal + valorOrderBump;
        }
        

        // Aplicar cupom se fornecido
        if (cupomDesconto) {
            // Implementar lógica de cupom aqui
        }
        
        // Aplicar taxa de 90% para o vendedor (valor_final = 90% do valor original)
        const valorFinal = valorTotal * 0.9;
        const valorOriginal = valorOriginalProduto; // Valor original do produto sem desconto

        console.log(`💰 Valores finais:`);
        console.log(`   💳 Valor total cobrado: MZN ${valorTotal}`);
        console.log(`   💼 Valor para vendedor (90%): MZN ${valorFinal}`);
        console.log(`   🏢 Taxa da plataforma (10%): MZN ${valorTotal - valorFinal}`);
        console.log(`   📊 Valor original do produto: MZN ${valorOriginal}`);

        // Formatar número de celular para a API de pagamentos
        if (!numeroCelularFinal) {
            return res.status(400).json({
                success: false,
                error: 'Número de celular é obrigatório'
            });
        }
        
        const numeroFormatado = formatarNumeroCelular(numeroCelularFinal);


        // Obter IP do cliente
        const clienteIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const userAgent = req.get('User-Agent');

        // Obter dados de analytics se disponíveis
        const analytics = req.analytics || {};
        const origemTrafico = analytics.origemTrafico || origemTraficoParam || 'Direto';
        
        // Usar utilitário aprimorado para capturar parâmetros UTM
        const utmTracking = require('../utils/utmTracking');
        
        // Capturar parâmetros UTM de múltiplas fontes
        const utmParams = utmTracking.captureUTMParameters({
            reqBody: req.body,
            reqQuery: req.query,
            analytics: analytics,
            ip: clienteIp
        });
        
        // Validar parâmetros capturados
        const validation = utmTracking.validateUTMParameters(utmParams);
        if (!validation.valid) {
            console.warn('⚠️ UTM: Erros de validação:', validation.errors);
        }
        if (validation.warnings.length > 0) {
            console.log('ℹ️ UTM: Avisos:', validation.warnings);
        }
        
        // Log formatado dos parâmetros capturados
        utmTracking.logUTMParameters(utmParams, 'checkout');
        
        // Preparar parâmetros de rastreamento para UTMify (inclui IP)
        const trackingParams = {
            utm_source: utmParams.utm_source,
            utm_medium: utmParams.utm_medium,
            utm_campaign: utmParams.utm_campaign,
            utm_content: utmParams.utm_content,
            utm_term: utmParams.utm_term,
            src: utmParams.src,
            sck: utmParams.sck,
            ip: utmParams.ip
        };
        
        // Preparar tracking_data para salvar no banco (sem IP, pois será adicionado no backend)
        const trackingDataForDB = utmTracking.prepareTrackingDataForDB(utmParams, {
            includeMetadata: false,
            includeIP: false
        });

        // Inicializar banco se necessário
        console.log(`🔍 Verificando inicialização do banco: ${databaseManager.initialized}`);
        if (!databaseManager.initialized) {
            console.log('🔄 Inicializando banco de dados...');
            await databaseManager.initialize();
            console.log('✅ Banco de dados inicializado');
        } else {
            console.log('✅ Banco de dados já inicializado');
        }

        // Verificar se o produto tem vendedor_id
        console.log(`🔍 Verificando vendedor_id do produto ${produto.id}:`);
        console.log(`   - Vendedor ID: ${produto.vendedor_id}`);
        console.log(`   - Tipo: ${typeof produto.vendedor_id}`);
        console.log(`   - É null? ${produto.vendedor_id === null}`);
        console.log(`   - É undefined? ${produto.vendedor_id === undefined}`);
        console.log(`   - É 0? ${produto.vendedor_id === 0}`);
        console.log(`   - É falsy? ${!produto.vendedor_id}`);
        
        if (!produto.vendedor_id) {
            console.error('❌ Produto sem vendedor_id:', produto.id);
            return res.status(500).json({
                success: false,
                error: 'Produto não possui vendedor associado'
            });
        }

        console.log(`👤 Vendedor do produto: ${produto.vendedor_id}`);

        // Gerar referência de pagamento única para toda a transação
        const referenciaPagamento = `RTX${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
        
        // Preparar dados para múltiplas vendas
        const vendasParaCriar = [];
        
        // 1. Venda do produto principal
        const publicIdPrincipal = String(Math.floor(Math.random() * 900000) + 100000);
        
        // Garantir que valorProdutoPrincipal está definido
        if (typeof valorProdutoPrincipal === 'undefined' || valorProdutoPrincipal === null) {
            console.error('❌ valorProdutoPrincipal não está definido!');
            valorProdutoPrincipal = parseFloat(produto.preco) || 0;
            let desconto = parseFloat(produto.desconto) || 0;
            if (desconto > 0) {
                valorProdutoPrincipal = valorProdutoPrincipal - (valorProdutoPrincipal * desconto / 100);
            }
        }
        
        const valorVendedorPrincipal = valorProdutoPrincipal * 0.9;
        const taxaAdminPrincipal = valorProdutoPrincipal * 0.1;
        
        // Determinar código de afiliado (prioridade: ref > afiliadoCodigo)
        const codigoAfiliadoFinal = ref || afiliadoCodigo || null;
        
        // Salvar o valor total pago (com desconto) nas observações para referência futura
        const observacoesComValorTotal = `Produto principal: ${produto.nome} | Valor total pago: MZN ${valorProdutoPrincipal.toFixed(2)}${observacoes ? ' | ' + observacoes : ''}`;
        
        vendasParaCriar.push({
            public_id: publicIdPrincipal,
            produto_id: produto.id,
            vendedor_id: produto.vendedor_id,
            cliente_nome: nomeCliente || 'Cliente',
            cliente_email: emailCliente || 'cliente@exemplo.com',
            cliente_telefone: numeroFormatado || numeroCelularFinal || '000000000',
            cliente_whatsapp: whatsappCliente || null,
            metodo_pagamento: metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola',
            valor: valorVendedorPrincipal, // 90% do valor com desconto
            taxa_admin: parseFloat(taxaAdminPrincipal.toFixed(2)),
            valor_vendedor: parseFloat(valorVendedorPrincipal.toFixed(2)),
            status: 'Pendente',
            referencia_pagamento: referenciaPagamento,
            afiliado_ref: codigoAfiliadoFinal, // Salvar código de afiliado na venda
            observacoes: observacoesComValorTotal,
            tracking_data: trackingDataForDB // Salvar parâmetros UTM
        });
        
        // Log para confirmar que tracking_data será salvo
        console.log('💾 UTM: Salvando tracking_data na venda principal:', JSON.stringify(trackingDataForDB, null, 2));
        
        // 2. Vendas dos produtos do Order Bump (em ordem: orderbump1, orderbump2, ...)
        if (produtosOrderBump.length > 0) {
            console.log(`🎯 Criando vendas para ${produtosOrderBump.length} produtos do Order Bump...`);
            
            produtosOrderBump.forEach((produtoBump, index) => {
                const publicIdBump = String(Math.floor(Math.random() * 900000) + 100000);
                const valorVendedorBump = produtoBump.valor_final * 0.9;
                const taxaAdminBump = produtoBump.valor_final * 0.1;
                
                vendasParaCriar.push({
                    public_id: publicIdBump,
                    produto_id: produtoBump.id,
                    vendedor_id: produtoBump.vendedor_id,
                    cliente_nome: nomeCliente || 'Cliente',
                    cliente_email: emailCliente || 'cliente@exemplo.com',
                    cliente_telefone: numeroFormatado || numeroCelularFinal || '000000000',
            cliente_whatsapp: whatsappCliente || null,
                    metodo_pagamento: metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola',
                    valor: valorVendedorBump,
                    taxa_admin: parseFloat(taxaAdminBump.toFixed(2)),
                    valor_vendedor: parseFloat(valorVendedorBump.toFixed(2)),
                    status: 'Pendente',
                    referencia_pagamento: referenciaPagamento,
                    afiliado_ref: codigoAfiliadoFinal, // Salvar código de afiliado também nas vendas de Order Bump
                    observacoes: `Order Bump ${index + 1}: ${produtoBump.nome}${observacoes ? ' | ' + observacoes : ''}`,
                    tracking_data: trackingDataForDB // Salvar parâmetros UTM
                });
                
                console.log(`   📦 Venda Order Bump ${index + 1}: ${produtoBump.nome} - MZN ${valorVendedorBump}`);
            });
        }
        
        console.log(`📊 Total de vendas a serem criadas: ${vendasParaCriar.length}`);
        console.log(`🔗 Referência de pagamento única: ${referenciaPagamento}`);

        // Debug: Log dos dados que serão inseridos
        console.log('🔍 Dados das vendas que serão inseridas:', JSON.stringify(vendasParaCriar, null, 2));

        // Salvar múltiplas vendas no banco ANTES do processamento do pagamento
        const vendasCriadas = [];
        try {
            const { sequelize } = require('../config/database');
            
            const insertQuery = `
                INSERT INTO vendas (
                    id, public_id, produto_id, vendedor_id, valor, valor_vendedor, taxa_admin,
                    cliente_nome, cliente_email, cliente_telefone, cliente_whatsapp, metodo_pagamento, 
                    referencia_pagamento, status, observacoes, afiliado_ref, tracking_data, created_at, updated_at
                ) VALUES (
                    :id, :public_id, :produto_id, :vendedor_id, :valor, :valor_vendedor, :taxa_admin,
                    :cliente_nome, :cliente_email, :cliente_telefone, :cliente_whatsapp, :metodo_pagamento,
                    :referencia_pagamento, :status, :observacoes, :afiliado_ref, :tracking_data::jsonb, :created_at, :updated_at
                ) RETURNING *
            `;
            
            const now = new Date();
            
            // Criar cada venda individualmente
            for (const vendaData of vendasParaCriar) {
                const result = await sequelize.query(insertQuery, {
                    replacements: {
                        id: require('crypto').randomUUID(),
                        public_id: vendaData.public_id,
                        produto_id: vendaData.produto_id,
                        vendedor_id: vendaData.vendedor_id,
                        valor: vendaData.valor,
                        valor_vendedor: vendaData.valor_vendedor,
                        taxa_admin: vendaData.taxa_admin,
                        cliente_nome: vendaData.cliente_nome,
                        cliente_email: vendaData.cliente_email,
                        cliente_telefone: vendaData.cliente_telefone,
                        cliente_whatsapp: vendaData.cliente_whatsapp || null,
                        metodo_pagamento: vendaData.metodo_pagamento,
                        referencia_pagamento: vendaData.referencia_pagamento,
                        status: vendaData.status,
                        observacoes: vendaData.observacoes,
                        afiliado_ref: vendaData.afiliado_ref || null,
                        tracking_data: vendaData.tracking_data ? JSON.stringify(vendaData.tracking_data) : null,
                        created_at: now,
                        updated_at: now
                    },
                    type: sequelize.QueryTypes.SELECT
                });
                
                // Buscar a venda criada pelo public_id
                const vendaCriada = await Venda.findOne({ where: { public_id: vendaData.public_id } });
                vendasCriadas.push(vendaCriada);
                
                const tipoVenda = vendaData.observacoes?.includes('Order Bump') ? 'Order Bump' : 
                                 vendaData.observacoes?.includes('Upsell') ? 'Upsell' : 'Principal';
                console.log(`✅ Venda ${tipoVenda} criada: ID ${vendaCriada.id} - ${vendaData.public_id}`);
                
                // Remarketing agora é configurado diretamente no produto
                // A funcionalidade foi integrada na criação de produtos
            }
            
            console.log(`🎉 Total de ${vendasCriadas.length} vendas criadas com sucesso!`);
            
        } catch (createError) {
            console.error('❌ Erro ao criar vendas:', createError);
            console.error('🔍 Dados que causaram o erro:', JSON.stringify(vendasParaCriar, null, 2));
            throw createError;
        }
        
        // Salvar produtos complementares no banco de dados
        console.log('🔍 Verificando orderBumpProducts:', {
            exists: !!orderBumpProducts,
            length: orderBumpProducts ? orderBumpProducts.length : 0,
            data: orderBumpProducts
        });
        
        if (orderBumpProducts && orderBumpProducts.length > 0) {
            try {
                console.log('💾 Salvando produtos complementares no banco de dados...');
                console.log('📦 Dados completos dos produtos complementares:', JSON.stringify(orderBumpProducts, null, 2));
                const ProdutoComplementarVendaService = require('../services/produtoComplementarVendaService');
                
                // Usar a primeira venda (produto principal) como referência
                const vendaPrincipal = vendasCriadas[0];
                
                // Preparar dados dos produtos complementares
                const produtosComplementaresParaSalvar = await Promise.all(orderBumpProducts.map(async (produto) => {
                    // Buscar produto original para garantir que temos o link_conteudo
                    let linkConteudo = produto.link_conteudo || produto.linkConteudo || '';
                    
                    if (!linkConteudo && produto.produto_complementar_id) {
                        try {
                            const produtoOriginal = await Produto.findByPk(produto.produto_complementar_id || produto.id);
                            if (produtoOriginal && produtoOriginal.link_conteudo) {
                                linkConteudo = produtoOriginal.link_conteudo;
                                console.log(`✅ Link de conteúdo recuperado do produto original: ${produtoOriginal.nome}`);
                            }
                        } catch (error) {
                            console.error(`❌ Erro ao buscar produto original para link_conteudo:`, error);
                        }
                    }
                    
                    console.log('🔍 Mapeando produto complementar para salvar:', {
                        id: produto.id,
                        produto_complementar_id: produto.produto_complementar_id,
                        nome: produto.nome,
                        preco: produto.preco,
                        preco_com_desconto: produto.preco_com_desconto,
                        desconto: produto.desconto,
                        imagem_url: produto.imagem_url,
                        link_conteudo: linkConteudo,
                        descricao: produto.descricao,
                        tipo: produto.tipo,
                        vendedor_id: produto.vendedor_id
                    });
                    
                    return {
                        id: produto.produto_complementar_id || produto.id,
                        nome: produto.nome || 'Produto Complementar',
                        preco: parseFloat(produto.preco_com_desconto || produto.preco) || 0,
                        desconto: parseFloat(produto.desconto || 0),
                        imagem: produto.imagem_url || produto.imagem || '', // Usar imagem_url ou imagem
                        miniatura: '', // A tabela produtos não tem miniatura
                        link_conteudo: linkConteudo, // Garantir que sempre temos o link
                        descricao: produto.descricao || produto.description || '', // Múltiplas possibilidades
                        tipo: produto.tipo || produto.type || 'digital',
                        vendedor_id: produto.vendedor_id || vendaPrincipal.vendedor_id
                    };
                }));
                
                // Salvar no banco de dados
                await ProdutoComplementarVendaService.salvarProdutosComplementares(
                    vendaPrincipal.id, 
                    produtosComplementaresParaSalvar
                );
                
                console.log('✅ Produtos complementares salvos no banco de dados com sucesso!');
                
            } catch (complementarError) {
                console.error('❌ Erro ao salvar produtos complementares:', complementarError);
                // Não falhar a transação por causa dos produtos complementares
                console.log('⚠️ Continuando com o processamento do pagamento...');
            }
        }
        
        // Usar a primeira venda (produto principal) como referência principal
        const venda = vendasCriadas[0];
        
        // Transação registrada - sem necessidade de cancelamento automático
        
        // Registrar estatística de venda pendente na tabela estatisticas_vendas
        try {
            // await EstatisticaVenda.registrarTransacaoPendente(vendaData.pagamentoTransacaoId, vendaData.pagamentoValor);
            console.log(`📊 Estatística de transação pendente registrada`);
        } catch (error) {
            console.error('❌ Erro ao registrar estatística de transação pendente:', error);
            // Não falhar o processo se a estatística falhar
        }

        // Processar pagamento ANTES de retornar resposta para obter status real
        console.log('🔄 Processando pagamento para obter status real...');
        
        // Validar e ajustar valor para e2payment (deve ser >= 1 e inteiro)
        let valorParaPagamento = Math.round(valorTotal);
        if (valorParaPagamento < 1) {
            console.log(`⚠️ Valor muito baixo (${valorParaPagamento}), ajustando para 1`);
            valorParaPagamento = 1;
        }
        
        console.log(`💰 Valor original: MZN ${valorTotal}`);
        console.log(`💰 Valor para PayMoz: MZN ${valorParaPagamento}`);
        
        try {
            const resultadoPagamento = await paymozService.processPayment(
                metodo.toLowerCase(), // Garantir que o método está em lowercase
                valorParaPagamento, // Usar valor ajustado para PayMoz
                numeroFormatado,
                `${produto.custom_id}${produtosOrderBump.length > 0 ? `+${produtosOrderBump.length}OB` : ''}` // Referência externa do pagamento incluindo Order Bump
            );

            console.log('📊 Resultado do pagamento PayMoz:', resultadoPagamento);

            // Determinar status baseado na resposta real da API PayMoz
            let statusPagamento = 'Pendente';
            let statusVenda = 'Pendente';
            let mensagemResposta = 'Pagamento iniciado com sucesso';

            // Verificar primeiro se há erro ou cancelamento (independente do success)
            const isError = resultadoPagamento.status === 'error' || 
                           resultadoPagamento.status === 'failed' ||
                           resultadoPagamento.status === 'rejected';
            
            const isCancelled = resultadoPagamento.status === 'cancelled' || 
                               resultadoPagamento.status === 'canceled';
            
            const isSuccess = resultadoPagamento.status === 'approved' || 
                             resultadoPagamento.status === 'success' || 
                             resultadoPagamento.status === 'COMPLETED';

            console.log(`📊 Status recebido: ${resultadoPagamento.status}`);
            console.log(`📊 Success: ${resultadoPagamento.success}`);
            console.log(`📊 Transaction ID (output_ThirdPartyReference): ${resultadoPagamento.transaction_id}`);
            console.log(`📊 Verificação de sucesso: ${isSuccess}`);
            console.log(`📊 Verificação de erro: ${isError}`);
            console.log(`📊 Verificação de cancelamento: ${isCancelled}`);

            // Tratar erro primeiro - mas NÃO forçar cancelamento
            // Apenas usar status real retornado pela PayMoz
            if (isError) {
                // API retornou erro - usar status real, mas não forçar cancelamento
                console.log('⚠️ API PayMoz retornou erro - usando status real da resposta');
                
                const motivo = resultadoPagamento.data?.error_message || resultadoPagamento.data?.message || resultadoPagamento.message || 'Pagamento rejeitado pela API';
                
                // Usar status real da PayMoz - não forçar cancelamento
                // Se a PayMoz retornou erro explícito, usar esse status
                const statusReal = resultadoPagamento.status || 'Pendente';
                
                // Atualizar vendas com status real da PayMoz
                for (const vendaItem of vendasCriadas) {
                    await vendaItem.update({
                        status: statusReal === 'error' || statusReal === 'failed' ? 'Rejeitado' : 'Pendente',
                        pagamento_status: statusReal === 'error' || statusReal === 'failed' ? 'Rejeitado' : 'Pendente',
                        falhaMotivo: motivo,
                        falhaData: new Date().toISOString(),
                        falhaId: `ERROR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                    });
                }
                
                // Usar status real da PayMoz
                statusPagamento = statusReal === 'error' || statusReal === 'failed' ? 'Rejeitado' : 'Pendente';
                statusVenda = statusReal === 'error' || statusReal === 'failed' ? 'Rejeitado' : 'Pendente';
                mensagemResposta = 'Status real da transação: ' + (statusReal === 'error' || statusReal === 'failed' ? 'Rejeitado' : 'Pendente');
                
                console.log(`✅ Status definido como ${statusPagamento} - usando status real da PayMoz`);
                
            } else if (isCancelled) {
                // API retornou cancelamento - usar status real
                console.log('⚠️ API PayMoz retornou cancelamento - usando status real da resposta');
                
                const motivo = resultadoPagamento.data?.error_message || resultadoPagamento.message || 'Pagamento cancelado pela API';
                
                // Usar status real da PayMoz
                for (const vendaItem of vendasCriadas) {
                    await vendaItem.update({
                        status: 'Cancelada', // Status real retornado pela PayMoz
                        pagamento_status: 'Cancelada',
                        falhaMotivo: motivo,
                        falhaData: new Date().toISOString(),
                        falhaId: `CANCEL-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                    });
                }
                
                statusPagamento = 'Cancelada';
                statusVenda = 'Cancelada';
                mensagemResposta = 'Pagamento cancelado';
                
                console.log('✅ Status definido como Cancelada - usando status real da PayMoz');
                
                // Enviar webhook e adicionar à fila de remarketing se o produto tiver remarketing ativado
                if (vendasCriadas && vendasCriadas.length > 0) {
                    const vendaPrincipal = vendasCriadas[0]; // Primeira venda é sempre a principal
                    const produtoCancelado = await Produto.findByPk(vendaPrincipal.produto_id);
                    
                    // Enviar webhook para venda cancelada
                    if (produtoCancelado && produtoCancelado.vendedor_id) {
                        try {
                            const { enviarWebhook } = require('./webhooks');
                            await enviarWebhook('venda_cancelada', {
                                venda_id: vendaPrincipal.id,
                                produto_id: vendaPrincipal.produto_id,
                                vendedor_id: produtoCancelado.vendedor_id,
                                valor: vendaPrincipal.valor || vendaPrincipal.pagamento_valor,
                                cliente_nome: vendaPrincipal.cliente_nome,
                                cliente_email: vendaPrincipal.cliente_email,
                                cliente_telefone: vendaPrincipal.cliente_telefone,
                                cliente_whatsapp: vendaPrincipal.cliente_whatsapp,
                                status_anterior: 'Pendente',
                                motivo: motivo,
                                data_cancelamento: new Date().toISOString()
                            }, produtoCancelado.vendedor_id, vendaPrincipal.produto_id);
                            console.log('✅ Webhook de venda cancelada enviado (PayMoz retornou cancelamento)');
                        } catch (webhookError) {
                            console.error('⚠️ Erro ao enviar webhook de venda cancelada:', webhookError);
                        }
                    }
                    
                    // Adicionar à fila de remarketing
                    try {
                        const remarketingService = require('../services/remarketingService');
                        
                        if (produtoCancelado && produtoCancelado.remarketing_config?.enabled) {
                            console.log('🔄 Adicionando venda cancelada à fila de remarketing...');
                            const resultadoRemarketing = await remarketingService.adicionarVendaCancelada({
                                cliente_id: vendaPrincipal.cliente_id || undefined, // undefined será tratado pelo serviço
                                cliente_nome: vendaPrincipal.cliente_nome || 'Cliente',
                                produto_id: vendaPrincipal.produto_id,
                                produto_nome: produtoCancelado.nome,
                                email: vendaPrincipal.cliente_email,
                                telefone: vendaPrincipal.cliente_whatsapp || vendaPrincipal.cliente_telefone, // Priorizar WhatsApp do checkout
                                venda_cancelada_id: vendaPrincipal.id // Adicionar ID da venda cancelada
                            });
                            
                            if (resultadoRemarketing.ignorado) {
                                console.log(`⚠️ Remarketing ignorado: ${resultadoRemarketing.motivo}`);
                            } else if (resultadoRemarketing.sucesso) {
                                console.log('✅ Venda cancelada adicionada à fila de remarketing!');
                            }
                        }
                    } catch (remarketingError) {
                        console.error('⚠️ Erro ao adicionar à fila de remarketing:', remarketingError.message);
                    }
                }
                
            } else if (isSuccess && resultadoPagamento.success) {
                console.log(`📊 Status da API PayMoz: ${resultadoPagamento.status}`);
                console.log(`📊 Message da API PayMoz: ${resultadoPagamento.message}`);
                console.log(`📊 Transaction ID (output_ThirdPartyReference): ${resultadoPagamento.transaction_id}`);
                
                // Processar pagamento aprovado usando o fluxo completo
                    statusPagamento = 'Aprovada';
                    statusVenda = 'Pago';
                    mensagemResposta = 'Pagamento realizado com sucesso';
                    
                    console.log('✅ Status definido como APROVADO');
                    
                    // Criar objeto cliente a partir dos dados da venda
                    const cliente = {
                        nome: vendasCriadas[0].cliente_nome,
                        email: vendasCriadas[0].cliente_email,
                        telefone: vendasCriadas[0].cliente_telefone,
                        whatsapp: whatsappCliente || vendasCriadas[0].cliente_whatsapp || null,
                        whatsappCliente: whatsappCliente || vendasCriadas[0].cliente_whatsapp || null
                    };
                    
                    // Definir método de pagamento
                    const metodoPagamento = metodo === 'mpesa' ? 'M-Pesa' : 'e-Mola';
                    
                    // Usar o fluxo completo de processamento de pagamento aprovado
                    const pedidoInfo = await processarPagamentoAprovado(
                        vendasCriadas[0], // Primeira venda
                        produto,
                        cliente,
                        valorTotal,
                        metodoPagamento,
                        resultadoPagamento.transaction_id,
                        ref, // Passar referência do afiliado
                        trackingParams // Passar parâmetros de rastreamento UTM
                    );
                    
                    // Atualizar todas as vendas com o número do pedido gerado
                    // IMPORTANTE: numero_pedido tem limite de 6 caracteres (VARCHAR(6))
                    // Extrair apenas os últimos 6 dígitos do transaction_id ou gerar número aleatório de 6 dígitos
                    const numeroPedidoBase = pedidoInfo.idPedido.replace(/[^0-9]/g, '').slice(-6);
                    const numeroPedidoPrincipal = numeroPedidoBase && numeroPedidoBase.length === 6 
                        ? numeroPedidoBase 
                        : String(Math.floor(Math.random() * 900000) + 100000);
                    
                    // Atualizar todas as vendas com números de pedido únicos (máximo 6 caracteres)
                    for (let i = 0; i < vendasCriadas.length; i++) {
                        const vendaItem = vendasCriadas[i];
                        
                        // Gerar número único para cada venda (sempre 6 caracteres)
                        let numeroPedido;
                        if (i === 0) {
                            // Venda principal: usar número base
                            numeroPedido = numeroPedidoPrincipal;
                        } else {
                            // Para orderbumps: gerar número único de 6 dígitos
                            // Usar hash simples baseado no índice para garantir unicidade
                            const hash = (parseInt(numeroPedidoPrincipal) + i) % 1000000;
                            numeroPedido = String(hash).padStart(6, '0');
                        }
                        
                        // Garantir que sempre tenha exatamente 6 caracteres
                        if (numeroPedido.length > 6) {
                            numeroPedido = numeroPedido.slice(-6);
                        } else if (numeroPedido.length < 6) {
                            numeroPedido = numeroPedido.padStart(6, '0');
                        }
                        
                        try {
                        await vendaItem.update({
                            status: 'Pago',
                                numero_pedido: numeroPedido,
                            referencia_pagamento: pedidoInfo.idPedido, // Manter transaction_id na referência
                            data_pagamento: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                        } catch (updateError) {
                            // Se houver erro de duplicata ou tamanho, gerar número alternativo
                            if (updateError.name === 'SequelizeUniqueConstraintError' || 
                                (updateError.name === 'SequelizeDatabaseError' && updateError.message.includes('muito longo'))) {
                                console.warn(`⚠️ Número de pedido ${numeroPedido} inválido, gerando novo número...`);
                                // Gerar número aleatório de 6 dígitos garantindo unicidade
                                let numeroAlternativo;
                                let tentativas = 0;
                                do {
                                    numeroAlternativo = String(Math.floor(Math.random() * 900000) + 100000);
                                    tentativas++;
                                    if (tentativas > 10) {
                                        // Se não conseguir gerar único após 10 tentativas, usar timestamp
                                        numeroAlternativo = String(Date.now()).slice(-6);
                                        break;
                                    }
                                } while (numeroAlternativo.length !== 6);
                                
                                await vendaItem.update({
                                    status: 'Pago',
                                    numero_pedido: numeroAlternativo,
                                    referencia_pagamento: pedidoInfo.idPedido,
                                    data_pagamento: new Date().toISOString(),
                                    updated_at: new Date().toISOString()
                                });
                            } else {
                                throw updateError;
                            }
                        }
                    }
        
                    console.log('✅ Venda atualizada como APROVADA');
                    
                    // Recarregar a venda principal do banco para garantir que está atualizada
                    const vendaAtualizada = await Venda.findByPk(vendasCriadas[0].id);
                    if (!vendaAtualizada) {
                        console.error('❌ Venda não encontrada após atualização');
                    } else {
                        console.log(`🔍 Status da venda após atualização: ${vendaAtualizada.status}`);
                    }

                    // Enviar notificação automática para painel do vendedor
                    try {
                        console.log('🔔 Enviando notificação automática para painel do vendedor...');
                        console.log(`🔍 ID da venda para notificação: ${vendasCriadas[0].id}`);
                        const vendaNotificationService = require('../services/vendaNotificationService');
                        await vendaNotificationService.enviarNotificacaoNovaVenda(vendasCriadas[0].id);
                        console.log('✅ Notificação automática enviada para painel do vendedor');
                    } catch (autoNotificationError) {
                        console.error('❌ Erro ao enviar notificação automática:', autoNotificationError);
                        console.error('❌ Stack trace:', autoNotificationError.stack);
                        // Não falhar o pagamento por erro de notificação
                    }

                    // Processar operações em paralelo para melhor performance
                    console.log('⚡ Processando operações pós-pagamento em paralelo...');
                    const valorTotalVenda = venda.valor / 0.9;
                    const valorTotalParaCredito = venda.valor / 0.9;
                    
                    // Executar operações não-críticas em paralelo (não bloqueiam a resposta)
                    Promise.all([
                        // Email de confirmação (não crítico)
                        (async () => {
                            try {
                                const vendaNotificationService = require('../services/vendaNotificationService');
                                await vendaNotificationService.enviarNotificacaoConteudoPronto(vendasCriadas[0].id);
                                console.log('✅ Email de confirmação enviado');
                            } catch (error) {
                                console.error('⚠️ Erro ao enviar email:', error.message);
                            }
                        })(),
                        
                        // Limpar cache (não crítico)
                        (async () => {
                            try {
                                const ReceitaService = require('../services/receitaService');
                                ReceitaService.clearVendedorCache(venda.vendedor_id);
                            } catch (error) {
                                console.error('⚠️ Erro ao limpar cache:', error.message);
                            }
                        })(),
                        
                        // Recalcular agregados (não crítico, assíncrono)
                        (async () => {
                            try {
                                const SaldoVendedorService = require('../services/saldoVendedorService');
                                await SaldoVendedorService.recalcularAgregados(venda.vendedor_id);
                            } catch (error) {
                                console.error('⚠️ Erro ao recalcular agregados:', error.message);
                            }
                        })()
                    ]).catch(() => {}); // Ignorar erros para não bloquear
                    
                    // Operações críticas (devem ser sequenciais para garantir consistência)
                    try {
                        const SaldoAdminService = require('../services/saldoAdminService');
                        const resultado = await SaldoAdminService.processarVendaAprovada(venda.id, valorTotalVenda, venda.vendedor_id);
                        console.log('💰 Sistema de taxas processado:');
                        console.log(`   💳 Valor total: MZN ${valorTotalVenda.toFixed(2)}`);
                        console.log(`   💼 Taxa admin (10%): MZN ${resultado.taxa_admin.toFixed(2)}`);
                        console.log(`   👤 Receita vendedor (90%): MZN ${resultado.receita_vendedor.toFixed(2)}`);
                    } catch (error) {
                        console.error('⚠️ Erro ao processar taxas:', error.message);
                    }

                    // Creditar saldo do vendedor (crítico)
                    try {
                        const SaldoVendedorService = require('../services/saldoVendedorService');
                        await SaldoVendedorService.creditarVenda(venda.vendedor_id, venda.id, valorTotalParaCredito);
                        console.log(`✅ Saldo creditado: MZN ${venda.valor.toFixed(2)}`);
                    } catch (creditError) {
                        console.error('⚠️ Erro ao creditar saldo:', creditError.message);
                    }

                    // Notificações automáticas (não crítico, pode ser assíncrono)
                    (async () => {
                        try {
                            await enviarNotificacoesAutomaticas(pedidoInfo, venda, produto);
                            console.log('✅ Notificações enviadas');
                        } catch (error) {
                            console.error('⚠️ Erro ao enviar notificações:', error.message);
                        }
                    })().catch(() => {});
            }
            
            // Log para debug - verificar status antes da verificação final
            console.log('🔍 DEBUG - Status antes da verificação final:');
            console.log(`   - statusPagamento: ${statusPagamento}`);
            console.log(`   - statusVenda: ${statusVenda}`);
            console.log(`   - resultadoPagamento.status: ${resultadoPagamento.status}`);
            console.log(`   - resultadoPagamento.success: ${resultadoPagamento.success}`);
            
            // Se não há status específico, verificar se há dados de resposta
            // IMPORTANTE: Só definir como pendente se o status ainda não foi definido
            if (statusPagamento === 'Pendente' && resultadoPagamento.data && Object.keys(resultadoPagamento.data).length > 0) {
                // Se há dados mas não conseguimos determinar o status, tratar como pendente
                statusPagamento = 'Pendente';
                statusVenda = 'Pendente';
                mensagemResposta = 'Pagamento em processamento';
                
                console.log('🔄 Status não determinado - definindo como PENDENTE');
                console.log('🔄 Resposta da API e2Payments recebida, mas status não determinado - mantendo como PENDENTE');
                console.log(`📊 Dados recebidos: ${JSON.stringify(resultadoPagamento.data)}`);
            } else if (statusPagamento === 'Pendente' && (!resultadoPagamento.data || Object.keys(resultadoPagamento.data).length === 0)) {
                    // Se não há dados, tratar como erro e cancelar
                    console.log('❌ API Extra Pay não retornou dados válidos - cancelando venda');
                    
                    // Atualizar venda com status final cancelado
                    const motivo = 'API e2Payments não retornou dados válidos';
                    
                    await venda.update({
                        status: 'Cancelada',
                        pagamento_status: 'Cancelada',
                        falhaMotivo: motivo,
                        falhaData: new Date().toISOString(),
                        falhaId: `INVALID-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                    });
                    
                    // Definir status como cancelado
                    statusPagamento = 'Cancelada';
                    statusVenda = 'Cancelada';
                    
                    // Enviar webhook e adicionar à fila de remarketing
                    if (vendasCriadas && vendasCriadas.length > 0) {
                        const vendaPrincipal = vendasCriadas[0]; // Primeira venda é sempre a principal
                        const produtoCancelado = await Produto.findByPk(vendaPrincipal.produto_id);
                        
                        // Enviar webhook para venda cancelada
                        if (produtoCancelado && produtoCancelado.vendedor_id) {
                            try {
                                const { enviarWebhook } = require('./webhooks');
                                await enviarWebhook('venda_cancelada', {
                                    venda_id: vendaPrincipal.id,
                                    produto_id: vendaPrincipal.produto_id,
                                    vendedor_id: produtoCancelado.vendedor_id,
                                    valor: vendaPrincipal.valor || vendaPrincipal.pagamento_valor,
                                    cliente_nome: vendaPrincipal.cliente_nome,
                                    cliente_email: vendaPrincipal.cliente_email,
                                    cliente_telefone: vendaPrincipal.cliente_telefone,
                                    cliente_whatsapp: vendaPrincipal.cliente_whatsapp,
                                    status_anterior: 'Pendente',
                                    motivo: motivo,
                                    data_cancelamento: new Date().toISOString()
                                }, produtoCancelado.vendedor_id, vendaPrincipal.produto_id);
                                console.log('✅ Webhook de venda cancelada enviado (resposta inválida)');
                            } catch (webhookError) {
                                console.error('⚠️ Erro ao enviar webhook de venda cancelada:', webhookError);
                            }
                        }
                        
                        // Adicionar à fila de remarketing se o produto tiver remarketing ativado
                        try {
                            const remarketingService = require('../services/remarketingService');
                            
                            if (produtoCancelado && produtoCancelado.remarketing_config?.enabled) {
                                console.log('🔄 Adicionando venda cancelada à fila de remarketing...');
                                const resultadoRemarketing = await remarketingService.adicionarVendaCancelada({
                                    cliente_id: vendaPrincipal.cliente_id || undefined, // undefined será tratado pelo serviço
                                    cliente_nome: vendaPrincipal.cliente_nome || 'Cliente',
                                    produto_id: vendaPrincipal.produto_id,
                                    produto_nome: produtoCancelado.nome,
                                    email: vendaPrincipal.cliente_email,
                                    telefone: vendaPrincipal.cliente_whatsapp || vendaPrincipal.cliente_telefone, // Priorizar WhatsApp do checkout
                                    venda_cancelada_id: vendaPrincipal.id // Adicionar ID da venda cancelada
                                });
                                
                                if (resultadoRemarketing.ignorado) {
                                    console.log(`⚠️ Remarketing ignorado: ${resultadoRemarketing.motivo}`);
                                } else if (resultadoRemarketing.sucesso) {
                                    console.log('✅ Venda cancelada adicionada à fila de remarketing!');
                                }
                            }
                        } catch (remarketingError) {
                            console.error('⚠️ Erro ao adicionar à fila de remarketing:', remarketingError.message);
                        }
                    }
                    mensagemResposta = 'Falha no pagamento, transação cancelada';
                    
                    console.log('✅ Venda cancelada automaticamente por resposta inválida');
                    
                    // Enviar notificação de venda cancelada
                    try {
                        const notificationService = require('../services/notificationService');
                        
                        // Notificação de venda cancelada removida - usar vendaNotificationService se necessário
                        console.log('🔔 Venda cancelada - notificação removida para evitar erro');
                        
                        console.log('🔔 Notificação de venda cancelada enviada');
                    } catch (notificationError) {
                        console.error('❌ Erro ao enviar notificação de venda cancelada:', notificationError);
                    }
                }
            
            // Verificar se há erro no resultado do pagamento
            // NÃO forçar cancelamento - manter pendente e aguardar status real da PayMoz
            if (resultadoPagamento.error) {
                console.log('⚠️ Erro na API PayMoz detectado - mantendo status pendente para aguardar confirmação real');
                
                // Verificar se é timeout ou erro de conexão
                const isTimeout = resultadoPagamento.errorType === 'timeout';
                const isConnectionError = resultadoPagamento.errorType === 'connection';
                
                let motivo = resultadoPagamento.error || 'Erro na comunicação com o servidor de pagamento';
                
                // NÃO cancelar - manter como pendente e aguardar webhook da PayMoz
                // Apenas registrar o erro para referência, mas não alterar status
                await venda.update({
                    falhaMotivo: motivo,
                    falhaData: new Date().toISOString(),
                    falhaId: `ERROR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
                    // NÃO alterar status - manter pendente
                });
                
                // Manter status como pendente - não cancelar
                statusPagamento = 'Pendente';
                statusVenda = 'Pendente';
                mensagemResposta = isTimeout ? 
                    'Aguardando confirmação do status real da transação' : 
                    isConnectionError ? 
                    'Aguardando confirmação do status real da transação' :
                    'Aguardando confirmação do status real da transação';
                
                console.log('ℹ️ Status mantido como Pendente - aguardando webhook da PayMoz para status real');
                    
                // NÃO enviar notificação de cancelamento - status está pendente, aguardando confirmação real
            }

            console.log(`📊 Status final definido: ${statusPagamento}`);
            console.log(`📊 Status da venda final: ${statusVenda}`);
            console.log(`📊 Mensagem final: ${mensagemResposta}`);
            
            // Log adicional para debug
            console.log('🔍 DEBUG - Verificando se status foi sobrescrito incorretamente:');
            console.log(`   - Status da API e2Payments: ${resultadoPagamento.status}`);
            console.log(`   - Success da API: ${resultadoPagamento.success}`);
            console.log(`   - Status final do pagamento: ${statusPagamento}`);
            console.log(`   - Status final da venda: ${statusVenda}`);

            // Determinar se a resposta deve ser de sucesso ou erro
            const isSuccessResponse = statusPagamento === 'Aprovada';

            // Criar a resposta que será enviada
            const responseData = {
                success: isSuccessResponse,
                message: mensagemResposta,
                status: statusPagamento.toLowerCase(),
                data: {
                    produto: {
                        nome: produto.nome,
                        customId: produto.custom_id,
                        valor: valorFinal,
                        valorOriginal: (valorFinal / 0.9),
                        desconto: desconto,
                        linkConteudo: linkConteudo || produto.link_conteudo || ''
                    },
                    cliente: {
                        nome: nomeCliente,
                        email: emailCliente,
                        telefone: numeroFormatado
                    },
                    pagamento: {
                        metodo: metodo,
                        status: statusPagamento,
                        transactionId: venda.pagamentoTransacaoId,
                        referencia: venda.pagamentoReferencia,
                        numeroCelular: numeroFormatado
                    },
                    venda: {
                        id: venda.id,
                        status: statusVenda,
                        pagamentoStatus: statusPagamento,
                        transacaoId: venda.pagamentoTransacaoId
                    },
                    pedido: {
                        id: venda.id, // Usar o ID da venda como ID do pedido
                        numero: venda.public_id
                    }
                }
            };

            console.log('📊 Resposta que será enviada para o frontend:', JSON.stringify(responseData, null, 2));

            // Notificação já foi enviada quando a venda foi aprovada acima
            // Removido para evitar duplicatas

            // Retornar resposta com status real
            res.json(responseData);

        } catch (processError) {
            console.error('❌ Erro ao processar pagamento:', processError);
            console.error('Stack trace:', processError.stack);
            
            // IMPORTANTE: NÃO CANCELAR AUTOMATICAMENTE
            // O status da venda será determinado APENAS pela resposta do PayMoz via webhook
            // Erros internos não devem alterar o status da venda
            
            // Apenas logar o erro e retornar resposta de erro sem alterar status
            console.warn('⚠️ Erro interno no processamento - status da venda permanece como determinado pelo PayMoz');
            
            // Retornar resposta de erro sem cancelar
            return res.status(500).json({
                    success: false,
                message: 'Erro interno no processamento. O status do pagamento será atualizado pelo servidor PayMoz.',
                status: 'pending', // Manter como pendente - PayMoz determinará o status final
                error: processError.message,
                    data: {
                        produto: {
                            nome: produto.nome,
                            customId: produto.custom_id,
                            valor: valorFinal,
                            valorOriginal: valorOriginal,
                            desconto: desconto,
                            linkConteudo: linkConteudo || produto.link_conteudo || ''
                        },
                        cliente: {
                            nome: nomeCliente,
                            email: emailCliente,
                            telefone: numeroFormatado
                        },
                        pagamento: {
                            metodo: metodo,
                        status: 'Pendente', // Status será atualizado pelo webhook do PayMoz
                        transactionId: venda?.pagamento_transacao_id || null,
                        referencia: venda?.referencia_pagamento || null,
                            numeroCelular: numeroFormatado
                        },
                        venda: {
                        id: venda?.id || null,
                        status: 'Pendente', // Status será atualizado pelo webhook do PayMoz
                        pagamentoStatus: 'Pendente',
                        transacaoId: venda?.pagamento_transacao_id || null
                }
            }
        });
        }

    } catch (error) {
        console.error('❌ Erro no processamento do pagamento:', error);
        console.error('Stack trace:', error.stack);
        
        // Verificar se é um erro específico que podemos tratar
        let mensagemErro = 'Ocorreu um erro ao processar o pagamento';
        let detalhesErro = 'Erro interno do servidor';
        
        if (error.name === 'ValidationError') {
            mensagemErro = 'Dados inválidos fornecidos';
            detalhesErro = error.message;
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            mensagemErro = 'Não foi possível conectar ao serviço de pagamento';
            detalhesErro = 'Erro de conexão com o serviço';
        } else if (error.message && error.message.includes('numeroCelular')) {
            mensagemErro = 'Número de celular inválido';
            detalhesErro = error.message;
        } else if (error.message) {
            // Usar a mensagem de erro original se disponível
            mensagemErro = error.message;
            detalhesErro = error.message;
        }
        
        return res.status(500).json({
            success: false,
            error: mensagemErro,
            message: detalhesErro
        });
    }
});

// GET - Status do pagamento (rota principal)

// GET - Status do pagamento (nova rota simplificada)
router.get('/status', async (req, res) => {
    try {
        // Obter a transação da sessão do usuário
        const transactionId = req.session?.transactionId;
        
        if (!transactionId) {
            return res.json({
                status: 'Pendente',
                message: 'Nenhuma transação em andamento'
            });
        }

        // Buscar venda pelo transaction ID
        const venda = await Venda.findOne({ where: { referencia_pagamento: transactionId } });

        if (!venda) {
            return res.json({
                status: 'Pendente',
                message: 'Transação não encontrada'
            });
        }

        // Retornar apenas o status sem dados técnicos
        res.json({
            status: venda.status,
            message: venda.status === 'Aprovada' ? 'Pagamento aprovado!' : 
                     venda.status === 'Rejeitado' || venda.status === 'Cancelada' ? 
                     'Pagamento rejeitado ou cancelado.' : 'Pagamento pendente. Aguarde a confirmação.'
        });

    } catch (error) {
        console.error('❌ Erro ao buscar status simplificado:', error);
        res.json({
            status: 'Erro',
            message: 'Erro ao consultar status'
        });
    }
});

// Rota de sucesso (sem parâmetros na URL)
router.get('/success', (req, res) => {
    const { transactionId } = req.query;
    
    if (!transactionId) {
        return res.redirect('/server-error.html?error=missing_transaction_id');
    }
    
    // Armazenar o transactionId na sessão
    req.session = req.session || {};
    req.session.transactionId = transactionId;
    
    // Redirecionar para a página de sucesso sem parâmetros na URL
    res.redirect('/sucesso.html');
});

// Nova rota de sucesso sem parâmetros na URL
router.get('/success/clean', (req, res) => {
    res.sendFile('sucesso.html', { root: './public' });
});

// GET - Histórico de pagamentos
router.get('/historico', async (req, res) => {
    try {
        const { email, telefone } = req.query;

        if (!email && !telefone) {
            return res.status(400).json({
                success: false,
                error: 'Email ou telefone é obrigatório'
            });
        }

        // Buscar vendas do cliente
        const whereClause = {};
        if (email) {
            whereClause.cliente_email = email;
        }
        if (telefone) {
            whereClause.cliente_telefone = telefone;
        }
        const vendas = await Venda.findAll({ where: whereClause });

        res.json({
            success: true,
            data: vendas.map(venda => ({
                id: venda.id,
                produto: venda.produtoNome,
                valor: venda.pagamentoValor,
                metodo: venda.pagamentoMetodo,
                status: venda.pagamentoStatus,
                dataVenda: venda.dataVenda,
                transactionId: venda.pagamentoTransacaoId,
                falhaId: venda.falhaId,
                falhaMotivo: venda.falhaMotivo,
                falhaData: venda.falhaData,
                ultimaAtualizacao: venda.ultimaAtualizacao
            }))
        });

    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET - Estatísticas de vendas
router.get('/estatisticas', async (req, res) => {
    try {
        const { periodo, produtoId } = req.query;
        
        // Definir período de busca
        let dataInicio = null;
        let dataFim = new Date().toISOString();
        
        if (periodo) {
            const hoje = new Date();
            switch (periodo) {
                case 'hoje':
                    dataInicio = new Date(hoje.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case 'ontem':
                    const ontem = new Date(hoje);
                    ontem.setDate(ontem.getDate() - 1);
                    dataInicio = new Date(ontem.setHours(0, 0, 0, 0)).toISOString();
                    dataFim = new Date(ontem.setHours(23, 59, 59, 999)).toISOString();
                    break;
                case '7dias':
                    const seteDias = new Date(hoje);
                    seteDias.setDate(seteDias.getDate() - 7);
                    dataInicio = new Date(seteDias.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case '30dias':
                    const trintaDias = new Date(hoje);
                    trintaDias.setDate(trintaDias.getDate() - 30);
                    dataInicio = new Date(trintaDias.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case 'mes':
                    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                    dataInicio = new Date(inicioMes.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case 'mesanterior':
                    const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                    dataInicio = new Date(inicioMesAnterior.setHours(0, 0, 0, 0)).toISOString();
                    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                    dataFim = new Date(fimMesAnterior.setHours(23, 59, 59, 999)).toISOString();
                    break;
                default:
                    // Padrão: últimos 30 dias
                    const defaultPeriod = new Date(hoje);
                    defaultPeriod.setDate(defaultPeriod.getDate() - 30);
                    dataInicio = new Date(defaultPeriod.setHours(0, 0, 0, 0)).toISOString();
            }
        } else {
            // Padrão: últimos 30 dias
            const defaultPeriod = new Date();
            defaultPeriod.setDate(defaultPeriod.getDate() - 30);
            dataInicio = new Date(defaultPeriod.setHours(0, 0, 0, 0)).toISOString();
        }
        
        // Buscar todas as vendas no período
        const whereClause = {};
        
        if (dataInicio && dataFim) {
            whereClause.created_at = {
                [require('sequelize').Op.between]: [dataInicio, dataFim]
            };
        }
        
        if (produtoId) {
            whereClause.produto_id = produtoId;
        }
        
        const vendas = await Venda.findAll({ where: whereClause });
        
        // Calcular estatísticas
        const totalVendas = vendas.length;
        const vendasAprovadas = vendas.filter(v => v.pagamentoStatus === 'Aprovado').length;
        const vendasPendentes = vendas.filter(v => v.pagamentoStatus === 'Pendente').length;
        const vendasCanceladas = vendas.filter(v => v.pagamentoStatus === 'Cancelado').length;
        const vendasFalhas = vendas.filter(v => v.pagamentoStatus === 'Rejeitado').length;
        
        // Calcular valor total
        const valorTotal = vendas.reduce((total, venda) => {
            return total + (parseFloat(venda.pagamentoValor) || 0);
        }, 0);
        
        // Calcular valor aprovado
        const valorAprovado = vendas
            .filter(v => v.pagamentoStatus === 'Aprovado')
            .reduce((total, venda) => {
                return total + (parseFloat(venda.pagamentoValor) || 0);
            }, 0);
        
        // Agrupar por método de pagamento
        const porMetodoPagamento = {};
        vendas.forEach(venda => {
            const metodo = venda.pagamentoMetodo || 'Desconhecido';
            if (!porMetodoPagamento[metodo]) {
                porMetodoPagamento[metodo] = {
                    total: 0,
                    aprovadas: 0,
                    pendentes: 0,
                    canceladas: 0,
                    falhas: 0,
                    valor: 0
                };
            }
            
            porMetodoPagamento[metodo].total++;
            
            if (venda.pagamentoStatus === 'Aprovado') {
                porMetodoPagamento[metodo].aprovadas++;
                porMetodoPagamento[metodo].valor += parseFloat(venda.pagamentoValor) || 0;
            } else if (venda.pagamentoStatus === 'Pendente') {
                porMetodoPagamento[metodo].pendentes++;
            } else if (venda.pagamentoStatus === 'Cancelado') {
                porMetodoPagamento[metodo].canceladas++;
            } else if (venda.pagamentoStatus === 'Rejeitado') {
                porMetodoPagamento[metodo].rejeitadas++;
            }
        });
        
        // Retornar estatísticas
        res.json({
            success: true,
            data: {
                periodo: {
                    inicio: dataInicio,
                    fim: dataFim,
                    nome: periodo || '30dias'
                },
                vendas: {
                    total: totalVendas,
                    aprovadas: vendasAprovadas,
                    pendentes: vendasPendentes,
                    canceladas: vendasCanceladas,
                    falhas: vendasFalhas
                },
                valores: {
                    total: valorTotal.toFixed(2),
                    aprovado: valorAprovado.toFixed(2)
                },
                porMetodoPagamento
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Webhook para atualização de status de pagamento do PayMoz
router.post('/webhook/paymoz', async (req, res) => {
    try {
        // PayMoz pode enviar output_ThirdPartyReference (que usamos como transaction_id)
        const { output_ThirdPartyReference, output_TransactionID, transaction_id, transactionId, status, reference, amount, method, error_message, error_code, paymentId } = req.body;

        console.log(`🔄 Webhook PayMoz recebido:`, {
            output_ThirdPartyReference,
            output_TransactionID,
            transaction_id: transaction_id || transactionId || paymentId,
            status,
            reference,
            amount,
            method,
            error_message,
            error_code
        });

        // Usar output_ThirdPartyReference como transaction_id (como especificado)
        const txId = output_ThirdPartyReference || transaction_id || transactionId || paymentId;
        if (!txId || !status) {
            return res.status(400).json({
                success: false,
                error: 'Dados obrigatórios: transaction_id, status'
            });
        }

        // Função auxiliar para extrair ordem do orderbump
        const extrairOrdemOrderBump = (observacoes) => {
            if (!observacoes) return null;
            const match = observacoes.match(/Order Bump (\d+):/);
            return match ? parseInt(match[1]) : null;
        };

        // Buscar TODAS as vendas relacionadas (principal + orderbumps) pela referência de pagamento
        const vendasRelacionadas = await Venda.findAll({ 
            where: { referencia_pagamento: txId },
            include: [{
                model: Produto,
                as: 'produto'
            }],
            order: [['created_at', 'ASC']] // Ordenar por data de criação (principal primeiro, depois orderbumps)
        });
        
        // Ordenar manualmente: principal primeiro (sem "Order Bump" nas observações), depois orderbumps por ordem
        vendasRelacionadas.sort((a, b) => {
            const aIsOrderBump = a.observacoes && a.observacoes.includes('Order Bump');
            const bIsOrderBump = b.observacoes && b.observacoes.includes('Order Bump');
            
            // Principal vem primeiro
            if (!aIsOrderBump && bIsOrderBump) return -1;
            if (aIsOrderBump && !bIsOrderBump) return 1;
            
            // Se ambos são orderbumps, ordenar por ordem extraída das observações
            if (aIsOrderBump && bIsOrderBump) {
                const ordemA = extrairOrdemOrderBump(a.observacoes);
                const ordemB = extrairOrdemOrderBump(b.observacoes);
                if (ordemA !== null && ordemB !== null) {
                    return ordemA - ordemB;
                }
            }
            
            // Fallback: usar created_at
            return new Date(a.created_at) - new Date(b.created_at);
        });
        
        if (!vendasRelacionadas || vendasRelacionadas.length === 0) {
            console.log(`❌ Nenhuma venda encontrada para transaction_id: ${txId}`);
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }

        // Usar a primeira venda como referência principal
        const venda = vendasRelacionadas[0];
        const statusAnterior = venda.pagamentoStatus || venda.status; // Usar pagamentoStatus primeiro

        // Mapear status do gateway para status do sistema
        let novoPagamentoStatus = 'Pendente';
        let novoStatus = 'Pendente';

        switch (status.toLowerCase()) {
            case 'success':
            case 'approved':
            case 'completed':
                novoPagamentoStatus = 'Aprovado';
                novoStatus = 'Pago';
                break;
            case 'failed':
            case 'rejected':
            case 'declined':
                novoPagamentoStatus = 'Rejeitado';
                novoStatus = 'Cancelado';
                break;
            case 'cancelled':
            case 'canceled':
                novoPagamentoStatus = 'Cancelado';
                novoStatus = 'Falha';
                break;
            case 'pending':
            case 'processing':
                novoPagamentoStatus = 'Pendente';
                novoStatus = 'Pendente';
                break;
            default:
                novoPagamentoStatus = 'Pendente';
                novoStatus = 'Pendente';
        }

        // Atualizar TODAS as vendas relacionadas (principal + orderbumps) com o mesmo status
        console.log(`🔄 Atualizando ${vendasRelacionadas.length} vendas relacionadas...`);
        for (const vendaItem of vendasRelacionadas) {
            const updateData = {
                status: novoStatus,
                pagamento_status: novoPagamentoStatus,
                referencia_pagamento: reference || vendaItem.referencia_pagamento,
                updated_at: new Date().toISOString()
            };

            // Se aprovado, adicionar data de pagamento
            if (novoPagamentoStatus === 'Aprovado' && novoStatus === 'Pago') {
                updateData.data_pagamento = new Date().toISOString();
            }

            // Se rejeitado/cancelado, registrar informações da falha
            if (novoPagamentoStatus === 'Rejeitado' || novoPagamentoStatus === 'Cancelado') {
                updateData.falhaMotivo = error_message || `Pagamento ${novoPagamentoStatus.toLowerCase()}`;
                updateData.falhaData = new Date().toISOString();
                updateData.falhaId = `${novoPagamentoStatus.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            }

            // Atualizar valor se fornecido (apenas na venda principal - sem "Order Bump" nas observações)
            if (amount && (!vendaItem.observacoes || !vendaItem.observacoes.includes('Order Bump'))) {
                updateData.valor = parseFloat(amount);
            }

            await vendaItem.update(updateData);
            const tipoVenda = (vendaItem.observacoes && vendaItem.observacoes.includes('Order Bump')) ? 'order_bump' : 'principal';
            console.log(`   ✅ Venda ${tipoVenda} atualizada: ${vendaItem.id}`);
        }

        // Se pagamento foi cancelado/rejeitado, adicionar à fila de remarketing (apenas para venda principal)
        if ((novoPagamentoStatus === 'Rejeitado' || novoPagamentoStatus === 'Cancelado') && venda) {
            // Buscar produto para webhook e remarketing
            const produtoCancelado = await Produto.findByPk(venda.produto_id);
            
            // Enviar webhook para venda cancelada
            try {
                const { enviarWebhook } = require('./webhooks');
                
                if (produtoCancelado && produtoCancelado.vendedor_id) {
                    await enviarWebhook('venda_cancelada', {
                        venda_id: venda.id,
                        produto_id: venda.produto_id,
                        vendedor_id: produtoCancelado.vendedor_id,
                        valor: venda.valor || venda.pagamento_valor,
                        cliente_nome: venda.cliente_nome,
                        cliente_email: venda.cliente_email,
                        cliente_telefone: venda.cliente_telefone,
                        status_anterior: statusAnterior,
                        motivo: novoPagamentoStatus === 'Rejeitado' ? 'Pagamento rejeitado' : 'Pagamento cancelado',
                        data_cancelamento: new Date().toISOString()
                    }, produtoCancelado.vendedor_id, venda.produto_id); // Passar user_id e produto_id para filtrar webhooks
                    console.log('✅ Webhook de venda cancelada enviado');
                }
            } catch (webhookError) {
                console.error('⚠️ Erro ao enviar webhook de venda cancelada:', webhookError);
            }
            
            try {
                console.log('🔄 Verificando remarketing para venda cancelada...');
                const remarketingService = require('../services/remarketingService');
                
                // Verificar se produto tem remarketing ativo
                
                if (produtoCancelado && produtoCancelado.remarketing_config?.enabled) {
                    console.log('✅ Remarketing ativado para este produto. Adicionando à fila...');
                    const resultadoRemarketing = await remarketingService.adicionarVendaCancelada({
                        cliente_id: venda.cliente_id || undefined, // undefined será tratado pelo serviço
                        cliente_nome: venda.cliente_nome || 'Cliente',
                        produto_id: venda.produto_id,
                        produto_nome: produtoCancelado.nome,
                        email: venda.cliente_email,
                        telefone: venda.cliente_whatsapp || venda.cliente_telefone, // Priorizar WhatsApp do checkout
                        venda_cancelada_id: venda.id // Adicionar ID da venda cancelada
                    });
                    
                    if (resultadoRemarketing.ignorado) {
                        console.log(`⚠️ Remarketing ignorado: ${resultadoRemarketing.motivo}`);
                    } else if (resultadoRemarketing.sucesso) {
                        console.log('✅ Venda cancelada adicionada à fila de remarketing com sucesso!');
                    }
                } else {
                    console.log('ℹ️ Remarketing não está ativado para este produto ou produto não encontrado');
                }
            } catch (remarketingError) {
                // Não falhar o webhook por erro no remarketing
                console.error('⚠️ Erro ao adicionar à fila de remarketing:', remarketingError.message);
            }
        }

        console.log(`✅ Status atualizado via webhook PayMoz:`);
        console.log(`   Total de vendas: ${vendasRelacionadas.length}`);
        console.log(`   Transaction ID: ${txId}`);
        console.log(`   Status anterior: ${statusAnterior}`);
        console.log(`   Novo status: ${novoPagamentoStatus}`);

        // Incrementar vendas do produto apenas se mudou para aprovado (apenas uma vez)
        // Verificar se o status anterior não era aprovado e o novo status é aprovado
        const statusAnteriorNormalizado = (statusAnterior || '').toString().trim();
        const foiAprovadoAgora = novoPagamentoStatus === 'Aprovado';
        const naoEraAprovadoAntes = statusAnteriorNormalizado !== 'Aprovado' && 
                                     statusAnteriorNormalizado !== 'Aprovada' &&
                                     statusAnteriorNormalizado !== 'Pago';
        
        if (naoEraAprovadoAntes && foiAprovadoAgora) {
            console.log(`🔄 Status mudou de "${statusAnteriorNormalizado}" para "${novoPagamentoStatus}" - Processando aprovação...`);
            // Enviar notificação para o vendedor via webhook e2Payments
            try {
                console.log('🔔 Enviando notificação automática para painel do vendedor via webhook e2Payments...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoNovaVenda(venda.id);
                console.log('✅ Notificação automática enviada para painel do vendedor via webhook e2Payments');
            } catch (autoNotificationError) {
                console.error('❌ Erro ao enviar notificação automática via webhook e2Payments:', autoNotificationError);
                // Não falhar o webhook por erro de notificação
            }

            // Enviar email de confirmação de compra para o cliente via webhook e2Payments
            // Enviar apenas uma vez para a venda principal (que já envia todos os produtos)
            try {
                console.log('📧 Enviando email de confirmação de compra para cliente via webhook e2Payments...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoConteudoPronto(venda.id);
                console.log('✅ Email de confirmação de compra enviado para cliente via webhook e2Payments');
            } catch (emailClienteError) {
                console.error('❌ Erro ao enviar email para cliente via webhook e2Payments:', emailClienteError);
                // Não falhar o webhook por erro de email
            }
            
            // Detectar conversão de remarketing
            try {
                const remarketingConversaoService = require('../services/remarketingConversaoService');
                await remarketingConversaoService.detectarConversao(venda);
            } catch (conversaoError) {
                console.error('⚠️ Erro ao detectar conversão de remarketing (não crítico):', conversaoError);
            }
            
            // Incrementar vendas dos produtos (principal + orderbumps)
            const produtosIds = [...new Set(vendasRelacionadas.map(v => v.produto_id).filter(Boolean))];
            for (const produtoId of produtosIds) {
                await Produto.increment('vendas', { where: { id: produtoId } });
            }
            console.log(`📈 Vendas dos produtos incrementadas (${produtosIds.length} produtos)`);
            
            // Buscar produto para envio do email
            const produto = await Produto.findByPk(venda.produto_id);
            
            // Enviar venda para UTMify (integração oficial) via webhook
            // Apenas se ainda não foi enviado
            try {
                const trackingDataFromVenda = venda.tracking_data || {};
                if (trackingDataFromVenda.utmfy_enviado === true) {
                    console.log('✅ UTMIFY: Venda já foi enviada anteriormente. Pulando envio via webhook.');
                    // Não tentar enviar novamente se já foi enviado
                } else {
                console.log('═══════════════════════════════════════════════════════════');
                console.log('🚀 UTMIFY: Iniciando envio via WEBHOOK');
                console.log('📦 Venda ID:', venda.id);
                console.log('📦 Produto ID:', venda.produto_id);
                console.log('═══════════════════════════════════════════════════════════');
                const utmifyService = require('../services/utmifyService');
                
                // Preparar dados do cliente
                    // O IP é obrigatório na API UTMify, então usar IP salvo na venda ou valor padrão
                const cliente = {
                    nome: venda.cliente_nome,
                    email: venda.cliente_email,
                    telefone: venda.cliente_telefone,
                    whatsapp: venda.cliente_whatsapp,
                        ip: venda.cliente_ip || '0.0.0.0' // Usar IP salvo na venda ou valor padrão
                };
                
                    // Usar utilitário aprimorado para carregar tracking_data da venda
                    const utmTracking = require('../utils/utmTracking');
                    
                    // Capturar parâmetros UTM do tracking_data da venda
                    const utmParams = utmTracking.captureUTMParameters({
                        trackingData: trackingDataFromVenda,
                        ip: venda.cliente_ip || '0.0.0.0'
                    });
                    
                    // Preparar parâmetros para UTMify
                const trackingParams = {
                        utm_source: utmParams.utm_source,
                        utm_medium: utmParams.utm_medium,
                        utm_campaign: utmParams.utm_campaign,
                        utm_content: utmParams.utm_content,
                        utm_term: utmParams.utm_term,
                        src: utmParams.src,
                        sck: utmParams.sck,
                        ip: utmParams.ip || '0.0.0.0'
                    };
                    
                    // Log formatado
                    utmTracking.logUTMParameters(utmParams, 'webhook');
                
                // Enviar para UTMify (com status atualizado)
                // Criar uma cópia da venda com status atualizado
                const vendaComStatusAtualizado = {
                    ...venda.toJSON ? venda.toJSON() : venda,
                    status: novoPagamentoStatus, // Usar o novo status
                    data_pagamento: new Date().toISOString() // Garantir que tem data_pagamento
                };
                
                const resultadoUtmify = await utmifyService.enviarVenda(
                    vendaComStatusAtualizado,
                    produto,
                    cliente,
                    trackingParams,
                        { 
                            isTest: false,
                            isApproved: true // Marcar como aprovado pois o webhook indica pagamento aprovado
                        }
                );
                
                if (resultadoUtmify.success) {
                    console.log('✅ UTMIFY: Venda enviada com SUCESSO via webhook (status atualizado)!');
                        
                        // Marcar venda como enviada
                        try {
                            const utmTracking = require('../utils/utmTracking');
                            const trackingDataAtualizado = utmTracking.mergeTrackingData(trackingDataFromVenda, {
                                utmfy_enviado: true,
                                utmfy_enviado_em: new Date().toISOString()
                            });
                            await venda.update({
                                tracking_data: trackingDataAtualizado
                            });
                            console.log('✅ UTMIFY: Venda marcada como enviada no banco de dados (webhook)');
                        } catch (updateError) {
                            console.error('⚠️ UTMIFY: Erro ao marcar venda como enviada:', updateError.message);
                            // Não falhar o processo por erro ao atualizar
                        }
                } else if (resultadoUtmify.skipped) {
                    console.log(`⚠️ UTMIFY: Envio pulado via webhook - ${resultadoUtmify.reason}`);
                } else {
                    console.error('❌ UTMIFY: Erro ao enviar venda via webhook:', resultadoUtmify.error);
                    // Não falhar o processo por erro no UTMify
                    }
                }
            } catch (utmifyError) {
                console.error('═══════════════════════════════════════════════════════════');
                console.error('❌ UTMIFY: EXCEÇÃO ao processar envio via webhook!');
                console.error('📦 Erro:', utmifyError.message);
                console.error('═══════════════════════════════════════════════════════════');
                // Não falhar o processo por erro no UTMify
            }
            
            // Atualizar receita do vendedor
            try {
                console.log('💰 Atualizando receita do vendedor via webhook...');
                const EstatisticasService = require('../services/estatisticasService');
                await EstatisticasService.atualizarEstatisticasVendedor(produto.vendedor_id);
                console.log('✅ Receita do vendedor atualizada via webhook');
            } catch (receitaError) {
                console.error('❌ Erro ao atualizar receita do vendedor via webhook:', receitaError);
                // Não falhar o processo por erro na atualização da receita
            }
            
            // Buscar dados do vendedor para notificação
            let vendedor = null;
            try {
                const { Usuario } = require('../config/database');
                vendedor = await Usuario.findByPk(produto.vendedor_id);
                console.log('👤 Vendedor encontrado para notificação via webhook:', vendedor ? vendedor.email : 'não encontrado');
            } catch (error) {
                console.error('❌ Erro ao buscar vendedor via webhook:', error);
            }
            
            // Processar venda com sistema de taxas (10% admin, 90% vendedor)
            // venda.valor já é 90% do valor com desconto, então calcular valor total
            try {
                console.log('💰 Processando sistema de taxas via webhook...');
                const SaldoAdminService = require('../services/saldoAdminService');
                // venda.valor é 90% do valor com desconto, então o valor total é venda.valor / 0.9
                const valorTotalVenda = venda.valor / 0.9;
                const resultado = await SaldoAdminService.processarVendaAprovada(venda.id, valorTotalVenda, produto.vendedor_id);
                console.log('✅ Sistema de taxas processado via webhook:');
                console.log(`   💳 Valor total da venda (com desconto): MZN ${valorTotalVenda.toFixed(2)}`);
                console.log(`   💼 Taxa do administrador (10%): MZN ${resultado.taxa_admin.toFixed(2)}`);
                console.log(`   👤 Receita do vendedor (90%): MZN ${resultado.receita_vendedor.toFixed(2)}`);
            } catch (taxError) {
                console.error('⚠️ Erro ao processar sistema de taxas via webhook:', taxError);
                // Não falhar o webhook por erro na comissão
            }

            // Creditar saldo do vendedor (idempotente)
            // venda.valor já é 90% do valor com desconto, mas creditarVenda calcula mais 90%
            // Então precisamos passar o valor total (venda.valor / 0.9) para que ele calcule 90% corretamente
            try {
                const SaldoVendedorService = require('../services/saldoVendedorService');
                // venda.valor é 90% do valor com desconto, então o valor total é venda.valor / 0.9
                // creditarVenda vai calcular 90% desse valor total, resultando em venda.valor (correto)
                const valorTotalParaCredito = venda.valor / 0.9;
                await SaldoVendedorService.creditarVenda(produto.vendedor_id, venda.id, valorTotalParaCredito);
                console.log(`✅ Saldo creditado ao vendedor via webhook: MZN ${venda.valor.toFixed(2)} (90% do valor com desconto)`);
                SaldoVendedorService.recalcularAgregados(produto.vendedor_id).catch(() => {});
            } catch (creditError) {
                console.error('⚠️ Erro ao creditar saldo via webhook:', creditError);
            }
            
            // Enviar webhook para venda aprovada
            try {
                console.log(`\n🔔 [PAGAMENTO DEBUG] ===== DISPARANDO WEBHOOK venda_aprovada =====`);
                console.log(`🔔 [PAGAMENTO DEBUG] Venda ID: ${venda.id}`);
                console.log(`🔔 [PAGAMENTO DEBUG] Produto ID: ${produto.id}`);
                console.log(`🔔 [PAGAMENTO DEBUG] Vendedor ID: ${produto.vendedor_id}`);
                
                const { enviarWebhook } = require('./webhooks');
                await enviarWebhook('venda_aprovada', {
                    venda_id: venda.id,
                    produto_id: produto.id,
                    vendedor_id: produto.vendedor_id,
                    valor: venda.valor,
                    cliente_nome: venda.cliente_nome,
                    cliente_email: venda.cliente_email,
                    cliente_telefone: venda.cliente_telefone,
                    cliente_whatsapp: venda.cliente_whatsapp,
                    data_aprovacao: new Date().toISOString()
                }, produto.vendedor_id, produto.id); // Passar user_id e produto_id para filtrar webhooks
                console.log(`🔔 [PAGAMENTO DEBUG] Webhook de venda aprovada processado`);
                console.log(`🔔 [PAGAMENTO DEBUG] ===== FIM DO DISPARO =====\n`);
            } catch (webhookError) {
                console.error(`\n❌ [PAGAMENTO DEBUG] ===== ERRO AO DISPARAR WEBHOOK =====`);
                console.error('❌ [PAGAMENTO DEBUG] Erro ao enviar webhook de venda:', webhookError);
                console.error('❌ [PAGAMENTO DEBUG] Stack:', webhookError.stack);
                console.error(`❌ [PAGAMENTO DEBUG] ===== FIM DO ERRO =====\n`);
            }
            
            // Notificação para vendedores removida (push notifications descontinuadas)

            // Enviar notificação automática para painel do vendedor via webhook
            try {
                console.log('🔔 Enviando notificação automática para painel do vendedor via webhook...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoNovaVenda(venda.id);
                console.log('✅ Notificação automática enviada para painel do vendedor via webhook');
            } catch (autoNotificationError) {
                console.error('❌ Erro ao enviar notificação automática via webhook:', autoNotificationError);
                // Não falhar o webhook por erro de notificação
            }

            // Enviar email de confirmação de compra para o cliente via webhook
            try {
                console.log('📧 Enviando email de confirmação de compra para cliente via webhook...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoConteudoPronto(venda.id);
                console.log('✅ Email de confirmação de compra enviado para cliente via webhook');
            } catch (emailClienteError) {
                console.error('❌ Erro ao enviar email para cliente via webhook:', emailClienteError);
                // Não falhar o webhook por erro de email
            }
        }

        res.json({
            success: true,
            message: 'Status atualizado com sucesso via e2Payments',
            data: {
                vendaId: venda.id,
                transactionId: transaction_id,
                statusAnterior,
                pagamentoStatus: novoPagamentoStatus
            }
        });

    } catch (error) {
        console.error('❌ Erro no webhook PayMoz:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Atualizar status da venda por ID da transação
router.post('/atualizar-status-venda/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { status, motivo } = req.body;

        console.log(`🔄 Atualizando status da venda: ${transactionId} para ${status}`);

        if (!status) {
            return res.status(400).json({
                success: false,
                error: 'Status é obrigatório'
            });
        }

        // Buscar venda pelo transaction_id ou pelo ID da venda
        let venda = await Venda.findOne({ where: { referencia_pagamento: transactionId } });
        
        // Se não encontrar por referencia_pagamento, tentar buscar pelo ID da venda
        if (!venda) {
            venda = await Venda.findByPk(transactionId);
        }
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }

        const statusAnterior = venda.status;
        
        // Validar status
        const statusValidos = ['Pendente', 'Aprovada', 'Rejeitado', 'Cancelada'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status inválido. Valores aceitos: Pendente, Aprovado, Rejeitado, Cancelado'
            });
        }

        // Preparar dados para atualização
        const updateData = {
            status: status,
            data_pagamento: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Se for cancelamento, adicionar informações de falha
        if (status === 'Cancelada') {
            updateData.status = 'Cancelada';
            updateData.falha_motivo = motivo || 'Cancelamento automático por erro do servidor';
            updateData.falha_data = new Date().toISOString();
            updateData.falha_id = `SERVER-ERROR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            
            // Buscar produto para webhook e remarketing
            const produtoCancelado = await Produto.findByPk(venda.produto_id);
            
            // Enviar webhook para venda cancelada
            if (produtoCancelado && produtoCancelado.vendedor_id) {
                try {
                    const { enviarWebhook } = require('./webhooks');
                    await enviarWebhook('venda_cancelada', {
                        venda_id: venda.id,
                        produto_id: venda.produto_id,
                        vendedor_id: produtoCancelado.vendedor_id,
                        valor: venda.valor || venda.pagamento_valor,
                        cliente_nome: venda.cliente_nome,
                        cliente_email: venda.cliente_email,
                        cliente_telefone: venda.cliente_telefone,
                        cliente_whatsapp: venda.cliente_whatsapp,
                        status_anterior: statusAnterior,
                        motivo: motivo || 'Cancelamento automático por erro do servidor',
                        data_cancelamento: new Date().toISOString()
                    }, produtoCancelado.vendedor_id, venda.produto_id);
                    console.log('✅ Webhook de venda cancelada enviado (atualização manual)');
                } catch (webhookError) {
                    console.error('⚠️ Erro ao enviar webhook de venda cancelada:', webhookError);
                }
            }
            
            // Adicionar à fila de remarketing se o produto tiver remarketing ativado
            try {
                const remarketingService = require('../services/remarketingService');
                
                if (produtoCancelado && produtoCancelado.remarketing_config?.enabled) {
                    console.log('🔄 Adicionando venda cancelada à fila de remarketing...');
                    const resultadoRemarketing = await remarketingService.adicionarVendaCancelada({
                        cliente_id: venda.cliente_id || undefined, // undefined será tratado pelo serviço
                        cliente_nome: venda.cliente_nome || 'Cliente',
                        produto_id: venda.produto_id,
                        produto_nome: produtoCancelado.nome,
                        email: venda.cliente_email,
                        telefone: venda.cliente_whatsapp || venda.cliente_telefone, // Priorizar WhatsApp do checkout
                        venda_cancelada_id: venda.id // Adicionar ID da venda cancelada
                    });
                    
                    if (resultadoRemarketing.ignorado) {
                        console.log(`⚠️ Remarketing ignorado: ${resultadoRemarketing.motivo}`);
                    } else if (resultadoRemarketing.sucesso) {
                        console.log('✅ Venda cancelada adicionada à fila de remarketing!');
                    }
                }
            } catch (remarketingError) {
                console.error('⚠️ Erro ao adicionar à fila de remarketing:', remarketingError.message);
            }
        }

        await venda.update(updateData);

        console.log(`✅ Status da venda atualizado:`);
        console.log(`   Venda ID: ${venda.id}`);
        console.log(`   Transaction ID: ${transactionId}`);
        console.log(`   Status anterior: ${statusAnterior}`);
        console.log(`   Novo status: ${status}`);
        if (motivo) {
            console.log(`   Motivo: ${motivo}`);
        }

        // Notificação de conteúdo pendente removida conforme solicitado

        // Notificar frontend em tempo real sobre o cancelamento
        if (status === 'Cancelada' && global.emitUpdate) {
            global.emitUpdate(`venda_${venda.id}`, 'payment_cancelled', {
                vendaId: venda.id,
                publicId: venda.public_id,
                motivo: motivo || 'Cancelamento automático por erro do servidor',
                tipoErro: 'server_error',
                timestamp: new Date().toISOString()
            });
        }

        res.json({
            success: true,
            message: 'Status atualizado com sucesso',
            data: {
                transactionId: transactionId,
                vendaId: venda.id,
                statusAnterior: statusAnterior,
                novoStatus: status,
                motivo: motivo
            }
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status da venda:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Atualizar status manualmente (para testes e correções)
router.post('/atualizar-status', async (req, res) => {
    try {
        const { transaction_id, status, observacoes } = req.body;

        if (!transaction_id || !status) {
            return res.status(400).json({
                success: false,
                error: 'Dados obrigatórios: transaction_id, status'
            });
        }

        // Buscar venda pelo transaction_id
        const venda = await Venda.findOne({ where: { referencia_pagamento: transaction_id } });
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }

        const statusAnterior = venda.status;
        
        // Validar status
        const statusValidos = ['Pendente', 'Aprovada', 'Rejeitado', 'Cancelada'];
        if (!statusValidos.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Status inválido. Valores aceitos: Pendente, Aprovado, Rejeitado, Cancelado'
            });
        }

        // Preparar dados para atualização
        const updateData = {
            status: status,
            data_pagamento: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Adicionar observações se fornecidas
        if (observacoes) {
            updateData.observacoes = venda.observacoes ? 
                `${venda.observacoes}\n${new Date().toISOString()}: ${observacoes}` : 
                `${new Date().toISOString()}: ${observacoes}`;
        }

        await venda.update(updateData);

        console.log(`✅ Status atualizado manualmente:`);
        console.log(`   Venda ID: ${venda.id}`);
        console.log(`   Transaction ID: ${transaction_id}`);
        console.log(`   Status anterior: ${statusAnterior}`);
        console.log(`   Novo status: ${status}`);

        // Incrementar vendas do produto apenas se mudou para aprovado
        if (statusAnterior !== 'Aprovada' && status === 'Aprovada') {
            await Produto.increment('vendas', { where: { id: venda.produto_id } });
            
            // Buscar produto para envio do email
            const produto = await Produto.findByPk(venda.produto_id);
            
            // Processar venda com sistema de taxas (10% admin, 90% vendedor)
            // venda.valor já é 90% do valor com desconto, então calcular valor total
            try {
                console.log('💰 Processando sistema de taxas via atualização manual...');
                const SaldoAdminService = require('../services/saldoAdminService');
                // venda.valor é 90% do valor com desconto, então o valor total é venda.valor / 0.9
                const valorTotalVenda = venda.valor / 0.9;
                const resultado = await SaldoAdminService.processarVendaAprovada(venda.id, valorTotalVenda, produto.vendedor_id);
                console.log('✅ Sistema de taxas processado via atualização manual:');
                console.log(`   💳 Valor total da venda (com desconto): MZN ${valorTotalVenda.toFixed(2)}`);
                console.log(`   💼 Taxa do administrador (10%): MZN ${resultado.taxa_admin.toFixed(2)}`);
                console.log(`   👤 Receita do vendedor (90%): MZN ${resultado.receita_vendedor.toFixed(2)}`);
            } catch (taxError) {
                console.error('⚠️ Erro ao processar sistema de taxas via atualização manual:', taxError);
                // Não falhar o processo por erro na comissão
            }
            
            // Atualizar receita do vendedor (sistema antigo - mantido para compatibilidade)
            try {
                console.log('💰 Atualizando receita do vendedor via atualização manual...');
                const EstatisticasService = require('../services/estatisticasService');
                await EstatisticasService.atualizarEstatisticasVendedor(produto.vendedor_id);
                console.log('✅ Receita do vendedor atualizada via atualização manual');
            } catch (receitaError) {
                console.error('❌ Erro ao atualizar receita do vendedor via atualização manual:', receitaError);
                // Não falhar o processo por erro na atualização da receita
            }
            
            // Buscar dados do vendedor para notificação
            let vendedor = null;
            try {
                const { Usuario } = require('../config/database');
                vendedor = await Usuario.findByPk(produto.vendedor_id);
                console.log('👤 Vendedor encontrado para notificação via atualização manual:', vendedor ? vendedor.email : 'não encontrado');
            } catch (error) {
                console.error('❌ Erro ao buscar vendedor via atualização manual:', error);
            }
            
            // Push notifications removido

            // Notificação para vendedores removida (push notifications descontinuadas)

            // Enviar notificação automática para painel do vendedor via atualização manual
            try {
                console.log('🔔 Enviando notificação automática para painel do vendedor via atualização manual...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoNovaVenda(venda.id);
                console.log('✅ Notificação automática enviada para painel do vendedor via atualização manual');
            } catch (autoNotificationError) {
                console.error('❌ Erro ao enviar notificação automática via atualização manual:', autoNotificationError);
                // Não falhar o processo por erro de notificação
            }

            // Enviar email de confirmação de compra para o cliente via atualização manual
            try {
                console.log('📧 Enviando email de confirmação de compra para cliente via atualização manual...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoConteudoPronto(venda.id);
                console.log('✅ Email de confirmação de compra enviado para cliente via atualização manual');
            } catch (emailClienteError) {
                console.error('❌ Erro ao enviar email para cliente via atualização manual:', emailClienteError);
                // Não falhar o processo por erro de email
            }
        }

        res.json({
            success: true,
            message: 'Status atualizado com sucesso',
            data: {
                vendaId: venda.id,
                transactionId: transaction_id,
                statusAnterior,
                pagamentoStatus: status
            }
        });

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET - Verificar status do pagamento por transactionId
router.get('/status/:transactionId', async (req, res) => {
    try {
        const transactionId = req.params.transactionId;
        
        // Buscar venda pelo ID da transação ou pelo ID da venda
        let venda = await Venda.findOne({ where: { referencia_pagamento: transactionId } });
        
        // Se não encontrar por referencia_pagamento, tentar buscar pelo ID da venda
        if (!venda) {
            venda = await Venda.findByPk(transactionId);
        }
        
        if (!venda) {
            console.log(`❌ Venda não encontrada para transactionId: ${transactionId}`);
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }
        
        console.log(`✅ Venda encontrada: ${JSON.stringify(venda)}`);
        
        // Buscar produto relacionado
        const produto = await Produto.findByPk(venda.produto_id);
        
        if (!produto) {
            console.log(`⚠️ Produto não encontrado para venda: ${venda.id}, produtoId: ${venda.produtoId}`);
        } else {
            console.log(`✅ Produto encontrado: ${produto.nome}`);
        }
        
        // Formatar resposta
        const resposta = {
            success: true,
            data: {
                status: venda.pagamentoStatus,
                transactionId: venda.pagamentoTransacaoId || transactionId,
                pagamento: {
                    status: venda.pagamentoStatus,
                    metodo: venda.pagamentoMetodo,
                    valor: venda.pagamentoValor,
                    data: venda.pagamentoData
                },
                venda: {
                    id: venda.id,
                    status: venda.status,
                    dataVenda: venda.dataVenda,
                    transacaoId: venda.pagamentoTransacaoId || transactionId
                },
                cliente: {
                    nome: venda.clienteNome,
                    email: venda.clienteEmail
                },
                produto: produto ? {
                    id: produto.id,
                    nome: produto.nome,
                    customId: produto.custom_id
                } : null
            }
        };
        
        // Se o pagamento foi aprovado e ainda não foi processado, processar e enviar notificações
        const statusAprovado = ['Pago', 'Aprovado', 'approved', 'success', 'completed'];
        if (statusAprovado.includes(venda.status) || statusAprovado.includes(venda.pagamento_status)) {
            // Verificar se já foi processado (tem data_pagamento)
            // Verificar se é upsell pelas observações
            const isUpsell = venda.observacoes && venda.observacoes.toLowerCase().includes('upsell');
            if (!venda.data_pagamento && isUpsell) {
                console.log('🔄 Pagamento de upsell aprovado, processando e enviando notificações...');
                try {
                    const { processarPagamentoAprovado } = require('./pagamento');
                    const { Cliente } = require('../config/database');
                    
                    // Buscar cliente
                    let cliente = null;
                    if (venda.cliente_id) {
                        cliente = await Cliente.findByPk(venda.cliente_id);
                    }
                    
                    if (!cliente && venda.cliente_email) {
                        cliente = await Cliente.findOne({ where: { email: venda.cliente_email } });
                    }
                    
                    if (!cliente) {
                        cliente = {
                            id: venda.cliente_id,
                            nome: venda.cliente_nome || 'Cliente',
                            email: venda.cliente_email || '',
                            telefone: venda.cliente_telefone || ''
                        };
                    }
                    
                    if (produto) {
                        await processarPagamentoAprovado(
                            venda,
                            produto,
                            cliente,
                            parseFloat(venda.valor || venda.pagamento_valor || 0),
                            venda.metodo_pagamento || venda.pagamento_metodo || 'mpesa',
                            transactionId
                        );
                        console.log('✅ Pagamento de upsell processado e notificações enviadas');
                    }
                } catch (processError) {
                    console.error('❌ Erro ao processar pagamento aprovado de upsell:', processError);
                    // Não falhar a resposta de status por erro de processamento
                }
            }
        }
        
        console.log(`✅ Status verificado para transactionId: ${transactionId}, status: ${venda.pagamentoStatus}`);
        res.json(resposta);
    } catch (error) {
        console.error('❌ Erro ao verificar status do pagamento:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar status do pagamento'
        });
    }
});

// GET - Obter dados completos da transação para página de sucesso
router.get('/transacao/:transactionId', async (req, res) => {
    try {
        const transactionId = req.params.transactionId;
        
        // Buscar venda pelo ID da transação
        const venda = await Venda.findOne({ where: { referencia_pagamento: transactionId } });
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }
        
        // Buscar produto relacionado
        const produto = await Produto.findByPk(venda.produto_id);
        
        // Buscar dados do vendedor se o produto existir
        let vendedor = null;
        if (produto && produto.vendedor_id) {
            const { Usuario } = require('../config/database');
            vendedor = await Usuario.findByPk(produto.vendedor_id);
        }
        
        const resposta = {
            success: true,
            data: {
                transacaoId: transactionId,
                nomeCliente: venda.cliente_nome,
                emailCliente: venda.cliente_email,
                valor: venda.valor,
                metodo: venda.metodo_pagamento,
                status: venda.status,
                dataCriacao: venda.created_at,
                produto: produto ? {
                    id: produto.id,
                    nome: produto.nome,
                    tipo: produto.tipo,
                    linkConteudo: produto.link_conteudo,
                    customId: produto.custom_id
                } : null,
                vendedor: vendedor ? {
                    id: vendedor.id,
                    nome: vendedor.nome_completo,
                    email: vendedor.email,
                    whatsapp: vendedor.whatsapp || vendedor.telefone
                } : null
            }
        };
        
        console.log(`✅ Dados da transação carregados: ${transactionId}`);
        res.json(resposta);
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados da transação:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET - Buscar produtos complementares para Order Bump
router.get('/order-bump/:produtoId', async (req, res) => {
    try {
        const { produtoId } = req.params;
        
        console.log(`🎯 Buscando produtos complementares para Order Bump: ${produtoId}`);
        
        // Buscar produto principal por public_id (6 dígitos) ou custom_id
        let produtoPrincipal;
        
        if (/^\d{6}$/.test(produtoId)) {
            // Se for 6 dígitos, buscar por public_id
            produtoPrincipal = await Produto.findOne({ 
                where: { public_id: produtoId } 
            });
        } else {
            // Caso contrário, buscar por custom_id
            produtoPrincipal = await Produto.findOne({ 
                where: { custom_id: produtoId } 
            });
        }
        
        if (!produtoPrincipal) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }
        
        console.log(`✅ Produto principal encontrado: ${produtoPrincipal.nome} (Vendedor: ${produtoPrincipal.vendedor_id})`);
        
        // Buscar produtos complementares do mesmo vendedor
        // TODO: Implementar busca baseada na configuração do usuário
        // Por enquanto, usar configuração padrão
        const maxProducts = 3; // Configuração padrão
        const displayOrder = 'vendas'; // Configuração padrão
        
        let orderClause;
        switch (displayOrder) {
            case 'preco':
                orderClause = [['preco', 'ASC'], ['created_at', 'DESC']];
                break;
            case 'recente':
                orderClause = [['created_at', 'DESC'], ['vendas', 'DESC']];
                break;
            case 'aleatorio':
                orderClause = [require('sequelize').literal('RANDOM()')];
                break;
            default: // 'vendas'
                orderClause = [['vendas', 'DESC'], ['created_at', 'DESC']];
        }

        const produtosComplementares = await Produto.findAll({
            where: {
                vendedor_id: produtoPrincipal.vendedor_id,
                public_id: { [require('sequelize').Op.ne]: produtoPrincipal.public_id }, // Excluir o produto principal
                ativo: true,
                preco: { [require('sequelize').Op.gt]: 0 } // Apenas produtos com preço > 0
            },
            order: orderClause,
            limit: maxProducts
        });
        
        console.log(`🔍 Encontrados ${produtosComplementares.length} produtos complementares`);
        
        // Formatar resposta
        const orderBumpProducts = produtosComplementares.map(produto => ({
            id: produto.id,
            public_id: produto.public_id,
            custom_id: produto.custom_id,
            nome: produto.nome,
            descricao: produto.descricao,
            preco: produto.preco,
            preco_com_desconto: produto.preco_com_desconto,
            desconto: produto.desconto,
            categoria: produto.categoria,
            tipo: produto.tipo,
            imagem_url: produto.imagem_url,
            vendas: produto.vendas || 0
        }));
        
        res.json({
            success: true,
            produto_principal: {
                id: produtoPrincipal.id,
                public_id: produtoPrincipal.public_id,
                nome: produtoPrincipal.nome,
                vendedor_id: produtoPrincipal.vendedor_id
            },
            produtos_complementares: orderBumpProducts
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar produtos complementares:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// GET - Obter dados do vendedor através do produto
router.get('/produtos/:productId/vendedor', async (req, res) => {
    try {
        const productId = req.params.productId;
        const { Op } = require('sequelize');
        
        // Buscar produto
        const produto = await Produto.findOne({ 
            where: { 
                [Op.or]: [
                    { id: productId },
                    { custom_id: productId },
                    { public_id: productId }
                ]
            }
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }
        
        // Buscar dados do vendedor
        let vendedor = null;
        if (produto.vendedor_id) {
            const { Usuario } = require('../config/database');
            vendedor = await Usuario.findByPk(produto.vendedor_id);
        }
        
        if (!vendedor) {
            return res.status(404).json({
                success: false,
                error: 'Vendedor não encontrado'
            });
        }
        
        const resposta = {
            success: true,
            data: {
                id: vendedor.id,
                nome: vendedor.nome_completo,
                email: vendedor.email,
                whatsapp: vendedor.whatsapp || vendedor.telefone,
                telefone: vendedor.telefone
            }
        };
        
        console.log(`✅ Dados do vendedor carregados: ${vendedor.nome_completo}`);
        res.json(resposta);
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados do vendedor:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Cancelar transação automaticamente (timeout)
router.post('/cancelar-transacao/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { motivo } = req.body;

        console.log(`🔄 Cancelando transação automaticamente: ${transactionId}, motivo: ${motivo}`);

        // Buscar venda pelo transaction ID
        const venda = await Venda.findOne({ where: { referencia_pagamento: transactionId } });

        if (!venda) {
            return res.status(404).json({
                success: false,
                error: 'Transação não encontrada'
            });
        }

        // Verificar se a transação ainda está pendente
        if (venda.status !== 'Pendente') {
            return res.status(400).json({
                success: false,
                error: 'Transação já não está pendente'
            });
        }

        // Atualizar status para cancelado
        await venda.update({
            status: 'Cancelada',
            falha_motivo: motivo || 'Transação cancelada automaticamente por timeout',
            falha_data: new Date().toISOString(),
            falha_id: `TIMEOUT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            data_pagamento: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // Enviar webhook para venda cancelada
        try {
            const { Produto } = require('../config/database');
            const produto = await Produto.findByPk(venda.produto_id);
            
            if (produto && produto.vendedor_id) {
                const { enviarWebhook } = require('./webhooks');
                await enviarWebhook('venda_cancelada', {
                    venda_id: venda.id,
                    produto_id: venda.produto_id,
                    vendedor_id: produto.vendedor_id,
                    valor: venda.pagamento_valor || venda.valor,
                    cliente_nome: venda.cliente_nome,
                    cliente_email: venda.cliente_email,
                    cliente_telefone: venda.cliente_telefone,
                    cliente_whatsapp: venda.cliente_whatsapp,
                    status_anterior: 'Pendente',
                    motivo: motivo || 'Transação cancelada automaticamente por timeout',
                    data_cancelamento: new Date().toISOString()
                }, produto.vendedor_id, venda.produto_id);
                console.log('✅ Webhook de venda cancelada enviado (timeout)');
            }
        } catch (webhookError) {
            console.error('⚠️ Erro ao enviar webhook de venda cancelada:', webhookError);
        }

        console.log(`✅ Transação ${transactionId} cancelada automaticamente`);

        res.json({
            success: true,
            message: 'Transação cancelada com sucesso',
            data: {
                transactionId: transactionId,
                status: 'Cancelado',
                motivo: motivo || 'Transação cancelada automaticamente por timeout'
            }
        });

    } catch (error) {
        console.error('❌ Erro ao cancelar transação:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Enviar confirmação manual (endpoint adicional)
router.post('/enviar-confirmacao', async (req, res) => {
    try {
        const {
            nome,
            email,
            produto,
            valorPago,
            idTransacao,
            desconto,
            valorOriginal,
            linkContent
        } = req.body;

        // Validações básicas
        if (!email || !nome || !produto || !valorPago || !idTransacao) {
            return res.status(400).json({
                success: false,
                error: 'Dados obrigatórios: email, nome, produto, valorPago, idTransacao'
            });
        }

        // Verificar se o serviço de email está configurado
        if (!professionalEmailService.isInitialized) {
            return res.status(500).json({
                success: false,
                error: 'Serviço de email não configurado'
            });
        }

        // Criar objeto venda para compatibilidade com o serviço de email
        const vendaData = {
            clienteNome: nome,
            clienteEmail: email,
            pagamentoValor: parseFloat(valorPago),
            pagamentoTransacaoId: idTransacao,
            pagamentoMetodo: 'Manual'
        };

        // Criar objeto produto para compatibilidade
        const produtoData = {
            nome: produto,
            linkConteudo: linkContent || '#'
        };

        // Enviar email
        await professionalEmailService.enviarEmailVendas(email, '🎉 Confirmação de Compra - RatixPay', `Olá ${nome}! Sua compra foi confirmada.`, 'confirmacao_compra');

        res.status(200).json({
            success: true,
            message: 'E-mail enviado com sucesso.'
        });

    } catch (error) {
        console.error('❌ Erro ao enviar confirmação manual:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar e-mail.',
            error: error.message
        });
    }
});

// GET - Endpoint de sucesso com todas as informações do pedido (por venda_id)
router.get('/success/venda/:vendaId', async (req, res) => {
    try {
        const { vendaId } = req.params;
        
        console.log(`📊 Buscando informações do pedido por venda_id: ${vendaId}`);
        
        // Verificar se é um número (public_id) ou UUID
        let venda;
        if (/^\d+$/.test(vendaId)) {
            // É um número, buscar pelo public_id
            console.log(`🔍 Buscando venda pelo public_id: ${vendaId}`);
            venda = await Venda.findOne({
                where: { public_id: vendaId }
            });
        } else {
            // É um UUID, buscar pelo id
            console.log(`🔍 Buscando venda pelo id (UUID): ${vendaId}`);
            venda = await Venda.findByPk(vendaId);
        }
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar o pedido relacionado
        const pedido = await Pedido.findOne({
            where: { venda_id: venda.id }
        });
        
        // Buscar o produto
        const produto = await Produto.findByPk(venda.produto_id);
        
        // Buscar o vendedor
        const vendedor = await Usuario.findByPk(venda.vendedor_id);
        
        // Buscar o expert associado ao produto (se houver)
        let expert = null;
        if (produto && produto.expert_id) {
            const { Expert } = require('../config/database');
            expert = await Expert.findByPk(produto.expert_id);
        }
        
        // Buscar produtos complementares da venda
        const ProdutoComplementarVendaService = require('../services/produtoComplementarVendaService');
        const produtosComplementares = await ProdutoComplementarVendaService.buscarProdutosComplementaresPorVenda(venda.id);
        const produtosComplementaresFormatados = await ProdutoComplementarVendaService.formatarProdutosComplementares(produtosComplementares);
        
        console.log(`📦 Produtos complementares encontrados: ${produtosComplementaresFormatados.length}`);
        
        // Verificar se a venda foi aprovada (aceitar múltiplos status de aprovação)
        const statusAprovado = ['Pago', 'Aprovada', 'Aprovado', 'Paga'];
        if (!statusAprovado.includes(venda.status)) {
            console.log(`⚠️ Venda ${vendaId} não está aprovada. Status atual: ${venda.status}`);
            return res.status(400).json({
                success: false,
                message: `Venda não foi aprovada. Status atual: ${venda.status}`
            });
        }
        
        // Formatar dados para resposta
        const responseData = {
            success: true,
            data: {
                numeroPedido: pedido ? pedido.numero : venda.referencia_pagamento,
                produto: {
                    nome: produto ? produto.nome : 'Produto não encontrado',
                    imagem: produto ? produto.imagem_url : '',
                    linkConteudo: produto ? (produto.link_conteudo || produto.conteudo_link) : ''
                },
                vendedor: {
                    nome: vendedor ? vendedor.nome_completo : 'Vendedor não encontrado',
                    email: vendedor ? vendedor.email : '',
                    whatsapp: vendedor ? vendedor.telefone : ''
                },
                expert: expert ? {
                    nome: expert.nome,
                    email: expert.email,
                    whatsapp: expert.whatsapp,
                    profissao: expert.profissao
                } : null,
                cliente: {
                    nome: venda.cliente_nome,
                    email: venda.cliente_email,
                    telefone: venda.cliente_telefone
                },
                pagamento: {
                    valor: venda.valor,
                    status: venda.status,
                    metodo: venda.metodo_pagamento,
                    data: venda.created_at
                },
                pedido: {
                    id: pedido ? pedido.id : venda.id,
                    status: pedido ? pedido.status : venda.status,
                    dataCriacao: pedido ? pedido.created_at : venda.created_at
                },
                produtosComplementares: produtosComplementaresFormatados,
                // Incluir tracking_data (parâmetros UTM) da venda
                tracking_data: venda.tracking_data || null
            }
        };
        
        // Log para debug do tracking_data
        if (venda.tracking_data) {
            console.log(`📊 Tracking Data incluído na resposta:`, JSON.stringify(venda.tracking_data, null, 2));
        } else {
            console.log(`ℹ️ Venda não possui tracking_data (pode ser venda antiga ou sem parâmetros UTM)`);
        }
        
        console.log(`✅ Informações do pedido por venda_id ${vendaId} retornadas com sucesso`);
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Erro ao buscar informações do pedido por venda_id:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET - Endpoint de sucesso com todas as informações do pedido (por número do pedido)
router.get('/success/:numeroPedido', async (req, res) => {
    try {
        const { numeroPedido } = req.params;
        
        console.log(`📊 Buscando informações do pedido: ${numeroPedido}`);
        
        // Verificar se é um UUID (venda_id)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(numeroPedido)) {
            console.log(`🔄 UUID detectado, redirecionando para rota de venda: ${numeroPedido}`);
            // Redirecionar para a rota de venda
            return res.redirect(`/api/success/venda/${numeroPedido}`);
        }
        
        // Validar se numeroPedido é um número válido
        const numeroPedidoInt = parseInt(numeroPedido);
        if (isNaN(numeroPedidoInt) || numeroPedidoInt <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Número do pedido inválido'
            });
        }
        
        // Buscar o pedido pelo número
        const pedido = await Pedido.findOne({
            where: { numero: numeroPedidoInt }
        });
        
        if (!pedido) {
            return res.status(404).json({
                success: false,
                message: 'Pedido não encontrado'
            });
        }
        
        // Buscar a venda relacionada
        const venda = await Venda.findByPk(pedido.venda_id);
        
        if (!venda) {
            return res.status(404).json({
                success: false,
                message: 'Venda não encontrada'
            });
        }
        
        // Buscar o produto
        const produto = await Produto.findByPk(venda.produto_id);
        
        // Buscar o vendedor
        const vendedor = await Usuario.findByPk(venda.vendedor_id);
        
        // Buscar o expert associado ao produto (se houver)
        let expert = null;
        if (produto && produto.expert_id) {
            const { Expert } = require('../config/database');
            expert = await Expert.findByPk(produto.expert_id);
        }
        
        // Buscar produtos complementares da venda
        const ProdutoComplementarVendaService = require('../services/produtoComplementarVendaService');
        const produtosComplementares = await ProdutoComplementarVendaService.buscarProdutosComplementaresPorVenda(venda.id);
        const produtosComplementaresFormatados = await ProdutoComplementarVendaService.formatarProdutosComplementares(produtosComplementares);
        
        console.log(`📦 Produtos complementares encontrados: ${produtosComplementaresFormatados.length}`);
        
        // Verificar se a venda foi aprovada (aceitar múltiplos status de aprovação)
        const statusAprovado = ['Pago', 'Aprovada', 'Aprovado', 'Paga'];
        if (!statusAprovado.includes(venda.status)) {
            console.log(`⚠️ Venda ${numeroPedido} não está aprovada. Status atual: ${venda.status}`);
            return res.status(400).json({
                success: false,
                message: `Venda não foi aprovada. Status atual: ${venda.status}`
            });
        }
        
        // Formatar dados para resposta
        const responseData = {
            success: true,
            data: {
                numeroPedido: pedido.numero,
                produto: {
                    nome: produto ? produto.nome : 'Produto não encontrado',
                    imagem: produto ? produto.imagem_url : '',
                    linkConteudo: produto ? (produto.link_conteudo || produto.conteudo_link) : ''
                },
                vendedor: {
                    nome: vendedor ? vendedor.nome_completo : 'Vendedor não encontrado',
                    email: vendedor ? vendedor.email : '',
                    whatsapp: vendedor ? vendedor.telefone : ''
                },
                expert: expert ? {
                    nome: expert.nome,
                    email: expert.email,
                    whatsapp: expert.whatsapp,
                    profissao: expert.profissao
                } : null,
                cliente: {
                    nome: venda.cliente_nome,
                    email: venda.cliente_email,
                    telefone: venda.cliente_telefone
                },
                pagamento: {
                    valor: venda.valor,
                    status: venda.status,
                    metodo: venda.metodo_pagamento,
                    data: venda.created_at
                },
                pedido: {
                    id: pedido.id,
                    status: pedido.status,
                    dataCriacao: pedido.created_at
                },
                produtosComplementares: produtosComplementaresFormatados
            }
        };
        
        console.log(`✅ Informações do pedido ${numeroPedido} retornadas com sucesso`);
        
        res.json(responseData);
        
    } catch (error) {
        console.error('❌ Erro ao buscar informações do pedido:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// POST - Enviar conteúdo por e-mail
router.post('/send-content-email', async (req, res) => {
    try {
        const { numeroPedido, clienteNome, clienteEmail, produtoNome, linkConteudo } = req.body;
        
        console.log(`📧 Enviando conteúdo por e-mail para pedido: ${numeroPedido}, cliente: ${clienteNome}, email: ${clienteEmail}`);
        
        // Validar dados obrigatórios
        if (!numeroPedido || !clienteEmail || !produtoNome) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }
        
        // Preparar dados para envio
        const emailData = {
            to: clienteEmail,
            subject: `🎉 Seu conteúdo está pronto! - Pedido #${numeroPedido}`,
            productName: produtoNome,
            contentLink: linkConteudo || '',
            orderNumber: numeroPedido,
            clientName: clienteNome
        };
        
        // Enviar e-mail com o conteúdo
        await professionalEmailService.enviarEmailVendas(clienteEmail, '📧 Conteúdo do Produto - RatixPay', conteudo, 'conteudo_produto');
        
        console.log(`✅ Conteúdo enviado por e-mail para ${clienteEmail}`);
        
        res.json({
            success: true,
            message: 'Conteúdo enviado por e-mail com sucesso!'
        });
        
    } catch (error) {
        console.error('❌ Erro ao enviar conteúdo por e-mail:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar e-mail. Tente novamente.',
            error: error.message
        });
    }
});

// POST - Enviar conteúdo por WhatsApp
router.post('/send-content-whatsapp', async (req, res) => {
    try {
        const { numeroPedido, clienteNome, clienteTelefone, produtoNome, linkConteudo } = req.body;
        
        console.log(`📱 Enviando conteúdo por WhatsApp para pedido: ${numeroPedido}, cliente: ${clienteNome}, telefone: ${clienteTelefone}`);
        
        // Validar dados obrigatórios
        if (!numeroPedido || !clienteTelefone || !produtoNome) {
            return res.status(400).json({
                success: false,
                message: 'Dados obrigatórios não fornecidos'
            });
        }
        
        // Enviar WhatsApp com o conteúdo usando sessão única
        const whatsappManager = require('../services/whatsappManager');
        
        // Mensagem curta e objetiva
        let mensagem = `📦 *Seu Produto*

${produtoNome}

🔗 ${linkConteudo || ''}

RatixPay`;

        await whatsappManager.sendNotificationSafely(clienteTelefone, mensagem);
        
        console.log(`✅ Conteúdo enviado por WhatsApp para ${clienteTelefone}`);
        
        res.json({
            success: true,
            message: 'Conteúdo enviado por WhatsApp com sucesso!'
        });
        
    } catch (error) {
        console.error('❌ Erro ao enviar conteúdo por WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar WhatsApp',
            error: error.message
        });
    }
});



// POST - Testar serviço de notificações
router.post('/test-notifications', async (req, res) => {
    try {
        const resultado = await notificationService.testarNotificacoes();
        
        res.json({
            success: true,
            message: 'Teste de notificações executado',
            resultado
        });
    } catch (error) {
        console.error('❌ Erro no teste de notificações:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET - Buscar configuração do Order Bump do usuário
router.get('/order-bump/config', async (req, res) => {
    try {
        // Verificar autenticação
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token de autenticação necessário'
            });
        }

        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            return res.status(401).json({
                success: false,
                error: 'Token inválido'
            });
        }

        const userId = decoded.id;
        console.log(`🔍 Buscando configuração Order Bump para usuário: ${userId}`);

        // Buscar configuração no banco (por enquanto retornar configuração padrão)
        // TODO: Implementar tabela de configurações se necessário
        const defaultConfig = {
            maxProducts: 3,
            displayOrder: 'vendas',
            customMessage: '',
            backgroundColor: '#fef3c7',
            borderColor: '#f59e0b',
            selectedProducts: []
        };

        res.json({
            success: true,
            config: defaultConfig
        });

    } catch (error) {
        console.error('❌ Erro ao buscar configuração Order Bump:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});

// POST - Salvar configuração do Order Bump
router.post('/order-bump/config', async (req, res) => {
    try {
        // Verificar autenticação
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token de autenticação necessário'
            });
        }

        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_aqui';
        
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            return res.status(401).json({
                success: false,
                error: 'Token inválido'
            });
        }

        const userId = decoded.id;
        const config = req.body;

        console.log(`💾 Salvando configuração Order Bump para usuário: ${userId}`, config);

        // Validar configuração
        if (!config.maxProducts || config.maxProducts < 1 || config.maxProducts > 5) {
            return res.status(400).json({
                success: false,
                error: 'Número máximo de produtos deve estar entre 1 e 5'
            });
        }

        // TODO: Salvar configuração no banco de dados
        // Por enquanto, apenas logar a configuração
        console.log('✅ Configuração Order Bump salva:', {
            userId,
            maxProducts: config.maxProducts,
            displayOrder: config.displayOrder,
            selectedProducts: config.selectedProducts?.length || 0
        });

        res.json({
            success: true,
            message: 'Configuração salva com sucesso',
            config: config
        });

    } catch (error) {
        console.error('❌ Erro ao salvar configuração Order Bump:', error);
        res.status(500).json({
            success: false,
            error: 'Erro interno do servidor'
        });
    }
});


// POST - Endpoint de checkout simplificado para e2Payments API
router.post('/checkout', async (req, res) => {
    try {
        const { method, amount, phone, context } = req.body;

        // Validações
        if (!['mpesa', 'emola'].includes(method)) {
            return res.status(400).json({ 
                success: false, 
                status: 'cancelled', 
                message: 'Método inválido' 
            });
        }
        
        if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
            return res.status(400).json({ 
                success: false, 
                status: 'cancelled', 
                message: 'Valor inválido' 
            });
        }
        
        if (!/^8[4-7]\d{7}$/.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                status: 'cancelled', 
                message: 'Telefone inválido' 
            });
        }

        // Chamada para PayMoz API
        const response = await paymozService.processPayment(
            method.toLowerCase(), // Garantir que o método está em lowercase
            amount,
            phone,
            context || `Pagamento do Pedido #${context || 'N/A'}`
        );

        res.json({
            success: true,
            transaction_id: referenciaPagamento, // Usar o referencia_pagamento como transaction_id
            status: response.status || "approved",
            message: response.message || "Pagamento processado",
            paid_amount: amount,
            customer_phone: phone
        });

    } catch (error) {
        console.error('❌ Erro no checkout:', error);
        res.status(500).json({
            success: false,
            status: "cancelled",
            message: error.response?.data?.error || error.message
        });
    }
});

// POST - Enviar venda para UTMify (chamado do frontend)
// Sempre tenta enviar - sem restrições de envio duplicado
router.post('/pagamento/venda/:vendaId/utmify', async (req, res) => {
    try {
        const { vendaId } = req.params;
        const { produtoId, trackingParams = {} } = req.body;
        
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🚀 UTMIFY: Recebendo requisição do frontend');
        console.log('📦 Venda ID:', vendaId);
        console.log('📦 Produto ID:', produtoId);
        console.log('═══════════════════════════════════════════════════════════');
        
        // Buscar venda (suporta UUID e public_id)
        let venda;
        if (/^\d+$/.test(vendaId)) {
            // É um número, buscar pelo public_id
            console.log(`🔍 UTMIFY: Buscando venda pelo public_id: ${vendaId}`);
            venda = await Venda.findOne({ where: { public_id: vendaId } });
        } else {
            // É um UUID, buscar pelo id
            console.log(`🔍 UTMIFY: Buscando venda pelo id (UUID): ${vendaId}`);
            venda = await Venda.findByPk(vendaId);
        }
        
        if (!venda) {
            console.error(`❌ UTMIFY: Venda não encontrada: ${vendaId}`);
            return res.status(404).json({
                success: false,
                error: 'Venda não encontrada',
                vendaId: vendaId
            });
        }
        
        console.log(`✅ UTMIFY: Venda encontrada - ID: ${venda.id}, Status: ${venda.status}`);
        
        // Verificar se já foi enviado - se sim, não tentar novamente
        const trackingData = venda.tracking_data || {};
        if (trackingData.utmfy_enviado === true) {
            const dataEnvio = trackingData.utmfy_enviado_em ? new Date(trackingData.utmfy_enviado_em) : null;
            console.log('✅ UTMIFY: Venda já foi enviada anteriormente.');
            if (dataEnvio) {
                console.log(`📅 Data do envio: ${dataEnvio.toISOString()}`);
            }
            console.log('ℹ️ UTMIFY: Não tentando enviar novamente - já foi processado.');
            return res.json({
                success: true,
                skipped: true,
                message: 'Venda já foi enviada para UTMify anteriormente',
                alreadySent: true,
                dataEnvio: dataEnvio ? dataEnvio.toISOString() : null
            });
        }
        
        // Buscar produto com token UTMify
        const produtoIdFinal = produtoId || venda.produto_id;
        const produto = await Produto.findByPk(produtoIdFinal, {
            attributes: ['id', 'nome', 'utmfy_api_key', 'utmfy_active', 'utmfy_token_type']
        });
        
        if (!produto) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado'
            });
        }
        
        // Obter IP da requisição atual se não estiver disponível nos parâmetros
        const ipAtual = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || null;
        
        // Preparar dados do cliente
        const cliente = {
            nome: venda.cliente_nome,
            email: venda.cliente_email,
            telefone: venda.cliente_telefone,
            whatsapp: venda.cliente_whatsapp,
            ip: trackingParams.ip || venda.cliente_ip || ipAtual || '0.0.0.0',
            cpf: null,
            pais: 'MZ'
        };
        
        // Usar utilitário aprimorado para mesclar tracking_data da venda com parâmetros enviados
        const utmTracking = require('../utils/utmTracking');
        const trackingDataFromVenda = venda.tracking_data || {};
        
        // Capturar parâmetros UTM mesclando dados da venda com dados da requisição
        const utmParams = utmTracking.captureUTMParameters({
            reqBody: trackingParams,
            trackingData: trackingDataFromVenda,
            ip: trackingParams.ip || venda.cliente_ip || ipAtual || '0.0.0.0'
        });
        
        // Preparar parâmetros finais para UTMify
        const trackingParamsFinal = {
            utm_source: utmParams.utm_source,
            utm_medium: utmParams.utm_medium,
            utm_campaign: utmParams.utm_campaign,
            utm_content: utmParams.utm_content,
            utm_term: utmParams.utm_term,
            src: utmParams.src,
            sck: utmParams.sck,
            ip: utmParams.ip || '0.0.0.0'
        };
        
        // Log dos parâmetros mesclados
        utmTracking.logUTMParameters(utmParams, 'utmify-endpoint');
        
        console.log('📊 UTMIFY: Parâmetros de rastreamento:', {
            fromRequest: trackingParams,
            fromVenda: trackingDataFromVenda,
            final: trackingParamsFinal
        });
        
        // Enviar para UTMify usando o serviço
        const utmifyService = require('../services/utmifyService');
        
        // Calcular valor total (venda.valor é 90%, então dividir por 0.9)
        const valorTotal = parseFloat(venda.valor) / 0.9;
        const vendaComValorTotal = {
            ...venda.toJSON ? venda.toJSON() : venda,
            valor: valorTotal
        };
        
        // Verificar se o pagamento foi aprovado para definir status correto
        const isApproved = venda.status === 'Pago' || venda.status === 'Aprovada' || venda.status === 'Aprovado' || !!venda.data_pagamento;
        
        const resultadoUtmify = await utmifyService.enviarVenda(
            vendaComValorTotal,
            produto,
            cliente,
            trackingParamsFinal,
            { 
                isTest: false,
                isApproved: isApproved
            }
        );
        
        if (resultadoUtmify.success) {
            console.log('✅ UTMIFY: Venda enviada com SUCESSO via frontend!');
            
            // Marcar venda como enviada para evitar envios duplicados
            try {
                const utmTracking = require('../utils/utmTracking');
                const trackingDataAtualizado = utmTracking.mergeTrackingData(trackingData, {
                    utmfy_enviado: true,
                    utmfy_enviado_em: new Date().toISOString()
                });
                await venda.update({
                    tracking_data: trackingDataAtualizado
                });
                console.log('✅ UTMIFY: Venda marcada como enviada no banco de dados');
            } catch (updateError) {
                console.error('⚠️ UTMIFY: Erro ao marcar venda como enviada:', updateError.message);
                // Não falhar o processo por erro ao atualizar
            }
            
            return res.json({
                success: true,
                message: 'Venda enviada para UTMify com sucesso',
                data: resultadoUtmify.response
            });
        } else if (resultadoUtmify.skipped) {
            console.log(`⚠️ UTMIFY: Envio pulado - ${resultadoUtmify.reason}`);
            return res.json({
                success: false,
                skipped: true,
                reason: resultadoUtmify.reason
            });
        } else {
            console.error('❌ UTMIFY: Erro ao enviar venda:', resultadoUtmify.error);
            return res.status(500).json({
                success: false,
                error: resultadoUtmify.error || 'Erro ao enviar venda para UTMify'
            });
        }
        
    } catch (error) {
        console.error('═══════════════════════════════════════════════════════════');
        console.error('❌ UTMIFY: EXCEÇÃO ao processar requisição do frontend!');
        console.error('📦 Erro:', error.message);
        console.error('═══════════════════════════════════════════════════════════');
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno ao processar envio para UTMify'
        });
    }
});

// Exportar router como default e funções adicionais
router.enviarNotificacaoSaqueAfiliado = enviarNotificacaoSaqueAfiliado;
router.processarPagamentoAprovado = processarPagamentoAprovado;

module.exports = router;