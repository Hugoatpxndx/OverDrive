# OverDrive · Guía para explicar el proyecto (rubrica)

> Léela como un guion: cada sección = una pregunta típica del docente.
> Lo más seguro es explicar con tus palabras siguiendo el orden: idea → flujo → arquitectura → seguridad → CI/CD.

---

## 1) ¿Qué es OverDrive? (la idea, 1 minuto)

OverDrive es una **plataforma web de economía circular para músicos independientes**.
Usa una moneda de tokens llamada **Tokens de Visibilidad**:

- Un **artista** gasta **1 token** para enviar su canción a una playlist.
- Un **curador** (dueño de una playlist de Spotify) **acepta** o **rechaza** la propuesta.
- Al aceptar, la canción se agrega **de verdad** a la playlist de Spotify, y el token que pagó el artista **pasa al curador** (+1, tope de 10) como pago por publicarla.
- Al rechazar, el token **se devuelve al artista** (el envío no le cuesta nada).

**Reglas de negocio:**
- Bono inicial: 3 tokens por usuario nuevo.
- Tope: 10 tokens (implementado con un `CHECK` en la BD + `LEAST(tokens+1,10)`).
- No puedes enviar a tu **propia** playlist (obliga a usar 2 usuarios).
- No puedes enviar el mismo track 2 veces a la misma playlist (restricción `UNIQUE` → devuelve 409 y **reembolsa** el token).
- El email debe **verificarse** antes de poder enviar (código de 6 dígitos que simula un correo).
- Al enviar, el backend **valida el track contra la API real de Spotify** con el *Client Credentials Flow* (sin exigir que el artista conecte su cuenta): si la canción no existe, se rechaza la propuesta antes de gastar el token.

**Ejemplo para el profe:** imagina 2 usuarios. El artista tiene 3 tokens, envía un track (queda con 2). El curador acepta → el track aparece en la playlist real de Spotify y el token pasa al curador (+1). Si en su lugar lo rechaza, el artista recupera su token (vuelve a 3).

---

## 2) ¿Cómo está construido? (arquitectura)

**Monorepo** con dos carpetas (`backend/` y `frontend/`).

| Capa | Tecnología | Qué hace |
|------|-----------|----------|
| Frontend | **React + Vite** | Interfaz (login, dashboard, modos artista/curador, admin). |
| Backend | **Node.js + Express** | API REST (auth, propuestas, Spotify, admin). |
| Base de datos | **MariaDB (MySQL)** | Usuarios, playlists, propuestas, tokens de Spotify cifrados. |
| Autenticación | **JWT** | Token firmado que viaja en el header `Authorization: Bearer`. Guarda roles. |
| Integración | **API de Spotify (OAuth 2.0)** | Importar playlists y agregar canciones reales. |

**Cómo fluye una petición (ejemplo: login):**
```
React → POST /api/auth/login → Express → valida con bcrypt → genera JWT → responde
```
**Ejemplo de propuesta:**
```
Artista → POST /api/submissions {trackUrl, playlistId} → valida JWT + email verificado
→ valida el track en Spotify (Client Credentials) → resta 1 token
→ INSERT en submissions → (duplicado? → 409 + reembolso) → responde "Canción enviada"
```
**Flujo de propuesta (bandeja):**
```
Artista envía (‒1 token) → Curador ve canción, artista y fecha en su bandeja
→ Aceptar: +1 token al curador + canción agregada a Spotify (sync real)
→ Rechazar: +1 token al artista (reembolso)
→ En ambos casos queda registrado quién procesó y cuándo (auditoría)
```

---

## 3) ¿Qué archivo hace qué? (para ubicarte al exponer)

| Ruta | Rol |
|------|-----|
| `backend/server.js` | Levanta Express, cabeceras de seguridad (helmet), CORS, rate-limit. |
| `backend/config/db.js` | Pool de conexiones a MariaDB con **prepared statements**. |
| `backend/controllers/authController.js` | Registro/login, bcrypt, JWT, bono de 3 tokens, verificación de email. |
| `backend/controllers/submissionController.js` | Enviar/aceptar/rechazar propuestas, mover tokens, sync a Spotify, validación real del track. |
| `backend/controllers/spotifyController.js` | OAuth con Spotify: conectar, importar playlists, track info. |
| `backend/config/spotify.js` | Cliente de la API: auth URL, refresh tokens, agregar canciones, **Client Credentials Flow** (validar tracks). |
| `backend/middlewares/auth.js` | Verifica JWT y roles (`isAdmin`, `requireAuth`). |
| `backend/routes/` | Define los endpoints y conecta controllers. |
| `backend/database/schema.sql` | Esquema: tablas, índices, constraints (`CHECK`, `UNIQUE`). |
| `backend/tests/` | Tests automatizados (Jest + Supertest). |
| `frontend/src/components/Dashboard.jsx` | Pantalla principal: modos, formularios, bandeja, admin. |
| `frontend/src/context/AuthContext.jsx` | Guarda el JWT en el navegador. |
| `frontend/src/pages/` | Login y registro. |

