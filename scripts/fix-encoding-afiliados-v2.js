const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'afiliados.html');

console.log('🔧 Corrigindo encoding do arquivo afiliados.html...');

// Ler arquivo como buffer e converter para string UTF-8
let content = fs.readFileSync(filePath, { encoding: 'utf8' });

// Substituições diretas usando expressões regulares mais flexíveis
const replacements = [
    // Disponíveis
    [/Dispon[^\w]veis/gi, 'Disponíveis'],
    [/dispon[^\w]vel/gi, 'disponível'],
    // Comissões
    [/comiss[^\w]es/gi, 'comissões'],
    [/comiss[^\w]o/gi, 'comissão'],
    // Até - corrigir múltiplas ocorrências e caracteres especiais
    [/Atééé/g, 'Até'],
    [/Atéé/g, 'Até'],
    [/atéé/g, 'até'],
    [/Até[^\w]/g, 'Até'],
    [/até[^\w]/g, 'até'],
    [/At[^\w] /g, 'Até '],
    [/at[^\w] /g, 'até '],
    // Corrigir "RatéixPay" e "translatéeY"
    [/RatéixPay/g, 'RatixPay'],
    [/translatéeY/g, 'translateY'],
    // Através - corrigir "atéravs"
    [/atérav[^\w]s/gi, 'através'],
    [/atrav[^\w]s/gi, 'através'],
    // Próprio
    [/pr[^\w]prio/gi, 'próprio'],
    // Negócio
    [/neg[^\w]cio/gi, 'negócio'],
    // Segurança
    [/Seguran[^\w]a/gi, 'Segurança'],
    // Confiáveis
    [/confi[^\w]veis/gi, 'confiáveis'],
    // Afiliação
    [/afilia[^\w][^\w]o/gi, 'afiliação'],
    [/Afilia[^\w][^\w]o/g, 'Afiliação'],
    [/solicitarAfilia[^\w][^\w]o/gi, 'solicitarAfiliação'],
    // Instruções
    [/instru[^\w][^\w]es/gi, 'instruções'],
    // Padrão
    [/padr[^\w]o/gi, 'padrão'],
    // Corrigir parseFloat mal codificado
    [/parseFloaté/g, 'parseFloat'],
    // Corrigir getAttribute mal codificado
    [/getAtééétribute/g, 'getAttribute']
];

let changed = false;
for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        changed = true;
        console.log(`✅ Corrigido: ${pattern} → ${replacement}`);
    }
}

// Substituições simples adicionais
const simpleReplacements = {
    'Disponveis': 'Disponíveis',
    'disponvel': 'disponível',
    'comisses': 'comissões',
    'comisso': 'comissão'
};

for (const [wrong, correct] of Object.entries(simpleReplacements)) {
    if (content.includes(wrong)) {
        content = content.replace(new RegExp(wrong, 'g'), correct);
        changed = true;
        console.log(`✅ Corrigido: ${wrong} → ${correct}`);
    }
}

if (changed) {
    // Salvar arquivo com encoding UTF-8
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    console.log('\n✅ Arquivo corrigido com sucesso!');
} else {
    console.log('\n⚠️ Nenhuma correção necessária.');
}

