const { Expert, Produto, Usuario } = require('../config/database');
const { Op } = require('sequelize');

class ExpertService {
    
    /**
     * Criar um novo expert
     */
    static async criarExpert(vendedorId, dadosExpert) {
        try {
            console.log(`🔄 Criando expert para vendedor ${vendedorId}...`);
            
            const { nome, email, whatsapp, profissao } = dadosExpert;
            
            // Validar dados obrigatórios
            if (!nome || !email || !whatsapp || !profissao) {
                throw new Error('Todos os campos são obrigatórios: nome, email, whatsapp, profissao');
            }
            
            // Verificar se já existe um expert com o mesmo email para este vendedor
            const expertExistente = await Expert.findOne({
                where: {
                    vendedor_id: vendedorId,
                    email: email
                }
            });
            
            if (expertExistente) {
                throw new Error('Já existe um expert com este e-mail cadastrado');
            }
            
            // Criar o expert
            const expert = await Expert.create({
                vendedor_id: vendedorId,
                nome: nome.trim(),
                email: email.trim().toLowerCase(),
                whatsapp: whatsapp.trim(),
                profissao: profissao.trim(),
                ativo: true
            });
            
            console.log(`✅ Expert criado com sucesso: ${expert.nome} (${expert.id})`);
            
            return {
                success: true,
                data: expert,
                message: 'Expert criado com sucesso'
            };
            
        } catch (error) {
            console.error('❌ Erro ao criar expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Listar todos os experts de um vendedor
     */
    static async listarExperts(vendedorId, incluirInativos = false) {
        try {
            console.log(`🔄 Listando experts do vendedor ${vendedorId}...`);
            
            const whereClause = { vendedor_id: vendedorId };
            
            if (!incluirInativos) {
                whereClause.ativo = true;
            }
            
            const experts = await Expert.findAll({
                where: whereClause,
                order: [['nome', 'ASC']]
            });
            
            console.log(`✅ ${experts.length} experts encontrados`);
            
            return {
                success: true,
                data: experts
            };
            
        } catch (error) {
            console.error('❌ Erro ao listar experts:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Buscar expert por ID
     */
    static async buscarExpertPorId(expertId, vendedorId) {
        try {
            console.log(`🔄 Buscando expert ${expertId} do vendedor ${vendedorId}...`);
            
            const expert = await Expert.findOne({
                where: {
                    id: expertId,
                    vendedor_id: vendedorId
                }
            });
            
            if (!expert) {
                return {
                    success: false,
                    message: 'Expert não encontrado'
                };
            }
            
            console.log(`✅ Expert encontrado: ${expert.nome}`);
            
            return {
                success: true,
                data: expert
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Atualizar expert
     */
    static async atualizarExpert(expertId, vendedorId, dadosAtualizacao) {
        try {
            console.log(`🔄 Atualizando expert ${expertId}...`);
            
            const expert = await Expert.findOne({
                where: {
                    id: expertId,
                    vendedor_id: vendedorId
                }
            });
            
            if (!expert) {
                return {
                    success: false,
                    message: 'Expert não encontrado'
                };
            }
            
            // Verificar se o email já existe em outro expert
            if (dadosAtualizacao.email && dadosAtualizacao.email !== expert.email) {
                const expertComEmail = await Expert.findOne({
                    where: {
                        vendedor_id: vendedorId,
                        email: dadosAtualizacao.email,
                        id: { [Op.ne]: expertId }
                    }
                });
                
                if (expertComEmail) {
                    return {
                        success: false,
                        message: 'Já existe outro expert com este e-mail'
                    };
                }
            }
            
            // Atualizar campos
            const camposPermitidos = ['nome', 'email', 'whatsapp', 'profissao', 'ativo'];
            const dadosParaAtualizar = {};
            
            camposPermitidos.forEach(campo => {
                if (dadosAtualizacao[campo] !== undefined) {
                    if (campo === 'email') {
                        dadosParaAtualizar[campo] = dadosAtualizacao[campo].trim().toLowerCase();
                    } else if (typeof dadosAtualizacao[campo] === 'string') {
                        dadosParaAtualizar[campo] = dadosAtualizacao[campo].trim();
                    } else {
                        dadosParaAtualizar[campo] = dadosAtualizacao[campo];
                    }
                }
            });
            
            await expert.update(dadosParaAtualizar);
            
            console.log(`✅ Expert atualizado: ${expert.nome}`);
            
            return {
                success: true,
                data: expert,
                message: 'Expert atualizado com sucesso'
            };
            
        } catch (error) {
            console.error('❌ Erro ao atualizar expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Excluir expert (soft delete - marcar como inativo)
     */
    static async excluirExpert(expertId, vendedorId) {
        try {
            console.log(`🔄 Excluindo expert ${expertId}...`);
            
            const expert = await Expert.findOne({
                where: {
                    id: expertId,
                    vendedor_id: vendedorId
                }
            });
            
            if (!expert) {
                return {
                    success: false,
                    message: 'Expert não encontrado'
                };
            }
            
            // Verificar se o expert está associado a algum produto
            const produtosComExpert = await Produto.count({
                where: { expert_id: expertId }
            });
            
            if (produtosComExpert > 0) {
                return {
                    success: false,
                    message: `Não é possível excluir o expert pois ele está associado a ${produtosComExpert} produto(s). Desassocie os produtos primeiro.`
                };
            }
            
            // Marcar como inativo (soft delete)
            await expert.update({ ativo: false });
            
            console.log(`✅ Expert excluído: ${expert.nome}`);
            
            return {
                success: true,
                message: 'Expert excluído com sucesso'
            };
            
        } catch (error) {
            console.error('❌ Erro ao excluir expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Associar expert a um produto
     */
    static async associarExpertAoProduto(produtoId, expertId, vendedorId) {
        try {
            console.log(`🔄 Associando expert ${expertId} ao produto ${produtoId}...`);
            
            // Verificar se o produto pertence ao vendedor
            const produto = await Produto.findOne({
                where: {
                    id: produtoId,
                    vendedor_id: vendedorId
                }
            });
            
            if (!produto) {
                return {
                    success: false,
                    message: 'Produto não encontrado'
                };
            }
            
            // Verificar se o expert pertence ao vendedor
            const expert = await Expert.findOne({
                where: {
                    id: expertId,
                    vendedor_id: vendedorId,
                    ativo: true
                }
            });
            
            if (!expert) {
                return {
                    success: false,
                    message: 'Expert não encontrado ou inativo'
                };
            }
            
            // Associar expert ao produto
            await produto.update({ expert_id: expertId });
            
            console.log(`✅ Expert ${expert.nome} associado ao produto ${produto.nome}`);
            
            return {
                success: true,
                data: {
                    produto: produto,
                    expert: expert
                },
                message: 'Expert associado ao produto com sucesso'
            };
            
        } catch (error) {
            console.error('❌ Erro ao associar expert ao produto:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Desassociar expert de um produto
     */
    static async desassociarExpertDoProduto(produtoId, vendedorId) {
        try {
            console.log(`🔄 Desassociando expert do produto ${produtoId}...`);
            
            const produto = await Produto.findOne({
                where: {
                    id: produtoId,
                    vendedor_id: vendedorId
                }
            });
            
            if (!produto) {
                return {
                    success: false,
                    message: 'Produto não encontrado'
                };
            }
            
            await produto.update({ expert_id: null });
            
            console.log(`✅ Expert desassociado do produto ${produto.nome}`);
            
            return {
                success: true,
                data: produto,
                message: 'Expert desassociado do produto com sucesso'
            };
            
        } catch (error) {
            console.error('❌ Erro ao desassociar expert do produto:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Associar múltiplos produtos a um expert
     */
    static async associarProdutosAoExpert(produtoIds, expertId, vendedorId) {
        try {
            console.log(`🔄 Associando ${produtoIds.length} produtos ao expert ${expertId}...`);
            
            // Verificar se o expert pertence ao vendedor
            const expert = await Expert.findOne({
                where: {
                    id: expertId,
                    vendedor_id: vendedorId,
                    ativo: true
                }
            });
            
            if (!expert) {
                return {
                    success: false,
                    message: 'Expert não encontrado ou inativo'
                };
            }
            
            // Verificar se todos os produtos pertencem ao vendedor
            const produtos = await Produto.findAll({
                where: {
                    id: { [Op.in]: produtoIds },
                    vendedor_id: vendedorId
                }
            });
            
            if (produtos.length !== produtoIds.length) {
                return {
                    success: false,
                    message: 'Alguns produtos não foram encontrados ou não pertencem ao vendedor'
                };
            }
            
            // Associar todos os produtos ao expert
            await Produto.update(
                { expert_id: expertId },
                {
                    where: {
                        id: { [Op.in]: produtoIds },
                        vendedor_id: vendedorId
                    }
                }
            );
            
            console.log(`✅ ${produtos.length} produtos associados ao expert ${expert.nome}`);
            
            return {
                success: true,
                data: {
                    expert: expert,
                    produtosAssociados: produtos.length
                },
                message: `${produtos.length} produtos associados ao expert com sucesso`
            };
            
        } catch (error) {
            console.error('❌ Erro ao associar produtos ao expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Buscar expert associado a um produto
     */
    static async buscarExpertDoProduto(produtoId, vendedorId) {
        try {
            console.log(`🔄 Buscando expert do produto ${produtoId}...`);
            
            const produto = await Produto.findOne({
                where: {
                    id: produtoId,
                    vendedor_id: vendedorId
                },
                include: [{
                    model: Expert,
                    as: 'expert',
                    where: { ativo: true },
                    required: false
                }]
            });
            
            if (!produto) {
                return {
                    success: false,
                    message: 'Produto não encontrado'
                };
            }
            
            return {
                success: true,
                data: produto.expert
            };
            
        } catch (error) {
            console.error('❌ Erro ao buscar expert do produto:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    /**
     * Listar produtos sem expert associado
     */
    static async listarProdutosSemExpert(vendedorId) {
        try {
            console.log(`🔄 Listando produtos sem expert do vendedor ${vendedorId}...`);
            
            const produtos = await Produto.findAll({
                where: {
                    vendedor_id: vendedorId,
                    expert_id: null,
                    ativo: true
                },
                order: [['nome', 'ASC']]
            });
            
            console.log(`✅ ${produtos.length} produtos sem expert encontrados`);
            
            return {
                success: true,
                data: produtos
            };
            
        } catch (error) {
            console.error('❌ Erro ao listar produtos sem expert:', error.message);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = ExpertService;
