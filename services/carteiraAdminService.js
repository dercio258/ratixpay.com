/**
 * Serviço para gerenciar carteiras do administrador (M-Pesa e Emola)
 */

const { CarteiraAdmin, sequelize } = require('../config/database');

class CarteiraAdminService {
    
    /**
     * Inicializar carteiras do admin se não existirem
     */
    static async inicializarCarteiras() {
        try {
            // Verificar se já existem
            const carteiras = await CarteiraAdmin.findAll();
            
            if (carteiras.length >= 2) {
                return; // Já existem
            }
            
            // Criar carteira M-Pesa se não existir
            const mpesa = await CarteiraAdmin.findOne({ where: { tipo: 'mpesa' } });
            if (!mpesa) {
                await CarteiraAdmin.create({
                    tipo: 'mpesa',
                    nome: 'Carteira M-Pesa',
                    contacto: '',
                    nome_titular: 'Administrador',
                    email: null,
                    saldo: 0,
                    ativa: true
                });
                console.log('✅ Carteira M-Pesa criada');
            }
            
            // Criar carteira Emola se não existir
            const emola = await CarteiraAdmin.findOne({ where: { tipo: 'emola' } });
            if (!emola) {
                await CarteiraAdmin.create({
                    tipo: 'emola',
                    nome: 'Carteira Emola',
                    contacto: '',
                    nome_titular: 'Administrador',
                    email: null,
                    saldo: 0,
                    ativa: true
                });
                console.log('✅ Carteira Emola criada');
            }
            
        } catch (error) {
            console.error('❌ Erro ao inicializar carteiras do admin:', error);
            throw error;
        }
    }
    
    /**
     * Buscar todas as carteiras do admin
     */
    static async buscarCarteiras() {
        try {
            await this.inicializarCarteiras();
            
            const carteiras = await CarteiraAdmin.findAll({
                order: [['tipo', 'ASC']]
            });
            
            return carteiras.map(c => ({
                id: c.id,
                tipo: c.tipo,
                nome: c.nome,
                contacto: c.contacto,
                nome_titular: c.nome_titular,
                email: c.email,
                saldo: parseFloat(c.saldo || 0),
                ativa: c.ativa,
                observacoes: c.observacoes,
                created_at: c.created_at,
                updated_at: c.updated_at
            }));
        } catch (error) {
            console.error('❌ Erro ao buscar carteiras do admin:', error);
            throw error;
        }
    }
    
    /**
     * Buscar carteira por tipo
     */
    static async buscarCarteiraPorTipo(tipo) {
        try {
            await this.inicializarCarteiras();
            
            const carteira = await CarteiraAdmin.findOne({ where: { tipo } });
            
            if (!carteira) {
                throw new Error(`Carteira ${tipo} não encontrada`);
            }
            
            return {
                id: carteira.id,
                tipo: carteira.tipo,
                nome: carteira.nome,
                contacto: carteira.contacto,
                nome_titular: carteira.nome_titular,
                email: carteira.email,
                saldo: parseFloat(carteira.saldo || 0),
                ativa: carteira.ativa,
                observacoes: carteira.observacoes
            };
        } catch (error) {
            console.error(`❌ Erro ao buscar carteira ${tipo}:`, error);
            throw error;
        }
    }
    
    /**
     * Atualizar carteira
     */
    static async atualizarCarteira(tipo, dados) {
        try {
            const carteira = await CarteiraAdmin.findOne({ where: { tipo } });
            
            if (!carteira) {
                throw new Error(`Carteira ${tipo} não encontrada`);
            }
            
            await carteira.update({
                nome: dados.nome || carteira.nome,
                contacto: dados.contacto !== undefined ? dados.contacto : carteira.contacto,
                nome_titular: dados.nome_titular || carteira.nome_titular,
                email: dados.email !== undefined ? dados.email : carteira.email,
                ativa: dados.ativa !== undefined ? dados.ativa : carteira.ativa,
                observacoes: dados.observacoes !== undefined ? dados.observacoes : carteira.observacoes
            });
            
            return await this.buscarCarteiraPorTipo(tipo);
        } catch (error) {
            console.error(`❌ Erro ao atualizar carteira ${tipo}:`, error);
            throw error;
        }
    }
    
    /**
     * Adicionar saldo à carteira
     */
    static async adicionarSaldo(tipo, valor, observacao = null) {
        try {
            const carteira = await CarteiraAdmin.findOne({ where: { tipo } });
            
            if (!carteira) {
                throw new Error(`Carteira ${tipo} não encontrada`);
            }
            
            const novoSaldo = parseFloat(carteira.saldo || 0) + parseFloat(valor);
            
            await carteira.update({
                saldo: novoSaldo,
                observacoes: observacao || carteira.observacoes
            });
            
            return await this.buscarCarteiraPorTipo(tipo);
        } catch (error) {
            console.error(`❌ Erro ao adicionar saldo à carteira ${tipo}:`, error);
            throw error;
        }
    }
    
    /**
     * Subtrair saldo da carteira
     */
    static async subtrairSaldo(tipo, valor, observacao = null) {
        try {
            const carteira = await CarteiraAdmin.findOne({ where: { tipo } });
            
            if (!carteira) {
                throw new Error(`Carteira ${tipo} não encontrada`);
            }
            
            const saldoAtual = parseFloat(carteira.saldo || 0);
            const valorSubtrair = parseFloat(valor);
            
            if (saldoAtual < valorSubtrair) {
                throw new Error(`Saldo insuficiente na carteira ${tipo}. Saldo atual: ${saldoAtual}, Valor solicitado: ${valorSubtrair}`);
            }
            
            const novoSaldo = saldoAtual - valorSubtrair;
            
            await carteira.update({
                saldo: novoSaldo,
                observacoes: observacao || carteira.observacoes
            });
            
            return await this.buscarCarteiraPorTipo(tipo);
        } catch (error) {
            console.error(`❌ Erro ao subtrair saldo da carteira ${tipo}:`, error);
            throw error;
        }
    }
    
    /**
     * Obter resumo financeiro
     */
    static async obterResumoFinanceiro() {
        try {
            const carteiras = await this.buscarCarteiras();
            
            const mpesa = carteiras.find(c => c.tipo === 'mpesa');
            const emola = carteiras.find(c => c.tipo === 'emola');
            
            const saldoTotal = (mpesa?.saldo || 0) + (emola?.saldo || 0);
            
            return {
                carteiras: {
                    mpesa: mpesa || null,
                    emola: emola || null
                },
                saldo_total: saldoTotal,
                total_carteiras: carteiras.length
            };
        } catch (error) {
            console.error('❌ Erro ao obter resumo financeiro:', error);
            throw error;
        }
    }
}

module.exports = CarteiraAdminService;

