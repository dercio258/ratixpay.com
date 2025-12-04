# 📊 Estrutura do Banco de Dados - Pagamentos e Saques

## 🎯 Visão Geral

Este documento descreve a estrutura do banco de dados local relacionada a **pagamentos** e **saques** no sistema RatixPay.

### Configuração Local

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ratixpay_local
DB_USER=postgres
DB_PASS=postgres
```

---

## 📋 Tabelas Principais

### 1. `carteiras` - Carteiras de Pagamento

A tabela `carteiras` armazena as informações das carteiras de pagamento dos vendedores. Cada vendedor pode ter apenas **uma carteira ativa**.

#### Estrutura da Tabela

```sql
CREATE TABLE carteiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID UNIQUE NOT NULL,
    nome VARCHAR(255) DEFAULT 'Carteira Principal',
    
    -- Dados Mpesa
    contacto_mpesa VARCHAR(20) NOT NULL,
    nome_titular_mpesa VARCHAR(255) NOT NULL,
    
    -- Dados Emola
    contacto_emola VARCHAR(20) NOT NULL,
    nome_titular_emola VARCHAR(255) NOT NULL,
    
    -- Email
    email VARCHAR(255) NOT NULL,
    
    -- Saldos
    saldo_disponivel DECIMAL(10, 2) DEFAULT 0,
    saldo_bloqueado DECIMAL(10, 2) DEFAULT 0,
    saldo_total DECIMAL(10, 2) DEFAULT 0,
    
    -- Status e Configurações
    ativa BOOLEAN DEFAULT true,
    metodo_saque VARCHAR(50) DEFAULT 'Mpesa',
    
    -- Campos Legados (compatibilidade)
    contacto VARCHAR(20) NOT NULL DEFAULT '',
    nome_titular VARCHAR(255) NOT NULL DEFAULT '',
    email_titular VARCHAR(255) NOT NULL DEFAULT '',
    
    -- Timestamps
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_carteira_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

#### Campos Importantes

**Campos Novos (Específicos por Método):**
- `contacto_mpesa` / `nome_titular_mpesa` - Dados para saques via Mpesa
- `contacto_emola` / `nome_titular_emola` - Dados para saques via Emola
- `email` - Email do titular da carteira
- `metodo_saque` - Método de saque padrão ('Mpesa' ou 'Emola')

**Campos Legados (Compatibilidade):**
- `contacto` - Contacto padrão (preenchido automaticamente com `contacto_mpesa`)
- `nome_titular` - Nome do titular padrão (preenchido automaticamente com `nome_titular_mpesa`)
- `email_titular` - Email do titular (preenchido automaticamente com `email`)

#### Constraints

- **UNIQUE**: `vendedor_id` - Um vendedor pode ter apenas uma carteira
- **FOREIGN KEY**: `vendedor_id` → `usuarios.id` (CASCADE DELETE)

---

### 2. `pagamentos` - Saques/Pagamentos

A tabela `pagamentos` armazena todas as solicitações de saque dos vendedores.

#### Estrutura da Tabela

```sql
CREATE TABLE pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL,
    
    -- Valores
    valor DECIMAL(10, 2) NOT NULL,
    valor_liquido DECIMAL(10, 2),
    taxa DECIMAL(10, 2),
    
    -- Método e Destino
    metodo VARCHAR(50),
    conta_destino VARCHAR(255),  -- Nome do titular (não o contacto!)
    telefone_titular VARCHAR(20),
    
    -- Status
    status VARCHAR(20) DEFAULT 'pendente',  -- pendente, aprovado, pago, rejeitado
    
    -- Datas
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_processamento TIMESTAMP,
    
    -- Informações Adicionais
    observacoes TEXT,
    nome_titular VARCHAR(255),
    ip_solicitacao VARCHAR(45),
    user_agent TEXT,
    public_id VARCHAR(20) UNIQUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_pagamento_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

#### Status Possíveis

- `pendente` - Aguardando aprovação do administrador
- `aprovado` - Aprovado pelo administrador, aguardando pagamento
- `pago` - Pagamento realizado
- `rejeitado` - Saque rejeitado pelo administrador

#### Campos Importantes

- `valor` - Valor total solicitado pelo vendedor
- `valor_liquido` - Valor após dedução de taxas (95% do valor)
- `taxa` - Taxa do administrador (5% do valor)
- `conta_destino` - **Nome do titular** (não o número de contacto!)
- `telefone_titular` - Número de contacto/telefone
- `public_id` - ID público memorável (ex: SAQ-123456)

---

### 3. `usuarios` - Usuários/Vendedores

A tabela `usuarios` armazena informações dos vendedores.

#### Campos Relevantes para Pagamentos

```sql
CREATE TABLE usuarios (
    id UUID PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    telefone VARCHAR(20),
    -- ... outros campos
);
```

---

## 🔄 Fluxo de Saque

### 1. Solicitação de Saque

1. Vendedor escolhe uma carteira
2. Vendedor insere o valor do saque
3. Sistema gera código de autenticação (6 dígitos)
4. Código é enviado por email e WhatsApp
5. Vendedor confirma com o código
6. Sistema cria registro em `pagamentos` com status `pendente`

### 2. Processamento do Saque

O serviço `SaqueSimplificadoService.processarSaqueDirecto()`:

1. **Valida a carteira:**
   - Verifica se a carteira existe e está ativa
   - Busca `nome_titular_mpesa` ou `nome_titular_emola` baseado no método
   - Busca `contacto_mpesa` ou `contacto_emola` baseado no método
   - Fallback para campos legados se necessário

2. **Valida o código de autenticação:**
   - Verifica se o código é válido e não expirou

3. **Verifica receita disponível:**
   - Calcula se o vendedor tem receita suficiente

4. **Cria registro de saque:**
   - Status: `pendente`
   - Calcula taxas (5% admin, 95% vendedor)
   - Salva nome do titular em `conta_destino`

5. **Aguarda aprovação do administrador**

### 3. Aprovação do Saque

O administrador aprova o saque, que então:
- Status muda para `aprovado` ou `pago`
- Taxas são processadas
- Saldo do administrador é atualizado
- Receita do vendedor é atualizada

---

## ⚠️ Problemas Comuns e Soluções

### Erro: "Nome do titular da carteira não encontrado"

**Causa:** A carteira não tem `nome_titular_mpesa` ou `nome_titular_emola` preenchidos.

**Solução:** Execute o script de correção:

```bash
psql -U postgres -d ratixpay_local -f scripts/fix-nome-titular-producao.sql
```

Ou manualmente:

```sql
-- Preencher nome_titular_mpesa se estiver vazio
UPDATE carteiras c
SET nome_titular_mpesa = COALESCE(
    NULLIF(c.nome_titular_mpesa, ''),
    NULLIF(c.nome_titular, ''),
    (SELECT u.nome_completo FROM usuarios u WHERE u.id = c.vendedor_id),
    'Titular não informado'
)
WHERE nome_titular_mpesa IS NULL OR nome_titular_mpesa = '';

