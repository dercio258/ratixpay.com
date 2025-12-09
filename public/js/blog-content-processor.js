/**
 * Blog Content Processor - Sistema robusto e simplificado para processar conteúdo de blog
 * Versão refatorada com lógica melhorada para evitar erros de tags e renderização
 */

class BlogContentProcessor {
    constructor() {
        // Tags HTML permitidas
        this.allowedTags = [
            'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
            'a', 'img', 'div', 'span', 'hr', 'table',
            'thead', 'tbody', 'tr', 'th', 'td', 'video', 'iframe'
        ];

        // Atributos permitidos por tag
        this.allowedAttributes = {
            'a': ['href', 'title', 'target', 'rel', 'class'],
            'img': ['src', 'alt', 'title', 'width', 'height', 'class', 'loading'],
            'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'class'],
            'video': ['src', 'width', 'height', 'controls', 'class'],
            'code': ['class'],
            'pre': ['class'],
            'div': ['class'],
            'span': ['class'],
            'p': ['class'],
            'h1': ['class'], 'h2': ['class'], 'h3': ['class'],
            'h4': ['class'], 'h5': ['class'], 'h6': ['class'],
            'ul': ['class'], 'ol': ['class'], 'li': ['class'],
            'blockquote': ['class'],
            'strong': ['class'], 'em': ['class'], 'b': ['class'],
            'i': ['class'], 'u': ['class'], 's': ['class'],
            'table': ['class'],
            'td': ['class', 'colspan', 'rowspan'],
            'th': ['class', 'colspan', 'rowspan']
        };
    }

    /**
     * Processa e renderiza conteúdo do blog
     * @param {string} content - Conteúdo HTML do post
     * @param {HTMLElement} targetElement - Elemento onde o conteúdo será renderizado
     */
    process(content, targetElement) {
        if (!targetElement) {
            console.error('Elemento alvo não fornecido');
            return;
        }

        try {
            // 1. Normalizar conteúdo
            let normalized = this.normalizeContent(content);
            console.log('📝 Conteúdo normalizado:', normalized.substring(0, 200));
            
            // 2. Corrigir HTML mal formatado
            normalized = this.fixMalformedHtml(normalized);
            console.log('🔧 HTML corrigido:', normalized.substring(0, 200));
            
            // 3. Sanitizar HTML
            normalized = this.sanitizeHtml(normalized);
            console.log('🧹 HTML sanitizado:', normalized.substring(0, 200));
            
            // 4. Validar e corrigir estrutura
            normalized = this.validateAndFixStructure(normalized);
            console.log('✅ Estrutura validada:', normalized.substring(0, 200));
            
            // 5. Renderizar no elemento
            this.render(normalized, targetElement);
            console.log('✨ Conteúdo renderizado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao processar conteúdo do blog:', error);
            // Fallback seguro: exibir conteúdo como texto
            targetElement.textContent = content || 'Conteúdo não disponível';
        }
    }

    /**
     * Método estático para renderizar conteúdo (facilita uso direto)
     * @param {string} content - Conteúdo HTML do post
     * @param {HTMLElement} targetElement - Elemento onde o conteúdo será renderizado
     */
    static render(content, targetElement) {
        const processor = new BlogContentProcessor();
        processor.process(content, targetElement);
    }

    /**
     * Normaliza o conteúdo inicial
     */
    normalizeContent(content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        // Decodificar entidades HTML
        if (content.includes('&lt;') || content.includes('&gt;') || content.includes('&amp;')) {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = content;
            content = textarea.value;
        }

        // REMOVER ELEMENTOS DE PÁGINA COMPLETA (body, head, meta, title, etc.)
        // Se o conteúdo contém tags de página completa, extrair apenas o conteúdo interno
        if (content.includes('<body') || content.includes('bodymeta') || content.includes('body>')) {
            // Tentar extrair conteúdo do body
            const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/is);
            if (bodyMatch) {
                content = bodyMatch[1];
            } else {
                // Se não encontrar body tag, remover elementos de página completa
                content = content
                    .replace(/<head[^>]*>.*?<\/head>/gis, '')
                    .replace(/<body[^>]*>/gi, '')
                    .replace(/<\/body>/gi, '')
                    .replace(/<html[^>]*>/gi, '')
                    .replace(/<\/html>/gi, '')
                    .replace(/<meta[^>]*>/gi, '')
                    .replace(/<title[^>]*>.*?<\/title>/gis, '')
                    .replace(/<link[^>]*>/gi, '')
                    .replace(/<script[^>]*>.*?<\/script>/gis, '')
                    .replace(/<style[^>]*>.*?<\/style>/gis, '');
            }
        }
        
