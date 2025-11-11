const { Venda: VendaModel } = require('../config/database');
const SecurityUtils = require('../utils/securityUtils');

class Venda {
    constructor(data = {}) {
        this.id = data.id;
        this.produtoId = data.produto_id;
        this.clienteNome = data.cliente_nome;
        this.clienteEmail = data.cliente_email;
        this.clienteTelefone = data.cliente_telefone;
        this.clienteWhatsapp = data.cliente_whatsapp;
        this.clienteCpf = data.cliente_cpf;
        this.clienteEndereco = data.cliente_endereco;
        this.clienteCidade = data.cliente_cidade;
        this.clientePais = data.cliente_pais;
        this.clienteIp = data.cliente_ip;
        this.clienteUserAgent = data.cliente_user_agent;
        this.clienteDispositivo = data.cliente_dispositivo;
        this.clienteNavegador = data.cliente_navegador;
        this.pagamentoMetodo = data.pagamento_metodo;
        this.pagamentoValor = data.pagamento_valor;
        this.pagamentoValorOriginal = data.pagamento_valor_original;
        this.pagamentoDesconto = data.pagamento_desconto || 0;
        this.pagamentoCupom = data.pagamento_cupom;
        this.pagamentoStatus = data.pagamento_status || 'Pendente';
        this.pagamentoTransacaoId = data.pagamento_transacao_id;
        this.pagamentoGateway = data.pagamento_gateway || 'Local';
        this.pagamentoDataProcessamento = data.pagamento_data_processamento;
        this.pagamentoReferencia = data.pagamento_referencia;
        this.pagamentoComprovante = data.pagamento_comprovante;
        this.afiliadoCodigo = data.afiliado_codigo;
        this.afiliadoComissao = data.afiliado_comissao || 0;
        this.status = data.status || 'Aguardando Pagamento';
        this.dataVenda = data.data_venda;
        this.dataEntrega = data.data_entrega;
        this.observacoes = data.observacoes;
        this.ip = data.ip;
        this.userAgent = data.user_agent;
        this.canalVenda = data.canal_venda || 'Site';
        this.origemTrafico = data.origem_trafico;
        this.campanha = data.campanha;
        this.utmSource = data.utm_source;
        this.utmMedium = data.utm_medium;
        this.utmCampaign = data.utm_campaign;
        this.createdAt = data.createdAt;
        this.updatedAt = data.updatedAt;
    }

    // Criar nova venda
    static async create(vendaData) {
        try {
        // Validar e sanitizar dados
        if (vendaData.clienteNome) {
            vendaData.clienteNome = SecurityUtils.sanitizarDados(vendaData.clienteNome);
        }
        if (vendaData.clienteEmail) {
            vendaData.clienteEmail = SecurityUtils.sanitizarDados(vendaData.clienteEmail);
        }
        if (vendaData.clienteTelefone) {
            vendaData.clienteTelefone = SecurityUtils.sanitizarDados(vendaData.clienteTelefone);
        }
        
        // Validar valor em MZN
        if (vendaData.pagamentoValor && !SecurityUtils.validarValorMZN(vendaData.pagamentoValor)) {
            throw new Error('Valor inválido. O valor deve estar entre 1 e 50.000 MZN');
        }
        
        // Gerar transação ID seguro se não fornecido
        if (!vendaData.pagamentoTransacaoId) {
            vendaData.pagamentoTransacaoId = SecurityUtils.gerarTransacaoIdSeguro();
        } else {
            // Se o ID foi fornecido pelo gateway de pagamento, aceitar sem validação rigorosa
            // Apenas verificar se é uma string válida
            if (typeof vendaData.pagamentoTransacaoId !== 'string' || vendaData.pagamentoTransacaoId.trim().length === 0) {
                throw new Error('ID de transação inválido');
            }
        }

        // Detectar dispositivo e navegador
        if (vendaData.userAgent) {
            const deviceInfo = this.detectarDispositivo(vendaData.userAgent);
            vendaData.clienteDispositivo = deviceInfo.dispositivo;
            vendaData.clienteNavegador = deviceInfo.navegador;
        }

            // Converter nomes de campos para snake_case para o Sequelize
            const sequelizeData = {
                public_id: vendaData.publicId || String(Math.floor(Math.random() * 900000) + 100000),
                produto_id: vendaData.produtoId,
                vendedor_id: vendaData.vendedorId,
                valor_final: vendaData.valorFinal || vendaData.pagamentoValor,
                cliente_nome: vendaData.clienteNome,
                cliente_email: vendaData.clienteEmail,
                cliente_telefone: vendaData.clienteTelefone,
                cliente_whatsapp: vendaData.clienteWhatsapp, // Adicionar campo WhatsApp
                cliente_cpf: vendaData.clienteCpf,
                cliente_endereco: vendaData.clienteEndereco,
                cliente_cidade: vendaData.clienteCidade,
                cliente_pais: vendaData.clientePais,
                cliente_ip: vendaData.clienteIp,
                cliente_user_agent: vendaData.clienteUserAgent,
                cliente_dispositivo: vendaData.clienteDispositivo,
                cliente_navegador: vendaData.clienteNavegador,
                pagamento_metodo: vendaData.pagamentoMetodo,
                pagamento_valor: vendaData.pagamentoValor,
                pagamento_valor_original: vendaData.pagamentoValorOriginal,
                pagamento_desconto: vendaData.pagamentoDesconto,
                pagamento_cupom: vendaData.pagamentoCupom,
                pagamento_status: vendaData.pagamentoStatus,
                pagamento_transacao_id: vendaData.pagamentoTransacaoId,
                pagamento_gateway: vendaData.pagamentoGateway,
                pagamento_data_processamento: vendaData.pagamentoDataProcessamento,
                pagamento_referencia: vendaData.pagamentoReferencia,
                pagamento_comprovante: vendaData.pagamentoComprovante,
                afiliado_codigo: vendaData.afiliadoCodigo,
                afiliado_comissao: vendaData.afiliadoComissao,
                status: vendaData.status,
                data_venda: vendaData.dataVenda,
                data_entrega: vendaData.dataEntrega,
                observacoes: vendaData.observacoes,
                ip: vendaData.ip,
                user_agent: vendaData.userAgent,
                canal_venda: vendaData.canalVenda,
                origem_trafico: vendaData.origemTrafico,
                campanha: vendaData.campanha,
                utm_source: vendaData.utmSource,
                utm_medium: vendaData.utmMedium,
                utm_campaign: vendaData.utmCampaign
            };

            const venda = await VendaModel.create(sequelizeData);
            return new Venda(venda.toJSON());
        } catch (error) {
            console.error('❌ Erro ao criar venda:', error);
            throw error;
        }
    }

