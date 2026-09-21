# OverDrive 🎵

Plataforma web de **economía circular para músicos independientes**. Los usuarios intercambian espacios en playlists de Spotify usando **Tokens de Visibilidad**.

- **Modo Artista**: Gasta 1 token para enviar el enlace de su canción.
- **Modo Curador**: Al aceptar gana **1 token** del artista; al rechazar se lo **devuelve**.
- **Reglas**: Bono inicial de 3 tokens. Límite de 10 tokens (Wallet Cap).

---

## 🏗️ Estructura del Monorepo

```
OverDrive/
├── backend/                    # API REST con Express
│   ├── config/db.js           # Pool MySQL con Prepared Statements
│   ├── controllers/           # Lógica de negocio (auth, submissions)
│   ├── middlewares/auth.js    # Verificación JWT + Roles (isAdmin)
│   ├── routes/                # Endpoints de la API
│   ├── tests/                 # Pruebas unitarias (Jest + Supertest)
│   ├── database/schema.sql    # Esquema de MySQL/MariaDB
│   └── server.js              # Servidor seguro (helmet, cors, rate-limit)
├── frontend/                   # Aplicación React (Vite)
│   └── src/
│       ├── context/           # AuthContext (gestión del JWT)
│       ├── components/        # Dashboard
│       ├── pages/             # Login, Register
│       └── services/          # Cliente HTTP (axios)
├── .github/workflows/ci.yml   # Pipeline CI/CD
├── sonar-project.properties   # Configuración SonarQube
└── .env.example               # Variables de entorno (plantilla)
```

---

## 🚀 Instalación y Ejecución

### ⚠️ Versión de Node requerida

