const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAq56WV66j3T6Pgru2IlHJRMzCngVYmFNw'; // Chave de exemplo - substitua pela sua
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        
        // Cache para treinamento de produtos
        this.cacheTreinamento = new Map();
        
        console.log('🤖 GeminiService inicializado');
    }

    /**
     * Verifica se um produto é aceitável usando moderação de conteúdo
     * @param {Object} produto - Dados do produto para verificação
     * @returns {Promise<Object>} - Resultado da verificação {aprovado: boolean, motivo?: string}
     */
    async verificarProduto(produto) {
        try {
            console.log('🔍 Verificando produto:', produto.nome);
            
            const prompt = `
Prompt para Verificação de Produtos

Você é um assistente de moderação de produtos em uma loja virtual.
Sempre que receber informações de um produto (nome, descrição, link do arquivo ou nome do arquivo), você deve analisar e verificar se o produto é aceitável ou não.

Objetivo: Retorne apenas uma das opções:

"Sim" → Produto aprovado.

"Não" → Produto rejeitado (explique brevemente o motivo).

Critérios de rejeição (não aprovados):

Conteúdo sobre violência sexual
Conteúdo sobre burla ou fraude
Esquemas de pirâmide financeira
Conteúdo sobre suicídio
Incitação à violência
Incitação a crimes
Venda de drogas
Venda de armas de fogo
Conteúdo impróprio (ódio, discriminação, racismo, etc.)
Conteúdo adulto ou sexual explícito
Qualquer outra forma de infração da lei

Regras adicionais:

Não seja muito rigoroso em rejeitar (exemplo: se for apenas uma palavra ambígua que não representa risco real, aprove).
Caso rejeite (responda "Não"), explique de forma simples o motivo, indicando se foi pelo nome, link, descrição ou conteúdo.
Nunca devolva respostas longas, apenas:

"Sim" (produto aceito)

"Não – motivo" (produto rejeitado)

Exemplo de uso

Entrada:

Nome: "Relógio Digital Luxo"
Descrição: "Relógio masculino com mostrador LED."
Link: "https://exemplo.com/produtos/relogio123.jpg"

Saída:

Sim

Entrada:

Nome: "Curso rápido para fraudar cartões"
Descrição: "Aprenda a clonar cartões de crédito em minutos"
Arquivo: "cursofraude.pdf"

Saída:

Não – contém indícios de fraude (descrição e nome do arquivo)

---

Agora analise este produto:

Nome: "${produto.nome || 'Não informado'}"
Descrição: "${produto.descricao || 'Não informada'}"
${produto.conteudo_link ? `Link: "${produto.conteudo_link}"` : ''}
${produto.conteudo_arquivo_nome ? `Arquivo: "${produto.conteudo_arquivo_nome}"` : ''}
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const resultado = response.text().trim();

            console.log('🤖 Resposta da IA:', resultado);

            // Processar resposta
            const aprovado = resultado.toLowerCase().startsWith('sim');
            const motivo = aprovado ? null : resultado.replace(/^não\s*[-–]\s*/i, '').trim();

            console.log(`✅ Verificação concluída: ${aprovado ? 'APROVADO' : 'REJEITADO'}`);
            if (motivo) {
                console.log(`📝 Motivo: ${motivo}`);
            }

            return {
                aprovado,
                motivo: motivo || null,
                resposta_ia: resultado
            };

        } catch (error) {
            console.error('❌ Erro na verificação do produto:', error);
            
            // Em caso de erro, aprovar o produto para não bloquear o sistema
            return {
                aprovado: true,
                motivo: null,
                erro: error.message,
                resposta_ia: 'Erro na verificação - produto aprovado automaticamente'
            };
        }
    }

    /**
     * Gera descrição detalhada de um produto
     * @param {Object} produto - Dados básicos do produto
     * @returns {Promise<string>} - Descrição gerada pela IA
     */
    async gerarDescricaoProduto(produto) {
        try {
            console.log('🔄 Gerando descrição para produto:', produto.nome);
            
            const prompt = `
                Você é um especialista em marketing digital e vendas online. 
                Crie uma descrição detalhada e atrativa para o seguinte produto:

                Nome: ${produto.nome}
                Preço: ${produto.preco}
                Categoria: ${produto.categoria || 'Não especificada'}

                A descrição deve:
                1. Ser clara e objetiva (máximo 300 palavras)
                2. Responder às principais dúvidas dos clientes
                3. Destacar benefícios e características
                4. Incluir informações sobre como usar/beneficiar do produto
                5. Ser adequada para um chatbot de suporte
                6. Usar linguagem acessível e profissional

                Formato da resposta: Apenas a descrição, sem títulos ou formatação adicional.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const descricao = response.text();

            console.log('✅ Descrição gerada com sucesso');
            return descricao.trim();

        } catch (error) {
            console.error('❌ Erro ao gerar descrição do produto:', error);
            
            // Fallback: descrição básica
            return this.gerarDescricaoFallback(produto);
        }
    }

    /**
     * Gera resposta do chatbot para suporte
     * @param {string} pergunta - Pergunta do cliente
     * @param {Object} produto - Dados do produto comprado
     * @param {string} contexto - Contexto adicional
     * @returns {Promise<string>} - Resposta do chatbot
     */
    async gerarRespostaChatbot(pergunta, produto, contexto = '') {
        try {
            console.log('🔄 Gerando resposta do chatbot para:', pergunta.substring(0, 50) + '...');
            
            // Gerar contexto de treinamento
            const contextoTreinamento = await this.treinarChatbotComProduto(produto);
            
            const prompt = `
                Você é um assistente de suporte da RatixPay, especializado em ajudar clientes que compraram produtos digitais.
                
                ${contextoTreinamento}
                
                INFORMAÇÕES DA PÁGINA ATUAL:
                - Esta é a página de sucesso do pagamento
                - O cliente pode ver informações do produto comprado
                - Há um botão de download para acessar o conteúdo
                - Há informações de contato do vendedor
                - O cliente pode entrar em contato via WhatsApp
                - Há opções de suporte disponíveis
                
                PERGUNTA DO CLIENTE: ${pergunta}
                
                INSTRUÇÕES:
                1. Responda em NO MÁXIMO 50 palavras
                2. Seja direto, claro e objetivo
                3. NÃO use comprimentos excessivos como "Olá", "Oi", "Olá! Como posso ajudar?"
                4. NÃO use emojis nas respostas
                5. Vá direto ao ponto da pergunta
                6. Se perguntarem sobre download: explique que há um botão de download na página
                7. Se perguntarem sobre contato: mencione as opções de contato disponíveis na página
                8. Se perguntarem sobre outros produtos: "Só posso ajudar com o produto comprado"
                9. Se não souber algo específico, seja honesto mas ofereça alternativas
                10. Baseie suas respostas na descrição do produto e nas informações da página
                
                Resposta (máximo 20 palavras, direta e objetiva):
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let resposta = response.text().trim();

            // Garantir que a resposta não exceda 50 palavras
            const palavras = resposta.split(' ');
            if (palavras.length > 50) {
                resposta = palavras.slice(0, 50).join(' ') + '...';
            }

            console.log('✅ Resposta gerada:', resposta);
            return resposta;

        } catch (error) {
            console.error('❌ Erro ao gerar resposta do chatbot:', error);
            return "Desculpe, não consegui processar sua pergunta. Tente novamente.";
        }
    }

    /**
     * Gera descrição de fallback quando a IA falha
     * @param {Object} produto - Dados do produto
     * @returns {string} - Descrição básica
     */
    gerarDescricaoFallback(produto) {
        return `
            ${produto.nome} é um produto digital de alta qualidade que oferece excelente valor pelo investimento.
            
            Este produto foi cuidadosamente desenvolvido para atender às necessidades dos nossos clientes,
            proporcionando uma experiência única e satisfatória.
            
            Com preço acessível de ${produto.preco}, você terá acesso a conteúdo exclusivo e de qualidade.
            
            Para dúvidas sobre este produto, entre em contato com nosso suporte especializado.
        `.trim();
    }

    /**
     * Valida se a pergunta é sobre o produto específico
     * @param {string} pergunta - Pergunta do cliente
     * @param {Object} produto - Dados do produto
     * @returns {boolean} - Se a pergunta é relevante
     */
    validarPergunta(pergunta, produto) {
        const palavrasProduto = produto.nome.toLowerCase().split(' ');
        const perguntaLower = pergunta.toLowerCase();
        
        // Verifica se a pergunta menciona o produto específico
        const mencionaProduto = palavrasProduto.some(palavra => 
            palavra.length > 3 && perguntaLower.includes(palavra)
        );
        
        // Verifica se é uma pergunta sobre outros produtos
        const outrosProdutos = ['outro produto', 'outros produtos', 'produto diferente', 'outra coisa'];
        const perguntaOutrosProdutos = outrosProdutos.some(termo => 
            perguntaLower.includes(termo)
        );
        
        return mencionaProduto || !perguntaOutrosProdutos;
    }

    /**
     * Treina o chatbot com informações específicas do produto
     */
    async treinarChatbotComProduto(produto) {
        try {
            console.log('🎓 Treinando chatbot com produto:', produto.nome);
            
            // Verificar cache
            const cacheKey = `${produto.id}_${produto.nome}_${produto.descricao?.substring(0, 50)}`;
            if (this.cacheTreinamento.has(cacheKey)) {
                console.log('📋 Usando treinamento do cache');
                return this.cacheTreinamento.get(cacheKey);
            }
            
            // Analisar a descrição para extrair informações-chave
            const informacoesChave = await this.extrairInformacoesChave(produto);
            
            // Criar contexto de treinamento baseado na descrição
            const contexto = `
                CONTEXTO DE TREINAMENTO - PRODUTO: ${produto.nome}
                
                INFORMAÇÕES PRINCIPAIS:
                - Nome: ${produto.nome}
                - Descrição: ${produto.descricao}
                - Preço: MZN ${produto.preco}
                - Categoria: ${produto.categoria || 'Produto Digital'}
                - Tipo: ${produto.tipo || 'Digital'}
                
                INFORMAÇÕES-CHAVE EXTRAÍDAS:
                ${informacoesChave}
                
                INFORMAÇÕES DA PÁGINA DE SUCESSO:
                - O cliente está na página de confirmação de pagamento
                - Há um botão "Baixar Produto" para fazer download
                - Há informações de contato do vendedor
                - Há opções de suporte via WhatsApp
                - O cliente pode ver detalhes da transação
                
                INSTRUÇÕES PARA RESPOSTAS:
                1. Use estas informações para responder perguntas sobre o produto
                2. Se perguntarem sobre download: "Use o botão 'Baixar Produto' na página"
                3. Se perguntarem sobre contato: "Use as opções de contato disponíveis na página"
                4. Se perguntarem sobre características, benefícios ou conteúdo, baseie-se na descrição
                5. Seja direto e objetivo, sem comprimentos excessivos
                6. NÃO use emojis nas respostas
                7. Vá direto ao ponto da pergunta
            `;
            
            // Armazenar no cache
            this.cacheTreinamento.set(cacheKey, contexto);
            
            return contexto;
        } catch (error) {
            console.error('❌ Erro ao treinar chatbot:', error);
            return '';
        }
    }
    
    /**
     * Extrai informações-chave da descrição do produto
     */
    async extrairInformacoesChave(produto) {
        try {
            if (!produto.descricao || produto.descricao === 'Produto adquirido via RatixPay') {
                return 'Descrição básica disponível.';
            }
            
            const prompt = `
                Analise a descrição do produto e extraia as informações mais importantes:
                
                PRODUTO: ${produto.nome}
                DESCRIÇÃO: ${produto.descricao}
                
                Extraia e liste as informações-chave em formato de tópicos:
                - Características principais
                - Benefícios
                - Formato/conteúdo
                - Público-alvo
                - Diferenciais
                
                Seja conciso e objetivo. Máximo 5 tópicos.
            `;
            
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const informacoes = response.text().trim();
            
            console.log('🔍 Informações-chave extraídas:', informacoes.substring(0, 100) + '...');
            return informacoes;
            
        } catch (error) {
            console.error('❌ Erro ao extrair informações-chave:', error);
            return 'Descrição disponível para consulta.';
        }
    }

    /**
     * Gera perguntas para facilitar a criação da descrição do produto
     */
    async gerarPerguntasProduto({ nome, categoria, preco }) {
        try {
            const prompt = `
Você é um assistente especializado em criação de produtos digitais. 

Com base nas informações do produto:
- Nome: ${nome}
- Categoria: ${categoria}
- Preço: MZN ${preco}

Gere 5-7 perguntas específicas e práticas que um vendedor deve responder para criar uma descrição completa e atrativa do produto. 

As perguntas devem ajudar a:
1. Destacar os benefícios principais
2. Explicar o que o cliente vai receber
3. Mencionar características únicas
4. Incluir informações sobre formato/conteúdo
5. Destacar diferenciais competitivos

Formato: Retorne apenas as perguntas, uma por linha, numeradas de 1 a 7.

Exemplo:
1. Quais são os principais benefícios que este produto oferece ao cliente?
2. O que exatamente o cliente receberá após a compra?
3. Qual é o formato do conteúdo (PDF, vídeo, áudio, etc.)?
4. Há alguma garantia ou suporte oferecido?
5. Quem é o público-alvo ideal para este produto?
6. Existe algum diferencial único deste produto?
7. Há algum pré-requisito ou conhecimento necessário?

Responda apenas com as perguntas numeradas, sem explicações adicionais.
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const texto = response.text();
            
            // Dividir em perguntas individuais
            const perguntas = texto.split('\n')
                .filter(linha => linha.trim().length > 0)
                .filter(linha => /^\d+\./.test(linha.trim()))
                .map(linha => linha.replace(/^\d+\.\s*/, '').trim());
            
            return perguntas;
        } catch (error) {
            console.error('❌ Erro ao gerar perguntas do produto:', error);
            throw error;
        }
    }
}

module.exports = new GeminiService();
