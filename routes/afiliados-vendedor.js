const express = require('express');
const router = express.Router();
const { Afiliado, VendaAfiliado, LinkTracking, Venda, Produto, CliqueValidoAfiliado, sequelize } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');
const SaldoVendedorService = require('../services/saldoVendedorService');

// Função para garantir que as colunas necessárias existem
async function ensureAfiliadoColumns() {
    try {
        // Verificar e criar vendedor_id
        const [vendedorIdCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'vendedor_id'
        `);
        
        if (vendedorIdCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'vendedor_id'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN vendedor_id UUID NULL;
                        RAISE NOTICE 'Coluna vendedor_id adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna vendedor_id criada automaticamente');
        }

        // Verificar e criar meta_pixel_id
        const [metaPixelCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'meta_pixel_id'
        `);
        
        if (metaPixelCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'meta_pixel_id'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN meta_pixel_id VARCHAR(50) NULL;
                        COMMENT ON COLUMN afiliados.meta_pixel_id IS 'ID do Meta Pixel (Facebook Pixel) para rastreamento';
                        RAISE NOTICE 'Coluna meta_pixel_id adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna meta_pixel_id criada automaticamente');
        }

        // Verificar e criar utmify_api_token
        const [utmifyCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'utmify_api_token'
        `);
        
        if (utmifyCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'utmify_api_token'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN utmify_api_token VARCHAR(255) NULL;
                        COMMENT ON COLUMN afiliados.utmify_api_token IS 'API Token do UTMify para rastreamento';
                        RAISE NOTICE 'Coluna utmify_api_token adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna utmify_api_token criada automaticamente');
        }

        // Verificar e criar total_cliques
        const [totalCliquesCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'total_cliques'
        `);
        
        if (totalCliquesCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'total_cliques'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN total_cliques INTEGER NOT NULL DEFAULT 0;
                        COMMENT ON COLUMN afiliados.total_cliques IS 'Total de cliques em todos os links do afiliado';
                        RAISE NOTICE 'Coluna total_cliques adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna total_cliques criada automaticamente');
        }

        // Verificar e criar cliques_pagos
        const [cliquesPagosCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'cliques_pagos'
        `);
        
        if (cliquesPagosCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'cliques_pagos'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN cliques_pagos INTEGER NOT NULL DEFAULT 0;
                        COMMENT ON COLUMN afiliados.cliques_pagos IS 'Total de cliques já pagos';
                        RAISE NOTICE 'Coluna cliques_pagos adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna cliques_pagos criada automaticamente');
        }

        // Verificar e criar creditos_cliques
        const [creditosCliquesCheck] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'afiliados'
            AND column_name = 'creditos_cliques'
        `);
        
        if (creditosCliquesCheck.length === 0) {
            await sequelize.query(`
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'afiliados' 
                        AND column_name = 'creditos_cliques'
                    ) THEN
                        ALTER TABLE afiliados ADD COLUMN creditos_cliques DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
                        COMMENT ON COLUMN afiliados.creditos_cliques IS 'Créditos gerados por cliques (1 MZN a cada 10 cliques)';
                        RAISE NOTICE 'Coluna creditos_cliques adicionada';
                    END IF;
                END $$;
            `);
            console.log('✅ Coluna creditos_cliques criada automaticamente');
        }
    } catch (error) {
        // Ignorar erros de coluna já existe
        if (!error.message.includes('already exists') && 
            !error.message.includes('já existe') &&
            !error.message.includes('duplicate')) {
            console.error('⚠️ Erro ao verificar/criar colunas:', error.message);
        }
    }
}

// Manter função antiga para compatibilidade (chama a nova função)
async function ensureVendedorIdColumn() {
    return ensureAfiliadoColumns();
}

// Wrapper para garantir colunas antes de buscar afiliado
async function buscarAfiliadoComSeguranca(email) {
    try {
        // Garantir que todas as colunas existem
        await ensureAfiliadoColumns();
        
        // Tentar buscar
        return await Afiliado.findOne({
            where: { email: email }
        });
    } catch (error) {
        // Se der erro relacionado a colunas faltantes, tentar criar novamente
        if (error.message && (error.message.includes('meta_pixel_id') || error.message.includes('utmify_api_token'))) {
            console.log('🔄 Erro ao buscar afiliado, recriando colunas...');
            await ensureAfiliadoColumns();
            // Aguardar um pouco para garantir que as colunas foram criadas
            await new Promise(resolve => setTimeout(resolve, 500));
            return await Afiliado.findOne({
                where: { email: email }
            });
        }
        throw error;
    }
}

