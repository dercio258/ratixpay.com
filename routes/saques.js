const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { Pagamento, Usuario, HistoricoSaques } = require('../config/database');
const ReceitaService = require('../services/receitaService'); // Novo serviço unificado

// POST - Solicitar saque (usando ReceitaService)
router.post('/solicitar', authenticateToken, async (req, res) => {
    try {
        const { valor, metodoPagamento, contaDestino, banco, observacoes, telefoneTitular } = req.body;
        const vendedorId = req.user.id;
        
        console.log(`🔄 Processando solicitação de saque para vendedor ${vendedorId}...`);
        console.log(`📋 Dados recebidos:`, { valor, metodoPagamento, contaDestino, banco, observacoes, telefoneTitular });
        console.log(`🔍 Tipo dos dados:`, {
            valor: typeof valor,
            metodoPagamento: typeof metodoPagamento,
            contaDestino: typeof contaDestino,
            banco: typeof banco,
            observacoes: typeof observacoes,
            telefoneTitular: typeof telefoneTitular
        });
        
        // Validar dados
        if (!valor || valor <= 0) {
            console.log(`❌ Validação falhou: valor inválido - ${valor}`);
            return res.status(400).json({
                success: false,
                message: 'Valor do saque deve ser maior que zero'
            });
        }
        
        if (!contaDestino) {
            console.log(`❌ Validação falhou: contaDestino ausente`);
            return res.status(400).json({
                success: false,
                message: 'Conta de destino é obrigatória'
            });
        }
        
        if (!metodoPagamento) {
            console.log(`❌ Validação falhou: metodoPagamento ausente`);
            return res.status(400).json({
                success: false,
                message: 'Método de pagamento é obrigatório'
            });
        }
        
        if (!['Mpesa', 'Emola'].includes(metodoPagamento)) {
            console.log(`❌ Validação falhou: metodoPagamento inválido - ${metodoPagamento}`);
            return res.status(400).json({
                success: false,
                message: `Método de pagamento deve ser Mpesa ou Emola. Recebido: ${metodoPagamento}`
            });
        }
        
        console.log(`✅ Validações passaram com sucesso`);
        
        // Dados para o serviço
        const dadosSaque = {
            metodoPagamento: metodoPagamento,
            contaDestino: contaDestino,
            banco: banco,
            observacoes: observacoes,
            telefoneTitular: telefoneTitular,
            ipSolicitacao: req.ip,
            userAgent: req.get('User-Agent')
        };
        
        console.log(`📤 Dados do saque preparados:`, dadosSaque);
        
        // Processar saque usando ReceitaService
        const resultado = await ReceitaService.processarSolicitacaoSaque(
            vendedorId, 
            parseFloat(valor), 
            dadosSaque
        );
        
        console.log(`✅ Saque solicitado com sucesso: ID ${resultado.saqueId}`);
        console.log(`📊 Resultado completo:`, resultado);
        
        // Enviar notificação automática para o admin sobre nova solicitação
        try {
            console.log('🔔 Enviando notificação de pedido de saque para admin...');
            const vendaNotificationService = require('../services/vendaNotificationService');
            await vendaNotificationService.enviarNotificacaoPedidoSaqueAdmin(resultado.saque);
            console.log(`✅ Notificação de solicitação de saque enviada para admin`);
        } catch (notificationError) {
            console.error('❌ Erro ao enviar notificação de saque:', notificationError);
            // Não falhar o saque por erro de notificação
        }
        
        res.json({
            success: true,
            message: 'Saque solicitado com sucesso',
            data: {
                saqueId: resultado.saqueId,
                publicId: resultado.publicId,
                idSaque: resultado.idSaque,
                receitaAtualizada: resultado.receitaAtualizada
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao solicitar saque:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro interno do servidor'
        });
    }
});

// POST - Atualizar receita após solicitação de saque (usando ReceitaService)
router.post('/atualizar-receita', authenticateToken, async (req, res) => {
    try {
        console.log(`🔄 Atualizando receita do vendedor ${req.user.id}...`);
        
        // Usar ReceitaService para garantir sincronização
        const receitaAtualizada = await ReceitaService.buscarReceitaTotal(req.user.id);
        
        res.json({
            success: true,
            data: {
                receitaTotal: parseFloat(receitaAtualizada.receitaTotal),
                receitaDisponivel: parseFloat(receitaAtualizada.receitaDisponivel),
                valorSaquesPendentes: parseFloat(receitaAtualizada.valorSaquesPendentes),
                ultimaAtualizacao: receitaAtualizada.ultimaAtualizacao
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar receita:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            error: error.message
        });
    }
});

// GET - Saque pendente do vendedor (DEVE VIR ANTES DE /vendedor)
router.get('/vendedor/pendente', authenticateToken, async (req, res) => {
    try {
        const vendedorId = req.user.id;
        console.log(`🔄 Buscando saque pendente do vendedor ${vendedorId}...`);
        
        // Buscar saque pendente do vendedor
        const saquePendente = await Pagamento.findOne({
            where: { 
                vendedor_id: vendedorId,
                status: 'pendente'
            },
            order: [['createdAt', 'DESC']]
        });
        
        if (!saquePendente) {
            return res.json({
                success: true,
                data: null,
                message: 'Nenhum saque pendente encontrado'
            });
        }
        
        // Formatar dados do saque usando apenas campos existentes
        const saqueFormatado = {
            id: saquePendente.id,
            publicId: saquePendente.id, // Usar id como publicId temporariamente
            idSaque: saquePendente.id,
            valor: parseFloat(saquePendente.valor || 0),
            valorLiquido: parseFloat(saquePendente.valor || 0), // Usar valor como valorLiquido
            taxa: 0, // Taxa não existe no banco, usar 0
            metodoPagamento: saquePendente.metodo || 'N/A',
            nomeTitular: saquePendente.telefone_titular || 'N/A', // Usar telefone como nome temporariamente
            telefoneTitular: saquePendente.telefone_titular || 'N/A',
            contaDestino: saquePendente.conta_destino || 'N/A',
            banco: saquePendente.banco || 'N/A',
            observacoes: saquePendente.observacoes || 'N/A',
            status: saquePendente.status || 'pendente',
            dataSolicitacao: saquePendente.data_solicitacao || saquePendente.createdAt,
            dataAprovacao: saquePendente.data_processamento || null,
            dataPagamento: saquePendente.data_pagamento || null,
            dataAtualizacao: saquePendente.updatedAt
        };
        
        console.log(`✅ Saque pendente encontrado: ${saquePendente.id}`);
        
        res.json({
            success: true,
            data: saqueFormatado
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar saque pendente:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Listar saques do vendedor (usando histórico)
router.get('/vendedor', authenticateToken, async (req, res) => {
    try {
        const vendedorId = req.user.id;
        console.log(`🔄 Listando saques do vendedor ${vendedorId}...`);
        
        // Buscar saques do vendedor com todos os campos necessários
        const saques = await Pagamento.findAll({
            where: { vendedor_id: vendedorId },
            order: [['data_solicitacao', 'DESC']],
            attributes: [
                'id', 'valor',
                'status', 'data_solicitacao', 'data_processamento', 'data_pagamento', 
                'metodo', 'telefone_titular',
                'conta_destino', 'banco', 'observacoes', 'motivo_rejeicao'
            ]
        });
        
        console.log(`🔍 Saques encontrados no banco:`, saques.length);
        saques.forEach(saque => {
            console.log(`  - ID: ${saque.id}, Status: ${saque.status}, Valor: ${saque.valor}, Data: ${saque.data_solicitacao}`);
        });
        
        // Formatar dados dos saques
        const saquesFormatados = saques.map(saque => ({
            id: saque.id,
            publicId: saque.id, // Usar id como publicId temporariamente
            idSaque: saque.id,
            valor: parseFloat(saque.valor),
            valorLiquido: parseFloat(saque.valor), // Usar valor como valorLiquido
            taxa: 0, // Taxa não existe no banco, usar 0
            status: saque.status,
            dataSolicitacao: saque.data_solicitacao,
            dataAprovacao: saque.data_processamento, // Usar data_processamento como dataAprovacao
            dataPagamento: saque.data_pagamento,
            metodoPagamento: saque.metodo,
            nomeTitular: saque.telefone_titular || 'N/A', // Usar telefone como nome temporariamente
            telefoneTitular: saque.telefone_titular,
            contaDestino: saque.conta_destino,
            banco: saque.banco,
            observacoes: saque.observacoes,
            motivoRejeicao: saque.motivo_rejeicao
        }));
        
        console.log(`✅ ${saquesFormatados.length} saques formatados para vendedor ${vendedorId}`);
        
        res.json({
            success: true,
            data: saquesFormatados
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar saques:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Calcular receita total do vendedor (usando ReceitaService)
router.get('/vendedor/receita', authenticateToken, async (req, res) => {
    try {
        const vendedorId = req.user.id;
        console.log(`🔄 Calculando receita total do vendedor ${vendedorId}...`);
        
        // Usar ReceitaService para garantir sincronização
        const receitaAtualizada = await ReceitaService.buscarReceitaTotal(vendedorId);
        
        res.json({
            success: true,
            data: {
                receitaTotal: parseFloat(receitaAtualizada.receitaTotal),
                receitaDisponivel: parseFloat(receitaAtualizada.receitaDisponivel),
                valorSaquesPendentes: parseFloat(receitaAtualizada.valorSaquesPendentes),
                totalVendas: parseInt(receitaAtualizada.totalVendas),
                ultimaAtualizacao: receitaAtualizada.ultimaAtualizacao
            }
        });

    } catch (error) {
        console.error('❌ Erro ao calcular receita do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// GET - Status atual do vendedor (alias para /receita)
router.get('/vendedor/status-atual', authenticateToken, async (req, res) => {
    try {
        const vendedorId = req.user.id;
        console.log(`🔄 Obtendo status atual do vendedor ${vendedorId}...`);
        
        // Usar ReceitaService para garantir sincronização
        const receitaAtualizada = await ReceitaService.buscarReceitaTotal(vendedorId);
        
        res.json({
            success: true,
            data: {
                receitaTotal: parseFloat(receitaAtualizada.receitaTotal),
                receitaDisponivel: parseFloat(receitaAtualizada.receitaDisponivel),
                valorSaquesPendentes: parseFloat(receitaAtualizada.valorSaquesPendentes),
                totalVendas: parseInt(receitaAtualizada.totalVendas),
                ultimaAtualizacao: receitaAtualizada.ultimaAtualizacao
            }
        });

    } catch (error) {
        console.error('❌ Erro ao obter status atual do vendedor:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST - Cancelar saque (REMOVIDO - saques pendentes não podem ser cancelados)
// Saques pendentes só podem ser aprovados ou rejeitados pelo admin

// GET - Histórico de alterações de saques
router.get('/historico/:saqueId', authenticateToken, async (req, res) => {
    try {
        const { saqueId } = req.params;
        const vendedorId = req.user.id;
        
        console.log(`🔄 Buscando histórico do saque ${saqueId}...`);
        
        // Verificar se o saque pertence ao vendedor
        const saque = await Pagamento.findOne({
            where: { 
                id: saqueId,
                vendedor_id: vendedorId
            }
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado'
            });
        }
        
        // Buscar histórico
        const historico = await HistoricoSaques.findAll({
            where: { saque_id: saqueId },
            order: [['data_alteracao', 'DESC']],
            attributes: [
                'status_anterior', 'status_novo', 'acao_admin',
                'admin_id', 'observacoes', 'data_alteracao'
            ]
        });
        
        console.log(`✅ Histórico do saque ${saqueId} carregado: ${historico.length} registros`);
        
        res.json({
            success: true,
            data: historico
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

// POST - Confirmar recebimento de pagamento (vendedor)
router.post('/confirmar-pagamento/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const vendedorId = req.user.id;
        
        console.log(`🔄 Confirmando recebimento do saque ${id} pelo vendedor ${vendedorId}...`);
        
        // Buscar saque
        const saque = await Pagamento.findOne({
            where: { 
                id: id,
                vendedor_id: vendedorId,
                status: 'pago' // Só pode confirmar se estiver pago
            }
        });
        
        if (!saque) {
            return res.status(404).json({
                success: false,
                message: 'Saque não encontrado ou não pode ser confirmado'
            });
        }
        
        // Verificar se já foi confirmado
        if (saque.confirmado_vendedor) {
            return res.status(400).json({
                success: false,
                message: 'Pagamento já foi confirmado'
            });
        }
        
        // Confirmar recebimento
        await saque.update({
            confirmado_vendedor: true,
            data_confirmacao_vendedor: new Date(),
            observacoes: `${saque.observacoes || ''}\n\nConfirmado pelo vendedor em: ${new Date().toLocaleString('pt-BR')}`.trim()
        });
        
        console.log(`✅ Recebimento do saque ${id} confirmado com sucesso`);
        
        res.json({
            success: true,
            message: 'Recebimento confirmado com sucesso',
            data: {
                id: saque.id,
                confirmado: true,
                dataConfirmacao: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao confirmar recebimento:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});

module.exports = router;
