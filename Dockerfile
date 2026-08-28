# Imagem oficial do Node.js LTS leve
FROM node:20-alpine AS builder

WORKDIR /app

# Copia dependências e instala
COPY package*.json ./
RUN npm ci

# Copia código e compila o front-end React
COPY . .
RUN npm run build

# Imagem final de produção
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copia arquivos necessários e o build do front-end
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000

CMD ["node", "server.js"]