-- Preencher nome_titular_emola se estiver vazio
UPDATE carteiras c
SET nome_titular_emola = COALESCE(
    NULLIF(c.nome_titular_emola, ''),
    NULLIF(c.nome_titular_mpesa, ''),
    NULLIF(c.nome_titular, ''),
    (SELECT u.nome_completo FROM usuarios u WHERE u.id = c.vendedor_id),
    'Titular não informado'
)
WHERE nome_titular_emola IS NULL OR nome_titular_emola = '';
```

### Erro: "Contacto da carteira não encontrado"

**Causa:** A carteira não tem `contacto_mpesa` ou `contacto_emola` preenchidos.

**Solução:**

```sql
-- Preencher contacto_mpesa se estiver vazio
UPDATE carteiras
SET contacto_mpesa = COALESCE(
    NULLIF(contacto_mpesa, ''),
    contacto,
    contacto_emola,
    ''
)
WHERE contacto_mpesa IS NULL OR contacto_mpesa = '';

-- Preencher contacto_emola se estiver vazio
UPDATE carteiras
SET contacto_emola = COALESCE(
    NULLIF(contacto_emola, ''),
    contacto_mpesa,
    contacto,
    ''
)
WHERE contacto_emola IS NULL OR contacto_emola = '';
```

---

## 🔍 Queries Úteis

### Verificar carteiras sem nome do titular

```sql
SELECT 
    c.id,
    c.vendedor_id,
    c.nome,
    c.nome_titular_mpesa,
    c.nome_titular_emola,
    c.metodo_saque,
    u.nome_completo as nome_usuario,
    u.email as email_usuario
FROM carteiras c
LEFT JOIN usuarios u ON u.id = c.vendedor_id
WHERE (c.nome_titular_mpesa IS NULL OR c.nome_titular_mpesa = '')
  AND (c.nome_titular_emola IS NULL OR c.nome_titular_emola = '');
```

### Verificar saques pendentes

```sql
SELECT 
    p.id,
    p.vendedor_id,
    p.valor,
    p.status,
    p.data_solicitacao,
    u.nome_completo as vendedor,
    c.nome as carteira
FROM pagamentos p
LEFT JOIN usuarios u ON u.id = p.vendedor_id
LEFT JOIN carteiras c ON c.vendedor_id = p.vendedor_id
WHERE p.status = 'pendente'
ORDER BY p.data_solicitacao DESC;
```

### Estatísticas de saques

```sql
SELECT 
    status,
    COUNT(*) as total,
    SUM(valor) as valor_total,
    AVG(valor) as valor_medio
FROM pagamentos
GROUP BY status;
```

---

## 📝 Scripts de Manutenção

### Script Completo de Correção

Execute para corrigir todos os problemas de carteiras:

```bash
psql -U postgres -d ratixpay_local -f scripts/fix-carteira-complete.sql
```

### Script Específico para Nome do Titular

Execute para corrigir apenas o problema do nome do titular:

```bash
psql -U postgres -d ratixpay_local -f scripts/fix-nome-titular-producao.sql
```

---

## 🔗 Relacionamentos

```
usuarios (1) ──< (1) carteiras
usuarios (1) ──< (*) pagamentos
```

- Um usuário tem **uma** carteira
- Um usuário pode ter **múltiplos** pagamentos/saques

---

## 📌 Notas Importantes

1. **Nome do Titular vs Contacto:**
   - `conta_destino` em `pagamentos` deve conter o **nome do titular**, não o contacto
   - `telefone_titular` contém o número de contacto

2. **Campos Legados:**
   - Os campos `contacto`, `nome_titular` e `email_titular` são mantidos para compatibilidade
   - Eles são preenchidos automaticamente com os valores dos campos novos

3. **Método de Saque:**
   - O campo `metodo_saque` determina qual conjunto de campos usar (Mpesa ou Emola)
   - Padrão é 'Mpesa'

4. **Status de Saque:**
   - Todos os saques começam com status `pendente`
   - Apenas o administrador pode aprovar/pagar saques

---

## 🚀 Próximos Passos

Se encontrar problemas:

1. Execute o script de correção apropriado
2. Verifique os logs do servidor para mais detalhes
3. Consulte a documentação do serviço `SaqueSimplificadoService`
4. Verifique se todas as carteiras têm os campos obrigatórios preenchidos

