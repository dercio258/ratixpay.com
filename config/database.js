const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Configuração do Sequelize para PostgreSQL LOCAL
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 5432);
const dbName = process.env.DB_NAME || 'ratixpay_local';
const dbUser = process.env.DB_USER || 'postgres';
const dbPass = process.env.DB_PASS || 'postgres';

console.log('🔧 Configurando banco de dados LOCAL...');
console.log(`📊 Host: ${dbHost}`);
console.log(`📊 Port: ${dbPort}`);
console.log(`📊 Database: ${dbName}`);
console.log(`📊 User: ${dbUser}`);

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
    host: dbHost,
    port: dbPort,
    dialect: 'postgres',
    dialectOptions: {
        ssl: false // SSL desabilitado para banco local
    },
    logging: process.env.LOG_DATABASE === 'true' ? console.log : false,
    define: { 
        timestamps: true,
        underscored: true,
        freezeTableName: true
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    retry: {
        max: 3,
        timeout: 60000
    }
});

// ======================== MODELOS ========================

// Produto
const Produto = sequelize.define('Produto', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    public_id: { 
        type: DataTypes.STRING(6), 
        unique: true, 
        allowNull: false,
        validate: {
            len: [6, 6],
            is: /^\d{6}$/
        }
    },
    legacy_id: { type: DataTypes.INTEGER },
    custom_id: { type: DataTypes.STRING, unique: true, allowNull: false },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    vendedor_legacy_id: { type: DataTypes.INTEGER },
    nome: { type: DataTypes.STRING, allowNull: false },
    tipo: { type: DataTypes.STRING, allowNull: false },
    categoria: { type: DataTypes.STRING },
    preco: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    desconto: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
    preco_com_desconto: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    descricao: { type: DataTypes.TEXT },
    link_conteudo: { type: DataTypes.TEXT },
    imagem_url: { type: DataTypes.TEXT },
    imagem_public_id: { type: DataTypes.STRING },
    imagem_conteudo: { type: DataTypes.TEXT },
    imagem_tipo: { type: DataTypes.STRING },
    status_criacao: { type: DataTypes.STRING, defaultValue: 'iniciado' },
    status_aprovacao: { 
        type: DataTypes.ENUM('aprovado', 'rejeitado', 'pendente_aprovacao'), 
        defaultValue: 'aprovado',
        comment: 'Status de aprovação do produto: aprovado (automático), rejeitado, pendente_aprovacao (aguardando admin)'
    },
    motivo_rejeicao: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'Motivo da rejeição automática ou manual'
    },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: false },
    vendas: { type: DataTypes.INTEGER, defaultValue: 0 },
    expert_id: { 
        type: DataTypes.UUID, 
        allowNull: true,
        comment: 'ID do expert associado ao produto'
    },
    order_bump_ativo: { type: DataTypes.BOOLEAN, defaultValue: false },
    order_bump_produtos: { type: DataTypes.JSON, allowNull: true, comment: 'Array de produtos complementares' },
    // Configurações integradas
    discount_config: { type: DataTypes.JSON, allowNull: true, comment: 'Configuração de desconto simples' },
    timer_config: { type: DataTypes.JSON, allowNull: true, comment: 'Configuração de temporizador de urgência' },
    blackfriday_config: { type: DataTypes.JSON, allowNull: true, comment: 'Configuração de Black Friday' },
    remarketing_config: { type: DataTypes.JSON, allowNull: true, comment: 'Configuração de remarketing automático: {enabled: true/false, tempo_minutos: 0-1440}' },
    // Configurações de afiliados
    permitir_afiliados: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Permitir afiliados para este produto' },
    comissao_afiliados: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0, comment: 'Comissão dos afiliados (0-50%)' },
    comissao_minima: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, comment: 'Comissão mínima em MZN' },
    tipo_comissao: { type: DataTypes.ENUM('percentual', 'fixo', 'tier'), defaultValue: 'percentual', comment: 'Tipo de comissão' },
    tier_config: { type: DataTypes.JSON, allowNull: true, comment: 'Configuração de níveis de comissão' },
    // Meta Pixel ID para rastreamento
    pixel_id: { type: DataTypes.STRING(50), allowNull: true, comment: 'Meta Pixel ID para rastreamento de conversões' },
    pixel_events: { type: DataTypes.JSON, allowNull: true, comment: 'Eventos do Meta Pixel configurados para este produto' },
    // Configurações UTMfy
    utmfy_api_key: { type: DataTypes.STRING(255), allowNull: true, comment: 'API Key do UTMfy para rastreamento' },
    utmfy_token_type: { type: DataTypes.ENUM('utmify'), allowNull: true, comment: 'Tipo de token UTMfy (apenas utmify)' },
    utmfy_events: { type: DataTypes.JSON, allowNull: true, comment: 'Eventos UTMfy configurados para este produto' },
    utmfy_active: { type: DataTypes.BOOLEAN, defaultValue: false, comment: 'Se o rastreamento UTMfy está ativo para este produto' }
}, { tableName: 'produtos' });

