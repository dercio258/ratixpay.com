const databaseManager = require('../config/database');

class Cliente {
    constructor(data = {}) {
        this.id = data.id;
        this.nome = data.nome;
        this.email = data.email;
        this.telefone = data.telefone;
        this.endereco = data.endereco ? (typeof data.endereco === 'string' ? JSON.parse(data.endereco) : data.endereco) : {};
        this.dataNascimento = data.data_nascimento;
        this.genero = data.genero;
        this.totalCompras = data.total_compras || 0;
        this.valorTotalGasto = data.valor_total_gasto || 0;
        this.status = data.status || 'Ativo';
        this.observacoes = data.observacoes;
        this.tags = data.tags ? (typeof data.tags === 'string' ? JSON.parse(data.tags) : data.tags) : [];
        this.dataCadastro = data.data_cadastro;
        this.ultimaCompra = data.ultima_compra;
        this.origem = data.origem || 'Site';
        this.createdAt = data.created_at;
        this.updatedAt = data.updated_at;
    }

    // Criar novo cliente
    static async create(clienteData) {
        const pool = databaseManager.getPool();
        
        const query = `
            INSERT INTO clientes (
                nome, email, telefone, endereco, data_nascimento, genero,
                total_compras, valor_total_gasto, status, observacoes, tags,
                data_cadastro, ultima_compra, origem
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING *
        `;

        const values = [
            clienteData.nome,
            clienteData.email,
            clienteData.telefone,
            JSON.stringify(clienteData.endereco || {}),
            clienteData.dataNascimento,
            clienteData.genero,
            clienteData.totalCompras || 0,
            clienteData.valorTotalGasto || 0,
            clienteData.status || 'Ativo',
            clienteData.observacoes,
            JSON.stringify(clienteData.tags || []),
            clienteData.dataCadastro || new Date().toISOString(),
            clienteData.ultimaCompra,
            clienteData.origem || 'Site'
        ];

        const result = await pool.query(query, values);
        return new Cliente(result.rows[0]);
    }

    // Buscar por ID
    static async findById(id) {
        const pool = databaseManager.getPool();
        const result = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
        return result.rows[0] ? new Cliente(result.rows[0]) : null;
    }

    // Buscar por email
    static async findByEmail(email) {
        const pool = databaseManager.getPool();
        const result = await pool.query('SELECT * FROM clientes WHERE email = $1', [email]);
        return result.rows[0] ? new Cliente(result.rows[0]) : null;
    }

    // Buscar por telefone
    static async findByTelefone(telefone) {
        const pool = databaseManager.getPool();
        const result = await pool.query('SELECT * FROM clientes WHERE telefone = $1', [telefone]);
        return result.rows[0] ? new Cliente(result.rows[0]) : null;
    }

