# Script PowerShell para Preparar Commit no GitHub
# Execute: .\scripts\prepare-github-commit.ps1

Write-Host "========================================" -ForegroundColor Green
Write-Host "🚀 Preparando Commit para GitHub" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Verificar se há merge em andamento
$mergeStatus = git status | Select-String "All conflicts fixed but you are still merging"
if ($mergeStatus) {
    Write-Host "⚠️  Há um merge em andamento!" -ForegroundColor Yellow
    Write-Host "Primeiro você precisa concluir o merge." -ForegroundColor Yellow
    Write-Host ""
    $confirmMerge = Read-Host "Deseja concluir o merge agora? (S/N)"
    if ($confirmMerge -eq "S" -or $confirmMerge -eq "s") {
        git commit -m "Merge branch atualizado"
        Write-Host "✅ Merge concluído!" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📦 Adicionando arquivos de migração..." -ForegroundColor Yellow

# Adicionar arquivos de migração
git add migrations/migrate-all-systems-unified.sql
git add migrations/update-domain-ratixpay-com-to-site.sql
git add migrations/update-products-images-files.sql
git add migrations/README-MIGRATIONS.md

Write-Host "✅ Migrações adicionadas" -ForegroundColor Green

# Adicionar scripts
Write-Host "📜 Adicionando scripts..." -ForegroundColor Yellow
git add scripts/run-all-migrations.sh
git add scripts/run-all-migrations.js
git add scripts/update-domain-in-code.js

Write-Host "✅ Scripts adicionados" -ForegroundColor Green

# Adicionar documentação
Write-Host "📚 Adicionando documentação..." -ForegroundColor Yellow
git add MIGRATION-GUIDE.md
git add PREPARACAO-GITHUB.md
git add COMMIT-MESSAGE.md

Write-Host "✅ Documentação adicionada" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Arquivos Preparados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Mostrar status
Write-Host "📊 Status dos arquivos adicionados:" -ForegroundColor Blue
git status --short | Select-String "^A  "

Write-Host ""
Write-Host "💡 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Revise as alterações: git diff --cached" -ForegroundColor White
Write-Host "2. Faça o commit:" -ForegroundColor White
Write-Host "   git commit -m `"feat: Adicionar migrações completas e atualização de domínio para ratixpay.site`"" -ForegroundColor Cyan
Write-Host "3. Push para GitHub:" -ForegroundColor White
Write-Host "   git push origin main" -ForegroundColor Cyan
Write-Host ""