---

## 4) ¿Qué son los tokens y cómo se mueven? (pregunta frecuente)

1. Registrar → te dan **3 tokens**.
2. Enviar canción → `UPDATE users SET tokens = tokens - 1 WHERE tokens >= 1` (atómico, evita concurrencia) al **artista**.
3. Aceptar → el token que pagó el artista se transfiere al **curador** (`LEAST(tokens + 1, 10)`).
4. Rechazar → el token **se devuelve al artista** (`LEAST(tokens + 1, 10)`).
5. Envío duplicado (409) → el token descontado se **reembolsa** automáticamente.
6. El tope de 10 tiene doble protección: `CHECK (tokens BETWEEN 0 AND 10)` en schema + `LEAST()` en código.

> Resumen para el profe: **quien decide recibe, quien no decide no pierde** (rechazo = gratuidad garantizada para el artista).

---

## 5) Seguridad (OWASP) — qué implementamos y por qué

| Amenaza | Qué hicimos | Dónde |
|---------|-------------|-------|
| **Inyección SQL** | Prepared statements (`.execute()` de mysql2), nunca concatenamos SQL. | `config/db.js` |
| **XSS** | `helmet`, `express-validator` con `.escape()`, inputs sanitizados. | `server.js`, controllers |
| **Fuerza bruta** | `express-rate-limit` en login/registro (máx 10 intentos / 15 min). | `server.js` |
| **Contraseñas** | Cifradas con **bcrypt** (nunca en claro). | `authController.js` |
| **Cuentas no verificadas** | El email debe verificarse (código de 6 dígitos) antes de poder enviar. | `authController.js` |
| **Enlaces falsos / tracks inexistentes** | El envío **valida el track contra la API real de Spotify** (*Client Credentials Flow*, sin token de usuario). Se rechaza antes de gastar el token. | `config/spotify.js`, `submissionController.js` |
| **Tokens de Spotify** | Cacheados en memoria / BD; refresh tokens para no pedir login cada hora. | `spotifyController.js` |
| **Payloads gigantes** | Límite de cuerpo a 10kb. | `server.js` |
| **Errores que filtran info** | Errores genéricos en producción (no mandamos stacks). | controllers |

**Ejemplo:** si alguien intenta `' OR 1=1 --` en el login, el prepared statement lo trata como texto literal; nunca se ejecuta. Si escribe password 50 veces rápido, el rate-limit responde 429.

---

## 6) Pruebas (Jest) — qué significa "cobertura"

- Corremos `cd backend && npm test`. Hay **87 tests** y pasan todos.
- Cobertura medida en % de líneas/funciones ejecutadas por los tests. Umbral mínimo configurado en `backend/jest.config.js` (**≥80%**).
- Qué cubren: autenticación (register/login), verificación de email (/auth/verify, correcciones e incorrectas), roles (artista vs curador vs admin), envío (descuento, duplicado 409 con reembolso, tokens insuficientes 402, **track inexistente en Spotify 400**, email sin verificar 403), aceptación (+1 al curador, sync a Spotify), rechazo (devolución de token), rutas admin, validación de IDs (404/400), y el flujo de Spotify mockeado.

> Para el profe: "del código que existe, los tests ejecutan el 85% de las líneas reales, y el pipeline falla si baja de 80%".

---

## 7) CI/CD — LA pregunta estrella, explicado simple

### ¿Qué es CI?
**Integración Continua**: cada vez que subes código a GitHub, un robot (GitHub Actions) **compila, corre las pruebas, revisa calidad y seguridad** automáticamente. Si algo falla, te avisa en rojo. Así ya no se rompe la app "sin querer".

### ¿Qué es CD?
**Despliegue Continuo**: cuando el código pasa las pruebas (push a `main`), el mismo robot **levanta la app automáticamente** en un entorno de prueba y hace un smoke test (¿está viva? ¿el login responde?).

