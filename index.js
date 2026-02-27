const fastify = require('fastify')({ logger: true });
const sharp = require('sharp');
const axios = require('axios');
const multipart = require('@fastify/multipart');

// Registra o plugin para suportar arquivos enviados pelo n8n
fastify.register(multipart, { attachFieldsToBody: true });

// Função central de processamento para evitar repetição de código
async function processWatermark(mainBuffer, logoUrl, selectedPos) {
    const logoRes = await axios.get(logoUrl, { responseType: 'arraybuffer' });
    const positions = { 'centro': 'center', 'cima': 'north', 'baixo': 'south', 'canto': 'southeast' };
    const gravity = positions[selectedPos] || 'center';

    const mainImg = sharp(mainBuffer);
    const metadata = await mainImg.metadata();
    const squareSize = Math.max(metadata.width, metadata.height);

    const logoWidth = Math.floor(squareSize * 0.30);
    const processedLogo = await sharp(logoRes.data).resize(logoWidth).toBuffer();

    return await mainImg
        .resize(squareSize, squareSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .composite([{ input: processedLogo, gravity }])
        .png()
        .toBuffer();
}

// 1. GET para Imegens com URLs
fastify.get('/watermark', async (request, reply) => {
    const { main, logo, pos = 'centro' } = request.query;
    if (!main || !logo) return reply.status(400).send({ error: "Faltam parâmetros." });

    try {
        const res = await axios.get(main, { responseType: 'arraybuffer' });
        const output = await processWatermark(res.data, logo, pos);
        reply.type('image/png').send(output);
    } catch (e) {
        reply.status(500).send({ error: "Erro no GET: " + e.message });
    }
});

// 2. POST para Imagens Binárias
fastify.post('/watermark', async (request, reply) => {
    try {
        const data = request.body;
        let mainBuffer;

        // Verifica se é arquivo binário ou URL no corpo do POST
        if (data.main && data.main.file) {
            mainBuffer = await data.main.toBuffer();
        } else {
            const res = await axios.get(data.main.value, { responseType: 'arraybuffer' });
            mainBuffer = res.data;
        }

        const output = await processWatermark(mainBuffer, data.logo.value, data.pos?.value || 'centro');
        reply.type('image/png').send(output);
    } catch (e) {
        reply.status(500).send({ error: "Erro no POST: " + e.message });
    }
});

fastify.listen({ port: 3028, host: '0.0.0.0' });
