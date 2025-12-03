/**
 * Script para verificar foreign keys das tabelas upsell e webhooks
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
        console.log('✅ Conectado ao banco de dados\n');

        const fks = await sequelize.query(`
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN ('upsell_pages', 'produto_upsell', 'webhooks')
            ORDER BY tc.table_name, kcu.column_name
        `, { type: Sequelize.QueryTypes.SELECT });

        if (fks.length > 0) {
            console.log(`✅ ${fks.length} Foreign Key(s) encontrada(s):\n`);
            fks.forEach(fk => {
                console.log(`   ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
            });
        } else {
            console.log('⚠️  Nenhuma foreign key encontrada nas tabelas upsell_pages, produto_upsell ou webhooks');
            console.log('💡 Isso pode indicar que as constraints não foram criadas corretamente');
        }

        await sequelize.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        await sequelize.close();
        process.exit(1);
    }
})();