// Venda
const Venda = sequelize.define('Venda', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    public_id: { 
        type: DataTypes.STRING(6), 
        unique: true, 
        allowNull: false,
        validate: {
            len: [6, 6],
            is: /^\d{6}$/
        }
    },
    legacy_id: { type: DataTypes.INTEGER },
    produto_id: { type: DataTypes.UUID, allowNull: false },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    cliente_id: { type: DataTypes.UUID },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    valor_vendedor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    taxa_admin: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    cliente_nome: { type: DataTypes.STRING, allowNull: false },
    cliente_email: { type: DataTypes.STRING, allowNull: false },
    cliente_telefone: { type: DataTypes.STRING },
    cliente_whatsapp: { type: DataTypes.STRING, allowNull: true },
    numero_celular: { type: DataTypes.STRING },
    metodo_pagamento: { type: DataTypes.STRING },
    data_pagamento: { type: DataTypes.DATE },
    referencia_pagamento: { type: DataTypes.STRING },
    link_conteudo: { type: DataTypes.TEXT },
    numero_pedido: { type: DataTypes.STRING(6), unique: true, allowNull: true },
    afiliado_ref: { type: DataTypes.STRING(20), allowNull: true, comment: 'Código do afiliado que gerou a venda' },
    status: { type: DataTypes.STRING, defaultValue: 'Pendente' },
    observacoes: { type: DataTypes.TEXT },
    tracking_data: { type: DataTypes.JSON, allowNull: true, comment: 'Parâmetros UTM e de rastreamento (utm_source, utm_campaign, etc)' },
    created_at: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW 
    },
    updated_at: { 
        type: DataTypes.DATE, 
        allowNull: false, 
        defaultValue: DataTypes.NOW 
    }
}, { 
    tableName: 'vendas',
    timestamps: true, // Habilitar timestamps automáticos
    underscored: true, // Usar snake_case para created_at e updated_at
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

// Usuário
const Usuario = sequelize.define('Usuario', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    public_id: { 
        type: DataTypes.STRING(6), 
        unique: true, 
        allowNull: false,
        validate: {
            len: [6, 6],
            is: /^\d{6}$/
        }
    },
    legacy_id: { type: DataTypes.INTEGER },
    password: { 
        type: DataTypes.STRING, 
        allowNull: true,
        comment: 'Senha em texto plano (deprecated - usar password_hash)'
    },
    password_hash: { 
        type: DataTypes.STRING, 
        allowNull: true,
        comment: 'Hash bcrypt da senha para login local'
    },
    nome: { type: DataTypes.STRING, allowNull: false },
    nome_completo: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    telefone: { 
        type: DataTypes.STRING, 
        allowNull: true,
        validate: {
            len: {
                args: [9, 15],
                msg: 'Número de telefone deve ter entre 9 e 15 caracteres'
            }
        }
    },
    whatsapp_contact: { 
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Número de WhatsApp específico para notificações',
        validate: {
            len: {
                args: [9, 15],
                msg: 'Número de WhatsApp deve ter entre 9 e 15 caracteres'
            }
        }
    },
    whatsapp_enabled: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Se o usuário optou por receber notificações via WhatsApp'
    },
    whatsapp_notification_types: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array de tipos de notificações WhatsApp que o usuário deseja receber: codigo_verificacao, codigo_saque, nova_venda, saque_pago, remarketing, upsell, venda_afiliado'
    },
    google_user: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Se o usuário se registrou via Google OAuth (deprecated - usar auth_provider)'
    },
    auth_provider: { 
        type: DataTypes.ENUM('local', 'google', 'local+google'),
        defaultValue: 'local',
        comment: 'Provedor de autenticação'
    },
    google_id: { 
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: true,
        comment: 'ID único do usuário no Google OAuth'
    },
    contact_configured: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Se o usuário já configurou seu contato no primeiro acesso'
    },
    role: { 
        type: DataTypes.ENUM('admin', 'user'), 
        defaultValue: 'user',
        comment: 'user = vendedor, admin = administrador',
        validate: {
            isIn: [['admin', 'user']]
        }
    },
    vendedor_id: { type: DataTypes.STRING, unique: true },
    status: { 
        type: DataTypes.ENUM('Ativa', 'Bloqueada'), 
        defaultValue: 'Ativa',
        validate: {
            isIn: [['Ativa', 'Bloqueada']]
        }
    },
    notificacoes: { type: DataTypes.INTEGER, defaultValue: 0 },
    email_verificado: { type: DataTypes.BOOLEAN, defaultValue: false },
    telefone_verificado: { type: DataTypes.BOOLEAN, defaultValue: false },
    codigo_verificacao: { type: DataTypes.STRING },
    codigo_verificacao_expira: { type: DataTypes.DATE },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
    suspenso: { type: DataTypes.BOOLEAN, defaultValue: false },
    motivo_suspensao: { type: DataTypes.TEXT },
    data_suspensao: { type: DataTypes.DATE },
    ultimo_login: { 
        type: DataTypes.DATE,
        comment: 'Deprecated - usar last_login'
    },
    last_login: { 
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp do último login'
    },
    tentativas_login: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0,
        comment: 'Deprecated - usar login_attempts'
    },
    login_attempts: { 
        type: DataTypes.INTEGER, 
        defaultValue: 0,
        comment: 'Número de tentativas de login falhadas'
    },
    bloqueado_ate: { 
        type: DataTypes.DATE,
        comment: 'Deprecated - usar locked_until'
    },
    locked_until: { 
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp até quando a conta está bloqueada'
    },
    reset_token: { type: DataTypes.STRING },
    reset_token_expira: { type: DataTypes.DATE },
    plano: { 
        type: DataTypes.STRING, 
        defaultValue: 'gratuito',
        comment: 'Tipo de plano do usuário: gratuito, premium, especial'
    },
    marketing_avancado: { 
        type: DataTypes.BOOLEAN, 
        defaultValue: false,
        comment: 'Flag legada - mantida apenas para compatibilidade retroativa'
    },
    avatar_url: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'URL da imagem de avatar do usuário'
    },
    push_subscription: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'Subscription JSON para push notifications (Web Push API)'
    }
}, { tableName: 'usuarios' });

