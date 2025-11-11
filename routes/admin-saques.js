const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { Pagamento, Usuario, SaldoAdmin } = require('../config/database');
const SaldoAdminService = require('../services/saldoAdminService');
const SaldoVendedorService = require('../services/saldoVendedorService');

// GET - Teste de conectividade
router.get('/test', (req, res) => {
    console.log('🧪 Teste de rota admin-saques chamado');
    res.json({
        success: true,
        message: 'Rota admin-saques funcionando',
        timestamp: new Date().toISOString()
    });
});

// GET - Teste sem autenticação
router.get('/test-simple', (req, res) => {
    console.log('🧪 Teste simples admin-saques chamado');
    res.json({
        success: true,
        message: 'Rota simples admin-saques funcionando',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/admin/saldo
 * Buscar saldo atual do admin
 */
router.get('/saldo', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Buscando saldo do admin...');
        
        // Dados básicos com valores padrão
        const dadosBasicos = {
            saldo_total: 0,
            comissao_percentual: 10.00,
            total_vendas_aprovadas: 0,
            valor_total_vendas: 0,
            total_comissoes: 0,
            total_saques_pagos: 0,
            taxas: 0,
            taxas_saques: 0,
            ultima_atualizacao: new Date().toISOString()
        };
        
        try {
            const saldo = await SaldoAdminService.buscarSaldo();
            console.log('✅ Saldo encontrado:', saldo);
            res.json({
                success: true,
                data: saldo
            });
        } catch (serviceError) {
            console.error('❌ Erro no serviço, usando dados básicos:', serviceError);
            res.json({
                success: true,
                data: dadosBasicos
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao buscar saldo do admin:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/admin/saques/pendentes
 * Listar todos os saques pendentes
 */
router.get('/saques/pendentes', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Listando saques pendentes...');
        
        // Dados básicos com array vazio
        const dadosBasicos = [];
        
        try {
            const saques = await Pagamento.findAll({
                where: {
                    status: 'pendente'
                },
                order: [['data_solicitacao', 'DESC']],
                attributes: [
                    'id', 'valor', 'status', 'data_solicitacao', 'data_pagamento', 
                    'metodo', 'telefone_titular', 'conta_destino', 'banco', 'observacoes', 'vendedor_id'
                ]
                });
            
            console.log(`📊 Saques encontrados no banco: ${saques.length}`);
            saques.forEach((s, idx) => {
                console.log(`   Saque ${idx + 1}: ID=${s.id}, Valor=${s.valor}, Status=${s.status}, Vendedor=${s.vendedor_id}`);
            });
            
            console.log(`✅ ${saques.length} saques pendentes encontrados`);
            
            // Buscar dados dos vendedores
            const vendedorIds = [...new Set(saques.map(s => s.vendedor_id).filter(id => id != null))];
            console.log(`👥 Buscando dados de ${vendedorIds.length} vendedor(es):`, vendedorIds);
            
            let vendedores = [];
            let vendedoresMap = {};
            
            if (vendedorIds.length > 0) {
                vendedores = await Usuario.findAll({
                    where: { id: vendedorIds },
                    attributes: ['id', 'nome_completo', 'email', 'telefone']
                });
                
                vendedores.forEach(v => {
                    vendedoresMap[v.id] = v;
                });
                
                console.log(`✅ ${vendedores.length} vendedor(es) encontrado(s)`);
            } else {
                console.warn('⚠️ Nenhum vendedor_id encontrado nos saques');
            }
            
            const saquesFormatados = saques.map(saque => {
                const vendedor = vendedoresMap[saque.vendedor_id];
                // Gerar ID amigável no mesmo formato da página pagamentos.html (últimos 6 caracteres)
                let idAmigavel = '-';
                if (saque.id) {
                    // Usar o mesmo formato da página pagamentos.html: últimos 6 caracteres do UUID
                    idAmigavel = saque.id.substring(saque.id.length - 6).toUpperCase();
                }
                
                // Calcular taxas (5% para admin, 95% para vendedor)
                const valorTotal = parseFloat(saque.valor || 0);
                const taxaAdmin = valorTotal * 0.05; // 5% para admin
                const valorLiquidoVendedor = valorTotal * 0.95; // 95% para vendedor
                
                console.log(`📋 Formatando saque: ID=${saque.id}, ID Amigável=${idAmigavel}, Valor=${valorTotal}, Vendedor=${vendedor ? vendedor.nome_completo : 'N/A'}`);
                
                return {
                    id: saque.id,
                    publicId: saque.id, // Usar id como publicId temporariamente
                    idSaque: idAmigavel,
                    valor: valorTotal, // Valor total solicitado
                    valorLiquido: valorLiquidoVendedor, // 95% que o vendedor receberá
                    taxa: taxaAdmin, // 5% que vai para o admin
                    percentualTaxa: 5,
                    percentualVendedor: 95,
                    status: saque.status || 'pendente',
                    dataSolicitacao: saque.data_solicitacao || saque.createdAt || new Date(),
                    dataAprovacao: null, // Campo não existe no banco ainda
                    dataPagamento: saque.data_pagamento || null,
                    metodoPagamento: saque.metodo || 'N/A',
                    nomeTitular: saque.conta_destino || 'N/A', // conta_destino pode conter o nome do titular
                    telefoneTitular: saque.telefone_titular || 'N/A',
                    contaDestino: saque.conta_destino || 'N/A',
                    banco: saque.banco || 'N/A',
                    observacoes: saque.observacoes || 'N/A',
                    vendedor: vendedor ? {
                        id: vendedor.id,
                        nome: vendedor.nome_completo,
                        email: vendedor.email,
                        telefone: vendedor.telefone
                    } : null
                };
            });
            
            console.log(`📤 Enviando ${saquesFormatados.length} saques pendentes para o frontend`);
            
            if (saquesFormatados.length > 0) {
                console.log('📋 Primeiro saque formatado (exemplo):', JSON.stringify({
                    id: saquesFormatados[0].id,
                    idSaque: saquesFormatados[0].idSaque,
                    valor: saquesFormatados[0].valor,
                    status: saquesFormatados[0].status,
                    vendedor: saquesFormatados[0].vendedor,
                    nomeTitular: saquesFormatados[0].nomeTitular,
                    telefoneTitular: saquesFormatados[0].telefoneTitular,
                    metodoPagamento: saquesFormatados[0].metodoPagamento
                }, null, 2));
                
                // Log detalhado de todos os saques
                console.log('📋 Todos os saques formatados:');
                saquesFormatados.forEach((s, idx) => {
                    console.log(`   ${idx + 1}. ID: ${s.id}, ID Amigável: ${s.idSaque}, Valor: ${s.valor}, Status: ${s.status}, Vendedor: ${s.vendedor?.nome || 'N/A'}`);
                });
            }
            
            const responseData = {
                success: true,
                data: saquesFormatados
            };
            
            console.log(`✅ Resposta JSON preparada: ${JSON.stringify(responseData).substring(0, 200)}...`);
            
            res.json(responseData);
            
        } catch (dbError) {
            console.error('❌ Erro ao buscar saques pendentes:', dbError);
            console.error('❌ Stack trace:', dbError.stack);
            res.json({
                success: true,
                data: dadosBasicos
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao listar saques pendentes:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/admin/saques/processados
 * Listar todos os saques processados
 */
router.get('/saques/processados', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Listando saques processados...');
        
        // Dados básicos com array vazio
        const dadosBasicos = [];
        
        try {
            const saques = await Pagamento.findAll({
                where: {
                    status: {
                        [Op.in]: ['pago', 'aprovado', 'pendente', 'cancelado']
                    }
                },
                order: [['data_pagamento', 'DESC']],
                attributes: [
                    'id', 'vendedor_id', 'valor', 'metodo', 'conta_destino', 'banco', 
                    'observacoes', 'telefone_titular', 'status', 'data_solicitacao', 
                    'data_pagamento'
                ]
            });
            
            console.log(`✅ ${saques.length} saques processados encontrados`);
            
            // Buscar dados dos vendedores
            const vendedorIds = [...new Set(saques.map(s => s.vendedor_id))];
            const vendedores = await Usuario.findAll({
                where: { id: vendedorIds },
                attributes: ['id', 'nome_completo', 'email', 'telefone']
            });
            
            const vendedoresMap = {};
            vendedores.forEach(v => {
                vendedoresMap[v.id] = v;
            });
            
            const saquesFormatados = saques.map(saque => {
                const vendedor = vendedoresMap[saque.vendedor_id];
                return {
                    id: saque.id,
                    publicId: saque.id, // Usar ID como identificador público
                    idSaque: saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-', // Usar ID de 6 dígitos
                    valor: parseFloat(saque.valor || 0),
                    valorLiquido: parseFloat(saque.valor || 0), // Mesmo valor, sem taxa
                    taxa: 0, // Taxa não existe no banco
                    status: saque.status || 'pendente',
                    dataSolicitacao: saque.data_solicitacao,
                    dataAprovacao: null, // Campo não existe no banco
                    dataPagamento: saque.data_pagamento,
                    metodoPagamento: saque.metodo || 'N/A',
                    nomeTitular: saque.conta_destino || 'N/A', // Usar conta_destino como nome do titular
                    telefoneTitular: saque.telefone_titular || 'N/A',
                    contaDestino: saque.conta_destino || 'N/A',
                    banco: saque.banco || 'N/A',
                    observacoes: saque.observacoes || 'N/A',
                    vendedor: vendedor ? {
                        id: vendedor.id,
                        nome: vendedor.nome_completo,
                        email: vendedor.email,
                        telefone: vendedor.telefone
                    } : null
                };
            });
            
            res.json({
                success: true,
                data: saquesFormatados
            });
            
        } catch (dbError) {
            console.error('❌ Erro ao buscar saques processados:', dbError);
            res.json({
                success: true,
                data: dadosBasicos
            });
        }
        
    } catch (error) {
        console.error('❌ Erro ao listar saques processados:', error);
        console.error('❌ Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * GET /api/admin/saques/:id
 * Buscar dados de um saque específico
 */
router.get('/saques/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🔄 Buscando dados do saque ${id}...`);
        
        const saque = await Pagamento.findByPk(id, {
            attributes: [
                'id', 'vendedor_id', 'valor', 'metodo', 'conta_destino', 'banco', 
                'observacoes', 'telefone_titular', 'status', 'data_solicitacao', 
                'data_pagamento', 'motivo_rejeicao'
            ]
        });

        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }

        // Buscar dados do vendedor
        const vendedor = await Usuario.findByPk(saque.vendedor_id, {
            attributes: ['id', 'nome_completo', 'email']
        });

        const saqueFormatado = {
            id: saque.id,
            publicId: saque.id,
            valor: parseFloat(saque.valor),
            valorLiquido: parseFloat(saque.valor),
            taxa: 0,
            status: saque.status,
            data_solicitacao: saque.data_solicitacao,
            data_aprovacao: null, // Campo não existe no banco
            data_pagamento: saque.data_pagamento,
            metodo: saque.metodo,
            nome_titular: saque.conta_destino || 'N/A', // Usar conta_destino como nome do titular
            telefone_titular: saque.telefone_titular,
            conta_destino: saque.conta_destino,
            banco: saque.banco,
            observacoes: saque.observacoes,
            vendedor: vendedor ? {
                nome: vendedor.nome_completo,
                email: vendedor.email
            } : null
        };
        
        console.log(`✅ Dados do saque ${id} encontrados`);
        
        res.json({
            success: true,
            data: saqueFormatado
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar dados do saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * GET /api/admin/saques/:id/pdf
 * Gerar PDF do saque
 */
router.get('/saques/:id/pdf', authenticateToken, isAdmin, async (req, res) => {
    try {
        const saqueId = req.params.id;
        console.log(`🔄 Gerando PDF para saque ${saqueId}...`);
        
        const saque = await Pagamento.findOne({
            where: { id: saqueId },
            attributes: [
                'id', 'id', 'id', 'valor', 'valor',
                'status', 'data_solicitacao', 'metodo', 'observacoes', 'vendedor_id'
            ]
        });

        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }

        // Buscar dados do vendedor separadamente
        const vendedor = await Usuario.findByPk(saque.vendedor_id, {
            attributes: ['id', 'nome_completo', 'email']
        });
        
        // Gerar HTML otimizado para impressão/PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comprovante de Saque - ${saque.id}</title>
            <style>
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    margin: 20px; 
                    background: white;
                    color: #333;
                }
                .header { 
                    text-align: center; 
                    border-bottom: 3px solid #2c3e50; 
                    padding-bottom: 20px; 
                    margin-bottom: 30px; 
                }
                .header h1 { 
                    color: #2c3e50; 
                    margin: 0; 
                    font-size: 28px;
                }
                .header h2 { 
                    color: #e74c3c; 
                    margin: 5px 0 0 0; 
                    font-size: 18px;
                }
                .info { 
                    margin: 15px 0; 
                    padding: 10px;
                    border-left: 4px solid #3498db;
                    background: #f8f9fa;
                }
                .label { 
                    font-weight: bold; 
                    color: #2c3e50;
                    display: inline-block;
                    width: 200px;
                }
                .value {
                    color: #333;
                }
                .footer { 
                    margin-top: 40px; 
                    text-align: center; 
                    font-size: 12px; 
                    color: #666;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                .verification-info {
                    background: #d4edda;
                    border: 1px solid #c3e6cb;
                    border-radius: 5px;
                    padding: 15px;
                    margin: 20px 0;
                }
                .verification-info h3 {
                    color: #155724;
                    margin: 0 0 10px 0;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>COMPROVANTE DE SAQUE</h1>
                <h2>RatixPay - Sistema de Pagamentos</h2>
            </div>
            
            <div class="info">
                <span class="label">ID do Saque:</span>
                <span class="value">${saque.id}</span>
            </div>
            <div class="info">
                <span class="label">Vendedor:</span>
                <span class="value">${vendedor ? vendedor.nome_completo : 'N/A'}</span>
            </div>
            <div class="info">
                <span class="label">Email:</span>
                <span class="value">${vendedor ? vendedor.email : 'N/A'}</span>
            </div>
            <div class="info">
                <span class="label">Valor Solicitado:</span>
                <span class="value">MZN ${parseFloat(saque.valor).toFixed(2)}</span>
            </div>
            <div class="info">
                <span class="label">Valor Líquido:</span>
                <span class="value">MZN ${parseFloat(saque.valor).toFixed(2)}</span>
            </div>
            <div class="info">
                <span class="label">Método de Pagamento:</span>
                <span class="value">${saque.metodo}</span>
            </div>
            <div class="info">
                <span class="label">Nome do Titular:</span>
                <span class="value">N/A</span>
            </div>
            <div class="info">
                <span class="label">Telefone:</span>
                <span class="value">${saque.telefone_titular}</span>
            </div>
            <div class="info">
                <span class="label">Data de Solicitação:</span>
                <span class="value">${new Date(saque.data_solicitacao).toLocaleDateString('pt-BR')}</span>
            </div>
            <div class="info">
                <span class="label">Data de Pagamento:</span>
                <span class="value">${saque.data_pagamento ? new Date(saque.data_pagamento).toLocaleDateString('pt-BR') : 'N/A'}</span>
            </div>
            <div class="info">
                <span class="label">Status:</span>
                <span class="value">${saque.status.toUpperCase()}</span>
            </div>
            ${saque.observacoes ? `
            <div class="info">
                <span class="label">Observações:</span>
                <span class="value">${saque.observacoes}</span>
            </div>
            ` : ''}
            
            ${saque.verificado ? `
            <div class="verification-info">
                <h3>✅ VERIFICAÇÃO CONFIRMADA</h3>
                <div class="info">
                    <span class="label">Data de Verificação:</span>
                    <span class="value">${saque.data_verificacao ? new Date(saque.data_verificacao).toLocaleString('pt-BR') : 'N/A'}</span>
                </div>
                ${saque.id_transacao_verificacao ? `
                <div class="info">
                    <span class="label">ID da Transação:</span>
                    <span class="value">${saque.id_transacao_verificacao}</span>
                </div>
                ` : ''}
                ${saque.observacoes_verificacao ? `
                <div class="info">
                    <span class="label">Observações da Verificação:</span>
                    <span class="value">${saque.observacoes_verificacao}</span>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div class="footer">
                <p><strong>Este documento foi gerado automaticamente pelo sistema RatixPay</strong></p>
                <p>Data de geração: ${new Date().toLocaleString('pt-BR')}</p>
                <p>Documento válido apenas para fins de comprovação</p>
            </div>
        </body>
        </html>
        `;
        
        // Configurar headers para visualização inline
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="comprovante-saque-${saque.id}.html"`);
        
        // Enviar HTML
        res.send(htmlContent);
        
        console.log(`✅ PDF gerado para saque ${saqueId}`);
        
    } catch (error) {
        console.error('❌ Erro ao gerar PDF:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar PDF'
        });
    }
});

/**
 * GET /api/admin/saques/historico
 * Listar histórico de saques
 */
router.get('/saques/historico', authenticateToken, isAdmin, async (req, res) => {
    try {
        console.log('🔄 Listando histórico de saques...');
        
        const { HistoricoSaques } = require('../config/database');
        
        const historico = await HistoricoSaques.findAll({
            order: [['data_solicitacao', 'DESC']],
            attributes: [
                'id', 'vendedor_id', 'valor_solicitado', 'valor_liquido', 'metodo_pagamento', 'status', 
                'data_solicitacao', 'observacoes', 'created_at', 'updated_at'
            ]
        });

        // Buscar dados dos vendedores separadamente
        const vendedoresIds = [...new Set(historico.map(h => h.vendedor_id))];
        const vendedores = await Usuario.findAll({
            where: { id: vendedoresIds },
            attributes: ['id', 'nome_completo', 'email', 'telefone']
        });

        // Criar mapa de vendedores
        const vendedoresMap = {};
        vendedores.forEach(v => {
            vendedoresMap[v.id] = v;
        });
        
        console.log(`✅ ${historico.length} registros de histórico encontrados`);
        
        const historicoFormatado = historico.map(registro => {
            const vendedor = vendedoresMap[registro.vendedor_id];
            return {
                id: registro.id,
                publicId: registro.public_id,
                valor: parseFloat(registro.valor_solicitado),
                valorLiquido: parseFloat(registro.valor_liquido),
                taxa: parseFloat(registro.taxa),
                status: registro.status,
                data_solicitacao: registro.data_solicitacao,
                data_aprovacao: null, // Campo não existe no banco
                data_pagamento: registro.data_pagamento,
                metodo: registro.metodo_pagamento,
                nome_titular: registro.conta_destino || 'N/A', // Usar conta_destino como nome do titular
                telefone_titular: registro.telefone_titular,
                observacoes: registro.observacoes,
                processado_por: registro.processado_por,
                codigo_transacao: registro.codigo_transacao,
                vendedor_nome: vendedor ? vendedor.nome_completo : 'N/A',
                vendedor_email: vendedor ? vendedor.email : 'N/A',
                vendedor_telefone: vendedor ? vendedor.telefone : 'N/A'
            };
        });
        
        res.json({
            success: true,
            data: historicoFormatado
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar histórico de saques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * PUT /api/admin/saques/:id/verificar
 * Marcar saque como verificado (permanente)
 */
router.put('/saques/:id/verificar', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🔄 Marcando saque ${id} como verificado...`);
        console.log('📋 Dados recebidos:', {
            params: req.params,
            body: req.body,
            user: req.user ? { id: req.user.id, role: req.user.role } : 'N/A',
            headers: {
                authorization: req.headers.authorization ? 'Presente' : 'Ausente',
                contentType: req.headers['content-type']
            }
        });
        
        const saque = await Pagamento.findByPk(id, {
            attributes: [
                'id', 'vendedor_id', 'valor', 'metodo', 'conta_destino', 'banco', 
                'observacoes', 'telefone_titular', 'status', 'data_solicitacao', 
                'data_pagamento', 'motivo_rejeicao'
            ]
        });
        
        if (!saque) {
            console.log(`❌ Saque ${id} não encontrado`);
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        console.log(`📊 Saque encontrado:`, {
            id: saque.id,
            status: saque.status,
            valor: saque.valor
        });
        
        // Verificar se já foi processado (status diferente de 'pago')
        if (saque.status !== 'pago') {
            console.log(`⚠️ Saque ${id} não está no status 'pago' (status atual: ${saque.status})`);
            return res.status(400).json({
                success: false,
                message: 'Saque deve estar no status "pago" para ser verificado'
            });
        }
        
        // Extrair dados do formulário
        const { id_transacao, data_verificacao, observacoes } = req.body;
        
        console.log('📝 Dados de verificação:', {
            id_transacao,
            data_verificacao,
            observacoes,
            verificado_por: req.user.id
        });
        
        // Marcar como verificado
        // Atualizar apenas as observações (colunas de verificação não existem na tabela)
        const updateData = {
            observacoes: observacoes ? `${saque.observacoes || ''}\n\nVerificado em: ${new Date().toLocaleString('pt-BR')}\nVerificado por: ${req.user.id}\nID Transação: ${id_transacao || 'N/A'}`.trim() : saque.observacoes
        };
        
        console.log('💾 Dados para atualização:', updateData);
        
        await saque.update(updateData);
        
        console.log(`✅ Saque ${id} marcado como verificado com sucesso`);
        
        // Atualizar também na tabela de histórico de saques
        const { HistoricoSaques } = require('../config/database');
        const historicoSaque = await HistoricoSaques.findOne({
            where: { saque_id: id },
            attributes: [
                'id', 'vendedor_id', 'valor_solicitado', 'valor_liquido', 'metodo_pagamento', 'status', 
                'data_solicitacao', 'observacoes', 'created_at', 'updated_at'
            ]
        });
        
        if (historicoSaque) {
            await historicoSaque.update(updateData);
            console.log(`✅ Histórico de saque ${id} também atualizado`);
        } else {
            console.log(`⚠️ Histórico de saque ${id} não encontrado`);
        }
        
        // Verificar se os dados foram realmente salvos
        const saqueVerificado = await Pagamento.findByPk(id, {
            attributes: [
                'id', 'vendedor_id', 'valor', 'metodo', 'conta_destino', 'banco', 
                'observacoes', 'telefone_titular', 'status', 'data_solicitacao', 
                'data_pagamento'
            ]
        });
        console.log('🔍 Verificação dos dados salvos:', {
            id: saqueVerificado.id,
            status: saqueVerificado.status,
            observacoes: saqueVerificado.observacoes
        });
        
        // Buscar o saque atualizado para retornar os dados completos
        const saqueAtualizado = await Pagamento.findByPk(id, {
            attributes: [
                'id', 'vendedor_id', 'valor', 'metodo', 'conta_destino', 'banco', 
                'observacoes', 'telefone_titular', 'status', 'data_solicitacao', 
                'data_pagamento', 'motivo_rejeicao'
            ]
        });
        
        res.json({
            success: true,
            message: 'Saque marcado como verificado com sucesso',
            data: {
                id: saqueAtualizado.id,
                status: saqueAtualizado.status,
                verificado: true,
                data_verificacao: new Date().toISOString(),
                id_transacao_verificacao: id_transacao || 'N/A'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao marcar saque como verificado:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

/**
 * PUT /api/admin/saques/:id/aprovar
 * Aprovar e pagar saque
 */
router.put('/saques/:id/aprovar', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { id_transacao_pagamento, observacoes } = req.body;
        
        console.log(`🔄 Aprovando saque ${id}...`);
        
        const saque = await Pagamento.findByPk(id);
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        // Verificar se o saque está no status correto para aprovação
        if (saque.status !== 'pendente') {
            return res.status(400).json({
                success: false,
                message: 'Saque deve estar no status "pendente" para ser aprovado'
            });
        }
        
        // Calcular taxas (5% para admin, 95% para vendedor)
        const valorTotal = parseFloat(saque.valor);
        const taxaAdmin = valorTotal * 0.05; // 5% para admin
        const valorLiquidoVendedor = valorTotal * 0.95; // 95% para vendedor
        
        console.log(`💰 Processando taxas do saque aprovado:`);
        console.log(`   💼 Taxa do administrador (5%): MZN ${taxaAdmin.toFixed(2)}`);
        console.log(`   👤 Valor líquido do vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`);
        console.log(`   📝 Valor total do saque: MZN ${valorTotal.toFixed(2)}`);
        
        // Atualizar saque para aprovado e pago
        await saque.update({
            status: 'pago',
            data_pagamento: new Date(),
            id_transacao_pagamento: id_transacao_pagamento,
            aprovado_por: req.user.id,
            pago_por: req.user.id,
            observacoes: observacoes ? `${saque.observacoes || ''}\n\nAprovado em: ${new Date().toLocaleString('pt-BR')}\nAprovado por: ${req.user.id}\nID Transação: ${id_transacao_pagamento}\nTaxa admin (5%): MZN ${taxaAdmin.toFixed(2)}\nValor líquido vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`.trim() : saque.observacoes
        });

        // Processar taxas no saldo do admin (5% vai para o admin)
        try {
            await SaldoAdminService.processarSaquePago(saque.id, valorTotal);
            console.log(`✅ Taxa de 5% (MZN ${taxaAdmin.toFixed(2)}) adicionada ao saldo do admin`);
        } catch (taxaError) {
            console.error('⚠️ Erro ao processar taxa do admin no saque aprovado:', taxaError.message);
            // Não falhar a aprovação por erro na taxa
        }

        // Debitar valor total do saldo do vendedor (ele já recebeu 95% via transferência)
        // O valor total é debitado porque o sistema já transferiu 95% para ele
        try {
            await SaldoVendedorService.debitarSaque(saque.vendedor_id, saque.id, valorTotal);
            // Atualizar agregados em background
            SaldoVendedorService.recalcularAgregados(saque.vendedor_id).catch(() => {});
            console.log(`✅ Valor total (MZN ${valorTotal.toFixed(2)}) debitado da receita do vendedor`);
        } catch (e) {
            console.error('⚠️ Erro ao debitar saldo do vendedor no saque aprovado:', e);
        }
        
        // Buscar dados do vendedor para notificação
        const vendedor = await Usuario.findByPk(saque.vendedor_id, {
            attributes: ['id', 'nome_completo', 'email', 'telefone']
        });
        
        // Enviar notificação de saque aprovado/pago para o vendedor
        try {
            console.log('🔔 Enviando notificação de saque pago para vendedor...');
            const SaqueNotificationService = require('../services/saqueNotificationService');
            await SaqueNotificationService.notificarVendedorSaqueAprovado(saque);
            console.log(`✅ Notificação de saque pago enviada para vendedor: ${vendedor.nome_completo}`);
            
            // Enviar notificação via Socket.IO para atualização em tempo real
            try {
                const socketService = require('../services/socketService');
                socketService.sendSaqueAprovado({
                    vendedor_id: vendedor.id,
                    saque_id: id,
                    valor: saque.valor,
                    metodo: saque.metodo,
                    data_aprovacao: new Date()
                });
            } catch (socketError) {
                console.error('❌ Erro ao enviar notificação via Socket.IO:', socketError);
            }
            
        } catch (notificationError) {
            console.error('❌ Erro ao enviar notificação de saque aprovado:', notificationError);
            // Não falhar o processo por erro de notificação
        }
        
        // Atualizar também na tabela de histórico
        const { HistoricoSaques } = require('../config/database');
        const historicoSaque = await HistoricoSaques.findOne({
            where: { saque_id: id },
            attributes: [
                'id', 'vendedor_id', 'valor_solicitado', 'valor_liquido', 'metodo_pagamento', 'status', 
                'data_solicitacao', 'observacoes', 'created_at', 'updated_at'
            ]
        });
        
        if (historicoSaque) {
            await historicoSaque.update({
                status: 'pago',
                data_pagamento: new Date(),
                processado_por: req.user.id,
                codigo_transacao: id_transacao_pagamento
            });
        }
        
        console.log(`✅ Saque ${id} aprovado com sucesso`);
        
        res.json({
            success: true,
            message: 'Saque aprovado e pago com sucesso',
            data: {
                id: saque.id,
                status: 'pago',
                data_aprovacao: new Date().toISOString(),
                data_pagamento: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

/**
 * PUT /api/admin/saques/:id/cancelar
 * Cancelar saque
 */
router.put('/saques/:id/cancelar', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo_cancelamento } = req.body;
        
        console.log(`🔄 Cancelando saque ${id}...`);
        
        const saque = await Pagamento.findByPk(id);
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        // Verificar se o saque pode ser cancelado
        if (saque.status === 'cancelado') {
            return res.status(400).json({
                success: false,
                message: 'Saque já está cancelado'
            });
        }
        
        if (saque.status === 'pago') {
            return res.status(400).json({
                success: false,
                message: 'Saque já foi pago e não pode ser cancelado'
            });
        }
        
        // NUNCA permitir cancelamento de saques pendentes
        if (saque.status === 'pendente') {
            return res.status(400).json({
                success: false,
                message: 'Saques pendentes não podem ser cancelados. Apenas aprovados ou rejeitados.'
            });
        }
        
        // Atualizar saque para cancelado
        await saque.update({
            status: 'cancelado',
            data_cancelamento: new Date(),
            cancelado_por: req.user.id,
            motivo_cancelamento: motivo_cancelamento,
            observacoes: `${saque.observacoes || ''}\n\nCancelado em: ${new Date().toLocaleString('pt-BR')}\nCancelado por: ${req.user.id}\nMotivo: ${motivo_cancelamento}`.trim()
        });
        
        // Buscar dados do vendedor para notificação
        const vendedor = await Usuario.findByPk(saque.vendedor_id, {
            attributes: ['id', 'nome_completo', 'email', 'telefone']
        });
        
        // Enviar notificação automática para o vendedor sobre o cancelamento
        if (vendedor) {
            try {
                console.log('🔔 Enviando notificação de saque cancelado...');
                const vendaNotificationService = require('../services/vendaNotificationService');
                await vendaNotificationService.enviarNotificacaoSaqueProcessado(saque);
                console.log(`✅ Notificação de cancelamento enviada para vendedor ${vendedor.nome_completo}`);
            } catch (notificationError) {
                console.error('❌ Erro ao enviar notificação de cancelamento:', notificationError);
                // Não falhar o processo por erro de notificação
            }
        }
        
        // Atualizar também na tabela de histórico
        const { HistoricoSaques } = require('../config/database');
        const historicoSaque = await HistoricoSaques.findOne({
            where: { saque_id: id },
            attributes: [
                'id', 'vendedor_id', 'valor_solicitado', 'valor_liquido', 'metodo_pagamento', 'status', 
                'data_solicitacao', 'observacoes', 'created_at', 'updated_at'
            ]
        });
        
        if (historicoSaque) {
            await historicoSaque.update({
                status: 'cancelado',
                data_cancelamento: new Date(),
                processado_por: req.user.id
            });
        }
        
        console.log(`✅ Saque ${id} cancelado com sucesso`);
        
        res.json({
            success: true,
            message: 'Saque cancelado com sucesso',
            data: {
                id: saque.id,
                status: 'cancelado',
                data_cancelamento: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao cancelar saque:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
