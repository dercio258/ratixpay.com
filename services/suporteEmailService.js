/**
 * Serviço de Emails de Suporte
 * Gerencia emails de reclamações, sugestões e reembolsos
 */

const professionalEmailService = require('./professionalEmailService');

class SuporteEmailService {
    constructor() {
        this.emailService = professionalEmailService;
    }

    /**
     * Enviar confirmação de reclamação
     */
    async enviarConfirmacaoReclamacao(dadosReclamacao) {
        const { email, nome, numeroTicket, assunto, descricao } = dadosReclamacao;
        
        const assuntoEmail = `📋 Reclamação Recebida - Ticket #${numeroTicket}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Recebemos sua reclamação e ela está sendo analisada pela nossa equipe de suporte.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📋 Detalhes da Reclamação</h3>
                <p><strong>Número do Ticket:</strong> #${numeroTicket}</p>
                <p><strong>Assunto:</strong> ${assunto}</p>
                <p><strong>Descrição:</strong> ${descricao}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>✅ Recebido!</strong> Nossa equipe analisará sua reclamação e retornará em até 24 horas.
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>📞 Precisa de ajuda imediata?</strong> Entre em contato via WhatsApp: <a href="https://wa.me/258867792543">+258 867 792 543</a>
            </div>
        `;
        
        return await this.emailService.enviarEmail('suporte', email, assuntoEmail, conteudo, 'reclamacao');
    }

    /**
     * Enviar confirmação de sugestão
     */
    async enviarConfirmacaoSugestao(dadosSugestao) {
        const { email, nome, numeroTicket, sugestao } = dadosSugestao;
        
        const assunto = `💡 Sugestão Recebida - Ticket #${numeroTicket}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Obrigado por sua sugestão! Ela é muito importante para melhorarmos nossos serviços.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>💡 Sua Sugestão</h3>
                <p><strong>Número do Ticket:</strong> #${numeroTicket}</p>
                <p><strong>Sugestão:</strong> ${sugestao}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>🙏 Obrigado!</strong> Sua sugestão será analisada pela nossa equipe de desenvolvimento.
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>💡 Dica:</strong> As melhores sugestões são aquelas que nos ajudam a melhorar a experiência do usuário!
            </div>
        `;
        
        return await this.emailService.enviarEmail('suporte', email, assunto, conteudo, 'sugestao');
    }

    /**
     * Enviar confirmação de solicitação de reembolso
     */
    async enviarConfirmacaoReembolso(dadosReembolso) {
        const { email, nome, numeroTicket, valorReembolso, motivo, prazoProcessamento } = dadosReembolso;
        
        const assunto = `💰 Solicitação de Reembolso - Ticket #${numeroTicket}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Sua solicitação de reembolso foi recebida e está sendo processada.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>💰 Detalhes do Reembolso</h3>
                <p><strong>Número do Ticket:</strong> #${numeroTicket}</p>
                <p><strong>Valor:</strong> ${valorReembolso}</p>
                <p><strong>Motivo:</strong> ${motivo}</p>
                <p><strong>Prazo de Processamento:</strong> ${prazoProcessamento}</p>
                <p><strong>Data da Solicitação:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>✅ Recebido!</strong> Sua solicitação será analisada e processada conforme nossos termos de uso.
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>📞 Dúvidas?</strong> Entre em contato conosco: <a href="mailto:suporte@ratixpay.com">suporte@ratixpay.com</a>
            </div>
        `;
        
        return await this.emailService.enviarEmail('suporte', email, assunto, conteudo, 'reembolso');
    }

    /**
     * Enviar resposta de suporte
     */
    async enviarRespostaSuporte(dadosResposta) {
        const { email, nome, numeroTicket, resposta, atendente } = dadosResposta;
        
        const assunto = `📞 Resposta do Suporte - Ticket #${numeroTicket}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Nossa equipe de suporte respondeu ao seu ticket.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📞 Resposta do Suporte</h3>
                <p><strong>Número do Ticket:</strong> #${numeroTicket}</p>
                <p><strong>Atendente:</strong> ${atendente}</p>
                <p><strong>Data da Resposta:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4>💬 Mensagem:</h4>
                <p>${resposta}</p>
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>❓ Ainda tem dúvidas?</strong> Responda este email ou entre em contato conosco.
            </div>
        `;
        
        return await this.emailService.enviarEmail('suporte', email, assunto, conteudo, 'resposta');
    }

    /**
     * Enviar notificação de resolução
     */
    async enviarNotificacaoResolucao(dadosResolucao) {
        const { email, nome, numeroTicket, status, solucao } = dadosResolucao;
        
        const assunto = `✅ Ticket Resolvido - #${numeroTicket}`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Seu ticket foi ${status.toLowerCase()} pela nossa equipe de suporte.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📋 Detalhes da Resolução</h3>
                <p><strong>Número do Ticket:</strong> #${numeroTicket}</p>
                <p><strong>Status:</strong> ${status}</p>
                <p><strong>Data da Resolução:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            ${solucao ? `
                <div style="background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                    <h4>💡 Solução:</h4>
                    <p>${solucao}</p>
                </div>
            ` : ''}
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>✅ Resolvido!</strong> Esperamos que sua experiência tenha sido positiva. Avalie nosso atendimento!
            </div>
        `;
        
        return await this.emailService.enviarEmail('suporte', email, assunto, conteudo, 'resolucao');
    }
}

module.exports = new SuporteEmailService();
