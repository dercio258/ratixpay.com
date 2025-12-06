/**
 * Rotas para gerenciar carteiras dos vendedores
 * Sistema de carteiras para saques simplificados
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const CarteiraService = require('../services/carteiraService');
const SaqueSimplificadoService = require('../services/saqueSimplificadoService');

// ======================== ROTAS DE CARTEIRAS ========================

/**
 * Helper para converter carteira de camelCase para snake_case
 * Garante compatibilidade com frontend que espera snake_case
 */
function formatarCarteira(carteira) {
    if (!carteira) return null;
    const data = carteira.toJSON ? carteira.toJSON() : carteira;
    
    // Garantir que todos os campos sejam retornados corretamente
    return {
        id: data.id,
        vendedorId: data.vendedorId || data.vendedor_id,
        vendedor_id: data.vendedor_id || data.vendedorId,
        nome: data.nome,
        metodoSaque: data.metodoSaque || data.metodo_saque || 'Mpesa',
        metodo_saque: data.metodo_saque || data.metodoSaque || 'Mpesa',
        contactoMpesa: data.contactoMpesa || data.contacto_mpesa || null,
        contacto_mpesa: data.contacto_mpesa || data.contactoMpesa || null,
        nomeTitularMpesa: data.nomeTitularMpesa || data.nome_titular_mpesa || null,
        nome_titular_mpesa: data.nome_titular_mpesa || data.nomeTitularMpesa || null,
        contactoEmola: data.contactoEmola || data.contacto_emola || null,
        contacto_emola: data.contacto_emola || data.contactoEmola || null,
        nomeTitularEmola: data.nomeTitularEmola || data.nome_titular_emola || null,
        nome_titular_emola: data.nome_titular_emola || data.nomeTitularEmola || null,
        email: data.email,
        emailTitular: data.emailTitular || data.email_titular || data.email,
        email_titular: data.email_titular || data.emailTitular || data.email,
        saldoDisponivel: data.saldoDisponivel || data.saldo_disponivel || '0.00',
        saldo_disponivel: data.saldo_disponivel || data.saldoDisponivel || '0.00',
        saldoBloqueado: data.saldoBloqueado || data.saldo_bloqueado || '0.00',
        saldo_bloqueado: data.saldo_bloqueado || data.saldoBloqueado || '0.00',
        saldoTotal: data.saldoTotal || data.saldo_total || '0.00',
        saldo_total: data.saldo_total || data.saldoTotal || '0.00',
        ativa: data.ativa !== undefined ? data.ativa : true,
        dataCriacao: data.dataCriacao || data.data_criacao,
        data_criacao: data.data_criacao || data.dataCriacao,
        ultimaAtualizacao: data.ultimaAtualizacao || data.ultima_atualizacao,
        ultima_atualizacao: data.ultima_atualizacao || data.ultimaAtualizacao,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        // Campos legados (compatibilidade)
        contacto: data.contacto || data.contacto_mpesa || data.contactoMpesa || null,
        nome_titular: data.nome_titular || data.nomeTitular || data.nome_titular_mpesa || data.nomeTitularMpesa || null
    };
}