// Executar na inicialização do módulo
ensureAfiliadoColumns().catch(err => {
    console.error('Erro ao garantir colunas do afiliado:', err);
});

// Função para gerar código de afiliado único
function gerarCodigoAfiliado() {
    return 'AF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Função para verificar e liberar comissões automaticamente quando atingir 50MZN
async function verificarELiberarComissoes(afiliadoId, vendedorId) {
    try {
        // Importar modelos dinamicamente
        const { MovimentoSaldo, SaldoVendedor } = require('../config/database');
        
        if (!MovimentoSaldo || !SaldoVendedor) {
            console.warn('⚠️ MovimentoSaldo ou SaldoVendedor não disponíveis');
            return { liberado: false, valor: 0 };
        }

        // Buscar todas as comissões pendentes do afiliado
        const comissoesPendentes = await VendaAfiliado.findAll({
            where: {
                afiliado_id: afiliadoId,
                status: 'pendente'
            },
            order: [['created_at', 'ASC']]
        });

        // Calcular total acumulado
        const totalAcumulado = comissoesPendentes.reduce((sum, va) => {
            return sum + parseFloat(va.valor_comissao || 0);
        }, 0);

        // Se o total acumulado for >= 50MZN, liberar
        if (totalAcumulado >= 50) {
            const transaction = await sequelize.transaction();
            try {
                // Criar movimento de saldo para o vendedor
                await MovimentoSaldo.create({
                    vendedor_id: vendedorId,
                    tipo: 'credito',
                    origem: 'comissao_afiliado',
                    referencia_id: afiliadoId,
                    valor: totalAcumulado,
                    descricao: `Comissão aprovada de afiliado (acumulado: MZN ${totalAcumulado.toFixed(2)})`
                }, { transaction });

                // Atualizar saldo do vendedor
                const saldo = await SaldoVendedor.findOne({ 
                    where: { vendedor_id: vendedorId }, 
                    transaction 
                });
                
                if (!saldo) {
                    await SaldoVendedor.create({
                        vendedor_id: vendedorId,
                        saldo_atual: totalAcumulado,
                        receita_total: totalAcumulado,
                        receita_hoje: 0,
                        receita_ontem: 0,
                        receita_semana: 0,
                        receita_mes: 0
                    }, { transaction });
                } else {
                    saldo.saldo_atual = +((parseFloat(saldo.saldo_atual || 0)) + totalAcumulado).toFixed(2);
                    saldo.receita_total = +((parseFloat(saldo.receita_total || 0)) + totalAcumulado).toFixed(2);
                    await saldo.save({ transaction });
                }

                // Atualizar status das vendas para 'pago'
                await VendaAfiliado.update(
                    { 
                        status: 'pago',
                        data_pagamento: new Date()
                    },
                    {
                        where: { 
                            afiliado_id: afiliadoId,
                            status: 'pendente'
                        },
                        transaction
                    }
                );

                await transaction.commit();
                console.log(`✅ Comissões liberadas automaticamente: MZN ${totalAcumulado.toFixed(2)} para vendedor ${vendedorId}`);
                
                // Buscar afiliado para enviar notificação
                const afiliadoParaNotificacao = await Afiliado.findByPk(afiliadoId);
                
                // Enviar notificação para o afiliado sobre comissões aprovadas
                if (afiliadoParaNotificacao) {
                    try {
                        const afiliadoVendaService = require('../services/afiliadoVendaService');
                        await afiliadoVendaService.enviarNotificacaoComissoesAprovadas(afiliadoParaNotificacao, totalAcumulado);
                    } catch (notifError) {
                        console.warn('⚠️ Erro ao enviar notificação de comissões aprovadas (não crítico):', notifError);
                    }
                }
                
                return { liberado: true, valor: totalAcumulado };
            } catch (error) {
                await transaction.rollback();
                console.error('❌ Erro ao liberar comissões:', error);
                throw error;
            }
        }

        return { liberado: false, valor: totalAcumulado };
    } catch (error) {
        console.error('❌ Erro ao verificar comissões:', error);
        throw error;
    }
}

// GET - Métricas do vendedor como afiliado
router.get('/metricas', authenticateToken, async (req, res) => {
    try {
        // Verificar se req.user existe
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        const vendedorId = req.user.id;
        
        // Garantir que todas as colunas existem antes de buscar
        await ensureAfiliadoColumns();
        
        // Buscar ou criar registro de afiliado para o vendedor
        let afiliado = await buscarAfiliadoComSeguranca(req.user.email);

        // Se não existe, criar um código de afiliado para o vendedor
        if (!afiliado) {
            const codigoAfiliado = gerarCodigoAfiliado();
            // Criar senha temporária (vendedores não precisam de senha de afiliado, mas o campo é obrigatório)
            const bcrypt = require('bcrypt');
            const senhaHash = await bcrypt.hash(`temp_${vendedorId}_${Date.now()}`, 12);
            
            afiliado = await Afiliado.create({
                nome: req.user.nome_completo || req.user.email,
                email: req.user.email,
                senha: senhaHash,
                codigo_afiliado: codigoAfiliado,
                link_afiliado: `${process.env.BASE_URL || 'http://localhost:4000'}/?ref=${codigoAfiliado}`,
                status: 'ativo',
                vendedor_id: vendedorId,
                email_verificado: true
            });
        }

        const afiliadoId = afiliado.id;
        
        // Total de vendas
        const totalVendas = await VendaAfiliado.count({
            where: { afiliado_id: afiliadoId }
        });

        // Total de cliques - usar SUM do campo cliques
        // Primeiro, buscar todos os links do afiliado para debug
        const linksTracking = await LinkTracking.findAll({
            where: { afiliado_id: afiliadoId },
            attributes: ['id', 'produto_id', 'cliques', 'conversoes']
        });
        
        console.log(`📊 Links de tracking encontrados para afiliado ${afiliadoId}:`, linksTracking.length);
        linksTracking.forEach(link => {
            console.log(`  - Link ${link.id}: ${link.cliques} cliques, ${link.conversoes} conversões`);
        });
        
        const totalCliquesResult = await LinkTracking.findAll({
            where: { afiliado_id: afiliadoId },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('cliques')), 'total']
            ],
            raw: true
        });
        const totalCliques = parseInt(totalCliquesResult[0]?.total || 0);
        
        console.log(`📊 Total de cliques calculado para afiliado ${afiliadoId}: ${totalCliques}`);

        // Comissões
        const comissoesLiberadasResult = await VendaAfiliado.findAll({
            where: { 
                afiliado_id: afiliadoId,
                status: 'pago'
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('valor_comissao')), 'total']
            ],
            raw: true
        });
        const comissoesLiberadas = parseFloat(comissoesLiberadasResult[0]?.total || 0);

        const comissoesPendentesResult = await VendaAfiliado.findAll({
            where: { 
                afiliado_id: afiliadoId,
                status: 'pendente'
            },
            attributes: [
                [sequelize.fn('SUM', sequelize.col('valor_comissao')), 'total']
            ],
            raw: true
        });
        const comissoesPendentes = parseFloat(comissoesPendentesResult[0]?.total || 0);

        const totalComissoes = comissoesLiberadas + comissoesPendentes;

        return res.json({
            success: true,
            data: {
                total_vendas: totalVendas,
                total_comissoes: totalComissoes,
                comissoes_liberadas: comissoesLiberadas,
                comissoes_pendentes: comissoesPendentes,
                total_cliques: totalCliques
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar métricas do vendedor:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar métricas',
            error: error.message
        });
    }
});

