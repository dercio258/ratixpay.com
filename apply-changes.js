const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'admin-gestao-saques.html');

// Ler o arquivo
let content = fs.readFileSync(filePath, 'utf8');

// 1. Adicionar cálculos antes do modalContent na função aprovarSaque
const aprovarSaqueCalcCode = `
                // Calcular valores
                const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
                const taxa = valorSolicitado * 0.05; // 5% de taxa
                const valorLiquido = valorSolicitado - taxa; // Valor líquido = valor solicitado - 5%

                // Obter ID público (public ID de 6 dígitos)
                const publicId = saque.publicId || saque.public_id || saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : '-');

                // Dados de Mpesa
                const dadosMpesa = saque.dadosMpesa || saque.dadosCarteiraCompleta?.mpesa || {};
                const mpesaNome = dadosMpesa.nomeTitular || 'N/A';
                const mpesaContacto = dadosMpesa.contacto || 'N/A';

                // Dados de Emola
                const dadosEmola = saque.dadosEmola || saque.dadosCarteiraCompleta?.emola || {};
                const emolaNome = dadosEmola.nomeTitular || 'N/A';
                const emolaContacto = dadosEmola.contacto || 'N/A';

                // Método de pagamento
                const metodo = saque.metodo || saque.metodoPagamento || saque.metodo_pagamento || 'N/A';

                // Data formatada
                const dataFormatada = saque.dataSolicitacao || saque.data_solicitacao 
                    ? new Date(saque.dataSolicitacao || saque.data_solicitacao).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                    : 'N/A';

                // Mostrar modal de resumo da transação`;

// Substituir após "const saque = data.data;" na função aprovarSaque
content = content.replace(
    /(const saque = data\.data;\s*\/\/ Mostrar modal de resumo da transa[^\n]*)/,
    `const saque = data.data;${aprovarSaqueCalcCode}`
);

// 2. Substituir o modal-body (precisamos encontrar o padrão exato)
// Vou fazer isso em partes menores

// Substituir o header do modal
content = content.replace(
    /<div class="modal-header bg-success text-white">/g,
    '<div class="modal-header" style="background: linear-gradient(135deg, #f64c00 0%, #e04500 100%); color: white;">'
);

// Substituir "Resumo da Transao" por "Resumo da Transação"
content = content.replace(/Resumo da Transa[^\n]*/g, 'Resumo da Transação');

// Substituir o modal-body completo - isso é mais complexo, vamos fazer em partes
// Primeiro, vamos substituir o ID do saque para usar publicId
content = content.replace(
    /\$\{saque\.id_saque \|\| saque\.id \|\| '-'/g,
    '${publicId'
);

// Substituir valor_solicitado para usar valorSolicitado
content = content.replace(
    /parseFloat\(saque\.valor_solicitado \|\| 0\)/g,
    'valorSolicitado'
);

// Substituir valor_liquido para usar valorLiquido
content = content.replace(
    /parseFloat\(saque\.valor_liquido \|\| 0\)/g,
    'valorLiquido'
);

// 3. Melhorar a função gerarPDF
// Adicionar cálculos após const saque = data.data;
const gerarPDFCalcCode = `
                
                // Gerar ID público (public ID de 6 dígitos)
                const idSaque = saque.publicId || saque.public_id || saque.idSaque || (saque.id ? saque.id.substring(saque.id.length - 6).toUpperCase() : saque.id);
                
                // Calcular valores
                const valorSolicitado = parseFloat(saque.valor || saque.valor_solicitado || 0);
                const taxa = valorSolicitado * 0.05; // 5% de taxa
                const valorLiquido = valorSolicitado - taxa; // Valor líquido = valor solicitado - 5%
                
                // Dados de Mpesa e Emola
                const dadosMpesa = saque.dadosMpesa || saque.dadosCarteiraCompleta?.mpesa || {};
                const dadosEmola = saque.dadosEmola || saque.dadosCarteiraCompleta?.emola || {};`;

content = content.replace(
    /(const saque = data\.data;\s*\/\/ Gerar ID amig[^\n]*)/,
    `const saque = data.data;${gerarPDFCalcCode}`
);

// Salvar o arquivo
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Mudanças aplicadas com sucesso!');

