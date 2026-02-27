const fastify = require('fastify')({ logger: true });
const sharp = require('sharp');
const axios = require('axios');

fastify.get('/watermark', async (request, reply) => {
    const { main, logo, pos = 'centro' } = request.query;

    if (!main || !logo) {
        return reply.status(400).send({ error: "Parâmetros 'main' e 'logo' são obrigatórios." });
    }

    // Mapeamento de posições para o Sharp
    const positions = {
        'centro': 'center',
        'cima': 'north',
        'baixo': 'south',
        'canto': 'southeast'
    };

    const selectedGravity = positions[pos] || 'center';

    try {
        // Busca as duas imagens simultaneamente
        const [mainRes, logoRes] = await Promise.all([
            axios.get(main, { responseType: 'arraybuffer' }),
            axios.get(logo, { responseType: 'arraybuffer' })
        ]);

        // Carrega os metadados da imagem principal para calcular o quadrado
        const mainImg = sharp(mainRes.data);
        const metadata = await mainImg.metadata();

        // Define o tamanho do quadrado baseado no maior lado (largura ou altura)
        const squareSize = Math.max(metadata.width, metadata.height);

        // Processa a logo: 30% da largura do novo quadrado (ajustável)
        const logoWidth = Math.floor(squareSize * 0.30);
        const processedLogo = await sharp(logoRes.data)
            .resize(logoWidth)
            .toBuffer();

        // Geração da imagem final
        const output = await mainImg
            .resize(squareSize, squareSize, {
                fit: 'contain', // Mantém a imagem inteira sem cortar
                background: { r: 255, g: 255, b: 255, alpha: 1 } // Fundo branco (Bordas)
            })
            .composite([{ 
                input: processedLogo, 
                gravity: selectedGravity,
                blend: 'over' 
            }])
            .png() // Converte para PNG para manter transparência da logo se houver
            .toBuffer();

        // Retorna a imagem processada
        reply.type('image/png').send(output);

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Erro ao processar as imagens. Verifique as URLs enviadas." });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3028, host: '0.0.0.0' });
        console.log("Servidor rodando em http://localhost:3028");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
