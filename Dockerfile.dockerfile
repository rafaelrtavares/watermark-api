FROM node:20-slim

# Instala bibliotecas de imagem no Linux
RUN apt-get update && apt-get install -y \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

# EXPOSTA A PORTA 3028 PARA O EASYPANEL
EXPOSE 3028

CMD ["node", "index.js"]