const { Usuario } = require('../config/database');

class MarketingAvancadoService {
    /**
     * Ativar marketing avançado para um vendedor
     * @param {string} vendedorId - ID do vendedor
     * @param {number} dias - Número de dias de ativação (padrão: 30)
     */
    static async ativarMarketingAvancado(vendedorId, dias = 30) {
        try {
            console.log(`🚀 Ativando Marketing Avançado para vendedor ${vendedorId} por ${dias} dias`);
            
            // Buscar o vendedor
            const vendedor = await Usuario.findByPk(vendedorId);
            if (!vendedor) {
                throw new Error(`Vendedor ${vendedorId} não encontrado`);
            }
            
            // Calcular data de expiração
            const dataExpiracao = new Date();
            dataExpiracao.setDate(dataExpiracao.getDate() + dias);
            
            // Atualizar dados do vendedor
            await vendedor.update({
                marketing_avancado_ativo: true,
                marketing_avancado_data_inicio: new Date(),
                marketing_avancado_data_expiracao: dataExpiracao,
                marketing_avancado_dias_restantes: dias
            });
            
            console.log(`✅ Marketing Avançado ativado para ${vendedor.nome_completo || vendedor.nome}`);
            console.log(`📅 Data de expiração: ${dataExpiracao.toLocaleDateString('pt-BR')}`);
            
            return {
                success: true,
                vendedor: {
                    id: vendedor.id,
                    nome: vendedor.nome_completo || vendedor.nome,
                    email: vendedor.email
                },
                marketing_avancado: {
                    ativo: true,
                    data_inicio: new Date(),
                    data_expiracao: dataExpiracao,
                    dias_restantes: dias
                }
            };
            
        } catch (error) {
            console.error('❌ Erro ao ativar Marketing Avançado:', error);
            throw error;
        }
    }
    
    /**
     * Verificar se o marketing avançado está ativo para um vendedor
     * @param {string} vendedorId - ID do vendedor
     */
    static async verificarStatusMarketingAvancado(vendedorId) {
        try {
            const vendedor = await Usuario.findByPk(vendedorId);
            if (!vendedor) {
                return { ativo: false, motivo: 'Vendedor não encontrado' };
            }
            
            // Verificar se está ativo
            if (!vendedor.marketing_avancado_ativo) {
                return { ativo: false, motivo: 'Marketing Avançado não ativado' };
            }
            
            // Verificar se não expirou
            const agora = new Date();
            const dataExpiracao = new Date(vendedor.marketing_avancado_data_expiracao);
            
            if (agora > dataExpiracao) {
                // Desativar automaticamente se expirou
                await vendedor.update({
                    marketing_avancado_ativo: false,
                    marketing_avancado_dias_restantes: 0
                });
                
                return { 
                    ativo: false, 
                    motivo: 'Marketing Avançado expirado',
                    data_expiracao: dataExpiracao
                };
            }
            
            // Calcular dias restantes
            const diasRestantes = Math.ceil((dataExpiracao - agora) / (1000 * 60 * 60 * 24));
            
            return {
                ativo: true,
                data_inicio: vendedor.marketing_avancado_data_inicio,
                data_expiracao: dataExpiracao,
                dias_restantes: diasRestantes
            };
            
        } catch (error) {
            console.error('❌ Erro ao verificar status do Marketing Avançado:', error);
            return { ativo: false, motivo: 'Erro interno' };
        }
    }
    
    /**
     * Desativar marketing avançado para um vendedor
     * @param {string} vendedorId - ID do vendedor
     */
    static async desativarMarketingAvancado(vendedorId) {
        try {
            const vendedor = await Usuario.findByPk(vendedorId);
            if (!vendedor) {
                throw new Error(`Vendedor ${vendedorId} não encontrado`);
            }
            
            await vendedor.update({
                marketing_avancado_ativo: false,
                marketing_avancado_dias_restantes: 0
            });
            
            console.log(`🔒 Marketing Avançado desativado para ${vendedor.nome_completo || vendedor.nome}`);
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ Erro ao desativar Marketing Avançado:', error);
            throw error;
        }
    }
    
    /**
     * Processar ativação automática após pagamento do produto L47FUIO0N
     * @param {string} vendedorId - ID do vendedor
     * @param {string} produtoId - ID do produto (deve ser L47FUIO0N)
     */
    static async processarAtivacaoAutomatica(vendedorId, produtoId) {
        try {
            // Verificar se é o produto correto
            if (produtoId !== 'L47FUIO0N') {
                console.log(`ℹ️ Produto ${produtoId} não é de Marketing Avançado, pulando ativação`);
                return { success: false, motivo: 'Produto não é de Marketing Avançado' };
            }
            
            console.log(`🎯 Processando ativação automática do Marketing Avançado para vendedor ${vendedorId}`);
            
            // Ativar marketing avançado por 30 dias
            const resultado = await this.ativarMarketingAvancado(vendedorId, 30);
            
            // Enviar notificação de ativação
            await this.enviarNotificacaoAtivacao(vendedorId, resultado);
            
            return resultado;
            
        } catch (error) {
            console.error('❌ Erro na ativação automática:', error);
            throw error;
        }
    }
    
    /**
     * Enviar notificação de ativação do Marketing Avançado
     * @param {string} vendedorId - ID do vendedor
     * @param {object} dadosAtivacao - Dados da ativação
     */
    static async enviarNotificacaoAtivacao(vendedorId, dadosAtivacao) {
        try {
            const vendedor = await Usuario.findByPk(vendedorId);
            if (!vendedor) return;
            
            console.log(`📧 Enviando notificação de ativação para ${vendedor.email}`);
            
            // Aqui você pode implementar o envio de email/WhatsApp
            // Por enquanto, apenas log
            console.log(`✅ Marketing Avançado ativado com sucesso!`);
            console.log(`👤 Vendedor: ${vendedor.nome_completo || vendedor.nome}`);
            console.log(`📅 Válido até: ${dadosAtivacao.marketing_avancado.data_expiracao.toLocaleDateString('pt-BR')}`);
            console.log(`⏰ Dias restantes: ${dadosAtivacao.marketing_avancado.dias_restantes}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar notificação de ativação:', error);
        }
    }
}

module.exports = MarketingAvancadoService;