// Cliente
const Cliente = sequelize.define('Cliente', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    legacy_id: { type: DataTypes.INTEGER },
    nome: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: true, allowNull: false },
    telefone: { type: DataTypes.STRING },
    total_compras: { type: DataTypes.INTEGER, defaultValue: 0 },
    valor_total_gasto: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'Ativo' },
    origem: { type: DataTypes.STRING, defaultValue: 'Site' }
}, { tableName: 'clientes' });

// Configuração
const Configuracao = sequelize.define('Configuracao', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    legacy_id: { type: DataTypes.INTEGER },
    chave: { type: DataTypes.STRING, unique: true, allowNull: false },
    valor: { type: DataTypes.TEXT },
    descricao: { type: DataTypes.TEXT }
}, { tableName: 'configuracoes' });

// Saldo do Administrador
const SaldoAdmin = sequelize.define('SaldoAdmin', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    saldo_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    comissao_percentual: { type: DataTypes.DECIMAL(5, 2), defaultValue: 10.00 },
    total_vendas_aprovadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    valor_total_vendas: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total_comissoes: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    total_saques_pagos: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    taxas: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    taxas_saques: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    ultima_atualizacao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    observacoes: { type: DataTypes.TEXT }
}, { 
    tableName: 'saldo_admin',
    indexes: [
        {
            unique: true,
            fields: ['id']
        }
    ]
});

// Pagamento
const Pagamento = sequelize.define('Pagamento', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    public_id: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
        comment: 'ID público memorável para exibição e pesquisa (ex: SAQ-123456)'
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    valor_liquido: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: true,
        comment: 'Valor líquido após dedução de taxas'
    },
    taxa: { 
        type: DataTypes.DECIMAL(10, 2), 
        allowNull: true,
        defaultValue: 0,
        comment: 'Taxa aplicada ao saque'
    },
    status: { type: DataTypes.STRING(50), defaultValue: 'pendente' },
    metodo: { type: DataTypes.STRING(50) },
    metodo_pagamento: { type: DataTypes.STRING(50) },
    dados_pagamento: { type: DataTypes.JSON },
    nome_titular: { 
        type: DataTypes.STRING(255), 
        allowNull: true,
        comment: 'Nome do titular da conta'
    },
    telefone_titular: { type: DataTypes.STRING(20) },
    conta_destino: { type: DataTypes.STRING(50) },
    banco: { type: DataTypes.STRING(100) },
    data_solicitacao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    data_processamento: { type: DataTypes.DATE },
    data_pagamento: { type: DataTypes.DATE },
    observacoes: { type: DataTypes.TEXT },
    motivo_rejeicao: { type: DataTypes.TEXT },
    ip_solicitacao: { 
        type: DataTypes.STRING(45), 
        allowNull: true,
        comment: 'IP de onde foi feita a solicitação'
    },
    user_agent: { 
        type: DataTypes.TEXT, 
        allowNull: true,
        comment: 'User agent do navegador'
    }
}, { tableName: 'pagamentos' });

// HistoricoSaques
const HistoricoSaques = sequelize.define('HistoricoSaques', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    saque_id: { type: DataTypes.UUID },
    valor_solicitado: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    valor_pago: { type: DataTypes.DECIMAL(10, 2) },
    status: { type: DataTypes.STRING(50), defaultValue: 'pendente' },
    data_solicitacao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    data_pagamento: { type: DataTypes.DATE },
    observacoes: { type: DataTypes.TEXT }
}, { tableName: 'historico_saques' });

// EstatisticasVendedor
const EstatisticasVendedor = sequelize.define('EstatisticasVendedor', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    total_vendas: { type: DataTypes.INTEGER, defaultValue: 0 },
    vendas_aprovadas: { type: DataTypes.INTEGER, defaultValue: 0 },
    vendas_pendentes: { type: DataTypes.INTEGER, defaultValue: 0 },
    vendas_canceladas: { type: DataTypes.INTEGER, defaultValue: 0 },
    receita_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    comissao_total: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    ultima_atualizacao: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'estatisticas_vendedor' });

