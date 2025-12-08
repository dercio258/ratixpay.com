# 🔄 Mudança de Domínio: ratixpay.com → ratixpay.site

## 📋 Resumo das Alterações

Este documento descreve todas as alterações realizadas para migrar o domínio de **ratixpay.com** para **ratixpay.site**.

---

## ✅ Alterações Realizadas

### 1. Scripts de Atualização do Banco de Dados

#### 📄 `scripts/update-domain-ratixpay-site.sql`
Script SQL para atualizar URLs e nomes de arquivos no banco de dados:
- Atualiza `produtos.imagem_url`
- Atualiza `produtos.link_conteudo`
- Atualiza `afiliados.link_afiliado`
- Atualiza `link_trackings.link_original`
- Atualiza `link_trackings.link_afiliado`
- Atualiza campos JSON em `vendas.tracking_data` (se existir)
- Atualiza `vendas.url_produto` (se existir)

#### 📄 `scripts/update-domain-ratixpay-site.js`
Script Node.js para executar a atualização do banco de dados:
- Conecta ao banco usando variáveis de ambiente
- Executa todas as atualizações de forma transacional
- Mostra estatísticas das atualizações realizadas
- Inclui tratamento de erros e rollback

**Como executar:**
```bash
# Opção 1: Script SQL direto
psql -U postgres -d ratixpay -f scripts/update-domain-ratixpay-site.sql

# Opção 2: Script Node.js (recomendado)
node scripts/update-domain-ratixpay-site.js
```

---

### 2. Arquivos de Configuração

#### ✅ `nginx.conf`
- Atualizado `server_name` de `ratixpay.com www.ratixpay.com` para `ratixpay.site www.ratixpay.site`

#### ✅ `loaders/express.js`
- Atualizado CSP (Content Security Policy) para incluir `wss://ratixpay.site` e `ws://ratixpay.site`

#### ✅ `middleware/security.js`
- Atualizado CSP para incluir:
  - `https://www.ratixpay.site`
  - `https://ratixpay.site`
  - `http://www.ratixpay.site`
  - `http://ratixpay.site`
  - `wss://ratixpay.site`
  - `ws://ratixpay.site`

#### ✅ `utils/securityOptimizer.js`
- Atualizado CSP para incluir `wss://ratixpay.site` e `ws://ratixpay.site`

---

### 3. Rotas e Serviços

#### ✅ `routes/pagamento.js`
- Atualizado `BASE_URL` padrão de `https://ratixpay.com` para `https://ratixpay.site`
- Atualizadas todas as referências internas ao `baseUrl`

#### ✅ `routes/auth-afiliados.js`
- Atualizado `BASE_URL` padrão de `https://ratixpay.com` para `https://ratixpay.site`

---

### 4. Serviços de Email

#### ✅ `services/sistemaEmailService.js`
Atualizadas todas as URLs nos templates de email:
- Links para `https://ratixpay.site`
- Links para `https://ratixpay.site/dashboard`
- Links para `https://ratixpay.site/forgot-password.html`
- Links para `https://ratixpay.site/login.html`
- Links para `https://ratixpay.site/gestao-produtos.html`
- Links para `https://ratixpay.site/admin-produtos.html`

#### ✅ `services/vendaNotificationService.js`
Atualizadas todas as referências:
- `{{url_plataforma}}` → `https://ratixpay.site`
- `{{url_termos}}` → `https://ratixpay.site/termos`
- Todas as referências a `baseUrl` atualizadas

#### ✅ `services/saqueNotificationService.js`
- Atualizado `BASE_URL` padrão de `https://ratixpay.com` para `https://ratixpay.site`

#### ✅ `services/vendasEmailService.js`
- Atualizadas URLs de imagens e links para `https://ratixpay.site`

#### ✅ `services/ratixpayApprovalService.js`
- Atualizado `apiBaseUrl` de `https://api.ratixpay.com` para `https://api.ratixpay.site`

---

### 5. Arquivos Públicos (HTML)

#### ✅ `public/pagamentos.html`
- Atualizado CSP para incluir `wss://ratixpay.site` e `ws://ratixpay.site`

