/**
 * Serviço para gerenciar o saldo do administrador
 * O saldo é baseado em comissões das vendas aprovadas
 */

const { SaldoAdmin, Venda, Pagamento, sequelize } = require('../config/database');

class SaldoAdminService {
    
    /**
     * Inicializar registro de saldo do admin se não existir
     */
    static async inicializarSaldo() {
        try {
            // Usar SQL direto para evitar buscar coluna inexistente vendedor_id
            const [results] = await sequelize.query(
                'SELECT id FROM saldo_admin LIMIT 1',
                { type: sequelize.QueryTypes.SELECT, raw: true }
            );
            
            if (results && results.length > 0) {
                return; // Já existe
            }
            
            // Criar usando SQL direto
            console.log('🔄 Criando registro inicial de saldo do admin...');
            await sequelize.query(
                `INSERT INTO saldo_admin (id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                 valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                 observacoes, created_at, updated_at) 
                 VALUES (gen_random_uuid(), 0, 10.00, 0, 0, 0, 0, 0, 0, 
                 'Registro inicial criado automaticamente', NOW(), NOW())`,
                { type: sequelize.QueryTypes.INSERT }
            );
            console.log('✅ Registro de saldo do admin criado');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar saldo do admin:', error);
            throw error;
        }
    }
    
    /**
     * Buscar saldo atual do admin
     */
    static async buscarSaldo() {
        try {
            // Usar SQL direto para evitar buscar coluna inexistente vendedor_id
            const [results] = await sequelize.query(
                `SELECT id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                 valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                 ultima_atualizacao, observacoes 
                 FROM saldo_admin LIMIT 1`,
                { type: sequelize.QueryTypes.SELECT, raw: true }
            );
            
            if (!results || results.length === 0) {
                await this.inicializarSaldo();
                // Buscar novamente após criar
                const [newResults] = await sequelize.query(
                    `SELECT id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                     valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                     ultima_atualizacao, observacoes 
                     FROM saldo_admin LIMIT 1`,
                    { type: sequelize.QueryTypes.SELECT, raw: true }
                );
                
                if (newResults && newResults.length > 0) {
                    const saldoAdmin = newResults[0];
                    return {
                        saldo_total: parseFloat(saldoAdmin.saldo_total || 0),
                        comissao_percentual: parseFloat(saldoAdmin.comissao_percentual || 10),
                        total_vendas_aprovadas: parseInt(saldoAdmin.total_vendas_aprovadas || 0),
                        valor_total_vendas: parseFloat(saldoAdmin.valor_total_vendas || 0),
                        total_comissoes: parseFloat(saldoAdmin.total_comissoes || 0),
                        total_saques_pagos: parseFloat(saldoAdmin.total_saques_pagos || 0),
                        taxas: parseFloat(saldoAdmin.taxas || 0),
                        taxas_saques: parseFloat(saldoAdmin.taxas_saques || 0),
                        ultima_atualizacao: saldoAdmin.ultima_atualizacao,
                        observacoes: saldoAdmin.observacoes
                    };
                }
            } else {
                const saldoAdmin = results[0];
            return {
                saldo_total: parseFloat(saldoAdmin.saldo_total || 0),
                comissao_percentual: parseFloat(saldoAdmin.comissao_percentual || 10),
                total_vendas_aprovadas: parseInt(saldoAdmin.total_vendas_aprovadas || 0),
                valor_total_vendas: parseFloat(saldoAdmin.valor_total_vendas || 0),
                total_comissoes: parseFloat(saldoAdmin.total_comissoes || 0),
                total_saques_pagos: parseFloat(saldoAdmin.total_saques_pagos || 0),
                taxas: parseFloat(saldoAdmin.taxas || 0),
                taxas_saques: parseFloat(saldoAdmin.taxas_saques || 0),
                ultima_atualizacao: saldoAdmin.ultima_atualizacao,
                observacoes: saldoAdmin.observacoes
                };
            }
            
            // Fallback
            return {
                saldo_total: 0,
                comissao_percentual: 10.00,
                total_vendas_aprovadas: 0,
                valor_total_vendas: 0,
                total_comissoes: 0,
                total_saques_pagos: 0,
                taxas: 0,
                taxas_saques: 0,
                ultima_atualizacao: null,
                observacoes: null
            };
        } catch (error) {
            console.error('❌ Erro ao buscar saldo do admin:', error);
            throw error;
        }
    }
    
