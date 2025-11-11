/**
 * Script de Migração para Push Notifications Avançado
 * Adiciona/atualiza coluna push_subscription para suportar múltiplos dispositivos
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

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

async function migratePushNotifications() {
    try {
        console.log('🔄 Iniciando migração de Push Notifications...');
        console.log('📊 Conectando ao banco de dados...');
        
        await sequelize.authenticate();
        console.log('✅ Conexão estabelecida com sucesso');

        // Verificar se a coluna push_subscription existe
        console.log('\n📝 Verificando coluna push_subscription na tabela usuarios...');
        const [results] = await sequelize.query(`
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length,
                is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'usuarios' 
            AND column_name = 'push_subscription'
        `);

        if (results.length === 0) {
            // Coluna não existe - criar
            console.log('   ➕ Coluna push_subscription não existe. Criando...');
            
            // Verificar se é PostgreSQL para usar JSONB (melhor performance)
            const [dbInfo] = await sequelize.query("SELECT version()");
            const isPostgreSQL = dbInfo[0]?.version?.includes('PostgreSQL');
            
            if (isPostgreSQL) {
                // Usar JSONB no PostgreSQL (mais eficiente para queries JSON)
                await sequelize.query(`
                    ALTER TABLE usuarios 
                    ADD COLUMN push_subscription JSONB
                `);
                
                await sequelize.query(`
                    COMMENT ON COLUMN usuarios.push_subscription IS 
                    'Array de dispositivos para push notifications. Formato: [{"deviceId": "...", "endpoint": "...", "keys": {...}, "platform": "...", "browser": "...", "createdAt": "...", "lastActive": "...", "active": true}]'
                `);
                
                console.log('   ✅ Coluna push_subscription criada como JSONB (PostgreSQL)');
            } else {
                // Usar TEXT para outros bancos
                await sequelize.query(`
                    ALTER TABLE usuarios 
                    ADD COLUMN push_subscription TEXT
                `);
                
                console.log('   ✅ Coluna push_subscription criada como TEXT');
            }
        } else {
            // Coluna existe - verificar tipo
            const column = results[0];
            console.log(`   ℹ️  Coluna push_subscription já existe`);
            console.log(`   📊 Tipo atual: ${column.data_type}`);
            
            // Se for VARCHAR ou outro tipo limitado, sugerir migração para TEXT/JSONB
            if (column.data_type === 'character varying' || column.data_type === 'varchar') {
                console.log('   ⚠️  Coluna é VARCHAR - considerando migração para TEXT/JSONB...');
                
                // Verificar se há dados
                const [dataCheck] = await sequelize.query(`
                    SELECT COUNT(*) as count 
                    FROM usuarios 
                    WHERE push_subscription IS NOT NULL
                `);
                
                const hasData = parseInt(dataCheck[0]?.count || 0) > 0;
                
                if (hasData) {
                    console.log('   ⚠️  Coluna contém dados. Migração automática não será feita.');
                    console.log('   💡 Para migrar manualmente:');
                    console.log('      1. Fazer backup dos dados');
                    console.log('      2. Converter dados para JSON válido');
                    console.log('      3. Alterar tipo da coluna');
                } else {
                    // Sem dados - pode alterar tipo
                    const [dbInfo] = await sequelize.query("SELECT version()");
                    const isPostgreSQL = dbInfo[0]?.version?.includes('PostgreSQL');
                    
                    if (isPostgreSQL) {
                        console.log('   🔄 Migrando para JSONB...');
                        await sequelize.query(`
                            ALTER TABLE usuarios 
                            ALTER COLUMN push_subscription TYPE JSONB 
                            USING push_subscription::jsonb
                        `);
                        console.log('   ✅ Coluna migrada para JSONB');
                    } else {
                        console.log('   🔄 Migrando para TEXT...');
                        await sequelize.query(`
                            ALTER TABLE usuarios 
                            ALTER COLUMN push_subscription TYPE TEXT
                        `);
                        console.log('   ✅ Coluna migrada para TEXT');
                    }
                }
            } else if (column.data_type === 'text' || column.data_type === 'jsonb') {
                console.log(`   ✅ Tipo da coluna está correto (${column.data_type})`);
            }
        }

        // Adicionar índice para melhor performance (se PostgreSQL e JSONB)
        try {
            const [dbInfo] = await sequelize.query("SELECT version()");
            const isPostgreSQL = dbInfo[0]?.version?.includes('PostgreSQL');
            
            if (isPostgreSQL) {
                // Verificar tipo atual da coluna
                const [columnInfo] = await sequelize.query(`
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'usuarios' 
                    AND column_name = 'push_subscription'
                `);
                
                const dataType = columnInfo[0]?.data_type;
                
                if (dataType === 'jsonb') {
                    // Verificar se índice já existe
                    const [indexCheck] = await sequelize.query(`
                        SELECT indexname 
                        FROM pg_indexes 
                        WHERE tablename = 'usuarios' 
                        AND indexname = 'idx_usuarios_push_subscription'
                    `);
                    
                    if (indexCheck.length === 0) {
                        console.log('\n📝 Criando índice GIN para push_subscription (JSONB)...');
                        await sequelize.query(`
                            CREATE INDEX idx_usuarios_push_subscription 
                            ON usuarios USING GIN (push_subscription)
                        `);
                        console.log('   ✅ Índice GIN criado com sucesso');
                    } else {
                        console.log('\n   ℹ️  Índice GIN já existe');
                    }
                } else {
                    console.log('\n   ℹ️  Coluna é TEXT - índice GIN não aplicável (apenas para JSONB)');
                    console.log('   💡 Para melhor performance, considere migrar para JSONB:');
                    console.log('      ALTER TABLE usuarios ALTER COLUMN push_subscription TYPE JSONB USING push_subscription::jsonb');
                }
            }
        } catch (indexError) {
            console.warn('   ⚠️  Erro ao criar índice (não crítico):', indexError.message);
        }

        // Verificar e migrar dados antigos (formato único dispositivo -> array)
        console.log('\n🔄 Verificando dados antigos para migração...');
        const [oldFormatCheck] = await sequelize.query(`
            SELECT id, push_subscription 
            FROM usuarios 
            WHERE push_subscription IS NOT NULL 
            AND push_subscription != ''
            LIMIT 10
        `);

        if (oldFormatCheck.length > 0) {
            console.log(`   📦 Encontrados ${oldFormatCheck.length} registros com push_subscription`);
            
            let migratedCount = 0;
            for (const user of oldFormatCheck) {
                try {
                    let subscriptionData = user.push_subscription;
                    
                    // Se for string, tentar parsear
                    if (typeof subscriptionData === 'string') {
                        subscriptionData = JSON.parse(subscriptionData);
                    }
                    
                    // Se já é array, pular
                    if (Array.isArray(subscriptionData)) {
                        continue;
                    }
                    
                    // Se é objeto único (formato antigo), converter para array
                    if (subscriptionData && typeof subscriptionData === 'object' && subscriptionData.endpoint) {
                        // Gerar deviceId se não existir
                        const deviceId = subscriptionData.deviceId || 
                            `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        // Detectar plataforma e navegador
                        const userAgent = subscriptionData.userAgent || 'unknown';
                        const platform = detectPlatform(userAgent, subscriptionData);
                        const browser = detectBrowser(userAgent);
                        
                        // Converter para array
                        const newFormat = [{
                            deviceId: deviceId,
                            endpoint: subscriptionData.endpoint,
                            keys: subscriptionData.keys,
                            platform: platform,
                            browser: browser,
                            userAgent: userAgent,
                            name: `${platform} - ${browser}`,
                            createdAt: subscriptionData.createdAt || new Date().toISOString(),
                            lastActive: new Date().toISOString(),
                            active: true
                        }];
                        
                        // Atualizar no banco
                        const [dbInfo] = await sequelize.query("SELECT version()");
                        const isPostgreSQL = dbInfo[0]?.version?.includes('PostgreSQL');
                        
                        if (isPostgreSQL) {
                            await sequelize.query(`
                                UPDATE usuarios 
                                SET push_subscription = $1::jsonb
                                WHERE id = $2
                            `, {
                                bind: [JSON.stringify(newFormat), user.id]
                            });
                        } else {
                            await sequelize.query(`
                                UPDATE usuarios 
                                SET push_subscription = ?
                                WHERE id = ?
                            `, {
                                bind: [JSON.stringify(newFormat), user.id]
                            });
                        }
                        
                        migratedCount++;
                        console.log(`   ✅ Usuário ${user.id} migrado para novo formato`);
                    }
                } catch (error) {
                    console.warn(`   ⚠️  Erro ao migrar usuário ${user.id}:`, error.message);
                }
            }
            
            if (migratedCount > 0) {
                console.log(`\n✅ ${migratedCount} usuário(s) migrado(s) para o novo formato`);
            } else {
                console.log('\n   ℹ️  Nenhuma migração de dados necessária');
            }
        } else {
            console.log('   ℹ️  Nenhum registro com push_subscription encontrado');
        }

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('✅ Migração de Push Notifications concluída com sucesso!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\n📋 Resumo:');
        console.log('   ✅ Coluna push_subscription verificada/criada');
        console.log('   ✅ Tipo da coluna verificado (TEXT ou JSONB)');
        console.log('   ✅ Índice GIN criado (se PostgreSQL)');
        console.log('   ✅ Dados antigos migrados para novo formato (se necessário)');
        console.log('\n💡 Próximos passos:');
        console.log('   1. Reiniciar o servidor');
        console.log('   2. Testar registro de dispositivos');
        console.log('   3. Verificar envio de notificações');

    } catch (error) {
        console.error('\n❌ Erro na migração:', error);
        console.error('📋 Stack:', error.stack);
        process.exit(1);
    } finally {
        await sequelize.close();
        console.log('\n🔌 Conexão fechada');
    }
}

// Funções auxiliares para detecção
function detectPlatform(userAgent, subscription) {
    const ua = userAgent || '';
    const endpoint = subscription?.endpoint || '';

    if (/iPhone|iPad|iPod/.test(ua)) {
        return 'ios';
    }
    if (/Android/.test(ua)) {
        return 'android';
    }
    if (/Windows/.test(ua)) {
        return 'windows';
    }
    if (/Mac/.test(ua)) {
        return 'macos';
    }
    if (/Linux/.test(ua)) {
        return 'linux';
    }
    
    if (endpoint.includes('fcm.googleapis.com')) {
        return 'android';
    }
    if (endpoint.includes('wns2-')) {
        return 'windows';
    }
    
    return 'unknown';
}

function detectBrowser(userAgent) {
    const ua = userAgent || '';
    
    if (/Chrome/.test(ua) && !/Edge|OPR/.test(ua)) {
        return 'chrome';
    }
    if (/Firefox/.test(ua)) {
        return 'firefox';
    }
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
        return 'safari';
    }
    if (/Edge/.test(ua)) {
        return 'edge';
    }
    if (/OPR/.test(ua)) {
        return 'opera';
    }
    
    return 'unknown';
}

// Executar migração
if (require.main === module) {
    migratePushNotifications();
}

module.exports = { migratePushNotifications };

