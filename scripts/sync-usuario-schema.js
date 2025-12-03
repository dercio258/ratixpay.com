/**
 * Script de Sincronização do Schema da Tabela Usuarios
 * Garante que todas as colunas do modelo Usuario estejam presentes no banco de dados
 * 
 * Uso: node scripts/sync-usuario-schema.js
 */

require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Configuração do banco de dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ratixpay_local',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || 'postgres',
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false
};

// Criar conexão Sequelize
const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging,
        dialectOptions: {
            ssl: false
        }
    }
);

// Mapeamento de tipos Sequelize para PostgreSQL
function getPostgresType(sequelizeType) {
    if (sequelizeType instanceof DataTypes.UUID) {
        return 'UUID';
    }
    if (sequelizeType instanceof DataTypes.STRING) {
        return `VARCHAR(${sequelizeType.options.length || 255})`;
    }
    if (sequelizeType instanceof DataTypes.TEXT) {
        return 'TEXT';
    }
    if (sequelizeType instanceof DataTypes.BOOLEAN) {
        return 'BOOLEAN';
    }
    if (sequelizeType instanceof DataTypes.INTEGER) {
        return 'INTEGER';
    }
    if (sequelizeType instanceof DataTypes.DECIMAL) {
        const precision = sequelizeType.options.precision || 10;
        const scale = sequelizeType.options.scale || 2;
        return `DECIMAL(${precision}, ${scale})`;
    }
    if (sequelizeType instanceof DataTypes.DATE) {
        return 'TIMESTAMP';
    }
    if (sequelizeType instanceof DataTypes.ENUM) {
        // Para ENUM, vamos usar VARCHAR por enquanto
        return 'VARCHAR(50)';
    }
    if (sequelizeType instanceof DataTypes.JSON) {
        return 'JSON';
    }
    // Default
    return 'TEXT';
}

// Definir modelo Usuario (mesma definição do database.js)
const UsuarioModel = {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4, allowNull: false },
    public_id: { type: DataTypes.STRING(6), unique: true, allowNull: false },
    legacy_id: { type: DataTypes.INTEGER },
    password: { type: DataTypes.STRING, allowNull: true },
    password_hash: { type: DataTypes.STRING, allowNull: true },
    nome: { type: DataTypes.STRING, allowNull: false },
    nome_completo: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    telefone: { type: DataTypes.STRING, allowNull: true },
    whatsapp_contact: { type: DataTypes.STRING, allowNull: true },
    whatsapp_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    whatsapp_notification_types: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    google_user: { type: DataTypes.BOOLEAN, defaultValue: false },
    auth_provider: { type: DataTypes.ENUM('local', 'google', 'local+google'), defaultValue: 'local' },
    google_id: { type: DataTypes.STRING(255), unique: true, allowNull: true },
    contact_configured: { type: DataTypes.BOOLEAN, defaultValue: false },
    role: { type: DataTypes.ENUM('admin', 'user'), defaultValue: 'user' },
    vendedor_id: { type: DataTypes.STRING, unique: true },
    status: { type: DataTypes.ENUM('Ativa', 'Bloqueada'), defaultValue: 'Ativa' },
    notificacoes: { type: DataTypes.INTEGER, defaultValue: 0 },
    email_verificado: { type: DataTypes.BOOLEAN, defaultValue: false },
    telefone_verificado: { type: DataTypes.BOOLEAN, defaultValue: false },
    codigo_verificacao: { type: DataTypes.STRING },
    codigo_verificacao_expira: { type: DataTypes.DATE },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    suspenso: { type: DataTypes.BOOLEAN, defaultValue: false },
    motivo_suspensao: { type: DataTypes.TEXT },
    data_suspensao: { type: DataTypes.DATE },
    ultimo_login: { type: DataTypes.DATE },
    last_login: { type: DataTypes.DATE, allowNull: true },
    tentativas_login: { type: DataTypes.INTEGER, defaultValue: 0 },
    login_attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    bloqueado_ate: { type: DataTypes.DATE },
    locked_until: { type: DataTypes.DATE, allowNull: true },
    reset_token: { type: DataTypes.STRING },
    reset_token_expira: { type: DataTypes.DATE },
    plano: { type: DataTypes.STRING, defaultValue: 'gratuito' },
    marketing_avancado: { type: DataTypes.BOOLEAN, defaultValue: false },
    avatar_url: { type: DataTypes.TEXT, allowNull: true },
    push_subscription: { type: DataTypes.TEXT, allowNull: true }
};

// Verificar se coluna existe
async function columnExists(tableName, columnName) {
    const [results] = await sequelize.query(
        `SELECT COUNT(*)::int as count 
         FROM information_schema.columns 
         WHERE table_name = :tableName 
         AND column_name = :columnName`,
        {
            replacements: { tableName, columnName },
            type: Sequelize.QueryTypes.SELECT
        }
    );
    return results.count > 0;
}