    /**
     * Processar venda aprovada - NOVO SISTEMA DE TAXAS
     * 10% vai para o administrador (taxas)
     * 90% vai para o vendedor
     */
    static async processarVendaAprovada(vendaId, valorVenda, vendedorId = null) {
        try {
            console.log(`🔄 Processando venda aprovada com sistema de taxas: ${vendaId}, valor: ${valorVenda}`);
            
            // Se não tiver vendedorId, buscar na venda
            if (!vendedorId) {
                const venda = await Venda.findByPk(vendaId);
                if (!venda) {
                    throw new Error('Venda não encontrada');
                }
                vendedorId = venda.vendedor_id;
            }
            
            // Usar o novo serviço de taxas
            const TaxService = require('./taxService');
            const resultado = await TaxService.processarVendaComTaxas(vendaId, valorVenda, vendedorId);
            
            console.log(`✅ Venda processada com sistema de taxas:`);
            console.log(`   💼 Taxa do administrador (10%): MZN ${resultado.taxa_admin.toFixed(2)}`);
            console.log(`   👤 Receita do vendedor (90%): MZN ${resultado.receita_vendedor.toFixed(2)}`);
            
            return {
                receita_transferida: valorVenda,
                taxa_admin: resultado.taxa_admin,
                receita_vendedor: resultado.receita_vendedor,
                tipo_transferencia: 'sistema_taxas_90_10'
            };
            
        } catch (error) {
            console.error('❌ Erro ao processar venda aprovada com taxas:', error);
            throw error;
        }
    }
    