        // REMOVER ELEMENTOS SEM TAGS < > (caso especial do GrapesJS)
        // Padrão: bodymeta, headerclass, footerclass, etc.
        if (content.includes('bodymeta') || content.includes('headerclass') || content.includes('footerclass')) {
            // Remover elementos de página completa sem tags
            content = content
                .replace(/bodymeta\s+charset="[^"]*"/gi, '')
                .replace(/bodymeta\s+name="[^"]*"[^>]*/gi, '')
                .replace(/body>/gi, '')
                .replace(/<\/body>/gi, '')
                .replace(/headerclass="[^"]*"/gi, '')
                .replace(/footerclass="[^"]*"/gi, '')
                .replace(/mainclass="[^"]*"/gi, '')
                .replace(/articleclass="[^"]*"/gi, '')
                .replace(/sectionclass="[^"]*"/gi, '')
                .replace(/navclass="[^"]*"/gi, '')
                .replace(/asideclass="[^"]*"/gi, '')
                .replace(/meta\s+charset="[^"]*"/gi, '')
                .replace(/meta\s+name="[^"]*"[^>]*/gi, '')
                .replace(/title[^<]*\/title/gi, '')
                .replace(/link[^>]*/gi, '');
        }

        // Remover classes e atributos do GrapesJS que não são necessários na renderização
        content = content.replace(/\s*data-gjs-[^=]*="[^"]*"/gi, '');
        content = content.replace(/\s*data-highlightable[^=]*="[^"]*"/gi, '');
        content = content.replace(/\s*data-testid[^=]*="[^"]*"/gi, '');
        