/**
 * GET /api/carteiras
 * Listar carteiras do vendedor autenticado
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const carteira = await CarteiraService.buscarCarteiraUnica(req.user.id);

        if (carteira) {
            res.json({
                success: true,
                carteira: formatarCarteira(carteira)
            });
        } else {
            res.json({
                success: true,
                carteira: null,
                message: 'Nenhuma carteira configurada'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao buscar carteira:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao buscar carteira',
            message: error.message
        });
    }
});

/**
 * POST /api/carteiras
 * Criar ou atualizar carteira única do usuário
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Log completo do body recebido para debug
        console.log('📥 Body completo recebido:', JSON.stringify(req.body, null, 2));
        console.log('📥 Tipo do body:', typeof req.body);
        console.log('📥 Keys do body:', Object.keys(req.body || {}));
        
        // Coletar todos os campos do body
        const { 
            nome, 
            metodoSaque, 
            contactoMpesa, 
            nomeTitularMpesa, 
            contactoEmola, 
            nomeTitularEmola,
            emailTitular 
        } = req.body;

        // Log dos valores extraídos
        console.log('📋 Valores extraídos:', {
            nome: nome,
            metodoSaque: metodoSaque,
            contactoMpesa: contactoMpesa,
            nomeTitularMpesa: nomeTitularMpesa,
            contactoEmola: contactoEmola,
            nomeTitularEmola: nomeTitularEmola,
            emailTitular: emailTitular
        });

        // Validações básicas
        if (!contactoMpesa || !nomeTitularMpesa || !contactoEmola || !nomeTitularEmola) {
            return res.status(400).json({
                success: false,
                error: 'Dados incompletos',
                message: 'Todos os campos são obrigatórios: Contacto Mpesa, Nome Titular Mpesa, Contacto Emola, Nome Titular Emola'
            });
        }

        // Usar email do usuário autenticado (prioridade) ou emailTitular fornecido
        const email = (req.user.email || req.user.email_usuario || emailTitular || '').trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email não encontrado',
                message: 'Email do usuário não encontrado. Faça login novamente.'
            });
        }

        console.log('🔄 Criando/atualizando carteira para vendedor:', req.user.id);
        console.log('📋 Dados recebidos (completo):', {
            nome: nome || 'Carteira Principal',
            metodoSaque: metodoSaque || 'Mpesa',
            contactoMpesa: contactoMpesa || 'NULL/VAZIO',
            nomeTitularMpesa: nomeTitularMpesa || 'NULL/VAZIO',
            contactoEmola: contactoEmola || 'NULL/VAZIO',
            nomeTitularEmola: nomeTitularEmola || 'NULL/VAZIO',
            email: email || 'NULL/VAZIO'
        });
        
        // Validar que contactos não sejam vazios ou null
        if (!contactoMpesa || contactoMpesa.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Contacto Mpesa inválido',
                message: 'Contacto Mpesa é obrigatório e não pode estar vazio'
            });
        }
        if (!contactoEmola || contactoEmola.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Contacto Emola inválido',
                message: 'Contacto Emola é obrigatório e não pode estar vazio'
            });
        }

        const carteira = await CarteiraService.criarOuAtualizarCarteira(req.user.id, {
            nome: (nome || 'Carteira Principal').trim(),
            metodoSaque: (metodoSaque || 'Mpesa').trim(),
            contactoMpesa: contactoMpesa.trim(),
            nomeTitularMpesa: nomeTitularMpesa.trim(),
            contactoEmola: contactoEmola.trim(),
            nomeTitularEmola: nomeTitularEmola.trim(),
            email: email
        });

        res.status(201).json({
            success: true,
            message: 'Carteira configurada com sucesso',
            carteira: formatarCarteira(carteira)
        });

    } catch (error) {
        console.error('❌ Erro ao criar/atualizar carteira:', error);
        console.error('❌ Stack trace:', error.stack);

        // Mensagem de erro mais amigável
        let errorMessage = error.message || 'Erro ao configurar carteira';

        res.status(400).json({
            success: false,
            error: 'Erro ao configurar carteira',
            message: errorMessage
        });
    }
});

// ======================== ROTAS DE SAQUE (ESPECÍFICAS - DEVEM VIR ANTES DAS ROTAS COM :id) ========================

/**
 * POST /api/carteiras/saque/codigo
 * Gerar código de autenticação para saque (usa carteira única do usuário)
 */
