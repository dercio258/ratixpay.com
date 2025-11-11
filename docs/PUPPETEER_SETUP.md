# Configuração do Puppeteer para WhatsApp Sessions

## Problema

O `whatsapp-web.js` requer o Puppeteer com Chromium instalado. Se você receber o erro:

```
Could not find expected browser (chrome) locally. Run `npm install` to download the correct Chromium revision.
```

## Solução

### Opção 1: Instalar Puppeteer (Recomendado)

```bash
npm install puppeteer
```

Isso instalará automaticamente o Chromium necessário.

### Opção 2: Usar Chrome/Chromium do Sistema

Se você já tem Chrome ou Chromium instalado no sistema, configure a variável de ambiente:

**Windows:**
```powershell
$env:PUPPETEER_EXECUTABLE_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

**Linux/Mac:**
```bash
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome"
```

### Opção 3: Reinstalar dependências

Se o Puppeteer estiver corrompido ou incompleto:

```bash
# Parar o servidor primeiro
# Depois:
rm -rf node_modules/puppeteer
npm install puppeteer
```

### Verificar Instalação

Para verificar se o Puppeteer está funcionando:

```bash
node -e "require('puppeteer').launch().then(browser => { console.log('✅ Puppeteer funcionando!'); browser.close(); })"
```

## Nota Importante

- O Puppeteer baixa automaticamente o Chromium (~300MB) na primeira instalação
- Isso pode demorar alguns minutos dependendo da sua conexão
- Se houver erro de permissão, execute como administrador