// Carteira (apenas uma por usuário)
const Carteira = sequelize.define('Carteira', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedorId: { 
        type: DataTypes.UUID, 
        allowNull: false,
        unique: true, // Garantir apenas uma carteira por usuário
        field: 'vendedor_id' // Mapear para snake_case no banco
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: 'Carteira Principal',
        comment: 'Nome da carteira'
    },
    // Dados Mpesa
    contactoMpesa: { 
        type: DataTypes.STRING(20), 
        allowNull: false, 
        comment: 'Número de contacto Mpesa',
        field: 'contacto_mpesa'
    },
    nomeTitularMpesa: { 
        type: DataTypes.STRING(255), 
        allowNull: false, 
        comment: 'Nome do titular Mpesa',
        field: 'nome_titular_mpesa'
    },
    // Dados Emola
    contactoEmola: { 
        type: DataTypes.STRING(20), 
        allowNull: false, 
        comment: 'Número de contacto Emola',
        field: 'contacto_emola'
    },
    nomeTitularEmola: { 
        type: DataTypes.STRING(255), 
        allowNull: false, 
        comment: 'Nome do titular Emola',
        field: 'nome_titular_emola'
    },
    // Email (obrigatório)
    email: { 
        type: DataTypes.STRING(255), 
        allowNull: false, 
        comment: 'Email do titular'
    },
    saldoDisponivel: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0,
        field: 'saldo_disponivel'
    },
    saldoBloqueado: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0,
        field: 'saldo_bloqueado'
    },
    saldoTotal: { 
        type: DataTypes.DECIMAL(10, 2), 
        defaultValue: 0,
        field: 'saldo_total'
    },
    ativa: { type: DataTypes.BOOLEAN, defaultValue: true },
    metodoSaque: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Mpesa',
        comment: 'Método de saque padrão (Mpesa, Emola, etc)',
        field: 'metodo_saque'
    },
    contacto: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '',
        comment: 'Contacto padrão (legado - usar contacto_mpesa ou contacto_emola)',
        field: 'contacto'
    },
    nomeTitular: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        comment: 'Nome do titular padrão (legado - usar nome_titular_mpesa ou nome_titular_emola)',
        field: 'nome_titular'
    },
    emailTitular: {
        type: DataTypes.STRING(255),
        allowNull: false,
        defaultValue: '',
        comment: 'Email do titular (legado - usar email do usuário autenticado)',
        field: 'email_titular'
    },
    dataCriacao: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        field: 'data_criacao'
    },
    ultimaAtualizacao: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW,
        field: 'ultima_atualizacao'
    }
}, { tableName: 'carteiras' });

// CodigoAutenticacao
const CodigoAutenticacao = sequelize.define('CodigoAutenticacao', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    codigo: { type: DataTypes.STRING(10), allowNull: false },
    tipo: { type: DataTypes.STRING(50), defaultValue: 'email' },
    usado: { type: DataTypes.BOOLEAN, defaultValue: false },
    expira_em: { type: DataTypes.DATE, allowNull: false }
}, { tableName: 'codigos_autenticacao' });

// Pedido
const Pedido = sequelize.define('Pedido', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    venda_id: { type: DataTypes.UUID, allowNull: false },
    produto_id: { type: DataTypes.UUID, allowNull: false },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    numero: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    quantidade: { type: DataTypes.INTEGER, defaultValue: 1 },
    preco_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    preco_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'pedidos' });

// PontoVenda
const PontoVenda = sequelize.define('PontoVenda', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    endereco: { type: DataTypes.TEXT },
    telefone: { type: DataTypes.STRING(20) },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'pontos_venda' });

// Notificacao
const Notificacao = sequelize.define('Notificacao', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true, 
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    titulo: { type: DataTypes.STRING(255), allowNull: false },
    mensagem: { type: DataTypes.TEXT, allowNull: false },
    tipo: { type: DataTypes.STRING(50), defaultValue: 'info' },
    prioridade: { type: DataTypes.STRING(20), defaultValue: 'normal' },
    status: { type: DataTypes.STRING(20), defaultValue: 'unread' },
    url_redirecionamento: { type: DataTypes.STRING(500) },
    lida: { type: DataTypes.BOOLEAN, defaultValue: false },
    data_envio: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    data_leitura: { type: DataTypes.DATE }
}, { tableName: 'notificacoes' });

// Expert
const Expert = sequelize.define('Expert', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    nome: { type: DataTypes.STRING(255), allowNull: false },
    especialidade: { type: DataTypes.STRING(255) },
    descricao: { type: DataTypes.TEXT },
    ativo: { type: DataTypes.BOOLEAN, defaultValue: true }
}, { tableName: 'experts' });

