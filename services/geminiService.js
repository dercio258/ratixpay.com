const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
    constructor() {
        // Suportar ambas as variáveis de ambiente para compatibilidade
        this.apiKey = process.env.Google_gimine_key_api || 
                     process.env.GEMINI_API_KEY || 
                     'AIzaSyC2U7wos_ztcESqrFfCIHCdByEBMcbxpf0';
        
        if (!this.apiKey || this.apiKey === 'sua_chave_gemini_aqui') {
            console.warn('⚠️ Chave da API do Gemini não configurada. Configure Google_gimine_key_api no .env');
        } else {
            try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
                // Usar gemini-2.5-flash que é o modelo mais recente e estável
                this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                console.log('🤖 GeminiService inicializado com sucesso (modelo: gemini-2.5-flash)');
            } catch (error) {
                console.error('❌ Erro ao inicializar Gemini AI:', error.message);
                this.genAI = null;
                this.model = null;
            }
        }
        
        // Cache para treinamento de produtos
        this.cacheTreinamento = new Map();
    }

    /**
     * Verifica se um produto é aceitável usando moderação de conteúdo
     * @param {Object} produto - Dados do produto para verificação
     * @returns {Promise<Object>} - Resultado da verificação {aprovado: boolean, motivo?: string, score?: number}
     */
    async verificarProduto(produto) {
        try {
            // Verificar se a API está configurada
            if (!this.genAI || !this.model) {
                console.warn('⚠️ Gemini AI não configurado - produto será aprovado automaticamente');
                return {
                    aprovado: true,
                    motivo: null,
                    resposta_ia: 'Gemini AI não configurado',
                    score: 0
                };
            }

            // Garantir que estamos usando o modelo correto (gemini-2.5-flash)
            // Sempre recriar o modelo para garantir que está usando o modelo correto
            // Isso evita problemas com cache ou inicialização antiga
            try {
                console.log('🔄 Garantindo que o modelo está usando gemini-2.5-flash...');
                this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                console.log('✅ Modelo gemini-2.5-flash configurado corretamente');
            } catch (modelError) {
                console.error('❌ Erro ao configurar modelo gemini-2.5-flash:', modelError.message);
                // Tentar fallback para gemini-2.5-pro se gemini-2.5-flash falhar
                try {
                    console.log('🔄 Tentando fallback para gemini-2.5-pro...');
                    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
                    console.log('✅ Modelo gemini-2.5-pro configurado como fallback');
                } catch (fallbackError) {
                    console.error('❌ Erro ao configurar modelo fallback:', fallbackError.message);
                    throw modelError; // Lançar o erro original
                }
            }

            console.log('🔍 Verificando produto com Gemini AI:', produto.nome);
            
            const prompt = `
Você é um moderador de conteúdo especializado em produtos digitais para uma plataforma de vendas online.

Sua função é analisar produtos e determinar se são adequados para publicação na plataforma.

IMPORTANTE: Seja JUSTO e CONTEXTUAL. Não rejeite produtos legítimos por palavras ambíguas ou interpretações exageradas.
Considere o CONTEXTO COMPLETO antes de tomar uma decisão.

INSTRUÇÕES DE ANÁLISE:
1. Analise TODOS os campos: nome, descrição, tipo, categoria e links/arquivos
2. Considere o contexto completo - um nome sozinho pode ser ambíguo, mas a descrição pode esclarecer
3. Seja TOLERANTE com produtos educacionais, cursos, e-books e serviços digitais legítimos
4. Apenas rejeite se houver EVIDÊNCIA CLARA de violação das políticas
5. Produtos sobre saúde mental, bem-estar e educação são geralmente aceitos, desde que não promovam autolesão

CRITÉRIOS DE REJEIÇÃO (produto NÃO será aprovado APENAS se contiver EVIDÊNCIA CLARA de):
- Conteúdo que PROMOVE ativamente violência sexual ou exploração (não apenas menciona)
- Conteúdo que ENSINA ou PROMOVE burla, fraude ou golpes financeiros
- Esquemas de pirâmide financeira EXPLÍCITOS (não apenas marketing multinível legítimo)
- Conteúdo que INCITA diretamente ao suicídio ou autolesão (não apenas discute o tema educacionalmente)
- Incitação EXPLÍCITA à violência física ou crimes
- Venda de drogas ilegais ou substâncias controladas
- Venda de armas de fogo ou armas brancas
- Conteúdo de ódio, discriminação, racismo ou xenofobia EXPLÍCITOS
- Conteúdo adulto ou sexual EXPLÍCITO (não apenas referências educacionais)
- Qualquer forma de infração CLARA à lei
- Produtos que PROMETEM resultados IMPOSSÍVEIS de forma ENGANOSA

CRITÉRIOS DE APROVAÇÃO (produto SERÁ aprovado se):
- For um produto digital legítimo (curso, e-book, software, serviço digital, consultoria)
- Tiver descrição clara e honesta
- Não violar NENHUM dos critérios de rejeição acima de forma CLARA
- Estiver de acordo com as leis e regulamentações locais
- For educacional, informativo ou de entretenimento legítimo

FORMATO DE RESPOSTA:
Você DEVE responder APENAS em um dos seguintes formatos:

Se APROVADO:
"APROVADO"

Se REJEITADO:
"REJEITADO: [motivo claro e específico, mencionando qual campo causou a rejeição: nome, descrição, tipo, categoria ou conteúdo]"

Exemplos de respostas:
- "APROVADO"
- "REJEITADO: O nome do produto sugere conteúdo que incita ao suicídio"
- "REJEITADO: A descrição contém material que promove fraude financeira"
- "REJEITADO: O tipo/categoria indica venda de substâncias ilegais"

---

PRODUTO PARA ANÁLISE COMPLETA:

Nome: "${produto.nome || 'Não informado'}"
Tipo: "${produto.tipo || 'Não informado'}"
Categoria: "${produto.categoria || 'Não informada'}"
Descrição: "${produto.descricao || 'Não informada'}"
${produto.conteudo_link ? `Link do conteúdo: "${produto.conteudo_link}"` : ''}
${produto.conteudo_arquivo_nome ? `Nome do arquivo: "${produto.conteudo_arquivo_nome}"` : ''}

Analise TODOS os campos acima e responda APENAS com "APROVADO" ou "REJEITADO: [motivo claro]":
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let resultado = response.text().trim();
            
            // Normalizar resposta para maiúsculas para processamento
            resultado = resultado.toUpperCase();

            console.log('🤖 Resposta da IA:', resultado);

            // Processar resposta de forma mais robusta
            const aprovado = resultado.startsWith('APROVADO');
            let motivo = null;
            
            if (!aprovado) {
                // Extrair motivo da rejeição
                const match = resultado.match(/REJEITADO:\s*(.+)/i);
                motivo = match ? match[1].trim() : 'Produto não atende aos critérios da plataforma';
            }

            // Calcular score de confiança (0-100)
            const score = aprovado ? 100 : 0;

            console.log(`✅ Verificação concluída: ${aprovado ? '✅ APROVADO' : '❌ REJEITADO'}`);
            if (motivo) {
                console.log(`📝 Motivo da rejeição: ${motivo}`);
            }

            return {
                aprovado,
                motivo: motivo || null,
                resposta_ia: resultado,
                score: score,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Erro na verificação do produto com Gemini AI:', error);
            
            // Verificar se é erro de modelo não disponível ou erro de API
            const isModelError = error.message && (
                error.message.includes('404 Not Found') ||
                error.message.includes('is not found') ||
                error.message.includes('not supported')
            );
            
            // Se for erro de modelo/API, aprovar o produto para não bloquear o sistema
            // Mas registrar o erro para investigação
            if (isModelError) {
                console.warn('⚠️ Erro de modelo/API do Gemini - produto será aprovado automaticamente');
            return {
                aprovado: true,
                motivo: null,
                    erro: error.message,
                    resposta_ia: 'Erro de modelo/API - produto aprovado automaticamente',
                    score: 0,
                    timestamp: new Date().toISOString(),
                    warning: 'Verificação automática não disponível - produto aprovado por segurança'
                };
            }
            
            // Para outros erros, rejeitar o produto para segurança
            return {
                aprovado: false,
                motivo: `Erro na verificação automática: ${error.message}. Produto requer revisão manual.`,
                erro: error.message,
                resposta_ia: 'Erro na verificação - produto requer revisão manual',
                score: 0,
                timestamp: new Date().toISOString()
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
