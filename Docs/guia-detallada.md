# OverDrive · Guia Detallada (explicacion paso a paso)

> Este documento explica **cada carpeta, cada archivo y cada concepto** como si
> no supieras nada. Ideal para explicarle al profe pieza por pieza.

---

## PARTE 1: QUE ES ESTO (en 1 minuto)

OverDrive es una **pagina web** donde los musicos intercambian "favores".
Un artista quiere que alguien ponga su cancion en una playlist de Spotify.
Un curador (el dueño de la playlist) decide si la acepta o no.

Para que no sea gratis para todos, usamos "tokens":
- El artista gasta 1 token para enviar su cancion.
- Si el curador la acepta, el token pasa a el (+1).
- Si la rechaza, el artista recupera su token.

Asi de simple.

---

## PARTE 2: QUE CARPETAS Y ARCHIVOS EXISTEN

```
OverDrive/
├── backend/                    ← El "cerebro" de la app (logica, base de datos, seguridad)
├── frontend/                   ← La "cara" de la app (lo que el usuario ve)
├── docs/                       ← Documentos, reportes, instrucciones
├── .github/workflows/ci.yml   ← El robot que corre pruebas automaticas
├── compose.yaml                ← Instrucciones para levantar todo con Docker
├── sonar-project.properties    ← Configuracion para analizar calidad del codigo
├── README.md                   ← Resumen del proyecto
└── .env.example                ← Plantilla de variables secretas
```

---

## PARTE 3: EL BACKEND (carpeta `backend/`)

El backend es el servidor. El usuario nunca lo ve directamente. El frontend
le manda peticiones y el backend responde con datos.

### `backend/server.js` — El jefe de todo

**Que hace:** Es el archivo que arranca el servidor Express. Cuando ejecutas
`node server.js`, este:
1. Carga las variables de entorno (credenciales, puertos).
2. Activa la seguridad (helmet, CORS, rate-limit).
3. Conecta las rutas (donde estan los endpoints).
4. Escucha en el puerto 4000.

**Por que importa:** Sin este archivo, el servidor no existe. Es como prender
la maquina.

### `backend/config/db.js` — La conexion a la base de datos

**Que hace:** Crea un "pool" ( grupo de conexiones) a MariaDB. Cuando el
backend necesita leer o guardar algo en la base de datos, usa este archivo.

**Que es un prepared statement:** En vez de escribir SQL como
`SELECT * FROM users WHERE id = 1`, escribimos:
```js
executeQuery('SELECT * FROM users WHERE id = ?', [1])
```
El `?` es un placeholder. La base de datos recibe la consulta y el dato por
separado, asi que **nunca se mezclan**. Esto previene ataques de inyeccion SQL.

**Ejemplo:** Si alguien escribe `' OR 1=1 --` como usuario, el prepared statement
lo trata como texto literal, no como codigo SQL. La consulta falla o no encuentra
nada, pero **no rompe nada**.

### `backend/config/spotify.js` — El cliente de Spotify

**Que hace:** Contiene todas las funciones para hablar con la API de Spotify:
- `buildAuthUrl`: genera el link para que el curador autorice su cuenta.
- `exchangeCode`: cambia el codigo de autorizacion por un token de acceso.
- `refreshAccessToken`: renueva el token cuando expira.
- `getMyPlaylists`: obtiene las playlists del curador.
- `addTracksToPlaylist`: agrega una cancion a una playlist real de Spotify.
- `getTrackApp`: valida si un track existe (Client Credentials Flow).
- `getTrack`: obtiene info de un track (nombre, artista, imagen).

**Que es OAuth 2.0:** Es un protocolo para que nuestra app acceda a Spotify
**sin pedir la contraseña** del usuario. El curador le da permiso a la app
una sola vez, y la app guarda un "token de acceso" que se renueva solo.

**Client Credentials Flow:** Es como OAuth pero sin usuario. La app se
identifica con su propio ID y contraseña (que Spotify nos dio cuando
registramos la app) y puede leer datos publicos como si un track existe.

### `backend/controllers/authController.js` — Login y registro

**Que hace:** Maneja todo lo relacionado con usuarios:
- **Registro**: recibe username, email y password. Hashea la contraseña con
  bcrypt (nunca la guarda en claro). Le da 3 tokens al nuevo usuario.
- **Login**: busca el usuario, compara la contraseña hasheada con bcrypt,
  y si todo esta bien, genera un JWT.
- **Verificacion de email**: genera un codigo de 6 digitos y lo "guarda".
  Cuando el usuario lo ingresa, marca su email como verificado.
- **`/me`**: devuelve los datos actuales del usuario (tokens frescos).

