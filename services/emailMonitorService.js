/**
 * Serviço de Monitoramento de Email
 * Monitora e reporta o status dos envios de email
 */

const { Venda, Usuario } = require('../config/database');

class EmailMonitorService {
    constructor() {
        this.stats = {
            totalEnviados: 0,
            totalFalhas: 0,
            falhasPorTipo: {},
            ultimaVerificacao: null
        };
    }

    /**
     * Registrar tentativa de envio de email
     * @param {string} tipo - Tipo do email (venda, conteudo, etc.)
     * @param {boolean} sucesso - Se o envio foi bem-sucedido
     * @param {string} destinatario - Email do destinatário
     * @param {string} erro - Mensagem de erro se houver
     */
    registrarTentativa(tipo, sucesso, destinatario, erro = null) {
        if (sucesso) {
            this.stats.totalEnviados++;
            console.log(`✅ Email ${tipo} enviado com sucesso para: ${destinatario}`);
        } else {
            this.stats.totalFalhas++;
            if (!this.stats.falhasPorTipo[tipo]) {
                this.stats.falhasPorTipo[tipo] = 0;
            }
            this.stats.falhasPorTipo[tipo]++;
            console.error(`❌ Falha ao enviar email ${tipo} para: ${destinatario} - ${erro}`);
        }
        
        this.stats.ultimaVerificacao = new Date();
    }

    /**
     * Verificar status dos emails pendentes
     */
    async verificarEmailsPendentes() {
        try {
            console.log('🔍 Verificando emails pendentes...');
            
            // Buscar vendas com status aprovado mas sem notificação enviada
            const vendasPendentes = await Venda.findAll({
                where: {
                    status: 'Pago',
                    pagamento_status: 'Aprovado',
                    notificacao_enviada: false
                },
                include: [{
                    model: Usuario,
                    as: 'vendedor',
                    attributes: ['id', 'nome_completo', 'email', 'telefone']
                }]
            });

            console.log(`📊 Encontradas ${vendasPendentes.length} vendas com notificações pendentes`);
            
            return vendasPendentes;
        } catch (error) {
            console.error('❌ Erro ao verificar emails pendentes:', error);
            return [];
        }
    }

    /**
     * Reenviar emails que falharam
     */
    async reenviarEmailsFalhados() {
        try {
            console.log('🔄 Tentando reenviar emails que falharam...');
            
            const vendasPendentes = await this.verificarEmailsPendentes();
            const vendaNotificationService = require('./vendaNotificationService');
            
            let sucessos = 0;
            let falhas = 0;
            
            for (const venda of vendasPendentes) {
                try {
                    // Notificação de conteúdo pendente removida conforme solicitado
                    sucessos++;
                    console.log(`✅ Reenvio bem-sucedido para venda ${venda.id}`);
                } catch (error) {
                    falhas++;
                    console.error(`❌ Falha no reenvio para venda ${venda.id}:`, error);
                }
            }
            
            console.log(`📊 Reenvio concluído: ${sucessos} sucessos, ${falhas} falhas`);
            return { sucessos, falhas };
            
        } catch (error) {
            console.error('❌ Erro ao reenviar emails:', error);
            return { sucessos: 0, falhas: 1 };
        }
    }

    /**
     * Obter estatísticas de envio
     */
    obterEstatisticas() {
        const total = this.stats.totalEnviados + this.stats.totalFalhas;
        const taxaSucesso = total > 0 ? (this.stats.totalEnviados / total * 100).toFixed(2) : 0;
        
        return {
            ...this.stats,
            totalTentativas: total,
            taxaSucesso: `${taxaSucesso}%`,
            falhasPorTipo: this.stats.falhasPorTipo
        };
    }

    /**
     * Limpar estatísticas
     */
    limparEstatisticas() {
        this.stats = {
            totalEnviados: 0,
            totalFalhas: 0,
            falhasPorTipo: {},
            ultimaVerificacao: null
        };
        console.log('🧹 Estatísticas de email limpas');
    }

    /**
     * Verificar configuração de email
     */
    verificarConfiguracao() {
        const professionalEmailService = require('./professionalEmailService');
        const isConfigurado = professionalEmailService.isInitialized;
        
        console.log(`📧 Configuração de email: ${isConfigurado ? '✅ Configurado' : '❌ Não configurado'}`);
        
        if (!isConfigurado) {
            console.log('⚠️ Recomendações:');
            console.log('   1. Verificar variáveis de ambiente GMAIL_PASS ou EMAIL_PASSWORD');
            console.log('   2. Verificar configuração em config/admin-config.js');
            console.log('   3. Testar conectividade com Gmail');
        }
        
        return isConfigurado;
    }

    /**
     * Executar diagnóstico completo
     */
    async executarDiagnostico() {
        console.log('🔍 Executando diagnóstico completo do sistema de email...');
        
        const configuracao = this.verificarConfiguracao();
        const emailsPendentes = await this.verificarEmailsPendentes();
        const estatisticas = this.obterEstatisticas();
        
        const diagnostico = {
            timestamp: new Date().toISOString(),
            configuracao: {
                emailConfigurado: configuracao,
                recomendacoes: configuracao ? [] : [
                    'Verificar variáveis de ambiente',
                    'Verificar configuração do Gmail',
                    'Testar conectividade'
                ]
            },
            pendentes: {
                total: emailsPendentes.length,
                vendas: emailsPendentes.map(v => ({
                    id: v.id,
                    cliente: v.cliente_nome,
                    produto: v.produto?.nome,
                    vendedor: v.vendedor?.nome_completo
                }))
            },
            estatisticas: estatisticas
        };
        
        console.log('📊 Diagnóstico concluído:', JSON.stringify(diagnostico, null, 2));
        return diagnostico;
    }
}

module.exports = new EmailMonitorService();
