/**
 * Serviço para detectar fraudes em cliques de afiliados
 */

const { CliqueValidoAfiliado } = require('../config/database');
const { Op } = require('sequelize');
const crypto = require('crypto');

class FraudeDetectionService {
    constructor() {
        // Limites para detecção de fraude
        this.MAX_CLIQUES_POR_IP_POR_HORA = 5; // Máximo 5 cliques válidos do mesmo IP por hora
        this.MAX_CLIQUES_POR_AFILIADO_POR_HORA = 20; // Máximo 20 cliques válidos por afiliado por hora
        this.TEMPO_MINIMO_ENTRE_CLIQUES = 60000; // 1 minuto entre cliques do mesmo IP/afiliado
    }

    /**
     * Detectar navegador e sistema operacional do user agent
     */
    detectarNavegador(userAgent) {
        if (!userAgent) return { navegador: 'Desconhecido', sistema: 'Desconhecido', dispositivo: 'Desconhecido' };

        let navegador = 'Desconhecido';
        let sistema = 'Desconhecido';
        let dispositivo = 'Desktop';

        // Detectar navegador
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
            navegador = 'Chrome';
        } else if (userAgent.includes('Firefox')) {
            navegador = 'Firefox';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            navegador = 'Safari';
        } else if (userAgent.includes('Edg')) {
            navegador = 'Edge';
        } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
            navegador = 'Opera';
        }

        // Detectar sistema operacional
        if (userAgent.includes('Windows')) {
            sistema = 'Windows';
        } else if (userAgent.includes('Mac OS X') || userAgent.includes('Macintosh')) {
            sistema = 'macOS';
        } else if (userAgent.includes('Linux')) {
            sistema = 'Linux';
        } else if (userAgent.includes('Android')) {
            sistema = 'Android';
            dispositivo = 'Mobile';
        } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
            sistema = 'iOS';
            dispositivo = userAgent.includes('iPad') ? 'Tablet' : 'Mobile';
        }

        // Detectar dispositivo
        if (userAgent.includes('Mobile') && !userAgent.includes('iPad')) {
            dispositivo = 'Mobile';
        } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
            dispositivo = 'Tablet';
        }

        return { navegador, sistema, dispositivo };
    }

    /**
     * Gerar fingerprint único do navegador
     */
    gerarFingerprint(userAgent, ipAddress, referer) {
        const data = `${userAgent}|${ipAddress}|${referer || ''}`;
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    }

    /**
     * Verificar se há cliques suspeitos do mesmo IP
     */
    async verificarCliquesIP(ipAddress, afiliadoId, produtoId = null) {
        try {
            const umaHoraAtras = new Date(Date.now() - 3600000); // 1 hora atrás

            // Contar cliques válidos do mesmo IP na última hora
            const cliquesIP = await CliqueValidoAfiliado.count({
                where: {
                    ip_address: ipAddress,
                    valido: true,
                    created_at: {
                        [Op.gte]: umaHoraAtras
                    }
                }
            });

            if (cliquesIP >= this.MAX_CLIQUES_POR_IP_POR_HORA) {
                return {
                    valido: false,
                    motivo: `Muitos cliques do mesmo IP (${cliquesIP} cliques na última hora). Limite: ${this.MAX_CLIQUES_POR_IP_POR_HORA}`
                };
            }

            // Verificar se há clique muito recente do mesmo IP
            const ultimoClique = await CliqueValidoAfiliado.findOne({
                where: {
                    ip_address: ipAddress,
                    valido: true
                },
                order: [['created_at', 'DESC']]
            });

            if (ultimoClique) {
                const tempoDesdeUltimoClique = Date.now() - new Date(ultimoClique.created_at).getTime();
                if (tempoDesdeUltimoClique < this.TEMPO_MINIMO_ENTRE_CLIQUES) {
                    return {
                        valido: false,
                        motivo: `Clique muito rápido após o anterior (${Math.round(tempoDesdeUltimoClique / 1000)}s). Mínimo: ${this.TEMPO_MINIMO_ENTRE_CLIQUES / 1000}s`
                    };
                }
            }

            return { valido: true };
        } catch (error) {
            console.error('❌ Erro ao verificar cliques por IP:', error);
            // Em caso de erro, permitir o clique (não bloquear por falha técnica)
            return { valido: true };
        }
    }

    /**
     * Verificar se há cliques suspeitos do mesmo afiliado
     */
    async verificarCliquesAfiliado(afiliadoId) {
        try {
            const umaHoraAtras = new Date(Date.now() - 3600000);

            // Contar cliques válidos do mesmo afiliado na última hora
            const cliquesAfiliado = await CliqueValidoAfiliado.count({
                where: {
                    afiliado_id: afiliadoId,
                    valido: true,
                    created_at: {
                        [Op.gte]: umaHoraAtras
                    }
                }
            });

            if (cliquesAfiliado >= this.MAX_CLIQUES_POR_AFILIADO_POR_HORA) {
                return {
                    valido: false,
                    motivo: `Muitos cliques do mesmo afiliado (${cliquesAfiliado} cliques na última hora). Limite: ${this.MAX_CLIQUES_POR_AFILIADO_POR_HORA}`
                };
            }

            return { valido: true };
        } catch (error) {
            console.error('❌ Erro ao verificar cliques por afiliado:', error);
            return { valido: true };
        }
    }

    /**
     * Verificar se há cliques duplicados do mesmo fingerprint
     */
    async verificarFingerprintDuplicado(fingerprint, afiliadoId) {
        try {
            const umaHoraAtras = new Date(Date.now() - 3600000);

            // Verificar se o mesmo fingerprint já fez clique válido recentemente
            const cliqueExistente = await CliqueValidoAfiliado.findOne({
                where: {
                    fingerprint: fingerprint,
                    afiliado_id: afiliadoId,
                    valido: true,
                    created_at: {
                        [Op.gte]: umaHoraAtras
                    }
                }
            });

            if (cliqueExistente) {
                return {
                    valido: false,
                    motivo: 'Fingerprint duplicado detectado (mesmo navegador/dispositivo já fez clique válido recentemente)'
                };
            }

            return { valido: true };
        } catch (error) {
            console.error('❌ Erro ao verificar fingerprint:', error);
            return { valido: true };
        }
    }

    /**
     * Validar clique completo (todas as verificações) - MELHORADO
     */
    async validarClique(dadosClique) {
        const { 
            ipAddress, 
            userAgent, 
            afiliadoId, 
            produtoId, 
            referer,
            fingerprint: fingerprintClient,
            screen_info,
            timezone,
            language
        } = dadosClique;

        // Detectar navegador e sistema
        const { navegador, sistema, dispositivo } = this.detectarNavegador(userAgent);
        
        // Usar fingerprint do cliente se fornecido, senão gerar
        const fingerprint = fingerprintClient || this.gerarFingerprint(userAgent, ipAddress, referer);
        
        // Validações adicionais de fraude
        const validacoesAdicionais = await this.validacoesAdicionaisFraude({
            ipAddress,
            fingerprint,
            screen_info,
            timezone,
            language,
            afiliadoId,
            produtoId
        });
        
        if (!validacoesAdicionais.valido) {
            return {
                valido: false,
                motivo: validacoesAdicionais.motivo,
                navegador,
                sistema,
                dispositivo,
                fingerprint
            };
        }

        // Executar todas as verificações
        const [verificacaoIP, verificacaoAfiliado, verificacaoFingerprint] = await Promise.all([
            this.verificarCliquesIP(ipAddress, afiliadoId, produtoId),
            this.verificarCliquesAfiliado(afiliadoId),
            this.verificarFingerprintDuplicado(fingerprint, afiliadoId)
        ]);

        // Se alguma verificação falhar, o clique é inválido
        if (!verificacaoIP.valido) {
            return {
                valido: false,
                motivo: verificacaoIP.motivo,
                navegador,
                sistema,
                dispositivo,
                fingerprint
            };
        }

        if (!verificacaoAfiliado.valido) {
            return {
                valido: false,
                motivo: verificacaoAfiliado.motivo,
                navegador,
                sistema,
                dispositivo,
                fingerprint
            };
        }

        if (!verificacaoFingerprint.valido) {
            return {
                valido: false,
                motivo: verificacaoFingerprint.motivo,
                navegador,
                sistema,
                dispositivo,
                fingerprint
            };
        }

        // Todas as verificações passaram
        return {
            valido: true,
            navegador,
            sistema,
            dispositivo,
            fingerprint
        };
    }

    /**
     * Validações adicionais de fraude
     */
    async validacoesAdicionaisFraude(dados) {
        const { ipAddress, fingerprint, screen_info, timezone, language, afiliadoId, produtoId } = dados;

        // Verificar se o IP é suspeito (localhost, IPs privados em produção)
        if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
            // Em produção, IPs privados são suspeitos
            if (process.env.NODE_ENV === 'production') {
                return {
                    valido: false,
                    motivo: 'IP privado detectado (possível fraude)'
                };
            }
        }

        // Verificar se o mesmo fingerprint já fez clique válido recentemente (mais rigoroso)
        const umaHoraAtras = new Date(Date.now() - 3600000);
        const cliquesFingerprint = await CliqueValidoAfiliado.count({
            where: {
                fingerprint: fingerprint,
                valido: true,
                created_at: {
                    [Op.gte]: umaHoraAtras
                }
            }
        });

        if (cliquesFingerprint >= 3) {
            return {
                valido: false,
                motivo: `Muitos cliques do mesmo dispositivo (${cliquesFingerprint} cliques válidos na última hora). Limite: 3`
            };
        }

        // Verificar se o mesmo IP já fez muitos cliques válidos para diferentes afiliados (possível bot)
        const cliquesIPMultiplosAfiliados = await CliqueValidoAfiliado.findAll({
            where: {
                ip_address: ipAddress,
                valido: true,
                created_at: {
                    [Op.gte]: umaHoraAtras
                }
            },
            attributes: ['afiliado_id'],
            group: ['afiliado_id']
        });

        if (cliquesIPMultiplosAfiliados.length > 5) {
            return {
                valido: false,
                motivo: `IP suspeito: muitos cliques para diferentes afiliados (${cliquesIPMultiplosAfiliados.length} afiliados diferentes na última hora)`
            };
        }

        // Verificar padrões suspeitos de screen_info
        if (screen_info) {
            // Resoluções muito pequenas ou muito grandes podem ser suspeitas
            if (screen_info.width < 320 || screen_info.width > 7680 || 
                screen_info.height < 240 || screen_info.height > 4320) {
                return {
                    valido: false,
                    motivo: 'Resolução de tela suspeita'
                };
            }
        }

        return { valido: true };
    }
}

module.exports = new FraudeDetectionService();