**Que es bcrypt:** Un algoritmo que convierte una contraseña en un texto
aparentemente random. `Admin123!` se convierte en algo como
`$2a$12$xawFLNM.Dd6VOolicX/dCuO0A1Fz/3bCRQIit/87/foPZgU1pbxwi`.
Aunque alguien vea la base de datos, **no puede saber la contraseña original**.

**Que es JWT (JSON Web Token):** Es como una credencial digital firmada.
Contiene: `{ id: 1, username: "admin", role: "administrador" }` + una firma
digital. El servidor la verifica en cada peticion para saber quien eres y
que rol tienes.

### `backend/controllers/submissionController.js` — El corazon del negocio

**Que hace:** Maneja el intercambio de canciones:
- **Enviar cancion (`POST /api/submissions`)**:
  1. Valida que el artista tenga tokens.
  2. Valida que la playlist exista y no sea suya.
  3. Valida el track contra Spotify (si no existe, rechaza).
  4. Descuenta 1 token del artista.
  5. Guarda la submission en la BD.
  6. Si es duplicado (409), reembolsa el token.

- **Aceptar (`POST /api/submissions/:id/accept`)**:
  1. Verifica que quien acepta es el dueño de la playlist.
  2. Cambia el estado a "aprobada".
  3. Da +1 token al curador.
  4. Agrega la cancion a la playlist real de Spotify.

- **Rechazar (`POST /api/submissions/:id/reject`)**:
  1. Verifica que quien rechaza es el dueño de la playlist.
  2. Cambia el estado a "rechazada".
  3. Devuelve 1 token al artista.

**El token es atomico:** El SQL dice `UPDATE users SET tokens = tokens - 1
WHERE id = ? AND tokens >= 1`. La condicion `WHERE tokens >= 1` asegura que
**nunca** queden tokens negativos, aunque 2 personas envien al mismo tiempo.

### `backend/controllers/spotifyController.js` — Integracion con Spotify

**Que hace:** Conecta la cuenta de Spotify del curador con la app:
- **`/api/spotify/auth-url`**: genera el link de autorizacion.
- **`/api/spotify/callback`**: recibe el codigo de Spotify y lo cambia por tokens.
- **`/api/spotify/playlists`**: importa las playlists del curador (nombre, url, seguidores).
- **`/api/spotify/track/:id`**: obtiene info de un track (nombre, artistas, generos, imagen).

### `backend/controllers/adminController.js` — Panel de administrador

**Que hace:** Devuelve la lista de todos los usuarios (sin contraseñas).
Solo un admin puede acceder.

### `backend/controllers/playlistController.js` — CRUD de playlists

**Que hace:** Permite crear playlists manualmente (nombre, URL, seguidores)
y listar todas las playlists disponibles.

### `backend/middlewares/auth.js` — El guardia de seguridad

**Que hace:** Verifica el JWT en cada peticion a rutas protegidas.
- `requireAuth`: verifica que haya un token valido.
- `isAdmin`: verifica que el rol sea "administrador".

Si el token no es valido o no hay token, responde 401 (No autorizado).

### `backend/routes/` — El mapa de rutas

Cada archivo define que endpoints existen y que controller los maneja:

| Archivo | Rutas | Controller |
|---------|-------|------------|
| `authRoutes.js` | `/api/auth/*` | authController |
| `submissionRoutes.js` | `/api/submissions/*` | submissionController |
| `playlistRoutes.js` | `/api/playlists` | playlistController |
| `spotifyRoutes.js` | `/api/spotify/*` | spotifyController |
| `adminRoutes.js` | `/api/admin/*` | adminController |

### `backend/database/schema.sql` — El plano de la base de datos

**Que hace:** Crea las tablas con sus columnas, tipos de dato y restricciones.

**Tablas principales:**
- `users`: id, username, email, password_hash, role, tokens, email_verified,
  verification_code, spotify tokens.
- `playlists`: id, user_id (quien la creo), spotify_id, name, spotify_url, followers.
- `submissions`: id, artist_id, playlist_id, track_url, track_name, status
  (pendiente/aprobada/rechazada), handled_by, created_at, updated_at.

**Restricciones importantes:**
- `CHECK (tokens BETWEEN 0 AND 10)`: nadie puede tener mas de 10 o menos de 0 tokens.
- `UNIQUE (artist_id, playlist_id, track_url)`: no puedes enviar el mismo track 2 veces
  a la misma playlist.
- `ENUM('pendiente','aprobada','rechazada')`: solo esos 3 estados posibles.

### `backend/database/migrations/` — Cambios a la BD

