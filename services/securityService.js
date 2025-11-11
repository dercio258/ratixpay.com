/**
 * Serviço de Segurança para RatixPay
 * Gerencia tentativas de login, bloqueios e desbloqueios
 */

const crypto = require('crypto');
const { Usuario, TentativaLogin, BloqueioConta } = require('../config/database');
const professionalEmailService = require('./professionalEmailService');

class SecurityService {
    constructor() {
        this.MAX_TENTATIVAS = 7; // Máximo de tentativas antes do bloqueio
        this.TEMPO_LIMPEZA = 24 * 60 * 60 * 1000; // 24 horas para limpar tentativas antigas
    }

    /**
     * Registrar tentativa de login
     */
    async registrarTentativaLogin(email, sucesso, motivoFalha = null, ipAddress = null, userAgent = null) {
        try {
            // Buscar usuário por email
            const usuario = await Usuario.findOne({ where: { email } });
            
            if (!usuario) {
                console.log(`⚠️ Tentativa de login com email não encontrado: ${email}`);
                return { sucesso: false, motivo: 'usuario_nao_encontrado' };
            }

            // Verificar se usuário já está bloqueado
            const bloqueio = await this.verificarBloqueio(usuario.id);
            if (bloqueio.bloqueado) {
                console.log(`🔒 Usuário bloqueado tentando acessar: ${email}`);
                // Enviar novo link de desbloqueio automaticamente
                await this.enviarNovoLinkDesbloqueio(usuario);
                return { sucesso: false, motivo: 'conta_bloqueada', bloqueada: true };
            }

            // Registrar tentativa
            await TentativaLogin.create({
                usuario_id: usuario.id,
                email: email,
                ip_address: ipAddress,
                user_agent: userAgent,
                sucesso: sucesso,
                motivo_falha: motivoFalha
            });

            // Se login foi bem-sucedido, limpar tentativas anteriores
            if (sucesso) {
                await this.limparTentativasAnteriores(usuario.id);
                return { sucesso: true };
            }

            // Se login falhou, verificar se deve bloquear
            const tentativasRecentes = await this.contarTentativasRecentes(usuario.id);
            
            if (tentativasRecentes >= this.MAX_TENTATIVAS) {
                console.log(`🔒 Bloqueando conta por excesso de tentativas: ${email}`);
                await this.bloquearConta(usuario, 'tentativas_excedidas', `Excedeu ${this.MAX_TENTATIVAS} tentativas de login incorretas`);
                return { sucesso: false, motivo: 'conta_bloqueada', bloqueada: true };
            }

            return { 
                sucesso: false, 
                motivo: motivoFalha || 'senha_incorreta',
                tentativas_restantes: this.MAX_TENTATIVAS - tentativasRecentes
            };

        } catch (error) {
            console.error('❌ Erro ao registrar tentativa de login:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Contar tentativas recentes de login
     */
    async contarTentativasRecentes(usuarioId) {
        try {
            const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000); // Última hora
            
            const tentativas = await TentativaLogin.count({
                where: {
                    usuario_id: usuarioId,
                    sucesso: false,
                    created_at: {
                        [require('sequelize').Op.gte]: umaHoraAtras
                    }
                }
            });

            return tentativas;
        } catch (error) {
            console.error('❌ Erro ao contar tentativas recentes:', error);
            return 0;
        }
    }

    /**
     * Limpar tentativas anteriores
     */
    async limparTentativasAnteriores(usuarioId) {
        try {
            await TentativaLogin.destroy({
                where: {
                    usuario_id: usuarioId,
                    sucesso: false
                }
            });
        } catch (error) {
            console.error('❌ Erro ao limpar tentativas anteriores:', error);
        }
    }

    /**
     * Bloquear conta
     */
    async bloquearConta(usuario, tipoBloqueio = 'tentativas_excedidas', motivo = null) {
        try {
            // Verificar se já existe bloqueio ativo
            const bloqueioExistente = await BloqueioConta.findOne({
                where: {
                    usuario_id: usuario.id,
                    ativo: true
                }
            });

            if (bloqueioExistente) {
                console.log(`⚠️ Usuário ${usuario.email} já possui bloqueio ativo`);
                return { sucesso: false, motivo: 'ja_bloqueado' };
            }

            // Gerar código de desbloqueio (6 dígitos)
            const codigoDesbloqueio = Math.floor(100000 + Math.random() * 900000).toString();
            const codigoExpira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            // Criar bloqueio
            const bloqueio = await BloqueioConta.create({
                usuario_id: usuario.id,
                email: usuario.email,
                tipo_bloqueio: tipoBloqueio,
                motivo: motivo,
                codigo_desbloqueio: codigoDesbloqueio,
                codigo_expira: codigoExpira,
                ativo: true,
                tentativas_enviadas: { email: false, whatsapp: false }
            });

            // Desativar usuário
            await usuario.update({ ativo: false });

            // Enviar notificações com código
            await this.enviarNotificacoesDesbloqueio(usuario, null, false, codigoDesbloqueio);

            console.log(`✅ Conta bloqueada: ${usuario.email}`);
            return { sucesso: true, codigo: codigoDesbloqueio };

        } catch (error) {
            console.error('❌ Erro ao bloquear conta:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Enviar notificações de desbloqueio
     */
    async enviarNotificacoesDesbloqueio(usuario, tokenDesbloqueio = null, isTentativaAcesso = false, codigoDesbloqueio = null) {
        try {
            // Enviar email
            const emailResult = codigoDesbloqueio 
                ? await professionalEmailService.enviarEmailSistema(
                    usuario.email, 
                    '🔓 Código de Desbloqueio - RatixPay',
                    `Seu código de desbloqueio é: ${codigoDesbloqueio}`,
                    'desbloqueio'
                )
                : isTentativaAcesso 
                    ? await professionalEmailService.enviarEmailSistema(
                        usuario.email, 
                        '⚠️ Tentativa de Acesso Bloqueada - RatixPay',
                        `Sua conta foi bloqueada por tentativas de acesso suspeitas. Token: ${tokenDesbloqueio}`,
                        'seguranca'
                    )
                    : await professionalEmailService.enviarEmailSistema(
                        usuario.email, 
                        '🔓 Conta Desbloqueada - RatixPay',
                        `Sua conta foi desbloqueada. Token: ${tokenDesbloqueio}`,
                        'desbloqueio'
                    );

            // Enviar WhatsApp (se disponível)
            let whatsappResult = { success: false };
            try {
                const telefone = usuario.telefone || usuario.phone;
                if (telefone) {
                    let mensagem = '';
                    
                    if (codigoDesbloqueio) {
                        mensagem = `🔓 *RatixPay - Código de Desbloqueio*\n\nOlá ${usuario.nome || usuario.username},\n\nSua conta foi bloqueada por motivos de segurança.\n\n*Código de desbloqueio:* ${codigoDesbloqueio}\n\n⚠️ *Importante:*\n• Código válido por 15 minutos\n• Use apenas uma vez\n• Não compartilhe\n\n📞 Suporte: +258 86 2127 7274`;
                    } else {
                        const linkDesbloqueio = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/desbloquear-conta?token=${tokenDesbloqueio}`;
                        mensagem = isTentativaAcesso 
                            ? `🔓 *RatixPay - Novo Link de Desbloqueio*\n\nOlá ${usuario.nome || usuario.username},\n\nDetectamos uma tentativa de acesso à sua conta bloqueada.\n\nPara desbloquear, clique no link:\n${linkDesbloqueio}\n\n⚠️ *Importante:*\n• Link válido por 24h\n• Use apenas uma vez\n• Não compartilhe\n\n📞 Suporte: +258 86 2127 7274`
                            : `🔓 *RatixPay - Desbloqueio de Conta*\n\nOlá ${usuario.nome || usuario.username},\n\nSua conta foi bloqueada por motivos de segurança.\n\nPara desbloquear, clique no link:\n${linkDesbloqueio}\n\n⚠️ *Importante:*\n• Link válido por 24h\n• Use apenas uma vez\n• Não compartilhe\n\n📞 Suporte: +258 86 2127 7274`;
                    }
                    
                    const whatsappManager = require('./whatsappManager');
                    await whatsappManager.sendNotificationSafely(telefone, mensagem, null, 'sistema');
                    whatsappResult = { success: true };
                }
            } catch (whatsappError) {
                console.error('❌ Erro ao enviar WhatsApp:', whatsappError);
            }

            // Atualizar status das tentativas
            await BloqueioConta.update(
                { 
                    tentativas_enviadas: { 
                        email: emailResult.success, 
                        whatsapp: whatsappResult.success 
                    } 
                },
                { 
                    where: { 
                        usuario_id: usuario.id, 
                        ativo: true 
                    } 
                }
            );

            console.log(`📧 Email: ${emailResult.success ? 'Enviado' : 'Falhou'}`);
            console.log(`📱 WhatsApp: ${whatsappResult.success ? 'Enviado' : 'Falhou'}`);

        } catch (error) {
            console.error('❌ Erro ao enviar notificações:', error);
        }
    }

    /**
     * Enviar novo código de desbloqueio para usuário bloqueado
     */
    async enviarNovoLinkDesbloqueio(usuario) {
        try {
            // Buscar bloqueio ativo
            const bloqueio = await BloqueioConta.findOne({
                where: {
                    usuario_id: usuario.id,
                    ativo: true
                }
            });

            if (!bloqueio) {
                console.log(`⚠️ Nenhum bloqueio ativo encontrado para: ${usuario.email}`);
                return { sucesso: false, motivo: 'nao_bloqueado' };
            }

            // Verificar se já foi enviado recentemente (evitar spam)
            const agora = new Date();
            const ultimoEnvio = new Date(bloqueio.updated_at);
            const diferencaMinutos = (agora - ultimoEnvio) / (1000 * 60);

            // Só enviar se passou mais de 2 minutos desde o último envio
            if (diferencaMinutos < 2) {
                console.log(`⏰ Código já enviado recentemente para: ${usuario.email} (${Math.round(diferencaMinutos)} min atrás)`);
                return { sucesso: true, motivo: 'ja_enviado_recentemente' };
            }

            // Gerar novo código de desbloqueio (6 dígitos)
            const novoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
            const codigoExpira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

            // Atualizar bloqueio com novo código
            await bloqueio.update({
                codigo_desbloqueio: novoCodigo,
                codigo_expira: codigoExpira,
                updated_at: agora
            });

            // Enviar notificações com código (marcar como tentativa de acesso)
            await this.enviarNotificacoesDesbloqueio(usuario, null, true, novoCodigo);

            console.log(`📧 Novo código de desbloqueio enviado para: ${usuario.email}`);
            return { sucesso: true, codigo: novoCodigo };

        } catch (error) {
            console.error('❌ Erro ao enviar novo código de desbloqueio:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Desbloquear conta por código
     */
    async desbloquearContaPorCodigo(email, codigo) {
        try {
            // Buscar bloqueio ativo com o código
            const bloqueio = await BloqueioConta.findOne({
                where: {
                    email: email,
                    codigo_desbloqueio: codigo,
                    ativo: true
                },
                include: [{
                    model: Usuario,
                    as: 'usuario'
                }]
            });

            if (!bloqueio) {
                return { sucesso: false, motivo: 'codigo_invalido' };
            }

            // Verificar se o código não expirou
            const agora = new Date();
            if (bloqueio.codigo_expira && agora > bloqueio.codigo_expira) {
                return { sucesso: false, motivo: 'codigo_expirado' };
            }

            // Desbloquear conta
            await bloqueio.update({
                ativo: false,
                data_desbloqueio: agora,
                codigo_desbloqueio: null, // Limpar código usado
                codigo_expira: null
            });

            // Reativar usuário
            await bloqueio.usuario.update({ ativo: true });

            // Limpar tentativas de login
            await this.limparTentativasAnteriores(bloqueio.usuario_id);

            console.log(`✅ Conta desbloqueada por código: ${bloqueio.email}`);
            return { sucesso: true, usuario: bloqueio.usuario };

        } catch (error) {
            console.error('❌ Erro ao desbloquear conta por código:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Desbloquear conta por token (mantido para compatibilidade)
     */
    async desbloquearContaPorToken(token) {
        try {
            // Buscar bloqueio ativo com o token
            const bloqueio = await BloqueioConta.findOne({
                where: {
                    token_desbloqueio: token,
                    ativo: true
                },
                include: [{
                    model: Usuario,
                    as: 'usuario'
                }]
            });

            if (!bloqueio) {
                return { sucesso: false, motivo: 'token_invalido' };
            }

            // Verificar se o token não expirou (24 horas)
            const agora = new Date();
            const tempoBloqueio = new Date(bloqueio.created_at);
            const diferencaHoras = (agora - tempoBloqueio) / (1000 * 60 * 60);

            if (diferencaHoras > 24) {
                return { sucesso: false, motivo: 'token_expirado' };
            }

            // Desbloquear conta
            await bloqueio.update({
                ativo: false,
                data_desbloqueio: agora
            });

            // Reativar usuário
            await bloqueio.usuario.update({ ativo: true });

            // Limpar tentativas de login
            await this.limparTentativasAnteriores(bloqueio.usuario_id);

            console.log(`✅ Conta desbloqueada: ${bloqueio.email}`);
            return { sucesso: true, usuario: bloqueio.usuario };

        } catch (error) {
            console.error('❌ Erro ao desbloquear conta:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Verificar se usuário está bloqueado
     */
    async verificarBloqueio(usuarioId) {
        try {
            const bloqueio = await BloqueioConta.findOne({
                where: {
                    usuario_id: usuarioId,
                    ativo: true
                }
            });

            return bloqueio ? {
                bloqueado: true,
                tipo: bloqueio.tipo_bloqueio,
                motivo: bloqueio.motivo,
                dataBloqueio: bloqueio.created_at
            } : { bloqueado: false };

        } catch (error) {
            console.error('❌ Erro ao verificar bloqueio:', error);
            return { bloqueado: false };
        }
    }

    /**
     * Desbloquear conta manualmente (admin)
     */
    async desbloquearContaManual(usuarioId, adminId) {
        try {
            const bloqueio = await BloqueioConta.findOne({
                where: {
                    usuario_id: usuarioId,
                    ativo: true
                },
                include: [{
                    model: Usuario,
                    as: 'usuario'
                }]
            });

            if (!bloqueio) {
                return { sucesso: false, motivo: 'nao_bloqueado' };
            }

            // Desbloquear
            await bloqueio.update({
                ativo: false,
                data_desbloqueio: new Date()
            });

            // Reativar usuário
            await bloqueio.usuario.update({ ativo: true });

            // Limpar tentativas
            await this.limparTentativasAnteriores(usuarioId);

            console.log(`✅ Conta desbloqueada manualmente por admin ${adminId}: ${bloqueio.email}`);
            return { sucesso: true, usuario: bloqueio.usuario };

        } catch (error) {
            console.error('❌ Erro ao desbloquear conta manualmente:', error);
            return { sucesso: false, motivo: 'erro_interno' };
        }
    }

    /**
     * Limpar tentativas antigas (manutenção)
     */
    async limparTentativasAntigas() {
        try {
            const dataLimite = new Date(Date.now() - this.TEMPO_LIMPEZA);
            
            const deletados = await TentativaLogin.destroy({
                where: {
                    created_at: {
                        [require('sequelize').Op.lt]: dataLimite
                    }
                }
            });

            console.log(`🧹 Limpeza: ${deletados} tentativas antigas removidas`);
            return deletados;

        } catch (error) {
            console.error('❌ Erro na limpeza de tentativas:', error);
            return 0;
        }
    }
}

module.exports = new SecurityService();
