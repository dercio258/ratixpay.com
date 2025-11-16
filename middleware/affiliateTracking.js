const { Afiliado, LinkTracking, Produto } = require('../config/database');

// Middleware para capturar e processar tracking de afiliados
async function affiliateTrackingMiddleware(req, res, next) {
    try {
        // Verificar se há parâmetro de referência na URL
        const ref = req.query.ref || req.query.affiliate || req.query.afiliado;
        
        if (!ref) {
            return next();
        }
        
        console.log('🔗 Parâmetro de afiliado detectado:', ref);
        
        // Buscar afiliado pelo código
        const afiliado = await Afiliado.findOne({
            where: { 
                codigo_afiliado: ref,
                status: 'ativo'
            }
        });
        
        if (!afiliado) {
            console.log('⚠️ Afiliado não encontrado ou inativo:', ref);
            return next();
        }
        
        console.log('✅ Afiliado encontrado:', afiliado.nome, '(', afiliado.codigo_afiliado, ')');
        
        // Construir URL original (sem parâmetros de afiliado)
        const urlOriginal = req.originalUrl.split('?')[0];
        const linkAfiliado = req.originalUrl;
        
        // Extrair produto_id da URL se disponível
        const produtoId = req.query.produto ? 
            await Produto.findOne({ where: { custom_id: req.query.produto } }).then(p => p?.id) : 
            null;
        
        // Buscar ou criar link de tracking (garantir um link por produto por afiliado)
        let linkTracking = await LinkTracking.findOne({
            where: {
                afiliado_id: afiliado.id,
                produto_id: produtoId || null,
                link_original: urlOriginal
            }
        });
        
        if (!linkTracking) {
            // Verificar se já existe link para este produto e afiliado (evitar duplicatas)
            if (produtoId) {
                const linkExistente = await LinkTracking.findOne({
                    where: {
                        afiliado_id: afiliado.id,
                        produto_id: produtoId
                    }
                });
                
                if (linkExistente) {
                    linkTracking = linkExistente;
                    // Atualizar link_afiliado se necessário
                    if (linkExistente.link_afiliado !== linkAfiliado) {
                        await linkExistente.update({ link_afiliado: linkAfiliado });
                    }
                } else {
                    linkTracking = await LinkTracking.create({
                        afiliado_id: afiliado.id,
                        produto_id: produtoId,
                        link_original: urlOriginal,
                        link_afiliado: linkAfiliado,
                        cliques: 0,
                        cliques_pagos: 0,
                        creditos_gerados: 0.00,
                        conversoes: 0
                    });
                }
            } else {
                linkTracking = await LinkTracking.create({
                    afiliado_id: afiliado.id,
                    produto_id: null,
                    link_original: urlOriginal,
                    link_afiliado: linkAfiliado,
                    cliques: 0,
                    cliques_pagos: 0,
                    creditos_gerados: 0.00,
                    conversoes: 0
                });
            }
        }
        
        // IMPORTANTE: Não processar clique aqui - será processado apenas quando o botão "Pagar Agora" for clicado
        // Apenas garantir que o link tracking existe para uso posterior
        // O clique será rastreado com validação de fraude apenas no checkout quando o cliente clicar em "Pagar Agora"
        
        // Adicionar informações do afiliado ao request
        req.affiliate = {
            id: afiliado.id,
            codigo: afiliado.codigo_afiliado,
            nome: afiliado.nome,
            comissao_percentual: afiliado.comissao_percentual
        };
        
        // Armazenar código do afiliado na sessão para uso posterior
        if (req.session) {
            req.session.affiliate_ref = afiliado.codigo_afiliado;
        }
        
        console.log(`🔗 Link de afiliado detectado: ${afiliado.nome} (${afiliado.codigo_afiliado}) -> ${urlOriginal} (clique será rastreado apenas no botão "Pagar Agora")`);
        
        next();
        
    } catch (error) {
        console.error('❌ Erro no tracking de afiliados:', error);
        // Continuar sem falhar se houver erro no tracking
        next();
    }
}

// Middleware para capturar referência de afiliado em formulários
function captureAffiliateFromForm(req, res, next) {
    try {
        // Verificar se há referência de afiliado no corpo da requisição
        const affiliateRef = req.body.affiliate_ref || req.body.afiliado_ref || req.body.ref;
        
        if (affiliateRef) {
            req.session.affiliate_ref = affiliateRef;
            console.log('🔗 Referência de afiliado capturada do formulário:', affiliateRef);
        }
        
        next();
    } catch (error) {
        console.error('❌ Erro ao capturar referência de afiliado:', error);
        next();
    }
}

