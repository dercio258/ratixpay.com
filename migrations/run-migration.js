/**
 * Script para executar migração de adicionar campos de aprovação à tabela produtos
 * Execute: node migrations/run-migration.js
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    logging: console.log
});

async function runMigration() {
    try {
        console.log('🔄 Iniciando migração: Adicionar campos de aprovação à tabela produtos...');
        
        // Adicionar coluna status_aprovacao
        await sequelize.query(`
            ALTER TABLE produtos 
            ADD COLUMN IF NOT EXISTS status_aprovacao VARCHAR(50) DEFAULT 'aprovado' 
            CHECK (status_aprovacao IN ('aprovado', 'rejeitado', 'pendente_aprovacao'));
        `);
        console.log('✅ Coluna status_aprovacao adicionada');
        
        // Adicionar coluna motivo_rejeicao
        await sequelize.query(`
            ALTER TABLE produtos 
            ADD COLUMN IF NOT EXISTS motivo_rejeicao TEXT;
        `);
        console.log('✅ Coluna motivo_rejeicao adicionada');
        
        // Adicionar comentários
        await sequelize.query(`
            COMMENT ON COLUMN produtos.status_aprovacao IS 'Status de aprovação do produto: aprovado (automático), rejeitado, pendente_aprovacao (aguardando admin)';
        `);
        await sequelize.query(`
            COMMENT ON COLUMN produtos.motivo_rejeicao IS 'Motivo da rejeição automática ou manual';
        `);
        console.log('✅ Comentários adicionados');
        
        // Atualizar produtos existentes
        await sequelize.query(`
            UPDATE produtos 
            SET status_aprovacao = 'aprovado' 
            WHERE status_aprovacao IS NULL AND ativo = true;
        `);
        console.log('✅ Produtos ativos atualizados para status aprovado');
        
        await sequelize.query(`
            UPDATE produtos 
            SET status_aprovacao = 'rejeitado' 
            WHERE status_aprovacao IS NULL AND ativo = false;
        `);
        console.log('✅ Produtos inativos atualizados para status rejeitado');
        
        await sequelize.query(`
            UPDATE produtos 
            SET status_aprovacao = 'aprovado' 
            WHERE ativo = true AND status_aprovacao != 'aprovado';
        `);
        console.log('✅ Garantindo que produtos ativos tenham status aprovado');
        
        console.log('✅ Migração concluída com sucesso!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erro ao executar migração:', error);
        process.exit(1);
    }
}

runMigration();

