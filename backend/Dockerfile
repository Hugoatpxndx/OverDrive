FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY config ./config
COPY controllers ./controllers
COPY middlewares ./middlewares
COPY routes ./routes
COPY scripts ./scripts
COPY server.js ./

# Usuario sin privilegios (OWASP; no ejecutar como root)
RUN chown -R node:node /app
USER node

EXPOSE 4000

CMD ["node", "server.js"]