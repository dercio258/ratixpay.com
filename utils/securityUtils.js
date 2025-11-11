const crypto = require('crypto');

class SecurityUtils {
    // Gerar ID de transação seguro com caracteres especiais
    static gerarTransacaoIdSeguro() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
        const caracteresEspeciais = ['@', '#', '$', '%', '&', '*', '!', '?'];
        const caracteresAleatorios = caracteresEspeciais[Math.floor(Math.random() * caracteresEspeciais.length)];
        
        // Criar hash do timestamp para adicionar mais entropia
        const hash = crypto.createHash('sha256').update(timestamp + randomBytes).digest('hex').substring(0, 6).toUpperCase();
        
        // Formato: RTX@TIMESTAMP#HASH$RANDOM
        return `RTX${caracteresAleatorios}${timestamp.slice(-8)}${caracteresEspeciais[Math.floor(Math.random() * caracteresEspeciais.length)]}${hash}${caracteresEspeciais[Math.floor(Math.random() * caracteresEspeciais.length)]}${randomBytes.substring(0, 4)}`;
    }

    // Gerar ID de referência seguro
    static gerarReferenciaIdSeguro() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.randomBytes(6).toString('hex').toUpperCase();
        const caracteresEspeciais = ['@', '#', '$', '%', '&'];
        const caracteresAleatorios = caracteresEspeciais[Math.floor(Math.random() * caracteresEspeciais.length)];
        
        return `REF${caracteresAleatorios}${timestamp.slice(-6)}${caracteresAleatorios}${randomBytes}`;
    }

    // Validar formato do ID de transação
    static validarTransacaoId(transacaoId) {
        if (!transacaoId || typeof transacaoId !== 'string') {
            return false;
        }
        
        // Verificar se contém pelo menos um caractere especial
        const caracteresEspeciais = /[@#$%&*!?]/;
        if (!caracteresEspeciais.test(transacaoId)) {
            return false;
        }
        
        // Verificar se começa com RTX
        if (!transacaoId.startsWith('RTX')) {
            return false;
        }
        
        // Verificar comprimento mínimo
        if (transacaoId.length < 20) {
            return false;
        }
        
        return true;
    }

    // Criptografar dados sensíveis
    static criptografarDados(dados, chave = process.env.ENCRYPTION_KEY || 'ratixpay_secret_key_2024') {
        try {
            const cipher = crypto.createCipher('aes-256-cbc', chave);
            let encrypted = cipher.update(dados, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            return encrypted;
        } catch (error) {
            console.error('Erro ao criptografar dados:', error);
            return dados;
        }
    }

    // Descriptografar dados
    static descriptografarDados(dadosCriptografados, chave = process.env.ENCRYPTION_KEY || 'ratixpay_secret_key_2024') {
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', chave);
            let decrypted = decipher.update(dadosCriptografados, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            console.error('Erro ao descriptografar dados:', error);
            return dadosCriptografados;
        }
    }

    // Gerar hash seguro para validação
    static gerarHash(dados) {
        return crypto.createHash('sha256').update(dados).digest('hex');
    }

    // Validar assinatura digital
    static validarAssinatura(dados, assinatura, chaveSecreta = process.env.SIGNATURE_KEY || 'ratixpay_signature_2024') {
        const hashEsperado = this.gerarHash(dados + chaveSecreta);
        return hashEsperado === assinatura;
    }

    // Gerar assinatura digital
    static gerarAssinatura(dados, chaveSecreta = process.env.SIGNATURE_KEY || 'ratixpay_signature_2024') {
        return this.gerarHash(dados + chaveSecreta);
    }

    // Sanitizar dados de entrada
    static sanitizarDados(dados) {
        if (typeof dados === 'string') {
            return dados
                .replace(/[<>]/g, '') // Remover caracteres perigosos
                .trim();
        }
        return dados;
    }

    // Validar formato de email
    static validarEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validar formato de telefone moçambicano
    static validarTelefoneMZ(telefone) {
        // Remove todos os caracteres não numéricos
        const numeroLimpo = telefone.replace(/\D/g, '');
        
        // Verifica se tem 9 dígitos (formato moçambicano)
        if (numeroLimpo.length !== 9) {
            return false;
        }
        
        // Verifica se começa com 8 ou 9 (prefixos válidos em Moçambique)
        const prefixo = numeroLimpo.substring(0, 1);
        return ['8', '9'].includes(prefixo);
    }

    // Formatar valor em MZN
    static formatarValorMZN(valor) {
        if (typeof valor !== 'number' || isNaN(valor)) {
            throw new Error('Valor inválido para formatação');
        }
        
        return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'MZN',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Validar valor em MZN
    static validarValorMZN(valor) {
        const valorNumerico = parseFloat(valor);
        return !isNaN(valorNumerico) && valorNumerico > 0 && valorNumerico <= 50000;
    }

    // Gerar token de acesso temporário
    static gerarTokenAcesso(duracaoMinutos = 60) {
        const timestamp = Date.now();
        const expiracao = timestamp + (duracaoMinutos * 60 * 1000);
        const dados = `${timestamp}-${expiracao}-${crypto.randomBytes(16).toString('hex')}`;
        
        return {
            token: this.criptografarDados(dados),
            expiracao: new Date(expiracao)
        };
    }

    // Validar token de acesso
    static validarTokenAcesso(token) {
        try {
            const dadosDescriptografados = this.descriptografarDados(token);
            const [timestamp, expiracao] = dadosDescriptografados.split('-');
            
            const agora = Date.now();
            const expiracaoTimestamp = parseInt(expiracao);
            
            return agora < expiracaoTimestamp;
        } catch (error) {
            return false;
        }
    }
}

module.exports = SecurityUtils; 