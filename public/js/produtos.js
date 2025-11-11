// Produtos simulados para demonstração da plataforma RatixPay
const produtosSimulados = [
    {
        id: '1',
        name: 'Curso de Marketing Digital',
        type: 'curso',
        category: 'marketing',
        description: 'Aprenda as melhores estratégias de marketing digital para alavancar seu negócio online. Curso completo com módulos práticos e cases reais.',
        price: 297.00,
        discount: 10,
        finalPrice: 267.30,
        couponCode: 'MARKETING10',
        allowAffiliates: true,
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMDA3YmZmIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5NYXJrZXRpbmc8L3RleHQ+PC9zdmc+',
        content: {
            modules: [
                {
                    name: 'Fundamentos do Marketing Digital',
                    description: 'Conceitos básicos e estratégias fundamentais',
                    lessons: ['Introdução ao Marketing Digital', 'Personas e Público-Alvo', 'Funil de Vendas']
                },
                {
                    name: 'Redes Sociais',
                    description: 'Como usar as redes sociais para marketing',
                    lessons: ['Facebook Ads', 'Instagram Marketing', 'LinkedIn para Negócios']
                },
                {
                    name: 'SEO e Conteúdo',
                    description: 'Otimização para mecanismos de busca',
                    lessons: ['SEO Básico', 'Marketing de Conteúdo', 'Google Analytics']
                }
            ]
        },
        createdAt: '2024-01-15T10:30:00Z'
    },
    {
        id: '2',
        name: 'eBook: Finanças Pessoais',
        type: 'ebook',
        category: 'financas',
        description: 'Guia completo para organizar suas finanças pessoais, eliminar dívidas e construir patrimônio. Métodos práticos e planilhas incluídas.',
        price: 47.00,
        discount: 0,
        finalPrice: 47.00,
        couponCode: '',
        allowAffiliates: false,
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjhjM2U1MCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+RmluYW7Dp2FzPC90ZXh0Pjwvc3ZnPg==',
        content: {
            pdfFile: 'financas-pessoais.pdf'
        },
        createdAt: '2024-01-10T14:20:00Z'
    },
    {
        id: '3',
        name: 'Curso de Programação Web',
        type: 'curso',
        category: 'programacao',
        description: 'Aprenda a criar sites e aplicações web do zero. HTML, CSS, JavaScript e frameworks modernos. Projetos práticos incluídos.',
        price: 497.00,
        discount: 20,
        finalPrice: 397.60,
        couponCode: 'PROG20',
        allowAffiliates: true,
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzQzYTQwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qcm9ncmFtYcOnw6NvPC90ZXh0Pjwvc3ZnPg==',
        content: {
            modules: [
                {
                    name: 'HTML e CSS',
                    description: 'Estrutura e estilização de páginas web',
                    lessons: ['HTML Básico', 'CSS Fundamentals', 'Flexbox e Grid', 'Responsividade']
                },
                {
                    name: 'JavaScript',
                    description: 'Programação interativa para web',
                    lessons: ['JavaScript Básico', 'DOM Manipulation', 'APIs e AJAX', 'ES6+']
                },
                {
                    name: 'Frameworks',
                    description: 'React e outras tecnologias modernas',
                    lessons: ['Introdução ao React', 'Components e Props', 'State Management', 'Projeto Final']
                }
            ]
        },
        createdAt: '2024-01-08T09:15:00Z'
    },
    {
        id: '4',
        name: 'eBook: Receitas Saudáveis',
        type: 'ebook',
        category: 'saude',
        description: 'Coletânea de 50 receitas saudáveis e nutritivas para uma alimentação equilibrada. Inclui dicas de nutrição e planejamento de refeições.',
        price: 27.00,
        discount: 0,
        finalPrice: 27.00,
        couponCode: '',
        allowAffiliates: true,
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjdhZTYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5SZWNlaXRhczwvdGV4dD48L3N2Zz4=',
        content: {
            pdfFile: 'receitas-saudaveis.pdf'
        },
        createdAt: '2024-01-12T16:45:00Z'
    },
    {
        id: '5',
        name: 'Curso de Design Gráfico',
        type: 'curso',
        category: 'design',
        description: 'Domine as ferramentas e técnicas de design gráfico. Photoshop, Illustrator, teoria das cores e projetos práticos.',
        price: 397.00,
        discount: 15,
        finalPrice: 337.45,
        couponCode: 'DESIGN15',
        allowAffiliates: true,
        image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTc0YzNjIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5EZXNpZ248L3RleHQ+PC9zdmc+',
        content: {
            modules: [
                {
                    name: 'Fundamentos do Design',
                    description: 'Teoria das cores, tipografia e composição',
                    lessons: ['Teoria das Cores', 'Tipografia', 'Composição Visual', 'Psicologia das Cores']
                },
                {
                    name: 'Adobe Photoshop',
                    description: 'Edição e manipulação de imagens',
                    lessons: ['Interface do Photoshop', 'Ferramentas Básicas', 'Layers e Máscaras', 'Efeitos e Filtros']
                },
                {
                    name: 'Adobe Illustrator',
                    description: 'Criação de vetores e logotipos',
                    lessons: ['Introdução ao Illustrator', 'Ferramentas de Vetor', 'Criação de Logotipos', 'Projeto Final']
                }
            ]
        },
        createdAt: '2024-01-05T11:30:00Z'
    }
];