    // Buscar por ID
    static async findById(id) {
        try {
            const venda = await VendaModel.findByPk(id);
            return venda ? new Venda(venda.toJSON()) : null;
        } catch (error) {
            console.error('❌ Erro ao buscar venda por ID:', error);
            throw error;
        }
    }

    // Buscar por ID de transação
    static async findByTransactionId(transactionId) {
        try {
            const venda = await VendaModel.findOne({
                where: { pagamento_transacao_id: transactionId }
            });
            return venda ? new Venda(venda.toJSON()) : null;
        } catch (error) {
            console.error('❌ Erro ao buscar venda por ID de transação:', error);
            throw error;
        }
    }

    // Buscar por status
    static async findByStatus(status) {
        try {
            const vendas = await VendaModel.findAll({
                where: { status: status },
                order: [['createdAt', 'DESC']]
            });
            return vendas.map(venda => new Venda(venda.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar vendas por status:', error);
            throw error;
        }
    }

    // Buscar por produto
    static async findByProduct(productId) {
        try {
            const vendas = await VendaModel.findAll({
                where: { produto_id: productId },
                order: [['createdAt', 'DESC']]
            });
            return vendas.map(venda => new Venda(venda.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar vendas por produto:', error);
            throw error;
        }
    }

    // Buscar por cliente
    static async findByCustomer(email) {
        try {
            const vendas = await VendaModel.findAll({
                where: { cliente_email: email },
                order: [['createdAt', 'DESC']]
            });
            return vendas.map(venda => new Venda(venda.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar vendas por cliente:', error);
            throw error;
        }
    }

    // Buscar todas as vendas
    static async findAll(options = {}) {
        try {
            const queryOptions = {
                order: [['createdAt', 'DESC']],
                ...options
            };
            
            const vendas = await VendaModel.findAll(queryOptions);
            return vendas.map(venda => new Venda(venda.toJSON()));
        } catch (error) {
            console.error('❌ Erro ao buscar todas as vendas:', error);
            throw error;
        }
    }

    // Atualizar venda
    async update(updateData) {
        try {
            const sequelizeData = {};
            
            // Converter nomes de campos para snake_case
            Object.keys(updateData).forEach(key => {
                const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                sequelizeData[snakeKey] = updateData[key];
            });

            await VendaModel.update(sequelizeData, {
                where: { id: this.id }
            });

            // Atualizar instância local
            Object.assign(this, updateData);
            
            return this;
        } catch (error) {
            console.error('❌ Erro ao atualizar venda:', error);
            throw error;
        }
    }

    // Atualizar status
    async updateStatus(status, observacoes = null) {
        try {
            const updateData = { status };
            if (observacoes) {
                updateData.observacoes = observacoes;
            }

            await this.update(updateData);
            console.log(`✅ Status da venda ${this.id} atualizado para: ${status}`);
        } catch (error) {
            console.error('❌ Erro ao atualizar status da venda:', error);
            throw error;
        }
    }

    // Atualizar status de pagamento
    async updatePaymentStatus(status, transactionId = null, comprovante = null) {
        try {
            const updateData = { pagamento_status: status };
            
            if (transactionId) {
                updateData.pagamento_transacao_id = transactionId;
            }
            
            if (comprovante) {
                updateData.pagamento_comprovante = comprovante;
            }

            await this.update(updateData);
            console.log(`✅ Status de pagamento da venda ${this.id} atualizado para: ${status}`);
        } catch (error) {
            console.error('❌ Erro ao atualizar status de pagamento:', error);
            throw error;
        }
    }

    // Deletar venda
    async delete() {
        try {
            await VendaModel.destroy({
                where: { id: this.id }
            });
            console.log(`✅ Venda ${this.id} deletada com sucesso`);
        } catch (error) {
            console.error('❌ Erro ao deletar venda:', error);
            throw error;
        }
    }

    // Obter estatísticas
    static async getStats() {
        try {
            const stats = await VendaModel.findAll({
                attributes: [
                    'status',
                    [VendaModel.sequelize.fn('COUNT', VendaModel.sequelize.col('id')), 'total'],
                    [VendaModel.sequelize.fn('SUM', VendaModel.sequelize.col('pagamento_valor')), 'valor_total']
                ],
                group: ['status']
            });

            return stats.map(stat => stat.toJSON());
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de vendas:', error);
            throw error;
        }
    }

    // Detectar dispositivo e navegador
    static detectarDispositivo(userAgent) {
        const ua = userAgent.toLowerCase();
        
        let dispositivo = 'Desktop';
        let navegador = 'Desconhecido';

        // Detectar dispositivo
        if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
            dispositivo = 'Mobile';
        } else if (ua.includes('tablet')) {
            dispositivo = 'Tablet';
        }

        // Detectar navegador
        if (ua.includes('chrome')) {
            navegador = 'Chrome';
        } else if (ua.includes('firefox')) {
            navegador = 'Firefox';
        } else if (ua.includes('safari')) {
            navegador = 'Safari';
        } else if (ua.includes('edge')) {
            navegador = 'Edge';
        } else if (ua.includes('opera')) {
            navegador = 'Opera';
        }

        return { dispositivo, navegador };
    }

    // Converter para objeto simples
    toJSON() {
        return {
            id: this.id,
            produtoId: this.produtoId,
            clienteNome: this.clienteNome,
            clienteEmail: this.clienteEmail,
            clienteTelefone: this.clienteTelefone,
            clienteWhatsapp: this.clienteWhatsapp, // Adicionar campo WhatsApp
            clienteCpf: this.clienteCpf,
            clienteEndereco: this.clienteEndereco,
            clienteCidade: this.clienteCidade,
            clientePais: this.clientePais,
            clienteIp: this.clienteIp,
            clienteUserAgent: this.clienteUserAgent,
            clienteDispositivo: this.clienteDispositivo,
            clienteNavegador: this.clienteNavegador,
            pagamentoMetodo: this.pagamentoMetodo,
            pagamentoValor: this.pagamentoValor,
            pagamentoValorOriginal: this.pagamentoValorOriginal,
            pagamentoDesconto: this.pagamentoDesconto,
            pagamentoCupom: this.pagamentoCupom,
            pagamentoStatus: this.pagamentoStatus,
            pagamentoTransacaoId: this.pagamentoTransacaoId,
            pagamentoGateway: this.pagamentoGateway,
            pagamentoDataProcessamento: this.pagamentoDataProcessamento,
            pagamentoReferencia: this.pagamentoReferencia,
            pagamentoComprovante: this.pagamentoComprovante,
            afiliadoCodigo: this.afiliadoCodigo,
            afiliadoComissao: this.afiliadoComissao,
            status: this.status,
            dataVenda: this.dataVenda,
            dataEntrega: this.dataEntrega,
            observacoes: this.observacoes,
            ip: this.ip,
            userAgent: this.userAgent,
            canalVenda: this.canalVenda,
            origemTrafico: this.origemTrafico,
            campanha: this.campanha,
            utmSource: this.utmSource,
            utmMedium: this.utmMedium,
            utmCampaign: this.utmCampaign,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Venda;

