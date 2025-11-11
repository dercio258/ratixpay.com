# Configuração Nginx para Marketing Avançado

## Visão Geral

A configuração do Nginx foi otimizada para suportar o sistema de controle de acesso ao marketing avançado, com foco em performance, segurança e compatibilidade com Cloudflare.

## Otimizações Implementadas

### 1. **Páginas de Configuração de Marketing**

```nginx
# Headers específicos para páginas de configuração de marketing
location ~* ^/(blackfriday-config|descontos-config|remarketing-config|temporizador-config) {
    add_header Cache-Control "public, max-age=900"; # 15 minutos
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header CF-Cache-Status "HIT";
    add_header ETag "";
}
```

**Características:**
- Cache de 15 minutos para páginas de configuração
- Headers de segurança específicos
- Otimizado para Cloudflare

### 2. **Páginas de Marketing Avançado**

```nginx
# Headers específicos para páginas de marketing avançado
location ~* ^/marketing-avancado {
    add_header Cache-Control "public, max-age=1800"; # 30 minutos
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header CF-Cache-Status "HIT";
    add_header ETag "";
}
```

**Características:**
- Cache de 30 minutos para página de marketing
- Headers de segurança reforçados
- Suporte completo ao Cloudflare

### 3. **Rotas de API de Marketing Avançado**

```nginx
# Rotas específicas de marketing avançado
location ~ ^/api/blackfriday/ {
    limit_req zone=api burst=10 nodelay;
    proxy_pass http://app;
    # Headers de segurança específicos para Black Friday
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

**Rotas Configuradas:**
- `/api/blackfriday/` - Configuração Black Friday
- `/api/descontos/` - Configuração Descontos
- `/api/remarketing/` - Configuração Remarketing
- `/api/temporizador-config/` - Configuração Temporizador

### 4. **Arquivos JavaScript Otimizados**

```nginx
# Headers específicos para arquivos de autenticação
location ~* ^/js/(global-auth|auth-utils)\.js$ {
    add_header Cache-Control "public, max-age=3600"; # 1 hora
    add_header Vary "Accept-Encoding, CF-Cache-Status";
    add_header Access-Control-Allow-Origin "*";
    add_header CF-Cache-Status "HIT";
}

# Headers específicos para arquivos de configuração
location ~* ^/js/(blackfriday-config|descontos-config|remarketing-config|temporizador-config)\.js$ {
    add_header Cache-Control "public, max-age=1800"; # 30 minutos
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "SAMEORIGIN";
    add_header CF-Cache-Status "HIT";
}
```

**Características:**
- Cache diferenciado por tipo de arquivo
- Arquivos de auth: 1 hora
- Arquivos de config: 30 minutos
- Headers de segurança específicos

## Rate Limiting

### **Configurações de Rate Limiting**

```nginx
# Rate limiting geral
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

# Aplicação nas rotas
location ~ ^/api/(blackfriday|descontos|remarketing|temporizador-config) {
    limit_req zone=api burst=10 nodelay;
}
```

**Limites Configurados:**
- **API Geral**: 10 req/s
- **Login**: 5 req/min
- **Upload**: 2 req/s
- **Marketing Avançado**: 10 req/s

## Headers de Segurança

### **Headers Implementados**

```nginx
# Headers de segurança para marketing avançado
add_header X-Content-Type-Options "nosniff";
add_header X-Frame-Options "SAMEORIGIN";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
```

**Proteções:**
- **X-Content-Type-Options**: Previne MIME type sniffing
- **X-Frame-Options**: Previne clickjacking
- **X-XSS-Protection**: Proteção contra XSS
- **Referrer-Policy**: Controle de referrer

## Cache Strategy

### **Estratégia de Cache por Tipo**

| Tipo de Arquivo | Cache | Motivo |
|-----------------|-------|--------|
| **Páginas de Config** | 15 min | Conteúdo dinâmico |
| **Páginas de Marketing** | 30 min | Conteúdo semi-estático |
| **JS de Auth** | 1 hora | Segurança |
| **JS de Config** | 30 min | Funcionalidade |
| **Assets Estáticos** | 30 dias | Imutáveis |

## Cloudflare Integration

### **Headers Específicos para Cloudflare**

```nginx
# Headers de Cloudflare
add_header CF-Cache-Status "HIT";
add_header CF-Ray $http_cf_ray;
add_header CF-Connecting-IP $http_cf_connecting_ip;
add_header CF-Visitor $http_cf_visitor;

# Headers de performance
add_header Vary "Accept-Encoding, CF-Cache-Status";
add_header X-Cache-Status $upstream_cache_status;
```

**Benefícios:**
- Cache inteligente com Cloudflare
- Headers de performance otimizados
- Suporte completo a CDN
- Compressão Gzip e Brotli

## Compressão

### **Configurações de Compressão**

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;

# Brotli compression (se disponível)
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css application/json application/javascript;
```

**Tipos Suportados:**
- **Gzip**: Texto, CSS, JS, JSON
- **Brotli**: Texto, CSS, JS, JSON (Cloudflare)
- **Níveis**: 6 (balanceado)

## Monitoramento

### **Endpoints de Monitoramento**

```nginx
# Health check
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}

# Status do Nginx
location /nginx-status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    allow 172.16.0.0/12;
    deny all;
}
```

## Scripts de Gerenciamento

### **Comandos Disponíveis**

```bash
# Testar configuração
node scripts/test-nginx-config.js

# Gerenciar Nginx
npm run nginx:start
npm run nginx:stop
npm run nginx:restart
npm run nginx:status
npm run nginx:reload
npm run nginx:test
```

## Benefícios da Configuração

### ✅ **Performance**
- Cache otimizado por tipo de conteúdo
- Compressão Gzip e Brotli
- Headers de performance para Cloudflare

### ✅ **Segurança**
- Headers de segurança específicos
- Rate limiting por tipo de rota
- Proteção contra ataques comuns

### ✅ **Escalabilidade**
- Suporte completo ao Cloudflare
- Cache inteligente
- Rate limiting configurável

### ✅ **Monitoramento**
- Endpoints de health check
- Status do Nginx
- Logs detalhados

## Próximos Passos

1. **Reiniciar Nginx**: `npm run nginx:restart`
2. **Testar Configuração**: `node scripts/test-nginx-config.js`
3. **Monitorar Performance**: `npm run nginx:status`
4. **Verificar Logs**: `tail -f /var/log/nginx/error.log`

A configuração está otimizada para suportar o sistema de marketing avançado com máxima performance e segurança! 🚀
