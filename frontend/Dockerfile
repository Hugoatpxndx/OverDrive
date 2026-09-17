# ============================================================
# Frontend OverDrive (Vite + React)
# Modo desarrollo accesible desde el host en http://localhost:5173
# ============================================================
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]