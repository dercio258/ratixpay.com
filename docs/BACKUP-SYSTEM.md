# Sistema de Backup RatixPay

Este documento descreve o sistema completo de backup e restore do banco de dados PostgreSQL do RatixPay.

## 📋 Visão Geral

O sistema de backup inclui:
- ✅ **Backup manual e automático** do banco PostgreSQL
- ✅ **Restore interativo** com seleção de arquivos
- ✅ **Limpeza automática** de backups antigos
- ✅ **Logs detalhados** de todas as operações
- ✅ **Scripts PowerShell** para Windows
- ✅ **Integração com npm** para fácil uso

## 🚀 Uso Rápido

### Backup Manual
```bash
# Criar backup
npm run backup

# Listar backups
npm run backup:list

# Verificar status
npm run backup:status
```

### Restore
```bash
# Restore interativo
npm run restore

# Restore de arquivo específico
node scripts/restore-database.js arquivo.sql
```

### PowerShell (Windows)
```powershell
# Backup
.\scripts\backup-manager.ps1 backup

# Restore interativo
.\scripts\backup-manager.ps1 restore

# Listar backups
.\scripts\backup-manager.ps1 list

# Verificar status
.\scripts\backup-manager.ps1 status
```

## 📁 Estrutura de Arquivos

```
scripts/
├── backup-database.js      # Script principal de backup
├── restore-database.js      # Script de restore
├── auto-backup.js          # Backup automático
└── backup-manager.ps1      # Gerenciador PowerShell

config/
└── backup-config.js         # Configurações centralizadas

backups/                     # Diretório de backups
├── ratixpay_backup_2024-01-15_14-30-00.sql
├── ratixpay_backup_2024-01-16_14-30-00.sql
└── ...

logs/
└── backup.log              # Log de operações
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` com as configurações:

```env
# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay_local
DB_USER=postgres
DB_PASS=postgres

# Backup
BACKUP_DIR=./backups
MAX_BACKUPS=7
PG_DUMP_PATH=pg_dump
PSQL_PATH=psql

# Logs
LOG_DIR=./logs
LOG_LEVEL=INFO
```

### Configuração do PostgreSQL

Certifique-se de que o PostgreSQL está instalado e configurado:

```bash
# Verificar instalação
psql --version

# Testar conexão
psql -h localhost -U postgres -d ratixpay_local
```

## 🔧 Scripts Disponíveis

### 1. backup-database.js
Script principal para criar backups.

**Uso:**
```bash
node scripts/backup-database.js
node scripts/backup-database.js --list
```

**Funcionalidades:**
- ✅ Cria backup completo do banco
- ✅ Nome com timestamp automático
- ✅ Limpeza de backups antigos
- ✅ Logs detalhados

### 2. restore-database.js
Script para restaurar backups.

**Uso:**
```bash
# Modo interativo
node scripts/restore-database.js

# Arquivo específico
node scripts/restore-database.js arquivo.sql
```

**Funcionalidades:**
- ✅ Lista backups disponíveis
- ✅ Seleção interativa
- ✅ Confirmação de segurança
- ✅ Restore completo

### 3. auto-backup.js
Script para backup automático.

**Uso:**
```bash
node scripts/auto-backup.js
node scripts/auto-backup.js --status
```

**Funcionalidades:**
- ✅ Backup automático
- ✅ Verificação de status
- ✅ Logs estruturados

### 4. backup-manager.ps1
Gerenciador PowerShell para Windows.

**Uso:**
```powershell
.\scripts\backup-manager.ps1 backup
.\scripts\backup-manager.ps1 restore
.\scripts\backup-manager.ps1 list
.\scripts\backup-manager.ps1 status
```

## 📊 Monitoramento

### Logs
Os logs são salvos em `logs/backup.log`:

```
[2024-01-15T14:30:00.000Z] [INFO] 🚀 Iniciando backup do banco de dados...
[2024-01-15T14:30:05.000Z] [INFO] ✅ Backup criado com sucesso: ratixpay_backup_2024-01-15_14-30-00.sql (15.2 MB)
[2024-01-15T14:30:06.000Z] [INFO] 🧹 Limpeza de backups antigos concluída
```

### Status do Backup
```bash
npm run backup:status
```

Verifica:
- ✅ Último backup realizado
- ✅ Idade do backup
- ✅ Tamanho do arquivo
- ✅ Status de saúde

## 🔄 Backup Automático

### Agendamento (Windows)
Para configurar backup automático no Windows:

1. **Agendador de Tarefas:**
   - Abra o "Agendador de Tarefas"
   - Crie nova tarefa
   - Ação: `node scripts/auto-backup.js`
   - Agendamento: Diário às 2:00 AM

2. **Task Scheduler via PowerShell:**
```powershell
# Criar tarefa agendada
$action = New-ScheduledTaskAction -Execute "node" -Argument "scripts/auto-backup.js" -WorkingDirectory "E:\Producao\ratixpay.production-main"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "RatixPay Backup" -Description "Backup automático do RatixPay"
```

### Agendamento (Linux)
Para configurar backup automático no Linux:

```bash
# Adicionar ao crontab
crontab -e

# Backup diário às 2:00 AM
0 2 * * * cd /path/to/ratixpay && node scripts/auto-backup.js >> logs/backup.log 2>&1
```

## 🛡️ Segurança

### Boas Práticas
- ✅ **Backups regulares:** Diariamente
- ✅ **Retenção:** Manter 7 backups (1 semana)
- ✅ **Teste de restore:** Mensalmente
- ✅ **Backup offsite:** Para produção
- ✅ **Criptografia:** Para dados sensíveis

### Verificação de Integridade
```bash
# Verificar backup
npm run backup:status

# Testar restore (em ambiente de teste)
npm run restore
```

## 🚨 Troubleshooting

### Problemas Comuns

**1. Erro de conexão PostgreSQL:**
```
❌ Erro ao criar backup: password authentication failed
```
**Solução:** Verificar credenciais no `.env`

**2. pg_dump não encontrado:**
```
❌ pg_dump não encontrado
```
**Solução:** Adicionar PostgreSQL ao PATH ou definir `PG_DUMP_PATH`

**3. Permissões de arquivo:**
```
❌ EACCES: permission denied
```
**Solução:** Verificar permissões do diretório `backups/`

**4. Espaço em disco:**
```
❌ ENOSPC: no space left on device
```
**Solução:** Limpar backups antigos ou aumentar espaço

### Logs de Debug
```bash
# Habilitar logs detalhados
LOG_LEVEL=DEBUG npm run backup
```

## 📈 Próximas Funcionalidades

- [ ] **Notificações por email** de status do backup
- [ ] **Backup incremental** para bases grandes
- [ ] **Compressão automática** dos arquivos
- [ ] **Upload automático** para cloud storage
- [ ] **Dashboard web** para monitoramento
- [ ] **Backup de arquivos** da aplicação
- [ ] **Restore seletivo** de tabelas

## 📞 Suporte

Para problemas ou dúvidas:
1. Verificar logs em `logs/backup.log`
2. Testar conectividade com PostgreSQL
3. Verificar permissões de arquivo
4. Consultar este documento

---

**Sistema de Backup RatixPay v1.0**  
*Desenvolvido para garantir a segurança dos dados do RatixPay*
