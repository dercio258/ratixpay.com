/**
 * Serviço de Remarketing Automático
 * Gerencia fila de notificações de remarketing para vendas canceladas
 */

const { sequelize } = require('../config/database');
const { Produto, Usuario } = require('../config/database');
const emailManagerService = require('./emailManagerService');
const whatsappService = require('./whatsappService');
const whatsappBaileysManager = require('./whatsappBaileysManager');
const professionalEmailService = require('./professionalEmailService');

class RemarketingService {
    constructor() {
        this.tableName = 'remarketing_queue';
        this.maxItensPorExecucao = 50;
        this.intervaloProcessamento = 5 * 60 * 1000; // 5 minutos
    }

    /**
     * Adiciona venda cancelada à fila de remarketing
     * @param {Object} dados - Dados da venda cancelada
     * @returns {Promise<Object>} Item adicionado à fila
     */
    async adicionarVendaCancelada(dados) {
        const {
            cliente_id,
            cliente_nome,
            produto_id,
            produto_nome,
            email,
            telefone
        } = dados;

        try {
            // Se cliente_id for null ou undefined, usar um UUID genérico (a tabela não aceita NULL)
            const { randomUUID } = require('crypto');
            // Garantir que sempre temos um UUID válido (não null e não undefined)
            // Tratar explicitamente null, undefined, string 'null', string 'undefined', e strings vazias
            const clienteIdFinal = (cliente_id && 
                                   cliente_id !== null && 
                                   cliente_id !== undefined && 
                                   cliente_id !== 'null' && 
                                   cliente_id !== 'undefined' && 
                                   cliente_id !== '') 
                ? cliente_id 
                : randomUUID();
            
            console.log(`🔄 Remarketing - cliente_id original: ${cliente_id} (${typeof cliente_id}), cliente_id final: ${clienteIdFinal}`);
            
            // Buscar produto para verificar se remarketing está ativo
            const produto = await Produto.findByPk(produto_id);
            
            if (!produto) {
                throw new Error('Produto não encontrado');
            }

            // Verificar se remarketing está ativado
            const remarketingConfig = produto.remarketing_config;
            if (!remarketingConfig || !remarketingConfig.enabled) {
                return { ignorado: true, motivo: 'Remarketing não ativado para este produto' };
            }

            // Verificar antispam (máximo 1 notificação por cliente/produto/dia)
            // Se cliente_id for null, usar email ou telefone para verificação
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const amanha = new Date(hoje);
            amanha.setDate(amanha.getDate() + 1);

            // Verificar antispam (máximo 1 notificação por cliente/produto/dia)
            // Se cliente_id original for null, verificar por email ou telefone
            let antispamCheck = [];
            if (cliente_id) {
                // Verificar por cliente_id original
                antispamCheck = await sequelize.query(
                    `SELECT id FROM ${this.tableName} 
                     WHERE cliente_id = :cliente_id 
                       AND produto_id = :produto_id 
                       AND DATE(data_cancelamento) = DATE(:hoje)
                       AND status IN ('pendente', 'enviado')
                     LIMIT 1`,
                    {
                        replacements: {
                            cliente_id: clienteIdFinal,
                            produto_id,
                            hoje: hoje.toISOString()
                        },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
            } else if (email) {
                // Se não tiver cliente_id original, verificar por email
                antispamCheck = await sequelize.query(
                    `SELECT id FROM ${this.tableName} 
                     WHERE email = :email 
                       AND produto_id = :produto_id 
                       AND DATE(data_cancelamento) = DATE(:hoje)
                       AND status IN ('pendente', 'enviado')
                     LIMIT 1`,
                    {
                        replacements: {
                            email,
                            produto_id,
                            hoje: hoje.toISOString()
                        },
                        type: sequelize.QueryTypes.SELECT
                    }
                );
            }

            if (antispamCheck.length > 0) {
                return { ignorado: true, motivo: 'Antispam: já existe notificação para este cliente/produto hoje' };
            }

            // Calcular data_agendada
            const tempoMinutos = remarketingConfig.tempo_minutos || 0;
            const dataCancelamento = new Date();
            const dataAgendada = new Date(dataCancelamento.getTime() + (tempoMinutos * 60 * 1000));

            // Validar e formatar telefone
            let telefoneFinal = null;
            if (telefone) {
                // Remover espaços e caracteres especiais, mas manter o formato básico
                telefoneFinal = telefone.toString().trim();
                if (telefoneFinal === '' || telefoneFinal === 'null' || telefoneFinal === 'undefined') {
                    telefoneFinal = null;
                }
            }

            console.log(`📝 Adicionando à fila de remarketing:`);
            console.log(`   - Cliente: ${cliente_nome}`);
            console.log(`   - Produto: ${produto_nome}`);
            console.log(`   - Email: ${email || 'não informado'}`);
            console.log(`   - Telefone: ${telefoneFinal || 'não informado'}`);
            console.log(`   - Tempo agendado: ${tempoMinutos} minutos`);

            // Inserir na fila
            const [result] = await sequelize.query(
                `INSERT INTO ${this.tableName} 
                 (cliente_id, cliente_nome, produto_id, produto_nome, email, telefone, 
                  status, data_cancelamento, tempo_envio, data_agendada, created_at, updated_at)
                 VALUES (:cliente_id, :cliente_nome, :produto_id, :produto_nome, :email, :telefone,
                         'pendente', :data_cancelamento, :tempo_envio, :data_agendada, NOW(), NOW())
                 RETURNING *`,
                {
                    replacements: {
                        cliente_id: clienteIdFinal,
                        cliente_nome,
                        produto_id,
                        produto_nome,
                        email: email || null,
                        telefone: telefoneFinal,
                        data_cancelamento: dataCancelamento.toISOString(),
                        tempo_envio: tempoMinutos,
                        data_agendada: dataAgendada.toISOString()
                    },
                    type: sequelize.QueryTypes.INSERT
                }
            );

            return { sucesso: true, item: result[0] };
        } catch (error) {
            console.error('❌ Erro ao adicionar venda cancelada à fila:', error);
            throw error;
        }
    }

    /**
     * Processa a fila de remarketing
     * Busca itens pendentes cuja data_agendada já passou
     * @returns {Promise<Object>} Estatísticas do processamento
     */
    async processarFila() {
        const agora = new Date();
        const stats = {
            processados: 0,
            enviados: 0,
            ignorados: 0,
            erros: 0
        };

        try {
            // Buscar itens pendentes cuja data_agendada já passou
            const itens = await sequelize.query(
                `SELECT * FROM ${this.tableName}
                 WHERE status = 'pendente'
                   AND data_agendada <= :agora
                 ORDER BY data_agendada ASC
                 LIMIT :limite`,
                {
                    replacements: {
                        agora: agora.toISOString(),
                        limite: this.maxItensPorExecucao
                    },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (itens.length === 0) {
                return stats;
            }

            // Processar cada item
            for (const item of itens) {
                stats.processados++;

                try {
                    // Verificar antispam novamente antes de enviar
                    const hoje = new Date(item.data_cancelamento);
                    hoje.setHours(0, 0, 0, 0);

                    const antispamCheck = await sequelize.query(
                        `SELECT id FROM ${this.tableName}
                         WHERE cliente_id = :cliente_id
                           AND produto_id = :produto_id
                           AND DATE(data_cancelamento) = DATE(:hoje)
                           AND status = 'enviado'
                           AND id != :item_id
                         LIMIT 1`,
                        {
                            replacements: {
                                cliente_id: item.cliente_id,
                                produto_id: item.produto_id,
                                hoje: hoje.toISOString(),
                                item_id: item.id
                            },
                            type: sequelize.QueryTypes.SELECT
                        }
                    );

                    if (antispamCheck.length > 0) {
                        await this.marcarComoIgnorado(item.id, 'Antispam: notificação já enviada hoje');
                        stats.ignorados++;
                        continue;
                    }

                    // Enviar notificação
                    const resultado = await this.enviarNotificacao(item);
                    
                    if (resultado.sucesso) {
                        await this.marcarComoEnviado(item.id);
                        stats.enviados++;
                    } else {
                        await this.marcarComoIgnorado(item.id, resultado.motivo || 'Erro ao enviar');
                        stats.ignorados++;
                    }
                } catch (error) {
                    console.error(`❌ Erro ao processar item ${item.id}:`, error);
                    stats.erros++;
                    
                    // Incrementar tentativas
                    await sequelize.query(
                        `UPDATE ${this.tableName}
                         SET tentativas = tentativas + 1,
                             updated_at = NOW()
                         WHERE id = :id`,
                        {
                            replacements: { id: item.id }
                        }
                    );

                    // Se exceder 3 tentativas, marcar como ignorado
                    if ((item.tentativas || 0) >= 2) {
                        await this.marcarComoIgnorado(item.id, 'Máximo de tentativas excedido');
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('❌ Erro ao processar fila de remarketing:', error);
            throw error;
        }
    }

    /**
     * Envia notificação de remarketing
     * @param {Object} item - Item da fila
     * @returns {Promise<Object>} Resultado do envio
     */
    async enviarNotificacao(item) {
        try {
            // Buscar dados do produto
            const produto = await Produto.findByPk(item.produto_id);
            if (!produto) {
                return { sucesso: false, motivo: 'Produto não encontrado' };
            }

            // Gerar link do checkout
            const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
            const linkCheckout = `${baseUrl}/checkout.html?produto=${produto.custom_id}`;

            // Preparar mensagem
            const mensagem = this.prepararMensagem(
                item.cliente_nome,
                item.produto_nome,
                linkCheckout
            );

            let sucessoEmail = false;
            let sucessoWhatsApp = false;

            // ========== ENVIO PARA CLIENTE ==========
            // Enviar por email (sempre que disponível)
            if (item.email) {
                try {
                    console.log(`📧 Enviando email de remarketing para cliente: ${item.email}`);
                    await emailManagerService.enviarEmailOfertas('campanha_remarketing', {
                        email: item.email,
                        nome: item.cliente_nome,
                        produtoInteresse: item.produto_nome,
                        linkProduto: linkCheckout,
                        ofertaEspecial: 'Finalize sua compra agora e aproveite!',
                        motivoAbandono: 'Pagamento não foi concluído'
                    });
                    sucessoEmail = true;
                    console.log(`✅ Email de remarketing enviado com sucesso para cliente: ${item.email}`);
                } catch (error) {
                    console.error(`⚠️ Erro ao enviar email de remarketing para ${item.email}:`, error.message);
                }
            } else {
                console.log(`ℹ️ Email não disponível para cliente (item ID: ${item.id})`);
            }

            // Enviar por WhatsApp usando sessão "default" (sempre que disponível)
            if (item.telefone) {
                try {
                    console.log(`📱 Enviando WhatsApp de remarketing para cliente: ${item.telefone}`);
                    
                    // Formatar número de telefone para WhatsApp
                    const telefoneFormatado = this.formatarTelefoneWhatsApp(item.telefone);
                    console.log(`📱 Telefone formatado: ${telefoneFormatado}`);
                    
                    // Usar whatsappBaileysManager com sessão "default"
                    const resultadoWhatsApp = await whatsappBaileysManager.sendMessage(
                        telefoneFormatado, 
                        mensagem, 
                        null, 
                        'default' // Sessão WhatsApp: default
                    );
                    
                    if (resultadoWhatsApp && resultadoWhatsApp.success !== false) {
                        sucessoWhatsApp = true;
                        console.log(`✅ WhatsApp de remarketing enviado com sucesso para cliente: ${telefoneFormatado}`);
                    } else {
                        console.log(`⚠️ Falha ao enviar WhatsApp de remarketing para cliente: ${telefoneFormatado}`);
                        if (resultadoWhatsApp && resultadoWhatsApp.error) {
                            console.log(`   Motivo: ${resultadoWhatsApp.error}`);
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erro ao enviar WhatsApp de remarketing para cliente ${item.telefone}:`, error.message);
                    console.error(`❌ Stack trace:`, error.stack);
                }
            } else {
                console.log(`ℹ️ Telefone não disponível para envio de WhatsApp de remarketing (item ID: ${item.id})`);
            }

            // Notificar vendedor sobre o remarketing enviado
            try {
                await this.notificarVendedorRemarketing(produto, item);
            } catch (error) {
                console.error(`⚠️ Erro ao notificar vendedor sobre remarketing:`, error.message);
                // Não falhar o processo principal por erro na notificação do vendedor
            }

            // Retornar sucesso se pelo menos um método funcionou
            if (sucessoEmail || sucessoWhatsApp) {
                console.log(`✅ Notificação de remarketing enviada - Email: ${sucessoEmail ? 'Sim' : 'Não'}, WhatsApp: ${sucessoWhatsApp ? 'Sim' : 'Não'}`);
                return { sucesso: true, email: sucessoEmail, whatsapp: sucessoWhatsApp };
            } else {
                const motivo = !item.email && !item.telefone 
                    ? 'Nenhum canal de envio disponível (sem email e sem telefone)' 
                    : 'Nenhum canal de envio funcionou';
                console.log(`⚠️ ${motivo} para item ID: ${item.id}`);
                return { sucesso: false, motivo };
            }
        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);
            return { sucesso: false, motivo: error.message };
        }
    }

    /**
     * Formata número de telefone para WhatsApp
     * @param {string} telefone - Número de telefone
     * @returns {string} Telefone formatado
     */
    formatarTelefoneWhatsApp(telefone) {
        if (!telefone) return null;
        
        let telefoneFormatado = telefone.toString().trim();
        
        // Remover caracteres especiais, mas manter o + se existir
        if (telefoneFormatado.startsWith('+')) {
            telefoneFormatado = '+' + telefoneFormatado.substring(1).replace(/[^\d]/g, '');
        } else {
            telefoneFormatado = telefoneFormatado.replace(/[^\d]/g, '');
        }
        
        return telefoneFormatado;
    }

    /**
     * Notifica o vendedor sobre remarketing enviado
     * Envia tanto WhatsApp quanto Email (ambos quando disponíveis)
     * @param {Object} produto - Dados do produto
     * @param {Object} item - Item da fila de remarketing
     */
    async notificarVendedorRemarketing(produto, item) {
        try {
            // Buscar dados do vendedor
            if (!produto.vendedor_id) {
                console.log(`ℹ️ Produto ${produto.id} não tem vendedor_id, pulando notificação ao vendedor`);
                return;
            }

            const vendedor = await Usuario.findByPk(produto.vendedor_id, {
                attributes: ['id', 'nome_completo', 'nome', 'email', 'telefone']
            });

            if (!vendedor) {
                console.log(`⚠️ Vendedor não encontrado com ID: ${produto.vendedor_id}`);
                return;
            }

            const nomeVendedor = vendedor.nome_completo || vendedor.nome || 'Parceiro';
            
            // Preparar informações do contato do cliente
            const contatoCliente = item.telefone 
                ? `WhatsApp: ${item.telefone}` 
                : (item.email ? `Email: ${item.email}` : 'Contato não disponível');

            // Preparar mensagem para o vendedor
            const mensagemVendedor = `🔄 *Remarketing Realizado - RatixPay*

Olá ${nomeVendedor}! 👋

Realizamos remarketing da venda do produto *"${item.produto_nome}"* no nosso sistema de ofertas para aumentar as conversões.

📋 *Detalhes:*
• Cliente: ${item.cliente_nome}
• Contato: ${contatoCliente}
• Produto: ${item.produto_nome}

💡 O sistema enviou automaticamente uma mensagem de remarketing para o cliente, incentivando-o a finalizar a compra.

*RatixPay* 🚀`;

            let sucessoWhatsAppVendedor = false;
            let sucessoEmailVendedor = false;

            // ========== ENVIO WHATSAPP PARA VENDEDOR ==========
            if (vendedor.telefone) {
                try {
                    console.log(`📱 Enviando WhatsApp de notificação para vendedor: ${vendedor.telefone}`);
                    const telefoneFormatado = this.formatarTelefoneWhatsApp(vendedor.telefone);
                    
                    // Usar whatsappBaileysManager com sessão "default"
                    const resultadoWhatsApp = await whatsappBaileysManager.sendMessage(
                        telefoneFormatado, 
                        mensagemVendedor, 
                        null, 
                        'default' // Sessão WhatsApp: default
                    );
                    
                    if (resultadoWhatsApp && resultadoWhatsApp.success !== false) {
                        sucessoWhatsAppVendedor = true;
                        console.log(`✅ Vendedor notificado via WhatsApp com sucesso: ${telefoneFormatado}`);
                    } else {
                        console.log(`⚠️ Falha ao enviar WhatsApp para vendedor: ${telefoneFormatado}`);
                        if (resultadoWhatsApp && resultadoWhatsApp.error) {
                            console.log(`   Motivo: ${resultadoWhatsApp.error}`);
                        }
                    }
                } catch (error) {
                    console.error(`⚠️ Erro ao enviar WhatsApp para vendedor:`, error.message);
                }
            } else {
                console.log(`ℹ️ Vendedor não tem telefone para notificação WhatsApp`);
            }

            // ========== ENVIO EMAIL PARA VENDEDOR ==========
            if (vendedor.email) {
                try {
                    console.log(`📧 Enviando email de notificação para vendedor: ${vendedor.email}`);
                    await professionalEmailService.enviarEmailSistema(
                        vendedor.email,
                        `🔄 Remarketing Realizado - ${item.produto_nome}`,
                        `
                            <h2>Remarketing Realizado</h2>
                            <p>Olá ${nomeVendedor},</p>
                            <p>Realizamos remarketing da venda do produto <strong>"${item.produto_nome}"</strong> no nosso sistema de ofertas para aumentar as conversões.</p>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <h3>Detalhes:</h3>
                                <ul>
                                    <li><strong>Cliente:</strong> ${item.cliente_nome}</li>
                                    <li><strong>Contato:</strong> ${contatoCliente}</li>
                                    <li><strong>Produto:</strong> ${item.produto_nome}</li>
                                </ul>
                            </div>
                            
                            <p>O sistema enviou automaticamente uma mensagem de remarketing para o cliente, incentivando-o a finalizar a compra.</p>
                            
                            <p>Obrigado por usar RatixPay!</p>
                        `,
                        'sistema'
                    );
                    sucessoEmailVendedor = true;
                    console.log(`✅ Vendedor notificado via email com sucesso: ${vendedor.email}`);
                } catch (error) {
                    console.error(`⚠️ Erro ao enviar email para vendedor:`, error.message);
                }
            } else {
                console.log(`ℹ️ Vendedor não tem email para notificação`);
            }

            // Log resumo
            if (sucessoWhatsAppVendedor || sucessoEmailVendedor) {
                console.log(`✅ Notificação de remarketing enviada ao vendedor - WhatsApp: ${sucessoWhatsAppVendedor ? 'Sim' : 'Não'}, Email: ${sucessoEmailVendedor ? 'Sim' : 'Não'}`);
            } else {
                console.log(`⚠️ Nenhuma notificação foi enviada ao vendedor (sem telefone e sem email)`);
            }

        } catch (error) {
            console.error(`❌ Erro ao notificar vendedor sobre remarketing:`, error);
            throw error;
        }
    }

    /**
     * Prepara mensagem padrão de remarketing para WhatsApp
     * @param {string} nomeCliente - Nome do cliente
     * @param {string} nomeProduto - Nome do produto
     * @param {string} linkCheckout - Link do checkout
     * @returns {string} Mensagem formatada
     */
    prepararMensagem(nomeCliente, nomeProduto, linkCheckout) {
        // Número de suporte (apenas número, sem link)
        const numeroSuporte = '862177274';
        
        // Mensagem conforme estrutura solicitada
        // O link do produto será automaticamente clicável no WhatsApp (URL completa)
        return `Olá ${nomeCliente}! Notamos que você demonstrou interesse em *${nomeProduto}* mas não finalizou a compra. Finalize a sua compra e aproveite, pois esta oferta pode não estar mais disponível, aproveite!

Acesse o link abaixo:
${linkCheckout}

Caso tenha algum problema ou dúvida fale com o suporte: ${numeroSuporte}`;
    }

    /**
     * Marca item como enviado
     * @param {string} queueId - ID do item na fila
     */
    async marcarComoEnviado(queueId) {
        await sequelize.query(
            `UPDATE ${this.tableName}
             SET status = 'enviado',
                 data_envio = NOW(),
                 updated_at = NOW()
             WHERE id = :id`,
            {
                replacements: { id: queueId }
            }
        );
    }

    /**
     * Marca item como ignorado
     * @param {string} queueId - ID do item na fila
     * @param {string} motivo - Motivo da ignorância
     */
    async marcarComoIgnorado(queueId, motivo) {
        await sequelize.query(
            `UPDATE ${this.tableName}
             SET status = 'ignorado',
                 motivo_ignorado = :motivo,
                 updated_at = NOW()
             WHERE id = :id`,
            {
                replacements: { id: queueId, motivo }
            }
        );
    }

    /**
     * Obtém estatísticas da fila
     * @returns {Promise<Object>} Estatísticas
     */
    async obterEstatisticas() {
        const [result] = await sequelize.query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'pendente') as pendentes,
                COUNT(*) FILTER (WHERE status = 'enviado') as enviados,
                COUNT(*) FILTER (WHERE status = 'ignorado') as ignorados,
                COUNT(*) as total
             FROM ${this.tableName}`,
            {
                type: sequelize.QueryTypes.SELECT
            }
        );

        return {
            pendentes: parseInt(result.pendentes) || 0,
            enviados: parseInt(result.enviados) || 0,
            ignorados: parseInt(result.ignorados) || 0,
            total: parseInt(result.total) || 0
        };
    }
}

module.exports = new RemarketingService();

