/**
 * Script para corrigir o tipo da coluna whatsapp_notification_types para JSON
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

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

        // Verificar tipo atual da coluna
        const [result] = await sequelize.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'whatsapp_notification_types'
        `);

        if (result.length === 0) {
            console.log('❌ Coluna whatsapp_notification_types não encontrada');
            process.exit(1);
        }

        const currentType = result[0].data_type;
        console.log(`📊 Tipo atual da coluna: ${currentType}`);

        if (currentType === 'json') {
            console.log('✅ Coluna já está no tipo JSON correto');
        } else {
            console.log('🔄 Convertendo coluna para JSON...');
            
            // Converter para JSON
            await sequelize.query(`
                ALTER TABLE usuarios 
                ALTER COLUMN whatsapp_notification_types 
                TYPE JSON USING 
                CASE 
                    WHEN whatsapp_notification_types IS NULL OR whatsapp_notification_types = '' 
                    THEN '[]'::json
                    ELSE whatsapp_notification_types::json
                END;
            `);

            // Definir default
            await sequelize.query(`
                ALTER TABLE usuarios 
                ALTER COLUMN whatsapp_notification_types 
                SET DEFAULT '[]'::json;
            `);

            // Adicionar comentário
            await sequelize.query(`
                COMMENT ON COLUMN usuarios.whatsapp_notification_types IS 
                'Array de tipos de notificações WhatsApp que o usuário deseja receber: codigo_verificacao, codigo_saque, nova_venda, saque_pago, remarketing, upsell, venda_afiliado';
            `);

            console.log('✅ Coluna whatsapp_notification_types corrigida para JSON');
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await sequelize.close();
        process.exit(1);
    }
})();

