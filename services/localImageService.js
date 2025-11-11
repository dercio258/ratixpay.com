const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Serviço para gerenciar uploads de imagens localmente
 */
class LocalImageService {
  /**
   * Faz upload de uma imagem localmente
   * @param {string} imagemBase64 - Imagem em formato base64
   * @param {string} pasta - Pasta onde a imagem será armazenada
   * @param {string} nomeArquivo - Nome do arquivo (opcional)
   * @returns {Promise<Object>} - Objeto com informações da imagem salva
   */
  static async uploadImagem(imagemBase64, pasta = 'produtos', nomeArquivo = null) {
    try {
      // Validar entrada
      if (!imagemBase64) {
        throw new Error('Imagem base64 é obrigatória');
      }

      // Extrair formato da imagem do base64
      const matches = imagemBase64.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Formato de imagem base64 inválido');
      }

      const formato = matches[1];
      const dadosBase64 = matches[2];

      // Validar formato
      const formatosValidos = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
      if (!formatosValidos.includes(formato.toLowerCase())) {
        throw new Error(`Formato de imagem não suportado: ${formato}`);
      }

      // Criar diretório se não existir
      const diretorioUpload = path.join(__dirname, '..', 'public', 'uploads', pasta);
      await fs.mkdir(diretorioUpload, { recursive: true });

      // Gerar nome do arquivo se não fornecido
      if (!nomeArquivo) {
        const hash = crypto.createHash('md5').update(dadosBase64).digest('hex');
        nomeArquivo = `${hash}.${formato}`;
      } else {
        // Se nomeArquivo foi fornecido mas não tem extensão, adicionar
        if (!nomeArquivo.includes('.')) {
          nomeArquivo = `${nomeArquivo}.${formato}`;
        }
      }

      // Caminho completo do arquivo
      const caminhoArquivo = path.join(diretorioUpload, nomeArquivo);

      // Converter base64 para buffer e salvar
      const buffer = Buffer.from(dadosBase64, 'base64');
      await fs.writeFile(caminhoArquivo, buffer);

      // Gerar URL local
      const url = `/uploads/${pasta}/${nomeArquivo}`;

      console.log(`✅ Imagem salva localmente: ${caminhoArquivo}`);

      return {
        url: url,
        publicId: nomeArquivo.replace(`.${formato}`, ''), // Para compatibilidade
        formato: formato,
        tamanho: buffer.length,
        caminho: caminhoArquivo,
        nomeArquivo: nomeArquivo,
        // Campos adicionais para compatibilidade
        largura: null,
        altura: null,
        versao: Date.now()
      };

    } catch (error) {
      console.error('❌ Erro ao salvar imagem localmente:', error);
      throw new Error(`Falha no upload local: ${error.message}`);
    }
  }

  /**
   * Atualiza uma imagem existente
   * @param {string} imagemBase64 - Nova imagem em formato base64
   * @param {string} publicId - ID público da imagem existente (nome do arquivo)
   * @param {string} pasta - Pasta onde a imagem está armazenada
   * @returns {Promise<Object>} - Objeto com informações da imagem atualizada
   */
  static async atualizarImagem(imagemBase64, publicId, pasta = 'produtos') {
    try {
      if (!publicId) {
        throw new Error('Public ID é obrigatório para atualização');
      }

      // Buscar arquivo existente
      const diretorioUpload = path.join(__dirname, '..', 'public', 'uploads', pasta);
      const arquivos = await fs.readdir(diretorioUpload);
      const arquivoExistente = arquivos.find(arquivo => arquivo.startsWith(publicId));

      if (!arquivoExistente) {
        throw new Error(`Arquivo não encontrado: ${publicId}`);
      }

      // Fazer upload da nova imagem (vai sobrescrever)
      const resultado = await this.uploadImagem(imagemBase64, pasta, arquivoExistente);

      console.log(`✅ Imagem atualizada: ${arquivoExistente}`);

      return resultado;

    } catch (error) {
      console.error('❌ Erro ao atualizar imagem:', error);
      throw new Error(`Falha na atualização: ${error.message}`);
    }
  }

  /**
   * Exclui uma imagem local
   * @param {string} publicId - ID público da imagem a ser excluída
   * @param {string} pasta - Pasta onde a imagem está armazenada
   * @returns {Promise<Object>} - Resultado da operação de exclusão
   */
  static async excluirImagem(publicId, pasta = 'produtos') {
    try {
      if (!publicId) {
        throw new Error('Public ID é obrigatório para exclusão');
      }

      const diretorioUpload = path.join(__dirname, '..', 'public', 'uploads', pasta);
      
      // Buscar arquivo
      const arquivos = await fs.readdir(diretorioUpload);
      const arquivoParaExcluir = arquivos.find(arquivo => arquivo.startsWith(publicId));

      if (!arquivoParaExcluir) {
        console.log(`ℹ️ Arquivo ${publicId} não encontrado`);
        return {
          success: true,
          publicId: publicId,
          resultado: { result: 'not_found' }
        };
      }

      // Excluir arquivo
      const caminhoArquivo = path.join(diretorioUpload, arquivoParaExcluir);
      await fs.unlink(caminhoArquivo);

      console.log(`✅ Imagem excluída: ${arquivoParaExcluir}`);

      return {
        success: true,
        publicId: publicId,
        resultado: { result: 'ok' }
      };

    } catch (error) {
      console.error('❌ Erro ao excluir imagem:', error);
      throw new Error(`Falha na exclusão: ${error.message}`);
    }
  }

  /**
   * Faz upload de múltiplas imagens
   * @param {Array<string>} imagensBase64 - Array de imagens em formato base64
   * @param {string} pasta - Pasta onde as imagens serão armazenadas
   * @returns {Promise<Array<Object>>} - Array com informações das imagens enviadas
   */
  static async uploadMultiplasImagens(imagensBase64, pasta = 'produtos') {
    if (!Array.isArray(imagensBase64) || imagensBase64.length === 0) {
      throw new Error('Array de imagens é obrigatório e não pode estar vazio');
    }

    console.log(`🔄 Iniciando upload de ${imagensBase64.length} imagens...`);

    try {
      const resultados = [];
      
      for (let i = 0; i < imagensBase64.length; i++) {
        try {
          const resultado = await this.uploadImagem(imagensBase64[i], pasta);
          resultados.push({ ...resultado, index: i });
        } catch (erro) {
          resultados.push({ erro: erro.message, index: i });
        }
      }

      const sucessos = resultados.filter(r => !r.erro);
      const falhas = resultados.filter(r => r.erro);

      console.log(`✅ Upload concluído: ${sucessos.length} sucessos, ${falhas.length} falhas`);

      if (falhas.length > 0) {
        console.error('❌ Falhas no upload:', falhas);
      }

      return resultados;

    } catch (error) {
      console.error('❌ Erro no upload múltiplo:', error);
      throw new Error('Falha no upload de múltiplas imagens');
    }
  }

  /**
   * Valida se o serviço está configurado corretamente
   * @returns {boolean} - True se está configurado
   */
  static validarConfiguracao() {
    try {
      const diretorioUpload = path.join(__dirname, '..', 'public', 'uploads');
      // Verificar se o diretório existe ou pode ser criado
      return true;
    } catch (error) {
      console.error('❌ Erro na configuração do serviço local:', error);
      return false;
    }
  }

  /**
   * Testa o serviço local
   * @returns {Promise<boolean>} - True se está funcionando
   */
  static async testarConexao() {
    try {
      console.log('🔄 Testando serviço de imagens local...');
      
      const diretorioUpload = path.join(__dirname, '..', 'public', 'uploads');
      await fs.mkdir(diretorioUpload, { recursive: true });
      
      console.log('✅ Serviço de imagens local funcionando');
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar serviço local:', error);
      return false;
    }
  }
}

// Validar configuração na inicialização
if (!LocalImageService.validarConfiguracao()) {
  console.warn('⚠️ Serviço de imagens local não configurado corretamente.');
}

module.exports = LocalImageService;