// GET - Meus produtos afiliados (vendedor)
router.get('/meus-produtos', authenticateToken, async (req, res) => {
    try {
        // Verificar se req.user existe
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        const vendedorId = req.user.id;
        
        // Garantir que todas as colunas existem antes de buscar (com retry)
        try {
            await ensureAfiliadoColumns();
        } catch (error) {
            console.warn('⚠️ Erro ao garantir colunas (tentando novamente):', error.message);
            // Tentar novamente
            await ensureAfiliadoColumns();
        }
        
        // Buscar afiliado do vendedor
        let afiliado = await buscarAfiliadoComSeguranca(req.user.email);

        if (!afiliado) {
            return res.json({
                success: true,
                data: []
            });
        }

        const afiliadoId = afiliado.id;

        // Buscar links de tracking do afiliado (apenas com produto_id não nulo)
        const links = await LinkTracking.findAll({
            where: { 
                afiliado_id: afiliadoId,
                produto_id: { [Op.ne]: null }
            },
            attributes: ['id', 'produto_id', 'link_afiliado', 'cliques', 'conversoes', 'created_at']
        });

        // Buscar produtos separadamente
        const produtoIds = links.map(l => l.produto_id).filter(id => id !== null);
        
        let produtosMap = new Map();
        if (produtoIds.length > 0) {
            const produtos = await Produto.findAll({
                where: { 
                    id: { [Op.in]: produtoIds },
                    status_aprovacao: 'aprovado', // Apenas produtos aprovados
                    ativo: true // Apenas produtos ativos
                },
                attributes: ['id', 'nome', 'imagem_url', 'preco', 'descricao', 'comissao_afiliados', 'comissao_minima', 'tipo_comissao']
            });
            
            produtos.forEach(p => produtosMap.set(p.id, p));
        }

        // Buscar todas as vendas do afiliado uma vez
        const todasVendas = await VendaAfiliado.findAll({
            where: { afiliado_id: afiliadoId },
            include: [{
                model: Venda,
                as: 'venda',
                required: false,
                attributes: ['id', 'produto_id']
            }]
        });

        // Formatar dados
        const produtosComStats = links.map(link => {
            const produto = produtosMap.get(link.produto_id);
            if (!produto) return null;

            // Filtrar vendas deste produto
            const vendasProduto = todasVendas.filter(va => va.venda && va.venda.produto_id === produto.id);

            const totalVendas = vendasProduto.length;
            const comissoesGeradas = vendasProduto.reduce((sum, v) => sum + parseFloat(v.valor_comissao || 0), 0);
            const totalCliques = link.cliques || 0;

            // Calcular comissão
            const valorProduto = produto.preco || 0;
            const comissaoPercentual = produto.comissao_afiliados || 0;
            const comissaoValor = valorProduto * (comissaoPercentual / 100);

            return {
                id: link.id,
                produto_id: produto.id,
                nome: produto.nome,
                imagem: produto.imagem_url || null,
                comissao_percentual: comissaoPercentual,
                comissao_valor: comissaoValor,
                comissao_info: comissaoPercentual > 0 ? `${comissaoPercentual}%` : 'N/A',
                link_afiliado: link.link_afiliado,
                total_vendas: totalVendas,
                total_cliques: totalCliques,
                comissoes_geradas: comissoesGeradas,
                status: 'ativo',
                created_at: link.created_at
            };
        }).filter(p => p !== null);

        const produtos = produtosComStats;

        return res.json({
            success: true,
            data: produtos
        });
    } catch (error) {
        console.error('❌ Erro ao buscar produtos afiliados:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar produtos afiliados',
            error: error.message
        });
    }
});