    /**
     * Processar saque pago - NOVO SISTEMA DE TAXAS DE SAQUES
     * 5% do valor do saque vai para o administrador como taxa
     * 95% do valor do saque é processado para o vendedor
     */
    static async processarSaquePago(saqueId, valorSaque, existingTransaction = null) {
        // IMPORTANTE: Buscar e criar SaldoAdmin SEM transação para evitar conflitos 25P02
        // Depois atualizamos dentro da transação fornecida ou criamos uma nova
        
        try {
            console.log(`🔄 Processando saque pago com taxa: ${saqueId}, valor: ${valorSaque}`);
            
            // IMPORTANTE: Buscar/criar SaldoAdmin usando conexão completamente nova do pool
            // Isso garante que não há transação pendente interferindo
            let saldoAdmin;
            let saldoData = null;
            
            // Obter uma conexão nova do pool (bypassa qualquer transação pendente)
            const connection = await sequelize.connectionManager.getConnection();
            
            try {
                // Buscar saldo admin completo usando conexão nova (todos os campos necessários)
                const [results] = await sequelize.query(
                    `SELECT id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                     valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                     ultima_atualizacao, observacoes, created_at, updated_at 
                     FROM saldo_admin LIMIT 1`,
                    { 
                        bind: null,
                        type: sequelize.QueryTypes.SELECT,
                        raw: true,
                        // Usar conexão específica (não a conexão padrão que pode ter transação)
                        connection: connection
                    }
                );
                
                if (results && results.length > 0) {
                    saldoData = results[0];
                } else {
                    // Criar saldo usando conexão nova
                    console.log('🔄 Criando registro inicial de saldo do admin (SQL direto)...');
                    await sequelize.query(
                        `INSERT INTO saldo_admin (id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                         valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                         observacoes, created_at, updated_at) 
                         VALUES (gen_random_uuid(), 0, 10.00, 0, 0, 0, 0, 0, 0, 
                         'Registro inicial criado automaticamente', NOW(), NOW())`,
                        { 
                            bind: null,
                            type: sequelize.QueryTypes.INSERT,
                            raw: true,
                            connection: connection
                        }
                    );
                    console.log('✅ Registro de saldo do admin criado via SQL direto');
                    
                    // Buscar o registro recém-criado usando a mesma conexão
                    const [newResults] = await sequelize.query(
                        `SELECT id, saldo_total, comissao_percentual, total_vendas_aprovadas, 
                         valor_total_vendas, total_comissoes, total_saques_pagos, taxas, taxas_saques, 
                         ultima_atualizacao, observacoes, created_at, updated_at 
                         FROM saldo_admin LIMIT 1`,
                        { 
                            bind: null,
                            type: sequelize.QueryTypes.SELECT,
                            raw: true,
                            connection: connection
                        }
                    );
                    
                    if (newResults && newResults.length > 0) {
                        saldoData = newResults[0];
                    }
                }
                
                // Liberar conexão de volta ao pool
                sequelize.connectionManager.releaseConnection(connection);
                
                // Manter apenas como objeto simples (não usar Sequelize build/instance)
                // Isso evita que o Sequelize tente buscar colunas inexistentes
                if (saldoData && saldoData.id) {
                    saldoAdmin = saldoData; // Usar objeto simples, não instância Sequelize
                }
                
            } catch (queryError) {
                // Liberar conexão em caso de erro
                sequelize.connectionManager.releaseConnection(connection);
                console.error('❌ Erro ao buscar/criar saldo admin via SQL direto:', queryError.message);
                throw queryError;
            }
            
            // Se ainda não encontrou, lançar erro
            if (!saldoAdmin) {
                throw new Error('Não foi possível encontrar ou criar o registro de saldo do admin');
            }
            
            const valorSaqueFloat = parseFloat(valorSaque || 0);
            
            // Calcular taxa de saque (5% para admin, 95% para vendedor)
            const taxaSaque = valorSaqueFloat * 0.05; // 5%
            const valorLiquidoVendedor = valorSaqueFloat * 0.95; // 95%
            
            console.log(`💰 Distribuição do saque:`);
            console.log(`   💼 Taxa do administrador (5%): MZN ${taxaSaque.toFixed(2)}`);
            console.log(`   👤 Valor líquido do vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`);
            
            // Criar transação apenas se não foi fornecida
            const transaction = existingTransaction || await sequelize.transaction();
            
            try {
                // Atualizar saldo do admin usando SQL direto para evitar problemas com colunas inexistentes
                const novoSaldoTotal = parseFloat(saldoAdmin.saldo_total || 0) + taxaSaque;
                const novoTotalSaquesPagos = parseFloat(saldoAdmin.total_saques_pagos || 0) + valorLiquidoVendedor;
                const novoTaxasSaques = parseFloat(saldoAdmin.taxas_saques || 0) + taxaSaque;
                
                await sequelize.query(
                    `UPDATE saldo_admin 
                     SET saldo_total = :saldo_total,
                         total_saques_pagos = :total_saques_pagos,
                         taxas_saques = :taxas_saques,
                         ultima_atualizacao = NOW()
                     WHERE id = :id`,
                    {
                        replacements: {
                            saldo_total: novoSaldoTotal,
                            total_saques_pagos: novoTotalSaquesPagos,
                            taxas_saques: novoTaxasSaques,
                            id: saldoAdmin.id
                        },
                        type: sequelize.QueryTypes.UPDATE,
                        transaction: transaction
                    }
                );
                
                // Atualizar os valores no objeto para uso posterior
                saldoAdmin.saldo_total = novoSaldoTotal;
                saldoAdmin.total_saques_pagos = novoTotalSaquesPagos;
                saldoAdmin.taxas_saques = novoTaxasSaques;
            
            // Só faz commit se criou a transação
            if (!existingTransaction) {
                await transaction.commit();
                }
            } catch (updateError) {
                // Rollback apenas se criou a transação (não foi fornecida externamente)
                if (!existingTransaction) {
                    if (transaction && !transaction.finished) {
                        try {
                            await transaction.rollback();
                        } catch (rollbackError) {
                            console.error('⚠️ Erro ao fazer rollback (não crítico):', rollbackError.message);
                        }
                    }
                }
                throw updateError;
            }
            
            console.log(`✅ Saque processado com taxa:`);
            console.log(`   💼 Taxa de saque adicionada: MZN ${taxaSaque.toFixed(2)}`);
            console.log(`   👤 Valor líquido processado: MZN ${valorLiquidoVendedor.toFixed(2)}`);
            console.log(`💰 Novo saldo do admin: MZN ${(parseFloat(saldoAdmin.saldo_total) + taxaSaque).toFixed(2)}`);
            console.log(`💼 Total de taxas de saques: MZN ${(parseFloat(saldoAdmin.taxas_saques) + taxaSaque).toFixed(2)}`);
            
            return {
                valor_saque_original: valorSaqueFloat,
                taxa_saque: taxaSaque,
                valor_liquido_vendedor: valorLiquidoVendedor,
                novo_saldo: parseFloat(saldoAdmin.saldo_total) + taxaSaque,
                total_taxas_saques: parseFloat(saldoAdmin.taxas_saques) + taxaSaque
            };
            
        } catch (error) {
            // Não precisa fazer rollback aqui porque já foi feito no catch interno
            // ou porque a transação não foi criada ainda
            console.error('❌ Erro ao processar saque pago com taxa:', error);
            throw error;
        }
    }
    