// ProdutoComplementarVenda
const ProdutoComplementarVenda = sequelize.define('ProdutoComplementarVenda', {
    id: { 
        type: DataTypes.UUID, 
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    venda_id: { type: DataTypes.UUID, allowNull: false },
    vendedor_id: { type: DataTypes.UUID, allowNull: false },
    produto_complementar_id: { type: DataTypes.UUID, allowNull: false },
    nome_produto: { type: DataTypes.STRING(255), allowNull: false },
    preco: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    quantidade: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'produtos_complementares_venda' });

// ======================== GERENCIADOR DO BANCO LOCAL ========================
class LocalDatabaseManager {
    constructor() {
        this.sequelize = sequelize;
        this.initialized = false;
    }

    async initialize() {
        try {
            if (this.initialized) {
                return;
            }

            console.log('🔄 Inicializando banco de dados PostgreSQL LOCAL...');
            
            // Testar conexão
            await this.sequelize.authenticate();
            // Conexão estabelecida com sucesso

            // Marcar como inicializado
            this.initialized = true;

            // Sincronização - criar/ajustar tabelas/colunas conforme modelos, controlado por env
            try {
                const alterSync = process.env.DB_ALTER_SYNC === 'true';
                console.log(`🔄 Verificando/ajustando estrutura do banco (alter=${alterSync})...`);
                await sequelize.sync({ force: false, alter: alterSync });
                // Estrutura do banco verificada/ajustada conforme configuração
            } catch (error) {
                console.log('⚠️ Erro na verificação da estrutura (continuando):', error.message);
            }

            // Banco PostgreSQL LOCAL inicializado com sucesso

        } catch (error) {
            console.error('❌ Erro ao inicializar banco PostgreSQL LOCAL:', error.message);
            this.initialized = false;
            throw error;
        }
    }
    
    async query(sql, options = {}) {
        return await this.sequelize.query(sql, options);
    }
    
    getPool() {
        return this.sequelize;
    }

    async close() {
        await this.sequelize.close();
    }
}

// Afiliado
const Afiliado = sequelize.define('Afiliado', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true
    },
    senha: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    token_reset_senha: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    token_reset_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    telefone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    codigo_afiliado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true
    },
    link_afiliado: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    comissao_percentual: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.00
    },
    status: {
        type: DataTypes.ENUM('ativo', 'inativo', 'suspenso'),
        allowNull: false,
        defaultValue: 'ativo'
    },
    total_vendas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    total_comissoes: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    saldo_disponivel: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
    },
    total_cliques: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de cliques em todos os links do afiliado'
    },
    cliques_pagos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de cliques já pagos'
    },
    creditos_cliques: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Créditos gerados por cliques (1 MZN a cada 10 cliques)'
    },
    data_cadastro: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    ultima_atividade: {
        type: DataTypes.DATE,
        allowNull: true
    },
    email_verificado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    vendedor_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do vendedor associado (se o afiliado for um vendedor)'
    },
    codigo_verificacao: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    codigo_verificacao_expira: {
        type: DataTypes.DATE,
        allowNull: true
    },
    meta_pixel_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'ID do Meta Pixel (Facebook Pixel) para rastreamento'
    },
    utmify_api_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'API Token do UTMify para rastreamento de conversões'
    }
}, {
    tableName: 'afiliados',
    timestamps: true,
    // Não sincronizar automaticamente - usar migrações manuais
    sync: false
});

// Venda Afiliado
const VendaAfiliado = sequelize.define('VendaAfiliado', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    afiliado_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'afiliados',
            key: 'id'
        }
    },
    venda_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'vendas',
            key: 'id'
        }
    },
    valor_venda: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    comissao_percentual: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false
    },
    valor_comissao: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pendente', 'pago', 'cancelado'),
        allowNull: false,
        defaultValue: 'pendente'
    },
    data_pagamento: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'venda_afiliados',
    timestamps: true
});

// Relacionamentos VendaAfiliado
VendaAfiliado.belongsTo(Afiliado, { foreignKey: 'afiliado_id', as: 'afiliado' });
VendaAfiliado.belongsTo(Venda, { foreignKey: 'venda_id', as: 'venda' });

// Link Tracking
const LinkTracking = sequelize.define('LinkTracking', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    afiliado_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'afiliados',
            key: 'id'
        }
    },
    link_original: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    link_afiliado: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'produtos',
            key: 'id'
        }
    },
    cliques: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de cliques no link'
    },
    cliques_pagos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Cliques já pagos (para cálculo de créditos)'
    },
    creditos_gerados: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total de créditos gerados por este link (1 MZN a cada 10 cliques)'
    },
    conversoes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    ultimo_clique: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Constraint única: um link por produto por afiliado
    unique_afiliado_produto: {
        type: DataTypes.VIRTUAL,
        get() {
            return `${this.afiliado_id}_${this.produto_id}`;
        }
    }
}, {
    tableName: 'link_trackings',
    timestamps: true
});

// Relacionamentos LinkTracking
LinkTracking.belongsTo(Afiliado, { foreignKey: 'afiliado_id', as: 'afiliado' });
LinkTracking.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// Clique Válido de Afiliado (rastreado quando usuário clica em "Pagar")
const CliqueValidoAfiliado = sequelize.define('CliqueValidoAfiliado', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    afiliado_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'afiliados',
            key: 'id'
        }
    },
    link_tracking_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'link_trackings',
            key: 'id'
        }
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'produtos',
            key: 'id'
        }
    },
    // Informações de fraude
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: false,
        comment: 'IP do usuário (suporta IPv4 e IPv6)'
    },
    user_agent: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'User Agent do navegador'
    },
    navegador: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Nome do navegador detectado'
    },
    sistema_operacional: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Sistema operacional detectado'
    },
    dispositivo: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Tipo de dispositivo (mobile, desktop, tablet)'
    },
    fingerprint: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Fingerprint único do navegador (hash)'
    },
    // Status de validação
    valido: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Se o clique foi considerado válido após verificação de fraude'
    },
    motivo_rejeicao: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo da rejeição se valido = false'
    },
    // Informações adicionais
    referer: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL de referência'
    },
    session_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID da sessão do usuário'
    }
}, {
    tableName: 'cliques_validos_afiliados',
    timestamps: true,
    indexes: [
        {
            fields: ['afiliado_id', 'ip_address'],
            name: 'idx_afiliado_ip'
        },
        {
            fields: ['link_tracking_id'],
            name: 'idx_link_tracking'
        },
        {
            fields: ['valido'],
            name: 'idx_valido'
        },
        {
            fields: ['created_at'],
            name: 'idx_created_at'
        }
    ]
});