    // Buscar todos os clientes
    static async findAll(options = {}) {
        const pool = databaseManager.getPool();
        let query = 'SELECT * FROM clientes';
        const params = [];
        let paramIndex = 1;

        // Filtros
        const conditions = [];
        
        if (options.status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(options.status);
            paramIndex++;
        }

        if (options.origem) {
            conditions.push(`origem = $${paramIndex}`);
            params.push(options.origem);
            paramIndex++;
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // Ordenação
        query += ' ORDER BY created_at DESC';

        // Paginação
        if (options.limit) {
            query += ` LIMIT $${paramIndex}`;
            params.push(options.limit);
            paramIndex++;
        }

        if (options.offset) {
            query += ` OFFSET $${paramIndex}`;
            params.push(options.offset);
        }

        const result = await pool.query(query, params);
        return result.rows.map(cliente => new Cliente(cliente));
    }

    // Atualizar cliente
    async save() {
        const pool = databaseManager.getPool();
        
        if (this.id) {
            // Atualizar
            const query = `
                UPDATE clientes 
                SET nome = $1, email = $2, telefone = $3, endereco = $4, data_nascimento = $5,
                    genero = $6, total_compras = $7, valor_total_gasto = $8, status = $9,
                    observacoes = $10, tags = $11, ultima_compra = $12, origem = $13, updated_at = CURRENT_TIMESTAMP
                WHERE id = $14
                RETURNING *
            `;

            const values = [
                this.nome,
                this.email,
                this.telefone,
                JSON.stringify(this.endereco),
                this.dataNascimento,
                this.genero,
                this.totalCompras,
                this.valorTotalGasto,
                this.status,
                this.observacoes,
                JSON.stringify(this.tags),
                this.ultimaCompra,
                this.origem,
                this.id
            ];

            const result = await pool.query(query, values);
            const updatedCliente = result.rows[0];
            
            // Atualizar instância atual
            Object.assign(this, new Cliente(updatedCliente));
            
            return this;
        } else {
            // Criar novo
            return await Cliente.create(this);
        }
    }

    // Deletar cliente
    static async findByIdAndDelete(id) {
        const pool = databaseManager.getPool();
        const result = await pool.query('DELETE FROM clientes WHERE id = $1 RETURNING *', [id]);
        return result.rows[0] ? new Cliente(result.rows[0]) : null;
    }

    // Contar clientes
    static async count(options = {}) {
        const pool = databaseManager.getPool();
        let query = 'SELECT COUNT(*) FROM clientes';
        const params = [];
        let paramIndex = 1;

        if (options.status) {
            query += ` WHERE status = $${paramIndex}`;
            params.push(options.status);
        }

        const result = await pool.query(query, params);
        return parseInt(result.rows[0].count);
    }

    // Atualizar estatísticas do cliente
    async atualizarEstatisticas() {
        const pool = databaseManager.getPool();
        
        // Buscar vendas do cliente
        const vendasQuery = `
            SELECT COUNT(*) as total_compras, COALESCE(SUM(pagamento_valor), 0) as valor_total
            FROM vendas 
            WHERE cliente_email = $1 AND status = 'Pago'
        `;
        
        const vendasResult = await pool.query(vendasQuery, [this.email]);
        const vendasData = vendasResult.rows[0];
        
        // Buscar última compra
        const ultimaCompraQuery = `
            SELECT data_venda 
            FROM vendas 
            WHERE cliente_email = $1 AND status = 'Pago'
            ORDER BY data_venda DESC 
            LIMIT 1
        `;
        
        const ultimaCompraResult = await pool.query(ultimaCompraQuery, [this.email]);
        const ultimaCompra = ultimaCompraResult.rows[0]?.data_venda;
        
        // Atualizar dados do cliente
        this.totalCompras = parseInt(vendasData.total_compras);
        this.valorTotalGasto = parseFloat(vendasData.valor_total);
        this.ultimaCompra = ultimaCompra;
        
        // Salvar alterações
        await this.save();
        
        return this;
    }

    // Buscar clientes com estatísticas
    static async findWithStats() {
        const pool = databaseManager.getPool();
        const query = `
            SELECT c.*, 
                   COUNT(v.id) as total_vendas,
                   COALESCE(SUM(v.pagamento_valor), 0) as valor_total_gasto,
                   MAX(v.data_venda) as ultima_compra
            FROM clientes c
            LEFT JOIN vendas v ON c.email = v.cliente_email AND v.status = 'Pago'
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `;

        const result = await pool.query(query);
        return result.rows.map(row => ({
            ...new Cliente(row),
            totalVendas: parseInt(row.total_vendas),
            valorTotalGasto: parseFloat(row.valor_total_gasto),
            ultimaCompra: row.ultima_compra
        }));
    }

    // Converter para JSON
    toJSON() {
        return {
            id: this.id,
            nome: this.nome,
            email: this.email,
            telefone: this.telefone,
            endereco: this.endereco,
            dataNascimento: this.dataNascimento,
            genero: this.genero,
            totalCompras: this.totalCompras,
            valorTotalGasto: this.valorTotalGasto,
            status: this.status,
            observacoes: this.observacoes,
            tags: this.tags,
            dataCadastro: this.dataCadastro,
            ultimaCompra: this.ultimaCompra,
            origem: this.origem,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = Cliente;

