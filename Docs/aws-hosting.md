# Guía de Hosting en AWS EC2 - OverDrive

## Resumen Rápido

1. Crear instancia EC2 (Ubuntu 24.04, t2.micro - gratis 12 meses)
2. Instalar Docker
3. Configurar GitHub Secrets
4. Hacer push → se despliega automáticamente

---

## Paso 1: Crear cuenta AWS

1. Ve a https://aws.amazon.com
2. Click "Create an AWS Account"
3. Necesitas tarjeta de crédito (Free Tier: t2.micro gratis por 12 meses)

## Paso 2: Crear instancia EC2

1. Ve a **EC2 Dashboard** → **Launch Instance**
2. Configura:
   - **Name**: `overdrive-server`
   - **OS Image**: Ubuntu 24.04 LTS (Free Tier eligible)
   - **Instance type**: `t2.micro` (1 vCPU, 1 GB RAM - gratis)
   - **Key pair**: Click "Create new key pair" → nombre: `overdrive-key` → descarga el `.pem`
   - **Network settings** → Edit:
     - **Allow SSH** (port 22): Source = "My IP"
     - **Allow HTTP** (port 80): Source = "Anywhere" (0.0.0.0/0)
     - **Allow custom TCP** (port 4000): Source = "Anywhere" (0.0.0.0/0)
   - **Storage**: 20 GB gp3
3. Click **Launch Instance**
4. Anota la **IPv4 Public IP** (ej: `54.210.123.45`)

## Paso 3: Conectarte y preparar el servidor

```bash
# En tu computadora
chmod 400 overdrive-key.pem

# Conectarte
ssh -i overdrive-key.pem ubuntu@54.210.123.45

# Dentro del servidor:
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl start docker

# Sal y vuelve a entrar para que el grupo tome efecto
exit
```

## Paso 4: Subir el código al servidor (alternativa manual)

Si no quieres configurar CI/CD automático, puedes subir manualmente:

```bash
# En tu computadora, desde la raíz del proyecto
scp -i overdrive-key.pem -r backend/ frontend/ compose.yaml docker-compose.prod.yml \
  ubuntu@54.210.123.45:/tmp/overdrive/

# Conectarte y levantar
ssh -i overdrive-key.pem ubuntu@54.210.123.45
cd /tmp/overdrive

# Editar docker-compose.prod.yml: cambiar IP_DE_TU_EC2 por tu IP real
sed -i 's/IP_DE_TU_EC2/54.210.123.45/g' docker-compose.prod.yml

# Levantar todo
docker compose -f docker-compose.prod.yml up -d --build

# Verificar
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | tail -5
```

## Paso 5: Configurar CI/CD automático (GitHub Actions)

Ve a GitHub → Tu repo → **Settings** → **Secrets and variables** → **Actions**

Agrega estos secrets:

| Secret | Descripción | Ejemplo |
|--------|-------------|---------|
| `EC2_HOST` | IP pública de EC2 | `54.210.123.45` |
| `EC2_SSH_KEY` | Contenido COMPLETO del archivo `.pem` | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |
| `EC2_USERNAME` | Usuario SSH | `ubuntu` |

### Cómo copiar el contenido del .pem:

```bash
# En tu computadora
cat overdrive-key.pem
# Copia TODO el contenido (incluyendo BEGIN y END)
# Pégalo en el secret EC2_SSH_KEY de GitHub
```

## Paso 6: Crear Spotify App para producción

1. Ve a https://developer.spotify.com/dashboard
2. Click "Create App"
3. Nombre: `OverDrive Production`
4. Redirect URIs: `http://54.210.123.45/api/spotify/callback`
5. Copia el **Client ID** y **Client Secret**

En el servidor, edita el archivo `.env` del backend:

```bash
ssh -i overdrive-key.pem ubuntu@54.210.123.45

# Crear .env del backend
cat > /tmp/overdrive/backend/.env << 'EOF'
PORT=4000
DB_HOST=db
DB_PORT=3306
DB_USER=overdrive_user
DB_PASS=2010
DB_NAME=overdrive
JWT_SECRET=overdrive-secret-production-change-me
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://54.210.123.45
SPOTIFY_CLIENT_ID=tu_client_id_aqui
SPOTIFY_CLIENT_SECRET=tu_client_secret_aqui
SPOTIFY_REDIRECT_URI=http://54.210.123.45/api/spotify/callback
EOF

# Editar docker-compose.prod.yml con tu IP real
sed -i 's/IP_DE_TU_EC2/54.210.123.45/g' docker-compose.prod.yml

# Reconstruir
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

## Paso 7: Verificar

```bash
# En el servidor
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs backend | tail -10

# Desde tu navegador
http://54.210.123.45

# Login admin
admin@overdrive.app / 8H8LrSK8qUhvuY7i6Ghs
```

## Cómo funciona el CI/CD automático

```
1. Tu haces push a main
2. GitHub Actions ejecuta:
   - Tests del backend (87+ tests)
   - Build del frontend
   - Análisis SonarQube (si configurado)
   - Smoke test en Docker
3. Si todo pasa → deploy automático a EC2:
   - Copia el código al servidor
   - Reconstruye los contenedores Docker
   - Aplica migraciones de BD
   - La app se actualiza en segundos
```

## URLs de la app en producción

| Servicio | URL |
|----------|-----|
| Frontend | `http://54.210.123.45` |
| Backend API | `http://54.210.123.45/api/...` |
| Spotify Callback | `http://54.210.123.45/api/spotify/callback` |

## Credenciales de prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin@overdrive.app | 8H8LrSK8qUhvuY7i6Ghs | Administrador |

## Comandos útiles

```bash
# Ver logs
docker compose -f docker-compose.prod.yml logs -f backend

# Reiniciar solo el backend
docker compose -f docker-compose.prod.yml restart backend

# Actualizar código y reconstruir
cd /tmp/overdrive
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Detener todo
docker compose -f docker-compose.prod.yml down

# Ver contenedores
docker compose -f docker-compose.prod.yml ps
```

## Costos estimados (Free Tier)

| Servicio | Costo | Notas |
|----------|-------|-------|
| EC2 t2.micro | $0/mes | Gratis por 12 meses |
| Almacenamiento 20GB | ~$2/mes | después de Free Tier |
| Tráfico | $0 | bajo volumen |
| **Total primer año** | **$0** | Free Tier |
| **Después** | **~$5-10/mes** | t2.micro + almacenamiento |

## Troubleshooting

### El frontend no carga
```bash
docker compose -f docker-compose.prod.yml logs frontend
# Si dice "no such file", el build falló
docker compose -f docker-compose.prod.yml build frontend --no-cache
```

### El backend no responde
```bash
docker compose -f docker-compose.prod.yml logs backend
# Verificar que la BD está corriendo
docker compose -f docker-compose.prod.yml ps db
```

### No puedo conectarme por SSH
```bash
# Verificar permisos del key
chmod 400 overdrive-key.pem
# Verificar que el security group permite SSH desde tu IP
```
