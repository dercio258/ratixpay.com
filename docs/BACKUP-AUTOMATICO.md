# Guia de Backup Automático RatixPay

Este guia mostra como configurar e executar o backup automático do banco de dados PostgreSQL.

## 🚀 Execução Rápida

### Backup Manual
```bash
# Criar backup agora
npm run backup

# Listar backups disponíveis
npm run backup:list

# Verificar status dos backups
npm run backup:status
```

### PowerShell Direto
```powershell
# Backup manual
.\scripts\backup-working.ps1

# Restore interativo
.\scripts\restore-working.ps1

# Gerenciar backups
.\scripts\backup-manager.ps1 backup
.\scripts\backup-manager.ps1 list
.\scripts\backup-manager.ps1 status
```

## ⚙️ Configuração do Backup Automático

### 1. Backup Diário (Windows Task Scheduler)

**Passo 1: Abrir Agendador de Tarefas**
- Pressione `Win + R`
- Digite `taskschd.msc`
- Pressione Enter

**Passo 2: Criar Nova Tarefa**
1. Clique em "Criar Tarefa..." (não "Criar Tarefa Básica")
2. **Geral:**
   - Nome: `RatixPay Backup Diário`
   - Descrição: `Backup automático do banco RatixPay`
   - Marque "Executar se o usuário estiver ou não conectado"
   - Marque "Executar com privilégios mais altos"

3. **Disparadores:**
   - Clique "Novo..."
   - Iniciar: "Em um agendamento"
   - Configurações: "Diariamente"
   - Iniciar em: `02:00:00` (2:00 AM)
   - Marque "Ativado"

4. **Ações:**
   - Clique "Novo..."
   - Ação: "Iniciar um programa"
   - Programa/script: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "E:\Producao\ratixpay.production-main\scripts\backup-working.ps1"`
   - Iniciar em: `E:\Producao\ratixpay.production-main`

5. **Configurações:**
   - Marque "Permitir que a tarefa seja executada sob demanda"
   - Marque "Executar tarefa assim que possível após um início agendado perdido"
   - Marque "Se a tarefa falhar, reiniciar a cada: 1 minuto"
   - Número de tentativas: 3

6. **Condições:**
   - Desmarque "Iniciar a tarefa apenas se o computador estiver em CA"
   - Marque "Acordar o computador para executar esta tarefa"

### 2. Backup por PowerShell (Alternativo)

**Criar script de agendamento:**
```powershell
# Salvar como: scripts\schedule-backup.ps1
$taskName = "RatixPay Backup Diário"
$scriptPath = "E:\Producao\ratixpay.production-main\scripts\backup-working.ps1"
$triggerTime = "02:00"

# Criar ação
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`""

# Criar trigger (diário às 2:00 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime

# Criar configurações
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Registrar tarefa
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Backup automático do RatixPay"

Write-Host "✅ Tarefa de backup agendada criada com sucesso!"
Write-Host "📅 Execução: Diariamente às $triggerTime"
```

**Executar:**
```powershell
.\scripts\schedule-backup.ps1
```

### 3. Backup por Cron (Linux)

```bash
# Editar crontab
crontab -e

# Adicionar linha para backup diário às 2:00 AM
0 2 * * * cd /path/to/ratixpay && node scripts/auto-backup.js >> logs/backup.log 2>&1

# Verificar crontab
crontab -l
```

## 📊 Monitoramento do Backup

### Verificar Status
```bash
# Status dos backups
npm run backup:status

# Listar backups
npm run backup:list

# PowerShell
.\scripts\backup-manager.ps1 status
```

### Logs de Backup
```bash
# Ver logs
Get-Content logs\backup.log -Tail 20

# Logs em tempo real
Get-Content logs\backup.log -Wait
```

### Verificar Tarefas Agendadas
```powershell
# Listar tarefas do RatixPay
Get-ScheduledTask -TaskName "*RatixPay*"

# Verificar última execução
Get-ScheduledTask -TaskName "RatixPay Backup Diário" | Get-ScheduledTaskInfo
```

## 🔧 Configurações Avançadas

### 1. Backup Múltiplo por Dia

**Criar tarefas adicionais:**
- `RatixPay Backup Manhã` - 08:00
- `RatixPay Backup Tarde` - 14:00
- `RatixPay Backup Noite` - 20:00

### 2. Backup com Notificação

