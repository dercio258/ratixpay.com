# Script para iniciar o PostgreSQL
Write-Host "🔄 Iniciando PostgreSQL..." -ForegroundColor Yellow

# Tentar iniciar o serviço
try {
    $service = Get-Service -Name "postgresql-x64-18" -ErrorAction Stop
    if ($service.Status -eq 'Running') {
        Write-Host "✅ PostgreSQL já está rodando!" -ForegroundColor Green
    } else {
        Write-Host "🔄 Iniciando serviço PostgreSQL..." -ForegroundColor Yellow
        Start-Service -Name "postgresql-x64-18" -ErrorAction Stop
        Start-Sleep -Seconds 5
        $service = Get-Service -Name "postgresql-x64-18"
        if ($service.Status -eq 'Running') {
            Write-Host "✅ PostgreSQL iniciado com sucesso!" -ForegroundColor Green
        } else {
            Write-Host "❌ Falha ao iniciar o serviço PostgreSQL" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "⚠️ Tentando iniciar via pg_ctl..." -ForegroundColor Yellow
    try {
        & "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D "C:\Program Files\PostgreSQL\18\data" -l "C:\Program Files\PostgreSQL\18\data\log\postgresql.log" start
        Start-Sleep -Seconds 5
        $process = Get-Process -Name "postgres" -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "✅ PostgreSQL iniciado via pg_ctl!" -ForegroundColor Green
        } else {
            Write-Host "❌ Falha ao iniciar PostgreSQL via pg_ctl" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erro ao iniciar PostgreSQL: $_" -ForegroundColor Red
    }
}

# Verificar conexão
Write-Host "`n🔍 Verificando conexão..." -ForegroundColor Yellow
$env:PGPASSWORD = "postgres"
try {
    $result = & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Conexão com PostgreSQL estabelecida!" -ForegroundColor Green
        Write-Host "📊 Status: PostgreSQL está funcionando corretamente" -ForegroundColor Green
    } else {
        Write-Host "❌ Falha na conexão: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Erro ao verificar conexão: $_" -ForegroundColor Red
}

Write-Host "`n✅ Processo concluído!" -ForegroundColor Green