// Função para inicializar produtos simulados no localStorage
function inicializarProdutosSimulados() {
    const produtosExistentes = localStorage.getItem('ratixpay_products');
    
    if (!produtosExistentes) {
        localStorage.setItem('ratixpay_products', JSON.stringify(produtosSimulados));
        console.log('Produtos simulados inicializados no localStorage');
    }
}

// Função para obter todos os produtos
function obterTodosProdutos() {
    const produtos = localStorage.getItem('ratixpay_products');
    return produtos ? JSON.parse(produtos) : produtosSimulados;
}

// Função para obter produto por ID
function obterProdutoPorId(id) {
    const produtos = obterTodosProdutos();
    return produtos.find(produto => produto.id === id);
}

// Função para adicionar novo produto
function adicionarProduto(produto) {
    const produtos = obterTodosProdutos();
    produto.id = Date.now().toString();
    produto.createdAt = new Date().toISOString();
    produtos.push(produto);
    localStorage.setItem('ratixpay_products', JSON.stringify(produtos));
    return produto;
}

// Função para atualizar produto
function atualizarProduto(id, dadosAtualizados) {
    const produtos = obterTodosProdutos();
    const index = produtos.findIndex(produto => produto.id === id);
    
    if (index !== -1) {
        produtos[index] = { ...produtos[index], ...dadosAtualizados };
        localStorage.setItem('ratixpay_products', JSON.stringify(produtos));
        return produtos[index];
    }
    
    return null;
}

// Função para remover produto
function removerProduto(id) {
    const produtos = obterTodosProdutos();
    const produtosFiltrados = produtos.filter(produto => produto.id !== id);
    localStorage.setItem('ratixpay_products', JSON.stringify(produtosFiltrados));
    return produtosFiltrados;
}

// Função para obter estatísticas dos produtos
function obterEstatisticasProdutos() {
    const produtos = obterTodosProdutos();
    
    return {
        total: produtos.length,
        cursos: produtos.filter(p => p.type === 'curso').length,
        ebooks: produtos.filter(p => p.type === 'ebook').length,
        comAfiliados: produtos.filter(p => p.allowAffiliates).length,
        receitaTotal: produtos.reduce((total, p) => total + p.finalPrice, 0)
    };
}

// Inicializar produtos simulados quando o script for carregado
if (typeof window !== 'undefined') {
    inicializarProdutosSimulados();
}

