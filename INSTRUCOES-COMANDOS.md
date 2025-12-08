# 📋 Instruções - Comandos Prontos para Executar

## 🚀 Opção 1: Usar Script PowerShell (Mais Fácil)

```powershell
# Execute no PowerShell:
.\scripts\prepare-github-commit.ps1
```

Este script vai:
- ✅ Verificar se há merge pendente
- ✅ Adicionar todos os arquivos necessários
- ✅ Mostrar resumo
- ✅ Dar instruções finais

## 🚀 Opção 2: Comandos Manuais

### Passo 1: Concluir Merge (se necessário)

```bash
git commit -m "Merge branch atualizado"
```

### Passo 2: Adicionar Arquivos de Migração

```bash
git add migrations/migrate-all-systems-unified.sql
git add migrations/update-domain-ratixpay-com-to-site.sql
git add migrations/update-products-images-files.sql
git add migrations/README-MIGRATIONS.md
```

### Passo 3: Adicionar Scripts

```bash
git add scripts/run-all-migrations.sh
git add scripts/run-all-migrations.js
git add scripts/update-domain-in-code.js
git add scripts/prepare-github-commit.ps1
```

### Passo 4: Adicionar Documentação

```bash
git add MIGRATION-GUIDE.md
git add PREPARACAO-GITHUB.md
git add COMMIT-MESSAGE.md
git add RESUMO-FINAL.md
```

### Passo 5: Fazer Commit

```bash
git commit -m "feat: Adicionar migrações completas e atualização de domínio para ratixpay.site

- Criar migração unificada para Blog, Remarketing e Afiliados
- Script para atualizar domínio ratixpay.com → ratixpay.site
- Script para atualizar produtos, imagens e arquivos
- Scripts automatizados para executar migrações
- Documentação completa de migração

Migrações:
- migrate-all-systems-unified.sql: Sistema completo
- update-domain-ratixpay-com-to-site.sql: Atualizar domínio
- update-products-images-files.sql: Atualizar produtos

Scripts:
- run-all-migrations.sh/js: Executar migrações
- update-domain-in-code.js: Atualizar código
- prepare-github-commit.ps1: Preparar commit

Documentação:
- MIGRATION-GUIDE.md: Guia completo
- migrations/README-MIGRATIONS.md: Docs técnicas"
```

### Passo 6: Push para GitHub

```bash
git push origin main
```

## 🔧 Para Executar as Migrações no Servidor

### Opção A: Script Node.js (Recomendado)

```bash
node scripts/run-all-migrations.js
```

### Opção B: Script Bash

```bash
chmod +x scripts/run-all-migrations.sh
./scripts/run-all-migrations.sh
```

### Opção C: Manual (PostgreSQL)

```bash
# 1. Backup primeiro!
pg_dump -U postgres -d ratixpay > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Migração unificada
psql -U postgres -d ratixpay -f migrations/migrate-all-systems-unified.sql

# 3. Atualizar domínio
psql -U postgres -d ratixpay -f migrations/update-domain-ratixpay-com-to-site.sql

# 4. Atualizar produtos
psql -U postgres -d ratixpay -f migrations/update-products-images-files.sql
```

## 📝 Resumo Rápido

**Arquivos criados:**
- ✅ 3 migrações SQL
- ✅ 4 scripts de automação
- ✅ 5 arquivos de documentação

**Total:** 12 arquivos novos

**Comando mais rápido:**
```powershell
.\scripts\prepare-github-commit.ps1
git commit -m "feat: Adicionar migrações completas e atualização de domínio para ratixpay.site"
git push origin main
```

## ✅ Verificação Pós-Commit

```bash
# Verificar arquivos commitados
git log --oneline -1
git show --name-only --pretty=""

# Verificar estrutura de arquivos
ls -la migrations/
ls -la scripts/
```