#### ✅ `public/termos-condicoes.html`
- Atualizado link do website de `ratixpay.com` para `ratixpay.site`

---

## 📝 Notas Importantes

### Emails NÃO Alterados
Os seguintes endereços de email **NÃO** foram alterados, pois são endereços de email, não URLs:
- `suporte@ratixpay.com`
- `vendas@ratixpay.com`
- `sistema@ratixpay.com`
- `ofertas@ratixpay.com`
- `admin@ratixpay.com`

**⚠️ IMPORTANTE:** Se você também precisa alterar os domínios dos emails, será necessário:
1. Configurar os novos endereços de email no servidor
2. Atualizar as variáveis de ambiente no arquivo `.env`
3. Atualizar manualmente as referências nos arquivos de serviço

---

## 🚀 Como Aplicar as Alterações

### Passo 1: Atualizar o Banco de Dados
```bash
# Executar o script de atualização
node scripts/update-domain-ratixpay-site.js
```

### Passo 2: Verificar Variáveis de Ambiente
Certifique-se de que o arquivo `.env` contém:
```env
BASE_URL=https://ratixpay.site
FRONTEND_URL=https://ratixpay.site
RATIXPAY_API_URL=https://api.ratixpay.site
```

### Passo 3: Reiniciar o Servidor
```bash
# Reiniciar o servidor Node.js
pm2 restart all
# ou
systemctl restart ratixpay
```

### Passo 4: Atualizar Configuração do Nginx
```bash
# Testar configuração
nginx -t

# Recarregar configuração
nginx -s reload
# ou
systemctl reload nginx
```

### Passo 5: Verificar DNS
Certifique-se de que o domínio `ratixpay.site` está configurado corretamente:
- Registro A apontando para o IP do servidor
- Registro CNAME para `www.ratixpay.site` (se necessário)
- Certificado SSL configurado para o novo domínio

---

## 🔍 Verificação Pós-Migração

### 1. Verificar Banco de Dados
```sql
-- Verificar produtos com novo domínio
SELECT id, imagem_url, link_conteudo 
FROM produtos 
WHERE imagem_url LIKE '%ratixpay.site%' 
   OR link_conteudo LIKE '%ratixpay.site%';

-- Verificar afiliados
SELECT id, link_afiliado 
FROM afiliados 
WHERE link_afiliado LIKE '%ratixpay.site%';

-- Verificar se ainda há referências ao domínio antigo
SELECT COUNT(*) as total_antigo
FROM produtos 
WHERE imagem_url LIKE '%ratixpay.com%' 
   OR link_conteudo LIKE '%ratixpay.com%';
```

### 2. Verificar Logs
```bash
# Verificar logs do servidor
pm2 logs
# ou
tail -f /var/log/ratixpay/error.log
```

### 3. Testar Funcionalidades
- [ ] Login e autenticação
- [ ] Criação de produtos
- [ ] Processamento de pagamentos
- [ ] Envio de emails
- [ ] Links de afiliados
- [ ] WebSockets (se aplicável)

---

## 📊 Estatísticas

### Arquivos Modificados
- **Scripts:** 2 arquivos criados
- **Configuração:** 4 arquivos atualizados
- **Rotas:** 2 arquivos atualizados
- **Serviços:** 6 arquivos atualizados
- **Públicos:** 2 arquivos atualizados

### Total de Referências Atualizadas
- URLs: ~50+ referências
- CSP (Content Security Policy): 4 arquivos
- Variáveis de ambiente: 3 variáveis

---

## ⚠️ Avisos

1. **Backup:** Sempre faça backup do banco de dados antes de executar os scripts de atualização
2. **Testes:** Teste todas as funcionalidades após a migração
3. **DNS:** Certifique-se de que o DNS está configurado corretamente antes de fazer o deploy
4. **SSL:** Configure o certificado SSL para o novo domínio
5. **Emails:** Se os emails também precisarem ser alterados, faça isso separadamente

---

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do servidor
2. Logs do banco de dados
3. Configuração do Nginx
4. Variáveis de ambiente
5. Configuração DNS

---

**Data da Migração:** $(date)
**Versão do Documento:** 1.0

