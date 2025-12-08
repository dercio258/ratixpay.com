/**
 * Gerenciador Central de Emails Profissionais
 * Coordena o envio de emails por categoria
 */

const vendasEmailService = require('./vendasEmailService');
const sistemaEmailService = require('./sistemaEmailService');
const suporteEmailService = require('./suporteEmailService');
const ofertasEmailService = require('./ofertasEmailService');
const professionalEmailService = require('./professionalEmailService');

class EmailManagerService {
    constructor() {
        this.vendas = vendasEmailService;
        this.sistema = sistemaEmailService;
        this.suporte = suporteEmailService;
        this.ofertas = ofertasEmailService;
        this.professional = professionalEmailService;
    }

    /**
     * Enviar email de vendas
     */
    async enviarEmailVendas(tipo, dados) {
        try {
            switch (tipo) {
                case 'confirmacao_compra':
                    return await this.vendas.enviarConfirmacaoCompra(dados);
                case 'notificacao_saque':
                    return await this.vendas.enviarNotificacaoSaque(dados);
                case 'confirmacao_venda':
                    return await this.vendas.enviarConfirmacaoVenda(dados);
                case 'recibo_venda':
                    // Redirecionar para confirmação de compra (que agora inclui recibo)
                    console.log('📧 Redirecionando recibo_venda para confirmacao_compra...');
                    return await this.vendas.enviarConfirmacaoCompra(dados);
                default:
                    throw new Error(`Tipo de email de vendas inválido: ${tipo}`);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar email de vendas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de sistema
     */
    async enviarEmailSistema(tipo, dados) {
        try {
            switch (tipo) {
                case 'codigo_verificacao':
                    return await this.sistema.enviarCodigoVerificacao(dados);
                case 'boas_vindas':
                    return await this.sistema.enviarBoasVindas(dados);
                case 'notificacao_sistema':
                    return await this.sistema.enviarNotificacaoSistema(dados);
                case 'recuperacao_senha':
                    return await this.sistema.enviarRecuperacaoSenha(dados);
                case 'notificacao_login':
                    return await this.sistema.enviarNotificacaoLogin(dados);
                case 'notificacao_bloqueio':
                    return await this.sistema.enviarNotificacaoBloqueio(dados);
                case 'notificacao_bloqueio_conta':
                    return await this.sistema.enviarNotificacaoBloqueioConta(dados);
                case 'notificacao_desbloqueio_conta':
                    return await this.sistema.enviarNotificacaoDesbloqueioConta(dados);
                case 'notificacao_exclusao_conta':
                    return await this.sistema.enviarNotificacaoExclusaoConta(dados);
                case 'notificacao_produto_criado':
                    return await this.sistema.enviarNotificacaoProdutoCriado(dados);
                case 'notificacao_produto_ativado':
                    return await this.sistema.enviarNotificacaoProdutoAtivado(dados);
                case 'notificacao_produto_deletado':
                    return await this.sistema.enviarNotificacaoProdutoDeletado(dados);
                case 'solicitacao_aprovacao_produto':
                    return await this.sistema.enviarSolicitacaoAprovacaoProduto(dados);
                case 'notificacao_produto_aprovado_admin':
                    return await this.sistema.enviarNotificacaoProdutoAprovadoAdmin(dados);
                case 'notificacao_produto_aprovado':
                    return await this.sistema.enviarNotificacaoProdutoAprovado(dados);
                case 'notificacao_produto_rejeitado':
                    return await this.sistema.enviarNotificacaoProdutoRejeitado(dados);
                case 'novo_post_blog':
                    return await this.sistema.enviarNotificacaoNovoPost(dados);
                case 'resposta_comentario_blog':
                    return await this.sistema.enviarNotificacaoRespostaComentario(dados);
                case 'reacao_comentario_blog':
                    return await this.sistema.enviarNotificacaoReacaoComentario(dados);
                default:
                    throw new Error(`Tipo de email de sistema inválido: ${tipo}`);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar email de sistema:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de suporte
     */
    async enviarEmailSuporte(tipo, dados) {
        try {
            switch (tipo) {
                case 'confirmacao_reclamacao':
                    return await this.suporte.enviarConfirmacaoReclamacao(dados);
                case 'confirmacao_sugestao':
                    return await this.suporte.enviarConfirmacaoSugestao(dados);
                case 'confirmacao_reembolso':
                    return await this.suporte.enviarConfirmacaoReembolso(dados);
                case 'resposta_suporte':
                    return await this.suporte.enviarRespostaSuporte(dados);
                case 'notificacao_resolucao':
                    return await this.suporte.enviarNotificacaoResolucao(dados);
                default:
                    throw new Error(`Tipo de email de suporte inválido: ${tipo}`);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar email de suporte:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enviar email de ofertas
     */
    async enviarEmailOfertas(tipo, dados) {
        try {
            switch (tipo) {
                case 'oferta_especial':
                    return await this.ofertas.enviarOfertaEspecial(dados);
                case 'promocao_produto':
                    return await this.ofertas.enviarPromocaoProduto(dados);
                case 'newsletter':
                    return await this.ofertas.enviarNewsletter(dados);
                case 'campanha_remarketing':
                    return await this.ofertas.enviarCampanhaRemarketing(dados);
                case 'oferta_upsell':
                    return await this.ofertas.enviarOfertaUpsell(dados);
                default:
                    throw new Error(`Tipo de email de ofertas inválido: ${tipo}`);
            }
        } catch (error) {
            console.error('❌ Erro ao enviar email de ofertas:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Método genérico para enviar email por categoria
     */
    async enviarEmail(categoria, tipo, dados) {
        try {
            console.log(`📧 Enviando email ${categoria}/${tipo} para: ${dados.email || dados.clienteEmail || dados.vendedorEmail}`);
            
            switch (categoria.toLowerCase()) {
                case 'vendas':
                    return await this.enviarEmailVendas(tipo, dados);
                case 'sistema':
                    return await this.enviarEmailSistema(tipo, dados);
                case 'suporte':
                    return await this.enviarEmailSuporte(tipo, dados);
                case 'ofertas':
                    return await this.enviarEmailOfertas(tipo, dados);
                default:
                    throw new Error(`Categoria de email inválida: ${categoria}`);
            }
        } catch (error) {
            console.error(`❌ Erro ao enviar email ${categoria}/${tipo}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Verificar status de todos os serviços de email
     */
    async verificarStatus() {
        try {
            const status = await this.professional.verificarStatus();
            console.log('📧 Status dos serviços de email:', status);
            return status;
        } catch (error) {
            console.error('❌ Erro ao verificar status dos emails:', error);
            return { error: error.message };
        }
    }

    /**
     * Obter estatísticas de envio
     */
    async obterEstatisticas() {
        return {
            categorias: {
                vendas: {
                    tipos: ['confirmacao_compra', 'notificacao_saque', 'confirmacao_venda', 'recibo_venda'],
                    email: 'vendas@ratixpay.com'
                },
                sistema: {
                    tipos: ['codigo_verificacao', 'boas_vindas', 'notificacao_sistema', 'recuperacao_senha', 'notificacao_login', 'notificacao_bloqueio', 'notificacao_bloqueio_conta', 'notificacao_desbloqueio_conta', 'notificacao_exclusao_conta', 'notificacao_produto_criado', 'notificacao_produto_ativado', 'notificacao_produto_deletado', 'solicitacao_aprovacao_produto', 'notificacao_produto_aprovado_admin'],
                    email: 'sistema@ratixpay.com'
                },
                suporte: {
                    tipos: ['confirmacao_reclamacao', 'confirmacao_sugestao', 'confirmacao_reembolso', 'resposta_suporte', 'notificacao_resolucao'],
                    email: 'suporte@ratixpay.com'
                },
                ofertas: {
                    tipos: ['oferta_especial', 'promocao_produto', 'newsletter', 'campanha_remarketing', 'oferta_upsell'],
                    email: 'ofertas@ratixpay.com'
                }
            },
            totalCategorias: 4,
            totalTipos: 18
        };
    }
}

// Criar instância única do gerenciador
const emailManagerService = new EmailManagerService();

module.exports = emailManagerService;
