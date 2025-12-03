/**
 * Script para forçar atualização do sidebar
 * Adiciona versionamento ao arquivo para quebrar cache do navegador
 */

const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, '..', 'public', 'js', 'sidebar-component.js');

// Ler o arquivo atual
let content = fs.readFileSync(sidebarPath, 'utf8');

// Adicionar ou atualizar versão no cabeçalho do arquivo
const version = Date.now(); // Usar timestamp como versão

// Verificar se já tem versão
if (content.includes('VERSION:')) {
    // Atualizar versão existente
    content = content.replace(/\/\*\s*VERSION:\s*\d+\s*\*\//, `/* VERSION: ${version} */`);
} else {
    // Adicionar versão no início do arquivo
    content = `/* VERSION: ${version} */\n${content}`;
}

// Salvar arquivo
fs.writeFileSync(sidebarPath, content, 'utf8');

console.log(`✅ Versão do sidebar atualizada: ${version}`);
console.log('📝 Agora execute o script para atualizar as páginas HTML');