router.post('/saque/codigo', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Rota /saque/codigo chamada');
        console.log('👤 Usuário:', req.user.id);

        // Buscar carteira única do usuário usando o serviço
        const carteira = await CarteiraService.buscarCarteiraUnica(req.user.id);

        if (!carteira) {
            return res.status(400).json({
                success: false,
                error: 'Carteira não configurada',
                message: 'Configure sua carteira primeiro antes de solicitar saques'
            });
        }

        // Verificar se a carteira está ativa
        if (!carteira.ativa && carteira.ativa !== undefined) {
            return res.status(400).json({
                success: false,
                error: 'Carteira inativa',
                message: 'Sua carteira está inativa. Ative-a antes de solicitar saques.'
            });
        }

        const carteiraId = carteira.id;
        const emailCarteira = carteira.email || req.user.email || req.user.email_usuario;
        console.log('✅ Carteira encontrada:', carteiraId);

        if (!emailCarteira) {
            return res.status(400).json({
                success: false,
                error: 'Email não encontrado',
                message: 'Email da carteira não encontrado. Configure sua carteira novamente.'
            });
        }

        const resultado = await SaqueSimplificadoService.gerarCodigoSaque(
            req.user.id,
            carteiraId,
            emailCarteira
        );

        console.log('✅ Código gerado com sucesso');

        res.json({
            success: true,
            message: resultado.mensagem,
            expiraEm: resultado.expiraEm
        });

    } catch (error) {
        console.error('❌ Erro ao gerar código de saque:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao gerar código de saque',
            message: error.message
        });
    }
});

/**
 * POST /api/carteiras/saque/processar
 * Processar saque simplificado
 */
router.post('/saque/processar', authenticateToken, async (req, res) => {
    try {
        const { carteiraId, valor, codigoAutenticacao } = req.body;

        // Validações básicas
        if (!carteiraId || !valor || !codigoAutenticacao) {
            return res.status(400).json({
                success: false,
                error: 'Dados incompletos',
                message: 'Carteira, valor e código são obrigatórios'
            });
        }

        if (valor <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valor inválido',
                message: 'O valor deve ser maior que zero'
            });
        }

        const resultado = await SaqueSimplificadoService.processarSaqueDirecto(
            req.user.id,
            carteiraId,
            parseFloat(valor),
            codigoAutenticacao
        );

        res.json({
            success: true,
            ...resultado
        });

    } catch (error) {
        console.error('❌ Erro ao processar saque:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao processar saque',
            message: error.message
        });
    }
});

/**
 * POST /api/carteiras/saque/direto
 * Processar saque direto (sem pendência)
 */
router.post('/saque/direto', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Rota /saque/direto chamada');
        console.log('📝 Body:', req.body);
        console.log('👤 Usuário:', req.user.id);

        const { carteiraId, valor, codigoAutenticacao } = req.body;

        // Validações básicas
        if (!carteiraId || !valor || !codigoAutenticacao) {
            console.log('❌ Dados incompletos:', { carteiraId, valor, codigoAutenticacao });
            return res.status(400).json({
                success: false,
                error: 'Dados incompletos',
                message: 'Carteira, valor e código de autenticação são obrigatórios'
            });
        }

        if (valor <= 0) {
            console.log('❌ Valor inválido:', valor);
            return res.status(400).json({
                success: false,
                error: 'Valor inválido',
                message: 'O valor deve ser maior que zero'
            });
        }

        if (!codigoAutenticacao || codigoAutenticacao.length !== 6) {
            console.log('❌ Código de autenticação inválido:', codigoAutenticacao);
            return res.status(400).json({
                success: false,
                error: 'Código inválido',
                message: 'Código de autenticação deve ter 6 dígitos'
            });
        }

        console.log('✅ Dados validados, processando saque...');

        const resultado = await SaqueSimplificadoService.processarSaqueDirecto(
            req.user.id,
            carteiraId,
            parseFloat(valor),
            codigoAutenticacao
        );

        console.log('✅ Saque processado com sucesso');
        console.log('📊 Resultado do saque:', resultado);

        res.json({
            success: true,
            data: {
                saque: resultado.saque,
                novaReceita: resultado.novaReceita
            }
        });

    } catch (error) {
        console.error('❌ Erro ao processar saque direto:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao processar saque direto',
            message: error.message
        });
    }
});

