/**
 * Script de teste para Baileys com renderização de QR Code
 * 
 * Uso: node scripts/test-baileys.js [sessionId] [phoneNumber]
 * 
 * Exemplo:
 *   node scripts/test-baileys.js default 258867792543
 *   node scripts/test-baileys.js vendas-cliente 258867792543
 */

require('dotenv').config();
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');

// Forçar uso do Baileys para teste
process.env.USE_BAILEYS = 'true';

const whatsappManager = require('../services/whatsappManager');

async function testBaileys() {
    const sessionId = process.argv[2] || 'default';
    const testPhone = process.argv[3] || process.env.ADMIN_WHATSAPP || '258867792543';

    console.log('🧪 Testando Baileys WhatsApp Manager');
    console.log(`📱 Sessão: ${sessionId}`);
    console.log(`📞 Telefone de teste: ${testPhone}`);
    console.log('');

    try {
        // 1. Verificar se está usando Baileys
        console.log('1️⃣ Verificando se Baileys está ativo...');
        if (whatsappManager.isBaileys) {
            console.log('✅ Baileys está ativo!');
        } else {
            console.log('❌ Baileys não está ativo. Verifique USE_BAILEYS no .env');
            process.exit(1);
        }
        console.log('');

        // 2. Inicializar sessão
        console.log(`2️⃣ Inicializando sessão ${sessionId}...`);
        await whatsappManager.initialize(sessionId);
        console.log('✅ Sessão inicializada');
        console.log('');
        
        // Aguardar um pouco para o QR code ser gerado
        console.log('⏳ Aguardando QR code ser gerado...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('');

        // 3. Verificar status
        console.log('3️⃣ Verificando status da sessão...');
        let status = whatsappManager.getStatus(sessionId);
        console.log('Status:', JSON.stringify(status, null, 2));
        console.log('');

        // 4. Verificar e renderizar QR Code se necessário
        if (status.status === 'waiting_qr' || status.qrCode) {
            console.log('4️⃣ QR Code disponível!');
            console.log('');
            
            // Obter QR Code
            const qrData = whatsappManager.getQRCode(sessionId);
            let qrString = null;
            
            if (qrData && qrData.qrCode) {
                qrString = qrData.qrCode;
            } else if (status.qrCode) {
                qrString = status.qrCode;
            }
            
            if (qrString) {
                // Renderizar QR Code no terminal
                console.log('═══════════════════════════════════════════════════════');
                console.log('📱 ESCANEIE ESTE QR CODE COM SEU WHATSAPP');
                console.log('═══════════════════════════════════════════════════════');
                console.log('');
                
                // Renderizar no terminal
                qrcodeTerminal.generate(qrString, { small: true }, (qr) => {
                    console.log(qr);
                });
                
                console.log('');
                console.log('═══════════════════════════════════════════════════════');
                console.log('');
                
                // Salvar QR Code como imagem
                try {
                    const qrDir = path.join(__dirname, '../qr-codes');
                    await fs.mkdir(qrDir, { recursive: true });
                    
                    const qrFilePath = path.join(qrDir, `qr-${sessionId}-${Date.now()}.png`);
                    await QRCode.toFile(qrFilePath, qrString, {
                        width: 500,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    
                    console.log(`💾 QR Code salvo em: ${qrFilePath}`);
                    console.log('');
                } catch (error) {
                    console.warn('⚠️ Não foi possível salvar QR Code como imagem:', error.message);
                }
                
                // Aguardar conexão (máximo 5 minutos)
                console.log('⏳ Aguardando conexão (máximo 5 minutos)...');
                console.log('   (Escaneie o QR Code acima com seu WhatsApp)');
                console.log('');
                
                let attempts = 0;
                const maxAttempts = 60; // 5 minutos (5s * 60)
                
                while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const currentStatus = whatsappManager.getStatus(sessionId);
                    
                    if (currentStatus.isConnected) {
                        console.log('');
                        console.log('✅ Sessão conectada!');
                        break;
                    }
                    
                    attempts++;
                    if (attempts % 12 === 0) {
                        console.log(`⏳ Ainda aguardando... (${attempts * 5}s)`);
                    }
                }
                
                const finalStatus = whatsappManager.getStatus(sessionId);
                if (!finalStatus.isConnected) {
                    console.log('');
                    console.log('❌ Timeout aguardando conexão');
                    console.log('   Tente executar o script novamente.');
                    process.exit(1);
                }
            } else {
                console.log('⚠️ QR Code não disponível ainda. Aguardando...');
                console.log('');
                
                // Aguardar QR Code aparecer (máximo 60 segundos)
                let qrAttempts = 0;
                const maxQrAttempts = 12; // 60 segundos
                let qrString = null;
                
                while (qrAttempts < maxQrAttempts && !qrString) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const currentStatus = whatsappManager.getStatus(sessionId);
                    const currentQrData = whatsappManager.getQRCode(sessionId);
                    
                    if (currentQrData && currentQrData.qrCode) {
                        qrString = currentQrData.qrCode;
                    } else if (currentStatus.qrCode) {
                        qrString = currentStatus.qrCode;
                    }
                    
                    if (qrString) {
                        // QR Code apareceu, renderizar
                        console.log('');
                        console.log('═══════════════════════════════════════════════════════');
                        console.log('📱 ESCANEIE ESTE QR CODE COM SEU WHATSAPP');
                        console.log('═══════════════════════════════════════════════════════');
                        console.log('');
                        
                        qrcodeTerminal.generate(qrString, { small: true }, (qr) => {
                            console.log(qr);
                        });
                        
                        console.log('');
                        console.log('═══════════════════════════════════════════════════════');
                        console.log('');
                        
                        // Salvar como imagem
                        try {
                            const qrDir = path.join(__dirname, '../qr-codes');
                            await fs.mkdir(qrDir, { recursive: true });
                            const qrFilePath = path.join(qrDir, `qr-${sessionId}-${Date.now()}.png`);
                            await QRCode.toFile(qrFilePath, qrString, {
                                width: 500,
                                margin: 2
                            });
                            console.log(`💾 QR Code salvo em: ${qrFilePath}`);
                            console.log('');
                        } catch (error) {
                            console.warn('⚠️ Não foi possível salvar QR Code:', error.message);
                        }
                        
                        break;
                    }
                    
                    qrAttempts++;
                    console.log(`⏳ Aguardando QR Code... (${qrAttempts * 5}s)`);
                }
                
                if (!qrString) {
                    console.log('');
                    console.log('❌ QR Code não foi gerado após 60 segundos');
                    console.log('   Verifique os logs para mais informações.');
                    process.exit(1);
                }
                
                // Continuar aguardando conexão
                console.log('⏳ Aguardando conexão (máximo 5 minutos)...');
                console.log('   (Escaneie o QR Code acima com seu WhatsApp)');
                console.log('');
                
                let attempts = 0;
                const maxAttempts = 60;
                
                while (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const currentStatus = whatsappManager.getStatus(sessionId);
                    
                    if (currentStatus.isConnected) {
                        console.log('');
                        console.log('✅ Sessão conectada!');
                        break;
                    }
                    
                    attempts++;
                    if (attempts % 12 === 0) {
                        console.log(`⏳ Ainda aguardando... (${attempts * 5}s)`);
                    }
                }
                
                const finalStatus = whatsappManager.getStatus(sessionId);
                if (!finalStatus.isConnected) {
                    console.log('');
                    console.log('❌ Timeout aguardando conexão');
                    console.log('   Tente executar o script novamente.');
                    process.exit(1);
                }
            }
        } else if (status.isConnected) {
            console.log('4️⃣ Sessão já está conectada! ✅');
            console.log('');
        } else {
            console.log('4️⃣ Aguardando inicialização da sessão...');
            console.log('');
        }

        // 5. Enviar mensagem de teste
        console.log('5️⃣ Enviando mensagem de teste...');
        const testMessage = `🧪 *Teste Baileys*\n\n` +
            `Esta é uma mensagem de teste do Baileys WhatsApp Manager.\n` +
            `Sessão: ${sessionId}\n` +
            `Data: ${new Date().toLocaleString('pt-BR')}\n\n` +
            `Se você recebeu esta mensagem, o Baileys está funcionando corretamente! ✅`;
        
        const result = await whatsappManager.sendMessage(testPhone, testMessage, null, sessionId);
        console.log('Resultado:', JSON.stringify(result, null, 2));
        console.log('');

        // 6. Verificar estatísticas
        console.log('6️⃣ Estatísticas da sessão:');
        const finalStatus = whatsappManager.getStatus(sessionId);
        console.log('Estatísticas:', JSON.stringify(finalStatus.stats, null, 2));
        console.log('');

        // 7. Verificar todas as sessões (se Baileys)
        if (whatsappManager.isBaileys) {
            console.log('7️⃣ Status de todas as sessões:');
            const allStatus = whatsappManager.getAllSessionsStatus();
            console.log(JSON.stringify(allStatus, null, 2));
            console.log('');
        }

        console.log('✅ Teste concluído com sucesso!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Executar teste
testBaileys();

