const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'afiliados.html');

console.log('🔧 Corrigindo botões e funções JavaScript...');

// Ler arquivo
let content = fs.readFileSync(filePath, 'utf8');

// Correções necessárias
const fixes = [
    // Corrigir getAttribute
    [/getAt[^\w]tribute/g, 'getAttribute'],
    [/getAtétribute/g, 'getAttribute'],
    
    // Corrigir text-decoration
    [/text-decorat[^\w]ion-none/g, 'text-decoration-none'],
    [/text-decoratéion-none/g, 'text-decoration-none'],
    
    // Corrigir window.location
    [/window\.locat[^\w]ion/g, 'window.location'],
    [/window\.locatéion/g, 'window.location'],
    
    // Remover onclick mostrarEsqueciSenha e substituir por link
    [/onclick="mostrarEsqueciSenha\(\)"/g, 'href="afiliado-forgot-password.html"'],
    [/href="#".*mostrarEsqueciSenha/g, 'href="afiliado-forgot-password.html"'],
];

let changed = false;
for (const [pattern, replacement] of fixes) {
    if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        changed = true;
        console.log(`✅ Corrigido: ${pattern} → ${replacement}`);
    }
}

// Adicionar funções verificarLogin e logout se não existirem
if (!content.includes('function verificarLogin()')) {
    const initFunction = `        // Verificar se já está logado
        function verificarLogin() {
            const token = localStorage.getItem('afiliado_token');
            if (token) {
                // Atualizar botões da navbar
                const navbar = document.querySelector('.navbar-nav');
                if (navbar) {
                    navbar.innerHTML = \`
                        <li class="nav-item">
                            <a class="nav-link" href="afiliado-dashboard.html">
                                <i class="fas fa-tachometer-alt"></i> Dashboard
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#beneficios">Por que Afiliar</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#produtos">Produtos</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#como-funciona">Como Funciona</a>
                        </li>
                    \`;
                }
                
                const btnContainer = document.querySelector('.d-flex.gap-2');
                if (btnContainer) {
                    btnContainer.innerHTML = \`
                        <a href="afiliado-dashboard.html" class="btn btn-register">
                            <i class="fas fa-tachometer-alt"></i> Painel
                        </a>
                        <button class="btn btn-login" onclick="logout()">
                            <i class="fas fa-sign-out-alt"></i> Sair
                        </button>
                    \`;
                }
            }
        }

        // Logout
        function logout() {
            localStorage.removeItem('afiliado_token');
            localStorage.removeItem('afiliado_data');
            window.location.reload();
        }

        `;
    
    // Substituir a inicialização simples pela completa
    content = content.replace(
        /\/\/ Inicializar[^\n]*\n\s*document\.addEventListener\('DOMContentLoaded',\s*function\(\)\s*\{[^}]*console\.log\([^)]*\);[^}]*carregarDados\(\);[^}]*\}\);/,
        initFunction + `        // Inicializar página
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Inicializando página de afiliados...');
            verificarLogin();
            carregarDados();
        });`
    );
    
    changed = true;
    console.log('✅ Funções verificarLogin e logout adicionadas');
}

if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('\n✅ Arquivo corrigido com sucesso!');
} else {
    console.log('\n⚠️ Nenhuma correção necessária.');
}



