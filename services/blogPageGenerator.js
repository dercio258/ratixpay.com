/**
 * Serviço para gerar páginas HTML dinâmicas de posts do blog
 */

const fs = require('fs').promises;
const path = require('path');

class BlogPageGenerator {
    
    /**
     * Gerar página HTML para um post
     */
    static async gerarPaginaPost(post) {
        try {
            const publicDir = path.join(__dirname, '..', 'public');
            const postsDir = path.join(publicDir, 'blog-posts');
            
            // Criar diretório se não existir
            try {
                await fs.mkdir(postsDir, { recursive: true });
            } catch (error) {
                // Diretório já existe ou erro ao criar
            }
            
            // Nome do arquivo baseado no slug
            const fileName = `${post.slug}.html`;
            const filePath = path.join(postsDir, fileName);
            
            // Gerar HTML
            const html = this.gerarHTMLPost(post);
            
            // Salvar arquivo
            await fs.writeFile(filePath, html, 'utf8');
            
            console.log(`✅ Página gerada: ${fileName}`);
            
            return {
                success: true,
                filePath: `/blog-posts/${fileName}`,
                fileName: fileName
            };
        } catch (error) {
            console.error('❌ Erro ao gerar página do post:', error);
            throw error;
        }
    }
    
    /**
     * Gerar HTML completo do post
     */
    static gerarHTMLPost(post) {
        const baseUrl = process.env.BASE_URL || 'https://ratixpay.site';
        const postUrl = `${baseUrl}/blog-posts/${post.slug}.html`;
        
        // Formatar data
        const dataPublicacao = post.published_at 
            ? new Date(post.published_at).toLocaleDateString('pt-BR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : 'Data não informada';
        
        // Tags HTML
        const tagsHTML = post.tags && post.tags.length > 0
            ? post.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';
        
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(post.title)} - RatixPay Blog</title>
    ${post.meta_description ? `<meta name="description" content="${this.escapeHtml(post.meta_description)}">` : ''}
    ${post.meta_keywords ? `<meta name="keywords" content="${this.escapeHtml(post.meta_keywords)}">` : ''}
    
    <!-- Open Graph -->
    <meta property="og:title" content="${this.escapeHtml(post.title)}">
    <meta property="og:description" content="${this.escapeHtml(post.subtitle || post.meta_description || '')}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${postUrl}">
    ${post.image ? `<meta property="og:image" content="${post.image}">` : ''}
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${this.escapeHtml(post.title)}">
    <meta name="twitter:description" content="${this.escapeHtml(post.subtitle || post.meta_description || '')}">
    ${post.image ? `<meta name="twitter:image" content="${post.image}">` : ''}
    
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <script src="/js/dark-mode-manager.js"></script>
    <script src="/js/blog-content-processor.js"></script>
    <style>
        :root {
            --primary: #F64C00;
            --primary-dark: #e55a00;
            --secondary: #10b981;
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --text-light: #9ca3af;
            --bg-primary: #ffffff;
            --bg-secondary: #f9fafb;
            --bg-tertiary: #f3f4f6;
            --border-color: #e5e7eb;
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }

        body.dark-mode {
            --text-primary: #f3f4f6;
            --text-secondary: #d1d5db;
            --text-light: #9ca3af;
            --bg-primary: #111827;
            --bg-secondary: #1f2937;
            --bg-tertiary: #374151;
            --border-color: #4b5563;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.7;
            font-size: 16px;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
            color: white;
            padding: 40px 20px;
            text-align: center;
            box-shadow: var(--shadow-lg);
        }

        .header a {
            color: white;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 20px;
            opacity: 0.9;
            transition: opacity 0.2s;
        }

        .header a:hover {
            opacity: 1;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .post-header {
            margin-bottom: 40px;
        }

        .post-category {
            display: inline-block;
            padding: 8px 16px;
            background: var(--bg-tertiary);
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--primary);
            margin-bottom: 16px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .post-title {
            font-size: 2.5rem;
            font-weight: 800;
            line-height: 1.2;
            margin-bottom: 16px;
            color: var(--text-primary);
        }

        .post-subtitle {
            font-size: 1.3rem;
            color: var(--text-secondary);
            margin-bottom: 24px;
            font-weight: 400;
        }

        .post-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: center;
            color: var(--text-light);
            font-size: 0.9rem;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--border-color);
        }

