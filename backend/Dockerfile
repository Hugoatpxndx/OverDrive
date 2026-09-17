# ============================================================
# Backend OverDrive (Express + MySQL)
# Node 22 LTS (necesario para mysql2/iconv-lite; Node 26 rompe libs)
# ============================================================
FROM node:22-alpine

WORKDIR /app

# Copiar manifiestos y fijar dependencias de producción
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copiar únicamente el código necesario (evita datos sensibles)
COPY server.js ./
COPY config ./config
COPY controllers ./controllers
COPY middlewares ./middlewares
COPY routes ./routes
COPY database ./database

# Ejecutar como usuario sin privilegios (la imagen node ya incluye "node")
USER node

EXPOSE 4000

CMD ["node", "server.js"]