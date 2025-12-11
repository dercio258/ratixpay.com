# Script PowerShell para executar migração de carteiras do administrador
# Uso: .\scripts\executar-migracao-carteiras-admin.ps1

$ErrorActionPreference = "Stop"

# Carregar variáveis de ambiente do .env se existir
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Obter configurações do banco de dados
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "ratixpay_local" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_PASS = if ($env:DB_PASS) { $env:DB_PASS } else { "postgres" }

Write-Host "🔄 Iniciando migração de carteiras do administrador..." -ForegroundColor Cyan
Write-Host "📊 Banco: $DB_NAME em $DB_HOST:$DB_PORT" -ForegroundColor Gray

$sqlFile = "migrations\create-carteiras-admin.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Arquivo de migração não encontrado: $sqlFile" -ForegroundColor Red
    exit 1
}

try {
    # Executar migração usando psql
    $env:PGPASSWORD = $DB_PASS
    $result = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $sqlFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migração executada com sucesso!" -ForegroundColor Green
        Write-Host "✅ Tabela carteiras_admin criada" -ForegroundColor Green
        Write-Host "✅ Carteiras M-Pesa e Emola inicializadas" -ForegroundColor Green
        
        # Verificar carteiras criadas
        Write-Host "`n📊 Verificando carteiras criadas..." -ForegroundColor Cyan
        $query = "SELECT tipo, nome, saldo FROM carteiras_admin ORDER BY tipo;"
        $checkResult = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c $query 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host $checkResult
        }
    } else {
        Write-Host "❌ Erro ao executar migração" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
} catch {
    Write-Host "❌ Erro: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n✅ Migração concluída!" -ForegroundColor Green

