FROM node:18-alpine

WORKDIR /app

# Solo dependencias primero (mejor cache)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copia el resto del código
COPY . .

# Cloud Run inyecta PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

# Arranque de TU servidor real (no el “index OK…”)
CMD ["node", "server/server.cjs"]