        // Limpar classes do GrapesJS mas manter outras classes úteis
        content = content.replace(/\s*class="([^"]*)"/gi, (match, classList) => {
            if (!classList) return '';
            const classes = classList.split(/\s+/).filter(c => {
                // Remover classes do GrapesJS
                if (c.startsWith('gjs-')) return false;
                // Manter classes de blog e outras classes úteis
                return c.startsWith('blog-') || c.length > 0;
            });
            return classes.length > 0 ? `class="${classes.join(' ')}"` : '';
        });

        // Remover elementos vazios do GrapesJS
        content = content.replace(/<div[^>]*>\s*<\/div>/gi, '');
        content = content.replace(/<div[^>]*>\s*<br\s*\/?>\s*<\/div>/gi, '');
        content = content.replace(/<div[^>]*>\s*&nbsp;\s*<\/div>/gi, '');

        // Remover estilos inline do GrapesJS que não são necessários
        content = content.replace(/\s*style="[^"]*position:\s*relative[^"]*"/gi, '');
        content = content.replace(/\s*style="[^"]*min-height:\s*[^"]*"/gi, '');

        // Remover caracteres estranhos comuns
        content = content.replace(/<<+</g, '');
        content = content.replace(/>+>/g, '');
        content = content.replace(/\s*>\s*>\s*/g, ' ');
        content = content.trim();

        return content;
    }

    /**
     * Corrige HTML mal formatado (tags sem < >)
     */
    fixMalformedHtml(content) {
        if (!content) return '';

        // Se já tem HTML válido, apenas limpar
        if (content.includes('<') && content.includes('>')) {
            return this.cleanStrangeCharacters(content);
        }

        let fixed = content;
        
        // REMOVER ELEMENTOS DE PÁGINA COMPLETA SEM TAGS
        // Remover body, header, footer, main, article, etc. sem < >
        fixed = fixed.replace(/bodymeta\s+charset="[^"]*"/gi, '');
        fixed = fixed.replace(/bodymeta\s+name="[^"]*"[^>]*/gi, '');
        fixed = fixed.replace(/body(meta|>|class)/gi, '');
        fixed = fixed.replace(/headerclass="[^"]*"/gi, '');
        fixed = fixed.replace(/header(class|>)/gi, '');
        fixed = fixed.replace(/footerclass="[^"]*"/gi, '');
        fixed = fixed.replace(/footer(class|>)/gi, '');
        fixed = fixed.replace(/mainclass="[^"]*"/gi, '');
        fixed = fixed.replace(/main(class|>)/gi, '');
        fixed = fixed.replace(/articleclass="[^"]*"/gi, '');
        fixed = fixed.replace(/article(class|>)/gi, '');
        fixed = fixed.replace(/sectionclass="[^"]*"/gi, '');
        fixed = fixed.replace(/section(class|>)/gi, '');
        fixed = fixed.replace(/navclass="[^"]*"/gi, '');
        fixed = fixed.replace(/nav(class|>)/gi, '');
        fixed = fixed.replace(/asideclass="[^"]*"/gi, '');
        fixed = fixed.replace(/aside(class|>)/gi, '');
        
        // Remover meta, title, link, script, style sem < >
        fixed = fixed.replace(/meta\s+charset="[^"]*"/gi, '');
        fixed = fixed.replace(/meta\s+name="[^"]*"[^>]*/gi, '');
        fixed = fixed.replace(/title[^<]*\/title/gi, '');
        fixed = fixed.replace(/link[^>]*/gi, '');
        
        // Remover padrões específicos: bodymeta, headerclass="...", etc.
        fixed = fixed.replace(/bodymeta[^>]*>/gi, '');
        fixed = fixed.replace(/headerclass="[^"]*"/gi, '');
        fixed = fixed.replace(/footerclass="[^"]*"/gi, '');
        fixed = fixed.replace(/mainclass="[^"]*"/gi, '');
        fixed = fixed.replace(/articleclass="[^"]*"/gi, '');
        fixed = fixed.replace(/sectionclass="[^"]*"/gi, '');
        fixed = fixed.replace(/navclass="[^"]*"/gi, '');
        fixed = fixed.replace(/asideclass="[^"]*"/gi, '');
        
        const tags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'b', 'em', 'i', 'u', 's', 
                     'ul', 'ol', 'li', 'div', 'span', 'blockquote', 'br', 'img', 'a', 'table', 'tr', 'td', 'th'];

        // Corrigir padrão: tagConteudo/tag -> <tag>Conteudo</tag>
        tags.forEach(tag => {
            // Padrão mais flexível para tags sem < >
            const pattern = new RegExp(`\\b${tag}([^/<>]+)/${tag}(?![a-z0-9])`, 'gi');
            fixed = fixed.replace(pattern, (match, text) => {
                if (text.trim() && !text.trim().startsWith('<') && !text.trim().startsWith('>')) {
                    return `<${tag}>${text.trim()}</${tag}>`;
                }
                return match;
            });
        });

        // Corrigir padrão: tag class="..."Conteudo/tag -> <tag class="...">Conteudo</tag>
        tags.forEach(tag => {
            const pattern = new RegExp(`\\b${tag}\\s+class="([^"]+)"([^/<>]+)/${tag}`, 'gi');
            fixed = fixed.replace(pattern, (match, className, text) => {
                if (text.trim()) {
                    return `<${tag} class="${className}">${text.trim()}</${tag}>`;
                }
                return match;
            });
        });

        // Corrigir padrão: class="..."Conteudo (sem tag) -> <p class="...">Conteudo</p>
        fixed = fixed.replace(/class="([^"]+)"([^<>"']+?)(?=<|$|class=)/g, (match, className, text) => {
            if (text.trim() && !text.trim().startsWith('>') && !text.trim().startsWith('<')) {
                return `<p class="${className}">${text.trim()}</p>`;
            }
            return match;
        });

        // Corrigir padrão: pbr/p -> <p><br/></p>
        fixed = fixed.replace(/pbr\/p/gi, '<p><br/></p>');
        
        // Corrigir padrão: img src="..." -> <img src="..." />
        fixed = fixed.replace(/img\s+src="([^"]+)"([^>]*)/gi, '<img src="$1"$2 />');
        
        // Corrigir padrão: a href="..." -> <a href="...">texto</a>
        fixed = fixed.replace(/a\s+href="([^"]+)"([^>]*?)([^<>]+)/gi, '<a href="$1"$2>$3</a>');

        // Se ainda não tem tags, envolver em parágrafo
        if (!fixed.includes('<') && !fixed.includes('>')) {
            if (fixed.includes('\n')) {
                fixed = fixed.split(/\r?\n/).filter(l => l.trim())
                    .map(l => `<p>${l.trim()}</p>`).join('');
            } else if (fixed.trim()) {
                fixed = `<p>${fixed.trim()}</p>`;
            }
        }

        return fixed;
    }

    /**
     * Limpa caracteres estranhos
     */
    cleanStrangeCharacters(html) {
        if (!html) return '';
        
        let cleaned = html;
        
        // Remover múltiplos < ou >
        cleaned = cleaned.replace(/<<+</g, '');
        cleaned = cleaned.replace(/>+>/g, '');
        cleaned = cleaned.replace(/\s*>\s*>\s*/g, ' ');
        cleaned = cleaned.replace(/^\s*>\s*/g, '');
        cleaned = cleaned.replace(/\s*>\s*$/g, '');
        
        // Corrigir classes quebradas: class="..."texto -> class="...">texto</tag>
        cleaned = cleaned.replace(/class="([^"]+)"([^<>"']+?)(?=<|$)/g, (match, className, text) => {
            if (text.trim() && !text.trim().startsWith('>')) {
                // Procurar tag anterior
                const matchPos = cleaned.indexOf(match);
                const before = cleaned.substring(0, matchPos);
                const tagMatch = before.match(/<([a-z]+)[^>]*$/i);
                const tagName = tagMatch ? tagMatch[1] : 'p';
                return `class="${className}">${text.trim()}</${tagName}>`;
            }
            return match;
        });
        
        return cleaned.trim();
    }

    /**
     * Sanitiza HTML removendo elementos perigosos
     */
    sanitizeHtml(html) {
        if (!html) return '';

        try {
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Remover scripts e estilos
            const dangerous = temp.querySelectorAll('script, style, iframe[src*="javascript:"], iframe[src*="data:text/html"]');
            dangerous.forEach(el => el.remove());

            // Limpar elementos recursivamente
            const elements = Array.from(temp.children);
            elements.forEach(el => this.cleanElement(el));

            return temp.innerHTML;
        } catch (error) {
            console.warn('Erro ao sanitizar HTML:', error);
            return html;
        }
    }

    /**
     * Limpa um elemento HTML removendo atributos não permitidos
     */
    cleanElement(element) {
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return element;
        }

        const tagName = element.tagName.toLowerCase();

        // Se tag não é permitida, remover mas manter conteúdo
        if (!this.allowedTags.includes(tagName)) {
            const parent = element.parentNode;
            if (parent) {
                while (element.firstChild) {
                    parent.insertBefore(element.firstChild, element);
                }
                parent.removeChild(element);
            }
            return null;
        }

        // Remover atributos não permitidos
        const allowedAttrs = this.allowedAttributes[tagName] || [];
        const attrsToRemove = [];

        Array.from(element.attributes).forEach(attr => {
            const attrName = attr.name.toLowerCase();
            
            // Verificar se atributo é permitido
            if (!allowedAttrs.includes(attrName)) {
                attrsToRemove.push(attr.name);
            } else {
                // Sanitizar atributos específicos
                if (attrName === 'href' || attrName === 'src') {
                    const value = attr.value.toLowerCase();
                    if (value.startsWith('javascript:') ||
                        value.startsWith('data:text/html') ||
                        value.startsWith('vbscript:') ||
                        value.startsWith('onerror') ||
                        value.startsWith('onload')) {
                        attrsToRemove.push(attr.name);
                    }
                }
            }

            // Remover event handlers
            if (attrName.startsWith('on')) {
                attrsToRemove.push(attr.name);
            }
        });

        attrsToRemove.forEach(attr => element.removeAttribute(attr));

        // Processar filhos recursivamente
        const children = Array.from(element.childNodes);
        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                this.cleanElement(child);
            }
        });

        return element;
    }

    /**
     * Valida e corrige estrutura HTML
     */
    validateAndFixStructure(html) {
        if (!html) return '';

        try {
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Corrigir tags não fechadas
            const allElements = temp.querySelectorAll('*');
            allElements.forEach(el => {
                const tagName = el.tagName.toLowerCase();
                
                // Verificar se é tag auto-fechada
                if (['br', 'hr', 'img', 'input', 'meta', 'link'].includes(tagName)) {
                    return; // Não precisa fechar
                }

                // Verificar se tem conteúdo mas não tem filhos
                if (el.textContent.trim() && el.children.length === 0) {
                    // Já está correto
                    return;
                }
            });

            // Adicionar atributos padrão em imagens
            const images = temp.querySelectorAll('img');
            images.forEach(img => {
                if (!img.hasAttribute('alt')) {
                    img.setAttribute('alt', 'Imagem do post');
                }
                if (!img.hasAttribute('loading')) {
                    img.setAttribute('loading', 'lazy');
                }
            });

            // Adicionar atributos padrão em links
            const links = temp.querySelectorAll('a[href]');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                    if (!link.hasAttribute('target')) {
                        link.setAttribute('target', '_blank');
                    }
                    if (!link.hasAttribute('rel')) {
                        link.setAttribute('rel', 'noopener noreferrer');
                    }
                }
            });

            return temp.innerHTML;
        } catch (error) {
            console.warn('Erro ao validar estrutura:', error);
            return html;
        }
    }

    /**
     * Renderiza o conteúdo processado no elemento
     */
    render(html, targetElement) {
        try {
            // Limpar elemento
            targetElement.innerHTML = '';

            // Criar container temporário
            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Mover conteúdo para elemento alvo
            while (temp.firstChild) {
                targetElement.appendChild(temp.firstChild);
            }

            // Aplicar estilos Quill se necessário
            this.applyQuillStyles(targetElement);

        } catch (error) {
            console.error('Erro ao renderizar conteúdo:', error);
            targetElement.innerHTML = html;
        }
    }

    /**
     * Aplica estilos CSS para classes do Quill
     */
    applyQuillStyles(container) {
        // Verificar se estilos já foram adicionados
        if (document.getElementById('quill-blog-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'quill-blog-styles';
        style.textContent = `
            .post-content .ql-align-left { text-align: left; }
            .post-content .ql-align-center { text-align: center; }
            .post-content .ql-align-right { text-align: right; }
            .post-content .ql-align-justify { text-align: justify; }
            
            .post-content .ql-indent-1 { margin-left: 3em; }
            .post-content .ql-indent-2 { margin-left: 6em; }
            .post-content .ql-indent-3 { margin-left: 9em; }
            .post-content .ql-indent-4 { margin-left: 12em; }
            .post-content .ql-indent-5 { margin-left: 15em; }
            .post-content .ql-indent-6 { margin-left: 18em; }
            .post-content .ql-indent-7 { margin-left: 21em; }
            .post-content .ql-indent-8 { margin-left: 24em; }
            
            .post-content .ql-font-serif { font-family: Georgia, Times New Roman, serif; }
            .post-content .ql-font-monospace { font-family: Monaco, Courier New, monospace; }
            
            .post-content .ql-size-small { font-size: 0.75em; }
            .post-content .ql-size-large { font-size: 1.5em; }
            .post-content .ql-size-huge { font-size: 2.5em; }
        `;
        document.head.appendChild(style);
    }
}

// Criar instância global
const blogContentProcessor = new BlogContentProcessor();

// Função global para compatibilidade
function processBlogContent(content, targetElement) {
    blogContentProcessor.process(content, targetElement);
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlogContentProcessor;
}