**Script com notificação:**
```powershell
# Salvar como: scripts\backup-with-notification.ps1
try {
    # Executar backup
    .\scripts\backup-working.ps1
    
    # Enviar notificação de sucesso
    [System.Windows.Forms.MessageBox]::Show("Backup do RatixPay concluído com sucesso!", "Backup OK", "OK", "Information")
}
catch {
    # Enviar notificação de erro
    [System.Windows.Forms.MessageBox]::Show("Erro no backup do RatixPay: $($_.Exception.Message)", "Backup Error", "OK", "Error")
}
```

### 3. Backup com Email

**Configurar notificação por email:**
```powershell
# Adicionar ao final do backup-working.ps1
function Send-BackupNotification {
    param(
        [string]$Status,
        [string]$Message
    )
    
    $smtpServer = "smtp.gmail.com"
    $smtpPort = 587
    $smtpUser = "seu-email@gmail.com"
    $smtpPass = "sua-senha-app"
    $toEmail = "admin@ratixpay.com"
    
    $subject = "RatixPay Backup - $Status"
    $body = "Backup do RatixPay: $Message`n`nData: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
    
    Send-MailMessage -SmtpServer $smtpServer -Port $smtpPort -UseSsl -Credential (New-Object System.Management.Automation.PSCredential($smtpUser, (ConvertTo-SecureString $smtpPass -AsPlainText -Force))) -To $toEmail -From $smtpUser -Subject $subject -Body $body
}
```

## 🛠️ Solução de Problemas

### Problema: Backup não executa
```powershell
# Verificar se PostgreSQL está rodando
Get-Service -Name "postgresql*"

# Verificar se pg_dump está no PATH
pg_dump --version

# Testar backup manual
.\scripts\backup-working.ps1
```

### Problema: Permissões
```powershell
# Executar PowerShell como Administrador
# Verificar permissões da pasta backups
Get-Acl .\backups\

# Corrigir permissões se necessário
icacls .\backups\ /grant Everyone:F
```

### Problema: Espaço em disco
```powershell
# Verificar espaço disponível
Get-WmiObject -Class Win32_LogicalDisk | Select-Object DeviceID, @{Name="Size(GB)";Expression={[math]::Round($_.Size/1GB,2)}}, @{Name="FreeSpace(GB)";Expression={[math]::Round($_.FreeSpace/1GB,2)}}

# Limpar backups antigos manualmente
Get-ChildItem .\backups\ | Sort-Object LastWriteTime -Descending | Select-Object -Skip 7 | Remove-Item -Force
```

## 📈 Otimizações

### 1. Backup Incremental
```powershell
# Script para backup incremental (apenas mudanças)
# Implementar usando pg_dump com --schema-only para estrutura
# e --data-only para dados modificados
```

### 2. Compressão
```powershell
# Adicionar compressão ao backup
$backupPath = ".\backups\ratixpay_backup_$timestamp.sql.gz"
pg_dump ... | gzip > $backupPath
```

### 3. Backup Remoto
```powershell
# Upload para cloud storage
# Implementar upload para Google Drive, Dropbox, etc.
```

## 📋 Checklist de Configuração

- [ ] ✅ PostgreSQL instalado e funcionando
- [ ] ✅ Scripts de backup testados
- [ ] ✅ Tarefa agendada criada
- [ ] ✅ Permissões configuradas
- [ ] ✅ Espaço em disco suficiente
- [ ] ✅ Logs configurados
- [ ] ✅ Teste de restore realizado
- [ ] ✅ Monitoramento ativo

## 🚨 Alertas e Monitoramento

### Verificação Diária
```powershell
# Script para verificar backups diários
$lastBackup = Get-ChildItem .\backups\ | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$hoursSinceBackup = (Get-Date) - $lastBackup.LastWriteTime

if ($hoursSinceBackup.TotalHours -gt 25) {
    Write-Warning "⚠️ Backup está desatualizado (mais de 25 horas)"
    # Enviar alerta
}
```

### Dashboard de Status
```powershell
# Criar dashboard simples
Write-Host "📊 Status dos Backups RatixPay" -ForegroundColor Cyan
Write-Host "=" * 40 -ForegroundColor Cyan

$backups = Get-ChildItem .\backups\ | Sort-Object LastWriteTime -Descending
Write-Host "📁 Total de backups: $($backups.Count)" -ForegroundColor Green
Write-Host "📅 Último backup: $($backups[0].LastWriteTime.ToString('dd/MM/yyyy HH:mm:ss'))" -ForegroundColor Green
Write-Host "💾 Tamanho total: $([math]::Round(($backups | Measure-Object Length -Sum).Sum / 1MB, 2)) MB" -ForegroundColor Green
```

---

**Sistema de Backup Automático RatixPay**  
*Configurado para máxima segurança e confiabilidade*