Son archivos SQL que se ejecutan despues del schema principal para agregar
columnas o tablas nuevas (ej: columnas de Spotify, verificacion de email).

### `backend/tests/` — Las pruebas automatizadas

Cada archivo testea una parte del sistema:

| Archivo | Que testea |
|---------|-----------|
| `auth.test.js` | Registro, login, JWT, roles, verificacion de email |
| `submission.test.js` | Enviar, aceptar, rechazar, tokens, validacion de tracks |
| `playlist.test.js` | CRUD de playlists |
| `spotify.test.js` | Integracion con Spotify (mockeada) |
| `controller-coverage.test.js` | Cubre code paths que los otros tests no alcanzan |

**Que es un mock:** Es un "simulacro". En vez de hablar con Spotify de verdad,
simulamos sus respuestas. Asi los tests funcionan sin internet y sin gastar
tokens reales de Spotify.

### `backend/jest.config.js` — Configuracion de tests

Define:
- Donde buscar los tests (`tests/**/*.test.js`).
- Donde medir cobertura (`controllers/`, `middlewares/`).
- Umbral minimo: 80% en statements, lines y functions; 65% en branches.

### `backend/package.json` — Lista de dependencias

Define que librerias usa el backend:
- **express**: framework web (crea rutas, maneja peticiones HTTP).
- **mysql2**: driver para conectarse a MariaDB/MySQL.
- **bcryptjs**: hashea contraseñas.
- **jsonwebtoken**: crea y verifica JWTs.
- **helmet**: agrega cabeceras de seguridad HTTP.
- **express-rate-limit**: limita cuantas peticiones puede hacer un usuario.
- **express-validator**: valida y sanitiza datos de entrada.
- **axios**: hace peticiones HTTP a la API de Spotify.
- **jest** / **supertest**: corrigen tests HTTP.

---

## PARTE 4: EL FRONTEND (carpeta `frontend/`)

El frontend es lo que el usuario ve en el navegador. Es una aplicacion
de una sola pagina (SPA) hecha en React.

### `frontend/src/main.jsx` — El punto de entrada

**Que hace:** Carga la app React y la monta en el HTML. Tambien:
- Aplica el tema (claro/oscuro) antes del primer render (evita parpadeo).
- Envuelve todo en `<BrowserRouter>` (para navegacion) y `<AuthProvider>`
  (para manejar el JWT).

### `frontend/src/App.jsx` — El mapa de navegacion

**Que hace:** Define que pagina se muestra segun la URL:
- `/login` → pagina de login
- `/register` → pagina de registro
- `/dashboard` → dashboard principal (protegido, necesita JWT)

### `frontend/src/context/AuthContext.jsx` — El estado global

**Que hace:** Guarda informacion que toda la app necesita:
- `user`: datos del usuario actual (id, username, tokens, etc.)
- `token`: el JWT (se guarda en `localStorage` del navegador).
- `modo`: 'artista' o 'curador'.
- `login()`, `register()`, `logout()`: funciones para manejar sesion.

**Que es Context:** Es como una "caja compartida". En vez de pasar datos
por todos los componentes uno por uno, se guardan aqui y cualquiera los lee.

### `frontend/src/pages/Login.jsx` — Pagina de inicio de saison

**Que hace:** Muestra un formulario con usuario/email y contraseña.
Al enviar, llama a `login()` del AuthContext que hace POST a `/api/auth/login`.

### `frontend/src/pages/Register.jsx` — Pagina de registro

**Que hace:** Muestra un formulario con username, email, password y confirmar.
Valida que el password tenga mayuscula, minuscula y numero.
Al enviar, llama a `register()` del AuthContext.

### `frontend/src/components/Dashboard.jsx` — La pantalla principal (780 lineas)

**Que hace:** Es el archivo mas grande. Muestra todo lo que el usuario puede
hacer dependiendo de su modo:

**Modo Artista:**
- Formulario para enviar cancion (seleccionar playlist + pegar URL).
- Lista de "Mis envios" con nombre, artista, fecha y estado.

**Modo Curador:**
- Boton para conectar/desconectar Spotify.
- Lista de "Mis playlists".
- Formulario para crear playlist manual.
- "Bandeja de entrada": propuestas recibidas con nombre, artista, fecha,
  boton de escuchar (reproductor embebido de Spotify), aceptar y rechazar.

**Panel de Admin:**
- Tabla con todos los usuarios, sus roles y tokens.

**Componentes especiales:**
- `ThemeToggle`: boton para cambiar entre modo claro y oscuro.
- Toast de confirmacion: cuando aceptas o rechazas, aparece un popup con
  el resultado.