### ¿De qué consta NUESTRO pipeline? (`.github/workflows/ci.yml`)

1. **backend-tests**: `npm install` + `npm test` + valida cobertura ≥80%.
2. **frontend-build**: compila el frontend de producción (`npm run build`).
3. **security-scan**: `npm audit` (busca dependencias con vulnerabilidades conocidas).
4. **sonarqube**: análisis de calidad de código (bugs, olores, duplicados) contra un servidor SonarQube.
5. **zap-scan**: escaneo de seguridad con **OWASP ZAP** (busca fallas HTTP como XSS/SQLi en la app desplegada).
6. **deploy**: despliega con Docker Compose y hace smoke test (health + login JWT real).

### ¿Cómo se usa / ve?
- Subes cambios: `git push`. Abres GitHub → pestaña **Actions** → ves cada job (verde ✅ / rojo ❌).
- Si un job falla, tienes los **logs** para ver qué pasó.
- El CI usa una **MariaDB real como servicio** (no fakearla) y corre en Node 22.

**Ejemplo:** un compañero rompe el login sin darse cuenta; cuando hace push, el job `backend-tests` falla en rojo, nadie puede mergear la rama sin arreglarlo, y la app de producción nunca se rompe porque `deploy` no dispara.

---

## 8) SonarQube y ZAP (calidad y seguridad extra)

- **SonarQube**: panel que da nota al código (bugs, vulnerabilidades, code smells, duplicación). Umbral de cobertura también se valida ahí. Se levanta con Docker en `localhost:9000`.
- **OWASP ZAP**: atacante automático que apunta a la URL de tu app y reporta hallazgos (XSS, SQLi, cabeceras). Genera `zap-report.html` que se sube como artifact del pipeline.

---

## 9) Endpoints principales (para mostrar)

| Método | Ruta | Para qué sirve | Acceso |
|--------|------|----------------|--------|
| POST | `/api/auth/register` | Crear usuario (bono 3 tokens + código de verificación) | Público |
| POST | `/api/auth/verify` | Verificar el email con el código de 6 dígitos | Autenticado |
| POST | `/api/auth/login` | Login → JWT | Público |
| GET | `/api/auth/me` | Datos del usuario (contador de tokens al día) | Autenticado |
| GET | `/api/health` | Saber si el back está vivo | Público |
| POST | `/api/submissions` | Enviar canción (cuesta 1 token, track validado en Spotify) | Autenticado |
| GET | `/api/submissions` | Mis propuestas | Autenticado |
| POST | `/api/submissions/:id/accept` | Aceptar (canción → Spotify, +1 token al curador) | Curador dueño |
| POST | `/api/submissions/:id/reject` | Rechazar (devuelve el token al artista) | Curador dueño |
| GET | `/api/spotify/auth-url` | URL para conectar Spotify | Autenticado |
| GET | `/api/spotify/track/:id` | Info del track (nombre, artista, carátula) | Autenticado |
| GET | `/api/spotify/playlists` | Importar/actualizar playlists del curador | Autenticado |
| GET | `/api/admin/users` | Listar usuarios (solo admin) | Administrador |

**Un ejemplo completito para la demo:**
```
1. Regístrate con 2 usuarios (A=artista, C=curador) y verifica los correos.
2. C conecta Spotify e importa su playlist.
3. A envía un track real (3→2 tokens).
4. C entra a la bandeja, ve canción/artista/fecha, escucha la canción completa, acepta.
5. El track aparece en la playlist real de Spotify y el token pasa al curador (+1 para C).
6. Si A envía un track falso, la app lo rechaza al instante (400) sin gastar token.
7. Admin entra y ve a todos los usuarios y sus tokens en el panel.
```

---

## 10) Glosario exprés

| Término | Significado simple |
|---------|--------------------|
| JWT | Tarjeta de identidad firmada que el servidor expide al hacer login. |
| OAuth 2.0 | Protocolo para que nuestra app acceda a Spotify SIN pedir tu contraseña (solo permisos). |
| Refresh token | Clave para renovar el acceso cuando expira, sin volver a autorizar. |
| Prepared statement | SQL enviado con parámetros separados → imposible inyectar. |
| Endpoint | Una URL de la API (ej. `/api/submissions`). |
| Cobertura | % de código que los tests logran ejecutar. |
| Artifact | Archivo que el pipeline publica (ej. el reporte ZAP). |
| Smoke test | Prueba mínima: "¿la app está viva y responde?" |