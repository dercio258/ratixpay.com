/**
 * Serviço de Emails de Sistema
 * Gerencia emails de códigos de verificação, boas-vindas e notificações do sistema
 */

const professionalEmailService = require('./professionalEmailService');

class SistemaEmailService {
    constructor() {
        this.emailService = professionalEmailService;
    }

    /**
     * Enviar código de verificação
     */
    async enviarCodigoVerificacao(dadosUsuario) {
        const { email, nome, codigo, motivo, tempoExpiracao } = dadosUsuario;
        
        const assunto = `🔐 Código de Verificação - RatixPay`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Recebemos uma solicitação para ${motivo} em sua conta RatixPay.</p>
            
            <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                <h3 style="color: #6c757d; margin-bottom: 15px;">Código de Verificação</h3>
                <div style="font-size: 32px; font-weight: bold; color: #000; letter-spacing: 8px; margin: 15px 0; font-family: 'Courier New', monospace; background-color: #ffffff; padding: 15px 20px; border-radius: 6px; border: 1px solid #dee2e6; display: inline-block; min-width: 200px;">
                    ${codigo}
                </div>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>⏰ Importante:</strong> Este código expira em <strong>${tempoExpiracao} minutos</strong> e só pode ser usado uma vez.
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>🔒 Por motivos de segurança:</strong> Nunca compartilhe este código com terceiros. A RatixPay nunca solicitará seu código por telefone ou email.
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'codigo');
    }

    /**
     * Enviar email de boas-vindas
     */
    async enviarBoasVindas(dadosUsuario) {
        const { email, nome, tipoUsuario } = dadosUsuario;
        
        const assunto = `🎉 Bem-vindo ao RatixPay!`;
        
        const conteudo = `
            <h2>Bem-vindo ao RatixPay, ${nome}!</h2>
            <p>É um prazer tê-lo conosco! Sua conta ${tipoUsuario} foi criada com sucesso.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🚀 O que você pode fazer agora:</h3>
                <ul>
                    ${tipoUsuario === 'vendedor' ? `
                        <li>📦 Criar e gerenciar seus produtos</li>
                        <li>💰 Acompanhar suas vendas e comissões</li>
                        <li>📊 Visualizar relatórios detalhados</li>
                        <li>💳 Solicitar saques quando desejar</li>
                    ` : `
                        <li>🛒 Comprar produtos digitais</li>
                        <li>📱 Acessar seus produtos a qualquer momento</li>
                        <li>💳 Pagar com segurança</li>
                        <li>📧 Receber confirmações por email</li>
                    `}
                </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/dashboard" style="background-color: #F64C00; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🏠 Acessar Minha Conta
                </a>
            </div>
            
            <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>💡 Dica:</strong> Mantenha seus dados sempre atualizados para uma melhor experiência.
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'boas-vindas');
    }

    /**
     * Enviar notificação de sistema
     */
    async enviarNotificacaoSistema(dadosNotificacao) {
        const { email, nome, titulo, mensagem, tipo } = dadosNotificacao;
        
        const assunto = `🔔 ${titulo} - RatixPay`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>${mensagem}</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>📋 Detalhes da Notificação</h3>
                <p><strong>Tipo:</strong> ${tipo}</p>
                <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/dashboard" style="background-color: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🔍 Ver Detalhes
                </a>
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao');
    }

    /**
     * Enviar email de recuperação de senha
     */
    async enviarRecuperacaoSenha(dadosUsuario) {
        const { email, nome, linkRecuperacao, tempoExpiracao } = dadosUsuario;
        
        const assunto = `🔑 Recuperação de Senha - RatixPay`;
        
        const conteudo = `
            <h2>Olá, ${nome}!</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta RatixPay.</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${linkRecuperacao}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    🔑 Redefinir Minha Senha
                </a>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>⏰ Importante:</strong> Este link expira em <strong>${tempoExpiracao} minutos</strong> por motivos de segurança.
            </div>
            
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <strong>🔒 Segurança:</strong> Se você não solicitou esta recuperação, ignore este email. Sua conta permanece segura.
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'recuperacao');
    }
}

module.exports = new SistemaEmailService();