### `frontend/src/components/ThemeToggle.jsx` — Modo oscuro/claro

**Que hace:** Un boton que alterna entre tema claro y oscuro.
Guarda la preferencia en `localStorage` para recordarla.

### `frontend/src/services/api.js` — El cliente HTTP

**Que hace:** Crea una instancia de axios con:
- URL base: `http://localhost:4000` (o el proxy de Vite en desarrollo).
- Header automatico `Authorization: Bearer <token>` en cada peticion.

### `frontend/src/index.css` — Los estilos (CSS)

**Que define:** Todos los colores, tamaños, fuentes, sombras, bordes, etc.
Incluye variables CSS para el tema claro y oscuro.

**Tema oscuro:** Se activa con `data-theme="dark"` en `<html>`.
Cambia todos los colores automaticamente.

### `frontend/package.json` — Dependencias del frontend

- **react** / **react-dom**: libreria para crear interfaces.
- **react-router-dom**: navegacion entre paginas (rutas).
- **axios**: cliente HTTP para hablar con el backend.
- **vite**: herramienta de desarrollo (compila, recarga automatica).

---

## PARTE 5: LA SEGURIDAD (OWASP)

OWASP es una organizacion que lista las fallas de seguridad mas comunes
en aplicaciones web. Asi es como las prevenimos:

### 1. Inyeccion SQL (OWASP A03)
**Que es:** Alguien escribe codigo SQL malicioso en un formulario para
robar o borrar datos.
**Como lo prevenimos:** Prepared statements. El SQL y los datos van por
separado, asi que el codigo malicioso se trata como texto normal.
**Donde:** `backend/config/db.js`

### 2. XSS (OWASP A07)
**Que es:** Alguien inyecta `<script>alert('hola')</script>` en un campo
y cuando otro usuario lo ve, se ejecuta el script.
**Como lo prevenimos:** `helmet` (cabeceras de seguridad), `express-validator`
con `.escape()` (convierte `<` en `&lt;`), sanitizacion de strings.
**Donde:** `backend/server.js`, controllers

### 3. Fuerza bruta (OWASP A07)
**Que es:** Alguien prueba miles de contraseñas hasta encontrar la correcta.
**Como lo prevenimos:** `express-rate-limit`: maximo 10 intentos de login
cada 15 minutos por IP. Despues responde 429 (Too Many Requests).
**Donde:** `backend/server.js`

### 4. Contraseñas expuestas (OWASP A02)
**Que es:** Alguien accede a la base de datos y ve las contraseñas.
**Como lo prevenimos:** Las contraseñas NUNCA se guardan en claro.
Se guardan hasheadas con bcrypt. Aunque vean la BD, no pueden saber
las contraseñas originales.
**Donde:** `backend/controllers/authController.js`

### 5. Informacion filtrada en errores (OWASP A05)
**Que es:** Un error muestra el "stack trace" completo, revelando como
esta hecha la app.
**Como lo prevenimos:** En produccion, los errores son genericos
("Error interno del servidor") sin detalles tecnicos.
**Donde:** todos los controllers

### 6. Payloads gigantes (OWASP A05)
**Que es:** Alguien manda un JSON de 1GB para colapsar el servidor.
**Como lo prevenimos:** `express.json({ limit: '10kb' })`. Si el body
es mas grande de 10 kilobytes, lo rechaza.
**Donde:** `backend/server.js`

---

## PARTE 6: CI/CD (el robot automatico)

### Que es CI?
**Integracion Continua:** Cada vez que haces `git push`, GitHub Actions
ejecuta automaticamente:
1. Instala las dependencias.
2. Corre los 87 tests.
3. Verifica que la cobertura sea >= 80%.
4. Compila el frontend.
5. Escanea vulnerabilidades en dependencias.
6. Analiza calidad con SonarQube.
7. Escanea seguridad con OWASP ZAP.

Si algo falla, ves un **icono rojo** en GitHub y no puedes mergear el codigo.

### Que es CD?
**Despliegue Continuo:** Cuando el codigo pasa todas las pruebas y haces
push a `main`, el robot:
1. Levanta una base de datos MySQL real.
2. Inicia el backend.
3. Hace un "smoke test" (health + login real).
4. Si todo esta bien, la app esta desplegada.

### El archivo `.github/workflows/ci.yml`

Tiene 6 "jobs" (tareas):

| Job | Que hace | Cuando corre |
|-----|----------|--------------|
| `backend-tests` | Corre Jest, valida cobertura | Siempre |
| `frontend-build` | Compila React | Siempre |
| `security-scan` | `npm audit` (vulnerabilidades) | Siempre |
| `sonarqube` | Analisis de calidad | Si hay secrets |
| `deploy` | Despliega + smoke test | Solo en push a main |
| `zap-scan` | Escaneo OWASP ZAP | Siempre |

