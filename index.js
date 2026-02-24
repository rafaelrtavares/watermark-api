const fastify = require('fastify')({ logger: true });
const sharp = require('sharp');
const axios = require('axios');

fastify.get('/watermark', async (request, reply) => {
    const { main, logo, pos = 'centro' } = request.query;

    if (!main || !logo) {
        return reply.status(400).send({ error: "Parâmetros 'main' e 'logo' são obrigatórios." });
    }

    // Mapeamento de posições amigáveis para o Sharp (Gravity)
    const positions = {
        'centro': 'center',
        'cima': 'north',
        'baixo': 'south',
        'canto': 'southeast' // Canto inferior direito
    };

    const selectedGravity = positions[pos] || 'center';

    try {
        const [mainRes, logoRes] = await Promise.all([
            axios.get(main, { responseType: 'arraybuffer' }),
            axios.get(logo, { responseType: 'arraybuffer' })
        ]);

        const mainImg = sharp(mainRes.data);
        const metadata = await mainImg.metadata();

        // Logo proporcional (20% da largura da imagem principal)
        const logoWidth = Math.floor(metadata.width * 0.35);
        
        const processedLogo = await sharp(logoRes.data)
            .resize(logoWidth)
            .toBuffer();

        const output = await mainImg
            .composite([{ 
                input: processedLogo, 
                gravity: selectedGravity,
                blend: 'over' 
            }])
            .png()
            .toBuffer();

        reply.type('image/png').send(output);

    } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: "Erro ao processar as imagens." });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3028, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