// Relacionamentos CliqueValidoAfiliado
CliqueValidoAfiliado.belongsTo(Afiliado, { foreignKey: 'afiliado_id', as: 'afiliado' });
CliqueValidoAfiliado.belongsTo(LinkTracking, { foreignKey: 'link_tracking_id', as: 'linkTracking' });
CliqueValidoAfiliado.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// Banner de Afiliado (banners personalizados com mensagem e imagem)
const BannerAfiliado = sequelize.define('BannerAfiliado', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    afiliado_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'afiliados',
            key: 'id'
        }
    },
    link_tracking_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'link_trackings',
            key: 'id'
        },
        comment: 'Link de tracking associado (opcional)'
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'produtos',
            key: 'id'
        },
        comment: 'Produto associado ao banner (opcional)'
    },
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Título do banner'
    },
    mensagem: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensagem personalizada do banner'
    },
    imagem_url: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'URL da imagem do banner'
    },
    link_afiliado: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Link de afiliado com código ref incorporado'
    },
    codigo_html: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Código HTML gerado para o banner'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Se o banner está ativo'
    },
    cliques: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total de cliques no banner'
    }
}, {
    tableName: 'banner_afiliados',
    timestamps: true
});

// Relacionamentos BannerAfiliado
BannerAfiliado.belongsTo(Afiliado, { foreignKey: 'afiliado_id', as: 'afiliado' });
BannerAfiliado.belongsTo(LinkTracking, { foreignKey: 'link_tracking_id', as: 'linkTracking' });
BannerAfiliado.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// UpsellPage
const UpsellPage = sequelize.define('UpsellPage', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    vendedor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do vendedor que criou a página de upsell'
    },
    titulo: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Título da página de upsell'
    },
    nome_produto: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do produto na página de upsell'
    },
    video_url: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'URL do vídeo da página de upsell'
    },
    video_public_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Public ID do vídeo (Cloudinary)'
    },
    link_checkout: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Link de checkout da página de upsell'
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do produto relacionado (opcional)'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Se a página de upsell está ativa'
    },
    ordem: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Ordem de exibição da página de upsell'
    }
}, {
    tableName: 'upsell_pages',
    timestamps: true,
    underscored: true
});

// ProdutoUpsell
const ProdutoUpsell = sequelize.define('ProdutoUpsell', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do produto'
    },
    upsell_page_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID da página de upsell'
    },
    ordem: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Ordem de exibição do produto na página'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Se o produto está ativo na página de upsell'
    }
}, {
    tableName: 'produto_upsell',
    timestamps: true,
    underscored: true
});

// Relacionamentos Upsell
UpsellPage.belongsTo(Usuario, { foreignKey: 'vendedor_id', as: 'vendedor' });
UpsellPage.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });
UpsellPage.hasMany(ProdutoUpsell, { foreignKey: 'upsell_page_id', as: 'produtos' });
ProdutoUpsell.belongsTo(UpsellPage, { foreignKey: 'upsell_page_id', as: 'upsellPage' });
ProdutoUpsell.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// Webhook
const Webhook = sequelize.define('Webhook', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'ID único do webhook (gerado automaticamente)'
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do usuário que criou o webhook'
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do produto (opcional, NULL para webhooks globais)'
    },
    url: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            isUrl: true
        },
        comment: 'URL onde o webhook será enviado'
    },
    eventos: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: [],
        comment: 'Array de eventos que o webhook deve receber'
    },
    secret: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Secret opcional para validação de segurança'
    },
    ativo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Se o webhook está ativo'
    }
}, {
    tableName: 'webhooks',
    timestamps: true,
    underscored: true
});

// Relacionamentos Webhook
Webhook.belongsTo(Usuario, { foreignKey: 'user_id', as: 'usuario' });
Webhook.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// RemarketingQueue
const RemarketingQueue = sequelize.define('RemarketingQueue', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    cliente_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do cliente (UUID)'
    },
    cliente_nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do cliente'
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do produto'
    },
    produto_nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do produto'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Email do cliente'
    },
    telefone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Telefone do cliente'
    },
    status: {
        type: DataTypes.ENUM('pendente', 'enviado', 'ignorado'),
        allowNull: false,
        defaultValue: 'pendente',
        comment: 'Status: pendente, enviado, ignorado'
    },
    data_cancelamento: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data do cancelamento da venda'
    },
    tempo_envio: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Tempo em minutos até o envio'
    },
    data_agendada: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data agendada para envio'
    },
    tentativas: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Número de tentativas de envio'
    },
    motivo_ignorado: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Motivo pelo qual foi ignorado'
    },
    venda_cancelada_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID da venda cancelada que originou este item'
    }
}, {
    tableName: 'remarketing_queue',
    timestamps: true,
    underscored: true
});