// GET - Catálogo de produtos disponíveis (vendedor)
router.get('/catalogo', authenticateToken, async (req, res) => {
    try {
        // Verificar se req.user existe
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        const vendedorId = req.user.id;
        
        // Buscar ou criar afiliado do vendedor
        let afiliado = await buscarAfiliadoComSeguranca(req.user.email);

        if (!afiliado) {
            // Criar afiliado se não existir
            const codigoAfiliado = gerarCodigoAfiliado();
            const bcrypt = require('bcrypt');
            const senhaHash = await bcrypt.hash(`temp_${vendedorId}_${Date.now()}`, 12);
            
            afiliado = await Afiliado.create({
                nome: req.user.nome_completo || req.user.email,
                email: req.user.email,
                senha: senhaHash,
                codigo_afiliado: codigoAfiliado,
                link_afiliado: `${process.env.BASE_URL || 'http://localhost:4000'}/?ref=${codigoAfiliado}`,
                status: 'ativo',
                vendedor_id: vendedorId,
                email_verificado: true
            });
        }

        const afiliadoId = afiliado.id;

        // Verificar produto específico para debug
        const produtoDebug = await sequelize.query(`
            SELECT custom_id, nome, ativo, permitir_afiliados, vendedor_id
            FROM produtos
            WHERE custom_id = '3XXK3MZAU'
            LIMIT 1
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        if (produtoDebug.length > 0) {
            console.log(`🔍 Debug produto 3XXK3MZAU:`, produtoDebug[0]);
        }
        
        // Buscar produtos ativos que permitem afiliados, excluindo os do próprio vendedor
        // Otimização: usar query SQL direta para evitar problemas com coluna "imagem" inexistente
        // Apenas produtos com permitir_afiliados = true (explicitamente marcados)
        let produtosRaw;
        try {
            console.log(`🔍 Buscando produtos para vendedor: ${vendedorId}`);
            
            const queryResult = await sequelize.query(`
                SELECT 
                    id, 
                    nome, 
                    descricao, 
                    preco, 
                    imagem_url,
                    custom_id,
                    comissao_afiliados,
                    comissao_minima,
                    tipo_comissao,
                    vendedor_id,
                    permitir_afiliados,
                    ativo,
                    status_aprovacao
                FROM produtos
                WHERE ativo = true 
                    AND status_aprovacao = 'aprovado'
                    AND (permitir_afiliados = true OR permitir_afiliados IS NULL)
                    AND vendedor_id != CAST(:vendedorId AS UUID)
                ORDER BY nome ASC
                LIMIT 1000
            `, {
                replacements: { vendedorId },
                type: sequelize.QueryTypes.SELECT
            });
            
            // Sequelize.query com QueryTypes.SELECT retorna diretamente um array
            // Mas vamos garantir que seja um array válido
            if (Array.isArray(queryResult)) {
                produtosRaw = queryResult;
            } else if (Array.isArray(queryResult[0])) {
                // Caso raro: pode retornar [results, metadata]
                produtosRaw = queryResult[0];
            } else {
                console.error('❌ Formato inesperado do resultado:', typeof queryResult, queryResult);
                produtosRaw = [];
            }
        } catch (queryError) {
            console.error('❌ Erro na query SQL:', queryError);
            console.error('❌ Stack:', queryError.stack);
            throw queryError;
        }
        
        // Log para debug
        console.log(`📊 Produtos encontrados no catálogo: ${produtosRaw.length}`);
        if (produtosRaw.length > 0) {
            console.log(`   Primeiro produto: ${produtosRaw[0].nome} (custom_id: ${produtosRaw[0].custom_id}, permitir_afiliados: ${produtosRaw[0].permitir_afiliados})`);
            // Verificar se o produto específico está na lista
            const produtoEspecifico = produtosRaw.find(p => p.custom_id === '3XXK3MZAU');
            if (produtoEspecifico) {
                console.log(`   ✅ Produto 3XXK3MZAU encontrado: ${produtoEspecifico.nome}`);
            } else {
                console.log(`   ⚠️ Produto 3XXK3MZAU NÃO encontrado na lista`);
            }
        } else {
            console.log(`   ⚠️ Nenhum produto encontrado com permitir_afiliados = true`);
        }
        
        // Verificar se produtosRaw é um array válido
        if (!Array.isArray(produtosRaw)) {
            console.error('❌ produtosRaw não é um array:', typeof produtosRaw, produtosRaw);
            return res.status(500).json({
                success: false,
                message: 'Erro ao processar resultados da query',
                error: 'Resultado da query não é um array'
            });
        }
        
        // Converter para objetos simples e incluir permitir_afiliados para filtro adicional
        const produtos = produtosRaw.map(p => ({
            id: p.id,
            nome: p.nome,
            descricao: p.descricao,
            preco: p.preco,
            imagem_url: p.imagem_url,
            custom_id: p.custom_id,
            comissao_afiliados: p.comissao_afiliados,
            comissao_minima: p.comissao_minima,
            tipo_comissao: p.tipo_comissao,
            vendedor_id: p.vendedor_id,
            permitir_afiliados: p.permitir_afiliados,
            ativo: p.ativo
        }));

        // Verificar quais produtos o afiliado já está afiliado (busca otimizada)
        const produtosIds = produtos.map(p => p.id);
        const linksExistentes = produtosIds.length > 0 ? await LinkTracking.findAll({
            where: { 
                afiliado_id: afiliadoId,
                produto_id: {
                    [Op.in]: produtosIds // Apenas produtos do catálogo
                }
            },
            attributes: ['produto_id']
        }) : [];

        const produtosAfiliadosIds = new Set(linksExistentes.map(l => l.produto_id));

        // Buscar número de vendas para cada produto
        const produtosComVendas = await Promise.all(
            produtos.map(async (produto) => {
                const totalVendas = await Venda.count({
                    where: {
                        produto_id: produto.id,
                        status: { [Op.in]: ['Aprovado', 'Pago', 'pago', 'PAGO', 'aprovado', 'APROVADO'] }
                    }
                });
                
                return {
                    id: produto.id,
                    nome: produto.nome,
                    imagem_url: produto.imagem_url || null,
                    preco: produto.preco || 0,
                    comissao_afiliados: produto.comissao_afiliados || 0,
                    comissao_minima: produto.comissao_minima || 0,
                    tipo_comissao: produto.tipo_comissao || 'percentual',
                    ja_afiliado: produtosAfiliadosIds.has(produto.id),
                    custom_id: produto.custom_id,
                    total_vendas: totalVendas
                };
            })
        );

        // Formatar dados (já filtrado no banco - apenas permitir_afiliados = true)
        const catalogo = produtosComVendas;
        
        console.log(`📦 Catálogo final formatado: ${catalogo.length} produtos`);

        return res.json({
            success: true,
            data: catalogo
        });
    } catch (error) {
        console.error('❌ Erro ao buscar catálogo:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar catálogo',
            error: error.message
        });
    }
});

// POST - Afiliar-se a um produto (vendedor)
router.post('/afiliar-produto', authenticateToken, async (req, res) => {
    try {
        // Verificar se req.user existe
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        const vendedorId = req.user.id;
        const { produto_id } = req.body;

        if (!produto_id) {
            return res.status(400).json({
                success: false,
                message: 'ID do produto é obrigatório'
            });
        }

        // Buscar ou criar afiliado do vendedor
        let afiliado = await buscarAfiliadoComSeguranca(req.user.email);

        if (!afiliado) {
            const codigoAfiliado = gerarCodigoAfiliado();
            const bcrypt = require('bcrypt');
            const senhaHash = await bcrypt.hash(`temp_${vendedorId}_${Date.now()}`, 12);
            
            afiliado = await Afiliado.create({
                nome: req.user.nome_completo || req.user.email,
                email: req.user.email,
                senha: senhaHash,
                codigo_afiliado: codigoAfiliado,
                link_afiliado: `${process.env.BASE_URL || 'http://localhost:4000'}/?ref=${codigoAfiliado}`,
                status: 'ativo',
                vendedor_id: vendedorId,
                email_verificado: true
            });
        }

        const afiliadoId = afiliado.id;

        // Verificar se o produto existe, está marcado para afiliação e não é do próprio vendedor
        const produto = await Produto.findOne({
            where: {
                id: produto_id,
                ativo: true,
                permitir_afiliados: true, // Deve estar marcado para afiliação
                vendedor_id: {
                    [Op.ne]: vendedorId
                }
            },
            attributes: ['id', 'nome', 'custom_id', 'comissao_afiliados', 'comissao_minima']
        });

        if (!produto) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado ou não disponível para afiliação'
            });
        }

        // Verificar se já está afiliado
        const linkExistente = await LinkTracking.findOne({
            where: {
                afiliado_id: afiliadoId,
                produto_id: produto_id
            }
        });

        if (linkExistente) {
            return res.json({
                success: true,
                message: 'Você já está afiliado a este produto',
                data: {
                    link_afiliado: linkExistente.link_afiliado
                }
            });
        }

        // Criar link de afiliado usando apenas a referência (proteção: produto não exposto na URL)
        // (afiliado já foi buscado anteriormente, não precisa buscar novamente)
        const baseUrl = process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:4000';
        const produtoCustomId = produto.custom_id || produto_id;
        const codigoAfiliado = afiliado.codigo_afiliado;
        const linkOriginal = `${baseUrl}/checkout.html?produto=${produtoCustomId}`; // Para referência interna
        const linkAfiliado = `${baseUrl}/checkout.html?ref=${codigoAfiliado}`; // Link público (sem produto)

        const comissaoPercentual = produto.comissao_afiliados || 0;

        const novoLink = await LinkTracking.create({
            afiliado_id: afiliadoId,
            produto_id: produto_id,
            link_original: linkOriginal,
            link_afiliado: linkAfiliado,
            cliques: 0,
            cliques_pagos: 0,
            creditos_gerados: 0.00,
            conversoes: 0
        });

        return res.json({
            success: true,
            message: 'Produto afiliado com sucesso',
            data: {
                link_afiliado: linkAfiliado,
                comissao_percentual: comissaoPercentual
            }
        });
    } catch (error) {
        console.error('❌ Erro ao afiliar produto:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao afiliar produto',
            error: error.message
        });
    }
});

// GET - Transações do afiliado (vendas e comissões aprovadas)
router.get('/transacoes', authenticateToken, async (req, res) => {
    try {
        // Verificar se req.user existe
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        const vendedorId = req.user.id;
        
        // Buscar afiliado do vendedor
        let afiliado = await buscarAfiliadoComSeguranca(req.user.email);

        if (!afiliado) {
            return res.json({
                success: true,
                data: {
                    vendas: [],
                    comissoes_aprovadas: []
                }
            });
        }

        const afiliadoId = afiliado.id;

        // Verificar e liberar comissões automaticamente se atingir 50MZN
        await verificarELiberarComissoes(afiliadoId, vendedorId).catch(err => {
            console.error('⚠️ Erro ao verificar liberação automática (não crítico):', err);
        });

        // Buscar vendas do afiliado com informações do produto
        const vendasAfiliado = await VendaAfiliado.findAll({
            where: { afiliado_id: afiliadoId },
            include: [{
                model: Venda,
                as: 'venda',
                required: false,
                attributes: ['id', 'status', 'created_at'],
                include: [{
                    model: Produto,
                    as: 'produto',
                    required: false,
                    attributes: ['id', 'nome', 'imagem_url']
                }]
            }],
            order: [['created_at', 'DESC']],
            limit: 500
        });

        // Formatar vendas
        const vendas = vendasAfiliado
            .filter(va => va.venda && va.venda.produto)
            .map(va => ({
                id: va.id,
                tipo: 'venda',
                nome_produto: va.venda.produto.nome,
                data_hora: va.created_at,
                comissao: parseFloat(va.valor_comissao || 0),
                status_venda: va.venda.status || 'pendente',
                valor_venda: parseFloat(va.valor_venda || 0)
            }));

        // Buscar comissões aprovadas (quando foram liberadas para o vendedor)
        // Estas são registradas quando o acumulado atinge 50MZN
        // Usar query SQL direta já que MovimentoSaldo não está disponível no database.js
        let comissoesAprovadas = [];
        try {
            // Tentar buscar diretamente (se a tabela não existir, o erro será capturado)
            const results = await sequelize.query(`
                SELECT id, vendedor_id, tipo, origem, referencia_id, valor, descricao, created_at
                FROM movimento_saldo
                WHERE vendedor_id = CAST(:vendedorId AS UUID)
                    AND origem = 'comissao_afiliado'
                ORDER BY created_at DESC
                LIMIT 500
            `, {
                replacements: { vendedorId },
                type: sequelize.QueryTypes.SELECT
            });
            comissoesAprovadas = Array.isArray(results) ? results : [];
        } catch (error) {
            // Se a tabela não existir ou houver erro, simplesmente retornar array vazio
            // Isso não deve quebrar a funcionalidade principal
            console.error('⚠️ Erro ao buscar comissões aprovadas (não crítico):', error.message);
            comissoesAprovadas = [];
        }

        // Formatar comissões aprovadas
        const comissoesFormatadas = (Array.isArray(comissoesAprovadas) ? comissoesAprovadas : []).map(t => ({
            id: t.id,
            tipo: 'comissao_aprovada',
            nome: 'Comissão Aprovada',
            data_hora: t.created_at || t.createdAt,
            valor: parseFloat(t.valor || 0),
            status: 'aprovado'
        }));

        // Combinar e ordenar todas as transações
        const todasTransacoes = [...vendas, ...comissoesFormatadas].sort((a, b) => {
            return new Date(b.data_hora) - new Date(a.data_hora);
        });

        return res.json({
            success: true,
            data: {
                transacoes: todasTransacoes,
                total_vendas: vendas.length,
                total_comissoes_aprovadas: comissoesFormatadas.length
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar transações:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar transações',
            error: error.message
        });
    }
});

// GET - Histórico e gestão de cliques do afiliado
router.get('/cliques', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
        }
        
        const vendedorId = req.user.id;
        await ensureVendedorIdColumn();
        
        // Buscar afiliado do vendedor
        let afiliado = await Afiliado.findOne({
            where: { email: req.user.email }
        });

        if (!afiliado) {
            return res.json({
                success: true,
                data: {
                    cliques: [],
                    totais: {
                        pagos: 0,
                        pendentes: 0,
                        cancelados: 0,
                        geral: 0
                    }
                }
            });
        }

        const afiliadoId = afiliado.id;
        const { status, produto_id, page = 1, limit = 50 } = req.query;
        
        // Construir filtros
        const whereClause = {
            afiliado_id: afiliadoId
        };
        
        // Filtro por status
        if (status === 'pago') {
            // Cliques pagos: valido = false e motivo_rejeicao contém "convertidos"
            whereClause.valido = false;
            whereClause.motivo_rejeicao = { [Op.like]: '%convertidos%' };
        } else if (status === 'pendente') {
            // Cliques pendentes: valido = true
            whereClause.valido = true;
        } else if (status === 'cancelado') {
            // Cliques cancelados: valido = false e motivo_rejeicao não contém "convertidos" mas não é null
            whereClause.valido = false;
            whereClause.motivo_rejeicao = {
                [Op.ne]: null,
                [Op.notLike]: '%convertidos%'
            };
        }
        
        // Filtro por produto
        if (produto_id) {
            whereClause.produto_id = produto_id;
        }
        
        // Buscar cliques
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const cliques = await CliqueValidoAfiliado.findAndCountAll({
            where: whereClause,
            include: [{
                model: Produto,
                as: 'produto',
                required: false,
                attributes: ['id', 'nome', 'imagem_url', 'custom_id']
            }, {
                model: LinkTracking,
                as: 'linkTracking',
                required: false,
                attributes: ['id', 'link_afiliado']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });
        
        // Contar totais por status
        const totalPagos = await CliqueValidoAfiliado.count({
            where: {
                afiliado_id: afiliadoId,
                valido: false,
                motivo_rejeicao: { [Op.like]: '%convertidos%' }
            }
        });
        
        const totalPendentes = await CliqueValidoAfiliado.count({
            where: {
                afiliado_id: afiliadoId,
                valido: true
            }
        });
        
        const totalCancelados = await CliqueValidoAfiliado.count({
            where: {
                afiliado_id: afiliadoId,
                valido: false,
                motivo_rejeicao: {
                    [Op.ne]: null,
                    [Op.notLike]: '%convertidos%'
                }
            }
        });
        
        // Formatar cliques
        const cliquesFormatados = cliques.rows.map(clique => ({
            id: clique.id,
            produto_nome: clique.produto?.nome || 'Produto não encontrado',
            produto_imagem: clique.produto?.imagem_url || '/assets/images/placeholder-product.png',
            produto_id: clique.produto_id,
            ip_address: clique.ip_address,
            user_agent: clique.user_agent,
            navegador: clique.navegador || 'Desconhecido',
            sistema_operacional: clique.sistema_operacional || 'Desconhecido',
            dispositivo: clique.dispositivo || 'Desktop',
            valido: clique.valido,
            motivo_rejeicao: clique.motivo_rejeicao,
            referer: clique.referer,
            data_hora: clique.created_at,
            link_afiliado: clique.linkTracking?.link_afiliado || null,
            status: clique.valido 
                ? 'pendente' 
                : (clique.motivo_rejeicao && clique.motivo_rejeicao.includes('convertidos') 
                    ? 'pago' 
                    : 'cancelado')
        }));
        
        return res.json({
            success: true,
            data: {
                cliques: cliquesFormatados,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: cliques.count,
                    totalPages: Math.ceil(cliques.count / parseInt(limit))
                },
                totais: {
                    pagos: totalPagos,
                    pendentes: totalPendentes,
                    cancelados: totalCancelados,
                    geral: totalPagos + totalPendentes + totalCancelados
                }
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar cliques:', error);
        console.error('Stack:', error.stack);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar cliques',
            error: error.message
        });
    }
});

// GET - Buscar configurações de integração do afiliado
router.get('/integracao', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
        }
        
        await ensureVendedorIdColumn();
        
        // Buscar afiliado do vendedor
        let afiliado = await Afiliado.findOne({
            where: { email: req.user.email },
            attributes: ['id', 'meta_pixel_id', 'utmify_api_token']
        });

        if (!afiliado) {
            return res.json({
                success: true,
                data: {
                    meta_pixel_id: '',
                    utmify_api_token: ''
                }
            });
        }

        return res.json({
            success: true,
            data: {
                meta_pixel_id: afiliado.meta_pixel_id || '',
                utmify_api_token: afiliado.utmify_api_token || ''
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar configurações de integração:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao buscar configurações',
            error: error.message
        });
    }
});

// PUT - Salvar configurações de integração do afiliado
router.put('/integracao', authenticateToken, async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: 'Usuário não autenticado' });
        }
        
        const { meta_pixel_id, utmify_api_token } = req.body;
        
        await ensureVendedorIdColumn();
        
        // Buscar ou criar afiliado do vendedor
        let afiliado = await Afiliado.findOne({
            where: { email: req.user.email }
        });

        if (!afiliado) {
            // Se não existe, criar um código de afiliado para o vendedor
            const codigoAfiliado = gerarCodigoAfiliado();
            const bcrypt = require('bcrypt');
            const senhaHash = await bcrypt.hash(`temp_${req.user.id}_${Date.now()}`, 12);
            
            afiliado = await Afiliado.create({
                nome: req.user.nome_completo || req.user.email,
                email: req.user.email,
                senha: senhaHash,
                codigo_afiliado: codigoAfiliado,
                link_afiliado: `${process.env.FRONTEND_URL || 'http://localhost:4000'}/checkout.html?ref=${codigoAfiliado}`,
                vendedor_id: req.user.id,
                meta_pixel_id: meta_pixel_id || null,
                utmify_api_token: utmify_api_token || null
            });
        } else {
            // Atualizar configurações
            await afiliado.update({
                meta_pixel_id: meta_pixel_id || null,
                utmify_api_token: utmify_api_token || null
            });
        }

        return res.json({
            success: true,
            message: 'Configurações de integração salvas com sucesso',
            data: {
                meta_pixel_id: afiliado.meta_pixel_id || '',
                utmify_api_token: afiliado.utmify_api_token || ''
            }
        });
    } catch (error) {
        console.error('❌ Erro ao salvar configurações de integração:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro ao salvar configurações',
            error: error.message
        });
    }
});

module.exports = router;

