const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'afiliados.html');

console.log('🔧 Corrigindo encoding do arquivo afiliados.html...');

// Ler arquivo
let content = fs.readFileSync(filePath, 'utf8');

// Mapeamento de correções
const corrections = {
    // Corrigir "Disponíveis" e variações
    'Disponveis': 'Disponíveis',
    'Disponveis': 'Disponíveis',
    'disponvel': 'disponível',
    'disponvel': 'disponível',
    // Corrigir "comissões" e variações
    'comisses': 'comissões',
    'comisses': 'comissões',
    'comisso': 'comissão',
    'comisso': 'comissão',
    // Corrigir "até"
    'At': 'Até',
    'At': 'Até',
    'at ': 'até ',
    'atravs': 'através',
    'atravs': 'através',
    // Corrigir outras palavras
    'prprio': 'próprio',
    'prprio': 'próprio',
    'negcio': 'negócio',
    'negcio': 'negócio',
    'Segurana': 'Segurança',
    'Segurana': 'Segurança',
    'confiveis': 'confiáveis',
    'confiveis': 'confiáveis',
    'afiliao': 'afiliação',
    'afiliao': 'afiliação',
    'Afiliao': 'Afiliação',
    'Afiliao': 'Afiliação',
    'solicitarAfiliao': 'solicitarAfiliação',
    'instrues': 'instruções',
    'instrues': 'instruções',
    'padro': 'padrão',
    'padro': 'padrão'
};

// Aplicar correções usando expressões regulares para caracteres especiais
let changed = false;

// Corrigir "Disponíveis" - pode aparecer como "Disponveis" ou "Disponveis"
content = content.replace(/Dispon[\w]veis/g, 'Disponíveis');
content = content.replace(/dispon[\w]vel/g, 'disponível');
if (content.match(/Dispon[\w]veis|dispon[\w]vel/)) {
    changed = true;
    console.log('✅ Corrigido: Disponíveis');
}

// Corrigir "comissões"
content = content.replace(/comiss[\w]es/g, 'comissões');
content = content.replace(/comiss[\w]o/g, 'comissão');
if (content.match(/comiss[\w]/)) {
    changed = true;
    console.log('✅ Corrigido: comissões');
}

// Corrigir outras palavras com acentos
content = content.replace(/at[\w] /g, 'até ');
content = content.replace(/atrav[\w]s/g, 'através');
content = content.replace(/pr[\w]prio/g, 'próprio');
content = content.replace(/neg[\w]cio/g, 'negócio');
content = content.replace(/Seguran[\w]a/g, 'Segurança');
content = content.replace(/confi[\w]veis/g, 'confiáveis');
content = content.replace(/afilia[\w][\w]o/g, 'afiliação');
content = content.replace(/Afilia[\w][\w]o/g, 'Afiliação');
content = content.replace(/solicitarAfilia[\w][\w]o/g, 'solicitarAfiliação');
content = content.replace(/instru[\w][\w]es/g, 'instruções');
content = content.replace(/padr[\w]o/g, 'padrão');

// Aplicar outras correções simples
for (const [wrong, correct] of Object.entries(corrections)) {
    if (content.includes(wrong) && !wrong.includes('')) {
        content = content.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), correct);
        changed = true;
        console.log(`✅ Corrigido: ${wrong} → ${correct}`);
    }
}

if (changed) {
    // Salvar arquivo
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\n✅ Arquivo corrigido com sucesso!');
} else {
    console.log('\n⚠️ Nenhuma correção necessária.');
}

