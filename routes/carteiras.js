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
    return {
        ...data,
        metodo_saque: data.metodoSaque || data.metodo_saque,
        nome_titular: data.nomeTitular || data.nome_titular,
        email_titular: data.emailTitular || data.email_titular,
        vendedor_id: data.vendedorId || data.vendedor_id,
        saldo_disponivel: data.saldoDisponivel || data.saldo_disponivel,
        saldo_bloqueado: data.saldoBloqueado || data.saldo_bloqueado,
        saldo_total: data.saldoTotal || data.saldo_total,
        data_criacao: data.dataCriacao || data.data_criacao,
        ultima_atualizacao: data.ultimaAtualizacao || data.ultima_atualizacao
    };
}

/**
 * GET /api/carteiras
 * Listar carteiras do vendedor autenticado
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const carteiras = await CarteiraService.listarCarteiras(req.user.id);
        
        // Converter camelCase para snake_case para compatibilidade com frontend
        const carteirasFormatadas = carteiras.map(formatarCarteira);
        
        res.json({
            success: true,
            carteiras: carteirasFormatadas,
            total: carteirasFormatadas.length
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar carteiras:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao listar carteiras',
            message: error.message
        });
    }
});

/**
 * POST /api/carteiras
 * Criar nova carteira
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { nome, metodoSaque, contacto, nomeTitular, emailTitular } = req.body;
        
        // Validações básicas
        if (!nome || !metodoSaque || !contacto || !nomeTitular || !emailTitular) {
            return res.status(400).json({
                success: false,
                error: 'Dados incompletos',
                message: 'Todos os campos são obrigatórios'
            });
        }
        
        // Validação adicional de tipos
        if (typeof nome !== 'string' || typeof metodoSaque !== 'string' || 
            typeof contacto !== 'string' || typeof nomeTitular !== 'string' || 
            typeof emailTitular !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Dados inválidos',
                message: 'Todos os campos devem ser strings válidas'
            });
        }
        
        // Validar email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTitular)) {
            return res.status(400).json({
                success: false,
                error: 'Email inválido',
                message: 'O email fornecido não é válido'
            });
        }
        
        console.log('🔄 Criando carteira para vendedor:', req.user.id);
        console.log('📋 Dados da carteira:', { nome, metodoSaque, contacto, nomeTitular, emailTitular: emailTitular.substring(0, 10) + '...' });
        
        const carteira = await CarteiraService.criarCarteira(req.user.id, {
            nome: nome.trim(),
            metodoSaque: metodoSaque.trim(),
            contacto: contacto.trim(),
            nomeTitular: nomeTitular.trim(),
            emailTitular: emailTitular.trim().toLowerCase()
        });
        
        res.status(201).json({
            success: true,
            message: 'Carteira criada com sucesso',
            carteira: formatarCarteira(carteira)
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar carteira:', error);
        console.error('❌ Stack trace:', error.stack);
        
        // Mensagem de erro mais amigável
        let errorMessage = error.message || 'Erro ao criar carteira';
        
        // Tratar erros específicos de transação
        if (errorMessage.includes('transação') || errorMessage.includes('transaction')) {
            errorMessage = 'Erro ao processar solicitação. Por favor, tente novamente em alguns instantes.';
        }
        
        res.status(400).json({
            success: false,
            error: 'Erro ao criar carteira',
            message: errorMessage
        });
    }
});

// ======================== ROTAS DE SAQUE (ESPECÍFICAS - DEVEM VIR ANTES DAS ROTAS COM :id) ========================

/**
 * POST /api/carteiras/saque/codigo
 * Gerar código de autenticação para saque
 */
router.post('/saque/codigo', authenticateToken, async (req, res) => {
    try {
        console.log('🔄 Rota /saque/codigo chamada');
        console.log('📝 Body:', req.body);
        console.log('👤 Usuário:', req.user.id);
        
        const { carteiraId } = req.body;
        
        if (!carteiraId) {
            console.log('❌ carteiraId não fornecido');
            return res.status(400).json({
                success: false,
                error: 'ID da carteira é obrigatório'
            });
        }
        
        console.log('✅ carteiraId recebido:', carteiraId);
        
        const resultado = await SaqueSimplificadoService.gerarCodigoSaque(
            req.user.id,
            carteiraId
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
