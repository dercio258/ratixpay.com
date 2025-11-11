# Guia para Enviar Código para GitHub

## Passo 1: Inicializar Repositório Git (se ainda não foi feito)

```bash
git init
```

## Passo 2: Adicionar Remote do GitHub

Substitua `<SEU_USUARIO>` e `<SEU_REPOSITORIO>` pelos seus dados:

```bash
git remote add origin https://github.com/<SEU_USUARIO>/<SEU_REPOSITORIO>.git
```

Ou se preferir usar SSH:

```bash
git remote add origin git@github.com:<SEU_USUARIO>/<SEU_REPOSITORIO>.git
```

## Passo 3: Verificar Arquivos que Serão Commitados

```bash
git status
```

## Passo 4: Adicionar Arquivos ao Staging

```bash
git add .
```

## Passo 5: Criar Commit

```bash
git commit -m "Correções e melhorias: removidas senhas hardcoded, corrigido encoding, atualizado Font Awesome para jsDelivr, corrigido CSP"
```

## Passo 6: Definir Branch Principal (se necessário)

```bash
git branch -M main
```

## Passo 7: Fazer Push para GitHub

Primeira vez:

```bash
git push -u origin main
```

Próximas vezes:

```bash
git push
```

---

## Usando o Script Automatizado

Você também pode usar o script PowerShell criado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/prepare-git-commit.ps1
```

O script irá:
- ✅ Verificar se é um repositório Git (inicializar se necessário)
- ✅ Mostrar status dos arquivos
- ✅ Adicionar arquivos ao staging
- ✅ Criar commit com mensagem descritiva
- ✅ Mostrar instruções para push

---

## Arquivos que NÃO serão enviados (protegidos pelo .gitignore)

- `.env` (arquivo com credenciais)
- `node_modules/` (dependências)
- Arquivos de log
- Arquivos temporários
- QR codes
- Scripts de teste com dados sensíveis

---

## Verificação Final

Antes de fazer push, verifique se não há informações sensíveis:

```bash
# Verificar se .env está no .gitignore
git check-ignore .env

# Verificar o que será commitado
git status
```

---

## Resolução de Problemas

### Se der erro de autenticação:

1. Use Personal Access Token ao invés de senha
2. Ou configure SSH keys

### Se der erro de branch:

```bash
git branch -M main
git push -u origin main
```

### Se quiser ver o que será enviado:

```bash
git ls-files
```