        .post-meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .post-image {
            width: 100%;
            max-height: 500px;
            object-fit: cover;
            border-radius: 12px;
            margin-bottom: 40px;
            box-shadow: var(--shadow-md);
        }

        .post-content {
            font-size: 1.1rem;
            line-height: 1.9;
            color: var(--text-primary);
        }

        .post-content h1, .post-content h2, .post-content h3 {
            margin-top: 40px;
            margin-bottom: 20px;
            color: var(--text-primary);
        }

        .post-content h1 {
            font-size: 2rem;
        }

        .post-content h2 {
            font-size: 1.75rem;
        }

        .post-content h3 {
            font-size: 1.5rem;
        }

        .post-content p {
            margin-bottom: 20px;
        }

        .post-content img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 30px 0;
        }

        .post-content a {
            color: var(--primary);
            text-decoration: none;
            border-bottom: 2px solid transparent;
            transition: border-color 0.2s;
        }

        .post-content a:hover {
            border-bottom-color: var(--primary);
        }

        .post-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px solid var(--border-color);
        }

        .tag {
            padding: 6px 14px;
            background: var(--bg-tertiary);
            border-radius: 20px;
            font-size: 0.85rem;
            color: var(--text-secondary);
        }

        @media (max-width: 768px) {
            .post-title {
                font-size: 2rem;
            }

            .post-subtitle {
                font-size: 1.1rem;
            }

            .container {
                padding: 20px 15px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <a href="/blog.html">
            <i class="fas fa-arrow-left"></i>
            Voltar ao Blog
        </a>
        <h1>RatixPay Blog</h1>
    </div>

    <div class="container">
        <article class="post-header">
            ${post.category ? `<span class="post-category">${this.escapeHtml(post.category)}</span>` : ''}
            <h1 class="post-title">${this.escapeHtml(post.title)}</h1>
            ${post.subtitle ? `<p class="post-subtitle">${this.escapeHtml(post.subtitle)}</p>` : ''}
            
            <div class="post-meta">
                <div class="post-meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${dataPublicacao}</span>
                </div>
                ${post.author ? `
                <div class="post-meta-item">
                    <i class="fas fa-user"></i>
                    <span>${this.escapeHtml(post.author.nome_completo || 'Admin')}</span>
                </div>
                ` : ''}
                ${post.views !== undefined ? `
                <div class="post-meta-item">
                    <i class="fas fa-eye"></i>
                    <span>${post.views} visualizações</span>
                </div>
                ` : ''}
            </div>
        </article>

        ${post.image ? `<img src="${post.image}" alt="${this.escapeHtml(post.title)}" class="post-image">` : ''}

        <div class="post-content" id="postContent">
            ${post.content}
        </div>

        ${tagsHTML ? `<div class="post-tags">${tagsHTML}</div>` : ''}
    </div>

    <script>
        // Processar conteúdo do blog
        if (typeof processBlogContent === 'function') {
            document.addEventListener('DOMContentLoaded', () => {
                processBlogContent();
            });
        }
    </script>
</body>
</html>`;
    }
    
    /**
     * Escapar HTML para prevenir XSS
     */
    static escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }
    
    /**
     * Deletar página de post
     */
    static async deletarPaginaPost(slug) {
        try {
            const publicDir = path.join(__dirname, '..', 'public');
            const postsDir = path.join(publicDir, 'blog-posts');
            const fileName = `${slug}.html`;
            const filePath = path.join(postsDir, fileName);
            
            try {
                await fs.unlink(filePath);
                console.log(`✅ Página deletada: ${fileName}`);
                return { success: true };
            } catch (error) {
                if (error.code === 'ENOENT') {
                    // Arquivo não existe, não é erro
                    return { success: true };
                }
                throw error;
            }
        } catch (error) {
            console.error('❌ Erro ao deletar página do post:', error);
            throw error;
        }
    }
}

module.exports = BlogPageGenerator;