// Adicionar coluna se não existir
async function addColumnIfNotExists(tableName, columnName, columnDef) {
    const exists = await columnExists(tableName, columnName);
    
    if (exists) {
        console.log(`   ✓ Coluna ${columnName} já existe`);
        return false;
    }

    const pgType = getPostgresType(columnDef.type);
    let defaultValue = '';
    
    if (columnDef.defaultValue !== undefined) {
        if (typeof columnDef.defaultValue === 'boolean') {
            defaultValue = `DEFAULT ${columnDef.defaultValue}`;
        } else if (typeof columnDef.defaultValue === 'number') {
            defaultValue = `DEFAULT ${columnDef.defaultValue}`;
        } else if (typeof columnDef.defaultValue === 'string') {
            defaultValue = `DEFAULT '${columnDef.defaultValue}'`;
        } else if (columnDef.defaultValue === DataTypes.UUIDV4) {
            defaultValue = `DEFAULT gen_random_uuid()`;
        } else if (Array.isArray(columnDef.defaultValue)) {
            // Para JSON com array vazio
            if (pgType === 'JSON') {
                defaultValue = `DEFAULT '[]'::json`;
            } else {
                defaultValue = `DEFAULT '[]'`;
            }
        }
    }
    
    const allowNull = columnDef.allowNull !== false ? 'NULL' : 'NOT NULL';
    
    const sql = `
        ALTER TABLE ${tableName} 
        ADD COLUMN ${columnName} ${pgType} ${defaultValue} ${allowNull};
    `;
    
    try {
        await sequelize.query(sql);
        console.log(`   ✅ Coluna ${columnName} adicionada (${pgType})`);
        return true;
    } catch (error) {
        console.error(`   ❌ Erro ao adicionar coluna ${columnName}:`, error.message);
        return false;
    }
}

// Função principal
async function syncUsuarioSchema() {
    try {
        console.log('🚀 Iniciando sincronização do schema da tabela usuarios...\n');
        console.log(`📊 Conectando ao banco: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`);

        // Testar conexão
        await sequelize.authenticate();
        console.log('✅ Conexão com banco de dados estabelecida!\n');

        // Verificar se tabela existe
        const [tables] = await sequelize.query(
            `SELECT COUNT(*)::int as count 
             FROM information_schema.tables 
             WHERE table_name = 'usuarios'`
        );
        
        if (tables[0].count === 0) {
            console.error('❌ Tabela usuarios não existe! Execute a migração inicial primeiro.');
            process.exit(1);
        }

        console.log('📋 Verificando colunas do modelo Usuario...\n');

        let addedCount = 0;
        let skippedCount = 0;

        // Verificar e adicionar cada coluna
        for (const [columnName, columnDef] of Object.entries(UsuarioModel)) {
            // Pular coluna id (primary key)
            if (columnName === 'id') {
                continue;
            }

            const added = await addColumnIfNotExists('usuarios', columnName, columnDef);
            if (added) {
                addedCount++;
            } else {
                skippedCount++;
            }
        }

        // Adicionar comentário especial para whatsapp_notification_types
        if (await columnExists('usuarios', 'whatsapp_notification_types')) {
            try {
                await sequelize.query(`
                    COMMENT ON COLUMN usuarios.whatsapp_notification_types IS 
                    'Array de tipos de notificações WhatsApp que o usuário deseja receber: codigo_verificacao, codigo_saque, nova_venda, saque_pago, remarketing, upsell, venda_afiliado';
                `);
            } catch (error) {
                // Ignorar erro se comentário já existe
            }
        }

        console.log('\n📊 Resumo da sincronização:');
        console.log(`   ✅ Colunas adicionadas: ${addedCount}`);
        console.log(`   ⏭️  Colunas já existentes: ${skippedCount}`);
        console.log(`   📦 Total de colunas verificadas: ${Object.keys(UsuarioModel).length - 1}`);

        if (addedCount > 0) {
            console.log('\n🎉 Sincronização concluída! As colunas faltantes foram adicionadas.');
        } else {
            console.log('\n✅ Schema já está sincronizado! Todas as colunas existem.');
        }

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro fatal ao sincronizar schema:', error.message);
        console.error('\n📋 Verifique:');
        console.error('   1. Credenciais do banco no arquivo .env');
        console.error('   2. Conexão com o banco de dados');
        console.error('   3. Permissões do usuário do banco');
        console.error('\n💡 Variáveis necessárias no .env:');
        console.error('   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (ou DB_PASS)');
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    syncUsuarioSchema();
}

module.exports = { syncUsuarioSchema };