---

## PARTE 7: DOCKER (como se levanta todo)

### Que es Docker?
Docker crea "contenedores" (cajas aisladas) donde corre cada parte:
- Un contenedor para MariaDB (base de datos).
- Otro para el backend (servidor Node.js).
- Otro para el frontend (servidor Vite/Nginx).

Asi no necesitas instalar MySQL, Node.js ni nada en tu computadora.
Docker lo hace todo.

### `compose.yaml` — Las instrucciones de Docker

Define:
- `db`: contenedor de MariaDB 11, puerto 3307, con esquema automatico.
- `backend`: contenedor de Node.js 22, puerto 4000.
- `frontend`: contenedor de Node.js 22, puerto 5173.

**Comandos:**
```bash
docker compose up -d --build    # levantar todo
docker compose down             # detener todo
docker compose down -v          # detener y borrar datos
docker compose logs -f          # ver logs en tiempo real
```

---

## PARTE 8: SONARQUBE (analisis de calidad)

### Que es SonarQube?
Es una herramienta que analiza tu codigo y te da una "calificacion":
- **A** = excelente
- **B** = bueno
- **C** = aceptable
- **D/F** = hay problemas

Mide: bugs, vulnerabilidades, "code smells" (malos olores del codigo),
duplicacion, y cobertura de tests.

### Como se usa?
```bash
./scripts/analisis-calidad.sh    # levanta SonarQube, corre tests, escanea
```
Despues abres `http://localhost:9000` y ves el reporte.

---

## PARTE 9: OWASP ZAP (pruebas de seguridad)

### Que es ZAP?
OWASP ZAP es un "atacante automatico". Apunta a tu URL y prueba
各种ataques: XSS, SQLi, headers mal configurados, etc.

### Como se usa?
```bash
# Con el backend corriendo en :4000
docker run --rm --network host \
  -v "$PWD/docs:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy:stable \
  zap-baseline.py \
  -t http://localhost:4000/api/health \
  -r zap-report.html
```

Genera `docs/zap-report.html` con los hallazgos.

---

## PARTE 10: VARIABLES DE ENTORNOS

### Que son?
Son valores secretos que el backend necesita para funcionar.
Nunca se suben a GitHub (por seguridad).

### `backend/.env` (no se sube a GitHub)
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=overdrive_user
DB_PASSWORD=2010
DB_NAME=overdrive
JWT_SECRET=mi_secreto_super_seguro
SPOTIFY_CLIENT_ID=abc123
SPOTIFY_CLIENT_SECRET=def456
SPOTIFY_REDIRECT_URI=http://127.0.0.1:4000/api/spotify/callback
CORS_ORIGIN=http://localhost:5173
```

### `.env.example` (si se sube a GitHub)
Es una plantilla sin valores reales. Sirve para que otros desarrolladores
sepan que variables necesitan configurar.

---

## PARTE 11: GLOSARIO SIMPLE

| Palabra | Que significa |
|---------|---------------|
| API | Un "meson de atencion" donde la app pide y da datos. |
| Endpoint | Una URL especifica (ej: `/api/submissions`). |
| JWT | Credencial digital firmada que identifica al usuario. |
| OAuth | Protocolo para dar permisos sin dar contraseñas. |
| bcrypt | Algoritmo que hashea contraseñas (las vuelve ilegibles). |
| Prepared statement | SQL con parametros separados (previene inyeccion). |
| Mock | Simulacro de un servicio real (para tests). |
| Cobertura | % de codigo que los tests logran ejecutar. |
| CI/CD | Robot que corre pruebas y despliega automaticamente. |
| Docker | Cajas aisladas donde corre cada parte de la app. |
| SonarQube | Herramienta que analiza calidad del codigo. |
| OWASP ZAP | Atacante automatico que prueba seguridad. |
| Rate limit | Limite de peticiones por tiempo (evita fuerza bruta). |
| Helmet | Libreria que agrega cabeceras de seguridad HTTP. |
| MariaDB | Base de datos (fork de MySQL, codigo abierto). |
| Express | Framework web para Node.js (crea servidores). |
| React | Libreria para crear interfaces de usuario. |
| Vite | Herramienta de desarrollo para React (rapido). |
| SPA | Single Page Application (una sola pagina que no recarga). |
| Git | Sistema de control de versiones (guarda historial de cambios). |
| GitHub | Sitio web donde se guarda el codigo y corre CI/CD. |
