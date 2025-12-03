# Templates de Upsell

Esta pasta contém os templates de páginas de upsell disponíveis no sistema.

## Estrutura

- `templates.json` - Arquivo de metadados com informações sobre todos os templates disponíveis
- `vsl-laranja.html` - Template VSL Laranja (primeiro template)

## Como Adicionar um Novo Template

1. Crie um arquivo HTML na pasta `public/templates/upsell/` com o nome do template (ex: `meu-template.html`)

2. Use variáveis dinâmicas no formato `{{VARIAVEL}}` que serão substituídas pelos dados da página:
   - `{{TITULO_PAGINA}}` - Título da página (meta title)
   - `{{TITULO_PRINCIPAL}}` - Título principal (headline)
   - `{{SUBTITULO}}` - Subtítulo
   - `{{VIDEO_CONTENT}}` - Conteúdo do vídeo (será gerado automaticamente)
   - `{{PRECO_ORIGINAL}}` - Preço original (riscado)
   - `{{PRECO_OFERTA}}` - Preço da oferta
   - `{{TEXTO_BOTAO_ACEITAR}}` - Texto do botão principal
   - `{{TEXTO_BOTAO_RECUSAR}}` - Texto do botão de recusar
   - E outras variáveis conforme necessário

3. Adicione as informações do template no arquivo `templates.json`:
```json
{
  "id": "meu-template",
  "nome": "Meu Template",
  "descricao": "Descrição do template",
  "arquivo": "meu-template.html",
  "categoria": "VSL",
  "variaveis": [...]
}
```

## Variáveis Disponíveis

As seguintes variáveis são substituídas automaticamente quando o template é renderizado:

- **TITULO_PAGINA**: Título da página (meta title)
- **TEXTO_ALERTA**: Texto do alerta no topo
- **BADGE_TEXTO**: Texto do badge acima do título
- **TITULO_PRINCIPAL**: Título principal (headline)
- **SUBTITULO**: Subtítulo abaixo do título
- **VIDEO_CONTENT**: Conteúdo do vídeo (HTML completo)
- **PRECO_ORIGINAL**: Preço original formatado
- **PRECO_OFERTA**: Preço da oferta formatado
- **TEXTO_OFERTA_UNICA**: Texto do badge de oferta única
- **TEXTO_PERGUNTA_PRODUTO**: Texto da pergunta sobre adicionar produto
- **TEXTO_BOTAO_ACEITAR**: Texto do botão principal
- **TEXTO_SUBTITULO_BOTAO**: Texto abaixo do botão principal
- **TEXTO_BOTAO_RECUSAR**: Texto do botão de recusar
- **TEXTO_RECUSAR_SUBTITULO**: Texto abaixo do botão de recusar
- **TEXTO_CONFIRMACAO_RECUSAR**: Texto de confirmação ao recusar

## Integração com JavaScript

O template deve incluir a função `triggerPurchase()` que será chamada quando o botão de aceitar for clicado. Esta função pode usar a função global `processOneClickUpsell()` que está disponível no contexto da página.

Exemplo:
```javascript
function triggerPurchase() {
    if (typeof processOneClickUpsell === 'function') {
        processOneClickUpsell();
    }
}
```

## Exemplo de Template

Veja o arquivo `vsl-laranja.html` como referência de como criar um template completo.

