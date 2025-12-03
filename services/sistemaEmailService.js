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
        
        const assunto = `🎉 Seja Bem-Vindo(a) à Ratixpay! Sua Jornada de Vendas Começa Agora.`;
        
        const nomeParceiro = nome || 'Parceiro';
        
        const conteudo = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">Olá, ${nomeParceiro}!</p>
                
                <p style="line-height: 1.6; margin-bottom: 20px;">
                    É com grande entusiasmo que damos as boas-vindas à comunidade Ratixpay! Você acaba de dar um passo importante para digitalizar seu conhecimento e transformar sua paixão em um negócio lucrativo.
                </p>
                
                <p style="line-height: 1.6; margin-bottom: 20px; font-weight: bold;">
                    Para colocar sua ideia no ar e começar a vender, preparamos três passos simples para você:
                </p>
            
                <div style="background-color: #f8f9fa; border-left: 4px solid #F64C00; padding: 20px; margin: 25px 0; border-radius: 4px;">
                    <ol style="line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 15px;">
                            <strong>Configure seu Produto:</strong> Acesse o painel e cadastre seu curso, e-book ou serviço digital.
                        </li>
                        <li style="margin-bottom: 15px;">
                            <strong>Configure seus Pagamentos:</strong> Adicione sua conta bancária e habilite os métodos de pagamento locais (MPesa, eMola) e internacionais.
                        </li>
                        <li style="margin-bottom: 15px;">
                            <strong>Ative o Marketing:</strong> Explore nossas ferramentas de remarketing e fidelidade para aumentar suas vendas.
                        </li>
                    </ol>
            </div>
            
                <p style="line-height: 1.6; margin-bottom: 30px;">
                    Tudo que você precisa para o sucesso está no seu painel. Clique no botão abaixo para acessar agora e começar a configuração!
                </p>
                
                <div style="text-align: center; margin: 35px 0;">
                    <a href="https://ratixpay.com" 
                       style="background-color: #F64C00; color: white; padding: 15px 35px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        🚀 Acessar Meu Painel
                </a>
            </div>
            
                <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 25px 0;">
                    <p style="margin: 0; line-height: 1.6;">
                        <strong>💡 Lembre-se:</strong> nossa equipe de suporte e seu Gerente de Contas estão prontos para ajudar você a otimizar seus resultados em cada etapa.
                    </p>
                </div>
                
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                    <p style="line-height: 1.8; margin-bottom: 10px;">
                        <strong>Vamos construir juntos o seu sucesso!</strong>
                    </p>
                    <p style="margin: 0;">
                        Atenciosamente,<br>
                        <strong>Equipe Ratixpay</strong>
                    </p>
                </div>
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

    /**
     * Enviar notificação de login
     */
    async enviarNotificacaoLogin(dadosLogin) {
        const { email, nome, ip, userAgent, dataHora } = dadosLogin;
        
        const assunto = `Alerta Imediato: Atividade de Login Detectada em Sua Conta Ratixpay`;
        
        const nomeVendedor = nome || 'Parceiro(a)';
        const emailVendedor = email || 'sua conta';
        
        const conteudo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Alerta de Login - Ratixpay</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        margin: 0; 
                        padding: 0; 
                        background-color: #f4f4f4; 
                    }
                    .email-wrapper { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background-color: #ffffff; 
                    }
                    .header-security { 
                        background-color: #dc3545; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                        border-radius: 8px 8px 0 0; 
                    }
                    .header-security h2 { 
                        margin: 0; 
                        font-size: 24px; 
                        font-weight: bold; 
                        letter-spacing: 2px; 
                    }
                    .content-box { 
                        background-color: #ffffff; 
                        border: 2px solid #dc3545; 
                        border-top: none; 
                        border-radius: 0 0 8px 8px; 
                        padding: 30px 20px; 
                    }
                    .btn-primary { 
                        background-color: #dc3545; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold; 
                        font-size: 16px; 
                        text-align: center; 
                    }
                    @media only screen and (max-width: 600px) {
                        .email-wrapper { width: 100% !important; }
                        .content-box { padding: 20px 15px !important; }
                        .header-security h2 { font-size: 20px !important; }
                        .btn-primary { 
                            padding: 12px 20px !important; 
                            font-size: 14px !important; 
                            display: block !important; 
                            width: 100% !important; 
                            box-sizing: border-box !important; 
                        }
                        p { font-size: 14px !important; }
                        h3 { font-size: 16px !important; }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <!-- Cabeçalho de Segurança -->
                    <div class="header-security">
                        <h2>SEGURANÇA</h2>
                    </div>
                    
                    <div class="content-box">
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Prezado(a) parceiro(a), <strong>${nomeVendedor}</strong>
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        <strong>A sua segurança é a nossa prioridade máxima.</strong>
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        Detectamos um novo acesso à sua conta <strong>${emailVendedor}</strong> na plataforma Ratixpay.
                    </p>
                    </div>
                    
                    <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h3 style="color: #dc3545; margin-top: 0; text-align: center; font-size: 16px;">
                            ➡️ AÇÃO NECESSÁRIA SE NÃO FOI VOCÊ ⬅️
                        </h3>
                        
                        <p style="text-align: center; margin: 20px 0; line-height: 1.6;">
                            Se você <strong>NÃO reconhece</strong> esta atividade de login, clique imediatamente no botão abaixo para proteger sua conta:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://ratixpay.com/forgot-password.html" class="btn-primary">
                                🔒 REDEFINIR SENHA
                            </a>
                        </div>
                        
                        <p style="text-align: center; margin-top: 20px; word-break: break-word; font-size: 14px;">
                            <strong>URL:</strong> <a href="https://ratixpay.com/forgot-password.html" style="color: #007bff; text-decoration: none;">https://ratixpay.com/forgot-password.html</a>
                        </p>
                        
                        <p style="text-align: center; margin-top: 20px; color: #28a745; font-weight: bold; line-height: 1.6;">
                            Trocar a sua senha imediatamente garante a segurança total de seus dados e impede acessos não autorizados.
                        </p>
                    </div>
                    
                    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; line-height: 1.6;">
                            <strong>ℹ️ Informação:</strong> Se este login foi realizado por você, pedimos que ignore esta mensagem.
                        </p>
                    </div>
                    
                    <p style="line-height: 1.6;">Em caso de dúvidas ou necessidade de suporte, estamos à disposição.</p>
                
                    <p style="margin-top: 30px; line-height: 1.6;">
                        Atenciosamente,<br>
                        <strong>Equipe Ratixpay Segurança</strong>
                    </p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_login');
    }

    /**
     * Enviar notificação de bloqueio permanente
     */
    async enviarNotificacaoBloqueio(dadosBloqueio) {
        const { email, nome, numeroVendedor } = dadosBloqueio;
        
        const assunto = `Aviso Importante: Bloqueio Permanente da Sua Conta Ratixpay`;
        
        const conteudo = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Prezado(a) Parceiro(a),</p>
                
                <p>A Ratixpay informa que sua conta, associada ao número de vendedor <strong>${numeroVendedor || 'N/A'}</strong>, foi <strong style="color: #dc3545;">BLOQUEADA PERMANENTEMENTE</strong> com efeito imediato.</p>
                
                <p>Esta ação foi necessária devido à detecção de atividades que violam as nossas <strong>Políticas, Termos e Condições de Uso</strong>. Como resultado, o acesso à sua conta e a utilização de todos os nossos serviços estão suspensos.</p>
                
                <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <h3 style="color: #dc3545; margin-top: 0; text-align: center;">
                        =======================================<br>
                        ⚠️ CONTESTAÇÃO E SUPORTE ⚠️<br>
                        =======================================<br>
                    </h3>
                    
                    <p style="text-align: center; margin: 20px 0;">
                        Se você acredita que houve um engano ou deseja contestar o bloqueio, nossa equipe de Conformidade está à disposição para analisar o seu caso.
                    </p>
                    
                    <p style="text-align: center; margin: 20px 0;">
                        Por favor, entre em contato exclusivamente pelo e-mail de suporte:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="font-size: 18px; font-weight: bold; color: #007bff;">
                            E-mail de Suporte: <a href="mailto:suporte@ratixpay.com" style="color: #007bff;">suporte@ratixpay.com</a>
                        </p>
                    </div>
                </div>
                
                <p>Agradecemos a sua compreensão e reiteramos nosso compromisso com um ambiente seguro para todos.</p>
                
                <p style="margin-top: 30px;">
                    Atenciosamente,<br>
                    <strong>Equipe Ratixpay Segurança & Conformidade</strong>
                </p>
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_bloqueio');
    }

    /**
     * Enviar notificação de bloqueio de conta (com fundos congelados)
     */
    async enviarNotificacaoBloqueioConta(dadosBloqueio) {
        const { email, nome, numeroVendedor } = dadosBloqueio;
        
        const assunto = `⚠️ Conta Bloqueada - Fundos Congelados - Ratixpay`;
        
        const conteudo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Conta Bloqueada - Ratixpay</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        margin: 0; 
                        padding: 0; 
                        background-color: #f4f4f4; 
                    }
                    .email-wrapper { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background-color: #ffffff; 
                    }
                    .header-blocked { 
                        background-color: #dc3545; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                        border-radius: 8px 8px 0 0; 
                    }
                    .header-blocked h2 { 
                        margin: 0; 
                        font-size: 24px; 
                        font-weight: bold; 
                        letter-spacing: 2px; 
                    }
                    .content-box { 
                        background-color: #ffffff; 
                        border: 2px solid #dc3545; 
                        border-top: none; 
                        border-radius: 0 0 8px 8px; 
                        padding: 30px 20px; 
                    }
                    .alert-box { 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 25px 0; 
                    }
                    .alert-warning { 
                        background-color: #fff3cd; 
                        border: 2px solid #ffc107; 
                    }
                    .alert-info { 
                        background-color: #f8f9fa; 
                        border: 2px solid #dee2e6; 
                    }
                    .btn-primary { 
                        background-color: #28a745; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold; 
                        font-size: 16px; 
                        text-align: center; 
                    }
                    @media only screen and (max-width: 600px) {
                        .email-wrapper { width: 100% !important; }
                        .content-box { padding: 20px 15px !important; }
                        .header-blocked h2 { font-size: 20px !important; }
                        .btn-primary { 
                            padding: 12px 20px !important; 
                            font-size: 14px !important; 
                            display: block !important; 
                            width: 100% !important; 
                            box-sizing: border-box !important; 
                        }
                        .alert-box { padding: 15px !important; }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <!-- Cabeçalho de Bloqueio -->
                    <div class="header-blocked">
                        <h2>CONTA BLOQUEADA</h2>
                    </div>
                    
                    <div class="content-box">
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Prezado(a) Parceiro(a), <strong>${nome || 'Parceiro'}</strong>
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        A Ratixpay informa que sua conta, associada ao número de vendedor <strong>${numeroVendedor || 'N/A'}</strong>, foi <strong style="color: #dc3545;">BLOQUEADA</strong> com efeito imediato.
                    </p>
                    
                    <div class="alert-box alert-warning">
                        <h3 style="color: #856404; margin-top: 0; text-align: center; font-size: 18px;">
                            ⚠️ FUNDOS CONGELADOS ⚠️
                        </h3>
                        <p style="margin: 15px 0; line-height: 1.6; color: #856404;">
                            <strong>Importante:</strong> Os fundos da sua conta foram <strong>CONGELADOS</strong> e não estarão disponíveis para saque até que a situação seja resolvida.
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Esta ação foi necessária devido à detecção de atividades que violam as nossas <strong>Políticas, Termos e Condições de Uso</strong>. Como resultado, o acesso à sua conta e a utilização de todos os nossos serviços estão suspensos.
                    </p>
                    
                    <div class="alert-box alert-info">
                        <h3 style="color: #dc3545; margin-top: 0; text-align: center; font-size: 16px;">
                            ⚠️ SE FOI UM ENGANO ⚠️
                        </h3>
                        
                        <p style="text-align: center; margin: 20px 0; line-height: 1.6;">
                            Se você acredita que houve um <strong>ENGANO</strong> ou deseja contestar o bloqueio, nossa equipe de Conformidade está à disposição para analisar o seu caso.
                        </p>
                        
                        <p style="text-align: center; margin: 20px 0; line-height: 1.6;">
                            Por favor, entre em contato <strong>EXCLUSIVAMENTE</strong> pelo e-mail de suporte:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <p style="font-size: 18px; font-weight: bold; color: #007bff; word-break: break-word;">
                                E-mail: <a href="mailto:suporte@ratixpay.com" style="color: #007bff; text-decoration: none;">suporte@ratixpay.com</a>
                            </p>
                            <p style="font-size: 16px; color: #6c757d; margin-top: 10px; word-break: break-word;">
                                WhatsApp: <a href="https://wa.me/258860769147" style="color: #25D366; text-decoration: none;">+258 860 769 147</a>
                            </p>
                        </div>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Agradecemos a sua compreensão e reiteramos nosso compromisso com um ambiente seguro para todos.
                    </p>
                    
                    <p style="margin-top: 30px; line-height: 1.6;">
                        Atenciosamente,<br>
                        <strong>Equipe Ratixpay Segurança & Conformidade</strong>
                    </p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_bloqueio_conta');
    }

    /**
     * Enviar notificação de desbloqueio de conta
     */
    async enviarNotificacaoDesbloqueioConta(dadosDesbloqueio) {
        const { email, nome, numeroVendedor } = dadosDesbloqueio;
        
        const assunto = `✅ Conta Desbloqueada - Ratixpay`;
        
        const conteudo = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Conta Desbloqueada - Ratixpay</title>
                <style>
                    body { 
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
                        line-height: 1.6; 
                        color: #333; 
                        margin: 0; 
                        padding: 0; 
                        background-color: #f4f4f4; 
                    }
                    .email-wrapper { 
                        max-width: 600px; 
                        margin: 0 auto; 
                        background-color: #ffffff; 
                    }
                    .header-unblocked { 
                        background-color: #28a745; 
                        color: white; 
                        padding: 20px; 
                        text-align: center; 
                        border-radius: 8px 8px 0 0; 
                    }
                    .header-unblocked h2 { 
                        margin: 0; 
                        font-size: 24px; 
                        font-weight: bold; 
                        letter-spacing: 2px; 
                    }
                    .content-box { 
                        background-color: #ffffff; 
                        border: 2px solid #28a745; 
                        border-top: none; 
                        border-radius: 0 0 8px 8px; 
                        padding: 30px 20px; 
                    }
                    .alert-success { 
                        background-color: #d4edda; 
                        border: 2px solid #28a745; 
                        border-radius: 8px; 
                        padding: 20px; 
                        margin: 25px 0; 
                    }
                    .btn-primary { 
                        background-color: #28a745; 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        display: inline-block; 
                        font-weight: bold; 
                        font-size: 16px; 
                        text-align: center; 
                    }
                    @media only screen and (max-width: 600px) {
                        .email-wrapper { width: 100% !important; }
                        .content-box { padding: 20px 15px !important; }
                        .header-unblocked h2 { font-size: 20px !important; }
                        .btn-primary { 
                            padding: 12px 20px !important; 
                            font-size: 14px !important; 
                            display: block !important; 
                            width: 100% !important; 
                            box-sizing: border-box !important; 
                        }
                        .alert-success { padding: 15px !important; }
                    }
                </style>
            </head>
            <body>
                <div class="email-wrapper">
                    <!-- Cabeçalho de Desbloqueio -->
                    <div class="header-unblocked">
                        <h2>CONTA DESBLOQUEADA</h2>
                    </div>
                    
                    <div class="content-box">
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Prezado(a) Parceiro(a), <strong>${nome || 'Parceiro'}</strong>
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Temos o prazer de informar que sua conta, associada ao número de vendedor <strong>${numeroVendedor || 'N/A'}</strong>, foi <strong style="color: #28a745;">DESBLOQUEADA</strong> com sucesso.
                    </p>
                    
                    <div class="alert-success">
                        <h3 style="color: #155724; margin-top: 0; text-align: center; font-size: 18px;">
                            ✅ ACESSO RESTAURADO ✅
                        </h3>
                        <p style="margin: 15px 0; line-height: 1.6; color: #155724;">
                            <strong>Boa notícia:</strong> Você já pode acessar sua conta normalmente e utilizar todos os serviços da plataforma Ratixpay.
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://ratixpay.com/login.html" class="btn-primary">
                            🚀 Acessar Minha Conta
                        </a>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Se você tiver alguma dúvida ou precisar de suporte, nossa equipe está à disposição.
                    </p>
                    
                    <p style="margin-top: 30px; line-height: 1.6;">
                        Atenciosamente,<br>
                        <strong>Equipe Ratixpay</strong>
                    </p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_desbloqueio_conta');
    }

    /**
     * Enviar notificação de exclusão de conta
     */
    async enviarNotificacaoExclusaoConta(dadosExclusao) {
        const { email, nome, numeroVendedor } = dadosExclusao;
        
        const assunto = `❌ Conta Excluída Permanentemente - Ratixpay`;
        
        const conteudo = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <!-- Cabeçalho de Exclusão -->
                <div style="background-color: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                    <h2 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">CONTA EXCLUÍDA</h2>
                </div>
                
                <div style="background-color: #ffffff; border: 2px solid #6c757d; border-top: none; border-radius: 0 0 8px 8px; padding: 30px; margin-bottom: 20px;">
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Prezado(a) Parceiro(a), <strong>${nome || 'Parceiro'}</strong>
                    </p>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Informamos que sua conta, associada ao número de vendedor <strong>${numeroVendedor || 'N/A'}</strong>, foi <strong style="color: #dc3545;">EXCLUÍDA PERMANENTEMENTE</strong> do sistema Ratixpay.
                    </p>
                    
                    <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                        <p style="margin: 0; line-height: 1.6; color: #6c757d;">
                            <strong>⚠️ Importante:</strong> Esta ação é <strong>IRREVERSÍVEL</strong>. Todos os dados associados à sua conta foram removidos permanentemente do sistema.
                        </p>
                    </div>
                    
                    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                        Se você acredita que houve um engano ou tem dúvidas sobre esta ação, entre em contato com nossa equipe de suporte:
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <p style="font-size: 16px; color: #6c757d;">
                            E-mail: <a href="mailto:suporte@ratixpay.com" style="color: #007bff; text-decoration: none;">suporte@ratixpay.com</a>
                        </p>
                    </div>
                    
                    <p style="margin-top: 30px; line-height: 1.6;">
                        Atenciosamente,<br>
                        <strong>Equipe Ratixpay</strong>
                    </p>
                </div>
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_exclusao_conta');
    }

    /**
     * Enviar notificação de criação de produto
     */
    async enviarNotificacaoProdutoCriado(dadosProduto) {
        const { email, nome, produto } = dadosProduto;
        
        const assunto = `🎉 Seu produto foi criado com sucesso!`;
        
        const produtoNome = produto.nome || 'Produto';
        const produtoPreco = produto.preco ? `MZN ${parseFloat(produto.preco).toFixed(2)}` : 'N/A';
        
        const conteudo = `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá, <strong>${nome || 'Parceiro'}</strong>!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Parabéns! Seu produto <strong>"${produtoNome}"</strong> foi criado com sucesso e está aguardando aprovação.
            </p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #155724; font-size: 16px;">
                    📦 ${produtoNome}
                </p>
                <p style="margin: 5px 0; color: #155724;">
                    Preço: <strong>${produtoPreco}</strong>
                </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                <strong>O que acontece agora?</strong>
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Seu produto será analisado pela nossa equipe. Você receberá um email quando ele for aprovado e estiver disponível para venda.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/gestao-produtos.html" 
                   style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Ver Meus Produtos
                </a>
            </div>
            
            <p style="margin-top: 30px; line-height: 1.6; color: #666; font-size: 14px;">
                Atenciosamente,<br>
                <strong>Equipe Ratixpay</strong>
            </p>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_criado');
    }

    /**
     * Enviar notificação de produto ativado
     */
    async enviarNotificacaoProdutoAtivado(dadosNotificacao) {
        const { email, nome, produtos } = dadosNotificacao;
        
        const produtosList = Array.isArray(produtos) ? produtos : [produtos];
        const produto = produtosList[0] || {};
        
        const assunto = `✅ Produto Ativado - Ratixpay`;
        
        const conteudo = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Prezado(a) Parceiro(a), <strong>${nome || 'Parceiro'}</strong>
                </p>
                
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Informamos que seu produto foi <strong style="color: #28a745;">ATIVADO</strong> com sucesso na plataforma Ratixpay.
                </p>
                
                <div style="background-color: #d4edda; border: 2px solid #28a745; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h3 style="color: #155724; margin-top: 0; margin-bottom: 15px;">
                        Produto Ativado:
                    </h3>
                    <div style="background-color: white; border-left: 4px solid #28a745; padding: 15px; border-radius: 4px;">
                        <p style="margin: 0; font-weight: bold; color: #333;">
                            ID: <code style="background-color: #f1f1f1; padding: 2px 6px; border-radius: 3px;">${produto.custom_id || 'N/A'}</code>
                        </p>
                        <p style="margin: 5px 0 0 0; color: #666;">
                            Nome: <strong>${produto.nome || 'Produto sem nome'}</strong>
                        </p>
                    </div>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Seu produto já está disponível para venda e pode ser visualizado pelos clientes.
                </p>
                
                <p style="margin-top: 30px; line-height: 1.6;">
                    Atenciosamente,<br>
                    <strong>Equipe Ratixpay</strong>
                </p>
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_ativado');
    }

    /**
     * Enviar notificação de produto deletado
     */
    async enviarNotificacaoProdutoDeletado(dadosNotificacao) {
        const { email, nome, produtos } = dadosNotificacao;
        
        // produtos é um array de produtos deletados/desativados
        const produtosList = produtos.map(p => ({
            custom_id: p.custom_id || p.customId || 'N/A',
            nome: p.nome || 'Produto sem nome',
            acao: p.acao || 'excluído'
        }));

        const assunto = produtosList.length === 1 
            ? `Produto ${produtosList[0].acao === 'excluído' ? 'Excluído' : 'Desativado'} - Ratixpay`
            : `${produtosList.length} Produtos ${produtosList[0].acao === 'excluído' ? 'Excluídos' : 'Desativados'} - Ratixpay`;
        
        const conteudo = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <p>Prezado(a) Parceiro(a) <strong>${nome}</strong>,</p>
                
                <p>Informamos que ${produtosList.length === 1 ? 'seu produto foi' : 'seus produtos foram'} ${produtosList[0].acao === 'excluído' ? 'excluído' : 'desativado'}${produtosList.length > 1 ? 's' : ''} da plataforma Ratixpay por um administrador do sistema.</p>
                
                <div style="background-color: #f8f9fa; border: 2px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h3 style="color: #dc3545; margin-top: 0; margin-bottom: 15px;">
                        ${produtosList.length === 1 ? 'Produto Afetado:' : 'Produtos Afetados:'}
                    </h3>
                    ${produtosList.map(p => `
                        <div style="background-color: white; border-left: 4px solid #dc3545; padding: 15px; margin-bottom: 10px; border-radius: 4px;">
                            <p style="margin: 0; font-weight: bold; color: #333;">
                                ID: <code style="background-color: #f1f1f1; padding: 2px 6px; border-radius: 3px;">${p.custom_id}</code>
                            </p>
                            <p style="margin: 5px 0 0 0; color: #666;">
                                Nome: <strong>${p.nome}</strong>
                            </p>
                            <p style="margin: 5px 0 0 0; color: #dc3545; font-size: 0.9em;">
                                Status: ${p.acao === 'excluído' ? 'Excluído permanentemente' : 'Desativado'}
                            </p>
                        </div>
                    `).join('')}
                </div>
                
                ${produtosList.some(p => p.acao === 'desativado') ? `
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0;">
                            <strong>ℹ️ Nota:</strong> Alguns produtos foram desativados em vez de excluídos porque possuem vendas associadas. Produtos com vendas não podem ser excluídos permanentemente para preservar o histórico de transações.
                        </p>
                    </div>
                ` : ''}
                
                <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0;">
                        <strong>💡 Precisa de ajuda?</strong> Se você acredita que houve um engano ou tem dúvidas sobre esta ação, entre em contato com nossa equipe de suporte:
                    </p>
                    <p style="margin: 10px 0 0 0; text-align: center;">
                        <strong>E-mail:</strong> <a href="mailto:suporte@ratixpay.com" style="color: #007bff;">suporte@ratixpay.com</a>
                    </p>
                </div>
                
                <p style="margin-top: 30px;">
                    Atenciosamente,<br>
                    <strong>Equipe Ratixpay</strong>
                </p>
            </div>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_deletado');
    }

    /**
     * Enviar notificação de solicitação de aprovação de produto para admin
     */
    async enviarSolicitacaoAprovacaoProduto(dadosSolicitacao) {
        const { email, nome, produto, vendedor, motivo_rejeicao } = dadosSolicitacao;
        
        const assunto = `Produto aguardando sua aprovação`;
        
        const conteudo = `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá, <strong>${nome || 'Administrador'}</strong>!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Um produto precisa da sua aprovação manual. O vendedor solicitou revisão após a rejeição automática.
            </p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #495057; font-size: 16px;">
                    📦 ${produto.nome || 'Produto'}
                </p>
                <p style="margin: 5px 0; color: #495057;">
                    Vendedor: <strong>${vendedor.nome || 'N/A'}</strong> (${vendedor.email || 'N/A'})
                </p>
                <p style="margin: 5px 0; color: #495057;">
                    Categoria: ${produto.categoria || 'N/A'}
                </p>
            </div>
            
            ${motivo_rejeicao ? `
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #856404; font-size: 16px;">
                    ⚠️ Motivo da rejeição automática:
                </p>
                <p style="margin: 0; color: #856404; line-height: 1.6;">
                    ${motivo_rejeicao}
                </p>
            </div>
            ` : ''}
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                <strong>O que fazer?</strong>
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Acesse o painel administrativo para revisar o produto e decidir se deve ser aprovado ou rejeitado.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/admin-produtos.html?pendente=${produto.id}" 
                   style="background-color: #ffc107; color: #333; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Revisar Produto
                </a>
            </div>
            
            <p style="margin-top: 30px; line-height: 1.6; color: #666; font-size: 14px;">
                Atenciosamente,<br>
                <strong>Equipe Ratixpay</strong>
            </p>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'solicitacao_aprovacao_produto');
    }

    /**
     * Enviar notificação de aprovação de produto pelo admin
     */
    async enviarNotificacaoProdutoAprovadoAdmin(dadosNotificacao) {
        const { email, nome, produto } = dadosNotificacao;
        
        const assunto = `✅ Seu produto foi aprovado!`;
        
        const conteudo = `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá, <strong>${nome || 'Parceiro'}</strong>!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Ótimas notícias! Seu produto <strong>"${produto.nome || 'Produto'}"</strong> foi <strong style="color: #28a745;">aprovado</strong> pelo administrador e já está disponível para venda.
            </p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #155724; font-size: 16px;">
                    📦 ${produto.nome || 'Produto'}
                </p>
                <p style="margin: 5px 0; color: #155724;">
                    Preço: <strong>MZN ${produto.preco ? parseFloat(produto.preco).toFixed(2) : 'N/A'}</strong>
                </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                <strong>O que fazer agora?</strong>
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Seu produto já está ativo e pode ser visualizado pelos clientes. Você pode compartilhar o link e começar a vender!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/gestao-produtos.html" 
                   style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Ver Meus Produtos
                </a>
            </div>
            
            <p style="margin-top: 30px; line-height: 1.6; color: #666; font-size: 14px;">
                Atenciosamente,<br>
                <strong>Equipe Ratixpay</strong>
            </p>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_aprovado_admin');
    }

    /**
     * Enviar notificação de produto aprovado pela API
     */
    async enviarNotificacaoProdutoAprovado(dadosNotificacao) {
        const { email, nome, produto } = dadosNotificacao;
        
        const assunto = `✅ Seu produto foi aprovado!`;
        
        const conteudo = `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá, <strong>${nome || 'Parceiro'}</strong>!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Ótimas notícias! Seu produto <strong>"${produto.nome || 'Produto'}"</strong> foi <strong style="color: #28a745;">aprovado</strong> e já está disponível para venda.
            </p>
            
            <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #155724; font-size: 16px;">
                    📦 ${produto.nome || 'Produto'}
                </p>
                <p style="margin: 5px 0; color: #155724;">
                    Preço: <strong>MZN ${produto.preco ? parseFloat(produto.preco).toFixed(2) : 'N/A'}</strong>
                </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                <strong>O que fazer agora?</strong>
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Você já pode compartilhar o link do seu produto e começar a vender! Acesse seu painel para copiar o link e usar nossas ferramentas de marketing.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/gestao-produtos.html" 
                   style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Ver Meus Produtos
                </a>
            </div>
            
            <p style="margin-top: 30px; line-height: 1.6; color: #666; font-size: 14px;">
                Atenciosamente,<br>
                <strong>Equipe Ratixpay</strong>
            </p>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_aprovado');
    }

    /**
     * Enviar notificação de produto rejeitado pela API
     */
    async enviarNotificacaoProdutoRejeitado(dadosNotificacao) {
        const { email, nome, produto, motivo } = dadosNotificacao;
        
        const assunto = `Seu produto precisa de ajustes`;
        
        const conteudo = `
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Olá, <strong>${nome || 'Parceiro'}</strong>!
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Seu produto <strong>"${produto.nome || 'Produto'}"</strong> não foi aprovado automaticamente. Não se preocupe, você pode fazer ajustes e tentar novamente.
            </p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px 0; font-weight: bold; color: #856404; font-size: 16px;">
                    📋 Motivo:
                </p>
                <p style="margin: 0; color: #856404; line-height: 1.6;">
                    ${motivo || 'O produto não atende aos critérios de aprovação. Por favor, revise as informações e faça os ajustes necessários.'}
                </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                <strong>O que fazer agora?</strong>
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Acesse seu painel, edite o produto com base no motivo indicado acima e envie novamente para aprovação.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="https://ratixpay.com/gestao-produtos.html" 
                   style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Editar Produto
                </a>
            </div>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #6c757d; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; line-height: 1.6; color: #495057;">
                    <strong>Precisa de ajuda?</strong> Entre em contato: <a href="mailto:suporte@ratixpay.com" style="color: #007bff;">suporte@ratixpay.com</a>
                </p>
            </div>
            
            <p style="margin-top: 30px; line-height: 1.6; color: #666; font-size: 14px;">
                Atenciosamente,<br>
                <strong>Equipe Ratixpay</strong>
            </p>
        `;
        
        return await this.emailService.enviarEmail('sistema', email, assunto, conteudo, 'notificacao_produto_rejeitado');
    }
}

module.exports = new SistemaEmailService();
