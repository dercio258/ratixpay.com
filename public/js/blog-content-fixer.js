/**
 * Blog Content Fixer - Funções simples para corrigir HTML mal formatado
 * Corrige tags sem < > e classes quebradas
 */

// Função para decodificar entidades HTML
function decodeHtmlEntities(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// Função principal para corrigir HTML mal formatado
function fixBlogContent(content) {
    if (!content) return '';
    
    // Se já tem HTML válido, apenas limpar caracteres estranhos
    if (content.includes('<') && content.includes('>')) {
        return cleanHtmlContent(content);
    }
    
    // Decodificar entidades HTML se necessário
    if (content.includes('&lt;') || content.includes('&gt;')) {
        content = decodeHtmlEntities(content);
        if (content.includes('<') && content.includes('>')) {
            return cleanHtmlContent(content);
        }
    }
    
    // Corrigir tags mal formatadas
    content = fixMalformedTags(content);
    
    // Limpar caracteres estranhos
    content = cleanHtmlContent(content);
    
    return content;
}

// Função para corrigir tags sem < >
function fixMalformedTags(content) {
    if (!content) return '';
    
    let fixed = content;
    
    // Lista de tags HTML comuns (em ordem de prioridade - mais longas primeiro)
    const tags = ['blockquote', 'strong', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'em', 'i', 'u', 's', 
                  'ul', 'ol', 'li', 'div', 'span', 'pre', 'code', 'a', 'img', 'b'];
    
    // Processar múltiplas vezes para garantir correção completa
    for (let iteration = 0; iteration < 5; iteration++) {
        let previous = fixed;
        
        // 1. Corrigir padrão: tag class="..."Conteudo/tag -> <tag class="...">Conteudo</tag>
        // Exemplo: h1 class="ql-align-center"SAudaçao/h1
        tags.forEach(tag => {
            const pattern = new RegExp(`${tag}\\s+class="([^"]+)"([^/<>]+)/${tag}`, 'gi');
            fixed = fixed.replace(pattern, (match, className, text) => {
                return `<${tag} class="${className}">${text.trim()}</${tag}>`;
            });
        });
        
        // 2. Corrigir padrão: tagConteudo/tag -> <tag>Conteudo</tag>
        tags.forEach(tag => {
            const pattern = new RegExp(`${tag}([^/<>]+)/${tag}(?![a-z0-9])`, 'gi');
            fixed = fixed.replace(pattern, (match, text) => {
                if (!text.includes('<') && !text.includes('>')) {
                    return `<${tag}>${text.trim()}</${tag}>`;
                }
                return match;
            });
        });
        
        // 3. Corrigir padrão: class="..."Conteudo (sem tag antes) -> <p class="...">Conteudo</p>
        // Exemplo: class="ql-align-right">oi!
        fixed = fixed.replace(/class="([^"]+)"([^<>/]+?)(?=<|$)/g, (match, className, text) => {
            if (text.trim().length > 0 && !text.trim().startsWith('>')) {
                // Verificar se há tag antes
                const matchPos = fixed.indexOf(match);
                const before = fixed.substring(0, matchPos);
                const tagMatch = before.match(/<([a-z]+)[^>]*$/i);
                const tagName = tagMatch ? tagMatch[1] : 'p';
                return `<${tagName} class="${className}">${text.trim()}</${tagName}>`;
            }
            return match;
        });
        
        // 4. Corrigir padrão: tag class="..."Conteudo (sem fechamento)
        // Exemplo: p class="ql-align-right"tudo bem/
        tags.forEach(tag => {
            const pattern = new RegExp(`${tag}\\s+class="([^"]+)"([^/<>]+?)(?=/${tag}|$)`, 'gi');
            fixed = fixed.replace(pattern, (match, className, text) => {
                if (!text.includes('<') && !text.includes('>')) {
                    return `<${tag} class="${className}">${text.trim()}</${tag}>`;
                }
                return match;
            });
        });
        
        // 5. Corrigir padrão: tagConteudo (sem fechamento no final)
        // Exemplo: pNao!
        tags.forEach(tag => {
            const pattern = new RegExp(`${tag}([^/<>]+?)(?=/${tag}|[a-z]{1,2}[^/]*/${tag}|$)`, 'gi');
            fixed = fixed.replace(pattern, (match, text) => {
                if (!text.includes('<') && !text.includes('>') && text.trim().length > 0) {
                    // Verificar se não é início de outra tag
                    if (!tags.some(t => text.toLowerCase().startsWith(t))) {
                        return `<${tag}>${text.trim()}</${tag}>`;
                    }
                }
                return match;
            });
        });
        
        // Se não houve mudanças, parar
        if (fixed === previous) break;
    }
    
    // Corrigir padrões específicos
    
    // 1. Corrigir listas: olligripe/lilicabeca doi/liligastrite/li/ol
    // Padrão: ol + múltiplos li.../li + /ol
    fixed = fixed.replace(/ol(li[^/]+)\/li(li[^/]+)\/li(li[^/]+)\/li\/ol/gi, 
        (match, li1, li2, li3) => {
            return `<ol><li>${li1.replace(/^li/gi, '').trim()}</li><li>${li2.replace(/^li/gi, '').trim()}</li><li>${li3.replace(/^li/gi, '').trim()}</li></ol>`;
        });
    
    // Padrão genérico: olli.../li/ol (qualquer quantidade de itens)
    fixed = fixed.replace(/ol(li[^/]+(?:\/li(?:li[^/]+))*)\/li\/ol/gi, (match, content) => {
        // Separar por /li e processar cada item
        const parts = content.split(/\/li/gi);
        const items = parts.map(part => {
            const cleaned = part.replace(/^li/gi, '').trim();
            return cleaned ? `<li>${cleaned}</li>` : '';
        }).filter(item => item);
        return `<ol>${items.join('')}</ol>`;
    });
    
    // 2. Corrigir padrão: pbr/p -> <p><br/></p>
    fixed = fixed.replace(/pbr\/p/gi, '<p><br/></p>');
    
    // 3. Corrigir padrão: br/ -> <br/>
    fixed = fixed.replace(/br\//gi, '<br/>');
    
    // 4. Corrigir padrão: /li/ol -> </li></ol>
    fixed = fixed.replace(/\/li\/ol/gi, '</li></ol>');
    
    // 5. Corrigir padrão: /li -> </li> (quando não está dentro de tag)
    fixed = fixed.replace(/([^<])\/li([^>])/gi, '$1</li>$2');
    
    // 6. Corrigir padrão: class="..."br -> class="..."><br/>
    fixed = fixed.replace(/class="([^"]+)"br/gi, 'class="$1"><br/>');
    
    // 7. Corrigir padrão: class="...">br -> class="..."><br/>
    fixed = fixed.replace(/class="([^"]+)">br/gi, 'class="$1"><br/>');
    
    // 8. Corrigir padrão: class="...">br' -> class="..."><br/>
    fixed = fixed.replace(/class="([^"]+)">br'/gi, 'class="$1"><br/>');
    
    // Se ainda não tem tags, envolver em parágrafo
    if (!fixed.includes('<') && !fixed.includes('>')) {
        if (fixed.includes('\n')) {
            fixed = fixed.split(/\r?\n/).filter(l => l.trim()).map(l => `<p>${l.trim()}</p>`).join('');
        } else {
            fixed = `<p>${fixed}</p>`;
        }
    }
    
    return fixed;
}

