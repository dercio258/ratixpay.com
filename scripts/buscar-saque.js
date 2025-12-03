/**
 * Script para buscar informações de um saque específico
 */

const { sequelize, Pagamento } = require('../config/database');

async function buscarSaque() {
    try {
        const saqueId = '7128fe21-697c-4899-8d61-017a82606734';
        
        console.log(`🔍 Buscando saque: ${saqueId}...`);
        
        // Buscar saque
        const saque = await Pagamento.findByPk(saqueId, {
            attributes: [
                'id',
                'public_id',
                'vendedor_id',
                'valor',
                'status',
                'metodo',
                'nome_titular',
                'telefone_titular',
                'conta_destino',
                'banco',
                'data_solicitacao',
                'data_processamento',
                'data_pagamento',
                'observacoes',
                'motivo_rejeicao'
            ]
        });
        
        if (!saque) {
            console.log('❌ Saque não encontrado');
            return;
        }
        
        console.log('\n📋 Informações do Saque:');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`UUID: ${saque.id}`);
        console.log(`Public ID: ${saque.public_id || 'NÃO DEFINIDO'}`);
        console.log(`ID de 6 dígitos (últimos 6 do UUID): ${saque.id.substring(saque.id.length - 6).toUpperCase()}`);
        console.log(`Vendedor ID: ${saque.vendedor_id}`);
        console.log(`Valor: MZN ${parseFloat(saque.valor || 0).toFixed(2)}`);
        console.log(`Status: ${saque.status}`);
        console.log(`Método: ${saque.metodo || 'N/A'}`);
        console.log(`Nome Titular: ${saque.nome_titular || 'N/A'}`);
        console.log(`Telefone Titular: ${saque.telefone_titular || 'N/A'}`);
        console.log(`Conta Destino: ${saque.conta_destino || 'N/A'}`);
        console.log(`Banco: ${saque.banco || 'N/A'}`);
        console.log(`Data Solicitação: ${saque.data_solicitacao || 'N/A'}`);
        console.log(`Data Processamento: ${saque.data_processamento || 'N/A'}`);
        console.log(`Data Pagamento: ${saque.data_pagamento || 'N/A'}`);
        console.log(`Observações: ${saque.observacoes || 'N/A'}`);
        console.log(`Motivo Rejeição: ${saque.motivo_rejeicao || 'N/A'}`);
        console.log('═══════════════════════════════════════════════════════\n');
        
        // Verificar como o admin exibe (últimos 6 caracteres do UUID)
        const idAmigavel = saque.id.substring(saque.id.length - 6).toUpperCase();
        console.log(`🆔 ID que o admin exibe: ${idAmigavel}`);
        console.log(`🆔 Public ID (se existir): ${saque.public_id || 'NÃO DEFINIDO'}`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao buscar saque:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar busca
buscarSaque();