> **Usa una versión LTS de Node (20 o 22).** El driver `mysql2` usa `iconv-lite`, que aún no es
> totalmente compatible con Node 26 (versión "Current", no LTS). En Node 20/22 funciona sin problemas
> y es la versión que usa el pipeline de CI. Si tienes Node 26 instalado, instala una LTS con
> [nvm](https://github.com/nvm-sh/nvm):
>
> ```bash
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
> nvm install 22
> nvm use 22
> ```

### 1. Configurar la base de datos (MariaDB/MySQL)

```bash
# Crear la base de datos y el usuario (una sola vez)
mysql -u root -p < backend/database/schema.sql
```

> Esto crea la BD `overdrive`, las tablas y el usuario admin por defecto.

### 2. Configurar variables de entorno

```bash
# Crea tu archivo .env desde la plantilla del backend
cp backend/.env.example backend/.env
# Edita backend/.env con tus credenciales reales de MariaDB y tu JWT_SECRET
```

### 3. Instalar dependencias

```bash
# Backend
cd backend
npm install

# Frontend (otra terminal)
cd ../frontend
npm install
```

### 4. Ejecutar la aplicación

```bash
# Backend (puerto 4000)
cd backend
npm run dev

# Frontend (puerto 5173)
cd frontend
npm run dev
```

Abre **http://localhost:5173** en tu navegador.

### 5. Opción con Docker (todo en un comando)

> Requiere Docker + Docker Compose. Se levanta un stack con **MaríaDB + Backend + Frontend** en contenedores. Usa una base de datos *limpia* (volumen propio): los datos previos de tu MaríaDB local no se usan.

```bash
# Desde la raíz del proyecto
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f

# Detener los contenedores (conservando los datos de la BD)
docker compose down

# Detener y ELIMINAR la base de datos (arranque limpio)
docker compose down -v
```

| Servicio   | URL                  |
|------------|----------------------|
| Frontend   | http://localhost:5173 |
| Backend    | http://localhost:4000 (callback Spotify: `127.0.0.1:4000`) |
| MaríaDB    | `127.0.0.1:3307` (inspección opcional) |

> **Nota:** `MARIADB_PASSWORD` en `compose.yaml` debe coincidir con `DB_PASSWORD` de `backend/.env` (ambos `overdrive2010`). Si cambias uno, cambia el otro.
>
> **Importante:** detén antes los servicios locales (backend `:4000` y Vite `:5173`) para liberar los puertos, o usa `docker compose` cuando no estén corriendo.

### Credenciales del administrador

| Campo | Valor |
|-------|-------|
| Email | `admin@overdrive.app` |
| Contraseña | Consultar en `docs/credenciales-prueba.md` (se genera aleatoriamente y **no** se publica en el repo; `/Admin123!` del README antiguo **fue retirado** por seguridad). |

---

## 🎧 Probar el intercambio con Spotify (2 usuarios)

> **Importante**: la app **no permite** que un artista envíe canciones a su propia
> playlist, así que necesitas **2 cuentas** (una curadora y una artista).

Cuentas de prueba usadas para el demo:

| Correo (login)               | Rol sugerido | Estado Spotify |
|------------------------------|--------------|----------------|
| `overdrivespotify@gmail.com` | Curador      | ok             |
| `overdrivespotify2@yahoo.com`| Artista      | ok             |

> ⚠️ **Requisito de whitelist**: cada cuenta de Spotify que conecte la app debe estar
> agregada en el Dashboard de Spotify para desarrolladores → la app del proyecto →
> **"Users and access"** → agregar el correo de la cuenta. Si no, la Web API responde
> **403 Forbidden** al leer o escribir playlists (la app pide lectura + escritura).

Flujo:

1. **Curador**: crea/usa un usuario OverDrive, entra a **Modo Curador**, conecta la cuenta de
   Spotify y presiona **"Actualizar playlists"** para importar playlists.
2. **Artista**: con otro usuario OverDrive, entra a **Modo Artista** y envía el enlace de un
   track de Spotify a una playlist de la cuenta curadora (cuesta 1 token).
3. **Decidir como curador**: presiona **"Aceptar"** y la canción se agrega **de verdad** a la
   playlist: el token que el artista gastó al enviar **va a tu cuenta** (+1, tope 10). O presiona
   **"Rechazar"** y el artista **recupera su token** (reembolso de envío).

> Los pares de contraseñas de estas cuentas (correo y Spotify) y el resto de accesos
> locales se documentan en `docs/credenciales-prueba.md`, que por seguridad **se
> mantiene fuera del repositorio** (entregable local).

---

## 🧪 Pruebas Unitarias (Jest)

```bash
cd backend
npm test
```

Actualmente hay **87 tests** cubriendo autenticación, verificación de email, control de roles, envío/aceptación/rechazo de canciones (tokens), validación real del track en Spotify, playlists, integración con Spotify y rutas de administración. Cobertura real verificada: **statements 84.6%, branches 70.4%, functions 95.3%** (supera los umbrales: ≥80% statements/lines/functions y ≥65% branches). Los umbrales se definen en `backend/jest.config.js`.

---

## 🔒 Seguridad Implementada (OWASP)

| Amenaza | Mitigación |
|---------|-----------|
| XSS | `helmet`, `express-validator` (`.escape()`), sanitización de strings |
| Inyección SQL | **Prepared Statements** (`mysql2` con `connection.execute()`) |
| Fuerza Bruta | `express-rate-limit` en rutas de auth |
| Exposición de datos | `helmet` (cabeceras de seguridad HTTP) |
| CORS abusivo | Configuración estricta de `CORS_ORIGIN` |
| Payloads gigantes | Body parser limitado a `10kb` |
| Errores que filtran stack | Errores genéricos en producción |

---

## ⚙️ CI/CD (GitHub Actions)

El pipeline en `.github/workflows/ci.yml` ejecuta automáticamente en cada push/PR:

1. **backend-tests**: Instala, corre `npm test` y valida cobertura ≥80%.
2. **frontend-build**: Compila el frontend.
3. **security-scan**: Escaneo de vulnerabilidades (`npm audit`).
4. **sonarqube**: Análisis de calidad de código (opcional, requiere secrets).
5. **deploy**: Despliegue automático a un **entorno de prueba** con Docker Compose
   y *smoke test* (health + login JWT real). Se ejecuta en push a `main`.

### Secrets necesarios en GitHub

| Secret | Descripción |
|--------|-------------|
| `JWT_SECRET` | Clave secreta JWT |
| `SONAR_TOKEN` | Token de SonarQube (opcional) |
| `SONAR_HOST_URL` | URL de tu servidor SonarQube (opcional) |
| `SPOTIFY_CLIENT_ID` | Client ID de Spotify (opcional, para el deploy) |
| `SPOTIFY_CLIENT_SECRET` | Client Secret de Spotify (opcional, para el deploy) |

> La documentación de entrega (informe de cierre, presentación, métricas y
> reportes) se mantiene **fuera del repositorio** como entregable local.

---

## 📊 SonarQube

1. Configura las variables `SONAR_TOKEN` y `SONAR_HOST_URL` en GitHub Secrets.
2. Ejecuta localmente:

```bash
sonar-scanner
```

O automatízalo con el job `sonarqube` del CI.

### Ejecutar SonarQube localmente (Docker)

Se incluye un script que levanta SonarQube, corre las pruebas con cobertura y
ejecuta el escáner. Al terminar, abre `http://localhost:9000` (admin / `Overdrive2026!`).

```bash
./scripts/analisis-calidad.sh
```

### Escaneo de seguridad (OWASP ZAP)

Con el backend corriendo en `:4000`, genera un reporte de seguridad:

```bash
docker run --rm --network host -v "$PWD/docs:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable zap-baseline.py \
  -t http://localhost:4000/api/health -r zap-report.html
```

> El pipeline también ejecuta ZAP automáticamente (job `zap-scan`) y publica el
> reporte como artifact. Puedes descargarlo desde la ejecución de GitHub Actions.

---

## 🔑 Endpoints de la API

| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | `/api/auth/register` | Registrar nuevo usuario (bono 3 tokens + código de verificación) | Público |
| POST | `/api/auth/login` | Iniciar sesión (devuelve JWT) | Público |
| POST | `/api/auth/verify` | Verificar el email con el código de 6 dígitos | Autenticado |
| GET | `/api/auth/me` | Datos actuales del usuario (tokens frescos) | Autenticado |
| GET | `/api/health` | Estado del servidor | Público |
| POST | `/api/submissions` | Enviar canción (cuesta 1 token; valida el track en Spotify) | Autenticado |
| GET | `/api/submissions` | Listar mis propuestas | Autenticado |
| POST | `/api/submissions/:id/accept` | Aceptar propuesta (+1 token para el curador) | Curador |
| POST | `/api/submissions/:id/reject` | Rechazar propuesta (devuelve el token al artista) | Curador |
| GET | `/api/admin/users` | Listar usuarios (sin hashes) | Administrador |

---

## 👤 Roles del sistema

- **usuario**: Artistas y curadores. Acceso a envíos y aceptación.
- **administrador**: Panel de administración y control total.

Los roles se incrustan en el **JWT** y se verifican con el middleware `isAdmin` (`backend/middlewares/auth.js`).