// Função para gerar link de afiliado
async function generateAffiliateLink(originalUrl, codigoAfiliado) {
    try {
        // Verificar se afiliado existe
        const afiliado = await Afiliado.findOne({
            where: { 
                codigo_afiliado: codigoAfiliado,
                status: 'ativo'
            }
        });
        
        if (!afiliado) {
            throw new Error('Afiliado não encontrado ou inativo');
        }
        
        // Gerar link de afiliado
        const separator = originalUrl.includes('?') ? '&' : '?';
        const linkAfiliado = `${originalUrl}${separator}ref=${codigoAfiliado}`;
        
        // Buscar ou criar link de tracking
        const [linkTracking, created] = await LinkTracking.findOrCreate({
            where: {
                afiliado_id: afiliado.id,
                link_original: originalUrl
            },
            defaults: {
                link_afiliado: linkAfiliado,
                cliques: 0,
                conversoes: 0
            }
        });
        
        if (!created) {
            await linkTracking.update({
                link_afiliado: linkAfiliado
            });
        }
        
        return {
            success: true,
            link_original: originalUrl,
            link_afiliado: linkAfiliado,
            codigo_afiliado: codigoAfiliado,
            afiliado: {
                nome: afiliado.nome,
                email: afiliado.email
            },
            tracking_id: linkTracking.id
        };
        
    } catch (error) {
        console.error('❌ Erro ao gerar link de afiliado:', error);
        throw error;
    }
}

// Função para obter estatísticas de um link de afiliado
async function getAffiliateLinkStats(linkTrackingId) {
    try {
        const linkTracking = await LinkTracking.findByPk(linkTrackingId, {
            include: [{
                model: Afiliado,
                as: 'afiliado',
                attributes: ['nome', 'codigo_afiliado', 'email']
            }]
        });
        
        if (!linkTracking) {
            throw new Error('Link de tracking não encontrado');
        }
        
        return {
            success: true,
            data: {
                id: linkTracking.id,
                link_original: linkTracking.link_original,
                link_afiliado: linkTracking.link_afiliado,
                cliques: linkTracking.cliques,
                conversoes: linkTracking.conversoes,
                ultimo_clique: linkTracking.ultimo_clique,
                afiliado: linkTracking.afiliado,
                taxa_conversao: linkTracking.cliques > 0 ? 
                    ((linkTracking.conversoes / linkTracking.cliques) * 100).toFixed(2) : 0
            }
        };
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas do link:', error);
        throw error;
    }
}

// Função para obter estatísticas de um afiliado
async function getAffiliateStats(afiliadoId) {
    try {
        const afiliado = await Afiliado.findByPk(afiliadoId);
        
        if (!afiliado) {
            throw new Error('Afiliado não encontrado');
        }
        
        // Buscar todos os links do afiliado
        const links = await LinkTracking.findAll({
            where: { afiliado_id: afiliadoId }
        });
        
        // Calcular estatísticas totais
        const totalCliques = links.reduce((sum, link) => sum + link.cliques, 0);
        const totalConversoes = links.reduce((sum, link) => sum + link.conversoes, 0);
        const taxaConversao = totalCliques > 0 ? 
            ((totalConversoes / totalCliques) * 100).toFixed(2) : 0;
        
        return {
            success: true,
            data: {
                afiliado: {
                    id: afiliado.id,
                    nome: afiliado.nome,
                    codigo: afiliado.codigo_afiliado,
                    email: afiliado.email,
                    status: afiliado.status,
                    comissao_percentual: afiliado.comissao_percentual,
                    total_vendas: afiliado.total_vendas,
                    total_comissoes: afiliado.total_comissoes,
                    saldo_disponivel: afiliado.saldo_disponivel,
                    ultima_atividade: afiliado.ultima_atividade
                },
                links: links.map(link => ({
                    id: link.id,
                    link_original: link.link_original,
                    link_afiliado: link.link_afiliado,
                    cliques: link.cliques,
                    conversoes: link.conversoes,
                    ultimo_clique: link.ultimo_clique,
                    taxa_conversao: link.cliques > 0 ? 
                        ((link.conversoes / link.cliques) * 100).toFixed(2) : 0
                })),
                estatisticas: {
                    total_links: links.length,
                    total_cliques: totalCliques,
                    total_conversoes: totalConversoes,
                    taxa_conversao_geral: taxaConversao
                }
            }
        };
        
    } catch (error) {
        console.error('❌ Erro ao obter estatísticas do afiliado:', error);
        throw error;
    }
}

module.exports = {
    affiliateTrackingMiddleware,
    captureAffiliateFromForm,
    generateAffiliateLink,
    getAffiliateLinkStats,
    getAffiliateStats
};
