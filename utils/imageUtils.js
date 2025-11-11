const fs = require('fs');
const path = require('path');

/**
 * Utilitários para manipulação de imagens
 */
const imageUtils = {
    /**
     * Converte um arquivo de imagem para string base64
     * @param {string} filePath - Caminho completo para o arquivo de imagem
     * @returns {Promise<string>} - String base64 da imagem
     */
    fileToBase64: async (filePath) => {
        try {
            // Verificar se o arquivo existe
            if (!fs.existsSync(filePath)) {
                throw new Error(`Arquivo não encontrado: ${filePath}`);
            }
            
            // Ler o arquivo como buffer
            const buffer = fs.readFileSync(filePath);
            
            // Determinar o tipo MIME com base na extensão
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            const mimeType = mimeTypes[ext] || 'application/octet-stream';
            
            // Converter para base64 e formatar como data URL
            const base64 = buffer.toString('base64');
            return `data:${mimeType};base64,${base64}`;
        } catch (error) {
            console.error('Erro ao converter imagem para base64:', error);
            throw error;
        }
    },
    
    /**
     * Verifica se uma string é uma imagem base64 válida
     * @param {string} base64String - String a ser verificada
     * @returns {boolean} - Verdadeiro se for uma imagem base64 válida
     */
    isBase64Image: (base64String) => {
        if (!base64String) return false;
        
        // Verificar formato básico de data URL para imagens
        const regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
        if (!regex.test(base64String)) return false;
        
        try {
            // Verificar se a parte base64 é válida
            const base64Data = base64String.split(',')[1];
            return !!base64Data;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * Migra imagens de arquivos para base64 no banco de dados
     * @param {Array} produtos - Lista de produtos a serem migrados
     * @param {string} uploadsDir - Diretório de uploads
     * @returns {Promise<number>} - Número de produtos atualizados
     */
    migrateImagesToBase64: async (produtos, uploadsDir) => {
        let atualizados = 0;
        
        for (const produto of produtos) {
            try {
                // Verificar se o produto tem uma URL de imagem que é um arquivo
                if (produto.imagemUrl && produto.imagemUrl.startsWith('/uploads/')) {
                    // Extrair o nome do arquivo
                    const fileName = produto.imagemUrl.split('/').pop();
                    const filePath = path.join(uploadsDir, fileName);
                    
                    // Converter para base64
                    const base64 = await imageUtils.fileToBase64(filePath);
                    
                    // Atualizar o produto
                    produto.imagemUrl = base64;
                    await produto.save();
                    
                    atualizados++;
                    console.log(`Produto ID ${produto.id} migrado para base64`);
                }
            } catch (error) {
                console.error(`Erro ao migrar imagem do produto ID ${produto.id}:`, error);
            }
        }
        
        return atualizados;
    }
};

module.exports = imageUtils;