# Script para preparar commit e push para GitHub
# Execute: powershell -ExecutionPolicy Bypass -File scripts/prepare-git-commit.ps1

Write-Host "🔍 Verificando status do Git..." -ForegroundColor Cyan

# Verificar se é um repositório Git
if (-not (Test-Path .git)) {
    Write-Host "❌ Não é um repositório Git. Inicializando..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Repositório Git inicializado" -ForegroundColor Green
}

# Verificar status
Write-Host "`n📊 Status do repositório:" -ForegroundColor Cyan
git status --short

# Verificar se há arquivos para commit
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "`n✅ Não há alterações para commitar" -ForegroundColor Green
    exit 0
}

Write-Host "`n📝 Arquivos modificados/novos:" -ForegroundColor Cyan
git status --short

# Adicionar todos os arquivos (respeitando .gitignore)
Write-Host "`n➕ Adicionando arquivos ao staging..." -ForegroundColor Cyan
git add .

# Verificar o que será commitado
Write-Host "`n📋 Arquivos que serão commitados:" -ForegroundColor Cyan
git status --short

# Criar mensagem de commit
$commitMessage = @"
Correções e melhorias:

- Removidas senhas hardcoded do código (migrado para variáveis de ambiente)
- Corrigido encoding UTF-8 na página forgot-password.html
- Simplificada página de recuperação de senha (removidos passos visuais)
- Atualizado Font Awesome para usar jsDelivr CDN (resolve problemas de CORS)
- Corrigido Content Security Policy para permitir fontes do jsDelivr
- Adicionado .env.example com template de configurações
- Atualizado .gitignore para proteger arquivos sensíveis
- Melhorado serviço de email profissional
"@

Write-Host "`n💾 Criando commit..." -ForegroundColor Cyan
git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit criado com sucesso!" -ForegroundColor Green
    
    # Verificar se há remote configurado
    $remote = git remote -v
    if ([string]::IsNullOrWhiteSpace($remote)) {
        Write-Host "`n⚠️  Nenhum remote configurado. Para adicionar:" -ForegroundColor Yellow
        Write-Host "   git remote add origin <URL_DO_SEU_REPOSITORIO>" -ForegroundColor Gray
        Write-Host "   git branch -M main" -ForegroundColor Gray
        Write-Host "   git push -u origin main" -ForegroundColor Gray
    } else {
        Write-Host "`n🌐 Remote configurado:" -ForegroundColor Cyan
        git remote -v
        
        Write-Host "`n📤 Para fazer push, execute:" -ForegroundColor Yellow
        Write-Host "   git push" -ForegroundColor Gray
        Write-Host "   ou" -ForegroundColor Gray
        Write-Host "   git push origin main" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ Erro ao criar commit" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Processo concluído!" -ForegroundColor Green

