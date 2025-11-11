/**
 * Serviço de Emails de Ofertas
 * Gerencia emails de promoções, ofertas e marketing avançado
 */

const professionalEmailService = require('./professionalEmailService');

class OfertasEmailService {
    constructor() {
        this.emailService = professionalEmailService;
    }

    /**
     * Enviar oferta especial
     */
    async enviarOfertaEspecial(dadosOferta) {
        const { email, nome, tituloOferta, descricao, desconto, linkOferta, dataExpiracao } = dadosOferta;
        
        const assunto = `🎯 ${tituloOferta} - Oferta Especial!`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Temos uma oferta especial que não pode perder!</p>
            
            <div style="background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%); color: #212529; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <h3 style="margin: 0; font-size: 24px;">🎯 ${tituloOferta}</h3>
                <p style="margin: 10px 0; font-size: 18px;">${descricao}</p>
                ${desconto ? `<div style="font-size: 32px; font-weight: bold; margin: 10px 0;">${desconto}</div>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${linkOferta}" style="background-color: #ffc107; color: #212529; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                    🛒 Aproveitar Oferta
                </a>
            </div>
            
            ${dataExpiracao ? `
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
                    <strong>⏰ Oferta válida até:</strong> ${dataExpiracao}
                </div>
            ` : ''}
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>💡 Dica:</strong> Esta oferta é exclusiva para você! Não perca esta oportunidade.
            </div>
        `;
        
        return await this.emailService.enviarEmail('ofertas', email, assunto, conteudo, 'oferta');
    }

    /**
     * Enviar promoção de produto
     */
    async enviarPromocaoProduto(dadosPromocao) {
        const { email, nome, produtoNome, precoOriginal, precoPromocao, desconto, linkProduto, imagemProduto } = dadosPromocao;
        
        const assunto = `🔥 Promoção: ${produtoNome} com ${desconto} de desconto!`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Que tal aproveitar esta promoção incrível?</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🛍️ ${produtoNome}</h3>
                ${imagemProduto ? `<img src="${imagemProduto}" alt="${produtoNome}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;">` : ''}
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0;">
                    <div>
                        <span style="text-decoration: line-through; color: #6c757d; font-size: 18px;">${precoOriginal}</span>
                        <span style="color: #dc3545; font-size: 24px; font-weight: bold; margin-left: 10px;">${precoPromocao}</span>
                    </div>
                    <div style="background-color: #dc3545; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold;">
                        ${desconto}
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${linkProduto}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                    🛒 Comprar Agora
                </a>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>⚡ Oferta por tempo limitado!</strong> Não perca esta oportunidade de economizar.
            </div>
        `;
        
        return await this.emailService.enviarEmail('ofertas', email, assunto, conteudo, 'promocao');
    }

    /**
     * Enviar newsletter de marketing
     */
    async enviarNewsletter(dadosNewsletter) {
        const { email, nome, titulo, conteudo, linkNewsletter, dataEnvio } = dadosNewsletter;
        
        const assunto = `📧 ${titulo} - Newsletter RatixPay`;
        
        const conteudoEmail = `
            <h2>Olá, ${nome}!</h2>
            <p>Confira as últimas novidades e ofertas do RatixPay:</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📰 Newsletter - ${new Date().toLocaleDateString('pt-BR')}</h3>
                ${conteudo}
            </div>
            
            ${linkNewsletter ? `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${linkNewsletter}" style="background-color: #F64C00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                        📖 Ler Newsletter Completa
                    </a>
                </div>
            ` : ''}
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>📧 Recebendo muitos emails?</strong> Você pode ajustar suas preferências de recebimento em sua conta.
            </div>
        `;
        
        return await this.emailService.enviarEmail('ofertas', email, assunto, conteudoEmail, 'newsletter');
    }

    /**
     * Enviar campanha de remarketing
     */
    async enviarCampanhaRemarketing(dadosCampanha) {
        const { email, nome, produtoInteresse, ofertaEspecial, linkProduto, motivoAbandono } = dadosCampanha;
        
        const assunto = `🔄 Você esqueceu algo? - ${produtoInteresse}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Notamos que você demonstrou interesse em <strong>${produtoInteresse}</strong> mas não finalizou a compra.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🛍️ Produto de Interesse</h3>
                <p><strong>Produto:</strong> ${produtoInteresse}</p>
                ${motivoAbandono ? `<p><strong>Motivo:</strong> ${motivoAbandono}</p>` : ''}
            </div>
            
            ${ofertaEspecial ? `
                <div style="background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%); color: #212529; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h3 style="margin: 0;">🎯 Oferta Especial para Você!</h3>
                    <p style="margin: 10px 0; font-size: 18px;">${ofertaEspecial}</p>
                </div>
            ` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${linkProduto}" style="background-color: #F64C00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🛒 Finalizar Compra
                </a>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>⏰ Tempo limitado!</strong> Esta oferta pode não estar disponível por muito tempo.
            </div>
        `;
        
        return await this.emailService.enviarEmail('ofertas', email, assunto, conteudo, 'remarketing');
    }

    /**
     * Enviar oferta de upsell
     */
    async enviarOfertaUpsell(dadosUpsell) {
        const { email, nome, produtoComprado, produtoUpsell, desconto, linkUpsell, valorEconomia } = dadosUpsell;
        
        const assunto = `🎁 Oferta Especial: ${produtoUpsell}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Parabéns pela sua compra de <strong>${produtoComprado}</strong>! Temos uma oferta especial para você.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🎁 Oferta Complementar</h3>
                <p><strong>Produto:</strong> ${produtoUpsell}</p>
                <p><strong>Desconto:</strong> ${desconto}</p>
                ${valorEconomia ? `<p><strong>Você economiza:</strong> ${valorEconomia}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${linkUpsell}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🛒 Aproveitar Oferta
                </a>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>💡 Dica:</strong> Este produto complementa perfeitamente sua compra anterior!
            </div>
        `;
        
        return await this.emailService.enviarEmail('ofertas', email, assunto, conteudo, 'upsell');
    }
}

module.exports = new OfertasEmailService();
