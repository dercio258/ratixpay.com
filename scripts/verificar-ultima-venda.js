/**
 * Script para verificar informações da última venda no banco de dados
 * Execute: node scripts/verificar-ultima-venda.js
 * 
 * Este script busca a última venda cadastrada e mostra todas as informações,
 * especialmente os campos de data/hora (created_at, updated_at).
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

// Configuração do banco de dados
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: false, // Desabilitar logs do Sequelize para output mais limpo
    dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: false
        } : false
    }
});

async function verificarUltimaVenda() {
    try {
        console.log('🔄 Conectando ao banco de dados...');
        console.log(`📊 Host: ${dbHost}`);
        console.log(`📊 Port: ${dbPort}`);
        console.log(`📊 Database: ${dbName}`);
        console.log(`📊 User: ${dbUser}\n`);
        
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida com sucesso\n');

        // Verificar estrutura da tabela vendas
        console.log('📋 Verificando estrutura da tabela vendas...\n');
        const [columns] = await sequelize.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default,
                character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'vendas' 
            ORDER BY ordinal_position
        `);

        console.log('📊 Colunas da tabela vendas:');
        console.log('─'.repeat(80));
        columns.forEach(col => {
            const maxLength = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            console.log(`  ${col.column_name.padEnd(30)} | ${(col.data_type + maxLength).padEnd(20)} | nullable: ${col.is_nullable.padEnd(3)} | default: ${col.column_default || 'N/A'}`);
        });
        console.log('─'.repeat(80));
        console.log(`Total: ${columns.length} colunas\n`);

        // Verificar se created_at e updated_at existem
        const hasCreatedAt = columns.some(col => col.column_name === 'created_at');
        const hasUpdatedAt = columns.some(col => col.column_name === 'updated_at');

        console.log('🔍 Verificação de timestamps:');
        console.log(`  created_at: ${hasCreatedAt ? '✅ Existe' : '❌ Não existe'}`);
        console.log(`  updated_at: ${hasUpdatedAt ? '✅ Existe' : '❌ Não existe'}\n`);

        // Buscar última venda
        console.log('🔍 Buscando última venda cadastrada...\n');
        
        const [ultimaVenda] = await sequelize.query(`
            SELECT *
            FROM vendas
            ORDER BY 
                CASE 
                    WHEN created_at IS NOT NULL THEN created_at 
                    ELSE '1970-01-01'::timestamp 
                END DESC,
                id DESC
            LIMIT 1
        `);

        if (ultimaVenda.length === 0) {
            console.log('⚠️  Nenhuma venda encontrada no banco de dados.');
            return;
        }

        const venda = ultimaVenda[0];

        console.log('📦 Informações da Última Venda:');
        console.log('═'.repeat(80));
        
        // Informações básicas
        console.log('\n📌 Informações Básicas:');
        console.log(`  ID: ${venda.id}`);
        console.log(`  Public ID: ${venda.public_id || 'N/A'}`);
        console.log(`  Número do Pedido: ${venda.numero_pedido || 'N/A'}`);
        console.log(`  Status: ${venda.status || 'N/A'}`);
        
        // Informações de data/hora
        console.log('\n📅 Informações de Data/Hora:');
        if (venda.created_at) {
            const createdDate = new Date(venda.created_at);
            console.log(`  created_at: ${venda.created_at}`);
            console.log(`             → ${createdDate.toLocaleString('pt-BR', { timeZone: 'UTC' })} (UTC)`);
            console.log(`             → ${createdDate.toLocaleString('pt-BR')} (Local)`);
            console.log(`             → Tipo: ${typeof venda.created_at}`);
        } else {
            console.log(`  created_at: ❌ NULL ou não existe`);
        }

        if (venda.updated_at) {
            const updatedDate = new Date(venda.updated_at);
            console.log(`  updated_at: ${venda.updated_at}`);
            console.log(`             → ${updatedDate.toLocaleString('pt-BR', { timeZone: 'UTC' })} (UTC)`);
            console.log(`             → ${updatedDate.toLocaleString('pt-BR')} (Local)`);
            console.log(`             → Tipo: ${typeof venda.updated_at}`);
        } else {
            console.log(`  updated_at: ❌ NULL ou não existe`);
        }

        if (venda.data_pagamento) {
            const pagamentoDate = new Date(venda.data_pagamento);
            console.log(`  data_pagamento: ${venda.data_pagamento}`);
            console.log(`                 → ${pagamentoDate.toLocaleString('pt-BR')} (Local)`);
        }

        // Informações do produto
        console.log('\n🛍️  Informações do Produto:');
        console.log(`  Produto ID: ${venda.produto_id || 'N/A'}`);
        
        // Informações do cliente
        console.log('\n👤 Informações do Cliente:');
        console.log(`  Nome: ${venda.cliente_nome || 'N/A'}`);
        console.log(`  Email: ${venda.cliente_email || 'N/A'}`);
        console.log(`  Telefone: ${venda.cliente_telefone || 'N/A'}`);
        console.log(`  WhatsApp: ${venda.cliente_whatsapp || 'N/A'}`);

        // Informações de pagamento
        console.log('\n💳 Informações de Pagamento:');
        console.log(`  Valor: MZN ${parseFloat(venda.valor || 0).toFixed(2)}`);
        console.log(`  Valor Vendedor: MZN ${parseFloat(venda.valor_vendedor || 0).toFixed(2)}`);
        console.log(`  Taxa Admin: MZN ${parseFloat(venda.taxa_admin || 0).toFixed(2)}`);
        console.log(`  Método: ${venda.metodo_pagamento || 'N/A'}`);
        console.log(`  Referência: ${venda.referencia_pagamento || 'N/A'}`);

        // Informações de afiliado
        if (venda.afiliado_ref) {
            console.log('\n🤝 Informações de Afiliado:');
            console.log(`  Código: ${venda.afiliado_ref}`);
        }

        // Informações do vendedor
        console.log('\n👨‍💼 Informações do Vendedor:');
        console.log(`  Vendedor ID: ${venda.vendedor_id || 'N/A'}`);

        // Todas as colunas (para debug completo)
        console.log('\n📋 Todas as Colunas (JSON):');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(venda, null, 2));
        console.log('─'.repeat(80));

        // Verificar quantas vendas têm created_at
        console.log('\n📊 Estatísticas:');
        const [stats] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_vendas,
                COUNT(created_at) as vendas_com_created_at,
                COUNT(updated_at) as vendas_com_updated_at,
                COUNT(*) - COUNT(created_at) as vendas_sem_created_at,
                COUNT(*) - COUNT(updated_at) as vendas_sem_updated_at
            FROM vendas
        `);

        if (stats.length > 0) {
            const stat = stats[0];
            console.log(`  Total de vendas: ${stat.total_vendas}`);
            console.log(`  Vendas com created_at: ${stat.vendas_com_created_at} (${((stat.vendas_com_created_at / stat.total_vendas) * 100).toFixed(2)}%)`);
            console.log(`  Vendas com updated_at: ${stat.vendas_com_updated_at} (${((stat.vendas_com_updated_at / stat.total_vendas) * 100).toFixed(2)}%)`);
            console.log(`  Vendas sem created_at: ${stat.vendas_sem_created_at}`);
            console.log(`  Vendas sem updated_at: ${stat.vendas_sem_updated_at}`);
        }

        // Verificar últimas 5 vendas para comparação
        console.log('\n📋 Últimas 5 Vendas (para comparação):');
        const [ultimasVendas] = await sequelize.query(`
            SELECT 
                id,
                public_id,
                status,
                created_at,
                updated_at,
                cliente_nome,
                valor
            FROM vendas
            ORDER BY 
                CASE 
                    WHEN created_at IS NOT NULL THEN created_at 
                    ELSE '1970-01-01'::timestamp 
                END DESC,
                id DESC
            LIMIT 5
        `);

        console.log('─'.repeat(80));
        ultimasVendas.forEach((v, index) => {
            console.log(`\n${index + 1}. Venda ID: ${v.id} (Public: ${v.public_id || 'N/A'})`);
            console.log(`   Status: ${v.status}`);
            console.log(`   Cliente: ${v.cliente_nome || 'N/A'}`);
            console.log(`   Valor: MZN ${parseFloat(v.valor || 0).toFixed(2)}`);
            console.log(`   created_at: ${v.created_at || '❌ NULL'}`);
            console.log(`   updated_at: ${v.updated_at || '❌ NULL'}`);
        });
        console.log('─'.repeat(80));

        console.log('\n✅ Verificação concluída!');
        
    } catch (error) {
        console.error('\n❌ Erro durante a verificação:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Conexão fechada.');
    }
}

// Executar verificação
console.log('🚀 Iniciando verificação da última venda...\n');
verificarUltimaVenda()
    .then(() => {
        console.log('\n✨ Processo finalizado!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Erro fatal:', error);
        process.exit(1);
    });

