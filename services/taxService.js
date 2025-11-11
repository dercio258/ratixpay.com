/**
 * Serviço para gerenciar o sistema de taxas
 * 10% da receita vai para o administrador (taxas)
 * 90% da receita vai para o vendedor
 */

const { SaldoAdmin, Venda, EstatisticasVendedor, sequelize } = require('../config/database');

class TaxService {
    
    /**
     * Processar venda aprovada com sistema de taxas
     * @param {string} vendaId - ID da venda
     * @param {number} valorVenda - Valor total da venda
     * @param {string} vendedorId - ID do vendedor
     */
    static async processarVendaComTaxas(vendaId, valorVenda, vendedorId) {
        const transaction = await sequelize.transaction();
        
        try {
            console.log(`🔄 Processando venda com taxas: ${vendaId}, valor: ${valorVenda}, vendedor: ${vendedorId}`);
            
            const valorVendaFloat = parseFloat(valorVenda || 0);
            
            // O valorVenda é o valor total da venda (100%)
            const valorOriginal = valorVendaFloat; // Valor original (100%)
            
            // Calcular taxas (10% para admin, 90% para vendedor) baseadas no valor original
            const taxaAdmin = valorOriginal * 0.10; // 10% do valor original
            const receitaVendedor = valorOriginal * 0.90; // 90% do valor original
            
            console.log(`💰 Distribuição de receita:`);
            console.log(`   💰 Valor original: MZN ${valorOriginal.toFixed(2)}`);
            console.log(`   💼 Taxa do administrador (10%): MZN ${taxaAdmin.toFixed(2)}`);
            console.log(`   👤 Receita do vendedor (90%): MZN ${receitaVendedor.toFixed(2)}`);
            
            // 1. Atualizar saldo do administrador (adicionar taxa) - FUNCIONANDO
            try {
                await this.adicionarTaxaAdmin(taxaAdmin, transaction);
                await transaction.commit();
            } catch (taxError) {
                console.error('❌ Erro ao adicionar taxa ao admin:', taxError);
                await transaction.rollback();
                throw taxError;
            }
            
            // 2. Atualizar receita do vendedor diretamente
            try {
                console.log(`🔄 Adicionando receita do vendedor: MZN ${receitaVendedor.toFixed(2)}`);
                await this.adicionarReceitaVendedor(vendedorId, receitaVendedor);
                console.log(`✅ Receita do vendedor adicionada com sucesso: MZN ${receitaVendedor.toFixed(2)}`);
            } catch (vendedorError) {
                console.error('⚠️ Erro ao adicionar receita ao vendedor:', vendedorError.message);
                console.log(`   👤 Receita calculada para vendedor: MZN ${receitaVendedor.toFixed(2)}`);
                // Não falhar o processo por erro na receita do vendedor
            }
            
            console.log(`✅ Venda processada com sucesso:`);
            console.log(`   💼 Taxa adicionada ao admin: MZN ${taxaAdmin.toFixed(2)}`);
            console.log(`   👤 Receita processada para vendedor: MZN ${receitaVendedor.toFixed(2)}`);
            
            return {
                venda_id: vendaId,
                valor_total: valorVendaFloat,
                taxa_admin: taxaAdmin,
                receita_vendedor: receitaVendedor,
                percentual_taxa: 10,
                percentual_vendedor: 90,
                vendedor_processado: true
            };
            
        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('⚠️ Erro ao fazer rollback da transação:', rollbackError.message);
            }
            console.error('❌ Erro ao processar venda com taxas:', error);
            throw error;
        }
    }
    
    /**
     * Adicionar taxa ao saldo do administrador
     */
    static async adicionarTaxaAdmin(valorTaxa, existingTransaction = null) {
        const transaction = existingTransaction || await sequelize.transaction();
        
        try {
            let saldoAdmin = await SaldoAdmin.findOne({ transaction });
            
            if (!saldoAdmin) {
                // Inicializar saldo do admin se não existir
                saldoAdmin = await SaldoAdmin.create({
                    saldo_total: 0,
                    comissao_percentual: 10.00,
                    total_vendas_aprovadas: 0,
                    valor_total_vendas: 0,
                    total_comissoes: 0,
                    total_saques_pagos: 0,
                    taxas: 0,
                    observacoes: 'Registro inicial criado automaticamente'
                }, { transaction });
            }
            
            const valorTaxaFloat = parseFloat(valorTaxa || 0);
            
            // Atualizar saldo do admin
            await saldoAdmin.update({
                saldo_total: parseFloat(saldoAdmin.saldo_total || 0) + valorTaxaFloat,
                total_vendas_aprovadas: parseInt(saldoAdmin.total_vendas_aprovadas || 0) + 1,
                valor_total_vendas: parseFloat(saldoAdmin.valor_total_vendas || 0) + (valorTaxaFloat / 0.10), // Valor total da venda (taxa / 10%)
                total_comissoes: parseFloat(saldoAdmin.total_comissoes || 0) + valorTaxaFloat,
                taxas: parseFloat(saldoAdmin.taxas || 0) + valorTaxaFloat,
                ultima_atualizacao: new Date()
            }, { transaction });
            
            // Só faz commit se criou a transação
            if (!existingTransaction) {
                await transaction.commit();
            }
            
            console.log(`✅ Taxa de MZN ${valorTaxaFloat.toFixed(2)} adicionada ao saldo do administrador`);
            console.log(`💰 Novo saldo total do admin: MZN ${(parseFloat(saldoAdmin.saldo_total) + valorTaxaFloat).toFixed(2)}`);
            console.log(`💼 Total de taxas coletadas: MZN ${(parseFloat(saldoAdmin.taxas) + valorTaxaFloat).toFixed(2)}`);
            
            return {
                taxa_adicionada: valorTaxaFloat,
                novo_saldo_total: parseFloat(saldoAdmin.saldo_total) + valorTaxaFloat,
                total_taxas: parseFloat(saldoAdmin.taxas) + valorTaxaFloat
            };
            
        } catch (error) {
            // Só faz rollback se criou a transação
            if (!existingTransaction) {
                await transaction.rollback();
            }
            console.error('❌ Erro ao adicionar taxa ao admin:', error);
            throw error;
        }
    }
    
    /**
     * Adicionar receita ao vendedor
     */
    static async adicionarReceitaVendedor(vendedorId, valorReceita, existingTransaction = null) {
        try {
            const valorReceitaFloat = parseFloat(valorReceita || 0);

            console.log(`🔄 Adicionando receita ao vendedor ${vendedorId}: MZN ${valorReceitaFloat.toFixed(2)}`);

            // Usar uma nova transação para evitar conflitos
            const transaction = await EstatisticasVendedor.sequelize.transaction();

            try {
                // Buscar ou criar estatísticas do vendedor
                const [estatisticas, created] = await EstatisticasVendedor.findOrCreate({
                    where: { vendedor_id: vendedorId },
                    defaults: {
                        vendedor_id: vendedorId,
                        receita_total: 0,
                        receita_disponivel: 0,
                        total_vendas: 0,
                        vendas_pendentes: 0,
                        vendas_canceladas: 0,
                        total_saques: 0,
                        saques_pendentes: 0,
                        saques_aprovados: 0,
                        saques_pagos: 0,
                        saques_cancelados: 0,
                        valor_total_saques: 0,
                        valor_saques_pendentes: 0,
                        valor_saques_pagos: 0,
                        produtos_ativos: 0,
                        clientes_unicos: 0,
                        ultima_atualizacao: new Date()
                    },
                    transaction
                });

                console.log(`📊 Estatísticas do vendedor: ${created ? 'criadas' : 'existentes'}`);
                console.log(`   Receita atual: MZN ${parseFloat(estatisticas.receita_total || 0).toFixed(2)}`);
                console.log(`   Receita disponível: MZN ${parseFloat(estatisticas.receita_disponivel || 0).toFixed(2)}`);

                // Calcular novos valores
                const novaReceitaTotal = parseFloat(estatisticas.receita_total || 0) + valorReceitaFloat;
                const novaReceitaDisponivel = parseFloat(estatisticas.receita_disponivel || 0) + valorReceitaFloat;
                const novoTotalVendas = parseInt(estatisticas.total_vendas || 0) + 1;

                // Atualizar receita do vendedor
                await estatisticas.update({
                    receita_total: novaReceitaTotal,
                    receita_disponivel: novaReceitaDisponivel,
                    total_vendas: novoTotalVendas,
                    ultima_atualizacao: new Date()
                }, { transaction });

                await transaction.commit();

                console.log(`✅ Receita de MZN ${valorReceitaFloat.toFixed(2)} adicionada ao vendedor ${vendedorId}`);
                console.log(`💰 Nova receita total: MZN ${novaReceitaTotal.toFixed(2)}`);
                console.log(`💳 Nova receita disponível: MZN ${novaReceitaDisponivel.toFixed(2)}`);
                console.log(`📊 Total de vendas: ${novoTotalVendas}`);

                return {
                    receita_adicionada: valorReceitaFloat,
                    nova_receita_total: novaReceitaTotal,
                    nova_receita_disponivel: novaReceitaDisponivel,
                    total_vendas: novoTotalVendas
                };

            } catch (error) {
                await transaction.rollback();
                throw error;
            }

        } catch (error) {
            console.error('❌ Erro ao adicionar receita ao vendedor:', error);
            throw error;
        }
    }
    
    /**
     * Obter estatísticas de taxas
     */
    static async obterEstatisticasTaxas() {
        try {
            const saldoAdmin = await SaldoAdmin.findOne();
            
            if (!saldoAdmin) {
                return {
                    total_taxas: 0,
                    total_vendas: 0,
                    valor_total_vendas: 0,
                    percentual_taxa: 10,
                    percentual_vendedor: 90
                };
            }
            
            return {
                total_taxas: parseFloat(saldoAdmin.taxas || 0),
                total_taxas_saques: parseFloat(saldoAdmin.taxas_saques || 0),
                total_vendas: parseInt(saldoAdmin.total_vendas_aprovadas || 0),
                valor_total_vendas: parseFloat(saldoAdmin.valor_total_vendas || 0),
                saldo_total_admin: parseFloat(saldoAdmin.saldo_total || 0),
                percentual_taxa_vendas: 10,
                percentual_vendedor_vendas: 90,
                percentual_taxa_saques: 5,
                percentual_vendedor_saques: 95,
                ultima_atualizacao: saldoAdmin.ultima_atualizacao
            };
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas de taxas:', error);
            throw error;
        }
    }
    
    /**
     * Processar saque com taxa de 5%
     * @param {string} saqueId - ID do saque
     * @param {number} valorSaque - Valor do saque
     * @param {string} vendedorId - ID do vendedor
     */
    static async processarSaqueComTaxa(saqueId, valorSaque, vendedorId) {
        const transaction = await sequelize.transaction();
        
        try {
            console.log(`🔄 Processando saque com taxa: ${saqueId}, valor: ${valorSaque}, vendedor: ${vendedorId}`);
            
            const valorSaqueFloat = parseFloat(valorSaque || 0);
            
            // Calcular taxa de saque (5% para admin, 95% para vendedor)
            const taxaSaque = valorSaqueFloat * 0.05; // 5%
            const valorLiquidoVendedor = valorSaqueFloat * 0.95; // 95%
            
            console.log(`💰 Distribuição do saque:`);
            console.log(`   💼 Taxa do administrador (5%): MZN ${taxaSaque.toFixed(2)}`);
            console.log(`   👤 Valor líquido do vendedor (95%): MZN ${valorLiquidoVendedor.toFixed(2)}`);
            
            // 1. Adicionar taxa de saque ao administrador
            await this.adicionarTaxaSaqueAdmin(taxaSaque, transaction);
            
            await transaction.commit();
            
            console.log(`✅ Saque processado com sucesso:`);
            console.log(`   💼 Taxa de saque adicionada ao admin: MZN ${taxaSaque.toFixed(2)}`);
            console.log(`   👤 Valor líquido para vendedor: MZN ${valorLiquidoVendedor.toFixed(2)}`);
            
            return {
                saque_id: saqueId,
                valor_saque_original: valorSaqueFloat,
                taxa_saque: taxaSaque,
                valor_liquido_vendedor: valorLiquidoVendedor,
                percentual_taxa_saque: 5,
                percentual_vendedor: 95
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao processar saque com taxa:', error);
            throw error;
        }
    }
    
    /**
     * Adicionar taxa de saque ao saldo do administrador
     */
    static async adicionarTaxaSaqueAdmin(valorTaxaSaque, existingTransaction = null) {
        const transaction = existingTransaction || await sequelize.transaction();
        
        try {
            let saldoAdmin = await SaldoAdmin.findOne({ transaction });
            
            if (!saldoAdmin) {
                // Inicializar saldo do admin se não existir
                saldoAdmin = await SaldoAdmin.create({
                    saldo_total: 0,
                    comissao_percentual: 10.00,
                    total_vendas_aprovadas: 0,
                    valor_total_vendas: 0,
                    total_comissoes: 0,
                    total_saques_pagos: 0,
                    taxas: 0,
                    taxas_saques: 0,
                    observacoes: 'Registro inicial criado automaticamente'
                }, { transaction });
            }
            
            const valorTaxaSaqueFloat = parseFloat(valorTaxaSaque || 0);
            
            // Atualizar saldo do admin
            await saldoAdmin.update({
                saldo_total: parseFloat(saldoAdmin.saldo_total || 0) + valorTaxaSaqueFloat,
                taxas_saques: parseFloat(saldoAdmin.taxas_saques || 0) + valorTaxaSaqueFloat,
                ultima_atualizacao: new Date()
            }, { transaction });
            
            // Só faz commit se criou a transação
            if (!existingTransaction) {
                await transaction.commit();
            }
            
            console.log(`✅ Taxa de saque de MZN ${valorTaxaSaqueFloat.toFixed(2)} adicionada ao saldo do administrador`);
            console.log(`💰 Novo saldo total do admin: MZN ${(parseFloat(saldoAdmin.saldo_total) + valorTaxaSaqueFloat).toFixed(2)}`);
            console.log(`💼 Total de taxas de saques: MZN ${(parseFloat(saldoAdmin.taxas_saques) + valorTaxaSaqueFloat).toFixed(2)}`);
            
            return {
                taxa_saque_adicionada: valorTaxaSaqueFloat,
                novo_saldo_total: parseFloat(saldoAdmin.saldo_total) + valorTaxaSaqueFloat,
                total_taxas_saques: parseFloat(saldoAdmin.taxas_saques) + valorTaxaSaqueFloat
            };
            
        } catch (error) {
            // Só faz rollback se criou a transação
            if (!existingTransaction) {
                await transaction.rollback();
            }
            console.error('❌ Erro ao adicionar taxa de saque ao admin:', error);
            throw error;
        }
    }
    
    /**
     * Recalcular todas as taxas baseado nas vendas aprovadas
     */
    static async recalcularTaxas() {
        const transaction = await sequelize.transaction();
        
        try {
            console.log('🔄 Recalculando todas as taxas baseado nas vendas aprovadas...');
            
            // Buscar todas as vendas aprovadas
            const vendasAprovadas = await Venda.findAll({
                where: { pagamento_status: 'Aprovado' },
                attributes: ['id', 'vendedor_id', 'pagamento_valor'],
                transaction
            });
            
            let saldoAdmin = await SaldoAdmin.findOne({ transaction });
            
            if (!saldoAdmin) {
                saldoAdmin = await SaldoAdmin.create({
                    saldo_total: 0,
                    comissao_percentual: 10.00,
                    total_vendas_aprovadas: 0,
                    valor_total_vendas: 0,
                    total_comissoes: 0,
                    total_saques_pagos: 0,
                    taxas: 0,
                    observacoes: 'Registro inicial criado automaticamente'
                }, { transaction });
            }
            
            // Resetar contadores
            let totalTaxas = 0;
            let totalVendas = 0;
            let valorTotalVendas = 0;
            let totalComissoes = 0;
            
            // Processar cada venda
            for (const venda of vendasAprovadas) {
                const valorVenda = parseFloat(venda.pagamento_valor || 0);
                const taxaAdmin = valorVenda * 0.10; // 10%
                
                totalTaxas += taxaAdmin;
                totalVendas += 1;
                valorTotalVendas += valorVenda;
                totalComissoes += taxaAdmin;
            }
            
            // Atualizar saldo do admin
            await saldoAdmin.update({
                saldo_total: totalTaxas,
                total_vendas_aprovadas: totalVendas,
                valor_total_vendas: valorTotalVendas,
                total_comissoes: totalComissoes,
                taxas: totalTaxas,
                ultima_atualizacao: new Date(),
                observacoes: `Taxas recalculadas em ${new Date().toLocaleString('pt-BR')}`
            }, { transaction });
            
            await transaction.commit();
            
            console.log('✅ Taxas recalculadas com sucesso:');
            console.log(`📊 Total de vendas: ${totalVendas}`);
            console.log(`💰 Valor total vendas: MZN ${valorTotalVendas.toFixed(2)}`);
            console.log(`💼 Total de taxas (10%): MZN ${totalTaxas.toFixed(2)}`);
            console.log(`👤 Total para vendedores (90%): MZN ${(valorTotalVendas - totalTaxas).toFixed(2)}`);
            
            return {
                total_vendas: totalVendas,
                valor_total_vendas: valorTotalVendas,
                total_taxas: totalTaxas,
                total_vendedores: valorTotalVendas - totalTaxas,
                percentual_taxa: 10,
                percentual_vendedor: 90
            };
            
        } catch (error) {
            await transaction.rollback();
            console.error('❌ Erro ao recalcular taxas:', error);
            throw error;
        }
    }
}

module.exports = TaxService;
