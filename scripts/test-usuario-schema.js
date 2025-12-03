/**
 * Script de teste para validar a estrutura da tabela usuarios
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { Usuario } = require('../config/database');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'ratixpay_local',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASS || 'postgres',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false
    }
);

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Conectado ao banco de dados');

        // Tentar buscar um usuário (simulando o que o middleware auth.js faz)
        console.log('\n🧪 Testando query do modelo Usuario...');
        
        const testUserId = '6f7db170-8197-4cfb-ab30-b86f5e1066d0';
        
        try {
            const user = await Usuario.findByPk(testUserId);
            if (user) {
                console.log('✅ Query executada com sucesso!');
                console.log(`   Usuário encontrado: ${user.email}`);
                console.log(`   whatsapp_notification_types:`, user.whatsapp_notification_types);
            } else {
                console.log('⚠️  Usuário de teste não encontrado, mas query executou sem erros');
            }
        } catch (error) {
            if (error.message.includes('não existe')) {
                console.error('❌ ERRO: Coluna não existe no banco:', error.message);
                console.error('\n💡 Execute: node scripts/sync-usuario-schema.js');
            } else {
                throw error;
            }
        }

        // Verificar estrutura da coluna
        console.log('\n📊 Verificando estrutura da coluna whatsapp_notification_types...');
        const [result] = await sequelize.query(`
            SELECT 
                column_name,
                data_type,
                column_default,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'whatsapp_notification_types'
        `);

        if (result.length > 0) {
            const col = result[0];
            console.log('✅ Coluna encontrada:');
            console.log(`   Tipo: ${col.data_type}`);
            console.log(`   Default: ${col.column_default || 'NULL'}`);
            console.log(`   Nullable: ${col.is_nullable}`);
            
            if (col.data_type === 'json') {
                console.log('✅ Tipo JSON está correto!');
            } else {
                console.log('⚠️  Tipo não é JSON. Execute: node scripts/fix-whatsapp-notification-types-column.js');
            }
        } else {
            console.log('❌ Coluna whatsapp_notification_types não encontrada!');
        }

        await sequelize.close();
        console.log('\n✅ Teste concluído!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await sequelize.close();
        process.exit(1);
    }
})();

