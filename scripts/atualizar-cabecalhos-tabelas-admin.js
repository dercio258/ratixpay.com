/**
 * Script para atualizar os cabeçalhos das tabelas na página admin-gestao-saques.html
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'admin-gestao-saques.html');

try {
    console.log('📝 Lendo arquivo...');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Atualizar cabeçalho da tabela de histórico de saques
    const oldHeader1 = /<th>ID do Saque<\/th>\s*<th>Nome do Titular<\/th>\s*<th>Telefone<\/th>\s*<th>Valor<\/th>\s*<th>M[^<]*<\/th>\s*<th>Data<\/th>\s*<th>Status<\/th>\s*<th>Comprovativo<\/th>/;
    const newHeader1 = '<th>ID do Saque</th>\n                                <th>Valor</th>\n                                <th>Dados de Emola</th>\n                                <th>Dados de Mpesa</th>\n                                <th>Status</th>\n                                <th>Solicitado em</th>\n                                <th>Processado em</th>\n                                <th>Comprovativo</th>';
    
    if (oldHeader1.test(content)) {
        content = content.replace(oldHeader1, newHeader1);
        console.log('✅ Cabeçalho da tabela de histórico atualizado');
    } else {
        console.log('⚠️ Cabeçalho da tabela de histórico não encontrado no formato esperado');
    }
    
    // Atualizar cabeçalho da tabela de saques pendentes
    const oldHeader2 = /<th>ID Saque<\/th>\s*<th>Vendedor<\/th>\s*<th>Nome Titular<\/th>\s*<th>Telefone<\/th>\s*<th>Valor<\/th>\s*<th>M[^<]*<\/th>\s*<th>Data<\/th>\s*<th>A[^<]*<\/th>/;
    const newHeader2 = '<th>ID do Saque</th>\n                            <th>Valor</th>\n                            <th>Dados de Emola</th>\n                            <th>Dados de Mpesa</th>\n                            <th>Status</th>\n                            <th>Solicitado em</th>\n                            <th>Processado em</th>\n                            <th>Ações</th>';
    
    if (oldHeader2.test(content)) {
        content = content.replace(oldHeader2, newHeader2);
        console.log('✅ Cabeçalho da tabela de saques pendentes atualizado');
    } else {
        console.log('⚠️ Cabeçalho da tabela de saques pendentes não encontrado no formato esperado');
    }
    
    // Salvar arquivo
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Arquivo atualizado com sucesso!');
    
} catch (error) {
    console.error('❌ Erro ao atualizar arquivo:', error);
    process.exit(1);
}