// RemarketingConversao
const RemarketingConversao = sequelize.define('RemarketingConversao', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    remarketing_queue_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID do item na fila de remarketing'
    },
    venda_cancelada_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID da venda cancelada original'
    },
    venda_aprovada_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID da venda aprovada (conversão)'
    },
    cliente_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do cliente'
    },
    cliente_nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do cliente'
    },
    produto_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'ID do produto'
    },
    produto_nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do produto'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Email do cliente'
    },
    telefone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Telefone do cliente'
    },
    data_cancelamento: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: 'Data do cancelamento'
    },
    data_remarketing_enviado: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Data em que o remarketing foi enviado'
    },
    data_conversao: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'Data da conversão'
    },
    valor_venda_cancelada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Valor da venda cancelada'
    },
    valor_venda_aprovada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Valor da venda aprovada'
    },
    tempo_ate_conversao_minutos: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Tempo em minutos entre o envio do remarketing e a conversão'
    }
}, {
    tableName: 'remarketing_conversoes',
    timestamps: true,
    underscored: true
});

// Relacionamentos Remarketing
RemarketingQueue.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });
RemarketingQueue.belongsTo(Venda, { foreignKey: 'venda_cancelada_id', as: 'vendaCancelada' });
RemarketingConversao.belongsTo(RemarketingQueue, { foreignKey: 'remarketing_queue_id', as: 'remarketingQueue' });
RemarketingConversao.belongsTo(Venda, { foreignKey: 'venda_cancelada_id', as: 'vendaCancelada' });
RemarketingConversao.belongsTo(Venda, { foreignKey: 'venda_aprovada_id', as: 'vendaAprovada' });
RemarketingConversao.belongsTo(Produto, { foreignKey: 'produto_id', as: 'produto' });

// ======================== MODELOS DO BLOG ========================

// BlogPost - Posts do blog
const BlogPost = sequelize.define('BlogPost', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Título do post'
    },
    slug: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'URL amigável do post'
    },
    subtitle: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Subtítulo do post'
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        comment: 'Conteúdo HTML do post'
    },
    image: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'URL da imagem de destaque'
    },
    category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Categoria do post'
    },
    tags: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        comment: 'Array de tags do post'
    },
    author_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        comment: 'ID do autor do post'
    },
    views: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Número de visualizações'
    },
    likes: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        comment: 'Número de curtidas'
    },
    status: {
        type: DataTypes.ENUM('published', 'draft'),
        defaultValue: 'draft',
        allowNull: false,
        comment: 'Status do post: publicado ou rascunho'
    },
    published_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Data de publicação agendada'
    },
    meta_description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Meta description para SEO'
    },
    meta_keywords: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Meta keywords para SEO'
    }
}, {
    tableName: 'blog_posts',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['slug'] },
        { fields: ['status'] },
        { fields: ['category'] },
        { fields: ['author_id'] },
        { fields: ['published_at'] }
    ]
});

// BlogComment - Comentários dos posts
const BlogComment = sequelize.define('BlogComment', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    post_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'blog_posts',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID do post comentado'
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'ID do usuário (se autenticado)'
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do comentarista'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Email do comentarista'
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: false,
        comment: 'Conteúdo do comentário'
    },
    parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'blog_comments',
            key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID do comentário pai (para respostas)'
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'Status do comentário: pendente, aprovado ou rejeitado'
    },
    reactions: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: { like: 0, bad: 0, heart: 0, fire: 0 },
        comment: 'Reações do comentário (like, bad, heart, fire)'
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IP do comentarista para moderação'
    }
}, {
    tableName: 'blog_comments',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['post_id'] },
        { fields: ['user_id'] },
        { fields: ['parent_id'] },
        { fields: ['status'] }
    ]
});

// BlogPage - Páginas estáticas criadas pelo admin
const BlogPage = sequelize.define('BlogPage', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Título da página'
    },
    slug: {
        type: DataTypes.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'URL amigável da página'
    },
    content: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        comment: 'Conteúdo HTML da página'
    },
    status: {
        type: DataTypes.ENUM('published', 'draft'),
        defaultValue: 'draft',
        allowNull: false,
        comment: 'Status da página: publicada ou rascunho'
    },
    meta_description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Meta description para SEO'
    },
    meta_keywords: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Meta keywords para SEO'
    }
}, {
    tableName: 'blog_pages',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['slug'] },
        { fields: ['status'] }
    ]
});

// Relacionamentos do Blog
BlogPost.belongsTo(Usuario, { foreignKey: 'author_id', as: 'author' });
BlogPost.hasMany(BlogComment, { foreignKey: 'post_id', as: 'comments' });

BlogComment.belongsTo(BlogPost, { foreignKey: 'post_id', as: 'post' });
BlogComment.belongsTo(Usuario, { foreignKey: 'user_id', as: 'user' });
BlogComment.belongsTo(BlogComment, { foreignKey: 'parent_id', as: 'parent' });
BlogComment.hasMany(BlogComment, { foreignKey: 'parent_id', as: 'replies' });