/**
 * GET /api/carteiras/saque/historico
 * Listar histórico de saques do vendedor
 */
router.get('/saque/historico', authenticateToken, async (req, res) => {
    try {
        const historico = await SaqueSimplificadoService.listarHistoricoSaques(req.user.id);

        res.json({
            success: true,
            historico: historico,
            total: historico.length
        });

    } catch (error) {
        console.error('❌ Erro ao listar histórico de saques:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao listar histórico de saques',
            message: error.message
        });
    }
});

// ======================== ROTAS COM PARÂMETROS (:id) ========================

/**
 * PUT /api/carteiras/:id
 * Editar carteira existente
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, metodoSaque, contacto, nomeTitular, emailTitular } = req.body;

        const carteira = await CarteiraService.editarCarteira(id, req.user.id, {
            nome,
            metodoSaque,
            contacto,
            nomeTitular,
            emailTitular
        });

        res.json({
            success: true,
            message: 'Carteira atualizada com sucesso',
            carteira: carteira
        });

    } catch (error) {
        console.error('❌ Erro ao editar carteira:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao editar carteira',
            message: error.message
        });
    }
});

/**
 * DELETE /api/carteiras/:id
 * Desativar carteira
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        await CarteiraService.desativarCarteira(id, req.user.id);

        res.json({
            success: true,
            message: 'Carteira desativada com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao desativar carteira:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao desativar carteira',
            message: error.message
        });
    }
});

// ======================== ROTAS DE AUTENTICAÇÃO ========================

/**
 * POST /api/carteiras/:id/codigo
 * Gerar código de autenticação para carteira
 */
router.post('/:id/codigo', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar carteira para obter email
        const carteira = await CarteiraService.listarCarteiras(req.user.id);
        const carteiraAlvo = carteira.find(c => c.id === id);

        if (!carteiraAlvo) {
            return res.status(404).json({
                success: false,
                error: 'Carteira não encontrada'
            });
        }

        const resultado = await CarteiraService.gerarCodigoCarteira(
            req.user.id,
            carteiraAlvo.email_titular
        );

        res.json({
            success: true,
            message: resultado.mensagem,
            expiraEm: resultado.expiraEm
        });

    } catch (error) {
        console.error('❌ Erro ao gerar código de carteira:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao gerar código',
            message: error.message
        });
    }
});

/**
 * POST /api/carteiras/:id/verificar-codigo
 * Verificar código de autenticação para carteira
 */
router.post('/:id/verificar-codigo', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo } = req.body;

        if (!codigo) {
            return res.status(400).json({
                success: false,
                error: 'Código é obrigatório'
            });
        }

        const codigoValido = await CarteiraService.verificarCodigoCarteira(
            req.user.id,
            codigo
        );

        if (codigoValido) {
            res.json({
                success: true,
                message: 'Código verificado com sucesso'
            });
        } else {
            res.status(400).json({
                success: false,
                error: 'Código inválido'
            });
        }

    } catch (error) {
        console.error('❌ Erro ao verificar código:', error);
        res.status(400).json({
            success: false,
            error: 'Erro ao verificar código',
            message: error.message
        });
    }
});

/**
 * GET /api/carteiras/saque/disponibilidade
 * Verificar se vendedor pode fazer saque
 */
router.get('/saque/disponibilidade', authenticateToken, async (req, res) => {
    try {
        const disponibilidade = await SaqueSimplificadoService.verificarDisponibilidadeSaque(req.user.id);

        res.json({
            success: true,
            ...disponibilidade
        });

    } catch (error) {
        console.error('❌ Erro ao verificar disponibilidade de saque:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao verificar disponibilidade',
            message: error.message
        });
    }
});

module.exports = router;