    /**
     * Atualizar percentual de comissão (mantido para compatibilidade)
     * NOTA: Agora a receita COMPLETA vai para o admin, não apenas a comissão
     */
    static async atualizarComissao(novoPercentual) {
        try {
            let saldoAdmin = await SaldoAdmin.findOne();
            
            if (!saldoAdmin) {
                saldoAdmin = await this.inicializarSaldo();
            }
            
            await saldoAdmin.update({
                comissao_percentual: parseFloat(novoPercentual),
                ultima_atualizacao: new Date(),
                observacoes: `Percentual de comissão atualizado para ${novoPercentual}% em ${new Date().toLocaleString('pt-BR')} (NOTA: Receita COMPLETA vai para admin)`
            });
            
            console.log(`✅ Percentual de comissão atualizado para ${novoPercentual}%`);
            console.log(`💡 NOTA: A receita COMPLETA das vendas continua indo para o admin, não apenas a comissão`);
            
            return await this.buscarSaldo();
            
        } catch (error) {
            console.error('❌ Erro ao atualizar percentual de comissão:', error);
            throw error;
        }
    }
    
    /**
     * Recalcular saldo baseado em todas as vendas aprovadas
     */
    static async recalcularSaldo() {
        const transaction = await sequelize.transaction();
        
        try {
            console.log('🔄 Recalculando saldo do admin baseado em todas as vendas...');
            
            // Buscar todas as vendas aprovadas
            // Status que indicam aprovação (incluindo APROVADO)
            const { Op } = require('sequelize');
            const statusAprovados = ['Pago', 'pago', 'PAGO', 'Aprovado', 'aprovado', 'APROVADO', 'Aprovada', 'aprovada', 'APROVADA', 'approved', 'paid'];
            
            const vendasAprovadas = await Venda.findAll({
                where: { 
                    [Op.or]: [
                        { status: { [Op.in]: statusAprovados } },
                        { pagamento_status: { [Op.in]: statusAprovados } }
                    ]
                },
                attributes: ['pagamento_valor', 'valor'],
                transaction
            });
            
            // Buscar todos os saques pagos
            const saquesPagos = await Pagamento.findAll({
                where: { status: 'pago' },
                attributes: ['valor_liquido'],
                transaction
            });
            
            let saldoAdmin = await SaldoAdmin.findOne({ transaction });
            
            if (!saldoAdmin) {
                saldoAdmin = await this.inicializarSaldo();
                // Buscar novamente dentro da transação
                saldoAdmin = await SaldoAdmin.findOne({ transaction });
            }
            
            // Calcular totais
            const totalVendas = vendasAprovadas.length;
            const valorTotalVendas = vendasAprovadas.reduce((total, venda) => {
                // Usar 'valor' (campo principal) ou 'pagamento_valor' como fallback
                return total + parseFloat(venda.valor || venda.pagamento_valor || 0);
            }, 0);
            
            // IMPORTANTE: Agora a receita COMPLETA vai para o admin, não apenas a comissão
            const totalComissoes = valorTotalVendas; // Receita completa
            
            const totalSaquesPagos = saquesPagos.reduce((total, saque) => {
                return total + parseFloat(saque.valor_liquido || 0);
            }, 0);
            
            const saldoTotal = totalComissoes - totalSaquesPagos;
            
            // Atualizar registro
            await saldoAdmin.update({
                saldo_total: Math.max(0, saldoTotal),
                total_vendas_aprovadas: totalVendas,
                valor_total_vendas: valorTotalVendas,
                total_comissoes: totalComissoes,
                total_saques_pagos: totalSaquesPagos,
                taxas: totalComissoes, // As taxas são iguais às comissões no sistema atual
                taxas_saques: 0, // Será calculado separadamente se necessário
                ultima_atualizacao: new Date(),
                observacoes: `Saldo recalculado em ${new Date().toLocaleString('pt-BR')}`
            }, { transaction });
            
            await transaction.commit();
            
            console.log('✅ Saldo recalculado com sucesso:');
            console.log(`📊 Total de vendas: ${totalVendas}`);
            console.log(`💰 Valor total vendas: MZN ${valorTotalVendas.toFixed(2)}`);
            console.log(`💼 Total receitas transferidas: MZN ${totalComissoes.toFixed(2)} (RECEITA COMPLETA)`);
            console.log(`💳 Total saques pagos: MZN ${totalSaquesPagos.toFixed(2)}`);
            console.log(`🏦 Saldo final: MZN ${Math.max(0, saldoTotal).toFixed(2)}`);
            console.log(`💡 NOTA: A receita COMPLETA das vendas foi transferida para o admin (não apenas comissão)`);
            
            return await this.buscarSaldo();
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao recalcular saldo:', error);
            throw error;
        }
    }
    
