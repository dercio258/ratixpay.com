const crypto = require('crypto');

class PaymentProcessor {
  constructor() {
    // Métodos de pagamento suportados
    this.metodosSuportados = [
      'M-Pesa',
      'e-Mola'
    ];
    
    this.taxasConfiabilidade = {
      'M-Pesa': 0.92,
      'e-Mola': 0.90
    };
  }

  // Gerar ID único para transação
  gerarTransacaoId(prefixo = 'RTX') {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefixo}${timestamp.slice(-8)}${random}`;
  }

  // Gerar referência de pagamento
  gerarReferenciaId() {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `REF${timestamp.slice(-6)}${random}`;
  }

  // Validar método de pagamento
  validarMetodoPagamento(metodo) {
    return this.metodosSuportados.includes(metodo);
  }

  // Calcular taxa de processamento
  calcularTaxa(valor, metodo) {
    const taxas = {
      'e-Mola': 0.025,      // 2.5%
      'M-Pesa': 0.03,       // 3%
      'RatixPay': 0.015,    // 1.5%
      'Cartão de Crédito': 0.035, // 3.5%
      'PIX': 0.01           // 1%
    };
    
    const taxa = taxas[metodo] || 0.025;
    return valor * taxa;
  }

  // Simular processamento de pagamento
  async processarPagamento(dadosPagamento) {
    let { metodo, valor, transacaoId } = dadosPagamento;
    
    if (!this.validarMetodoPagamento(metodo)) {
      throw new Error(`Método de pagamento ${metodo} não suportado`);
    }

    // Simular tempo de processamento baseado no método
    const temposProcessamento = {
      'e-Mola': 2000,
      'M-Pesa': 3000
    };

    const tempo = temposProcessamento[metodo] || 2000;
    const confiabilidade = this.taxasConfiabilidade[metodo] || 0.85;

    return new Promise((resolve) => {
      setTimeout(() => {
        const aprovado = Math.random() < confiabilidade;
        const taxa = this.calcularTaxa(valor, metodo);
        
        const resultado = {
          transacaoId,
          aprovado,
          metodo,
          valor,
          taxa,
          valorLiquido: valor - taxa,
          dataProcessamento: new Date(),
          codigoResposta: aprovado ? '00' : '05',
          mensagem: aprovado ? 'Transação aprovada' : 'Transação rejeitada'
        };

        resolve(resultado);
      }, tempo);
    });
  }

  // Verificar status de transação
  async verificarStatus(transacaoId) {
    // Simular consulta ao gateway de pagamento
    return new Promise((resolve) => {
      setTimeout(() => {
        const status = Math.random() > 0.1 ? 'Aprovado' : 'Rejeitado';
        resolve({
          transacaoId,
          status,
          dataConsulta: new Date()
        });
      }, 500);
    });
  }

  // Processar reembolso
  async processarReembolso(transacaoId, valor, motivo) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const sucesso = Math.random() > 0.05; // 95% de sucesso
        const reembolsoId = this.gerarTransacaoId('REE');
        
        resolve({
          reembolsoId,
          transacaoOriginal: transacaoId,
          valor,
          motivo,
          sucesso,
          dataReembolso: new Date(),
          prazoEstorno: sucesso ? '3-5 dias úteis' : null
        });
      }, 1000);
    });
  }

  // Validar dados do cartão (para cartão de crédito)
  validarCartao(numeroCartao, cvv, validade) {
    // Validação básica do número do cartão (algoritmo de Luhn)
    const numero = numeroCartao.replace(/\s/g, '');
    
    if (!/^\d{13,19}$/.test(numero)) {
      return { valido: false, erro: 'Número do cartão inválido' };
    }

    // Validar CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return { valido: false, erro: 'CVV inválido' };
    }

    // Validar validade
    const [mes, ano] = validade.split('/');
    const dataValidade = new Date(2000 + parseInt(ano), parseInt(mes) - 1);
    
    if (dataValidade < new Date()) {
      return { valido: false, erro: 'Cartão expirado' };
    }

    return { valido: true };
  }

  // Obter bandeira do cartão
  obterBandeiraCartao(numeroCartao) {
    const numero = numeroCartao.replace(/\s/g, '');
    
    if (/^4/.test(numero)) return 'Visa';
    if (/^5[1-5]/.test(numero)) return 'Mastercard';
    if (/^3[47]/.test(numero)) return 'American Express';
    if (/^6/.test(numero)) return 'Discover';
    
    return 'Desconhecida';
  }
}

module.exports = new PaymentProcessor();