// BlogNewsletter - Newsletter do blog
const BlogNewsletter = sequelize.define('BlogNewsletter', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        },
        comment: 'Email do assinante'
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'ID do usuário se estiver autenticado'
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nome do assinante'
    },
    notificar_novos_posts: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Receber notificações de novos posts'
    },
    notificar_reacoes: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Receber notificações de reações nos comentários'
    },
    notificar_respostas: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Receber notificações de respostas aos comentários'
    },
    status: {
        type: DataTypes.ENUM('ativo', 'inativo', 'cancelado'),
        defaultValue: 'ativo',
        allowNull: false,
        comment: 'Status da assinatura'
    },
    token_unsubscribe: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'Token para cancelar assinatura'
    }
}, {
    tableName: 'blog_newsletter',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['email'] },
        { fields: ['user_id'] },
        { fields: ['status'] },
        { fields: ['token_unsubscribe'] }
    ]
});

// CarteiraAdmin - Carteiras do administrador (M-Pesa e Emola)
const CarteiraAdmin = sequelize.define('CarteiraAdmin', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    tipo: {
        type: DataTypes.ENUM('mpesa', 'emola'),
        allowNull: false,
        unique: true,
        comment: 'Tipo de carteira: M-Pesa ou Emola'
    },
    nome: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome da carteira'
    },
    contacto: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'Número de contacto'
    },
    nome_titular: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nome do titular'
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Email do titular'
    },
    saldo: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
        allowNull: false,
        comment: 'Saldo atual da carteira'
    },
    ativa: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        comment: 'Se a carteira está ativa'
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Observações sobre a carteira'
    }
}, {
    tableName: 'carteiras_admin',
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ['tipo'], unique: true }
    ]
});

// TransferenciaB2C - Modelo para transferências B2C
const TransferenciaB2C = sequelize.define('TransferenciaB2C', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false
    },
    id_transacao: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID da transação gerado pelo sistema'
    },
    metodo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Método de transferência (mpesa, emola)'
    },
    valor: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Valor da transferência'
    },
    nome_destinatario: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Nome do destinatário'
    },
    telefone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        comment: 'Telefone do destinatário'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pendente',
        allowNull: false,
        comment: 'Status da transferência (pendente, sucesso, falha)'
    },
    id_transacao_e2payment: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'ID da transação retornado pela API de pagamento'
    },
    resposta_e2payment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Resposta completa da API de pagamento (JSON)'
    },
    observacoes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Observações sobre a transferência'
    },
    data_processamento: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Data de processamento da transferência'
    },
    processado_por: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID do usuário que processou a transferência'
    },
    balance_after: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Saldo após a transferência (retornado pela API GibraPay)'
    }
}, {
    tableName: 'transferencias_b2c',
    timestamps: true,
    underscored: true,
    // Excluir balance_after das queries padrão (coluna não existe na tabela)
    defaultScope: {
        attributes: {
            exclude: ['balance_after']
        }
    },
    indexes: [
        { fields: ['metodo'] },
        { fields: ['status'] },
        { fields: ['id_transacao_e2payment'] }
    ]
});

const databaseManager = new LocalDatabaseManager();

// Log para debug - verificar se Webhook está definido antes de exportar
if (!Webhook) {
    console.error('❌ ERRO: Modelo Webhook não foi definido antes da exportação!');
} else {
    console.log('✅ Modelo Webhook definido e pronto para exportação');
    console.log('✅ Tipo do Webhook:', typeof Webhook);
    console.log('✅ Webhook.name:', Webhook.name);
}

// Criar objeto de exportação com todos os modelos
// IMPORTANTE: Garantir que todos os modelos estão incluídos na ordem correta
const models = {
    databaseManager,
    sequelize,
    Produto,
    Venda,
    Usuario,
    Cliente,
    Configuracao,
    SaldoAdmin,
    Pagamento,
    HistoricoSaques,
    EstatisticasVendedor,
    Carteira,
    CodigoAutenticacao,
    Pedido,
    PontoVenda,
    Notificacao,
    Expert,
    ProdutoComplementarVenda,
    Afiliado,
    VendaAfiliado,
    LinkTracking,
    CliqueValidoAfiliado,
    BannerAfiliado,
    Webhook, // CRÍTICO: Webhook deve estar aqui
    UpsellPage,
    ProdutoUpsell,
    RemarketingQueue,
    RemarketingConversao,
    BlogPost,
    BlogComment,
    BlogPage,
    BlogNewsletter,
    CarteiraAdmin,
    TransferenciaB2C
};

// Verificar se Webhook está no objeto de exportação
if (!models.Webhook) {
    console.error('❌ ERRO CRÍTICO: Webhook não está no objeto de exportação!');
    console.error('❌ Chaves disponíveis:', Object.keys(models));
} else {
    console.log('✅ Webhook confirmado no objeto de exportação');
    console.log('✅ Total de modelos exportados:', Object.keys(models).length);
}

// Exportar explicitamente garantindo que Webhook está incluído
module.exports = models;

// Log adicional após exportação para confirmar
console.log('📦 Módulo database.js exportado com', Object.keys(models).length, 'itens');
console.log('📦 Webhook exportado:', !!module.exports.Webhook);