// Função para limpar caracteres estranhos e normalizar HTML
function cleanHtmlContent(html) {
    if (!html) return '';
    
    let cleaned = html;
    
    // Remover caracteres estranhos
    cleaned = cleaned.replace(/<<+</g, '');
    cleaned = cleaned.replace(/>+>/g, '');
    cleaned = cleaned.replace(/\s*>\s*>\s*/g, ' ');
    cleaned = cleaned.replace(/^\s*>\s*/g, '');
    cleaned = cleaned.replace(/\s*>\s*$/g, '');
    
    // Corrigir classes quebradas: class="..."texto -> class="...">texto
    cleaned = cleaned.replace(/class="([^"]+)"([^<>"']+?)(?=<|$)/g, (match, className, text) => {
        if (text.trim().length > 0 && !text.trim().startsWith('>')) {
            const matchPos = cleaned.indexOf(match);
            const before = cleaned.substring(0, matchPos);
            const tagMatch = before.match(/<([a-z]+)[^>]*$/i);
            const tagName = tagMatch ? tagMatch[1] : 'p';
            return `class="${className}">${text.trim()}</${tagName}>`;
        }
        return match;
    });
    
    // Normalizar espaços
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/>\s+</g, '><');
    cleaned = cleaned.trim();
    
    // Validar usando DOM
    try {
        const temp = document.createElement('div');
        temp.innerHTML = cleaned;
        cleaned = temp.innerHTML;
    } catch (e) {
        console.warn('Erro ao validar HTML:', e);
    }
    
    return cleaned;
}

// Função para sanitizar HTML (remover scripts e elementos perigosos)
function sanitizeHtml(html) {
    if (!html) return '';
    
    try {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remover scripts e estilos
        const scripts = temp.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Remover event handlers
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
            Array.from(el.attributes).forEach(attr => {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            });
        });
        
        return temp.innerHTML;
    } catch (e) {
        console.warn('Erro ao sanitizar HTML:', e);
        return html;
    }
}

// Função para processar e renderizar conteúdo do blog
function processBlogContent(content, targetElement) {
    if (!content || !targetElement) return;
    
    // Corrigir conteúdo
    let fixed = fixBlogContent(content);
    
    // Sanitizar HTML
    fixed = sanitizeHtml(fixed);
    
    // Inserir no elemento
    try {
        const temp = document.createElement('div');
        temp.innerHTML = fixed;
        
        // Limpar nós de texto problemáticos que contêm classes quebradas
        const walker = document.createTreeWalker(
            temp,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent;
            if (text.match(/class="[^"]+"/) && !text.includes('>')) {
                textNodes.push(node);
            }
        }
        
        // Corrigir nós de texto com classes quebradas
        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const fixedText = text.replace(/class="([^"]+)"([^<>]+?)(?=<|$)/g, (match, className, restText) => {
                const parent = textNode.parentElement;
                const tagName = parent?.tagName?.toLowerCase() || 'p';
                const newEl = document.createElement(tagName);
                newEl.className = className;
                newEl.textContent = restText;
                return newEl.outerHTML;
            });
            
            if (fixedText !== text && fixedText.includes('<')) {
                const parent = textNode.parentElement;
                if (parent) {
                    const tempFix = document.createElement('div');
                    tempFix.innerHTML = fixedText;
                    while (tempFix.firstChild) {
                        parent.insertBefore(tempFix.firstChild, textNode);
                    }
                    parent.removeChild(textNode);
                }
            }
        });
        
        targetElement.innerHTML = temp.innerHTML;
        
        // Processar imagens
        const images = targetElement.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('alt')) {
                img.setAttribute('alt', 'Imagem do post');
            }
            img.setAttribute('loading', 'lazy');
        });
        
        // Processar links
        const links = targetElement.querySelectorAll('a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
        
    } catch (e) {
        console.error('Erro ao processar conteúdo:', e);
        targetElement.innerHTML = fixed;
    }
}