    /**
     * Subtrair valor do saldo do admin (para transferências B2C)
     */
    static async subtrairSaldo(valor, descricao = 'Transferência B2C') {
        try {
            console.log(`🔄 Subtraindo MZN ${valor} do saldo do admin: ${descricao}`);
            
            const transaction = await sequelize.transaction();
            
            try {
                let saldoAdmin = await SaldoAdmin.findOne({ transaction });
                
                if (!saldoAdmin) {
                    saldoAdmin = await this.inicializarSaldo();
                    saldoAdmin = await SaldoAdmin.findOne({ transaction });
                }
                
                const novoSaldo = Math.max(0, parseFloat(saldoAdmin.saldo_total || 0) - parseFloat(valor));
                
                await saldoAdmin.update({
                    saldo_total: novoSaldo,
                    ultima_atualizacao: new Date(),
                    observacoes: `${descricao} - MZN ${valor} subtraído em ${new Date().toLocaleString('pt-BR')}`
                }, { transaction });
                
                await transaction.commit();
                
                console.log(`✅ MZN ${valor} subtraído do saldo do admin. Novo saldo: MZN ${novoSaldo.toFixed(2)}`);
                
                return {
                    saldo_anterior: parseFloat(saldoAdmin.saldo_total || 0),
                    valor_subtraido: parseFloat(valor),
                    saldo_atual: novoSaldo,
                    descricao: descricao
                };
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
            
        } catch (error) {
            console.error('❌ Erro ao subtrair saldo do admin:', error);
            throw error;
        }
    }
}

module.exports = SaldoAdminService;
